import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import {
  Search, ChevronDown, ChevronUp,
  Users, X,
  Building2, LayoutDashboard, Briefcase, Settings, LogOut,
  UserPlus, Radar, TrendingUp, Globe,
  ArrowUpRight, Clock, Phone, Mail, MessageCircle, FileText, Calendar,
  ChevronRight,
} from "lucide-react";
import { differenceInDays, format, formatDistanceToNow, isToday, isBefore } from "date-fns";
import { nb } from "date-fns/locale";
import { getEffectiveSignal, normalizeCategoryLabel } from "@/lib/categoryUtils";
import { toast } from "sonner";
import { getConsultantAvailabilityMeta, sortHuntConsultants } from "@/lib/contactHunt";
import { useAuth } from "@/hooks/useAuth";
import { TextSizeControl, SCALE_MAP, type TextSize } from "@/components/designlab/TextSizeControl";
import { usePersistentState } from "@/hooks/usePersistentState";
import { getHeatResult, getTaskStatus, getActivityStatus, type HeatResult } from "@/lib/heatScore";
import { cleanDescription } from "@/lib/cleanDescription";

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
const TEMPERATURES = ["Alle", "Hett", "Lovende", "Mulig", "Sovende"] as const;
type TempFilter = typeof TEMPERATURES[number];

type SortField = "name" | "signal" | "company" | "title" | "owner" | "last_activity" | "heat";
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
  activeBg: "rgba(1,105,111,0.06)",
  selectedBorder: "#01696F",
  shadow: "0 1px 3px rgba(40,37,29,0.06)",
  danger: "#9a4a4a",
  dangerBg: "rgba(154,74,74,0.06)",
  success: "#4a9a6a",
  successBg: "rgba(74,154,106,0.06)",
  warning: "#9a7a2a",
  warningBg: "rgba(154,122,42,0.06)",
} as const;

/* ── Signal color map (V8 desaturated) ── */
const SIGNAL_COLORS: Record<Signal, { bg: string; color: string }> = {
  "Behov nå": { bg: "rgba(1,105,111,0.08)", color: C.accent },
  "Får fremtidig behov": { bg: "rgba(59,111,160,0.08)", color: "#3B6FA0" },
  "Får kanskje behov": { bg: "rgba(154,122,42,0.08)", color: "#8A7A3A" },
  "Ukjent om behov": { bg: "rgba(40,37,29,0.05)", color: C.textFaint },
  "Ikke aktuelt": { bg: "rgba(154,74,74,0.06)", color: "#8a5a5a" },
};

/* ── Heat badge colors (V8 desaturated) ── */
const HEAT_COLORS: Record<HeatResult["temperature"], { bg: string; color: string; label: string }> = {
  hett: { bg: "rgba(180,60,60,0.10)", color: "#A04040", label: "Hett" },
  lovende: { bg: "rgba(180,120,40,0.10)", color: "#9A7A2A", label: "Lovende" },
  mulig: { bg: "rgba(40,37,29,0.06)", color: C.textMuted, label: "Mulig" },
  sovende: { bg: "rgba(40,37,29,0.04)", color: C.textGhost, label: "Sovende" },
};

/* ── Signal vertical selector colors ── */
const BEHOV_OPTIONS: { signal: Signal; short: string }[] = [
  { signal: "Behov nå", short: "Behov nå" },
  { signal: "Får fremtidig behov", short: "Fremtidig" },
  { signal: "Får kanskje behov", short: "Kanskje" },
  { signal: "Ukjent om behov", short: "Ukjent" },
];

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

function cleanSubject(subject: string): string {
  return subject.replace(/^(Svar:\s*|SV:\s*|Re:\s*|Fwd:\s*|VS:\s*)+/gi, "").trim();
}

function getInitials(first: string, last: string): string {
  return ((first?.[0] || "") + (last?.[0] || "")).toUpperCase();
}

/* ═══════════════════════════════════════════════════════════
   SIDEBAR NAV
   ═══════════════════════════════════════════════════════════ */

