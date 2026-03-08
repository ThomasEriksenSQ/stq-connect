import { differenceInDays } from "date-fns";

export const CATEGORIES = [
  { label: "Behov nå", badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { label: "Får fremtidig behov", badgeColor: "bg-blue-100 text-blue-800 border-blue-200" },
  { label: "Får kanskje behov", badgeColor: "bg-amber-100 text-amber-800 border-amber-200" },
  { label: "Ukjent om behov", badgeColor: "bg-gray-100 text-gray-600 border-gray-200" },
  { label: "Ikke aktuelt", badgeColor: "bg-red-50 text-red-700 border-red-200" },
] as const;

export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  "Fremtidig behov": "Får fremtidig behov",
  "Har kanskje behov": "Vil kanskje få behov",
  "Aldri aktuelt": "Ikke aktuelt",
};

export function normalizeCategoryLabel(label: string): string {
  return LEGACY_CATEGORY_MAP[label] || label;
}

/**
 * Extract category from an activity/task using subject and description.
 * Checks: exact subject match, subject contains label, description bracket prefix.
 */
export function extractCategory(subject: string | null, description: string | null): string {
  if (subject) {
    const trimmed = subject.trim();
    // Exact match (case-insensitive) against current labels
    const normalizedSubject = normalizeCategoryLabel(trimmed);
    if (CATEGORIES.some(c => c.label.toLowerCase() === normalizedSubject.toLowerCase())) {
      return CATEGORIES.find(c => c.label.toLowerCase() === normalizedSubject.toLowerCase())!.label;
    }
    // Exact match against legacy labels
    for (const [legacy, mapped] of Object.entries(LEGACY_CATEGORY_MAP)) {
      if (trimmed.toLowerCase() === legacy.toLowerCase()) return mapped;
    }
  }
  if (description) {
    const match = description.match(/^\[([^\]]+)\]\n?/);
    if (match) {
      const cat = normalizeCategoryLabel(match[1]);
      if (CATEGORIES.some(c => c.label === cat)) return cat;
    }
  }
  return "";
}

export const SIGNAL_ORDER = CATEGORIES.map(c => c.label);

/* ── Signal expiry TTL (in days from created_at for activities) ── */
const SIGNAL_TTL: Record<string, number | null> = {
  "Behov nå": 30,
  "Får fremtidig behov": 90,
  "Vil kanskje få behov": 180,
  "Ukjent om behov": null, // never expires
  "Ikke aktuelt": null,    // never expires
};

interface SignalItem {
  /** For activities: created_at. For tasks: created_at */
  created_at: string;
  /** For activities: subject. For tasks: title */
  subject: string | null;
  description: string | null;
  /** Only present on tasks */
  due_date?: string | null;
  /** "activity" or "task" */
  _type: "activity" | "task";
}

/**
 * Given all activities and tasks for a contact/company, return the most recent
 * VALID (non-expired) signal category, or "" if none.
 *
 * Priority:
 * 1. Most recent PAST activity (created_at <= now) with a valid non-expired category
 * 2. Only if no past activity signal: most recent FUTURE task (due_date > today) with a category
 */
export function getEffectiveSignal(
  activities: Array<{ created_at: string; subject: string; description: string | null }>,
  tasks: Array<{ created_at: string; title: string; description: string | null; due_date?: string | null }>
): string {
  const now = new Date();

  // 1. Check past activities (most recent first)
  const sortedActs = [...activities].sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const act of sortedActs) {
    if (new Date(act.created_at) > now) continue; // skip future-dated activities
    const cat = extractCategory(act.subject, act.description);
    if (!cat) continue;
    const ttl = SIGNAL_TTL[cat];
    if (ttl === null) return cat; // never expires
    if (ttl !== undefined) {
      const daysSince = differenceInDays(now, new Date(act.created_at));
      if (daysSince <= ttl) return cat;
      // expired, keep looking
    }
  }

  // 2. Fallback: future tasks (nearest due_date first)
  const futureTasks = tasks
    .filter(t => t.due_date && new Date(t.due_date) >= now)
    .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
  for (const task of futureTasks) {
    const cat = extractCategory(task.title, task.description);
    if (cat) return cat;
  }

  return "";
}
