import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

import {
  Search,
  ChevronDown,
  ChevronUp,
  Users,
  X,
  ArrowUpRight,
} from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { nb } from "date-fns/locale";
import { getEffectiveSignal, normalizeCategoryLabel } from "@/lib/categoryUtils";
import { toast } from "sonner";
import { getConsultantAvailabilityMeta, sortHuntConsultants } from "@/lib/contactHunt";
import { useAuth } from "@/hooks/useAuth";
import { ContactCardContent } from "@/components/ContactCardContent";
import { TextSizeControl, SCALE_MAP, type TextSize } from "@/components/designlab/TextSizeControl";
import { C, SIGNAL_COLORS, HEAT_COLORS } from "@/components/designlab/theme";
import { CommandPalette } from "@/components/designlab/CommandPalette";
import { usePersistentState } from "@/hooks/usePersistentState";
import { getHeatResult, getTaskStatus, getActivityStatus, type HeatResult } from "@/lib/heatScore";
import { DesignLabSidebar } from "@/components/designlab/DesignLabSidebar";

/* ═══════════════════════════════════════════════════════════
   TYPES & CONSTANTS
   ═══════════════════════════════════════════════════════════ */

type Signal = "Behov nå" | "Får fremtidig behov" | "Får kanskje behov" | "Ukjent om behov" | "Ikke aktuelt";

const SIGNAL_ORDER: Record<Signal, number> = {
  "Behov nå": 0,
  "Får fremtidig behov": 1,
  "Får kanskje behov": 2,
  "Ukjent om behov": 3,
  "Ikke aktuelt": 4,
};

const SIGNALS: Signal[] = ["Behov nå", "Får fremtidig behov", "Får kanskje behov", "Ukjent om behov", "Ikke aktuelt"];
const OWNERS = ["Alle", "Jon Richard Nygaard", "Thomas Eriksen", "Uten eier"];
const TYPES = ["Alle", "Innkjøper", "CV-Epost", "Ikke relevant kontakt"] as const;
type TypeFilter = (typeof TYPES)[number];

type SortField = "name" | "signal" | "company" | "title" | "owner" | "last_activity" | "heat";
type SortDir = "asc" | "desc";

