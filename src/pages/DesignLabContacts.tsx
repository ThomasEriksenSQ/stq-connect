import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, ChevronDown, ChevronUp, Check, ArrowUpDown } from "lucide-react";
import { differenceInDays } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getEffectiveSignal,
  normalizeCategoryLabel,
  getSignalBadge,
} from "@/lib/categoryUtils";

/* ═══════════════════════════════════════════════════════════
   TYPES & CONSTANTS
   ═══════════════════════════════════════════════════════════ */

type Signal = "Behov nå" | "Får fremtidig behov" | "Får kanskje behov" | "Ukjent om behov" | "Ikke aktuelt";

const SIGNAL_BADGE: Record<Signal, string> = {
  "Behov nå": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Får fremtidig behov": "bg-blue-100 text-blue-800 border-blue-200",
  "Får kanskje behov": "bg-amber-100 text-amber-800 border-amber-200",
  "Ukjent om behov": "bg-gray-100 text-gray-600 border-gray-200",
  "Ikke aktuelt": "bg-red-50 text-red-700 border-red-200",
};

const SIGNAL_ORDER: Record<Signal, number> = {
  "Behov nå": 0, "Får fremtidig behov": 1, "Får kanskje behov": 2, "Ukjent om behov": 3, "Ikke aktuelt": 4,
};

const SIGNALS: Signal[] = ["Behov nå", "Får fremtidig behov", "Får kanskje behov", "Ukjent om behov", "Ikke aktuelt"];
const OWNERS = ["Alle", "Jon Richard Nygaard", "Thomas Eriksen"];

type SortField = "name" | "signal" | "company" | "title" | "last_activity";
type SortDir = "asc" | "desc";

