export const DEFAULT_PROJECTS_SECTION_TITLE = "Prosjekter";
const LEGACY_CV_DOCUMENT_TITLE = "CV";

export function normalizeProjectsSectionTitle(value?: string | null) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed || trimmed === LEGACY_CV_DOCUMENT_TITLE) return "";
  return trimmed;
}

export function getProjectsSectionTitle(value?: string | null) {
  return normalizeProjectsSectionTitle(value) || DEFAULT_PROJECTS_SECTION_TITLE;
}
