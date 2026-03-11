import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, Camera, Loader2 } from "lucide-react";
import { format } from "date-fns";
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

/* ─── Consultants Tab ─── */

interface Consultant {
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  experience_years: number | null;
  location: string | null;
  image_url: string | null;
  competences: string[] | null;
  industries: string[] | null;
  sort_order: number | null;
  active: boolean | null;
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
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Consultant[];
    },
  });

  const editing = consultants.find((c) => c.id === editId) ?? null;

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
          {consultants.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-card p-3 relative group">
              <span className="absolute top-2 right-2 text-[0.6875rem] text-muted-foreground">#{c.sort_order ?? 0}</span>
              {c.image_url ? (
                <img src={c.image_url} alt={c.name} className="aspect-square w-full object-cover rounded border border-border mb-2" />
              ) : (
                <div className="aspect-square w-full rounded border border-border mb-2 bg-muted flex items-center justify-center">
                  <span className="text-lg font-bold text-muted-foreground">
                    {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <p className="font-medium text-[0.875rem] text-foreground truncate">{c.name}</p>
              {c.title && <p className="text-[0.75rem] text-muted-foreground truncate">{c.title}</p>}
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
  const [title, setTitle] = useState(consultant?.title ?? "");
  const [description, setDescription] = useState(consultant?.description ?? "");
  const [experienceYears, setExperienceYears] = useState(consultant?.experience_years ?? 0);
  const [location, setLocation] = useState(consultant?.location ?? "");
  const [imageUrl, setImageUrl] = useState(consultant?.image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [competences, setCompetences] = useState<string[]>(consultant?.competences ?? []);
  const [industries, setIndustries] = useState<string[]>(consultant?.industries ?? []);
  const [sortOrder, setSortOrder] = useState(consultant?.sort_order ?? 0);
  const [active, setActive] = useState(mode === "edit" ? (consultant?.active ?? true) : false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (mode === "create") {
        const { error } = await supabase.from("consultants").insert({
          name,
          title: title || null,
          description: description || null,
          experience_years: experienceYears,
          location: location || null,
          image_url: imageUrl || null,
          competences,
          industries,
          sort_order: sortOrder,
          active,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("consultants")
          .update({
            title: title || null,
            description: description || null,
            experience_years: experienceYears,
            location: location || null,
            image_url: imageUrl || null,
            competences,
            industries,
            sort_order: sortOrder,
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
      <SheetContent side="right" className="w-[420px] p-0 overflow-y-auto" hideCloseButton>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[1.0625rem] font-bold text-foreground">
              {mode === "create" ? "Ny konsulent" : consultant!.name}
            </h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <label className={LABEL}>Navn</label>
            {mode === "create" ? (
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fullt navn" className="h-9 text-[0.8125rem]" />
            ) : (
              <Input value={consultant!.name} readOnly className="h-9 text-[0.8125rem] bg-muted/50" />
            )}
          </div>
          <div>
            <label className={LABEL}>Tittel</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 text-[0.8125rem]" />
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
            <label className={LABEL}>Bilde-URL</label>
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="h-9 text-[0.8125rem]" />
          </div>
          <div>
            <label className={LABEL}>Kompetanser</label>
            <TagInput value={competences} onChange={setCompetences} placeholder="Legg til kompetanse..." />
          </div>
          <div>
            <label className={LABEL}>Industrier</label>
            <TagInput value={industries} onChange={setIndustries} placeholder="Legg til industri..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Sorteringsrekkefølge</label>
              <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className="h-9 text-[0.8125rem]" />
            </div>
            <div className="flex items-end pb-1">
              <div className="flex items-center gap-2">
                <Switch checked={active} onCheckedChange={setActive} />
                <span className="text-[0.8125rem] text-foreground">Vis på stacq.no</span>
              </div>
            </div>
          </div>

          <button
            disabled={!canSave || saveMutation.isPending}
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

  const filtered = rows.filter((r) => {
    if (visFilter === "public" && !r.active) return false;
    if (visFilter === "ai_only" && r.active) return false;
    if (catFilter !== "alle" && r.category !== catFilter) return false;
    return true;
  });

  const canAdd = newCategory && newVisibility && newContent.trim();

  return (
    <div className="space-y-5">
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
