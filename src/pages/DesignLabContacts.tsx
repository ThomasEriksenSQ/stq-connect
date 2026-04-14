import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Phone, Mail, Clock, ChevronDown, X, ArrowUpDown, ArrowUp, ArrowDown, MessageCircle, FileText } from "lucide-react";

// ── Mock Data ──────────────────────────────────────────────────────
type Signal = "Behov nå" | "Fremtidig behov" | "Har kanskje behov" | "Ukjent om behov" | "Aldri aktuelt";
type Owner = "Jon Richard Nygaard" | "Thomas Eriksen";

interface MockContact {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  signal: Signal;
  owner: Owner;
  hasCv: boolean;
  cvUnsubscribed: boolean;
  technologies: string[];
  lastActivityDaysAgo: number;
  notes: string;
  tasks: { title: string; dueDate: string }[];
  activities: { type: "call" | "meeting"; subject: string; date: string; description: string }[];
}

const MOCK_CONTACTS: MockContact[] = [
  { id: "1", firstName: "Erik", lastName: "Solberg", title: "Tech Lead", company: "Aker Solutions", email: "erik.solberg@aker.no", phone: "+47 900 11 222", signal: "Behov nå", owner: "Jon Richard Nygaard", hasCv: true, cvUnsubscribed: false, technologies: ["Python", "ML", "GCP"], lastActivityDaysAgo: 1, notes: "Haster — trenger ML-ingeniør innen 2 uker.", tasks: [{ title: "Finn ML-kandidat", dueDate: "2026-04-16" }], activities: [{ type: "call", subject: "Hastebehov ML", date: "2026-04-13", description: "Prosjektet er forsinket, trenger senior ML-ingeniør ASAP." }] },
  { id: "2", firstName: "Kari", lastName: "Hansen", title: "VP Engineering", company: "DNB", email: "kari.hansen@dnb.no", phone: "+47 911 22 333", signal: "Behov nå", owner: "Jon Richard Nygaard", hasCv: true, cvUnsubscribed: false, technologies: ["Java", "Kotlin", "AWS"], lastActivityDaysAgo: 3, notes: "Bygger nytt team for digital bankplattform.", tasks: [{ title: "Send CV-pakke", dueDate: "2026-04-18" }], activities: [{ type: "meeting", subject: "Kvartalsplanlegging", date: "2026-04-11", description: "Gjennomgikk bemanningsplan Q2. Trenger 3 backend-utviklere." }] },
  { id: "3", firstName: "Lars", lastName: "Moen", title: "CTO", company: "Equinor ASA", email: "lars.moen@equinor.com", phone: "+47 922 33 444", signal: "Fremtidig behov", owner: "Thomas Eriksen", hasCv: false, cvUnsubscribed: false, technologies: ["Azure", "DevOps", "Terraform"], lastActivityDaysAgo: 7, notes: "", tasks: [], activities: [{ type: "call", subject: "Oppfølging etter konferanse", date: "2026-04-07", description: "Møttes på NDC. Interessert i DevOps-kompetanse fra Q3." }] },
  { id: "4", firstName: "Marte", lastName: "Olsen", title: "Engineering Manager", company: "Telenor Digital", email: "marte.olsen@telenor.com", phone: "+47 933 44 555", signal: "Fremtidig behov", owner: "Jon Richard Nygaard", hasCv: true, cvUnsubscribed: false, technologies: ["React", "TypeScript", "Node.js"], lastActivityDaysAgo: 14, notes: "Vurderer å bruke eksterne konsulenter fra august.", tasks: [{ title: "Følg opp i mai", dueDate: "2026-05-01" }], activities: [{ type: "call", subject: "Intro samtale", date: "2026-03-31", description: "Presenterte Stacq og våre konsulenter. Positiv respons." }] },
  { id: "5", firstName: "Anders", lastName: "Berg", title: "Innkjøpssjef IT", company: "Posten Norge", email: "anders.berg@posten.no", phone: "+47 944 55 666", signal: "Har kanskje behov", owner: "Thomas Eriksen", hasCv: false, cvUnsubscribed: false, technologies: [], lastActivityDaysAgo: 30, notes: "Har rammeavtale med annen leverandør, men er åpen for dialog.", tasks: [], activities: [{ type: "meeting", subject: "Leverandørmøte", date: "2026-03-15", description: "Diskuterte muligheten for spot-kjøp utenfor rammeavtalen." }] },
  { id: "6", firstName: "Silje", lastName: "Strand", title: "Head of Data", company: "Schibsted", email: "silje.strand@schibsted.com", phone: "+47 955 66 777", signal: "Behov nå", owner: "Thomas Eriksen", hasCv: true, cvUnsubscribed: false, technologies: ["Python", "Spark", "Databricks"], lastActivityDaysAgo: 2, notes: "Trenger data engineer til VG-prosjektet.", tasks: [{ title: "Send profiler", dueDate: "2026-04-15" }], activities: [{ type: "call", subject: "Nytt dataprosjekt", date: "2026-04-12", description: "VG skal bygge ny dataplattform. Trenger 2 data engineers." }] },
  { id: "7", firstName: "Petter", lastName: "Dahl", title: "Seniorrådgiver", company: "Statens Vegvesen", email: "petter.dahl@vegvesen.no", phone: "+47 966 77 888", signal: "Ukjent om behov", owner: "Jon Richard Nygaard", hasCv: false, cvUnsubscribed: false, technologies: ["Java", ".NET"], lastActivityDaysAgo: 60, notes: "", tasks: [], activities: [] },
  { id: "8", firstName: "Ingrid", lastName: "Lund", title: "Utviklingssjef", company: "Sparebank 1", email: "ingrid.lund@sparebank1.no", phone: "+47 977 88 999", signal: "Fremtidig behov", owner: "Thomas Eriksen", hasCv: true, cvUnsubscribed: true, technologies: ["React", "Java", "Kubernetes"], lastActivityDaysAgo: 5, notes: "Vil gjerne ha oppdatering om tilgjengelige React-utviklere i juni.", tasks: [{ title: "Send tilgjengelighetsliste", dueDate: "2026-05-20" }], activities: [{ type: "call", subject: "Status Q2", date: "2026-04-09", description: "Har budsjett fra juni. Trenger frontend-team." }] },
  { id: "9", firstName: "Thomas", lastName: "Vik", title: "IT-direktør", company: "Hydro ASA", email: "thomas.vik@hydro.com", phone: "+47 988 99 000", signal: "Aldri aktuelt", owner: "Jon Richard Nygaard", hasCv: false, cvUnsubscribed: false, technologies: [], lastActivityDaysAgo: 120, notes: "Bruker kun internressurser. Ikke relevant.", tasks: [], activities: [] },
  { id: "10", firstName: "Camilla", lastName: "Roth", title: "Product Lead", company: "Vipps MobilePay", email: "camilla.roth@vipps.no", phone: "+47 900 12 345", signal: "Behov nå", owner: "Jon Richard Nygaard", hasCv: true, cvUnsubscribed: false, technologies: ["Kotlin", "Swift", "React Native"], lastActivityDaysAgo: 0, notes: "Akutt behov for mobil-utviklere.", tasks: [{ title: "Intervju med kandidat", dueDate: "2026-04-14" }], activities: [{ type: "call", subject: "Hastebehov mobil", date: "2026-04-14", description: "Trenger 2 mobilutviklere umiddelbart. Prosjektstart neste uke." }] },
  { id: "11", firstName: "Henrik", lastName: "Paulsen", title: "Avdelingsleder", company: "Kongsberg Digital", email: "henrik.paulsen@kdi.no", phone: "+47 911 23 456", signal: "Har kanskje behov", owner: "Thomas Eriksen", hasCv: false, cvUnsubscribed: false, technologies: ["C++", "Python", "ROS"], lastActivityDaysAgo: 45, notes: "", tasks: [], activities: [{ type: "meeting", subject: "Teknisk demo", date: "2026-03-01", description: "Viste frem simuleringsplattform. Kan trenge robotikk-kompetanse." }] },
  { id: "12", firstName: "Julie", lastName: "Sæther", title: "CTO", company: "Kahoot!", email: "julie.saether@kahoot.com", phone: "+47 922 34 567", signal: "Fremtidig behov", owner: "Jon Richard Nygaard", hasCv: true, cvUnsubscribed: false, technologies: ["TypeScript", "Go", "AWS"], lastActivityDaysAgo: 10, notes: "Planlegger stor skalering i Q3.", tasks: [{ title: "Book Q3-planlegging", dueDate: "2026-05-15" }], activities: [{ type: "call", subject: "Skaleringsplaner", date: "2026-04-04", description: "Forventer 5x trafikkvekst. Trenger infrastruktur-team." }] },
];

