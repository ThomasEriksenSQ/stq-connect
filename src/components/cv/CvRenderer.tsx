import React, { useEffect, useMemo, useRef, useState } from "react";

// ═══════════════════════════════════════
// Types
// ═══════════════════════════════════════

export type SidebarSection = {
  heading: string;
  items: string[];
};

export type CompetenceGroup = {
  label: string;
  content: string;
};

export type ProjectEntry = {
  company: string;
  subtitle: string;
  role: string;
  period: string;
  startMonth?: number | null;
  startYear?: number | null;
  endMonth?: number | null;
  endYear?: number | null;
  isCurrent?: boolean;
  paragraphs: string[];
  technologies: string;
  pageBreakBefore?: boolean;
};

export const ADDITIONAL_SECTION_TITLE_OPTIONS = [
  "SERTIFISERINGER",
  "KURS",
  "PUBLIKASJONER",
  "UTMERKELSER",
  "FOREDRAG",
  "KONFERANSER",
  "OPEN SOURCE BIDRAG",
  "FAGLIGE BIDRAG",
  "FRIVILLIG ARBEID",
  "STYREVERV",
  "VERV",
  "MENTORROLLER",
] as const;

export const DEFAULT_ADDITIONAL_SECTION_TITLE = ADDITIONAL_SECTION_TITLE_OPTIONS[0];

export type AdditionalSectionTitle = string;
export type AdditionalSectionFormat = "timeline" | "bullet";

export type AdditionalSectionItem = {
  period: string;
  primary: string;
};

export type AdditionalSection = {
  title: AdditionalSectionTitle;
  format: AdditionalSectionFormat;
  items: AdditionalSectionItem[];
};

export type TimelineEntry = {
  period: string;
  primary: string;
  secondary?: string;
};

export type HeroContact = {
  title: string;
  name: string;
  phone: string;
  email: string;
};

export type HeroContent = {
  name: string;
  title: string;
  contact: HeroContact;
  portrait_url?: string;
  portrait_position?: string;
};

export type CVDocument = {
  hero: HeroContent;
  sidebarSections: SidebarSection[];
  introParagraphs: string[];
  competenceGroups: CompetenceGroup[];
  projects: ProjectEntry[];
  additionalSections: AdditionalSection[];
  education: TimelineEntry[];
  workExperience: TimelineEntry[];
};

// ═══════════════════════════════════════
// Layout constants
// ═══════════════════════════════════════

const mm = (value: number) => `${value}mm`;
const pt = (value: number) => `${value}pt`;
const px = (value: number) => `${value}px`;
const paddingMm = (top: number, right: number, bottom: number, left: number) =>
  `${mm(top)} ${mm(right)} ${mm(bottom)} ${mm(left)}`;

export const CV_LAYOUT = {
  pageWidthMm: 210,
  pageHeightMm: 297,
  sidebarWidthMm: 55,
  measureContentWidthMm: 155,
  firstPageHeroHeightMm: 71.4,
  continuationTopPaddingMm: 25.5,
  sidebarPadding: { topMm: 8.8, rightMm: 4.8, bottomMm: 10.5, leftMm: 6.8 },
  mainPadding: { topMm: 8.8, rightMm: 8.9, bottomMm: 10.2, leftMm: 8.9 },
  hero: {
    topRowHeightMm: 31.25,
    grayBandHeightMm: 34.2,
    logoBoxHeightMm: 24.8,
    portraitLeftMm: 6.8,
    portraitWidthMm: 41.4,
    portraitHeightMm: 46.75,
    firstPagePortraitTopMm: 24.8,
    continuationPortraitTopMm: 26.5,
    textTopMm: 39.9,
    textLeftMm: 63.9,
    textWidthMm: 136,
    contactRightMm: 7.8,
    contactHeightMm: 31.25,
    contactWidthMm: 41.5,
    contactSeparatorHeightMm: 16.9,
    contactSeparatorOffsetMm: 1.2,
  },
  screen: { pageGapPx: 16, topPaddingPx: 24, bottomPaddingPx: 40, controlsGapPx: 12 },
} as const;

export const CV_PRINT = {
  documentTitle: "CV",
  previewBackground: "#d7d7d7",
  helperText: 'For beste PDF-kvalitet, velg "Lagre som PDF" i print-dialogen.',
} as const;

const CONTINUATION_BOTTOM_PADDING_MM = 10.2;
const CONTINUATION_TARGET_BOTTOM_MARGIN_MM = 14.5;
const CONTINUATION_BOTTOM_BUFFER_MM = CONTINUATION_TARGET_BOTTOM_MARGIN_MM - CONTINUATION_BOTTOM_PADDING_MM;
const PROJECT_BLOCK_MARGIN_BOTTOM_MM = 6.4;
const PROJECT_FRAGMENT_FIT_SAFETY_MM = 0.8;

// ═══════════════════════════════════════
// Print CSS
// ═══════════════════════════════════════

export const PRINT_DOCUMENT_CSS = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: white; }
  body { font-family: "Calibri", "Carlito", Arial, sans-serif; }
  .cv-pages { display: block !important; }
  .cv-page {
    width: ${mm(CV_LAYOUT.pageWidthMm)} !important;
    height: ${mm(CV_LAYOUT.pageHeightMm)} !important;
    min-height: ${mm(CV_LAYOUT.pageHeightMm)} !important;
    margin: 0 auto !important;
    box-shadow: none !important;
    overflow: hidden !important;
    page-break-after: always;
    break-after: page;
  }
  .cv-page:last-child { page-break-after: auto; break-after: auto; }
  .cv-project-block { page-break-inside: avoid; break-inside: avoid; }
  .no-print { display: none !important; }
  @media screen {
    body {
      background: ${CV_PRINT.previewBackground};
      padding: ${px(CV_LAYOUT.screen.topPaddingPx)} 0 ${px(CV_LAYOUT.screen.bottomPaddingPx)};
    }
    .cv-pages { display: flex !important; flex-direction: column; gap: ${px(CV_LAYOUT.screen.pageGapPx)}; }
  }
