import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronDown, X, Phone, Mail } from "lucide-react";

/* ── Minimal Top Strip ── */
function TopStrip() {
  return (
    <header className="h-12 flex items-center justify-between px-6 border-b border-[#E5E7EB] bg-white">
      <span className="tracking-tight font-extrabold text-lg text-[#111827]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
        STACQ
      </span>
      <div className="relative w-full max-w-md mx-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
        <input
          placeholder="Søk kontakter, selskaper…  ⌘K"
          className="w-full h-8 pl-9 pr-3 rounded-lg text-sm outline-none bg-[#F3F4F6] text-[#111827]"
          style={{ fontFamily: "Inter, system-ui, sans-serif", border: "none" }}
          readOnly
        />
      </div>
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold bg-[#111827] text-white">
        JR
      </div>
    </header>
  );
}

/* ── Signal types & colors ── */
type Signal = "Behov nå" | "Fremtidig behov" | "Har kanskje behov" | "Ukjent om behov" | "Aldri aktuelt";

const SIGNAL_COLORS: Record<Signal, string> = {
  "Behov nå": "#10B981",
  "Fremtidig behov": "#3B82F6",
  "Har kanskje behov": "#F59E0B",
  "Ukjent om behov": "#9CA3AF",
  "Aldri aktuelt": "#EF4444",
};

const SIGNAL_TEXT_COLORS: Record<Signal, string> = {
  "Behov nå": "#065F46",
  "Fremtidig behov": "#1E40AF",
  "Har kanskje behov": "#92400E",
  "Ukjent om behov": "#6B7280",
  "Aldri aktuelt": "#991B1B",
};

/* ── Mock data ── */
interface Contact {
  id: string;
  navn: string;
  stilling: string;
  selskap: string;
  signal: Signal;
  eier: string;
  nesteSteg: string | null;
  sisteKontaktDager: number;
  sisteType: "Samtale" | "Møte" | "E-post";
}

const CONTACTS: Contact[] = [
  { id: "1", navn: "Erik Solberg", stilling: "Tech Lead", selskap: "Aker Solutions", signal: "Behov nå", eier: "Jon Richard Nygaard", nesteSteg: "Send 2 ML-profiler", sisteKontaktDager: 1, sisteType: "Samtale" },
  { id: "6", navn: "Henrik Berg", stilling: "Platform Lead", selskap: "Equinor", signal: "Behov nå", eier: "Jon Richard Nygaard", nesteSteg: "Presentere 2 DevOps-profiler", sisteKontaktDager: 2, sisteType: "Samtale" },
  { id: "3", navn: "Silje Strand", stilling: "Data Engineering Lead", selskap: "Schibsted", signal: "Behov nå", eier: "Jon Richard Nygaard", nesteSteg: "Sende profil Spark-konsulent", sisteKontaktDager: 5, sisteType: "Samtale" },
  { id: "2", navn: "Kari Hansen", stilling: "Engineering Manager", selskap: "DNB", signal: "Behov nå", eier: "Thomas Eriksen", nesteSteg: "Book demo med teamleder", sisteKontaktDager: 4, sisteType: "Møte" },
  { id: "4", navn: "Magnus Pedersen", stilling: "VP Engineering", selskap: "Cognite", signal: "Fremtidig behov", eier: "Jon Richard Nygaard", nesteSteg: "Følg opp Q3-behov", sisteKontaktDager: 9, sisteType: "Møte" },
  { id: "5", navn: "Ingrid Moe", stilling: "CTO", selskap: "Vipps", signal: "Fremtidig behov", eier: "Thomas Eriksen", nesteSteg: "Lunsj i mai", sisteKontaktDager: 11, sisteType: "E-post" },
  { id: "8", navn: "Andreas Dahl", stilling: "Sr. Engineering Manager", selskap: "Telenor", signal: "Fremtidig behov", eier: "Jon Richard Nygaard", nesteSteg: "Sjekk 5G-prosjekt status", sisteKontaktDager: 13, sisteType: "Samtale" },
  { id: "11", navn: "Camilla Vik", stilling: "VP Technology", selskap: "Statkraft", signal: "Fremtidig behov", eier: "Thomas Eriksen", nesteSteg: "Send rammeavtale-info", sisteKontaktDager: 6, sisteType: "Møte" },
  { id: "7", navn: "Lene Johansen", stilling: "Head of Digital", selskap: "Storebrand", signal: "Har kanskje behov", eier: "Thomas Eriksen", nesteSteg: null, sisteKontaktDager: 17, sisteType: "Møte" },
  { id: "10", navn: "Ola Kristiansen", stilling: "IT-sjef", selskap: "Posten", signal: "Har kanskje behov", eier: "Jon Richard Nygaard", nesteSteg: null, sisteKontaktDager: 25, sisteType: "Samtale" },
  { id: "9", navn: "Marte Eriksen", stilling: "Tech Director", selskap: "Kahoot!", signal: "Ukjent om behov", eier: "Thomas Eriksen", nesteSteg: "Intro-møte", sisteKontaktDager: 30, sisteType: "E-post" },
  { id: "12", navn: "Thomas Lie", stilling: "CTO", selskap: "Color Line", signal: "Aldri aktuelt", eier: "Jon Richard Nygaard", nesteSteg: null, sisteKontaktDager: 63, sisteType: "E-post" },
];

const OWNERS = ["Alle", "Jon Richard Nygaard", "Thomas Eriksen"];
const SIGNALS: Signal[] = ["Behov nå", "Fremtidig behov", "Har kanskje behov", "Ukjent om behov", "Aldri aktuelt"];

/* ── Relative time ── */
function relTime(days: number): string {
  if (days === 0) return "I dag";
  if (days === 1) return "1d";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}u`;
  return `${Math.floor(days / 30)}m`;
}

function urgencyColor(days: number): string {
  if (days <= 3) return "#6B7280";
  if (days <= 7) return "#92400E";
  if (days <= 14) return "#B45309";
  return "#DC2626";
}

/* ── Filter dropdown ── */
function FilterPill({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = value !== "Alle";
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-colors"
        style={{
          background: active ? "#111827" : "#FFFFFF",
          color: active ? "#FFFFFF" : "#6B7280",
          border: `1px solid ${active ? "#111827" : "#E5E7EB"}`,
        }}
      >
        {label}{active ? `: ${value}` : ""}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-10 left-0 z-20 rounded-lg py-1 min-w-[200px] bg-white border border-[#E5E7EB]" style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-[#F9FAFB] transition-colors"
                style={{ color: "#111827", fontWeight: value === opt ? 600 : 400 }}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Priority Card ── */
function PriorityCard({ contact, onClick }: { contact: Contact; onClick: () => void }) {
  const borderColor = SIGNAL_COLORS[contact.signal];
  return (
    <div
      onClick={onClick}
      className="flex-1 min-w-0 bg-white cursor-pointer transition-shadow hover:shadow-md group"
      style={{
        borderLeft: `3px solid ${borderColor}`,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        padding: "20px 20px 16px",
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <div className="text-[17px] font-semibold text-[#111827] truncate">{contact.navn}</div>
          <div className="text-[13px] text-[#6B7280] truncate">{contact.selskap}</div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); }}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-[#10B981] text-white opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2"
        >
          <Phone className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="text-[14px] font-medium text-[#111827] mb-3 line-clamp-1">{contact.nesteSteg}</div>
      <div className="flex items-center gap-2 text-[12px]">
        <span style={{ color: urgencyColor(contact.sisteKontaktDager) }} className="font-medium">
          {relTime(contact.sisteKontaktDager)}
        </span>
        <span className="text-[#D1D5DB]">·</span>
        <span className="text-[#9CA3AF]">{contact.sisteType}</span>
      </div>
    </div>
  );
}

/* ── Contact Row ── */
function ContactRow({ contact, onClick }: { contact: Contact; onClick: () => void }) {
  const borderColor = SIGNAL_COLORS[contact.signal];
  const signalTextColor = SIGNAL_TEXT_COLORS[contact.signal];
  return (
    <div
      onClick={onClick}
      className="flex items-center cursor-pointer transition-colors hover:bg-[#F9FAFB] group"
      style={{
        borderLeft: `3px solid ${borderColor}`,
        minHeight: 64,
        borderBottom: "1px solid #F3F4F6",
      }}
    >
      {/* Name + role + company */}
      <div className="flex-[2] min-w-0 px-4 py-3">
        <div className="text-[14px] font-semibold text-[#111827] truncate">{contact.navn}</div>
        <div className="text-[12px] text-[#9CA3AF] truncate">{contact.stilling} · {contact.selskap}</div>
      </div>

      {/* Next action */}
      <div className="flex-[2] min-w-0 px-3">
        {contact.nesteSteg ? (
          <>
            <div className="text-[14px] font-medium text-[#111827] truncate">{contact.nesteSteg}</div>
            <div className="text-[12px] font-medium" style={{ color: signalTextColor }}>{contact.signal}</div>
          </>
        ) : (
          <>
            <div className="text-[13px] text-[#D1D5DB]">Ingen neste steg</div>
            <div className="text-[12px] font-medium" style={{ color: signalTextColor }}>{contact.signal}</div>
          </>
        )}
      </div>

      {/* Owner */}
      <div className="flex-[1.2] min-w-0 px-3">
        <span className="text-[13px] text-[#6B7280] truncate block">{contact.eier}</span>
      </div>

      {/* Time + hover actions */}
      <div className="w-[100px] px-3 flex items-center justify-end gap-2">
        <div className="group-hover:hidden">
          <span className="text-[13px] font-medium" style={{ color: urgencyColor(contact.sisteKontaktDager) }}>
            {relTime(contact.sisteKontaktDager)}
          </span>
        </div>
        <div className="hidden group-hover:flex items-center gap-1">
          <button
            onClick={(e) => e.stopPropagation()}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#111827] transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => e.stopPropagation()}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#111827] transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function DesignLabContacts() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("Alle");
  const [signalFilter, setSignalFilter] = useState("Alle");

  const hasFilters = ownerFilter !== "Alle" || signalFilter !== "Alle" || search !== "";

  const filtered = useMemo(() => {
    return CONTACTS.filter((c) => {
      if (ownerFilter !== "Alle" && c.eier !== ownerFilter) return false;
      if (signalFilter !== "Alle" && c.signal !== signalFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return c.navn.toLowerCase().includes(q) || c.selskap.toLowerCase().includes(q);
      }
      return true;
    });
  }, [search, ownerFilter, signalFilter]);

  // Top 3 priority: have nesteSteg, sorted by urgency
  const priorities = useMemo(() => {
    return CONTACTS
      .filter((c) => c.nesteSteg && (c.signal === "Behov nå"))
      .sort((a, b) => a.sisteKontaktDager - b.sisteKontaktDager)
      .slice(0, 3);
  }, []);

  const goTo = (id: string) => navigate(`/design-lab/kontakter/${id}`);

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <TopStrip />

      <div className="max-w-[1200px] mx-auto px-6 py-8">
        {/* Priority cards */}
        <div className="mb-10">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[20px] font-bold text-[#111827]">Ring neste</h2>
            <span className="text-[13px] text-[#9CA3AF]">
              {new Date().toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}
            </span>
          </div>
          <div className="flex gap-4">
            {priorities.map((c) => (
              <PriorityCard key={c.id} contact={c} onClick={() => goTo(c.id)} />
            ))}
          </div>
        </div>

        {/* All contacts */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-semibold text-[#111827]">
              Alle kontakter
              <span className="ml-2 text-[13px] font-normal text-[#9CA3AF]">{filtered.length}</span>
            </h2>
            <div className="flex items-center gap-2">
              <div className="relative mr-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Søk…"
                  className="h-8 pl-8 pr-3 rounded-lg text-sm outline-none bg-white border border-[#E5E7EB] w-48 focus:w-64 transition-all text-[#111827]"
                  style={{ fontFamily: "Inter, system-ui, sans-serif" }}
                />
              </div>
              <FilterPill label="Eier" value={ownerFilter} options={OWNERS} onChange={setOwnerFilter} />
              <FilterPill label="Signal" value={signalFilter} options={["Alle", ...SIGNALS]} onChange={setSignalFilter} />
              {hasFilters && (
                <button
                  onClick={() => { setSearch(""); setOwnerFilter("Alle"); setSignalFilter("Alle"); }}
                  className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded hover:bg-[#F3F4F6] text-[#9CA3AF] transition-colors"
                >
                  <X className="w-3 h-3" /> Nullstill
                </button>
              )}
            </div>
          </div>

          {/* Column header */}
          <div
            className="flex items-center h-9 text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-[0.06em]"
            style={{ borderBottom: "1px solid #E5E7EB" }}
          >
            <div className="flex-[2] px-4 pl-[19px]">Kontakt</div>
            <div className="flex-[2] px-3">Neste steg</div>
            <div className="flex-[1.2] px-3">Eier</div>
            <div className="w-[100px] px-3 text-right">Sist</div>
          </div>

          {/* Rows */}
          <div>
            {filtered.map((c) => (
              <ContactRow key={c.id} contact={c} onClick={() => goTo(c.id)} />
            ))}
            {filtered.length === 0 && (
              <div className="py-16 text-center text-[14px] text-[#9CA3AF]">
                Ingen kontakter funnet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
