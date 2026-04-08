import { getCanonicalMatchScore, normalizeScoredMatchTags } from "./matchScore.ts";

const DOMAIN_TAGS = new Set([
  "AI",
  "Automation",
  "Computer vision",
  "Cybersecurity",
  "Edge Computing",
  "GIS",
  "HIL",
  "Hardware Integration",
  "Robotics",
  "Safety",
  "Testing",
  "UAV",
]);

const DEFAULT_MAX_TAGS = 18;
const DEFAULT_MAX_MATCH_TAGS = 6;

export type MatchingSourceProfile = {
  tags: Array<string | null | undefined> | string | null | undefined;
  type?: string;
  navn?: string;
  selskap_navn?: string;
};

type MatchingResultShape = {
  id: number | string;
  score?: number | string;
  begrunnelse?: string;
  match_tags?: Array<string | null | undefined> | string | null | undefined;
  type?: string;
  navn?: string;
  selskap_navn?: string;
};

type SanitizedMatchResult = {
  id: number | string;
  score: number;
  begrunnelse: string;
  match_tags: string[];
  type?: string;
  navn?: string;
  selskap_navn?: string;
};

function truncateReason(text: string, maxWords = 12): string {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join(" ");
}

function normalizeIdKey(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function compareSanitizedResults(a: SanitizedMatchResult, b: SanitizedMatchResult): number {
  if (a.score !== b.score) return b.score - a.score;

  const aName = a.navn?.trim() || "";
  const bName = b.navn?.trim() || "";
  if (aName && bName) return aName.localeCompare(bName, "nb");

  return String(a.id).localeCompare(String(b.id), "nb");
}

export function normalizeMatchingTags(
  values: Array<string | null | undefined> | string | null | undefined,
  maxTags = DEFAULT_MAX_TAGS,
): string[] {
  return normalizeScoredMatchTags(values, maxTags);
}

export function buildMatchingProfile(
  values: Array<string | null | undefined> | string | null | undefined,
  maxTags = DEFAULT_MAX_TAGS,
): {
  tags: string[];
  technologyTags: string[];
  domainTags: string[];
  promptText: string;
} {
  const tags = normalizeMatchingTags(values, maxTags);
  const technologyTags = tags.filter((tag) => !DOMAIN_TAGS.has(tag));
  const domainTags = tags.filter((tag) => DOMAIN_TAGS.has(tag));

  const promptParts: string[] = [];
  if (technologyTags.length > 0) {
    promptParts.push(`Teknologier: ${technologyTags.join(", ")}`);
  }
  if (domainTags.length > 0) {
    promptParts.push(`Domener: ${domainTags.join(", ")}`);
  }

  return {
    tags,
    technologyTags,
    domainTags,
    promptText: promptParts.join(" | ") || "ukjent",
  };
}

export function sanitizeAiMatchResults(
  results: unknown,
  options: {
    targetTags: Array<string | null | undefined> | string | null | undefined;
    sourcesById: Map<string, MatchingSourceProfile>;
    maxMatchTags?: number;
    allowedTypes?: Set<string>;
    fallbackReason?: string;
  },
): MatchingResultShape[] {
  if (!Array.isArray(results)) return [];

  const targetTagSet = new Set(normalizeMatchingTags(options.targetTags, 50));
  const maxMatchTags = options.maxMatchTags ?? DEFAULT_MAX_MATCH_TAGS;
  const deduped = new Map<string, SanitizedMatchResult>();
  const upsertResult = (idKey: string, result: SanitizedMatchResult) => {
    const existing = deduped.get(idKey);
    if (!existing || compareSanitizedResults(result, existing) < 0) {
      deduped.set(idKey, result);
    }
  };

  results.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const raw = entry as Record<string, unknown>;
    const idKey = normalizeIdKey(raw.id);
    if (!idKey) return;

    const source = options.sourcesById.get(idKey);
    const sourceTags = normalizeMatchingTags(source?.tags || [], 50);
    const overlapTags = sourceTags.filter((tag) => targetTagSet.has(tag));
    const overlapSet = new Set(overlapTags);

    const requestedMatchTags = normalizeMatchingTags(raw.match_tags as Array<string | null | undefined> | string | null | undefined, 50);
    const sanitizedMatchTags = requestedMatchTags.filter((tag) => overlapSet.has(tag));
    const finalMatchTags = (sanitizedMatchTags.length > 0 ? sanitizedMatchTags : overlapTags).slice(0, maxMatchTags);

    const scoreResult = getCanonicalMatchScore(options.targetTags, sourceTags, 50);
    const score = scoreResult.score10;
    if (score < 4) return;

    const result: SanitizedMatchResult = {
      id: typeof raw.id === "number" ? raw.id : idKey,
      score,
      begrunnelse: truncateReason(
        typeof raw.begrunnelse === "string" && raw.begrunnelse.trim()
          ? raw.begrunnelse
          : options.fallbackReason || "Relevant teknologimatch",
      ),
      match_tags: finalMatchTags.length > 0 ? finalMatchTags : scoreResult.matchTags.slice(0, maxMatchTags),
    };

    if (typeof raw.navn === "string" && raw.navn.trim()) result.navn = raw.navn.trim();
    if (typeof raw.selskap_navn === "string" && raw.selskap_navn.trim()) result.selskap_navn = raw.selskap_navn.trim();

    const candidateType = typeof raw.type === "string" && raw.type.trim()
      ? raw.type.trim()
      : typeof source?.type === "string" && source.type.trim()
        ? source.type.trim()
        : undefined;

    if (candidateType && options.allowedTypes?.has(candidateType)) {
      result.type = candidateType;
    }

    upsertResult(idKey, result);
  });

  options.sourcesById.forEach((source, idKey) => {
    if (deduped.has(idKey)) return;

    const scoreResult = getCanonicalMatchScore(options.targetTags, source.tags, 50);
    if (scoreResult.score10 < 4) return;

    const result: SanitizedMatchResult = {
      id: /^\d+$/.test(idKey) ? Number(idKey) : idKey,
      score: scoreResult.score10,
      begrunnelse: options.fallbackReason || "Relevant teknologimatch",
      match_tags: scoreResult.matchTags.slice(0, maxMatchTags),
    };

    if (source.navn?.trim()) result.navn = source.navn.trim();
    if (source.selskap_navn?.trim()) result.selskap_navn = source.selskap_navn.trim();

    const candidateType = typeof source.type === "string" && source.type.trim() ? source.type.trim() : undefined;
    if (candidateType && options.allowedTypes?.has(candidateType)) {
      result.type = candidateType;
    }

    upsertResult(idKey, result);
  });

  return Array.from(deduped.values()).sort(compareSanitizedResults);
}
