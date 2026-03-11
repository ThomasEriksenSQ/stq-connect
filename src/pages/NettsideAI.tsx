import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const NettsideAI = () => {
  const queryClient = useQueryClient();
  const [visFilter, setVisFilter] = useState<VisFilter>("alle");
  const [catFilter, setCatFilter] = useState<CatFilter>("alle");

  // Form state
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
      <div>
        <h1 className="text-[1.375rem] font-bold text-foreground">Nettside AI</h1>
        <p className="text-[0.8125rem] text-muted-foreground mt-1">
          Kunnskapsbase for STACQ-AI boten på stacq.no. Innhold merket som AI-only brukes kun til resonnering — vises aldri direkte til besøkende.
        </p>
      </div>

      {/* Add form */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1 block">Kategori</label>
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
            <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1 block">Synlighet</label>
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
          <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1 block">Innhold</label>
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
            {/* Header */}
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
};

export default NettsideAI;
