import { useMemo } from "react";
import { cn, formatNOK, getInitials } from "@/lib/utils";
import { format, differenceInDays, startOfMonth } from "date-fns";
import { nb } from "date-fns/locale";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export function buildMonthlySummary(enriched: any[]) {
  const year = new Date().getFullYear();
  const counts: Record<number, number> = {};
  enriched
    .filter((o: any) => (o.status === "Aktiv" || o.status === "Oppstart") && (o.forny_dato || o.lopende_30_dager))
    .forEach((o: any) => {
      const now = new Date();
      const d = o.lopende_30_dager
        ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        : new Date(o.forny_dato);
      if (d.getFullYear() === year) {
        const m = d.getMonth();
        counts[m] = (counts[m] || 0) + 1;
      }
    });
  return Object.entries(counts)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([m, count]) => ({ month: MONTHS_SHORT[Number(m)], count }));
}

export function FornyelsesTimeline({ enriched }: { enriched: any[] }) {
  const year = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const { data: ansatteListe = [] } = useQuery({
    queryKey: ["ansatte-names"],
    queryFn: async () => {
      const { data } = await supabase.from("stacq_ansatte").select("id, navn");
      return data || [];
    },
  });

  const { data: cvPortraits = [] } = useQuery({
    queryKey: ["cv-portraits"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cv_documents")
        .select("ansatt_id, portrait_url")
        .not("portrait_url", "is", null);
      return data || [];
    },
  });

  const { nameToAnsattId, portraitByAnsattId } = useMemo(() => {
    const nameMap = new Map<string, number>();
    (ansatteListe as any[]).forEach((a) => {
      if (a.id && a.navn) nameMap.set(a.navn.trim().toLowerCase(), a.id);
    });
    const portraitMap = new Map<number, string>();
    (cvPortraits as any[]).forEach((c) => {
      if (c.ansatt_id && c.portrait_url) portraitMap.set(c.ansatt_id, c.portrait_url);
    });
    return { nameToAnsattId: nameMap, portraitByAnsattId: portraitMap };
  }, [ansatteListe, cvPortraits]);

  const rows = useMemo(() => {
    const now = new Date();
    return enriched
      .filter((o: any) => (o.status === "Aktiv" || o.status === "Oppstart") && (o.forny_dato || o.lopende_30_dager))
      .map((o: any) => {
        const d = o.lopende_30_dager
          ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
          : new Date(o.forny_dato);
        return {
          id: o.id,
          navn: o.kandidat || "?",
          fullName: o.kandidat || "?",
          kunde: o.kunde || "",
          utpris: Number(o.utpris) || 0,
          status: o.status,
          erAnsatt: o.er_ansatt === true,
          fornyDate: d,
          fornyMonth: d.getFullYear() === year ? d.getMonth() : -1,
          fornyDay: d.getDate(),
          fullDate: format(d, "d. MMMM yyyy", { locale: nb }),
        };
      })
      .sort((a, b) => a.fornyDate.getTime() - b.fornyDate.getTime());
  }, [enriched, year]);

  if (rows.length === 0) return null;

  return (
    <div className="h-full">
      <div className="border border-border rounded-lg bg-card shadow-[0_1px_3px_rgba(0,0,0,0.07)] relative h-full flex flex-col">
        <div className="overflow-x-auto flex-1">
          <div className="min-w-[900px] relative">
            {/* Active month vertical highlight overlay */}
            <div
              aria-hidden
              className="absolute pointer-events-none z-0"
              style={{
                left: `calc(190px + (100% - 190px) * ${currentMonth} / 12)`,
                width: `calc((100% - 190px) / 12)`,
                top: 0,
                bottom: 0,
                background: "rgba(94,106,210,0.05)",
              }}
            />

            {/* Header */}
            <div className="flex border-b border-border bg-background sticky top-0 z-20">
              <div className="w-[190px] shrink-0 px-4 py-2.5 sticky left-0 z-30 bg-background text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Konsulent
              </div>
              {MONTHS_SHORT.map((m, i) => (
                <div
                  key={m}
                  className={cn(
                    "flex-1 min-w-[56px] text-center py-2.5 text-[0.6875rem] font-medium uppercase tracking-[0.08em]",
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
            <div className="divide-y divide-border relative z-10">
              {rows.map((r) => {
                const pill = getPillColor(r.fornyDate, r.status === "Oppstart");
                const ansattId = r.erAnsatt ? nameToAnsattId.get(r.fullName.trim().toLowerCase()) : undefined;
                const portrait = ansattId ? portraitByAnsattId.get(ansattId) : undefined;
                return (
                  <div key={r.id} className="flex items-center min-h-[38px] py-1 hover:bg-muted/30 transition-colors">
                    <div className="w-[190px] shrink-0 px-3 sticky left-0 z-10 bg-card flex items-center gap-2">
                      {(() => {
                        if (r.erAnsatt && portrait) {
                          return <img src={portrait} alt={r.fullName} className="w-6 h-6 rounded-full object-cover border border-border flex-shrink-0" />;
                        }
                        if (r.erAnsatt) {
                          return (
                            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[0.625rem] font-bold flex items-center justify-center flex-shrink-0">
                              {getInitials(r.fullName)}
                            </div>
                          );
                        }
                        return (
                          <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-[0.625rem] font-bold flex items-center justify-center flex-shrink-0">
                            {getInitials(r.fullName)}
                          </div>
                        );
                      })()}
                      <div className="min-w-0">
                        <p className="text-[0.8125rem] font-medium text-foreground truncate">{r.navn}</p>
                      </div>
                    </div>
                    {MONTHS_SHORT.map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 min-w-[56px] flex items-center justify-center"
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
                              <p className="font-semibold">{r.fullName}</p>
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
      </div>
    </div>
  );
}
