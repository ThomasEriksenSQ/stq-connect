import { useState, useMemo, useCallback } from "react";
import { Search, ChevronDown, ChevronUp, X, Phone, Mail, MessageCircle, FileText, Calendar, ExternalLink, Check } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { format, subDays, subMonths } from "date-fns";
import { nb } from "date-fns/locale";

/* ═══════════════════════════════════════════════════════════
   TYPES & DATA
   ═══════════════════════════════════════════════════════════ */

type Signal = "Behov nå" | "Fremtidig behov" | "Har kanskje behov" | "Ukjent om behov" | "Aldri aktuelt";

const SIGNAL_DOT: Record<Signal, string> = {
  "Behov nå": "#22C55E",
  "Fremtidig behov": "#3B82F6",
  "Har kanskje behov": "#F59E0B",
  "Ukjent om behov": "#A3A3A3",
  "Aldri aktuelt": "#EF4444",
};

interface Activity {
  id: string;
  type: "Samtale" | "Møte" | "E-post";
  subject: string;
  description: string;
  date: Date;
}

interface Task {
  id: string;
  title: string;
  dueDate: Date;
  done: boolean;
}

interface ConsultantMatch {
  name: string;
  title: string;
  matchPct: number;
  tags: string[];
}

interface Contact {
  id: string;
  navn: string;
  stilling: string;
  selskap: string;
  signal: Signal;
  eier: string;
  epost: string;
  telefon: string;
  linkedin: string;
  sisteKontaktDager: number;
  sisteType: "Samtale" | "Møte" | "E-post";
  activities: Activity[];
  tasks: Task[];
  consultantMatches: ConsultantMatch[];
}

const now = new Date();

