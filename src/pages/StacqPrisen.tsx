import { useState, useMemo } from "react";
import { format, startOfDay } from "date-fns";
import { nb } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calcStacqPris } from "@/lib/stacqPris";
import { computeOppdragStatus as computeSharedOppdragStatus } from "@/lib/oppdragForm";
import { toast } from "@/components/ui/sonner";
import { ArrowUpDown, TrendingUp } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Dialog, DialogContent, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type SortField = "kandidat" | "kunde" | "stacq" | "utpris";
const TIMER_PER_DAG = 7.5;
type SortDir = "asc" | "desc";

const SEED_HISTORY = [
  { label: "2024-W09", value: 316 },
  { label: "2024-W10", value: 986 },
  { label: "2024-W14", value: 1336 },
  { label: "2024-W19", value: 1761 },
  { label: "2024-W28", value: 2086 },
  { label: "2025-W01", value: 2130 },
  { label: "2025-W02", value: 2485 },
  { label: "2025-W11", value: 2557 },
  { label: "2025-W18", value: 2532 },
  { label: "2025-W33", value: 3917 },
  { label: "2025-W42", value: 4107 },
  { label: "2025-W49", value: 4557 },
  { label: "2026-W01", value: 4276 },
  { label: "2026-W03", value: 3917 },
  { label: "2026-W08", value: 4364 },
  { label: "2026-W10", value: 4639 },
];

function formatKr(n: number): string {
  return n.toLocaleString("nb-NO", { maximumFractionDigits: 0 });
}

