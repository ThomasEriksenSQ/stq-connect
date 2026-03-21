import { differenceInDays } from "date-fns";

export const TEMP_CONFIG = {
  hett:    { label: "Hett",    bg: "bg-red-500",    text: "text-white",      dot: "bg-red-500",    bar: "bg-red-500"    },
  lovende: { label: "Lovende", bg: "bg-orange-400", text: "text-white",      dot: "bg-orange-400", bar: "bg-orange-400" },
  mulig:   { label: "Mulig",   bg: "bg-amber-400",  text: "text-amber-900",  dot: "bg-amber-400",  bar: "bg-amber-400"  },
  sovende: { label: "Sovende", bg: "bg-gray-200",   text: "text-gray-600",   dot: "bg-gray-400",   bar: "bg-gray-300"   },
};

export function calcHeatScore(params: {
  signal: string;
  isInnkjoper: boolean;
  hasMarkedsradar: boolean;
  hasAktivForespørsel: boolean;
  hasOverdue: boolean;
  daysSinceLastContact: number;
}): number {
  let score = 0;
  if (params.signal === "Behov nå") score += 40;
  else if (params.signal === "Får fremtidig behov") score += 20;
  else if (params.signal === "Får kanskje behov") score += 8;
  else if (params.signal === "Ukjent om behov") score += 16;
  if (params.isInnkjoper) score += 15;
  if (params.hasMarkedsradar) score += 12;
  if (params.hasMarkedsradar && params.signal === "Behov nå") score += 8;
  if (params.hasAktivForespørsel) score += 15;
  if (params.hasOverdue) score += 10;
  if (params.daysSinceLastContact > 90) score += 5;
  if (params.daysSinceLastContact > 180) score += 5;
  return score;
}

export function getTemperature(params: {
  score: number;
  signal: string;
  hasOverdue: boolean;
  hasMarkedsradar: boolean;
  isInnkjoper: boolean;
}): "hett" | "lovende" | "mulig" | "sovende" {
  const { signal, hasOverdue, hasMarkedsradar, isInnkjoper, score } = params;
  if (signal === "Behov nå" && hasOverdue) return "hett";
  if (signal === "Behov nå" && hasMarkedsradar) return "hett";
  if (isInnkjoper && signal === "Behov nå") return "hett";
  if (signal === "Behov nå") return "lovende";
  if (hasMarkedsradar && signal === "Får fremtidig behov") return "lovende";
  if (isInnkjoper && signal === "Får fremtidig behov") return "lovende";
  if (score >= 35) return "lovende";
  if (signal === "Får fremtidig behov") return "mulig";
  if (signal === "Får kanskje behov") return "mulig";
  if (hasMarkedsradar) return "mulig";
  if (isInnkjoper) return "mulig";
  return "sovende";
}
