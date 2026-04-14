import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, ChevronDown, ChevronRight, Phone, Mail, Clock } from "lucide-react";

/* ── Geist Sans font ── */
const fontLink = "https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap";

/* ── Obsidian palette ── */
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
} as const;

const SIGNALS = [
  { key: "now", label: "Behov nå", color: C.signalNow },
  { key: "future", label: "Fremtidig behov", color: C.signalFuture },
  { key: "maybe", label: "Har kanskje behov", color: C.signalMaybe },
  { key: "unknown", label: "Ukjent om behov", color: C.signalUnknown },
  { key: "never", label: "Aldri aktuelt", color: C.signalNever },
] as const;

type Signal = typeof SIGNALS[number]["key"];

interface Contact {
  id: string;
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  signal: Signal;
  owner: string;
  tech: string[];
  cv: boolean;
  lastActivity: string;
  lastActivityDays: number;
  nextTask?: string;
  nextTaskDate?: string;
  lastActivityType?: string;
  lastActivitySubject?: string;
  lastActivityDescription?: string;
  notes?: string;
}

const MOCK_CONTACTS: Contact[] = [
  { id: "1", name: "Erik Solberg", title: "Tech Lead", company: "Aker Solutions", email: "erik.solberg@aker.no", phone: "+47 900 11 222", signal: "now", owner: "Jon Richard Nygaard", tech: ["Python", "ML", "GCP"], cv: true, lastActivity: "1d", lastActivityDays: 1, nextTask: "Finn ML-kandidat", nextTaskDate: "16. apr 2026", lastActivityType: "call", lastActivitySubject: "Hastebehov ML", lastActivityDescription: "Prosjektet er forsinket, trenger senior ML-ingeniør innen 2 uker.", notes: "Haster — trenger ML-ingeniør innen 2 uker. Erik er besluttningstaker." },
  { id: "2", name: "Kari Hansen", title: "Engineering Manager", company: "DNB", email: "kari.hansen@dnb.no", phone: "+47 911 22 333", signal: "now", owner: "Thomas Eriksen", tech: ["Java", "Kotlin", "AWS"], cv: true, lastActivity: "3d", lastActivityDays: 3, nextTask: "Send CV-er backend", nextTaskDate: "18. apr 2026", lastActivityType: "meeting", lastActivitySubject: "Kvartalsplanlegging", lastActivityDescription: "Diskuterte behovet for 2 backend-utviklere fra Q3." },
  { id: "3", name: "Silje Strand", title: "Data Engineer", company: "Schibsted", email: "silje.strand@schibsted.no", phone: "+47 922 33 444", signal: "now", owner: "Jon Richard Nygaard", tech: ["Spark", "Kafka", "Python"], cv: false, lastActivity: "2d", lastActivityDays: 2, lastActivityType: "call", lastActivitySubject: "Nytt dataprosjekt", lastActivityDescription: "Starter opp nytt dataplattform-prosjekt i juni." },
  { id: "4", name: "Camilla Roth", title: "VP Engineering", company: "Vipps", email: "camilla.roth@vipps.no", phone: "+47 933 44 555", signal: "now", owner: "Thomas Eriksen", tech: ["Kotlin", "Swift", "React"], cv: true, lastActivity: "i dag", lastActivityDays: 0, nextTask: "Presentere kandidater", nextTaskDate: "14. apr 2026", lastActivityType: "call", lastActivitySubject: "Mobilteam-utvidelse", lastActivityDescription: "Trenger 3 mobilutviklere ASAP." },
  { id: "5", name: "Lars Moen", title: "CTO", company: "Equinor", email: "lars.moen@equinor.com", phone: "+47 944 55 666", signal: "future", owner: "Jon Richard Nygaard", tech: ["Azure", "DevOps", "Terraform"], cv: false, lastActivity: "1u", lastActivityDays: 7, nextTask: "Følge opp Q4-plan", nextTaskDate: "1. mai 2026", lastActivityType: "meeting", lastActivitySubject: "Årlig leverandørgjennomgang" },
  { id: "6", name: "Marte Olsen", title: "Head of Product", company: "Telenor Digital", email: "marte.olsen@telenor.no", phone: "+47 955 66 777", signal: "future", owner: "Thomas Eriksen", tech: ["React", "TypeScript", "Node"], cv: true, lastActivity: "2u", lastActivityDays: 14, lastActivityType: "call", lastActivitySubject: "Ny frontend-satsing", lastActivityDescription: "Planlegger omskriving av kundeportal i 2027." },
  { id: "7", name: "Anders Berg", title: "Platform Lead", company: "Cognite", email: "anders.berg@cognite.com", phone: "+47 966 77 888", signal: "future", owner: "Jon Richard Nygaard", tech: ["Rust", "Go", "K8s"], cv: false, lastActivity: "5d", lastActivityDays: 5, lastActivityType: "call", lastActivitySubject: "Platform-team vokser" },
  { id: "8", name: "Ingrid Dahl", title: "Director IT", company: "Storebrand", email: "ingrid.dahl@storebrand.no", phone: "+47 977 88 999", signal: "maybe", owner: "Thomas Eriksen", tech: ["SAP", ".NET", "Azure"], cv: false, lastActivity: "3u", lastActivityDays: 21, lastActivityType: "meeting", lastActivitySubject: "Budsjettprosess 2027" },
  { id: "9", name: "Henrik Lund", title: "Dev Manager", company: "Kahoot!", email: "henrik.lund@kahoot.com", phone: "+47 988 99 000", signal: "maybe", owner: "Jon Richard Nygaard", tech: ["React", "AWS", "Python"], cv: true, lastActivity: "1m", lastActivityDays: 30, lastActivityType: "call", lastActivitySubject: "Mulig behov etter jul" },
  { id: "10", name: "Nora Vik", title: "IT-sjef", company: "Posten Norge", email: "nora.vik@posten.no", phone: "+47 999 00 111", signal: "unknown", owner: "Thomas Eriksen", tech: ["Java", "Oracle"], cv: false, lastActivity: "2m", lastActivityDays: 60 },
  { id: "11", name: "Olav Fredriksen", title: "Senior Advisor", company: "Statkraft", email: "olav.f@statkraft.com", phone: "+47 900 22 333", signal: "unknown", owner: "Jon Richard Nygaard", tech: ["Python", "MATLAB"], cv: false, lastActivity: "3m", lastActivityDays: 90 },
  { id: "12", name: "Maja Kristiansen", title: "CIO", company: "Color Line", email: "maja.k@colorline.no", phone: "+47 911 33 444", signal: "never", owner: "Thomas Eriksen", tech: [".NET", "SQL Server"], cv: false, lastActivity: "6m", lastActivityDays: 180, notes: "Ikke aktuelt — bruker kun interne ressurser." },
];

