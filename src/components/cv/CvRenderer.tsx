import React, { useEffect, useRef, useState } from "react";

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
  paragraphs: string[];
  technologies: string;
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
};

export type CVDocument = {
  hero: HeroContent;
  sidebarSections: SidebarSection[];
  introParagraphs: string[];
  competenceGroups: CompetenceGroup[];
  projects: ProjectEntry[];
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

function getProjectKey(project: ProjectEntry) {
  return `${project.company}-${project.subtitle}`;
}

// ═══════════════════════════════════════
// Pagination
// ═══════════════════════════════════════

type ContinuationSectionId = "education" | "work";

type ContinuationPageModel = {
  key: string;
  projects: ProjectEntry[];
  sections: ContinuationSectionId[];
};

function buildContinuationPages({
  allProjects,
  projectHeights,
  projectsTitleHeight,
  educationTopHeight,
  educationAfterHeight,
  workTopHeight,
  workAfterHeight,
  availableHeight,
  bottomBuffer,
}: {
  allProjects: ProjectEntry[];
  projectHeights: number[];
  projectsTitleHeight: number;
  educationTopHeight: number;
  educationAfterHeight: number;
  workTopHeight: number;
  workAfterHeight: number;
  availableHeight: number;
  bottomBuffer: number;
}): ContinuationPageModel[] {
  const capacity = Math.max(availableHeight - bottomBuffer, 0);

  const getProjectsUsedHeight = (indices: number[]) => {
    if (indices.length === 0) return 0;
    return projectsTitleHeight + indices.reduce((sum, index) => sum + projectHeights[index], 0);
  };

  const projectPages: number[][] = [];
  let currentPage: number[] = [];
  let currentUsed = 0;

  for (let index = 0; index < allProjects.length; index += 1) {
    const nextUsed =
      currentPage.length === 0 ? projectsTitleHeight + projectHeights[index] : currentUsed + projectHeights[index];

    if (currentPage.length > 0 && nextUsed > capacity) {
      projectPages.push(currentPage);
      currentPage = [index];
      currentUsed = projectsTitleHeight + projectHeights[index];
    } else {
      currentPage.push(index);
      currentUsed = nextUsed;
    }
  }

  if (currentPage.length > 0) projectPages.push(currentPage);
  if (projectPages.length === 0) projectPages.push([]);

  for (let pageIndex = projectPages.length - 1; pageIndex > 0; pageIndex -= 1) {
    let canRebalance = true;
    while (canRebalance) {
      canRebalance = false;
      const previousPage = projectPages[pageIndex - 1];
      const currentPageProjects = projectPages[pageIndex];
      if (previousPage.length <= 1) break;
      const candidateIndex = previousPage[previousPage.length - 1];
      const previousBefore = getProjectsUsedHeight(previousPage);
      const currentBefore = getProjectsUsedHeight(currentPageProjects);
      const previousAfterProjects = previousPage.slice(0, -1);
      const currentAfterProjects = [candidateIndex, ...currentPageProjects];
      const previousAfter = getProjectsUsedHeight(previousAfterProjects);
      const currentAfter = getProjectsUsedHeight(currentAfterProjects);
      if (currentAfter > capacity) break;
      const beforeSpread = Math.abs(capacity - previousBefore - (capacity - currentBefore));
      const afterSpread = Math.abs(capacity - previousAfter - (capacity - currentAfter));
      const beforeWorstGap = Math.max(capacity - previousBefore, capacity - currentBefore);
      const afterWorstGap = Math.max(capacity - previousAfter, capacity - currentAfter);
      if (afterSpread < beforeSpread && afterWorstGap <= beforeWorstGap + 12) {
        previousPage.pop();
        currentPageProjects.unshift(candidateIndex);
        canRebalance = true;
      }
    }
  }

  const models = projectPages.map((pageProjects, index) => ({
    key: `continuation-${index + 1}`,
    projectIndices: [...pageProjects],
    sections: [] as ContinuationSectionId[],
    usedHeight: getProjectsUsedHeight(pageProjects),
  }));

  const appendSection = (sectionId: ContinuationSectionId, topHeight: number, afterHeight: number) => {
    const lastPage = models[models.length - 1];
    const isAtTop = lastPage.usedHeight === 0;
    const sectionHeight = isAtTop ? topHeight : afterHeight;
    if (!isAtTop && lastPage.usedHeight + sectionHeight > capacity) {
      models.push({
        key: `continuation-${models.length + 1}`,
        projectIndices: [],
        sections: [sectionId],
        usedHeight: topHeight,
      });
      return;
    }
    lastPage.sections.push(sectionId);
    lastPage.usedHeight += sectionHeight;
  };

  appendSection("education", educationTopHeight, educationAfterHeight);
  appendSection("work", workTopHeight, workAfterHeight);

  return models.map((page) => ({
    key: page.key,
    projects: page.projectIndices.map((index) => allProjects[index]),
    sections: page.sections,
  }));
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

function EmptySidebar({ imageUrl }: { imageUrl?: string }) {
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
      <Portrait topMm={CV_LAYOUT.hero.continuationPortraitTopMm} imageUrl={imageUrl} />
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

function Portrait({ topMm, imageUrl }: { topMm: number; imageUrl?: string }) {
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
            objectPosition: "center 11%",
            display: "block",
          }}
        />
      )}
    </div>
  );
}

