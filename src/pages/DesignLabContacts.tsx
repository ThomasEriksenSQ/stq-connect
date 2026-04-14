import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import {
  Search, ChevronDown, ChevronUp, Check,
  Users, X,
  Building2, LayoutDashboard, Briefcase, Settings, LogOut,
  UserPlus, Radar, TrendingUp, Globe,
  ArrowUpRight, Clock,
} from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { nb } from "date-fns/locale";
import { getEffectiveSignal, normalizeCategoryLabel } from "@/lib/categoryUtils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { ContactCardContent } from "@/components/ContactCardContent";

/* ═══════════════════════════════════════════════════════════
   TYPES & CONSTANTS
   ═══════════════════════════════════════════════════════════ */

type Signal = "Behov nå" | "Får fremtidig behov" | "Får kanskje behov" | "Ukjent om behov" | "Ikke aktuelt";

const SIGNAL_ORDER: Record<Signal, number> = {
  "Behov nå": 0, "Får fremtidig behov": 1, "Får kanskje behov": 2, "Ukjent om behov": 3, "Ikke aktuelt": 4,
};

const SIGNALS: Signal[] = ["Behov nå", "Får fremtidig behov", "Får kanskje behov", "Ukjent om behov", "Ikke aktuelt"];
const OWNERS = ["Alle", "Jon Richard Nygaard", "Thomas Eriksen", "Uten eier"];
const TYPES = ["Alle", "Innkjøper", "CV-Epost", "Ikke relevant kontakt"] as const;
type TypeFilter = typeof TYPES[number];

type SortField = "name" | "signal" | "company" | "title" | "owner" | "last_activity";
type SortDir = "asc" | "desc";

/* ── Colors ── */
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
  dangerBg: "rgba(154,74,74,0.06)",
  success: "#4a9a6a",
  successBg: "rgba(74,154,106,0.06)",
  warning: "#9a7a2a",
  warningBg: "rgba(154,122,42,0.06)",
} as const;

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
  { label: "Selskaper", icon: Building2, href: "/selskaper" },
  { label: "Kontakter", icon: Users, href: "/design-lab/kontakter", active: true },
  { label: "Forespørsler", icon: Briefcase, href: "/foresporsler" },
  { label: "Oppfølginger", icon: Clock, href: "/oppfolginger" },
];

