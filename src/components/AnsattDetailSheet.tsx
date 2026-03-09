import { Sheet, SheetContent } from "@/components/ui/sheet";
import { getInitials, cn } from "@/lib/utils";
import { Globe, FileText, Pencil, X } from "lucide-react";
import { OppdragsMatchPanel } from "@/components/OppdragsMatchPanel";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

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
  { value: "KOMMENDE", label: "Kommende" },
  { value: "SLUTTET", label: "Sluttet" },
];

export function AnsattDetailSheet({ open, onClose, ansatt }: AnsattDetailSheetProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [form, setForm] = useState({
    navn: "", epost: "", tlf: "", geografi: "", status: "AKTIV/SIGNERT",
    start_dato: "", kompetanse: [] as string[], bio: "",
  });

  // Reset edit mode when panel opens/closes or ansatt changes
  useEffect(() => {
    setEditing(false);
    if (ansatt) {
      setForm({
        navn: ansatt.navn || "",
        epost: ansatt.epost || "",
        tlf: ansatt.tlf || "",
        geografi: ansatt.geografi || "",
        status: ansatt.status || "AKTIV/SIGNERT",
        start_dato: ansatt.start_dato || "",
        kompetanse: ansatt.kompetanse || [],
        bio: ansatt.bio || "",
      });
    }
  }, [ansatt, open]);

  if (!ansatt) return null;

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

  const handleSave = async () => {
    if (!form.navn.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("stacq_ansatte")
      .update({
        navn: form.navn.trim(),
        epost: form.epost.trim() || null,
        tlf: form.tlf.trim() || null,
        geografi: form.geografi.trim() || null,
        status: form.status,
        start_dato: form.start_dato || null,
        kompetanse: form.kompetanse,
        bio: form.bio.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ansatt.id);
    setSaving(false);
    if (error) { toast.error("Kunne ikke lagre"); return; }
    toast.success("Profil oppdatert");
    queryClient.invalidateQueries({ queryKey: ["stacq-ansatte"] });
    setEditing(false);
  };

  const LABEL = "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-[520px] max-w-full p-0 flex flex-col [&>button]:hidden">

        {/* ─── EDIT MODE ─── */}
        {editing ? (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[1.25rem] font-bold text-foreground">Rediger {form.navn.split(" ")[0]}</h2>
              <button onClick={() => setEditing(false)} className="text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors">
                Avbryt
              </button>
            </div>

            <div className="space-y-4">
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

              <div>
                <label className={LABEL}>Sted</label>
                <Input value={form.geografi} onChange={(e) => set("geografi", e.target.value)} className="mt-1 text-[0.875rem]" placeholder="Oslo" />
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

              <div>
                <label className={LABEL}>Ansettelsesdato</label>
                <Input type="date" value={form.start_dato} onChange={(e) => set("start_dato", e.target.value)} className="mt-1 text-[0.875rem]" />
              </div>

              {/* Teknologier tag input */}
              <div>
                <label className={LABEL}>Teknologier</label>
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
                    placeholder={form.kompetanse.length === 0 ? "Legg til..." : ""}
                    className="flex-1 min-w-[80px] bg-transparent outline-none text-[0.8125rem] placeholder:text-muted-foreground"
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
                <label className={LABEL}>Kommentar / Bio</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => set("bio", e.target.value)}
                  placeholder="2-3 setninger om bakgrunn og spesialitet..."
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
            </div>

            {/* Save / Cancel footer */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <button onClick={() => setEditing(false)} className="text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors">
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
          /* ─── VIEW MODE (unchanged) ─── */
          <>
            {/* Header */}
            <div className="px-6 py-5 border-b border-border">
              <div className="flex items-center gap-3">
                {ansatt.bilde_url ? (
                  <img src={ansatt.bilde_url} alt={ansatt.navn} className="w-12 h-12 rounded-full object-cover border border-border" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
                    {getInitials(ansatt.navn)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-[1.25rem] font-bold text-foreground truncate">{ansatt.navn}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    {ansatt.synlig_web && (
                      <span className="inline-flex items-center gap-1 text-[0.6875rem] text-primary">
                        <Globe className="h-3 w-3" />
                        Synlig på web
                      </span>
                    )}
                    {ansatt.geografi && (
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
              {ansatt.kompetanse?.length > 0 && (
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
                {ansatt.bio ? (
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
                  navn: ansatt.navn,
                  teknologier: ansatt.kompetanse || [],
                  cv_tekst: ansatt.bio || null,
                  geografi: ansatt.geografi || null,
                  ansatt_id: ansatt.id,
                }}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
