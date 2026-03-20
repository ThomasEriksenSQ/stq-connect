import { differenceInDays, isPast, isToday } from "date-fns";
import { getEffectiveSignal } from "@/lib/categoryUtils";

export function calcHeatScore(
  contact: any,
  activities: any[],
  tasks: any[],
  foresporsler: any[]
): number {
  const signal = getEffectiveSignal(
    activities.map(a => ({ created_at: a.created_at, subject: a.subject, description: a.description })),
    tasks.map(t => ({ created_at: t.created_at, title: t.title, description: t.description, due_date: t.due_date }))
  );

  if (signal === "Ikke aktuelt") return 0;

  let score = 0;

  if (signal === "Behov nå") score += 40;
  else if (signal === "Får fremtidig behov") score += 20;
  else if (signal === "Får kanskje behov") score += 8;

  if (contact.call_list) score += 20;

  const harForesp = foresporsler.some((f: any) => f.selskap_id === contact.company_id);
  if (harForesp) score += 15;

  const sisteAkt = activities[0]?.created_at;
  if (sisteAkt) {
    const dager = differenceInDays(new Date(), new Date(sisteAkt));
    if (dager <= 7) score += 10;
    else if (dager <= 30) score += 5;
    else if (dager > 90) score -= 10;
  } else {
    score -= 15;
  }

  const harForfalt = tasks.some(t =>
    t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))
  );
  if (harForfalt) score += 10;

  return Math.max(0, score);
}
