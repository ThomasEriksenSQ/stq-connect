export type CvEditorImportSegment = {
  id: string;
  page: number;
  order: number;
  text: string;
  fontSize?: number;
  isHeadingCandidate?: boolean;
};

type SegmentRef = string | string[] | null | undefined;

type ParsedSidebarSection = {
  heading?: string | null;
  headingIds?: string[] | null;
  itemIds?: string[] | null;
  items?: string[] | null;
};

type ParsedCompetenceGroup = {
  label?: string | null;
  itemIds?: string[] | null;
  content?: string | null;
};

type ParsedProject = {
  companyIds?: string[] | null;
  company?: string | null;
  subtitleIds?: string[] | null;
  subtitle?: string | null;
  roleIds?: string[] | null;
  role?: string | null;
  periodIds?: string[] | null;
  period?: string | null;
  paragraphs?: Array<string[] | string> | null;
  technologyIds?: string[] | null;
  technologies?: string | null;
};

type ParsedTimelineEntry = {
  periodIds?: string[] | null;
  period?: string | null;
  primaryIds?: string[] | null;
  primary?: string | null;
  secondaryIds?: string[] | null;
  secondary?: string | null;
};

type ParsedAdditionalSectionItem = {
  periodIds?: string[] | null;
  period?: string | null;
  itemIds?: string[] | null;
  primaryIds?: string[] | null;
  primary?: string | null;
};

type ParsedAdditionalSection = {
  titleIds?: string[] | null;
  title?: string | null;
  format?: string | null;
  items?: ParsedAdditionalSectionItem[] | null;
};

type ParsedImportResult = {
  navnIds?: string[] | null;
  navn?: string | null;
  tittelIds?: string[] | null;
  tittel?: string | null;
  sidebarSections?: ParsedSidebarSection[] | null;
  introParagraphs?: Array<string[] | string> | null;
  competenceGroups?: ParsedCompetenceGroup[] | null;
  projects?: ParsedProject[] | null;
  education?: ParsedTimelineEntry[] | null;
  workExperience?: ParsedTimelineEntry[] | null;
  additionalSections?: ParsedAdditionalSection[] | null;
  warnings?: string[] | null;
};

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

const ALLOWED_SIDEBAR_HEADINGS = new Set(["PERSONALIA", "NØKKELPUNKTER", "UTDANNELSE"]);
const COMPETENCE_SECTION_HEADINGS = new Set([
  "PROGRAMMERINGSSPRÅK",
  "SOFTWARE",
  "HARDWARE",
  "OPERATIVSYSTEMER",
  "OPERATIVSYSTEM",
  "ANNET RELEVANT",
  "ANNEN RELEVANT",
  "ANNET",
]);
const TIMELINE_SECTION_HEADINGS = new Set(["SERTIFISERINGER", "KURS", "KONFERANSER", "FOREDRAG"]);
const EDUCATION_SECTION_HEADINGS = new Set(["UTDANNELSE", "UTDANNING"]);
const WORK_EXPERIENCE_SECTION_HEADINGS = new Set(["ARBEIDSERFARING", "ERFARING"]);

function cleanDisplayText(value: string) {
  return compactWhitespace(value)
    .replace(/^Teknologier:\s*/i, "")
    .replace(/^(Rolle|Periode):\s*/i, "");
}

function isSingleLetterToken(value: string) {
  return /^[A-Za-zÆØÅæøå]$/u.test(value);
}

function isHyphenLetterToken(value: string) {
  return /^-[A-Za-zÆØÅæøå]$/u.test(value);
}

function collapseSpacedWords(value: string) {
  const normalized = compactWhitespace(value);
  const tokens = normalized.split(/\s+/);

  if (tokens.length < 4) return normalized;

  const rebuilt: string[] = [];
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index];

    if (!isSingleLetterToken(token)) {
      rebuilt.push(token);
      index += 1;
      continue;
    }

    let cursor = index;
    let currentWord = "";
    const words: string[] = [];

    while (cursor < tokens.length) {
      const currentToken = tokens[cursor];

      if (isSingleLetterToken(currentToken)) {
        if (
          currentWord &&
          currentWord.length > 1 &&
          /[a-zæøå]$/u.test(currentWord) &&
          /^[A-ZÆØÅ]$/u.test(currentToken)
        ) {
          words.push(currentWord);
          currentWord = currentToken;
        } else {
          currentWord += currentToken;
        }

        cursor += 1;
        continue;
      }

      if (isHyphenLetterToken(currentToken) && currentWord) {
        currentWord += currentToken;
        cursor += 1;
        continue;
      }

      break;
    }

    if (currentWord) words.push(currentWord);

    if (words.join("").length >= 4 && words.some((word) => word.length > 1)) {
      rebuilt.push(...words);
      index = cursor;
      continue;
    }

    rebuilt.push(token);
    index += 1;
  }

  return rebuilt.join(" ");
}

