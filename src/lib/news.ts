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

function normalizeImageUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

function getUrlHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function getUrlStoryId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const numericSegment = segments.find((segment) => /^\d{6,}$/.test(segment));
    return numericSegment ?? null;
  } catch {
    return null;
  }
}

function getTranslationGroupKey(item: NewsItem): string | null {
  const storyId = getUrlStoryId(item.url);
  if (storyId) {
    return [
      item.primary_company_id,
      getUrlHost(item.url),
      item.source,
      item.published_at,
      `story:${storyId}`,
    ].join("|");
  }

  const imageKey = normalizeImageUrl(item.image.url);
  if (!imageKey) return null;

  return [
    item.primary_company_id,
    getUrlHost(item.url),
    item.source,
    item.published_at,
    imageKey,
  ].join("|");
}

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((sum, pattern) => sum + (pattern.test(text) ? 1 : 0), 0);
}

function norwegianPreferenceScore(item: NewsItem): number {
  const lowerUrl = item.url.toLowerCase();
  const text = `${item.title} ${item.variant === "brief" ? "" : item.ingress}`.toLowerCase();

  const norwegianMarkers = [
    /\b(og|med|til|av|på|for|som|ved|etter|fra|ikke|siden|vekst|resultater|pressemelding)\b/i,
    /[æøå]/i,
    /(^|[/?._-])(nb|no)([/?._-]|$)/i,
    /[?&](lang|locale)=no\b/i,
  ];

  const englishMarkers = [
    /\b(and|with|from|the|year|performance|growth|press release|share)\b/i,
    /(^|[/?._-])en([/?._-]|$)/i,
    /[?&](lang|locale)=en\b/i,
  ];

  return countMatches(`${text} ${lowerUrl}`, norwegianMarkers) - countMatches(`${text} ${lowerUrl}`, englishMarkers);
}

function pickPreferredTranslation(a: NewsItem, b: NewsItem): NewsItem {
  const norwegianDelta = norwegianPreferenceScore(b) - norwegianPreferenceScore(a);
  if (norwegianDelta !== 0) return norwegianDelta > 0 ? b : a;
  if (b.score !== a.score) return b.score > a.score ? b : a;
  return b.source_tier < a.source_tier ? b : a;
}

function mergeTranslationSiblings(preferred: NewsItem, sibling: NewsItem): NewsItem {
  return {
    ...preferred,
    also_matched_company_ids: Array.from(
      new Set([
        ...preferred.also_matched_company_ids,
        sibling.primary_company_id,
        ...sibling.also_matched_company_ids,
      ]),
    ).filter((id) => id !== preferred.primary_company_id),
    also_matched_company_names: Array.from(
      new Set([
        ...preferred.also_matched_company_names,
        sibling.primary_company_name,
        ...sibling.also_matched_company_names,
      ]),
    ).filter((name) => name !== preferred.primary_company_name),
    score: Math.max(preferred.score, sibling.score),
  };
}

function newsTimestamp(iso: string): number {
  const timestamp = Date.parse(iso);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function sortNewsItemsNewestFirst<T extends { published_at: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => newsTimestamp(b.published_at) - newsTimestamp(a.published_at));
}

export function dedupeTranslatedNewsItems(items: NewsItem[]): NewsItem[] {
  const grouped = new Map<string, { firstIndex: number; item: NewsItem }>();
  const passthrough: Array<{ index: number; item: NewsItem }> = [];

  items.forEach((item, index) => {
    const key = getTranslationGroupKey(item);
    if (!key) {
      passthrough.push({ index, item });
      return;
    }

    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { firstIndex: index, item });
      return;
    }

    const preferred = pickPreferredTranslation(existing.item, item);
    const sibling = preferred === existing.item ? item : existing.item;
    grouped.set(key, {
      firstIndex: existing.firstIndex,
      item: mergeTranslationSiblings(preferred, sibling),
    });
  });

  return [
    ...passthrough,
    ...Array.from(grouped.values()).map(({ firstIndex, item }) => ({ index: firstIndex, item })),
  ]
    .sort((a, b) => a.index - b.index)
    .map(({ item }) => item);
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