/* ── Detail overlay ── */
function DetailOverlay({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const navigate = useNavigate();
  const signal = SIGNALS.find(s => s.key === contact.signal)!;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }} />
      <div
        className="relative z-10 w-full max-w-[520px] rounded-2xl overflow-hidden"
        style={{ background: C.surface, border: `1px solid ${C.border}` }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors" style={{ color: C.textTertiary }} onMouseEnter={e => (e.currentTarget.style.color = C.textPrimary)} onMouseLeave={e => (e.currentTarget.style.color = C.textTertiary)}>
          <X size={16} />
        </button>

        <div className="p-6 pb-4">
          <h2 className="text-[18px] font-semibold" style={{ color: C.textPrimary, fontFamily: "'Geist', system-ui, sans-serif" }}>{contact.name}</h2>
          <p className="text-[13px] mt-1" style={{ color: C.textSecondary }}>{contact.title} · {contact.company}</p>
          <div className="flex items-center gap-3 mt-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: signal.color }}>
              <span className="w-[6px] h-[6px] rounded-full" style={{ background: signal.color }} />
              {signal.label}
            </span>
            {contact.cv && <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: `${C.accent}22`, color: C.accent }}>CV</span>}
            <span className="text-[11px]" style={{ color: C.textTertiary }}>{contact.owner}</span>
          </div>
        </div>

        <div className="h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${signal.color}44, transparent)` }} />

        <div className="px-6 py-4 flex gap-6">
          <div className="flex items-center gap-2 text-[13px]" style={{ color: C.textSecondary }}><Mail size={13} style={{ color: C.textTertiary }} />{contact.email}</div>
          <div className="flex items-center gap-2 text-[13px]" style={{ color: C.textSecondary }}><Phone size={13} style={{ color: C.textTertiary }} />{contact.phone}</div>
        </div>

        <div className="px-6 pb-4 flex flex-wrap gap-1.5">
          {contact.tech.map(t => <span key={t} className="text-[11px] px-2 py-0.5 rounded" style={{ color: C.textSecondary, border: `1px solid ${C.border}` }}>{t}</span>)}
        </div>

        {contact.nextTask && (
          <div className="mx-6 mb-4 p-3 rounded-lg" style={{ background: C.elevated }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: C.textTertiary }}>Neste</div>
            <div className="flex justify-between items-center">
              <span className="text-[13px]" style={{ color: C.textPrimary }}>□ {contact.nextTask}</span>
              <span className="text-[12px]" style={{ color: C.textTertiary }}>{contact.nextTaskDate}</span>
            </div>
          </div>
        )}

        {contact.lastActivitySubject && (
          <div className="mx-6 mb-4 p-3 rounded-lg" style={{ background: C.elevated }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: C.textTertiary }}>Siste</div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[13px] font-medium" style={{ color: C.textPrimary }}>{contact.lastActivityType === "call" ? "📞" : "📋"} {contact.lastActivitySubject}</span>
              <span className="text-[12px]" style={{ color: C.textTertiary }}>{contact.lastActivity}</span>
            </div>
            {contact.lastActivityDescription && <p className="text-[12px] leading-relaxed" style={{ color: C.textSecondary }}>{contact.lastActivityDescription}</p>}
          </div>
        )}

        {contact.notes && (
          <div className="mx-6 mb-4 p-3 rounded-lg" style={{ background: C.elevated }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: C.textTertiary }}>Notat</div>
            <p className="text-[12px] leading-relaxed" style={{ color: C.textSecondary, fontFamily: "'Geist Mono', monospace" }}>{contact.notes}</p>
          </div>
        )}

        <div className="px-6 py-4 flex gap-2" style={{ borderTop: `1px solid ${C.border}` }}>
          <button className="flex-1 h-9 text-[13px] font-medium rounded-lg" style={{ background: C.signalNow, color: "#000" }} onClick={() => navigate(`/design-lab/kontakter/${contact.id}`)}>Åpne fullvisning</button>
          <button className="h-9 px-4 text-[13px] font-medium rounded-lg flex items-center justify-center" style={{ border: `1px solid ${C.border}`, color: C.textSecondary, background: "transparent" }}><Phone size={14} /></button>
          <button className="h-9 px-4 text-[13px] font-medium rounded-lg flex items-center justify-center" style={{ border: `1px solid ${C.border}`, color: C.textSecondary, background: "transparent" }}><Mail size={14} /></button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function DesignLabContacts() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const filtered = useMemo(() => {
    if (!search) return MOCK_CONTACTS;
    const q = search.toLowerCase();
    return MOCK_CONTACTS.filter(c =>
      c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q) ||
      c.tech.some(t => t.toLowerCase().includes(q)) || c.owner.toLowerCase().includes(q)
    );
  }, [search]);

  const grouped = useMemo(() =>
    SIGNALS.map(s => ({ ...s, contacts: filtered.filter(c => c.signal === s.key) })).filter(g => g.contacts.length > 0),
  [filtered]);

  const flatList = useMemo(() => grouped.flatMap(g => g.contacts), [grouped]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setFocusedIndex(i => Math.min(i + 1, flatList.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setFocusedIndex(i => Math.max(i - 1, 0)); }
      if (e.key === "Enter" && focusedIndex >= 0 && flatList[focusedIndex]) { setSelectedContact(flatList[focusedIndex]); }
      if (e.key === "Escape") { setSelectedContact(null); setFocusedIndex(-1); }
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); document.getElementById("studio-search")?.focus(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focusedIndex, flatList]);

  return (
    <>
      <link rel="stylesheet" href={fontLink} />
      <div className="design-lab min-h-screen" style={{ background: C.base, fontFamily: "'Geist', system-ui, sans-serif" }}>
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-[52px] px-6" style={{ background: C.base, borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-semibold tracking-[-0.02em]" style={{ color: C.textPrimary }}>STACQ</span>
            <span className="text-[13px]" style={{ color: C.textTertiary }}>·</span>
            <span className="text-[13px]" style={{ color: C.textTertiary }}>Studio</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 h-8 px-3 rounded-lg cursor-text" style={{ background: C.surface, border: `1px solid ${C.border}` }} onClick={() => document.getElementById("studio-search")?.focus()}>
              <Search size={13} style={{ color: C.textTertiary }} />
              <span className="text-[12px]" style={{ color: C.textTertiary }}>Søk…</span>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded ml-4" style={{ background: C.elevated, color: C.textTertiary }}>⌘K</kbd>
            </div>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold" style={{ background: C.accent, color: "#fff" }}>JR</div>
          </div>
        </header>

        {/* Content */}
        <div className="max-w-[960px] mx-auto px-6 py-8">
          <div className="flex items-baseline justify-between mb-6">
            <h1 className="text-[24px] font-semibold tracking-[-0.03em]" style={{ color: C.textPrimary }}>Kontakter</h1>
            <span className="text-[13px]" style={{ color: C.textTertiary }}>{filtered.length} kontakter</span>
          </div>

          <div className="relative mb-8">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.textTertiary }} />
            <input
              id="studio-search" type="text" placeholder="Søk kontakter, selskaper, teknologier…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl text-[13px] outline-none transition-colors placeholder:opacity-50"
              style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.textPrimary }}
              onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
              onBlur={e => (e.currentTarget.style.borderColor = C.border)}
            />
            {search && <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}><X size={14} style={{ color: C.textTertiary }} /></button>}
          </div>

          {/* Signal-grouped lanes */}
          <div className="space-y-1">
            {grouped.map(group => {
              const isCollapsed = collapsedGroups.has(group.key);
              return (
                <div key={group.key}>
                  <button
                    className="w-full flex items-center gap-2 py-2.5 px-3 rounded-lg transition-colors"
                    style={{ color: group.color }}
                    onClick={() => toggleGroup(group.key)}
                    onMouseEnter={e => (e.currentTarget.style.background = C.elevated)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">{group.label}</span>
                    <span className="text-[11px] font-medium ml-1" style={{ color: C.textTertiary }}>({group.contacts.length})</span>
                    <div className="flex-1 h-[1px] ml-3" style={{ background: `linear-gradient(90deg, ${group.color}33, transparent)` }} />
                  </button>

                  {!isCollapsed && (
                    <div className="mb-2">
                      {group.contacts.map(contact => {
                        const globalIdx = flatList.indexOf(contact);
                        const isFocused = globalIdx === focusedIndex;
                        return (
                          <div
                            key={contact.id}
                            className="group flex items-center gap-3 h-[52px] px-3 rounded-lg cursor-pointer transition-all"
                            style={{ background: isFocused ? C.elevated : "transparent", boxShadow: isFocused ? `inset 0 0 0 1px ${C.accent}44` : "none" }}
                            onClick={() => setSelectedContact(contact)}
                            onMouseEnter={e => { if (!isFocused) e.currentTarget.style.background = `${C.elevated}88`; }}
                            onMouseLeave={e => { if (!isFocused) e.currentTarget.style.background = isFocused ? C.elevated : "transparent"; }}
                          >
                            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-semibold" style={{ background: `${group.color}18`, color: group.color }}>
                              {contact.name.split(" ").map(n => n[0]).join("")}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[14px] font-medium truncate cursor-pointer transition-colors" style={{ color: C.textPrimary }}
                                  onClick={e => { e.stopPropagation(); navigate(`/design-lab/kontakter/${contact.id}`); }}
                                  onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
                                  onMouseLeave={e => (e.currentTarget.style.color = C.textPrimary)}
                                >{contact.name}</span>
                                {contact.cv && <span className="text-[9px] font-bold px-1.5 py-[1px] rounded" style={{ background: `${C.accent}22`, color: C.accent }}>CV</span>}
                              </div>
                              <p className="text-[12px] truncate" style={{ color: C.textTertiary }}>{contact.title} · {contact.company}</p>
                            </div>
                            <div className="hidden lg:flex items-center gap-1 flex-shrink-0">
                              {contact.tech.slice(0, 3).map(t => <span key={t} className="text-[10px] px-1.5 py-[1px] rounded" style={{ color: C.textTertiary, border: `1px solid ${C.border}` }}>{t}</span>)}
                            </div>
                            <span className="text-[11px] flex-shrink-0 hidden md:block" style={{ color: C.textTertiary }}>{contact.owner.split(" ").map(n => n[0]).join("")}</span>
                            <span className="text-[12px] w-10 text-right flex-shrink-0" style={{ color: C.textTertiary }}>{contact.lastActivity}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              <button className="w-7 h-7 rounded-md flex items-center justify-center transition-colors" style={{ color: C.textTertiary }}
                                onMouseEnter={e => { e.currentTarget.style.background = C.elevated; e.currentTarget.style.color = C.signalNow; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textTertiary; }}><Phone size={13} /></button>
                              <button className="w-7 h-7 rounded-md flex items-center justify-center transition-colors" style={{ color: C.textTertiary }}
                                onMouseEnter={e => { e.currentTarget.style.background = C.elevated; e.currentTarget.style.color = C.accent; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textTertiary; }}><Mail size={13} /></button>
                              <button className="w-7 h-7 rounded-md flex items-center justify-center transition-colors" style={{ color: C.textTertiary }}
                                onMouseEnter={e => { e.currentTarget.style.background = C.elevated; e.currentTarget.style.color = C.signalMaybe; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textTertiary; }}><Clock size={13} /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-20">
              <p className="text-[14px]" style={{ color: C.textTertiary }}>Ingen kontakter funnet</p>
              <p className="text-[12px] mt-1" style={{ color: C.textTertiary }}>Prøv et annet søkeord</p>
            </div>
          )}
        </div>

        {/* Keyboard hints */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 px-4 py-2 rounded-full" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <span className="text-[11px] flex items-center gap-1" style={{ color: C.textTertiary }}><kbd className="text-[10px] px-1 rounded" style={{ background: C.elevated }}>↑↓</kbd> naviger</span>
          <span className="text-[11px] flex items-center gap-1" style={{ color: C.textTertiary }}><kbd className="text-[10px] px-1 rounded" style={{ background: C.elevated }}>↵</kbd> åpne</span>
          <span className="text-[11px] flex items-center gap-1" style={{ color: C.textTertiary }}><kbd className="text-[10px] px-1 rounded" style={{ background: C.elevated }}>esc</kbd> lukk</span>
        </div>
      </div>

      {selectedContact && <DetailOverlay contact={selectedContact} onClose={() => setSelectedContact(null)} />}
    </>
  );
}