function normalizeHeroName(value: string) {
  return collapseSpacedWords(compactWhitespace(value));
}

function normalizeCommonLabelArtifacts(value: string) {
  return compactWhitespace(value)
    .replace(/\s+([.:,+/])/g, "$1")
    .replace(/([.:/+])\s+([A-Za-zÆØÅæøå])/gu, "$1$2")
    .replace(/([.:/+])(\S)/g, "$1$2")
    .replace(/(?<=\d)\s+(?=\d)/gu, "")
    .replace(/\b([A-ZÆØÅ]{2,})\s+([A-ZÆØÅ]{1,4})\b/g, "$1$2")
    .replace(/\b([A-Za-zÆØÅæøå.]+)(Gmb)\s+H\b/g, "$1 $2H")
    .replace(/([A-ZÆØÅ]{2,})(ASA|AS|AB|BV|SA)\b/g, "$1 $2")
    .replace(/([A-Za-zÆØÅæøå.]+)(GmbH)\b/g, "$1 $2")
    .replace(/\b(\d{1,2})\s*\/\s*(\d{2,4})\b/g, "$1/$2")
    .replace(/\b(\d+)\s*\+\s*års\s*erfaring\b/giu, "$1+ års erfaring")
    .replace(/\b(\d+)\s*årserfaring\b/giu, "$1 års erfaring")
    .replace(/([A-Za-zÆØÅæøå])-ingeniørmed\b/gu, "$1-ingeniør med")
    .replace(/\bmed(\d)/giu, "med $1")
    .replace(/\bårs([A-Za-zÆØÅæøå])/giu, "års $1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeShortLabelText(value: string | null | undefined) {
  const normalized = compactWhitespace(String(value || ""));
  if (!normalized) return "";
  return normalizeCommonLabelArtifacts(collapseSpacedWords(normalized));
}

function humanizeSectionLabel(value: string) {
  const normalized = normalizeHeading(value);
  if (!normalized) return "";
  return normalized.charAt(0) + normalized.slice(1).toLocaleLowerCase("nb-NO");
}

function normalizeHeading(value: string | null | undefined) {
  const heading = normalizeShortLabelText(String(value || "")).replace(/:$/, "");
  return heading ? heading.toLocaleUpperCase("nb-NO") : "";
}

function toSegmentMap(segments: CvEditorImportSegment[]) {
  return new Map(segments.map((segment) => [segment.id, compactWhitespace(segment.text)]));
}

function resolveSegmentRefs(ref: SegmentRef, segmentMap: Map<string, string>, joiner = " "): string {
  if (!ref) return "";

  if (typeof ref === "string") {
    return compactWhitespace(segmentMap.get(ref) || ref);
  }

  const resolved = ref
    .map((entry) => compactWhitespace(segmentMap.get(entry) || entry))
    .filter(Boolean);

  return compactWhitespace(resolved.join(joiner));
}

function resolvePreferredText(
  preferredRef: SegmentRef,
  fallbackValue: string | null | undefined,
  segmentMap: Map<string, string>,
  joiner = " ",
) {
  const preferred = resolveSegmentRefs(preferredRef, segmentMap, joiner);
  if (preferred) return preferred;
  return compactWhitespace(fallbackValue || "");
}

function resolveParagraphs(
  paragraphs: Array<string[] | string> | null | undefined,
  segmentMap: Map<string, string>,
): string[] {
  if (!Array.isArray(paragraphs)) return [];

  return paragraphs
    .map((entry) => resolveSegmentRefs(entry, segmentMap, " "))
    .map((entry) => compactWhitespace(entry))
    .filter(Boolean);
}

function normalizeAdditionalSectionFormat(value: string | null | undefined, items: ParsedAdditionalSectionItem[]) {
  if (value === "timeline" || value === "bullet") return value;
  return items.some((item) => compactWhitespace(item.period || "").length > 0 || (item.periodIds || []).length > 0)
    ? "timeline"
    : "bullet";
}

function looksLikeLongSentence(value: string) {
  const wordCount = value.split(/\s+/).filter(Boolean).length;
  return wordCount > 14 || /[.!?]/.test(value);
}

function sanitizeSidebarSections(sections: Array<{ heading: string; items: string[] }>) {
  return sections
    .map((section) => ({
      heading: section.heading,
      items: section.items
        .map((item) => cleanDisplayText(item).replace(/^\s*[•·▪◦]+\s*/u, ""))
        .map((item) => normalizeShortLabelText(item))
        .filter(Boolean)
        .filter((item) => {
          if (section.heading === "KONTAKTPERSON") return false;
          if (/^Kontaktperson$/i.test(item)) return false;
          if (/^(Jon Richard Nygaard|Thomas Eriksen)$/i.test(item)) return false;
          if (/jr@stacq\.no|thomas@stacq\.no/i.test(item)) return false;
          if (/Rolle:|Periode:|Teknologier:/i.test(item)) return false;
          if (looksLikeLongSentence(item)) return false;
          return true;
        })
        .filter((item, index, items) => items.indexOf(item) === index),
    }))
    .filter((section) => ALLOWED_SIDEBAR_HEADINGS.has(section.heading) && section.items.length > 0);
}

function sanitizeIntroParagraphs(paragraphs: string[]) {
  return paragraphs
    .map((paragraph) => cleanDisplayText(paragraph))
    .filter(Boolean)
    .filter((paragraph) => {
      if (/^(PERSONALIA|NØKKELPUNKTER|UTDANNELSE|KONTAKTPERSON)\b/i.test(paragraph)) return false;
      if (/^\s*[•\-]/.test(paragraph)) return false;
      return true;
    });
}

function sanitizeProjects(
  projects: Array<{
    company: string;
    subtitle: string;
    role: string;
    period: string;
    paragraphs: string[];
    technologies: string;
  }>,
) {
  return projects.map((project) => ({
    ...project,
    company: normalizeShortLabelText(project.company),
    subtitle: normalizeShortLabelText(project.subtitle),
    role: normalizeShortLabelText(cleanDisplayText(project.role)),
    period: normalizeCommonLabelArtifacts(cleanDisplayText(project.period)),
    paragraphs: project.paragraphs
      .map((paragraph) => cleanDisplayText(paragraph))
      .filter(Boolean)
      .filter(
        (paragraph) =>
          !/^(Rolle:|Periode:|Teknologier:)/i.test(paragraph) &&
          paragraph !== project.role &&
          paragraph !== project.period,
      ),
    technologies: cleanDisplayText(project.technologies),
  }));
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collapseRepeatedWordSequence(value: string) {
  const normalized = compactWhitespace(value);
  const words = normalized.split(/\s+/).filter(Boolean);

  for (let size = Math.floor(words.length / 2); size >= 2; size -= 1) {
    if (size * 2 !== words.length) continue;

    const first = words.slice(0, size).join(" ");
    const second = words.slice(size).join(" ");

    if (first === second) {
      return first;
    }
  }

  return normalized;
}

function normalizeTimelinePeriod(value: string) {
  return normalizeCommonLabelArtifacts(compactWhitespace(value).replace(/[—−]/g, "–"));
}

function normalizeTimelinePrimary(value: string) {
  return collapseRepeatedWordSequence(normalizeShortLabelText(value));
}

function extractLeadingPeriod(value: string) {
  const normalized = compactWhitespace(value);
  const match = normalized.match(
    /^((?:\d{1,2}\/\d{2,4}|\d{4})(?:\s*[–-]\s*(?:(?:\d{1,2}\/\d{2,4}|\d{4}|nå|nåværende|d\.d\.)?)?)?)\s+(.+)$/iu,
  );

  if (!match) return null;

  return {
    period: normalizeTimelinePeriod(match[1]),
    primary: normalizeTimelinePrimary(match[2]),
  };
}

function normalizeTimelineEntry(
  entry: { period: string; primary: string; secondary?: string },
  kind: "education" | "work",
) {
  let period = normalizeTimelinePeriod(entry.period);
  let primary = normalizeTimelinePrimary(entry.primary);
  let secondary = kind === "education" ? normalizeTimelinePrimary(entry.secondary || "") : "";

  if (primary) {
    const extracted = extractLeadingPeriod(primary);
    if (!period && extracted) {
      period = extracted.period;
      primary = extracted.primary;
    } else if (period && extracted?.period === period) {
      primary = extracted.primary;
    }
  }

  if (secondary) {
    const extractedSecondary = extractLeadingPeriod(secondary);
    if (!period && extractedSecondary) {
      period = extractedSecondary.period;
      secondary = extractedSecondary.primary;
    } else if (period && extractedSecondary?.period === period) {
      secondary = extractedSecondary.primary;
    }
  }

  if (kind === "work" && secondary) {
    primary = normalizeTimelinePrimary(`${primary} ${secondary}`);
    secondary = "";
  }

  if (secondary && secondary === primary) {
    secondary = "";
  }

  return {
    period,
    primary,
    secondary,
  };
}

function normalizeTimelineKey(entry: { period: string; primary: string; secondary?: string }) {
  return [entry.period, entry.primary, entry.secondary || ""]
    .map((value) => normalizeShortLabelText(value))
    .join("::");
}

function sanitizeEducationEntries(
  entries: Array<{ period: string; primary: string; secondary?: string }>,
  sidebarEducationItems: Set<string>,
) {
  return uniqueBy(
    entries
      .map((entry) => normalizeTimelineEntry(entry, "education"))
      .filter((entry) => entry.period || entry.primary || entry.secondary)
      .filter((entry) => Boolean(entry.period || entry.secondary))
      .filter((entry) => entry.primary && !sidebarEducationItems.has(entry.primary)),
    normalizeTimelineKey,
  );
}

function sanitizeWorkExperienceEntries(entries: Array<{ period: string; primary: string }>) {
  return uniqueBy(
    entries
      .map((entry) => normalizeTimelineEntry(entry, "work"))
      .filter((entry) => Boolean(entry.period && entry.primary))
      .map((entry) => ({ period: entry.period, primary: entry.primary })),
    normalizeTimelineKey,
  );
}

function inferOverflowSectionFormat(
  heading: string,
  items: string[],
): "timeline" | "bullet" {
  if (!TIMELINE_SECTION_HEADINGS.has(heading)) return "bullet";
  return items.some((item) => /\b\d{2,4}\b/.test(item)) ? "timeline" : "bullet";
}

export function buildCvEditorImportDocument(
  parsed: ParsedImportResult,
  segments: CvEditorImportSegment[],
): {
  navn: string;
  tittel: string;
  sidebarSections: Array<{ heading: string; items: string[] }>;
  introParagraphs: string[];
  competenceGroups: Array<{ label: string; content: string }>;
  projects: Array<{
    company: string;
    subtitle: string;
    role: string;
    period: string;
    paragraphs: string[];
    technologies: string;
  }>;
  education: Array<{ period: string; primary: string; secondary: string }>;
  workExperience: Array<{ period: string; primary: string }>;
  additionalSections: Array<{
    title: string;
    format: "timeline" | "bullet";
    items: Array<{ period: string; primary: string }>;
  }>;
  warnings: string[];
} {
  const segmentMap = toSegmentMap(segments);

  const rawSidebarSections = (parsed.sidebarSections || [])
    .map((section) => {
      const items = [
        ...((section.itemIds || []).map((id) => resolveSegmentRefs(id, segmentMap))),
        ...((section.items || []).map((item) => compactWhitespace(item || ""))),
      ].filter(Boolean);

      return {
        heading: normalizeHeading(resolvePreferredText(section.headingIds, section.heading, segmentMap)),
        items,
      };
    })
    .filter((section) => section.heading && section.items.length > 0);

  const sidebarSections = sanitizeSidebarSections(rawSidebarSections);
  const overflowSidebarSections = rawSidebarSections
    .map((section) => ({
      heading: section.heading,
      items: section.items
        .map((item) => cleanDisplayText(item).replace(/^\s*[•·▪◦]+\s*/u, ""))
        .map((item) => normalizeShortLabelText(item))
        .filter(Boolean),
    }))
    .filter((section) => section.heading && section.items.length > 0 && !ALLOWED_SIDEBAR_HEADINGS.has(section.heading));

  const overflowCompetenceGroups = overflowSidebarSections
    .filter((section) => COMPETENCE_SECTION_HEADINGS.has(section.heading))
    .map((section) => ({
      label: humanizeSectionLabel(section.heading),
      content: uniqueBy(section.items, (item) => item).join(", "),
    }));

  const overflowAdditionalSections = overflowSidebarSections
    .filter((section) => !COMPETENCE_SECTION_HEADINGS.has(section.heading))
    .map((section) => ({
      title: normalizeHeading(section.heading),
      format: inferOverflowSectionFormat(section.heading, section.items),
      items: uniqueBy(section.items, (item) => item).map((item) => ({
        period: "",
        primary: item,
      })),
    }));

  const competenceGroups = uniqueBy(
    [
      ...(parsed.competenceGroups || [])
    .map((group) => ({
      label: normalizeShortLabelText(group.label || ""),
      content: compactWhitespace(
        resolveSegmentRefs(group.itemIds || group.content || "", segmentMap, " "),
      ),
    }))
    .filter((group) => group.label && group.content),
      ...overflowCompetenceGroups,
    ],
    (group) => `${group.label}::${group.content}`,
  );

  const projects = sanitizeProjects((parsed.projects || [])
    .map((project) => ({
      company: resolvePreferredText(project.companyIds, project.company, segmentMap),
      subtitle: resolvePreferredText(project.subtitleIds, project.subtitle, segmentMap),
      role: resolvePreferredText(project.roleIds, project.role, segmentMap),
      period: resolvePreferredText(project.periodIds, project.period, segmentMap),
      paragraphs: resolveParagraphs(project.paragraphs, segmentMap),
      technologies: resolvePreferredText(project.technologyIds, project.technologies, segmentMap, ", "),
    }))
    .filter((project) => project.company || project.paragraphs.length > 0 || project.technologies));

  const additionalSections = (parsed.additionalSections || [])
    .map((section) => {
      const items = (section.items || [])
      .map((item) => ({
          period: normalizeCommonLabelArtifacts(resolvePreferredText(item.periodIds, item.period, segmentMap)),
          primary: normalizeShortLabelText(resolvePreferredText(item.primaryIds || item.itemIds, item.primary, segmentMap)),
        }))
        .filter((item) => item.primary);

      return {
        title: normalizeHeading(resolvePreferredText(section.titleIds, section.title, segmentMap)),
        format: normalizeAdditionalSectionFormat(section.format, section.items || []) as "timeline" | "bullet",
        items,
      };
    })
    .filter((section) => section.title && section.items.length > 0);

  const sidebarEducationItems = new Set(
    sidebarSections
      .filter((section) => section.heading === "UTDANNELSE")
      .flatMap((section) => section.items.map((item) => normalizeShortLabelText(item))),
  );

  const additionalEducationEntries = additionalSections
    .filter((section) => EDUCATION_SECTION_HEADINGS.has(section.title))
    .flatMap((section) =>
      section.items.map((item) => ({
        period: item.period,
        primary: item.primary,
        secondary: "",
      })),
    );

  const additionalWorkEntries = additionalSections
    .filter((section) => WORK_EXPERIENCE_SECTION_HEADINGS.has(section.title))
    .flatMap((section) =>
      section.items.map((item) => ({
        period: item.period,
        primary: item.primary,
      })),
    );

  const visibleAdditionalSections = additionalSections.filter(
    (section) =>
      !EDUCATION_SECTION_HEADINGS.has(section.title) && !WORK_EXPERIENCE_SECTION_HEADINGS.has(section.title),
  );

  return {
    navn: normalizeHeroName(resolvePreferredText(parsed.navnIds, parsed.navn, segmentMap)),
    tittel: normalizeShortLabelText(resolvePreferredText(parsed.tittelIds, parsed.tittel, segmentMap)),
    sidebarSections,
    introParagraphs: sanitizeIntroParagraphs(resolveParagraphs(parsed.introParagraphs, segmentMap)),
    competenceGroups,
    projects,
    education: sanitizeEducationEntries(
      [
        ...(parsed.education || []).map((entry) => ({
          period: resolvePreferredText(entry.periodIds, entry.period, segmentMap),
          primary: resolvePreferredText(entry.primaryIds, entry.primary, segmentMap),
          secondary: resolvePreferredText(entry.secondaryIds, entry.secondary, segmentMap),
        })),
        ...additionalEducationEntries,
      ],
      sidebarEducationItems,
    ),
    workExperience: sanitizeWorkExperienceEntries([
      ...(parsed.workExperience || []).map((entry) => ({
        period: resolvePreferredText(entry.periodIds, entry.period, segmentMap),
        primary: resolvePreferredText(entry.primaryIds, entry.primary, segmentMap),
      })),
      ...additionalWorkEntries,
    ]),
    additionalSections: uniqueBy(
      [...visibleAdditionalSections, ...overflowAdditionalSections].filter(
        (section) =>
          !EDUCATION_SECTION_HEADINGS.has(section.title) && !WORK_EXPERIENCE_SECTION_HEADINGS.has(section.title),
      ),
      (section) => `${section.title}::${section.items.map((item) => `${item.period}|${item.primary}`).join(";")}`,
    ),
    warnings: (parsed.warnings || []).map((warning) => compactWhitespace(warning || "")).filter(Boolean),
  };
}
