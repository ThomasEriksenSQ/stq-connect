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

const HARD_CAP_BATCHES = 24;
const BATCH_SIZE = 8;
const PARALLEL_BATCHES = 4;
const PASS1_MAX_AGE_HOURS = 48; // Pass 1: kun siste 48 timer
const PASS2_MAX_AGE_HOURS = 24 * 7; // Pass 2: maks 7 dager
const TARGET_AFTER_PASS_1 = 12;
const FETCH_CHUNK = 200; // Supabase .in() URL-lengde-grense

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
    .map((c) => `- ${c.name}${c.website ? ` (${c.website})` : ""}`)
    .join("\n");

  const timeWindow = recencyFilter === "day" ? "siste 48 timer" : "siste 7 dager";
  const prompt = `Søk i norske nyhetskilder etter saker fra ${timeWindow} som omtaler ett eller flere av disse selskapene:

${list}

Returner ALLE relevante saker du finner. Det er bedre å returnere en sak du er litt usikker på, enn å returnere ingenting. For hver sak: company_name (skriv selskapsnavnet eksakt slik det står i listen over), title (artikkeltittel), ingress (1-2 setninger på norsk), url (full lenke til artikkelen), published_at (ISO 8601 dato).

Hvis du ikke finner noen saker, returner items: [].`;

  const body = {
    model: "sonar",
    messages: [
      { role: "system", content: "Du er en nyhets-aggregator for et norsk B2B-salgsteam. Returner verifiserbare saker fra norske medier som e24, DN, Finansavisen, TU, Digi, NRK, Aftenposten, Kapital, Hegnar, Shifter." },
      { role: "user", content: prompt },
    ],
    search_recency_filter: recencyFilter === "day" ? "day" : "week",
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
      const citations: string[] = Array.isArray(data.citations) ? data.citations.map((c: unknown) => String(c)) : [];
      const citationSet = new Set(citations.map((c) => c.replace(/\/$/, "")));
      if (!content) {
        console.log(`[perplexity] no content. keys=${Object.keys(data).join(",")} choices=${data.choices?.length ?? 0}`);
        return [];
      }
      let parsed: { items?: unknown[] } = {};
      try {
        parsed = JSON.parse(content);
      } catch {
        console.log(`[perplexity] JSON parse failed. content_sample=${content.slice(0, 300)}`);
        return [];
      }
      const items = (parsed.items ?? []) as Array<Record<string, unknown>>;
      console.log(`[perplexity] returned items=${items.length} citations=${citations.length} for batch_size=${companies.length} recency=${recencyFilter}`);
      if (items.length > 0) {
        console.log(`[perplexity] sample=${JSON.stringify(items[0]).slice(0, 250)}`);
      }

      // Bygg fuzzy match: lowercase + uten suffikser (AS, ASA, AB)
      const norm = (s: string) => s.toLowerCase().replace(/\b(as|asa|ab|sa|inc|ltd|gmbh|group|holding|holdings)\b/g, "").replace(/[^a-z0-9æøå ]/g, "").replace(/\s+/g, " ").trim();
      const companyByNorm = new Map<string, CompanyRow>();
      for (const c of companies) companyByNorm.set(norm(c.name), c);

      const out: RawItem[] = [];
      let unmatched = 0;
      let droppedHallucinated = 0;
      for (const it of items) {
        const rawName = String(it.company_name ?? "");
        let company = companies.find((c) => c.name.toLowerCase() === rawName.toLowerCase());
        if (!company) {
          company = companyByNorm.get(norm(rawName));
        }
        if (!company) {
          const nName = norm(rawName);
          if (nName.length >= 3) {
            company = companies.find((c) => {
              const nc = norm(c.name);
              return nc.includes(nName) || nName.includes(nc);
            });
          }
        }
        if (!company) {
          unmatched++;
          continue;
        }
        const rawUrl = String(it.url ?? "").trim();
        const title = String(it.title ?? "");
        if (!rawUrl || !title) continue;

        // Anti-hallusinering: URL må finnes i Perplexitys citations.
        // Hvis ikke, prøv å finne en citation som inneholder samme host.
        const normalizedUrl = rawUrl.replace(/\/$/, "");
        let finalUrl: string | null = null;
        if (citationSet.has(normalizedUrl)) {
          finalUrl = rawUrl;
        } else {
          try {
            const host = new URL(rawUrl).hostname.replace(/^www\./, "");
            const match = citations.find((c) => {
              try {
                return new URL(c).hostname.replace(/^www\./, "") === host;
              } catch {
                return false;
              }
            });
            if (match) finalUrl = match;
          } catch { /* invalid url */ }
        }
        if (!finalUrl) {
          droppedHallucinated++;
          continue;
        }

        out.push({
          url: finalUrl,
          title,
          ingress: it.ingress ? String(it.ingress) : null,
          source: sourceForUrl(finalUrl),
          source_tier: tierForUrl(finalUrl),
          published_at: it.published_at ? String(it.published_at) : new Date().toISOString(),
          primary_company_id: company.id,
          primary_company_name: company.name,
          also_matched_company_ids: [],
          also_matched_company_names: [],
          image_url: null,
        });
      }
      if (unmatched > 0) console.log(`[perplexity] unmatched_company_names=${unmatched}/${items.length}`);
      if (droppedHallucinated > 0) console.log(`[perplexity] dropped_hallucinated_urls=${droppedHallucinated}/${items.length}`);
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

    // 2. Hent kontakter + siste aktivitet → heat tier per selskap (chunket for å unngå URL-grenser)
    const companyIds = companyList.map((c) => c.id);
    const allContacts: Array<{ id: string; company_id: string | null; ikke_aktuell_kontakt: boolean | null }> = [];
    for (let i = 0; i < companyIds.length; i += FETCH_CHUNK) {
      const chunk = companyIds.slice(i, i + FETCH_CHUNK);
      const { data, error } = await supabase
        .from("contacts")
        .select("id, company_id, ikke_aktuell_kontakt")
        .in("company_id", chunk);
      if (error) console.error(`[contacts chunk ${i}] error:`, error.message);
      if (data) allContacts.push(...data);
    }
    console.log(`[contacts] companies=${companyIds.length} contacts_fetched=${allContacts.length}`);

    const contactIds = allContacts.map((c) => c.id);
    const allActivities: ActivityRow[] = [];
    for (let i = 0; i < contactIds.length; i += FETCH_CHUNK) {
      const chunk = contactIds.slice(i, i + FETCH_CHUNK);
      const { data, error } = await supabase
        .from("activities")
        .select("contact_id, description, created_at")
        .in("contact_id", chunk)
        .order("created_at", { ascending: false });
      if (error) console.error(`[activities chunk ${i}] error:`, error.message);
      if (data) allActivities.push(...(data as ActivityRow[]));
    }
    console.log(`[activities] contacts=${contactIds.length} activities_fetched=${allActivities.length}`);

    // Per kontakt: nyeste aktivitet → signal + alder
    const latestByContact = new Map<string, ActivityRow>();
    for (const a of allActivities) {
      if (!a.contact_id) continue;
      if (!latestByContact.has(a.contact_id)) latestByContact.set(a.contact_id, a);
    }

    const now = Date.now();
    const contactSignals = allContacts
      .filter((c) => c.company_id)
      .map((c) => {
        const latest = latestByContact.get(c.id);
        const days = latest
          ? Math.floor((now - new Date(latest.created_at).getTime()) / 86_400_000)
          : 999;
        return {
          company_id: c.company_id as string,
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

    // Pass 1 prioriterer Tier 1-3 (varme) — Tier 4 spares til evt. fallback
    const warmCompanies = sortedCompanies.filter((c) => (heatTier.get(c.id) ?? 4) <= 3);
    const coldCompanies = sortedCompanies.filter((c) => (heatTier.get(c.id) ?? 4) === 4);
    console.log(`[heat split] warm(T1-3)=${warmCompanies.length} cold(T4)=${coldCompanies.length}`);

    // 4. Pass 1 — siste 48 timer på varme selskaper (parallell)
    let batchesUsed = 0;
    const allRaw: RawItem[] = [];
    let perplexityHits = 0;
    async function runPass(
      pool: CompanyRow[],
      recency: "day" | "week",
      maxAgeHours: number,
      label: string,
    ) {
      const cutoff = Date.now() - maxAgeHours * 3_600_000;
      let droppedAge = 0;
      for (let i = 0; i < pool.length && batchesUsed < HARD_CAP_BATCHES; i += BATCH_SIZE * PARALLEL_BATCHES) {
        const slots: Promise<RawItem[]>[] = [];
        for (let j = 0; j < PARALLEL_BATCHES && batchesUsed < HARD_CAP_BATCHES; j++) {
          const start = i + j * BATCH_SIZE;
          if (start >= pool.length) break;
          const batch = pool.slice(start, start + BATCH_SIZE);
          slots.push(callPerplexity(PERPLEXITY_API_KEY, batch, recency));
          batchesUsed++;
        }
        const results = await Promise.all(slots);
        for (const items of results) {
          perplexityHits += items.length;
          for (const it of items) {
            const ts = new Date(it.published_at).getTime();
            if (Number.isFinite(ts) && ts < cutoff) {
              droppedAge++;
              continue;
            }
            allRaw.push(it);
          }
        }
      }
      console.log(`[${label} done] batches=${batchesUsed} hits=${perplexityHits} kept=${allRaw.length} dropped_too_old=${droppedAge}`);
    }
    await runPass(warmCompanies, "day", PASS1_MAX_AGE_HOURS, "pass1-warm-48h");

    const ctx: ScoringContext = { baseWeight, heatTier };
    // Bygg aliaser: fullt navn + første ord (hvis ≥4 tegn og ikke generisk)
    const GENERIC_FIRST_WORDS = new Set(["the", "norsk", "norske", "nordic", "norway", "norge", "scandinavian"]);
    const aliasByCompany = new Map<string, string[]>();
    for (const c of companyList) {
      const aliases = [c.name];
      const firstWord = c.name.split(/\s+/)[0]?.replace(/[^\p{L}0-9]/gu, "") ?? "";
      if (firstWord.length >= 4 && !GENERIC_FIRST_WORDS.has(firstWord.toLowerCase())) {
        aliases.push(firstWord);
      }
      aliasByCompany.set(c.id, aliases);
    }

    // Verifiser at URL-er faktisk eksisterer (filtrer hallusinasjoner)
    async function urlExists(url: string): Promise<boolean> {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      try {
        // GET (ikke HEAD) — mange norske medier blokkerer HEAD
        const res = await fetch(url, {
          method: "GET",
          redirect: "follow",
          signal: ctrl.signal,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; STACQ-Daily/1.0)" },
        });
        return res.ok && res.status < 400;
      } catch {
        return false;
      } finally {
        clearTimeout(t);
      }
    }
    async function filterLiveUrls(items: RawItem[]): Promise<RawItem[]> {
      const checks = await Promise.all(items.map((it) => urlExists(it.url)));
      const live = items.filter((_, i) => checks[i]);
      console.log(`[urlValidation] checked=${items.length} live=${live.length} dead=${items.length - live.length}`);
      return live;
    }

    function scoreFiltered(raw: RawItem[]) {
      const merged = dedupAndMerge(raw);
      const afterMerge = merged.length;
      const filtered = merged.filter((it) => {
        const aliases = aliasByCompany.get(it.primary_company_id) ?? [];
        return matchesCompanyName(it, aliases);
      });
      const afterNameMatch = filtered.length;
      const scored = filtered.map((item) => ({ item, score: scoreItem(item, ctx) }));
      const final = scored.filter((s) => passesQuality(s.item, s.score));
      console.log(`[scoreFiltered] raw=${raw.length} merged=${afterMerge} name_match=${afterNameMatch} quality_pass=${final.length}`);
      return final;
    }

    let scored = scoreFiltered(allRaw);

    // 5. Pass 2 — utvid til 7 dager + ta inn cold companies hvis budsjett er igjen
    let fallbackUsed = false;
    if (scored.length < TARGET_AFTER_PASS_1 && batchesUsed < HARD_CAP_BATCHES) {
      fallbackUsed = true;
      console.log(`[pass2 start] scored=${scored.length} < target=${TARGET_AFTER_PASS_1}, expanding to 7d + cold pool`);
      await runPass(warmCompanies, "week", PASS2_MAX_AGE_HOURS, "pass2-warm-7d");
      if (batchesUsed < HARD_CAP_BATCHES) {
        await runPass(coldCompanies, "week", PASS2_MAX_AGE_HOURS, "pass2-cold-7d");
      }
      scored = scoreFiltered(allRaw);
    }

    // 6. Lagre alltid det vi har — UI bestemmer presentasjon. Ingen "empty"-grense.

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
      // Hent bilde for alle varianter (også briefs får liten thumbnail)
      const image = await resolveAndMirrorImage({
        supabase,
        itemId: id,
        date: today,
        pageUrl: entry.item.url,
        companyWebsite: company?.website ?? null,
        companyName: entry.item.primary_company_name,
      });

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
