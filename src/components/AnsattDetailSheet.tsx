import { Sheet, SheetContent } from "@/components/ui/sheet";
import { getInitials, cn } from "@/lib/utils";
import { FileText, Pencil, X, Loader2, Upload, Sparkles, Target } from "lucide-react";
import { format, differenceInMonths } from "date-fns";
import { nb } from "date-fns/locale";
import { formatMonths } from "@/lib/utils";
import { OppdragsMatchPanel } from "@/components/OppdragsMatchPanel";
import { getEffectiveSignal } from "@/lib/categoryUtils";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { normalizeTechnologyTags } from "@/lib/technologyTags";

const SUPABASE_URL = "https://kbvzpcebfopqqrvmbiap.supabase.co";

interface AnsattDetailSheetProps {
  open: boolean;
  onClose: () => void;
  ansatt: any | null;
  openInEditMode?: boolean;
  autoRunMatch?: boolean;
}

const SUGGESTED_TAGS = [
  "C++",
  "C",
  "Embedded",
  "Yocto",
  "Linux",
  "Qt",
  "FPGA",
  "Python",
  "SPI/I2C",
  "MCU",
  "Embedded Linux",
  "Sikkerhet",
  "Assembly",
  "FreeRTOS",
  "TrustZone",
];

const STATUS_OPTIONS = [
  { value: "AKTIV/SIGNERT", label: "Aktiv" },
  { value: "SLUTTET", label: "Sluttet" },
];