const CONTACTS: Contact[] = [
  {
    id: "1", navn: "Erik Solberg", stilling: "Tech Lead", selskap: "Aker Solutions",
    signal: "Behov nå", eier: "Jon Richard Nygaard", epost: "erik.solberg@akersolutions.com",
    telefon: "+47 901 23 456", linkedin: "linkedin.com/in/eriksolberg",
    sisteKontaktDager: 1, sisteType: "Samtale",
    activities: [
      { id: "a1", type: "Samtale", subject: "Diskuterte ML-behov", description: "Erik trenger 2 ML-profiler for Q3. Har budsjett godkjent. Ønsker senior-nivå med PyTorch-erfaring.", date: subDays(now, 1) },
      { id: "a2", type: "Møte", subject: "Intro-møte om konsulentbehov", description: "Første møte med Erik. Gikk gjennom teamets roadmap og identifiserte gaps innen ML og data engineering.", date: subDays(now, 14) },
      { id: "a3", type: "E-post", subject: "Sendt oversikt over tilgjengelige konsulenter", description: "Sendte profiler for 3 ML-konsulenter. Erik skal diskutere med teamet.", date: subDays(now, 21) },
    ],
    tasks: [
      { id: "t1", title: "Send 2 ML-profiler", dueDate: subDays(now, -1), done: false },
      { id: "t2", title: "Følg opp etter profilsending", dueDate: subDays(now, -5), done: false },
    ],
    consultantMatches: [
      { name: "Martin Olsen", title: "ML Engineer", matchPct: 94, tags: ["PyTorch", "Python", "MLOps"] },
      { name: "Sara Lindqvist", title: "Data Scientist", matchPct: 88, tags: ["TensorFlow", "Python", "AWS"] },
    ],
  },
  {
    id: "2", navn: "Kari Hansen", stilling: "Engineering Manager", selskap: "DNB",
    signal: "Behov nå", eier: "Thomas Eriksen", epost: "kari.hansen@dnb.no",
    telefon: "+47 922 33 444", linkedin: "linkedin.com/in/karihansen",
    sisteKontaktDager: 4, sisteType: "Møte",
    activities: [
      { id: "a4", type: "Møte", subject: "Gjennomgang av teamutvidelse", description: "Kari planlegger å utvide teamet med 3 utviklere. Fokus på React og Java. Ønsker oppstart i mai.", date: subDays(now, 4) },
      { id: "a5", type: "Samtale", subject: "Kort oppdatering på prosess", description: "Kari bekreftet at budsjett er godkjent. Venter på endelig headcount fra VP.", date: subDays(now, 18) },
    ],
    tasks: [
      { id: "t3", title: "Book demo med teamleder", dueDate: subDays(now, -2), done: false },
    ],
    consultantMatches: [
      { name: "Anders Berg", title: "Fullstack Developer", matchPct: 91, tags: ["React", "Java", "Spring"] },
    ],
  },
  {
    id: "3", navn: "Silje Strand", stilling: "Data Engineering Lead", selskap: "Schibsted",
    signal: "Behov nå", eier: "Jon Richard Nygaard", epost: "silje.strand@schibsted.no",
    telefon: "+47 933 44 555", linkedin: "linkedin.com/in/siljestrand",
    sisteKontaktDager: 5, sisteType: "Samtale",
    activities: [
      { id: "a6", type: "Samtale", subject: "Spark-konsulent behov", description: "Silje trenger en senior Spark-konsulent for migrasjonsprosjekt. 6 måneders engagement. Start ASAP.", date: subDays(now, 5) },
    ],
    tasks: [
      { id: "t4", title: "Sende profil Spark-konsulent", dueDate: subDays(now, -1), done: false },
    ],
    consultantMatches: [
      { name: "Henrik Dahl", title: "Data Engineer", matchPct: 96, tags: ["Spark", "Scala", "Kafka", "GCP"] },
    ],
  },
  {
    id: "4", navn: "Magnus Pedersen", stilling: "VP Engineering", selskap: "Cognite",
    signal: "Fremtidig behov", eier: "Jon Richard Nygaard", epost: "magnus@cognite.com",
    telefon: "+47 944 55 666", linkedin: "linkedin.com/in/magnuspedersen",
    sisteKontaktDager: 9, sisteType: "Møte",
    activities: [
      { id: "a7", type: "Møte", subject: "Lunsj — diskuterte Q3-planer", description: "Magnus vurderer å hente inn konsulenter i Q3 for IoT-plattform. Avhenger av styregodkjenning.", date: subDays(now, 9) },
    ],
    tasks: [
      { id: "t5", title: "Følg opp Q3-behov", dueDate: subDays(now, -14), done: false },
    ],
    consultantMatches: [],
  },
  {
    id: "5", navn: "Ingrid Moe", stilling: "CTO", selskap: "Vipps",
    signal: "Fremtidig behov", eier: "Thomas Eriksen", epost: "ingrid.moe@vipps.no",
    telefon: "+47 955 66 777", linkedin: "linkedin.com/in/ingridmoe",
    sisteKontaktDager: 11, sisteType: "E-post",
    activities: [
      { id: "a8", type: "E-post", subject: "Sendt info om STACQ", description: "Sendte generell presentasjon av STACQ og våre konsulenter. Ingrid svarte at de muligens har behov H2.", date: subDays(now, 11) },
    ],
    tasks: [
      { id: "t6", title: "Lunsj i mai", dueDate: subDays(now, -20), done: false },
    ],
    consultantMatches: [],
  },
  {
    id: "6", navn: "Henrik Berg", stilling: "Platform Lead", selskap: "Equinor",
    signal: "Behov nå", eier: "Jon Richard Nygaard", epost: "henrik.berg@equinor.com",
    telefon: "+47 966 77 888", linkedin: "linkedin.com/in/henrikberg",
    sisteKontaktDager: 2, sisteType: "Samtale",
    activities: [
      { id: "a9", type: "Samtale", subject: "DevOps-behov for plattformteamet", description: "Henrik trenger 2 DevOps-ingeniører med Kubernetes og Terraform. Fast pris per måned.", date: subDays(now, 2) },
      { id: "a10", type: "Møte", subject: "Første møte — kartlegging", description: "Kartla behov. Equinor har rammeavtale men Henrik har mandat til å bruke underleverandører.", date: subMonths(now, 1) },
    ],
    tasks: [
      { id: "t7", title: "Presentere 2 DevOps-profiler", dueDate: subDays(now, -1), done: false },
    ],
    consultantMatches: [
      { name: "Kristian Haugen", title: "DevOps Engineer", matchPct: 93, tags: ["Kubernetes", "Terraform", "Azure"] },
      { name: "Emilie Aasen", title: "Platform Engineer", matchPct: 87, tags: ["Docker", "CI/CD", "AWS"] },
    ],
  },
  {
    id: "7", navn: "Lene Johansen", stilling: "Head of Digital", selskap: "Storebrand",
    signal: "Har kanskje behov", eier: "Thomas Eriksen", epost: "lene.johansen@storebrand.no",
    telefon: "+47 977 88 999", linkedin: "linkedin.com/in/lenejohansen",
    sisteKontaktDager: 17, sisteType: "Møte",
    activities: [
      { id: "a11", type: "Møte", subject: "Intro-møte", description: "Lene er ny i rollen. Vil kartlegge behov internt før hun tar beslutninger. Virker positiv.", date: subDays(now, 17) },
    ],
    tasks: [],
    consultantMatches: [],
  },
  {
    id: "8", navn: "Andreas Dahl", stilling: "Sr. Engineering Manager", selskap: "Telenor",
    signal: "Fremtidig behov", eier: "Jon Richard Nygaard", epost: "andreas.dahl@telenor.com",
    telefon: "+47 988 99 000", linkedin: "linkedin.com/in/andreasdahl",
    sisteKontaktDager: 13, sisteType: "Samtale",
    activities: [
      { id: "a12", type: "Samtale", subject: "5G-prosjekt oppdatering", description: "Andreas sa 5G-prosjektet er forsinket. Konsulentbehov skyves til Q4. Ber oss holde kontakten.", date: subDays(now, 13) },
    ],
    tasks: [
      { id: "t8", title: "Sjekk 5G-prosjekt status", dueDate: subDays(now, -30), done: false },
    ],
    consultantMatches: [],
  },
  {
    id: "9", navn: "Marte Eriksen", stilling: "Tech Director", selskap: "Kahoot!",
    signal: "Ukjent om behov", eier: "Thomas Eriksen", epost: "marte.eriksen@kahoot.com",
    telefon: "+47 911 22 333", linkedin: "linkedin.com/in/marteeriksen",
    sisteKontaktDager: 30, sisteType: "E-post",
    activities: [
      { id: "a13", type: "E-post", subject: "Kald intro-mail", description: "Sendte intro-mail. Ingen respons ennå.", date: subDays(now, 30) },
    ],
    tasks: [
      { id: "t9", title: "Intro-møte", dueDate: subDays(now, -7), done: false },
    ],
    consultantMatches: [],
  },
  {
    id: "10", navn: "Ola Kristiansen", stilling: "IT-sjef", selskap: "Posten",
    signal: "Har kanskje behov", eier: "Jon Richard Nygaard", epost: "ola.kristiansen@posten.no",
    telefon: "+47 922 33 444", linkedin: "linkedin.com/in/olakristiansen",
    sisteKontaktDager: 25, sisteType: "Samtale",
    activities: [
      { id: "a14", type: "Samtale", subject: "Rask prat om logistikk-system", description: "Ola nevnte at de evaluerer ny leverandør for logistikksystemet. Mulig konsulentbehov.", date: subDays(now, 25) },
    ],
    tasks: [],
    consultantMatches: [],
  },
  {
    id: "11", navn: "Camilla Vik", stilling: "VP Technology", selskap: "Statkraft",
    signal: "Fremtidig behov", eier: "Thomas Eriksen", epost: "camilla.vik@statkraft.com",
    telefon: "+47 933 44 555", linkedin: "linkedin.com/in/camillavik",
    sisteKontaktDager: 6, sisteType: "Møte",
    activities: [
      { id: "a15", type: "Møte", subject: "Rammeavtale-diskusjon", description: "Camilla ønsker tilbud på rammeavtale for 2026. Trenger 5-8 konsulenter innen cloud og data. Tidslinje: oppstart Q1 2026.", date: subDays(now, 6) },
    ],
    tasks: [
      { id: "t10", title: "Send rammeavtale-info", dueDate: subDays(now, -3), done: false },
    ],
    consultantMatches: [
      { name: "Tomas Ruud", title: "Cloud Architect", matchPct: 90, tags: ["Azure", "AWS", "Terraform"] },
    ],
  },
  {
    id: "12", navn: "Thomas Lie", stilling: "CTO", selskap: "Color Line",
    signal: "Aldri aktuelt", eier: "Jon Richard Nygaard", epost: "thomas.lie@colorline.no",
    telefon: "+47 944 55 666", linkedin: "linkedin.com/in/thomaslie",
    sisteKontaktDager: 63, sisteType: "E-post",
    activities: [
      { id: "a16", type: "E-post", subject: "Avsluttet dialog", description: "Thomas bekreftet at Color Line bruker kun intern IT. Ikke aktuelt med eksterne konsulenter.", date: subDays(now, 63) },
    ],
    tasks: [],
    consultantMatches: [],
  },
];

