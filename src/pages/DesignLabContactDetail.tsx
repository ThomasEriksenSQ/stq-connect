import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Phone, Mail, Linkedin, ExternalLink, MessageCircle,
  FileText, Clock, ChevronDown, Check, Radio, MapPin, Plus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search } from "lucide-react";
import { format, subDays, subMonths, isPast, isToday, addDays, addWeeks, addMonths, addYears } from "date-fns";
import { nb } from "date-fns/locale";

/* ═══════════════════════════════════════════════════════════
   TYPES & DATA
   ═══════════════════════════════════════════════════════════ */

type Signal = "Behov nå" | "Fremtidig behov" | "Har kanskje behov" | "Ukjent om behov" | "Aldri aktuelt";

const SIGNAL_BADGE: Record<Signal, string> = {
  "Behov nå": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Fremtidig behov": "bg-blue-100 text-blue-800 border-blue-200",
  "Har kanskje behov": "bg-amber-100 text-amber-800 border-amber-200",
  "Ukjent om behov": "bg-gray-100 text-gray-600 border-gray-200",
  "Aldri aktuelt": "bg-red-50 text-red-700 border-red-200",
};

const SIGNALS: Signal[] = ["Behov nå", "Fremtidig behov", "Har kanskje behov", "Ukjent om behov", "Aldri aktuelt"];

interface Activity {
  id: string;
  type: "Samtale" | "Møte" | "E-post";
  subject: string;
  description: string;
  date: Date;
  createdBy: string;
}

interface Task {
  id: string;
  title: string;
  dueDate: Date;
  done: boolean;
  owner: string;
}

interface ConsultantMatch {
  name: string;
  title: string;
  matchPct: number;
  tags: string[];
}

interface ContactDetail {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  companyId: string;
  department: string | null;
  location: string | null;
  signal: Signal;
  eier: string;
  email: string;
  phone: string;
  linkedin: string;
  cvEmail: boolean;
  callList: boolean;
  ikkeRelevant: boolean;
  teknologier: string[];
  notat: string;
  activities: Activity[];
  tasks: Task[];
  consultantMatches: ConsultantMatch[];
}

const now = new Date();

