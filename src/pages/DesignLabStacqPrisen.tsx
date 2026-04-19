import { useMemo, useCallback, useState } from "react";
import { format, startOfDay } from "date-fns";
import { nb } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { calcStacqPris } from "@/lib/stacqPris";
import { countNorwegianWorkdays } from "@/lib/norwegianHolidays";
import { getInitials } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { getDesignLabTextSizeStyle, type TextSize } from "@/components/designlab/TextSizeControl";
import { usePersistentState } from "@/hooks/usePersistentState";
import { C } from "@/components/designlab/theme";
import { DesignLabSidebar } from "@/components/designlab/DesignLabSidebar";
import { DesignLabColumnHeader } from "@/components/designlab/system";
import { computeOppdragStatus as computeSharedOppdragStatus } from "@/lib/oppdragForm";
import { DesignLabStaticTag } from "@/components/designlab/controls";

/* Colors imported from @/components/designlab/theme */

type SortField = "kandidat" | "kunde" | "stacq" | "utpris";
type SortDir = "asc" | "desc";
const TIMER_PER_DAG = 7.5;

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

function stacqColorV8(timePris: number): string {
  if (timePris >= 450) return C.accent;
  if (timePris >= 350) return C.success;
  if (timePris >= 250) return C.warning;
  return C.textFaint;
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
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}




