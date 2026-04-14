import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, ChevronDown, Check, ChevronUp,
  Phone, Mail, Linkedin, Copy, Users, X,
  Building2, LayoutDashboard, Briefcase, Settings, LogOut,
  UserPlus, Radar, TrendingUp, Globe,
} from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { nb } from "date-fns/locale";
import { getEffectiveSignal, normalizeCategoryLabel } from "@/lib/categoryUtils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

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

/* ═══════════════════════════════════════════════════════════
   NAV ITEMS
   ═══════════════════════════════════════════════════════════ */

const sidebarNav = [
  { label: "Salgsagent", icon: LayoutDashboard, href: "/" },
  { label: "Selskaper", icon: Building2, href: "/selskaper" },
  { label: "Kontakter", icon: Users, href: "/design-lab/kontakter", active: true },
  { label: "Forespørsler", icon: Briefcase, href: "/foresporsler" },
];

const sidebarStacq = [
  { label: "STACQ Prisen", icon: TrendingUp, href: "/stacq/prisen" },
  { label: "Markedsradar", icon: Radar, href: "/markedsradar" },
  { label: "Ansatte", icon: Users, href: "/konsulenter/ansatte" },
  { label: "Eksterne", icon: UserPlus, href: "/konsulenter/eksterne" },
  { label: "stacq.no", icon: Globe, href: "/nettside-ai" },
];

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */

