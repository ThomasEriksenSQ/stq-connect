import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, Mail, MessageCircle, FileText, Clock, Users } from "lucide-react";

/* ── Top Strip (same as list) ── */
function TopStrip() {
  return (
    <header className="h-12 flex items-center justify-between px-6 border-b border-[#E5E7EB] bg-white">
      <span className="tracking-tight font-extrabold text-lg text-[#111827]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
        STACQ
      </span>
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold bg-[#111827] text-white">
        JR
      </div>
    </header>
  );
}

/* ── Signal config ── */
type Signal = "now" | "future" | "maybe" | "unknown" | "never";
const SIGNAL_META: Record<Signal, { label: string; color: string; textColor: string }> = {
  now: { label: "Behov nå", color: "#10B981", textColor: "#065F46" },
  future: { label: "Fremtidig behov", color: "#3B82F6", textColor: "#1E40AF" },
  maybe: { label: "Har kanskje behov", color: "#F59E0B", textColor: "#92400E" },
  unknown: { label: "Ukjent om behov", color: "#9CA3AF", textColor: "#6B7280" },
  never: { label: "Aldri aktuelt", color: "#EF4444", textColor: "#991B1B" },
};

/* ── Types ── */
interface Activity { type: "call" | "meeting"; subject: string; description?: string; date: string; month: string; }
interface Task { title: string; date: string; done: boolean; }
interface Consultant { name: string; title: string; match: number; tech: string[]; available: string; }

interface ContactData {
  name: string; title: string; company: string; email: string; phone: string;
  signal: Signal; owner: string; tech: string[]; notes?: string;
  tasks: Task[]; activities: Activity[]; consultants: Consultant[];
}

/* ── Mock data ── */
const MOCK: Record<string, ContactData> = {
  "1": {
    name: "Erik Solberg", title: "Tech Lead", company: "Aker Solutions",
    email: "erik.solberg@aker.no", phone: "+47 900 11 222",
    signal: "now", owner: "Jon Richard Nygaard",
    tech: ["Python", "ML", "GCP", "TensorFlow", "Docker"],
    notes: "Haster — trenger ML-ingeniør innen 2 uker. Erik er besluttningstaker og foretrekker senior-profiler med erfaring fra energisektoren.",
    tasks: [
      { title: "Send 2 ML-profiler til Erik", date: "16. apr 2026", done: false },
      { title: "Book demomøte med kandidat", date: "22. apr 2026", done: false },
    ],
    activities: [
      { type: "call", subject: "Hastebehov ML-ingeniør", description: "Prosjektet er 3 uker forsinket. Trenger senior ML-ingeniør med GCP-erfaring. Erik nevnte at de kan gå opp i pris for rett kandidat.", date: "13. apr 2026", month: "April 2026" },
      { type: "meeting", subject: "Kvartalsgjennomgang", description: "Gikk gjennom pipeline og leveranser. Aker er fornøyd med Johan på frontend-prosjektet. Ønsker å utvide samarbeidet.", date: "1. apr 2026", month: "April 2026" },
      { type: "call", subject: "Oppfølging Q1-leveranse", description: "Kort samtale om faktura og timeføring. Alt i orden.", date: "15. mar 2026", month: "Mars 2026" },
      { type: "meeting", subject: "Ny rammeavtale 2026", description: "Signerte ny rammeavtale for konsulentleveranser.", date: "28. feb 2026", month: "Februar 2026" },
    ],
    consultants: [
      { name: "Sara Nordström", title: "ML Engineer", match: 94, tech: ["Python", "TensorFlow", "GCP"], available: "Nå" },
      { name: "Kim Larsen", title: "Data Scientist", match: 87, tech: ["Python", "ML", "AWS"], available: "Mai 2026" },
      { name: "Anders Berg", title: "Backend Developer", match: 72, tech: ["Python", "Docker", "GCP"], available: "Nå" },
    ],
  },
  "2": {
    name: "Kari Hansen", title: "Engineering Manager", company: "DNB",
    email: "kari.hansen@dnb.no", phone: "+47 911 22 333",
    signal: "now", owner: "Thomas Eriksen",
    tech: ["Java", "Kotlin", "AWS", "Spring Boot", "PostgreSQL"],
    notes: "DNB trenger 2 backend-utviklere fra Q3. Kari har budsjettmyndighet.",
    tasks: [{ title: "Book demo med teamleder", date: "18. apr 2026", done: false }],
    activities: [
      { type: "meeting", subject: "Kvartalsplanlegging", description: "Diskuterte behovet for 2 backend-utviklere fra Q3. Kari foretrekker Kotlin-erfaring.", date: "10. apr 2026", month: "April 2026" },
      { type: "call", subject: "Intro-samtale", description: "Første kontakt med Kari. Anbefalt av kollega på DNB Markets.", date: "20. mar 2026", month: "Mars 2026" },
    ],
    consultants: [
      { name: "Martin Olsen", title: "Backend Developer", match: 91, tech: ["Kotlin", "Spring Boot", "AWS"], available: "Juni 2026" },
      { name: "Julie Svensson", title: "Fullstack Developer", match: 83, tech: ["Java", "React", "PostgreSQL"], available: "Nå" },
    ],
  },
  "3": {
    name: "Silje Strand", title: "Data Engineering Lead", company: "Schibsted",
    email: "silje.strand@schibsted.no", phone: "+47 922 33 444",
    signal: "now", owner: "Jon Richard Nygaard",
    tech: ["Spark", "Kafka", "Databricks", "Python"],
    notes: "Schibsted bygger nytt dataplattform-team. Trenger erfaren Spark-konsulent snarest.",
    tasks: [{ title: "Sende profil Spark-konsulent", date: "15. apr 2026", done: false }],
    activities: [
      { type: "call", subject: "Behov dataplattform", description: "Silje beskrev behovet: senior Spark-utvikler med Kafka-erfaring, helst med mediedomene.", date: "9. apr 2026", month: "April 2026" },
    ],
    consultants: [
      { name: "Ole Thorsen", title: "Data Engineer", match: 96, tech: ["Spark", "Kafka", "Python"], available: "Nå" },
    ],
  },
  "6": {
    name: "Henrik Berg", title: "Platform Lead", company: "Equinor",
    email: "henrik.berg@equinor.com", phone: "+47 933 44 555",
    signal: "now", owner: "Jon Richard Nygaard",
    tech: ["Azure", "Terraform", "DevOps", "Python"],
    notes: "Equinor trenger 2 DevOps-konsulenter for skymigrering. Stor kontrakt.",
    tasks: [{ title: "Presentere 2 DevOps-profiler", date: "17. apr 2026", done: false }],
    activities: [
      { type: "call", subject: "DevOps-behov skymigrering", description: "Henrik beskrev behovet: 2 senior DevOps med Terraform og Azure. Prosjektet starter i mai.", date: "12. apr 2026", month: "April 2026" },
      { type: "meeting", subject: "Intro-møte Equinor IT", description: "Første møte med platform-teamet. God kjemi.", date: "25. mar 2026", month: "Mars 2026" },
    ],
    consultants: [
      { name: "Erik Haugen", title: "DevOps Engineer", match: 92, tech: ["Azure", "Terraform", "Kubernetes"], available: "Nå" },
      { name: "Lise Bakken", title: "Cloud Engineer", match: 88, tech: ["Azure", "DevOps", "Python"], available: "Mai 2026" },
    ],
  },
};

// Fallback for IDs not in MOCK
function getFallback(id: string): ContactData {
  return {
    name: "Ukjent kontakt", title: "–", company: "–",
    email: "–", phone: "–", signal: "unknown", owner: "–",
    tech: [], tasks: [], activities: [], consultants: [],
  };
}

/* ── Page ── */
export default function DesignLabContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const data = MOCK[id || ""] || getFallback(id || "");
  const sig = SIGNAL_META[data.signal];

  const font = "Inter, system-ui, sans-serif";

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: font }}>
      <TopStrip />

      <div className="max-w-[1200px] mx-auto px-6 py-6">
        {/* Back */}
        <button
          onClick={() => navigate("/design-lab/kontakter")}
          className="inline-flex items-center gap-1.5 text-[13px] text-[#6B7280] hover:text-[#111827] transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Kontakter
        </button>

        {/* Header + actions */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-[28px] font-bold text-[#111827]">{data.name}</h1>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{ background: sig.color + "20", color: sig.textColor, border: `1px solid ${sig.color}40` }}
              >
                {sig.label}
              </span>
            </div>
            <div className="text-[15px] text-[#6B7280]">
              {data.title} · {data.company}
            </div>
            <div className="text-[13px] text-[#9CA3AF] mt-1">
              Eier: {data.owner}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#10B981] text-white text-[13px] font-medium hover:bg-[#059669] transition-colors">
              <Phone className="w-3.5 h-3.5" /> Ring
            </button>
            <button className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#111827] text-white text-[13px] font-medium hover:bg-[#1F2937] transition-colors">
              <Mail className="w-3.5 h-3.5" /> E-post
            </button>
            <button className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-[#E5E7EB] text-[#111827] text-[13px] font-medium hover:bg-[#F9FAFB] transition-colors">
              <MessageCircle className="w-3.5 h-3.5" /> Logg samtale
            </button>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex gap-8">
          {/* Left: main content */}
          <div className="flex-[2] min-w-0">
            {/* Contact info strip */}
            <div className="flex items-center gap-6 mb-8 text-[13px] text-[#6B7280]">
              <a href={`mailto:${data.email}`} className="hover:text-[#111827] transition-colors">{data.email}</a>
              <span>{data.phone}</span>
            </div>

            {/* Notes */}
            {data.notes && (
              <div className="mb-8 p-4 rounded-lg bg-[#FFFBEB] border border-[#FDE68A]">
                <div className="text-[12px] font-semibold text-[#92400E] uppercase tracking-[0.06em] mb-1">Notat</div>
                <div className="text-[14px] text-[#78350F] leading-relaxed">{data.notes}</div>
              </div>
            )}

            {/* Next steps */}
            {data.tasks.length > 0 && (
              <div className="mb-10">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF] mb-3 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" /> Neste steg
                </h3>
                <div className="space-y-2">
                  {data.tasks.map((t, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[#F9FAFB] transition-colors">
                      <div className="w-4 h-4 rounded border-2 border-[#D1D5DB] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[14px] font-medium text-[#111827]">{t.title}</span>
                      </div>
                      <span className="text-[12px] text-[#9CA3AF] shrink-0">{t.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tech tags */}
            {data.tech.length > 0 && (
              <div className="mb-10">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF] mb-3">Teknologier</h3>
                <div className="flex flex-wrap gap-1.5">
                  {data.tech.map((t) => (
                    <span key={t} className="inline-flex items-center rounded-md px-2 py-1 text-[12px] font-medium bg-[#F3F4F6] text-[#374151]">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Activity timeline */}
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF] mb-4">Aktivitetslogg</h3>
              {(() => {
                const months = [...new Set(data.activities.map((a) => a.month))];
                return months.map((month) => (
                  <div key={month} className="mb-6">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[13px] font-bold text-[#111827]">{month}</span>
                      <div className="flex-1 h-px bg-[#E5E7EB]" />
                    </div>
                    <div className="relative pl-6">
                      <div className="absolute left-[5px] top-[5px] bottom-0 w-[2px] bg-[#E5E7EB]" />
                      {data.activities.filter((a) => a.month === month).map((a, i) => {
                        const isCall = a.type === "call";
                        return (
                          <div key={i} className="relative mb-5 last:mb-0">
                            <div className="absolute -left-6 top-[2px] w-[12px] h-[12px] rounded-full bg-white flex items-center justify-center">
                              {isCall
                                ? <MessageCircle className="w-3 h-3 text-[#10B981]" />
                                : <FileText className="w-3 h-3 text-[#3B82F6]" />
                              }
                            </div>
                            <div className="text-[15px] font-semibold text-[#111827] mb-0.5">{a.subject}</div>
                            {a.description && (
                              <div className="text-[14px] text-[#6B7280] leading-relaxed mb-1">{a.description}</div>
                            )}
                            <div className="text-[12px] text-[#9CA3AF]">{a.date}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Right: Consultant matches */}
          <div className="w-[340px] shrink-0">
            <div className="sticky top-6">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF] mb-3 flex items-center gap-2">
                <Users className="w-3.5 h-3.5" /> Konsulentmatch
              </h3>
              {data.consultants.length > 0 ? (
                <div className="space-y-3">
                  {data.consultants.map((c, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-lg border border-[#E5E7EB] hover:border-[#D1D5DB] transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-[14px] font-semibold text-[#111827]">{c.name}</div>
                          <div className="text-[12px] text-[#6B7280]">{c.title}</div>
                        </div>
                        <span
                          className="text-[12px] font-bold rounded-full px-2 py-0.5"
                          style={{
                            background: c.match >= 90 ? "#D1FAE5" : c.match >= 80 ? "#DBEAFE" : "#F3F4F6",
                            color: c.match >= 90 ? "#065F46" : c.match >= 80 ? "#1E40AF" : "#6B7280",
                          }}
                        >
                          {c.match}%
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {c.tech.map((t) => (
                          <span key={t} className="text-[11px] rounded px-1.5 py-0.5 bg-[#F3F4F6] text-[#6B7280]">{t}</span>
                        ))}
                      </div>
                      <div className="text-[12px] text-[#9CA3AF]">
                        Tilgjengelig: <span className={c.available === "Nå" ? "text-[#10B981] font-medium" : ""}>{c.available}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[13px] text-[#D1D5DB] py-8 text-center">
                  Ingen konsulentmatch funnet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