function formatPct(n: number): string {
  return n.toLocaleString("nb-NO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function stacqColor(timePris: number): string {
  if (timePris >= 450) return "text-emerald-600";
  if (timePris >= 350) return "text-blue-600";
  if (timePris >= 250) return "text-amber-600";
  return "text-muted-foreground";
}

function getKundeTypeLabel(companyStatus: string | null): string {
  if (companyStatus === "partner") return "Partner";
  if (companyStatus === "customer" || companyStatus === "kunde") return "Kunde";
  if (companyStatus === "prospect") return "Potensiell kunde";
  return "Direkte";
}

function computeOppdragStatus(r: any): string {
  return computeSharedOppdragStatus({
    status: r.status,
    start_dato: r.start_dato,
    slutt_dato: r.slutt_dato,
  });
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

export default function StacqPrisen() {
  const queryClient = useQueryClient();
  const [editRow, setEditRow] = useState<any | null>(null);
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "stacq", dir: "desc" });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["stacq-oppdrag-prisen"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stacq_oppdrag")
        .select("id, kandidat, er_ansatt, status, utpris, til_konsulent, til_konsulent_override, ekstra_kostnad, kunde, selskap_id, deal_type, start_dato, forny_dato, slutt_dato");
      if (error) throw error;
      return data || [];
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

  const enriched = useMemo(() =>
    rows
      .map((r) => {
        const computedStatus = computeOppdragStatus(r);
        return {
          ...r,
          status: computedStatus,
          stacqPris: calcStacqPris({
            utpris: r.utpris ?? 0,
            til_konsulent: r.til_konsulent ?? null,
            til_konsulent_override: r.til_konsulent_override ?? null,
            er_ansatt: r.er_ansatt ?? false,
            ekstra_kostnad: r.ekstra_kostnad ?? null,
          }),
        };
      })
      .filter((r) => r.status !== "Inaktiv"),
    [rows]
  );

  const aktive = enriched.filter((r) => r.status === "Aktiv");
  const aktiveAnsatte = aktive.filter((r) => r.er_ansatt === true);
  const aktiveEksterne = aktive.filter((r) => r.er_ansatt !== true);
  const oppstart = enriched.filter((r) => r.status === "Oppstart");
  const stacqTotalPerTime = aktive.reduce((s, r) => s + r.stacqPris, 0);
  const oppstartTotalPerTime = oppstart.reduce((s, r) => s + r.stacqPris, 0);
  const avgMarginPerAnsatt = aktiveAnsatte.length > 0
    ? aktiveAnsatte.reduce((s, r) => s + r.stacqPris, 0) / aktiveAnsatte.length
    : 0;
  const avgMarginPerEkstern = aktiveEksterne.length > 0
    ? aktiveEksterne.reduce((s, r) => s + r.stacqPris, 0) / aktiveEksterne.length
    : 0;
  const avgMarginPctPerAnsatt = aktiveAnsatte.length > 0
    ? aktiveAnsatte.reduce((s, r) => s + (r.utpris ? (r.stacqPris / r.utpris) * 100 : 0), 0) / aktiveAnsatte.length
    : 0;
  const avgMarginPctPerEkstern = aktiveEksterne.length > 0
    ? aktiveEksterne.reduce((s, r) => s + (r.utpris ? (r.stacqPris / r.utpris) * 100 : 0), 0) / aktiveEksterne.length
    : 0;

  const now = new Date();
  const workdayCount = (() => {
    const y = now.getFullYear(), m = now.getMonth();
    const dim = new Date(y, m + 1, 0).getDate();
    let wd = 0;
    for (let d = 1; d <= dim; d++) { const dow = new Date(y, m, d).getDay(); if (dow !== 0 && dow !== 6) wd++; }
    return wd;
  })();
  const monthlyTotal = stacqTotalPerTime * TIMER_PER_DAG * workdayCount;

  const chartData = useMemo(() => [
    ...SEED_HISTORY,
    { label: "Nå", value: Math.round(stacqTotalPerTime) },
  ], [stacqTotalPerTime]);

  const mangler5000 = Math.max(0, 5000 - stacqTotalPerTime);

  const toggleSort = (field: SortField) => {
    setSort((p) => p.field === field ? { field, dir: p.dir === "asc" ? "desc" : "asc" } : { field, dir: "desc" });
  };

  const sorted = useMemo(() => {
    const all = [...enriched].sort((a, b) => {
      // Aktiv first
      if (a.status !== b.status) return a.status === "Aktiv" ? -1 : 1;
      const dir = sort.dir === "asc" ? 1 : -1;
      switch (sort.field) {
        case "kandidat": return dir * (a.kandidat || "").localeCompare(b.kandidat || "", "nb");
        case "kunde": return dir * (a.kunde || "").localeCompare(b.kunde || "", "nb");
        case "utpris": return dir * ((a.utpris ?? 0) - (b.utpris ?? 0));
        case "stacq": return dir * (a.stacqPris - b.stacqPris);
        default: return 0;
      }
    });
    return all;
  }, [enriched, sort]);

  const totalPct = aktive.length > 0
    ? aktive.reduce((s, r) => s + (r.utpris ? (r.stacqPris / r.utpris) * 100 : 0), 0) / aktive.length
    : 0;

  const mobileSortValue = `${sort.field}:${sort.dir}`;

  const handleMobileSortChange = (value: string) => {
    const [field, dir] = value.split(":");
    setSort({ field: field as SortField, dir: dir as SortDir });
  };


  const SortHeader = ({ field, children, className = "" }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <button
      onClick={() => toggleSort(field)}
      className={`flex items-center gap-1 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      {children}
      <ArrowUpDown className={`h-3 w-3 ${sort.field === field ? "text-foreground" : "text-muted-foreground/20"}`} />
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <TrendingUp className="h-5 w-5 text-emerald-600" />
        <h1 className="text-[1.5rem] font-bold text-foreground">STACQ Prisen</h1>
      </div>

      {/* Hero stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="STACQ Prisen / time" value={`kr ${formatKr(Math.round(stacqTotalPerTime))}`} sub={`${aktive.length} konsulenter i oppdrag`} accent="emerald" suffix="/ time" />
        <StatCard label="STACQ Prisen / mnd" value={`kr ${formatKr(Math.round(monthlyTotal))}`} sub={`${workdayCount} arbeidsdager · ${format(now, "MMMM yyyy", { locale: nb })}`} suffix="/ mnd" />
        <StatCard label="Snitt margin per ansatt" value={`kr ${formatKr(Math.round(avgMarginPerAnsatt))} (${formatPct(avgMarginPctPerAnsatt)}%)`} sub="kun ansatte" suffix="/ time" />
        <StatCard label="Snitt margin per ekstern" value={`kr ${formatKr(Math.round(avgMarginPerEkstern))} (${formatPct(avgMarginPctPerEkstern)}%)`} sub="kun eksterne" suffix="/ time" />
        <StatCard label="Oppstart" value={`+ kr ${formatKr(Math.round(oppstartTotalPerTime))}`} sub={`${oppstart.length} konsulenter kommer snart`} accent="amber" suffix="/ time" />
      </div>

      {/* Chart */}
      <div className="border border-border rounded-lg bg-card shadow-card p-5">
        <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-4">
          STACQ Prisen — ukentlig utvikling
        </h2>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="stacqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="rgb(16,185,129)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="rgb(16,185,129)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.1)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v}`} />
              <ReTooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 13 }}
                formatter={(value: number) => [`kr ${formatKr(value)} / time`, "STACQ Pris"]}
              />
              <ReferenceLine y={5000} stroke="hsl(var(--warning))" strokeDasharray="6 4" label={{ value: "Mål: 5 000", position: "right", fontSize: 11, fill: "hsl(var(--warning))" }} />
              <Area type="monotone" dataKey="value" stroke="rgb(16,185,129)" strokeWidth={2} fill="url(#stacqGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {mangler5000 > 0 && (
          <p className="text-[0.8125rem] text-muted-foreground mt-3">
            Neste milepæl: <span className="font-medium text-foreground">kr 5 000/time</span> — mangler{" "}
            <span className="font-medium text-amber-600">kr {formatKr(Math.round(mangler5000))}/time</span>
          </p>
        )}
      </div>

      {/* Table */}
      <div>
        <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-3">
          Bidrag per konsulent
        </h2>
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Laster...</div>
        ) : (
          <>
            <div className="mb-3 md:hidden">
              <select
                value={mobileSortValue}
                onChange={(e) => handleMobileSortChange(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-card px-3 text-[0.8125rem] text-foreground"
              >
                <option value="stacq:desc">Sorter: Høyeste STACQ Pris</option>
                <option value="kandidat:asc">Sorter: Konsulent A-Å</option>
                <option value="kunde:asc">Sorter: Kunde A-Å</option>
                <option value="utpris:desc">Sorter: Høyeste utpris</option>
              </select>
            </div>

            <div className="space-y-3 md:hidden">
              {sorted.map((row) => {
                const pct = row.utpris ? (row.stacqPris / row.utpris) * 100 : 0;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setEditRow(row)}
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-left shadow-card"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[0.9375rem] font-semibold text-foreground truncate">{row.kandidat}</p>
                        <p className="mt-1 text-[0.8125rem] text-muted-foreground truncate">{row.kunde || "—"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-[0.9375rem] font-bold ${stacqColor(row.stacqPris)}`}>kr {formatKr(Math.round(row.stacqPris))}</p>
                        <p className="text-[0.75rem] text-muted-foreground">{Math.round(pct)}%</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[0.6875rem] font-medium text-foreground">
                        {getKundeTypeLabel(row.selskap_id ? companyStatusMap[row.selskap_id] : null)}
                      </span>
                      <span className="text-[0.8125rem] text-muted-foreground">Utpris {row.utpris ?? "–"}</span>
                      {row.status === "Aktiv" ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[0.6875rem] font-semibold">Aktiv</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 text-[0.6875rem] font-semibold">Oppstart</span>
                      )}
                    </div>
                  </button>
                );
              })}

              <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-card">
                <p className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">Total</p>
                <p className="mt-1 text-[1rem] font-bold text-emerald-600">kr {formatKr(Math.round(stacqTotalPerTime + oppstartTotalPerTime))}/time</p>
                <p className="text-[0.75rem] text-muted-foreground">{Math.round(totalPct)}% av utpris</p>
              </div>
            </div>

            <div className="hidden md:block border border-border rounded-lg overflow-hidden bg-card shadow-card">
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_80px_80px_80px_100px_60px_80px] gap-3 px-4 py-2.5 border-b border-border bg-background">
              <SortHeader field="kandidat">Konsulent</SortHeader>
              <SortHeader field="kunde">Kunde</SortHeader>
              <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">Type</span>
              <SortHeader field="utpris">Utpris</SortHeader>
              <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">Ekstra</span>
              <SortHeader field="stacq">STACQ Pris</SortHeader>
              <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground text-right">%</span>
              <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground text-right">Status</span>
            </div>
            <div className="divide-y divide-border">
              {sorted.map((row) => {
                const pct = row.utpris ? (row.stacqPris / row.utpris) * 100 : 0;
                return (
                  <div
                    key={row.id}
                    onClick={() => setEditRow(row)}
                    className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_80px_80px_80px_100px_60px_80px] gap-3 items-center px-4 min-h-[44px] py-2 hover:bg-background/80 transition-colors duration-75 cursor-pointer"
                  >
                    <span className="text-[0.8125rem] font-medium text-foreground truncate">{row.kandidat}</span>
                    <span className="text-[0.8125rem] text-muted-foreground truncate">{row.kunde || "–"}</span>
                    <span>
                      {(() => {
                        const cs = row.selskap_id ? companyStatusMap[row.selskap_id] : null;
                        if (cs === "partner") return <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-0.5 text-[0.6875rem] font-semibold">Partner</span>;
                        if (cs === "customer" || cs === "kunde") return <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-[0.6875rem] font-semibold">Kunde</span>;
                        if (cs === "prospect") return <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-0.5 text-[0.6875rem] font-semibold">Potensiell</span>;
                        return <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-500 border border-gray-200 px-2.5 py-0.5 text-[0.6875rem] font-semibold">—</span>;
                      })()}
                    </span>
                    <span className="text-[0.8125rem] text-muted-foreground">{row.utpris ?? "–"}</span>
                    <span className="text-[0.8125rem]">
                      {(row.ekstra_kostnad ?? 0) > 0 ? (
                        <span className="text-destructive/60">−{row.ekstra_kostnad}</span>
                      ) : "–"}
                    </span>
                    <span className={`text-[0.8125rem] font-bold ${stacqColor(row.stacqPris)}`}>
                      kr {formatKr(Math.round(row.stacqPris))}
                    </span>
                    <span className={`text-[0.8125rem] text-right ${stacqColor(row.stacqPris)}`}>
                      {Math.round(pct)}%
                    </span>
                    <div className="flex justify-end">
                      {row.status === "Aktiv" ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[0.6875rem] font-semibold">Aktiv</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 text-[0.6875rem] font-semibold">Oppstart</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Total row */}
              <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_80px_80px_80px_100px_60px_80px] gap-3 items-center px-4 min-h-[44px] py-2 bg-background/50 font-bold">
                <span className="text-[0.8125rem] text-foreground">TOTAL</span>
                <span />
                <span />
                <span />
                <span />
                <span className="text-[0.8125rem] text-emerald-600">kr {formatKr(Math.round(stacqTotalPerTime + oppstartTotalPerTime))}/time</span>
                <span className="text-[0.8125rem] text-right text-muted-foreground">{Math.round(totalPct)}%</span>
                <span />
              </div>
            </div>
            </div>
          </>
        )}
      </div>

      {/* Edit modal */}
      {editRow && <EditModal row={editRow} onClose={() => setEditRow(null)} queryClient={queryClient} />}
    </div>
  );
}

function StatCard({ label, value, sub, accent, suffix }: {
  label: string; value: string; sub: string; accent?: "emerald" | "amber"; suffix?: string;
}) {
  const borderColor = accent === "emerald" ? "border-emerald-200" : accent === "amber" ? "border-amber-200" : "border-border";
  return (
    <div className={`border ${borderColor} rounded-lg bg-card shadow-card p-4`}>
      <p className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="text-[1.375rem] font-bold text-foreground mt-1">
        {value} <span className="text-[0.75rem] font-normal text-muted-foreground">{suffix}</span>
      </p>
      <p className="text-[0.75rem] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}

function EditModal({ row, onClose, queryClient }: { row: any; onClose: () => void; queryClient: any }) {
  const [utpris, setUtpris] = useState(row.utpris?.toString() || "");
  const [override, setOverride] = useState(row.til_konsulent_override?.toString() || "");
  const [ekstra, setEkstra] = useState(row.ekstra_kostnad?.toString() || "");
  const [saving, setSaving] = useState(false);

  const saveMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("stacq_oppdrag").update({
        utpris: utpris ? Number(utpris) : null,
        til_konsulent_override: override ? Number(override) : null,
        ekstra_kostnad: ekstra ? Number(ekstra) : null,
      }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Oppdatert");
      queryClient.invalidateQueries({ queryKey: ["stacq-oppdrag-prisen"] });
      onClose();
    },
    onError: () => toast.error("Kunne ikke lagre"),
  });

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm rounded-xl p-6 gap-0" onInteractOutside={(e) => e.preventDefault()}>
        <DialogTitle className="text-[1.125rem] font-bold text-foreground mb-4">
          Juster STACQ Prisen — {row.kandidat}
        </DialogTitle>
        <div className="space-y-3">
          <div>
            <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Utpris</label>
            <Input type="number" value={utpris} onChange={(e) => setUtpris(e.target.value)} className="mt-1 text-[0.875rem]" />
          </div>
          <div>
            <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Til konsulent override</label>
            <Input type="number" value={override} onChange={(e) => setOverride(e.target.value)} placeholder="Tom = standard 70%" className="mt-1 text-[0.875rem]" />
          </div>
          <div>
            <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Ekstra kostnad / dag</label>
            <Input type="number" value={ekstra} onChange={(e) => setEkstra(e.target.value)} placeholder="f.eks. 80 for deal-bonus" className="mt-1 text-[0.875rem]" />
            <p className="text-[0.75rem] text-muted-foreground mt-1">Ekstra kostnad trekkes fra STACQ Prisen. Brukes for deal-avtaler, bonus-forpliktelser e.l.</p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
          <button onClick={onClose} className="text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors">Avbryt</button>
          <button
            disabled={saving}
            onClick={() => { setSaving(true); saveMut.mutate(); }}
            className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90"
          >
            {saving ? "Lagrer..." : "Lagre"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
