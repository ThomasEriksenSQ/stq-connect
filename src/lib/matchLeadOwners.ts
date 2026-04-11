export type MatchLeadOwnerSource = "contact" | "company" | "fallback_contact" | "none";

export type MatchLeadOwner = {
  ownerId: string | null;
  ownerName: string | null;
  ownerSource: MatchLeadOwnerSource;
};

type OwnerProfileLike = {
  id?: string | null;
  full_name?: string | null;
} | null;

type OwnerRelationLike = {
  owner_id?: string | null;
  profiles?: OwnerProfileLike;
} | null | undefined;

export const MATCH_OWNER_FILTER_NONE = "__none__";

export function buildMatchLeadOwnerCandidate(
  relation: OwnerRelationLike,
  source: Exclude<MatchLeadOwnerSource, "none">,
): MatchLeadOwner | null {
  const ownerId = relation?.profiles?.id || relation?.owner_id || null;
  const ownerName = relation?.profiles?.full_name || null;

  if (!ownerId && !ownerName) return null;

  return {
    ownerId,
    ownerName,
    ownerSource: source,
  };
}

export function resolveMatchLeadOwner(...candidates: Array<MatchLeadOwner | null | undefined>): MatchLeadOwner {
  const resolved = candidates.find((candidate) => candidate && (candidate.ownerId || candidate.ownerName));
  if (!resolved) {
    return {
      ownerId: null,
      ownerName: null,
      ownerSource: "none",
    };
  }

  return {
    ownerId: resolved.ownerId ?? null,
    ownerName: resolved.ownerName ?? null,
    ownerSource: resolved.ownerSource,
  };
}

export function matchesMatchLeadOwnerFilter(ownerId: string | null, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === MATCH_OWNER_FILTER_NONE) return !ownerId;
  return ownerId === filter;
}

export function getMatchLeadOwnerLabel(ownerId: string | null, ownerName: string | null): string {
  if (ownerName) return ownerName;
  if (ownerId) return "Ukjent eier";
  return "Uten eier";
}
