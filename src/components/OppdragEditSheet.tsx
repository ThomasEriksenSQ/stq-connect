import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn, formatNOK } from "@/lib/utils";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const LABEL = "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";
const CHIP_BASE = "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors cursor-pointer select-none font-medium";

const STATUS_OPTIONS = ["Aktiv", "Oppstart", "Inaktiv"] as const;
const TYPE_OPTIONS = [
  { value: "DIR", label: "Direkte" },
  { value: "VIA", label: "Via partner" },
  { value: "VIA_M", label: "Via megler" },
] as const;

export function OppdragEditSheet({
  row,
  onClose,
}: {
  row: any;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  // Form state
  const [status, setStatus] = useState("");
  const [dealType, setDealType] = useState("");
  const [utpris, setUtpris] = useState("");
  const [tilKonsulent, setTilKonsulent] = useState("");
  const [fornyDato, setFornyDato] = useState<Date | undefined>();
  const [startDato, setStartDato] = useState<Date | undefined>();
  const [kommentar, setKommentar] = useState("");

  // Confirm terminate
  const [confirmTerminate, setConfirmTerminate] = useState(false);

  // Sync form on row change
  useEffect(() => {
    if (row) {
      setStatus(row.status || "Aktiv");
      setDealType(row.deal_type || "DIR");
      setUtpris(String(row.utpris || ""));
      setTilKonsulent(String(row.til_konsulent || ""));
      setFornyDato(row.forny_dato ? new Date(row.forny_dato) : undefined);
      setStartDato(row.start_dato ? new Date(row.start_dato) : undefined);
      setKommentar("");
      setConfirmTerminate(false);
    }
  }, [row?.id]);

  if (!row) return null;

  // Live margin calculation
  const ut = Number(utpris) || 0;
  const inn = Number(tilKonsulent) || 0;
  const marginPerTime = ut - inn;
  const marginPct = ut > 0 ? (marginPerTime / ut) * 100 : 0;

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    const { error } = await supabase
      .from("stacq_oppdrag")
      .update({
        status,
        deal_type: dealType,
        utpris: Number(utpris) || null,
        til_konsulent: Number(tilKonsulent) || null,
        forny_dato: fornyDato ? format(fornyDato, "yyyy-MM-dd") : null,
        start_dato: startDato ? format(startDato, "yyyy-MM-dd") : null,
      })
      .eq("id", row.id);
    setSaving(false);
    if (error) {
      toast.error("Kunne ikke oppdatere oppdrag");
      return;
    }
    toast.success("Oppdrag oppdatert");
    queryClient.invalidateQueries({ queryKey: ["stacq-oppdrag"] });
    onClose();
  };

  const handleTerminate = async () => {
    const { error } = await supabase
      .from("stacq_oppdrag")
      .update({ status: "Inaktiv", slutt_dato: format(new Date(), "yyyy-MM-dd") })
      .eq("id", row.id);
    if (error) {
      toast.error("Kunne ikke avslutte oppdrag");
      return;
    }
    toast.success("Oppdrag avsluttet");
    queryClient.invalidateQueries({ queryKey: ["stacq-oppdrag"] });
    onClose();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border">
        <h2 className="text-[1.25rem] font-bold text-foreground">{row.kandidat}</h2>
        <p className="text-[0.875rem] text-foreground/70 mt-0.5">{row.kunde || "Ukjent kunde"}</p>
        {row.created_at && (
          <p className="text-[0.75rem] text-muted-foreground mt-1">
            Opprettet {format(new Date(row.created_at), "d. MMM yyyy", { locale: nb })}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* STATUS */}
        <div>
          <p className={LABEL}>Status</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  CHIP_BASE,
                  status === s
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:bg-secondary"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* TYPE */}
        <div>
          <p className={LABEL}>Type</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            {TYPE_OPTIONS.map((t) => (
              <button
                key={t.value}
                onClick={() => setDealType(t.value)}
                className={cn(
                  CHIP_BASE,
                  dealType === t.value
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:bg-secondary"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* UTPRIS */}
        <div>
          <label className={LABEL}>Utpris / time</label>
          <Input
            type="number"
            value={utpris}
            onChange={(e) => setUtpris(e.target.value)}
            className="mt-1 text-[0.875rem]"
            placeholder="f.eks. 1550"
          />
        </div>

        {/* INNPRIS */}
        <div>
          <label className={LABEL}>Innpris / time</label>
          <Input
            type="number"
            value={tilKonsulent}
            onChange={(e) => setTilKonsulent(e.target.value)}
            className="mt-1 text-[0.875rem]"
            placeholder="f.eks. 1100"
          />
        </div>

        {/* MARGIN PREVIEW */}
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className={LABEL}>Margin (beregnet)</p>
          <p className={cn(
            "text-[1.0625rem] font-bold mt-1",
            marginPerTime > 0 ? "text-emerald-600" : marginPerTime < 0 ? "text-destructive" : "text-foreground"
          )}>
            kr {formatNOK(marginPerTime)}/t · {marginPct.toFixed(1)}%
          </p>
        </div>

        {/* FORNY DATO */}
        <div>
          <label className={LABEL}>Fornyes / utløper</label>
          <div className="mt-1">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "w-full h-9 px-3 rounded-lg border border-border bg-background text-left text-[0.875rem] flex items-center gap-2",
                    !fornyDato && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  {fornyDato ? format(fornyDato, "d. MMMM yyyy", { locale: nb }) : "Velg dato"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fornyDato}
                  onSelect={setFornyDato}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* STARTDATO */}
        <div>
          <label className={LABEL}>Startdato</label>
          <div className="mt-1">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "w-full h-9 px-3 rounded-lg border border-border bg-background text-left text-[0.875rem] flex items-center gap-2",
                    !startDato && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  {startDato ? format(startDato, "d. MMMM yyyy", { locale: nb }) : "Velg dato"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDato}
                  onSelect={setStartDato}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* KOMMENTAR */}
        <div>
          <label className={LABEL}>Kommentar</label>
          <textarea
            value={kommentar}
            onChange={(e) => setKommentar(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            placeholder="Interne notater om oppdraget..."
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border space-y-3">
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-9 text-[0.8125rem] rounded-lg border border-border text-muted-foreground hover:bg-secondary transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-9 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "Lagrer..." : "Lagre endringer"}
          </button>
        </div>

        {status !== "Inaktiv" && (
          <div>
            {!confirmTerminate ? (
              <button
                onClick={() => setConfirmTerminate(true)}
                className="text-[0.8125rem] text-destructive hover:underline"
              >
                Avslutt oppdrag
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-[0.8125rem] text-foreground font-medium">Er du sikker?</span>
                <button
                  onClick={handleTerminate}
                  className="text-[0.8125rem] text-destructive font-medium hover:underline"
                >
                  Ja, avslutt
                </button>
                <button
                  onClick={() => setConfirmTerminate(false)}
                  className="text-[0.8125rem] text-muted-foreground hover:text-foreground"
                >
                  Avbryt
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
