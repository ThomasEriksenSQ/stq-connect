import { useState, useEffect, useRef, useCallback } from "react";
import { CvRendererPreview, openCvPrintDialog, type CVDocument, type ProjectEntry, type CompetenceGroup, type TimelineEntry, type SidebarSection } from "./CvRenderer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Trash2, GripVertical, Download, Check, Loader2 } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface CvEditorPanelProps {
  cvData: CVDocument;
  onSave: (data: CVDocument, savedBy: string) => Promise<void>;
  savedBy: string;
  imageUrl?: string;
}

type SaveStatus = "idle" | "saving" | "saved";

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

const LABEL = "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

export function CvEditorPanel({ cvData: initialData, onSave, savedBy, imageUrl }: CvEditorPanelProps) {
  const [doc, setDoc] = useState<CVDocument>(initialData);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(0.5);

  // Sync if initialData changes externally (e.g. version restore)
  useEffect(() => {
    setDoc(initialData);
  }, [initialData]);

  // Compute preview scale
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width || 600;
      // A4 in mm = 210mm, in px at 96dpi ≈ 793px
      setPreviewScale(Math.min(width / 793, 1));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Autosave debounce
  const scheduleAutosave = useCallback((newDoc: CVDocument) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await onSave(newDoc, savedBy);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("idle");
      }
    }, 2000);
  }, [onSave, savedBy]);

  const update = useCallback((updater: (prev: CVDocument) => CVDocument) => {
    setDoc((prev) => {
      const next = updater(prev);
      scheduleAutosave(next);
      return next;
    });
  }, [scheduleAutosave]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleProjectDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    update((prev) => {
      const oldIndex = prev.projects.findIndex((_, i) => `project-${i}` === active.id);
      const newIndex = prev.projects.findIndex((_, i) => `project-${i}` === over.id);
      return { ...prev, projects: arrayMove(prev.projects, oldIndex, newIndex) };
    });
  };

  const handleCompetenceDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    update((prev) => {
      const oldIndex = prev.competenceGroups.findIndex((_, i) => `comp-${i}` === active.id);
      const newIndex = prev.competenceGroups.findIndex((_, i) => `comp-${i}` === over.id);
      return { ...prev, competenceGroups: arrayMove(prev.competenceGroups, oldIndex, newIndex) };
    });
  };

  const setHero = (key: string, val: string) => update((p) => ({ ...p, hero: { ...p.hero, [key]: val } }));
  const setHeroContact = (key: string, val: string) => update((p) => ({
    ...p, hero: { ...p.hero, contact: { ...p.hero.contact, [key]: val } }
  }));

  return (
    <div className="flex h-full bg-background">
      {/* LEFT PANEL — Editor */}
      <div className="w-[480px] shrink-0 border-r border-border overflow-y-auto">
        {/* Save status bar */}
        <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[0.8125rem]">
            {saveStatus === "saving" && <><Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /><span className="text-muted-foreground">Lagrer...</span></>}
            {saveStatus === "saved" && <><Check className="h-3.5 w-3.5 text-emerald-600" /><span className="text-emerald-600">Lagret</span></>}
            {saveStatus === "idle" && <span className="text-muted-foreground">CV Editor</span>}
          </div>
          <Button size="sm" variant="outline" onClick={() => openCvPrintDialog(doc.hero.name ? `${doc.hero.name}_CV` : "CV")}>
            <Download className="h-3.5 w-3.5 mr-1" /> Last ned PDF
          </Button>
        </div>

        <div className="p-4 space-y-1">
          <Accordion type="multiple" defaultValue={["profil", "prosjekter"]} className="space-y-0">
            {/* PROFIL */}
            <AccordionItem value="profil">
              <AccordionTrigger className="text-[0.8125rem] font-bold uppercase tracking-wide">Profil</AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                <div>
                  <label className={LABEL}>Navn</label>
                  <Input value={doc.hero.name} onChange={(e) => setHero("name", e.target.value)} className="mt-1 text-[0.875rem]" />
                </div>
                <div>
                  <label className={LABEL}>Tittel / ingress</label>
                  <Input value={doc.hero.title} onChange={(e) => setHero("title", e.target.value)} className="mt-1 text-[0.875rem]" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={LABEL}>Kontaktperson</label>
                    <Input value={doc.hero.contact.name} onChange={(e) => setHeroContact("name", e.target.value)} className="mt-1 text-[0.875rem]" />
                  </div>
                  <div>
                    <label className={LABEL}>Tittel</label>
                    <Input value={doc.hero.contact.title} onChange={(e) => setHeroContact("title", e.target.value)} className="mt-1 text-[0.875rem]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={LABEL}>Telefon</label>
                    <Input value={doc.hero.contact.phone} onChange={(e) => setHeroContact("phone", e.target.value)} className="mt-1 text-[0.875rem]" />
                  </div>
                  <div>
                    <label className={LABEL}>Epost</label>
                    <Input value={doc.hero.contact.email} onChange={(e) => setHeroContact("email", e.target.value)} className="mt-1 text-[0.875rem]" />
                  </div>
                </div>

                {/* Intro paragraphs */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={LABEL}>Intro-avsnitt</label>
                    <button onClick={() => update((p) => ({ ...p, introParagraphs: [...p.introParagraphs, ""] }))}
                      className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5">
                      <Plus className="h-3 w-3" /> Legg til
                    </button>
                  </div>
                  {doc.introParagraphs.map((para, i) => (
                    <div key={i} className="flex gap-1 mb-2">
                      <Textarea value={para} rows={3}
                        onChange={(e) => update((p) => {
                          const arr = [...p.introParagraphs];
                          arr[i] = e.target.value;
                          return { ...p, introParagraphs: arr };
                        })}
                        className="text-[0.8125rem]" />
                      <button onClick={() => update((p) => ({ ...p, introParagraphs: p.introParagraphs.filter((_, j) => j !== i) }))}
                        className="text-muted-foreground hover:text-destructive shrink-0 p-1">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* KOMPETANSEGRUPPER */}
            <AccordionItem value="kompetanse">
              <AccordionTrigger className="text-[0.8125rem] font-bold uppercase tracking-wide">Kompetansegrupper</AccordionTrigger>
              <AccordionContent className="space-y-2 pt-2">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCompetenceDragEnd}>
                  <SortableContext items={doc.competenceGroups.map((_, i) => `comp-${i}`)} strategy={verticalListSortingStrategy}>
                    {doc.competenceGroups.map((group, i) => (
                      <SortableItem key={`comp-${i}`} id={`comp-${i}`}>
                        <div className="border border-border rounded-lg p-3 bg-card space-y-2">
                          <div className="flex items-center gap-2">
                            <Input value={group.label} placeholder="Label"
                              onChange={(e) => update((p) => {
                                const arr = [...p.competenceGroups];
                                arr[i] = { ...arr[i], label: e.target.value };
                                return { ...p, competenceGroups: arr };
                              })}
                              className="text-[0.8125rem] font-medium" />
                            <button onClick={() => update((p) => ({ ...p, competenceGroups: p.competenceGroups.filter((_, j) => j !== i) }))}
                              className="text-muted-foreground hover:text-destructive shrink-0 p-1">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <Textarea value={group.content} rows={2}
                            onChange={(e) => update((p) => {
                              const arr = [...p.competenceGroups];
                              arr[i] = { ...arr[i], content: e.target.value };
                              return { ...p, competenceGroups: arr };
                            })}
                            className="text-[0.8125rem]" />
                        </div>
                      </SortableItem>
                    ))}
                  </SortableContext>
                </DndContext>
                <button onClick={() => update((p) => ({ ...p, competenceGroups: [...p.competenceGroups, { label: "", content: "" }] }))}
                  className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5">
                  <Plus className="h-3 w-3" /> Ny gruppe
                </button>
              </AccordionContent>
            </AccordionItem>

            {/* PROSJEKTER */}
            <AccordionItem value="prosjekter">
              <AccordionTrigger className="text-[0.8125rem] font-bold uppercase tracking-wide">Prosjekter</AccordionTrigger>
              <AccordionContent className="space-y-2 pt-2">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleProjectDragEnd}>
                  <SortableContext items={doc.projects.map((_, i) => `project-${i}`)} strategy={verticalListSortingStrategy}>
                    {doc.projects.map((project, i) => (
                      <SortableItem key={`project-${i}`} id={`project-${i}`}>
                        <Accordion type="single" collapsible>
                          <AccordionItem value={`proj-${i}`} className="border border-border rounded-lg bg-card">
                            <AccordionTrigger className="px-3 py-2 text-[0.8125rem] font-medium">
                              {project.company || "Nytt prosjekt"} {project.period && `(${project.period})`}
                            </AccordionTrigger>
                            <AccordionContent className="px-3 pb-3 space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className={LABEL}>Selskap</label>
                                  <Input value={project.company}
                                    onChange={(e) => update((p) => {
                                      const arr = [...p.projects]; arr[i] = { ...arr[i], company: e.target.value };
                                      return { ...p, projects: arr };
                                    })}
                                    className="mt-1 text-[0.8125rem]" />
                                </div>
                                <div>
                                  <label className={LABEL}>Periode</label>
                                  <Input value={project.period}
                                    onChange={(e) => update((p) => {
                                      const arr = [...p.projects]; arr[i] = { ...arr[i], period: e.target.value };
                                      return { ...p, projects: arr };
                                    })}
                                    className="mt-1 text-[0.8125rem]" />
                                </div>
                              </div>
                              <div>
                                <label className={LABEL}>Undertittel</label>
                                <Input value={project.subtitle}
                                  onChange={(e) => update((p) => {
                                    const arr = [...p.projects]; arr[i] = { ...arr[i], subtitle: e.target.value };
                                    return { ...p, projects: arr };
                                  })}
                                  className="mt-1 text-[0.8125rem]" />
                              </div>
                              <div>
                                <label className={LABEL}>Rolle</label>
                                <Input value={project.role}
                                  onChange={(e) => update((p) => {
                                    const arr = [...p.projects]; arr[i] = { ...arr[i], role: e.target.value };
                                    return { ...p, projects: arr };
                                  })}
                                  className="mt-1 text-[0.8125rem]" />
                              </div>
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className={LABEL}>Avsnitt</label>
                                  <button onClick={() => update((p) => {
                                    const arr = [...p.projects];
                                    arr[i] = { ...arr[i], paragraphs: [...arr[i].paragraphs, ""] };
                                    return { ...p, projects: arr };
                                  })}
                                    className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5">
                                    <Plus className="h-3 w-3" /> Legg til
                                  </button>
                                </div>
                                {project.paragraphs.map((para, pi) => (
                                  <div key={pi} className="flex gap-1 mb-2">
                                    <Textarea value={para} rows={3}
                                      onChange={(e) => update((p) => {
                                        const arr = [...p.projects];
                                        const paras = [...arr[i].paragraphs];
                                        paras[pi] = e.target.value;
                                        arr[i] = { ...arr[i], paragraphs: paras };
                                        return { ...p, projects: arr };
                                      })}
                                      className="text-[0.8125rem]" />
                                    <button onClick={() => update((p) => {
                                      const arr = [...p.projects];
                                      arr[i] = { ...arr[i], paragraphs: arr[i].paragraphs.filter((_, j) => j !== pi) };
                                      return { ...p, projects: arr };
                                    })}
                                      className="text-muted-foreground hover:text-destructive shrink-0 p-1">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <div>
                                <label className={LABEL}>Teknologier</label>
                                <Textarea value={project.technologies} rows={2}
                                  onChange={(e) => update((p) => {
                                    const arr = [...p.projects]; arr[i] = { ...arr[i], technologies: e.target.value };
                                    return { ...p, projects: arr };
                                  })}
                                  className="mt-1 text-[0.8125rem]" />
                              </div>
                              <button onClick={() => update((p) => ({ ...p, projects: p.projects.filter((_, j) => j !== i) }))}
                                className="text-destructive text-[0.75rem] font-medium hover:underline flex items-center gap-0.5 mt-2">
                                <Trash2 className="h-3 w-3" /> Slett prosjekt
                              </button>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </SortableItem>
                    ))}
                  </SortableContext>
                </DndContext>
                <button onClick={() => update((p) => ({
                  ...p, projects: [...p.projects, { company: "", subtitle: "", role: "", period: "", paragraphs: [""], technologies: "" }]
                }))}
                  className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5">
                  <Plus className="h-3 w-3" /> Nytt prosjekt
                </button>
              </AccordionContent>
            </AccordionItem>

            {/* UTDANNELSE */}
            <AccordionItem value="utdannelse">
              <AccordionTrigger className="text-[0.8125rem] font-bold uppercase tracking-wide">Utdannelse</AccordionTrigger>
              <AccordionContent className="space-y-2 pt-2">
                {doc.education.map((entry, i) => (
                  <div key={i} className="border border-border rounded-lg p-3 bg-card space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={entry.period} placeholder="Periode"
                        onChange={(e) => update((p) => {
                          const arr = [...p.education]; arr[i] = { ...arr[i], period: e.target.value };
                          return { ...p, education: arr };
                        })}
                        className="text-[0.8125rem] w-32" />
                      <Input value={entry.primary} placeholder="Grad / tittel"
                        onChange={(e) => update((p) => {
                          const arr = [...p.education]; arr[i] = { ...arr[i], primary: e.target.value };
                          return { ...p, education: arr };
                        })}
                        className="text-[0.8125rem] flex-1" />
                      <button onClick={() => update((p) => ({ ...p, education: p.education.filter((_, j) => j !== i) }))}
                        className="text-muted-foreground hover:text-destructive shrink-0 p-1">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Input value={entry.secondary || ""} placeholder="Detaljer (valgfritt)"
                      onChange={(e) => update((p) => {
                        const arr = [...p.education]; arr[i] = { ...arr[i], secondary: e.target.value };
                        return { ...p, education: arr };
                      })}
                      className="text-[0.8125rem]" />
                  </div>
                ))}
                <button onClick={() => update((p) => ({ ...p, education: [...p.education, { period: "", primary: "", secondary: "" }] }))}
                  className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5">
                  <Plus className="h-3 w-3" /> Legg til
                </button>
              </AccordionContent>
            </AccordionItem>

            {/* ARBEIDSERFARING */}
            <AccordionItem value="arbeidserfaring">
              <AccordionTrigger className="text-[0.8125rem] font-bold uppercase tracking-wide">Arbeidserfaring</AccordionTrigger>
              <AccordionContent className="space-y-2 pt-2">
                {doc.workExperience.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={entry.period} placeholder="Periode"
                      onChange={(e) => update((p) => {
                        const arr = [...p.workExperience]; arr[i] = { ...arr[i], period: e.target.value };
                        return { ...p, workExperience: arr };
                      })}
                      className="text-[0.8125rem] w-32" />
                    <Input value={entry.primary} placeholder="Selskap"
                      onChange={(e) => update((p) => {
                        const arr = [...p.workExperience]; arr[i] = { ...arr[i], primary: e.target.value };
                        return { ...p, workExperience: arr };
                      })}
                      className="text-[0.8125rem] flex-1" />
                    <button onClick={() => update((p) => ({ ...p, workExperience: p.workExperience.filter((_, j) => j !== i) }))}
                      className="text-muted-foreground hover:text-destructive shrink-0 p-1">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button onClick={() => update((p) => ({ ...p, workExperience: [...p.workExperience, { period: "", primary: "" }] }))}
                  className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5">
                  <Plus className="h-3 w-3" /> Legg til
                </button>
              </AccordionContent>
            </AccordionItem>

            {/* SIDEBAR */}
            <AccordionItem value="sidebar">
              <AccordionTrigger className="text-[0.8125rem] font-bold uppercase tracking-wide">Sidebar</AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                {doc.sidebarSections.map((section, si) => (
                  <div key={si} className="border border-border rounded-lg p-3 bg-card space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={section.heading} placeholder="Overskrift"
                        onChange={(e) => update((p) => {
                          const arr = [...p.sidebarSections]; arr[si] = { ...arr[si], heading: e.target.value };
                          return { ...p, sidebarSections: arr };
                        })}
                        className="text-[0.8125rem] font-medium" />
                      <button onClick={() => update((p) => ({ ...p, sidebarSections: p.sidebarSections.filter((_, j) => j !== si) }))}
                        className="text-muted-foreground hover:text-destructive shrink-0 p-1">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {section.items.map((item, ii) => (
                      <div key={ii} className="flex gap-1">
                        <Input value={item}
                          onChange={(e) => update((p) => {
                            const arr = [...p.sidebarSections];
                            const items = [...arr[si].items]; items[ii] = e.target.value;
                            arr[si] = { ...arr[si], items };
                            return { ...p, sidebarSections: arr };
                          })}
                          className="text-[0.8125rem]" />
                        <button onClick={() => update((p) => {
                          const arr = [...p.sidebarSections];
                          arr[si] = { ...arr[si], items: arr[si].items.filter((_, j) => j !== ii) };
                          return { ...p, sidebarSections: arr };
                        })}
                          className="text-muted-foreground hover:text-destructive shrink-0 p-1">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => update((p) => {
                      const arr = [...p.sidebarSections];
                      arr[si] = { ...arr[si], items: [...arr[si].items, ""] };
                      return { ...p, sidebarSections: arr };
                    })}
                      className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5">
                      <Plus className="h-3 w-3" /> Legg til punkt
                    </button>
                  </div>
                ))}
                <button onClick={() => update((p) => ({
                  ...p, sidebarSections: [...p.sidebarSections, { heading: "", items: [""] }]
                }))}
                  className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5">
                  <Plus className="h-3 w-3" /> Ny seksjon
                </button>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {/* RIGHT PANEL — Live Preview */}
      <div ref={previewContainerRef} className="flex-1 overflow-y-auto bg-[#d7d7d7] p-4">
        <CvRendererPreview doc={doc} imageUrl={imageUrl} scale={previewScale} />
      </div>
    </div>
  );
}
