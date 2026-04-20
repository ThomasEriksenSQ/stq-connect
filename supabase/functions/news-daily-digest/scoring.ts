import { tierForUrl } from "./sources.ts";
import { HEAT_BOOST, type Tier } from "./heat.ts";

export interface RawItem {
  url: string;
  title: string;
  ingress: string | null;
  source: string;
  source_tier: 1 | 2 | 3;
  published_at: string; // ISO
  primary_company_id: string;
  primary_company_name: string;
  also_matched_company_ids: string[];
  also_matched_company_names: string[];
  image_url: string | null;
}

const KEYWORD_BONUS: Array<{ re: RegExp; bonus: number }> = [
  { re: /\b(kontrakt|avtale|signerer|inngår)\b/i, bonus: 0.15 },
  { re: /\b(ansetter|rekrutterer|utvider|vekst)\b/i, bonus: 0.12 },
  { re: /\b(milliard|million)\b/i, bonus: 0.08 },
  { re: /\b(lanserer|investerer|kjøper|oppkjøp)\b/i, bonus: 0.10 },
];

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    // strip tracking params
    [...u.searchParams.keys()].forEach((k) => {
      if (k.startsWith("utm_") || k === "fbclid" || k === "gclid") {
        u.searchParams.delete(k);
      }
    });
    return u.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

export function recencyFactor(publishedIso: string, now = new Date()): number {
  const ageHours = (now.getTime() - new Date(publishedIso).getTime()) / 3_600_000;
  if (ageHours < 6) return 1.0;
  if (ageHours < 24) return 0.95;
  if (ageHours < 48) return 0.8;
  if (ageHours < 72) return 0.65;
  return 0.4;
}

export function tierFactor(tier: 1 | 2 | 3): number {
  if (tier === 1) return 1.0;
  if (tier === 2) return 0.8;
  return 0.55;
}

// Soft domain filter: kjente domener får boost, ukjente får liten penalty.
// Tier 1-2 = trygt redaksjonelt; Tier 3 = nøytralt; ukjent (default tier 3) får negativt bidrag.
export function domainTrustFactor(url: string, knownTier: 1 | 2 | 3): number {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    // Kjent domene fra SOURCE_TIERS gir host !== "" og knownTier reflekterer kvalitet
    if (knownTier === 1) return 0.20;
    if (knownTier === 2) return 0.10;
    // Tier 3 fallback: ukjent eller lavkvalitet — sjekk om host er åpenbart støy
    if (/(blog|substack|medium\.com|wordpress|whothoughtofit|tumblr)/i.test(host)) return -0.30;
    return -0.10;
  } catch {
    return -0.20;
  }
}

export function baseWeightFor(status: string | null): number {
  if (status === "Kunde") return 1.2;
  if (status === "Potensiell kunde") return 0.6;
  return 0.3;
}

export function keywordTiebreaker(text: string): number {
  let bonus = 0;
  for (const { re, bonus: b } of KEYWORD_BONUS) {
    if (re.test(text)) bonus += b;
  }
  return Math.min(bonus, 0.3);
}

export interface ScoringContext {
  baseWeight: Map<string, number>; // by company_id
  heatTier: Map<string, Tier>; // by company_id
}

export function scoreItem(item: RawItem, ctx: ScoringContext, now = new Date()): number {
  const base = ctx.baseWeight.get(item.primary_company_id) ?? 0.3;
  const tier = ctx.heatTier.get(item.primary_company_id) ?? 4;
  const heat = HEAT_BOOST[tier];
  const recency = recencyFactor(item.published_at, now);
  const tFactor = tierFactor(item.source_tier);
  const tieBreak = keywordTiebreaker(`${item.title} ${item.ingress ?? ""}`);
  const domainAdj = domainTrustFactor(item.url, item.source_tier);
  return (base + heat) * recency * tFactor + tieBreak + domainAdj;
}

export function dedupAndMerge(items: RawItem[]): RawItem[] {
  const byUrl = new Map<string, RawItem>();
  for (const item of items) {
    const key = normalizeUrl(item.url);
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, { ...item, url: key, source_tier: tierForUrl(key) });
      continue;
    }
    // merge: union also_matched
    const ids = new Set([
      existing.primary_company_id,
      ...existing.also_matched_company_ids,
      item.primary_company_id,
      ...item.also_matched_company_ids,
    ]);
    const names = new Set([
      existing.primary_company_name,
      ...existing.also_matched_company_names,
      item.primary_company_name,
      ...item.also_matched_company_names,
    ]);
    ids.delete(existing.primary_company_id);
    names.delete(existing.primary_company_name);
    existing.also_matched_company_ids = [...ids];
    existing.also_matched_company_names = [...names];
  }
  return [...byUrl.values()];
}

// Hard-block: åpenbar støy (link-farms, content-mills, brukerprofiler/forum)
const NOISE_DOMAINS = /(whothoughtofit|tumblr|wordpress\.com|substack|medium\.com|blogspot)/i;
const NOISE_PATHS = /\/(forum|user|profile|tag|category|search|tema)\//i;

export function passesQuality(item: RawItem, score: number): boolean {
  // Ingen score-terskel — la scoring rangere, ikke filtrere bort
  if (!item.title || item.title.length < 10) return false;
  if (item.ingress && item.ingress.trim().length > 0 && item.ingress.trim().length < 20) return false;
  try {
    const u = new URL(item.url);
    if (NOISE_DOMAINS.test(u.hostname)) return false;
    if (NOISE_PATHS.test(u.pathname)) return false;
  } catch {
    return false;
  }
  // Score brukes til ranking, ikke avvisning. Returnerer alltid true her hvis vi kom så langt.
  return score > -10; // sikkerhetsventil for ekstreme negative scores
}

// Eksakt navn/alias-match i tittel eller ingress
// Krev word-boundary match (ikke substring) for å unngå "Hornet" → "ved hornet"
export function matchesCompanyName(item: RawItem, aliases: string[]): boolean {
  const haystack = `${item.title} ${item.ingress ?? ""}`;
  return aliases.some((a) => {
    const trimmed = a.trim();
    if (trimmed.length < 3) return false;
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^\\p{L}0-9])${escaped}([^\\p{L}0-9]|$)`, "iu");
    return re.test(haystack);
  });
}
