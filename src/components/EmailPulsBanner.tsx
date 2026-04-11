import { useState, useEffect } from "react";
import { Mail, Check, X, Plus, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { analyzeEmailPuls, type EmailPulsResult } from "@/lib/aiEmailPuls";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

interface EmailPulsBannerProps {
  contactId: string;
  contactName: string;
  contactEmail: string | null;
  currentSignal: string | null;
  currentTechnologies: string[];
  onUpdateSignal: (signal: string) => void;
  onAddTechnologies: (techs: string[]) => void;
}

export function EmailPulsBanner({
  contactId,
  contactName,
  contactEmail,
  currentSignal,
  currentTechnologies,
  onUpdateSignal,
  onAddTechnologies,
}: EmailPulsBannerProps) {
  const [result, setResult] = useState<EmailPulsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [applied, setApplied] = useState(false);
  const [techsAdded, setTechsAdded] = useState(false);

  const dismissKey = `dismissed_email_puls_${contactId}`;

  // Reuse cached outlook emails query
  const { data: outlookEmails = [] } = useQuery({
    queryKey: ["email-puls-emails", contactEmail],
    queryFn: async () => {
      if (!contactEmail) return [];
      const { data, error } = await supabase.functions.invoke("outlook-mail", {
        body: { email: contactEmail },
      });
      if (error) return [];
      return (data?.emails || []) as Array<{ subject: string; body_text: string; received_at: string }>;
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

    if (outlookEmails.length === 0) return;

    let cancelled = false;
    setLoading(true);
    analyzeEmailPuls({
      contactName,
      currentSignal,
      currentTechnologies,
      emails: outlookEmails,
    }).then((r) => {
      if (cancelled) return;
      setResult(r);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [contactId, outlookEmails.length]);

  if (dismissed || loading || !result) return null;

  // Filter new technologies not already on contact
  const normalizedExisting = new Set(currentTechnologies.map((t) => t.toLowerCase()));
  const newTechs = (result.teknologier_funnet || []).filter(
    (t) => !normalizedExisting.has(t.toLowerCase())
  );

  const signalChanged = result.anbefalt_signal !== currentSignal;
  const hasNewTechs = newTechs.length > 0 && !techsAdded;

  // Don't show if nothing actionable
  if (applied && !hasNewTechs) return null;
  if (!signalChanged && !hasNewTechs) return null;

  const borderColor =
    result.konfidens === "høy"
      ? "border-blue-300 bg-blue-50/50"
      : result.konfidens === "middels"
        ? "border-amber-300 bg-amber-50/50"
        : "border-border bg-muted/30";

  return (
    <div className={cn("rounded-lg border px-3.5 py-2.5 mt-2", borderColor)}>
      <div className="flex items-start gap-2">
        <Mail className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[0.8125rem] font-medium text-foreground">E-post-puls:</span>
            {signalChanged && !applied && (
              <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold", getBadgeColor(result.anbefalt_signal))}>
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
                  className="inline-flex items-center rounded-full bg-secondary border border-border px-2 py-0.5 text-[0.6875rem] font-medium text-foreground"
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
