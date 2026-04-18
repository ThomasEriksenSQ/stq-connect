import { C, SIGNAL_COLORS } from "@/theme";

export const CATEGORIES = [
  { label: "Behov nå" },
  { label: "Får fremtidig behov" },
  { label: "Får kanskje behov" },
  { label: "Ukjent om behov" },
  { label: "Ikke aktuelt" },
] as const;

export const SIGNAL_OPTIONS = CATEGORIES.map((category) => ({
  label: category.label,
  badgeColor:
    category.label === "Behov nå"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : category.label === "Får fremtidig behov"
        ? "bg-blue-100 text-blue-800 border-blue-200"
        : category.label === "Får kanskje behov"
          ? "bg-amber-100 text-amber-800 border-amber-200"
          : category.label === "Ukjent om behov"
            ? "bg-gray-100 text-gray-600 border-gray-200"
            : "bg-red-50 text-red-700 border-red-200",
}));

export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  "Fremtidig behov": "Får fremtidig behov",
  "Har kanskje behov": "Får kanskje behov",
  "Vil kanskje få behov": "Får kanskje behov",
  "Aldri aktuelt": "Ikke aktuelt",
};

function coerceText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (value == null) return "";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of [
      "label",
      "name",
      "title",
      "subject",
      "description",
      "text",
      "content",
      "value",
      "date",
      "created_at",
      "updated_at",
      "due_date",
    ]) {
      const nested = coerceText(record[key]);
      if (nested) return nested;
    }
  }
  return "";
}

function parseDateValue(value: unknown): Date | null {
  const text = coerceText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeCategoryLabel(label: string | null | undefined): string {
  const normalizedLabel = coerceText(label).trim();
  return LEGACY_CATEGORY_MAP[normalizedLabel] || normalizedLabel;
}

export function getSignalBadgeColors(category: string | null) {
  if (!category) return null;

  const normalized = normalizeCategoryLabel(category);
  return SIGNAL_COLORS[normalized as keyof typeof SIGNAL_COLORS] || null;
}

export function getSignalBadgeStyle(category: string | null) {
  const colors = getSignalBadgeColors(category);
  if (!colors) {
    return {
      background: C.statusNeutralBg,
      color: C.statusNeutral,
      border: `1px solid ${C.statusNeutralBorder}`,
    };
  }

  return {
    background: colors.bg,
    color: colors.color,
    border: `1px solid ${colors.border}`,
  };
}

export function buildDescriptionWithCategory(category: string | null | undefined, description: string | null | undefined): string {
  const normalizedCategory = normalizeCategoryLabel(category);
  const normalizedDescription = coerceText(description);
  if (!normalizedCategory) return normalizedDescription;
  return normalizedDescription ? `[${normalizedCategory}]\n${normalizedDescription}` : `[${normalizedCategory}]`;
}

export function parseDescriptionCategory(description: unknown): { category: string; text: string } {
  const normalizedDescription = coerceText(description);
  if (!normalizedDescription) return { category: "", text: "" };

  const match = normalizedDescription.match(/^\[([^\]]+)\]\n?([\s\S]*)$/);
  if (!match) return { category: "", text: normalizedDescription };

  const category = normalizeCategoryLabel(match[1]);
  if (!CATEGORIES.some((c) => c.label === category)) {
    return { category: "", text: normalizedDescription };
  }

  return { category, text: match[2].trim() };
}

export function hasSomedayMarker(description: unknown): boolean {
  return /\[someday\]/i.test(coerceText(description));
}

export function stripSomedayMarker(description: unknown): string {
  return coerceText(description).replace(/\n?\[someday\]/gi, "").trim();
}

export function upsertTaskSignalDescription(
  description: unknown,
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
export function extractCategory(subject: unknown, description: unknown): string {
  const normalizedSubjectText = coerceText(subject);
  const normalizedDescription = coerceText(description);

  if (normalizedSubjectText) {
    const trimmed = normalizedSubjectText.trim();
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
  if (normalizedDescription) {
    const match = normalizedDescription.match(/^\[([^\]]+)\]\n?/);
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
  const rank = (SIGNAL_ORDER as readonly string[]).indexOf(normalized);
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

  const normalizedTasks = tasks.map((task) => ({
    createdAt: parseDateValue(task.created_at),
    updatedAt: parseDateValue(task.updated_at),
    dueDate: parseDateValue(task.due_date),
    title: coerceText(task.title),
    description: coerceText(task.description) || null,
    status: coerceText(task.status) || null,
  }));

  const sortedTasks = [...normalizedTasks]
    .filter((task) => task.status !== "done")
    .sort((a, b) => {
      const aDueTime = a.dueDate?.getTime() ?? null;
      const bDueTime = b.dueDate?.getTime() ?? null;
      if (aDueTime != null && bDueTime != null && aDueTime !== bDueTime) {
        return aDueTime - bDueTime;
      }
      if (aDueTime != null && bDueTime == null) return -1;
      if (aDueTime == null && bDueTime != null) return 1;

      const aTouchedAt = a.updatedAt?.getTime() ?? a.createdAt?.getTime() ?? -Infinity;
      const bTouchedAt = b.updatedAt?.getTime() ?? b.createdAt?.getTime() ?? -Infinity;
      return bTouchedAt - aTouchedAt;
    });

  for (const task of sortedTasks) {
    const cat = extractCategory(task.title, task.description);
    if (cat) return cat;
  }

  const normalizedActivities = activities.map((activity) => ({
    createdAt: parseDateValue(activity.created_at),
    subject: coerceText(activity.subject),
    description: coerceText(activity.description) || null,
  }));

  const sortedActs = [...normalizedActivities].sort(
    (a, b) => (b.createdAt?.getTime() ?? -Infinity) - (a.createdAt?.getTime() ?? -Infinity),
  );
  for (const act of sortedActs) {
    if (act.createdAt && act.createdAt > now) continue;
    const cat = extractCategory(act.subject, act.description);
    if (cat) return cat;
  }

  return "";
}
