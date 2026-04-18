import { useState, useEffect } from "react";
import { Sparkles, Check, X, Plus, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { analyzeSignal, type AiSignalResult } from "@/lib/aiSignal";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeTechnologyTags } from "@/lib/technologyTags";
import { normalizeOutlookMailItems } from "@/lib/outlookMail";

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
  contactEmail: string | null;
  currentSignal: string | null;
  currentTechnologies: unknown;
  activities: Array<{ type: string; subject: string; created_at: string }>;
  lastTaskDueDate: string | null;
  onUpdateSignal: (signal: string) => void;
  onAddTechnologies: (techs: string[]) => void;
  onVisibilityChange?: (visible: boolean) => void;
  hideContent?: boolean;
}

export function AiSignalBanner({
  contactId,
  contactName,
  contactEmail,
  currentSignal,
  currentTechnologies,
  activities,
  lastTaskDueDate,
  onUpdateSignal,
  onAddTechnologies,
  onVisibilityChange,
  hideContent = false,
}: AiSignalBannerProps) {
  const [result, setResult] = useState<AiSignalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [applied, setApplied] = useState(false);
  const [techsAdded, setTechsAdded] = useState(false);

  const dismissKey = `dismissed_signal_${contactId}`;

  // Fetch emails for analysis (separate cache key to avoid collision with timeline)
  const { data: outlookEmails = [] } = useQuery({
    queryKey: ["email-puls-emails", contactEmail],
    queryFn: async () => {
      if (!contactEmail) return [];
      const { data, error } = await supabase.functions.invoke("outlook-mail", {
        body: { email: contactEmail },
      });
      if (error) return [];
      return normalizeOutlookMailItems(data?.emails).map((email) => ({
        subject: email.subject,
        body_text: email.bodyText,
        received_at: email.receivedAt || "",
      }));
    },
    enabled: !!contactEmail,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const stored = localStorage.getItem(dismissKey);
    if (stored) {
      setDismissed(true);
      return;
    }

    if (activities.length === 0 && outlookEmails.length === 0) return;

    let cancelled = false;
    setLoading(true);
    analyzeSignal({
      currentSignal,
      activities,
      lastTaskDueDate,
      contactName,
      emails: outlookEmails,
      currentTechnologies,
    }).then((r) => {
      if (cancelled) return;
      setResult(r);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [contactId, currentSignal, activities.length, outlookEmails.length]);

  // Filter new technologies not already on contact
  const normalizedCurrentTechnologies = normalizeTechnologyTags(currentTechnologies);
  const normalizedExisting = new Set(normalizedCurrentTechnologies.map((t) => t.toLowerCase()));
  const normalizedSuggestedTechnologies = normalizeTechnologyTags(result?.teknologier_funnet ?? []);
  const newTechs = normalizedSuggestedTechnologies.filter(
    (t) => !normalizedExisting.has(t.toLowerCase())
  );

  const hasResult = Boolean(result);
  const signalChanged = Boolean(result && result.anbefalt_signal !== currentSignal);
  const hasNewTechs = newTechs.length > 0 && !techsAdded;
  const isVisible = !dismissed && !loading && hasResult && !(applied && !hasNewTechs) && (signalChanged || hasNewTechs);

  useEffect(() => {
    onVisibilityChange?.(isVisible);
  }, [isVisible, onVisibilityChange]);

  // Don't show if nothing actionable
  if (!hasResult || !isVisible || hideContent) return null;

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
            {signalChanged && !applied && (
              <span className="chip chip--action is-signal">
                {result.anbefalt_signal}
              </span>
            )}
            {result.konfidens === "lav" && (
              <span className="text-[0.6875rem] text-muted-foreground">(usikker)</span>
            )}
          </div>

          <p className="text-[0.75rem] text-muted-foreground mt-0.5">{result.begrunnelse}</p>

          {/* Tidsramme */}
          {result.tidsramme && (
            <div className="flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-[0.6875rem] text-muted-foreground">Tidsramme: {result.tidsramme}</span>
            </div>
          )}

          {/* Nye teknologier */}
          {hasNewTechs && (
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              <span className="text-[0.6875rem] text-muted-foreground">Teknologier:</span>
              {newTechs.map((t) => (
                <span
                  key={t}
                  className="chip chip--tech"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 mt-1.5">
            {signalChanged && !applied && (
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
            )}
            {hasNewTechs && (
              <button
                onClick={() => {
                  onAddTechnologies(newTechs);
                  setTechsAdded(true);
                }}
                className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Legg til teknologier
              </button>
            )}
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
