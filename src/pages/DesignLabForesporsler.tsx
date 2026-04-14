import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import {
  Search, ChevronDown, ChevronUp, X,
  Users, Building2, LayoutDashboard, Briefcase, Settings, LogOut,
  UserPlus, Radar, TrendingUp, Globe, Clock, ArrowUpRight,
} from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { nb } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { ForespørselSheet } from "@/components/ForespørselSheet";
import { crmQueryKeys } from "@/lib/queryKeys";
import { TextSizeControl, SCALE_MAP, type TextSize } from "@/components/designlab/TextSizeControl";
import { usePersistentState } from "@/hooks/usePersistentState";

/* ═══════════════════════════════════════════════════════════
   TYPES & CONSTANTS
   ═══════════════════════════════════════════════════════════ */

type StatusFilter = "aktive" | "utgatte" | "alle";
type TypeFilter = "Alle" | "DIR" | "VIA";
type SortField = "mottatt_dato" | "selskap_navn" | "sendt_count" | "kontakt";
type SortDir = "asc" | "desc";

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: "aktive", label: "Aktive" },
  { value: "utgatte", label: "Utgåtte" },
  { value: "alle", label: "Alle" },
];

const TYPE_CHIPS: { value: TypeFilter; label: string }[] = [
  { value: "Alle", label: "Alle" },
  { value: "DIR", label: "Direkte" },
  { value: "VIA", label: "Partner" },
];

/* ── V8 Colors ── */
const C = {
  bg: "#F7F6F2",
  surface: "#FFFFFF",
  text: "#28251D",
  textMuted: "#6B6B66",
  textFaint: "#9C9C97",
  textGhost: "#BAB9B4",
  accent: "#01696F",
  accentBg: "rgba(1,105,111,0.06)",
  border: "rgba(40,37,29,0.08)",
  borderLight: "rgba(40,37,29,0.05)",
  hoverBg: "rgba(40,37,29,0.035)",
  activeBg: "rgba(1,105,111,0.04)",
  shadow: "0 1px 3px rgba(40,37,29,0.06)",
  danger: "#9a4a4a",
  success: "#4a9a6a",
  warning: "#9a7a2a",
} as const;

function getDaysAgo(d: string): number {
  return differenceInDays(new Date(), new Date(d));
}

