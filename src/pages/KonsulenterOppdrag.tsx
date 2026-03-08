import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { cn, formatNOK, getInitials } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { Briefcase, CalendarCheck, TrendingUp, BarChart2 } from "lucide-react";

type Filter = "Alle" | "Aktiv" | "Oppstart" | "Inaktiv";
const TIMER_PER_DAG = 7.5;

export default function KonsulenterOppdrag() {
  const [filter, setFilter] = useState<Filter>("Aktiv");
  const today = new Date();

  const { data: oppdrag = [], isLoading } = useQuery({
    queryKey: ["stacq-oppdrag"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stacq_oppdrag")
        .select("*")
        .order("start_dato", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const enriched = useMemo(
    () =>
      oppdrag.map((o: any) => {
        const utpris = Number(o.utpris) || 0;
        const tilKons = Number(o.til_konsulent) || 0;
        const marginPerTime = utpris - tilKons;
        const margin = marginPerTime * TIMER_PER_DAG;
        const marginPct = utpris > 0 ? (marginPerTime / utpris) * 100 : 0;
        const daysUntilForny = o.forny_dato
          ? differenceInDays(new Date(o.forny_dato), today)
          : null;
        return { ...o, margin, marginPct, daysUntilForny };
      }),
    [oppdrag]
  );

  const stats = useMemo(() => {
    const aktive = enriched.filter((o: any) => o.status === "Aktiv");
    const oppstart = enriched.filter((o: any) => o.status === "Oppstart");
    const totalDagspris = aktive.reduce((s: number, o: any) => s + (Number(o.utpris) || 0) * TIMER_PER_DAG, 0);
    const avgMargin =
      aktive.length > 0
        ? aktive.reduce((s: number, o: any) => s + o.marginPct, 0) / aktive.length
        : 0;
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const dim = new Date(y, m + 1, 0).getDate();
    let workdays = 0;
    for (let d = 1; d <= dim; d++) { const dow = new Date(y, m, d).getDay(); if (dow !== 0 && dow !== 6) workdays++; }
    const stacqPerDag = aktive.reduce((s: number, o: any) => s + o.margin, 0);
    const stacqMonthly = stacqPerDag * workdays;
    const oppstartUtpris = oppstart.reduce((s: number, o: any) => s + (Number(o.utpris) || 0), 0);
    return {
      aktive: aktive.length,
      oppstart: oppstart.length,
      totalDagspris,
      avgMargin,
      stacqMonthly,
      workdays,
      monthLabel: format(now, "MMMM yyyy"),
      oppstartUtpris,
    };
  }, [enriched]);

  const filtered = useMemo(() => {
    let items = enriched;
    if (filter === "Aktiv") items = items.filter((o: any) => o.status === "Aktiv" || o.status === "Oppstart");
    else if (filter !== "Alle") items = items.filter((o: any) => o.status === filter);

    // Sort: Oppstart first, then Aktiv by forny asc, then Inaktiv by slutt desc
    return [...items].sort((a: any, b: any) => {
      const order: Record<string, number> = { Oppstart: 0, Aktiv: 1, Inaktiv: 2 };
      const oa = order[a.status] ?? 3;
      const ob = order[b.status] ?? 3;
      if (oa !== ob) return oa - ob;
      if (a.status === "Oppstart") return (a.start_dato || "").localeCompare(b.start_dato || "");
      if (a.status === "Aktiv") {
        const af = a.forny_dato || "9999";
        const bf = b.forny_dato || "9999";
        return af.localeCompare(bf);
      }
      return (b.slutt_dato || "").localeCompare(a.slutt_dato || "");
    });
  }, [enriched, filter]);

  const chips: Filter[] = ["Alle", "Aktiv", "Oppstart", "Inaktiv"];

  if (isLoading) {
    return <p className="text-muted-foreground py-12 text-center">Laster oppdrag...</p>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-[1.375rem] font-bold">I oppdrag</h1>
        <span className="bg-secondary text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
          {stats.aktive + stats.oppstart}
        </span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 rounded-xl px-5 py-4 shadow-sm">
          <Briefcase className="h-4 w-4 text-emerald-600 mb-1" />
          <p className="text-2xl font-bold text-emerald-600">{stats.aktive}</p>
          <p className="text-[0.8125rem] text-muted-foreground">Aktive oppdrag</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 rounded-xl px-5 py-4 shadow-sm">
          <CalendarCheck className="h-4 w-4 text-amber-600 mb-1" />
          <p className="text-2xl font-bold text-amber-600">{stats.oppstart}</p>
          <p className="text-[0.8125rem] text-muted-foreground">I oppstart</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 rounded-xl px-5 py-4 shadow-sm">
          <TrendingUp className="h-4 w-4 text-blue-600 mb-1" />
          <p className="text-xl font-bold text-blue-600">kr {formatNOK(stats.totalDagspris)}</p>
          <p className="text-[0.8125rem] text-muted-foreground">Total dagspris</p>
          <p className="text-xs text-muted-foreground">kr/dag alle aktive</p>
        </div>
        <div className="bg-violet-50 dark:bg-violet-950/20 border border-violet-100 rounded-xl px-5 py-4 shadow-sm">
          <BarChart2 className="h-4 w-4 text-violet-600 mb-1" />
          <p className="text-2xl font-bold text-violet-600">{stats.avgMargin.toFixed(1)}%</p>
          <p className="text-[0.8125rem] text-muted-foreground">Snitt margin</p>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 mb-4">
        {chips.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={cn(
              "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors",
              filter === c
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:bg-secondary"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["KONSULENT", "KUNDE", "TYPE", "UTPRIS", "MARGIN", "FORNY", "STATUS"].map((h) => (
                <th
                  key={h}
                  className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground px-4 py-2.5 text-left"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((o: any, i: number) => {
              const isInaktiv = o.status === "Inaktiv";
              const borderClass =
                o.daysUntilForny !== null && o.daysUntilForny < 0
                  ? "border-l-destructive"
                  : o.daysUntilForny !== null && o.daysUntilForny <= 30
                  ? "border-l-amber-400"
                  : o.status === "Oppstart"
                  ? "border-l-blue-400"
                  : "border-l-transparent";

              return (
                <tr
                  key={o.id}
                  className={cn(
                    "hover:bg-muted/30 transition-colors border-l-[3px]",
                    borderClass,
                    i < filtered.length - 1 && "border-b border-border",
                    isInaktiv && "opacity-60"
                  )}
                >
                  {/* KONSULENT */}
                  <td className="px-4 py-3.5">
                    <div>
                      <p className="font-semibold text-[0.875rem]">{o.kandidat}</p>
                      {o.er_ansatt ? (
                        <span className="bg-primary/10 text-primary text-[0.625rem] font-semibold uppercase rounded px-1.5 py-0.5">
                          STACQ
                        </span>
                      ) : (
                        <span className="bg-secondary text-muted-foreground text-[0.625rem] font-semibold uppercase rounded px-1.5 py-0.5">
                          PARTNER
                        </span>
                      )}
                    </div>
                  </td>
                  {/* KUNDE */}
                  <td className="px-4 py-3.5 font-medium text-[0.875rem]">{o.kunde}</td>
                  {/* TYPE */}
                  <td className="px-4 py-3.5">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        o.deal_type === "DIR"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : o.deal_type === "VIA"
                          ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {o.deal_type || "–"}
                    </span>
                  </td>
                  {/* UTPRIS (per time) */}
                  <td className="px-4 py-3.5 font-medium text-[0.875rem]">
                    kr {formatNOK(Number(o.utpris) || 0)}/t
                  </td>
                  {/* MARGIN */}
                  <td className="px-4 py-3.5">
                    <p
                      className={cn(
                        "font-medium text-[0.875rem]",
                        o.marginPct >= 28
                          ? "text-emerald-600"
                          : o.marginPct >= 20
                          ? "text-amber-600"
                          : "text-destructive"
                      )}
                    >
                      kr {formatNOK(o.margin)}/dag
                    </p>
                    <p className="text-xs text-muted-foreground">{o.marginPct.toFixed(1)}%</p>
                  </td>
                  {/* FORNY */}
                  <td className="px-4 py-3.5 text-[0.8125rem]">
                    {o.daysUntilForny === null ? (
                      <span className="text-muted-foreground">–</span>
                    ) : o.daysUntilForny < 0 ? (
                      <span className="bg-destructive/10 text-destructive rounded-full px-2 py-0.5 text-xs font-medium">
                        Utløpt
                      </span>
                    ) : o.daysUntilForny <= 30 ? (
                      <span className="bg-amber-100 text-amber-700 rounded-full px-2.5 py-0.5 text-xs font-medium">
                        Om {o.daysUntilForny} dager
                      </span>
                    ) : o.daysUntilForny <= 90 ? (
                      <span className="text-amber-600 font-medium">
                        {format(new Date(o.forny_dato), "dd.MM.yy")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {format(new Date(o.forny_dato), "dd.MM.yy")}
                      </span>
                    )}
                  </td>
                  {/* STATUS */}
                  <td className="px-4 py-3.5">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        o.status === "Aktiv" && "bg-emerald-100 text-emerald-700",
                        o.status === "Oppstart" && "bg-amber-100 text-amber-700",
                        o.status === "Inaktiv" && "bg-muted text-muted-foreground"
                      )}
                    >
                      {o.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-muted-foreground text-center py-12">Ingen oppdrag å vise</p>
        )}
      </div>
    </div>
  );
}
