import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Phone, Mail, Linkedin, ExternalLink, MessageCircle,
  FileText, Clock, ChevronDown, Check, MoreHorizontal, TrendingUp,
  Calendar, Users, Zap,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search } from "lucide-react";
import { format, subDays, subMonths, isPast, isToday } from "date-fns";
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

const SIGNAL_DOT: Record<Signal, string> = {
  "Behov nå": "bg-emerald-500",
  "Fremtidig behov": "bg-blue-500",
  "Har kanskje behov": "bg-amber-500",
  "Ukjent om behov": "bg-gray-400",
  "Aldri aktuelt": "bg-red-500",
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
   TOP NAV
   ═══════════════════════════════════════════════════════════ */

function TopNav() {
  const navigate = useNavigate();
  const tabs = [
    { label: "Kontakter", active: true, href: "/design-lab/kontakter" },
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
              onClick={() => t.href && navigate(t.href)}
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
          <input placeholder="Søk…  ⌘K" readOnly className="h-8 pl-8 pr-3 rounded-md text-[13px] outline-none bg-[#FAFAFA] text-[#111827] w-52 border border-[rgba(0,0,0,0.06)]" />
        </div>
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold bg-[#111827] text-white">JR</div>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════
   HIGHLIGHT CARD
   ═══════════════════════════════════════════════════════════ */

function HighlightCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color?: string;
}) {
  return (
    <div className="border border-[rgba(0,0,0,0.06)] rounded-lg p-4 bg-white hover:border-[rgba(0,0,0,0.1)] transition-colors">
      <div className="flex items-center gap-2 mb-2.5">
        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${color || "bg-[#F3F4F6]"}`}>
          {icon}
        </div>
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#9CA3AF]">{label}</span>
      </div>
      <p className="text-[15px] font-semibold text-[#111827] mb-0.5">{value}</p>
      <p className="text-[12px] text-[#9CA3AF]">{sub}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SIDEBAR KEY-VALUE ROW
   ═══════════════════════════════════════════════════════════ */

function KVRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#9CA3AF] mb-1">{label}</div>
      <div className="text-[13px] text-[#111827]">{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */

type Tab = "oversikt" | "aktivitet" | "oppfolginger";

export default function DesignLabContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const contact = getContact(id || "1");
  const [signal, setSignal] = useState<Signal>(contact.signal);
  const [cvEmail, setCvEmail] = useState(contact.cvEmail);
  const [callList, setCallList] = useState(contact.callList);
  const [ikkeRelevant, setIkkeRelevant] = useState(contact.ikkeRelevant);
  const [notat, setNotat] = useState(contact.notat);
  const [activeTab, setActiveTab] = useState<Tab>("oversikt");

  // Derived data
  const lastActivity = contact.activities[0];
  const nextTask = contact.tasks.find((t) => !t.done);
  const bestMatch = contact.consultantMatches[0];

  const relDays = (d: Date) => {
    const diff = Math.round((now.getTime() - d.getTime()) / 86400000);
    if (diff === 0) return "I dag";
    if (diff === 1) return "1 dag siden";
    return `${diff} dager siden`;
  };

  const futureDays = (d: Date) => {
    const diff = Math.round((d.getTime() - now.getTime()) / 86400000);
    if (diff <= 0) return format(d, "d. MMM", { locale: nb });
    if (diff === 1) return "I morgen";
    return format(d, "d. MMM", { locale: nb });
  };

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
    if (type === "Samtale") return <MessageCircle className="w-3 h-3 text-emerald-600" />;
    if (type === "Møte") return <FileText className="w-3 h-3 text-blue-600" />;
    return <Mail className="w-3 h-3 text-[#6B7280]" />;
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "oversikt", label: "Oversikt" },
    { key: "aktivitet", label: "Aktivitet" },
    { key: "oppfolginger", label: "Oppfølginger" },
  ];

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, -apple-system, system-ui, sans-serif" }}>
      <TopNav />

      <div className="px-8 pt-5 pb-16 max-w-[1400px] mx-auto">
        {/* Back */}
        <button
          onClick={() => navigate("/design-lab/kontakter")}
          className="inline-flex items-center gap-1.5 text-[13px] text-[#9CA3AF] hover:text-[#111827] transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kontakter
        </button>

        {/* ── HEADER ROW ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-semibold text-[#111827] mb-0.5">
              {contact.firstName} {contact.lastName}
            </h1>
            <p className="text-[14px] text-[#6B7280]">
              {contact.title} · {contact.company}
            </p>
          </div>

          {/* Actions in header */}
          <div className="flex items-center gap-2">
            <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium text-[#111827] border border-[rgba(0,0,0,0.08)] hover:bg-[#FAFAFA] transition-colors">
              <Phone className="w-3.5 h-3.5 text-[#6B7280]" />
              Ring
            </a>
            <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium text-[#111827] border border-[rgba(0,0,0,0.08)] hover:bg-[#FAFAFA] transition-colors">
              <Mail className="w-3.5 h-3.5 text-[#6B7280]" />
              E-post
            </a>
            <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium bg-[#111827] text-white hover:bg-[#1f2937] transition-colors">
              <MessageCircle className="w-3.5 h-3.5" />
              Logg
            </button>
            <button className="w-8 h-8 rounded-md border border-[rgba(0,0,0,0.08)] flex items-center justify-center hover:bg-[#FAFAFA] transition-colors">
              <MoreHorizontal className="w-4 h-4 text-[#6B7280]" />
            </button>
          </div>
        </div>

        {/* ── HIGHLIGHT WIDGETS ── */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <HighlightCard
            icon={<Zap className="w-3.5 h-3.5 text-emerald-600" />}
            label="Signal"
            value={signal}
            sub="Oppdatert 2 dager siden"
            color="bg-emerald-100"
          />
          <HighlightCard
            icon={<TrendingUp className="w-3.5 h-3.5 text-blue-600" />}
            label="Siste aktivitet"
            value={lastActivity ? relDays(lastActivity.date) : "—"}
            sub={lastActivity ? lastActivity.type : "Ingen aktivitet"}
            color="bg-blue-100"
          />
          <HighlightCard
            icon={<Calendar className="w-3.5 h-3.5 text-amber-600" />}
            label="Neste steg"
            value={nextTask ? futureDays(nextTask.dueDate) : "—"}
            sub={nextTask ? nextTask.title : "Ingen oppfølging"}
            color="bg-amber-100"
          />
          <HighlightCard
            icon={<Users className="w-3.5 h-3.5 text-violet-600" />}
            label="Beste match"
            value={bestMatch ? `${bestMatch.matchPct}%` : "—"}
            sub={bestMatch ? bestMatch.name : "Ingen match"}
            color="bg-violet-100"
          />
        </div>

        {/* ── MAIN CONTENT: TABS + SIDEBAR ── */}
        <div className="grid grid-cols-[1fr_280px] gap-0">
          {/* LEFT: Tabbed content */}
          <div className="min-w-0 border-r border-[rgba(0,0,0,0.06)] pr-8">
            {/* Tab bar */}
            <div className="flex items-center gap-0 border-b border-[rgba(0,0,0,0.06)] mb-6">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 pb-2.5 pt-1 text-[13px] font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === tab.key
                      ? "text-[#111827] border-[#111827]"
                      : "text-[#9CA3AF] border-transparent hover:text-[#6B7280]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB: Oversikt */}
            {activeTab === "oversikt" && (
              <div>
                {/* Notat */}
                <div className="mb-8">
                  <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#9CA3AF] mb-2.5">Notat</h2>
                  <textarea
                    value={notat}
                    onChange={(e) => setNotat(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-[rgba(0,0,0,0.06)] bg-white px-3 py-2.5 text-[14px] text-[#111827] resize-none focus:outline-none focus:border-[rgba(0,0,0,0.15)] transition-colors leading-relaxed"
                    placeholder="Legg til notat…"
                  />
                </div>

                {/* Konsulentmatch */}
                {contact.consultantMatches.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#9CA3AF] mb-2.5">Konsulentmatch</h2>
                    <div className="space-y-1">
                      {contact.consultantMatches.map((cm) => (
                        <div key={cm.name} className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-[rgba(0,0,0,0.015)] transition-colors cursor-pointer">
                          <div className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[12px] font-semibold text-[#6B7280]">
                            {cm.name.split(" ").map(n => n[0]).join("")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-[#111827]">{cm.name}</p>
                            <p className="text-[12px] text-[#9CA3AF]">{cm.title}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              {cm.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[11px] text-[#6B7280] font-medium">{tag}</span>
                              ))}
                            </div>
                            <div className={`text-[13px] font-semibold tabular-nums ${
                              cm.matchPct >= 90 ? "text-emerald-600" : cm.matchPct >= 80 ? "text-blue-600" : "text-amber-600"
                            }`}>
                              {cm.matchPct}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent activity preview */}
                {contact.activities.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#9CA3AF]">Siste aktivitet</h2>
                      <button onClick={() => setActiveTab("aktivitet")} className="text-[12px] text-[#9CA3AF] hover:text-[#111827] transition-colors">
                        Se alle →
                      </button>
                    </div>
                    <div className="space-y-0">
                      {contact.activities.slice(0, 3).map((act) => (
                        <div key={act.id} className="flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-[rgba(0,0,0,0.015)] transition-colors">
                          <div className="mt-0.5">{activityIcon(act.type)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-[#111827] mb-0.5">{act.subject}</p>
                            <p className="text-[12px] text-[#9CA3AF]">
                              {format(act.date, "d. MMM yyyy", { locale: nb })} · {act.createdBy}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: Aktivitet */}
            {activeTab === "aktivitet" && (
              <div className="relative pl-8">
                <div className="absolute left-[5px] top-[5px] bottom-0 w-[2px] bg-[rgba(0,0,0,0.06)]" />
                {Object.entries(groupedActivities).map(([month, activities], gi) => (
                  <div key={month} className={gi > 0 ? "mt-6" : ""}>
                    <div className="flex items-center gap-3 mb-4 -ml-8">
                      <span className="text-[13px] font-semibold tracking-[0.02em] text-[#111827] capitalize whitespace-nowrap">{month}</span>
                      <div className="flex-1 h-px bg-[rgba(0,0,0,0.06)]" />
                    </div>
                    <div className="space-y-5">
                      {activities.map((act) => (
                        <div key={act.id} className="relative">
                          <div className="absolute -left-7 top-[2px] w-[12px] h-[12px] bg-white rounded-full flex items-center justify-center">
                            {activityIcon(act.type)}
                          </div>
                          <div>
                            <h3 className="text-[14px] font-semibold text-[#111827] mb-1">{act.subject}</h3>
                            <p className="text-[13px] leading-relaxed text-[#6B7280] whitespace-pre-wrap mb-1.5">{act.description}</p>
                            <div className="flex items-center gap-2 text-[12px] text-[#9CA3AF]">
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
            )}

            {/* TAB: Oppfølginger */}
            {activeTab === "oppfolginger" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[13px] text-[#6B7280]">{contact.tasks.length} oppfølginger</span>
                  <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium border border-[rgba(0,0,0,0.08)] text-[#111827] hover:bg-[#FAFAFA] transition-colors">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    Ny oppfølging
                  </button>
                </div>
                {contact.tasks.length > 0 ? (
                  <div className="border border-[rgba(0,0,0,0.06)] rounded-lg divide-y divide-[rgba(0,0,0,0.04)]">
                    {contact.tasks.map((task) => {
                      const overdue = isPast(task.dueDate) && !isToday(task.dueDate);
                      const today = isToday(task.dueDate);
                      return (
                        <div key={task.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[rgba(0,0,0,0.015)] transition-colors cursor-pointer">
                          <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
                            task.done ? "bg-emerald-500 border-emerald-500" : "border-[rgba(0,0,0,0.15)]"
                          }`}>
                            {task.done && <Check className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-[#111827]">{task.title}</p>
                            <p className="text-[12px] text-[#9CA3AF]">{task.owner}</p>
                          </div>
                          <span className={`text-[13px] font-medium shrink-0 ${
                            overdue ? "text-red-600" : today ? "text-amber-600" : "text-[#9CA3AF]"
                          }`}>
                            {format(task.dueDate, "d. MMM yyyy", { locale: nb })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[13px] text-[#9CA3AF] py-8 text-center">Ingen oppfølginger</p>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Persistent sidebar */}
          <div className="pl-6">
            <div className="sticky top-6">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#9CA3AF] mb-3">Detaljer</h2>

              {/* Signal */}
              <KVRow label="Signal">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-1.5 cursor-pointer group">
                      <span className={`w-2 h-2 rounded-full ${SIGNAL_DOT[signal]}`} />
                      <span className="text-[13px] text-[#111827]">{signal}</span>
                      <ChevronDown className="w-3 h-3 text-[#9CA3AF] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {SIGNALS.map((s) => (
                      <DropdownMenuItem key={s} onClick={() => setSignal(s)}>
                        <span className={`w-2 h-2 rounded-full ${SIGNAL_DOT[s]} mr-2`} />
                        {s}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </KVRow>

              {/* Eier */}
              <KVRow label="Eier">
                <span className="text-[13px] font-medium">{contact.eier}</span>
              </KVRow>

              {/* Selskap */}
              <KVRow label="Selskap">
                <button className="text-[13px] text-[#111827] hover:text-blue-600 transition-colors inline-flex items-center gap-1">
                  {contact.company}
                  <ExternalLink className="w-3 h-3 text-[#9CA3AF]" />
                </button>
              </KVRow>

              {/* Avdeling */}
              {contact.department && (
                <KVRow label="Avdeling">
                  <span>{contact.department}</span>
                </KVRow>
              )}

              {/* Stilling */}
              <KVRow label="Stilling">
                <span>{contact.title}</span>
              </KVRow>

              {/* Sted */}
              {contact.location && (
                <KVRow label="Sted">
                  <span>{contact.location}</span>
                </KVRow>
              )}

              {/* ── KONTAKT ── */}
              <div className="border-t border-[rgba(0,0,0,0.06)] mt-3 pt-1">
                <KVRow label="Telefon">
                  <a href={`tel:${contact.phone}`} className="text-[13px] text-[#111827] hover:text-blue-600 transition-colors font-mono text-[12px]">{contact.phone}</a>
                </KVRow>
                <KVRow label="E-post">
                  <a href={`mailto:${contact.email}`} className="text-[13px] text-[#111827] hover:text-blue-600 transition-colors truncate block">{contact.email}</a>
                </KVRow>
                {contact.linkedin && (
                  <KVRow label="LinkedIn">
                    <a href="#" className="text-[13px] text-blue-600 hover:text-blue-700 transition-colors inline-flex items-center gap-1">
                      Profil <ExternalLink className="w-3 h-3" />
                    </a>
                  </KVRow>
                )}
              </div>

              {/* ── STATUS ── */}
              <div className="border-t border-[rgba(0,0,0,0.06)] mt-3 pt-1">
                <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#9CA3AF] mt-2.5 mb-2">Status</div>
                <div className="space-y-2">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-[13px] text-[#111827]">CV-Epost</span>
                    <button
                      onClick={() => setCvEmail(!cvEmail)}
                      className={`w-8 h-[18px] rounded-full transition-colors relative ${cvEmail ? "bg-emerald-500" : "bg-[#D1D5DB]"}`}
                    >
                      <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${cvEmail ? "left-[16px]" : "left-[2px]"}`} />
                    </button>
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-[13px] text-[#111827]">Innkjøper</span>
                    <button
                      onClick={() => setCallList(!callList)}
                      className={`w-8 h-[18px] rounded-full transition-colors relative ${callList ? "bg-emerald-500" : "bg-[#D1D5DB]"}`}
                    >
                      <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${callList ? "left-[16px]" : "left-[2px]"}`} />
                    </button>
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-[13px] text-[#111827]">Ikke relevant</span>
                    <button
                      onClick={() => setIkkeRelevant(!ikkeRelevant)}
                      className={`w-8 h-[18px] rounded-full transition-colors relative ${ikkeRelevant ? "bg-red-500" : "bg-[#D1D5DB]"}`}
                    >
                      <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${ikkeRelevant ? "left-[16px]" : "left-[2px]"}`} />
                    </button>
                  </label>
                </div>
              </div>

              {/* ── TEKNISK DNA ── */}
              {contact.teknologier.length > 0 && (
                <div className="border-t border-[rgba(0,0,0,0.06)] mt-3 pt-1">
                  <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#9CA3AF] mt-2.5 mb-2">Teknisk DNA</div>
                  <div className="flex flex-wrap gap-1">
                    {contact.teknologier.map((tag) => (
                      <span key={tag} className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[11px] text-[#6B7280] font-medium">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
