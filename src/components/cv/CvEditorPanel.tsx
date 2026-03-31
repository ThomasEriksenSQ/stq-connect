import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
import {
  ADDITIONAL_SECTION_TITLE_OPTIONS,
  CvRendererPreview,
  DEFAULT_ADDITIONAL_SECTION_TITLE,
  openCvPrintDialog,
  formatProjectPeriod,
  PROJECT_MONTH_OPTIONS,
  type CVDocument,
  type AdditionalSection,
  type ProjectEntry,
  type CompetenceGroup,
  type TimelineEntry,
  type SidebarSection,
} from "./CvRenderer";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Trash2, GripVertical, Download, Check, Loader2, Upload, Move } from "lucide-react";
import { toast } from "sonner";
import { getInitials } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface CvEditorPanelProps {
  cvData: CVDocument;
  onSave: (data: CVDocument, savedBy: string) => Promise<void>;
  savedBy: string;
  imageUrl?: string;
  headerLabel?: string;
  toolbarStart?: ReactNode;
  toolbarEnd?: ReactNode;
  onDownloadPdf?: (doc: CVDocument) => Promise<void> | void;
  /** When provided, the internal toolbar is hidden and this render prop is called instead */
  renderToolbar?: (opts: { saveStatus: SaveStatus; onDownload: () => Promise<void> }) => ReactNode;
}

type SaveStatus = "idle" | "saving" | "saved";

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-1">
      <button
        {...attributes}
        {...listeners}
        className="mt-3 p-1 cursor-grab text-muted-foreground hover:text-foreground shrink-0"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

const LABEL = "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";
const CLEAR_SELECT = "__none__";
const CUSTOM_ADDITIONAL_SECTION_TITLE = "__custom__";
const CURRENT_YEAR = new Date().getFullYear();
const PROJECT_YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 1977 }, (_, index) => CURRENT_YEAR + 2 - index);
const CONTACT_PERSON_PRESETS = {
  jon_richard: {
    title: "Kontaktperson",
    name: "Jon Richard Nygaard",
    phone: "932 87 267",
    email: "jr@stacq.no",
  },
  thomas_eriksen: {
    title: "Kontaktperson",
    name: "Thomas Eriksen",
    phone: "97 500 321",
    email: "thomas@stacq.no",
  },
} as const;

