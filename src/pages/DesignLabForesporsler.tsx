import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import {
  X,
} from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { nb } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { ForespørselSheet } from "@/components/ForespørselSheet";
import { DesignLabEntitySheet } from "@/components/designlab/DesignLabEntitySheet";
import { crmQueryKeys } from "@/lib/queryKeys";
import { TextSizeControl, getDesignLabTextSizeStyle, type TextSize } from "@/components/designlab/TextSizeControl";
import { usePersistentState } from "@/hooks/usePersistentState";
import { C } from "@/components/designlab/theme";
import { DesignLabSidebar } from "@/components/designlab/DesignLabSidebar";
import { getInitials } from "@/lib/utils";
import {
  DesignLabIconButton,
  DesignLabSearchInput,
} from "@/components/designlab/controls";
import {
  DesignLabColumnHeader,
  DesignLabFilterRow,
  DesignLabGhostAction,
  DesignLabPrimaryAction,
  DesignLabReadonlyChip,
  DesignLabSignalBadge,
} from "@/components/designlab/system";
import { getEffectiveSignal, getSignalRank } from "@/lib/categoryUtils";
import { NyForesporselModal } from "@/pages/Foresporsler";

/* ═══════════════════════════════════════════════════════════
   TYPES & CONSTANTS
   ═══════════════════════════════════════════════════════════ */

type StatusFilter = "aktive" | "utgatte" | "alle";
type TypeFilter = "Alle" | "DIR" | "VIA";
type SortField = "mottatt_dato" | "selskap_navn" | "sendt_count" | "kontakt" | "signal";
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

