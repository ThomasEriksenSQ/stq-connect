import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Phone, Copy, ExternalLink, Square, CheckSquare, MessageCircle, FileText, Clock, PhoneCall, Users } from "lucide-react";

const SIGNALS: Record<string, { label: string; bg: string; text: string }> = {
  now: { label: "Behov nå", bg: "bg-emerald-500", text: "text-white" },
  future: { label: "Fremtidig", bg: "bg-blue-500", text: "text-white" },
  maybe: { label: "Kanskje", bg: "bg-amber-400", text: "text-amber-950" },
  unknown: { label: "Ukjent", bg: "bg-gray-300", text: "text-gray-700" },
  never: { label: "Aldri", bg: "bg-red-500", text: "text-white" },
};

interface Activity { type: "call" | "meeting"; subject: string; description?: string; date: string; month: string; }
interface Task { title: string; date: string; done: boolean; }

const MOCK: Record<string, {
  name: string; title: string; company: string; email: string; phone: string;
  signal: string; owner: string; tech: string[]; cv: boolean; notes?: string; linkedin?: string;
  tasks: Task[]; activities: Activity[];
}> = {
  "1": {
    name: "Erik Solberg", title: "Tech Lead", company: "Aker Solutions",
    email: "erik.solberg@aker.no", phone: "+47 900 11 222",
    signal: "now", owner: "Jon Richard Nygaard",
    tech: ["Python", "ML", "GCP", "TensorFlow", "Docker"],
    cv: true, linkedin: "linkedin.com/in/eriksolberg",
    notes: "Haster — trenger ML-ingeniør innen 2 uker. Erik er besluttningstaker og foretrekker senior-profiler med erfaring fra energisektoren.",
    tasks: [
      { title: "Finn ML-kandidat", date: "16. apr 2026", done: false },
      { title: "Send CV til Erik", date: "18. apr 2026", done: false },
      { title: "Book demomøte med kandidat", date: "22. apr 2026", done: false },
    ],
    activities: [
      { type: "call", subject: "Hastebehov ML", description: "Prosjektet er 3 uker forsinket. Trenger senior ML-ingeniør med GCP-erfaring. Erik nevnte at de kan gå opp i pris for rett kandidat. Budsjettet er godkjent av CTO.", date: "13. apr 2026", month: "April 2026" },
      { type: "meeting", subject: "Kvartalsgjennomgang", description: "Gikk gjennom pipeline og leveranser. Aker er fornøyd med Johan på frontend-prosjektet. Ønsker å utvide samarbeidet.", date: "1. apr 2026", month: "April 2026" },
      { type: "call", subject: "Oppfølging Q1-leveranse", description: "Kort samtale om faktura og timeføring. Alt i orden.", date: "15. mar 2026", month: "Mars 2026" },
      { type: "meeting", subject: "Ny rammeavtale 2026", description: "Signerte ny rammeavtale for konsulentleveranser. Gjelder fra april 2026.", date: "28. feb 2026", month: "Februar 2026" },
    ],
  },
  "2": {
    name: "Kari Hansen", title: "Engineering Manager", company: "DNB",
    email: "kari.hansen@dnb.no", phone: "+47 911 22 333",
    signal: "now", owner: "Thomas Eriksen",
    tech: ["Java", "Kotlin", "AWS", "Spring Boot", "PostgreSQL"], cv: true,
    notes: "DNB trenger 2 backend-utviklere fra Q3. Kari har budsjettmyndighet.",
    tasks: [{ title: "Send CV-er backend", date: "18. apr 2026", done: false }],
    activities: [
      { type: "meeting", subject: "Kvartalsplanlegging", description: "Diskuterte behovet for 2 backend-utviklere fra Q3. Kari foretrekker Kotlin-erfaring.", date: "10. apr 2026", month: "April 2026" },
      { type: "call", subject: "Intro-samtale", description: "Første kontakt med Kari. Anbefalt av kollega på DNB Markets.", date: "20. mar 2026", month: "Mars 2026" },
    ],
  },
  "3": {
    name: "Silje Strand", title: "Data Engineer", company: "Schibsted",
    email: "silje.strand@schibsted.no", phone: "+47 922 33 444",
    signal: "now", owner: "Jon Richard Nygaard",
    tech: ["Spark", "Kafka", "Python", "Airflow"], cv: false, tasks: [],
    activities: [{ type: "call", subject: "Nytt dataprosjekt", description: "Starter opp nytt dataplattform-prosjekt i juni. Trenger 1-2 data engineers.", date: "11. apr 2026", month: "April 2026" }],
  },
  "4": {
    name: "Camilla Roth", title: "VP Engineering", company: "Vipps",
    email: "camilla.roth@vipps.no", phone: "+47 933 44 555",
    signal: "now", owner: "Thomas Eriksen",
    tech: ["Kotlin", "Swift", "React", "Firebase"], cv: true,
    tasks: [{ title: "Presentere kandidater", date: "14. apr 2026", done: false }],
    activities: [{ type: "call", subject: "Mobilteam-utvidelse", description: "Trenger 3 mobilutviklere ASAP. Budsjett er klar. Foretrekker Kotlin Multiplatform.", date: "14. apr 2026", month: "April 2026" }],
  },
};

