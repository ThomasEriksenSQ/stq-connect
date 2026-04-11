import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { cn, formatNOK, getInitials } from "@/lib/utils";
import { format, differenceInDays, startOfDay } from "date-fns";
import { Briefcase, CalendarCheck, BarChart2, Loader2, Plus } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { OppdragEditSheet } from "@/components/OppdragEditSheet";
import { FornyelsesTimeline } from "@/components/FornyelsesTimeline";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Filter = "Alle" | "Aktiv" | "Oppstart" | "Inaktiv";
const TIMER_PER_DAG = 7.5;

function computeOppdragStatus(oppdrag: any): string {
  if (oppdrag.status === "Inaktiv") return "Inaktiv";
  const today = startOfDay(new Date());
  const startDate = parseOppdragDate(oppdrag.start_dato);
  if (startDate && startDate > today) return "Oppstart";
  return "Aktiv";
}

function parseOppdragDate(value?: string | null): Date | null {
  if (!value) return null;

  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export default function KonsulenterOppdrag() {
  const [filter, setFilter] = useState<Filter>("Aktiv");
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  
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
  const companyStatusMap: Record<string, string> = Object.fromEntries(allCompanies.map((c: any) => [c.id, c.status]));

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

  const enriched = useMemo(
    () =>
      oppdrag.map((o: any) => {
        const computedStatus = computeOppdragStatus(o);
        const utpris = Number(o.utpris) || 0;
        const tilKons = Number(o.til_konsulent) || 0;
        const marginPerTime = utpris - tilKons;
        const margin = marginPerTime * TIMER_PER_DAG;
        const marginPct = utpris > 0 ? (marginPerTime / utpris) * 100 : 0;
        const daysUntilForny = o.lopende_30_dager
          ? 30
          : o.forny_dato
            ? differenceInDays(new Date(o.forny_dato), today)
            : null;
        return { ...o, status: computedStatus, margin, marginPerTime, marginPct, daysUntilForny };
      }),
    [oppdrag],
  );

  const stats = useMemo(() => {
    const aktive = enriched.filter((o: any) => o.status === "Aktiv");
    const oppstart = enriched.filter((o: any) => o.status === "Oppstart");
    const totalDagspris = aktive.reduce((s: number, o: any) => s + (Number(o.utpris) || 0) * TIMER_PER_DAG, 0);
    const avgMargin = aktive.length > 0 ? aktive.reduce((s: number, o: any) => s + o.marginPct, 0) / aktive.length : 0;
    const now = new Date();
    const y = now.getFullYear(),
      m = now.getMonth();
    const dim = new Date(y, m + 1, 0).getDate();
    let workdays = 0;
    for (let d = 1; d <= dim; d++) {
      const dow = new Date(y, m, d).getDay();
      if (dow !== 0 && dow !== 6) workdays++;
    }
    const stacqPerDag = aktive.reduce((s: number, o: any) => s + o.margin, 0);
    const stacqMonthly = stacqPerDag * workdays;
    const oppstartMarginPerTime =
      oppstart.length > 0 ? oppstart.reduce((s: number, o: any) => s + o.marginPerTime, 0) / oppstart.length : 0;
    const fornyelser30 = enriched.filter(
      (o: any) =>
        (o.status === "Aktiv" || o.status === "Oppstart") &&
        o.daysUntilForny !== null &&
        o.daysUntilForny >= 0 &&
        o.daysUntilForny <= 30,
    ).length;

    const fornyelser60 = enriched.filter(
      (o: any) =>
        (o.status === "Aktiv" || o.status === "Oppstart") &&
        o.daysUntilForny !== null &&
        o.daysUntilForny >= 0 &&
        o.daysUntilForny <= 60,
    ).length;

    return {
      aktive: aktive.length,
      oppstart: oppstart.length,
      totalDagspris,
      avgMargin,
      stacqMonthly,
      workdays,
      monthLabel: format(now, "MMMM yyyy"),
      oppstartMarginPerTime,
      fornyelser30,
      fornyelser60,
    };
  }, [enriched]);

  const filtered = useMemo(() => {
    let items = enriched;
    if (filter === "Aktiv") items = items.filter((o: any) => o.status === "Aktiv" || o.status === "Oppstart");
    else if (filter !== "Alle") items = items.filter((o: any) => o.status === filter);

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

  const selectedOppdrag = useMemo(
    () => enriched.find((oppdrag: any) => oppdrag.id === selectedRowId) || null,
    [enriched, selectedRowId],
  );

  const chips: Filter[] = ["Alle", "Aktiv", "Oppstart", "Inaktiv"];

  if (isLoading) {
    return <p className="text-muted-foreground py-12 text-center">Laster oppdrag...</p>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-[1.375rem] font-bold">Aktive oppdrag</h1>
          <span className="bg-secondary text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
            {stats.aktive + stats.oppstart}
          </span>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus className="h-4 w-4" />
          Nytt oppdrag
        </button>
      </div>


      {/* Stat cards */}
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
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 rounded-xl px-5 py-4 shadow-sm">
              <BarChart2 className="h-4 w-4 text-amber-600 mb-1" />
              <p className="text-2xl font-bold text-amber-600">{stats.fornyelser30}</p>
              <p className="text-[0.8125rem] text-muted-foreground">Fornyelser under 30 dager</p>
              <p className="text-xs text-muted-foreground">Krever oppfølging</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 rounded-xl px-5 py-4 shadow-sm">
              <BarChart2 className="h-4 w-4 text-amber-600 mb-1" />
              <p className="text-2xl font-bold text-amber-600">{stats.fornyelser60}</p>
              <p className="text-[0.8125rem] text-muted-foreground">Fornyelser under 60 dager</p>
              <p className="text-xs text-muted-foreground">Krever oppfølging</p>
            </div>
          </div>

          {/* Renewal timeline */}
          <FornyelsesTimeline enriched={enriched} />

          {/* Filter chips */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {chips.map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={cn(
                  "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors",
                  filter === c
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:bg-secondary",
                )}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((o: any) => {
              const isInaktiv = o.status === "Inaktiv";
              const kundeType = (() => {
                const cs = o.selskap_id ? companyStatusMap[o.selskap_id] : null;
                if (cs === "partner") return "Partner";
                if (cs === "customer" || cs === "kunde") return "Kunde";
                if (cs === "prospect") return "Potensiell";
                return "—";
              })();

              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSelectedRowId(o.id)}
                  className={cn(
                    "w-full rounded-xl border border-border bg-card px-4 py-3 text-left shadow-card",
                    isInaktiv && "opacity-60",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {(() => {
                        const isAnsatt = o.er_ansatt === true;
                        const ansattId = isAnsatt
                          ? o.ansatt_id ?? nameToAnsattId.get(o.kandidat?.trim().toLowerCase())
                          : undefined;
                        const portrait = ansattId ? portraitByAnsattId.get(ansattId) : undefined;
                        if (isAnsatt && portrait) {
                          return <img src={portrait} alt={o.kandidat} className="h-9 w-9 rounded-full object-cover border border-border flex-shrink-0" />;
                        }
                        return (
                          <div
                            className={cn(
                              "h-9 w-9 rounded-full text-[0.6875rem] font-bold flex items-center justify-center flex-shrink-0",
                              isAnsatt ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                            )}
                          >
                            {getInitials(o.kandidat || "?")}
                          </div>
                        );
                      })()}
                      <div className="min-w-0">
                        <p className="text-[0.9375rem] font-semibold text-foreground truncate">{o.kandidat}</p>
                        <p className="mt-1 text-[0.8125rem] text-muted-foreground truncate">{o.kunde}</p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold shrink-0",
                        o.status === "Aktiv" && "bg-emerald-100 text-emerald-700",
                        o.status === "Oppstart" && "bg-amber-100 text-amber-700",
                        o.status === "Inaktiv" && "bg-muted text-muted-foreground",
                      )}
                    >
                      {o.status}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[0.6875rem] font-medium text-foreground">
                      {kundeType}
                    </span>
                    <span className="text-[0.8125rem] font-medium text-foreground">kr {formatNOK(Number(o.utpris) || 0)}/t</span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-[0.8125rem]">
                    <div>
                      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">Margin</p>
                      <p
                        className={cn(
                          "mt-1 font-medium",
                          o.marginPct >= 28 ? "text-emerald-600" : o.marginPct >= 20 ? "text-amber-600" : "text-destructive",
                        )}
                      >
                        kr {formatNOK(o.marginPerTime)}/t
                      </p>
                      <p className="text-[0.6875rem] text-muted-foreground">{o.marginPct.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">Forny</p>
                      <div className="mt-1 text-[0.8125rem]">
                        {o.daysUntilForny === null ? (
                          <span className="text-muted-foreground">–</span>
                        ) : o.daysUntilForny < 0 ? (
                          <span className="font-medium text-destructive">Utløpt</span>
                        ) : o.daysUntilForny <= 30 ? (
                          <span className="font-medium text-amber-600">Om {o.daysUntilForny}d</span>
                        ) : o.daysUntilForny <= 90 ? (
                          <span className="text-amber-600">{format(new Date(o.forny_dato), "dd.MM.yy")}</span>
                        ) : (
                          <span className="text-muted-foreground">{format(new Date(o.forny_dato), "dd.MM.yy")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && <p className="text-muted-foreground text-center py-12">Ingen oppdrag å vise</p>}
          </div>

          {/* Table */}
          <div className="hidden md:block border border-border rounded-lg overflow-hidden bg-card shadow-[0_1px_3px_rgba(0,0,0,0.07)]">
            {/* Header row */}
            <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_80px_90px_110px_100px_90px] gap-3 px-4 py-2.5 border-b border-border bg-background">
              {["Konsulent", "Kunde", "Type", "Utpris", "Margin", "Forny", "Status"].map((h) => (
                <span
                  key={h}
                  className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground"
                >
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
                      isInaktiv && "opacity-60",
                    )}
                  >
                    {/* KONSULENT */}
                    <div className="flex items-center gap-2 min-w-0">
                      {(() => {
                        const isAnsatt = o.er_ansatt === true;
                        const ansattId = isAnsatt
                          ? o.ansatt_id ?? nameToAnsattId.get(o.kandidat?.trim().toLowerCase())
                          : undefined;
                        const portrait = ansattId ? portraitByAnsattId.get(ansattId) : undefined;
                        if (isAnsatt && portrait) {
                          return <img src={portrait} alt={o.kandidat} className="w-7 h-7 rounded-full object-cover border border-border flex-shrink-0" />;
                        }
                        if (isAnsatt) {
                          return (
                            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-[0.625rem] font-bold flex items-center justify-center flex-shrink-0">
                              {getInitials(o.kandidat || "?")}
                            </div>
                          );
                        }
                        return (
                          <div className="w-7 h-7 rounded-full bg-muted text-muted-foreground text-[0.625rem] font-bold flex items-center justify-center flex-shrink-0">
                            {getInitials(o.kandidat || "?")}
                          </div>
                        );
                      })()}
                      <p className="text-[0.875rem] font-semibold text-foreground truncate">{o.kandidat}</p>
                    </div>
                    {/* KUNDE */}
                    <span className="text-[0.875rem] font-medium text-foreground truncate">{o.kunde}</span>
                    {/* TYPE */}
                    <div>
                      {(() => {
                        const cs = o.selskap_id ? companyStatusMap[o.selskap_id] : null;
                        if (cs === "partner")
                          return (
                            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-0.5 text-[0.6875rem] font-semibold">
                              Partner
                            </span>
                          );
                        if (cs === "customer" || cs === "kunde")
                          return (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-[0.6875rem] font-semibold">
                              Kunde
                            </span>
                          );
                        if (cs === "prospect")
                          return (
                            <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-0.5 text-[0.6875rem] font-semibold">
                              Potensiell
                            </span>
                          );
                        return (
                          <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-500 border border-gray-200 px-2.5 py-0.5 text-[0.6875rem] font-semibold">
                            —
                          </span>
                        );
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
                              : "text-destructive",
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
                        <span className="text-amber-600">{format(new Date(o.forny_dato), "dd.MM.yy")}</span>
                      ) : (
                        <span className="text-muted-foreground">{format(new Date(o.forny_dato), "dd.MM.yy")}</span>
                      )}
                    </div>
                    {/* STATUS */}
                    <div>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold",
                          o.status === "Aktiv" && "bg-emerald-100 text-emerald-700",
                          o.status === "Oppstart" && "bg-amber-100 text-amber-700",
                          o.status === "Inaktiv" && "bg-muted text-muted-foreground",
                        )}
                      >
                        {o.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {filtered.length === 0 && <p className="text-muted-foreground text-center py-12">Ingen oppdrag å vise</p>}
          </div>
          <Sheet
            open={selectedRowId !== null || createOpen}
            onOpenChange={(o) => {
              if (!o) {
                setSelectedRowId(null);
                setCreateOpen(false);
              }
            }}
          >
            <SheetContent side="right" className="w-full sm:w-[920px] p-0" hideCloseButton>
              <OppdragEditSheet
                key={createOpen ? "create-oppdrag" : `edit-oppdrag-${selectedOppdrag?.id ?? "none"}`}
                row={selectedOppdrag}
                onClose={() => {
                  setSelectedRowId(null);
                  setCreateOpen(false);
                }}
              />
            </SheetContent>
          </Sheet>


    </div>
  );
}
