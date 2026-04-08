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

type MatchTagCategory = "specific" | "domain" | "broad";

export type MatchBand = "strong" | "good" | "related";

export interface MatchScoreResult {
  score10: number;
  matchBand: MatchBand | null;
  matchTags: string[];
  targetCoverage: number;
  sourceCoverage: number;
  matchedWeight: number;
}

const TAG_WEIGHT: Record<MatchTagCategory, number> = {
  specific: 1,
  domain: 0.6,
  broad: 0.2,
};

function getTagCategory(tag: string): MatchTagCategory {
  if (DOMAIN_TAGS.has(tag)) return "domain";
  if (BROAD_TECH_TAGS.has(tag)) return "broad";
  return "specific";
}

function getTagWeight(tag: string): number {
  return TAG_WEIGHT[getTagCategory(tag)];
}

function getWeightedTagSum(tags: string[]): number {
  return tags.reduce((sum, tag) => sum + getTagWeight(tag), 0);
}

function getCategoryWeight(tags: string[], category: MatchTagCategory): number {
  return tags.reduce((sum, tag) => sum + (getTagCategory(tag) === category ? getTagWeight(tag) : 0), 0);
}

function compareMatchingTags(left: string, right: string): number {
  const leftCategory = getTagCategory(left);
  const rightCategory = getTagCategory(right);

  if (leftCategory !== rightCategory) {
    if (leftCategory === "specific") return -1;
    if (rightCategory === "specific") return 1;
    if (leftCategory === "domain") return -1;
    return 1;
  }

  return left.localeCompare(right, "nb");
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeScoredMatchTags(
  values: Array<string | null | undefined> | string | null | undefined,
  maxTags = DEFAULT_MAX_TAGS,
): string[] {
  return normalizeTechnologyTags(values)
    .sort(compareMatchingTags)
    .slice(0, maxTags);
}

export function getMatchBand(score10: number): MatchBand | null {
  if (score10 >= 8) return "strong";
  if (score10 >= 6) return "good";
  if (score10 >= 4) return "related";
  return null;
}

export function getMatchBandRank(band: MatchBand | null): number {
  if (band === "strong") return 3;
  if (band === "good") return 2;
  if (band === "related") return 1;
  return 0;
}

export function getCanonicalMatchScore(
  targetValues: Array<string | null | undefined> | string | null | undefined,
  sourceValues: Array<string | null | undefined> | string | null | undefined,
  maxTags = DEFAULT_MAX_TAGS,
): MatchScoreResult {
  const targetTags = normalizeScoredMatchTags(targetValues, maxTags);
  const sourceTags = normalizeScoredMatchTags(sourceValues, maxTags);

  if (targetTags.length === 0 || sourceTags.length === 0) {
    return {
      score10: 0,
      matchBand: null,
      matchTags: [],
      targetCoverage: 0,
      sourceCoverage: 0,
      matchedWeight: 0,
    };
  }

  const sourceTagSet = new Set(sourceTags);
  const matchTags = targetTags.filter((tag) => sourceTagSet.has(tag));

  if (matchTags.length === 0) {
    return {
      score10: 0,
      matchBand: null,
      matchTags: [],
      targetCoverage: 0,
      sourceCoverage: 0,
      matchedWeight: 0,
    };
  }

  const targetWeight = getWeightedTagSum(targetTags);
  const sourceWeight = getWeightedTagSum(sourceTags);
  const matchedWeight = getWeightedTagSum(matchTags);
  const targetCoverage = targetWeight > 0 ? matchedWeight / targetWeight : 0;
  const sourceCoverage = sourceWeight > 0 ? matchedWeight / sourceWeight : 0;

  const targetSpecificWeight = getCategoryWeight(targetTags, "specific");
  const sourceSpecificWeight = getCategoryWeight(sourceTags, "specific");
  const matchedSpecificWeight = getCategoryWeight(matchTags, "specific");
  const targetDomainWeight = getCategoryWeight(targetTags, "domain");
  const sourceDomainWeight = getCategoryWeight(sourceTags, "domain");
  const matchedDomainWeight = getCategoryWeight(matchTags, "domain");
  const hasOnlyBroadMatches = matchedSpecificWeight === 0 && matchedDomainWeight === 0;

  const specificTargetCoverage = targetSpecificWeight > 0 ? matchedSpecificWeight / targetSpecificWeight : 0;
  const specificSourceCoverage = sourceSpecificWeight > 0 ? matchedSpecificWeight / sourceSpecificWeight : 0;
  const domainTargetCoverage = targetDomainWeight > 0 ? matchedDomainWeight / targetDomainWeight : 0;
  const domainSourceCoverage = sourceDomainWeight > 0 ? matchedDomainWeight / sourceDomainWeight : 0;

  let rawScore =
    targetCoverage * 0.5 +
    sourceCoverage * 0.15 +
    specificTargetCoverage * 0.2 +
    specificSourceCoverage * 0.05 +
    domainTargetCoverage * 0.05 +
    domainSourceCoverage * 0.05;

  if (matchedSpecificWeight >= 2) rawScore += 0.08;
  if (matchedDomainWeight > 0) rawScore += 0.04;
  if (hasOnlyBroadMatches) rawScore -= 0.15;

  const normalized = clamp(rawScore);
  const score10 = Math.round(normalized * 10);

  return {
    score10,
    matchBand: getMatchBand(score10),
    matchTags,
    targetCoverage,
    sourceCoverage,
    matchedWeight,
  };
}