function relTime(days: number): string {
  if (days === 0) return "I dag";
  if (days === 1) return "1d";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}u`;
  if (days < 365) return `${Math.floor(days / 30)} mnd`;
  return `${Math.floor(days / 365)}å`;
}

function mapToSignal(raw: string): Signal {
  const normalized = normalizeCategoryLabel(raw);
  if (Object.keys(SIGNAL_BADGE).includes(normalized)) return normalized as Signal;
  return "Ukjent om behov";
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */

export default function DesignLabContacts() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("Alle");
  const [signalFilter, setSignalFilter] = useState("Alle");
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "last_activity", dir: "asc" });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Fetch contacts with company + owner ──
  const { data: rawContacts = [], isLoading } = useQuery({
    queryKey: ["design-lab-contacts-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, title, email, phone, cv_email, call_list, ikke_aktuell_kontakt, teknologier, company_id, companies(id, name), profiles:owner_id(id, full_name)")
        .eq("ikke_aktuell_kontakt", false)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  // ── Fetch latest activity per contact for signal + recency ──
  const contactIds = useMemo(() => rawContacts.map((c) => c.id), [rawContacts]);

  const { data: activitiesMap = {} } = useQuery({
    queryKey: ["design-lab-contacts-activities", contactIds.length],
    queryFn: async () => {
      if (contactIds.length === 0) return {};
      const { data, error } = await supabase
        .from("activities")
        .select("id, contact_id, subject, description, created_at")
        .in("contact_id", contactIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const map: Record<string, typeof data> = {};
      data.forEach((a) => {
        if (a.contact_id) {
          if (!map[a.contact_id]) map[a.contact_id] = [];
          map[a.contact_id].push(a);
        }
      });
      return map;
    },
    enabled: contactIds.length > 0,
  });

  const { data: tasksMap = {} } = useQuery({
    queryKey: ["design-lab-contacts-tasks", contactIds.length],
    queryFn: async () => {
      if (contactIds.length === 0) return {};
      const { data, error } = await supabase
        .from("tasks")
        .select("id, contact_id, title, description, due_date, status, created_at, updated_at")
        .in("contact_id", contactIds)
        .neq("status", "done");
      if (error) throw error;
      const map: Record<string, typeof data> = {};
      data.forEach((t) => {
        if (t.contact_id) {
          if (!map[t.contact_id]) map[t.contact_id] = [];
          map[t.contact_id].push(t);
        }
      });
      return map;
    },
    enabled: contactIds.length > 0,
  });

  // ── Build enriched contact list ──
  const contacts = useMemo(() => {
    const now = new Date();
    return rawContacts.map((c) => {
      const acts = (activitiesMap as any)[c.id] || [];
      const tasks = (tasksMap as any)[c.id] || [];
      const effectiveSignal = getEffectiveSignal(acts, tasks);
      const signal = effectiveSignal ? mapToSignal(effectiveSignal) : "Ukjent om behov" as Signal;

      const lastActivityDate = acts.length > 0 ? new Date(acts[0].created_at) : null;
      const daysSince = lastActivityDate ? differenceInDays(now, lastActivityDate) : 999;

      const company = (c as any).companies;
      const owner = (c as any).profiles;

      return {
        id: c.id,
        firstName: c.first_name,
        lastName: c.last_name,
        title: c.title || "",
        company: company?.name || "",
        companyId: company?.id || null,
        signal,
        eier: owner?.full_name || "Ikke tildelt",
        cvEmail: c.cv_email,
        callList: c.call_list,
        teknologier: c.teknologier || [],
        sisteAktivitetDager: daysSince,
      };
    });
  }, [rawContacts, activitiesMap, tasksMap]);

  const toggleSort = useCallback((field: SortField) => {
    setSort((prev) =>
      prev.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: "asc" }
    );
  }, []);

  const filtered = useMemo(() => {
    let list = contacts;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
          c.company.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q)
      );
    }
    if (ownerFilter !== "Alle") list = list.filter((c) => c.eier === ownerFilter);
    if (signalFilter !== "Alle") list = list.filter((c) => c.signal === signalFilter);
    return list;
  }, [contacts, search, ownerFilter, signalFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sort.dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sort.field) {
        case "name": return dir * `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "nb");
        case "signal": return dir * (SIGNAL_ORDER[a.signal] - SIGNAL_ORDER[b.signal]);
        case "company": return dir * a.company.localeCompare(b.company, "nb");
        case "title": return dir * a.title.localeCompare(b.title, "nb");
        case "last_activity": return dir * (a.sisteAktivitetDager - b.sisteAktivitetDager);
        default: return 0;
      }
    });
    return arr;
  }, [filtered, sort]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === sorted.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(sorted.map((c) => c.id)));
  };

  const allSelected = sorted.length > 0 && selectedIds.size === sorted.length;

  if (isLoading) {
    return <p className="text-muted-foreground text-center py-12">Laster kontakter…</p>;
  }

  return (
    <div style={{ fontFamily: "Inter, -apple-system, system-ui, sans-serif" }}>
      <div className="pt-2 pb-8 max-w-[1600px]">
        {/* Page header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-baseline gap-3">
            <h1 className="text-[20px] font-semibold text-foreground">Kontakter</h1>
            <span className="text-[13px] text-muted-foreground font-medium">{filtered.length}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <FilterPill label="Eier" value={ownerFilter} options={OWNERS} onChange={setOwnerFilter} />
          <FilterPill label="Signal" value={signalFilter} options={["Alle", ...SIGNALS]} onChange={setSignalFilter} />
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk kontakter…"
              className="h-8 pl-8 pr-3 rounded-md text-[13px] outline-none bg-background text-foreground w-64 border border-border focus:border-primary/30 transition-colors"
            />
          </div>
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[40px_minmax(0,1.8fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_90px] gap-0 items-center h-[36px] bg-muted/50 border-b border-border">
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="w-3.5 h-3.5 rounded cursor-pointer"
              />
            </div>
            <ColHeader label="Navn" field="name" sort={sort} onSort={toggleSort} className="px-3" />
            <ColHeader label="Signal" field="signal" sort={sort} onSort={toggleSort} className="px-3" />
            <ColHeader label="Selskap" field="company" sort={sort} onSort={toggleSort} className="px-3" />
            <ColHeader label="Stilling" field="title" sort={sort} onSort={toggleSort} className="px-3" />
            <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground px-3">Tags</span>
            <ColHeader label="Siste akt." field="last_activity" sort={sort} onSort={toggleSort} className="px-3 justify-end" />
          </div>

          {/* Rows */}
          <div>
            {sorted.map((contact) => (
              <div
                key={contact.id}
                onClick={() => navigate(`/design-lab/kontakter/${contact.id}`)}
                className="grid grid-cols-[40px_minmax(0,1.8fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_90px] gap-0 items-center h-[44px] border-b border-border/40 hover:bg-muted/30 transition-colors duration-75 cursor-pointer group"
              >
                {/* Checkbox */}
                <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(contact.id)}
                    onChange={() => toggleSelect(contact.id)}
                    className="w-3.5 h-3.5 rounded cursor-pointer"
                  />
                </div>

                {/* Navn */}
                <div className="px-3 truncate">
                  <span className="text-[13px] font-medium text-foreground">
                    {contact.firstName} {contact.lastName}
                  </span>
                </div>

                {/* Signal */}
                <div className="px-3">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${SIGNAL_BADGE[contact.signal]}`}>
                    {contact.signal}
                  </span>
                </div>

                {/* Selskap */}
                <div className="px-3 truncate">
                  <span className="text-[13px] text-muted-foreground">{contact.company}</span>
                </div>

                {/* Stilling */}
                <div className="px-3 truncate">
                  <span className="text-[13px] text-muted-foreground">{contact.title}</span>
                </div>

                {/* Tags */}
                <div className="px-3 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {contact.cvEmail && (
                    <span className="rounded-full bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 text-[11px] font-medium">
                      CV
                    </span>
                  )}
                  {contact.callList && (
                    <span className="rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 text-[11px] font-medium">
                      Innkjøper
                    </span>
                  )}
                </div>

                {/* Siste akt. */}
                <div className="px-3 text-right">
                  <span className="text-[13px] text-muted-foreground">
                    {contact.sisteAktivitetDager < 999 ? relTime(contact.sisteAktivitetDager) : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function FilterPill({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  const active = value !== "Alle";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-[12px] font-medium transition-colors border ${
            active
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-muted-foreground border-border hover:border-foreground/20"
          }`}
        >
          {active ? `${label}: ${value}` : label}
          <ChevronDown className="w-3 h-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px]">
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt}
            onClick={() => onChange(opt)}
            className="flex items-center justify-between"
          >
            <span className="text-[13px]">{opt}</span>
            {value === opt && <Check className="w-3.5 h-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
      className={`flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.06em] transition-colors ${
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
      } ${className || ""}`}
    >
      {label}
      {active && (sort.dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
    </button>
  );
}