`;

// ═══════════════════════════════════════
// Styles
// ═══════════════════════════════════════

const pageStyle = {
  width: mm(CV_LAYOUT.pageWidthMm),
  height: mm(CV_LAYOUT.pageHeightMm),
  minHeight: mm(CV_LAYOUT.pageHeightMm),
  margin: "0 auto",
  background: "#fff",
  color: "#222",
  boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
  position: "relative",
  overflow: "hidden",
} satisfies React.CSSProperties;

const gridStyle = {
  display: "grid",
  gridTemplateColumns: `${mm(CV_LAYOUT.sidebarWidthMm)} 1fr`,
  height: mm(CV_LAYOUT.pageHeightMm),
  minHeight: mm(CV_LAYOUT.pageHeightMm),
  position: "relative",
} satisfies React.CSSProperties;

const firstPageGridStyle = {
  ...gridStyle,
  gridTemplateRows: `${mm(CV_LAYOUT.firstPageHeroHeightMm)} 1fr`,
} satisfies React.CSSProperties;

const leftRailStyle = {
  background: "#000",
  color: "rgba(255,255,255,0.92)",
  padding: paddingMm(
    CV_LAYOUT.sidebarPadding.topMm,
    CV_LAYOUT.sidebarPadding.rightMm,
    CV_LAYOUT.sidebarPadding.bottomMm,
    CV_LAYOUT.sidebarPadding.leftMm,
  ),
  fontSize: pt(9.1),
  lineHeight: 1.46,
} satisfies React.CSSProperties;

const mainStyle = {
  padding: paddingMm(
    CV_LAYOUT.mainPadding.topMm,
    CV_LAYOUT.mainPadding.rightMm,
    CV_LAYOUT.mainPadding.bottomMm,
    CV_LAYOUT.mainPadding.leftMm,
  ),
  fontSize: pt(10.3),
  lineHeight: 1.42,
  color: "#1f1f1f",
  fontFamily: '"Calibri", "Carlito", Arial, sans-serif',
} satisfies React.CSSProperties;

const continuationMainStyle = {
  ...mainStyle,
  padding: paddingMm(
    CV_LAYOUT.continuationTopPaddingMm,
    CV_LAYOUT.mainPadding.rightMm,
    CV_LAYOUT.mainPadding.bottomMm,
    CV_LAYOUT.mainPadding.leftMm,
  ),
} satisfies React.CSSProperties;

const continuationMeasureContentStyle = {
  width: mm(CV_LAYOUT.measureContentWidthMm),
  boxSizing: "border-box",
  padding: paddingMm(0, CV_LAYOUT.mainPadding.rightMm, 0, CV_LAYOUT.mainPadding.leftMm),
  fontSize: pt(10.3),
  lineHeight: 1.42,
  color: "#1f1f1f",
  fontFamily: '"Calibri", "Carlito", Arial, sans-serif',
} satisfies React.CSSProperties;

const hiddenMeasureRootStyle = {
  position: "absolute",
  top: 0,
  left: "-10000px",
  visibility: "hidden",
  pointerEvents: "none",
  zIndex: -1,
} satisfies React.CSSProperties;

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

export function waitForFontsReady(targetDocument: Document) {
  return "fonts" in targetDocument && "ready" in targetDocument.fonts
    ? targetDocument.fonts.ready.catch(() => undefined)
    : Promise.resolve();
}

export function waitForDoubleFrame(win: Window) {
  return new Promise<void>((resolve) => {
    win.requestAnimationFrame(() => {
      win.requestAnimationFrame(() => resolve());
    });
  });
}

function measureOuterHeight(element: HTMLElement | null) {
  if (!element) return 0;
  const computed = window.getComputedStyle(element);
  return element.getBoundingClientRect().height + parseFloat(computed.marginTop) + parseFloat(computed.marginBottom);
}

export const PROJECT_MONTH_OPTIONS = [
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
] as const;

const PROJECT_MONTH_LABELS = new Map(PROJECT_MONTH_OPTIONS.map((entry) => [entry.value, entry.label]));

type MonthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

function normalizeProjectMonth(value: number | null | undefined): MonthNumber | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 12
    ? (value as MonthNumber)
    : null;
}

function normalizeProjectYear(value: number | null | undefined) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function formatProjectMonthYear(month: number | null | undefined, year: number | null | undefined) {
  const safeMonth = normalizeProjectMonth(month);
  const safeYear = normalizeProjectYear(year);
  if (!safeMonth || !safeYear) return "";
  const monthLabel = PROJECT_MONTH_LABELS.get(safeMonth);
  return monthLabel ? `${monthLabel} ${safeYear}` : "";
}

export function formatProjectPeriod(
  project: Pick<ProjectEntry, "period" | "startMonth" | "startYear" | "endMonth" | "endYear" | "isCurrent">,
) {
  const startLabel = formatProjectMonthYear(project.startMonth, project.startYear);
  const endLabel = formatProjectMonthYear(project.endMonth, project.endYear);
  const fallback = (project.period || "").trim();

  if (!startLabel) return fallback;
  if (project.isCurrent) return `${startLabel} - nåværende`;
  if (endLabel) return `${startLabel} - ${endLabel}`;
  return startLabel;
}

function getProjectKey(project: ProjectEntry) {
  const formattedPeriod = formatProjectPeriod(project);
  return [
    project.company,
    project.subtitle,
    formattedPeriod,
    project.role,
    project.paragraphs.length.toString(),
    project.technologies,
  ]
    .map((part) => (part || "").trim())
    .join("::");
}

function getAdditionalSectionKey(section: AdditionalSection) {
  return [section.title, section.format, section.items.map((item) => `${item.period}::${item.primary}`).join("||")]
    .map((part) => (part || "").trim())
    .join("::");
}

function splitParagraphForFlow(text: string, targetChars = 220) {
  const trimmed = text.trim();
  void targetChars;
  // Keep original paragraphs atomic in the paginator. This matches the editor
  // model better and avoids false whitespace caused by measuring synthetic chunks.
  return [trimmed];
}

function buildProjectFragments(project: ProjectEntry): ProjectFragment[] {
  const fragments: ProjectFragment[] = [];
  const projectKey = getProjectKey(project);
  const formattedPeriod = formatProjectPeriod(project);
  const baseMeta = {
    projectKey,
    company: project.company,
    subtitle: project.subtitle,
    role: project.role,
    period: formattedPeriod,
  };

  if (project.paragraphs.length === 0) {
    fragments.push({
      key: `${projectKey}-chunk-header`,
      showHeader: true,
      forcePageBreakBefore: Boolean(project.pageBreakBefore),
      ...baseMeta,
      paragraphs: [],
      spacingAfterMm: project.technologies ? 0 : PROJECT_BLOCK_MARGIN_BOTTOM_MM,
    });

    if (project.technologies) {
      fragments.push({
        key: `${projectKey}-chunk-technologies`,
        showHeader: false,
        ...baseMeta,
        paragraphs: [],
        technologies: project.technologies,
        spacingAfterMm: PROJECT_BLOCK_MARGIN_BOTTOM_MM,
      });
    }

    return fragments;
  }

  project.paragraphs.forEach((paragraph, paragraphIndex) => {
    const segments = splitParagraphForFlow(paragraph);
    segments.forEach((segment, segmentIndex) => {
      const isFirstChunk = paragraphIndex === 0 && segmentIndex === 0;
      const isLastSegmentOfParagraph = segmentIndex === segments.length - 1;
      const isLastParagraph = paragraphIndex === project.paragraphs.length - 1;
      const isLastChunkOfProject = isLastParagraph && isLastSegmentOfParagraph;

      fragments.push({
        key: `${projectKey}-chunk-${paragraphIndex + 1}-${segmentIndex + 1}`,
        showHeader: isFirstChunk,
        forcePageBreakBefore: isFirstChunk ? Boolean(project.pageBreakBefore) : false,
        ...baseMeta,
        paragraphs: [{ text: segment, endsParagraph: isLastSegmentOfParagraph }],
        spacingAfterMm: isLastChunkOfProject && !project.technologies ? PROJECT_BLOCK_MARGIN_BOTTOM_MM : 0,
      });
    });
  });

  if (project.technologies) {
    fragments.push({
      key: `${projectKey}-chunk-technologies`,
      showHeader: false,
      ...baseMeta,
      paragraphs: [],
      technologies: project.technologies,
      spacingAfterMm: PROJECT_BLOCK_MARGIN_BOTTOM_MM,
    });
  }

  return fragments;
}

function buildAdditionalSectionFragments(section: AdditionalSection): AdditionalSectionFragment[] {
  const sectionKey = getAdditionalSectionKey(section);

  if (section.items.length === 0) {
    return [
      {
        key: `${sectionKey}-empty`,
        sectionKey,
        title: section.title,
        format: section.format,
        items: [],
        spacingAfterMm: PROJECT_BLOCK_MARGIN_BOTTOM_MM,
      },
    ];
  }

  return section.items.map((item, index) => ({
    key: `${sectionKey}-row-${index + 1}`,
    sectionKey,
    title: section.title,
    format: section.format,
    items: [item],
    spacingAfterMm: index === section.items.length - 1 ? PROJECT_BLOCK_MARGIN_BOTTOM_MM : 0,
  }));
}

function mergeProjectFragmentsForPage(fragments: ProjectFragment[]) {
  const merged: ProjectFragment[] = [];

  for (const fragment of fragments) {
    const previous = merged[merged.length - 1];
    const canMerge =
      previous && previous.projectKey === fragment.projectKey && !fragment.showHeader && !previous.technologies;

    if (!canMerge) {
      merged.push({
        ...fragment,
        paragraphs: [...fragment.paragraphs],
      });
      continue;
    }

    previous.paragraphs = [...previous.paragraphs, ...fragment.paragraphs];
    previous.technologies = fragment.technologies ?? previous.technologies;
    previous.spacingAfterMm = fragment.spacingAfterMm ?? previous.spacingAfterMm;
  }

  return merged;
}

function mergeAdditionalSectionFragmentsForPage(fragments: AdditionalSectionFragment[]) {
  const merged: AdditionalSectionFragment[] = [];

  for (const fragment of fragments) {
    const previous = merged[merged.length - 1];
    const canMerge = previous && previous.sectionKey === fragment.sectionKey;

    if (!canMerge) {
      merged.push({
        ...fragment,
        items: [...fragment.items],
      });
      continue;
    }

    previous.items = [...previous.items, ...fragment.items];
    previous.spacingAfterMm = fragment.spacingAfterMm ?? previous.spacingAfterMm;
  }

  return merged;
}

function reconstructParagraphs(chunks: ProjectParagraphChunk[]) {
  const paragraphs: string[] = [];
  let current = "";

  for (const chunk of chunks) {
    current = current ? `${current} ${chunk.text}` : chunk.text;
    if (chunk.endsParagraph) {
      paragraphs.push(current);
      current = "";
    }
  }

  if (current) paragraphs.push(current);
  return paragraphs;
}

// ═══════════════════════════════════════
// Pagination
// ═══════════════════════════════════════

type ContinuationSectionId = "education" | "work";

type FlowBlock =
  | {
      key: string;
      kind: "intro";
      text: string;
    }
  | {
      key: string;
      kind: "competence";
      label: string;
      content: string;
    };

type ProjectParagraphChunk = {
  text: string;
  endsParagraph: boolean;
};

type ProjectFragment = {
  key: string;
  projectKey: string;
  showHeader: boolean;
  forcePageBreakBefore?: boolean;
  company: string;
  subtitle: string;
  role: string;
  period: string;
  paragraphs: ProjectParagraphChunk[];
  technologies?: string;
  spacingAfterMm?: number;
};

type AdditionalSectionFragment = {
  key: string;
  sectionKey: string;
  title: AdditionalSectionTitle;
  format: AdditionalSectionFormat;
  items: AdditionalSectionItem[];
  spacingAfterMm?: number;
};

type ContinuationPageModel = {
  key: string;
  projects: ProjectFragment[];
  additionalSections: AdditionalSectionFragment[];
  sections: ContinuationSectionId[];
};

function buildContinuationPages({
  flowBlocks,
  flowHeights,
  firstPageAvailableHeight,
  projectFragments,
  projectFragmentHeights,
  additionalSectionFragments,
  additionalSectionFragmentHeights,
  projectFitSafety,
  projectsTitleTopHeight,
  projectsTitleAfterHeight,
  additionalSectionTitleTopHeight,
  additionalSectionTitleAfterHeight,
  educationTopHeight,
  educationAfterHeight,
  workTopHeight,
  workAfterHeight,
  continuationAvailableHeight,
  bottomBuffer,
}: {
  flowBlocks: FlowBlock[];
  flowHeights: number[];
  firstPageAvailableHeight: number;
  projectFragments: ProjectFragment[][];
  projectFragmentHeights: number[][];
  additionalSectionFragments: AdditionalSectionFragment[][];
  additionalSectionFragmentHeights: number[][];
  projectFitSafety: number;
  projectsTitleTopHeight: number;
  projectsTitleAfterHeight: number;
  additionalSectionTitleTopHeight: number;
  additionalSectionTitleAfterHeight: number;
  educationTopHeight: number;
  educationAfterHeight: number;
  workTopHeight: number;
  workAfterHeight: number;
  continuationAvailableHeight: number;
  bottomBuffer: number;
}): { firstPageFlowBlocks: FlowBlock[]; continuationPages: ContinuationPageModel[] } {
  const firstPageCapacity = Math.max(firstPageAvailableHeight - bottomBuffer, 0);
  const continuationCapacity = Math.max(continuationAvailableHeight - bottomBuffer, 0);

  const firstPageFlowBlocks: FlowBlock[] = [];
  let firstPageUsed = 0;

  for (let index = 0; index < flowBlocks.length; index += 1) {
    const blockHeight = flowHeights[index];
    const canFit = firstPageUsed + blockHeight <= firstPageCapacity;
    if (index > 0 && !canFit) {
      break;
    }
    firstPageFlowBlocks.push(flowBlocks[index]);
    firstPageUsed += blockHeight;
  }

  type MutablePageModel = {
    key: string;
    projects: ProjectFragment[];
    additionalSections: AdditionalSectionFragment[];
    sections: ContinuationSectionId[];
    usedHeight: number;
  };

  const models: MutablePageModel[] = [];
  let projectsTitlePlaced = false;

  const ensurePage = () => {
    let current = models[models.length - 1];
    if (!current) {
      current = {
        key: `continuation-${models.length + 1}`,
        projects: [],
        additionalSections: [],
        sections: [],
        usedHeight: 0,
      };
      models.push(current);
    }
    return current;
  };

  const startNewPage = () => {
    const next: MutablePageModel = {
      key: `continuation-${models.length + 1}`,
      projects: [],
      additionalSections: [],
      sections: [],
      usedHeight: 0,
    };
    models.push(next);
    return next;
  };

  const addProjectFragment = (fragment: ProjectFragment, height: number) => {
    let page = ensurePage();
    const titleHeight =
      !projectsTitlePlaced && page.projects.length === 0 && page.usedHeight === 0 ? projectsTitleTopHeight : 0;
    if (page.usedHeight > 0 && page.usedHeight + titleHeight + height + projectFitSafety > continuationCapacity) {
      page = startNewPage();
    }
    const appliedTitleHeight =
      !projectsTitlePlaced && page.projects.length === 0 && page.usedHeight === 0 ? projectsTitleTopHeight : 0;
    page.projects.push(fragment);
    page.usedHeight += appliedTitleHeight + height;
    if (appliedTitleHeight > 0) projectsTitlePlaced = true;
  };

  const addAdditionalSectionFragment = (fragment: AdditionalSectionFragment, height: number) => {
    let page = ensurePage();
    const pageHasSection = page.additionalSections.some((entry) => entry.sectionKey === fragment.sectionKey);
    const titleHeight = pageHasSection
      ? 0
      : page.usedHeight === 0
        ? additionalSectionTitleTopHeight
        : additionalSectionTitleAfterHeight;

    if (page.usedHeight > 0 && page.usedHeight + titleHeight + height > continuationCapacity) {
      page = startNewPage();
    }

    const pageHasSectionAfterBreak = page.additionalSections.some((entry) => entry.sectionKey === fragment.sectionKey);
    const appliedTitleHeight = pageHasSectionAfterBreak
      ? 0
      : page.usedHeight === 0
        ? additionalSectionTitleTopHeight
        : additionalSectionTitleAfterHeight;

    page.additionalSections.push(fragment);
    page.usedHeight += appliedTitleHeight + height;
  };

  const addSection = (sectionId: ContinuationSectionId, topHeight: number, afterHeight: number) => {
    let page = ensurePage();
    const sectionHeight = page.usedHeight === 0 ? topHeight : afterHeight;
    if (page.usedHeight > 0 && page.usedHeight + sectionHeight > continuationCapacity) {
      page = startNewPage();
    }
    const appliedHeight = page.usedHeight === 0 ? topHeight : afterHeight;
    page.sections.push(sectionId);
    page.usedHeight += appliedHeight;
  };

  const projectChunks = projectFragments.flatMap((fragments, projectIndex) =>
    fragments.map((fragment, fragmentIndex) => ({
      fragment,
      height: projectFragmentHeights[projectIndex]?.[fragmentIndex] ?? 0,
    })),
  );

  for (const chunk of projectChunks) {
    let page = ensurePage();
    if (chunk.fragment.forcePageBreakBefore && page.usedHeight > 0) {
      page = startNewPage();
    }
    const titleHeight =
      !projectsTitlePlaced && page.projects.length === 0 && page.usedHeight === 0 ? projectsTitleTopHeight : 0;

    if (page.usedHeight > 0 && page.usedHeight + titleHeight + chunk.height + projectFitSafety > continuationCapacity) {
      page = startNewPage();
    }

    addProjectFragment(chunk.fragment, chunk.height);
  }

  const additionalChunks = additionalSectionFragments.flatMap((fragments, sectionIndex) =>
    fragments.map((fragment, fragmentIndex) => ({
      fragment,
      height: additionalSectionFragmentHeights[sectionIndex]?.[fragmentIndex] ?? 0,
    })),
  );

  for (const chunk of additionalChunks) {
    addAdditionalSectionFragment(chunk.fragment, chunk.height);
  }

  addSection("education", educationTopHeight, educationAfterHeight);
  addSection("work", workTopHeight, workAfterHeight);

  return {
    firstPageFlowBlocks,
    continuationPages: models.map((page) => ({
      key: page.key,
      projects: page.projects,
      additionalSections: page.additionalSections,
      sections: page.sections,
    })),
  };
}

// ═══════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════

export function SectionTitle({ children, marginTop = "6mm" }: { children: string; marginTop?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "3mm", marginTop, marginBottom: "3mm" }}>
      <div
        style={{
          fontFamily:
            '"Myriad Pro Light", "Arial Narrow", "Avenir Next Condensed", "Helvetica Neue", Arial, sans-serif',
          fontSize: "13.1pt",
          fontWeight: 700,
          letterSpacing: "0.012em",
          textTransform: "uppercase",
          color: "#101010",
          whiteSpace: "nowrap",
        }}
      >
        {children}
      </div>
      <div style={{ flex: 1, height: "1px", background: "#bfc2c5" }} />
    </div>
  );
}

function Sidebar({
  sections,
  transparentBackground = false,
}: {
  sections: SidebarSection[];
  transparentBackground?: boolean;
}) {
  return (
    <div style={{ ...leftRailStyle, background: transparentBackground ? "transparent" : leftRailStyle.background }}>
      {sections.map((section) => (
        <div key={section.heading} style={{ marginBottom: "5.8mm" }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: "11.3pt",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: "2.2mm",
              color: "#fff",
              fontFamily: '"Myriad Pro Light", "Avenir Next Condensed", "Helvetica Neue", Arial, sans-serif',
            }}
          >
            {section.heading}
          </div>
          {section.items.map((item) => (
            <div key={item} style={{ display: "flex", gap: "1.8mm", marginBottom: "1.05mm" }}>
              <span style={{ flexShrink: 0, color: "rgba(255,255,255,0.7)" }}>•</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptySidebar({ imageUrl, portraitPosition }: { imageUrl?: string; portraitPosition?: string }) {
  return (
    <div style={{ background: "#000", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: mm(CV_LAYOUT.hero.topRowHeightMm),
          left: 0,
          width: mm(CV_LAYOUT.sidebarWidthMm),
          height: mm(CV_LAYOUT.hero.grayBandHeightMm),
          background: "#f2f2f2",
        }}
      />
      <Portrait
        topMm={CV_LAYOUT.hero.continuationPortraitTopMm}
        imageUrl={imageUrl}
        portraitPosition={portraitPosition}
      />
    </div>
  );
}

function LogoMark() {
  return (
    <img
      src="/STACQ_logo_black.png"
      alt="STACQ"
      style={{ width: mm(39.3), display: "block", filter: "brightness(0) invert(1)" }}
    />
  );
}

function Portrait({
  topMm,
  imageUrl,
  portraitPosition,
}: {
  topMm: number;
  imageUrl?: string;
  portraitPosition?: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: mm(topMm),
        left: mm(CV_LAYOUT.hero.portraitLeftMm),
        width: mm(CV_LAYOUT.hero.portraitWidthMm),
        height: mm(CV_LAYOUT.hero.portraitHeightMm),
        overflow: "hidden",
        background: "#000",
        zIndex: 2,
      }}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: portraitPosition || "50% 50%",
            display: "block",
          }}
        />
      )}
    </div>
  );
}

function ContactBlock({ contact }: { contact: HeroContact }) {
  const hasVisibleContent = [contact.title, contact.name, contact.phone, contact.email].some((value) => value.trim());
  if (!hasVisibleContent) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: mm(CV_LAYOUT.hero.contactRightMm),
        height: mm(CV_LAYOUT.hero.contactHeightMm),
        display: "flex",
        alignItems: "center",
        zIndex: 2,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: px(12), fontFamily: '"Verdana", Arial, sans-serif' }}>
        <div
          style={{
            width: "1.15px",
            height: mm(CV_LAYOUT.hero.contactSeparatorHeightMm),
            marginTop: mm(CV_LAYOUT.hero.contactSeparatorOffsetMm),
            background: "#d5d5d5",
            flexShrink: 0,
          }}
        />
        <div
          style={{ width: mm(CV_LAYOUT.hero.contactWidthMm), fontSize: pt(9.3), lineHeight: 1.28, color: "#848484" }}
        >
          <div style={{ fontWeight: 700, fontSize: pt(9.4), color: "#767676", marginBottom: "0.7mm" }}>
            {contact.title}
          </div>
          <div style={{ color: "#7e7e7e" }}>{contact.name}</div>
          <div style={{ whiteSpace: "nowrap" }}>{contact.phone}</div>
          <div style={{ whiteSpace: "nowrap" }}>{contact.email}</div>
        </div>
      </div>
    </div>
  );
}

function ProjectBlockHeader({
  company,
  subtitle,
  role,
  period,
}: Pick<ProjectEntry, "company" | "subtitle" | "role" | "period">) {
  return (
    <>
      <div
        style={{ fontWeight: 700, fontSize: "9.9pt", color: "#111", letterSpacing: "0.006em", marginBottom: "1.8mm" }}
      >
        {company}
      </div>
      <div style={{ fontWeight: 600, fontSize: "9.6pt", marginBottom: "2.9mm", color: "#242424", lineHeight: 1.28 }}>
        {subtitle}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "6mm",
          fontSize: "8.8pt",
          color: "#666",
          marginBottom: "3.1mm",
        }}
      >
        <span style={{ color: "#4f4f4f" }}>{role}</span>
        <span style={{ flexShrink: 0, color: "#4f4f4f" }}>{period}</span>
      </div>
    </>
  );
}

function TechnologiesLine({ technologies }: { technologies: string }) {
  return (
    <p style={{ margin: "1.2mm 0 0 0", lineHeight: 1.42, color: "#1f1f1f" }}>
      <strong>Teknologier:</strong> {technologies}
    </p>
  );
}

export function ProjectBlock({
  showHeader = true,
  company,
  subtitle,
  role,
  period,
  paragraphs,
  technologies,
  spacingAfterMm = PROJECT_BLOCK_MARGIN_BOTTOM_MM,
}: Omit<ProjectEntry, "paragraphs" | "technologies"> & {
  paragraphs: ProjectParagraphChunk[];
  technologies?: string;
  showHeader?: boolean;
  spacingAfterMm?: number;
}) {
  const reconstructedParagraphs = reconstructParagraphs(paragraphs);

  return (
    <div className="cv-project-block" style={{ marginBottom: mm(spacingAfterMm) }}>
      {showHeader ? <ProjectBlockHeader company={company} subtitle={subtitle} role={role} period={period} /> : null}
      {reconstructedParagraphs.map((paragraph, i) => (
        <p key={i} style={{ margin: "0 0 2.35mm 0", lineHeight: 1.36 }}>
          {paragraph}
        </p>
      ))}
      {technologies ? <TechnologiesLine technologies={technologies} /> : null}
    </div>
  );
}

function TimelineRow({
  period,
  primary,
  secondary,
  marginBottom = "2.5mm",
}: {
  period: string;
  primary: string;
  secondary?: string;
  marginBottom?: string;
}) {
  return (
    <div style={{ display: "flex", gap: "7mm", marginBottom, alignItems: "flex-start" }}>
      <span
        style={{
          minWidth: "29mm",
          flexShrink: 0,
          color: "#3d3d3d",
          fontSize: "9.4pt",
          lineHeight: 1.3,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.01em",
        }}
      >
        {period}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: "0.55mm" }}>
        <span style={{ fontSize: "9.8pt", lineHeight: 1.28, color: "#202020", fontWeight: 600 }}>{primary}</span>
        {secondary ? <span style={{ fontSize: "9.2pt", lineHeight: 1.28, color: "#555" }}>{secondary}</span> : null}
      </span>
    </div>
  );
}

function AdditionalSectionBulletRow({ primary, marginBottom = "2.8mm" }: { primary: string; marginBottom?: string }) {
  return (
    <div style={{ display: "flex", gap: "3.8mm", marginBottom, alignItems: "flex-start" }}>
      <span
        style={{
          width: "3.6mm",
          flexShrink: 0,
          color: "#3d3d3d",
          fontSize: "12pt",
          lineHeight: 1,
          textAlign: "center",
          paddingTop: "0.35mm",
        }}
      >
        •
      </span>
      <span style={{ fontSize: "9.8pt", lineHeight: 1.28, color: "#202020", fontWeight: 600, flex: 1 }}>{primary}</span>
    </div>
  );
}

function AdditionalSectionRows({ format, items }: { format: AdditionalSectionFormat; items: AdditionalSectionItem[] }) {
  return (
    <>
      {items.map((item, index) =>
        format === "bullet" ? (
          <AdditionalSectionBulletRow key={`${item.primary}-${index}`} primary={item.primary} marginBottom="2.8mm" />
        ) : (
          <TimelineRow
            key={`${item.period}-${item.primary}-${index}`}
            period={item.period}
            primary={item.primary}
            marginBottom="2.6mm"
          />
        ),
      )}
    </>
  );
}

function AdditionalSectionBlock({
  title,
  format,
  items,
  showTitle = true,
  marginTop = "6mm",
  spacingAfterMm = PROJECT_BLOCK_MARGIN_BOTTOM_MM,
}: {
  title: AdditionalSectionTitle;
  format: AdditionalSectionFormat;
  items: AdditionalSectionItem[];
  showTitle?: boolean;
  marginTop?: string;
  spacingAfterMm?: number;
}) {
  return (
    <div style={{ marginBottom: mm(spacingAfterMm) }}>
      {showTitle ? <SectionTitle marginTop={marginTop}>{title}</SectionTitle> : null}
      <AdditionalSectionRows format={format} items={items} />
    </div>
  );
}

function EducationSection({ education, marginTop = "6mm" }: { education: TimelineEntry[]; marginTop?: string }) {
  return (
    <>
      <SectionTitle marginTop={marginTop}>Utdannelse</SectionTitle>
      {education.map((entry, i) => (
        <TimelineRow
          key={i}
          period={entry.period}
          primary={entry.primary}
          secondary={entry.secondary}
          marginBottom="3.4mm"
        />
      ))}
    </>
  );
}

function WorkExperienceSection({
  workExperience,
  marginTop = "6mm",
}: {
  workExperience: TimelineEntry[];
  marginTop?: string;
}) {
  return (
    <>
      <SectionTitle marginTop={marginTop}>Arbeidserfaring</SectionTitle>
      {workExperience.map((entry, i) => (
        <TimelineRow key={i} period={entry.period} primary={entry.primary} marginBottom="2.6mm" />
      ))}
    </>
  );
}

function FlowBlockView({ block }: { block: FlowBlock }) {
  if (block.kind === "intro") {
    return <p style={{ margin: "0 0 3mm 0" }}>{block.text}</p>;
  }

  return (
    <p style={{ margin: "0 0 2.5mm 0" }}>
      <strong>{block.label}:</strong> {block.content}
    </p>
  );
}

function ContinuationPage({
  showProjectsTitle,
  pageProjects,
  pageAdditionalSections,
  sections,
  doc,
  imageUrl,
  portraitPosition,
}: {
  showProjectsTitle: boolean;
  pageProjects: ProjectFragment[];
  pageAdditionalSections: AdditionalSectionFragment[];
  sections: ContinuationSectionId[];
  doc: CVDocument;
  imageUrl?: string;
  portraitPosition?: string;
}) {
  const mergedProjects = mergeProjectFragmentsForPage(pageProjects);
  const mergedAdditionalSections = mergeAdditionalSectionFragmentsForPage(pageAdditionalSections);

  return (
    <div className="cv-page" style={pageStyle}>
      <div style={gridStyle}>
        <EmptySidebar imageUrl={imageUrl} portraitPosition={portraitPosition} />
        <div style={continuationMainStyle}>
          {mergedProjects.length > 0 && (
            <>
              {showProjectsTitle ? <SectionTitle marginTop="0">Prosjekter</SectionTitle> : null}
              {mergedProjects.map((project) => (
                <ProjectBlock key={project.key} {...project} />
              ))}
            </>
          )}
          {mergedAdditionalSections.map((section, index) => {
            const hasPreviousContent = mergedProjects.length > 0 || index > 0;
            return (
              <AdditionalSectionBlock
                key={section.key}
                title={section.title}
                format={section.format}
                items={section.items}
                showTitle
                marginTop={hasPreviousContent ? "6mm" : "0"}
                spacingAfterMm={section.spacingAfterMm}
              />
            );
          })}
          {sections.map((section, index) => {
            const hasPreviousContent = mergedProjects.length > 0 || mergedAdditionalSections.length > 0 || index > 0;
            const mt = hasPreviousContent ? "6mm" : "0";
            if (section === "education")
              return <EducationSection key={section} education={doc.education} marginTop={mt} />;
            return <WorkExperienceSection key={section} workExperience={doc.workExperience} marginTop={mt} />;
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Main Renderer
// ═══════════════════════════════════════

interface CvRendererProps {
  doc: CVDocument;
  imageUrl?: string;
  scale?: number;
}

export function CvRendererPreview({ doc, imageUrl, scale = 1 }: CvRendererProps) {
  const [firstPageFlowBlocks, setFirstPageFlowBlocks] = useState<FlowBlock[]>([]);
  const [continuationPages, setContinuationPages] = useState<ContinuationPageModel[]>([]);
  const firstPageCapacityRef = useRef<HTMLDivElement | null>(null);
  const measureCapacityRef = useRef<HTMLDivElement | null>(null);
  const projectsTitleTopMeasureRef = useRef<HTMLDivElement | null>(null);
  const projectsTitleAfterMeasureRef = useRef<HTMLDivElement | null>(null);
  const additionalSectionTitleTopMeasureRef = useRef<HTMLDivElement | null>(null);
  const additionalSectionTitleAfterMeasureRef = useRef<HTMLDivElement | null>(null);
  const educationTopMeasureRef = useRef<HTMLDivElement | null>(null);
  const educationAfterMeasureRef = useRef<HTMLDivElement | null>(null);
  const workTopMeasureRef = useRef<HTMLDivElement | null>(null);
  const workAfterMeasureRef = useRef<HTMLDivElement | null>(null);
  const projectFragmentMeasureRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const additionalSectionFragmentMeasureRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const flowMeasureRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const flowBlocks: FlowBlock[] = [
    ...doc.introParagraphs.map((text, index) => ({
      key: `intro-${index}`,
      kind: "intro" as const,
      text,
    })),
    ...doc.competenceGroups.map((group, index) => ({
      key: `competence-${index}`,
      kind: "competence" as const,
      label: group.label,
      content: group.content,
    })),
  ];

  const projectFragments = useMemo(() => doc.projects.map((project) => buildProjectFragments(project)), [doc.projects]);
  const additionalSectionFragments = useMemo(
    () => doc.additionalSections.map((section) => buildAdditionalSectionFragments(section)),
    [doc.additionalSections],
  );
  const additionalSectionMeasureTitle = useMemo(() => {
    const titles = doc.additionalSections
      .map((section) => section.title.trim())
      .filter(Boolean);

    if (titles.length === 0) return DEFAULT_ADDITIONAL_SECTION_TITLE;

    return titles.reduce((longest, title) => (title.length > longest.length ? title : longest), titles[0]);
  }, [doc.additionalSections]);

  useEffect(() => {
    let cancelled = false;
    const updatePagination = async () => {
      await waitForFontsReady(document);
      await waitForDoubleFrame(window);
      if (cancelled) return;
      const firstPageCapacity = firstPageCapacityRef.current;
      const measureCapacity = measureCapacityRef.current;
      const projectsTitleTop = projectsTitleTopMeasureRef.current;
      const projectsTitleAfter = projectsTitleAfterMeasureRef.current;
      const additionalSectionTitleTop = additionalSectionTitleTopMeasureRef.current;
      const additionalSectionTitleAfter = additionalSectionTitleAfterMeasureRef.current;
      const educationTop = educationTopMeasureRef.current;
      const educationAfter = educationAfterMeasureRef.current;
      const workTop = workTopMeasureRef.current;
      const workAfter = workAfterMeasureRef.current;
      if (
        !firstPageCapacity ||
        !measureCapacity ||
        !projectsTitleTop ||
        !projectsTitleAfter ||
        !additionalSectionTitleTop ||
        !additionalSectionTitleAfter ||
        !educationTop ||
        !educationAfter ||
        !workTop ||
        !workAfter
      ) {
        return;
      }
      const pageHeightPx = measureCapacity.getBoundingClientRect().height;
      const mmToPx = pageHeightPx / 297;
      const bottomBuffer = Math.max(CONTINUATION_BOTTOM_BUFFER_MM, 0) * mmToPx;
      const projectFitSafety = PROJECT_FRAGMENT_FIT_SAFETY_MM * mmToPx;
      const firstPageAvailableHeight =
        firstPageCapacity.clientHeight - (CV_LAYOUT.mainPadding.topMm + CV_LAYOUT.mainPadding.bottomMm) * mmToPx;
      const continuationAvailableHeight =
        measureCapacity.clientHeight - (CV_LAYOUT.continuationTopPaddingMm + CV_LAYOUT.mainPadding.bottomMm) * mmToPx;
      const flowHeights = flowBlocks.map((block) => measureOuterHeight(flowMeasureRefs.current[block.key]));
      const projectFragmentHeights = projectFragments.map((fragments) =>
        fragments.map((fragment) => measureOuterHeight(projectFragmentMeasureRefs.current[fragment.key])),
      );
      const additionalSectionFragmentHeights = additionalSectionFragments.map((fragments) =>
        fragments.map((fragment) => measureOuterHeight(additionalSectionFragmentMeasureRefs.current[fragment.key])),
      );
      const nextPagination = buildContinuationPages({
        flowBlocks,
        flowHeights,
        firstPageAvailableHeight,
        projectFragments,
        projectFragmentHeights,
        additionalSectionFragments,
        additionalSectionFragmentHeights,
        projectFitSafety,
        projectsTitleTopHeight: measureOuterHeight(projectsTitleTop),
        projectsTitleAfterHeight: measureOuterHeight(projectsTitleAfter),
        additionalSectionTitleTopHeight: measureOuterHeight(additionalSectionTitleTop),
        additionalSectionTitleAfterHeight: measureOuterHeight(additionalSectionTitleAfter),
        educationTopHeight: measureOuterHeight(educationTop),
        educationAfterHeight: measureOuterHeight(educationAfter),
        workTopHeight: measureOuterHeight(workTop),
        workAfterHeight: measureOuterHeight(workAfter),
        continuationAvailableHeight,
        bottomBuffer,
      });
      if (cancelled) return;
      setFirstPageFlowBlocks((current) =>
        JSON.stringify(current) === JSON.stringify(nextPagination.firstPageFlowBlocks)
          ? current
          : nextPagination.firstPageFlowBlocks,
      );
      setContinuationPages((current) =>
        JSON.stringify(current) === JSON.stringify(nextPagination.continuationPages)
          ? current
          : nextPagination.continuationPages,
      );
    };
    updatePagination();
    window.addEventListener("resize", updatePagination);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", updatePagination);
    };
  }, [doc, flowBlocks, projectFragments, additionalSectionFragments]);
  const { hero, sidebarSections, education, workExperience } = doc;

  return (
    <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: `${100 / scale}%` }}>
      {/* Hidden measure elements */}
      <div aria-hidden="true" className="no-print" style={hiddenMeasureRootStyle}>
        <div
          style={{
            width: mm(CV_LAYOUT.pageWidthMm),
            display: "grid",
            gridTemplateColumns: `${mm(CV_LAYOUT.sidebarWidthMm)} 1fr`,
            gridTemplateRows: `${mm(CV_LAYOUT.firstPageHeroHeightMm)} 1fr`,
            height: mm(CV_LAYOUT.pageHeightMm),
          }}
        >
          <div />
          <div ref={firstPageCapacityRef} style={{ ...mainStyle, gridColumn: 2, gridRow: 2 }} />
        </div>
        <div
          style={{
            width: mm(CV_LAYOUT.pageWidthMm),
            display: "grid",
            gridTemplateColumns: `${mm(CV_LAYOUT.sidebarWidthMm)} 1fr`,
            height: mm(CV_LAYOUT.pageHeightMm),
          }}
        >
          <div />
          <div ref={measureCapacityRef} style={continuationMainStyle} />
        </div>
        <div style={continuationMeasureContentStyle}>
          {flowBlocks.map((block) => (
            <div
              key={`measure-flow-${block.key}`}
              style={{ display: "flow-root" }}
              ref={(el) => {
                flowMeasureRefs.current[block.key] = el;
              }}
            >
              <FlowBlockView block={block} />
            </div>
          ))}
          <div ref={projectsTitleTopMeasureRef} style={{ display: "flow-root" }}>
            <SectionTitle marginTop="0">Prosjekter</SectionTitle>
          </div>
          <div ref={projectsTitleAfterMeasureRef} style={{ display: "flow-root" }}>
            <SectionTitle marginTop="6mm">Prosjekter</SectionTitle>
          </div>
          {projectFragments.flat().map((fragment) => (
            <div
              key={`measure-${fragment.key}`}
              style={{ display: "flow-root" }}
              ref={(el) => {
                projectFragmentMeasureRefs.current[fragment.key] = el;
              }}
            >
              <ProjectBlock {...fragment} />
            </div>
          ))}
          <div ref={additionalSectionTitleTopMeasureRef} style={{ display: "flow-root" }}>
            <SectionTitle marginTop="0">{additionalSectionMeasureTitle}</SectionTitle>
          </div>
          <div ref={additionalSectionTitleAfterMeasureRef} style={{ display: "flow-root" }}>
            <SectionTitle marginTop="6mm">{additionalSectionMeasureTitle}</SectionTitle>
          </div>
          {additionalSectionFragments.flat().map((fragment) => (
            <div
              key={`measure-additional-${fragment.key}`}
              style={{ display: "flow-root" }}
              ref={(el) => {
                additionalSectionFragmentMeasureRefs.current[fragment.key] = el;
              }}
            >
              <AdditionalSectionBlock
                title={fragment.title}
                format={fragment.format}
                items={fragment.items}
                showTitle={false}
                spacingAfterMm={fragment.spacingAfterMm}
              />
            </div>
          ))}
          <div ref={educationTopMeasureRef} style={{ display: "flow-root" }}>
            <EducationSection education={education} marginTop="0" />
          </div>
          <div ref={educationAfterMeasureRef} style={{ display: "flow-root" }}>
            <EducationSection education={education} marginTop="6mm" />
          </div>
          <div ref={workTopMeasureRef} style={{ display: "flow-root" }}>
            <WorkExperienceSection workExperience={workExperience} marginTop="0" />
          </div>
          <div ref={workAfterMeasureRef} style={{ display: "flow-root" }}>
            <WorkExperienceSection workExperience={workExperience} marginTop="6mm" />
          </div>
        </div>
      </div>

      {/* Pages */}
      <div className="cv-print-root">
        <div
          className="cv-pages"
          style={{
            fontFamily: '"Calibri", "Carlito", Arial, sans-serif',
            display: "flex",
            flexDirection: "column",
            gap: px(CV_LAYOUT.screen.pageGapPx),
          }}
        >
          {/* First page */}
          <div className="cv-page cv-document" style={pageStyle}>
            <div style={firstPageGridStyle}>
              <div
                style={{
                  gridColumn: "1 / -1",
                  gridRow: 1,
                  position: "relative",
                  overflow: "hidden",
                  background: "transparent",
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: mm(CV_LAYOUT.sidebarWidthMm),
                    right: 0,
                    height: mm(CV_LAYOUT.hero.topRowHeightMm),
                    background: "#fff",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: mm(CV_LAYOUT.hero.topRowHeightMm),
                    left: 0,
                    right: 0,
                    height: mm(CV_LAYOUT.hero.grayBandHeightMm),
                    background: "#f2f2f2",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: mm(CV_LAYOUT.sidebarWidthMm),
                    height: mm(CV_LAYOUT.hero.logoBoxHeightMm),
                  }}
                >
                  <div
                    style={{
                      width: mm(CV_LAYOUT.sidebarWidthMm),
                      height: mm(CV_LAYOUT.hero.logoBoxHeightMm),
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <LogoMark />
                  </div>
                </div>
                <Portrait
                  topMm={CV_LAYOUT.hero.firstPagePortraitTopMm}
                  imageUrl={imageUrl}
                  portraitPosition={doc.hero.portrait_position}
                />
                <ContactBlock contact={hero.contact} />
                <div
                  style={{
                    position: "absolute",
                    top: mm(CV_LAYOUT.hero.textTopMm),
                    left: mm(CV_LAYOUT.hero.textLeftMm),
                    width: mm(CV_LAYOUT.hero.textWidthMm),
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    zIndex: 2,
                  }}
                >
                  <div
                    style={{
                      fontFamily: '"Carlito", "Calibri", Arial, sans-serif',
                      fontSize: "32.3pt",
                      fontWeight: 700,
                      marginLeft: "-1mm",
                      letterSpacing: "-0.014em",
                      lineHeight: 0.99,
                      color: "#000",
                    }}
                  >
                    {hero.name}
                  </div>
                  <div
                    style={{
                      fontFamily: '"Raleway", "Helvetica Neue", Arial, sans-serif',
                      fontSize: "11.2pt",
                      fontWeight: 500,
                      marginTop: "3.3mm",
                      letterSpacing: "0.05em",
                      color: "#383838",
                    }}
                  >
                    {hero.title}
                  </div>
                </div>
              </div>
              <div style={{ gridColumn: 1, gridRow: "1 / -1", background: "#000", zIndex: 0 }} />
              <div style={{ gridColumn: 1, gridRow: 2, position: "relative", zIndex: 1 }}>
                <Sidebar sections={sidebarSections} transparentBackground />
              </div>
              <div style={{ ...mainStyle, gridColumn: 2, gridRow: 2 }}>
                {firstPageFlowBlocks.map((block) => (
                  <FlowBlockView key={block.key} block={block} />
                ))}
              </div>
            </div>
          </div>

          {continuationPages.map((page, index) => (
            <ContinuationPage
              key={page.key}
              showProjectsTitle={index === 0 && page.projects.length > 0}
              pageProjects={page.projects}
              pageAdditionalSections={page.additionalSections}
              sections={page.sections}
              doc={doc}
              imageUrl={imageUrl}
              portraitPosition={doc.hero.portrait_position}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Print dialog helper
// ═══════════════════════════════════════

export async function openCvPrintDialog(documentTitle?: string) {
  const sourceRoot = document.querySelector(".cv-print-root") as HTMLElement | null;
  if (!sourceRoot) return;

  const clonedRoot = sourceRoot.cloneNode(true) as HTMLElement;
  Array.from(clonedRoot.querySelectorAll<HTMLImageElement>("img")).forEach((image) => {
    const rawSrc = image.getAttribute("src") ?? image.src;
    image.src = new URL(rawSrc, window.location.href).toString();
  });

  const printFrame = document.createElement("iframe");
  printFrame.setAttribute("aria-hidden", "true");
  Object.assign(printFrame.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(printFrame);

  const printWindow = printFrame.contentWindow;
  const printDocument = printFrame.contentDocument;
  if (!printWindow || !printDocument) {
    printFrame.remove();
    return;
  }

  printDocument.open();
  printDocument.write(`<!doctype html>
