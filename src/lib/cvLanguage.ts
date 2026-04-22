export type CvLanguageCode = "nb" | "en";

type CvCopy = {
  anonymousCandidate: string;
  anonymizedLabel: string;
  contactPerson: string;
  currentProjectPeriod: string;
  education: string;
  languageLabel: string;
  originalLabel: string;
  projectsDefaultTitle: string;
  technologies: string;
  workExperience: string;
  anonymizedSubject: string;
  anonymizedPossessive: string;
};

const CV_COPY: Record<CvLanguageCode, CvCopy> = {
  nb: {
    anonymousCandidate: "Anonymisert kandidat",
    anonymizedLabel: "Anonymisert",
    contactPerson: "Kontaktperson",
    currentProjectPeriod: "nåværende",
    education: "Utdannelse",
    languageLabel: "Norsk",
    originalLabel: "Original",
    projectsDefaultTitle: "Prosjekter",
    technologies: "Teknologier",
    workExperience: "Arbeidserfaring",
    anonymizedSubject: "Konsulenten",
    anonymizedPossessive: "Konsulentens",
  },
  en: {
    anonymousCandidate: "Anonymous candidate",
    anonymizedLabel: "Anonymized",
    contactPerson: "Contact person",
    currentProjectPeriod: "present",
    education: "Education",
    languageLabel: "English",
    originalLabel: "Original",
    projectsDefaultTitle: "Projects",
    technologies: "Technologies",
    workExperience: "Work experience",
    anonymizedSubject: "The consultant",
    anonymizedPossessive: "The consultant's",
  },
};

export const CV_LANGUAGE_OPTIONS: CvLanguageCode[] = ["nb", "en"];

const PROJECT_MONTH_OPTIONS_BY_LANGUAGE = {
  nb: [
    { value: 1, label: "jan." },
    { value: 2, label: "feb." },
    { value: 3, label: "mar." },
    { value: 4, label: "apr." },
    { value: 5, label: "mai" },
    { value: 6, label: "jun." },
    { value: 7, label: "jul." },
    { value: 8, label: "aug." },
    { value: 9, label: "sep." },
    { value: 10, label: "okt." },
    { value: 11, label: "nov." },
    { value: 12, label: "des." },
  ],
  en: [
    { value: 1, label: "Jan." },
    { value: 2, label: "Feb." },
    { value: 3, label: "Mar." },
    { value: 4, label: "Apr." },
    { value: 5, label: "May" },
    { value: 6, label: "Jun." },
    { value: 7, label: "Jul." },
    { value: 8, label: "Aug." },
    { value: 9, label: "Sep." },
    { value: 10, label: "Oct." },
    { value: 11, label: "Nov." },
    { value: 12, label: "Dec." },
  ],
} as const;

export type ProjectMonthOption = { value: number; label: string };

export function getCvCopy(languageCode: CvLanguageCode = "nb") {
  return CV_COPY[languageCode];
}

export function getCvLanguageLabel(languageCode: CvLanguageCode = "nb") {
  return getCvCopy(languageCode).languageLabel;
}

export function getProjectMonthOptions(languageCode: CvLanguageCode = "nb"): readonly ProjectMonthOption[] {
  return PROJECT_MONTH_OPTIONS_BY_LANGUAGE[languageCode];
}

export function getProjectMonthLabel(month: number, languageCode: CvLanguageCode = "nb") {
  return getProjectMonthOptions(languageCode).find((entry) => entry.value === month)?.label;
}
