// STACQ Daily — daglig nyhetsforside drevet av Perplexity Sonar.
// Kjøres via cron (04:30 UTC) eller on-demand fra frontend.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { sourceForUrl, tierForUrl } from "./sources.ts";
import { aggregateHeatTiers, type Tier } from "./heat.ts";
import {
  baseWeightFor,
  dedupAndMerge,
  matchesCompanyName,
  passesQuality,
  scoreItem,
  type RawItem,
  type ScoringContext,
} from "./scoring.ts";
import { resolveAndMirrorImage } from "./images.ts";

const HARD_CAP_BATCHES = 30;
const BATCH_SIZE = 10;
const MIN_ITEMS_FOR_OK = 6;
const TARGET_AFTER_PASS_1 = 12;

interface CompanyRow {
  id: string;
  name: string;
  website: string | null;
  org_number: string | null;
  status: string | null;
}

interface ContactRow {
  id: string;
  company_id: string | null;
  ikke_aktuell_kontakt: boolean | null;
  next_review_at: string | null;
}

interface ActivityRow {
  contact_id: string | null;
  description: string | null;
  created_at: string;
}

interface NewsItemOut {
  id: string;
  variant: "lead" | "feature" | "brief";
  primary_company_id: string;
  primary_company_name: string;
  also_matched_company_ids: string[];
  also_matched_company_names: string[];
  title: string;
  ingress: string | null;
  url: string;
  source: string;
  source_tier: 1 | 2 | 3;
  published_at: string;
  image: { url: string | null; source: "og" | "company_logo" | "placeholder" };
  score: number;
}

const SIGNAL_KEYWORDS = ["Behov nå", "Får fremtidig behov", "Får kanskje behov", "Ukjent om behov", "Ikke aktuelt"];

function extractSignal(description: string | null): string | null {
  if (!description) return null;
  for (const k of SIGNAL_KEYWORDS) {
    if (description.includes(k)) return k;
  }
  return null;
}

