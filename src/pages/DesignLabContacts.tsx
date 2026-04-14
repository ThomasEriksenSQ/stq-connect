import { useState, useMemo } from "react";
import { Search, Phone, Mail, Clock, MoreHorizontal, X, ChevronDown, ExternalLink, ArrowUpDown } from "lucide-react";

// ─── Mock Data ────────────────────────────────────────────────────────────────

interface MockContact {
  id: string;
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  signal: "behov_nå" | "fremtidig" | "kanskje" | "ukjent" | "aldri";
  owner: string;
  cvEmail: boolean;
  lastActivity: string; // relative
  lastActivityDate: string;
  tags: string[];
  notes: string;
  activities: { type: "call" | "meeting"; title: string; date: string; description: string }[];
  tasks: { title: string; dueDate: string; done: boolean }[];
}

const MOCK_CONTACTS: MockContact[] = [
  {
    id: "1", name: "Ola Nordmann", title: "CTO", company: "Equinor ASA",
    email: "ola@equinor.com", phone: "+47 900 00 001",
    signal: "behov_nå", owner: "Jon Richard Nygaard", cvEmail: true,
    lastActivity: "3d", lastActivityDate: "11. apr 2026",
    tags: ["Java", "Kubernetes", "Azure"],
    notes: "Ønsker 2 seniorkonsulenter til skymigrasjonsprosjekt Q3.",
    activities: [
      { type: "call", title: "Behovsavklaring", date: "11. apr 2026", description: "Diskuterte skymigrasjonsprosjekt. Trenger 2 senior Java/K8s-konsulenter fra august." },
      { type: "meeting", title: "Lunsjmøte Aker Brygge", date: "28. mar 2026", description: "Presenterte Stacq-teamet. Ola viste interesse for DevOps-kompetanse." },
    ],
    tasks: [
      { title: "Send CV-er Java/K8s", dueDate: "15. apr 2026", done: false },
    ],
  },
  {
    id: "2", name: "Kari Hansen", title: "VP Engineering", company: "DNB",
    email: "kari.hansen@dnb.no", phone: "+47 900 00 002",
    signal: "fremtidig", owner: "Thomas Eriksen", cvEmail: true,
    lastActivity: "2u", lastActivityDate: "31. mar 2026",
    tags: ["React", "TypeScript", "AWS"],
    notes: "Budsjett frigjøres i september. Følg opp i august.",
    activities: [
      { type: "call", title: "Kvartalscheck", date: "31. mar 2026", description: "Teamet vokser, men budsjett først i Q4. Følg opp august." },
    ],
    tasks: [
      { title: "Følg opp budsjett Q4", dueDate: "1. aug 2026", done: false },
    ],
  },
  {
    id: "3", name: "Erik Solberg", title: "Tech Lead", company: "Aker Solutions",
    email: "erik.solberg@akersolutions.com", phone: "+47 900 00 003",
    signal: "behov_nå", owner: "Jon Richard Nygaard", cvEmail: true,
    lastActivity: "1d", lastActivityDate: "13. apr 2026",
    tags: ["Python", "ML", "GCP"],
    notes: "Haster — trenger ML-ingeniør innen 2 uker.",
    activities: [
      { type: "call", title: "Hastebehov ML", date: "13. apr 2026", description: "Prosjektet er forsinket. Trenger ML-ingeniør med GCP-erfaring ASAP." },
    ],
    tasks: [
      { title: "Finn ML-kandidat", dueDate: "16. apr 2026", done: false },
    ],
  },
  {
    id: "4", name: "Lise Bakken", title: "IT-sjef", company: "Telenor",
    email: "lise.bakken@telenor.com", phone: "+47 900 00 004",
    signal: "kanskje", owner: "Thomas Eriksen", cvEmail: false,
    lastActivity: "1m", lastActivityDate: "14. mar 2026",
    tags: ["Java", ".NET", "DevOps"],
    notes: "Usikker på om de bruker eksterne konsulenter fremover.",
    activities: [
      { type: "meeting", title: "Introduksjonsmøte", date: "14. mar 2026", description: "Presenterte Stacq. Lise sa de vurderer å insource mer." },
    ],
    tasks: [],
  },
  {
    id: "5", name: "Anders Moe", title: "Innkjøpssjef", company: "Statnett",
    email: "anders.moe@statnett.no", phone: "+47 900 00 005",
    signal: "behov_nå", owner: "Jon Richard Nygaard", cvEmail: true,
    lastActivity: "5d", lastActivityDate: "9. apr 2026",
    tags: ["SAP", "ABAP", "Project Management"],
    notes: "Rammeavtale utløper juni, ny anbudsprosess starter.",
    activities: [
      { type: "call", title: "Rammeavtale-diskusjon", date: "9. apr 2026", description: "Nåværende avtale utløper. Vi bør levere tilbud innen mai." },
      { type: "call", title: "Oppfølging tilbud", date: "2. apr 2026", description: "Sendte over prisindikasjon. Anders sjekker internt." },
    ],
    tasks: [
      { title: "Forbered tilbud rammeavtale", dueDate: "1. mai 2026", done: false },
      { title: "Sjekk SAP-tilgjengelighet", dueDate: "18. apr 2026", done: false },
    ],
  },
  {
    id: "6", name: "Ingrid Fjell", title: "Avdelingsleder Utvikling", company: "Schibsted",
    email: "ingrid.fjell@schibsted.com", phone: "+47 900 00 006",
    signal: "fremtidig", owner: "Thomas Eriksen", cvEmail: true,
    lastActivity: "3u", lastActivityDate: "24. mar 2026",
    tags: ["React", "Node.js", "Kafka"],
    notes: "Bygger nytt team for streaming-plattform H2 2026.",
    activities: [
      { type: "meeting", title: "Strategimøte", date: "24. mar 2026", description: "Diskuterte streaming-plattform roadmap. Trenger 3-4 utviklere fra oktober." },
    ],
    tasks: [
      { title: "Følg opp september", dueDate: "1. sep 2026", done: false },
    ],
  },
  {
    id: "7", name: "Thomas Berg", title: "CIO", company: "Norsk Hydro",
    email: "thomas.berg@hydro.com", phone: "+47 900 00 007",
    signal: "ukjent", owner: "Jon Richard Nygaard", cvEmail: false,
    lastActivity: "2m", lastActivityDate: "14. feb 2026",
    tags: ["SAP", "Azure", "Power Platform"],
    notes: "",
    activities: [],
    tasks: [
      { title: "Book introduksjonsmøte", dueDate: "20. apr 2026", done: false },
    ],
  },
  {
    id: "8", name: "Maria Strand", title: "Director of Engineering", company: "Finn.no",
    email: "maria.strand@finn.no", phone: "+47 900 00 008",
    signal: "behov_nå", owner: "Thomas Eriksen", cvEmail: true,
    lastActivity: "2d", lastActivityDate: "12. apr 2026",
    tags: ["Kotlin", "React", "Elasticsearch"],
    notes: "Trenger 1 senior backend + 1 frontend. Oppstart mai.",
    activities: [
      { type: "call", title: "Behovsgjennomgang", date: "12. apr 2026", description: "2 roller: Senior Kotlin backend og React frontend. Oppstart 1. mai." },
      { type: "meeting", title: "Kontorsbesøk", date: "5. apr 2026", description: "Besøkte Finn-kontoret. Godt kulturmatch med våre konsulenter." },
    ],
    tasks: [
      { title: "Send 3 CV-er backend", dueDate: "16. apr 2026", done: false },
      { title: "Send 2 CV-er frontend", dueDate: "17. apr 2026", done: false },
    ],
  },
  {
    id: "9", name: "Henrik Lund", title: "Teamleder DevOps", company: "Kongsberg Digital",
    email: "henrik.lund@kongsberg.com", phone: "+47 900 00 009",
    signal: "fremtidig", owner: "Jon Richard Nygaard", cvEmail: true,
    lastActivity: "1u", lastActivityDate: "7. apr 2026",
    tags: ["Terraform", "AWS", "Docker", "CI/CD"],
    notes: "Vurderer å utvide DevOps-teamet Q1 2027.",
    activities: [
      { type: "call", title: "Status DevOps-team", date: "7. apr 2026", description: "Teamet fungerer bra, men ser behov for skalering neste år." },
    ],
    tasks: [],
  },
  {
    id: "10", name: "Silje Haugen", title: "Prosjektleder", company: "Gjensidige",
    email: "silje.haugen@gjensidige.no", phone: "+47 900 00 010",
    signal: "aldri", owner: "Thomas Eriksen", cvEmail: false,
    lastActivity: "3m", lastActivityDate: "14. jan 2026",
    tags: [".NET", "Azure"],
    notes: "Bruker kun interne ressurser. Ikke aktuell.",
    activities: [
      { type: "call", title: "Avklaring", date: "14. jan 2026", description: "Gjensidige har policy mot eksterne konsulenter i denne avdelingen." },
    ],
    tasks: [],
  },
  {
    id: "11", name: "Petter Dahl", title: "VP Platform", company: "Vipps",
    email: "petter.dahl@vipps.no", phone: "+47 900 00 011",
    signal: "behov_nå", owner: "Jon Richard Nygaard", cvEmail: true,
    lastActivity: "1d", lastActivityDate: "13. apr 2026",
    tags: ["Kotlin", "Kubernetes", "PostgreSQL"],
    notes: "Haster! Trenger backend-utvikler med Kotlin/K8s ASAP.",
    activities: [
      { type: "call", title: "Hastebehov backend", date: "13. apr 2026", description: "Utvikler sluttet brått. Trenger erstatter umiddelbart." },
    ],
    tasks: [
      { title: "Match Kotlin-konsulenter", dueDate: "15. apr 2026", done: false },
    ],
  },
  {
    id: "12", name: "Nina Kristiansen", title: "Rekrutteringsansvarlig", company: "Yara International",
    email: "nina.k@yara.com", phone: "+47 900 00 012",
    signal: "kanskje", owner: "Thomas Eriksen", cvEmail: true,
    lastActivity: "2u", lastActivityDate: "31. mar 2026",
    tags: ["SAP", "Data Engineering"],
    notes: "Vurderer konsulentbruk for SAP S/4HANA-migrering.",
    activities: [
      { type: "meeting", title: "SAP-workshop", date: "31. mar 2026", description: "Deltok på workshop om S/4HANA. Nina åpen for tilbud men må forankre internt." },
    ],
    tasks: [
      { title: "Send SAP-referanser", dueDate: "20. apr 2026", done: false },
    ],
  },
];