const NAV_MAIN = [
  { label: "Salgsagent", icon: LayoutDashboard, href: "/" },
  { label: "Selskaper", icon: Building2, href: "/selskaper" },
  { label: "Kontakter", icon: Users, href: "/design-lab/kontakter", active: true },
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

export default function DesignLabContacts() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { signOut, user } = useAuth();
  const [textSize, setTextSize] = usePersistentState<TextSize>("dl-text-size", "M");
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("Alle");
  const [signalFilter, setSignalFilter] = useState("Alle");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("Alle");
  const [tempFilter, setTempFilter] = useState<TempFilter>("Alle");
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "heat", dir: "asc" });
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
        .select("id, first_name, last_name, title, email, phone, cv_email, call_list, ikke_aktuell_kontakt, teknologier, company_id, location, linkedin, department, notes, locations, companies(id, name, ikke_relevant), profiles:owner_id(id, full_name)")
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

  const { data: foresporslerMap = {} } = useQuery({
    queryKey: ["dl-foresporsler-v8", contactIds.length],
    queryFn: async () => {
      if (!contactIds.length) return {};
      const { data, error } = await supabase
        .from("foresporsler")
        .select("id, kontakt_id, status")
        .in("kontakt_id", contactIds);
      if (error) throw error;
      const map: Record<string, typeof data> = {};
      data.forEach((f) => { if (f.kontakt_id) { (map[f.kontakt_id] ??= []).push(f); } });
      return map;
    },
    enabled: contactIds.length > 0,
  });

  const { data: availableConsultants = [] } = useQuery({
    queryKey: ["dl-available-consultants"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stacq_ansatte")
        .select("id, navn, tilgjengelig_fra")
        .eq("status", "Ledig")
        .not("tilgjengelig_fra", "is", null);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const MOCK_CONSULTANTS = [
    { id: 1, navn: "Tom Erik Lundesgaard", tilgjengelig_fra: (() => { const d = new Date(); d.setDate(d.getDate() + 10); return d.toISOString().slice(0, 10); })() },
    { id: 2, navn: "Harald Ivarson Moldsvor", tilgjengelig_fra: "2026-09-01" },
    { id: 3, navn: "Trond Hübertz Emaus", tilgjengelig_fra: "2026-09-01" },
  ];

  const sortedConsultants = useMemo(() => {
    const real = availableConsultants.filter((c) => c.tilgjengelig_fra);
    const source = real.length > 0 ? real : MOCK_CONSULTANTS;
    return sortHuntConsultants(source as { id: number; navn: string; tilgjengelig_fra: string | null }[]);
  }, [availableConsultants]);

  // ── Computed with heat score ──
  const contacts = useMemo(() => {
    const now = new Date();
    return rawContacts.map((c) => {
      const acts = (activitiesMap as any)[c.id] || [];
      const tasks = (tasksMap as any)[c.id] || [];
      const foresps = (foresporslerMap as any)[c.id] || [];
      const effectiveSignal = getEffectiveSignal(acts, tasks);
      const signal = effectiveSignal ? mapToSignal(effectiveSignal) : "Ukjent om behov" as Signal;
      const lastAct = acts[0] || null;
      const daysSince = lastAct ? differenceInDays(now, new Date(lastAct.created_at)) : 999;
      const company = (c as any).companies;
      const owner = (c as any).profiles;

      const hasOverdue = tasks.some((t: any) => t.status !== "done" && t.status !== "completed" && t.due_date && new Date(t.due_date) < now);
      const hasAktivForespørsel = foresps.some((f: any) => f.status === "Aktiv" || f.status === "Ny");
      const hasTidligereForespørsel = foresps.length > 0;
      const hasMarkedsradar = false;
      const taskStatus = getTaskStatus(tasks.map((t: any) => ({ due_date: t.due_date, status: t.status })));
      const activityStatus = getActivityStatus(daysSince);

      const heatResult = getHeatResult({
        signal: signal,
        isInnkjoper: c.call_list === true,
        hasMarkedsradar,
        hasAktivForespørsel,
        hasOverdue,
        daysSinceLastContact: daysSince,
        hasTidligereForespørsel,
        ikkeAktuellKontakt: c.ikke_aktuell_kontakt ?? false,
        ikkeRelevantSelskap: company?.ikke_relevant ?? false,
        taskStatus,
        activityStatus,
      });

      // Find next open task
      const openTasks = tasks.filter((t: any) => t.status !== "done" && t.status !== "completed");
      const nextTask = openTasks.find((t: any) => t.due_date) || openTasks[0] || null;

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
        activities: acts, tasks, nextTask,
        heatResult,
      };
    });
  }, [rawContacts, activitiesMap, tasksMap, foresporslerMap]);

  const toggleSort = useCallback((field: SortField) => {
    setSort((p) => p.field === field ? { field, dir: p.dir === "asc" ? "desc" : "asc" } : { field, dir: "asc" });
  }, []);

  const filtered = useMemo(() => {
    let list = contacts;
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
    // Temperature filter
    if (tempFilter !== "Alle") {
      const tempKey = tempFilter.toLowerCase() as HeatResult["temperature"];
      list = list.filter((c) => c.heatResult.temperature === tempKey);
    }
    return list;
  }, [contacts, search, ownerFilter, signalFilter, typeFilter, tempFilter]);

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
        case "heat": {
          const tierDiff = a.heatResult.tier - b.heatResult.tier;
          if (tierDiff !== 0) return d * tierDiff;
          return d * (b.heatResult.score - a.heatResult.score);
        }
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

  const hasActiveFilters = ownerFilter !== "Alle" || signalFilter !== "Alle" || typeFilter !== "Alle" || tempFilter !== "Alle";

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
        {/* Header bar */}
        <header className="flex items-center justify-between px-6 shrink-0" style={{ height: 48, borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-baseline gap-2.5">
            <h1 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Kontakter</h1>
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
          <FilterRow label="SIGNAL" options={["Alle", ...SIGNALS]} value={signalFilter} onChange={setSignalFilter} />
          <FilterRow label="TYPE" options={[...TYPES]} value={typeFilter} onChange={(v) => setTypeFilter(v as TypeFilter)} />
          <div className="flex items-center justify-between">
            <FilterRow label="VARME" options={[...TEMPERATURES]} value={tempFilter} onChange={(v) => setTempFilter(v as TempFilter)} />
            {hasActiveFilters && (
              <button
                onClick={() => { setOwnerFilter("Alle"); setSignalFilter("Alle"); setTypeFilter("Alle"); setTempFilter("Alle"); }}
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

        {/* Available consultants bar */}
        {sortedConsultants.length > 0 && (
          <div className="shrink-0" style={{ borderBottom: `1px solid ${C.border}`, padding: "8px 24px 10px" }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.textGhost, marginBottom: 6 }}>Tilgjengelig for oppdrag</p>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {sortedConsultants.map((con) => {
                const meta = getConsultantAvailabilityMeta(con.tilgjengelig_fra);
                const nameParts = con.navn.split(" ");
                const cInitials = (nameParts[0]?.[0] || "") + (nameParts[nameParts.length - 1]?.[0] || "");
                const toneColor = meta.tone === "ready" ? C.success : meta.tone === "soon" ? C.warning : C.textFaint;
                return (
                  <div key={con.id ?? con.navn} className="flex items-center gap-2.5 shrink-0 rounded-lg" style={{ border: `1px solid ${C.border}`, padding: "8px 14px", background: C.surface }}>
                    <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 36, height: 36, background: "rgba(40,37,29,0.08)", fontSize: 12, fontWeight: 600, color: C.text }}>{cInitials.toUpperCase()}</div>
                    <div className="min-w-0">
                      <p className="truncate" style={{ fontSize: 13, fontWeight: 500, color: C.text, maxWidth: 140 }}>{con.navn}</p>
                      <p style={{ fontSize: 12, color: toneColor, fontWeight: 500 }}>{meta.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Content: list + detail */}
        <div className="flex-1 min-h-0">
          {sel ? (
            <ResizablePanelGroup direction="horizontal" className="h-full">
              <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
                <div className="h-full overflow-y-auto">
                  {/* Table header — compact */}
                  <div
                    className="grid items-center sticky top-0 z-10"
                    style={{
                      gridTemplateColumns: "minmax(0,1fr) 100px 72px",
                      height: 32, borderBottom: `1px solid ${C.border}`,
                      background: C.bg, paddingLeft: 16, paddingRight: 16,
                    }}
                  >
                    <ColHeader label="Navn" field="name" sort={sort} onSort={toggleSort} />
                    <ColHeader label="Signal" field="signal" sort={sort} onSort={toggleSort} />
                    <ColHeader label="Varme" field="heat" sort={sort} onSort={toggleSort} className="justify-end" />
                  </div>
                  {isLoading ? (
                    <LoadingMsg />
                  ) : sorted.length === 0 ? (
                    <EmptyMsg />
                  ) : (
                    sorted.map((c) => (
                      <CompactRow key={c.id} c={c} isActive={selectedId === c.id} onClick={() => setSelectedId(selectedId === c.id ? null : c.id)} />
                    ))
                  )}
                </div>
              </ResizablePanel>
              <ResizableHandle
                withHandle
                className="bg-transparent hover:bg-[rgba(40,37,29,0.06)] transition-colors data-[resize-handle-active]:bg-[rgba(1,105,111,0.12)]"
              />
              <ResizablePanel defaultSize={70} minSize={40}>
                <DetailPanel contact={sel} onClose={() => setSelectedId(null)} onNavigate={() => navigate(`/kontakter/${sel.id}`)} />
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <div className="h-full overflow-y-auto">
              {/* Table header — full width */}
              <div
                className="grid items-center sticky top-0 z-10"
                style={{
                  gridTemplateColumns: "minmax(0,1fr) 120px 200px 180px 160px 80px 72px",
                  height: 32, borderBottom: `1px solid ${C.border}`,
                  background: C.bg, paddingLeft: 16, paddingRight: 16,
                }}
              >
                <ColHeader label="Navn" field="name" sort={sort} onSort={toggleSort} />
                <ColHeader label="Signal" field="signal" sort={sort} onSort={toggleSort} />
                <ColHeader label="Selskap" field="company" sort={sort} onSort={toggleSort} />
                <ColHeader label="Stilling" field="title" sort={sort} onSort={toggleSort} />
                <ColHeader label="Eier" field="owner" sort={sort} onSort={toggleSort} />
                <ColHeader label="Siste" field="last_activity" sort={sort} onSort={toggleSort} />
                <ColHeader label="Varme" field="heat" sort={sort} onSort={toggleSort} className="justify-end" />
              </div>
              {isLoading ? (
                <LoadingMsg />
              ) : sorted.length === 0 ? (
                <EmptyMsg />
              ) : (
                sorted.map((c) => (
                  <FullRow key={c.id} c={c} isActive={selectedId === c.id} onClick={() => setSelectedId(c.id)} />
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
   COMPACT ROW (with detail panel open)
   ═══════════════════════════════════════════════════════════ */

function CompactRow({ c, isActive, onClick }: { c: any; isActive: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="grid items-center cursor-pointer group"
      style={{
        gridTemplateColumns: "minmax(0,1fr) 100px 72px",
        minHeight: 44, paddingLeft: isActive ? 14 : 16, paddingRight: 16,
        paddingTop: 5, paddingBottom: 5,
        borderBottom: `1px solid ${C.borderLight}`,
        borderLeft: isActive ? `2px solid ${C.selectedBorder}` : "2px solid transparent",
        background: isActive ? C.activeBg : undefined,
        transition: "background 50ms, border-color 50ms",
      }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = C.hoverBg; }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = isActive ? C.activeBg : ""; }}
    >
      <div className="flex items-center gap-2.5 truncate pr-3">
        <Avatar first={c.firstName} last={c.lastName} size={28} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate" style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: C.text }}>{c.firstName} {c.lastName}</span>
            <ContactIndicators callList={c.callList} cvEmail={c.cvEmail} />
          </div>
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 12, color: C.textFaint, lineHeight: 1.2 }} className="truncate block">{c.company}</span>
            {c.daysSince < 999 && (
              <span style={{ fontSize: 11, color: C.textGhost }}>{relTime(c.daysSince)}</span>
            )}
          </div>
        </div>
      </div>
      <div className="pr-3"><SignalChip signal={c.signal} /></div>
      <div className="flex justify-end">
        <HeatBadge heat={c.heatResult} daysSince={c.daysSince} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FULL ROW (no detail panel)
   ═══════════════════════════════════════════════════════════ */

function FullRow({ c, isActive, onClick }: { c: any; isActive: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="grid items-center cursor-pointer group"
      style={{
        gridTemplateColumns: "minmax(0,1fr) 120px 200px 180px 160px 80px 72px",
        height: 40, paddingLeft: 16, paddingRight: 16,
        borderBottom: `1px solid ${C.borderLight}`,
        background: isActive ? C.activeBg : undefined,
        transition: "background 50ms",
      }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = C.hoverBg; }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = isActive ? C.activeBg : ""; }}
    >
      <div className="flex items-center gap-2.5 truncate pr-3">
        <Avatar first={c.firstName} last={c.lastName} size={26} />
        <span style={{ fontSize: 13, fontWeight: 500, color: C.text }} className="truncate">{c.firstName} {c.lastName}</span>
        <ContactIndicators callList={c.callList} cvEmail={c.cvEmail} />
      </div>
      <div className="pr-3"><SignalChip signal={c.signal} /></div>
      <div className="truncate pr-3"><span style={{ fontSize: 13, color: C.textMuted }}>{c.company}</span></div>
      <div className="truncate pr-3"><span style={{ fontSize: 13, color: C.textMuted }}>{c.title}</span></div>
      <div className="truncate pr-3"><span style={{ fontSize: 12, color: C.textFaint }}>{c.eier}</span></div>
      <div><span style={{ fontSize: 12, color: C.textFaint }}>{c.daysSince < 999 ? relTime(c.daysSince) : "—"}</span></div>
      <div className="flex justify-end">
        <HeatBadge heat={c.heatResult} daysSince={c.daysSince} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DETAIL PANEL — "Decision Panel"
   ═══════════════════════════════════════════════════════════ */

function DetailPanel({ contact: sel, onClose, onNavigate }: { contact: any; onClose: () => void; onNavigate: () => void }) {
  const heatConfig = HEAT_COLORS[sel.heatResult.temperature];

  // Next task
  const nextTask = sel.nextTask;
  const nextDue = nextTask?.due_date ? new Date(nextTask.due_date) : null;
  const isOverdue = nextDue ? isBefore(nextDue, new Date()) && !isToday(nextDue) : false;
  const isDueToday = nextDue ? isToday(nextDue) : false;

  // Group activities by month
  const activityGroups = useMemo(() => {
    const groups: { label: string; items: any[] }[] = [];
    const acts = sel.activities || [];
    let currentLabel = "";
    for (const act of acts) {
      const d = new Date(act.created_at);
      const label = format(d, "MMMM yyyy", { locale: nb });
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, items: [] });
      }
      groups[groups.length - 1].items.push(act);
    }
    return groups;
  }, [sel.activities]);

  const openTasks = (sel.tasks || []).filter((t: any) => t.status !== "done" && t.status !== "completed");

  return (
    <div className="h-full flex flex-col" style={{ background: C.surface }}>
      {/* ── Header ── */}
      <div className="shrink-0 px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <Avatar first={sel.firstName} last={sel.lastName} size={40} />
            <div className="min-w-0 flex-1">
              <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, lineHeight: 1.2, marginBottom: 2 }}>{sel.firstName} {sel.lastName}</h2>
              <p style={{ fontSize: 13, color: C.textMuted }}>
                {[sel.company, sel.title, sel.location].filter(Boolean).join(" · ")}
              </p>
              {/* Tags row */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <SignalChip signal={sel.signal} size="md" />
                {sel.callList && (
                  <span className="inline-flex items-center rounded-full" style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", background: "rgba(1,105,111,0.06)", color: C.accent }}>Innkjøper</span>
                )}
                {sel.cvEmail && (
                  <span className="inline-flex items-center rounded-full" style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", background: "rgba(59,111,160,0.06)", color: "#3B6FA0" }}>CV</span>
                )}
                {sel.heatResult.needsReview && (
                  <span className="inline-flex items-center rounded-full" style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", background: C.warningBg, color: C.warning }}>⚠ Trenger review</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0 ml-4">
            <IconBtn icon={<ArrowUpRight style={{ width: 15, height: 15 }} />} title="Åpne i CRM" onClick={onNavigate} />
            <IconBtn icon={<X style={{ width: 15, height: 15 }} />} title="Lukk" onClick={onClose} />
          </div>
        </div>
      </div>

      {/* ── Body: Left meta + Right content ── */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT META COLUMN */}
        <div className="shrink-0 overflow-y-auto" style={{ width: 180, borderRight: `1px solid ${C.border}`, padding: "16px 16px" }}>
          {/* Contact info */}
          <MetaSection label="KONTAKT">
            {sel.email && (
              <a href={`mailto:${sel.email}`} style={{ fontSize: 12, color: C.accent, textDecoration: "none", wordBreak: "break-all", display: "block", marginBottom: 2 }}>{sel.email}</a>
            )}
            {sel.phone && (
              <a href={`tel:${sel.phone}`} style={{ fontSize: 12, color: C.accent, textDecoration: "none", display: "block", marginBottom: 2 }}>{sel.phone}</a>
            )}
            {sel.linkedin && (
              <a href={sel.linkedin} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.accent, textDecoration: "none", display: "block" }}>LinkedIn ↗</a>
            )}
          </MetaSection>

          {/* Behov selector */}
          <MetaSection label="BEHOV">
            <div className="space-y-1">
              {BEHOV_OPTIONS.map((opt) => {
                const isSelected = sel.signal === opt.signal;
                const colors = SIGNAL_COLORS[opt.signal];
                return (
                  <div
                    key={opt.signal}
                    className="flex items-center gap-2 rounded-full cursor-default"
                    style={{
                      padding: "3px 10px",
                      fontSize: 12, fontWeight: isSelected ? 600 : 400,
                      background: isSelected ? colors.bg : "transparent",
                      color: isSelected ? colors.color : C.textFaint,
                      border: isSelected ? "none" : `1px solid transparent`,
                    }}
                  >
                    <span className="rounded-full" style={{ width: 6, height: 6, background: isSelected ? colors.color : C.textGhost, flexShrink: 0 }} />
                    {opt.short}
                  </div>
                );
              })}
            </div>
          </MetaSection>

          {/* Next follow-up */}
          <MetaSection label="NESTE OPPFØLGING">
            {nextTask ? (
              <div>
                <p style={{
                  fontSize: 13, fontWeight: 600,
                  color: isOverdue ? C.danger : isDueToday ? C.warning : C.text,
                }}>
                  {nextDue ? format(nextDue, "d. MMM yyyy", { locale: nb }) : "Ingen dato"}
                </p>
                {nextDue && (
                  <p style={{ fontSize: 11, color: isOverdue ? C.danger : C.textFaint, marginTop: 1 }}>
                    {isOverdue ? "Forfalt" : isDueToday ? "I dag" : formatDistanceToNow(nextDue, { locale: nb, addSuffix: true })}
                  </p>
                )}
                <p className="truncate" style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>{cleanSubject(nextTask.title)}</p>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: C.textGhost }}>Ingen planlagt</p>
            )}
          </MetaSection>

          {/* Heat score */}
          <MetaSection label="HEAT SCORE">
            <p style={{ fontSize: 24, fontWeight: 700, color: heatConfig.color, lineHeight: 1 }}>
              {sel.heatResult.score}
            </p>
            <span className="inline-flex items-center rounded-full mt-1" style={{ fontSize: 11, fontWeight: 500, padding: "1px 7px", background: heatConfig.bg, color: heatConfig.color }}>
              {heatConfig.label}
            </span>
            {sel.heatResult.reasons.length > 0 && (
              <p style={{ fontSize: 11, color: C.textFaint, marginTop: 4, lineHeight: 1.4 }}>
                {sel.heatResult.reasons.join(" · ")}
              </p>
            )}
          </MetaSection>

          {/* Toggles */}
          <MetaSection label="EGENSKAPER">
            <TogglePill label="Innkjøper" active={sel.callList} />
            <TogglePill label="CV-Epost" active={sel.cvEmail} />
            {sel.ikkeAktuell && <TogglePill label="Ikke aktuell" active danger />}
          </MetaSection>

          {sel.eier && (
            <MetaSection label="EIER">
              <p style={{ fontSize: 12, color: C.textMuted }}>{sel.eier}</p>
            </MetaSection>
          )}
        </div>

        {/* RIGHT CONTENT — scrollable */}
        <div className="flex-1 min-w-0 overflow-y-auto" style={{ padding: "16px 24px" }}>
          {/* Next Action Box */}
          <div className="rounded-lg mb-5" style={{ border: `1px solid ${C.border}`, padding: "14px 16px", background: C.bg }}>
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.textMuted }}>Neste handling</span>
            </div>
            {nextTask ? (
              <div className="flex items-start gap-3 mb-3">
                <div className="rounded-full shrink-0 flex items-center justify-center" style={{ width: 28, height: 28, background: isOverdue ? C.dangerBg : isDueToday ? C.warningBg : C.accentBg }}>
                  <Clock style={{ width: 14, height: 14, color: isOverdue ? C.danger : isDueToday ? C.warning : C.accent }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{cleanSubject(nextTask.title)}</p>
                  <p style={{ fontSize: 12, color: isOverdue ? C.danger : isDueToday ? C.warning : C.textFaint }}>
                    {nextDue ? format(nextDue, "d. MMM yyyy", { locale: nb }) : "Ingen frist"}{" "}
                    {nextDue && (isOverdue ? "· Forfalt" : isDueToday ? "· I dag" : "")}
                  </p>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: C.textFaint, marginBottom: 12 }}>Ingen planlagt oppfølging</p>
            )}
            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center gap-1.5 rounded-md transition-opacity hover:opacity-90"
                style={{ height: 30, paddingInline: 12, fontSize: 13, fontWeight: 500, background: C.accent, color: "#fff", borderRadius: 6 }}
              >
                <MessageCircle style={{ width: 13, height: 13 }} />
                Logg aktivitet
              </button>
              <button
                className="inline-flex items-center gap-1.5 rounded-md transition-colors"
                style={{ height: 30, paddingInline: 12, fontSize: 13, fontWeight: 500, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, borderRadius: 6 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <Clock style={{ width: 13, height: 13, color: C.warning }} />
                Ny oppfølging
              </button>
            </div>
          </div>

          {/* Open tasks */}
          {openTasks.length > 0 && (
            <div className="mb-5">
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.textMuted, marginBottom: 8 }}>
                Oppfølginger · {openTasks.length}
              </p>
              <div className="space-y-1">
                {openTasks.map((t: any) => {
                  const due = t.due_date ? new Date(t.due_date) : null;
                  const overdue = due ? isBefore(due, new Date()) && !isToday(due) : false;
                  const today = due ? isToday(due) : false;
                  return (
                    <div key={t.id} className="flex items-center gap-2 py-1.5 px-2 rounded" style={{ fontSize: 13 }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverBg; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <Clock style={{ width: 12, height: 12, color: overdue ? C.danger : today ? C.warning : C.textFaint, flexShrink: 0 }} />
                      <span className="truncate flex-1" style={{ fontWeight: 500, color: C.text }}>{cleanSubject(t.title)}</span>
                      {due && (
                        <span style={{ fontSize: 12, color: overdue ? C.danger : today ? C.warning : C.textFaint, flexShrink: 0 }}>
                          {format(due, "d. MMM", { locale: nb })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Activity feed */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.textMuted, marginBottom: 8 }}>
              Aktiviteter · {sel.activities?.length || 0}
            </p>
            {activityGroups.length === 0 ? (
              <p style={{ fontSize: 13, color: C.textGhost }}>Ingen aktiviteter registrert</p>
            ) : (
              activityGroups.map((group) => (
                <div key={group.label} className="mb-4">
                  {/* Month header */}
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: C.textFaint, whiteSpace: "nowrap" }}>
                      {group.label}
                    </span>
                    <div className="flex-1 h-px" style={{ background: C.border }} />
                  </div>
                  {group.items.map((act: any) => {
                    const isCall = act.type === "call" || act.subject?.toLowerCase().includes("samtale");
                    const isMeeting = act.type === "meeting" || act.subject?.toLowerCase().includes("møte");
                    const dotColor = isCall ? C.success : isMeeting ? "#3B6FA0" : C.warning;
                    const cleaned = cleanDescription(act.description);
                    const ownerName = (act as any).profiles?.full_name || "";
                    return (
                      <div key={act.id} className="flex gap-3 py-2" style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                        <div className="shrink-0 mt-1.5">
                          <span className="block rounded-full" style={{ width: 8, height: 8, background: dotColor }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>
                            {cleanSubject(act.subject)}
                          </p>
                          {cleaned && (
                            <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.4, marginTop: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {cleaned}
                            </p>
                          )}
                          <p style={{ fontSize: 11, color: C.textGhost, marginTop: 3 }}>
                            {ownerName}{ownerName ? " · " : ""}{format(new Date(act.created_at), "d. MMM yyyy", { locale: nb })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SHARED SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function Avatar({ first, last, size = 28 }: { first: string; last: string; size?: number }) {
  const ini = getInitials(first, last);
  return (
    <div
      className="flex items-center justify-center rounded-full shrink-0"
      style={{ width: size, height: size, background: "rgba(40,37,29,0.08)", color: C.text, fontSize: size * 0.38, fontWeight: 600 }}
    >
      {ini}
    </div>
  );
}

function MetaSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textGhost, marginBottom: 6 }}>{label}</p>
      {children}
    </div>
  );
}

function TogglePill({ label, active, danger }: { label: string; active: boolean; danger?: boolean }) {
  const bg = active ? (danger ? C.dangerBg : C.accentBg) : "transparent";
  const color = active ? (danger ? C.danger : C.accent) : C.textGhost;
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full mb-1 mr-1" style={{ padding: "2px 8px", fontSize: 11, fontWeight: 500, background: bg, color, border: active ? "none" : `1px solid ${C.border}` }}>
      <span className="rounded-full" style={{ width: 5, height: 5, background: color }} />
      {label}
    </div>
  );
}

function SignalChip({ signal, size = "sm" }: { signal: Signal; size?: "sm" | "md" }) {
  const colors = SIGNAL_COLORS[signal];
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
        background: colors.bg,
        color: colors.color,
      }}
    >
      {size === "sm" ? shortLabels[signal] : signal}
    </span>
  );
}

function HeatBadge({ heat, daysSince, showScore }: { heat: HeatResult; daysSince: number; showScore?: boolean }) {
  const config = HEAT_COLORS[heat.temperature];
  const tooltip = `${config.label} (${heat.score}p) · Siste: ${daysSince < 999 ? relTime(daysSince) : "aldri"}`;
  return (
    <span
      className="inline-flex items-center rounded-full"
      title={tooltip}
      style={{ fontSize: 11, fontWeight: 500, padding: "1px 7px", whiteSpace: "nowrap", background: config.bg, color: config.color }}
    >
      {config.label}
      {showScore && <span style={{ marginLeft: 4, opacity: 0.7 }}>{heat.score}</span>}
    </span>
  );
}

function ContactIndicators({ callList, cvEmail }: { callList: boolean; cvEmail: boolean }) {
  if (!callList && !cvEmail) return null;
  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      {callList && <span title="Innkjøper" className="rounded-full inline-block" style={{ width: 6, height: 6, background: C.accent }} />}
      {cvEmail && <span title="CV-epost" className="rounded-full inline-block" style={{ width: 6, height: 6, background: "#3B6FA0" }} />}
    </span>
  );
}

function LoadingMsg() {
  return <div style={{ textAlign: "center", padding: "48px 0", color: C.textFaint, fontSize: 13 }}>Laster kontakter…</div>;
}

function EmptyMsg() {
  return <div style={{ textAlign: "center", padding: "48px 0", color: C.textFaint, fontSize: 13 }}>Ingen kontakter funnet</div>;
}

function NavGroup({ items, navigate }: { items: typeof NAV_MAIN; navigate: (p: string) => void }) {
  return (
    <div className="space-y-px">
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => navigate(item.href)}
          className="flex items-center gap-2 w-full rounded-md px-2 py-[6px] transition-colors"
          style={{ fontSize: 13, fontWeight: item.active ? 600 : 500, color: item.active ? C.text : C.textMuted, background: item.active ? "rgba(40,37,29,0.06)" : "transparent" }}
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
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-[3px]">
      <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.textMuted, width: 56, flexShrink: 0 }}>{label}</span>
      <div className="flex items-center gap-1 flex-wrap">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              onClick={() => onChange(opt)}
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
      style={{ fontSize: 11, fontWeight: active ? 700 : 600, textTransform: "uppercase", letterSpacing: "0.06em", color: active ? C.text : C.textMuted }}
    >
      {label}
      {active && (sort.dir === "asc" ? <ChevronUp style={{ width: 12, height: 12 }} /> : <ChevronDown style={{ width: 12, height: 12 }} />)}
    </button>
  );
}
