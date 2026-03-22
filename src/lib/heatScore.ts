import { differenceInDays } from "date-fns";

export const TEMP_CONFIG = {
  hett:    { label: "Hett",    bg: "bg-red-500",    text: "text-white",      dot: "bg-red-500",    bar: "bg-red-500"    },
  lovende: { label: "Lovende", bg: "bg-orange-400", text: "text-white",      dot: "bg-orange-400", bar: "bg-orange-400" },
  mulig:   { label: "Mulig",   bg: "bg-amber-400",  text: "text-amber-900",  dot: "bg-amber-400",  bar: "bg-amber-400"  },
  sovende: { label: "Sovende", bg: "bg-gray-200",   text: "text-gray-600",   dot: "bg-gray-400",   bar: "bg-gray-300"   },
};

export const COOLDOWN_DAYS: Record<1|2|3|4, number> = {
  1: 14,
  2: 45,
  3: 60,
  4: 90,
};

export type TaskStatus =
  | "FO_nær"     // forfalt < 14 dager siden
  | "FO_mid"     // forfalt 14–45 dager siden
  | "FO_gammel"  // forfalt > 45 dager siden
  | "O45"        // åpen task due innen 45 dager
  | "O60"        // åpen task due innen 60 dager
  | "O90"        // åpen task due innen 90 dager
  | "AnyO"       // åpen task, når som helst
  | "ingen";

export type ActivityStatus =
  | "LA_ny"      // < 14 dager
  | "LA_mid"     // 14–45 dager
  | "LA_gammel"  // 45–90 dager
  | "LA_zombie"  // > 90 dager
  | "LA_aldri";  // ingen aktivitet

export interface HeatInput {
  // Eksisterende parametere (bakoverkompatible)
  signal: string;
  isInnkjoper: boolean;
  hasMarkedsradar: boolean;
  hasAktivForespørsel: boolean;
  hasOverdue: boolean;
  daysSinceLastContact: number;
  // Nye parametere (valgfrie med defaults)
  hasTidligereForespørsel?: boolean;
  ikkeAktuellKontakt?: boolean;
  ikkeRelevantSelskap?: boolean;
  taskStatus?: TaskStatus;
  activityStatus?: ActivityStatus;
  kes?: boolean; // aktivitet etter signal
}

export interface HeatResult {
  tier: 1 | 2 | 3 | 4;
  score: number;
  temperature: "hett" | "lovende" | "mulig" | "sovende";
  reasons: string[];
  needsReview: boolean;
}

export function getTaskStatus(tasks: Array<{ due_date: string | null; status: string }>): TaskStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const openTasks = tasks.filter(t => t.status !== "done" && t.status !== "completed");
  // Sjekk forfalte først (sterkeste)
  for (const t of openTasks) {
    if (!t.due_date) continue;
    const due = new Date(t.due_date);
    due.setHours(0, 0, 0, 0);
    if (due < today) {
      const daysOverdue = differenceInDays(today, due);
      if (daysOverdue < 14) return "FO_nær";
      if (daysOverdue <= 45) return "FO_mid";
      return "FO_gammel";
    }
  }
  // Sjekk fremtidige
  for (const t of openTasks) {
    if (!t.due_date) continue;
    const due = new Date(t.due_date);
    due.setHours(0, 0, 0, 0);
    const daysUntil = differenceInDays(due, today);
    if (daysUntil <= 45) return "O45";
    if (daysUntil <= 60) return "O60";
    if (daysUntil <= 90) return "O90";
    return "AnyO";
  }
  if (openTasks.some(t => !t.due_date)) return "AnyO";
  return "ingen";
}

export function getActivityStatus(daysSince: number): ActivityStatus {
  if (daysSince === 999 || daysSince < 0) return "LA_aldri";
  if (daysSince < 14) return "LA_ny";
  if (daysSince <= 45) return "LA_mid";
  if (daysSince <= 90) return "LA_gammel";
  return "LA_zombie";
}

export function getTier(signal: string, hasFN: boolean): 1 | 2 | 3 | 4 {
  if (signal === "Behov nå") return 1;
  if (signal === "Får fremtidig behov") return 2;
  if (signal === "Får kanskje behov") return 3;
  if (hasFN) return 3; // ingen signal men FN
  if (signal === "Ukjent om behov") return 4;
  return 4;
}

