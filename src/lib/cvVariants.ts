import type { CVDocument } from "@/components/cv/CvRenderer";
import { getCvCopy, type CvLanguageCode } from "@/lib/cvLanguage";

export type CvVariantLanguageCode = CvLanguageCode;

export type CvVariantIdentity = {
  languageCode: CvVariantLanguageCode;
  isAnonymized: boolean;
};

export const ORIGINAL_NB_CV_VARIANT: CvVariantIdentity = {
  languageCode: "nb",
  isAnonymized: false,
};

export const ANONYMIZED_NB_CV_VARIANT: CvVariantIdentity = {
  languageCode: "nb",
  isAnonymized: true,
};

export const ORIGINAL_EN_CV_VARIANT: CvVariantIdentity = {
  languageCode: "en",
  isAnonymized: false,
};

export const ANONYMIZED_EN_CV_VARIANT: CvVariantIdentity = {
  languageCode: "en",
  isAnonymized: true,
};

export const ALL_CV_VARIANTS: CvVariantIdentity[] = [
  ORIGINAL_NB_CV_VARIANT,
  ANONYMIZED_NB_CV_VARIANT,
  ORIGINAL_EN_CV_VARIANT,
  ANONYMIZED_EN_CV_VARIANT,
];

export function getCvVariantStorageKey(variant: CvVariantIdentity) {
  return `${variant.languageCode}:${variant.isAnonymized ? "anonymized" : "original"}`;
}

export function isRootCvVariant(variant: CvVariantIdentity) {
  return variant.languageCode === "nb" && !variant.isAnonymized;
}

export function getCvVariantSource(variant: CvVariantIdentity): CvVariantIdentity | null {
  if (isRootCvVariant(variant)) return null;
  if (variant.languageCode === "nb" && variant.isAnonymized) return ORIGINAL_NB_CV_VARIANT;
  if (variant.languageCode === "en" && !variant.isAnonymized) return ORIGINAL_NB_CV_VARIANT;
  return ANONYMIZED_NB_CV_VARIANT;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getAnonymizedHeroName(languageCode: CvVariantLanguageCode) {
  return getCvCopy(languageCode).anonymousCandidate;
}

function getAnonymizedSubjectPlaceholder(languageCode: CvVariantLanguageCode) {
  return getCvCopy(languageCode).anonymizedSubject;
}

function getAnonymizedPossessivePlaceholder(languageCode: CvVariantLanguageCode) {
  return getCvCopy(languageCode).anonymizedPossessive;
}

function collapseDuplicatePlaceholderRuns(text: string, placeholder: string) {
  if (!text.trim() || !placeholder.trim()) return text;

  return text.replace(
    new RegExp(`\\b(${escapeRegex(placeholder)})(?:\\s+\\1\\b)+`, "giu"),
    placeholder,
  );
}

function replaceStandalonePhrase(text: string, phrase: string, replacement: string) {
  if (!text.trim() || !phrase.trim() || phrase === replacement) return text;

  return text.replace(
    new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRegex(phrase)})(?=$|[^\\p{L}\\p{N}])`, "giu"),
    `$1${replacement}`,
  );
}

function localizeAnonymizedPlaceholders(text: string, languageCode: CvVariantLanguageCode) {
  const targetSubject = getAnonymizedSubjectPlaceholder(languageCode);
  const targetPossessive = getAnonymizedPossessivePlaceholder(languageCode);

  let nextText = text;
  (["nb", "en"] as const).forEach((candidateLanguageCode) => {
    nextText = replaceStandalonePhrase(
      nextText,
      getAnonymizedPossessivePlaceholder(candidateLanguageCode),
      targetPossessive,
    );
  });
  (["nb", "en"] as const).forEach((candidateLanguageCode) => {
    nextText = replaceStandalonePhrase(nextText, getAnonymizedSubjectPlaceholder(candidateLanguageCode), targetSubject);
  });

  return nextText;
}

function normalizeAnonymizedText(text: string, languageCode: CvVariantLanguageCode = "nb") {
  if (!text.trim()) return text;

  const localizedText = localizeAnonymizedPlaceholders(text, languageCode);

  return collapseDuplicatePlaceholderRuns(
    collapseDuplicatePlaceholderRuns(localizedText, getAnonymizedPossessivePlaceholder(languageCode)),
    getAnonymizedSubjectPlaceholder(languageCode),
  );
}

function normalizeAnonymizedHeroName(value: string, languageCode: CvVariantLanguageCode) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return getAnonymizedHeroName(languageCode);

  const isKnownAnonymousHeroName = (["nb", "en"] as const).some(
    (candidateLanguageCode) =>
      trimmedValue.toLocaleLowerCase() === getAnonymizedHeroName(candidateLanguageCode).toLocaleLowerCase(),
  );

  return isKnownAnonymousHeroName ? getAnonymizedHeroName(languageCode) : value;
}

function buildCandidatePatterns(fullName: string) {
  const cleanName = fullName.trim().replace(/\s+/g, " ");
  if (!cleanName) return [];

  const tokens = cleanName
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

  return Array.from(new Set([cleanName, ...tokens])).sort((left, right) => right.length - left.length);
}

export function replaceCandidateReferences(
  text: string,
  fullName: string,
  languageCode: CvVariantLanguageCode = "nb",
) {
  if (!text.trim() || !fullName.trim()) return text;

  const subjectPlaceholder = getAnonymizedSubjectPlaceholder(languageCode);
  const possessivePlaceholder = getAnonymizedPossessivePlaceholder(languageCode);

  const replacedText = buildCandidatePatterns(fullName).reduce((currentText, pattern) => {
    const escapedPattern = escapeRegex(pattern.trim());

    const withPossessiveFormsHandled = currentText
      .replace(
        new RegExp(`(^|[^\\p{L}\\p{N}])(${escapedPattern})\\s+sin(?=$|[^\\p{L}\\p{N}])`, "giu"),
        `$1${possessivePlaceholder}`,
      )
      .replace(
        new RegExp(`(^|[^\\p{L}\\p{N}])(${escapedPattern})(?:'s|s)(?=$|[^\\p{L}\\p{N}])`, "giu"),
        `$1${possessivePlaceholder}`,
      );

    return withPossessiveFormsHandled.replace(
      new RegExp(`(^|[^\\p{L}\\p{N}])(${escapedPattern})(?=$|[^\\p{L}\\p{N}])`, "giu"),
      `$1${subjectPlaceholder}`,
    );
  }, text);

  return normalizeAnonymizedText(replacedText, languageCode);
}