const SIGNAL_CONFIG = {
  behov_nå: { label: "Behov nå", dotClass: "bg-emerald-500", sortOrder: 1 },
  fremtidig: { label: "Fremtidig", dotClass: "bg-blue-500", sortOrder: 2 },
  kanskje: { label: "Kanskje", dotClass: "bg-amber-500", sortOrder: 3 },
  ukjent: { label: "Ukjent", dotClass: "bg-gray-400", sortOrder: 4 },
  aldri: { label: "Aldri aktuelt", dotClass: "bg-red-500", sortOrder: 5 },
} as const;

const OWNERS = ["Alle", "Jon Richard Nygaard", "Thomas Eriksen"];
const SIGNALS = ["Alle", "Behov nå", "Fremtidig", "Kanskje", "Ukjent", "Aldri aktuelt"];

// ─── Components ───────────────────────────────────────────────────────────────

function FacetPill({ label, value, options, onChange }: {
  label: string; value: string; options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isActive = value !== "Alle";
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium tracking-wide uppercase rounded-full border transition-all
          ${isActive
            ? "bg-[#6366F1] text-white border-[#6366F1]"
            : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#D1D5DB] hover:bg-[#F9FAFB]"
          }`}
      >
        {label}: {isActive ? value : "Alle"}
        {isActive ? (
          <X className="w-3 h-3 ml-0.5 cursor-pointer" onClick={(e) => { e.stopPropagation(); onChange("Alle"); setOpen(false); }} />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg shadow-lg border border-[#E5E7EB] py-1 min-w-[160px]">
            {options.map(opt => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`block w-full text-left px-3 py-1.5 text-[13px] transition-colors
                  ${opt === value ? "bg-[#EEF2FF] text-[#6366F1] font-medium" : "text-[#374151] hover:bg-[#F9FAFB]"}`}
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

function ContactRow({ contact, isSelected, onClick }: {
  contact: MockContact; isSelected: boolean; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const sig = SIGNAL_CONFIG[contact.signal];

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group grid grid-cols-[1fr_120px_100px] items-center px-5 cursor-pointer transition-all border-l-2
        ${isSelected
          ? "bg-[#EEF2FF] border-l-[#6366F1]"
          : hovered
            ? "bg-[#FAFBFC] border-l-transparent"
            : "bg-white border-l-transparent"
        }`}
      style={{ minHeight: hovered ? 64 : 52 }}
    >
      {/* Col 1: Identity */}
      <div className="flex items-center gap-3 py-2 min-w-0">
        <div className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[11px] font-semibold text-[#6B7280] shrink-0 uppercase">
          {contact.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-[#111827] truncate">{contact.name}</span>
            {contact.cvEmail && (
              <span className="text-[10px] font-medium text-[#6366F1] bg-[#EEF2FF] rounded px-1.5 py-0.5 shrink-0">CV</span>
            )}
          </div>
          <div className="text-[13px] text-[#9CA3AF] truncate">
            {contact.title} · {contact.company}
          </div>
        </div>
      </div>

      {/* Col 2: Signal */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full shrink-0 ${sig.dotClass}`} />
        <span className="text-[12px] text-[#6B7280] font-medium">{sig.label}</span>
      </div>

      {/* Col 3: Time + Actions */}
      <div className="flex items-center justify-end gap-1">
        {hovered ? (
          <div className="flex items-center gap-0.5">
            <button className="w-7 h-7 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#6366F1] hover:bg-[#EEF2FF] transition-colors" title="Ring">
              <Phone className="w-3.5 h-3.5" />
            </button>
            <button className="w-7 h-7 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#6366F1] hover:bg-[#EEF2FF] transition-colors" title="E-post">
              <Mail className="w-3.5 h-3.5" />
            </button>
            <button className="w-7 h-7 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#6366F1] hover:bg-[#EEF2FF] transition-colors" title="Oppfølging">
              <Clock className="w-3.5 h-3.5" />
            </button>
            <button className="w-7 h-7 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#6366F1] hover:bg-[#EEF2FF] transition-colors" title="Mer">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <span className="text-[12px] text-[#9CA3AF]">{contact.lastActivity}</span>
        )}
      </div>
    </div>
  );
}

function DetailPanel({ contact, onClose }: { contact: MockContact; onClose: () => void }) {
  const sig = SIGNAL_CONFIG[contact.signal];

  return (
    <div className="h-full flex flex-col bg-white border-l border-[#E5E7EB] overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-[#F3F4F6]">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[13px] font-semibold text-[#6B7280] uppercase">
              {contact.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            <div>
              <h2 className="text-[18px] font-bold text-[#111827]">{contact.name}</h2>
              <p className="text-[13px] text-[#9CA3AF]">{contact.title} · {contact.company}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Signal + Owner */}
        <div className="flex items-center gap-3 mb-4">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#E5E7EB] text-[12px] font-medium text-[#374151]">
            <div className={`w-2 h-2 rounded-full ${sig.dotClass}`} />
            {sig.label}
          </div>
          <span className="text-[12px] text-[#9CA3AF]">Eier: {contact.owner}</span>
        </div>

        {/* Contact info */}
        <div className="flex flex-col gap-1.5">
          <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-2 text-[13px] text-[#6366F1] hover:underline">
            <Mail className="w-3.5 h-3.5" /> {contact.email}
          </a>
          <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-2 text-[13px] text-[#374151]">
            <Phone className="w-3.5 h-3.5 text-[#9CA3AF]" /> {contact.phone}
          </a>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Tags */}
        {contact.tags.length > 0 && (
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF] mb-2">Teknologier</h3>
            <div className="flex flex-wrap gap-1.5">
              {contact.tags.map(tag => (
                <span key={tag} className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#F3F4F6] text-[#374151]">{tag}</span>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {contact.notes && (
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF] mb-2">Notater</h3>
            <p className="text-[13px] text-[#374151] leading-relaxed">{contact.notes}</p>
          </div>
        )}

        {/* Tasks */}
        {contact.tasks.length > 0 && (
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF] mb-2">Oppfølginger</h3>
            <div className="space-y-2">
              {contact.tasks.map((task, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg border border-[#F3F4F6] bg-[#FAFBFC]">
                  <div className={`w-4 h-4 rounded border-2 mt-0.5 shrink-0 flex items-center justify-center
                    ${task.done ? "bg-[#6366F1] border-[#6366F1]" : "border-[#D1D5DB]"}`}>
                    {task.done && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" fill="none" /></svg>}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium text-[#111827]">{task.title}</div>
                    <div className="text-[11px] text-[#9CA3AF]">{task.dueDate}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activities */}
        {contact.activities.length > 0 && (
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF] mb-2">Aktiviteter</h3>
            <div className="space-y-3">
              {contact.activities.map((act, i) => (
                <div key={i} className="flex gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5
                    ${act.type === "call" ? "bg-emerald-50 text-emerald-600" : "bg-[#EEF2FF] text-[#6366F1]"}`}>
                    {act.type === "call" ? <Phone className="w-3 h-3" /> : <ExternalLink className="w-3 h-3" />}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-[#111827]">{act.title}</div>
                    <div className="text-[11px] text-[#9CA3AF] mb-1">{act.date}</div>
                    <p className="text-[12px] text-[#6B7280] leading-relaxed">{act.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-6 py-3 border-t border-[#F3F4F6] flex gap-2">
        <button className="flex-1 h-9 rounded-lg bg-[#6366F1] text-white text-[13px] font-medium hover:bg-[#5558E6] transition-colors">
          Logg samtale
        </button>
        <button className="flex-1 h-9 rounded-lg border border-[#E5E7EB] bg-white text-[#374151] text-[13px] font-medium hover:bg-[#F9FAFB] transition-colors">
          Ny oppfølging
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type SortField = "name" | "signal" | "activity";
type SortDir = "asc" | "desc";

export default function DesignLabContacts() {
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("Alle");
  const [signalFilter, setSignalFilter] = useState("Alle");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("signal");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    let list = MOCK_CONTACTS;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    if (ownerFilter !== "Alle") list = list.filter(c => c.owner === ownerFilter);
    if (signalFilter !== "Alle") {
      const signalKey = Object.entries(SIGNAL_CONFIG).find(([, v]) => v.label === signalFilter)?.[0];
      if (signalKey) list = list.filter(c => c.signal === signalKey);
    }

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name, "nb");
      else if (sortField === "signal") cmp = SIGNAL_CONFIG[a.signal].sortOrder - SIGNAL_CONFIG[b.signal].sortOrder;
      else cmp = 0; // activity sort by mock order
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [search, ownerFilter, signalFilter, sortField, sortDir]);

  const selected = MOCK_CONTACTS.find(c => c.id === selectedId) || null;

  return (
    <div className="design-lab h-screen flex flex-col bg-[#FAFAFA]" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      {/* Top bar */}
      <div className="bg-white border-b border-[#E5E7EB] px-6 py-4">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <h1 className="text-[28px] font-bold text-[#111827] tracking-tight">Kontakter</h1>
              <p className="text-[13px] text-[#9CA3AF] mt-0.5">{filtered.length} av {MOCK_CONTACTS.length} kontakter</p>
            </div>
            <span className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider bg-[#F3F4F6] px-2.5 py-1 rounded-full">
              Design Lab
            </span>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Søk kontakter, selskaper, teknologier…"
              className="w-full h-10 pl-10 pr-16 rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] text-[14px] text-[#111827] placeholder:text-[#D1D5DB] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#D1D5DB] border border-[#E5E7EB] rounded px-1.5 py-0.5 font-mono">⌘K</kbd>
          </div>

          {/* Facet filters */}
          <div className="flex items-center gap-2">
            <FacetPill label="Eier" value={ownerFilter} options={OWNERS} onChange={setOwnerFilter} />
            <FacetPill label="Signal" value={signalFilter} options={SIGNALS} onChange={setSignalFilter} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* List */}
        <div className={`flex-1 flex flex-col min-w-0 transition-all ${selected ? "max-w-[60%]" : ""}`}>
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_120px_100px] items-center px-5 h-9 bg-[#FAFAFA] border-b border-[#F3F4F6]">
            <button onClick={() => toggleSort("name")} className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF] hover:text-[#6B7280]">
              Kontakt <ArrowUpDown className="w-3 h-3" />
            </button>
            <button onClick={() => toggleSort("signal")} className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF] hover:text-[#6B7280]">
              Signal <ArrowUpDown className="w-3 h-3" />
            </button>
            <div className="text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]">Sist</div>
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#F3F4F6]">
            {filtered.map(contact => (
              <ContactRow
                key={contact.id}
                contact={contact}
                isSelected={selectedId === contact.id}
                onClick={() => setSelectedId(selectedId === contact.id ? null : contact.id)}
              />
            ))}
            {filtered.length === 0 && (
              <div className="flex items-center justify-center h-32 text-[14px] text-[#9CA3AF]">
                Ingen kontakter funnet
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-[40%] min-w-[360px] max-w-[520px] border-l border-[#E5E7EB] bg-white">
            <DetailPanel contact={selected} onClose={() => setSelectedId(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
