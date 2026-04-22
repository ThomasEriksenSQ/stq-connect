/* ────────────────────────────────────────────────────────────
   STACQ Daily — felles datamodell og helpers
   Brukes av både mock (Fase 1) og produksjon (Fase 2).
   ──────────────────────────────────────────────────────────── */

export type SourceTier = 1 | 2 | 3;

export type NewsImage = {
  url: string | null;
  source: "og" | "company_logo" | "placeholder";
};

export type NewsItemBase = {
  id: string;
  primary_company_id: string;
  primary_company_name: string;
  also_matched_company_ids: string[];
  also_matched_company_names: string[];
  title: string;
  url: string;
  source: string;
  source_tier: SourceTier;
  published_at: string;
  image: NewsImage;
  score: number;
};

export type NewsLead = NewsItemBase & { variant: "lead"; ingress: string };
export type NewsFeature = NewsItemBase & { variant: "feature"; ingress: string };
export type NewsBrief = NewsItemBase & { variant: "brief"; ingress: null };
export type NewsItem = NewsLead | NewsFeature | NewsBrief;

export type NewsDailyPayload = {
  items: NewsItem[];
  generated_at: string;
  generation_version: string;
};

function newsTimestamp(iso: string): number {
  const timestamp = Date.parse(iso);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function sortNewsItemsNewestFirst<T extends { published_at: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => newsTimestamp(b.published_at) - newsTimestamp(a.published_at));
}

/* UTM-helper. Bevarer eksisterende query, legger på utm_source og utm_medium. */
export function withUtm(
  url: string,
  params: { source: string; medium: string },
): string {
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", params.source);
    u.searchParams.set("utm_medium", params.medium);
    return u.toString();
  } catch {
    return url;
  }
}

/* Norsk relativ dato for nyhetslinjer ("2t siden", "1d siden"). */
export function newsRelative(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diffMin = Math.max(0, Math.round((now.getTime() - then) / 60000));
  if (diffMin < 60) return `${diffMin}m siden`;
  const hours = Math.round(diffMin / 60);
  if (hours < 24) return `${hours}t siden`;
  const days = Math.round(hours / 24);
  return `${days}d siden`;
}