export function AnsattDetailSheet({ open, onClose, ansatt, openInEditMode, autoRunMatch }: AnsattDetailSheetProps) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  const isCreate = ansatt === null;

  const [editing, setEditing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvParsing, setCvParsing] = useState(false);
  const [cvParsed, setCvParsed] = useState(false);
  const [finnLeads, setFinnLeads] = useState(false);
  const [leadsResults, setLeadsResults] = useState<any[] | null>(null);
  const [leadsLoading, setLeadsLoading] = useState(false);

  const [form, setForm] = useState({
    navn: "",
    epost: "",
    tlf: "",
    geografi: "",
    status: "AKTIV/SIGNERT",
    start_dato: "",
    slutt_dato: "",
    kompetanse: [] as string[],
    bilde_url: "",
    erfaring_aar: "",
    tilgjengelig_fra: "",
  });
  const kompetanseStyresAvCv = !isCreate && Boolean(ansatt?.cv_profil_hentet);

  // Reset form when panel opens/closes or ansatt changes
  useEffect(() => {
    if (isCreate) {
      setEditing(true);
      setForm({
        navn: "",
        epost: "",
        tlf: "",
        geografi: "",
        status: "AKTIV/SIGNERT",
        start_dato: "",
        slutt_dato: "",
        kompetanse: [],
        bilde_url: "",
        erfaring_aar: "",
        tilgjengelig_fra: "",
      });
    } else if (ansatt) {
      setEditing(false);
      setForm({
        navn: ansatt.navn || "",
        epost: ansatt.epost || "",
        tlf: ansatt.tlf || "",
        geografi: ansatt.geografi || "",
        status: ansatt.status || "AKTIV/SIGNERT",
        start_dato: ansatt.start_dato || "",
        slutt_dato: ansatt.slutt_dato || "",
        kompetanse: ansatt.kompetanse || [],
        bilde_url: ansatt.bilde_url || "",
        erfaring_aar: ansatt.erfaring_aar?.toString() || "",
        tilgjengelig_fra: ansatt.tilgjengelig_fra || "",
      });
    }
    setTagInput("");
    setCvFile(null);
    setCvParsing(false);
    setCvParsed(false);
  }, [ansatt, open]);

  // Open directly in edit mode when requested
  useEffect(() => {
    if (open && ansatt && openInEditMode) {
      setEditing(true);
    }
  }, [open, ansatt, openInEditMode]);

  const handleSyncFromCV = async () => {
    if (!ansatt?.id) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-cv-kompetanse", {
        body: { ansatt_id: ansatt.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (Array.isArray(data?.kompetanse)) set("kompetanse", normalizeTechnologyTags(data.kompetanse));
      toast.success(`${data.count} kompetanser hentet fra CV`);
      queryClient.invalidateQueries({ queryKey: ["stacq-ansatte"] });
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke synkronisere");
    } finally {
      setSyncing(false);
    }
  };

  const set = (key: string, val: any) => setForm((prev) => ({ ...prev, [key]: val }));

  const addTag = (tag: string) => {
    const normalized = normalizeTechnologyTags(tag);
    if (normalized.length > 0) {
      set("kompetanse", normalizeTechnologyTags([...form.kompetanse, ...normalized]));
    }
    setTagInput("");
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Maks 5 MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${ansatt?.id || "new"}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("ansatte-bilder").upload(path, file, { upsert: true });
    setUploading(false);
    if (error) {
      toast.error("Opplasting feilet");
      return;
    }
    const url = `${SUPABASE_URL}/storage/v1/object/public/ansatte-bilder/${path}`;
    set("bilde_url", url);
  };

  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Maks 10 MB");
      return;
    }
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
      if (data.kompetanse?.length) set("kompetanse", normalizeTechnologyTags(data.kompetanse));
      if (data.geografi) set("geografi", data.geografi);
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
      geografi: form.geografi.trim() || null,
      status: form.status,
      start_dato: form.start_dato || null,
      slutt_dato: form.slutt_dato || null,
      kompetanse: normalizeTechnologyTags(form.kompetanse),
      bilde_url: form.bilde_url || null,
      erfaring_aar: form.erfaring_aar ? parseInt(form.erfaring_aar) : null,
      tilgjengelig_fra: form.tilgjengelig_fra || null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (isCreate) {
      ({ error } = await supabase.from("stacq_ansatte").insert(payload));
    } else {
      ({ error } = await supabase.from("stacq_ansatte").update(payload).eq("id", ansatt.id));
    }
    setSaving(false);
    if (error) {
      toast.error("Kunne ikke lagre");
      return;
    }
    toast.success(isCreate ? "Ansatt lagt til" : "Profil oppdatert");
    queryClient.invalidateQueries({ queryKey: ["stacq-ansatte"] });
    if (isCreate) {
      onClose();
    } else {
      setEditing(false);
    }
  };

  const handleFinnLeads = async () => {
    if (!ansatt) return;
    setLeadsLoading(true);
    setLeadsResults(null);
    try {
      const { data: kontakter } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, title, company_id, call_list, teknologier, companies(name)")
        .not("teknologier", "eq", "{}")
        .limit(200);

      if (!kontakter?.length) {
        toast("Ingen kontakter med teknisk profil ennå");
        setLeadsLoading(false);
        return;
      }

      const kontaktIds = kontakter.map((k: any) => k.id);

      const [{ data: aktiviteter }, { data: tasks }] = await Promise.all([
        supabase
          .from("activities")
          .select("contact_id, created_at, subject, description")
          .in("contact_id", kontaktIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("tasks")
          .select("contact_id, created_at, title, description, due_date")
          .in("contact_id", kontaktIds)
          .neq("status", "done"),
      ]);

      const berikede = kontakter.map((k: any) => {
        const kAkts = (aktiviteter || []).filter((a: any) => a.contact_id === k.id);
        const kTasks = (tasks || []).filter((t: any) => t.contact_id === k.id);
        const signal = getEffectiveSignal(
          kAkts.map((a: any) => ({ created_at: a.created_at, subject: a.subject, description: a.description })),
          kTasks.map((t: any) => ({
            created_at: t.created_at,
            title: t.title,
            description: t.description,
            due_date: t.due_date,
          })),
        );
        const sisteKontakt = kAkts[0]?.created_at
          ? new Date(kAkts[0].created_at).toLocaleDateString("nb-NO", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : null;
        return {
          id: k.id,
          navn: `${k.first_name} ${k.last_name}`,
          selskap: (k.companies as any)?.name || "",
          stilling: k.title || "",
          er_innkjoper: k.call_list || false,
          teknologier: k.teknologier || [],
          signal: signal || "Ukjent om behov",
          siste_kontakt: sisteKontakt,
        };
      });

      const { data, error } = await supabase.functions.invoke("match-contacts-for-consultant", {
        body: {
          konsulent: {
            navn: ansatt.navn,
            teknologier: ansatt.kompetanse || [],
            erfaring_aar: ansatt.erfaring_aar || null,
            geografi: ansatt.geografi || null,
            tilgjengelig_fra: ansatt.tilgjengelig_fra || null,
          },
          kontakter: berikede,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLeadsResults(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke kjøre matching");
      setLeadsResults([]);
    } finally {
      setLeadsLoading(false);
    }
  };

  const LABEL = "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <SheetContent side="right" className="w-[840px] sm:w-[920px] p-0 flex flex-col [&>button]:hidden">
        {/* ─── EDIT MODE ─── */}
        {editing ? (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[1.25rem] font-bold text-foreground">
                {isCreate ? "Ny ansatt" : `Rediger ${form.navn.split(" ")[0]}`}
              </h2>
            </div>

            <div className="space-y-4">
              {/* Intern section label */}

              <div>
                <label className={LABEL}>Navn</label>
                <Input
                  value={form.navn}
                  onChange={(e) => set("navn", e.target.value)}
                  className="mt-1 text-[0.875rem]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Epost</label>
                  <Input
                    type="email"
                    value={form.epost}
                    onChange={(e) => set("epost", e.target.value)}
                    className="mt-1 text-[0.875rem]"
                  />
                </div>
                <div>
                  <label className={LABEL}>Telefon</label>
                  <Input
                    value={form.tlf}
                    onChange={(e) => set("tlf", e.target.value)}
                    className="mt-1 text-[0.875rem]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Startdato</label>
                  <Input
                    type="date"
                    value={form.start_dato}
                    onChange={(e) => set("start_dato", e.target.value)}
                    className="mt-1 text-[0.875rem]"
                  />
                </div>
                <div>
                  <label className={LABEL}>
                    Sluttdato <span className="text-muted-foreground/50 normal-case font-normal">(valgfritt)</span>
                  </label>
                  <Input
                    type="date"
                    value={form.slutt_dato}
                    onChange={(e) => set("slutt_dato", e.target.value)}
                    className="mt-1 text-[0.875rem]"
                  />
                </div>
              </div>

              <div>
                <label className={LABEL}>Tilgjengelig fra</label>
                <Input
                  type="date"
                  value={form.tilgjengelig_fra}
                  onChange={(e) => set("tilgjengelig_fra", e.target.value)}
                  className="mt-1 text-[0.875rem]"
                />

                <p className="text-[0.6875rem] text-muted-foreground mt-1">
                  Når kan konsulenten starte et nytt oppdrag? (kan være etter fornyelsesdato)
                </p>
              </div>

              <div>
                <label className={cn(LABEL, "mb-1.5 block")}>Status</label>
                <div className="flex gap-2">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => set("status", s.value)}
                      className={cn(
                        "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors",
                        form.status === s.value
                          ? "bg-foreground text-background border-foreground"
                          : "border-border text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── PROFIL ── */}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Erfaring (år)</label>
                  <Input
                    type="number"
                    value={form.erfaring_aar}
                    onChange={(e) => set("erfaring_aar", e.target.value)}
                    placeholder="15"
                    className="mt-1 text-[0.875rem]"
                  />
                </div>
                <div>
                  <label className={LABEL}>By / geografi</label>
                  <Input
                    value={form.geografi}
                    onChange={(e) => set("geografi", e.target.value)}
                    placeholder="Oslo"
                    className="mt-1 text-[0.875rem]"
                  />
                </div>
              </div>

              {/* Teknologier tag input */}
              <div>
                <div className="flex items-center justify-between gap-3">
                  <label className={LABEL}>Kompetanse</label>
                  {kompetanseStyresAvCv && (
                    <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      CV-styrt
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[0.75rem] text-muted-foreground">
                  {kompetanseStyresAvCv
                    ? "Dette feltet oppdateres automatisk fra CV-editoren. Endre teknologier i CV-en for å oppdatere kompetansen her."
                    : "Legg til kompetanse manuelt, eller hent den fra CV når CV-en er klar."}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 p-2 border border-border rounded-lg bg-background min-h-[38px]">
                  {form.kompetanse.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[0.75rem] text-foreground"
                    >
                      {t}
                      {!kompetanseStyresAvCv && (
                        <button
                          onClick={() =>
                            set(
                              "kompetanse",
                              form.kompetanse.filter((x) => x !== t),
                            )
                          }
                          className="hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    disabled={kompetanseStyresAvCv}
                    placeholder={
                      kompetanseStyresAvCv
                        ? "Kompetanse styres av CV-editoren"
                        : form.kompetanse.length === 0
                          ? "Legg til kompetanse..."
                          : ""
                    }
                    className="flex-1 min-w-[100px] bg-transparent outline-none text-[0.8125rem] placeholder:text-muted-foreground"
                  />
                </div>
                {!kompetanseStyresAvCv && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {SUGGESTED_TAGS.filter((s) => !form.kompetanse.includes(s))
                      .slice(0, 10)
                      .map((s) => (
                        <button
                          key={s}
                          onClick={() => addTag(s)}
                          className="h-6 px-2 text-[0.6875rem] rounded-full border border-border text-muted-foreground hover:bg-secondary transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Save / Cancel footer */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <button
                onClick={() => {
                  if (isCreate) onClose();
                  else setEditing(false);
                }}
                className="text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors"
              >
                Avbryt
              </button>
              <button
                disabled={!form.navn.trim() || saving}
                onClick={handleSave}
                className={cn(
                  "inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg transition-colors",
                  form.navn.trim() && !saving
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "bg-muted text-muted-foreground cursor-not-allowed",
                )}
              >
                {saving ? "Lagrer..." : "Lagre"}
              </button>
            </div>
          </div>
        ) : (
          /* ─── VIEW MODE ─── */
          <>
            {/* Header */}
            <div className="px-6 py-5 border-b border-border">
              <div className="flex items-center gap-3">
                {ansatt?.bilde_url ? (
                  <img
                    src={ansatt.bilde_url}
                    alt={ansatt.navn}
                    className="w-12 h-12 rounded-full object-cover border border-border"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
                    {getInitials(ansatt?.navn || "")}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-[1.25rem] font-bold text-foreground truncate">{ansatt?.navn}</h2>
                </div>
              </div>

              {/* Tech tags */}
              {ansatt?.kompetanse?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {ansatt.kompetanse.map((t: string) => (
                    <span
                      key={t}
                      className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-[0.75rem] font-medium text-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {ansatt?.tilgjengelig_fra && (
                <div className="mt-3 flex items-center gap-2 text-[0.8125rem]">
                  <span className="text-muted-foreground">Tilgjengelig fra:</span>
                  <span
                    className={cn(
                      "font-medium",
                      (() => {
                        const dager = Math.round(
                          (new Date(ansatt.tilgjengelig_fra).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                        );
                        if (dager <= 0) return "text-emerald-600";
                        if (dager <= 30) return "text-amber-600";
                        return "text-muted-foreground";
                      })(),
                    )}
                  >
                    {(() => {
                      const dager = Math.round(
                        (new Date(ansatt.tilgjengelig_fra).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                      );
                      if (dager <= 0) return "Tilgjengelig nå";
                      if (dager <= 30)
                        return `Om ${dager} dager (${format(new Date(ansatt.tilgjengelig_fra), "d. MMM yyyy", { locale: nb })})`;
                      return format(new Date(ansatt.tilgjengelig_fra), "d. MMMM yyyy", { locale: nb });
                    })()}
                  </span>
                </div>
              )}

              {/* Synkroniser kompetanse fra CV */}
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={handleSyncFromCV}
                  disabled={syncing}
                  className="inline-flex items-center gap-1.5 h-7 px-3 text-[0.75rem] font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {syncing ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Synkroniserer...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3" />
                      Synkroniser kompetanse fra CV
                    </>
                  )}
                </button>
                {ansatt?.cv_profil_hentet && (
                  <span className="text-[0.6875rem] text-muted-foreground">✓ Hentet fra CV</span>
                )}
              </div>
              {ansatt?.cv_profil_hentet && (
                <p className="mt-2 text-[0.75rem] text-muted-foreground">
                  Kompetansefeltet styres av CV-editoren. Endringer gjøres i CV-en og synkroniseres hit automatisk.
                </p>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div>
                <OppdragsMatchPanel
                  konsulent={{
                    navn: ansatt?.navn || "",
                    teknologier: ansatt?.kompetanse || [],
                    cv_tekst: ansatt?.bio || null,
                    geografi: ansatt?.geografi || null,
                    ansatt_id: ansatt?.id,
                    forny_dato: ansatt?.forny_dato || null,
                    erfaring_aar: ansatt?.erfaring_aar || null,
                    tilgjengelig_fra: ansatt?.tilgjengelig_fra || null,
                  }}
                  autoRunMatch={autoRunMatch}
                />
              </div>

              {/* Finn leads */}
              <div className="mt-6">
                <button
                  onClick={() => {
                    setFinnLeads(!finnLeads);
                    if (!finnLeads && !leadsResults) handleFinnLeads();
                  }}
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-[0.8125rem] font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full justify-center"
                >
                  {leadsLoading ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Finner leads...
                    </>
                  ) : (
                    <>
                      <Target className="h-3 w-3 text-primary" />
                      Finn leads for {ansatt?.navn?.split(" ")[0]}
                    </>
                  )}
                </button>

                {finnLeads && leadsResults !== null && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Beste leads · {leadsResults.length}
                      </span>
                      <button
                        onClick={handleFinnLeads}
                        className="text-[0.6875rem] text-muted-foreground hover:text-foreground"
                      >
                        Kjør på nytt
                      </button>
                    </div>

                    {leadsResults.length === 0 ? (
                      <p className="text-[0.8125rem] text-muted-foreground">Ingen treff</p>
                    ) : (
                      leadsResults.map((m: any, i: number) => (
                        <div key={`lead-${m.id || i}`} className="rounded-lg border border-border bg-card p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[0.75rem] font-bold text-muted-foreground">#{i + 1}</span>
                              <span className="text-[0.8125rem] font-semibold text-foreground truncate">{m.navn}</span>
                              {m.er_innkjoper && (
                                <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[0.625rem] font-semibold shrink-0">
                                  INN
                                </span>
                              )}
                            </div>
                            <p className="text-[0.75rem] text-muted-foreground truncate">{m.selskap}</p>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <div className="flex flex-wrap gap-1">
                              {(m.match_tags || []).map((t: string) => (
                                <span
                                  key={t}
                                  className="inline-flex items-center rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[0.625rem] font-medium"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className={cn(
                                  "inline-block h-2 w-2 rounded-full",
                                  m.score >= 8 ? "bg-emerald-500" : m.score >= 6 ? "bg-amber-500" : "bg-red-500",
                                )}
                              />
                              <span className="text-[0.75rem] font-bold">{m.score}/10</span>
                            </div>
                          </div>
                          <p className="text-[0.75rem] text-muted-foreground mt-1 italic">{m.begrunnelse}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