function normalizeProjectDateValue(value: string) {
  if (value === CLEAR_SELECT) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function syncProjectPeriod(project: ProjectEntry): ProjectEntry {
  const formattedPeriod = formatProjectPeriod({ ...project, period: "" });
  return { ...project, period: formattedPeriod || project.period || "" };
}

function getSelectedContactPresetId(contact: CVDocument["hero"]["contact"]) {
  const entry = Object.entries(CONTACT_PERSON_PRESETS).find(([, preset]) => {
    return (
      preset.title === contact.title &&
      preset.name === contact.name &&
      preset.phone === contact.phone &&
      preset.email === contact.email
    );
  });

  return entry?.[0] ?? CLEAR_SELECT;
}

function createAdditionalSection(format: AdditionalSection["format"]): AdditionalSection {
  return {
    title: DEFAULT_ADDITIONAL_SECTION_TITLE,
    format,
    items: [{ period: "", primary: "" }],
  };
}

function isPresetAdditionalSectionTitle(title: string) {
  return ADDITIONAL_SECTION_TITLE_OPTIONS.includes(title as (typeof ADDITIONAL_SECTION_TITLE_OPTIONS)[number]);
}

function PortraitFocalPicker({
  imageUrl,
  position,
  onChange,
}: {
  imageUrl: string;
  position: string;
  onChange: (pos: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const [xPct, yPct] = useMemo(() => {
    const parts = position.split(/\s+/).map((s) => parseFloat(s));
    return [isNaN(parts[0]) ? 50 : parts[0], isNaN(parts[1]) ? 50 : parts[1]];
  }, [position]);

  const handlePointer = useCallback(
    (e: React.PointerEvent | PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      onChange(`${Math.round(x)}% ${Math.round(y)}%`);
    },
    [onChange],
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => handlePointer(e);
    const up = () => setDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, handlePointer]);

  return (
    <div className="flex flex-col items-start gap-1">
      <div
        ref={containerRef}
        className="relative w-[160px] h-[100px] rounded-md border border-border overflow-hidden cursor-move select-none"
        onPointerDown={(e) => {
          setDragging(true);
          handlePointer(e);
          e.preventDefault();
        }}
      >
        <img src={imageUrl} alt="" className="w-full h-full object-cover pointer-events-none" draggable={false} />
        {/* Crosshair */}
        <div
          className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md pointer-events-none"
          style={{
            left: `${xPct}%`,
            top: `${yPct}%`,
            background: "rgba(255,255,255,0.3)",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.3)",
          }}
        />
        <Move className="absolute bottom-1 right-1 h-3 w-3 text-white/70 pointer-events-none" />
      </div>
      <span className="text-[0.6875rem] text-muted-foreground">
        Dra for å justere · {Math.round(xPct)}% {Math.round(yPct)}%
      </span>
    </div>
  );
}

export function CvEditorPanel({
  cvData: initialData,
  onSave,
  savedBy,
  imageUrl,
  headerLabel,
  toolbarStart,
  toolbarEnd,
  onDownloadPdf,
  renderToolbar,
}: CvEditorPanelProps) {
  const [doc, setDoc] = useState<CVDocument>(initialData);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [portraitUploading, setPortraitUploading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const splitLayoutRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const portraitInputRef = useRef<HTMLInputElement>(null);
  const [previewScale, setPreviewScale] = useState(0.5);
  const [pendingDeletes, setPendingDeletes] = useState<Record<string, ReturnType<typeof setTimeout>>>({});
  const [editorWidth, setEditorWidth] = useState(480);
  const [isResizingEditor, setIsResizingEditor] = useState(false);
  const [expandedAdditionalSection, setExpandedAdditionalSection] = useState<string>("");
  const resizeBoundsRef = useRef({ right: 0, width: 0 });

  const EDITOR_MIN_WIDTH = 440;
  const EDITOR_MAX_WIDTH = 860;
  const PREVIEW_MIN_WIDTH = 420;

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

  useEffect(() => {
    if (!isResizingEditor) return;

    const handlePointerMove = (event: PointerEvent) => {
      const { right, width } = resizeBoundsRef.current;
      if (width <= 0) return;

      const maxWidth = Math.min(EDITOR_MAX_WIDTH, Math.max(EDITOR_MIN_WIDTH, width - PREVIEW_MIN_WIDTH));
      const nextWidth = Math.max(EDITOR_MIN_WIDTH, Math.min(maxWidth, right - event.clientX));
      setEditorWidth(nextWidth);
    };

    const stopResize = () => {
      setIsResizingEditor(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingEditor]);

  // Autosave debounce
  const scheduleAutosave = useCallback(
    (newDoc: CVDocument) => {
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
    },
    [onSave, savedBy],
  );

  const update = useCallback(
    (updater: (prev: CVDocument) => CVDocument) => {
      setDoc((prev) => {
        const next = updater(prev);
        scheduleAutosave(next);
        return next;
      });
    },
    [scheduleAutosave],
  );

  const scheduleDelete = useCallback(
    (key: string, label: string, applyDelete: (prev: CVDocument) => CVDocument) => {
      const toastId = `delete-${key}-${Date.now()}`;
      let undone = false;

      const timerId = setTimeout(() => {
        if (!undone) {
          update(applyDelete);
        }
        setPendingDeletes((prev) => {
          const next = { ...prev };
          delete next[toastId];
          return next;
        });
      }, 10000);

      setPendingDeletes((prev) => ({ ...prev, [toastId]: timerId }));

      toast(`${label} slettes om 10 sekunder`, {
        id: toastId,
        duration: 10000,
        action: {
          label: "Angre",
          onClick: () => {
            undone = true;
            clearTimeout(timerId);
            setPendingDeletes((prev) => {
              const next = { ...prev };
              delete next[toastId];
              return next;
            });
            toast.dismiss(toastId);
          },
        },
      });
    },
    [update],
  );

  const updateProjectAt = useCallback(
    (projectIndex: number, updater: (project: ProjectEntry) => ProjectEntry) => {
      update((prev) => {
        const projects = [...prev.projects];
        projects[projectIndex] = syncProjectPeriod(updater(projects[projectIndex]));
        return { ...prev, projects };
      });
    },
    [update],
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
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

  const handleAdditionalSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    update((prev) => {
      const oldIndex = prev.additionalSections.findIndex((_, i) => `additional-${i}` === active.id);
      const newIndex = prev.additionalSections.findIndex((_, i) => `additional-${i}` === over.id);
      return { ...prev, additionalSections: arrayMove(prev.additionalSections, oldIndex, newIndex) };
    });
  };

  const setHero = (key: string, val: string) => update((p) => ({ ...p, hero: { ...p.hero, [key]: val } }));
  const setHeroContact = (key: string, val: string) =>
    update((p) => ({
      ...p,
      hero: { ...p.hero, contact: { ...p.hero.contact, [key]: val } },
    }));

  const handlePortraitUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPortraitUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `cv-portraits/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("ansatte-bilder").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("ansatte-bilder").getPublicUrl(path);
      update((p) => ({ ...p, hero: { ...p.hero, portrait_url: urlData.publicUrl } }));
      toast.success("Bilde lastet opp");
    } catch (err: any) {
      toast.error("Kunne ikke laste opp bilde: " + (err.message || "Ukjent feil"));
    } finally {
      setPortraitUploading(false);
      if (portraitInputRef.current) portraitInputRef.current.value = "";
    }
  };

  const handleDownloadClick = async () => {
    if (onDownloadPdf) {
      await onDownloadPdf(doc);
      return;
    }

    await openCvPrintDialog(doc.hero.name ? `CV - ${doc.hero.name} - STACQ` : "CV - STACQ");
  };

  const handleResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = splitLayoutRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    resizeBoundsRef.current = { right: rect.right, width: rect.width };
    setIsResizingEditor(true);
    event.preventDefault();
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* External toolbar if provided */}
      {renderToolbar ? (
        renderToolbar({ saveStatus, onDownload: handleDownloadClick })
      ) : (
        <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[0.8125rem]">
            {toolbarStart}
            {saveStatus === "saving" && (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Lagrer...</span>
              </>
            )}
            {saveStatus === "saved" && (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-600">Lagret</span>
              </>
            )}
            {saveStatus === "idle" && <span className="text-muted-foreground">{headerLabel || "CV Editor"}</span>}
          </div>
          <div className="flex items-center gap-2">
            {toolbarEnd}
            <Button size="sm" variant="outline" onClick={handleDownloadClick}>
              <Download className="h-3.5 w-3.5 mr-1" /> Last ned PDF
            </Button>
          </div>
        </div>
      )}

      <div ref={splitLayoutRef} className="flex flex-1 min-h-0">
        {/* LEFT PANEL — Live Preview */}
        <div ref={previewContainerRef} className="flex-1 min-w-0 overflow-y-auto bg-[#d7d7d7] p-4">
          <CvRendererPreview doc={doc} imageUrl={doc.hero.portrait_url || imageUrl} scale={previewScale} />
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Juster bredde på editor"
          onPointerDown={handleResizeStart}
          className={`shrink-0 w-2 cursor-col-resize touch-none transition-colors ${
            isResizingEditor ? "bg-border" : "bg-transparent hover:bg-border/70"
          }`}
        />

        {/* RIGHT PANEL — Editor */}
        <div
          style={{ width: `${editorWidth}px` }}
          className="shrink-0 border-l border-border overflow-y-auto bg-background"
        >
          <div className="p-4 space-y-1">
            <Accordion type="multiple" defaultValue={["profil", "prosjekter"]} className="space-y-0">
              {/* PROFIL */}
              <AccordionItem value="profil">
                <AccordionTrigger className="text-[0.8125rem] font-bold uppercase tracking-wide">
                  Profil
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div>
                    <label className={LABEL}>Navn</label>
                    <Input
                      value={doc.hero.name}
                      onChange={(e) => setHero("name", e.target.value)}
                      className="mt-1 text-[0.875rem]"
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Profilbilde</label>
                    <div className="flex flex-col gap-2 mt-1">
                      <button
                        onClick={() => portraitInputRef.current?.click()}
                        disabled={portraitUploading}
                        className="inline-flex items-center gap-1.5 h-8 px-3 text-[0.75rem] font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 self-start"
                      >
                        {portraitUploading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        {portraitUploading ? "Laster opp..." : "Last opp bilde"}
                      </button>
                      <input
                        ref={portraitInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePortraitUpload}
                      />
                      {doc.hero.portrait_url && (
                        <PortraitFocalPicker
                          imageUrl={doc.hero.portrait_url}
                          position={doc.hero.portrait_position || "50% 50%"}
                          onChange={(pos) => update((p) => ({ ...p, hero: { ...p.hero, portrait_position: pos } }))}
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className={LABEL}>Tittel / ingress</label>
                    <Input
                      value={doc.hero.title}
                      onChange={(e) => setHero("title", e.target.value)}
                      className="mt-1 text-[0.875rem]"
                    />
                  </div>
                  {/* Intro paragraphs */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={LABEL}>Intro-avsnitt</label>
                      <button
                        onClick={() => update((p) => ({ ...p, introParagraphs: [...p.introParagraphs, ""] }))}
                        className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5"
                      >
                        <Plus className="h-3 w-3" /> Legg til
                      </button>
                    </div>
                    {doc.introParagraphs.map((para, i) => (
                      <div key={i} className="flex gap-1 mb-2">
                        <Textarea
                          value={para}
                          rows={3}
                          onChange={(e) =>
                            update((p) => {
                              const arr = [...p.introParagraphs];
                              arr[i] = e.target.value;
                              return { ...p, introParagraphs: arr };
                            })
                          }
                          className="text-[0.8125rem]"
                        />
                        <button
                          onClick={() =>
                            scheduleDelete(`intro-${i}`, "Intro-avsnitt", (p) => ({
                              ...p,
                              introParagraphs: p.introParagraphs.filter((_, j) => j !== i),
                            }))
                          }
                          className="text-muted-foreground hover:text-destructive shrink-0 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* KOMPETANSEGRUPPER */}
              <AccordionItem value="kompetanse">
                <AccordionTrigger className="text-[0.8125rem] font-bold uppercase tracking-wide">
                  Kompetansegrupper
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pt-2">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCompetenceDragEnd}>
                    <SortableContext
                      items={doc.competenceGroups.map((_, i) => `comp-${i}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      {doc.competenceGroups.map((group, i) => (
                        <SortableItem key={`comp-${i}`} id={`comp-${i}`}>
                          <div className="border border-border rounded-lg p-3 bg-card space-y-2">
                            <div className="flex items-center gap-2">
                              <Input
                                value={group.label}
                                placeholder="Label"
                                onChange={(e) =>
                                  update((p) => {
                                    const arr = [...p.competenceGroups];
                                    arr[i] = { ...arr[i], label: e.target.value };
                                    return { ...p, competenceGroups: arr };
                                  })
                                }
                                className="text-[0.8125rem] font-medium"
                              />
                              <button
                                onClick={() =>
                                  scheduleDelete(
                                    `comp-${i}`,
                                    `Kompetansegruppe "${doc.competenceGroups[i]?.label || i + 1}"`,
                                    (p) => ({ ...p, competenceGroups: p.competenceGroups.filter((_, j) => j !== i) }),
                                  )
                                }
                                className="text-muted-foreground hover:text-destructive shrink-0 p-1"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <Textarea
                              value={group.content}
                              rows={2}
                              onChange={(e) =>
                                update((p) => {
                                  const arr = [...p.competenceGroups];
                                  arr[i] = { ...arr[i], content: e.target.value };
                                  return { ...p, competenceGroups: arr };
                                })
                              }
                              className="text-[0.8125rem]"
                            />
                          </div>
                        </SortableItem>
                      ))}
                    </SortableContext>
                  </DndContext>
                  <button
                    onClick={() =>
                      update((p) => ({ ...p, competenceGroups: [...p.competenceGroups, { label: "", content: "" }] }))
                    }
                    className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="h-3 w-3" /> Ny gruppe
                  </button>
                </AccordionContent>
              </AccordionItem>

              {/* PROSJEKTER */}
              <AccordionItem value="prosjekter">
                <AccordionTrigger className="text-[0.8125rem] font-bold uppercase tracking-wide">
                  Prosjekter
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pt-2">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleProjectDragEnd}>
                    <SortableContext
                      items={doc.projects.map((_, i) => `project-${i}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      {doc.projects.map((project, i) => {
                        const projectPeriodLabel = formatProjectPeriod(project);

                        return (
                          <SortableItem key={`project-${i}`} id={`project-${i}`}>
                            <Accordion type="single" collapsible>
                              <AccordionItem value={`proj-${i}`} className="border border-border rounded-lg bg-card">
                                <AccordionTrigger className="px-3 py-2 text-[0.8125rem] font-medium">
                                  {project.company || "Nytt prosjekt"} {projectPeriodLabel && `(${projectPeriodLabel})`}
                                </AccordionTrigger>
                                <AccordionContent className="px-3 pb-3 space-y-2">
                                  <div>
                                    <label className={LABEL}>Selskap</label>
                                    <Input
                                      value={project.company}
                                      onChange={(e) =>
                                        updateProjectAt(i, (current) => ({ ...current, company: e.target.value }))
                                      }
                                      className="mt-1 text-[0.8125rem]"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                      <label className={LABEL}>Fra</label>
                                      <div className="grid grid-cols-2 gap-2">
                                        <Select
                                          value={project.startMonth ? String(project.startMonth) : undefined}
                                          onValueChange={(value) =>
                                            updateProjectAt(i, (current) => ({
                                              ...current,
                                              startMonth: normalizeProjectDateValue(value),
                                            }))
                                          }
                                        >
                                          <SelectTrigger className="h-10 text-[0.8125rem]">
                                            <SelectValue placeholder="Måned" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value={CLEAR_SELECT}>Ingen</SelectItem>
                                            {PROJECT_MONTH_OPTIONS.map((month) => (
                                              <SelectItem key={month.value} value={String(month.value)}>
                                                {month.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Select
                                          value={project.startYear ? String(project.startYear) : undefined}
                                          onValueChange={(value) =>
                                            updateProjectAt(i, (current) => ({
                                              ...current,
                                              startYear: normalizeProjectDateValue(value),
                                            }))
                                          }
                                        >
                                          <SelectTrigger className="h-10 text-[0.8125rem]">
                                            <SelectValue placeholder="År" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value={CLEAR_SELECT}>Ingen</SelectItem>
                                            {PROJECT_YEAR_OPTIONS.map((year) => (
                                              <SelectItem key={year} value={String(year)}>
                                                {year}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <label className={LABEL}>Til</label>
                                      <div className="grid grid-cols-2 gap-2">
                                        <Select
                                          value={
                                            project.isCurrent
                                              ? CLEAR_SELECT
                                              : project.endMonth
                                                ? String(project.endMonth)
                                                : CLEAR_SELECT
                                          }
                                          onValueChange={(value) =>
                                            updateProjectAt(i, (current) => ({
                                              ...current,
                                              isCurrent: false,
                                              endMonth: normalizeProjectDateValue(value),
                                            }))
                                          }
                                          disabled={Boolean(project.isCurrent)}
                                        >
                                          <SelectTrigger className="h-10 text-[0.8125rem]">
                                            <SelectValue placeholder="Måned" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value={CLEAR_SELECT}>Ingen</SelectItem>
                                            {PROJECT_MONTH_OPTIONS.map((month) => (
                                              <SelectItem key={month.value} value={String(month.value)}>
                                                {month.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Select
                                          value={
                                            project.isCurrent
                                              ? CLEAR_SELECT
                                              : project.endYear
                                                ? String(project.endYear)
                                                : CLEAR_SELECT
                                          }
                                          onValueChange={(value) =>
                                            updateProjectAt(i, (current) => ({
                                              ...current,
                                              isCurrent: false,
                                              endYear: normalizeProjectDateValue(value),
                                            }))
                                          }
                                          disabled={Boolean(project.isCurrent)}
                                        >
                                          <SelectTrigger className="h-10 text-[0.8125rem]">
                                            <SelectValue placeholder="År" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value={CLEAR_SELECT}>Ingen</SelectItem>
                                            {PROJECT_YEAR_OPTIONS.map((year) => (
                                              <SelectItem key={year} value={String(year)}>
                                                {year}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                                        <div className="text-[0.75rem] font-medium text-foreground">Nåværende</div>
                                        <Switch
                                          checked={Boolean(project.isCurrent)}
                                          onCheckedChange={(checked) =>
                                            updateProjectAt(i, (current) => ({
                                              ...current,
                                              isCurrent: checked,
                                              endMonth: checked ? null : current.endMonth,
                                              endYear: checked ? null : current.endYear,
                                            }))
                                          }
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  {!project.startMonth &&
                                  !project.startYear &&
                                  !project.endMonth &&
                                  !project.endYear &&
                                  !project.isCurrent &&
                                  project.period ? (
                                    <p className="text-[0.6875rem] text-muted-foreground">
                                      Eksisterende periode: {project.period}. Velg{" "}
                                      <span className="font-medium">Fra</span> og{" "}
                                      <span className="font-medium">Til</span> for å strukturere den.
                                    </p>
                                  ) : null}
                                  <div>
                                    <label className={LABEL}>Undertittel</label>
                                    <Input
                                      value={project.subtitle}
                                      onChange={(e) =>
                                        updateProjectAt(i, (current) => ({ ...current, subtitle: e.target.value }))
                                      }
                                      className="mt-1 text-[0.8125rem]"
                                    />
                                  </div>
                                  <div>
                                    <label className={LABEL}>Rolle</label>
                                    <Input
                                      value={project.role}
                                      onChange={(e) =>
                                        updateProjectAt(i, (current) => ({ ...current, role: e.target.value }))
                                      }
                                      className="mt-1 text-[0.8125rem]"
                                    />
                                  </div>
                                  <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                                    <div>
                                      <div className="text-[0.75rem] font-medium text-foreground">
                                        Start prosjekt på ny side
                                      </div>
                                      <div className="text-[0.6875rem] text-muted-foreground">
                                        Valgfri override hvis dette prosjektet skal starte på neste side.
                                      </div>
                                    </div>
                                    <Switch
                                      checked={Boolean(project.pageBreakBefore)}
                                      onCheckedChange={(checked) =>
                                        updateProjectAt(i, (current) => ({ ...current, pageBreakBefore: checked }))
                                      }
                                    />
                                  </div>
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <label className={LABEL}>Avsnitt</label>
                                      <button
                                        onClick={() =>
                                          update((p) => {
                                            const arr = [...p.projects];
                                            arr[i] = { ...arr[i], paragraphs: [...arr[i].paragraphs, ""] };
                                            return { ...p, projects: arr };
                                          })
                                        }
                                        className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5"
                                      >
                                        <Plus className="h-3 w-3" /> Legg til
                                      </button>
                                    </div>
                                    {project.paragraphs.map((para, pi) => (
                                      <div key={pi} className="flex gap-1 mb-2">
                                        <Textarea
                                          value={para}
                                          rows={3}
                                          onChange={(e) =>
                                            update((p) => {
                                              const arr = [...p.projects];
                                              const paras = [...arr[i].paragraphs];
                                              paras[pi] = e.target.value;
                                              arr[i] = { ...arr[i], paragraphs: paras };
                                              return { ...p, projects: arr };
                                            })
                                          }
                                          className="text-[0.8125rem]"
                                        />
                                        <button
                                          onClick={() =>
                                            scheduleDelete(`proj-${i}-para-${pi}`, "Avsnitt", (p) => {
                                              const arr = [...p.projects];
                                              arr[i] = {
                                                ...arr[i],
                                                paragraphs: arr[i].paragraphs.filter((_, j) => j !== pi),
                                              };
                                              return { ...p, projects: arr };
                                            })
                                          }
                                          className="text-muted-foreground hover:text-destructive shrink-0 p-1"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                  <div>
                                    <label className={LABEL}>Teknologier</label>
                                    <Textarea
                                      value={project.technologies}
                                      rows={2}
                                      onChange={(e) =>
                                        updateProjectAt(i, (current) => ({ ...current, technologies: e.target.value }))
                                      }
                                      className="mt-1 text-[0.8125rem]"
                                    />
                                  </div>
                                  <button
                                    onClick={() =>
                                      scheduleDelete(
                                        `project-${i}`,
                                        `Prosjekt "${doc.projects[i]?.company || "Uten navn"}"`,
                                        (p) => ({ ...p, projects: p.projects.filter((_, j) => j !== i) }),
                                      )
                                    }
                                    className="text-destructive text-[0.75rem] font-medium hover:underline flex items-center gap-0.5 mt-2"
                                  >
                                    <Trash2 className="h-3 w-3" /> Slett prosjekt
                                  </button>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </SortableItem>
                        );
                      })}
                    </SortableContext>
                  </DndContext>
                  <button
                    onClick={() =>
                      update((p) => ({
                        ...p,
                        projects: [
                          ...p.projects,
                          {
                            company: "",
                            subtitle: "",
                            role: "",
                            period: "",
                            startMonth: null,
                            startYear: null,
                            endMonth: null,
                            endYear: null,
                            isCurrent: false,
                            paragraphs: [""],
                            technologies: "",
                            pageBreakBefore: false,
                          },
                        ],
                      }))
                    }
                    className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="h-3 w-3" /> Nytt prosjekt
                  </button>
                </AccordionContent>
              </AccordionItem>

              {/* EKSTRA HOVEDSEKSJONER */}
              <AccordionItem value="additional-sections">
                <AccordionTrigger className="text-[0.8125rem] font-bold uppercase tracking-wide">
                  Ekstra hovedseksjoner
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pt-2">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleAdditionalSectionDragEnd}
                  >
                    <SortableContext
                      items={doc.additionalSections.map((_, i) => `additional-${i}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      {doc.additionalSections.map((section, i) => (
                        <SortableItem key={`additional-${i}`} id={`additional-${i}`}>
                          <Accordion
                            type="single"
                            collapsible
                            value={
                              expandedAdditionalSection === `additional-section-${i}` ? expandedAdditionalSection : ""
                            }
                            onValueChange={(value) => setExpandedAdditionalSection(value)}
                          >
                            <AccordionItem
                              value={`additional-section-${i}`}
                              className="border border-border rounded-lg bg-card"
                            >
                              <AccordionTrigger className="px-3 py-2 text-[0.8125rem] font-medium">
                                {section.title}
                              </AccordionTrigger>
                              <AccordionContent className="px-3 pb-3 space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className={LABEL}>Hovedseksjon</label>
                                    <Select
                                      value={
                                        isPresetAdditionalSectionTitle(section.title)
                                          ? section.title
                                          : CUSTOM_ADDITIONAL_SECTION_TITLE
                                      }
                                      onValueChange={(value) =>
                                        update((p) => {
                                          const arr = [...p.additionalSections];
                                          arr[i] = {
                                            ...arr[i],
                                            title:
                                              value === CUSTOM_ADDITIONAL_SECTION_TITLE
                                                ? arr[i].title || DEFAULT_ADDITIONAL_SECTION_TITLE
                                                : value,
                                          };
                                          return { ...p, additionalSections: arr };
                                        })
                                      }
                                    >
                                      <SelectTrigger className="mt-1 h-10 text-[0.8125rem]">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {ADDITIONAL_SECTION_TITLE_OPTIONS.map((option) => (
                                          <SelectItem key={option} value={option}>
                                            {option}
                                          </SelectItem>
                                        ))}
                                        <SelectItem value={CUSTOM_ADDITIONAL_SECTION_TITLE}>Egendefinert</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Input
                                      value={section.title}
                                      placeholder="Seksjonstittel"
                                      onChange={(e) =>
                                        update((p) => {
                                          const arr = [...p.additionalSections];
                                          arr[i] = {
                                            ...arr[i],
                                            title: e.target.value,
                                          };
                                          return { ...p, additionalSections: arr };
                                        })
                                      }
                                      className="mt-2 text-[0.8125rem]"
                                    />
                                  </div>
                                  <div>
                                    <label className={LABEL}>Format</label>
                                    <Select
                                      value={section.format}
                                      onValueChange={(value) =>
                                        update((p) => {
                                          const arr = [...p.additionalSections];
                                          arr[i] = {
                                            ...arr[i],
                                            format: value as AdditionalSection["format"],
                                          };
                                          return { ...p, additionalSections: arr };
                                        })
                                      }
                                    >
                                      <SelectTrigger className="mt-1 h-10 text-[0.8125rem]">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="timeline">Dato</SelectItem>
                                        <SelectItem value="bullet">Punktliste</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className={LABEL}>Rader</label>
                                    <button
                                      onClick={() =>
                                        update((p) => {
                                          const arr = [...p.additionalSections];
                                          arr[i] = {
                                            ...arr[i],
                                            items: [...arr[i].items, { period: "", primary: "" }],
                                          };
                                          return { ...p, additionalSections: arr };
                                        })
                                      }
                                      className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5"
                                    >
                                      <Plus className="h-3 w-3" /> Legg til
                                    </button>
                                  </div>

                                  {section.items.map((item, itemIndex) => (
                                    <div key={`${i}-${itemIndex}`} className="mb-2 rounded-lg border border-border p-2">
                                      {section.format === "timeline" ? (
                                        <div className="flex items-start gap-2">
                                          <Input
                                            value={item.period}
                                            placeholder="Periode"
                                            onChange={(e) =>
                                              update((p) => {
                                                const arr = [...p.additionalSections];
                                                const items = [...arr[i].items];
                                                items[itemIndex] = { ...items[itemIndex], period: e.target.value };
                                                arr[i] = { ...arr[i], items };
                                                return { ...p, additionalSections: arr };
                                              })
                                            }
                                            className="text-[0.8125rem] w-36"
                                          />
                                          <Input
                                            value={item.primary}
                                            placeholder="Tekst"
                                            onChange={(e) =>
                                              update((p) => {
                                                const arr = [...p.additionalSections];
                                                const items = [...arr[i].items];
                                                items[itemIndex] = { ...items[itemIndex], primary: e.target.value };
                                                arr[i] = { ...arr[i], items };
                                                return { ...p, additionalSections: arr };
                                              })
                                            }
                                            className="text-[0.8125rem] flex-1"
                                          />
                                          <button
                                            onClick={() =>
                                              scheduleDelete(`additional-${i}-item-${itemIndex}`, "Rad", (p) => {
                                                const arr = [...p.additionalSections];
                                                arr[i] = {
                                                  ...arr[i],
                                                  items: arr[i].items.filter((_, j) => j !== itemIndex),
                                                };
                                                return { ...p, additionalSections: arr };
                                              })
                                            }
                                            className="text-muted-foreground hover:text-destructive shrink-0 p-1"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-start gap-2">
                                          <Input
                                            value={item.primary}
                                            placeholder="Tekst"
                                            onChange={(e) =>
                                              update((p) => {
                                                const arr = [...p.additionalSections];
                                                const items = [...arr[i].items];
                                                items[itemIndex] = { ...items[itemIndex], primary: e.target.value };
                                                arr[i] = { ...arr[i], items };
                                                return { ...p, additionalSections: arr };
                                              })
                                            }
                                            className="text-[0.8125rem] flex-1"
                                          />
                                          <button
                                            onClick={() =>
                                              scheduleDelete(`additional-${i}-item-${itemIndex}`, "Punkt", (p) => {
                                                const arr = [...p.additionalSections];
                                                arr[i] = {
                                                  ...arr[i],
                                                  items: arr[i].items.filter((_, j) => j !== itemIndex),
                                                };
                                                return { ...p, additionalSections: arr };
                                              })
                                            }
                                            className="text-muted-foreground hover:text-destructive shrink-0 p-1"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>

                                <button
                                  onClick={() =>
                                    scheduleDelete(
                                      `additional-section-${i}`,
                                      `Hovedseksjon "${doc.additionalSections[i]?.title || i + 1}"`,
                                      (p) => ({
                                        ...p,
                                        additionalSections: p.additionalSections.filter((_, j) => j !== i),
                                      }),
                                    )
                                  }
                                  className="text-destructive text-[0.75rem] font-medium hover:underline flex items-center gap-0.5"
                                >
                                  <Trash2 className="h-3 w-3" /> Slett hovedseksjon
                                </button>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </SortableItem>
                      ))}
                    </SortableContext>
                  </DndContext>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() =>
                        update((p) => {
                          const nextSections = [...p.additionalSections, createAdditionalSection("timeline")];
                          setExpandedAdditionalSection(`additional-section-${nextSections.length - 1}`);
                          return {
                            ...p,
                            additionalSections: nextSections,
                          };
                        })
                      }
                      className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="h-3 w-3" /> Ny hovedseksjon
                    </button>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* UTDANNELSE */}
              <AccordionItem value="utdannelse">
                <AccordionTrigger className="text-[0.8125rem] font-bold uppercase tracking-wide">
                  Utdannelse
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pt-2">
                  {doc.education.map((entry, i) => (
                    <div key={i} className="border border-border rounded-lg p-3 bg-card space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={entry.period}
                          placeholder="Periode"
                          onChange={(e) =>
                            update((p) => {
                              const arr = [...p.education];
                              arr[i] = { ...arr[i], period: e.target.value };
                              return { ...p, education: arr };
                            })
                          }
                          className="text-[0.8125rem] w-32"
                        />
                        <Input
                          value={entry.primary}
                          placeholder="Grad / tittel"
                          onChange={(e) =>
                            update((p) => {
                              const arr = [...p.education];
                              arr[i] = { ...arr[i], primary: e.target.value };
                              return { ...p, education: arr };
                            })
                          }
                          className="text-[0.8125rem] flex-1"
                        />
                        <button
                          onClick={() =>
                            scheduleDelete(`edu-${i}`, `Utdannelse "${doc.education[i]?.primary || i + 1}"`, (p) => ({
                              ...p,
                              education: p.education.filter((_, j) => j !== i),
                            }))
                          }
                          className="text-muted-foreground hover:text-destructive shrink-0 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <Input
                        value={entry.secondary || ""}
                        placeholder="Detaljer (valgfritt)"
                        onChange={(e) =>
                          update((p) => {
                            const arr = [...p.education];
                            arr[i] = { ...arr[i], secondary: e.target.value };
                            return { ...p, education: arr };
                          })
                        }
                        className="text-[0.8125rem]"
                      />
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      update((p) => ({ ...p, education: [...p.education, { period: "", primary: "", secondary: "" }] }))
                    }
                    className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="h-3 w-3" /> Legg til
                  </button>
                </AccordionContent>
              </AccordionItem>

              {/* ARBEIDSERFARING */}
              <AccordionItem value="arbeidserfaring">
                <AccordionTrigger className="text-[0.8125rem] font-bold uppercase tracking-wide">
                  Arbeidserfaring
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pt-2">
                  {doc.workExperience.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={entry.period}
                        placeholder="Periode"
                        onChange={(e) =>
                          update((p) => {
                            const arr = [...p.workExperience];
                            arr[i] = { ...arr[i], period: e.target.value };
                            return { ...p, workExperience: arr };
                          })
                        }
                        className="text-[0.8125rem] w-32"
                      />
                      <Input
                        value={entry.primary}
                        placeholder="Selskap"
                        onChange={(e) =>
                          update((p) => {
                            const arr = [...p.workExperience];
                            arr[i] = { ...arr[i], primary: e.target.value };
                            return { ...p, workExperience: arr };
                          })
                        }
                        className="text-[0.8125rem] flex-1"
                      />
                      <button
                        onClick={() =>
                          scheduleDelete(
                            `work-${i}`,
                            `Arbeidserfaring "${doc.workExperience[i]?.primary || i + 1}"`,
                            (p) => ({ ...p, workExperience: p.workExperience.filter((_, j) => j !== i) }),
                          )
                        }
                        className="text-muted-foreground hover:text-destructive shrink-0 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      update((p) => ({ ...p, workExperience: [...p.workExperience, { period: "", primary: "" }] }))
                    }
                    className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="h-3 w-3" /> Legg til
                  </button>
                </AccordionContent>
              </AccordionItem>

              {/* SIDEBAR */}
              <AccordionItem value="sidebar">
                <AccordionTrigger className="text-[0.8125rem] font-bold uppercase tracking-wide">
                  Sidebar
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  {doc.sidebarSections.map((section, si) => (
                    <div key={si} className="border border-border rounded-lg p-3 bg-card space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={section.heading}
                          placeholder="Overskrift"
                          onChange={(e) =>
                            update((p) => {
                              const arr = [...p.sidebarSections];
                              arr[si] = { ...arr[si], heading: e.target.value };
                              return { ...p, sidebarSections: arr };
                            })
                          }
                          className="text-[0.8125rem] font-medium"
                        />
                        <button
                          onClick={() =>
                            scheduleDelete(
                              `sidebar-${si}`,
                              `Sidebar-seksjon "${doc.sidebarSections[si]?.heading || si + 1}"`,
                              (p) => ({ ...p, sidebarSections: p.sidebarSections.filter((_, j) => j !== si) }),
                            )
                          }
                          className="text-muted-foreground hover:text-destructive shrink-0 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {section.items.map((item, ii) => (
                        <div key={ii} className="flex gap-1">
                          <Input
                            value={item}
                            onChange={(e) =>
                              update((p) => {
                                const arr = [...p.sidebarSections];
                                const items = [...arr[si].items];
                                items[ii] = e.target.value;
                                arr[si] = { ...arr[si], items };
                                return { ...p, sidebarSections: arr };
                              })
                            }
                            className="text-[0.8125rem]"
                          />
                          <button
                            onClick={() =>
                              scheduleDelete(`sidebar-${si}-item-${ii}`, "Sidebar-punkt", (p) => {
                                const arr = [...p.sidebarSections];
                                arr[si] = { ...arr[si], items: arr[si].items.filter((_, j) => j !== ii) };
                                return { ...p, sidebarSections: arr };
                              })
                            }
                            className="text-muted-foreground hover:text-destructive shrink-0 p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() =>
                          update((p) => {
                            const arr = [...p.sidebarSections];
                            arr[si] = { ...arr[si], items: [...arr[si].items, ""] };
                            return { ...p, sidebarSections: arr };
                          })
                        }
                        className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5"
                      >
                        <Plus className="h-3 w-3" /> Legg til punkt
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      update((p) => ({
                        ...p,
                        sidebarSections: [...p.sidebarSections, { heading: "", items: [""] }],
                      }))
                    }
                    className="text-primary text-[0.75rem] font-medium hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="h-3 w-3" /> Ny seksjon
                  </button>
                </AccordionContent>
              </AccordionItem>

              {/* KONTAKTPERSON */}
              <AccordionItem value="kontaktperson">
                <AccordionTrigger className="text-[0.8125rem] font-bold uppercase tracking-wide">
                  Kontaktperson
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div>
                    <label className={LABEL}>Velg ferdig kontaktperson</label>
                    <Select
                      value={getSelectedContactPresetId(doc.hero.contact)}
                      onValueChange={(value) => {
                        if (value === CLEAR_SELECT) {
                          update((p) => ({
                            ...p,
                            hero: {
                              ...p.hero,
                              contact: {
                                ...p.hero.contact,
                                title: "",
                                name: "",
                                phone: "",
                                email: "",
                              },
                            },
                          }));
                          return;
                        }

                        const preset = CONTACT_PERSON_PRESETS[value as keyof typeof CONTACT_PERSON_PRESETS];
                        update((p) => ({
                          ...p,
                          hero: {
                            ...p.hero,
                            contact: {
                              ...p.hero.contact,
                              ...preset,
                            },
                          },
                        }));
                      }}
                    >
                      <SelectTrigger className="mt-1 h-10 text-[0.875rem]">
                        <SelectValue placeholder="Velg kontaktperson" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CLEAR_SELECT}>Ingen valgt</SelectItem>
                        <SelectItem value="jon_richard">Jon Richard Nygaard</SelectItem>
                        <SelectItem value="thomas_eriksen">Thomas Eriksen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={LABEL}>Navn</label>
                      <Input
                        value={doc.hero.contact.name}
                        onChange={(e) => setHeroContact("name", e.target.value)}
                        className="mt-1 text-[0.875rem]"
                      />
                    </div>
                    <div>
                      <label className={LABEL}>Tittel</label>
                      <Input
                        value={doc.hero.contact.title}
                        onChange={(e) => setHeroContact("title", e.target.value)}
                        className="mt-1 text-[0.875rem]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={LABEL}>Telefon</label>
                      <Input
                        value={doc.hero.contact.phone}
                        onChange={(e) => setHeroContact("phone", e.target.value)}
                        className="mt-1 text-[0.875rem]"
                      />
                    </div>
                    <div>
                      <label className={LABEL}>Epost</label>
                      <Input
                        value={doc.hero.contact.email}
                        onChange={(e) => setHeroContact("email", e.target.value)}
                        className="mt-1 text-[0.875rem]"
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>
    </div>
  );
}