function ContactBlock({ contact }: { contact: HeroContact }) {
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

export function ProjectBlock({ company, subtitle, role, period, paragraphs, technologies }: ProjectEntry) {
  return (
    <div className="cv-project-block" style={{ marginBottom: "6.4mm" }}>
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
      {paragraphs.map((paragraph, i) => (
        <p key={i} style={{ margin: "0 0 2.35mm 0", lineHeight: 1.36 }}>
          {paragraph}
        </p>
      ))}
      <p style={{ margin: "1.2mm 0 0 0", lineHeight: 1.42, color: "#1f1f1f" }}>
        <strong>Teknologier:</strong> {technologies}
      </p>
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

function ContinuationPage({
  pageProjects,
  sections,
  doc,
  imageUrl,
}: {
  pageProjects: ProjectEntry[];
  sections: ContinuationSectionId[];
  doc: CVDocument;
  imageUrl?: string;
}) {
  return (
    <div className="cv-page" style={pageStyle}>
      <div style={gridStyle}>
        <EmptySidebar imageUrl={imageUrl} />
        <div style={continuationMainStyle}>
          {pageProjects.length > 0 && (
            <>
              <SectionTitle marginTop="0">Prosjekter</SectionTitle>
              {pageProjects.map((project) => (
                <ProjectBlock key={getProjectKey(project)} {...project} />
              ))}
            </>
          )}
          {sections.map((section, index) => {
            const mt = pageProjects.length > 0 || index > 0 ? "6mm" : "0";
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
  const [continuationPages, setContinuationPages] = useState<ContinuationPageModel[]>([]);
  const measureCapacityRef = useRef<HTMLDivElement | null>(null);
  const projectsTitleMeasureRef = useRef<HTMLDivElement | null>(null);
  const educationTopMeasureRef = useRef<HTMLDivElement | null>(null);
  const educationAfterMeasureRef = useRef<HTMLDivElement | null>(null);
  const workTopMeasureRef = useRef<HTMLDivElement | null>(null);
  const workAfterMeasureRef = useRef<HTMLDivElement | null>(null);
  const projectMeasureRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    let cancelled = false;
    const updatePagination = async () => {
      await waitForFontsReady(document);
      await waitForDoubleFrame(window);
      if (cancelled) return;
      const measureCapacity = measureCapacityRef.current;
      const projectsTitle = projectsTitleMeasureRef.current;
      const educationTop = educationTopMeasureRef.current;
      const educationAfter = educationAfterMeasureRef.current;
      const workTop = workTopMeasureRef.current;
      const workAfter = workAfterMeasureRef.current;
      if (!measureCapacity || !projectsTitle || !educationTop || !educationAfter || !workTop || !workAfter) return;
      const pageHeightPx = measureCapacity.getBoundingClientRect().height;
      const mmToPx = pageHeightPx / 297;
      const bottomBuffer = Math.max(CONTINUATION_BOTTOM_BUFFER_MM, 0) * mmToPx;
      const projectHeights = doc.projects.map((project) =>
        measureOuterHeight(projectMeasureRefs.current[getProjectKey(project)]),
      );
      const nextPages = buildContinuationPages({
        allProjects: doc.projects,
        projectHeights,
        projectsTitleHeight: measureOuterHeight(projectsTitle),
        educationTopHeight: measureOuterHeight(educationTop),
        educationAfterHeight: measureOuterHeight(educationAfter),
        workTopHeight: measureOuterHeight(workTop),
        workAfterHeight: measureOuterHeight(workAfter),
        availableHeight: measureCapacity.clientHeight,
        bottomBuffer,
      });
      if (cancelled) return;
      setContinuationPages((current) => (JSON.stringify(current) === JSON.stringify(nextPages) ? current : nextPages));
    };
    updatePagination();
    window.addEventListener("resize", updatePagination);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", updatePagination);
    };
  }, [doc]);

  const { hero, sidebarSections, introParagraphs, competenceGroups, projects, education, workExperience } = doc;

  return (
    <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: `${100 / scale}%` }}>
      {/* Hidden measure elements */}
      <div aria-hidden="true" className="no-print" style={hiddenMeasureRootStyle}>
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
          <div ref={projectsTitleMeasureRef} style={{ display: "flow-root" }}>
            <SectionTitle marginTop="0">Prosjekter</SectionTitle>
          </div>
          {projects.map((project) => (
            <div
              key={`measure-${getProjectKey(project)}`}
              style={{ display: "flow-root" }}
              ref={(el) => {
                projectMeasureRefs.current[getProjectKey(project)] = el;
              }}
            >
              <ProjectBlock {...project} />
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
                <Portrait topMm={CV_LAYOUT.hero.firstPagePortraitTopMm} imageUrl={imageUrl} />
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
                {introParagraphs.map((paragraph, i) => (
                  <p key={i} style={{ margin: "0 0 3mm 0" }}>
                    {paragraph}
                  </p>
                ))}
                {competenceGroups.map((group, i) => (
                  <p key={i} style={{ margin: "0 0 2.5mm 0" }}>
                    <strong>{group.label}:</strong> {group.content}
                  </p>
                ))}
              </div>
            </div>
          </div>

          {continuationPages.map((page) => (
            <ContinuationPage
              key={page.key}
              pageProjects={page.projects}
              sections={page.sections}
              doc={doc}
              imageUrl={imageUrl}
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
  printWindow.focus();
  printWindow.addEventListener("afterprint", cleanupPrintFrame, { once: true });
  window.setTimeout(cleanupPrintFrame, 60000);
  printWindow.print();
}