<html lang="no">
  <head>
    <meta charset="utf-8" />
    <title>${documentTitle || CV_PRINT.documentTitle}</title>
    <style>${PRINT_DOCUMENT_CSS}</style>
  </head>
  <body>${clonedRoot.outerHTML}</body>
</html>`);
  printDocument.close();

  const readyImages = Array.from(printDocument.querySelectorAll<HTMLImageElement>("img"));
  const imagePromises = readyImages.map(
    (image) =>
      new Promise<void>((resolve) => {
        if (image.complete) {
          resolve();
          return;
        }
        const done = () => {
          image.removeEventListener("load", done);
          image.removeEventListener("error", done);
          resolve();
        };
        image.addEventListener("load", done);
        image.addEventListener("error", done);
      }),
  );

  await Promise.all([waitForFontsReady(printDocument), ...imagePromises]);
  await waitForDoubleFrame(printWindow);

  const cleanupPrintFrame = () => {
    printWindow.removeEventListener("afterprint", cleanupPrintFrame);
    printFrame.remove();
  };
  const originalTitle = document.title;
  if (documentTitle) document.title = documentTitle;
  printWindow.focus();
  printWindow.addEventListener("afterprint", cleanupPrintFrame, { once: true });
  window.setTimeout(cleanupPrintFrame, 60000);
  printWindow.print();
  if (documentTitle) {
    // Restore after a short delay so the print dialog has time to read the title
    window.setTimeout(() => {
      document.title = originalTitle;
    }, 2000);
  }
}
