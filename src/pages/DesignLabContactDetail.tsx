import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Phone, Copy, ExternalLink, CheckSquare, Square, MessageCircle, FileText } from "lucide-react";

const fontLink = "https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap";

const C = {
  base: "#0A0A0F",
  surface: "#16161F",
  elevated: "#1E1E2A",
  border: "#2A2A3C",
  textPrimary: "#EDEDF0",
  textSecondary: "#8B8B9E",
  textTertiary: "#55556A",
  accent: "#6C5CE7",
  signalNow: "#00D68F",
  signalFuture: "#4DA6FF",
  signalMaybe: "#FFB347",
  signalUnknown: "#55556A",
  signalNever: "#FF6B6B",
};

const SIGNALS: Record<string, { label: string; color: string }> = {
  now: { label: "Behov nå", color: C.signalNow },
  future: { label: "Fremtidig behov", color: C.signalFuture },
  maybe: { label: "Har kanskje behov", color: C.signalMaybe },
  unknown: { label: "Ukjent om behov", color: C.signalUnknown },
  never: { label: "Aldri aktuelt", color: C.signalNever },
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
  return { name: `Kontakt ${id}`, title: "Ukjent", company: "Ukjent", email: "—", phone: "—", signal: "unknown", owner: "—", tech: [], cv: false, tasks: [] as Task[], activities: [] as Activity[] };
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
    <>
      <link rel="stylesheet" href={fontLink} />
      <div className="min-h-screen" style={{ background: C.base, fontFamily: "'Geist', system-ui, sans-serif" }}>
        <header className="sticky top-0 z-30 h-[52px] flex items-center px-6" style={{ background: C.base, borderBottom: `1px solid ${C.border}` }}>
          <button className="flex items-center gap-2 text-[13px] transition-colors" style={{ color: C.textSecondary }}
            onClick={() => navigate("/design-lab/kontakter")}
            onMouseEnter={e => (e.currentTarget.style.color = C.textPrimary)}
            onMouseLeave={e => (e.currentTarget.style.color = C.textSecondary)}
          ><ArrowLeft size={15} />Tilbake</button>
        </header>

        <div className="max-w-[800px] mx-auto px-6 py-10">
          {/* Hero */}
          <div className="mb-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-[28px] font-semibold tracking-[-0.03em]" style={{ color: C.textPrimary }}>{data.name}</h1>
                <p className="text-[15px] mt-1" style={{ color: C.textSecondary }}>{data.title} · {data.company}</p>
                <div className="flex items-center gap-3 mt-3">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: signal.color }}>
                    <span className="w-[7px] h-[7px] rounded-full" style={{ background: signal.color }} />{signal.label}
                  </span>
                  {data.cv && <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: `${C.accent}22`, color: C.accent }}>CV</span>}
                  <span className="text-[12px]" style={{ color: C.textTertiary }}>{data.owner}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="h-9 px-4 text-[13px] font-medium rounded-lg" style={{ background: C.signalNow, color: "#000" }}>Logg samtale</button>
                <button className="h-9 px-4 text-[13px] font-medium rounded-lg" style={{ border: `1px solid ${C.border}`, color: C.textSecondary, background: "transparent" }}>Ny oppfølging</button>
              </div>
            </div>
            <div className="h-[1px] mt-6" style={{ background: `linear-gradient(90deg, ${signal.color}, ${signal.color}22, transparent)` }} />
          </div>

          {/* Two-column */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="rounded-xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-4" style={{ color: C.textTertiary }}>Kontaktinfo</div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[13px]" style={{ color: C.textSecondary }}><Mail size={13} style={{ color: C.textTertiary }} />{data.email}</div>
                  <button className="p-1 rounded transition-colors" style={{ color: C.textTertiary }} onMouseEnter={e => (e.currentTarget.style.color = C.accent)} onMouseLeave={e => (e.currentTarget.style.color = C.textTertiary)}><Copy size={12} /></button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[13px]" style={{ color: C.textSecondary }}><Phone size={13} style={{ color: C.textTertiary }} />{data.phone}</div>
                  <button className="p-1 rounded transition-colors" style={{ color: C.textTertiary }} onMouseEnter={e => (e.currentTarget.style.color = C.accent)} onMouseLeave={e => (e.currentTarget.style.color = C.textTertiary)}><Copy size={12} /></button>
                </div>
                {data.linkedin && <div className="flex items-center gap-2 text-[13px]" style={{ color: C.textSecondary }}><ExternalLink size={13} style={{ color: C.textTertiary }} />{data.linkedin}</div>}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-5">
                {data.tech.map(t => <span key={t} className="text-[11px] px-2 py-0.5 rounded" style={{ color: C.textSecondary, border: `1px solid ${C.border}` }}>{t}</span>)}
              </div>
            </div>

            <div className="rounded-xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-4" style={{ color: C.textTertiary }}>Snapshot</div>
              {data.activities.length > 0 && (
                <div className="mb-3">
                  <div className="text-[11px] mb-1" style={{ color: C.textTertiary }}>Siste aktivitet</div>
                  <div className="text-[13px]" style={{ color: C.textPrimary }}>{data.activities[0].type === "call" ? "📞" : "📋"} {data.activities[0].subject}</div>
                  <div className="text-[12px]" style={{ color: C.textTertiary }}>{data.activities[0].date}</div>
                </div>
              )}
              {data.tasks.length > 0 && (
                <div>
                  <div className="text-[11px] mb-1" style={{ color: C.textTertiary }}>Neste oppfølging</div>
                  <div className="text-[13px]" style={{ color: C.textPrimary }}>{data.tasks[0].title}</div>
                  <div className="text-[12px]" style={{ color: C.textTertiary }}>{data.tasks[0].date}</div>
                </div>
              )}
              {data.activities.length === 0 && data.tasks.length === 0 && <p className="text-[13px]" style={{ color: C.textTertiary }}>Ingen data ennå</p>}
            </div>
          </div>

          {/* Tasks */}
          {data.tasks.length > 0 && (
            <div className="mb-8">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: C.textTertiary }}>Oppfølginger</div>
              <div className="space-y-1">
                {data.tasks.map((task, i) => (
                  <div key={i} className="flex items-center justify-between h-11 px-4 rounded-lg transition-colors cursor-pointer" style={{ background: C.surface }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.elevated)}
                    onMouseLeave={e => (e.currentTarget.style.background = C.surface)}>
                    <div className="flex items-center gap-3">
                      {task.done ? <CheckSquare size={15} style={{ color: C.accent }} /> : <Square size={15} style={{ color: C.textTertiary }} />}
                      <span className="text-[13px]" style={{ color: task.done ? C.textTertiary : C.textPrimary, textDecoration: task.done ? "line-through" : "none" }}>{task.title}</span>
                    </div>
                    <span className="text-[12px]" style={{ color: C.textTertiary }}>{task.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activities */}
          {data.activities.length > 0 && (
            <div className="mb-8">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-4" style={{ color: C.textTertiary }}>Aktiviteter</div>
              {Object.entries(activityMonths).map(([month, acts]) => (
                <div key={month} className="mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[12px] font-semibold" style={{ color: C.textSecondary }}>{month}</span>
                    <div className="flex-1 h-[1px]" style={{ background: C.border }} />
                  </div>
                  <div className="relative pl-6">
                    <div className="absolute left-[7px] top-2 bottom-2 w-[1.5px]" style={{ background: C.border }} />
                    <div className="space-y-4">
                      {acts.map((a, i) => (
                        <div key={i} className="relative">
                          <div className="absolute -left-6 top-[5px] w-[14px] h-[14px] rounded-full flex items-center justify-center" style={{ background: C.base }}>
                            {a.type === "call" ? <MessageCircle size={10} style={{ color: C.signalNow }} /> : <FileText size={10} style={{ color: C.accent }} />}
                          </div>
                          <div className="flex items-baseline justify-between mb-1">
                            <span className="text-[14px] font-medium" style={{ color: C.textPrimary }}>{a.subject}</span>
                            <span className="text-[12px] ml-3 flex-shrink-0" style={{ color: C.textTertiary }}>{a.date}</span>
                          </div>
                          {a.description && <p className="text-[13px] leading-relaxed" style={{ color: C.textSecondary }}>{a.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          {data.notes && (
            <div className="mb-8">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: C.textTertiary }}>Notater</div>
              <div className="rounded-xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: C.textSecondary, fontFamily: "'Geist Mono', monospace" }}>{data.notes}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
