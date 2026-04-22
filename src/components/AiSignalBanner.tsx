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

function getBannerToneClasses(confidence: AiSignalResult["konfidens"]) {
  if (confidence === "høy") {
    return "border-[hsl(var(--primary)/0.28)] bg-[hsl(var(--primary)/0.08)] dark:border-[hsl(var(--primary)/0.4)] dark:bg-[hsl(var(--primary)/0.14)]";
  }
  if (confidence === "middels") {
    return "border-[hsl(var(--warning)/0.28)] bg-[hsl(var(--warning)/0.08)] dark:border-[hsl(var(--warning)/0.38)] dark:bg-[hsl(var(--warning)/0.12)]";
  }
  return "border-border bg-card/75 dark:bg-card/95";
}

function getAccentTextClasses(confidence: AiSignalResult["konfidens"]) {
  if (confidence === "høy") {
    return "text-[hsl(var(--primary))] dark:text-[hsl(var(--primary))]";
  }
  if (confidence === "middels") {
    return "text-[hsl(var(--warning))] dark:text-[hsl(var(--warning))]";
  }
  return "text-primary";
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
  const [addedTechs, setAddedTechs] = useState<Set<string>>(new Set());

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
  const normalizedCurrentTechnologies = normalizeTechnologyTags(currentTechnologies as string | string[] | null | undefined);
  const normalizedExisting = new Set(normalizedCurrentTechnologies.map((t) => t.toLowerCase()));
  const normalizedSuggestedTechnologies = normalizeTechnologyTags(result?.teknologier_funnet ?? []);
  const newTechs = normalizedSuggestedTechnologies.filter(
    (t) => !normalizedExisting.has(t.toLowerCase())
  );
  const remainingTechs = newTechs.filter((t) => !addedTechs.has(t.toLowerCase()));

  const hasResult = Boolean(result);
  const signalChanged = Boolean(result && result.anbefalt_signal !== currentSignal);
  const hasNewTechs = remainingTechs.length > 0;
  const isVisible = !dismissed && !loading && hasResult && !(applied && !hasNewTechs) && (signalChanged || hasNewTechs);

  useEffect(() => {
    onVisibilityChange?.(isVisible);
  }, [isVisible, onVisibilityChange]);

  // Don't show if nothing actionable
  if (!hasResult || !isVisible || hideContent) return null;

  const bannerToneClasses = getBannerToneClasses(result.konfidens);
  const accentTextClasses = getAccentTextClasses(result.konfidens);

  return (
    <div className={cn("mt-2 rounded-xl border px-3.5 py-3 shadow-sm backdrop-blur-[1px]", bannerToneClasses)}>
      <div className="flex items-start gap-2">
        <Sparkles className={cn("mt-0.5 h-3.5 w-3.5 flex-shrink-0", accentTextClasses)} />
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
          <p className="mt-0.5 text-[0.75rem] leading-relaxed text-foreground/80 dark:text-foreground/78">
            {result.begrunnelse}
          </p>

          {/* Tidsramme */}
          {result.tidsramme && (
            <div className="flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3 text-foreground/55 dark:text-foreground/60" />
              <span className="text-[0.6875rem] text-foreground/62 dark:text-foreground/68">Tidsramme: {result.tidsramme}</span>
            </div>
          )}

          {/* Nye teknologier — klikkbare for individuell tillegging */}
          {hasNewTechs && (
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              <span className="text-[0.6875rem] text-foreground/58 dark:text-foreground/64">Foreslåtte teknologier (klikk for å legge til):</span>
              {remainingTechs.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    onAddTechnologies([t]);
                    setAddedTechs((prev) => {
                      const next = new Set(prev);
                      next.add(t.toLowerCase());
                      return next;
                    });
                  }}
                  className="chip chip--tech inline-flex cursor-pointer items-center gap-1 transition-colors hover:border-[hsl(var(--primary)/0.35)] hover:bg-[hsl(var(--primary)/0.10)] hover:text-[hsl(var(--primary))] dark:hover:border-[hsl(var(--primary)/0.45)] dark:hover:bg-[hsl(var(--primary)/0.16)]"
                  title={`Legg til ${t}`}
                >
                  <Plus className="h-3 w-3" />
                  {t}
                </button>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-2 flex items-center gap-3">
            {signalChanged && !applied && (
              <button
                onClick={() => {
                  onUpdateSignal(result.anbefalt_signal);
                  setApplied(true);
                }}
                className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-[hsl(var(--primary))] transition-colors hover:text-[hsl(var(--primary)/0.8)]"
              >
                <Check className="h-3 w-3" />
                Oppdater signal
              </button>
            )}
            {hasNewTechs && (
              <button
                onClick={() => {
                  onAddTechnologies(remainingTechs);
                  setAddedTechs((prev) => {
                    const next = new Set(prev);
                    remainingTechs.forEach((t) => next.add(t.toLowerCase()));
                    return next;
                  });
                }}
                className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-[hsl(var(--primary))] transition-colors hover:text-[hsl(var(--primary)/0.8)]"
              >
                <Plus className="h-3 w-3" />
                Oppdater alle
              </button>
            )}
            <button
              onClick={() => {
                localStorage.setItem(dismissKey, new Date().toISOString());
                setDismissed(true);
              }}
              className="inline-flex items-center gap-1 text-[0.75rem] text-foreground/58 transition-colors hover:text-foreground/86 dark:text-foreground/62 dark:hover:text-foreground"
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