const MOCK_CONTACTS: Record<string, ContactDetail> = {
  "1": {
    id: "1", firstName: "Erik", lastName: "Solberg", title: "Tech Lead",
    company: "Aker Solutions", companyId: "c1", department: "Digital Engineering",
    location: "Oslo", signal: "Behov nå", eier: "Jon Richard Nygaard",
    email: "erik.solberg@akersolutions.com", phone: "+47 901 23 456",
    linkedin: "linkedin.com/in/eriksolberg", cvEmail: true, callList: false,
    ikkeRelevant: false, teknologier: ["Python", "PyTorch", "MLOps", "Azure"],
    notat: "Erik er vår viktigste kontakt hos Aker Solutions. Har budsjett for 2 ML-profiler Q3.",
    activities: [
      { id: "a1", type: "Samtale", subject: "Diskuterte ML-behov", description: "Erik trenger 2 ML-profiler for Q3. Har budsjett godkjent. Ønsker senior-nivå med PyTorch-erfaring.", date: subDays(now, 1), createdBy: "Jon Richard Nygaard" },
      { id: "a2", type: "Møte", subject: "Intro-møte om konsulentbehov", description: "Første møte med Erik. Gikk gjennom teamets roadmap og identifiserte gaps innen ML og data engineering.", date: subDays(now, 14), createdBy: "Jon Richard Nygaard" },
      { id: "a3", type: "E-post", subject: "Sendt oversikt over tilgjengelige konsulenter", description: "Sendte profiler for 3 ML-konsulenter. Erik skal diskutere med teamet.", date: subDays(now, 21), createdBy: "Jon Richard Nygaard" },
      { id: "a4", type: "Samtale", subject: "Oppfølging Q1-evaluering", description: "Kort oppdatering. Erik har hatt positive tilbakemeldinger fra teamet. Ønsker å gå videre med Martin Olsen.", date: subMonths(now, 2), createdBy: "Jon Richard Nygaard" },
    ],
    tasks: [
      { id: "t1", title: "Send 2 ML-profiler", dueDate: subDays(now, -1), done: false, owner: "Jon Richard Nygaard" },
      { id: "t2", title: "Følg opp etter profilsending", dueDate: subDays(now, -5), done: false, owner: "Jon Richard Nygaard" },
    ],
    consultantMatches: [
      { name: "Martin Olsen", title: "ML Engineer", matchPct: 94, tags: ["PyTorch", "Python", "MLOps"] },
      { name: "Sara Lindqvist", title: "Data Scientist", matchPct: 88, tags: ["TensorFlow", "Python", "AWS"] },
      { name: "Henrik Dahl", title: "Data Engineer", matchPct: 76, tags: ["Spark", "Python", "GCP"] },
    ],
  },
  "2": {
    id: "2", firstName: "Kari", lastName: "Hansen", title: "Engineering Manager",
    company: "DNB", companyId: "c2", department: "Personmarked IT",
    location: "Oslo", signal: "Behov nå", eier: "Thomas Eriksen",
    email: "kari.hansen@dnb.no", phone: "+47 922 33 444",
    linkedin: "linkedin.com/in/karihansen", cvEmail: true, callList: true,
    ikkeRelevant: false, teknologier: ["React", "Java", "Spring", "Kubernetes"],
    notat: "Kari planlegger å utvide teamet med 3 utviklere. Fokus på React og Java.",
    activities: [
      { id: "a4", type: "Møte", subject: "Gjennomgang av teamutvidelse", description: "Kari planlegger å utvide teamet med 3 utviklere. Fokus på React og Java. Ønsker oppstart i mai.", date: subDays(now, 4), createdBy: "Thomas Eriksen" },
      { id: "a5", type: "Samtale", subject: "Kort oppdatering på prosess", description: "Kari bekreftet at budsjett er godkjent. Venter på endelig headcount fra VP.", date: subDays(now, 18), createdBy: "Thomas Eriksen" },
    ],
    tasks: [
      { id: "t3", title: "Book demo med teamleder", dueDate: subDays(now, -2), done: false, owner: "Thomas Eriksen" },
    ],
    consultantMatches: [
      { name: "Anders Berg", title: "Fullstack Developer", matchPct: 91, tags: ["React", "Java", "Spring"] },
    ],
  },
  "6": {
    id: "6", firstName: "Henrik", lastName: "Berg", title: "Platform Lead",
    company: "Equinor", companyId: "c6", department: "Digital Platform",
    location: "Stavanger", signal: "Behov nå", eier: "Jon Richard Nygaard",
    email: "henrik.berg@equinor.com", phone: "+47 966 77 888",
    linkedin: "linkedin.com/in/henrikberg", cvEmail: true, callList: true,
    ikkeRelevant: false, teknologier: ["Kubernetes", "Terraform", "Azure", "Docker"],
    notat: "Henrik har mandat til å bruke underleverandører utenom rammeavtalen. Trenger 2 DevOps.",
    activities: [
      { id: "a9", type: "Samtale", subject: "DevOps-behov for plattformteamet", description: "Henrik trenger 2 DevOps-ingeniører med Kubernetes og Terraform. Fast pris per måned.", date: subDays(now, 2), createdBy: "Jon Richard Nygaard" },
      { id: "a10", type: "Møte", subject: "Første møte — kartlegging", description: "Kartla behov. Equinor har rammeavtale men Henrik har mandat til å bruke underleverandører.", date: subMonths(now, 1), createdBy: "Jon Richard Nygaard" },
    ],
    tasks: [
      { id: "t7", title: "Presentere 2 DevOps-profiler", dueDate: subDays(now, -1), done: false, owner: "Jon Richard Nygaard" },
    ],
    consultantMatches: [
      { name: "Kristian Haugen", title: "DevOps Engineer", matchPct: 93, tags: ["Kubernetes", "Terraform", "Azure"] },
      { name: "Emilie Aasen", title: "Platform Engineer", matchPct: 87, tags: ["Docker", "CI/CD", "AWS"] },
    ],
  },
};

// Generate simple fallbacks for other IDs
function getContact(id: string): ContactDetail {
  if (MOCK_CONTACTS[id]) return MOCK_CONTACTS[id];
  return {
    id, firstName: "Ukjent", lastName: "Kontakt", title: "Ukjent stilling",
    company: "Ukjent selskap", companyId: "cx", department: null, location: null,
    signal: "Ukjent om behov", eier: "Jon Richard Nygaard",
    email: "test@example.com", phone: "+47 000 00 000",
    linkedin: "", cvEmail: false, callList: false, ikkeRelevant: false,
    teknologier: [], notat: "", activities: [], tasks: [], consultantMatches: [],
  };
}