export default function DesignLabContacts() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("Alle");
  const [signalFilter, setSignalFilter] = useState("Alle");
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "last_activity", dir: "asc" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [signalOpen, setSignalOpen] = useState(false);

  const initials = user?.email ? user.email.split("@")[0].slice(0, 2).toUpperCase() : "??";

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
        id: c.id, firstName: c.first_name, lastName: c.last_name,
        title: c.title || "", email: c.email || "", phone: c.phone || "",
        linkedin: c.linkedin || "", location: c.location || "",
        company: company?.name || "", companyId: company?.id || null,
        signal, eier: owner?.full_name || "Ikke tildelt",
        cvEmail: c.cv_email, callList: c.call_list,
        teknologier: c.teknologier || [],
        sisteAktivitetDager: daysSince, activities: acts, tasks,
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
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif", background: "#F7F6F2" }}>

      {/* ═══ LEFT SIDEBAR ═══ */}
      <aside className="flex flex-col w-[220px] shrink-0 border-r" style={{ borderColor: "rgba(40,37,29,0.08)", background: "#F7F6F2" }}>
        {/* Logo */}
        <div className="px-5 pt-6 pb-5">
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", color: "#28251D" }}>STACQ</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          <p className="px-2 pt-1 pb-2" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#BAB9B4" }}>
            CRM
          </p>
          {sidebarNav.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.href)}
              className="flex items-center gap-2.5 w-full rounded-md px-2.5 py-[7px] transition-colors"
              style={{
                fontSize: 13, fontWeight: 500,
                color: item.active ? "#01696F" : "#7A7974",
                background: item.active ? "rgba(1,105,111,0.06)" : "transparent",
                borderLeft: item.active ? "2px solid #01696F" : "2px solid transparent",
              }}
              onMouseEnter={(e) => { if (!item.active) e.currentTarget.style.background = "rgba(40,37,29,0.04)"; }}
              onMouseLeave={(e) => { if (!item.active) e.currentTarget.style.background = "transparent"; }}
            >
              <item.icon style={{ width: 16, height: 16, strokeWidth: 1.5 }} />
              {item.label}
            </button>
          ))}

          <p className="px-2 pt-5 pb-2" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#BAB9B4" }}>
            STACQ
          </p>
          {sidebarStacq.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.href)}
              className="flex items-center gap-2.5 w-full rounded-md px-2.5 py-[7px] transition-colors"
              style={{ fontSize: 13, fontWeight: 500, color: "#7A7974", borderLeft: "2px solid transparent" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(40,37,29,0.04)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <item.icon style={{ width: 16, height: 16, strokeWidth: 1.5 }} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 pt-2 space-y-1" style={{ borderTop: "1px solid rgba(40,37,29,0.08)" }}>
          <button
            onClick={() => navigate("/innstillinger")}
            className="flex items-center gap-2.5 w-full rounded-md px-2.5 py-[7px] transition-colors"
            style={{ fontSize: 13, fontWeight: 500, color: "#7A7974" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(40,37,29,0.04)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <Settings style={{ width: 16, height: 16, strokeWidth: 1.5 }} />
            Innstillinger
          </button>
          <button
            onClick={signOut}
            className="flex items-center gap-2.5 w-full rounded-md px-2.5 py-[7px] transition-colors"
            style={{ fontSize: 13, fontWeight: 500, color: "#BAB9B4" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(40,37,29,0.04)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <LogOut style={{ width: 16, height: 16, strokeWidth: 1.5 }} />
            Logg ut
          </button>
          {user && (
            <div className="flex items-center gap-2 px-2.5 pt-2">
              <div className="flex items-center justify-center rounded-full" style={{ width: 26, height: 26, background: "rgba(1,105,111,0.08)", color: "#01696F", fontSize: 10, fontWeight: 600 }}>
                {initials}
              </div>
              <span className="truncate" style={{ fontSize: 12, color: "#BAB9B4" }}>{user.email}</span>
            </div>
          )}
        </div>
      </aside>

      {/* ═══ MAIN AREA ═══ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar with search */}
        <header className="flex items-center justify-center px-6 shrink-0" style={{ height: 56, borderBottom: "1px solid rgba(40,37,29,0.08)" }}>
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#BAB9B4" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk kontakter…"
              className="w-full outline-none"
              style={{
                height: 36, paddingLeft: 36, paddingRight: 16, borderRadius: 18,
                border: "1px solid rgba(40,37,29,0.08)", background: "#FFFFFF", color: "#28251D", fontSize: 13,
              }}
            />
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pt-5 pb-8">
          {/* Page header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-baseline gap-3">
              <h1 style={{ fontSize: 22, fontWeight: 600, color: "#28251D" }}>Kontakter</h1>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#BAB9B4" }}>{filtered.length}</span>
            </div>
            <button
              className="inline-flex items-center gap-1.5 rounded-md transition-colors"
              style={{ height: 34, paddingLeft: 14, paddingRight: 14, fontSize: 13, fontWeight: 500, background: "#01696F", color: "#FFFFFF", borderRadius: 6 }}
            >
              + Legg til kontakt
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mb-4 relative">
            <FilterPill label="Eier" value={ownerFilter} options={OWNERS} open={ownerOpen} setOpen={setOwnerOpen} onChange={(v) => { setOwnerFilter(v); setOwnerOpen(false); }} />
            <FilterPill label="Signal" value={signalFilter} options={["Alle", ...SIGNALS]} open={signalOpen} setOpen={setSignalOpen} onChange={(v) => { setSignalFilter(v); setSignalOpen(false); }} />
          </div>

          {/* List + Detail panel */}
          <div className="flex gap-0">
            {/* Contact list */}
            <div className={`flex-1 min-w-0 transition-all duration-200`}>
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(40,37,29,0.08)", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(40,37,29,0.04)" }}>
                {/* Header */}
                <div
                  className="grid items-center"
                  style={{
                    gridTemplateColumns: "minmax(0,1.8fr) minmax(0,1fr) minmax(0,1.4fr) minmax(0,1.2fr) 72px",
                    height: 36, borderBottom: "1px solid rgba(40,37,29,0.06)", background: "rgba(40,37,29,0.015)",
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
                  <p style={{ color: "#7A7974", textAlign: "center", padding: "48px 0", fontSize: 13 }}>Laster kontakter…</p>
                ) : sorted.length === 0 ? (
                  <p style={{ color: "#7A7974", textAlign: "center", padding: "48px 0", fontSize: 13 }}>Ingen kontakter funnet</p>
                ) : (
                  sorted.map((contact) => {
                    const isActive = selectedId === contact.id;
                    return (
                      <div
                        key={contact.id}
                        onClick={() => setSelectedId(isActive ? null : contact.id)}
                        className="grid items-center cursor-pointer transition-colors duration-75"
                        style={{
                          gridTemplateColumns: "minmax(0,1.8fr) minmax(0,1fr) minmax(0,1.4fr) minmax(0,1.2fr) 72px",
                          height: 42,
                          borderBottom: "1px solid rgba(40,37,29,0.05)",
                          borderLeft: isActive ? "2px solid #01696F" : "2px solid transparent",
                          background: isActive ? "rgba(1,105,111,0.04)" : undefined,
                        }}
                        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "#F3F0EC"; }}
                        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = ""; }}
                      >
                        <div className="px-4 truncate">
                          <span style={{ fontSize: 13, fontWeight: 500, color: "#28251D" }}>
                            {contact.firstName} {contact.lastName}
                          </span>
                        </div>
                        <div className="px-3">
                          <SignalChip signal={contact.signal} />
                        </div>
                        <div className="px-3 truncate">
                          <span style={{ fontSize: 13, color: "#7A7974" }}>{contact.company}</span>
                        </div>
                        <div className="px-3 truncate">
                          <span style={{ fontSize: 13, color: "#7A7974" }}>{contact.title}</span>
                        </div>
                        <div className="px-3 text-right">
                          <span style={{ fontSize: 13, color: "#BAB9B4" }}>
                            {contact.sisteAktivitetDager < 999 ? relTime(contact.sisteAktivitetDager) : "—"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Empty state */}
              {!selectedContact && !isLoading && sorted.length > 0 && (
                <div className="flex flex-col items-center justify-center py-14">
                  <Users className="w-7 h-7 mb-2" style={{ color: "#BAB9B4" }} />
                  <p style={{ fontSize: 13, color: "#7A7974" }}>Velg en kontakt for å se detaljer</p>
                </div>
              )}
            </div>

            {/* Detail panel */}
            <div
              className="overflow-hidden transition-all duration-200 ease-in-out shrink-0"
              style={{
                width: selectedContact ? 340 : 0,
                minWidth: selectedContact ? 340 : 0,
                opacity: selectedContact ? 1 : 0,
                marginLeft: selectedContact ? 16 : 0,
              }}
            >
              {selectedContact && <DetailPanel contact={selectedContact} onClose={() => setSelectedId(null)} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SIGNAL CHIP
   ═══════════════════════════════════════════════════════════ */

function SignalChip({ signal }: { signal: Signal }) {
  const isTeal = signal === "Behov nå";
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5"
      style={{
        fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
        background: isTeal ? "rgba(1,105,111,0.08)" : "rgba(40,37,29,0.06)",
        color: isTeal ? "#01696F" : signal === "Ikke aktuelt" ? "#5A5954" : "#7A7974",
      }}
    >
      {signal}
    </span>
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
      className="overflow-y-auto rounded-lg"
      style={{
        width: 340, background: "#FFFFFF", border: "1px solid rgba(40,37,29,0.08)",
        boxShadow: "0 1px 2px rgba(40,37,29,0.04)", maxHeight: "calc(100vh - 120px)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-5 pb-0">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-full shrink-0"
            style={{ width: 44, height: 44, background: "rgba(1,105,111,0.08)", color: "#01696F", fontSize: 14, fontWeight: 600 }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <h2 className="truncate" style={{ fontSize: 15, fontWeight: 600, color: "#28251D", lineHeight: 1.3 }}>
              {contact.firstName} {contact.lastName}
            </h2>
            <p className="truncate" style={{ fontSize: 12, color: "#7A7974" }}>
              {contact.title}{contact.title && contact.company ? " · " : ""}{contact.company}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-black/5 transition-colors shrink-0">
          <X className="w-4 h-4" style={{ color: "#7A7974" }} />
        </button>
      </div>

      {/* Signal */}
      <div className="px-5 pt-3">
        <SignalChip signal={contact.signal} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 px-5 pt-3 pb-4" style={{ borderBottom: "1px solid rgba(40,37,29,0.08)" }}>
        {contact.phone && <ActionIcon icon={<Phone className="w-3.5 h-3.5" />} label="Ring" onClick={() => window.open(`tel:${contact.phone}`)} />}
        {contact.email && <ActionIcon icon={<Mail className="w-3.5 h-3.5" />} label="E-post" onClick={() => window.open(`mailto:${contact.email}`)} />}
        {contact.linkedin && <ActionIcon icon={<Linkedin className="w-3.5 h-3.5" />} label="LinkedIn" onClick={() => window.open(contact.linkedin, "_blank")} />}
        {contact.email && <ActionIcon icon={<Copy className="w-3.5 h-3.5" />} label="Kopier" onClick={() => { navigator.clipboard.writeText(contact.email); toast.success("E-post kopiert"); }} />}
      </div>

      {/* Next step */}
      {nextTask && (
        <Section title="Neste steg">
          <p style={{ fontSize: 13, fontWeight: 500, color: "#28251D" }}>{nextTask.title}</p>
          {nextTask.due_date && (
            <p style={{ fontSize: 12, color: "#7A7974", marginTop: 2 }}>
              {format(new Date(nextTask.due_date), "d. MMM yyyy", { locale: nb })}
            </p>
          )}
        </Section>
      )}

      {/* Contact info */}
      <Section title="Kontakt">
        {contact.email && <InfoRow label="E-post" value={contact.email} />}
        {contact.phone && <InfoRow label="Telefon" value={contact.phone} />}
        {contact.location && <InfoRow label="Sted" value={contact.location} />}
        <InfoRow label="Eier" value={contact.eier} />
      </Section>

      {/* Status */}
      <Section title="Status">
        <div className="flex items-center gap-2.5">
          <StatusTag label="CV-Epost" active={contact.cvEmail} />
          <StatusTag label="Innkjøper" active={contact.callList} />
        </div>
      </Section>

      {/* Tech */}
      {contact.teknologier.length > 0 && (
        <Section title="Teknisk DNA">
          <div className="flex flex-wrap gap-1.5">
            {contact.teknologier.map((t: string) => (
              <span key={t} className="rounded-full px-2 py-0.5" style={{ fontSize: 11, fontWeight: 500, background: "rgba(40,37,29,0.06)", color: "#7A7974" }}>
                {t}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Activities */}
      <div className="px-5 py-3">
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#BAB9B4", marginBottom: 8 }}>
          Aktivitet
        </p>
        {recentActivities.length === 0 ? (
          <p style={{ fontSize: 13, color: "#BAB9B4" }}>Ingen aktiviteter</p>
        ) : (
          <div className="flex flex-col gap-3">
            {recentActivities.map((act: any) => (
              <div key={act.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate flex-1" style={{ fontSize: 13, fontWeight: 500, color: "#28251D" }}>{act.subject}</p>
                  <span style={{ fontSize: 11, color: "#BAB9B4", whiteSpace: "nowrap" }}>
                    {format(new Date(act.created_at), "d. MMM", { locale: nb })}
                  </span>
                </div>
                {act.description && (
                  <p className="line-clamp-2" style={{ fontSize: 12, color: "#7A7974", marginTop: 2 }}>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(40,37,29,0.08)" }}>
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#BAB9B4", marginBottom: 8 }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function ActionIcon({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={label}
      className="flex items-center justify-center rounded-md transition-colors hover:bg-black/5"
      style={{ width: 32, height: 32, color: "#7A7974" }}
    >
      {icon}
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span style={{ fontSize: 12, color: "#7A7974" }}>{label}</span>
      <span style={{ fontSize: 13, color: "#28251D" }}>{value}</span>
    </div>
  );
}

function StatusTag({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5"
      style={{
        fontSize: 11, fontWeight: 500,
        background: active ? "rgba(1,105,111,0.08)" : "rgba(40,37,29,0.06)",
        color: active ? "#01696F" : "#BAB9B4",
      }}
    >
      {active ? "✓" : "✗"} {label}
    </span>
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
        className="inline-flex items-center gap-1.5 rounded-md transition-colors"
        style={{
          height: 28, paddingLeft: 10, paddingRight: 8, fontSize: 12, fontWeight: 500,
          border: `1px solid ${active ? "#28251D" : "rgba(40,37,29,0.08)"}`,
          background: active ? "#28251D" : "#FFFFFF",
          color: active ? "#F7F6F2" : "#7A7974",
        }}
      >
        {active ? `${label}: ${value}` : label}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-52 rounded-lg overflow-hidden z-50" style={{ background: "#FFFFFF", border: "1px solid rgba(40,37,29,0.08)", boxShadow: "0 4px 12px rgba(40,37,29,0.08)" }}>
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => onChange(opt)}
                className="flex items-center justify-between w-full px-3 py-2 transition-colors"
                style={{ fontSize: 13, color: "#28251D" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#F3F0EC"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
              >
                {opt}
                {value === opt && <Check className="w-3.5 h-3.5" style={{ color: "#01696F" }} />}
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
      className={`flex items-center gap-1 transition-colors ${className || ""}`}
      style={{
        fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em",
        color: active ? "#28251D" : "#7A7974",
      }}
    >
      {label}
      {active && (sort.dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
    </button>
  );
}
