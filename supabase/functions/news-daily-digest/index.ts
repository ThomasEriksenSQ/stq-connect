// STACQ Daily — daglig nyhetsforside drevet av Perplexity Sonar.
// Kjøres via cron (04:30 UTC) eller on-demand fra frontend.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { hostFromUrl, isTrustedSource, sourceForUrl, tierForUrl } from "./sources.ts";
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

// Search-API-baserte konstanter — én query per selskap, høy parallellisering.
const SEARCH_PARALLEL = 10; // antall samtidige /search-kall
const SEARCH_RESULTS_PER_QUERY = 8; // hvor mange treff vi henter per selskap
const PASS1_MAX_AGE_DAYS = 14; // varme selskaper: siste 14 dager
const PASS2_MAX_AGE_DAYS = 30; // alle selskaper: siste 30 dager
const HARD_CAP_COMPANIES = 200; // sikkerhetstak per kjøring
const TARGET_ITEMS = 15;
const MAX_PER_COMPANY = 2; // unngå at ett selskap dominerer feeden
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

// Strip formelle suffiks når vi søker — øker treffraten dramatisk
function cleanCompanyName(n: string): string {
  return n
    .replace(/\s+(AS|ASA|AB|SA|GMBH|LTD|LLC|INC|GROUP|HOLDING|HOLDINGS)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface SearchResult {
  url: string;
  title: string;
  snippet: string | null;
  date: string | null; // YYYY-MM-DD
  last_updated?: string | null;
}

// Trekker ut en kort ingress (1-2 setninger) fra Perplexity-snippet.
function snippetToIngress(snippet: string | null): string | null {
  if (!snippet) return null;
  // Fjern markdown-headere, listprefiks og linjeskift-støy
  const cleaned = snippet
    .replace(/^#+\s*/gm, "")
    .replace(/\n{2,}/g, " · ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 30) return null;
  // Trim til ~280 tegn ved nærmeste setningsslutt
  if (cleaned.length <= 280) return cleaned;
  const cut = cleaned.slice(0, 280);
  const lastDot = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (lastDot > 120 ? cut.slice(0, lastDot + 1) : cut + "…").trim();
}

// Kall Perplexity Search API for ett selskap. Returnerer rå treff med ekte URL-er.
async function searchCompany(
  apiKey: string,
  company: CompanyRow,
  maxAgeDays: number,
): Promise<RawItem[]> {
  const name = cleanCompanyName(company.name);
  // Sterkere artikkel-signaler: dato, "melder", "leverer" — dropper "kontrakt" som lokker investor-sider
  const query = `"${name}" Norge nyhet melder leverer signerer lanserer ansetter vekst -aksje -kurs -ticker`;
  const body = {
    query,
    max_results: SEARCH_RESULTS_PER_QUERY,
    max_tokens_per_page: 256,
  };

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch("https://api.perplexity.ai/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Perplexity Search ${res.status}: ${txt.slice(0, 200)}`);
      }
      const data = await res.json();
      const results = (data.results ?? []) as SearchResult[];
      const companyHost = hostFromUrl(company.website);
      const cutoffMs = Date.now() - maxAgeDays * 86_400_000;

      const out: RawItem[] = [];
      let droppedNoDate = 0;
      let droppedTooOld = 0;
      let droppedUntrusted = 0;
      for (const r of results) {
        const rawUrl = r.url?.trim();
        const title = r.title?.trim();
        if (!rawUrl || !title) continue;

        // Tillat kun redaksjonelle/offisielle domener + selskapets eget domene
        if (!isTrustedSource(rawUrl, companyHost)) {
          droppedUntrusted++;
          continue;
        }

        // Krev ekte dato innenfor cutoff
        const dateStr = r.date ?? r.last_updated ?? null;
        if (!dateStr) {
          droppedNoDate++;
          continue;
        }
        const ts = Date.parse(dateStr);
        if (!Number.isFinite(ts)) {
          droppedNoDate++;
          continue;
        }
        if (ts < cutoffMs || ts > Date.now() + 86_400_000) {
          droppedTooOld++;
          continue;
        }

        out.push({
          url: rawUrl,
          title,
          ingress: snippetToIngress(r.snippet),
          source: sourceForUrl(rawUrl),
          source_tier: tierForUrl(rawUrl),
          published_at: new Date(ts).toISOString(),
          primary_company_id: company.id,
          primary_company_name: company.name,
          also_matched_company_ids: [],
          also_matched_company_names: [],
          image_url: null,
        });
      }
      if (droppedNoDate || droppedTooOld || droppedUntrusted) {
        console.log(`[search ${name}] kept=${out.length}/${results.length} no_date=${droppedNoDate} too_old=${droppedTooOld} untrusted=${droppedUntrusted}`);
      } else if (out.length > 0) {
        console.log(`[search ${name}] kept=${out.length}/${results.length}`);
      }
      return out;
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, attempt === 0 ? 500 : 2000));
    }
  }
  console.error(`[search ${name}] failed after retries:`, lastError);
  return [];
}