/* ═══════════════════════════════════════════════════════════
   TOP NAV (shared style)
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

export default function DesignLabContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const contact = getContact(id || "1");
  const [signal, setSignal] = useState<Signal>(contact.signal);
  const [cvEmail, setCvEmail] = useState(contact.cvEmail);
  const [callList, setCallList] = useState(contact.callList);
  const [ikkeRelevant, setIkkeRelevant] = useState(contact.ikkeRelevant);
  const [notat, setNotat] = useState(contact.notat);

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
    if (type === "Samtale") return <MessageCircle className="w-3 h-3 text-[hsl(var(--success))]" />;
    if (type === "Møte") return <FileText className="w-3 h-3 text-primary" />;
    return <Mail className="w-3 h-3 text-[#6B7280]" />;
  };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, -apple-system, system-ui, sans-serif" }}>
      <TopNav />

      <div className="px-8 pt-6 pb-16 max-w-[1100px] mx-auto">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-[13px] text-[#6B7280] hover:text-[#111827] transition-colors mb-5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Tilbake
        </button>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-[1.5rem] font-bold text-[#111827]">
                {contact.firstName} {contact.lastName}
              </h1>
              <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[0.6875rem] font-medium">
                {contact.eier}
              </span>
            </div>
            <p className="text-[14px] text-[#6B7280]">
              {contact.company}
              {contact.location && <> · {contact.location}</>}
              {contact.department && <> · {contact.department}</>}
              {contact.title && <> · {contact.title}</>}
            </p>
          </div>

          {/* Signal badge */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold cursor-pointer ${SIGNAL_BADGE[signal]}`}>
                {signal}
                <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SIGNALS.map((s) => (
                <DropdownMenuItem key={s} onClick={() => setSignal(s)}>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${SIGNAL_BADGE[s]}`}>
                    {s}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Contact info pills */}
        <div className="flex items-center gap-3 mb-5">
          <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] text-[#111827] border border-[rgba(0,0,0,0.06)] hover:bg-[#FAFAFA] transition-colors">
            <Phone className="w-3.5 h-3.5 text-[#6B7280]" />
            {contact.phone}
          </a>
          <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] text-[#111827] border border-[rgba(0,0,0,0.06)] hover:bg-[#FAFAFA] transition-colors">
            <Mail className="w-3.5 h-3.5 text-[#6B7280]" />
            {contact.email}
          </a>
          {contact.linkedin && (
            <a href="#" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] text-[#3B82F6] border border-[rgba(0,0,0,0.06)] hover:bg-[#FAFAFA] transition-colors">
              <Linkedin className="w-3.5 h-3.5" />
              LinkedIn
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Status toggles */}
        <div className="flex items-center gap-2 mb-6 pb-6 border-b border-[rgba(0,0,0,0.06)]">
          <button
            onClick={() => setCvEmail(!cvEmail)}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors ${
              cvEmail
                ? "bg-blue-100 text-blue-800 border-blue-200"
                : "border-[rgba(0,0,0,0.1)] text-[#9CA3AF] hover:text-[#6B7280]"
            }`}
          >
            CV-Epost
          </button>
          <button
            onClick={() => setCallList(!callList)}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors ${
              callList
                ? "bg-amber-100 text-amber-800 border-amber-200"
                : "border-[rgba(0,0,0,0.1)] text-[#9CA3AF] hover:text-[#6B7280]"
            }`}
          >
            Innkjøper
          </button>
          <button
            onClick={() => setIkkeRelevant(!ikkeRelevant)}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors ${
              ikkeRelevant
                ? "bg-red-50 text-red-700 border-red-200"
                : "border-[rgba(0,0,0,0.1)] text-[#9CA3AF] hover:text-[#6B7280]"
            }`}
          >
            Ikke relevant
          </button>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-[1fr_340px] gap-10">
          {/* Left column — main content */}
          <div className="min-w-0">
            {/* Teknisk DNA */}
            {contact.teknologier.length > 0 && (
              <div className="mb-8">
                <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[#9CA3AF] mb-3">Teknisk DNA</h2>
                <div className="flex flex-wrap gap-1.5">
                  {contact.teknologier.map((tag) => (
                    <span key={tag} className="rounded-full border border-[rgba(0,0,0,0.06)] bg-[#FAFAFA] px-2.5 py-1 text-[12px] text-[#111827] font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Notat */}
            <div className="mb-8">
              <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[#9CA3AF] mb-3">Notat</h2>
              <textarea
                value={notat}
                onChange={(e) => setNotat(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-[rgba(0,0,0,0.06)] bg-white px-3 py-2 text-[14px] text-[#111827] resize-none focus:outline-none focus:border-[rgba(0,0,0,0.15)] transition-colors leading-relaxed"
                placeholder="Legg til notat…"
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 mb-8">
              <button className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-[hsl(var(--success))] text-white hover:opacity-90 transition-opacity">
                <MessageCircle className="w-4 h-4" />
                Logg samtale
              </button>
              <button className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-[#111827] text-white hover:bg-[#1f2937] transition-colors">
                <FileText className="w-4 h-4" />
                Logg møtereferat
              </button>
              <button className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg border border-[rgba(0,0,0,0.06)] bg-white text-[#111827] hover:bg-[#FAFAFA] transition-colors">
                <Clock className="w-4 h-4 text-[hsl(var(--warning))]" />
                Ny oppfølging
              </button>
            </div>

            {/* Oppfølginger */}
            {contact.tasks.length > 0 && (
              <div className="mb-8">
                <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[#9CA3AF] mb-3">Oppfølginger</h2>
                <div className="border border-[rgba(0,0,0,0.06)] rounded-lg divide-y divide-[rgba(0,0,0,0.04)]">
                  {contact.tasks.map((task) => {
                    const overdue = isPast(task.dueDate) && !isToday(task.dueDate);
                    const today = isToday(task.dueDate);
                    return (
                      <div key={task.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[rgba(0,0,0,0.015)] transition-colors cursor-pointer">
                        <div
                          className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
                            task.done ? "bg-emerald-500 border-emerald-500" : "border-[rgba(0,0,0,0.15)]"
                          }`}
                        >
                          {task.done && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[1rem] font-bold text-[#111827]">{task.title}</p>
                        </div>
                        <span className={`text-[0.8125rem] font-medium shrink-0 ${
                          overdue ? "text-destructive" : today ? "text-[hsl(var(--warning))]" : "text-[#9CA3AF]"
                        }`}>
                          {format(task.dueDate, "d. MMM yyyy", { locale: nb })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Aktiviteter */}
            <div className="mb-8">
              <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[#9CA3AF] mb-4">Aktiviteter</h2>
              <div className="relative pl-8">
                {/* Vertical line */}
                <div className="absolute left-[5px] top-[5px] bottom-0 w-[2px] bg-[rgba(0,0,0,0.06)]" />

                {Object.entries(groupedActivities).map(([month, activities], gi) => (
                  <div key={month} className={gi > 0 ? "mt-6" : ""}>
                    {/* Month header */}
                    <div className="flex items-center gap-3 mb-4 -ml-8">
                      <span className="text-[0.8125rem] font-bold tracking-[0.04em] text-[#111827] capitalize whitespace-nowrap">
                        {month}
                      </span>
                      <div className="flex-1 h-px bg-[rgba(0,0,0,0.06)]" />
                    </div>

                    <div className="space-y-5">
                      {activities.map((act) => (
                        <div key={act.id} className="relative">
                          {/* Icon on line */}
                          <div className="absolute -left-7 top-[2px] w-[12px] h-[12px] bg-white rounded-full flex items-center justify-center">
                            {activityIcon(act.type)}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-[1.0625rem] font-bold text-[#111827]">{act.subject}</h3>
                            </div>
                            <p className="text-[0.9375rem] leading-relaxed text-[#111827]/70 whitespace-pre-wrap mb-1.5">
                              {act.description}
                            </p>
                            <div className="flex items-center gap-2 text-[0.8125rem] text-[#9CA3AF]">
                              <span>{format(act.date, "d. MMM yyyy", { locale: nb })}</span>
                              <span>·</span>
                              <span>{act.createdBy}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column — Konsulentmatch */}
          <div>
            <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[#9CA3AF] mb-3">Konsulentmatch</h2>
            {contact.consultantMatches.length > 0 ? (
              <div className="border border-[rgba(0,0,0,0.06)] rounded-lg divide-y divide-[rgba(0,0,0,0.04)]">
                {contact.consultantMatches.map((cm) => (
                  <div key={cm.name} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <p className="text-[14px] font-medium text-[#111827]">{cm.name}</p>
                        <p className="text-[12px] text-[#6B7280]">{cm.title}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${
                          cm.matchPct >= 90 ? "bg-emerald-500" : cm.matchPct >= 80 ? "bg-blue-500" : "bg-amber-500"
                        }`} />
                        <span className="text-[13px] font-semibold text-[#111827]">{cm.matchPct}%</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {cm.tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-[rgba(0,0,0,0.06)] bg-[#FAFAFA] px-2 py-0.5 text-[11px] text-[#6B7280] font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-[#9CA3AF]">Ingen konsulentmatch tilgjengelig</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
