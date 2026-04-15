import { useState, useMemo, useCallback } from "react";
import { format, startOfDay } from "date-fns";
import { nb } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { calcStacqPris } from "@/lib/stacqPris";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowUpDown, TrendingUp, ChevronUp, ChevronDown,
  Users, Building2, LayoutDashboard, Briefcase, Clock,
  Settings, LogOut, Radar, UserPlus, Globe, Search,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Dialog, DialogContent, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TextSizeControl, SCALE_MAP, type TextSize } from "@/components/designlab/TextSizeControl";
import { usePersistentState } from "@/hooks/usePersistentState";

/* ═══ V8 COLOR CONSTANTS ═══ */
const C = {
  bg: "#f7f8f8",
  sidebarBg: "#ecedf0",
  surface: "#ffffff",
  surfaceAlt: "#f3f4f5",
  text: "#1d2028",
  textMuted: "#6b6f76",
  textFaint: "#8a8f98",
  textGhost: "#a2a5ab",
  accent: "#01696F",
  accentBg: "rgba(1,105,111,0.06)",
  border: "#e6e6e6",
  borderLight: "#eff0f1",
  hoverBg: "rgba(0,0,0,0.03)",
  activeBg: "rgba(1,105,111,0.05)",
  shadow: "0 1px 2px rgba(0,0,0,0.04)",
  danger: "#9a4a4a",
  dangerBg: "rgba(154,74,74,0.06)",
  success: "#4a9a6a",
  successBg: "rgba(74,154,106,0.06)",
  warning: "#9a7a2a",
  warningBg: "rgba(154,122,42,0.06)",
} as const;

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

function getKundeTypeLabel(companyStatus: string | null): string {
  if (companyStatus === "partner") return "Partner";
  if (companyStatus === "customer" || companyStatus === "kunde") return "Kunde";
  if (companyStatus === "prospect") return "Potensiell";
  return "Direkte";
}

function computeOppdragStatus(r: any): string {
  if (r.status === "Inaktiv") return "Inaktiv";
  const today = startOfDay(new Date());
  const startDate = parseOppdragDate(r.start_dato);
  if (startDate && startDate > today) return "Oppstart";
  return "Aktiv";
}

