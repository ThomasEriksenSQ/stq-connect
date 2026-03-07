export const CATEGORIES = [
  { label: "Behov nå", badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { label: "Får fremtidig behov", badgeColor: "bg-blue-100 text-blue-800 border-blue-200" },
  { label: "Vil kanskje få behov", badgeColor: "bg-amber-100 text-amber-800 border-amber-200" },
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
    const normalizedSubject = normalizeCategoryLabel(subject);
    // Exact match
    if (CATEGORIES.some(c => c.label === normalizedSubject)) return normalizedSubject;
    // Subject contains a category label (case-insensitive)
    const subjectLower = subject.toLowerCase();
    for (const c of CATEGORIES) {
      if (subjectLower.includes(c.label.toLowerCase())) return c.label;
    }
    // Check legacy labels in subject
    for (const [legacy, mapped] of Object.entries(LEGACY_CATEGORY_MAP)) {
      if (subjectLower.includes(legacy.toLowerCase())) return mapped;
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
