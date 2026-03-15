import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { History, RotateCcw, Download, ChevronDown, Plus, Trash2, GripVertical, Loader2, Check, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { toast } from "sonner";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import React from "react";

// ═══════════════════════════════════════
// Types (from CVMaker.tsx)
// ═══════════════════════════════════════

type SidebarSection = { heading: string; items: string[] };
type CompetenceGroup = { label: string; content: string };
type ProjectEntry = {
  company: string; subtitle: string; role: string; period: string;
  paragraphs: string[]; technologies: string;
};
type TimelineEntry = { period: string; primary: string; secondary?: string };
type HeroContact = { title: string; name: string; phone: string; email: string };
type HeroContent = { name: string; title: string; contact: HeroContact };
type CVDocument = {
  hero: HeroContent; sidebarSections: SidebarSection[];
  introParagraphs: string[]; competenceGroups: CompetenceGroup[];
  projects: ProjectEntry[]; education: TimelineEntry[]; workExperience: TimelineEntry[];
};

// ═══════════════════════════════════════
// Layout constants
// ═══════════════════════════════════════

const mm = (v: number) => `${v}mm`;
const pt = (v: number) => `${v}pt`;
const px = (v: number) => `${v}px`;
const paddingMm = (t: number, r: number, b: number, l: number) => `${mm(t)} ${mm(r)} ${mm(b)} ${mm(l)}`;

const CV_LAYOUT = {
  pageWidthMm: 210, pageHeightMm: 297, sidebarWidthMm: 55,
  measureContentWidthMm: 155, firstPageHeroHeightMm: 71.4,
  continuationTopPaddingMm: 25.5,
  sidebarPadding: { topMm: 8.8, rightMm: 4.8, bottomMm: 10.5, leftMm: 6.8 },
  mainPadding: { topMm: 8.8, rightMm: 8.9, bottomMm: 10.2, leftMm: 8.9 },
  hero: {
    topRowHeightMm: 31.25, grayBandHeightMm: 34.2, logoBoxHeightMm: 24.8,
    portraitLeftMm: 6.8, portraitWidthMm: 41.4, portraitHeightMm: 46.75,
    firstPagePortraitTopMm: 24.8, continuationPortraitTopMm: 26.5,
    textTopMm: 39.9, textLeftMm: 63.9, textWidthMm: 124,
    contactRightMm: 7.8, contactHeightMm: 31.25, contactWidthMm: 41.5,
    contactSeparatorHeightMm: 16.9, contactSeparatorOffsetMm: 1.2,
  },
  screen: { pageGapPx: 16, topPaddingPx: 24, bottomPaddingPx: 40, controlsGapPx: 12 },
} as const;

const CV_PRINT = {
  documentTitle: "CV",
  previewBackground: "#d7d7d7",
  helperText: 'For beste PDF-kvalitet, velg "Lagre som PDF" i print-dialogen.',
} as const;

const CONTINUATION_BOTTOM_PADDING_MM = 10.2;
const CONTINUATION_TARGET_BOTTOM_MARGIN_MM = 14.5;
const CONTINUATION_BOTTOM_BUFFER_MM = CONTINUATION_TARGET_BOTTOM_MARGIN_MM - CONTINUATION_BOTTOM_PADDING_MM;

const PRINT_DOCUMENT_CSS = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: white; }
  body { font-family: "Calibri", "Carlito", Arial, sans-serif; }
  .cv-pages { display: block !important; }
  .cv-page {
    width: ${mm(CV_LAYOUT.pageWidthMm)} !important; height: ${mm(CV_LAYOUT.pageHeightMm)} !important;
    min-height: ${mm(CV_LAYOUT.pageHeightMm)} !important; margin: 0 auto !important;
    box-shadow: none !important; overflow: hidden !important;
    page-break-after: always; break-after: page;
  }
  .cv-page:last-child { page-break-after: auto; break-after: auto; }
  .cv-project-block { page-break-inside: avoid; break-inside: avoid; }
  .no-print { display: none !important; }
  @media screen {
    body { background: ${CV_PRINT.previewBackground}; padding: ${px(CV_LAYOUT.screen.topPaddingPx)} 0 ${px(CV_LAYOUT.screen.bottomPaddingPx)}; }
    .cv-pages { display: flex !important; flex-direction: column; gap: ${px(CV_LAYOUT.screen.pageGapPx)}; }
  }
