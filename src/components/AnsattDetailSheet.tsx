import { Sheet, SheetContent } from "@/components/ui/sheet";
import { getInitials, cn } from "@/lib/utils";
import { Globe, FileText, Pencil, X, Loader2, Upload, Sparkles } from "lucide-react";
import { OppdragsMatchPanel } from "@/components/OppdragsMatchPanel";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const SUPABASE_URL = "https://kbvzpcebfopqqrvmbiap.supabase.co";

interface AnsattDetailSheetProps {
  open: boolean;
  onClose: () => void;
  ansatt: any | null;
}

const SUGGESTED_TAGS = [
  "C++", "C", "Embedded", "Yocto", "Linux", "Qt", "FPGA", "Python",
  "SPI/I2C", "MCU", "Embedded Linux", "Sikkerhet", "Assembly",
  "FreeRTOS", "TrustZone",
];

const STATUS_OPTIONS = [
  { value: "AKTIV/SIGNERT", label: "Aktiv" },
  { value: "SLUTTET", label: "Sluttet" },
];

export function AnsattDetailSheet({ open, onClose, ansatt }: AnsattDetailSheetProps) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  const isCreate = ansatt === null;

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvParsing, setCvParsing] = useState(false);
  const [cvParsed, setCvParsed] = useState(false);

  const [form, setForm] = useState({
    navn: "", epost: "", tlf: "", geografi: "", status: "AKTIV/SIGNERT",
    start_dato: "", slutt_dato: "", kompetanse: [] as string[], bio: "",
    bilde_url: "", erfaring_aar: "", synlig_web: false,
  });

  // Reset form when panel opens/closes or ansatt changes
  useEffect(() => {
    if (isCreate) {
      setEditing(true);
      setForm({
        navn: "", epost: "", tlf: "", geografi: "", status: "AKTIV/SIGNERT",
        start_dato: "", slutt_dato: "", kompetanse: [],
        bilde_url: "", erfaring_aar: "",
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
        bio: ansatt.bio || "",
        bilde_url: ansatt.bilde_url || "",
        erfaring_aar: ansatt.erfaring_aar?.toString() || "",
        synlig_web: ansatt.synlig_web || false,
      });
    }
    setTagInput("");
    setCvFile(null);
    setCvParsing(false);
    setCvParsed(false);
  }, [ansatt, open]);

  const set = (key: string, val: any) => setForm((prev) => ({ ...prev, [key]: val }));

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
      geografi: form.geografi.trim() || null,
      status: form.status,
      start_dato: form.start_dato || null,
      slutt_dato: form.slutt_dato || null,
      kompetanse: form.kompetanse,
      bio: form.bio.trim() || null,
      bilde_url: form.bilde_url || null,
      erfaring_aar: form.erfaring_aar ? parseInt(form.erfaring_aar) : null,
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
    if (isCreate) {
      onClose();
    } else {
      setEditing(false);
    }
  };

  const LABEL = "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-[700px] max-w-full p-0 flex flex-col [&>button]:hidden">

        {/* ─── EDIT MODE ─── */}
        {editing ? (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[1.25rem] font-bold text-foreground">
                {isCreate ? "Ny ansatt" : `Rediger ${form.navn.split(" ")[0]}`}
              </h2>
              <button onClick={() => { if (isCreate) onClose(); else setEditing(false); }} className="text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors">
                Avbryt
              </button>
            </div>

            <div className="space-y-4">
              {/* Intern section label */}
              <p className={LABEL}>Intern (CRM)</p>

              <div>
                <label className={LABEL}>Navn</label>
                <Input value={form.navn} onChange={(e) => set("navn", e.target.value)} className="mt-1 text-[0.875rem]" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Epost</label>
                  <Input type="email" value={form.epost} onChange={(e) => set("epost", e.target.value)} className="mt-1 text-[0.875rem]" />
                </div>
                <div>
                  <label className={LABEL}>Telefon</label>
                  <Input value={form.tlf} onChange={(e) => set("tlf", e.target.value)} className="mt-1 text-[0.875rem]" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Startdato</label>
                  <Input type="date" value={form.start_dato} onChange={(e) => set("start_dato", e.target.value)} className="mt-1 text-[0.875rem]" />
                </div>
                <div>
                  <label className={LABEL}>
                    Sluttdato <span className="text-muted-foreground/50 normal-case font-normal">(valgfritt)</span>
                  </label>
                  <Input type="date" value={form.slutt_dato} onChange={(e) => set("slutt_dato", e.target.value)} className="mt-1 text-[0.875rem]" />
                </div>
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
                          : "border-border text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── PROFIL ── */}
              <div className="space-y-3 mt-6">
                <label className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Profil — vises på nettsiden
                </label>

                {/* Avatar + CV upload */}
                <div className="flex gap-4 items-start">
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
                      className={cn(
                        "border-2 border-dashed rounded-lg px-4 py-3 cursor-pointer transition-colors text-sm",
                        cvParsing
                          ? "border-primary/40 bg-primary/5"
                          : cvFile
                            ? "border-emerald-500/40 bg-emerald-500/5"
                            : "border-border hover:border-primary/40 hover:bg-primary/5"
                      )}
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
                  <label className={LABEL}>Erfaring (år)</label>
                  <Input type="number" value={form.erfaring_aar} onChange={(e) => set("erfaring_aar", e.target.value)} placeholder="15" className="mt-1 text-[0.875rem]" />
                </div>
                <div>
                  <label className={LABEL}>By / geografi</label>
                  <Input value={form.geografi} onChange={(e) => set("geografi", e.target.value)} placeholder="Oslo" className="mt-1 text-[0.875rem]" />
                </div>
              </div>

              {/* Teknologier tag input */}
              <div>
                <label className={LABEL}>Kompetanse</label>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 p-2 border border-border rounded-lg bg-background min-h-[38px]">
                  {form.kompetanse.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[0.75rem] text-foreground">
                      {t}
                      <button onClick={() => set("kompetanse", form.kompetanse.filter((x) => x !== t))} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    placeholder={form.kompetanse.length === 0 ? "Legg til kompetanse..." : ""}
                    className="flex-1 min-w-[100px] bg-transparent outline-none text-[0.8125rem] placeholder:text-muted-foreground"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {SUGGESTED_TAGS.filter((s) => !form.kompetanse.includes(s)).slice(0, 10).map((s) => (
                    <button key={s} onClick={() => addTag(s)} className="h-6 px-2 text-[0.6875rem] rounded-full border border-border text-muted-foreground hover:bg-secondary transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={LABEL}>Kort bio</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => set("bio", e.target.value)}
                  placeholder="2-3 setninger om bakgrunn og spesialitet..."
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              {/* Synlig på web */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-[0.875rem] font-medium">Vis på stacq.no</p>
                  <p className="text-xs text-muted-foreground">Profilen vises på nettsidens konsulentside</p>
                </div>
                <Switch checked={form.synlig_web} onCheckedChange={(v) => set("synlig_web", v)} />
              </div>
            </div>

            {/* Save / Cancel footer */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <button onClick={() => { if (isCreate) onClose(); else setEditing(false); }} className="text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors">
                Avbryt
              </button>
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
          </div>
        ) : (
          /* ─── VIEW MODE ─── */
          <>
            {/* Header */}
            <div className="px-6 py-5 border-b border-border">
              <div className="flex items-center gap-3">
                {ansatt?.bilde_url ? (
                  <img src={ansatt.bilde_url} alt={ansatt.navn} className="w-12 h-12 rounded-full object-cover border border-border" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
                    {getInitials(ansatt?.navn || "")}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-[1.25rem] font-bold text-foreground truncate">{ansatt?.navn}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    {ansatt?.synlig_web && (
                      <span className="inline-flex items-center gap-1 text-[0.6875rem] text-primary">
                        <Globe className="h-3 w-3" />
                        Synlig på web
                      </span>
                    )}
                    {ansatt?.geografi && (
                      <span className="text-[0.8125rem] text-muted-foreground">{ansatt.geografi}</span>
                    )}
                  </div>
                </div>
                {/* Edit button */}
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-[0.8125rem] text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors shrink-0"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Rediger
                </button>
              </div>

              {/* Tech tags */}
              {ansatt?.kompetanse?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {ansatt.kompetanse.map((t: string) => (
                    <span key={t} className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-[0.75rem] font-medium text-foreground">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* CV status badge */}
              <div className="mt-3">
                {ansatt?.bio ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-0.5 text-[0.75rem] font-medium">
                    <FileText className="h-3 w-3" />
                    CV/bio tilgjengelig
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-[0.75rem] font-medium">
                    <FileText className="h-3 w-3" />
                    Ingen CV
                  </span>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <OppdragsMatchPanel
                konsulent={{
                  navn: ansatt?.navn || "",
                  teknologier: ansatt?.kompetanse || [],
                  cv_tekst: ansatt?.bio || null,
                  geografi: ansatt?.geografi || null,
                  ansatt_id: ansatt?.id,
                }}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
