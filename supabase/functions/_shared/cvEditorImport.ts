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

function normalizeHeading(value: string | null | undefined) {
  const heading = compactWhitespace(String(value || "")).replace(/:$/, "");
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

  const sidebarSections = (parsed.sidebarSections || [])
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

  const competenceGroups = (parsed.competenceGroups || [])
    .map((group) => ({
      label: compactWhitespace(group.label || ""),
      content: compactWhitespace(
        resolveSegmentRefs(group.itemIds || group.content || "", segmentMap, " "),
      ),
    }))
    .filter((group) => group.label && group.content);

  const projects = (parsed.projects || [])
    .map((project) => ({
      company: resolvePreferredText(project.companyIds, project.company, segmentMap),
      subtitle: resolvePreferredText(project.subtitleIds, project.subtitle, segmentMap),
      role: resolvePreferredText(project.roleIds, project.role, segmentMap),
      period: resolvePreferredText(project.periodIds, project.period, segmentMap),
      paragraphs: resolveParagraphs(project.paragraphs, segmentMap),
      technologies: resolvePreferredText(project.technologyIds, project.technologies, segmentMap, ", "),
    }))
    .filter((project) => project.company || project.paragraphs.length > 0 || project.technologies);

  const additionalSections = (parsed.additionalSections || [])
    .map((section) => {
      const items = (section.items || [])
        .map((item) => ({
          period: resolvePreferredText(item.periodIds, item.period, segmentMap),
          primary: resolvePreferredText(item.primaryIds || item.itemIds, item.primary, segmentMap),
        }))
        .filter((item) => item.primary);

      return {
        title: normalizeHeading(resolvePreferredText(section.titleIds, section.title, segmentMap)),
        format: normalizeAdditionalSectionFormat(section.format, section.items || []) as "timeline" | "bullet",
        items,
      };
    })
    .filter((section) => section.title && section.items.length > 0);

  return {
    navn: resolvePreferredText(parsed.navnIds, parsed.navn, segmentMap),
    tittel: resolvePreferredText(parsed.tittelIds, parsed.tittel, segmentMap),
    sidebarSections,
    introParagraphs: resolveParagraphs(parsed.introParagraphs, segmentMap),
    competenceGroups,
    projects,
    education: (parsed.education || [])
      .map((entry) => ({
        period: resolvePreferredText(entry.periodIds, entry.period, segmentMap),
        primary: resolvePreferredText(entry.primaryIds, entry.primary, segmentMap),
        secondary: resolvePreferredText(entry.secondaryIds, entry.secondary, segmentMap),
      }))
      .filter((entry) => entry.period || entry.primary || entry.secondary),
    workExperience: (parsed.workExperience || [])
      .map((entry) => ({
        period: resolvePreferredText(entry.periodIds, entry.period, segmentMap),
        primary: resolvePreferredText(entry.primaryIds, entry.primary, segmentMap),
      }))
      .filter((entry) => entry.period || entry.primary),
    additionalSections,
    warnings: (parsed.warnings || []).map((warning) => compactWhitespace(warning || "")).filter(Boolean),
  };
}
