import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { CompanyCardContent } from "@/components/CompanyCardContent";
import {
  Search, ChevronDown, ChevronUp, X,
  Users, Building2, LayoutDashboard, Briefcase, Settings, LogOut,
  UserPlus, Radar, TrendingUp, Globe, Clock,
} from "lucide-react";
import { differenceInDays } from "date-fns";
import { getEffectiveSignal, normalizeCategoryLabel } from "@/lib/categoryUtils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { C, SIGNAL_COLORS } from "@/components/designlab/theme";
import { crmQueryKeys } from "@/lib/queryKeys";

/* ═══════════════════════════════════════════════════════════
   TYPES & CONSTANTS
   ═══════════════════════════════════════════════════════════ */

type Signal = "Behov nå" | "Får fremtidig behov" | "Får kanskje behov" | "Ukjent om behov" | "Ikke aktuelt";

const SIGNAL_ORDER: Record<Signal, number> = {
  "Behov nå": 0, "Får fremtidig behov": 1, "Får kanskje behov": 2, "Ukjent om behov": 3, "Ikke aktuelt": 4,
};

const OWNERS = ["Alle", "Jon Richard Nygaard", "Thomas Eriksen", "Uten eier"];
const TYPE_FILTERS = ["Alle", "Potensiell kunde", "Kunde", "Partner", "Ikke relevant selskap"] as const;
type TypeFilter = typeof TYPE_FILTERS[number];

const TYPE_OPTIONS = [
  { value: "prospect", label: "Potensiell kunde" },
  { value: "customer", label: "Kunde" },
  { value: "partner", label: "Partner" },
  { value: "churned", label: "Ikke relevant selskap" },
];

const TYPE_VALUE_TO_LABEL: Record<string, string> = {
  prospect: "Potensiell kunde",
  customer: "Kunde",
  kunde: "Kunde",
  partner: "Partner",
  churned: "Ikke relevant selskap",
  lead: "Lead",
  active: "Aktiv",
};

const TYPE_LABEL_TO_VALUE: Record<string, string> = {
  "Potensiell kunde": "prospect",
  "Kunde": "customer",
  "Partner": "partner",
  "Ikke relevant selskap": "churned",
};

type SortField = "name" | "type" | "signal" | "city" | "last_activity" | "tasks";
type SortDir = "asc" | "desc";

