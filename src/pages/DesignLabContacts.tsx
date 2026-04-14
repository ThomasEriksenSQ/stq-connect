import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, ChevronDown, Check, ArrowUpDown, ChevronUp,
  Phone, Mail, Linkedin, Copy, Users, X,
} from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { nb } from "date-fns/locale";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getEffectiveSignal, normalizeCategoryLabel } from "@/lib/categoryUtils";
import { toast } from "sonner";

/* ═══════════════════════════════════════════════════════════
   DESIGN TOKENS — Linear-inspired warm palette
   ═══════════════════════════════════════════════════════════ */

const T = {
  bg: "#F7F6F2",
  surface: "#FFFFFF",
  text: "#28251D",
  muted: "#7A7974",
  faint: "#BAB9B4",
  teal: "#01696F",
  tealBg: "rgba(1,105,111,0.08)",
  border: "rgba(40,37,29,0.08)",
  hoverRow: "#F3F0EC",
  shadow: "0 1px 2px rgba(40,37,29,0.04)",
  chipNeutralBg: "rgba(40,37,29,0.06)",
  chipNeutralText: "#7A7974",
  chipDarkText: "#5A5954",
} as const;

/* ═══════════════════════════════════════════════════════════
   TYPES & CONSTANTS
   ═══════════════════════════════════════════════════════════ */

type Signal = "Behov nå" | "Får fremtidig behov" | "Får kanskje behov" | "Ukjent om behov" | "Ikke aktuelt";

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
  if (Object.keys(SIGNAL_ORDER).includes(normalized)) return normalized as Signal;
  return "Ukjent om behov";
}