export function normalizeAnonymizedCvDocument(
  doc: CVDocument,
  languageCode: CvVariantLanguageCode = "nb",
): CVDocument {
  const normalize = (value: string) => normalizeAnonymizedText(value, languageCode);

  return {
    ...doc,
    hero: {
      ...doc.hero,
      name: normalizeAnonymizedHeroName(normalize(doc.hero.name), languageCode),
      title: normalize(doc.hero.title),
      portrait_url: undefined,
    },
    sidebarSections: doc.sidebarSections.map((section) => ({
      heading: normalize(section.heading),
      items: section.items.map(normalize),
    })),
    introParagraphs: doc.introParagraphs.map(normalize),
    competenceGroups: doc.competenceGroups.map((group) => ({
      label: normalize(group.label),
      content: normalize(group.content),
    })),
    projectsTitle: normalize(doc.projectsTitle),
    projects: doc.projects.map((project) => ({
      ...project,
      company: normalize(project.company),
      subtitle: normalize(project.subtitle),
      role: normalize(project.role),
      period: normalize(project.period),
      paragraphs: project.paragraphs.map(normalize),
      technologies: normalize(project.technologies),
    })),
    additionalSections: doc.additionalSections.map((section) => ({
      ...section,
      title: normalize(section.title),
      items: section.items.map((item) => ({
        period: normalize(item.period),
        primary: normalize(item.primary),
      })),
    })),
    education: doc.education.map((entry) => ({
      period: normalize(entry.period),
      primary: normalize(entry.primary),
      secondary: normalize(entry.secondary || ""),
    })),
    workExperience: doc.workExperience.map((entry) => ({
      period: normalize(entry.period),
      primary: normalize(entry.primary),
      secondary: normalize(entry.secondary || ""),
    })),
  };
}

export function applyCvVariantInvariants(doc: CVDocument, variant: CvVariantIdentity): CVDocument {
  if (!variant.isAnonymized) return doc;

  return normalizeAnonymizedCvDocument(
    {
      ...doc,
      hero: {
        ...doc.hero,
        name: getAnonymizedHeroName(variant.languageCode),
        portrait_url: undefined,
      },
    },
    variant.languageCode,
  );
}

export function createAnonymizedCvDocument(
  doc: CVDocument,
  languageCode: CvVariantLanguageCode = "nb",
): CVDocument {
  const fullName = doc.hero.name.trim();
  const replaceName = (value: string) => replaceCandidateReferences(value, fullName, languageCode);

  return normalizeAnonymizedCvDocument({
    ...doc,
    hero: {
      ...doc.hero,
      name: getAnonymizedHeroName(languageCode),
      title: replaceName(doc.hero.title),
      portrait_url: undefined,
    },
    sidebarSections: doc.sidebarSections.map((section) => ({
      heading: replaceName(section.heading),
      items: section.items.map(replaceName),
    })),
    introParagraphs: doc.introParagraphs.map(replaceName),
    competenceGroups: doc.competenceGroups.map((group) => ({
      label: replaceName(group.label),
      content: replaceName(group.content),
    })),
    projectsTitle: replaceName(doc.projectsTitle),
    projects: doc.projects.map((project) => ({
      ...project,
      company: replaceName(project.company),
      subtitle: replaceName(project.subtitle),
      role: replaceName(project.role),
      period: replaceName(project.period),
      paragraphs: project.paragraphs.map(replaceName),
      technologies: replaceName(project.technologies),
    })),
    additionalSections: doc.additionalSections.map((section) => ({
      ...section,
      title: replaceName(section.title),
      items: section.items.map((item) => ({
        period: replaceName(item.period),
        primary: replaceName(item.primary),
      })),
    })),
    education: doc.education.map((entry) => ({
      period: replaceName(entry.period),
      primary: replaceName(entry.primary),
      secondary: replaceName(entry.secondary || ""),
    })),
    workExperience: doc.workExperience.map((entry) => ({
      period: replaceName(entry.period),
      primary: replaceName(entry.primary),
      secondary: replaceName(entry.secondary || ""),
    })),
  }, languageCode);
}