function getFallback(id: string) {
  return { name: `Kontakt ${id}`, title: "Ukjent", company: "Ukjent", email: "—", phone: "—", signal: "unknown", owner: "—", tech: [] as string[], cv: false, tasks: [] as Task[], activities: [] as Activity[] };
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function DesignLabContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const data = MOCK[id || ""] || getFallback(id || "");
  const signal = SIGNALS[data.signal] || SIGNALS.unknown;

  const activityMonths = data.activities.reduce<Record<string, Activity[]>>((acc, a) => {
    (acc[a.month] = acc[a.month] || []).push(a);
    return acc;
  }, {});

  return (
    <div className="min-h-screen" style={{ background: "#F8F7F4", fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
      {/* Top bar */}
      <header className="h-14 flex items-center px-8 border-b" style={{ background: "#FFFFFF", borderColor: "#E8E6E1" }}>
        <button
          onClick={() => navigate("/design-lab/kontakter")}
          className="flex items-center gap-2 text-[13px] font-medium transition-opacity hover:opacity-70"
          style={{ color: "#6B6B6B" }}
        >
          <ArrowLeft size={16} /> Tilbake
        </button>
      </header>

      <div className="max-w-[900px] mx-auto px-8 py-10">
        {/* Hero card */}
        <div className="rounded-xl border p-8 mb-8" style={{ background: "#FFFFFF", borderColor: "#E8E6E1", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-5">
              {/* Avatar */}
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-[18px] font-bold flex-shrink-0" style={{ background: "#F0EFEB", color: "#6B6B6B" }}>
                {getInitials(data.name)}
              </div>
              <div>
                <h1 className="text-[26px] font-bold tracking-tight" style={{ color: "#1A1A1A" }}>{data.name}</h1>
                <p className="text-[15px] mt-0.5" style={{ color: "#6B6B6B" }}>{data.title} · {data.company}</p>
                <div className="flex items-center gap-3 mt-3">
                  <span className={`inline-flex items-center text-[12px] font-semibold px-2.5 py-1 rounded-full ${signal.bg} ${signal.text}`}>
                    {signal.label}
                  </span>
                  {data.cv && <span className="text-[11px] font-bold px-2 py-0.5 rounded" style={{ background: "#E8E6F9", color: "#5B4FC4" }}>CV</span>}
                  <span className="text-[13px] font-medium" style={{ color: "#8A8780" }}>{data.owner}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button className="h-10 px-5 text-[13px] font-semibold rounded-lg flex items-center gap-2" style={{ background: "#16A34A", color: "#FFFFFF" }}>
                <PhoneCall size={14} /> Logg samtale
              </button>
              <button className="h-10 px-5 text-[13px] font-semibold rounded-lg flex items-center gap-2 border" style={{ borderColor: "#E8E6E1", color: "#6B6B6B", background: "#FFFFFF" }}>
                <Clock size={14} style={{ color: "#D97706" }} /> Ny oppfølging
              </button>
            </div>
          </div>
        </div>

        {/* Two-column: Contact info + Next steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
          {/* Contact info */}
          <div className="rounded-xl border p-6" style={{ background: "#FFFFFF", borderColor: "#E8E6E1" }}>
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] mb-4" style={{ color: "#8A8780" }}>Kontaktinfo</div>
            <div className="space-y-3">
              <InfoRow icon={<Mail size={15} />} text={data.email} />
              <InfoRow icon={<Phone size={15} />} text={data.phone} />
              {(data as any).linkedin && <InfoRow icon={<ExternalLink size={15} />} text={(data as any).linkedin} />}
            </div>
            {data.tech.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-5 pt-4" style={{ borderTop: "1px solid #F0EFEB" }}>
                {data.tech.map(t => (
                  <span key={t} className="text-[12px] px-2 py-0.5 rounded-md" style={{ background: "#F4F3F0", color: "#6B6B6B" }}>{t}</span>
                ))}
              </div>
            )}
          </div>

          {/* Next steps */}
          <div className="rounded-xl border p-6" style={{ background: "#FFFFFF", borderColor: "#E8E6E1" }}>
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] mb-4" style={{ color: "#8A8780" }}>Neste steg</div>
            {data.tasks.length === 0 && <p className="text-[14px]" style={{ color: "#B0AEA6" }}>Ingen oppfølginger</p>}
            <div className="space-y-1">
              {data.tasks.map((task, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 px-3 rounded-lg cursor-pointer transition-colors hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    {task.done
                      ? <CheckSquare size={16} style={{ color: "#16A34A" }} />
                      : <Square size={16} style={{ color: "#D1D0CB" }} />
                    }
                    <span className="text-[14px]" style={{ color: task.done ? "#B0AEA6" : "#1A1A1A", textDecoration: task.done ? "line-through" : "none" }}>{task.title}</span>
                  </div>
                  <span className="text-[13px]" style={{ color: "#B0AEA6" }}>{task.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Activities */}
        {data.activities.length > 0 && (
          <div className="mb-10">
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] mb-5" style={{ color: "#8A8780" }}>Aktiviteter</div>
            {Object.entries(activityMonths).map(([month, acts]) => (
              <div key={month} className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-[13px] font-bold" style={{ color: "#1A1A1A" }}>{month}</span>
                  <div className="flex-1 h-px" style={{ background: "#E8E6E1" }} />
                </div>
                <div className="relative pl-8">
                  <div className="absolute left-[6px] top-1 bottom-1 w-[2px] rounded-full" style={{ background: "#E8E6E1" }} />
                  <div className="space-y-5">
                    {acts.map((a, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-8 top-[3px] w-[14px] h-[14px] rounded-full flex items-center justify-center" style={{ background: "#FFFFFF", border: "2px solid #E8E6E1" }}>
                          {a.type === "call"
                            ? <MessageCircle size={8} style={{ color: "#16A34A" }} />
                            : <FileText size={8} style={{ color: "#5B4FC4" }} />
                          }
                        </div>
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-[15px] font-semibold" style={{ color: "#1A1A1A" }}>{a.subject}</span>
                          <span className="text-[13px] ml-4 flex-shrink-0" style={{ color: "#B0AEA6" }}>{a.date}</span>
                        </div>
                        {a.description && <p className="text-[14px] leading-relaxed" style={{ color: "#6B6B6B" }}>{a.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        {(data as any).notes && (
          <div className="mb-10">
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] mb-4" style={{ color: "#8A8780" }}>Notater</div>
            <div className="rounded-xl border p-6" style={{ background: "#FFFFFF", borderColor: "#E8E6E1" }}>
              <p className="text-[14px] leading-relaxed whitespace-pre-wrap" style={{ color: "#6B6B6B" }}>{(data as any).notes}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-3">
        <span style={{ color: "#B0AEA6" }}>{icon}</span>
        <span className="text-[14px]" style={{ color: "#1A1A1A" }}>{text}</span>
      </div>
      <button className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100">
        <Copy size={13} style={{ color: "#B0AEA6" }} />
      </button>
    </div>
  );
}
