import { useMemo } from "react";
import { cn, formatNOK } from "@/lib/utils";
import { format, differenceInDays, startOfMonth } from "date-fns";
import { nb } from "date-fns/locale";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];

function getPillColor(fornyDate: Date, isOppstart: boolean) {
  const now = new Date();
  const days = differenceInDays(fornyDate, startOfMonth(now));
  const thisMonth = now.getMonth() === fornyDate.getMonth() && now.getFullYear() === fornyDate.getFullYear();

  if (differenceInDays(fornyDate, now) < 0) return { bg: "bg-red-100 text-red-600", border: isOppstart };
  if (thisMonth) return { bg: "bg-blue-600 text-white", border: isOppstart };
  if (days <= 60) return { bg: "bg-amber-100 text-amber-700", border: isOppstart };
  if (days <= 180) return { bg: "bg-emerald-100 text-emerald-700", border: isOppstart };
  return { bg: "bg-muted text-muted-foreground", border: isOppstart };
}

export function FornyelsesTimeline({ enriched }: { enriched: any[] }) {
  const year = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const rows = useMemo(() => {
    return enriched
      .filter((o: any) => (o.status === "Aktiv" || o.status === "Oppstart") && o.forny_dato)
      .map((o: any) => {
        const d = new Date(o.forny_dato);
        return {
          id: o.id,
          navn: o.kandidat?.split(" ")[0] || "?",
          kunde: o.kunde || "",
          utpris: Number(o.utpris) || 0,
          status: o.status,
          fornyDate: d,
          fornyMonth: d.getFullYear() === year ? d.getMonth() : -1,
          fornyDay: d.getDate(),
          fullDate: format(d, "d. MMMM yyyy", { locale: nb }),
        };
      })
      .sort((a, b) => a.fornyDate.getTime() - b.fornyDate.getTime());
  }, [enriched, year]);

  const monthlySummary = useMemo(() => {
    const counts: Record<number, number> = {};
    rows.forEach((r) => {
      if (r.fornyMonth >= 0) counts[r.fornyMonth] = (counts[r.fornyMonth] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([m, count]) => ({ month: MONTHS_SHORT[Number(m)], count }));
  }, [rows]);

  if (rows.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-[0.8125rem] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-3">
        Fornyelser {year}
      </h2>

      <div className="border border-border rounded-lg bg-card shadow-[0_1px_3px_rgba(0,0,0,0.07)] overflow-hidden">
        <div className="overflow-x-auto overflow-y-visible">
          <div className="min-w-[900px]">
            {/* Header */}
            <div className="flex border-b border-border bg-background sticky top-0 z-10">
              <div className="w-[160px] shrink-0 px-3 py-2 sticky left-0 z-20 bg-background" />
              {MONTHS_SHORT.map((m, i) => (
                <div
                  key={m}
                  className={cn(
                    "flex-1 min-w-[56px] text-center py-2 text-[0.6875rem] font-medium uppercase tracking-[0.06em]",
                    i === currentMonth
                      ? "text-primary font-bold"
                      : "text-muted-foreground"
                  )}
                >
                  {m}
                  {i === currentMonth && (
                    <div className="h-[2px] bg-primary rounded-full mt-1 mx-2" />
                  )}
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="divide-y divide-border">
              {rows.map((r) => {
                const pill = getPillColor(r.fornyDate, r.status === "Oppstart");
                return (
                  <div key={r.id} className="flex items-center hover:bg-muted/30 transition-colors">
                    <div className="w-[160px] shrink-0 px-3 py-2.5 sticky left-0 z-20 bg-card">
                      <p className="text-[0.8125rem] font-semibold text-foreground truncate">{r.navn}</p>
                      <p className="text-[0.6875rem] text-muted-foreground truncate">{r.kunde}</p>
                    </div>
                    {MONTHS_SHORT.map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex-1 min-w-[56px] flex items-center justify-center py-2.5",
                          i === currentMonth && "bg-primary/[0.03]"
                        )}
                      >
                        {r.fornyMonth === i && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className={cn(
                                  "inline-flex items-center justify-center h-6 min-w-[28px] px-1.5 rounded-full text-[0.6875rem] font-bold",
                                  pill.bg,
                                  pill.border && "border-2 border-current bg-transparent"
                                )}
                              >
                                {String(r.fornyDay).padStart(2, "0")}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-semibold">{r.navn} — {r.kunde}</p>
                              <p>{r.fullDate}</p>
                              <p className="text-muted-foreground">kr {formatNOK(r.utpris)}/t</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Summary */}
        {monthlySummary.length > 0 && (
          <div className="px-3 py-2 border-t border-border bg-background">
            <p className="text-[0.75rem] text-muted-foreground">
              {monthlySummary.map((s, i) => (
                <span key={s.month}>
                  {i > 0 && " · "}
                  <span className="font-medium text-foreground">{s.month}:</span> {s.count} {s.count === 1 ? "fornyelse" : "fornyelser"}
                </span>
              ))}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