function relTime(days: number): string {
  if (days === 0) return "I dag";
  if (days === 1) return "1d";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}u`;
  if (days < 365) return `${Math.floor(days / 30)}m`;
  return `${Math.floor(days / 365)}å`;
}

function mapToSignal(raw: string): Signal {
  const normalized = normalizeCategoryLabel(raw);
  if (Object.keys(SIGNAL_ORDER).includes(normalized)) return normalized as Signal;
  return "Ukjent om behov";
}

/* ═══════════════════════════════════════════════════════════
   SIDEBAR NAV
   ═══════════════════════════════════════════════════════════ */

const NAV_MAIN = [
  { label: "Salgsagent", icon: LayoutDashboard, href: "/" },
  { label: "Selskaper", icon: Building2, href: "/design-lab/selskaper", active: true },
  { label: "Kontakter", icon: Users, href: "/design-lab/kontakter" },
  { label: "Forespørsler", icon: Briefcase, href: "/design-lab/foresporsler" },
  { label: "Oppfølginger", icon: Clock, href: "/oppfolginger" },
];

const NAV_STACQ = [
  { label: "STACQ Prisen", icon: TrendingUp, href: "/design-lab/stacq-prisen" },
  { label: "Markedsradar", icon: Radar, href: "/markedsradar" },
  { label: "Ansatte", icon: Users, href: "/konsulenter/ansatte" },
  { label: "Eksterne", icon: UserPlus, href: "/konsulenter/eksterne" },
  { label: "stacq.no", icon: Globe, href: "/nettside-ai" },
];

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function DesignLabCompanies() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { signOut, user } = useAuth();
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("Alle");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("Alle");
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "name", dir: "asc" });
  const [typeDropdownOpen, setTypeDropdownOpen] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const initials = user?.email ? user.email.split("@")[0].slice(0, 2).toUpperCase() : "??";

  // Close type dropdown on outside click
  useEffect(() => {
    if (!typeDropdownOpen) return;
    const handler = () => setTypeDropdownOpen(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [typeDropdownOpen]);

  // ── Data query (same pattern as Companies.tsx) ──
  const { data: companies = [], isLoading } = useQuery({
    queryKey: crmQueryKeys.companies.all(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*, contacts(id), profiles!companies_owner_id_fkey(id, full_name)")
        .order("name");
      if (error) throw error;

      const companyIds = data.map((c) => c.id);
      const companyIdSet = new Set(companyIds);
      const contactIds = data.flatMap((c) => (c.contacts || []).map((ct: any) => ct.id));

      const [actRes, taskRes, contactActRes, contactTaskRes] = await Promise.all([
        supabase.from("activities").select("company_id, created_at, subject, description")
          .not("company_id", "is", null).order("created_at", { ascending: false }).limit(2000),
        supabase.from("tasks").select("company_id, due_date, title, description, status, created_at")
          .not("company_id", "is", null).neq("status", "done").limit(2000),
        supabase.from("activities").select("contact_id, created_at, subject, description")
          .not("contact_id", "is", null).order("created_at", { ascending: false }).limit(2000),
        supabase.from("tasks").select("contact_id, due_date, title, description, status, created_at")
          .not("contact_id", "is", null).neq("status", "done").limit(2000),
      ]);

      const contactToCompany: Record<string, string> = {};
      data.forEach((c) => (c.contacts || []).forEach((ct: any) => { contactToCompany[ct.id] = c.id; }));

      const now = new Date();
      const isPast = (d: string) => new Date(d) <= now;
      const lastActivityMap: Record<string, string> = {};
      const taskCountMap: Record<string, number> = {};
      const overdueTaskMap: Record<string, boolean> = {};
      const companyActsMap: Record<string, any[]> = {};
      const companyTasksMap: Record<string, any[]> = {};

      (actRes.data || []).forEach((a) => {
        if (!a.company_id || !companyIdSet.has(a.company_id)) return;
        if (isPast(a.created_at) && !lastActivityMap[a.company_id]) lastActivityMap[a.company_id] = a.created_at;
      });

      ((contactActRes as any).data || []).forEach((a: any) => {
        const cid = contactToCompany[a.contact_id];
        if (!cid) return;
        if (isPast(a.created_at) && (!lastActivityMap[cid] || a.created_at > lastActivityMap[cid]))
          lastActivityMap[cid] = a.created_at;
        if (!companyActsMap[cid]) companyActsMap[cid] = [];
        companyActsMap[cid].push(a);
      });

      (taskRes.data || []).forEach((t) => {
        if (!t.company_id || !companyIdSet.has(t.company_id)) return;
        taskCountMap[t.company_id] = (taskCountMap[t.company_id] || 0) + 1;
        if (t.due_date && new Date(t.due_date) < new Date()) overdueTaskMap[t.company_id] = true;
      });

      ((contactTaskRes as any).data || []).forEach((t: any) => {
        const cid = contactToCompany[t.contact_id];
        if (!cid) return;
        taskCountMap[cid] = (taskCountMap[cid] || 0) + 1;
        if (t.due_date && new Date(t.due_date) < new Date()) overdueTaskMap[cid] = true;
        if (!companyTasksMap[cid]) companyTasksMap[cid] = [];
        companyTasksMap[cid].push(t);
      });

      const signalMap: Record<string, string> = {};
      for (const c of data) {
        const sig = getEffectiveSignal(
          (companyActsMap[c.id] || []).map((a: any) => ({ created_at: a.created_at, subject: a.subject, description: a.description })),
          (companyTasksMap[c.id] || []).map((t: any) => ({ created_at: t.created_at, title: t.title, description: t.description, due_date: t.due_date })),
        );
        signalMap[c.id] = sig || "";
      }

      return data.map((c) => ({
        ...c,
        lastActivity: lastActivityMap[c.id] || null,
        taskCount: taskCountMap[c.id] || 0,
        hasOverdue: overdueTaskMap[c.id] || false,
        signal: signalMap[c.id] || "",
        contactCount: (c.contacts || []).length,
        ownerName: (c.profiles as any)?.full_name || "",
        ownerId: (c.profiles as any)?.id || null,
      }));
    },
  });

  // ── Type mutation ──
  const setTypeMutation = useMutation({
    mutationFn: async ({ companyId, status }: { companyId: string; status: string }) => {
      const { error } = await supabase.from("companies").update({ status }).eq("id", companyId);
      if (error) throw error;
    },
    onMutate: async ({ companyId, status }) => {
      queryClient.setQueryData(crmQueryKeys.companies.all(), (old: any[]) =>
        old?.map((c) => (c.id === companyId ? { ...c, status } : c)),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.companies.all() });
      toast.success("Type oppdatert");
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.companies.all() });
      toast.error("Kunne ikke oppdatere type");
    },
  });

  const toggleSort = useCallback((field: SortField) => {
    setSort((p) => p.field === field ? { field, dir: p.dir === "asc" ? "desc" : "asc" } : { field, dir: field === "last_activity" ? "desc" : "asc" });
  }, []);

  // ── Filtering ──
  const filtered = useMemo(() => {
    let list = companies;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c: any) =>
        c.name.toLowerCase().includes(q) ||
        c.org_number?.includes(q) ||
        c.city?.toLowerCase().includes(q)
      );
    }
    if (ownerFilter === "Uten eier") list = list.filter((c: any) => !c.ownerId);
    else if (ownerFilter !== "Alle") list = list.filter((c: any) => c.ownerName === ownerFilter);
    if (typeFilter !== "Alle") {
      const dbValue = TYPE_LABEL_TO_VALUE[typeFilter];
      if (dbValue) list = list.filter((c: any) => c.status === dbValue || (dbValue === "customer" && c.status === "kunde"));
    }
    return list;
  }, [companies, search, ownerFilter, typeFilter]);

  // ── Sorting ──
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const d = sort.dir === "asc" ? 1 : -1;
    arr.sort((a: any, b: any) => {
      switch (sort.field) {
        case "name": return d * a.name.localeCompare(b.name, "nb");
        case "type": {
          const typeOrder = ["customer", "kunde", "prospect", "partner", "churned"];
          const ai = typeOrder.indexOf(a.status); const bi = typeOrder.indexOf(b.status);
          return d * ((ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi));
        }
        case "signal": {
          const as = SIGNAL_ORDER[mapToSignal(a.signal)] ?? 3;
          const bs = SIGNAL_ORDER[mapToSignal(b.signal)] ?? 3;
          return d * (as - bs);
        }
        case "city": return d * (a.city || "").localeCompare(b.city || "", "nb");
        case "last_activity": {
          if (!a.lastActivity && !b.lastActivity) return 0;
          if (!a.lastActivity) return 1;
          if (!b.lastActivity) return -1;
          return d * a.lastActivity.localeCompare(b.lastActivity);
        }
        case "tasks": return d * ((a.taskCount || 0) - (b.taskCount || 0));
        default: return 0;
      }
    });
    return arr;
  }, [filtered, sort]);

  const renderRow = useCallback((company: any) => {
    const signal = company.signal ? mapToSignal(company.signal) : null;
    const signalColors = signal ? SIGNAL_COLORS[signal] : null;
    const daysSince = company.lastActivity ? differenceInDays(new Date(), new Date(company.lastActivity)) : null;
    const typeLabel = TYPE_VALUE_TO_LABEL[company.status] || company.status;
    const isSelected = selectedId === company.id;

    return (
      <div
        key={company.id}
        onClick={() => setSelectedId(isSelected ? null : company.id)}
        className="grid items-center cursor-pointer group"
        style={{
          gridTemplateColumns: "minmax(180px,2fr) minmax(120px,1fr) 130px 120px 90px 80px",
          minHeight: 34, paddingLeft: 16, paddingRight: 16,
          borderBottom: `1px solid ${C.borderLight}`,
          background: isSelected ? C.activeBg : "transparent",
        }}
        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = C.hoverBg; }}
        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
      >
        {/* Name */}
        <div className="min-w-0 flex items-center gap-2">
          <span className="truncate" style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{company.name}</span>
          {company.contactCount > 0 && (
            <span style={{ fontSize: 11, color: C.textGhost }}>{company.contactCount}</span>
          )}
        </div>

        {/* Type — inline dropdown */}
        <div className="min-w-0 relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTypeDropdownOpen(typeDropdownOpen === company.id ? null : company.id);
            }}
            className="inline-flex items-center gap-0.5 transition-colors"
            style={{ fontSize: 12, color: C.textMuted, cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = C.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; }}
          >
            <span className="truncate">{typeLabel}</span>
            <ChevronDown style={{ width: 12, height: 12, flexShrink: 0 }} />
          </button>
          {typeDropdownOpen === company.id && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setTypeDropdownOpen(null)} />
              <div
                className="absolute left-0 top-full mt-1 z-30 rounded-md overflow-hidden"
                style={{ background: C.panel, border: `1px solid ${C.border}`, boxShadow: C.shadowMd, minWidth: 160 }}
              >
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setTypeMutation.mutate({ companyId: company.id, status: opt.value });
                      setTypeDropdownOpen(null);
                    }}
                    className="block w-full text-left px-3 transition-colors"
                    style={{ fontSize: 12, color: C.text, height: 30 }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverBg; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Signal */}
        <div className="flex items-center gap-1.5">
          {signal && <SignalChip signal={signal} />}
        </div>

        {/* City */}
        <span className="truncate" style={{ fontSize: 12, color: C.textMuted }}>{company.city || ""}</span>

        {/* Last activity */}
        <span style={{ fontSize: 12, color: C.textFaint }}>
          {daysSince !== null ? relTime(daysSince) : ""}
        </span>

        {/* Tasks */}
        <span className="text-right" style={{ fontSize: 12, color: company.hasOverdue ? C.danger : company.taskCount > 0 ? C.textMuted : C.textGhost }}>
          {company.taskCount > 0 ? company.taskCount : ""}
        </span>
      </div>
    );
  }, [selectedId, typeDropdownOpen, setTypeMutation]);

  /* ═══ RENDER ═══ */
  return (
    <div className="flex h-screen overflow-hidden select-none" style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif", background: C.bg }}>

      {/* ═══ SIDEBAR ═══ */}
      <aside className="flex flex-col shrink-0" style={{ width: 220, borderRight: `1px solid ${C.borderLight}`, background: C.sidebarBg }}>
        <div className="flex items-center gap-2 px-4" style={{ height: 40 }}>
          <div className="flex items-center justify-center rounded" style={{ width: 22, height: 22, background: C.accent, color: "#fff", fontSize: 11, fontWeight: 600 }}>S</div>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>STACQ</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 space-y-4 pb-3 pt-1">
          <NavGroup items={NAV_MAIN} navigate={navigate} />
          <div>
            <p className="px-2 pb-1.5 pt-1" style={{ fontSize: 11, fontWeight: 500, color: C.textFaint, textTransform: "none" }}>Stacq</p>
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
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: C.appBg }}>
        {/* Header bar */}
        <header className="flex items-center justify-between px-6 shrink-0" style={{ height: 40, borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-baseline gap-2.5">
            <h1 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Selskaper</h1>
            <span style={{ fontSize: 13, color: C.textGhost, fontWeight: 500 }}>{filtered.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative" style={{ width: 220 }}>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ width: 14, height: 14, color: C.textGhost }} />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Søk selskaper…"
                className="w-full outline-none placeholder:text-[#a2a5ab]"
                style={{ height: 32, paddingLeft: 30, paddingRight: 9, borderRadius: 5, border: `1px solid ${C.border}`, background: C.surfaceAlt, color: C.text, fontSize: 13 }}
              />
            </div>
            <button
              className="inline-flex items-center gap-1.5 rounded-md transition-opacity hover:opacity-90"
              style={{ height: 30, paddingInline: 11, fontSize: 13, fontWeight: 500, background: C.accent, color: "#fff", borderRadius: 5 }}
              onClick={() => navigate("/selskaper?ny=Nytt+selskap")}
            >
              + Nytt selskap
            </button>
          </div>
        </header>

        {/* Filters bar */}
        <div className="shrink-0 space-y-0" style={{ borderBottom: `1px solid ${C.border}`, padding: "8px 24px 10px" }}>
          <FilterRow label="EIER" options={OWNERS} value={ownerFilter} onChange={setOwnerFilter} />
          <div className="flex items-center justify-between">
            <FilterRow label="TYPE" options={[...TYPE_FILTERS]} value={typeFilter} onChange={(v) => setTypeFilter(v as TypeFilter)} />
            {(ownerFilter !== "Alle" || typeFilter !== "Alle") && (
              <button
                onClick={() => { setOwnerFilter("Alle"); setTypeFilter("Alle"); }}
                className="inline-flex items-center gap-1 rounded transition-colors shrink-0"
                style={{ fontSize: 12, color: C.textFaint, padding: "2px 6px" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = C.text; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = C.textFaint; }}
              >
                <X style={{ width: 12, height: 12 }} /> Nullstill
              </button>
            )}
          </div>
        </div>

        {/* Content: list + detail */}
        <div className="flex-1 min-h-0 flex">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={35} minSize={20} maxSize={60}>
              <div className="h-full overflow-y-auto" style={{ scrollbarColor: `${C.borderStrong} ${C.surfaceAlt}` }}>
                <div
                  className="grid items-center sticky top-0 z-10"
                  style={{
                    gridTemplateColumns: "minmax(180px,2fr) minmax(120px,1fr) 130px 120px 90px 80px",
                    height: 32, borderBottom: `1px solid ${C.border}`,
                    background: C.surfaceAlt, paddingLeft: 16, paddingRight: 16,
                  }}
                >
                  <ColHeader label="Selskap" field="name" sort={sort} onSort={toggleSort} />
                  <ColHeader label="Type" field="type" sort={sort} onSort={toggleSort} />
                  <ColHeader label="Signal" field="signal" sort={sort} onSort={toggleSort} />
                  <ColHeader label="Sted" field="city" sort={sort} onSort={toggleSort} />
                  <ColHeader label="Siste akt." field="last_activity" sort={sort} onSort={toggleSort} />
                  <ColHeader label="Oppf." field="tasks" sort={sort} onSort={toggleSort} className="justify-end" />
                </div>
                {isLoading ? (
                  <div style={{ textAlign: "center", padding: "48px 0", color: C.textFaint, fontSize: 13 }}>Laster selskaper…</div>
                ) : sorted.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "48px 0", color: C.textFaint, fontSize: 13 }}>Ingen selskaper funnet</div>
                ) : (
                  sorted.map((company: any) => renderRow(company))
                )}
              </div>
            </ResizablePanel>
            <ResizableHandle
              withHandle
              className="bg-transparent hover:bg-[rgba(0,0,0,0.04)] transition-colors data-[resize-handle-active]:bg-[rgba(94,106,210,0.12)]"
            />
            <ResizablePanel defaultSize={65} minSize={30}>
              {selectedId ? (
                <div className="h-full flex flex-col" style={{ background: C.panel, borderLeft: `1px solid ${C.borderLight}` }}>
                  <div className="shrink-0 flex items-center justify-end px-4" style={{ height: 32, borderBottom: `1px solid ${C.border}` }}>
                    <button
                      onClick={() => setSelectedId(null)}
                      className="rounded p-1 hover:bg-black/5 transition-colors"
                      style={{ color: C.textFaint }}
                    >
                      <X style={{ width: 16, height: 16 }} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 py-5 dl-v8-theme">
                    <CompanyCardContent companyId={selectedId} editable onNavigateToFullPage={() => navigate(`/selskaper/${selectedId}`)} />
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
            <ResizablePanel defaultSize={0} minSize={0} maxSize={40}>
              <div className="h-full" style={{ background: C.appBg }} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function NavGroup({ items, navigate }: { items: typeof NAV_MAIN; navigate: (p: string) => void }) {
  return (
    <div className="space-y-px">
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => navigate(item.href)}
          className="flex items-center gap-2 w-full px-2 transition-colors"
          style={{
            fontSize: 13, fontWeight: item.active ? 500 : 400,
            color: item.active ? "#1A1C1F" : "#5C636E",
            background: item.active ? "#EAECF0" : "transparent",
            borderRadius: 4, height: 28,
          }}
          onMouseEnter={(e) => { if (!item.active) { e.currentTarget.style.background = "#F0F2F4"; e.currentTarget.style.color = "#1A1C1F"; } }}
          onMouseLeave={(e) => { if (!item.active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#5C636E"; } }}
        >
          <item.icon style={{ width: 14, height: 14, strokeWidth: 1.5, color: item.active ? "#1A1C1F" : "#8C929C" }} />
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
      className="flex items-center gap-2 w-full px-2 transition-colors"
      style={{ fontSize: 13, fontWeight: 400, color: muted ? C.textGhost : "#5C636E", borderRadius: 4, height: 28 }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#F0F2F4"; e.currentTarget.style.color = "#1A1C1F"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = muted ? C.textGhost : "#5C636E"; }}
    >
      <Icon style={{ width: 14, height: 14, strokeWidth: 1.5, color: "#8C929C" }} />
      {label}
    </button>
  );
}

function FilterRow({ label, options, value, onChange }: {
  label: string; options: readonly string[] | string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-[3px]">
      <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: C.textMuted, width: 56, flexShrink: 0 }}>{label}</span>
      <div className="flex items-center gap-1 flex-wrap">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              onClick={() => onChange(opt)}
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
              {opt}
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