const NAV_STACQ = [
  { label: "STACQ Prisen", icon: TrendingUp, href: "/stacq/prisen" },
  { label: "Markedsradar", icon: Radar, href: "/markedsradar" },
  { label: "Ansatte", icon: Users, href: "/konsulenter/ansatte" },
  { label: "Eksterne", icon: UserPlus, href: "/konsulenter/eksterne" },
  { label: "stacq.no", icon: Globe, href: "/nettside-ai" },
];

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function DesignLabContacts() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { signOut, user } = useAuth();
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("Alle");
  const [signalFilter, setSignalFilter] = useState("Alle");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("Alle");
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "last_activity", dir: "asc" });
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("contact"));
  const searchRef = useRef<HTMLInputElement>(null);

  const initials = user?.email ? user.email.split("@")[0].slice(0, 2).toUpperCase() : "??";

  // ⌘K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setSelectedId(null);
        searchRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // sync selectedId to URL
  useEffect(() => {
    if (selectedId) {
      setSearchParams({ contact: selectedId }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [selectedId]);

  // ── Queries ──
  const { data: rawContacts = [], isLoading } = useQuery({
    queryKey: ["dl-contacts-v8"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, title, email, phone, cv_email, call_list, ikke_aktuell_kontakt, teknologier, company_id, location, linkedin, department, notes, locations, companies(id, name), profiles:owner_id(id, full_name)")
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const contactIds = useMemo(() => rawContacts.map((c) => c.id), [rawContacts]);

  const { data: activitiesMap = {} } = useQuery({
    queryKey: ["dl-activities-v8", contactIds.length],
    queryFn: async () => {
      if (!contactIds.length) return {};
      const { data, error } = await supabase
        .from("activities")
        .select("id, contact_id, subject, description, created_at, type, created_by, profiles:created_by(full_name)")
        .in("contact_id", contactIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const map: Record<string, typeof data> = {};
      data.forEach((a) => { if (a.contact_id) { (map[a.contact_id] ??= []).push(a); } });
      return map;
    },
    enabled: contactIds.length > 0,
  });

  const { data: tasksMap = {} } = useQuery({
    queryKey: ["dl-tasks-v8", contactIds.length],
    queryFn: async () => {
      if (!contactIds.length) return {};
      const { data, error } = await supabase
        .from("tasks")
        .select("id, contact_id, title, description, due_date, status, priority, created_at, assigned_to, profiles:assigned_to(full_name), companies:company_id(name)")
        .in("contact_id", contactIds)
        .order("due_date", { ascending: true });
      if (error) throw error;
      const map: Record<string, typeof data> = {};
      data.forEach((t) => { if (t.contact_id) { (map[t.contact_id] ??= []).push(t); } });
      return map;
    },
    enabled: contactIds.length > 0,
  });

  // Forespørsler (requests) for selected contact
  // (forespørsler handled by ContactCardContent internally)

  // ── Computed ──
  const contacts = useMemo(() => {
    const now = new Date();
    return rawContacts.map((c) => {
      const acts = (activitiesMap as any)[c.id] || [];
      const tasks = (tasksMap as any)[c.id] || [];
      const effectiveSignal = getEffectiveSignal(acts, tasks);
      const signal = effectiveSignal ? mapToSignal(effectiveSignal) : "Ukjent om behov" as Signal;
      const lastAct = acts[0] || null;
      const daysSince = lastAct ? differenceInDays(now, new Date(lastAct.created_at)) : 999;
      const company = (c as any).companies;
      const owner = (c as any).profiles;
      return {
        id: c.id, firstName: c.first_name, lastName: c.last_name,
        title: c.title || "", email: c.email || "", phone: c.phone || "",
        linkedin: c.linkedin || "", location: c.location || "",
        locations: c.locations || [],
        department: c.department || "", notes: c.notes || "",
        company: company?.name || "", companyId: company?.id || null,
        signal, eier: owner?.full_name || "", eierId: owner?.id || null,
        cvEmail: c.cv_email, callList: c.call_list,
        ikkeAktuell: c.ikke_aktuell_kontakt ?? false,
        teknologier: c.teknologier || [],
        daysSince, lastActivitySubject: lastAct?.subject || "",
        activities: acts, tasks,
      };
    });
  }, [rawContacts, activitiesMap, tasksMap]);

  const toggleSort = useCallback((field: SortField) => {
    setSort((p) => p.field === field ? { field, dir: p.dir === "asc" ? "desc" : "asc" } : { field, dir: "asc" });
  }, []);

  const filtered = useMemo(() => {
    let list = contacts;
    // Default: hide ikke-relevante unless explicitly filtering for them
    if (typeFilter !== "Ikke relevant kontakt") {
      list = list.filter((c) => !c.ikkeAktuell);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    }
    if (ownerFilter === "Uten eier") list = list.filter((c) => !c.eier);
    else if (ownerFilter !== "Alle") list = list.filter((c) => c.eier === ownerFilter);
    if (signalFilter !== "Alle") list = list.filter((c) => c.signal === signalFilter);
    if (typeFilter === "Innkjøper") list = list.filter((c) => c.callList === true);
    else if (typeFilter === "CV-Epost") list = list.filter((c) => c.cvEmail === true);
    else if (typeFilter === "Ikke relevant kontakt") list = list.filter((c) => c.ikkeAktuell);
    return list;
  }, [contacts, search, ownerFilter, signalFilter, typeFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const d = sort.dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sort.field) {
        case "name": return d * `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "nb");
        case "signal": return d * (SIGNAL_ORDER[a.signal] - SIGNAL_ORDER[b.signal]);
        case "company": return d * a.company.localeCompare(b.company, "nb");
        case "title": return d * a.title.localeCompare(b.title, "nb");
        case "owner": return d * a.eier.localeCompare(b.eier, "nb");
        case "last_activity": return d * (a.daysSince - b.daysSince);
        default: return 0;
      }
    });
    return arr;
  }, [filtered, sort]);

  const sel = selectedId ? contacts.find((c) => c.id === selectedId) ?? null : null;

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!sorted.length) return;
        e.preventDefault();
        const idx = sorted.findIndex((c) => c.id === selectedId);
        const next = e.key === "ArrowDown"
          ? Math.min(idx + 1, sorted.length - 1)
          : Math.max(idx - 1, 0);
        setSelectedId(sorted[next].id);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [sorted, selectedId]);

  /* ═══ RENDER ═══ */
  return (
    <div className="flex h-screen overflow-hidden select-none" style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif", background: C.bg }}>

      {/* ═══ SIDEBAR ═══ */}
      <aside className="flex flex-col shrink-0" style={{ width: 216, borderRight: `1px solid ${C.border}`, background: C.bg }}>
        {/* Workspace */}
        <div className="flex items-center gap-2 px-4 h-12">
          <div className="flex items-center justify-center rounded" style={{ width: 22, height: 22, background: C.accent, color: "#fff", fontSize: 11, fontWeight: 700 }}>S</div>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>STACQ</span>
        </div>

        {/* Search trigger */}
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

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto px-3 space-y-4 pb-3">
          <NavGroup items={NAV_MAIN} navigate={navigate} />
          <div>
            <p className="px-2 pb-1.5 pt-1" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.textGhost }}>STACQ</p>
            <NavGroup items={NAV_STACQ} navigate={navigate} />
          </div>
        </nav>

        {/* Footer */}
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
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header bar */}
        <header className="flex items-center justify-between px-6 shrink-0" style={{ height: 48, borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-baseline gap-2.5">
            <h1 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Kontakter</h1>
            <span style={{ fontSize: 13, color: C.textGhost, fontWeight: 500 }}>{filtered.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative" style={{ width: 220 }}>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ width: 14, height: 14, color: C.textGhost }} />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Søk kontakter…"
                className="w-full outline-none placeholder:text-[#BAB9B4]"
                style={{ height: 30, paddingLeft: 30, paddingRight: 10, borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13 }}
              />
            </div>
            <button
              className="inline-flex items-center gap-1.5 rounded-md transition-opacity hover:opacity-90"
              style={{ height: 30, paddingInline: 12, fontSize: 13, fontWeight: 500, background: C.accent, color: "#fff", borderRadius: 6 }}
            >
              + Ny kontakt
            </button>
          </div>
        </header>

        {/* Filters bar */}
        <div className="shrink-0 space-y-0" style={{ borderBottom: `1px solid ${C.border}`, padding: "8px 24px 10px" }}>
          <FilterRow label="EIER" options={OWNERS} value={ownerFilter} onChange={setOwnerFilter} />
          <div className="flex items-center justify-between">
            <FilterRow label="SIGNAL" options={["Alle", ...SIGNALS]} value={signalFilter} onChange={setSignalFilter} />
            <span style={{ fontSize: 12, color: C.textFaint, fontWeight: 500, whiteSpace: "nowrap", paddingLeft: 12 }}>{filtered.length} kontakter</span>
          </div>
          <div className="flex items-center justify-between">
            <FilterRow label="TYPE" options={[...TYPES]} value={typeFilter} onChange={(v) => setTypeFilter(v as TypeFilter)} />
            {(ownerFilter !== "Alle" || signalFilter !== "Alle" || typeFilter !== "Alle") && (
              <button
                onClick={() => { setOwnerFilter("Alle"); setSignalFilter("Alle"); setTypeFilter("Alle"); }}
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
        <div className="flex-1 min-h-0">
          {sel ? (
            <ResizablePanelGroup direction="horizontal" className="h-full">
              <ResizablePanel defaultSize={35} minSize={20} maxSize={60}>
                <div className="h-full overflow-y-auto">
                  {/* Table header */}
                  <div
                    className="grid items-center sticky top-0 z-10"
                    style={{
                      gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr) minmax(0,1.4fr) 64px",
                      height: 32, borderBottom: `1px solid ${C.border}`,
                      background: C.bg, paddingLeft: 16, paddingRight: 16,
                    }}
                  >
                    <ColHeader label="Navn" field="name" sort={sort} onSort={toggleSort} />
                    <ColHeader label="Signal" field="signal" sort={sort} onSort={toggleSort} />
                    <ColHeader label="Selskap" field="company" sort={sort} onSort={toggleSort} />
                    <ColHeader label="Siste" field="last_activity" sort={sort} onSort={toggleSort} className="justify-end" />
                  </div>
                  {isLoading ? (
                    <div style={{ textAlign: "center", padding: "48px 0", color: C.textFaint, fontSize: 13 }}>Laster kontakter…</div>
                  ) : sorted.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "48px 0", color: C.textFaint, fontSize: 13 }}>Ingen kontakter funnet</div>
                  ) : (
                    sorted.map((c) => {
                      const isActive = selectedId === c.id;
                      return (
                        <div
                          key={c.id}
                          onClick={() => setSelectedId(isActive ? null : c.id)}
                          className="grid items-center cursor-pointer group"
                          style={{
                            gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr) minmax(0,1.4fr) 64px",
                            height: 38, paddingLeft: 16, paddingRight: 16,
                            borderBottom: `1px solid ${C.borderLight}`,
                            background: isActive ? C.activeBg : undefined,
                            transition: "background 50ms",
                          }}
                          onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = C.hoverBg; }}
                          onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = isActive ? C.activeBg : ""; }}
                        >
                          <div className="truncate pr-3">
                            <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{c.firstName} {c.lastName}</span>
                          </div>
                          <div className="pr-3"><SignalChip signal={c.signal} /></div>
                          <div className="truncate pr-3"><span style={{ fontSize: 13, color: C.textMuted }}>{c.company}</span></div>
                          <div className="text-right">
                            <span style={{
                              fontSize: 12, color: c.daysSince < 7 ? C.textMuted : c.daysSince < 30 ? C.textFaint : C.textGhost,
                            }}>
                              {c.daysSince < 999 ? relTime(c.daysSince) : "—"}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ResizablePanel>
              <ResizableHandle
                withHandle
                className="bg-transparent hover:bg-[rgba(40,37,29,0.06)] transition-colors data-[resize-handle-active]:bg-[rgba(1,105,111,0.12)]"
              />
              <ResizablePanel defaultSize={65} minSize={40}>
                <div className="h-full flex flex-col" style={{ background: C.surface }}>
                  {/* Linear-styled header */}
                  <div className="shrink-0 flex items-center justify-between px-6" style={{ height: 48, borderBottom: `1px solid ${C.border}` }}>
                    <div className="flex items-center gap-2">
                      <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{sel.firstName} {sel.lastName}</h2>
                      <SignalChip signal={sel.signal} size="md" />
                    </div>
                    <div className="flex items-center gap-0.5">
                      <IconBtn icon={<ArrowUpRight style={{ width: 15, height: 15 }} />} title="Åpne i CRM" onClick={() => navigate(`/kontakter/${sel.id}`)} />
                      <IconBtn icon={<X style={{ width: 15, height: 15 }} />} title="Lukk" onClick={() => setSelectedId(null)} />
                    </div>
                  </div>
                  {/* Full ContactCardContent */}
                  <div className="flex-1 overflow-y-auto px-6 py-5">
                    <ContactCardContent contactId={sel.id} editable />
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <div className="h-full overflow-y-auto">
              {/* Table header — full width */}
              <div
                className="grid items-center sticky top-0 z-10"
                style={{
                  gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr) minmax(0,1.4fr) minmax(0,1.2fr) minmax(0,1fr) 64px",
                  height: 32, borderBottom: `1px solid ${C.border}`,
                  background: C.bg, paddingLeft: 16, paddingRight: 16,
                }}
              >
                <ColHeader label="Navn" field="name" sort={sort} onSort={toggleSort} />
                <ColHeader label="Signal" field="signal" sort={sort} onSort={toggleSort} />
                <ColHeader label="Selskap" field="company" sort={sort} onSort={toggleSort} />
                <ColHeader label="Stilling" field="title" sort={sort} onSort={toggleSort} />
                <ColHeader label="Eier" field="owner" sort={sort} onSort={toggleSort} />
                <ColHeader label="Siste" field="last_activity" sort={sort} onSort={toggleSort} className="justify-end" />
              </div>
              {isLoading ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: C.textFaint, fontSize: 13 }}>Laster kontakter…</div>
              ) : sorted.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: C.textFaint, fontSize: 13 }}>Ingen kontakter funnet</div>
              ) : (
                sorted.map((c) => {
                  const isActive = selectedId === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedId(isActive ? null : c.id)}
                      className="grid items-center cursor-pointer group"
                      style={{
                        gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr) minmax(0,1.4fr) minmax(0,1.2fr) minmax(0,1fr) 64px",
                        height: 38, paddingLeft: 16, paddingRight: 16,
                        borderBottom: `1px solid ${C.borderLight}`,
                        background: isActive ? C.activeBg : undefined,
                        transition: "background 50ms",
                      }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = C.hoverBg; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = isActive ? C.activeBg : ""; }}
                    >
                      <div className="truncate pr-3">
                        <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{c.firstName} {c.lastName}</span>
                      </div>
                      <div className="pr-3"><SignalChip signal={c.signal} /></div>
                      <div className="truncate pr-3"><span style={{ fontSize: 13, color: C.textMuted }}>{c.company}</span></div>
                      <div className="truncate pr-3"><span style={{ fontSize: 13, color: C.textMuted }}>{c.title}</span></div>
                      <div className="truncate pr-3">
                        <span style={{ fontSize: 12, color: C.textFaint }}>{c.eier}</span>
                      </div>
                      <div className="text-right">
                        <span style={{
                          fontSize: 12, color: c.daysSince < 7 ? C.textMuted : c.daysSince < 30 ? C.textFaint : C.textGhost,
                        }}>
                          {c.daysSince < 999 ? relTime(c.daysSince) : "—"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SIGNAL CHIP
   ═══════════════════════════════════════════════════════════ */

function SignalChip({ signal, size = "sm" }: { signal: Signal; size?: "sm" | "md" }) {
  const isTeal = signal === "Behov nå";
  const shortLabels: Record<Signal, string> = {
    "Behov nå": "Behov nå",
    "Får fremtidig behov": "Fremtidig",
    "Får kanskje behov": "Kanskje",
    "Ukjent om behov": "Ukjent",
    "Ikke aktuelt": "Ikke aktuelt",
  };
  return (
    <span
      className="inline-flex items-center rounded-full"
      style={{
        fontSize: size === "sm" ? 11 : 12,
        fontWeight: 500,
        padding: size === "sm" ? "1px 7px" : "2px 10px",
        whiteSpace: "nowrap",
        background: isTeal ? "rgba(1,105,111,0.08)" : "rgba(40,37,29,0.05)",
        color: isTeal ? C.accent : signal === "Ikke aktuelt" ? "#8a5a5a" : C.textFaint,
      }}
    >
      {size === "sm" ? shortLabels[signal] : signal}
    </span>
  );
}

/* (DetailPanel removed — now using ContactCardContent directly) */

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


function FilterPill({ label, value, options, open, setOpen, onChange }: {
  label: string; value: string; options: string[]; open: boolean; setOpen: (v: boolean) => void; onChange: (v: string) => void;
}) {
  const active = value !== "Alle";
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 rounded transition-colors"
        style={{
          height: 26, paddingInline: 8, fontSize: 12, fontWeight: 500,
          border: `1px solid ${active ? C.text : C.border}`,
          background: active ? C.text : "transparent",
          color: active ? C.bg : C.textMuted,
        }}
      >
        {active ? `${label}: ${value}` : label}
        <ChevronDown style={{ width: 12, height: 12 }} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-52 rounded-lg overflow-hidden z-50" style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 4px 16px rgba(40,37,29,0.1)" }}>
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => onChange(opt)}
                className="flex items-center justify-between w-full px-3 py-1.5 transition-colors"
                style={{ fontSize: 13, color: C.text }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
              >
                {opt}
                {value === opt && <Check style={{ width: 14, height: 14, color: C.accent }} />}
              </button>
            ))}
          </div>
        </>
      )}
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