function parseOppdragDate(value?: string | null): Date | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/* ═══ NAV ═══ */
const NAV_MAIN = [
  { label: "Salgsagent", icon: LayoutDashboard, href: "/" },
  { label: "Selskaper", icon: Building2, href: "/selskaper" },
  { label: "Kontakter", icon: Users, href: "/design-lab/kontakter" },
  { label: "Forespørsler", icon: Briefcase, href: "/design-lab/foresporsler" },
  { label: "Oppfølginger", icon: Clock, href: "/oppfolginger" },
];
const NAV_STACQ = [
  { label: "STACQ Prisen", icon: TrendingUp, href: "/design-lab/stacq-prisen", active: true },
  { label: "Markedsradar", icon: Radar, href: "/markedsradar" },
  { label: "Ansatte", icon: Users, href: "/konsulenter/ansatte" },
  { label: "Eksterne", icon: UserPlus, href: "/konsulenter/eksterne" },
  { label: "stacq.no", icon: Globe, href: "/nettside-ai" },
];

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function DesignLabStacqPrisen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { signOut, user } = useAuth();
  const [textSize, setTextSize] = usePersistentState<TextSize>("dl-text-size", "M");
  const [editRow, setEditRow] = useState<any | null>(null);
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "stacq", dir: "desc" });
  const initials = user?.email ? user.email.split("@")[0].slice(0, 2).toUpperCase() : "??";

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["stacq-oppdrag-prisen"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stacq_oppdrag")
        .select("id, kandidat, er_ansatt, status, utpris, til_konsulent, til_konsulent_override, ekstra_kostnad, kunde, selskap_id, deal_type, start_dato, forny_dato, slutt_dato")
        .neq("status", "Inaktiv");
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
    })),
    [rows]
  );

  const aktive = enriched.filter((r) => r.status === "Aktiv");
  const oppstart = enriched.filter((r) => r.status === "Oppstart");
  const stacqTotalPerTime = aktive.reduce((s, r) => s + r.stacqPris, 0);
  const oppstartTotalPerTime = oppstart.reduce((s, r) => s + r.stacqPris, 0);
  const avgPrisPerTime = aktive.length > 0 ? stacqTotalPerTime / aktive.length : 0;

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

      {/* ═══ SIDEBAR ═══ */}
      <aside className="flex flex-col shrink-0" style={{ width: 216, borderRight: `1px solid ${C.border}`, background: C.bg }}>
        <div className="flex items-center gap-2 px-4" style={{ height: 44 }}>
          <div className="flex items-center justify-center rounded" style={{ width: 22, height: 22, background: C.accent, color: "#fff", fontSize: 11, fontWeight: 700 }}>S</div>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>STACQ</span>
        </div>
        <div className="px-3 mb-1">
          <button className="flex items-center gap-2 w-full px-2 py-1.5" style={{ fontSize: 13, color: C.textFaint, background: "transparent", borderRadius: 6 }}>
            <Search style={{ width: 14, height: 14 }} />
            <span className="flex-1 text-left">Søk</span>
            <kbd className="rounded px-1" style={{ fontSize: 10, color: C.textGhost, background: "rgba(0,0,0,0.06)" }}>⌘K</kbd>
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 space-y-4 pb-3">
          <NavGroup items={NAV_MAIN} navigate={navigate} />
          <div>
            <p className="px-2 pb-1.5 pt-1" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: C.textGhost }}>STACQ</p>
            <NavGroup items={NAV_STACQ} navigate={navigate} />
          </div>
        </nav>
        <div className="px-3 py-2 space-y-0.5" style={{ borderTop: `1px solid ${C.border}` }}>
          <SidebarBtn icon={Settings} label="Innstillinger" onClick={() => navigate("/innstillinger")} />
          <SidebarBtn icon={LogOut} label="Logg ut" onClick={signOut} muted />
          {user && (
            <div className="flex items-center gap-2 px-2 pt-2 pb-1">
              <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 24, height: 24, background: C.accentBg, color: C.accent, fontSize: 10, fontWeight: 600 }}>{initials}</div>
              <span className="truncate" style={{ fontSize: 12, color: C.textGhost }}>{user.email}</span>
            </div>
          )}
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ zoom: SCALE_MAP[textSize] }}>
        {/* Header */}
        <header className="flex items-center justify-between px-6 shrink-0" style={{ height: 44, borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-baseline gap-2.5">
            <h1 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>STACQ Prisen</h1>
          </div>
          <TextSizeControl value={textSize} onChange={setTextSize} />
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto" style={{ padding: "24px 24px 48px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          {/* Stat line */}
          <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>
            <span style={{ fontWeight: 600, color: C.text }}>kr {formatKr(Math.round(stacqTotalPerTime))}/t</span>
            {" · "}
            {aktive.length} konsulenter
            {" · "}
            snitt {formatKr(Math.round(avgPrisPerTime))}/t
            {" · "}
            <span style={{ color: C.warning }}>+{formatKr(Math.round(oppstartTotalPerTime))} oppstart</span>
            {" · "}
            {formatKr(Math.round(monthlyTotal))}/mnd ({format(now, "MMMM", { locale: nb })})
          </p>

          {/* Chart */}
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, padding: 20, marginBottom: 24 }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: C.textMuted, marginBottom: 16 }}>
              STACQ Prisen — ukentlig utvikling
            </p>
            <div style={{ height: 240 }}>
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

          {/* Table */}
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: C.textMuted, marginBottom: 10 }}>
            Bidrag per konsulent
          </p>

          {isLoading ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: C.textFaint, fontSize: 13 }}>Laster…</div>
          ) : (
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", background: C.surface }}>
              {/* Table header */}
              <div
                className="grid items-center"
                style={{
                  gridTemplateColumns: "minmax(0,2fr) minmax(0,1.5fr) 80px 80px 80px 100px 56px 80px",
                  height: 34, paddingInline: 16, borderBottom: `1px solid ${C.border}`, background: C.bg,
                }}
              >
                <ColHeader label="Konsulent" field="kandidat" sort={sort} onSort={toggleSort} />
                <ColHeader label="Kunde" field="kunde" sort={sort} onSort={toggleSort} />
                <span style={thStyle}>Type</span>
                <ColHeader label="Utpris" field="utpris" sort={sort} onSort={toggleSort} />
                <span style={thStyle}>Ekstra</span>
                <ColHeader label="STACQ Pris" field="stacq" sort={sort} onSort={toggleSort} />
                <span style={{ ...thStyle, textAlign: "right" }}>%</span>
                <span style={{ ...thStyle, textAlign: "right" }}>Status</span>
              </div>

              {/* Rows */}
              {sorted.map((row) => {
                const pct = row.utpris ? (row.stacqPris / row.utpris) * 100 : 0;
                const cs = row.selskap_id ? companyStatusMap[row.selskap_id] : null;
                const priceColor = stacqColorV8(row.stacqPris);
                return (
                  <div
                    key={row.id}
                    onClick={() => setEditRow(row)}
                    className="grid items-center cursor-pointer"
                    style={{
                      gridTemplateColumns: "minmax(0,2fr) minmax(0,1.5fr) 80px 80px 80px 100px 56px 80px",
                      minHeight: 40, paddingInline: 16,
                      borderBottom: `1px solid ${C.borderLight}`,
                      transition: "background 50ms",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverBg; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
                  >
                    <span className="truncate" style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{row.kandidat}</span>
                    <span className="truncate" style={{ fontSize: 13, color: C.textMuted }}>{row.kunde || "–"}</span>
                    <span><TypeBadge status={cs} /></span>
                    <span style={{ fontSize: 13, color: C.textMuted }}>{row.utpris ?? "–"}</span>
                    <span style={{ fontSize: 13 }}>
                      {(row.ekstra_kostnad ?? 0) > 0
                        ? <span style={{ color: C.danger }}>−{row.ekstra_kostnad}</span>
                        : <span style={{ color: C.textFaint }}>–</span>}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: priceColor }}>kr {formatKr(Math.round(row.stacqPris))}</span>
                    <span style={{ fontSize: 13, textAlign: "right", color: priceColor }}>{Math.round(pct)}%</span>
                    <div className="flex justify-end">
                      <StatusBadge status={row.status} />
                    </div>
                  </div>
                );
              })}

              {/* Total row */}
              <div
                className="grid items-center"
                style={{
                  gridTemplateColumns: "minmax(0,2fr) minmax(0,1.5fr) 80px 80px 80px 100px 56px 80px",
                  minHeight: 40, paddingInline: 16,
                  background: C.bg, fontWeight: 600,
                }}
              >
                <span style={{ fontSize: 13, color: C.text }}>TOTAL</span>
                <span /><span /><span /><span />
                <span style={{ fontSize: 13, color: C.accent }}>kr {formatKr(Math.round(stacqTotalPerTime + oppstartTotalPerTime))}/t</span>
                <span style={{ fontSize: 13, textAlign: "right", color: C.textMuted }}>{Math.round(totalPct)}%</span>
                <span />
              </div>
            </div>
          )}
          </div>
        </div>
      </main>

      {/* Edit modal */}
      {editRow && (
        <div className="dl-v8-theme">
          <EditModal row={editRow} onClose={() => setEditRow(null)} queryClient={queryClient} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

const thStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: C.textMuted,
};

function TypeBadge({ status }: { status: string | null }) {
  let label = "—";
  let bg: string = "rgba(0,0,0,0.04)";
  let color: string = C.textFaint;
  let borderColor: string = C.border;
  if (status === "partner") { label = "Partner"; bg = C.warningBg; color = C.warning; borderColor = "rgba(154,122,42,0.15)"; }
  else if (status === "customer" || status === "kunde") { label = "Kunde"; bg = C.successBg; color = C.success; borderColor = "rgba(74,154,106,0.15)"; }
  else if (status === "prospect") { label = "Potensiell"; bg = C.accentBg; color = C.accent; borderColor = "rgba(1,105,111,0.15)"; }
  return (
    <span className="inline-flex items-center rounded-full" style={{ fontSize: 11, fontWeight: 500, paddingInline: 8, paddingBlock: 2, background: bg, color, border: `1px solid ${borderColor}` }}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "Aktiv";
  return (
    <span className="inline-flex items-center rounded-full" style={{
      fontSize: 11, fontWeight: 500, paddingInline: 8, paddingBlock: 2,
      background: isActive ? C.successBg : C.warningBg,
      color: isActive ? C.success : C.warning,
      border: `1px solid ${isActive ? "rgba(74,154,106,0.15)" : "rgba(154,122,42,0.15)"}`,
    }}>
      {status}
    </span>
  );
}

function ColHeader({ label, field, sort, onSort, className }: {
  label: string; field: SortField; sort: { field: SortField; dir: SortDir };
  onSort: (f: SortField) => void; className?: string;
}) {
  const active = sort.field === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={`flex items-center gap-0.5 transition-colors ${className || ""}`}
      style={{ fontSize: 11, fontWeight: active ? 700 : 600, textTransform: "uppercase", letterSpacing: "0.04em", color: active ? C.text : C.textMuted }}
    >
      {label}
      {active && (sort.dir === "asc" ? <ChevronUp style={{ width: 12, height: 12 }} /> : <ChevronDown style={{ width: 12, height: 12 }} />)}
    </button>
  );
}

function NavGroup({ items, navigate }: { items: { label: string; icon: any; href: string; active?: boolean }[]; navigate: (p: string) => void }) {
  return (
    <div className="space-y-px">
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => navigate(item.href)}
          className="flex items-center gap-2 w-full px-2 py-[5px] transition-colors"
          style={{
            fontSize: 13, fontWeight: item.active ? 600 : 500,
            color: item.active ? C.text : C.textMuted,
            background: item.active ? "rgba(0,0,0,0.05)" : "transparent",
            borderRadius: 6,
          }}
          onMouseEnter={(e) => { if (!item.active) e.currentTarget.style.background = C.hoverBg; }}
          onMouseLeave={(e) => { if (!item.active) e.currentTarget.style.background = item.active ? "rgba(0,0,0,0.05)" : "transparent"; }}
        >
          <item.icon style={{ width: 15, height: 15, strokeWidth: 1.6 }} />
          {item.label}
        </button>
      ))}
    </div>
  );
}

