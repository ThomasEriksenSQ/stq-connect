import { normalizeTechnologyTags } from "./technologyTags.ts";

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

const BROAD_TECH_TAGS = new Set([
  "Embedded systems",
  "Electronics",
  "Firmware",
  "Linux",
  "RTOS",
]);

const DEFAULT_MAX_TAGS = 18;
const DEFAULT_MAX_MATCH_TAGS = 6;

export type MatchingSourceProfile = {
  tags: Array<string | null | undefined> | string | null | undefined;
  type?: string;
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

function compareMatchingTags(a: string, b: string): number {
  const aDomain = DOMAIN_TAGS.has(a);
  const bDomain = DOMAIN_TAGS.has(b);
  if (aDomain !== bDomain) return aDomain ? 1 : -1;

  const aBroad = BROAD_TECH_TAGS.has(a);
  const bBroad = BROAD_TECH_TAGS.has(b);
  if (aBroad !== bBroad) return aBroad ? 1 : -1;

  return a.localeCompare(b, "nb");
}

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

export function normalizeMatchingTags(
  values: Array<string | null | undefined> | string | null | undefined,
  maxTags = DEFAULT_MAX_TAGS,
): string[] {
  return normalizeTechnologyTags(values)
    .sort(compareMatchingTags)
    .slice(0, maxTags);
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

  return results.reduce<MatchingResultShape[]>((acc, entry) => {
    if (!entry || typeof entry !== "object") return acc;
    const raw = entry as Record<string, unknown>;
    const idKey = normalizeIdKey(raw.id);
    if (!idKey) return acc;

    const source = options.sourcesById.get(idKey);
    const sourceTags = normalizeMatchingTags(source?.tags || [], 50);
    const overlapTags = sourceTags.filter((tag) => targetTagSet.has(tag));
    const overlapSet = new Set(overlapTags);

    const requestedMatchTags = normalizeMatchingTags(raw.match_tags as Array<string | null | undefined> | string | null | undefined, 50);
    const sanitizedMatchTags = requestedMatchTags.filter((tag) => overlapSet.has(tag));
    const finalMatchTags = (sanitizedMatchTags.length > 0 ? sanitizedMatchTags : overlapTags).slice(0, maxMatchTags);

    const parsedScore = Number(raw.score);
    const score = Number.isFinite(parsedScore) ? Math.max(1, Math.min(10, Math.round(parsedScore))) : 4;

    const result: MatchingResultShape = {
      id: typeof raw.id === "number" ? raw.id : idKey,
      score,
      begrunnelse: truncateReason(
        typeof raw.begrunnelse === "string" && raw.begrunnelse.trim()
          ? raw.begrunnelse
          : options.fallbackReason || "Relevant teknologimatch",
      ),
      match_tags: finalMatchTags,
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

    acc.push(result);
    return acc;
  }, []);
}
