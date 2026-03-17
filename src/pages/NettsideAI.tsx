import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, Camera, Loader2, FileText, Upload, Move } from "lucide-react";
import { format } from "date-fns";
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LABEL = "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1 block";

/* ─── Knowledge base constants ─── */

const CHIP_BASE = "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors cursor-pointer select-none";
const CHIP_OFF = `${CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;
const CHIP_ON = `${CHIP_BASE} bg-foreground text-background border-foreground font-medium`;

type VisFilter = "alle" | "public" | "ai_only";
type CatFilter = "alle" | "skills" | "domain" | "services" | "availability" | "education" | "languages";

const VIS_CHIPS: { value: VisFilter; label: string }[] = [
  { value: "alle", label: "Alle" },
  { value: "public", label: "Public" },
  { value: "ai_only", label: "AI-only" },
];

const CAT_CHIPS: { value: CatFilter; label: string }[] = [
  { value: "alle", label: "Alle" },
  { value: "skills", label: "skills" },
  { value: "domain", label: "domain" },
  { value: "services", label: "services" },
  { value: "availability", label: "availability" },
  { value: "education", label: "education" },
  { value: "languages", label: "languages" },
];

const CATEGORIES_LIST = ["skills", "domain", "services", "availability", "education", "languages"];

/* ─── Shared components ─── */

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span className="flex items-center gap-1.5 text-[0.75rem]">
        <button onClick={onConfirm} className="text-destructive font-medium hover:underline">Ja, slett</button>
        <button onClick={() => setConfirming(false)} className="text-muted-foreground hover:underline">Avbryt</button>
      </span>
    );
  }
  return (
    <button onClick={() => setConfirming(true)} className="text-muted-foreground hover:text-destructive transition-colors">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState("");
  const add = () => {
    const tag = input.trim();
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setInput("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.75rem] font-medium text-foreground">
            {t}
            <button onClick={() => onChange(value.filter((v) => v !== t))} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={placeholder}
        className="h-8 text-[0.8125rem]"
      />
    </div>
  );
}

/* ─── Image Repositioner ─── */

function ImageRepositioner({
  src,
  position,
  onPositionChange,
}: {
  src: string;
  position: string;
  onPositionChange: (pos: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startPct = useRef({ x: 50, y: 50 });

  const parsePct = useCallback((pos: string) => {
    const parts = pos.split(/\s+/).map((s) => parseFloat(s));
    return { x: parts[0] ?? 50, y: parts[1] ?? 50 };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragging.current = true;
      startPos.current = { x: e.clientX, y: e.clientY };
      startPct.current = parsePct(position);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [position, parsePct]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      // Invert: dragging right moves object-position left
      const newX = Math.max(0, Math.min(100, startPct.current.x - (dx / rect.width) * 100));
      const newY = Math.max(0, Math.min(100, startPct.current.y - (dy / rect.height) * 100));
      onPositionChange(`${Math.round(newX)}% ${Math.round(newY)}%`);
    },
    [onPositionChange]
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div className="flex flex-col gap-1">
      <div
        ref={containerRef}
        className="group/repo w-full aspect-square rounded-lg border border-border overflow-hidden cursor-grab active:cursor-grabbing relative"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <img
          src={src}
          alt="Forhåndsvisning"
          className="w-full h-full object-cover pointer-events-none select-none"
          style={{ objectPosition: position }}
          draggable={false}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/repo:bg-black/20 transition-colors pointer-events-none">
          <Move className="h-5 w-5 text-white opacity-0 group-hover/repo:opacity-70 transition-opacity" />
        </div>
      </div>
      <span className="text-[0.6875rem] text-muted-foreground">Dra for å justere</span>
    </div>
  );
}

/* ─── Consultants Tab ─── */

interface Consultant {
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  experience_years: number | null;
  location: string | null;
  image_url: string | null;
  bilde_posisjon: string | null;
  competences: string[] | null;
  industries: string[] | null;
  sort_order: number | null;
  active: boolean | null;
  ikke_startet: boolean | null;
}

function ConsultantsTab() {
  const queryClient = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: consultants = [], isLoading } = useQuery({
    queryKey: ["consultants-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultants")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data as any[]) as Consultant[];
    },
  });

  const editing = consultants.find((c) => c.id === editId) ?? null;

  const sorted = [...consultants].sort((a, b) => {
    const aLast = a.ikke_startet ?? false;
    const bLast = b.ikke_startet ?? false;
    if (aLast === bLast) return 0;
    return aLast ? 1 : -1;
  });

  return (
    <>
      <div className="flex items-center justify-end mb-4">
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-[#C4703A] text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Ny konsulent
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="aspect-square bg-muted rounded animate-pulse" />
              <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
              <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
            </div>
          ))}
        </div>
      ) : consultants.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-[0.8125rem]">Ingen konsulenter funnet</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sorted.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-card p-3 relative group">
              {c.image_url ? (
                <img src={c.image_url} alt={c.name} className="aspect-square w-full object-cover rounded border border-border mb-2" style={{ objectPosition: c.bilde_posisjon || "50% 50%" }} />
              ) : (
                <div className="aspect-square w-full rounded border border-border mb-2 bg-muted flex items-center justify-center">
                  <span className="text-lg font-bold text-muted-foreground">
                    {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <p className="font-medium text-[0.875rem] text-foreground truncate">{c.name}</p>
              <div className="flex items-center gap-2 mt-1">
                {c.experience_years != null && (
                  <span className="text-[0.75rem] text-muted-foreground">{c.experience_years} år</span>
                )}
                {c.location && (
                  <span className="text-[0.75rem] text-muted-foreground">{c.location}</span>
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                {c.active ? (
                  <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold bg-green-100 text-green-800 border-green-200">Aktiv</span>
                ) : (
                  <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold bg-gray-100 text-gray-600 border-gray-200">Inaktiv</span>
                )}
                <button
                  onClick={() => setEditId(c.id)}
                  className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ConsultantSheet
          mode="edit"
          consultant={editing}
          open={!!editId}
          onClose={() => setEditId(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["consultants-admin"] });
            setEditId(null);
          }}
        />
      )}

      <ConsultantSheet
        mode="create"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["consultants-admin"] });
          setCreateOpen(false);
        }}
      />
    </>
  );
}

function SheetDeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div className="flex items-center gap-2 text-[0.8125rem]">
        <span className="text-muted-foreground">Er du sikker?</span>
        <button onClick={onConfirm} className="text-destructive font-medium hover:underline">Ja, slett</button>
        <button onClick={() => setConfirming(false)} className="text-muted-foreground hover:underline">Avbryt</button>
      </div>
    );
  }
  return (
    <button onClick={() => setConfirming(true)} className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground hover:text-destructive transition-colors">
      <Trash2 className="h-3.5 w-3.5" />
      Slett konsulent
    </button>
  );
}

function ConsultantSheet({
  mode,
  consultant,
  open,
  onClose,
  onSaved,
}: {
  mode: "edit" | "create";
  consultant?: Consultant;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(consultant?.name ?? "");
  const [description, setDescription] = useState(consultant?.description ?? "");
  const [experienceYears, setExperienceYears] = useState(consultant?.experience_years ?? 0);
  const [location, setLocation] = useState(consultant?.location ?? "");
  const [imageUrl, setImageUrl] = useState(consultant?.image_url ?? "");
  const [bildePos, setBildePos] = useState(consultant?.bilde_posisjon ?? "50% 50%");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);
  const [competences, setCompetences] = useState<string[]>(consultant?.competences ?? []);
  const [industries, setIndustries] = useState<string[]>(consultant?.industries ?? []);
  const [active, setActive] = useState(mode === "edit" ? (consultant?.active ?? true) : false);
  const [notStarted, setNotStarted] = useState(mode === "edit" ? (consultant?.ikke_startet ?? false) : false);
  const [cvAnalyzing, setCvAnalyzing] = useState(false);

  const handleCvUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Filen kan ikke være større enn 10MB");
      return;
    }

    setCvAnalyzing(true);
    let text = "";

    try {
      if (file.name.endsWith(".pdf")) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pages: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          pages.push(content.items.map((item: any) => item.str).join(" "));
        }
        text = pages.join("\n\n");
      } else if (file.name.endsWith(".docx")) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else {
        toast.error("Støtter kun PDF og DOCX");
        setCvAnalyzing(false);
        return;
      }

      if (!text.trim()) {
        toast.error("Ingen tekst funnet i dokumentet");
        setCvAnalyzing(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("analyze-cv-consultant", {
        body: { text },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      let filledCount = 0;
      if (data.navn && mode === "create") { setName(data.navn); filledCount++; }
      if (data.beskrivelse) { setDescription(data.beskrivelse); filledCount++; }
      if (data.erfaring_ar != null) { setExperienceYears(data.erfaring_ar); filledCount++; }
      if (data.lokasjon) { setLocation(data.lokasjon); filledCount++; }
      if (data.kompetanser?.length) { setCompetences(data.kompetanser); filledCount++; }
      if (data.industrier?.length) { setIndustries(data.industrier); filledCount++; }

      toast.success(`✓ AI fylte ut ${filledCount} felter fra CV`);
    } catch (e) {
      console.error("CV analysis error:", e);
      toast.error("Kunne ikke analysere CV");
    } finally {
      setCvAnalyzing(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (mode === "create") {
        const { error } = await supabase.from("consultants").insert({
          name,
          ikke_startet: notStarted,
          description: description || null,
          experience_years: experienceYears,
          location: location || null,
          image_url: imageUrl || null,
          bilde_posisjon: bildePos,
          competences,
          industries,
          active,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("consultants")
           .update({
            name,
            ikke_startet: notStarted,
            description: description || null,
            experience_years: experienceYears,
            location: location || null,
            image_url: imageUrl || null,
            bilde_posisjon: bildePos,
            competences,
            industries,
            active,
          })
          .eq("id", consultant!.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(mode === "create" ? "Konsulent opprettet" : "Konsulent oppdatert");
      onSaved();
    },
    onError: () => toast.error(mode === "create" ? "Kunne ikke opprette" : "Kunne ikke oppdatere"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("consultants").delete().eq("id", consultant!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Konsulent slettet");
      onSaved();
    },
    onError: () => toast.error("Kunne ikke slette"),
  });

  const canSave = mode === "create" ? name.trim().length > 0 : true;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-[840px] p-0 overflow-y-auto" hideCloseButton>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[1.0625rem] font-bold text-foreground">
              {mode === "create" ? "Ny konsulent" : (name || consultant!.name)}
            </h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* CV upload zone */}
          <div className="border-b border-border pb-4">
            <input
              ref={cvInputRef}
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCvUpload(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => cvInputRef.current?.click()}
              disabled={cvAnalyzing}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files?.[0];
                if (file) handleCvUpload(file);
              }}
              className="w-full rounded-lg border-2 border-dashed border-border p-5 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors disabled:opacity-50"
            >
              {cvAnalyzing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-[0.8125rem] font-medium">AI analyserer CV...</span>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5" />
                  <span className="text-[0.8125rem] font-medium">Dra og slipp CV her, eller klikk for å velge fil</span>
                  <span className="text-[0.6875rem]">Støtter PDF og DOCX</span>
                </>
              )}
            </button>
          </div>

          <div>
            <label className={LABEL}>Navn</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fullt navn" className="h-9 text-[0.8125rem]" />
          </div>
          <div>
            <label className={LABEL}>Beskrivelse</label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className="text-[0.8125rem]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Erfaring (år)</label>
              <Input type="number" value={experienceYears} onChange={(e) => setExperienceYears(Number(e.target.value))} className="h-9 text-[0.8125rem]" />
            </div>
            <div>
              <label className={LABEL}>Lokasjon</label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} className="h-9 text-[0.8125rem]" />
            </div>
          </div>
          <div>
            <label className={LABEL}>Bilde</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!file.type.startsWith("image/")) {
                  toast.error("Filen må være et bilde");
                  return;
                }
                if (file.size > 5 * 1024 * 1024) {
                  toast.error("Bildet kan ikke være større enn 5MB");
                  return;
                }
                setUploading(true);
                try {
                  const fileName = `${Date.now()}-${file.name.replace(/\s/g, "-")}`;
                  const { error } = await supabase.storage.from("consultant-images").upload(fileName, file, { upsert: true });
                  if (error) throw error;
                  const { data: urlData } = supabase.storage.from("consultant-images").getPublicUrl(fileName);
                  setImageUrl(urlData.publicUrl);
                  toast.success("Bilde lastet opp");
                } catch {
                  toast.error("Kunne ikke laste opp bilde");
                } finally {
                  setUploading(false);
                }
              }}
            />
            {imageUrl ? (
              <div className="flex items-start gap-3">
                <ImageRepositioner
                  src={imageUrl}
                  position={bildePos}
                  onPositionChange={setBildePos}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-[0.8125rem] font-medium rounded-lg border border-border text-foreground hover:bg-secondary disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  Bytt bilde
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full h-24 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                <span className="text-[0.75rem]">{uploading ? "Laster opp..." : "Last opp bilde"}</span>
              </button>
            )}
          </div>
          <div>
            <label className={LABEL}>Kompetanser</label>
            <TagInput value={competences} onChange={setCompetences} placeholder="Legg til kompetanse..." />
          </div>
          <div>
            <label className={LABEL}>Industrier</label>
            <TagInput value={industries} onChange={setIndustries} placeholder="Legg til industri..." />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={notStarted} onCheckedChange={setNotStarted} />
            <span className="text-[0.8125rem] text-foreground">Ikke startet ennå</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} />
            <span className="text-[0.8125rem] text-foreground">Vis på stacq.no</span>
          </div>

          <button
            disabled={!canSave || saveMutation.isPending || uploading || cvAnalyzing}
            onClick={() => saveMutation.mutate()}
            className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-[#C4703A] text-white hover:opacity-90 disabled:opacity-50 transition-opacity w-full justify-center"
          >
            {saveMutation.isPending ? "Lagrer..." : mode === "create" ? "Opprett konsulent" : "Lagre endringer"}
          </button>

          {mode === "edit" && (
            <div className="pt-2 border-t border-border">
              <SheetDeleteButton onConfirm={() => deleteMutation.mutate()} />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ─── Knowledge Tab ─── */

function KnowledgeTab() {
  const queryClient = useQueryClient();
  const [visFilter, setVisFilter] = useState<VisFilter>("alle");
  const [catFilter, setCatFilter] = useState<CatFilter>("alle");
  const [newCategory, setNewCategory] = useState("");
  const [newVisibility, setNewVisibility] = useState("");
  const [newContent, setNewContent] = useState("");

  // Upload state
  const docInputRef = useRef<HTMLInputElement>(null);
  const [uploadCategory, setUploadCategory] = useState("");
  const [uploadVisibility, setUploadVisibility] = useState("");
  const [uploadStatus, setUploadStatus] = useState<"idle" | "reading" | "analyzing" | "preview">("idle");
  const [extractedRows, setExtractedRows] = useState<Array<{ category: string; content: string }>>([]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["knowledge-base"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_base")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("knowledge_base").insert({
        category: newCategory,
        title: newCategory,
        content: newContent,
        active: newVisibility === "public",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
      toast.success("Kunnskap lagt til");
      setNewCategory("");
      setNewVisibility("");
      setNewContent("");
    },
    onError: () => toast.error("Kunne ikke legge til"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("knowledge_base").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
      toast.success("Rad slettet");
    },
    onError: () => toast.error("Kunne ikke slette"),
  });

  const handleFileUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Filen kan ikke være større enn 10MB");
      return;
    }

    let text = "";

    try {
      setUploadStatus("reading");

      if (file.name.endsWith(".txt")) {
        text = await file.text();
      } else if (file.name.endsWith(".pdf")) {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pages: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          pages.push(content.items.map((item: any) => item.str).join(" "));
        }
        text = pages.join("\n\n");
      } else {
        toast.error("Kun PDF og .txt-filer støttes");
        setUploadStatus("idle");
        return;
      }

      if (!text.trim()) {
        toast.error("Filen er tom eller inneholder ingen tekst");
        setUploadStatus("idle");
        return;
      }

      setUploadStatus("analyzing");

      const { data, error } = await supabase.functions.invoke("extract-knowledge", {
        body: { documentText: text },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const extracted = data?.rows;
      if (!Array.isArray(extracted) || extracted.length === 0) {
        toast.error("AI fant ingen relevant kunnskap i dokumentet");
        setUploadStatus("idle");
        return;
      }

      setExtractedRows(extracted);
      setUploadStatus("preview");
    } catch (e) {
      console.error("Document extraction error:", e);
      toast.error(e instanceof Error ? e.message : "Kunne ikke analysere dokument");
      setUploadStatus("idle");
    }
  };

  const saveExtractedRows = async () => {
    if (extractedRows.length === 0) return;
    const vis = uploadVisibility || "ai_only";
    try {
      const inserts = extractedRows.map((r) => ({
        category: r.category,
        title: r.category,
        content: r.content,
        active: vis === "public",
      }));
      const { error } = await supabase.from("knowledge_base").insert(inserts);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
      toast.success(`${extractedRows.length} rader lagt til fra dokument`);
      setExtractedRows([]);
      setUploadStatus("idle");
      setUploadCategory("");
      setUploadVisibility("");
    } catch {
      toast.error("Kunne ikke lagre rader");
    }
  };

  const removeExtractedRow = (idx: number) => {
    setExtractedRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const filtered = rows.filter((r) => {
    if (visFilter === "public" && !r.active) return false;
    if (visFilter === "ai_only" && r.active) return false;
    if (catFilter !== "alle" && r.category !== catFilter) return false;
    return true;
  });

  const canAdd = newCategory && newVisibility && newContent.trim();

  return (
    <div className="space-y-5">
      {/* Document upload section */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <label className={LABEL}>Last opp dokument — AI trekker ut relevant kunnskap automatisk</label>

        <input
          ref={docInputRef}
          type="file"
          accept=".pdf,.txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
            e.target.value = "";
          }}
        />

        {uploadStatus === "idle" && extractedRows.length === 0 && (
          <>
            <button
              type="button"
              onClick={() => docInputRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
            >
              <FileText className="h-6 w-6" />
              <span className="text-[0.8125rem] font-medium">Klikk for å laste opp PDF eller tekstfil</span>
              <span className="text-[0.75rem] text-muted-foreground">Støtter PDF og .txt — maks 10MB. Fungerer med håndbøker, brosjyrer og anonymiserte CVer.</span>
            </button>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Kategori (valgfritt overstyring)</label>
                <Select value={uploadCategory} onValueChange={setUploadCategory}>
                  <SelectTrigger className="h-9 text-[0.8125rem]">
                    <SelectValue placeholder="AI velger automatisk" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES_LIST.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={LABEL}>Synlighet</label>
                <Select value={uploadVisibility} onValueChange={setUploadVisibility}>
                  <SelectTrigger className="h-9 text-[0.8125rem]">
                    <SelectValue placeholder="AI-only (standard)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public — vises på nettside</SelectItem>
                    <SelectItem value="ai_only">AI-only — kun kontekst</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}

        {(uploadStatus === "reading" || uploadStatus === "analyzing") && (
          <div className="w-full border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-[0.8125rem] font-medium">
              {uploadStatus === "reading" ? "Leser dokument..." : "AI analyserer innhold..."}
            </span>
          </div>
        )}

        {uploadStatus === "preview" && extractedRows.length > 0 && (
          <div className="space-y-2">
            <p className="text-[0.8125rem] font-medium text-foreground">AI fant {extractedRows.length} kunnskapsrader:</p>
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {extractedRows.map((row, idx) => (
                <div key={idx} className="flex items-start gap-2 px-3 py-2 text-[0.8125rem]">
                  <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold bg-muted text-foreground border-border shrink-0 mt-0.5">
                    {row.category}
                  </span>
                  <span className="text-foreground/70 flex-1">{row.content}</span>
                  <button onClick={() => removeExtractedRow(idx)} className="text-muted-foreground hover:text-destructive shrink-0 mt-0.5">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={saveExtractedRows}
                className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-[#C4703A] text-white hover:opacity-90"
              >
                Lagre {extractedRows.length} rader til kunnskapsbase
              </button>
              <button
                onClick={() => { setExtractedRows([]); setUploadStatus("idle"); }}
                className="h-9 px-3 text-[0.8125rem] text-muted-foreground hover:text-foreground"
              >
                Avbryt
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="border-b border-border" />

      {/* Add form */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={LABEL}>Kategori</label>
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="h-9 text-[0.8125rem]">
                <SelectValue placeholder="Velg kategori" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES_LIST.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className={LABEL}>Synlighet</label>
            <Select value={newVisibility} onValueChange={setNewVisibility}>
              <SelectTrigger className="h-9 text-[0.8125rem]">
                <SelectValue placeholder="Velg synlighet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public — vises på nettside</SelectItem>
                <SelectItem value="ai_only">AI-only — kun kontekst</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <button
              disabled={!canAdd || addMutation.isPending}
              onClick={() => addMutation.mutate()}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-[#C4703A] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              Legg til
            </button>
          </div>
        </div>
        <div>
          <label className={LABEL}>Innhold</label>
          <Textarea
            rows={3}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Beskriv kompetanse, erfaring eller tjeneste uten å nevne navn..."
            className="text-[0.8125rem]"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {VIS_CHIPS.map((c) => (
            <button key={c.value} className={visFilter === c.value ? CHIP_ON : CHIP_OFF} onClick={() => setVisFilter(c.value)}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {CAT_CHIPS.map((c) => (
            <button key={c.value} className={catFilter === c.value ? CHIP_ON : CHIP_OFF} onClick={() => setCatFilter(c.value)}>
              {c.label}
            </button>
          ))}
          <div className="flex items-center gap-3 ml-auto shrink-0">
            <div className="w-px h-8 bg-border" />
            <div className="text-right">
              <span className="text-[0.9375rem] font-semibold text-foreground">{filtered.length}</span>
              <span className="text-[0.9375rem] text-muted-foreground ml-1.5">rader</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[100px_90px_1fr_100px_40px] gap-4 items-center min-h-[44px] px-4 py-2">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
                <div />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-[0.8125rem]">
            Ingen kunnskap lagt til ennå
          </div>
        ) : (
          <div className="divide-y divide-border">
            <div className="grid grid-cols-[100px_90px_1fr_100px_40px] gap-4 items-center min-h-[44px] px-4 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <span>Kategori</span>
              <span>Synlighet</span>
              <span>Innhold</span>
              <span>Lagt til</span>
              <span />
            </div>
            {filtered.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[100px_90px_1fr_100px_40px] gap-4 items-center min-h-[44px] px-4 py-2 hover:bg-background/80 transition-colors"
              >
                <span className="text-[0.8125rem] font-medium text-foreground">{row.category}</span>
                <span>
                  {row.active ? (
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold bg-green-100 text-green-800 border-green-200">public</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold bg-amber-100 text-amber-800 border-amber-200">ai_only</span>
                  )}
                </span>
                <span className="text-[0.8125rem] text-foreground/70 truncate">{row.content}</span>
                <span className="text-[0.8125rem] text-muted-foreground">
                  {row.created_at ? format(new Date(row.created_at), "d. MMM yyyy", { locale: nb }) : "—"}
                </span>
                <DeleteButton onConfirm={() => deleteMutation.mutate(row.id)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ─── */

const NettsideAI = () => {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.375rem] font-bold text-foreground">Nettside</h1>
        <p className="text-[0.8125rem] text-muted-foreground mt-1">
          Administrer konsulentprofiler og AI-kunnskapsbase for stacq.no.
        </p>
      </div>

      <Tabs defaultValue="consultants">
        <TabsList>
          <TabsTrigger value="consultants">Konsulenter</TabsTrigger>
          <TabsTrigger value="knowledge">AI-kunnskap</TabsTrigger>
        </TabsList>
        <TabsContent value="consultants" className="mt-5">
          <ConsultantsTab />
        </TabsContent>
        <TabsContent value="knowledge" className="mt-5">
          <KnowledgeTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NettsideAI;