async function callPerplexity(
  apiKey: string,
  companies: CompanyRow[],
  recencyFilter: "day" | "week",
): Promise<RawItem[]> {
  const list = companies
    .map((c) => `- ${c.name}${c.website ? ` (${c.website})` : ""}${c.org_number ? ` [org ${c.org_number}]` : ""}`)
    .join("\n");

  const prompt = `Finn nylige norske nyhetsartikler (siste ${recencyFilter === "day" ? "24 timer" : "uke"}) om disse selskapene. Returner KUN saker som eksplisitt nevner selskapet ved navn, fra norske nyhetskilder (e24.no, dn.no, finansavisen.no, tu.no, digi.no, nrk.no, aftenposten.no, kapital.no, hegnar.no, shifter.no).

Selskaper:
${list}

For hver sak, oppgi: company_name (eksakt fra listen), title, ingress (1-2 setninger på norsk), url (full URL), published_at (ISO 8601).`;

  const body = {
    model: "sonar",
    messages: [
      { role: "system", content: "Du er en presis nyhets-aggregator for B2B-salgsteam. Returner kun verifiserbare saker fra norske kilder." },
      { role: "user", content: prompt },
    ],
    search_recency_filter: recencyFilter,
    search_domain_filter: ["e24.no", "dn.no", "finansavisen.no", "tu.no", "digi.no", "nrk.no", "aftenposten.no", "kapital.no", "hegnar.no", "shifter.no"],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "news_items",
        schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  company_name: { type: "string" },
                  title: { type: "string" },
                  ingress: { type: "string" },
                  url: { type: "string" },
                  published_at: { type: "string" },
                },
                required: ["company_name", "title", "url", "published_at"],
              },
            },
          },
          required: ["items"],
        },
      },
    },
  };

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Perplexity ${res.status}: ${txt.slice(0, 200)}`);
      }
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) return [];
      const parsed = JSON.parse(content);
      const items = parsed.items ?? [];

      const out: RawItem[] = [];
      for (const it of items) {
        const company = companies.find((c) => c.name.toLowerCase() === String(it.company_name ?? "").toLowerCase());
        if (!company) continue;
        if (!it.url || !it.title) continue;
        out.push({
          url: it.url,
          title: it.title,
          ingress: it.ingress ?? null,
          source: sourceForUrl(it.url),
          source_tier: tierForUrl(it.url),
          published_at: it.published_at ?? new Date().toISOString(),
          primary_company_id: company.id,
          primary_company_name: company.name,
          also_matched_company_ids: [],
          also_matched_company_names: [],
          image_url: null,
        });
      }
      return out;
    } catch (err) {
      lastError = err;
      const wait = attempt === 0 ? 1000 : 4000;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  console.error("[perplexity] batch failed after retries:", lastError);
  return [];
}

function pickItems(scored: Array<{ item: RawItem; score: number }>): {
  lead: { item: RawItem; score: number } | null;
  features: Array<{ item: RawItem; score: number }>;
  briefs: Array<{ item: RawItem; score: number }>;
} {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const lead = sorted[0] ?? null;
  const features = sorted.slice(1, 7);
  const briefs = sorted.slice(7, 12);
  return { lead, features, briefs };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const runId = crypto.randomUUID();
  const startedAt = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) {
      return new Response(JSON.stringify({ error: "PERPLEXITY_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Hent selskaper (DB-statuser: prospect, customer, partner, churned)
    const { data: companies, error: cErr } = await supabase
      .from("companies")
      .select("id, name, website, org_number, status")
      .in("status", ["prospect", "customer"]);
    if (cErr) throw cErr;
    const companyList = (companies ?? []) as CompanyRow[];

    // Map status: customer = "Kunde" (vekt 1.2), prospect = "Potensiell kunde" (vekt 0.6)
    const baseWeight = new Map<string, number>();
    for (const c of companyList) {
      const eff = c.status === "customer" ? "Kunde" : "Potensiell kunde";
      baseWeight.set(c.id, baseWeightFor(eff));
    }

    // 2. Hent kontakter + siste aktivitet → heat tier per selskap
    const companyIds = companyList.map((c) => c.id);
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, company_id, ikke_aktuell_kontakt")
      .in("company_id", companyIds);

    const contactIds = (contacts ?? []).map((c) => c.id);
    const { data: activities } = await supabase
      .from("activities")
      .select("contact_id, description, created_at")
      .in("contact_id", contactIds)
      .order("created_at", { ascending: false })
      .limit(2000);

    // Per kontakt: nyeste aktivitet → signal + alder
    const latestByContact = new Map<string, ActivityRow>();
    for (const a of (activities ?? []) as ActivityRow[]) {
      if (!a.contact_id) continue;
      if (!latestByContact.has(a.contact_id)) latestByContact.set(a.contact_id, a);
    }

    const now = Date.now();
    const contactSignals = (contacts ?? []).map((c) => {
      const latest = latestByContact.get(c.id);
      const days = latest
        ? Math.floor((now - new Date(latest.created_at).getTime()) / 86_400_000)
        : 999;
      return {
        company_id: c.company_id ?? "",
        signal: extractSignal(latest?.description ?? null),
        days_since_last_activity: days,
        ikke_aktuell: !!c.ikke_aktuell_kontakt,
      };
    });
    const heatTier = aggregateHeatTiers(contactSignals);

    const heatTierDistribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0 };
    for (const t of heatTier.values()) heatTierDistribution[String(t)]++;

    // 3. Sortér selskaper: varmest først → de bestem rekkefølgen i batchene
    const sortedCompanies = [...companyList].sort((a, b) => {
      const ta: Tier = heatTier.get(a.id) ?? 4;
      const tb: Tier = heatTier.get(b.id) ?? 4;
      return ta - tb;
    });

    // 4. Pass 1 — siste 24t
    let batchesUsed = 0;
    const allRaw: RawItem[] = [];
    for (let i = 0; i < sortedCompanies.length && batchesUsed < HARD_CAP_BATCHES; i += BATCH_SIZE) {
      const batch = sortedCompanies.slice(i, i + BATCH_SIZE);
      const items = await callPerplexity(PERPLEXITY_API_KEY, batch, "day");
      allRaw.push(...items);
      batchesUsed++;
    }

    const ctx: ScoringContext = { baseWeight, heatTier };
    const aliasByCompany = new Map<string, string[]>();
    for (const c of companyList) aliasByCompany.set(c.id, [c.name]);

    function scoreFiltered(raw: RawItem[]) {
      const merged = dedupAndMerge(raw);
      const filtered = merged.filter((it) => {
        const aliases = aliasByCompany.get(it.primary_company_id) ?? [];
        return matchesCompanyName(it, aliases);
      });
      const scored = filtered.map((item) => ({ item, score: scoreItem(item, ctx) }));
      return scored.filter((s) => passesQuality(s.item, s.score));
    }

    let scored = scoreFiltered(allRaw);

    // 5. Pass 2 — utvid til siste uke hvis < 12
    let fallbackUsed = false;
    if (scored.length < TARGET_AFTER_PASS_1 && batchesUsed < HARD_CAP_BATCHES) {
      fallbackUsed = true;
      for (let i = 0; i < sortedCompanies.length && batchesUsed < HARD_CAP_BATCHES; i += BATCH_SIZE) {
        const batch = sortedCompanies.slice(i, i + BATCH_SIZE);
        const items = await callPerplexity(PERPLEXITY_API_KEY, batch, "week");
        allRaw.push(...items);
        batchesUsed++;
      }
      scored = scoreFiltered(allRaw);
    }

    // 6. Empty?
    if (scored.length < MIN_ITEMS_FOR_OK) {
      await supabase
        .from("news_daily")
        .update({ is_current: false })
        .eq("date", today)
        .eq("is_current", true);

      await supabase.from("news_daily").insert({
        date: today,
        payload: { items: [], generated_at: new Date().toISOString(), generation_version: "v1" },
        status: "empty",
        source_count: 0,
        company_count: companyList.length,
        warnings: [{ msg: "Ikke nok kvalifiserte saker", count: scored.length }],
      });

      console.log(JSON.stringify({
        run_id: runId,
        status: "empty",
        batches_called: batchesUsed,
        items_returned: scored.length,
        fallback_used: fallbackUsed,
        heat_tier_distribution: heatTierDistribution,
        elapsed_ms: Date.now() - startedAt,
      }));

      return new Response(JSON.stringify({ status: "empty", items: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. Pick + bilder
    const picked = pickItems(scored);
    const itemsOut: NewsItemOut[] = [];
    const companyById = new Map(companyList.map((c) => [c.id, c]));

    async function buildItem(
      entry: { item: RawItem; score: number },
      variant: "lead" | "feature" | "brief",
    ): Promise<NewsItemOut> {
      const id = `${variant}-${crypto.randomUUID().slice(0, 8)}`;
      const company = companyById.get(entry.item.primary_company_id);
      const includeImage = variant !== "brief";
      const image = includeImage
        ? await resolveAndMirrorImage({
            supabase,
            itemId: id,
            date: today,
            pageUrl: entry.item.url,
            companyWebsite: company?.website ?? null,
            companyName: entry.item.primary_company_name,
          })
        : { url: null, source: "placeholder" as const };

      return {
        id,
        variant,
        primary_company_id: entry.item.primary_company_id,
        primary_company_name: entry.item.primary_company_name,
        also_matched_company_ids: entry.item.also_matched_company_ids,
        also_matched_company_names: entry.item.also_matched_company_names,
        title: entry.item.title,
        ingress: variant === "brief" ? null : entry.item.ingress,
        url: entry.item.url,
        source: entry.item.source,
        source_tier: entry.item.source_tier,
        published_at: entry.item.published_at,
        image,
        score: entry.score,
      };
    }

    if (picked.lead) itemsOut.push(await buildItem(picked.lead, "lead"));
    for (const f of picked.features) itemsOut.push(await buildItem(f, "feature"));
    for (const b of picked.briefs) itemsOut.push(await buildItem(b, "brief"));

    // 8. Lagre
    await supabase
      .from("news_daily")
      .update({ is_current: false })
      .eq("date", today)
      .eq("is_current", true);

    const uniqueCompanies = new Set(itemsOut.map((i) => i.primary_company_id)).size;

    const { error: insErr } = await supabase.from("news_daily").insert({
      date: today,
      payload: { items: itemsOut, generated_at: new Date().toISOString(), generation_version: "v1" },
      status: "ok",
      source_count: itemsOut.length,
      company_count: uniqueCompanies,
      warnings: [],
    });
    if (insErr) throw insErr;

    console.log(JSON.stringify({
      run_id: runId,
      status: "ok",
      batches_called: batchesUsed,
      items_returned: itemsOut.length,
      fallback_used: fallbackUsed,
      heat_tier_distribution: heatTierDistribution,
      elapsed_ms: Date.now() - startedAt,
    }));

    return new Response(JSON.stringify({ status: "ok", items: itemsOut.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[news-daily-digest] error run=${runId}:`, msg);
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await supabase.from("news_daily").insert({
        date: today,
        payload: { items: [], generated_at: new Date().toISOString(), generation_version: "v1" },
        status: "error",
        source_count: 0,
        company_count: 0,
        warnings: [{ msg }],
      });
    } catch {
      // ignore
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
