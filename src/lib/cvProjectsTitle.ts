import { getCvCopy, type CvLanguageCode } from "@/lib/cvLanguage";

export const DEFAULT_PROJECTS_SECTION_TITLE = getCvCopy("nb").projectsDefaultTitle;
const LEGACY_CV_DOCUMENT_TITLE = "CV";

export function normalizeProjectsSectionTitle(value?: string | null) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed || trimmed === LEGACY_CV_DOCUMENT_TITLE) return "";
  return trimmed;
}

export function getDefaultProjectsSectionTitle(languageCode: CvLanguageCode = "nb") {
  return getCvCopy(languageCode).projectsDefaultTitle;
}

export function getProjectsSectionTitle(value?: string | null, languageCode: CvLanguageCode = "nb") {
  return normalizeProjectsSectionTitle(value) || getDefaultProjectsSectionTitle(languageCode);
}
