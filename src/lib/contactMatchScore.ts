import {
  getCanonicalMatchScore,
  getMatchBand,
  getMatchBandRank,
  normalizeScoredMatchTags,
  type ConfidenceBand,
  type MatchBand,
} from "../../supabase/functions/_shared/matchScore.ts";

export type { ConfidenceBand, MatchBand };

export interface ContactMatchScoreResult {
  score10: number;
  matchBand: MatchBand | null;
  matchTags: string[];
  coverage: number;
  precision: number;
  matchedWeight: number;
  technicalFit: number;
  evidence: number;
  confidenceScore: number;
  confidenceBand: ConfidenceBand;
  matchedLayerCount: number;
}

export function normalizeMatchTags(values: Array<string | null | undefined> | string | null | undefined): string[] {
  return normalizeScoredMatchTags(values, 18);
}

export { getMatchBand, getMatchBandRank };

export function getContactMatchScore(
  consultantValues: Array<string | null | undefined> | string | null | undefined,
  leadValues: Array<string | null | undefined> | string | null | undefined,
): ContactMatchScoreResult {
  const result = getCanonicalMatchScore(leadValues, consultantValues, 18);

  return {
    score10: result.score10,
    matchBand: result.matchBand,
    matchTags: result.matchTags,
    coverage: result.targetCoverage,
    precision: result.sourceCoverage,
    matchedWeight: result.matchedWeight,
    technicalFit: result.technicalFit,
    evidence: result.evidenceScore,
    confidenceScore: result.confidenceScore,
    confidenceBand: result.confidenceBand,
    matchedLayerCount: result.matchedLayerCount,
  };
}
