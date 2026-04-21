import type { CVDocument, HeroContact } from "@/components/cv/CvRenderer";
import { normalizeProjectsSectionTitle } from "@/lib/cvProjectsTitle";

type SnapshotLike = Record<string, unknown> | null | undefined;

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function snapshotToCvDocument(row: SnapshotLike, fallbackContact: HeroContact): CVDocument {
  return {
    hero: {
      name: typeof row?.hero_name === "string" ? row.hero_name : "",
      title: typeof row?.hero_title === "string" ? row.hero_title : "",
      contact: fallbackContact,
      portrait_url: typeof row?.portrait_url === "string" ? row.portrait_url : undefined,
      portrait_position: typeof row?.portrait_position === "string" ? row.portrait_position : "50% 50%",
    },
    sidebarSections: asArray(row?.sidebar_sections),
    introParagraphs: asArray(row?.intro_paragraphs),
    competenceGroups: asArray(row?.competence_groups),
    projectsTitle: normalizeProjectsSectionTitle(row?.title),
    projects: asArray(row?.projects),
    additionalSections: asArray(row?.additional_sections),
    education: asArray(row?.education),
    workExperience: asArray(row?.work_experience),
  };
}

export function cvDocumentToSnapshot(doc: CVDocument) {
  return {
    hero_name: doc.hero.name,
    hero_title: doc.hero.title,
    portrait_url: doc.hero.portrait_url || null,
    portrait_position: doc.hero.portrait_position || "50% 50%",
    intro_paragraphs: doc.introParagraphs,
    competence_groups: doc.competenceGroups,
    title: normalizeProjectsSectionTitle(doc.projectsTitle) || null,
    projects: doc.projects,
    additional_sections: doc.additionalSections,
    education: doc.education,
    work_experience: doc.workExperience,
    sidebar_sections: doc.sidebarSections,
    updated_at: new Date().toISOString(),
  };
}

export function hasCvDocumentContent(doc: CVDocument) {
  return Boolean(
    doc.hero.name.trim() ||
      doc.hero.title.trim() ||
      doc.sidebarSections.some((section) => section.heading.trim() || section.items.some((item) => item.trim())) ||
      doc.introParagraphs.some((paragraph) => paragraph.trim()) ||
      doc.competenceGroups.some((group) => group.label.trim() || group.content.trim()) ||
      doc.projects.length ||
      doc.additionalSections.length ||
      doc.education.length ||
      doc.workExperience.length,
  );
}