/* Colors, signal colors, and heat colors imported from @/components/designlab/theme */

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
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "heat", dir: "asc" });
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("contact"));
  const searchRef = useRef<HTMLInputElement>(null);
  const [cmdOpen, setCmdOpen] = useState(false);


  // ⌘K shortcut → open command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(true);
      }
      if (e.key === "Escape" && !cmdOpen) {
        setSelectedId(null);
        searchRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [cmdOpen]);

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
        .select(
          "id, first_name, last_name, title, email, phone, cv_email, call_list, ikke_aktuell_kontakt, teknologier, company_id, location, linkedin, department, notes, locations, companies(id, name, ikke_relevant), profiles:owner_id(id, full_name)",
        )
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
      data.forEach((a) => {
        if (a.contact_id) {
          (map[a.contact_id] ??= []).push(a);
        }
      });
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
        .select(
          "id, contact_id, title, description, due_date, status, priority, created_at, assigned_to, profiles:assigned_to(full_name), companies:company_id(name)",
        )
        .in("contact_id", contactIds)
        .order("due_date", { ascending: true });
      if (error) throw error;
      const map: Record<string, typeof data> = {};
      data.forEach((t) => {
        if (t.contact_id) {
          (map[t.contact_id] ??= []).push(t);
        }
      });
      return map;
    },
    enabled: contactIds.length > 0,
  });

  // ── Forespørsler for heat score ──
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
      data.forEach((f) => {
        if (f.kontakt_id) {
          (map[f.kontakt_id] ??= []).push(f);
        }
      });
      return map;
    },
    enabled: contactIds.length > 0,
  });

  // ── Company tech profiles for FINN column ──
  const companyIds = useMemo(() => {
    const ids = new Set<string>();
    rawContacts.forEach((c) => {
      if ((c as any).company_id) ids.add((c as any).company_id);
    });
    return Array.from(ids);
  }, [rawContacts]);

  const { data: techProfileMap = {} } = useQuery({
    queryKey: ["dl-tech-profiles-v8", companyIds.length],
    queryFn: async () => {
      if (!companyIds.length) return {};
      const { data, error } = await supabase
        .from("company_tech_profile")
        .select("company_id, sist_fra_finn")
        .in("company_id", companyIds);
      if (error) throw error;
      const map: Record<string, string | null> = {};
      data.forEach((p) => {
        if (p.company_id) map[p.company_id] = p.sist_fra_finn;
      });
      return map;
    },
    enabled: companyIds.length > 0,
  });

  // ── Consultants available ──
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
    {
      id: 1,
      navn: "Tom Erik Lundesgaard",
      tilgjengelig_fra: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 10);
        return d.toISOString().slice(0, 10);
      })(),
    },
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
      const signal = effectiveSignal ? mapToSignal(effectiveSignal) : ("Ukjent om behov" as Signal);
      const lastAct = acts[0] || null;
      const daysSince = lastAct ? differenceInDays(now, new Date(lastAct.created_at)) : 999;
      const company = (c as any).companies;
      const owner = (c as any).profiles;

      const hasOverdue = tasks.some(
        (t: any) => t.status !== "done" && t.status !== "completed" && t.due_date && new Date(t.due_date) < now,
      );
      const hasAktivForespørsel = foresps.some((f: any) => f.status === "Aktiv" || f.status === "Ny");
      const hasTidligereForespørsel = foresps.length > 0;
      const sistFraFinn = (techProfileMap as any)[(c as any).company_id || ""] || null;
      const hasMarkedsradar = !!(sistFraFinn && differenceInDays(now, new Date(sistFraFinn)) <= 90);
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

      return {
        id: c.id,
        firstName: c.first_name,
        lastName: c.last_name,
        title: c.title || "",
        email: c.email || "",
        phone: c.phone || "",
        linkedin: c.linkedin || "",
        location: c.location || "",
        locations: c.locations || [],
        department: c.department || "",
        notes: c.notes || "",
        company: company?.name || "",
        companyId: company?.id || null,
        signal,
        eier: owner?.full_name || "",
        eierId: owner?.id || null,
        cvEmail: c.cv_email,
        callList: c.call_list,
        ikkeAktuell: c.ikke_aktuell_kontakt ?? false,
        teknologier: c.teknologier || [],
        daysSince,
        lastActivitySubject: lastAct?.subject || "",
        activities: acts,
        tasks,
        heatResult,
        hasMarkedsradar,
      };
    });
  }, [rawContacts, activitiesMap, tasksMap, foresporslerMap, techProfileMap]);

  const toggleSort = useCallback((field: SortField) => {
    setSort((p) => (p.field === field ? { field, dir: p.dir === "asc" ? "desc" : "asc" } : { field, dir: "asc" }));
  }, []);

  const filtered = useMemo(() => {
    let list = contacts;
    // Default: hide ikke-relevante unless explicitly filtering for them
    if (typeFilter !== "Ikke relevant kontakt") {
      list = list.filter((c) => !c.ikkeAktuell);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
          c.company.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q),
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
        case "name":
          return d * `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "nb");
        case "signal":
          return d * (SIGNAL_ORDER[a.signal] - SIGNAL_ORDER[b.signal]);
        case "company":
          return d * a.company.localeCompare(b.company, "nb");
        case "title":
          return d * a.title.localeCompare(b.title, "nb");
        case "owner":
          return d * a.eier.localeCompare(b.eier, "nb");
        case "last_activity":
          return d * (a.daysSince - b.daysSince);
        case "heat": {
          // Primary: tier ASC (lower = hotter), Secondary: score DESC (higher = better)
          const tierDiff = a.heatResult.tier - b.heatResult.tier;
          if (tierDiff !== 0) return d * tierDiff;
          return d * (b.heatResult.score - a.heatResult.score);
        }
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sort]);

  const sel = selectedId ? (contacts.find((c) => c.id === selectedId) ?? null) : null;

  // Derived companies for command palette
  const companiesList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    contacts.forEach((c) => {
      if (c.companyId && c.company) {
        const existing = map.get(c.companyId);
        if (existing) existing.count++;
        else map.set(c.companyId, { id: c.companyId, name: c.company, count: 1 });
      }
    });
    return Array.from(map.values()).map((c) => ({ id: c.id, name: c.name, contactCount: c.count }));
  }, [contacts]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!sorted.length) return;
        e.preventDefault();
        const idx = sorted.findIndex((c) => c.id === selectedId);
        const next = e.key === "ArrowDown" ? Math.min(idx + 1, sorted.length - 1) : Math.max(idx - 1, 0);
        setSelectedId(sorted[next].id);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [sorted, selectedId]);

  /* ═══ RENDER ═══ */
  return (
    <div
      className="flex h-screen overflow-hidden select-none"
      style={{
        fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
        background: C.bg,
        zoom: SCALE_MAP[textSize],
      }}
    >
      <DesignLabSidebar navigate={navigate} signOut={signOut} user={user} activePath="/design-lab/kontakter" />

      {/* ═══ MAIN ═══ */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: C.appBg }}>
        {/* Header bar */}
        <header
          className="flex items-center justify-between px-6 shrink-0"
          style={{ height: 40, borderBottom: `1px solid ${C.border}` }}
        >
          <div className="flex items-baseline gap-2.5">
            <h1 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Kontakter</h1>
            <span style={{ fontSize: 13, color: C.textGhost, fontWeight: 500 }}>{filtered.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <TextSizeControl value={textSize} onChange={setTextSize} />
            <div className="relative" style={{ width: 220 }}>
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2"
                style={{ width: 14, height: 14, color: C.textGhost }}
              />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Søk kontakter…"
                className="w-full outline-none placeholder:text-[#a2a5ab]"
                style={{
                  height: 30,
                  paddingLeft: 30,
                  paddingRight: 9,
                  borderRadius: 5,
                  border: `1px solid ${C.border}`,
                  background: C.surfaceAlt,
                  color: C.text,
                  fontSize: 13,
                }}
              />
            </div>
            <button
              className="inline-flex items-center gap-1.5 rounded-md transition-opacity hover:opacity-90"
              style={{
                height: 30,
                paddingInline: 11,
                fontSize: 13,
                fontWeight: 500,
                background: C.accent,
                color: "#fff",
                borderRadius: 5,
              }}
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
            <span style={{ fontSize: 12, color: C.textFaint, fontWeight: 500, whiteSpace: "nowrap", paddingLeft: 12 }}>
              {filtered.length} kontakter
            </span>
          </div>
          <div className="flex items-center justify-between">
            <FilterRow
              label="TYPE"
              options={[...TYPES]}
              value={typeFilter}
              onChange={(v) => setTypeFilter(v as TypeFilter)}
            />
            {(ownerFilter !== "Alle" || signalFilter !== "Alle" || typeFilter !== "Alle") && (
              <button
                onClick={() => {
                  setOwnerFilter("Alle");
                  setSignalFilter("Alle");
                  setTypeFilter("Alle");
                }}
                className="inline-flex items-center gap-1 rounded transition-colors shrink-0"
                style={{ fontSize: 12, color: C.textFaint, padding: "2px 6px" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = C.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = C.textFaint;
                }}
              >
                <X style={{ width: 12, height: 12 }} /> Nullstill
              </button>
            )}
          </div>
        </div>

        {/* Available consultants bar */}
        {sortedConsultants.length > 0 && (
          <div className="shrink-0" style={{ borderBottom: `1px solid ${C.border}`, padding: "8px 24px 10px" }}>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: C.textGhost, marginBottom: 6 }}>
              Tilgjengelig for oppdrag
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {sortedConsultants.map((con) => {
                const meta = getConsultantAvailabilityMeta(con.tilgjengelig_fra);
                const nameParts = con.navn.split(" ");
                const initials = (nameParts[0]?.[0] || "") + (nameParts[nameParts.length - 1]?.[0] || "");
                const toneColor = meta.tone === "ready" ? C.dotSuccess : meta.tone === "soon" ? C.warning : C.textFaint;
                return (
                  <div
                    key={con.id ?? con.navn}
                    className="flex items-center gap-2.5 shrink-0 rounded-lg"
                    style={{ border: `1px solid ${C.border}`, padding: "8px 14px", background: C.panel }}
                  >
                    <div
                      className="flex items-center justify-center rounded-full shrink-0"
                      style={{
                        width: 36,
                        height: 36,
                        background: "rgba(0,0,0,0.06)",
                        fontSize: 12,
                        fontWeight: 600,
                        color: C.text,
                      }}
                    >
                      {initials.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate" style={{ fontSize: 13, fontWeight: 500, color: C.text, maxWidth: 140 }}>
                        {con.navn}
                      </p>
                      <p style={{ fontSize: 12, color: toneColor, fontWeight: 500 }}>{meta.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Content: list + detail */}
        <div className="flex-1 min-h-0 flex">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={35} minSize={20} maxSize={60}>
              <div className="h-full overflow-y-auto" style={{ scrollbarColor: `${C.borderStrong} ${C.surfaceAlt}` }}>
                <div
                  className="grid items-center sticky top-0 z-10"
                  style={{
                    gridTemplateColumns: "minmax(180px,2fr) minmax(120px,1fr) 130px 120px 90px 80px",
                    height: 32,
                    borderBottom: `1px solid ${C.border}`,
                    background: C.surfaceAlt,
                    paddingLeft: 16,
                    paddingRight: 16,
                  }}
                >
                  <ColHeader label="Kontakt" field="name" sort={sort} onSort={toggleSort} />
                  <ColHeader label="Selskap" field="company" sort={sort} onSort={toggleSort} />
                  <ColHeader label="Signal" field="signal" sort={sort} onSort={toggleSort} />
                  <ColHeader label="Stilling" field="title" sort={sort} onSort={toggleSort} />
                  <ColHeader label="Siste akt." field="last_activity" sort={sort} onSort={toggleSort} />
                  <ColHeader label="Varme" field="heat" sort={sort} onSort={toggleSort} className="justify-end" />
                </div>
                {isLoading ? (
                  <div style={{ textAlign: "center", padding: "48px 0", color: C.textFaint, fontSize: 13 }}>
                    Laster kontakter…
                  </div>
                ) : sorted.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "48px 0", color: C.textFaint, fontSize: 13 }}>
                    Ingen kontakter funnet
                  </div>
                ) : (
                  sorted.map((c) => {
                    const isActive = selectedId === c.id;
                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedId(isActive ? null : c.id)}
                        className="grid items-center cursor-pointer group"
                        style={{
                          gridTemplateColumns: "minmax(180px,2fr) minmax(120px,1fr) 130px 120px 90px 80px",
                          minHeight: 34,
                          paddingLeft: 16,
                          paddingRight: 16,
                          borderBottom: `1px solid ${C.borderLight}`,
                          background: isActive ? C.activeBg : "transparent",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.background = C.hoverBg;
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) e.currentTarget.style.background = isActive ? C.activeBg : "transparent";
                        }}
                      >
                        {/* Kontakt */}
                        <div className="min-w-0 flex items-center gap-2">
                          <span className="truncate" style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                            {c.firstName} {c.lastName}
                          </span>
                        </div>

                        {/* Selskap */}
                        <div className="min-w-0">
                          <span className="truncate" style={{ fontSize: 12, color: C.textMuted }}>{c.company}</span>
                        </div>

                        {/* Signal */}
                        <div className="flex items-center gap-1.5">
                          <SignalChip signal={c.signal} />
                        </div>

                        {/* Stilling */}
                        <span className="truncate" style={{ fontSize: 12, color: C.textMuted }}>{c.title}</span>

                        {/* Siste akt. */}
                        <span style={{ fontSize: 12, color: C.textFaint }}>
                          {c.daysSince < 999 ? relTime(c.daysSince) : ""}
                        </span>

                        {/* Varme */}
                        <div className="flex items-center justify-end">
                          <HeatBadge heat={c.heatResult} daysSince={c.daysSince} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ResizablePanel>
            <ResizableHandle
              withHandle
              className="bg-transparent hover:bg-[rgba(0,0,0,0.04)] transition-colors data-[resize-handle-active]:bg-[rgba(94,106,210,0.12)]"
            />
            <ResizablePanel defaultSize={65} minSize={30}>
              {sel ? (
                <div
                  className="h-full flex flex-col"
                  style={{ background: C.panel, borderLeft: `1px solid ${C.borderLight}` }}
                >
                  <div
                    className="shrink-0 flex items-center justify-end px-4"
                    style={{ height: 32, borderBottom: `1px solid ${C.border}` }}
                  >
                    <button
                      onClick={() => setSelectedId(null)}
                      className="rounded p-1 hover:bg-black/5 transition-colors"
                      style={{ color: C.textFaint }}
                    >
                      <X style={{ width: 16, height: 16 }} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 py-5 dl-v8-theme">
                    <ContactCardContent
                      contactId={sel.id}
                      editable
                      defaultHidden={{
                        techDna: true,
                        notes: true,
                        consultantMatch: true,
                        linkedinIfEmpty: true,
                        locationsIfEmpty: true,
                      }}
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
            <ResizablePanel defaultSize={0} minSize={0} maxSize={40}>
              <div className="h-full" style={{ background: C.appBg }} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </main>

      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        contacts={contacts.map((c) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          company: c.company,
          companyId: c.companyId,
          email: c.email,
          phone: c.phone,
          signal: c.signal,
          daysSince: c.daysSince,
        }))}
        companies={companiesList}
        selectedContact={
          sel
            ? { id: sel.id, firstName: sel.firstName, lastName: sel.lastName, email: sel.email, signal: sel.signal }
            : null
        }
        onSelectContact={(id) => setSelectedId(id)}
        onFilterByCompany={(name) => setSearch(name)}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SIGNAL CHIP (V8 color-coded)
   ═══════════════════════════════════════════════════════════ */

function SignalChip({ signal, size = "sm" }: { signal: Signal; size?: "sm" | "md" }) {
  const shortLabels: Record<Signal, string> = {
    "Behov nå": "Behov nå",
    "Får fremtidig behov": "Fremtidig",
    "Får kanskje behov": "Kanskje",
    "Ukjent om behov": "Ukjent",
    "Ikke aktuelt": "Ikke aktuelt",
  };
  const modifier = signal === "Ikke aktuelt" ? " is-muted" : " is-signal";
  return <span className={`chip chip--action${modifier}`}>{size === "sm" ? shortLabels[signal] : signal}</span>;
}

/* ═══════════════════════════════════════════════════════════
   HEAT BADGE
   ═══════════════════════════════════════════════════════════ */

function HeatBadge({ heat, daysSince, showScore }: { heat: HeatResult; daysSince: number; showScore?: boolean }) {
  const config = HEAT_COLORS[heat.temperature];
  const tooltip = `${config.label} (${heat.score}p) · Siste: ${daysSince < 999 ? relTime(daysSince) : "aldri"}`;
  return (
    <span
      className="inline-flex items-center rounded"
      title={tooltip}
      style={{
        fontSize: 11,
        fontWeight: 500,
        padding: "2px 6px",
        whiteSpace: "nowrap",
        background: config.bg,
        color: config.color,
      }}
    >
      {config.label}
      {showScore && <span style={{ marginLeft: 4, opacity: 0.7 }}>{heat.score}</span>}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   CONTACT INDICATORS (Innkjøper / CV dots)
   ═══════════════════════════════════════════════════════════ */

function ContactIndicators({ callList, cvEmail }: { callList: boolean; cvEmail: boolean }) {
  if (!callList && !cvEmail) return null;
  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      {callList && (
        <span
          title="Innkjøper"
          className="rounded-full inline-block"
          style={{ width: 6, height: 6, background: C.toggleBuyer.activeText }}
        />
      )}
      {cvEmail && (
        <span
          title="CV-epost"
          className="rounded-full inline-block"
          style={{ width: 6, height: 6, background: C.toggleCv.activeText }}
        />
      )}
    </span>
  );
}



function IconBtn({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center rounded transition-colors"
      style={{ width: 28, height: 28, color: C.textFaint }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = C.hoverBg;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {icon}
    </button>
  );
}

const TYPE_TOGGLE_MAP: Record<string, { activeBg: string; activeText: string }> = {
  "CV-Epost":              C.toggleCv,
  "Innkjøper":             C.toggleBuyer,
  "Ikke relevant kontakt": C.toggleIrrelevant,
};

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-[3px]">
      <span
        style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: C.textMuted, width: 56, flexShrink: 0 }}
      >
        {label}
      </span>
      <div className="flex items-center gap-1 flex-wrap">
        {options.map((opt) => {
          const active = value === opt;
          const toggle = label === "TYPE" ? TYPE_TOGGLE_MAP[opt] : undefined;

          // Active style: use toggle color if available, otherwise default accent
          const activeBg = toggle ? toggle.activeBg : C.accent;
          const activeColor = toggle ? toggle.activeText : "#fff";
          const inactiveBorder = `1px solid ${C.toggleInactive.border}`;

          return (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className="inline-flex items-center transition-colors"
              style={{
                height: 24,
                paddingInline: 10,
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 3,
                border: active ? (toggle ? `1px solid transparent` : "none") : inactiveBorder,
                background: active ? activeBg : C.toggleInactive.bg,
                color: active ? activeColor : C.toggleInactive.text,
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = C.hoverBg;
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = active ? activeBg : C.toggleInactive.bg;
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ColHeader({
  label,
  field,
  sort,
  onSort,
  className,
}: {
  label: string;
  field: SortField;
  sort: { field: SortField; dir: SortDir };
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const active = sort.field === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={`flex items-center gap-0.5 transition-colors ${className || ""}`}
      style={{
        fontSize: 11,
        fontWeight: active ? 600 : 500,
        letterSpacing: "0.01em",
        color: active ? C.text : C.textMuted,
      }}
    >
      {label}
      {active &&
        (sort.dir === "asc" ? (
          <ChevronUp style={{ width: 12, height: 12 }} />
        ) : (
          <ChevronDown style={{ width: 12, height: 12 }} />
        ))}
    </button>
  );
}
