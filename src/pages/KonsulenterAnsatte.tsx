import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState, useRef } from "react";
import { cn, getInitials, formatMonths } from "@/lib/utils";
import { format, differenceInMonths, isAfter } from "date-fns";
import { Pencil, Plus, X, Globe, Loader2, Upload, FileText, Sparkles } from "lucide-react";
import { AnsattDetailSheet } from "@/components/AnsattDetailSheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type Filter = "Alle" | "Aktiv" | "Kommende" | "Sluttet";

const SUGGESTED_KOMPETANSE = [
  "Embedded Linux", "RTOS", "C", "C++", "Python", "Yocto",
  "FreeRTOS", "CANopen", "STM32", "Security", "Autonomi",
  "Regulering", "Defence", "Java", "Rust",
];

const SUPABASE_URL = "https://kbvzpcebfopqqrvmbiap.supabase.co";

/* ─── Edit/Create Modal ─── */

interface AnsattForm {
  navn: string;
  epost: string;
  tlf: string;
  start_dato: string;
  slutt_dato: string;
  status: string;
  bilde_url: string;
  erfaring_aar: string;
  geografi: string;
  kompetanse: string[];
  bio: string;
  synlig_web: boolean;
}

function AnsattModal({
  open,
  onClose,
  ansatt,
}: {
  open: boolean;
  onClose: () => void;
  ansatt: any | null; // null = create mode
}) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvParsing, setCvParsing] = useState(false);
  const [cvParsed, setCvParsed] = useState(false);

  const isCreate = !ansatt;

  const [form, setForm] = useState<AnsattForm>({
    navn: "",
    epost: "",
    tlf: "",
    start_dato: "",
    slutt_dato: "",
    status: "AKTIV/SIGNERT",
    bilde_url: "",
    erfaring_aar: "",
    geografi: "",
    kompetanse: [],
    bio: "",
    synlig_web: false,
  });

  // Reset form when modal opens
  const [lastId, setLastId] = useState<number | null>(null);
  if (open && (ansatt?.id ?? null) !== lastId) {
    setLastId(ansatt?.id ?? null);
    setTagInput("");
    setCvFile(null);
    setCvParsing(false);
    setCvParsed(false);
    if (ansatt) {
      setForm({
        navn: ansatt.navn || "",
        epost: ansatt.epost || "",
        tlf: ansatt.tlf || "",
        start_dato: ansatt.start_dato || "",
        slutt_dato: ansatt.slutt_dato || "",
        status: ansatt.status || "AKTIV/SIGNERT",
        bilde_url: ansatt.bilde_url || "",
        erfaring_aar: ansatt.erfaring_aar?.toString() || "",
        geografi: ansatt.geografi || "",
        kompetanse: ansatt.kompetanse || [],
        bio: ansatt.bio || "",
        synlig_web: ansatt.synlig_web || false,
      });
    } else {
      setForm({
        navn: "", epost: "", tlf: "", start_dato: "", slutt_dato: "",
        status: "AKTIV/SIGNERT", bilde_url: "", erfaring_aar: "",
        geografi: "", kompetanse: [], bio: "", synlig_web: false,
      });
    }
  }

  const set = (key: keyof AnsattForm, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Maks 5 MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${ansatt?.id || "new"}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("ansatte-bilder").upload(path, file, { upsert: true });
    setUploading(false);
    if (error) { toast.error("Opplasting feilet"); return; }
    const url = `${SUPABASE_URL}/storage/v1/object/public/ansatte-bilder/${path}`;
    set("bilde_url", url);
  };

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !form.kompetanse.includes(t)) set("kompetanse", [...form.kompetanse, t]);
    setTagInput("");
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Maks 10 MB"); return; }
    setCvFile(file);
    setCvParsing(true);
    setCvParsed(false);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("parse-cv", {
        body: { base64, filename: file.name },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data.erfaring_aar) set("erfaring_aar", String(data.erfaring_aar));
      if (data.kompetanse?.length) set("kompetanse", data.kompetanse);
      if (data.geografi) set("geografi", data.geografi);
      if (data.bio) set("bio", data.bio);
      setCvParsed(true);
      toast.success("CV analysert — feltene er fylt inn");
    } catch (err) {
      console.error("CV parsing failed:", err);
      toast.error("Kunne ikke analysere CV — fyll inn manuelt");
    } finally {
      setCvParsing(false);
    }
  };

  const handleSave = async () => {
    if (!form.navn.trim()) return;
    setSaving(true);
    const payload: any = {
      navn: form.navn.trim(),
      epost: form.epost.trim() || null,
      tlf: form.tlf.trim() || null,
      start_dato: form.start_dato || null,
      slutt_dato: form.slutt_dato || null,
      status: form.status,
      bilde_url: form.bilde_url || null,
      erfaring_aar: form.erfaring_aar ? parseInt(form.erfaring_aar) : null,
      geografi: form.geografi.trim() || null,
      kompetanse: form.kompetanse,
      bio: form.bio.trim() || null,
      synlig_web: form.synlig_web,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (isCreate) {
      ({ error } = await supabase.from("stacq_ansatte").insert(payload));
    } else {
      ({ error } = await supabase.from("stacq_ansatte").update(payload).eq("id", ansatt.id));
    }
    setSaving(false);
    if (error) { toast.error("Kunne ikke lagre"); return; }
    toast.success(isCreate ? "Ansatt lagt til" : "Profil oppdatert");
    queryClient.invalidateQueries({ queryKey: ["stacq-ansatte"] });
    onClose();
  };

  const statusChips = ["AKTIV/SIGNERT", "SLUTTET"] as const;
  const statusLabel = (s: string) => {
    if (s === "AKTIV/SIGNERT") return "Aktiv";
    return "Sluttet";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg rounded-xl p-6 gap-0 max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <DialogTitle className="text-[1.125rem] font-bold text-foreground mb-5">
          {isCreate ? "Ny ansatt" : `Rediger ${form.navn.split(" ")[0]}`}
        </DialogTitle>

        <div className="space-y-4">
          {/* ── INTERN ── */}
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Intern (CRM)</p>

          <div>
            <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Navn</label>
            <Input value={form.navn} onChange={e => set("navn", e.target.value)} className="mt-1 text-[0.875rem]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Epost</label>
              <Input type="email" value={form.epost} onChange={e => set("epost", e.target.value)} className="mt-1 text-[0.875rem]" />
            </div>
            <div>
              <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Telefon</label>
              <Input value={form.tlf} onChange={e => set("tlf", e.target.value)} className="mt-1 text-[0.875rem]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Startdato</label>
              <Input type="date" value={form.start_dato} onChange={e => set("start_dato", e.target.value)} className="mt-1 text-[0.875rem]" />
            </div>
            <div>
              <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Sluttdato <span className="text-muted-foreground/50 normal-case font-normal">(valgfritt)</span>
              </label>
              <Input type="date" value={form.slutt_dato} onChange={e => set("slutt_dato", e.target.value)} className="mt-1 text-[0.875rem]" />
            </div>
          </div>

          <div>
            <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5 block">Status</label>
            <div className="flex gap-2">
              {statusChips.map(s => (
                <button
                  key={s}
                  onClick={() => set("status", s)}
                  className={cn(
                    "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors",
                    form.status === s
                      ? "bg-foreground text-background border-foreground"
                      : "border-border text-muted-foreground hover:bg-secondary"
                  )}
                >
                  {statusLabel(s)}
                </button>
              ))}
            </div>
          </div>

          {/* ── PROFIL ── */}
          <div className="space-y-3">
            <label className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Profil — vises på nettsiden
            </label>

            {/* Row: avatar + CV upload side by side */}
            <div className="flex gap-4 items-start">
              {/* Avatar/bilde */}
              <div className="shrink-0">
                {form.bilde_url ? (
                  <img src={form.bilde_url} alt="" className="w-20 h-20 rounded-full object-cover border border-border" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-bold">
                    {form.navn ? getInitials(form.navn) : "?"}
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="text-[0.6875rem] font-medium text-primary hover:underline disabled:opacity-50 mt-1.5 block mx-auto"
                >
                  {uploading ? "Laster opp..." : "Bytt bilde"}
                </button>
              </div>

              {/* CV upload box */}
              <div className="flex-1">
                <label className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground block mb-1.5">
                  Last opp CV (PDF)
                </label>
                <div
                  onClick={() => cvInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg px-4 py-3 cursor-pointer transition-colors text-sm ${
                    cvParsing
                      ? "border-primary/40 bg-primary/5"
                      : cvFile
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : "border-border hover:border-primary/40 hover:bg-primary/5"
                  }`}
                >
                  {cvParsing ? (
                    <div className="flex items-center gap-2 text-primary">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Analyserer CV med AI...</span>
                    </div>
                  ) : cvFile ? (
                    <div className="flex items-center gap-2 text-emerald-600">
                      <FileText className="h-4 w-4" />
                      <span className="font-medium">{cvFile.name}</span>
                      <span className="text-muted-foreground text-xs ml-auto">Klikk for å bytte</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Upload className="h-4 w-4" />
                      <div>
                        <span className="text-foreground font-medium">Last opp CV</span>
                        <span className="text-muted-foreground"> — PDF, maks 10 MB</span>
                        <p className="text-xs text-muted-foreground mt-0.5">AI henter ut erfaring, kompetanse og forslag til bio</p>
                      </div>
                    </div>
                  )}
                </div>
                <input ref={cvInputRef} type="file" accept=".pdf" className="hidden" onChange={handleCvUpload} />
              </div>
            </div>

            {/* AI result banner */}
            {cvParsed && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI hentet ut følgende — rediger gjerne
                </div>
                <p className="text-xs text-muted-foreground">
                  Feltene nedenfor er fylt inn automatisk. Du kan justere dem før du lagrer.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Erfaring (år)</label>
              <Input type="number" value={form.erfaring_aar} onChange={e => set("erfaring_aar", e.target.value)} placeholder="15" className="mt-1 text-[0.875rem]" />
            </div>
            <div>
              <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">By / geografi</label>
              <Input value={form.geografi} onChange={e => set("geografi", e.target.value)} placeholder="Oslo" className="mt-1 text-[0.875rem]" />
            </div>
          </div>

          {/* Kompetanse tags */}
          <div>
            <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Kompetanse</label>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 p-2 border border-border rounded-lg bg-background min-h-[38px]">
              {form.kompetanse.map(t => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[0.75rem] text-foreground">
                  {t}
                  <button onClick={() => set("kompetanse", form.kompetanse.filter(x => x !== t))} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={form.kompetanse.length === 0 ? "Legg til kompetanse..." : ""}
                className="flex-1 min-w-[100px] bg-transparent outline-none text-[0.8125rem] placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SUGGESTED_KOMPETANSE.filter(s => !form.kompetanse.includes(s)).slice(0, 10).map(s => (
                <button key={s} onClick={() => addTag(s)} className="h-6 px-2 text-[0.6875rem] rounded-full border border-border text-muted-foreground hover:bg-secondary transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Kort bio</label>
            <textarea
              value={form.bio}
              onChange={e => set("bio", e.target.value)}
              placeholder="2-3 setninger om bakgrunn og spesialitet..."
              rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>


          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-[0.875rem] font-medium">Vis på stacq.no</p>
              <p className="text-xs text-muted-foreground">Profilen vises på nettsidens konsulentside</p>
            </div>
            <Switch checked={form.synlig_web} onCheckedChange={v => set("synlig_web", v)} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <button onClick={onClose} className="text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors">Avbryt</button>
          <button
            disabled={!form.navn.trim() || saving}
            onClick={handleSave}
            className={cn(
              "inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg transition-colors",
              form.navn.trim() && !saving
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {saving ? "Lagrer..." : "Lagre"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Page ─── */

export default function KonsulenterAnsatte() {
  const [filter, setFilter] = useState<Filter>("Aktiv");
  const [editAnsatt, setEditAnsatt] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailAnsatt, setDetailAnsatt] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const today = new Date();

  const { data: ansatte = [], isLoading } = useQuery({
    queryKey: ["stacq-ansatte"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stacq_ansatte")
        .select("*")
        .order("start_dato", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: oppdrag = [] } = useQuery({
    queryKey: ["stacq-oppdrag-active-names"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stacq_oppdrag")
        .select("kandidat, status")
        .in("status", ["Aktiv", "Oppstart"]);
      if (error) throw error;
      return data;
    },
  });

  const oppdragMap = useMemo(() => {
    const m = new Map<string, string>();
    (oppdrag as any[]).forEach((o) => {
      // Keep highest priority: Aktiv > Oppstart
      if (!m.has(o.kandidat) || o.status === "Aktiv") m.set(o.kandidat, o.status);
    });
    return m;
  }, [oppdrag]);

  const activeOppdragNames = useMemo(
    () => new Set(oppdrag.map((o: any) => o.kandidat)),
    [oppdrag]
  );

  const getStatus = (row: any) => {
    if (row.status === "SLUTTET") return "Sluttet";
    if (row.start_dato && isAfter(new Date(row.start_dato), today)) return "Kommende";
    return "Aktiv";
  };

  const stats = useMemo(() => {
    let aktive = 0, kommende = 0;
    ansatte.forEach((a: any) => {
      const s = getStatus(a);
      if (s === "Aktiv") aktive++;
      else if (s === "Kommende") kommende++;
    });
    return { aktive, kommende };
  }, [ansatte]);

  const filtered = useMemo(() => {
    return ansatte.filter((a: any) => {
      const s = getStatus(a);
      if (filter === "Alle") return true;
      if (filter === "Aktiv") return s === "Aktiv" || s === "Kommende";
      return s === filter;
    });
  }, [ansatte, filter]);

  const getDuration = (row: any) => {
    const s = getStatus(row);
    if (s === "Kommende") return "–";
    const start = new Date(row.start_dato);
    const end = s === "Sluttet" && row.slutt_dato ? new Date(row.slutt_dato) : today;
    const months = differenceInMonths(end, start);
    return formatMonths(months);
  };

  const queryClient = useQueryClient();
  const openEdit = (a: any) => { setEditAnsatt(a); setModalOpen(true); };
  const openCreate = () => { setEditAnsatt(null); setModalOpen(true); };

  const handleSetOppdragStatus = async (navn: string, status: string | null) => {
    if (status === null) {
      await supabase
        .from("stacq_oppdrag")
        .update({ status: "Inaktiv" })
        .eq("kandidat", navn)
        .in("status", ["Aktiv", "Oppstart"]);
    } else {
      await supabase
        .from("stacq_oppdrag")
        .update({ status })
        .eq("kandidat", navn)
        .in("status", ["Aktiv", "Oppstart", "Inaktiv"]);
    }
    queryClient.invalidateQueries({ queryKey: ["stacq-ansatte"] });
    queryClient.invalidateQueries({ queryKey: ["stacq-oppdrag-active-names"] });
  };

  const chips: Filter[] = ["Alle", "Aktiv", "Kommende", "Sluttet"];

  if (isLoading) {
    return <p className="text-muted-foreground py-12 text-center">Laster ansatte...</p>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[1.375rem] font-bold">Ansatte</h1>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Ny ansatt
        </button>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[0.75rem] text-muted-foreground ml-auto">
          {stats.aktive + stats.kommende} ansatte
        </span>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2">
        {chips.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={cn(
              "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors",
              filter === c
                ? "bg-foreground text-background border-foreground font-medium"
                : "border-border text-muted-foreground hover:bg-secondary"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-card shadow-card">
        {/* Header */}
        <div className="grid grid-cols-[minmax(0,2.5fr)_100px_110px_130px_100px_180px_40px] gap-3 px-4 py-2.5 border-b border-border bg-background">
          {["NAVN", "START", "ANSETTELSE", "OPPDRAG", "ANSATT", "KONTAKT", ""].map((h) => (
            <span key={h} className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">{h}</span>
          ))}
        </div>
        <div className="divide-y divide-border">
        {filtered.map((a: any) => {
          const status = getStatus(a);
          const isKommende = status === "Kommende";
          const isSluttet = status === "Sluttet";
          const inOppdrag = activeOppdragNames.has(a.navn);
          const oppdragStatus = oppdragMap.get(a.navn) || null;

          const oppdragBadge = oppdragStatus === "Aktiv" ? (
            <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 text-[0.75rem] font-semibold">
              I oppdrag
            </span>
          ) : oppdragStatus === "Oppstart" ? (
            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-0.5 text-[0.75rem] font-semibold">
              Oppstart
            </span>
          ) : (
            <span className="text-[0.8125rem] text-muted-foreground">—</span>
          );

          return (
            <div
              key={a.id}
              onClick={() => { setDetailAnsatt(a); setDetailOpen(true); }}
              className={cn(
                "group grid grid-cols-[minmax(0,2.5fr)_100px_110px_130px_100px_180px_40px] gap-3 items-center px-4 min-h-[44px] py-2 hover:bg-background/80 transition-colors duration-75 cursor-pointer",
                isKommende && "opacity-80",
                isSluttet && "opacity-50"
              )}
            >
              {/* NAVN */}
              <div className="flex items-center gap-3 min-w-0">
                {a.bilde_url ? (
                  <img src={a.bilde_url} alt={a.navn} className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-border" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-[0.6875rem] font-bold flex items-center justify-center flex-shrink-0">
                    {getInitials(a.navn)}
                  </div>
                )}
                <span className="font-medium text-[0.8125rem] truncate">{a.navn}</span>
                {inOppdrag && (
                  <span className="bg-emerald-100 text-emerald-700 text-[0.625rem] font-semibold uppercase rounded px-1.5 py-0.5 flex-shrink-0">
                    I OPPDRAG
                  </span>
                )}
              </div>
              {/* START */}
              <div className="text-[0.8125rem]">
                {isKommende ? (
                  <span className="bg-amber-100 text-amber-700 text-xs font-medium rounded-full px-2.5 py-0.5">
                    Starter {format(new Date(a.start_dato), "dd.MM")}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {a.start_dato ? format(new Date(a.start_dato), "dd.MM.yyyy") : "–"}
                  </span>
                )}
              </div>
              {/* ANSETTELSE */}
              <div className="text-[0.8125rem] text-muted-foreground">{getDuration(a)}</div>
              {/* OPPDRAG */}
              <div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <button className="hover:opacity-70 transition-opacity">
                      {oppdragBadge}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => handleSetOppdragStatus(a.navn, "Aktiv")}>
                      <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-xs font-semibold mr-2">I oppdrag</span>
                      Sett til aktiv
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSetOppdragStatus(a.navn, "Oppstart")}>
                      <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 text-xs font-semibold mr-2">Oppstart</span>
                      Sett til oppstart
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleSetOppdragStatus(a.navn, null)}>
                      <span className="text-muted-foreground mr-2">—</span>
                      Ikke i oppdrag
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {/* ANSATT */}
              <div className="flex items-center gap-1">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    status === "Aktiv" && "bg-emerald-100 text-emerald-700",
                    status === "Kommende" && "bg-amber-100 text-amber-700",
                    status === "Sluttet" && "bg-muted text-muted-foreground"
                  )}
                >
                  {status}
                </span>
                {a.synlig_web && <Globe className="h-3 w-3 text-primary flex-shrink-0" />}
              </div>
              {/* KONTAKT */}
              <div className="flex flex-col min-w-0">
                <span className="text-[0.8125rem] text-muted-foreground truncate">{a.tlf}</span>
                <span className="text-[0.6875rem] text-muted-foreground/70 mt-0.5 truncate">{a.epost}</span>
              </div>
              {/* EDIT */}
              <button
                onClick={(e) => { e.stopPropagation(); openEdit(a); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
        </div>
        {filtered.length === 0 && (
          <p className="text-muted-foreground text-center py-12">Ingen ansatte å vise</p>
        )}
      </div>

      <AnsattModal open={modalOpen} onClose={() => setModalOpen(false)} ansatt={editAnsatt} />
      <AnsattDetailSheet open={detailOpen} onClose={() => setDetailOpen(false)} ansatt={detailAnsatt} onEdit={() => { setDetailOpen(false); setEditAnsatt(detailAnsatt); setModalOpen(true); }} />
    </div>
  );
}