function pickItems(scored: Array<{ item: RawItem; score: number }>): {
  lead: { item: RawItem; score: number } | null;
  features: Array<{ item: RawItem; score: number }>;
  briefs: Array<{ item: RawItem; score: number }>;
} {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  // Dedupliser per selskap: maks MAX_PER_COMPANY saker per primary_company_id
  const perCompany = new Map<string, number>();
  const balanced: Array<{ item: RawItem; score: number }> = [];
  for (const s of sorted) {
    const cnt = perCompany.get(s.item.primary_company_id) ?? 0;
    if (cnt >= MAX_PER_COMPANY) continue;
    perCompany.set(s.item.primary_company_id, cnt + 1);
    balanced.push(s);
    if (balanced.length >= TARGET_ITEMS) break;
  }
  const lead = balanced[0] ?? null;
  // Alle øvrige saker blir features (med bilde, tittel og ingress) — ingen briefs
  const features = balanced.slice(1, TARGET_ITEMS);
  const briefs: Array<{ item: RawItem; score: number }> = [];
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

    // Pass 1 prioriterer Tier 1-3 (varme) — Tier 4 (kalde) tas i Pass 2 hvis vi mangler items
    const warmCompanies = sortedCompanies.filter((c) => (heatTier.get(c.id) ?? 4) <= 3);
    const coldCompanies = sortedCompanies.filter((c) => (heatTier.get(c.id) ?? 4) === 4);
    console.log(`[heat split] warm(T1-3)=${warmCompanies.length} cold(T4)=${coldCompanies.length}`);

    // 4. Søk via Perplexity Search API — én query per selskap, parallellisert
    const allRaw: RawItem[] = [];
    let companiesQueried = 0;
    let totalHits = 0;

    async function runSearch(pool: CompanyRow[], maxAgeDays: number, label: string) {
      const startCount = allRaw.length;
      const capped = pool.slice(0, HARD_CAP_COMPANIES - companiesQueried);
      for (let i = 0; i < capped.length; i += SEARCH_PARALLEL) {
        const slice = capped.slice(i, i + SEARCH_PARALLEL);
        const results = await Promise.all(
          slice.map((c) => searchCompany(PERPLEXITY_API_KEY, c, maxAgeDays)),
        );
        for (const items of results) {
          totalHits += items.length;
          for (const it of items) allRaw.push(it);
        }
        companiesQueried += slice.length;
      }
      console.log(`[${label} done] companies=${capped.length} hits=${totalHits} kept_in_pool=${allRaw.length - startCount}`);
    }

    // Pass 1: varme selskaper, siste 14 dager
    await runSearch(warmCompanies, PASS1_MAX_AGE_DAYS, `pass1-warm-${PASS1_MAX_AGE_DAYS}d`);

    const ctx: ScoringContext = { baseWeight, heatTier };
    // Bygg aliaser: fullt navn + uten suffiks + første ord (hvis ≥4 tegn og ikke generisk)
    const GENERIC_FIRST_WORDS = new Set(["the", "norsk", "norske", "nordic", "norway", "norge", "scandinavian"]);
    const aliasByCompany = new Map<string, string[]>();
    for (const c of companyList) {
      const aliases = [c.name];
      const cleaned = cleanCompanyName(c.name);
      if (cleaned !== c.name) aliases.push(cleaned);
      const firstWord = cleaned.split(/\s+/)[0]?.replace(/[^\p{L}0-9]/gu, "") ?? "";
      if (firstWord.length >= 4 && !GENERIC_FIRST_WORDS.has(firstWord.toLowerCase())) {
        aliases.push(firstWord);
      }
      aliasByCompany.set(c.id, aliases);
    }

    // Verifiser at URL-er faktisk eksisterer (filtrer døde lenker)
    async function urlExists(url: string): Promise<boolean> {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      try {
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

    async function scoreFiltered(raw: RawItem[]) {
      const merged = dedupAndMerge(raw);
      const afterMerge = merged.length;
      // Name-match: titel/ingress må inneholde selskapsnavn (eller alias) som ord.
      // Dette eliminerer treff hvor selskapet bare er nevnt i en sidebar.
      const filtered = merged.filter((it) => {
        const aliases = aliasByCompany.get(it.primary_company_id) ?? [];
        return matchesCompanyName(it, aliases);
      });
      const afterNameMatch = filtered.length;
      const live = await filterLiveUrls(filtered);
      const scored = live.map((item) => ({ item, score: scoreItem(item, ctx) }));
      const final = scored.filter((s) => passesQuality(s.item, s.score));
      console.log(`[scoreFiltered] raw=${raw.length} merged=${afterMerge} name_match=${afterNameMatch} live=${live.length} quality_pass=${final.length}`);
      return final;
    }

    let scored = await scoreFiltered(allRaw);

    // 5. Pass 2 — ta inn kalde selskaper med 30-dagers vindu hvis vi mangler items
    let fallbackUsed = false;
    if (scored.length < TARGET_ITEMS && companiesQueried < HARD_CAP_COMPANIES) {
      fallbackUsed = true;
      console.log(`[pass2 start] scored=${scored.length} < target=${TARGET_ITEMS}, adding cold pool 30d`);
      await runSearch(coldCompanies, PASS2_MAX_AGE_DAYS, `pass2-cold-${PASS2_MAX_AGE_DAYS}d`);
      scored = await scoreFiltered(allRaw);
    }

    // 6. Lagre alltid det vi har — UI bestemmer presentasjon. Ingen "empty"-grense.

    // 7. Pick + bilder
    const picked = pickItems(scored);
    const itemsOut: NewsItemOut[] = [];
    const companyById = new Map(companyList.map((c) => [c.id, c]));

    // Heuristikk: "svak" tittel = ticker, domene-suffiks, for kort, eller bare selskapsnavn
    function isWeakTitle(title: string, companyName: string): boolean {
      const t = title.trim();
      if (t.length < 25) return true;
      if (/\([A-Z]{2,6}\)/.test(t)) return true; // (NORBT), (EQNR)
      if (/\s[-|–—]\s[A-ZÆØÅa-zæøå0-9.]{2,20}$/.test(t) && t.length < 60) return true; // " - Nordnet"
      const escaped = companyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const bareName = new RegExp(`^${escaped}\\s*[-|–—]?\\s*\\w{0,20}$`, "i");
      if (bareName.test(t)) return true;
      return false;
    }

    function pickBetterTitle(perplexityTitle: string, ogTitle: string | null, companyName: string): string {
      if (!ogTitle) return perplexityTitle;
      const og = ogTitle.trim();
      if (isWeakTitle(og, companyName)) return perplexityTitle;
      if (isWeakTitle(perplexityTitle, companyName) && og.length >= 25) {
        console.log(`[title-upgrade] "${perplexityTitle}" → "${og}"`);
        return og;
      }
      return perplexityTitle;
    }

    async function buildItem(
      entry: { item: RawItem; score: number },
      variant: "lead" | "feature" | "brief",
    ): Promise<NewsItemOut> {
      const id = `${variant}-${crypto.randomUUID().slice(0, 8)}`;
      const company = companyById.get(entry.item.primary_company_id);
      // Hent bilde + OG-meta i samme HTTP-runde for alle varianter
      const image = await resolveAndMirrorImage({
        supabase,
        itemId: id,
        date: today,
        pageUrl: entry.item.url,
        companyWebsite: company?.website ?? null,
        companyName: entry.item.primary_company_name,
      });

      // Oppgrader tittel hvis Perplexity ga svak versjon
      const finalTitle = pickBetterTitle(entry.item.title, image.ogTitle, entry.item.primary_company_name);

      // Bruk OG-description som ingress hvis Perplexity-snippet manglet
      let ingress = entry.item.ingress;
      if (variant !== "brief" && !ingress && image.ogDescription && image.ogDescription.length >= 30) {
        ingress = image.ogDescription.length > 280
          ? image.ogDescription.slice(0, 280).replace(/\s+\S*$/, "") + "…"
          : image.ogDescription;
      }

      return {
        id,
        variant,
        primary_company_id: entry.item.primary_company_id,
        primary_company_name: entry.item.primary_company_name,
        also_matched_company_ids: entry.item.also_matched_company_ids,
        also_matched_company_names: entry.item.also_matched_company_names,
        title: finalTitle,
        ingress: variant === "brief" ? null : ingress,
        url: entry.item.url,
        source: entry.item.source,
        source_tier: entry.item.source_tier,
        published_at: entry.item.published_at,
        image: { url: image.url, source: image.source },
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
      companies_queried: companiesQueried,
      total_perplexity_hits: totalHits,
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