const OWNERS = ["Alle", "Jon Richard Nygaard", "Thomas Eriksen"];
const SIGNALS: Signal[] = ["Behov nå", "Fremtidig behov", "Har kanskje behov", "Ukjent om behov", "Aldri aktuelt"];

type SortField = "navn" | "selskap" | "signal" | "eier" | "sist";
type SortDir = "asc" | "desc";

const SIGNAL_ORDER: Record<Signal, number> = {
  "Behov nå": 0, "Fremtidig behov": 1, "Har kanskje behov": 2, "Ukjent om behov": 3, "Aldri aktuelt": 4,
};

/* ═══════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════ */

function relTime(days: number): string {
  if (days === 0) return "I dag";
  if (days === 1) return "1d";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}u`;
  return `${Math.floor(days / 30)}mnd`;
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

/* Top navigation strip */
function TopNav() {
  const tabs = [
    { label: "Kontakter", active: true },
    { label: "Selskaper", active: false },
    { label: "Oppdrag", active: false },
  ];
  return (
    <header
      className="h-[53px] flex items-center justify-between px-8 bg-white"
      style={{ borderBottom: "1px solid #E8E8E8", fontFamily: "Inter, -apple-system, system-ui, sans-serif" }}
    >
      <div className="flex items-center gap-8">
        <span className="text-[15px] font-extrabold tracking-tight text-[#1A1A1A]">STACQ</span>
        <nav className="flex items-center gap-1">
          {tabs.map((t) => (
            <button
              key={t.label}
              className="h-[53px] px-3 text-[13px] font-medium transition-colors"
              style={{
                color: t.active ? "#1A1A1A" : "#717171",
                borderBottom: t.active ? "2px solid #1A1A1A" : "2px solid transparent",
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A3A3A3]" />
          <input
            placeholder="Søk…  ⌘K"
            readOnly
            className="h-8 pl-8 pr-3 rounded-md text-[13px] outline-none bg-[#F5F5F5] text-[#1A1A1A] w-52"
            style={{ border: "1px solid #E8E8E8" }}
          />
        </div>
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold bg-[#171717] text-white">
          JR
        </div>
      </div>
    </header>
  );
}

/* Filter dropdown */
function FilterDropdown({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = value !== "Alle";
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors"
        style={{
          background: active ? "#171717" : "transparent",
          color: active ? "#FFFFFF" : "#717171",
          border: `1px solid ${active ? "#171717" : "#E8E8E8"}`,
        }}
      >
        {active ? `${label}: ${value}` : label}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute top-9 left-0 z-20 rounded-md py-1 min-w-[200px] bg-white"
            style={{ border: "1px solid #E8E8E8", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
          >
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-[13px] hover:bg-[#FAFAFA] transition-colors"
                style={{ color: "#1A1A1A", fontWeight: value === opt ? 600 : 400 }}
              >
                {opt !== "Alle" && label === "Signal" && (
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SIGNAL_DOT[opt as Signal] }} />
                )}
                {opt}
                {value === opt && <Check className="w-3.5 h-3.5 ml-auto text-[#1A1A1A]" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* Signal badge with inline edit */
function SignalBadge({ signal, onChange }: { signal: Signal; onChange?: (s: Signal) => void }) {
  const [open, setOpen] = useState(false);
  const dot = SIGNAL_DOT[signal];
  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); if (onChange) setOpen(!open); }}
        className="inline-flex items-center gap-1.5 text-[13px] text-[#1A1A1A] hover:bg-[#F5F5F5] rounded px-1.5 py-0.5 -mx-1.5 transition-colors"
      >
        <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: dot }} />
        {signal}
      </button>
      {open && onChange && (
        <>
          <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div
            className="absolute top-7 left-0 z-40 rounded-md py-1 min-w-[180px] bg-white"
            style={{ border: "1px solid #E8E8E8", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
          >
            {SIGNALS.map((s) => (
              <button
                key={s}
                onClick={(e) => { e.stopPropagation(); onChange(s); setOpen(false); }}
                className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-[13px] hover:bg-[#FAFAFA] transition-colors"
                style={{ color: "#1A1A1A", fontWeight: signal === s ? 600 : 400 }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SIGNAL_DOT[s] }} />
                {s}
                {signal === s && <Check className="w-3.5 h-3.5 ml-auto" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* Sortable column header */
function ColHeader({ label, field, sort, onSort, className }: {
  label: string; field: SortField; sort: { field: SortField; dir: SortDir };
  onSort: (f: SortField) => void; className?: string;
}) {
  const active = sort.field === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={`flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors ${className || ""}`}
      style={{ color: active ? "#1A1A1A" : "#A3A3A3" }}
    >
      {label}
      {active && (sort.dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   DETAIL SHEET PANEL
   ═══════════════════════════════════════════════════════════ */

function ContactDetailPanel({ contact }: { contact: Contact }) {
  // Group activities by month
  const groupedActivities = useMemo(() => {
    const groups: Record<string, Activity[]> = {};
    contact.activities.forEach((a) => {
      const key = format(a.date, "MMMM yyyy", { locale: nb });
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    });
    return groups;
  }, [contact.activities]);

  const activityIcon = (type: string) => {
    if (type === "Samtale") return <MessageCircle className="w-3.5 h-3.5 text-[#22C55E]" />;
    if (type === "Møte") return <FileText className="w-3.5 h-3.5 text-[#3B82F6]" />;
    return <Mail className="w-3.5 h-3.5 text-[#717171]" />;
  };

  return (
    <div className="h-full flex flex-col" style={{ fontFamily: "Inter, -apple-system, system-ui, sans-serif" }}>
      {/* Header */}
      <div className="px-6 pt-6 pb-4" style={{ borderBottom: "1px solid #E8E8E8" }}>
        <h2 className="text-[20px] font-bold text-[#1A1A1A] mb-0.5">{contact.navn}</h2>
        <p className="text-[13px] text-[#717171] mb-3">{contact.stilling} · {contact.selskap}</p>

        {/* Quick actions */}
        <div className="flex items-center gap-2 mb-4">
          <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-medium bg-[#171717] text-white hover:bg-[#333] transition-colors">
            <Phone className="w-3.5 h-3.5" /> Ring
          </button>
          <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5] transition-colors" style={{ border: "1px solid #E8E8E8" }}>
            <Mail className="w-3.5 h-3.5" /> E-post
          </button>
          <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5] transition-colors" style={{ border: "1px solid #E8E8E8" }}>
            <MessageCircle className="w-3.5 h-3.5" /> Logg samtale
          </button>
        </div>

        {/* Contact info grid */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
          <div>
            <span className="text-[#A3A3A3]">E-post</span>
            <p className="text-[#1A1A1A] font-medium truncate">{contact.epost}</p>
          </div>
          <div>
            <span className="text-[#A3A3A3]">Telefon</span>
            <p className="text-[#1A1A1A] font-medium">{contact.telefon}</p>
          </div>
          <div>
            <span className="text-[#A3A3A3]">Eier</span>
            <p className="text-[#1A1A1A] font-medium">{contact.eier}</p>
          </div>
          <div>
            <span className="text-[#A3A3A3]">Signal</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-[6px] h-[6px] rounded-full" style={{ background: SIGNAL_DOT[contact.signal] }} />
              <span className="text-[#1A1A1A] font-medium">{contact.signal}</span>
            </div>
          </div>
          <div>
            <span className="text-[#A3A3A3]">LinkedIn</span>
            <a href="#" className="flex items-center gap-1 text-[#3B82F6] font-medium hover:underline">
              Profil <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div>
            <span className="text-[#A3A3A3]">Siste kontakt</span>
            <p className="text-[#1A1A1A] font-medium">{relTime(contact.sisteKontaktDager)} · {contact.sisteType}</p>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Tasks / Neste steg */}
        {contact.tasks.length > 0 && (
          <div className="px-6 py-4" style={{ borderBottom: "1px solid #E8E8E8" }}>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A3A3A3] mb-3">Oppfølginger</h3>
            <div className="space-y-2">
              {contact.tasks.map((t) => (
                <div key={t.id} className="flex items-start gap-2.5">
                  <div
                    className="w-4 h-4 rounded border shrink-0 mt-0.5 flex items-center justify-center"
                    style={{ borderColor: t.done ? "#22C55E" : "#E8E8E8", background: t.done ? "#22C55E" : "transparent" }}
                  >
                    {t.done && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-[#1A1A1A]">{t.title}</p>
                    <p className="text-[11px] text-[#A3A3A3]">
                      <Calendar className="w-3 h-3 inline mr-1" />
                      {format(t.dueDate, "d. MMM yyyy", { locale: nb })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activities timeline */}
        <div className="px-6 py-4" style={{ borderBottom: "1px solid #E8E8E8" }}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A3A3A3] mb-3">Aktiviteter</h3>
          {Object.entries(groupedActivities).map(([month, acts]) => (
            <div key={month} className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[12px] font-semibold text-[#1A1A1A] capitalize">{month}</span>
                <div className="flex-1 h-px bg-[#E8E8E8]" />
              </div>
              <div className="space-y-3 pl-5 relative">
                <div className="absolute left-[7px] top-[6px] bottom-0 w-[1.5px] bg-[#E8E8E8]" />
                {acts.map((a) => (
                  <div key={a.id} className="relative">
                    <div className="absolute -left-5 top-[3px] w-[11px] h-[11px] rounded-full bg-white flex items-center justify-center" style={{ border: "1.5px solid #E8E8E8" }}>
                      {activityIcon(a.type)}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[#1A1A1A]">{a.subject}</p>
                      <p className="text-[12px] text-[#717171] leading-relaxed mt-0.5">{a.description}</p>
                      <p className="text-[11px] text-[#A3A3A3] mt-1">{format(a.date, "d. MMM yyyy", { locale: nb })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {contact.activities.length === 0 && (
            <p className="text-[13px] text-[#A3A3A3]">Ingen aktiviteter</p>
          )}
        </div>

        {/* Consultant matches */}
        {contact.consultantMatches.length > 0 && (
          <div className="px-6 py-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A3A3A3] mb-3">Konsulentmatch</h3>
            <div className="space-y-3">
              {contact.consultantMatches.map((m) => (
                <div key={m.name} className="flex items-start justify-between">
                  <div>
                    <p className="text-[13px] font-semibold text-[#1A1A1A]">{m.name}</p>
                    <p className="text-[12px] text-[#717171]">{m.title}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {m.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded text-[#717171]"
                          style={{ background: "#F5F5F5" }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-[13px] font-bold text-[#22C55E] shrink-0 ml-3">{m.matchPct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */

export default function DesignLabContacts() {
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("Alle");
  const [signalFilter, setSignalFilter] = useState("Alle");
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "sist", dir: "asc" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [contacts, setContacts] = useState(CONTACTS);

  const hasFilters = ownerFilter !== "Alle" || signalFilter !== "Alle" || search !== "";

  const toggleSort = useCallback((field: SortField) => {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" }
    );
  }, []);

  const filtered = useMemo(() => {
    let list = contacts.filter((c) => {
      if (ownerFilter !== "Alle" && c.eier !== ownerFilter) return false;
      if (signalFilter !== "Alle" && c.signal !== signalFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return c.navn.toLowerCase().includes(q) || c.selskap.toLowerCase().includes(q) || c.stilling.toLowerCase().includes(q);
      }
      return true;
    });

    list.sort((a, b) => {
      let cmp = 0;
      switch (sort.field) {
        case "navn": cmp = a.navn.localeCompare(b.navn); break;
        case "selskap": cmp = a.selskap.localeCompare(b.selskap); break;
        case "signal": cmp = SIGNAL_ORDER[a.signal] - SIGNAL_ORDER[b.signal]; break;
        case "eier": cmp = a.eier.localeCompare(b.eier); break;
        case "sist": cmp = a.sisteKontaktDager - b.sisteKontaktDager; break;
      }
      return sort.dir === "desc" ? -cmp : cmp;
    });

    return list;
  }, [contacts, search, ownerFilter, signalFilter, sort]);

  const selectedContact = selectedId ? contacts.find((c) => c.id === selectedId) : null;

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allChecked = filtered.length > 0 && filtered.every((c) => checked.has(c.id));
  const toggleAll = () => {
    if (allChecked) setChecked(new Set());
    else setChecked(new Set(filtered.map((c) => c.id)));
  };

  const updateSignal = (id: string, signal: Signal) => {
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, signal } : c));
  };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, -apple-system, system-ui, sans-serif" }}>
      <TopNav />

      <div className="max-w-[1280px] mx-auto px-8 py-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-baseline gap-2">
            <h1 className="text-[20px] font-bold text-[#1A1A1A]">Kontakter</h1>
            <span className="text-[13px] text-[#A3A3A3] font-medium">{filtered.length}</span>
          </div>
          <button className="h-8 px-3 rounded-md text-[12px] font-medium bg-[#171717] text-white hover:bg-[#333] transition-colors">
            + Ny kontakt
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative mr-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A3A3A3]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrer…"
              className="h-7 pl-8 pr-3 rounded-md text-[12px] outline-none bg-white text-[#1A1A1A] w-44 focus:w-56 transition-all"
              style={{ border: "1px solid #E8E8E8" }}
            />
          </div>
          <FilterDropdown label="Eier" value={ownerFilter} options={OWNERS} onChange={setOwnerFilter} />
          <FilterDropdown label="Signal" value={signalFilter} options={["Alle", ...SIGNALS]} onChange={setSignalFilter} />
          {hasFilters && (
            <button
              onClick={() => { setSearch(""); setOwnerFilter("Alle"); setSignalFilter("Alle"); }}
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded hover:bg-[#F5F5F5] text-[#A3A3A3] transition-colors"
            >
              <X className="w-3 h-3" /> Nullstill
            </button>
          )}
        </div>

        {/* Table */}
        <div style={{ border: "1px solid #E8E8E8", borderRadius: 6, overflow: "hidden" }}>
          {/* Header */}
          <div
            className="flex items-center h-[36px] select-none"
            style={{ borderBottom: "1px solid #E8E8E8", background: "#FAFAFA" }}
          >
            <div className="w-10 flex items-center justify-center">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={toggleAll}
                className="w-3.5 h-3.5 rounded accent-[#171717] cursor-pointer"
              />
            </div>
            <div className="flex-[2.2] min-w-0 px-2">
              <ColHeader label="Navn" field="navn" sort={sort} onSort={toggleSort} />
            </div>
            <div className="flex-[1.5] min-w-0 px-2">
              <ColHeader label="Selskap" field="selskap" sort={sort} onSort={toggleSort} />
            </div>
            <div className="flex-[1.5] min-w-0 px-2">
              <ColHeader label="Signal" field="signal" sort={sort} onSort={toggleSort} />
            </div>
            <div className="flex-[1.5] min-w-0 px-2">
              <ColHeader label="Eier" field="eier" sort={sort} onSort={toggleSort} />
            </div>
            <div className="w-[72px] px-2 text-right">
              <ColHeader label="Sist" field="sist" sort={sort} onSort={toggleSort} className="justify-end" />
            </div>
          </div>

          {/* Rows */}
          {filtered.map((c) => {
            const isSelected = c.id === selectedId;
            const isChecked = checked.has(c.id);
            return (
              <div
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="flex items-center h-[44px] cursor-pointer transition-colors group"
                style={{
                  borderBottom: "1px solid #F5F5F5",
                  background: isSelected ? "#F5F5F5" : "transparent",
                  borderLeft: isSelected ? "2px solid #3B82F6" : "2px solid transparent",
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "#FAFAFA"; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
              >
                <div className="w-10 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleCheck(c.id)}
                    className="w-3.5 h-3.5 rounded accent-[#171717] cursor-pointer"
                  />
                </div>
                <div className="flex-[2.2] min-w-0 px-2">
                  <div className="text-[13px] font-semibold text-[#1A1A1A] truncate">{c.navn}</div>
                  <div className="text-[11px] text-[#A3A3A3] truncate">{c.stilling}</div>
                </div>
                <div className="flex-[1.5] min-w-0 px-2">
                  <span className="text-[13px] text-[#1A1A1A] truncate block">{c.selskap}</span>
                </div>
                <div className="flex-[1.5] min-w-0 px-2" onClick={(e) => e.stopPropagation()}>
                  <SignalBadge signal={c.signal} onChange={(s) => updateSignal(c.id, s)} />
                </div>
                <div className="flex-[1.5] min-w-0 px-2">
                  <span className="text-[13px] text-[#717171] truncate block">{c.eier}</span>
                </div>
                <div className="w-[72px] px-2 flex items-center justify-end gap-1">
                  <span className="text-[12px] text-[#A3A3A3] group-hover:hidden">{relTime(c.sisteKontaktDager)}</span>
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#F0F0F0] text-[#717171] hover:text-[#1A1A1A] transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#F0F0F0] text-[#717171] hover:text-[#1A1A1A] transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-16 text-center text-[13px] text-[#A3A3A3]">
              Ingen kontakter funnet
            </div>
          )}
        </div>
      </div>

      {/* Detail sheet panel */}
      <Sheet open={!!selectedContact} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <SheetContent
          side="right"
          className="w-[480px] p-0 border-l"
          style={{ borderColor: "#E8E8E8" }}
          hideCloseButton={false}
        >
          {selectedContact && <ContactDetailPanel contact={selectedContact} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