function SidebarBtn({ icon: Icon, label, onClick, muted }: { icon: any; label: string; onClick: () => void; muted?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full px-2 py-[5px] transition-colors"
      style={{ fontSize: 13, fontWeight: 500, color: muted ? C.textGhost : C.textMuted, borderRadius: 6 }}
      onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <Icon style={{ width: 15, height: 15, strokeWidth: 1.6 }} />
      {label}
    </button>
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
      <DialogContent
        className="max-w-sm rounded-xl p-6 gap-0"
        style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text }}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 16 }}>
          Juster STACQ Prisen — {row.kandidat}
        </DialogTitle>
        <div className="space-y-3">
          <div>
            <label style={{ ...thStyle, display: "block", marginBottom: 4 }}>Utpris</label>
            <Input type="number" value={utpris} onChange={(e) => setUtpris(e.target.value)} style={{ fontSize: 14, border: `1px solid ${C.border}` }} />
          </div>
          <div>
            <label style={{ ...thStyle, display: "block", marginBottom: 4 }}>Til konsulent override</label>
            <Input type="number" value={override} onChange={(e) => setOverride(e.target.value)} placeholder="Tom = standard 70%" style={{ fontSize: 14, border: `1px solid ${C.border}` }} />
          </div>
          <div>
            <label style={{ ...thStyle, display: "block", marginBottom: 4 }}>Ekstra kostnad / dag</label>
            <Input type="number" value={ekstra} onChange={(e) => setEkstra(e.target.value)} placeholder="f.eks. 80 for deal-bonus" style={{ fontSize: 14, border: `1px solid ${C.border}` }} />
            <p style={{ fontSize: 12, color: C.textFaint, marginTop: 4 }}>Ekstra kostnad trekkes fra STACQ Prisen. Brukes for deal-avtaler, bonus-forpliktelser e.l.</p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
          <button onClick={onClose} style={{ fontSize: 13, color: C.textFaint }} className="hover:opacity-80 transition-opacity">Avbryt</button>
          <button
            disabled={saving}
            onClick={() => { setSaving(true); saveMut.mutate(); }}
            className="inline-flex items-center gap-1.5 rounded-md transition-opacity hover:opacity-90"
            style={{ height: 32, paddingInline: 14, fontSize: 13, fontWeight: 500, background: C.accent, color: "#fff", borderRadius: 6 }}
          >
            {saving ? "Lagrer…" : "Lagre"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
