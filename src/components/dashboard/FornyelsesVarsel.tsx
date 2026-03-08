import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, format } from "date-fns";
import { nb } from "date-fns/locale";
import { cn, formatNOK } from "@/lib/utils";
import { CalendarClock, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function FornyelsesVarsel() {
  const navigate = useNavigate();

  const { data: oppdrag = [] } = useQuery({
    queryKey: ["stacq-oppdrag-fornyelser"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stacq_oppdrag")
        .select("id, kandidat, kunde, forny_dato, utpris, status")
        .in("status", ["Aktiv", "Oppstart"])
        .not("forny_dato", "is", null)
        .order("forny_dato");
      return data || [];
    },
  });

  const upcoming = oppdrag
    .map((o) => {
      const d = new Date(o.forny_dato!);
      const daysLeft = differenceInDays(d, new Date());
      return { ...o, fornyDate: d, daysLeft };
    })
    .filter((o) => o.daysLeft <= 60)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  if (upcoming.length === 0) return null;

  return (
    <div>
      <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-3 flex items-center gap-1.5">
        <CalendarClock className="h-3.5 w-3.5" />
        Kommende fornyelser
      </h2>

      <div className="bg-card border border-border rounded-lg shadow-card divide-y divide-border">
        {upcoming.map((o) => {
          const overdue = o.daysLeft < 0;
          const urgent = o.daysLeft >= 0 && o.daysLeft <= 14;
          const soon = o.daysLeft > 14 && o.daysLeft <= 60;

          return (
            <button
              key={o.id}
              onClick={() => navigate("/konsulenter/i-oppdrag")}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
            >
              {/* Status indicator */}
              <div className={cn(
                "w-2 h-2 rounded-full shrink-0",
                overdue && "bg-destructive",
                urgent && "bg-[hsl(var(--warning))]",
                soon && "bg-primary"
              )} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[0.875rem] font-semibold text-foreground truncate">
                  {o.kandidat}
                  {o.kunde && <span className="font-normal text-muted-foreground"> — {o.kunde}</span>}
                </p>
                <p className={cn(
                  "text-[0.8125rem] font-medium",
                  overdue && "text-destructive",
                  urgent && "text-[hsl(var(--warning))]",
                  soon && "text-muted-foreground"
                )}>
                  {overdue
                    ? `Forfalt ${Math.abs(o.daysLeft)} dager siden`
                    : o.daysLeft === 0
                      ? "Fornyes i dag"
                      : `Om ${o.daysLeft} dager`}
                  {" · "}
                  {format(o.fornyDate, "d. MMM yyyy", { locale: nb })}
                </p>
              </div>

              {/* Price */}
              {o.utpris && (
                <span className="text-[0.75rem] text-muted-foreground shrink-0">
                  kr {formatNOK(Number(o.utpris))}/t
                </span>
              )}

              {(overdue || urgent) && (
                <AlertTriangle className={cn(
                  "h-4 w-4 shrink-0",
                  overdue ? "text-destructive" : "text-[hsl(var(--warning))]"
                )} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
