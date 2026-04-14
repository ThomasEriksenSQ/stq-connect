import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronDown, ChevronUp, Check, Radio, ArrowUpDown } from "lucide-react";
import { subDays, subMonths } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* ═══════════════════════════════════════════════════════════
   TYPES & DATA
   ═══════════════════════════════════════════════════════════ */

type Signal = "Behov nå" | "Fremtidig behov" | "Har kanskje behov" | "Ukjent om behov" | "Aldri aktuelt";

const SIGNAL_DOT: Record<Signal, string> = {
  "Behov nå": "bg-emerald-500",
  "Fremtidig behov": "bg-blue-500",
  "Har kanskje behov": "bg-amber-500",
  "Ukjent om behov": "bg-gray-400",
  "Aldri aktuelt": "bg-red-500",
};

const SIGNAL_BADGE: Record<Signal, string> = {
  "Behov nå": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Fremtidig behov": "bg-blue-100 text-blue-800 border-blue-200",
  "Har kanskje behov": "bg-amber-100 text-amber-800 border-amber-200",
  "Ukjent om behov": "bg-gray-100 text-gray-600 border-gray-200",
  "Aldri aktuelt": "bg-red-50 text-red-700 border-red-200",
};

const SIGNAL_ORDER: Record<Signal, number> = {
  "Behov nå": 0, "Fremtidig behov": 1, "Har kanskje behov": 2, "Ukjent om behov": 3, "Aldri aktuelt": 4,
};

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  signal: Signal;
  eier: string;
  cvEmail: boolean;
  callList: boolean;
  hasMarkedsradar: boolean;
  sisteAktivitetDager: number;
}

const now = new Date();

const CONTACTS: Contact[] = [
  { id: "1", firstName: "Erik", lastName: "Solberg", title: "Tech Lead", company: "Aker Solutions", signal: "Behov nå", eier: "Jon Richard Nygaard", cvEmail: true, callList: false, hasMarkedsradar: true, sisteAktivitetDager: 1 },
  { id: "2", firstName: "Kari", lastName: "Hansen", title: "Engineering Manager", company: "DNB", signal: "Behov nå", eier: "Thomas Eriksen", cvEmail: true, callList: true, hasMarkedsradar: false, sisteAktivitetDager: 4 },
  { id: "3", firstName: "Silje", lastName: "Strand", title: "Data Engineering Lead", company: "Schibsted", signal: "Behov nå", eier: "Jon Richard Nygaard", cvEmail: false, callList: false, hasMarkedsradar: true, sisteAktivitetDager: 5 },
  { id: "4", firstName: "Magnus", lastName: "Pedersen", title: "VP Engineering", company: "Cognite", signal: "Fremtidig behov", eier: "Jon Richard Nygaard", cvEmail: true, callList: false, hasMarkedsradar: false, sisteAktivitetDager: 9 },
  { id: "5", firstName: "Ingrid", lastName: "Moe", title: "CTO", company: "Vipps", signal: "Fremtidig behov", eier: "Thomas Eriksen", cvEmail: false, callList: false, hasMarkedsradar: false, sisteAktivitetDager: 11 },
  { id: "6", firstName: "Henrik", lastName: "Berg", title: "Platform Lead", company: "Equinor", signal: "Behov nå", eier: "Jon Richard Nygaard", cvEmail: true, callList: true, hasMarkedsradar: true, sisteAktivitetDager: 2 },
  { id: "7", firstName: "Lene", lastName: "Johansen", title: "Head of Digital", company: "Storebrand", signal: "Har kanskje behov", eier: "Thomas Eriksen", cvEmail: false, callList: false, hasMarkedsradar: false, sisteAktivitetDager: 17 },
  { id: "8", firstName: "Andreas", lastName: "Dahl", title: "Sr. Engineering Manager", company: "Telenor", signal: "Fremtidig behov", eier: "Jon Richard Nygaard", cvEmail: true, callList: false, hasMarkedsradar: false, sisteAktivitetDager: 13 },
  { id: "9", firstName: "Marte", lastName: "Eriksen", title: "Tech Director", company: "Kahoot!", signal: "Ukjent om behov", eier: "Thomas Eriksen", cvEmail: false, callList: false, hasMarkedsradar: false, sisteAktivitetDager: 30 },
  { id: "10", firstName: "Ola", lastName: "Kristiansen", title: "IT-sjef", company: "Posten", signal: "Har kanskje behov", eier: "Jon Richard Nygaard", cvEmail: false, callList: false, hasMarkedsradar: false, sisteAktivitetDager: 25 },
  { id: "11", firstName: "Camilla", lastName: "Vik", title: "VP Technology", company: "Statkraft", signal: "Fremtidig behov", eier: "Thomas Eriksen", cvEmail: true, callList: false, hasMarkedsradar: true, sisteAktivitetDager: 6 },
  { id: "12", firstName: "Thomas", lastName: "Lie", title: "CTO", company: "Color Line", signal: "Aldri aktuelt", eier: "Jon Richard Nygaard", cvEmail: false, callList: false, hasMarkedsradar: false, sisteAktivitetDager: 63 },
];