function getVisibleTechnologies(tags: unknown): { visible: string[]; hiddenCount: number } {
  const normalized = Array.isArray(tags)
    ? tags
        .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
        .filter(Boolean)
    : [];

  const visible: string[] = [];
  let charBudget = 24;

  for (const tag of normalized) {
    const nextCost = tag.length + (visible.length > 0 ? 2 : 0);
    if (visible.length >= 2 || nextCost > charBudget) break;
    visible.push(tag);
    charBudget -= nextCost;
  }

  return { visible, hiddenCount: Math.max(0, normalized.length - visible.length) };
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
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
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
    const currentId = searchParams.get("id");
    if (selectedRowId) {
      const nextId = String(selectedRowId);
      if (currentId !== nextId) setSearchParams({ id: nextId }, { replace: true });
    } else if (currentId !== null) {
      setSearchParams({}, { replace: true });
    }
  }, [selectedRowId, searchParams, setSearchParams]);

  useEffect(() => {
    const nextId = Number(searchParams.get("id") || "") || null;
    if (nextId !== selectedRowId) setSelectedRowId(nextId);
  }, [searchParams]);

  // ── Query ──
  const { data: rows = [], isLoading } = useQuery({
    queryKey: crmQueryKeys.foresporsler.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foresporsler")
        .select("*, contacts(id, first_name, last_name, title, email, phone), foresporsler_konsulenter(id, konsulent_type, status, status_updated_at, stacq_ansatte(id, navn), external_consultants(id, navn))")
        .order("mottatt_dato", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: ansattePortraits = [] } = useQuery({
    queryKey: ["foresporsler-ansatte-portraits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cv_documents")
        .select("ansatt_id, portrait_url")
        .not("portrait_url", "is", null);
      if (error) throw error;
      return data || [];
    },
  });

  const portraitByAnsattId = useMemo(() => {
    const map = new Map<number, string>();
    (ansattePortraits as any[]).forEach((item) => {
      if (item.ansatt_id && item.portrait_url) {
        map.set(item.ansatt_id, item.portrait_url);
      }
    });
    return map;
  }, [ansattePortraits]);

  // ── Signal per kontakt (matcher Kontakter-tabellen) ──
  const contactIds = useMemo(() => {
    const set = new Set<string>();
    (rows as any[]).forEach((r) => {
      if (r.contacts?.id) set.add(r.contacts.id);
    });
    return Array.from(set);
  }, [rows]);

  const { data: signalByContactId = new Map<string, string>() } = useQuery({
    queryKey: ["foresporsler-contact-signals", contactIds.sort().join(",")],
    enabled: contactIds.length > 0,
    queryFn: async () => {
      const [actsRes, tasksRes] = await Promise.all([
        supabase
          .from("activities")
          .select("contact_id, created_at, subject, description")
          .in("contact_id", contactIds)
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase
          .from("tasks")
          .select("contact_id, created_at, updated_at, title, description, due_date, status")
          .in("contact_id", contactIds)
          .limit(5000),
      ]);
      const acts = actsRes.data || [];
      const tasks = tasksRes.data || [];
      const actsByContact: Record<string, any[]> = {};
      const tasksByContact: Record<string, any[]> = {};
      acts.forEach((a: any) => {
        if (a.contact_id) (actsByContact[a.contact_id] ??= []).push(a);
      });
      tasks.forEach((t: any) => {
        if (t.contact_id) (tasksByContact[t.contact_id] ??= []).push(t);
      });
      const map = new Map<string, string>();
      for (const cid of contactIds) {
        const sig = getEffectiveSignal(
          (actsByContact[cid] || []).map((a) => ({
            created_at: a.created_at,
            subject: a.subject || "",
            description: a.description,
          })),
          (tasksByContact[cid] || []).map((t) => ({
            created_at: t.created_at,
            updated_at: t.updated_at,
            title: t.title || "",
            description: t.description,
            due_date: t.due_date,
            status: t.status,
          })),
        );
        if (sig) map.set(cid, sig);
      }
      return map;
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
        case "signal": {
          const sa = a.contacts?.id ? signalByContactId.get(a.contacts.id) || null : null;
          const sb = b.contacts?.id ? signalByContactId.get(b.contacts.id) || null : null;
          return dir * (getSignalRank(sa) - getSignalRank(sb));
        }
        case "sendt_count": return dir * ((a.foresporsler_konsulenter?.length || 0) - (b.foresporsler_konsulenter?.length || 0));
        default: return 0;
      }
    });
  }, [filtered, sort, signalByContactId]);

  const selectedRow = useMemo(() => {
    if (!selectedRowId) return null;
    return rows.find((r: any) => r.id === selectedRowId) || null;
  }, [selectedRowId, rows]);

  useEffect(() => {
    if (!selectedRow) setEditSheetOpen(false);
  }, [selectedRow]);

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
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ ...getDesignLabTextSizeStyle(textSize), background: C.appBg }}>
        {/* Header */}
        <header className="flex items-center justify-between px-6 shrink-0" style={{ height: 40, borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-baseline gap-2.5">
            <h1 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Forespørsler</h1>
            <span style={{ fontSize: 13, color: C.textGhost, fontWeight: 500 }}>{filtered.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <TextSizeControl value={textSize} onChange={setTextSize} />
            <DesignLabPrimaryAction onClick={() => setCreateOpen(true)}>
              + Ny forespørsel
            </DesignLabPrimaryAction>
          </div>
        </header>

        {/* Filters + stat line */}
        <div className="shrink-0 space-y-0" style={{ borderBottom: `1px solid ${C.border}`, padding: "8px 24px 10px" }}>
          <DesignLabFilterRow
            label="TID"
            options={STATUS_CHIPS.map((option) => option.label)}
            value={STATUS_CHIPS.find((option) => option.value === statusFilter)?.label ?? "Aktive"}
            onChange={(value) => {
              const next = STATUS_CHIPS.find((option) => option.label === value);
              if (next) setStatusFilter(next.value);
            }}
          />
          <div className="flex items-center justify-between">
            <DesignLabFilterRow
              label="TYPE"
              options={TYPE_CHIPS.map((option) => option.label)}
              value={TYPE_CHIPS.find((option) => option.value === typeFilter)?.label ?? "Alle"}
              onChange={(value) => {
                const next = TYPE_CHIPS.find((option) => option.label === value);
                if (next) setTypeFilter(next.value);
              }}
            />
            <span style={{ fontSize: 12, color: C.textFaint, fontWeight: 500, whiteSpace: "nowrap", paddingLeft: 12 }}>
              {stats.aktive} aktive · {stats.utenKonsulent} uten konsulent · {stats.iProsess} i prosess · {stats.vunnet} vunnet
            </span>
          </div>
          {(statusFilter !== "aktive" || typeFilter !== "Alle") && (
            <div className="flex justify-end">
              <DesignLabGhostAction onClick={() => { setStatusFilter("aktive"); setTypeFilter("Alle"); }}>
                <X style={{ width: 12, height: 12 }} /> Nullstill
              </DesignLabGhostAction>
            </div>
          )}
        </div>

        {/* Content: list + detail */}
        <div className="flex-1 min-h-0 flex">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={38} minSize={24} maxSize={60}>
              <div className="h-full overflow-y-auto" style={{ scrollbarColor: `${C.borderStrong} ${C.surfaceAlt}` }}>
                <TableHeader sort={sort} onSort={toggleSort} />
                {isLoading ? (
                  <LoadingMsg />
                ) : sorted.length === 0 ? (
                  <EmptyMsg />
                ) : (
                  sorted.map((row: any) => (
                    <ForespRow
                      key={row.id}
                      row={row}
                      portraitByAnsattId={portraitByAnsattId}
                      signalByContactId={signalByContactId}
                      isActive={selectedRowId === row.id}
                      onClick={() => setSelectedRowId(row.id)}
                    />
                  ))
                )}
              </div>
            </ResizablePanel>
            <ResizableHandle
              withHandle
              className="bg-transparent hover:bg-[rgba(0,0,0,0.04)] transition-colors data-[resize-handle-active]:bg-[rgba(94,106,210,0.12)]"
            />
            <ResizablePanel defaultSize={62} minSize={34}>
              {selectedRow ? (
                <div className="h-full flex flex-col" style={{ background: C.panel, borderLeft: `1px solid ${C.borderLight}` }}>
                  <div className="shrink-0 flex items-center justify-end px-6" style={{ height: 40, borderBottom: `1px solid ${C.border}` }}>
                    <div className="flex items-center gap-1.5">
                      <DesignLabIconButton title="Lukk" onClick={() => setSelectedRowId(null)}>
                        <X style={{ width: 15, height: 15 }} />
                      </DesignLabIconButton>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto dl-v8-theme">
                    <ForespørselSheet
                      row={selectedRow}
                      onClose={() => setSelectedRowId(null)}
                      onExpandChange={() => {}}
                      onRequestEdit={() => setEditSheetOpen(true)}
                    />
                  </div>
                </div>
              ) : (
                <div className="h-full" style={{ borderLeft: `1px solid ${C.borderLight}`, background: C.appBg }} />
              )}
            </ResizablePanel>
            <ResizableHandle
              withHandle
              className="bg-transparent hover:bg-[rgba(0,0,0,0.04)] transition-colors data-[resize-handle-active]:bg-[rgba(94,106,210,0.12)]"
            />
            <ResizablePanel defaultSize={0} minSize={0} maxSize={30}>
              <div className="h-full" style={{ background: C.appBg }} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </main>

      <DesignLabEntitySheet
        open={editSheetOpen && Boolean(selectedRow)}
        onOpenChange={setEditSheetOpen}
        contentClassName="dl-v8-theme"
      >
        {selectedRow ? (
          <ForespørselSheet
            row={selectedRow}
            onClose={() => setEditSheetOpen(false)}
            onExpandChange={() => {}}
            startInEditMode
          />
        ) : null}
      </DesignLabEntitySheet>
      <NyForesporselModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TABLE COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function TableHeader({ sort, onSort }: { sort: { field: SortField; dir: SortDir }; onSort: (f: SortField) => void }) {
  const cols = "minmax(180px,1.3fr) 132px minmax(180px,1.2fr) 88px minmax(180px,1.05fr) minmax(190px,1.15fr) minmax(120px,0.85fr) 92px";

  return (
    <div
      className="grid items-center sticky top-0 z-10"
      style={{
        gridTemplateColumns: cols,
        height: 36,
        borderBottom: `1px solid ${C.border}`,
        background: C.surfaceAlt,
        paddingLeft: 16,
        paddingRight: 16,
      }}
    >
      <DesignLabColumnHeader label="Kontakt" field="kontakt" sort={sort} onSort={onSort} />
      <DesignLabColumnHeader label="Signal" field="signal" sort={sort} onSort={onSort} />
      <DesignLabColumnHeader label="Selskap" field="selskap_navn" sort={sort} onSort={onSort} />
      <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted }}>Type</span>
      <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted }}>Teknologier</span>
      <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted }}>Konsulent</span>
      <DesignLabColumnHeader label="Status" field="sendt_count" sort={sort} onSort={onSort} />
      <DesignLabColumnHeader label="Mottatt" field="mottatt_dato" sort={sort} onSort={onSort} />
    </div>
  );
}