function signalChipStyle(signal: Signal): React.CSSProperties {
  if (signal === "Behov nå") return { background: T.tealBg, color: T.teal, border: "none" };
  if (signal === "Ikke aktuelt") return { background: T.chipNeutralBg, color: T.chipDarkText, border: "none" };
  return { background: T.chipNeutralBg, color: T.chipNeutralText, border: "none" };
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */

export default function DesignLabContacts() {
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("Alle");
  const [signalFilter, setSignalFilter] = useState("Alle");
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "last_activity", dir: "asc" });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Fetch contacts ──
  const { data: rawContacts = [], isLoading } = useQuery({
    queryKey: ["design-lab-contacts-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, title, email, phone, cv_email, call_list, ikke_aktuell_kontakt, teknologier, company_id, location, linkedin, companies(id, name), profiles:owner_id(id, full_name)")
        .eq("ikke_aktuell_kontakt", false)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const contactIds = useMemo(() => rawContacts.map((c) => c.id), [rawContacts]);

  const { data: activitiesMap = {} } = useQuery({
    queryKey: ["design-lab-contacts-activities", contactIds.length],
    queryFn: async () => {
      if (contactIds.length === 0) return {};
      const { data, error } = await supabase
        .from("activities")
        .select("id, contact_id, subject, description, created_at, type")
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

  // ── Build enriched contacts ──
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
        email: c.email || "",
        phone: c.phone || "",
        linkedin: c.linkedin || "",
        location: c.location || "",
        company: company?.name || "",
        companyId: company?.id || null,
        signal,
        eier: owner?.full_name || "Ikke tildelt",
        cvEmail: c.cv_email,
        callList: c.call_list,
        teknologier: c.teknologier || [],
        sisteAktivitetDager: daysSince,
        activities: acts,
        tasks,
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

  const selectedContact = selectedId ? contacts.find((c) => c.id === selectedId) : null;

  return (
    <div style={{ fontFamily: "Inter, -apple-system, system-ui, sans-serif", background: T.bg, minHeight: "100vh" }}>
      <div className="pt-4 pb-8 px-6 max-w-[1800px] mx-auto">

        {/* ── Search bar (pill, centered) ── */}
        <div className="flex justify-center mb-6">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: T.faint }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk kontakter…"
              style={{
                height: 38, paddingLeft: 36, paddingRight: 16, borderRadius: 19,
                border: `1px solid ${T.border}`, background: T.surface, color: T.text,
                fontSize: 14, outline: "none", width: "100%",
              }}
            />
          </div>
        </div>

        {/* ── Page header ── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-baseline gap-3">
            <h1 style={{ fontSize: 22, fontWeight: 600, color: T.text }}>Kontakter</h1>
            <span style={{ fontSize: 13, fontWeight: 500, color: T.faint }}>{filtered.length}</span>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="flex items-center gap-2.5 mb-4">
          <FilterPill label="Eier" value={ownerFilter} options={OWNERS} onChange={setOwnerFilter} />
          <FilterPill label="Signal" value={signalFilter} options={["Alle", ...SIGNALS]} onChange={setSignalFilter} />
        </div>

        {/* ── Main content: list + detail panel ── */}
        <div className="flex gap-0">
          {/* ── Contact list ── */}
          <div className={`flex-1 min-w-0 transition-all duration-200 ${selectedContact ? "mr-[1px]" : ""}`}>
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden", background: T.surface, boxShadow: T.shadow }}>
              {/* Header row */}
              <div
                className="grid items-center"
                style={{
                  gridTemplateColumns: "minmax(0,1.8fr) minmax(0,1fr) minmax(0,1.4fr) minmax(0,1.2fr) 80px",
                  height: 36, borderBottom: `1px solid ${T.border}`, background: "rgba(40,37,29,0.02)",
                }}
              >
                <ColHeader label="Navn" field="name" sort={sort} onSort={toggleSort} className="px-4" />
                <ColHeader label="Signal" field="signal" sort={sort} onSort={toggleSort} className="px-3" />
                <ColHeader label="Selskap" field="company" sort={sort} onSort={toggleSort} className="px-3" />
                <ColHeader label="Stilling" field="title" sort={sort} onSort={toggleSort} className="px-3" />
                <ColHeader label="Siste" field="last_activity" sort={sort} onSort={toggleSort} className="px-3 justify-end" />
              </div>

              {/* Rows */}
              {isLoading ? (
                <p style={{ color: T.muted, textAlign: "center", padding: "48px 0", fontSize: 14 }}>Laster kontakter…</p>
              ) : sorted.length === 0 ? (
                <p style={{ color: T.muted, textAlign: "center", padding: "48px 0", fontSize: 14 }}>Ingen kontakter funnet</p>
              ) : (
                sorted.map((contact) => {
                  const isActive = selectedId === contact.id;
                  return (
                    <div
                      key={contact.id}
                      onClick={() => setSelectedId(isActive ? null : contact.id)}
                      className="grid items-center cursor-pointer transition-colors duration-75"
                      style={{
                        gridTemplateColumns: "minmax(0,1.8fr) minmax(0,1fr) minmax(0,1.4fr) minmax(0,1.2fr) 80px",
                        height: 44,
                        borderBottom: `1px solid ${T.border}`,
                        borderLeft: isActive ? `2px solid ${T.teal}` : "2px solid transparent",
                        background: isActive ? T.tealBg : undefined,
                      }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = T.hoverRow; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = ""; }}
                    >
                      <div className="px-4 truncate">
                        <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>
                          {contact.firstName} {contact.lastName}
                        </span>
                      </div>
                      <div className="px-3">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5"
                          style={{ fontSize: 11, fontWeight: 600, ...signalChipStyle(contact.signal) }}
                        >
                          {contact.signal}
                        </span>
                      </div>
                      <div className="px-3 truncate">
                        <span style={{ fontSize: 13, color: T.muted }}>{contact.company}</span>
                      </div>
                      <div className="px-3 truncate">
                        <span style={{ fontSize: 13, color: T.muted }}>{contact.title}</span>
                      </div>
                      <div className="px-3 text-right">
                        <span style={{ fontSize: 13, color: T.faint }}>
                          {contact.sisteAktivitetDager < 999 ? relTime(contact.sisteAktivitetDager) : "—"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Detail panel (sliding) ── */}
          <div
            className="overflow-hidden transition-all duration-200 ease-in-out"
            style={{
              width: selectedContact ? 360 : 0,
              minWidth: selectedContact ? 360 : 0,
              opacity: selectedContact ? 1 : 0,
            }}
          >
            {selectedContact && <DetailPanel contact={selectedContact} onClose={() => setSelectedId(null)} />}
          </div>
        </div>

        {/* ── Empty state when nothing selected ── */}
        {!selectedContact && !isLoading && sorted.length > 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <Users className="w-8 h-8 mb-3" style={{ color: T.faint }} />
            <p style={{ fontSize: 14, color: T.muted }}>Velg en kontakt for å se detaljer</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DETAIL PANEL
   ═══════════════════════════════════════════════════════════ */

function DetailPanel({ contact, onClose }: {
  contact: {
    id: string; firstName: string; lastName: string; title: string;
    email: string; phone: string; linkedin: string; location: string;
    company: string; signal: Signal; eier: string;
    cvEmail: boolean; callList: boolean; teknologier: string[];
    activities: any[]; tasks: any[];
  };
  onClose: () => void;
}) {
  const nextTask = contact.tasks.length > 0
    ? contact.tasks.sort((a: any, b: any) => (a.due_date || "9999").localeCompare(b.due_date || "9999"))[0]
    : null;

  const recentActivities = contact.activities.slice(0, 5);
  const initials = `${contact.firstName?.[0] || ""}${contact.lastName?.[0] || ""}`.toUpperCase();

  return (
    <div
      className="ml-4 overflow-y-auto"
      style={{
        width: 360, background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 8, boxShadow: T.shadow, maxHeight: "calc(100vh - 200px)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-5 pb-0">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-full"
            style={{ width: 48, height: 48, background: T.tealBg, color: T.teal, fontSize: 16, fontWeight: 600 }}
          >
            {initials}
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: T.text, lineHeight: 1.3 }}>
              {contact.firstName} {contact.lastName}
            </h2>
            <p style={{ fontSize: 13, color: T.muted }}>
              {contact.title}{contact.title && contact.company ? " · " : ""}{contact.company}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-black/5 transition-colors">
          <X className="w-4 h-4" style={{ color: T.muted }} />
        </button>
      </div>

      {/* Signal chip */}
      <div className="px-5 pt-3">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5"
          style={{ fontSize: 11, fontWeight: 600, ...signalChipStyle(contact.signal) }}
        >
          {contact.signal}
        </span>
      </div>

      {/* Action icons */}
      <div className="flex items-center gap-1.5 px-5 pt-3 pb-4" style={{ borderBottom: `1px solid ${T.border}` }}>
        {contact.phone && (
          <ActionIcon icon={<Phone className="w-3.5 h-3.5" />} label="Ring" onClick={() => window.open(`tel:${contact.phone}`)} />
        )}
        {contact.email && (
          <ActionIcon icon={<Mail className="w-3.5 h-3.5" />} label="E-post" onClick={() => window.open(`mailto:${contact.email}`)} />
        )}
        {contact.linkedin && (
          <ActionIcon icon={<Linkedin className="w-3.5 h-3.5" />} label="LinkedIn" onClick={() => window.open(contact.linkedin, "_blank")} />
        )}
        {contact.email && (
          <ActionIcon
            icon={<Copy className="w-3.5 h-3.5" />}
            label="Kopier e-post"
            onClick={() => { navigator.clipboard.writeText(contact.email); toast.success("E-post kopiert"); }}
          />
        )}
      </div>

      {/* Next step */}
      {nextTask && (
        <div className="px-5 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: T.faint, marginBottom: 4 }}>
            Neste steg
          </p>
          <p style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{nextTask.title}</p>
          {nextTask.due_date && (
            <p style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
              {format(new Date(nextTask.due_date), "d. MMM yyyy", { locale: nb })}
            </p>
          )}
        </div>
      )}

      {/* Contact info */}
      <div className="px-5 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: T.faint, marginBottom: 8 }}>
          Kontakt
        </p>
        {contact.email && <InfoRow label="E-post" value={contact.email} />}
        {contact.phone && <InfoRow label="Telefon" value={contact.phone} />}
        {contact.location && <InfoRow label="Sted" value={contact.location} />}
        <InfoRow label="Eier" value={contact.eier} />
      </div>

      {/* Status */}
      <div className="px-5 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: T.faint, marginBottom: 8 }}>
          Status
        </p>
        <div className="flex items-center gap-3">
          <StatusTag label="CV-Epost" active={contact.cvEmail} />
          <StatusTag label="Innkjøper" active={contact.callList} />
        </div>
      </div>

      {/* Tech tags */}
      {contact.teknologier.length > 0 && (
        <div className="px-5 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: T.faint, marginBottom: 8 }}>
            Teknisk DNA
          </p>
          <div className="flex flex-wrap gap-1.5">
            {contact.teknologier.map((t: string) => (
              <span
                key={t}
                className="rounded-full px-2 py-0.5"
                style={{ fontSize: 11, fontWeight: 500, background: T.chipNeutralBg, color: T.muted }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Activities */}
      <div className="px-5 py-3">
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: T.faint, marginBottom: 8 }}>
          Aktivitet
        </p>
        {recentActivities.length === 0 ? (
          <p style={{ fontSize: 13, color: T.faint }}>Ingen aktiviteter</p>
        ) : (
          <div className="flex flex-col gap-3">
            {recentActivities.map((act: any) => (
              <div key={act.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <p style={{ fontSize: 13, fontWeight: 500, color: T.text }} className="truncate flex-1">
                    {act.subject}
                  </p>
                  <span style={{ fontSize: 11, color: T.faint, whiteSpace: "nowrap" }}>
                    {format(new Date(act.created_at), "d. MMM", { locale: nb })}
                  </span>
                </div>
                {act.description && (
                  <p style={{ fontSize: 12, color: T.muted, marginTop: 2 }} className="line-clamp-2">
                    {act.description.replace(/^\[[^\]]*\]\n?/, "")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function ActionIcon({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={label}
      className="flex items-center justify-center rounded-md transition-colors hover:bg-black/5"
      style={{ width: 32, height: 32, color: T.muted }}
    >
      {icon}
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span style={{ fontSize: 12, color: T.muted }}>{label}</span>
      <span style={{ fontSize: 13, color: T.text, fontWeight: 400 }}>{value}</span>
    </div>
  );
}

function StatusTag({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5"
      style={{
        fontSize: 11, fontWeight: 500,
        background: active ? T.tealBg : T.chipNeutralBg,
        color: active ? T.teal : T.faint,
      }}
    >
      {active ? "✓" : "✗"} {label}
    </span>
  );
}

function FilterPill({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  const active = value !== "Alle";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 rounded-md transition-colors"
          style={{
            height: 28, paddingLeft: 10, paddingRight: 8, fontSize: 12, fontWeight: 500,
            border: `1px solid ${active ? T.text : T.border}`,
            background: active ? T.text : T.surface,
            color: active ? T.bg : T.muted,
          }}
        >
          {active ? `${label}: ${value}` : label}
          <ChevronDown className="w-3 h-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px]">
        {options.map((opt) => (
          <DropdownMenuItem key={opt} onClick={() => onChange(opt)} className="flex items-center justify-between">
            <span style={{ fontSize: 13 }}>{opt}</span>
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
      className={`flex items-center gap-1 transition-colors ${className || ""}`}
      style={{
        fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em",
        color: active ? T.text : T.muted,
      }}
    >
      {label}
      {active && (sort.dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
    </button>
  );
}