export function calcHeatScore(params: HeatInput): number {
  const {
    signal,
    isInnkjoper,
    hasMarkedsradar,
    hasAktivForespørsel,
    hasOverdue,
    daysSinceLastContact,
    hasTidligereForespørsel = false,
    ikkeAktuellKontakt = false,
    ikkeRelevantSelskap = false,
    taskStatus,
    activityStatus,
    kes = false,
  } = params;

  // Hard ekskludering — returner svært lav score
  if (ikkeAktuellKontakt || ikkeRelevantSelskap || signal === "Ikke aktuelt") return -1000;

  let score = 0;

  // Forsterkere
  if (hasAktivForespørsel) score += 20;
  if (hasAktivForespørsel && signal === "Behov nå") score += 5; // kombinasjonsbonus
  if (isInnkjoper) score += 8;
  if (hasMarkedsradar) score += 7;
  if (hasTidligereForespørsel) score += 5;
  if (kes) score += 7;

  // Task-status (eksklusiv enum)
  const ts = taskStatus ?? (hasOverdue ? "FO_nær" : "ingen");
  if (ts === "FO_nær") score += 12;
  else if (ts === "FO_mid") score += 6;
  else if (ts === "FO_gammel") score += 2;
  else if (ts === "O45") score += 10;
  else if (ts === "O60") score += 6;
  else if (ts === "O90") score += 4;
  else if (ts === "AnyO") score += 2;

  // Aktivitetsstatus (eksklusiv enum)
  const as_ = activityStatus ?? getActivityStatus(daysSinceLastContact);
  if (as_ === "LA_ny") score += 6;
  else if (as_ === "LA_mid") score += 3;
  else if (as_ === "LA_gammel") score -= 4;
  else if (as_ === "LA_zombie") score -= 10;
  // LA_aldri: ingen endring

  return score;
}

export function getHeatResult(params: HeatInput): HeatResult {
  const {
    signal,
    isInnkjoper,
    hasMarkedsradar,
    hasAktivForespørsel,
    hasOverdue,
    daysSinceLastContact,
    hasTidligereForespørsel = false,
    ikkeAktuellKontakt = false,
    ikkeRelevantSelskap = false,
    taskStatus,
    activityStatus,
    kes = false,
  } = params;

  // Hard ekskludering
  if (ikkeAktuellKontakt || ikkeRelevantSelskap || signal === "Ikke aktuelt") {
    return { tier: 4, score: -1000, temperature: "sovende", reasons: [], needsReview: false };
  }

  const score = calcHeatScore(params);
  const tier = getTier(signal, hasMarkedsradar);

  // Reasons-array
  const reasons: string[] = [];
  if (signal && signal !== "Ukjent om behov") reasons.push(
    signal === "Behov nå" ? "B" :
    signal === "Får fremtidig behov" ? "F" :
    signal === "Får kanskje behov" ? "K" : signal
  );
  if (hasAktivForespørsel) reasons.push("AF");
  if (hasTidligereForespørsel) reasons.push("TF");
  if (hasMarkedsradar) reasons.push("FN");
  if (isInnkjoper) reasons.push("IN");
  if (kes) reasons.push("KES");
  const ts = taskStatus ?? (hasOverdue ? "FO_nær" : "ingen");
  if (ts !== "ingen") reasons.push(ts);
  const as_ = activityStatus ?? getActivityStatus(daysSinceLastContact);
  if (as_ !== "LA_aldri") reasons.push(as_);

  // Tilsynsflagg
  const needsReview = !!(
    signal &&
    signal !== "Ukjent om behov" &&
    (as_ === "LA_gammel" || as_ === "LA_zombie") &&
    !kes
  );

  // Temperatur
  let temperature: HeatResult["temperature"];
  if (tier === 1 && (hasAktivForespørsel || isInnkjoper || hasMarkedsradar || ts === "FO_nær")) {
    temperature = "hett";
  } else if (tier === 1) {
    temperature = "lovende";
  } else if (tier === 2 && score >= 20) {
    temperature = "lovende";
  } else if (tier === 2) {
    temperature = "mulig";
  } else if (tier === 3 && score >= 15) {
    temperature = "mulig";
  } else {
    temperature = "sovende";
  }

  return { tier, score, temperature, reasons, needsReview };
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