function ForespRow({
  row,
  portraitByAnsattId,
  signalByContactId,
  isActive,
  onClick,
}: {
  row: any;
  portraitByAnsattId: Map<number, string>;
  signalByContactId: Map<string, string>;
  isActive: boolean;
  onClick: () => void;
}) {
  const days = getDaysAgo(row.mottatt_dato);
  const kontaktNavn = row.contacts ? `${row.contacts.first_name} ${row.contacts.last_name}`.trim() : "";
  const sendt = row.foresporsler_konsulenter || [];
  const technologies = getVisibleTechnologies(row.teknologier);
  const signal = row.contacts?.id ? signalByContactId.get(row.contacts.id) || null : null;
  const cols = "minmax(180px,1.3fr) 132px minmax(180px,1.2fr) 88px minmax(180px,1.05fr) minmax(190px,1.15fr) minmax(120px,0.85fr) 92px";

  return (
    <div
      onClick={onClick}
      className="grid items-start cursor-pointer group"
      style={{
        gridTemplateColumns: cols,
        minHeight: 52,
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 8,
        paddingBottom: 8,
        borderBottom: `1px solid ${C.borderLight}`,
        background: isActive ? C.activeBg : undefined,
        transition: "background 80ms ease",
      }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = C.hoverBg; }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = isActive ? C.activeBg : ""; }}
    >
      {/* Kontakt */}
      <div className="min-w-0 pr-4" style={{ paddingTop: 2 }}>
        {kontaktNavn ? (
          <span className="block truncate" style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
            {kontaktNavn}
          </span>
        ) : (
          <span style={{ fontSize: 13, color: C.textGhost }}>—</span>
        )}
      </div>
      {/* Signal */}
      <div className="flex items-center" style={{ paddingTop: 1 }}>
        {signal ? (
          <DesignLabSignalBadge signal={signal} />
        ) : (
          <span style={{ fontSize: 11, color: C.textGhost }}>—</span>
        )}
      </div>
      {/* Selskap */}
      <div className="min-w-0 pr-4" style={{ paddingTop: 2 }}>
        <span className="block truncate" style={{ fontSize: 12, color: C.textMuted }}>
          {row.selskap_navn}
        </span>
      </div>
      {/* Type */}
      <div style={{ paddingTop: 1 }}>
        <TypeChip type={row.type} />
      </div>
      {/* Teknologier */}
      <div className="min-w-0 pr-4">
        <div className="flex items-center gap-1.5 flex-nowrap">
          {technologies.visible.map((t) => (
            <DesignLabReadonlyChip key={t} active={false}>
              {t}
            </DesignLabReadonlyChip>
          ))}
          {technologies.hiddenCount > 0 && (
            <span className="shrink-0" style={{ fontSize: 11, color: C.textGhost }}>
              +{technologies.hiddenCount}
            </span>
          )}
          {technologies.visible.length === 0 && technologies.hiddenCount === 0 ? (
            <span style={{ fontSize: 12, color: C.textGhost }}>—</span>
          ) : null}
        </div>
      </div>
      {/* Konsulent */}
      <div className="flex flex-col items-start gap-2 pr-3" style={{ paddingTop: 2 }}>
        {sendt.length === 0 ? (
          <div style={{ minHeight: 28, display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.textGhost }}>—</span>
          </div>
        ) : (
          sendt.map((k: any) => {
            const navn = (k.konsulent_type === "intern" ? k.stacq_ansatte?.navn : k.external_consultants?.navn) || "Ukjent";
            const portrait =
              k.konsulent_type === "intern" && k.stacq_ansatte?.id
                ? portraitByAnsattId.get(k.stacq_ansatte.id) || null
                : null;
            return (
              <div key={k.id} style={{ minHeight: 28, display: "flex", alignItems: "center", gap: 8 }}>
                {portrait ? (
                  <img
                    src={portrait}
                    alt={navn}
                    style={{ width: 22, height: 22, borderRadius: "999px", objectFit: "cover", flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "999px",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: C.accentBg,
                      color: C.accent,
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {getInitials(navn)}
                  </div>
                )}
                <span style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.2, whiteSpace: "normal" }}>
                  {navn}
                </span>
              </div>
            );
          })
        )}
      </div>
      {/* Status */}
      <div className="flex flex-col items-start gap-2" style={{ paddingTop: 1 }}>
        {sendt.length === 0 ? (
          <div style={{ minHeight: 28, display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.textGhost }}>—</span>
          </div>
        ) : (
          sendt.map((k: any) => {
            const cfg = PIPELINE[k.status] || { label: "Ny", color: C.textFaint };
            return (
              <div key={k.id} style={{ minHeight: 28, display: "flex", alignItems: "center" }}>
                <span
                  className="inline-flex items-center rounded-[6px]"
                  style={{
                    height: 28,
                    width: "fit-content",
                    fontSize: 12,
                    fontWeight: 500,
                    padding: "0 10px",
                    background: `${cfg.color}10`,
                    color: cfg.color,
                    border: `1px solid ${cfg.color}25`,
                  }}
                >
                  {cfg.label}
                </span>
              </div>
            );
          })
        )}
      </div>
      {/* Mottatt */}
      <span style={{ fontSize: 13, fontWeight: 500, color: days <= 7 ? C.text : days <= 21 ? C.warning : C.danger, paddingTop: 2 }}>
        {relTime(days)}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function TypeChip({ type }: { type: string | null }) {
  const isDir = type === "DIR" || type === "direktekunde";
  const isVia = type === "VIA" || type === "via_partner";
  const label = isDir ? "Direkte" : isVia ? "Via" : "—";
  const color = isDir ? C.accent : isVia ? C.warning : C.textGhost;
  return (
    <span className="inline-flex items-center rounded-[6px]" style={{
      height: 28, fontSize: 12, fontWeight: 500, padding: "0 10px",
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