/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function DesignLabStacqPrisen() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [textSize, setTextSize] = usePersistentState<TextSize>("dl-text-size", "M");
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

  const { data: ansatteListe = [] } = useQuery({
    queryKey: ["ansatte-names-prisen"],
    queryFn: async () => {
      const { data } = await supabase.from("stacq_ansatte").select("id, navn");
      return data || [];
    },
  });

  const { data: cvPortraits = [] } = useQuery({
    queryKey: ["cv-portraits-prisen"],
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

  const companyStatusMap: Record<string, string> = Object.fromEntries(
    allCompanies.map((c: any) => [c.id, c.status])
  );

  const enriched = useMemo(() =>
    rows.map((r) => ({
      ...r,
      status: computeOppdragStatus(r),
      stacqPris: calcStacqPris({
        utpris: r.utpris ?? 0,
        til_konsulent: r.til_konsulent ?? null,
        til_konsulent_override: r.til_konsulent_override ?? null,
        er_ansatt: r.er_ansatt ?? false,
        ekstra_kostnad: r.ekstra_kostnad ?? null,
      }),
    })).filter((r) => r.status !== "Inaktiv"),
    [rows]
  );

  const aktive = enriched.filter((r) => r.status === "Aktiv");
  const oppstart = enriched.filter((r) => r.status === "Oppstart");
  const stacqTotalPerTime = aktive.reduce((s, r) => s + r.stacqPris, 0);
  const oppstartTotalPerTime = oppstart.reduce((s, r) => s + r.stacqPris, 0);
  const avgPrisPerTime = aktive.length > 0 ? stacqTotalPerTime / aktive.length : 0;

  const now = new Date();
  const workdayCount = countNorwegianWorkdays(now.getFullYear(), now.getMonth());
  const monthlyTotal = stacqTotalPerTime * TIMER_PER_DAG * workdayCount;

  const chartData = useMemo(() => [
    ...SEED_HISTORY,
    { label: "Nå", value: Math.round(stacqTotalPerTime) },
  ], [stacqTotalPerTime]);

  const mangler5000 = Math.max(0, 5000 - stacqTotalPerTime);

  const toggleSort = useCallback((field: SortField) => {
    setSort((p) => p.field === field ? { field, dir: p.dir === "asc" ? "desc" : "asc" } : { field, dir: "desc" });
  }, []);

  const sorted = useMemo(() => {
    return [...enriched].sort((a, b) => {
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
  }, [enriched, sort]);

  const totalPct = aktive.length > 0
    ? aktive.reduce((s, r) => s + (r.utpris ? (r.stacqPris / r.utpris) * 100 : 0), 0) / aktive.length
    : 0;

  return (
    <div className="flex h-screen overflow-hidden select-none" style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif", background: C.bg }}>

      <DesignLabSidebar navigate={navigate} signOut={signOut} user={user} activePath="/design-lab/stacq-prisen" />

      {/* ═══ MAIN ═══ */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ ...getDesignLabTextSizeStyle(textSize), background: C.appBg }}>
        {/* Header */}
        <header className="flex items-center justify-between px-6 shrink-0" style={{ height: 40, borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-baseline gap-2.5">
            <h1 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>STACQ Prisen</h1>
          </div>
          
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto" style={{ padding: "24px 24px 48px" }}>
          <div className="flex flex-col gap-4" style={{ maxWidth: "none", margin: 0 }}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <TopStatCard
                label="STACQ Prisen / time"
                value={`kr ${formatKr(Math.round(stacqTotalPerTime))}`}
                sub={`${aktive.length} konsulenter i oppdrag`}
                accent="emerald"
                suffix="/ time"
              />
              <TopStatCard
                label="STACQ Prisen / mnd"
                value={`kr ${formatKr(Math.round(monthlyTotal))}`}
                sub={`${workdayCount} arbeidsdager · ${format(now, "MMMM yyyy", { locale: nb })}`}
                suffix="/ mnd"
              />
              <TopStatCard
                label="Snitt per konsulent"
                value={`kr ${formatKr(Math.round(avgPrisPerTime))}`}
                sub="gjennomsnitt"
                suffix="/ time"
              />
              <TopStatCard
                label="Oppstart"
                value={`+ kr ${formatKr(Math.round(oppstartTotalPerTime))}`}
                sub={`${oppstart.length} konsulenter kommer snart`}
                accent="amber"
                suffix="/ time"
              />
            </div>

            <div
              className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(860px,1.18fr)_minmax(620px,0.92fr)] xl:items-stretch"
              style={{ maxWidth: "none", margin: 0 }}
            >
            <div className="min-w-0 w-full">
              {isLoading ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: C.textFaint, fontSize: 13 }}>Laster…</div>
              ) : (
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", background: C.surface }}>
                  <div
                    className="grid items-center"
                    style={{
                      gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1.4fr) 100px 88px 80px 112px 64px 84px",
                      height: 34, paddingInline: 16, borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt,
                    }}
                  >
                    <DesignLabColumnHeader label="Konsulent" field="kandidat" sort={sort} onSort={toggleSort} />
                    <DesignLabColumnHeader label="Kunde" field="kunde" sort={sort} onSort={toggleSort} />
                    <span style={thStyle}>Type</span>
                    <DesignLabColumnHeader label="Utpris" field="utpris" sort={sort} onSort={toggleSort} className="justify-end" />
                    <span style={{ ...thStyle, textAlign: "right", display: "block" }}>Ekstra</span>
                    <DesignLabColumnHeader label="STACQ Pris" field="stacq" sort={sort} onSort={toggleSort} className="justify-end" />
                    <span style={{ ...thStyle, textAlign: "right", display: "block" }}>%</span>
                    <span style={{ ...thStyle, textAlign: "right", display: "block" }}>Status</span>
                  </div>

                  {sorted.map((row) => {
                    const pct = row.utpris ? (row.stacqPris / row.utpris) * 100 : 0;
                    const cs = row.selskap_id ? companyStatusMap[row.selskap_id] : null;
                    const priceColor = stacqColorV8(row.stacqPris);
                    return (
                      <div
                        key={row.id}
                        className="grid items-center"
                        style={{
                          gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1.4fr) 100px 88px 80px 112px 64px 84px",
                          minHeight: 38, paddingInline: 16,
                          borderBottom: `1px solid ${C.borderLight}`,
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {(() => {
                            const ansattId = row.er_ansatt ? nameToAnsattId.get((row.kandidat || "").trim().toLowerCase()) : undefined;
                            const portrait = ansattId ? portraitByAnsattId.get(ansattId) : undefined;
                            if (row.er_ansatt && portrait) {
                              return <img src={portrait} alt={row.kandidat} style={{ width: 20, height: 20, borderRadius: 9999, objectFit: "cover", border: `1px solid ${C.borderLight}`, flexShrink: 0 }} />;
                            }
                            if (row.er_ansatt) {
                              return (
                                <div style={{ width: 20, height: 20, borderRadius: 9999, background: C.accentBg, color: C.accent, fontSize: 9, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  {getInitials(row.kandidat || "?")}
                                </div>
                              );
                            }
                            return (
                              <div style={{ width: 20, height: 20, borderRadius: 9999, background: C.surfaceAlt, color: C.textMuted, fontSize: 9, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                {getInitials(row.kandidat || "?")}
                              </div>
                            );
                          })()}
                          <span className="truncate" style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{row.kandidat}</span>
                        </div>
                        <span className="truncate" style={{ fontSize: 13, color: C.textMuted }}>{row.kunde || "–"}</span>
                        <span><TypeBadge dealType={row.deal_type} /></span>
                        <span style={{ fontSize: 13, color: C.textMuted, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.utpris ?? "–"}</span>
                        <span style={{ fontSize: 13, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {(row.ekstra_kostnad ?? 0) > 0
                            ? <span style={{ color: C.danger }}>−{row.ekstra_kostnad}</span>
                            : <span style={{ color: C.textFaint }}>–</span>}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: priceColor, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>kr {formatKr(Math.round(row.stacqPris))}</span>
                        <span style={{ fontSize: 13, textAlign: "right", color: priceColor, fontVariantNumeric: "tabular-nums" }}>{Math.round(pct)}%</span>
                        <div className="flex justify-end">
                          <StatusBadge status={row.status} />
                        </div>
                      </div>
                    );
                  })}

                  <div
                    className="grid items-center"
                    style={{
                      gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1.4fr) 100px 88px 80px 112px 64px 84px",
                      minHeight: 38, paddingInline: 16,
                      background: C.surfaceAlt, fontWeight: 600,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div style={{ width: 20, height: 20, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: C.text }}>TOTAL</span>
                    </div>
                    <span /><span /><span /><span />
                    <span style={{ fontSize: 13, color: C.accent, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>kr {formatKr(Math.round(stacqTotalPerTime + oppstartTotalPerTime))}/t</span>
                    <span style={{ fontSize: 13, textAlign: "right", color: C.textMuted, fontVariantNumeric: "tabular-nums" }}>{Math.round(totalPct)}%</span>
                    <span />
                  </div>
                </div>
              )}
            </div>

            <aside className="w-full h-full">
              <div
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  background: C.surface,
                  padding: 24,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: C.textMuted, marginBottom: 16 }}>
                  STACQ Prisen — ukentlig utvikling
                </p>
                <div style={{ flex: 1, minHeight: 420 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="stacqGradV8" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={C.accent} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={C.accent} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.textFaint }} stroke={C.border} />
                      <YAxis tick={{ fontSize: 11, fill: C.textFaint }} stroke={C.border} tickFormatter={(v) => `${v}`} />
                      <ReTooltip
                        contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, color: C.text }}
                        formatter={(value: number) => [`kr ${formatKr(value)} / time`, "STACQ Pris"]}
                      />
                      <ReferenceLine y={5000} stroke={C.warning} strokeDasharray="6 4" label={{ value: "Mål: 5 000", position: "right", fontSize: 11, fill: C.warning }} />
                      <Area type="monotone" dataKey="value" stroke={C.accent} strokeWidth={2} fill="url(#stacqGradV8)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {mangler5000 > 0 && (
                  <p style={{ fontSize: 13, color: C.textMuted, marginTop: 12 }}>
                    Neste milepæl: <span style={{ fontWeight: 500, color: C.text }}>kr 5 000/time</span> — mangler{" "}
                    <span style={{ fontWeight: 500, color: C.warning }}>kr {formatKr(Math.round(mangler5000))}/time</span>
                  </p>
                )}
              </div>
            </aside>
          </div>
          </div>
        </div>
      </main>

    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

const thStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted,
};

function TopStatCard({
  label,
  value,
  sub,
  accent,
  suffix,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: "emerald" | "amber";
  suffix?: string;
}) {
  const borderColor = accent === "emerald"
    ? "rgba(74,154,106,0.24)"
    : accent === "amber"
      ? "rgba(154,122,42,0.24)"
      : C.border;

  return (
    <div
      style={{
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        background: C.surface,
        padding: 16,
        boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
      }}
    >
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted }}>
        {label}
      </p>
      <p style={{ marginTop: 6, fontSize: 22, fontWeight: 700, color: C.text }}>
        {value}
        {suffix && <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 400, color: C.textFaint }}>{suffix}</span>}
      </p>
      <p style={{ marginTop: 4, fontSize: 12, color: C.textMuted }}>{sub}</p>
    </div>
  );
}

function TypeBadge({ dealType }: { dealType: string | null }) {
  const isVia = dealType === "VIA";
  if (isVia) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-0.5 text-[0.6875rem] font-semibold">
        Via partner
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 text-[0.6875rem] font-semibold">
      Direkte
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors =
    status === "Aktiv"
      ? { background: "#EAF7EF", color: "#197A52", border: "1px solid rgba(25,122,82,0.16)", fontWeight: 600 }
      : status === "Oppstart"
        ? { background: "#F6EFE2", color: "#9A7A2A", border: "1px solid rgba(154,122,42,0.16)", fontWeight: 600 }
        : { background: "#F7F8FA", color: "#8C929C", border: "1px solid #E3E6EB", fontWeight: 500 };
  return <DesignLabStaticTag colors={colors}>{status}</DesignLabStaticTag>;
}
