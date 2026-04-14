import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, Mail, Clock, Copy, MessageCircle, FileText, ExternalLink } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────
type Signal = "Behov nå" | "Fremtidig behov" | "Har kanskje behov" | "Ukjent om behov" | "Aldri aktuelt";

interface MockContact {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  signal: Signal;
  owner: string;
  hasCv: boolean;
  cvUnsubscribed: boolean;
  technologies: string[];
  lastActivityDaysAgo: number;
  notes: string;
  tasks: { title: string; dueDate: string; done?: boolean }[];
  activities: { type: "call" | "meeting"; subject: string; date: string; description: string }[];
}

const CONTACTS: Record<string, MockContact> = {
  "1": { id: "1", firstName: "Erik", lastName: "Solberg", title: "Tech Lead", company: "Aker Solutions", email: "erik.solberg@aker.no", phone: "+47 900 11 222", signal: "Behov nå", owner: "Jon Richard Nygaard", hasCv: true, cvUnsubscribed: false, technologies: ["Python", "ML", "GCP"], lastActivityDaysAgo: 1, notes: "Haster — trenger ML-ingeniør innen 2 uker.\nHar budsjett og mandat til å signere avtale direkte.", tasks: [{ title: "Finn ML-kandidat", dueDate: "2026-04-16" }, { title: "Sett opp intervju med kandidat A", dueDate: "2026-04-18", done: true }], activities: [{ type: "call", subject: "Hastebehov ML", date: "2026-04-13", description: "Prosjektet er forsinket. Trenger senior ML-ingeniør ASAP. Budsjett er godkjent, kan starte umiddelbart." }, { type: "meeting", subject: "Teknisk gjennomgang", date: "2026-04-01", description: "Gikk gjennom infrastruktur og krav til ML-pipeline. GCP-basert, trenger erfaring med Vertex AI." }, { type: "call", subject: "Første kontakt", date: "2026-03-15", description: "Introduksjon via LinkedIn. Interessert i Stacq sin kompetanse innen ML og data engineering." }] },
  "2": { id: "2", firstName: "Kari", lastName: "Hansen", title: "VP Engineering", company: "DNB", email: "kari.hansen@dnb.no", phone: "+47 911 22 333", signal: "Behov nå", owner: "Jon Richard Nygaard", hasCv: true, cvUnsubscribed: false, technologies: ["Java", "Kotlin", "AWS"], lastActivityDaysAgo: 3, notes: "Bygger nytt team for digital bankplattform.\nÅpent budsjett for Q2.", tasks: [{ title: "Send CV-pakke", dueDate: "2026-04-18" }], activities: [{ type: "meeting", subject: "Kvartalsplanlegging", date: "2026-04-11", description: "Gjennomgikk bemanningsplan Q2. Trenger 3 backend-utviklere med Java/Kotlin-erfaring." }] },
  "3": { id: "3", firstName: "Lars", lastName: "Moen", title: "CTO", company: "Equinor ASA", email: "lars.moen@equinor.com", phone: "+47 922 33 444", signal: "Fremtidig behov", owner: "Thomas Eriksen", hasCv: false, cvUnsubscribed: false, technologies: ["Azure", "DevOps", "Terraform"], lastActivityDaysAgo: 7, notes: "", tasks: [], activities: [{ type: "call", subject: "Oppfølging etter konferanse", date: "2026-04-07", description: "Møttes på NDC. Interessert i DevOps-kompetanse fra Q3." }] },
  "6": { id: "6", firstName: "Silje", lastName: "Strand", title: "Head of Data", company: "Schibsted", email: "silje.strand@schibsted.com", phone: "+47 955 66 777", signal: "Behov nå", owner: "Thomas Eriksen", hasCv: true, cvUnsubscribed: false, technologies: ["Python", "Spark", "Databricks"], lastActivityDaysAgo: 2, notes: "Trenger data engineer til VG-prosjektet.", tasks: [{ title: "Send profiler", dueDate: "2026-04-15" }], activities: [{ type: "call", subject: "Nytt dataprosjekt", date: "2026-04-12", description: "VG skal bygge ny dataplattform. Trenger 2 data engineers med Databricks-erfaring." }] },
  "10": { id: "10", firstName: "Camilla", lastName: "Roth", title: "Product Lead", company: "Vipps MobilePay", email: "camilla.roth@vipps.no", phone: "+47 900 12 345", signal: "Behov nå", owner: "Jon Richard Nygaard", hasCv: true, cvUnsubscribed: false, technologies: ["Kotlin", "Swift", "React Native"], lastActivityDaysAgo: 0, notes: "Akutt behov for mobil-utviklere.\nProsjektstart neste uke.", tasks: [{ title: "Intervju med kandidat", dueDate: "2026-04-14" }], activities: [{ type: "call", subject: "Hastebehov mobil", date: "2026-04-14", description: "Trenger 2 mobilutviklere umiddelbart. Prosjektstart neste uke. Kotlin og Swift." }] },
};

