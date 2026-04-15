import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import {
  Search, ChevronDown, ChevronUp, X,
  ArrowUpRight,
} from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { nb } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { ForespørselSheet } from "@/components/ForespørselSheet";
import { crmQueryKeys } from "@/lib/queryKeys";
import { TextSizeControl, SCALE_MAP, type TextSize } from "@/components/designlab/TextSizeControl";
import { usePersistentState } from "@/hooks/usePersistentState";
import { C } from "@/components/designlab/theme";
import { DesignLabSidebar } from "@/components/designlab/DesignLabSidebar";

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

/* Colors imported from @/components/designlab/theme */

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
  const off = "rgba(0,0,0,0.12)";

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

      <DesignLabSidebar navigate={navigate} signOut={signOut} user={user} activePath="/design-lab/foresporsler" />

      {/* ═══ MAIN ═══ */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ zoom: SCALE_MAP[textSize], background: C.appBg }}>
        {/* Header */}
        <header className="flex items-center justify-between px-6 shrink-0" style={{ height: 40, borderBottom: `1px solid ${C.border}` }}>
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
                className="w-full outline-none placeholder:text-[#a2a5ab]"
                style={{ height: 32, paddingLeft: 30, paddingRight: 9, borderRadius: 5, border: `1px solid ${C.border}`, background: C.surfaceAlt, color: C.text, fontSize: 13 }}
              />
            </div>
            <button
              className="inline-flex items-center gap-1.5 rounded-md transition-opacity hover:opacity-90"
              style={{ height: 30, paddingInline: 11, fontSize: 13, fontWeight: 500, background: C.accent, color: "#fff", borderRadius: 5 }}
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
                className="bg-transparent hover:bg-[rgba(0,0,0,0.04)] transition-colors data-[resize-handle-active]:bg-[rgba(94,106,210,0.12)]"
              />
              <ResizablePanel defaultSize={60} minSize={40}>
                <div className="h-full flex flex-col" style={{ background: C.panel, borderLeft: `1px solid ${C.borderLight}` }}>
                  <div className="shrink-0 flex items-center justify-between px-6" style={{ height: 40, borderBottom: `1px solid ${C.border}` }}>
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
            <div className="h-full overflow-y-auto" style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
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
      style={{ gridTemplateColumns: cols, height: 32, borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt, paddingLeft: 16, paddingRight: 16 }}
    >
      <ColHeader label="Mottatt" field="mottatt_dato" sort={sort} onSort={onSort} />
      <ColHeader label="Selskap" field="selskap_navn" sort={sort} onSort={onSort} />
      <ColHeader label="Kontakt" field="kontakt" sort={sort} onSort={onSort} />
      {compact ? (
        <ColHeader label="Type" field="sendt_count" sort={sort} onSort={onSort} />
      ) : (
        <>
          <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: C.textMuted }}>Type</span>
          <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: C.textMuted }}>Teknologier</span>
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
              <span key={t} className="inline-flex items-center rounded" style={{ border: `1px solid ${C.border}`, padding: "2px 6px", fontSize: 11, color: C.textMuted }}>{t}</span>
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
                      fontSize: 10, fontWeight: 600, padding: "2px 6px",
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
    <span className="inline-flex items-center rounded" style={{
      fontSize: 10, fontWeight: 600, padding: "2px 6px",
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
      <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: C.textMuted, width: 56, flexShrink: 0 }}>{label}</span>
      <div className="flex items-center gap-1 flex-wrap">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className="inline-flex items-center transition-colors"
              style={{
                height: 24, paddingInline: 10, fontSize: 12, fontWeight: 500,
                borderRadius: 3,
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
        fontSize: 11, fontWeight: active ? 600 : 500, letterSpacing: "0.01em",
        color: active ? C.text : C.textMuted,
      }}
    >
      {label}
      {active && (sort.dir === "asc" ? <ChevronUp style={{ width: 12, height: 12 }} /> : <ChevronDown style={{ width: 12, height: 12 }} />)}
    </button>
  );
}
