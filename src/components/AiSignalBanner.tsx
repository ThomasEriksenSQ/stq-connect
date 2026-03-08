import { useState, useEffect } from "react";
import { Sparkles, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { analyzeSignal, type AiSignalResult } from "@/lib/aiSignal";

const CATEGORIES = [
  { label: "Behov nå", badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { label: "Får fremtidig behov", badgeColor: "bg-blue-100 text-blue-800 border-blue-200" },
  { label: "Får kanskje behov", badgeColor: "bg-amber-100 text-amber-800 border-amber-200" },
  { label: "Ukjent om behov", badgeColor: "bg-gray-100 text-gray-600 border-gray-200" },
  { label: "Ikke aktuelt", badgeColor: "bg-red-50 text-red-700 border-red-200" },
];

function getBadgeColor(label: string) {
  return CATEGORIES.find((c) => c.label === label)?.badgeColor || "bg-gray-100 text-gray-600 border-gray-200";
}

interface AiSignalBannerProps {
  contactId: string;
  contactName: string;
  currentSignal: string | null;
  activities: Array<{ type: string; subject: string; created_at: string }>;
  lastTaskDueDate: string | null;
  onUpdateSignal: (signal: string) => void;
}

export function AiSignalBanner({
  contactId,
  contactName,
  currentSignal,
  activities,
  lastTaskDueDate,
  onUpdateSignal,
}: AiSignalBannerProps) {
  const [result, setResult] = useState<AiSignalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [applied, setApplied] = useState(false);

  const dismissKey = `dismissed_signal_${contactId}`;

  useEffect(() => {
    const stored = localStorage.getItem(dismissKey);
    if (stored) {
      setDismissed(true);
      return;
    }

    if (activities.length === 0) return;

    let cancelled = false;
    setLoading(true);
    analyzeSignal({ currentSignal, activities, lastTaskDueDate, contactName }).then((r) => {
      if (cancelled) return;
      setResult(r);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [contactId, currentSignal, activities.length]);

  if (dismissed || applied || loading || !result) return null;
  if (result.anbefalt_signal === currentSignal) return null;

  const borderColor =
    result.konfidens === "høy"
      ? "border-blue-300 bg-blue-50/50"
      : result.konfidens === "middels"
        ? "border-amber-300 bg-amber-50/50"
        : "border-border bg-muted/30";

  return (
    <div className={cn("rounded-lg border px-3.5 py-2.5 mt-2", borderColor)}>
      <div className="flex items-start gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[0.8125rem] font-medium text-foreground">AI foreslår:</span>
            <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold", getBadgeColor(result.anbefalt_signal))}>
              {result.anbefalt_signal}
            </span>
            {result.konfidens === "lav" && (
              <span className="text-[0.6875rem] text-muted-foreground">(usikker)</span>
            )}
          </div>
          <p className="text-[0.75rem] text-muted-foreground mt-0.5">{result.begrunnelse}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <button
              onClick={() => {
                onUpdateSignal(result.anbefalt_signal);
                setApplied(true);
              }}
              className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <Check className="h-3 w-3" />
              Oppdater signal
            </button>
            <button
              onClick={() => {
                localStorage.setItem(dismissKey, new Date().toISOString());
                setDismissed(true);
              }}
              className="inline-flex items-center gap-1 text-[0.75rem] text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
              Ignorer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