const SIGNAL_CONFIG: Record<Signal, { dot: string; label: string }> = {
  "Behov nå": { dot: "bg-emerald-500", label: "Behov nå" },
  "Fremtidig behov": { dot: "bg-blue-500", label: "Fremtidig behov" },
  "Har kanskje behov": { dot: "bg-amber-500", label: "Har kanskje behov" },
  "Ukjent om behov": { dot: "bg-gray-400", label: "Ukjent om behov" },
  "Aldri aktuelt": { dot: "bg-red-500", label: "Aldri aktuelt" },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];
  return `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function relativeTime(daysAgo: number): string {
  if (daysAgo === 0) return "I dag";
  if (daysAgo === 1) return "1 dag siden";
  if (daysAgo < 7) return `${daysAgo} dager siden`;
  if (daysAgo < 30) return `${Math.floor(daysAgo / 7)} uker siden`;
  return `${Math.floor(daysAgo / 30)} mnd siden`;
}

// Group activities by month
function groupByMonth(activities: MockContact["activities"]) {
  const groups: Record<string, typeof activities> = {};
  for (const a of activities) {
    const d = new Date(a.date);
    const months = ["Januar", "Februar", "Mars", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Desember"];
    const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  }
  return Object.entries(groups);
}

export default function DesignLabContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const contact = CONTACTS[id || ""];

  if (!contact) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#FAFBFC]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div className="text-center">
          <p className="text-[15px] text-[#6B7280] mb-4">Kontakt ikke funnet</p>
          <button onClick={() => navigate("/design-lab/kontakter")} className="text-[13px] text-[#4F46E5] hover:underline">
            ← Tilbake til kontakter
          </button>
        </div>
      </div>
    );
  }

  const sig = SIGNAL_CONFIG[contact.signal];
  const activityGroups = groupByMonth(contact.activities);

  return (
    <div className="design-lab h-screen flex flex-col bg-[#FAFBFC]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Top bar */}
      <div className="h-12 border-b border-[#E5E7EB] bg-white flex items-center px-6 shrink-0">
        <span className="text-[13px] font-bold text-[#111827] tracking-[0.02em]">STACQ</span>
        <span className="text-[13px] text-[#9CA3AF] ml-2">· Design Lab</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[900px] mx-auto px-8 py-8">
          {/* Back link */}
          <button
            onClick={() => navigate("/design-lab/kontakter")}
            className="inline-flex items-center gap-1.5 text-[13px] text-[#6B7280] hover:text-[#4F46E5] transition-colors mb-8"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Tilbake til kontakter
          </button>

          {/* Hero section */}
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[18px] font-bold text-[#6B7280] shrink-0">
                {contact.firstName[0]}{contact.lastName[0]}
              </div>
              <div>
                <h1 className="text-[28px] font-bold text-[#111827] leading-tight">
                  {contact.firstName} {contact.lastName}
                </h1>
                <p className="text-[15px] text-[#6B7280] mt-1">
                  {contact.title} · {contact.company}
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#374151]">
                    <span className={`w-2.5 h-2.5 rounded-full ${sig.dot}`} />
                    {sig.label}
                  </span>
                  {contact.hasCv && (
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                      contact.cvUnsubscribed ? "bg-red-50 text-red-600" : "bg-[#4F46E5]/10 text-[#4F46E5]"
                    }`}>
                      CV{contact.cvUnsubscribed ? " ✗" : ""}
                    </span>
                  )}
                  <span className="text-[12px] text-[#9CA3AF]">
                    Eier: {contact.owner}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                <Phone className="w-3.5 h-3.5" />
                Logg samtale
              </button>
              <button className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-medium rounded-lg bg-[#4F46E5] text-white hover:bg-[#4338CA] transition-colors">
                <FileText className="w-3.5 h-3.5" />
                Logg møte
              </button>
              <button className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-medium rounded-lg border border-[#E5E7EB] text-[#374151] bg-white hover:bg-[#F9FAFB] transition-colors">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                Ny oppfølging
              </button>
            </div>
          </div>

          {/* Two-column info bar */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* Contact info */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B7280] mb-4">
                Kontaktinfo
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between group">
                  <div className="flex items-center gap-2.5">
                    <Mail className="w-4 h-4 text-[#9CA3AF]" />
                    <span className="text-[13px] text-[#374151]">{contact.email}</span>
                  </div>
                  <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#F3F4F6] text-[#9CA3AF] transition-all">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between group">
                  <div className="flex items-center gap-2.5">
                    <Phone className="w-4 h-4 text-[#9CA3AF]" />
                    <span className="text-[13px] text-[#374151]">{contact.phone}</span>
                  </div>
                  <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#F3F4F6] text-[#9CA3AF] transition-all">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2.5">
                  <ExternalLink className="w-4 h-4 text-[#9CA3AF]" />
                  <span className="text-[13px] text-[#4F46E5] hover:underline cursor-pointer">{contact.company}</span>
                </div>
                {contact.technologies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {contact.technologies.map(t => (
                      <span key={t} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#F3F4F6] text-[#6B7280]">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Snapshot */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B7280] mb-4">
                Snapshot
              </h2>
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] text-[#9CA3AF] mb-1">Siste aktivitet</p>
                  <p className="text-[13px] font-medium text-[#111827]">
                    {relativeTime(contact.lastActivityDaysAgo)}
                    {contact.activities[0] && (
                      <span className="text-[#6B7280] font-normal"> · {contact.activities[0].type === "call" ? "Samtale" : "Møte"}</span>
                    )}
                  </p>
                </div>
                {contact.tasks.filter(t => !t.done).length > 0 && (
                  <div>
                    <p className="text-[11px] text-[#9CA3AF] mb-1">Neste oppfølging</p>
                    <p className="text-[13px] font-medium text-[#111827]">
                      {formatDate(contact.tasks.filter(t => !t.done)[0].dueDate)}
                      <span className="text-[#6B7280] font-normal"> · {contact.tasks.filter(t => !t.done)[0].title}</span>
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-[11px] text-[#9CA3AF] mb-1">Totalt</p>
                  <p className="text-[13px] text-[#374151]">
                    {contact.activities.length} aktiviteter · {contact.tasks.length} oppfølginger
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tasks */}
          {contact.tasks.length > 0 && (
            <div className="mb-8">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B7280] mb-4">
                Oppfølginger
              </h2>
              <div className="bg-white rounded-xl border border-[#E5E7EB] divide-y divide-[#F3F4F6]">
                {contact.tasks.map((t, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3.5 hover:bg-[#FAFBFC] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        t.done ? "bg-[#4F46E5] border-[#4F46E5]" : "border-[#D1D5DB]"
                      }`}>
                        {t.done && <span className="text-white text-[10px]">✓</span>}
                      </div>
                      <span className={`text-[13px] ${t.done ? "line-through text-[#9CA3AF]" : "text-[#374151]"}`}>
                        {t.title}
                      </span>
                    </div>
                    <span className={`text-[12px] font-medium ${t.done ? "text-[#D1D5DB]" : "text-[#9CA3AF]"}`}>
                      {formatDate(t.dueDate)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activities */}
          {contact.activities.length > 0 && (
            <div className="mb-8">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B7280] mb-4">
                Aktiviteter
              </h2>
              <div className="space-y-6">
                {activityGroups.map(([month, items]) => (
                  <div key={month}>
                    {/* Month header */}
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-[13px] font-bold text-[#111827]">{month}</span>
                      <div className="flex-1 h-px bg-[#E5E7EB]" />
                    </div>
                    {/* Activity items */}
                    <div className="space-y-0">
                      {items.map((a, i) => (
                        <div key={i} className="relative pl-8 pb-6 last:pb-0">
                          {i < items.length - 1 && (
                            <div className="absolute left-[7px] top-[18px] bottom-0 w-[2px] bg-[#E5E7EB]" />
                          )}
                          <div className={`absolute left-0 top-[4px] w-4 h-4 rounded-full flex items-center justify-center ${
                            a.type === "call" ? "bg-emerald-50" : "bg-[#EEF2FF]"
                          }`}>
                            {a.type === "call" ? (
                              <MessageCircle className="w-2.5 h-2.5 text-emerald-600" />
                            ) : (
                              <FileText className="w-2.5 h-2.5 text-[#4F46E5]" />
                            )}
                          </div>
                          <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 hover:shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[14px] font-semibold text-[#111827]">{a.subject}</span>
                              <span className="text-[12px] text-[#9CA3AF]">{formatDate(a.date)}</span>
                            </div>
                            <p className="text-[13px] text-[#6B7280] leading-relaxed whitespace-pre-wrap">{a.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {contact.notes && (
            <div className="mb-12">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B7280] mb-4">
                Notater
              </h2>
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
                <p className="text-[13px] text-[#374151] leading-relaxed whitespace-pre-wrap">{contact.notes}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
