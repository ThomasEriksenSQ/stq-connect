import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays } from "date-fns";
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function FornyelsesVarsel() {
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const { data: oppdrag = [] } = useQuery({
    queryKey: ["fornyelse-varsel"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("stacq_oppdrag")
        .select("id, kandidat, kunde, forny_dato, status")
        .neq("status", "Inaktiv")
        .not("forny_dato", "is", null)
        .order("forny_dato");
      return data || [];
    },
  });

  const today = new Date();
  const upcoming = oppdrag
    .map((o) => {
      const daysUntilForny = differenceInDays(new Date(o.forny_dato!), today);
      return { ...o, daysUntilForny };
    })
    .filter((o) => o.daysUntilForny <= 30)
    .sort((a, b) => a.daysUntilForny - b.daysUntilForny);

  // Hide rules
  if (upcoming.length === 0 || dismissed || location.pathname === "/") return null;

  const hasCritical = upcoming.some((o) => o.daysUntilForny <= 7);
  const displayItems = upcoming.slice(0, 3);
  const remaining = upcoming.length - 3;

  return (
    <div
      className={cn(
        "border-b",
        hasCritical
          ? "bg-destructive/10 border-destructive/20"
          : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
      )}
    >
      <div className="max-w-6xl mx-auto px-8 py-2 flex items-center gap-3">
        <div className="flex-1 min-w-0 flex items-center gap-0 flex-wrap text-[0.8125rem]">
          {displayItems.map((o, i) => {
            const isCrit = o.daysUntilForny <= 7;
            return (
              <span key={o.id}>
                {i > 0 && <span className={cn(hasCritical ? "text-destructive/50" : "text-amber-600/50 dark:text-amber-400/50")}> · </span>}
                <span
                  className={cn(
                    "font-medium",
                    hasCritical
                      ? isCrit
                        ? "text-destructive"
                        : "text-destructive/70"
                      : "text-amber-800 dark:text-amber-300"
                  )}
                >
                  {o.kandidat} hos {o.kunde || "ukjent"} — om {o.daysUntilForny}d
                </span>
              </span>
            );
          })}
          {remaining > 0 && (
            <span className="text-muted-foreground ml-1">og {remaining} til</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3 shrink-0">
          <button
            onClick={() => navigate("/konsulenter/i-oppdrag?filter=Aktiv")}
            className="text-[0.8125rem] font-medium text-primary hover:underline whitespace-nowrap"
          >
            Se alle →
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
