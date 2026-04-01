import { relativeTime } from "@/lib/relativeDate";

export type MatchSourceFilter = "Alle" | "Ansatte" | "Eksterne";

export interface ConsultantMatchLike {
  id: number | string;
  navn: string;
  type?: "intern" | "ekstern";
  score: number;
  begrunnelse: string;
  match_tags: string[];
}

export function sortConsultantMatches<T extends ConsultantMatchLike>(matches: T[]): T[] {
  return [...matches].sort(
    (left, right) =>
      right.score - left.score ||
      left.navn.localeCompare(right.navn, "nb"),
  );
}

export function filterConsultantMatches<T extends ConsultantMatchLike>(
  matches: T[],
  filter: MatchSourceFilter,
): T[] {
  return matches.filter((match) => {
    if (filter === "Alle") return true;
    if (filter === "Ansatte") return match.type === "intern";
    return match.type === "ekstern";
  });
}

export function getConsultantMatchScoreColor(score: number) {
  if (score >= 8) return "bg-emerald-500";
  if (score >= 6) return "bg-amber-500";
  return "bg-red-500";
}

export function formatConsultantMatchFreshness(timestamp: string | null) {
  if (!timestamp) return null;
  const label = relativeTime(timestamp);
  return label === "Nå" ? "Sist kjørt nå" : `Sist kjørt ${label}`;
}