const OWNERS = ["Alle", "Jon Richard Nygaard", "Thomas Eriksen"];
const SIGNALS: Signal[] = ["Behov nå", "Fremtidig behov", "Har kanskje behov", "Ukjent om behov", "Aldri aktuelt"];

type SortField = "name" | "signal" | "company" | "title" | "last_activity";
type SortDir = "asc" | "desc";

function relTime(days: number): string {
  if (days === 0) return "I dag";
  if (days === 1) return "1d";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}u`;
  return `${Math.floor(days / 30)} mnd`;
}

/* ═══════════════════════════════════════════════════════════
   TOP NAV
   ═══════════════════════════════════════════════════════════ */

function TopNav() {
  const tabs = [
    { label: "Kontakter", active: true },
    { label: "Selskaper", active: false },
    { label: "Oppdrag", active: false },
  ];
  return (
    <header className="h-[53px] flex items-center justify-between px-8 bg-white border-b border-[rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-8">
        <span className="text-[15px] font-extrabold tracking-tight text-[#111827]">STACQ</span>
        <nav className="flex items-center gap-1">
          {tabs.map((t) => (
            <button
              key={t.label}
              className={`h-[53px] px-3 text-[13px] font-medium transition-colors border-b-2 ${
                t.active
                  ? "text-[#111827] border-[#111827]"
                  : "text-[#6B7280] border-transparent hover:text-[#111827]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
          <input
            placeholder="Søk…  ⌘K"
            readOnly
            className="h-8 pl-8 pr-3 rounded-md text-[13px] outline-none bg-[#FAFAFA] text-[#111827] w-52 border border-[rgba(0,0,0,0.06)]"
          />
        </div>
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold bg-[#111827] text-white">
          JR
        </div>
      </div>
    </header>
  );
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
  const [contacts, setContacts] = useState(CONTACTS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const handleSignalChange = (id: string, signal: Signal) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, signal } : c)));
  };

  const allSelected = sorted.length > 0 && selectedIds.size === sorted.length;

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, -apple-system, system-ui, sans-serif" }}>
      <TopNav />

      <div className="px-8 pt-6 pb-8 max-w-[1600px] mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-baseline gap-3">
            <h1 className="text-[20px] font-semibold text-[#111827]">Kontakter</h1>
            <span className="text-[13px] text-[#9CA3AF] font-medium">{filtered.length}</span>
          </div>
          <button className="h-8 px-4 rounded-md text-[13px] font-medium bg-[#111827] text-white hover:bg-[#1f2937] transition-colors">
            + Ny kontakt
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <FilterPill label="Eier" value={ownerFilter} options={OWNERS} onChange={setOwnerFilter} />
          <FilterPill label="Signal" value={signalFilter} options={["Alle", ...SIGNALS]} onChange={setSignalFilter} />
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk kontakter…"
              className="h-8 pl-8 pr-3 rounded-md text-[13px] outline-none bg-white text-[#111827] w-64 border border-[rgba(0,0,0,0.06)] focus:border-[rgba(0,0,0,0.15)] transition-colors"
            />
          </div>
        </div>

        {/* Table */}
        <div className="border border-[rgba(0,0,0,0.06)] rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[40px_minmax(0,1.8fr)_minmax(0,1.4fr)_36px_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_90px] gap-0 items-center h-[36px] bg-[#FAFAFA] border-b border-[rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="w-3.5 h-3.5 rounded border-[rgba(0,0,0,0.15)] accent-[#111827] cursor-pointer"
              />
            </div>
            <ColHeader label="Navn" field="name" sort={sort} onSort={toggleSort} className="px-3" />
            <ColHeader label="Signal" field="signal" sort={sort} onSort={toggleSort} className="px-3" />
            <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#9CA3AF] px-1">Finn</span>
            <ColHeader label="Selskap" field="company" sort={sort} onSort={toggleSort} className="px-3" />
            <ColHeader label="Stilling" field="title" sort={sort} onSort={toggleSort} className="px-3" />
            <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#9CA3AF] px-3">Tags</span>
            <ColHeader label="Siste akt." field="last_activity" sort={sort} onSort={toggleSort} className="px-3 justify-end" />
          </div>

          {/* Rows */}
          <div>
            {sorted.map((contact) => (
              <div
                key={contact.id}
                className="grid grid-cols-[40px_minmax(0,1.8fr)_minmax(0,1.4fr)_36px_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_90px] gap-0 items-center h-[44px] border-b border-[rgba(0,0,0,0.04)] hover:bg-[rgba(0,0,0,0.015)] transition-colors duration-75 group"
              >
                {/* Checkbox */}
                <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(contact.id)}
                    onChange={() => toggleSelect(contact.id)}
                    className="w-3.5 h-3.5 rounded border-[rgba(0,0,0,0.15)] accent-[#111827] cursor-pointer"
                  />
                </div>

                {/* Navn */}
                <button
                  onClick={() => navigate(`/design-lab/kontakter/${contact.id}`)}
                  className="px-3 text-left cursor-pointer truncate"
                >
                  <span className="text-[13px] font-medium text-[#111827]">
                    {contact.firstName} {contact.lastName}
                  </span>
                </button>

                {/* Signal */}
                <div className="px-3" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold cursor-pointer ${SIGNAL_BADGE[contact.signal]}`}>
                        {contact.signal}
                        <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {SIGNALS.map((s) => (
                        <DropdownMenuItem key={s} onClick={() => handleSignalChange(contact.id, s)}>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${SIGNAL_BADGE[s]}`}>
                            {s}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Finn */}
                <div className="flex items-center justify-center">
                  {contact.hasMarkedsradar && (
                    <Radio className="h-3.5 w-3.5 text-blue-500" />
                  )}
                </div>

                {/* Selskap */}
                <button
                  onClick={() => navigate(`/design-lab/kontakter/${contact.id}`)}
                  className="px-3 text-left cursor-pointer truncate"
                >
                  <span className="text-[13px] text-[#6B7280]">{contact.company}</span>
                </button>

                {/* Stilling */}
                <button
                  onClick={() => navigate(`/design-lab/kontakter/${contact.id}`)}
                  className="px-3 text-left cursor-pointer truncate"
                >
                  <span className="text-[13px] text-[#6B7280]">{contact.title}</span>
                </button>

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
                  <span className="text-[13px] text-[#9CA3AF]">{relTime(contact.sisteAktivitetDager)}</span>
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
              ? "bg-[#111827] text-white border-[#111827]"
              : "bg-white text-[#6B7280] border-[rgba(0,0,0,0.06)] hover:border-[rgba(0,0,0,0.12)]"
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
        active ? "text-[#111827]" : "text-[#9CA3AF] hover:text-[#6B7280]"
      } ${className || ""}`}
    >
      {label}
      {active && (sort.dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
    </button>
  );
}
