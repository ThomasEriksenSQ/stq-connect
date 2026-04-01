export const CATEGORIES = [
  { label: "Behov nå", badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { label: "Får fremtidig behov", badgeColor: "bg-blue-100 text-blue-800 border-blue-200" },
  { label: "Får kanskje behov", badgeColor: "bg-amber-100 text-amber-800 border-amber-200" },
  { label: "Ukjent om behov", badgeColor: "bg-gray-100 text-gray-600 border-gray-200" },
  { label: "Ikke aktuelt", badgeColor: "bg-red-50 text-red-700 border-red-200" },
] as const;

export const SIGNAL_OPTIONS = CATEGORIES.map((category) => ({
  label: category.label,
  badgeColor: category.badgeColor,
}));

export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  "Fremtidig behov": "Får fremtidig behov",
  "Har kanskje behov": "Får kanskje behov",
  "Vil kanskje få behov": "Får kanskje behov",
  "Aldri aktuelt": "Ikke aktuelt",
};

export function normalizeCategoryLabel(label: string): string {
  return LEGACY_CATEGORY_MAP[label] || label;
}

export function buildDescriptionWithCategory(category: string, description: string): string {
  if (!category) return description;
  return description ? `[${category}]\n${description}` : `[${category}]`;
}

export function parseDescriptionCategory(description: string | null): { category: string; text: string } {
  if (!description) return { category: "", text: "" };

  const match = description.match(/^\[([^\]]+)\]\n?([\s\S]*)$/);
  if (!match) return { category: "", text: description };

  const category = normalizeCategoryLabel(match[1]);
  if (!CATEGORIES.some((c) => c.label === category)) {
    return { category: "", text: description };
  }

  return { category, text: match[2].trim() };
}

export function hasSomedayMarker(description: string | null): boolean {
  return /\[someday\]/i.test(description || "");
}

export function stripSomedayMarker(description: string | null): string {
  return (description || "").replace(/\n?\[someday\]/gi, "").trim();
}

export function upsertTaskSignalDescription(
  description: string | null,
  signal: string,
  someday = hasSomedayMarker(description),
): string | null {
  const parsed = parseDescriptionCategory(stripSomedayMarker(description));
  const nextDescription = buildDescriptionWithCategory(signal, parsed.text);

  if (someday) {
    return nextDescription ? `${nextDescription}\n[someday]` : "[someday]";
  }

  return nextDescription || null;
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
    if (CATEGORIES.some((c) => c.label.toLowerCase() === normalizedSubject.toLowerCase())) {
      return CATEGORIES.find((c) => c.label.toLowerCase() === normalizedSubject.toLowerCase())!.label;
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
      if (CATEGORIES.some((c) => c.label === cat)) return cat;
    }
  }
  return "";
}

export const SIGNAL_ORDER = CATEGORIES.map((c) => c.label);

export function getSignalBadge(category: string | null) {
  if (!category) return null;

  const normalized = normalizeCategoryLabel(category);
  return SIGNAL_OPTIONS.find((option) => option.label === normalized) || null;
}

export function getSignalRank(category: string | null): number {
  if (!category) return SIGNAL_ORDER.length + 1;

  const normalized = normalizeCategoryLabel(category);
  const rank = SIGNAL_ORDER.indexOf(normalized);
  return rank === -1 ? SIGNAL_ORDER.length : rank;
}

/**
 * Given all activities and open tasks for a contact/company, return the current signal.
 *
 * Priority:
 * 1. The next active follow-up/task with a signal category
 * 2. Fallback to the most recent past activity with a signal category
 */
export function getEffectiveSignal(
  activities: Array<{ created_at: string; subject: string; description: string | null }>,
  tasks: Array<{
    created_at: string;
    updated_at?: string | null;
    title: string;
    description: string | null;
    due_date?: string | null;
    status?: string | null;
  }>,
): string {
  const now = new Date();

  const sortedTasks = [...tasks]
    .filter((task) => task.status !== "done")
    .sort((a, b) => {
      if (a.due_date && b.due_date && a.due_date !== b.due_date) {
        return a.due_date.localeCompare(b.due_date);
      }
      if (a.due_date && !b.due_date) return -1;
      if (!a.due_date && b.due_date) return 1;

      const aTouchedAt = a.updated_at || a.created_at;
      const bTouchedAt = b.updated_at || b.created_at;
      return bTouchedAt.localeCompare(aTouchedAt);
    });

  for (const task of sortedTasks) {
    const cat = extractCategory(task.title, task.description);
    if (cat) return cat;
  }

  const sortedActs = [...activities].sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const act of sortedActs) {
    if (new Date(act.created_at) > now) continue;
    const cat = extractCategory(act.subject, act.description);
    if (cat) return cat;
  }

  return "";
}
