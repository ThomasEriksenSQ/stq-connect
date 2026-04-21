// Forenklet Deno-port av src/lib/heatScore.ts → kun det edge-funksjonen trenger
// for å replikere /kontakter sin priority-sortering (tier asc, heatScore desc).

export type Tier = 1 | 2 | 3 | 4;

export interface HeatInput {
  signal: string;
  isInnkjoper: boolean;
  hasMarkedsradar: boolean;
  hasAktivForespørsel: boolean;
  hasOverdue: boolean;
  daysSinceLastContact: number;
  hasTidligereForespørsel?: boolean;
  ikkeAktuellKontakt?: boolean;
  ikkeRelevantSelskap?: boolean;
  kes?: boolean;
}

export interface HeatResult {
  tier: Tier;
  score: number;
}

export type ActivityStatus = "LA_ny" | "LA_mid" | "LA_gammel" | "LA_zombie" | "LA_aldri";
export type TaskStatus =
  | "FO_nær"
  | "FO_mid"
  | "FO_gammel"
  | "O45"
  | "O60"
  | "O90"
  | "AnyO"
  | "ingen";

function getActivityStatus(daysSince: number): ActivityStatus {
  if (daysSince === 999 || daysSince < 0) return "LA_aldri";
  if (daysSince < 14) return "LA_ny";
  if (daysSince <= 45) return "LA_mid";
  if (daysSince <= 90) return "LA_gammel";
  return "LA_zombie";
}

function diffDays(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

export function getTaskStatus(tasks: Array<{ due_date: string | null; status: string }>): TaskStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const open = tasks.filter((t) => t.status !== "done" && t.status !== "completed");
  for (const t of open) {
    if (!t.due_date) continue;
    const due = new Date(t.due_date);
    due.setHours(0, 0, 0, 0);
    if (due < today) {
      const daysOverdue = diffDays(today, due);
      if (daysOverdue < 14) return "FO_nær";
      if (daysOverdue <= 45) return "FO_mid";
      return "FO_gammel";
    }
  }
  for (const t of open) {
    if (!t.due_date) continue;
    const due = new Date(t.due_date);
    due.setHours(0, 0, 0, 0);
    const daysUntil = diffDays(due, today);
    if (daysUntil <= 45) return "O45";
    if (daysUntil <= 60) return "O60";
    if (daysUntil <= 90) return "O90";
    return "AnyO";
  }
  if (open.some((t) => !t.due_date)) return "AnyO";
  return "ingen";
}

export function getTier(signal: string, hasFN: boolean): Tier {
  if (signal === "Behov nå") return 1;
  if (signal === "Får fremtidig behov") return 2;
  if (signal === "Får kanskje behov") return 3;
  if (hasFN) return 3;
  return 4;
}

export function getHeatResult(params: HeatInput, taskStatus?: TaskStatus): HeatResult {
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
    kes = false,
  } = params;

  if (ikkeAktuellKontakt || ikkeRelevantSelskap || signal === "Ikke aktuelt") {
    return { tier: 4, score: -1000 };
  }

  let score = 0;
  if (hasAktivForespørsel) score += 20;
  if (hasAktivForespørsel && signal === "Behov nå") score += 5;
  if (isInnkjoper) score += 8;
  if (hasMarkedsradar) score += 7;
  if (hasTidligereForespørsel) score += 5;
  if (kes) score += 7;

  const ts = taskStatus ?? (hasOverdue ? "FO_nær" : "ingen");
  if (ts === "FO_nær") score += 12;
  else if (ts === "FO_mid") score += 6;
  else if (ts === "FO_gammel") score += 2;
  else if (ts === "O45") score += 10;
  else if (ts === "O60") score += 6;
  else if (ts === "O90") score += 4;
  else if (ts === "AnyO") score += 2;

  const as_ = getActivityStatus(daysSinceLastContact);
  if (as_ === "LA_ny") score += 6;
  else if (as_ === "LA_mid") score += 3;
  else if (as_ === "LA_gammel") score -= 4;
  else if (as_ === "LA_zombie") score -= 10;

  return { tier: getTier(signal, hasMarkedsradar), score };
}