`;

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function waitForFontsReady(targetDocument: Document) {
  return "fonts" in targetDocument && "ready" in targetDocument.fonts
    ? targetDocument.fonts.ready.catch(() => undefined) : Promise.resolve();
}

function waitForDoubleFrame(win: Window) {
  return new Promise<void>((resolve) => {
    win.requestAnimationFrame(() => { win.requestAnimationFrame(() => resolve()); });
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
type ContinuationPageModel = { key: string; projects: ProjectEntry[]; sections: ContinuationSectionId[] };

function buildContinuationPages({
  allProjects, projectHeights, projectsTitleHeight,
  educationTopHeight, educationAfterHeight, workTopHeight, workAfterHeight,
  availableHeight, bottomBuffer,
}: {
  allProjects: ProjectEntry[]; projectHeights: number[]; projectsTitleHeight: number;
  educationTopHeight: number; educationAfterHeight: number;
  workTopHeight: number; workAfterHeight: number;
  availableHeight: number; bottomBuffer: number;
}): ContinuationPageModel[] {
  const capacity = Math.max(availableHeight - bottomBuffer, 0);
  const getH = (indices: number[]) => indices.length === 0 ? 0 : projectsTitleHeight + indices.reduce((s, i) => s + projectHeights[i], 0);

  const projectPages: number[][] = [];
  let cur: number[] = [], curH = 0;
  for (let i = 0; i < allProjects.length; i++) {
    const next = cur.length === 0 ? projectsTitleHeight + projectHeights[i] : curH + projectHeights[i];
    if (cur.length > 0 && next > capacity) { projectPages.push(cur); cur = [i]; curH = projectsTitleHeight + projectHeights[i]; }
    else { cur.push(i); curH = next; }
  }
  if (cur.length > 0) projectPages.push(cur);
  if (projectPages.length === 0) projectPages.push([]);

  for (let pi = projectPages.length - 1; pi > 0; pi--) {
    let can = true;
    while (can) {
      can = false;
      const prev = projectPages[pi - 1], curr = projectPages[pi];
      if (prev.length <= 1) break;
      const cand = prev[prev.length - 1];
      const pB = getH(prev), cB = getH(curr);
      const pA = getH(prev.slice(0, -1)), cA = getH([cand, ...curr]);
      if (cA > capacity) break;
      const bS = Math.abs(capacity - pB - (capacity - cB));
      const aS = Math.abs(capacity - pA - (capacity - cA));
      const bW = Math.max(capacity - pB, capacity - cB);
      const aW = Math.max(capacity - pA, capacity - cA);
      if (aS < bS && aW <= bW + 12) { prev.pop(); curr.unshift(cand); can = true; }
    }
  }

  const models = projectPages.map((pp, i) => ({
    key: `c-${i + 1}`, projectIndices: [...pp],
    sections: [] as ContinuationSectionId[], usedHeight: getH(pp),
  }));

  const appendSection = (sid: ContinuationSectionId, topH: number, afterH: number) => {
    const last = models[models.length - 1];
    const atTop = last.usedHeight === 0;
    const sh = atTop ? topH : afterH;
    if (!atTop && last.usedHeight + sh > capacity) {
      models.push({ key: `c-${models.length + 1}`, projectIndices: [], sections: [sid], usedHeight: topH });
      return;
    }
    last.sections.push(sid); last.usedHeight += sh;
  };
  appendSection("education", educationTopHeight, educationAfterHeight);
  appendSection("work", workTopHeight, workAfterHeight);

  return models.map((p) => ({ key: p.key, projects: p.projectIndices.map((i) => allProjects[i]), sections: p.sections }));
}

// ═══════════════════════════════════════
// Styles
// ═══════════════════════════════════════

const pageStyle = {
  width: mm(CV_LAYOUT.pageWidthMm), height: mm(CV_LAYOUT.pageHeightMm), minHeight: mm(CV_LAYOUT.pageHeightMm),
  margin: "0 auto", background: "#fff", color: "#222", boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
  position: "relative", overflow: "hidden",
} satisfies React.CSSProperties;

const gridStyle = {
  display: "grid", gridTemplateColumns: `${mm(CV_LAYOUT.sidebarWidthMm)} 1fr`,
  height: mm(CV_LAYOUT.pageHeightMm), minHeight: mm(CV_LAYOUT.pageHeightMm), position: "relative",
} satisfies React.CSSProperties;

const firstPageGridStyle = { ...gridStyle, gridTemplateRows: `${mm(CV_LAYOUT.firstPageHeroHeightMm)} 1fr` } satisfies React.CSSProperties;

const leftRailStyle = {
  background: "#000", color: "rgba(255,255,255,0.92)",
  padding: paddingMm(CV_LAYOUT.sidebarPadding.topMm, CV_LAYOUT.sidebarPadding.rightMm, CV_LAYOUT.sidebarPadding.bottomMm, CV_LAYOUT.sidebarPadding.leftMm),
  fontSize: pt(9.1), lineHeight: 1.46,
} satisfies React.CSSProperties;

const mainStyle = {
  padding: paddingMm(CV_LAYOUT.mainPadding.topMm, CV_LAYOUT.mainPadding.rightMm, CV_LAYOUT.mainPadding.bottomMm, CV_LAYOUT.mainPadding.leftMm),
  fontSize: pt(10.3), lineHeight: 1.42, color: "#1f1f1f", fontFamily: '"Calibri", "Carlito", Arial, sans-serif',
} satisfies React.CSSProperties;

const continuationMainStyle = {
  ...mainStyle,
  padding: paddingMm(CV_LAYOUT.continuationTopPaddingMm, CV_LAYOUT.mainPadding.rightMm, CV_LAYOUT.mainPadding.bottomMm, CV_LAYOUT.mainPadding.leftMm),
} satisfies React.CSSProperties;

const continuationMeasureContentStyle = {
  width: mm(CV_LAYOUT.measureContentWidthMm), boxSizing: "border-box",
  padding: paddingMm(0, CV_LAYOUT.mainPadding.rightMm, 0, CV_LAYOUT.mainPadding.leftMm),
  fontSize: pt(10.3), lineHeight: 1.42, color: "#1f1f1f", fontFamily: '"Calibri", "Carlito", Arial, sans-serif',
} satisfies React.CSSProperties;

const hiddenMeasureRootStyle = {
  position: "absolute", top: 0, left: "-10000px", visibility: "hidden", pointerEvents: "none", zIndex: -1,
} satisfies React.CSSProperties;

// ═══════════════════════════════════════
// CV Render Components
// ═══════════════════════════════════════

function SectionTitle({ children, marginTop = "6mm" }: { children: string; marginTop?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "3mm", marginTop, marginBottom: "3mm" }}>
      <div style={{
        fontFamily: '"Myriad Pro Light", "Arial Narrow", "Avenir Next Condensed", "Helvetica Neue", Arial, sans-serif',
        fontSize: "13.1pt", fontWeight: 700, letterSpacing: "0.012em",
        textTransform: "uppercase", color: "#101010", whiteSpace: "nowrap",
      }}>{children}</div>
      <div style={{ flex: 1, height: "1px", background: "#bfc2c5" }} />
    </div>
  );
}

function CvSidebar({ sections, transparentBackground = false }: { sections: SidebarSection[]; transparentBackground?: boolean }) {
  return (
    <div style={{ ...leftRailStyle, background: transparentBackground ? "transparent" : leftRailStyle.background }}>
      {sections.map((section) => (
        <div key={section.heading} style={{ marginBottom: "5.8mm" }}>
          <div style={{
            fontWeight: 800, fontSize: "11.3pt", textTransform: "uppercase", letterSpacing: "0.04em",
            marginBottom: "2.2mm", color: "#fff",
            fontFamily: '"Myriad Pro Light", "Avenir Next Condensed", "Helvetica Neue", Arial, sans-serif',
          }}>{section.heading}</div>
          {section.items.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: "1.8mm", marginBottom: "1.05mm" }}>
              <span style={{ flexShrink: 0, color: "rgba(255,255,255,0.7)" }}>•</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptySidebar({ imageUrl, initials }: { imageUrl?: string; initials?: string }) {
  return (
    <div style={{ background: "#000", position: "relative" }}>
      <div style={{
        position: "absolute", top: mm(CV_LAYOUT.hero.topRowHeightMm), left: 0,
        width: mm(CV_LAYOUT.sidebarWidthMm), height: mm(CV_LAYOUT.hero.grayBandHeightMm), background: "#f2f2f2",
      }} />
      <Portrait topMm={CV_LAYOUT.hero.continuationPortraitTopMm} imageUrl={imageUrl} initials={initials} />
    </div>
  );
}

function LogoMark() {
  return <img src="/STACQ_logo.png" alt="STACQ" style={{ width: mm(39.3), display: "block", filter: "brightness(0) invert(1)" }} />;
}

function Portrait({ topMm: topVal, imageUrl, initials }: { topMm: number; imageUrl?: string; initials?: string }) {
  return (
    <div style={{
      position: "absolute", top: mm(topVal), left: mm(CV_LAYOUT.hero.portraitLeftMm),
      width: mm(CV_LAYOUT.hero.portraitWidthMm), height: mm(CV_LAYOUT.hero.portraitHeightMm),
      overflow: "hidden", background: "#333", zIndex: 2,
    }}>
      {imageUrl ? (
        <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 11%", display: "block" }} />
      ) : (
        <div style={{
          width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "24pt", fontWeight: 700, color: "rgba(255,255,255,0.5)", background: "#555",
        }}>{initials || "?"}</div>
      )}
    </div>
  );
}

function ContactBlock({ contact }: { contact: HeroContact }) {
  return (
    <div style={{
      position: "absolute", top: 0, right: mm(CV_LAYOUT.hero.contactRightMm),
      height: mm(CV_LAYOUT.hero.contactHeightMm), display: "flex", alignItems: "center", zIndex: 2,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: px(12), fontFamily: '"Verdana", Arial, sans-serif' }}>
        <div style={{
          width: "1.15px", height: mm(CV_LAYOUT.hero.contactSeparatorHeightMm),
          marginTop: mm(CV_LAYOUT.hero.contactSeparatorOffsetMm), background: "#d5d5d5", flexShrink: 0,
        }} />
        <div style={{ width: mm(CV_LAYOUT.hero.contactWidthMm), fontSize: pt(9.3), lineHeight: 1.28, color: "#848484" }}>
          <div style={{ fontWeight: 700, fontSize: pt(9.4), color: "#767676", marginBottom: "0.7mm" }}>{contact.title}</div>
          <div style={{ color: "#7e7e7e" }}>{contact.name}</div>
          <div style={{ whiteSpace: "nowrap" }}>{contact.phone}</div>
          <div style={{ whiteSpace: "nowrap" }}>{contact.email}</div>
        </div>
      </div>
    </div>
  );
}

function ProjectBlock({ company, subtitle, role, period, paragraphs, technologies }: ProjectEntry) {
  return (
    <div className="cv-project-block" style={{ marginBottom: "6.4mm" }}>
      <div style={{ fontWeight: 700, fontSize: "9.9pt", color: "#111", letterSpacing: "0.006em", marginBottom: "1.8mm" }}>{company}</div>
      <div style={{ fontWeight: 600, fontSize: "9.6pt", marginBottom: "2.9mm", color: "#242424", lineHeight: 1.28 }}>{subtitle}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "6mm", fontSize: "8.8pt", color: "#666", marginBottom: "3.1mm" }}>
        <span style={{ color: "#4f4f4f" }}>{role}</span>
        <span style={{ flexShrink: 0, color: "#4f4f4f" }}>{period}</span>
      </div>
      {paragraphs.map((p, i) => <p key={i} style={{ margin: "0 0 2.35mm 0", lineHeight: 1.36 }}>{p}</p>)}
      <p style={{ margin: "1.2mm 0 0 0", lineHeight: 1.42, color: "#1f1f1f" }}><strong>Teknologier:</strong> {technologies}</p>
    </div>
  );
}

function TimelineRow({ period, primary, secondary, marginBottom = "2.5mm" }: { period: string; primary: string; secondary?: string; marginBottom?: string }) {
  return (
    <div style={{ display: "flex", gap: "7mm", marginBottom, alignItems: "flex-start" }}>
      <span style={{ minWidth: "29mm", flexShrink: 0, color: "#3d3d3d", fontSize: "9.4pt", lineHeight: 1.3, fontVariantNumeric: "tabular-nums", letterSpacing: "0.01em" }}>{period}</span>
      <span style={{ display: "flex", flexDirection: "column", gap: "0.55mm" }}>
        <span style={{ fontSize: "9.8pt", lineHeight: 1.28, color: "#202020", fontWeight: 600 }}>{primary}</span>
        {secondary && <span style={{ fontSize: "9.2pt", lineHeight: 1.28, color: "#555" }}>{secondary}</span>}
      </span>
    </div>
  );
}

function EducationSection({ education, marginTop = "6mm" }: { education: TimelineEntry[]; marginTop?: string }) {
  return (
    <>
      <SectionTitle marginTop={marginTop}>Utdannelse</SectionTitle>
      {education.map((e, i) => <TimelineRow key={i} period={e.period} primary={e.primary} secondary={e.secondary} marginBottom="3.4mm" />)}
    </>
  );
}

function WorkExperienceSection({ workExperience, marginTop = "6mm" }: { workExperience: TimelineEntry[]; marginTop?: string }) {
  return (
    <>
      <SectionTitle marginTop={marginTop}>Arbeidserfaring</SectionTitle>
      {workExperience.map((e, i) => <TimelineRow key={i} period={e.period} primary={e.primary} marginBottom="2.6mm" />)}
    </>
  );
}

function ContinuationPage({ pageProjects, sections, doc, imageUrl, initials }: {
  pageProjects: ProjectEntry[]; sections: ContinuationSectionId[]; doc: CVDocument; imageUrl?: string; initials?: string;
}) {
  return (
    <div className="cv-page" style={pageStyle}>
      <div style={gridStyle}>
        <EmptySidebar imageUrl={imageUrl} initials={initials} />
        <div style={continuationMainStyle}>
          {pageProjects.length > 0 && (
            <>
              <SectionTitle marginTop="0">Prosjekter</SectionTitle>
              {pageProjects.map((p) => <ProjectBlock key={getProjectKey(p)} {...p} />)}
            </>
          )}
          {sections.map((s, i) => {
            const mt = pageProjects.length > 0 || i > 0 ? "6mm" : "0";
            if (s === "education") return <EducationSection key={s} education={doc.education} marginTop={mt} />;
            return <WorkExperienceSection key={s} workExperience={doc.workExperience} marginTop={mt} />;
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Print dialog
// ═══════════════════════════════════════

async function openPrintDialog(documentTitle?: string) {
  const sourceRoot = document.querySelector(".cv-print-root") as HTMLElement | null;
  if (!sourceRoot) return;
  const clonedRoot = sourceRoot.cloneNode(true) as HTMLElement;
  Array.from(clonedRoot.querySelectorAll<HTMLImageElement>("img")).forEach((img) => {
    const rawSrc = img.getAttribute("src") ?? img.src;
    img.src = new URL(rawSrc, window.location.href).toString();
  });
  const printFrame = document.createElement("iframe");
  printFrame.setAttribute("aria-hidden", "true");
  Object.assign(printFrame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0", opacity: "0", pointerEvents: "none" });
  document.body.appendChild(printFrame);
  const pw = printFrame.contentWindow, pd = printFrame.contentDocument;
  if (!pw || !pd) { printFrame.remove(); return; }
  pd.open();
  pd.write(`<!doctype html><html lang="no"><head><meta charset="utf-8"/><title>${documentTitle || CV_PRINT.documentTitle}</title><style>${PRINT_DOCUMENT_CSS}</style></head><body>${clonedRoot.outerHTML}</body></html>`);
  pd.close();
  const imgs = Array.from(pd.querySelectorAll<HTMLImageElement>("img"));
  const imgP = imgs.map((img) => new Promise<void>((r) => { if (img.complete) { r(); return; } const d = () => { img.removeEventListener("load", d); img.removeEventListener("error", d); r(); }; img.addEventListener("load", d); img.addEventListener("error", d); }));
  await Promise.all([waitForFontsReady(pd), ...imgP]);
  await waitForDoubleFrame(pw);
  const cleanup = () => { pw.removeEventListener("afterprint", cleanup); printFrame.remove(); };
  pw.focus(); pw.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(cleanup, 60000); pw.print();
}

// ═══════════════════════════════════════
// Editor helpers
// ═══════════════════════════════════════

const EMPTY_CV: CVDocument = {
  hero: { name: "", title: "", contact: { title: "Kontaktperson", name: "Jon Richard Nygaard", phone: "932 87 267", email: "jr@stacq.no" } },
  sidebarSections: [], introParagraphs: [], competenceGroups: [], projects: [], education: [], workExperience: [],
};

function dbRowToCvDoc(row: any): CVDocument {
  return {
    hero: {
      name: row.hero_name || "", title: row.hero_title || "",
      contact: { title: "Kontaktperson", name: "Jon Richard Nygaard", phone: "932 87 267", email: "jr@stacq.no" },
    },
    sidebarSections: row.sidebar_sections || [],
    introParagraphs: row.intro_paragraphs || [],
    competenceGroups: row.competence_groups || [],
    projects: row.projects || [],
    education: row.education || [],
    workExperience: row.work_experience || [],
  };
}

function cvDocToDbRow(doc: CVDocument) {
  return {
    hero_name: doc.hero.name, hero_title: doc.hero.title,
    intro_paragraphs: doc.introParagraphs, competence_groups: doc.competenceGroups,
    projects: doc.projects, education: doc.education,
    work_experience: doc.workExperience, sidebar_sections: doc.sidebarSections,
    updated_at: new Date().toISOString(),
  };
}

const LABEL = "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-1">
      <button {...attributes} {...listeners} className="mt-3 p-1 cursor-grab text-muted-foreground hover:text-foreground shrink-0">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function getInitials(name: string) {
  return name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

// ═══════════════════════════════════════
// Main Component
// ═══════════════════════════════════════

export default function CvAdmin() {
  const { ansattId } = useParams<{ ansattId: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [cvData, setCvData] = useState<CVDocument | null>(null);
  const [cvId, setCvId] = useState<string | null>(null);
  const [ansattName, setAnsattName] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(0.5);

  // Collapsible sections state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    profil: true, kompetanse: false, sidebar: false, prosjekter: false, utdannelse: false, arbeidserfaring: false,
  });
  const toggleSection = (key: string) => setOpenSections(p => ({ ...p, [key]: !p[key] }));

  // Pagination state
  const [continuationPages, setContinuationPages] = useState<ContinuationPageModel[]>([]);
  const measureCapacityRef = useRef<HTMLDivElement | null>(null);
  const projectsTitleMeasureRef = useRef<HTMLDivElement | null>(null);
  const educationTopMeasureRef = useRef<HTMLDivElement | null>(null);
  const educationAfterMeasureRef = useRef<HTMLDivElement | null>(null);
  const workTopMeasureRef = useRef<HTMLDivElement | null>(null);
  const workAfterMeasureRef = useRef<HTMLDivElement | null>(null);
  const projectMeasureRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Load data
  useEffect(() => {
    if (!ansattId || !user) return;
    const id = parseInt(ansattId);
    if (isNaN(id)) return;

    (async () => {
      const { data: ansatt } = await supabase.from("stacq_ansatte").select("navn, bilde_url").eq("id", id).single();
      if (ansatt) {
        setAnsattName(ansatt.navn);
        if (ansatt.bilde_url) setImageUrl(ansatt.bilde_url);
      }
      let { data: cvRow } = await supabase.from("cv_documents").select("*").eq("ansatt_id", id).single();
      if (!cvRow) {
        const newDoc = { ansatt_id: id, hero_name: ansatt?.navn || "", hero_title: "", ...cvDocToDbRow(EMPTY_CV) };
        const { data: inserted } = await supabase.from("cv_documents").insert(newDoc).select().single();
        cvRow = inserted;
      }
      if (cvRow) {
        setCvId(cvRow.id);
        setCvData(dbRowToCvDoc(cvRow));
      }
    })();
  }, [ansattId, user]);

  // Preview scale
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width || 600;
      setPreviewScale(Math.min((width - 32) / 793, 1));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [cvData]);

  // Pagination
  useEffect(() => {
    if (!cvData) return;
    let cancelled = false;
    const updatePagination = async () => {
      await waitForFontsReady(document);
      await waitForDoubleFrame(window);
      if (cancelled) return;
      const mc = measureCapacityRef.current, pt2 = projectsTitleMeasureRef.current;
      const et = educationTopMeasureRef.current, ea = educationAfterMeasureRef.current;
      const wt = workTopMeasureRef.current, wa = workAfterMeasureRef.current;
      if (!mc || !pt2 || !et || !ea || !wt || !wa) return;
      const pageH = mc.getBoundingClientRect().height;
      const mmToPx = pageH / 297;
      const bb = Math.max(CONTINUATION_BOTTOM_BUFFER_MM, 0) * mmToPx;
      const ph = cvData.projects.map(p => measureOuterHeight(projectMeasureRefs.current[getProjectKey(p)]));
      const next = buildContinuationPages({
        allProjects: cvData.projects, projectHeights: ph,
        projectsTitleHeight: measureOuterHeight(pt2),
        educationTopHeight: measureOuterHeight(et), educationAfterHeight: measureOuterHeight(ea),
        workTopHeight: measureOuterHeight(wt), workAfterHeight: measureOuterHeight(wa),
        availableHeight: mc.clientHeight, bottomBuffer: bb,
      });
      if (!cancelled) setContinuationPages(curr => JSON.stringify(curr) === JSON.stringify(next) ? curr : next);
    };
    updatePagination();
    window.addEventListener("resize", updatePagination);
    return () => { cancelled = true; window.removeEventListener("resize", updatePagination); };
  }, [cvData]);

  // Autosave
  const autosave = useCallback(async (newDoc: CVDocument) => {
    if (!cvId) return;
    setSaveStatus("saving");
    try {
      await supabase.from("cv_documents").update(cvDocToDbRow(newDoc) as any).eq("id", cvId);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("idle");
    }
  }, [cvId]);

  const update = useCallback((updater: (prev: CVDocument) => CVDocument) => {
    setCvData((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => autosave(next), 2000);
      return next;
    });
  }, [autosave]);

  const setHero = (key: string, val: string) => update(p => ({ ...p, hero: { ...p.hero, [key]: val } }));
  const setHeroContact = (key: string, val: string) => update(p => ({ ...p, hero: { ...p.hero, contact: { ...p.hero.contact, [key]: val } } }));

  const handleProjectDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    update(prev => {
      const oi = prev.projects.findIndex((_, i) => `project-${i}` === active.id);
      const ni = prev.projects.findIndex((_, i) => `project-${i}` === over.id);
      return { ...prev, projects: arrayMove(prev.projects, oi, ni) };
    });
  };

  const handleCompetenceDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    update(prev => {
      const oi = prev.competenceGroups.findIndex((_, i) => `comp-${i}` === active.id);
      const ni = prev.competenceGroups.findIndex((_, i) => `comp-${i}` === over.id);
      return { ...prev, competenceGroups: arrayMove(prev.competenceGroups, oi, ni) };
    });
  };

  // Version history
  const loadVersions = async () => {
    if (!cvId) return;
    const { data } = await supabase.from("cv_versions").select("*").eq("cv_id", cvId).order("created_at", { ascending: false });
    setVersions(data || []);
    setVersionsOpen(true);
  };

  const restoreVersion = (snapshot: any) => {
    setCvData(dbRowToCvDoc(snapshot));
    setVersionsOpen(false);
    toast.info("Versjon gjenopprettet — husk å lagre");
  };

  // Download PDF + save version
  const handleDownloadPdf = async () => {
    if (cvId && cvData) {
      await supabase.from("cv_versions").insert({ cv_id: cvId, snapshot: cvDocToDbRow(cvData) as any, saved_by: "crm" });
    }
    openPrintDialog(cvData?.hero.name ? `${cvData.hero.name.replace(/\s+/g, "_")}_CV` : "CV");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Laster...</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!cvData) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Laster CV...</p></div>;

  const initials = getInitials(ansattName || cvData.hero.name || "");
  const { hero, sidebarSections, introParagraphs, competenceGroups, projects, education, workExperience } = cvData;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* TOP BAR */}
      <div className="shrink-0 border-b border-border bg-background px-4 py-2 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/konsulenter/ansatte")} className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[0.8125rem]">
            <ArrowLeft className="h-3.5 w-3.5" /> Tilbake
          </button>
          <span className="text-[0.8125rem] font-bold text-foreground">{ansattName || "CV"} — CV</span>
          <div className="flex items-center gap-1.5 text-[0.75rem]">
            {saveStatus === "saving" && <><Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /><span className="text-muted-foreground">Lagrer...</span></>}
            {saveStatus === "saved" && <><Check className="h-3 w-3 text-emerald-600" /><span className="text-emerald-600">Lagret</span></>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={loadVersions}>
            <History className="h-3.5 w-3.5 mr-1" /> Versjonshistorikk
          </Button>
          <Button size="sm" onClick={handleDownloadPdf}>
            <Download className="h-3.5 w-3.5 mr-1" /> Last ned PDF
          </Button>
        </div>
      </div>

      {/* TWO PANEL LAYOUT */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT — Editor 55% */}
        <div className="w-[55%] shrink-0 overflow-y-auto bg-background border-r border-border">
          <div className="p-4 space-y-1">
            {/* PROFIL */}
            <CollapsibleSection title="PROFIL" isOpen={openSections.profil} onToggle={() => toggleSection("profil")}>
              <div className="space-y-3">
                <Field label="Navn"><Input value={hero.name} onChange={e => setHero("name", e.target.value)} className="text-[0.875rem]" /></Field>
                <Field label="Tittel / ingress"><Input value={hero.title} onChange={e => setHero("title", e.target.value)} className="text-[0.875rem]" /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Kontaktperson navn"><Input value={hero.contact.name} onChange={e => setHeroContact("name", e.target.value)} className="text-[0.875rem]" /></Field>
                  <Field label="Kontaktperson tittel"><Input value={hero.contact.title} onChange={e => setHeroContact("title", e.target.value)} className="text-[0.875rem]" /></Field>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Telefon"><Input value={hero.contact.phone} onChange={e => setHeroContact("phone", e.target.value)} className="text-[0.875rem]" /></Field>
                  <Field label="Epost"><Input value={hero.contact.email} onChange={e => setHeroContact("email", e.target.value)} className="text-[0.875rem]" /></Field>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className={LABEL}>Intro-avsnitt</span>
                    <button onClick={() => update(p => ({ ...p, introParagraphs: [...p.introParagraphs, ""] }))}
                      className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5">
                      <Plus className="h-3 w-3" /> Legg til
                    </button>
                  </div>
                  {introParagraphs.map((para, i) => (
                    <div key={i} className="flex gap-1 mb-2">
                      <Textarea value={para} rows={3} onChange={e => update(p => { const a = [...p.introParagraphs]; a[i] = e.target.value; return { ...p, introParagraphs: a }; })} className="text-[0.8125rem]" />
                      <button onClick={() => update(p => ({ ...p, introParagraphs: p.introParagraphs.filter((_, j) => j !== i) }))} className="text-muted-foreground hover:text-destructive shrink-0 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleSection>

            {/* KOMPETANSEGRUPPER */}
            <CollapsibleSection title="KOMPETANSEGRUPPER" isOpen={openSections.kompetanse} onToggle={() => toggleSection("kompetanse")}>
              <div className="space-y-2">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCompetenceDragEnd}>
                  <SortableContext items={competenceGroups.map((_, i) => `comp-${i}`)} strategy={verticalListSortingStrategy}>
                    {competenceGroups.map((g, i) => (
                      <SortableItem key={`comp-${i}`} id={`comp-${i}`}>
                        <div className="border border-border rounded-lg p-3 bg-card space-y-2">
                          <div className="flex items-center gap-2">
                            <Input value={g.label} placeholder="Label" onChange={e => update(p => { const a = [...p.competenceGroups]; a[i] = { ...a[i], label: e.target.value }; return { ...p, competenceGroups: a }; })} className="text-[0.8125rem] font-medium" />
                            <button onClick={() => update(p => ({ ...p, competenceGroups: p.competenceGroups.filter((_, j) => j !== i) }))} className="text-muted-foreground hover:text-destructive shrink-0 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                          <Textarea value={g.content} rows={2} onChange={e => update(p => { const a = [...p.competenceGroups]; a[i] = { ...a[i], content: e.target.value }; return { ...p, competenceGroups: a }; })} className="text-[0.8125rem]" />
                        </div>
                      </SortableItem>
                    ))}
                  </SortableContext>
                </DndContext>
                <button onClick={() => update(p => ({ ...p, competenceGroups: [...p.competenceGroups, { label: "", content: "" }] }))} className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5"><Plus className="h-3 w-3" /> Ny gruppe</button>
              </div>
            </CollapsibleSection>

            {/* SIDEBAR */}
            <CollapsibleSection title="SIDEBAR" isOpen={openSections.sidebar} onToggle={() => toggleSection("sidebar")}>
              <div className="space-y-3">
                {sidebarSections.map((s, si) => (
                  <div key={si} className="border border-border rounded-lg p-3 bg-card space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={s.heading} placeholder="Overskrift" onChange={e => update(p => { const a = [...p.sidebarSections]; a[si] = { ...a[si], heading: e.target.value }; return { ...p, sidebarSections: a }; })} className="text-[0.8125rem] font-medium" />
                      <button onClick={() => update(p => ({ ...p, sidebarSections: p.sidebarSections.filter((_, j) => j !== si) }))} className="text-muted-foreground hover:text-destructive shrink-0 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    {s.items.map((item, ii) => (
                      <div key={ii} className="flex gap-1">
                        <Input value={item} onChange={e => update(p => { const a = [...p.sidebarSections]; const items = [...a[si].items]; items[ii] = e.target.value; a[si] = { ...a[si], items }; return { ...p, sidebarSections: a }; })} className="text-[0.8125rem]" />
                        <button onClick={() => update(p => { const a = [...p.sidebarSections]; a[si] = { ...a[si], items: a[si].items.filter((_, j) => j !== ii) }; return { ...p, sidebarSections: a }; })} className="text-muted-foreground hover:text-destructive shrink-0 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                    <button onClick={() => update(p => { const a = [...p.sidebarSections]; a[si] = { ...a[si], items: [...a[si].items, ""] }; return { ...p, sidebarSections: a }; })} className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5"><Plus className="h-3 w-3" /> Legg til punkt</button>
                  </div>
                ))}
                <button onClick={() => update(p => ({ ...p, sidebarSections: [...p.sidebarSections, { heading: "", items: [""] }] }))} className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5"><Plus className="h-3 w-3" /> Ny seksjon</button>
              </div>
            </CollapsibleSection>

            {/* PROSJEKTER */}
            <CollapsibleSection title="PROSJEKTER" isOpen={openSections.prosjekter} onToggle={() => toggleSection("prosjekter")}>
              <div className="space-y-2">
                <button onClick={() => update(p => ({ ...p, projects: [{ company: "", subtitle: "", role: "", period: "", paragraphs: [""], technologies: "" }, ...p.projects] }))} className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5 mb-2"><Plus className="h-3 w-3" /> Nytt prosjekt</button>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleProjectDragEnd}>
                  <SortableContext items={projects.map((_, i) => `project-${i}`)} strategy={verticalListSortingStrategy}>
                    {projects.map((proj, i) => (
                      <SortableItem key={`project-${i}`} id={`project-${i}`}>
                        <ProjectEditor project={proj} index={i} update={update} />
                      </SortableItem>
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            </CollapsibleSection>

            {/* UTDANNELSE */}
            <CollapsibleSection title="UTDANNELSE" isOpen={openSections.utdannelse} onToggle={() => toggleSection("utdannelse")}>
              <div className="space-y-2">
                {education.map((e, i) => (
                  <div key={i} className="border border-border rounded-lg p-3 bg-card space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={e.period} placeholder="Periode" onChange={ev => update(p => { const a = [...p.education]; a[i] = { ...a[i], period: ev.target.value }; return { ...p, education: a }; })} className="text-[0.8125rem] w-32" />
                      <Input value={e.primary} placeholder="Grad / tittel" onChange={ev => update(p => { const a = [...p.education]; a[i] = { ...a[i], primary: ev.target.value }; return { ...p, education: a }; })} className="text-[0.8125rem] flex-1" />
                      <button onClick={() => update(p => ({ ...p, education: p.education.filter((_, j) => j !== i) }))} className="text-muted-foreground hover:text-destructive shrink-0 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    <Input value={e.secondary || ""} placeholder="Detaljer (valgfritt)" onChange={ev => update(p => { const a = [...p.education]; a[i] = { ...a[i], secondary: ev.target.value }; return { ...p, education: a }; })} className="text-[0.8125rem]" />
                  </div>
                ))}
                <button onClick={() => update(p => ({ ...p, education: [...p.education, { period: "", primary: "", secondary: "" }] }))} className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5"><Plus className="h-3 w-3" /> Legg til</button>
              </div>
            </CollapsibleSection>

            {/* ARBEIDSERFARING */}
            <CollapsibleSection title="ARBEIDSERFARING" isOpen={openSections.arbeidserfaring} onToggle={() => toggleSection("arbeidserfaring")}>
              <div className="space-y-2">
                {workExperience.map((e, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={e.period} placeholder="Periode" onChange={ev => update(p => { const a = [...p.workExperience]; a[i] = { ...a[i], period: ev.target.value }; return { ...p, workExperience: a }; })} className="text-[0.8125rem] w-32" />
                    <Input value={e.primary} placeholder="Selskap" onChange={ev => update(p => { const a = [...p.workExperience]; a[i] = { ...a[i], primary: ev.target.value }; return { ...p, workExperience: a }; })} className="text-[0.8125rem] flex-1" />
                    <button onClick={() => update(p => ({ ...p, workExperience: p.workExperience.filter((_, j) => j !== i) }))} className="text-muted-foreground hover:text-destructive shrink-0 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                <button onClick={() => update(p => ({ ...p, workExperience: [...p.workExperience, { period: "", primary: "" }] }))} className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5"><Plus className="h-3 w-3" /> Legg til</button>
              </div>
            </CollapsibleSection>
          </div>
        </div>

        {/* RIGHT — Preview 45% */}
        <div ref={previewContainerRef} className="w-[45%] overflow-y-auto p-4" style={{ background: "#d7d7d7" }}>
          <div style={{ transform: `scale(${previewScale})`, transformOrigin: "top left", width: `${100 / previewScale}%` }}>
            {/* Hidden measure elements */}
            <div aria-hidden="true" className="no-print" style={hiddenMeasureRootStyle}>
              <div style={{ width: mm(CV_LAYOUT.pageWidthMm), display: "grid", gridTemplateColumns: `${mm(CV_LAYOUT.sidebarWidthMm)} 1fr`, height: mm(CV_LAYOUT.pageHeightMm) }}>
                <div />
                <div ref={measureCapacityRef} style={continuationMainStyle} />
              </div>
              <div style={continuationMeasureContentStyle}>
                <div ref={projectsTitleMeasureRef} style={{ display: "flow-root" }}><SectionTitle marginTop="0">Prosjekter</SectionTitle></div>
                {projects.map((p) => (
                  <div key={`measure-${getProjectKey(p)}`} style={{ display: "flow-root" }} ref={(el) => { projectMeasureRefs.current[getProjectKey(p)] = el; }}>
                    <ProjectBlock {...p} />
                  </div>
                ))}
                <div ref={educationTopMeasureRef} style={{ display: "flow-root" }}><EducationSection education={education} marginTop="0" /></div>
                <div ref={educationAfterMeasureRef} style={{ display: "flow-root" }}><EducationSection education={education} marginTop="6mm" /></div>
                <div ref={workTopMeasureRef} style={{ display: "flow-root" }}><WorkExperienceSection workExperience={workExperience} marginTop="0" /></div>
                <div ref={workAfterMeasureRef} style={{ display: "flow-root" }}><WorkExperienceSection workExperience={workExperience} marginTop="6mm" /></div>
              </div>
            </div>

            {/* Visible pages */}
            <div className="cv-print-root">
              <div className="cv-pages" style={{ fontFamily: '"Calibri", "Carlito", Arial, sans-serif', display: "flex", flexDirection: "column", gap: px(CV_LAYOUT.screen.pageGapPx) }}>
                {/* First page */}
                <div className="cv-page cv-document" style={pageStyle}>
                  <div style={firstPageGridStyle}>
                    <div style={{ gridColumn: "1 / -1", gridRow: 1, position: "relative", overflow: "hidden", background: "transparent", zIndex: 1 }}>
                      <div style={{ position: "absolute", top: 0, left: mm(CV_LAYOUT.sidebarWidthMm), right: 0, height: mm(CV_LAYOUT.hero.topRowHeightMm), background: "#fff" }} />
                      <div style={{ position: "absolute", top: mm(CV_LAYOUT.hero.topRowHeightMm), left: 0, right: 0, height: mm(CV_LAYOUT.hero.grayBandHeightMm), background: "#f2f2f2" }} />
                      <div style={{ position: "absolute", top: 0, left: 0, width: mm(CV_LAYOUT.sidebarWidthMm), height: mm(CV_LAYOUT.hero.logoBoxHeightMm) }}>
                        <div style={{ width: mm(CV_LAYOUT.sidebarWidthMm), height: mm(CV_LAYOUT.hero.logoBoxHeightMm), display: "flex", justifyContent: "center", alignItems: "center" }}>
                          <LogoMark />
                        </div>
                      </div>
                      <Portrait topMm={CV_LAYOUT.hero.firstPagePortraitTopMm} imageUrl={imageUrl} initials={initials} />
                      <ContactBlock contact={hero.contact} />
                      <div style={{
                        position: "absolute", top: mm(CV_LAYOUT.hero.textTopMm), left: mm(CV_LAYOUT.hero.textLeftMm),
                        width: mm(CV_LAYOUT.hero.textWidthMm), display: "flex", flexDirection: "column", justifyContent: "flex-start", zIndex: 2,
                      }}>
                        <div style={{ fontFamily: '"Carlito", "Calibri", Arial, sans-serif', fontSize: "32.3pt", fontWeight: 700, letterSpacing: "-0.014em", lineHeight: 0.99, color: "#000" }}>{hero.name}</div>
                        <div style={{ fontFamily: '"Raleway", "Helvetica Neue", Arial, sans-serif', fontSize: "11.2pt", fontWeight: 500, marginTop: "3.3mm", letterSpacing: "0.05em", color: "#383838" }}>{hero.title}</div>
                      </div>
                    </div>
                    <div style={{ gridColumn: 1, gridRow: "1 / -1", background: "#000", zIndex: 0 }} />
                    <div style={{ gridColumn: 1, gridRow: 2, position: "relative", zIndex: 1 }}>
                      <CvSidebar sections={sidebarSections} transparentBackground />
                    </div>
                    <div style={{ ...mainStyle, gridColumn: 2, gridRow: 2 }}>
                      {introParagraphs.map((p, i) => <p key={i} style={{ margin: "0 0 3mm 0" }}>{p}</p>)}
                      {competenceGroups.map((g, i) => <p key={i} style={{ margin: "0 0 2.5mm 0" }}><strong>{g.label}:</strong> {g.content}</p>)}
                    </div>
                  </div>
                </div>

                {continuationPages.map(page => (
                  <ContinuationPage key={page.key} pageProjects={page.projects} sections={page.sections} doc={cvData} imageUrl={imageUrl} initials={initials} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Version history sheet */}
      <Sheet open={versionsOpen} onOpenChange={setVersionsOpen}>
        <SheetContent side="right" className="w-full sm:w-[400px] max-w-[400px]">
          <h3 className="text-lg font-bold mb-4">Versjonshistorikk</h3>
          <div className="space-y-3 overflow-y-auto">
            {versions.length === 0 && <p className="text-sm text-muted-foreground">Ingen versjoner lagret ennå.</p>}
            {versions.map((v) => (
              <div key={v.id} className="border border-border rounded-lg p-3 bg-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {format(new Date(v.created_at), "dd.MM.yyyy HH:mm", { locale: nb })}
                    </p>
                    <p className="text-xs text-muted-foreground">Lagret av: {v.saved_by || "ukjent"}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => restoreVersion(v.snapshot)}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Gjenopprett
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ═══════════════════════════════════════
// Sub-components for editor
// ═══════════════════════════════════════

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function CollapsibleSection({ title, isOpen, onToggle, children }: {
  title: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2.5 text-[0.8125rem] font-bold uppercase tracking-wide text-foreground hover:text-foreground/80">
        {title}
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 pb-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ProjectEditor({ project, index, update }: {
  project: ProjectEntry; index: number;
  update: (updater: (prev: CVDocument) => CVDocument) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border border-border rounded-lg bg-card">
        <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-[0.8125rem] font-medium text-left">
          <span className="truncate">{project.company || "Nytt prosjekt"} {project.period && <span className="text-muted-foreground">({project.period})</span>}</span>
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3 pb-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Selskap"><Input value={project.company} onChange={e => update(p => { const a = [...p.projects]; a[index] = { ...a[index], company: e.target.value }; return { ...p, projects: a }; })} className="text-[0.8125rem]" /></Field>
            <Field label="Periode"><Input value={project.period} onChange={e => update(p => { const a = [...p.projects]; a[index] = { ...a[index], period: e.target.value }; return { ...p, projects: a }; })} className="text-[0.8125rem]" /></Field>
          </div>
          <Field label="Undertittel"><Input value={project.subtitle} onChange={e => update(p => { const a = [...p.projects]; a[index] = { ...a[index], subtitle: e.target.value }; return { ...p, projects: a }; })} className="text-[0.8125rem]" /></Field>
          <Field label="Rolle"><Input value={project.role} onChange={e => update(p => { const a = [...p.projects]; a[index] = { ...a[index], role: e.target.value }; return { ...p, projects: a }; })} className="text-[0.8125rem]" /></Field>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className={LABEL}>Avsnitt</span>
              <button onClick={() => update(p => { const a = [...p.projects]; a[index] = { ...a[index], paragraphs: [...a[index].paragraphs, ""] }; return { ...p, projects: a }; })} className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5"><Plus className="h-3 w-3" /> Legg til</button>
            </div>
            {project.paragraphs.map((para, pi) => (
              <div key={pi} className="flex gap-1 mb-2">
                <Textarea value={para} rows={3} onChange={e => update(p => { const a = [...p.projects]; const ps = [...a[index].paragraphs]; ps[pi] = e.target.value; a[index] = { ...a[index], paragraphs: ps }; return { ...p, projects: a }; })} className="text-[0.8125rem]" />
                <button onClick={() => update(p => { const a = [...p.projects]; a[index] = { ...a[index], paragraphs: a[index].paragraphs.filter((_, j) => j !== pi) }; return { ...p, projects: a }; })} className="text-muted-foreground hover:text-destructive shrink-0 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
          <Field label="Teknologier"><Textarea value={project.technologies} rows={2} onChange={e => update(p => { const a = [...p.projects]; a[index] = { ...a[index], technologies: e.target.value }; return { ...p, projects: a }; })} className="text-[0.8125rem]" /></Field>
          <button onClick={() => update(p => ({ ...p, projects: p.projects.filter((_, j) => j !== index) }))} className="text-destructive text-[0.75rem] font-medium hover:underline flex items-center gap-0.5 mt-2"><Trash2 className="h-3 w-3" /> Slett prosjekt</button>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