function relTime(days: number): string {
  if (days === 0) return "I dag";
  if (days === 1) return "1d";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}u`;
  if (days < 365) return `${Math.floor(days / 30)}m`;
  return `${Math.floor(days / 365)}å`;
}

/* ═══════════════════════════════════════════════════════════
   SIDEBAR NAV
   ═══════════════════════════════════════════════════════════ */

const NAV_MAIN = [
  { label: "Salgsagent", icon: LayoutDashboard, href: "/", active: false },
  { label: "Selskaper", icon: Building2, href: "/selskaper", active: false },
  { label: "Kontakter", icon: Users, href: "/design-lab/kontakter", active: false },
  { label: "Forespørsler", icon: Briefcase, href: "/design-lab/foresporsler", active: true },
  { label: "Oppfølginger", icon: Clock, href: "/oppfolginger", active: false },
];

const NAV_STACQ = [
  { label: "STACQ Prisen", icon: TrendingUp, href: "/design-lab/stacq-prisen" },
  { label: "Markedsradar", icon: Radar, href: "/markedsradar" },
  { label: "Ansatte", icon: Users, href: "/konsulenter/ansatte" },
  { label: "Eksterne", icon: UserPlus, href: "/konsulenter/eksterne" },
  { label: "stacq.no", icon: Globe, href: "/nettside-ai" },
];

/* ═══════════════════════════════════════════════════════════
   PIPELINE
   ═══════════════════════════════════════════════════════════ */

const PIPELINE: Record<string, { label: string; color: string; step: number | null }> = {
  sendt_cv:  { label: "Sendt CV", color: C.warning, step: 1 },
  intervju:  { label: "Intervju", color: C.accent, step: 2 },
  vunnet:    { label: "Vunnet", color: C.success, step: 3 },
  avslag:    { label: "Avslag", color: C.danger, step: null },
  bortfalt:  { label: "Bortfalt", color: C.textFaint, step: null },
};

function PipelineTrack({ status }: { status: string }) {
  const steps = [1, 2, 3];
  const cfg = PIPELINE[status] || PIPELINE.sendt_cv;
  const currentStep = cfg.step;
  const off = "rgba(40,37,29,0.15)";

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => {
        const filled = currentStep !== null && step <= currentStep;
        const clr = filled ? cfg.color : off;
        return (
          <div key={step} className="flex items-center">
            {i > 0 && <div style={{ width: 10, height: 2, background: clr }} />}
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: clr }} />
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function DesignLabForesporsler() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [textSize, setTextSize] = usePersistentState<TextSize>("dl-text-size", "M");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("aktive");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("Alle");
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "mottatt_dato", dir: "desc" });
  const [selectedRowId, setSelectedRowId] = useState<number | null>(Number(searchParams.get("id") || "") || null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");

  const initials = user?.email ? user.email.split("@")[0].slice(0, 2).toUpperCase() : "??";

  // ⌘K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Escape") { setSelectedRowId(null); searchRef.current?.blur(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // sync URL
  useEffect(() => {
    if (selectedRowId) setSearchParams({ id: String(selectedRowId) }, { replace: true });
    else setSearchParams({}, { replace: true });
  }, [selectedRowId]);

  // ── Query ──
  const { data: rows = [], isLoading } = useQuery({
    queryKey: crmQueryKeys.foresporsler.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foresporsler")
        .select("*, contacts(id, first_name, last_name), foresporsler_konsulenter(id, konsulent_type, status, status_updated_at, stacq_ansatte(navn), external_consultants(navn))")
        .order("mottatt_dato", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // ── Stats ──
  const stats = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 45);
    const aktive = rows.filter((r: any) => new Date(r.mottatt_dato) >= cutoff);
    const utenKonsulent = aktive.filter((r: any) => !r.foresporsler_konsulenter?.length).length;
    const allK = aktive.flatMap((r: any) => r.foresporsler_konsulenter || []);
    const iProsess = allK.filter((k: any) => k.status === "sendt_cv" || k.status === "intervju").length;
    const vunnet = aktive.filter((r: any) => (r.foresporsler_konsulenter || []).some((k: any) => k.status === "vunnet")).length;
    return { aktive: aktive.length, utenKonsulent, iProsess, vunnet };
  }, [rows]);

  // ── Filter & Sort ──
  const toggleSort = useCallback((field: SortField) => {
    setSort((p) => p.field === field ? { field, dir: p.dir === "asc" ? "desc" : "asc" } : { field, dir: field === "mottatt_dato" ? "desc" : "asc" });
  }, []);

  const filtered = useMemo(() => {
    let items = rows.filter((r: any) => {
      const days = getDaysAgo(r.mottatt_dato);
      if (statusFilter === "aktive") return days <= 45;
      if (statusFilter === "utgatte") return days > 45;
      return true;
    });
    if (typeFilter !== "Alle") items = items.filter((r: any) => r.type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((r: any) =>
        (r.selskap_navn || "").toLowerCase().includes(q) ||
        (r.contacts ? `${r.contacts.first_name} ${r.contacts.last_name}`.toLowerCase().includes(q) : false) ||
        (r.teknologier || []).some((t: string) => t.toLowerCase().includes(q))
      );
    }
    return items;
  }, [rows, statusFilter, typeFilter, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a: any, b: any) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      switch (sort.field) {
        case "mottatt_dato": return dir * (a.mottatt_dato || "").localeCompare(b.mottatt_dato || "");
        case "selskap_navn": return dir * (a.selskap_navn || "").localeCompare(b.selskap_navn || "", "nb");
        case "kontakt": {
          const na = a.contacts ? `${a.contacts.first_name} ${a.contacts.last_name}` : "";
          const nb2 = b.contacts ? `${b.contacts.first_name} ${b.contacts.last_name}` : "";
          return dir * na.localeCompare(nb2, "nb");
        }
        case "sendt_count": return dir * ((a.foresporsler_konsulenter?.length || 0) - (b.foresporsler_konsulenter?.length || 0));
        default: return 0;
      }
    });
  }, [filtered, sort]);

  const selectedRow = useMemo(() => {
    if (!selectedRowId) return null;
    return rows.find((r: any) => r.id === selectedRowId) || null;
  }, [selectedRowId, rows]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!sorted.length) return;
        e.preventDefault();
        const idx = sorted.findIndex((r: any) => r.id === selectedRowId);
        const next = e.key === "ArrowDown" ? Math.min(idx + 1, sorted.length - 1) : Math.max(idx - 1, 0);
        setSelectedRowId((sorted[next] as any).id);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [sorted, selectedRowId]);

  /* ═══ RENDER ═══ */
  return (
    <div className="flex h-screen overflow-hidden select-none" style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif", background: C.bg }}>

      {/* ═══ SIDEBAR ═══ */}
      <aside className="flex flex-col shrink-0" style={{ width: 216, borderRight: `1px solid ${C.border}`, background: C.bg }}>
        <div className="flex items-center gap-2 px-4 h-12">
          <div className="flex items-center justify-center rounded" style={{ width: 22, height: 22, background: C.accent, color: "#fff", fontSize: 11, fontWeight: 700 }}>S</div>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>STACQ</span>
        </div>

        <div className="px-3 mb-1">
          <button
            onClick={() => searchRef.current?.focus()}
            className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 transition-colors"
            style={{ fontSize: 13, color: C.textFaint, background: "transparent" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <Search style={{ width: 14, height: 14 }} />
            <span className="flex-1 text-left">Søk</span>
            <kbd className="rounded px-1" style={{ fontSize: 10, color: C.textGhost, background: "rgba(40,37,29,0.06)" }}>⌘K</kbd>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 space-y-4 pb-3">
          <NavGroup items={NAV_MAIN} navigate={navigate} />
          <div>
            <p className="px-2 pb-1.5 pt-1" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.textGhost }}>STACQ</p>
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
        <header className="flex items-center justify-between px-6 shrink-0" style={{ height: 48, borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-baseline gap-2.5">
            <h1 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Forespørsler</h1>
            <span style={{ fontSize: 13, color: C.textGhost, fontWeight: 500 }}>{filtered.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <TextSizeControl value={textSize} onChange={setTextSize} />
            <div className="relative" style={{ width: 220 }}>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ width: 14, height: 14, color: C.textGhost }} />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Søk forespørsler…"
                className="w-full outline-none placeholder:text-[#BAB9B4]"
                style={{ height: 30, paddingLeft: 30, paddingRight: 10, borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13 }}
              />
            </div>
            <button
              className="inline-flex items-center gap-1.5 rounded-md transition-opacity hover:opacity-90"
              style={{ height: 30, paddingInline: 12, fontSize: 13, fontWeight: 500, background: C.accent, color: "#fff", borderRadius: 6 }}
            >
              + Ny forespørsel
            </button>
          </div>
        </header>

        {/* Filters + stat line */}
        <div className="shrink-0 space-y-0" style={{ borderBottom: `1px solid ${C.border}`, padding: "8px 24px 10px" }}>
          <FilterRow label="TID" options={STATUS_CHIPS} value={statusFilter} onChange={(v) => setStatusFilter(v as StatusFilter)} />
          <div className="flex items-center justify-between">
            <FilterRow label="TYPE" options={TYPE_CHIPS} value={typeFilter} onChange={(v) => setTypeFilter(v as TypeFilter)} />
            <span style={{ fontSize: 12, color: C.textFaint, fontWeight: 500, whiteSpace: "nowrap", paddingLeft: 12 }}>
              {stats.aktive} aktive · {stats.utenKonsulent} uten konsulent · {stats.iProsess} i prosess · {stats.vunnet} vunnet
            </span>
          </div>
          {(statusFilter !== "aktive" || typeFilter !== "Alle") && (
            <div className="flex justify-end">
              <button
                onClick={() => { setStatusFilter("aktive"); setTypeFilter("Alle"); }}
                className="inline-flex items-center gap-1 rounded transition-colors"
                style={{ fontSize: 12, color: C.textFaint, padding: "2px 6px" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = C.text; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = C.textFaint; }}
              >
                <X style={{ width: 12, height: 12 }} /> Nullstill
              </button>
            </div>
          )}
        </div>

        {/* Content: list + detail */}
        <div className="flex-1 min-h-0">
          {selectedRow ? (
            <ResizablePanelGroup direction="horizontal" className="h-full">
              <ResizablePanel defaultSize={40} minSize={25} maxSize={60}>
                <div className="h-full overflow-y-auto">
                  <TableHeader sort={sort} onSort={toggleSort} compact />
                  {isLoading ? <LoadingMsg /> : sorted.length === 0 ? <EmptyMsg /> : (
                    sorted.map((row: any) => (
                      <ForespRow key={row.id} row={row} isActive={selectedRowId === row.id} onClick={() => setSelectedRowId(row.id)} compact />
                    ))
                  )}
                </div>
              </ResizablePanel>
              <ResizableHandle
                withHandle
                className="bg-transparent hover:bg-[rgba(40,37,29,0.06)] transition-colors data-[resize-handle-active]:bg-[rgba(1,105,111,0.12)]"
              />
              <ResizablePanel defaultSize={60} minSize={40}>
                <div className="h-full flex flex-col" style={{ background: C.surface }}>
                  <div className="shrink-0 flex items-center justify-between px-6" style={{ height: 48, borderBottom: `1px solid ${C.border}` }}>
                    <div className="flex items-center gap-2">
                      <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{(selectedRow as any).selskap_navn}</h2>
                      <TypeChip type={(selectedRow as any).type} />
                    </div>
                    <div className="flex items-center gap-0.5">
                      <IconBtn icon={<ArrowUpRight style={{ width: 15, height: 15 }} />} title="Åpne i CRM" onClick={() => navigate(`/foresporsler?id=${selectedRowId}`)} />
                      <IconBtn icon={<X style={{ width: 15, height: 15 }} />} title="Lukk" onClick={() => setSelectedRowId(null)} />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto dl-v8-theme">
                    <ForespørselSheet
                      row={selectedRow}
                      onClose={() => setSelectedRowId(null)}
                      onExpandChange={() => {}}
                    />
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <div className="h-full overflow-y-auto">
              <TableHeader sort={sort} onSort={toggleSort} compact={false} />
              {isLoading ? <LoadingMsg /> : sorted.length === 0 ? <EmptyMsg /> : (
                sorted.map((row: any) => (
                  <ForespRow key={row.id} row={row} isActive={false} onClick={() => setSelectedRowId(row.id)} compact={false} />
                ))
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TABLE COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function TableHeader({ sort, onSort, compact }: { sort: { field: SortField; dir: SortDir }; onSort: (f: SortField) => void; compact: boolean }) {
  const cols = compact
    ? "90px minmax(0,1.5fr) minmax(0,1fr) 60px"
    : "90px minmax(0,1.5fr) minmax(0,1fr) 70px minmax(0,1.2fr) minmax(0,1fr)";

  return (
    <div
      className="grid items-center sticky top-0 z-10"
      style={{ gridTemplateColumns: cols, height: 32, borderBottom: `1px solid ${C.border}`, background: C.bg, paddingLeft: 16, paddingRight: 16 }}
    >
      <ColHeader label="Mottatt" field="mottatt_dato" sort={sort} onSort={onSort} />
      <ColHeader label="Selskap" field="selskap_navn" sort={sort} onSort={onSort} />
      <ColHeader label="Kontakt" field="kontakt" sort={sort} onSort={onSort} />
      {compact ? (
        <ColHeader label="Type" field="sendt_count" sort={sort} onSort={onSort} />
      ) : (
        <>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.textMuted }}>Type</span>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.textMuted }}>Teknologier</span>
          <ColHeader label="Pipeline" field="sendt_count" sort={sort} onSort={onSort} className="justify-end" />
        </>
      )}
    </div>
  );
}

function ForespRow({ row, isActive, onClick, compact }: { row: any; isActive: boolean; onClick: () => void; compact: boolean }) {
  const days = getDaysAgo(row.mottatt_dato);
  const kontaktNavn = row.contacts ? `${row.contacts.first_name} ${row.contacts.last_name}`.trim() : "—";
  const sendt = row.foresporsler_konsulenter || [];

  const cols = compact
    ? "90px minmax(0,1.5fr) minmax(0,1fr) 60px"
    : "90px minmax(0,1.5fr) minmax(0,1fr) 70px minmax(0,1.2fr) minmax(0,1fr)";

  return (
    <div
      onClick={onClick}
      className="grid items-center cursor-pointer group"
      style={{
        gridTemplateColumns: cols,
        minHeight: 40, paddingLeft: 16, paddingRight: 16, paddingTop: 4, paddingBottom: 4,
        borderBottom: `1px solid ${C.borderLight}`,
        background: isActive ? C.activeBg : undefined,
        transition: "background 50ms",
      }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = C.hoverBg; }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = isActive ? C.activeBg : ""; }}
    >
      {/* Mottatt */}
      <span style={{ fontSize: 13, fontWeight: 500, color: days <= 7 ? C.text : days <= 21 ? C.warning : C.danger }}>
        {relTime(days)}
      </span>
      {/* Selskap */}
      <span className="truncate pr-3" style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{row.selskap_navn}</span>
      {/* Kontakt */}
      <span className="truncate pr-3" style={{ fontSize: 13, color: C.textMuted }}>{kontaktNavn}</span>

      {compact ? (
        <TypeChip type={row.type} />
      ) : (
        <>
          {/* Type */}
          <TypeChip type={row.type} />
          {/* Teknologier */}
          <div className="flex items-center gap-1 flex-wrap pr-2">
            {(row.teknologier || []).slice(0, 3).map((t: string) => (
              <span key={t} className="inline-flex items-center rounded-full" style={{ border: `1px solid ${C.border}`, padding: "1px 7px", fontSize: 11, color: C.textMuted }}>{t}</span>
            ))}
            {(row.teknologier || []).length > 3 && (
              <span style={{ fontSize: 11, color: C.textGhost }}>+{row.teknologier.length - 3}</span>
            )}
          </div>
          {/* Pipeline */}
          <div className="flex flex-col items-end gap-1">
            {sendt.length === 0 ? (
              <span style={{ fontSize: 12, color: C.textGhost }}>—</span>
            ) : (
              sendt.map((k: any) => {
                const navn = ((k.konsulent_type === "intern" ? k.stacq_ansatte?.navn : k.external_consultants?.navn) || "Ukjent").split(" ")[0];
                const cfg = PIPELINE[k.status] || { label: "Ny", color: C.textFaint };
                return (
                  <div key={k.id} className="flex items-center gap-1.5">
                    <span style={{ fontSize: 12, color: C.textMuted }}>{navn}</span>
                    <span className="inline-flex items-center rounded-full" style={{
                      fontSize: 10, fontWeight: 600, padding: "1px 7px",
                      background: `${cfg.color}10`, color: cfg.color, border: `1px solid ${cfg.color}25`,
                    }}>
                      {cfg.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function TypeChip({ type }: { type: string | null }) {
  const isDir = type === "DIR" || type === "direktekunde";
  const isVia = type === "VIA" || type === "via_partner";
  const label = isDir ? "DIR" : isVia ? "VIA" : "—";
  const color = isDir ? C.accent : isVia ? C.warning : C.textGhost;
  return (
    <span className="inline-flex items-center rounded-full" style={{
      fontSize: 10, fontWeight: 600, padding: "1px 7px",
      background: `${color}10`, color, border: `1px solid ${color}20`,
    }}>
      {label}
    </span>
  );
}

function LoadingMsg() {
  return <div style={{ textAlign: "center", padding: "48px 0", color: C.textFaint, fontSize: 13 }}>Laster forespørsler…</div>;
}
function EmptyMsg() {
  return <div style={{ textAlign: "center", padding: "48px 0", color: C.textFaint, fontSize: 13 }}>Ingen forespørsler å vise</div>;
}

function NavGroup({ items, navigate }: { items: readonly { label: string; icon: any; href: string; active?: boolean }[]; navigate: (p: string) => void }) {
  return (
    <div className="space-y-px">
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => navigate(item.href)}
          className="flex items-center gap-2 w-full rounded-md px-2 py-[6px] transition-colors"
          style={{
            fontSize: 13, fontWeight: item.active ? 600 : 500,
            color: item.active ? C.text : C.textMuted,
            background: item.active ? "rgba(40,37,29,0.06)" : "transparent",
          }}
          onMouseEnter={(e) => { if (!item.active) e.currentTarget.style.background = C.hoverBg; }}
          onMouseLeave={(e) => { if (!item.active) e.currentTarget.style.background = item.active ? "rgba(40,37,29,0.06)" : "transparent"; }}
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
      className="flex items-center gap-2 w-full rounded-md px-2 py-[6px] transition-colors"
      style={{ fontSize: 13, fontWeight: 500, color: muted ? C.textGhost : C.textMuted }}
      onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <Icon style={{ width: 15, height: 15, strokeWidth: 1.6 }} />
      {label}
    </button>
  );
}

function IconBtn({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center rounded transition-colors"
      style={{ width: 28, height: 28, color: C.textFaint }}
      onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {icon}
    </button>
  );
}

function FilterRow({ label, options, value, onChange }: {
  label: string; options: readonly { value: string; label: string }[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-[3px]">
      <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.textMuted, width: 56, flexShrink: 0 }}>{label}</span>
      <div className="flex items-center gap-1 flex-wrap">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className="inline-flex items-center rounded-full transition-colors"
              style={{
                height: 24, paddingInline: 10, fontSize: 12, fontWeight: 500,
                border: active ? "none" : `1px solid ${C.border}`,
                background: active ? C.accent : "transparent",
                color: active ? "#fff" : C.textMuted,
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = C.hoverBg; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = active ? C.accent : "transparent"; }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
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
      style={{
        fontSize: 11, fontWeight: active ? 700 : 600, textTransform: "uppercase", letterSpacing: "0.06em",
        color: active ? C.text : C.textMuted,
      }}
    >
      {label}
      {active && (sort.dir === "asc" ? <ChevronUp style={{ width: 12, height: 12 }} /> : <ChevronDown style={{ width: 12, height: 12 }} />)}
    </button>
  );
}