const SIGNAL_CONFIG: Record<Signal, { dot: string; label: string }> = {
  "Behov nå": { dot: "bg-emerald-500", label: "Behov nå" },
  "Fremtidig behov": { dot: "bg-blue-500", label: "Fremtidig" },
  "Har kanskje behov": { dot: "bg-amber-500", label: "Kanskje" },
  "Ukjent om behov": { dot: "bg-gray-400", label: "Ukjent" },
  "Aldri aktuelt": { dot: "bg-red-500", label: "Aldri" },
};

const OWNER_INITIALS: Record<Owner, string> = {
  "Jon Richard Nygaard": "JRN",
  "Thomas Eriksen": "TE",
};

function relativeTime(daysAgo: number): string {
  if (daysAgo === 0) return "I dag";
  if (daysAgo === 1) return "1d";
  if (daysAgo < 7) return `${daysAgo}d`;
  if (daysAgo < 30) return `${Math.floor(daysAgo / 7)}u`;
  if (daysAgo < 365) return `${Math.floor(daysAgo / 30)}mnd`;
  return `${Math.floor(daysAgo / 365)}år`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];
  return `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Filter dropdown ──────────────────────────────────────────────
function FacetFilter({ label, options, value, onChange }: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const isActive = value !== null;

  return (
    <div className="relative">
      {open && <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />}
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-full border transition-colors ${
          isActive
            ? "bg-indigo-50 border-indigo-200 text-indigo-700"
            : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
        }`}
      >
        {isActive ? `${label}: ${value}` : label}
        {isActive ? (
          <X className="w-3 h-3 ml-0.5" onClick={(e) => { e.stopPropagation(); onChange(null); }} />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-gray-50 transition-colors ${
                value === opt ? "text-indigo-700 font-medium" : "text-gray-700"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sort header ──────────────────────────────────────────────────
type SortField = "name" | "signal" | "owner" | "last";
type SortDir = "asc" | "desc";

function SortHeader({ label, field, current, dir, onSort, className }: {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const active = current === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors ${
        active ? "text-indigo-700" : "text-gray-500 hover:text-gray-700"
      } ${className || ""}`}
    >
      {label}
      {active ? (
        dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-40" />
      )}
    </button>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────
function DetailPanel({ contact, onClose }: { contact: MockContact; onClose: () => void }) {
  const navigate = useNavigate();
  const sig = SIGNAL_CONFIG[contact.signal];

  return (
    <div className="w-[420px] shrink-0 border-l border-gray-200 bg-white h-full overflow-y-auto">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <button
              onClick={() => navigate(`/design-lab/kontakter/${contact.id}`)}
              className="text-[20px] font-bold text-gray-900 hover:text-indigo-700 transition-colors"
            >
              {contact.firstName} {contact.lastName}
            </button>
            <p className="text-[13px] text-gray-500 mt-0.5">{contact.title} · {contact.company}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-6">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-gray-700">
            <span className={`w-2 h-2 rounded-full ${sig.dot}`} />
            {sig.label}
          </span>
          {contact.hasCv && (
            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
              contact.cvUnsubscribed ? "bg-red-50 text-red-600" : "bg-indigo-50 text-indigo-700"
            }`}>
              CV{contact.cvUnsubscribed ? " ✗" : ""}
            </span>
          )}
          <span className="text-[12px] text-gray-400 ml-auto">{contact.owner}</span>
        </div>

        <div className="space-y-2 mb-6">
          <div className="flex items-center gap-2 text-[13px] text-gray-700">
            <Mail className="w-3.5 h-3.5 text-gray-400" />
            {contact.email}
          </div>
          <div className="flex items-center gap-2 text-[13px] text-gray-700">
            <Phone className="w-3.5 h-3.5 text-gray-400" />
            {contact.phone}
          </div>
          {contact.technologies.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {contact.technologies.map(t => (
                <span key={t} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 mb-8">
          <button className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
            <Phone className="w-3.5 h-3.5" />
            Logg samtale
          </button>
          <button className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            Ny oppfølging
          </button>
        </div>

        {contact.tasks.length > 0 && (
          <div className="mb-8">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500 mb-3">Oppfølginger</h3>
            <div className="space-y-2">
              {contact.tasks.map((t, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 border border-gray-100">
                  <span className="text-[13px] text-gray-700">{t.title}</span>
                  <span className="text-[12px] font-medium text-gray-400">{formatDate(t.dueDate)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {contact.activities.length > 0 && (
          <div className="mb-8">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500 mb-3">Aktiviteter</h3>
            <div className="space-y-3">
              {contact.activities.map((a, i) => (
                <div key={i} className="relative pl-6">
                  {i < contact.activities.length - 1 && (
                    <div className="absolute left-[5px] top-[14px] bottom-[-8px] w-[2px] bg-gray-200" />
                  )}
                  <div className={`absolute left-0 top-[4px] w-[12px] h-[12px] rounded-full flex items-center justify-center ${
                    a.type === "call" ? "bg-emerald-50" : "bg-indigo-50"
                  }`}>
                    {a.type === "call" ? (
                      <MessageCircle className="w-2 h-2 text-emerald-600" />
                    ) : (
                      <FileText className="w-2 h-2 text-indigo-700" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-gray-900">{a.subject}</span>
                      <span className="text-[12px] text-gray-400">{formatDate(a.date)}</span>
                    </div>
                    <p className="text-[13px] text-gray-500 mt-0.5 leading-relaxed">{a.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {contact.notes && (
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500 mb-3">Notater</h3>
            <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{contact.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SIGNAL SORT ORDER ────────────────────────────────────────────
const SIGNAL_ORDER: Record<Signal, number> = {
  "Behov nå": 0, "Fremtidig behov": 1, "Har kanskje behov": 2, "Ukjent om behov": 3, "Aldri aktuelt": 4,
};

// ── Main Page ────────────────────────────────────────────────────
export default function DesignLabContacts() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [signalFilter, setSignalFilter] = useState<string | null>(null);
  const [cvFilter, setCvFilter] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("last");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [headerShadow, setHeaderShadow] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const handler = () => setHeaderShadow(el.scrollTop > 0);
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, []);

  const hasFilters = ownerFilter || signalFilter || cvFilter;

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    let list = [...MOCK_CONTACTS];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.technologies.some(t => t.toLowerCase().includes(q))
      );
    }
    if (ownerFilter) list = list.filter(c => c.owner === ownerFilter);
    if (signalFilter) list = list.filter(c => c.signal === signalFilter);
    if (cvFilter === "Har CV") list = list.filter(c => c.hasCv && !c.cvUnsubscribed);
    if (cvFilter === "Avmeldt CV") list = list.filter(c => c.cvUnsubscribed);
    if (cvFilter === "Ingen CV") list = list.filter(c => !c.hasCv);
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`); break;
        case "signal": cmp = SIGNAL_ORDER[a.signal] - SIGNAL_ORDER[b.signal]; break;
        case "owner": cmp = a.owner.localeCompare(b.owner); break;
        case "last": cmp = a.lastActivityDaysAgo - b.lastActivityDaysAgo; break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return list;
  }, [search, ownerFilter, signalFilter, cvFilter, sortField, sortDir]);

  const selectedContact = selectedId ? MOCK_CONTACTS.find(c => c.id === selectedId) : null;

  return (
    <div className="h-screen flex flex-col" style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#FAFBFC" }}>
      {/* Top bar */}
      <div className="h-12 border-b border-gray-200 bg-white flex items-center px-6 shrink-0">
        <span className="text-[13px] font-bold text-gray-900 tracking-[0.02em]">STACQ</span>
        <span className="text-[13px] text-gray-400 ml-2">· Design Lab</span>
      </div>

      {/* Header */}
      <div className={`bg-white px-8 pt-8 pb-0 shrink-0 transition-shadow duration-200 ${headerShadow ? "shadow-sm" : ""}`}>
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-[28px] font-bold text-gray-900">Kontakter</h1>
          <span className="text-[13px] text-gray-400">{filtered.length} kontakter</span>
        </div>

        <div className="relative mb-5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Søk kontakter, selskaper, teknologier…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-16 text-[13px] border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
            style={{ background: "#FAFBFC" }}
          />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-medium">⌘K</span>
        </div>

        <div className="flex items-center gap-2 pb-5">
          <FacetFilter label="Eier" options={["Jon Richard Nygaard", "Thomas Eriksen"]} value={ownerFilter} onChange={setOwnerFilter} />
          <FacetFilter label="Signal" options={["Behov nå", "Fremtidig behov", "Har kanskje behov", "Ukjent om behov", "Aldri aktuelt"]} value={signalFilter} onChange={setSignalFilter} />
          <FacetFilter label="CV" options={["Har CV", "Avmeldt CV", "Ingen CV"]} value={cvFilter} onChange={setCvFilter} />
          {hasFilters && (
            <button
              onClick={() => { setOwnerFilter(null); setSignalFilter(null); setCvFilter(null); }}
              className="text-[12px] text-indigo-700 hover:text-indigo-900 font-medium ml-1 transition-colors"
            >
              Nullstill
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        <div ref={listRef} className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-[1fr_140px_140px_80px] px-8 py-3 border-b border-gray-200 sticky top-0 z-10" style={{ background: "#FAFBFC" }}>
            <SortHeader label="Kontakt" field="name" current={sortField} dir={sortDir} onSort={handleSort} />
            <SortHeader label="Signal" field="signal" current={sortField} dir={sortDir} onSort={handleSort} />
            <SortHeader label="Eier" field="owner" current={sortField} dir={sortDir} onSort={handleSort} />
            <SortHeader label="Sist" field="last" current={sortField} dir={sortDir} onSort={handleSort} className="justify-end" />
          </div>

          <div className="divide-y divide-gray-100">
            {filtered.map(contact => {
              const sig = SIGNAL_CONFIG[contact.signal];
              const isSelected = selectedId === contact.id;
              return (
                <div
                  key={contact.id}
                  onClick={() => setSelectedId(isSelected ? null : contact.id)}
                  className={`group grid grid-cols-[1fr_140px_140px_80px] items-center px-8 h-14 cursor-pointer transition-colors ${
                    isSelected ? "bg-indigo-50/30" : "hover:bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[11px] font-bold text-gray-500 shrink-0">
                      {contact.firstName[0]}{contact.lastName[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/design-lab/kontakter/${contact.id}`); }}
                          className="text-[14px] font-semibold text-gray-900 hover:text-indigo-700 transition-colors truncate"
                        >
                          {contact.firstName} {contact.lastName}
                        </button>
                        {contact.hasCv && (
                          <span className={`text-[10px] font-bold px-1 py-px rounded ${
                            contact.cvUnsubscribed ? "bg-red-50 text-red-600" : "bg-indigo-50 text-indigo-700"
                          }`}>
                            CV{contact.cvUnsubscribed ? " ✗" : ""}
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-gray-400 truncate">{contact.title} · {contact.company}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${sig.dot}`} />
                    <span className="text-[12px] font-medium text-gray-700">{sig.label}</span>
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {OWNER_INITIALS[contact.owner]}
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-1">
                    <span className="text-[12px] font-medium text-gray-400 group-hover:hidden">
                      {relativeTime(contact.lastActivityDaysAgo)}
                    </span>
                    <div className="hidden group-hover:flex items-center gap-0.5">
                      <button className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-emerald-600 transition-colors">
                        <Phone className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-700 transition-colors">
                        <Mail className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-amber-500 transition-colors">
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="hidden group-hover:inline text-[12px] font-medium text-gray-400 ml-1">
                      {relativeTime(contact.lastActivityDaysAgo)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <Search className="w-8 h-8 text-gray-200 mb-3" />
              <p className="text-[13px] text-gray-400">Ingen kontakter funnet</p>
            </div>
          )}
        </div>

        {selectedContact && (
          <DetailPanel contact={selectedContact} onClose={() => setSelectedId(null)} />
        )}
      </div>
    </div>
  );
}
