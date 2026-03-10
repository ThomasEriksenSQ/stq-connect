import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { cn, formatNOK, getInitials } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { Briefcase, CalendarCheck, TrendingUp, BarChart2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { OppdragEditSheet } from "@/components/OppdragEditSheet";
import { FornyelsesTimeline } from "@/components/FornyelsesTimeline";

type Filter = "Alle" | "Aktiv" | "Oppstart" | "Inaktiv";
const TIMER_PER_DAG = 7.5;

function computeOppdragStatus(oppdrag: any): string {
  if (oppdrag.status === "Inaktiv") return "Inaktiv";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = oppdrag.start_dato ? new Date(oppdrag.start_dato) : null;
  if (startDate && startDate > today) return "Oppstart";
  return "Aktiv";
}

export default function KonsulenterOppdrag() {
  const [filter, setFilter] = useState<Filter>("Aktiv");
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
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

  const { data: allCompanies = [] } = useQuery({
    queryKey: ["all-companies-status"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, status");
      return data || [];
    },
  });
  const companyStatusMap: Record<string, string> = Object.fromEntries(
    allCompanies.map((c: any) => [c.id, c.status])
  );

  const enriched = useMemo(
    () =>
      oppdrag.map((o: any) => {
        const computedStatus = computeOppdragStatus(o);
        const utpris = Number(o.utpris) || 0;
        const tilKons = Number(o.til_konsulent) || 0;
        const marginPerTime = utpris - tilKons;
        const margin = marginPerTime * TIMER_PER_DAG;
        const marginPct = utpris > 0 ? (marginPerTime / utpris) * 100 : 0;
        const daysUntilForny = o.forny_dato
          ? differenceInDays(new Date(o.forny_dato), today)
          : null;
        return { ...o, status: computedStatus, margin, marginPerTime, marginPct, daysUntilForny };
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
    const oppstartMarginPerTime = oppstart.length > 0
      ? oppstart.reduce((s: number, o: any) => s + o.marginPerTime, 0) / oppstart.length
      : 0;
    return {
      aktive: aktive.length,
      oppstart: oppstart.length,
      totalDagspris,
      avgMargin,
      stacqMonthly,
      workdays,
      monthLabel: format(now, "MMMM yyyy"),
      oppstartMarginPerTime,
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
        <h1 className="text-[1.375rem] font-bold">Aktive oppdrag</h1>
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
          <p className="text-xl font-bold text-blue-600">kr {formatNOK(stats.stacqMonthly)} <span className="text-xs font-normal text-muted-foreground">/ mnd</span></p>
          <p className="text-[0.8125rem] text-muted-foreground">STACQ Prisen</p>
          <p className="text-xs text-muted-foreground">{stats.workdays} arbeidsdager · {stats.monthLabel}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 rounded-xl px-5 py-4 shadow-sm">
          <BarChart2 className="h-4 w-4 text-amber-600 mb-1" />
          <p className="text-xl font-bold text-amber-600">kr {formatNOK(stats.oppstartMarginPerTime)} <span className="text-xs font-normal text-muted-foreground">/ time</span></p>
          <p className="text-[0.8125rem] text-muted-foreground">Snitt margin / time</p>
          <p className="text-xs text-muted-foreground">{stats.oppstart} konsulenter kommer snart</p>
        </div>
      </div>

      {/* Renewal timeline */}
      <FornyelsesTimeline enriched={enriched} />

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
      <div className="border border-border rounded-lg overflow-hidden bg-card shadow-[0_1px_3px_rgba(0,0,0,0.07)]">
        {/* Header row */}
        <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_80px_90px_110px_100px_90px] gap-3 px-4 py-2.5 border-b border-border bg-background">
          {["Konsulent", "Kunde", "Type", "Utpris", "Margin", "Forny", "Status"].map((h) => (
            <span key={h} className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {h}
            </span>
          ))}
        </div>
        {/* Data rows */}
        <div className="divide-y divide-border">
          {filtered.map((o: any) => {
            const isInaktiv = o.status === "Inaktiv";

            return (
              <div
                key={o.id}
                onClick={() => setSelectedRowId(o.id)}
                className={cn(
                  "grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_80px_90px_110px_100px_90px] gap-3 items-center px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer",
                  isInaktiv && "opacity-60"
                )}
              >
                {/* KONSULENT */}
                <div className="min-w-0">
                  <p className="text-[0.875rem] font-semibold text-foreground truncate">{o.kandidat}</p>
                </div>
                {/* KUNDE */}
                <span className="text-[0.875rem] font-medium text-foreground truncate">{o.kunde}</span>
                {/* TYPE */}
                <div>
                  {(() => {
                    const cs = o.selskap_id ? companyStatusMap[o.selskap_id] : null;
                    if (cs === "partner") return <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-0.5 text-[0.6875rem] font-semibold">Partner</span>;
                    if (cs === "customer" || cs === "kunde") return <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-[0.6875rem] font-semibold">Kunde</span>;
                    if (cs === "prospect") return <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-0.5 text-[0.6875rem] font-semibold">Potensiell</span>;
                    return <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-500 border border-gray-200 px-2.5 py-0.5 text-[0.6875rem] font-semibold">—</span>;
                  })()}
                </div>
                {/* UTPRIS */}
                <span className="text-[0.8125rem] font-medium text-foreground">
                  kr {formatNOK(Number(o.utpris) || 0)}/t
                </span>
                {/* MARGIN */}
                <div>
                  <p
                    className={cn(
                      "text-[0.8125rem] font-medium",
                      o.marginPct >= 28
                        ? "text-emerald-600"
                        : o.marginPct >= 20
                        ? "text-amber-600"
                        : "text-destructive"
                    )}
                  >
                    kr {formatNOK(o.marginPerTime)}/t
                  </p>
                  <p className="text-[0.6875rem] text-muted-foreground">{o.marginPct.toFixed(1)}%</p>
                </div>
                {/* FORNY */}
                <div className="text-[0.8125rem]">
                  {o.daysUntilForny === null ? (
                    <span className="text-muted-foreground">–</span>
                  ) : o.daysUntilForny < 0 ? (
                    <span className="text-destructive font-medium">Utløpt</span>
                  ) : o.daysUntilForny <= 30 ? (
                    <span className="text-amber-600 font-medium">Om {o.daysUntilForny}d</span>
                  ) : o.daysUntilForny <= 90 ? (
                    <span className="text-amber-600">
                      {format(new Date(o.forny_dato), "dd.MM.yy")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {format(new Date(o.forny_dato), "dd.MM.yy")}
                    </span>
                  )}
                </div>
                {/* STATUS */}
                <div>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold",
                      o.status === "Aktiv" && "bg-emerald-100 text-emerald-700",
                      o.status === "Oppstart" && "bg-amber-100 text-amber-700",
                      o.status === "Inaktiv" && "bg-muted text-muted-foreground"
                    )}
                  >
                    {o.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        {filtered.length === 0 && (
          <p className="text-muted-foreground text-center py-12">Ingen oppdrag å vise</p>
        )}
      </div>
      <Sheet open={selectedRowId !== null} onOpenChange={(o) => { if (!o) setSelectedRowId(null); }}>
        <SheetContent side="right" className="w-[480px] sm:max-w-[480px] p-0" hideCloseButton>
          <OppdragEditSheet
            row={enriched.find((o: any) => o.id === selectedRowId) || null}
            onClose={() => setSelectedRowId(null)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
