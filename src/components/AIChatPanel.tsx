import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Sparkles, RefreshCw, ArrowUp, X, Copy, Loader2,
  ClipboardList, Inbox, FileText, Search, Mail, BarChart3, Upload,
} from "lucide-react";
import { CvUploadFlow } from "@/components/CvUploadFlow";
import { SheetClose } from "@/components/ui/sheet";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, startOfWeek, differenceInDays } from "date-fns";
import { nb } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { getEffectiveSignal } from "@/lib/categoryUtils";

/* ─── Types ─── */

type Msg = { role: "user" | "assistant"; content: string; error?: boolean; showCopy?: boolean };
type Mode = null | "forespørsel" | "pitch" | "match" | "epost" | "cv-upload";

interface CrmContext {
  contacts: Array<{ name: string; company: string; signal: string; daysAgo: number | null }>;
  foresporsler: Array<{ selskap: string; sted: string | null; teknologier: string[]; daysOld: number }>;
}

/* ─── Constants ─── */

const SUGGESTED_TAGS = ["C++", "C", "Embedded", "Yocto", "Linux", "Qt", "FPGA", "Python", "SPI/I2C", "MCU", "Embedded Linux", "Sikkerhet"];

const QUICK_ACTIONS = [
  { icon: ClipboardList, label: "Dagens prioriteringer", sub: "Hva bør jeg fokusere på nå?", action: "prioriteringer" as const },
  { icon: Inbox, label: "Legg inn forespørsel", sub: "Analyser tekst automatisk", action: "forespørsel" as const },
  { icon: FileText, label: "Skriv CV-pitch", sub: "3-4 setninger klar til sending", action: "pitch" as const },
  { icon: Search, label: "Match konsulent", sub: "Finn beste kandidat til oppdrag", action: "match" as const },
  { icon: Mail, label: "Skriv oppfølgings-epost", sub: "Basert på siste aktivitet", action: "epost" as const },
  { icon: BarChart3, label: "Ukesoppsummering", sub: "Pipeline og aktivitet denne uken", action: "ukesoppsummering" as const },
];

const CHIP_BASE = "h-7 px-2.5 text-[0.75rem] rounded-full border transition-colors cursor-pointer select-none";
const CHIP_OFF = `${CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;
const CHIP_ON = `${CHIP_BASE} bg-primary/10 border-primary/30 text-primary font-medium`;

/* ─── System prompt builder ─── */

function buildSystemPrompt(userName: string, ctx: CrmContext): string {
  const contactLines = ctx.contacts
    .filter((c) => c.signal && c.signal !== "Ikke aktuelt")
    .slice(0, 30)
    .map((c) => `- ${c.name} (${c.company}) | ${c.signal} | ${c.daysAgo != null ? `${c.daysAgo}d siden sist` : "aldri kontaktet"}`)
    .join("\n");

  const fLines = ctx.foresporsler
    .slice(0, 16)
    .map((f) => `- ${f.selskap} | ${f.sted || "?"} | ${f.teknologier.join(", ")} | ${f.daysOld}d gammel`)
    .join("\n");

  return `Du er en presis og direkte salgsassistent for STACQ — et norsk IT-konsulentselskap som matcher embedded/tech-konsulenter med industrielle kunder.

Din bruker heter ${userName}.

KONTEKST — KONTAKTER MED SIGNAL:
${contactLines || "(ingen kontakter med signal)"}

KONTEKST — AKTIVE FORESPØRSLER (${ctx.foresporsler.length} stk):
${fLines || "(ingen aktive forespørsler)"}

RETNINGSLINJER:
- Svar alltid på norsk
- Vær konkret og handlingsorientert — ikke generell
- Nevn spesifikke navn fra dataene
- Hold svar under 120 ord med mindre brukeren ber om mer
- Formater med markdown (bold, bullets, headings)`;
}

/* ─── Main Component ─── */

export function AIChatPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [crmContext, setCrmContext] = useState<CrmContext | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [mode, setMode] = useState<Mode>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userName = user?.email?.split("@")[0] || "bruker";

  // ── Forespørsel state
  const [rawText, setRawText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [parsedForesp, setParsedForesp] = useState<any>(null);
  const [fSelskapNavn, setFSelskapNavn] = useState("");
  const [fSelskapId, setFSelskapId] = useState<string | null>(null);
  const [fSted, setFSted] = useState("");
  const [fFrist, setFFrist] = useState("");
  const [fType, setFType] = useState("DIR");
  const [fTeknologier, setFTeknologier] = useState<string[]>([]);
  const [fTagInput, setFTagInput] = useState("");
  const [fKommentar, setFKommentar] = useState("");
  const [fCompanyResults, setFCompanyResults] = useState<any[]>([]);
  const [showFDropdown, setShowFDropdown] = useState(false);

  // ── Pitch state
  const [pitchSearch, setPitchSearch] = useState("");
  const [pitchConsultantId, setPitchConsultantId] = useState<number | null>(null);
  const [pitchConsultantName, setPitchConsultantName] = useState("");
  const [pitchContext, setPitchContext] = useState("");
  const [pitchResults, setPitchResults] = useState<any[]>([]);

  // ── Match state
  const [matchQuery, setMatchQuery] = useState("");

  // ── Epost state
  const [epostContactSearch, setEpostContactSearch] = useState("");
  const [epostContactId, setEpostContactId] = useState<string | null>(null);
  const [epostContactName, setEpostContactName] = useState("");
  const [epostTone, setEpostTone] = useState("Vennlig");
  const [epostContactResults, setEpostContactResults] = useState<any[]>([]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, mode]);

  // ── CRM context fetch
  const fetchContext = useCallback(async () => {
    setContextLoading(true);
    try {
      const now = new Date();
      const [contactsRes, foresporslerRes] = await Promise.all([
        supabase
          .from("contacts")
          .select("id, first_name, last_name, title, company_id, companies(name), activities(created_at, subject, description), tasks(id, title, due_date, status, created_at, description)")
          .limit(60),
        supabase
          .from("foresporsler")
          .select("*")
          .in("status", ["Ny", "Aktiv"])
          .order("mottatt_dato", { ascending: false }),
      ]);

      const contacts: CrmContext["contacts"] = (contactsRes.data || [])
        .map((c: any) => {
          const signal = getEffectiveSignal(
            (c.activities || []).map((a: any) => ({ created_at: a.created_at, subject: a.subject, description: a.description })),
            (c.tasks || []).map((t: any) => ({ created_at: t.created_at, title: t.title, description: t.description, due_date: t.due_date }))
          );
          const lastAct = (c.activities || []).reduce((max: string | null, a: any) => (!max || a.created_at > max ? a.created_at : max), null);
          return { name: `${c.first_name} ${c.last_name}`, company: c.companies?.name || "Ukjent", signal, daysAgo: lastAct ? differenceInDays(now, new Date(lastAct)) : null };
        })
        .filter((c) => c.signal && c.signal !== "Ikke aktuelt")
        .sort((a, b) => {
          const order = ["Behov nå", "Får fremtidig behov", "Får kanskje behov", "Ukjent om behov"];
          return order.indexOf(a.signal) - order.indexOf(b.signal);
        });

      const foresporsler: CrmContext["foresporsler"] = (foresporslerRes.data || []).map((f: any) => ({
        selskap: f.selskap_navn, sted: f.sted, teknologier: f.teknologier || [], daysOld: differenceInDays(now, new Date(f.mottatt_dato)),
      }));
      setCrmContext({ contacts, foresporsler });
    } catch (e) {
      console.error("Failed to fetch CRM context:", e);
      setCrmContext({ contacts: [], foresporsler: [] });
    } finally {
      setContextLoading(false);
    }
  }, []);

  useEffect(() => { fetchContext(); }, [fetchContext]);

  const handleRefresh = () => {
    setMessages([]);
    setMode(null);
    fetchContext();
  };

  // Auto-resize textarea
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 96) + "px";
  };

  // ── Core AI call
  const callAI = async (systemPrompt: string, userContent: string, showCopy = false) => {
    setIsLoading(true);
    const userMsg: Msg = { role: "user", content: userContent };
    setMessages(prev => [...prev, userMsg]);

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          system: systemPrompt,
          messages: [{ role: "user", content: userContent }],
        }),
      });

      const data = await resp.json();
      if (!resp.ok || data.error) {
        setMessages(prev => [...prev, { role: "assistant", content: data.error || "Beklager, noe gikk galt.", error: true }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: data.text || "Ingen respons.", showCopy }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Beklager, noe gikk galt.", error: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Send free-form message
  const sendMessage = async (text?: string) => {
    const userInput = (text || input).trim();
    if (!userInput || isLoading) return;

    const userMsg: Msg = { role: "user", content: userInput };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setIsLoading(true);

    try {
      const systemPrompt = crmContext ? buildSystemPrompt(userName, crmContext) : undefined;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          system: systemPrompt,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await resp.json();
      if (!resp.ok || data.error) {
        setMessages(prev => [...prev, { role: "assistant", content: data.error || "Beklager, noe gikk galt.", error: true }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: data.text || "Ingen respons." }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Beklager, noe gikk galt.", error: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  /* ══════════════════════════════════════
     ACTION HANDLERS
     ══════════════════════════════════════ */

  // ── Dagens prioriteringer
  const handlePrioriteringer = async () => {
    setMode(null);
    setIsLoading(true);
    setMessages(prev => [...prev, { role: "user", content: "📋 Dagens prioriteringer" }]);

    try {
      const today = new Date().toISOString().split("T")[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

      const [tasksRes, forespRes] = await Promise.all([
        supabase.from("tasks")
          .select("*, contacts(first_name, last_name, companies(name))")
          .neq("status", "done")
          .lte("due_date", today)
          .order("due_date", { ascending: true })
          .limit(10),
        supabase.from("foresporsler")
          .select("selskap_navn, frist_dato, teknologier")
          .gte("mottatt_dato", thirtyDaysAgo)
          .order("frist_dato", { ascending: true })
          .limit(5),
      ]);

      const system = "Du er salgsassistent for STACQ, et norsk konsulentselskap. Lag en kort prioritert liste for dagens arbeidsdag basert på dataene. Maks 5 punkter. Vær konkret med navn og datoer. Norsk. Markdown-format med bold og bullet points.";
      const userData = JSON.stringify({ tasks: tasksRes.data || [], foresporsler: forespRes.data || [], today: new Date().toISOString() });

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ system, messages: [{ role: "user", content: userData }] }),
      });
      const data = await resp.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.text || data.error || "Ingen respons." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Kunne ikke hente data.", error: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Ukesoppsummering
  const handleUkesoppsummering = async () => {
    setMode(null);
    setIsLoading(true);
    setMessages(prev => [...prev, { role: "user", content: "📊 Ukesoppsummering" }]);

    try {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();

      const [activitiesRes, tasksRes, forespRes] = await Promise.all([
        supabase.from("activities")
          .select("subject, contact_id, created_at, contacts(first_name, last_name)")
          .gte("created_at", weekStart),
        supabase.from("tasks")
          .select("title, completed_at, contacts(first_name, last_name)")
          .eq("status", "done")
          .gte("completed_at", weekStart),
        supabase.from("foresporsler")
          .select("selskap_navn, teknologier, mottatt_dato")
          .gte("mottatt_dato", weekStart.split("T")[0]),
      ]);

      const system = "Du er salgsassistent for STACQ. Lag en ukesoppsummering på norsk. Inkluder: aktiviteter gjennomført, oppfølginger fullført, nye forespørsler, og 2-3 anbefalinger for neste uke. Markdown med seksjoner.";
      const userData = JSON.stringify({
        activities: activitiesRes.data || [],
        completedTasks: tasksRes.data || [],
        newForesporsler: forespRes.data || [],
        week: format(new Date(), "'uke' w, yyyy", { locale: nb }),
      });

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ system, messages: [{ role: "user", content: userData }] }),
      });
      const data = await resp.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.text || data.error || "Ingen respons." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Kunne ikke hente ukedata.", error: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Company search for forespørsel */
  const searchCompaniesF = (query: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.length < 1) { setFCompanyResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      const { data } = await supabase.from("companies").select("id, name, city").ilike("name", `%${query}%`).limit(8);
      if (data) setFCompanyResults(data);
    }, 300);
  };

  /* ── Forespørsel: analyze text */
  const handleAnalyzeForespørsel = async () => {
    if (!rawText.trim()) return;
    setAnalyzing(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          system: `Du er assistent for STACQ. Analyser teksten og returner KUN et JSON-objekt:
{
  "selskap_navn": "string",
  "sted": "string",
  "teknologier": ["array"],
  "frist_dato": "YYYY-MM-DD or null",
  "type": "DIR or VIA",
  "kommentar": "kort notat om kilde/kontekst, maks 1 setning",
  "missing": ["norske feltnavn som mangler eller er usikre"]
}
Returner BARE JSON, ingen annen tekst.`,
          messages: [{ role: "user", content: rawText }],
        }),
      });
      const data = await resp.json();
      const text = (data.text || "").replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(text);
      setParsedForesp(parsed);
      setFSelskapNavn(parsed.selskap_navn || "");
      setFSted(parsed.sted || "");
      setFFrist(parsed.frist_dato || "");
      setFType(parsed.type || "DIR");
      setFTeknologier(parsed.teknologier || []);
      setFKommentar(parsed.kommentar || "");
    } catch (e) {
      console.error(e);
      toast.error("Kunne ikke analysere teksten. Prøv igjen.");
    } finally {
      setAnalyzing(false);
    }
  };

  /* ── Forespørsel: save */
  const handleSaveForespørsel = async () => {
    if (!fSelskapNavn.trim()) { toast.error("Selskap er påkrevd"); return; }
    const { error } = await supabase.from("foresporsler").insert({
      selskap_navn: fSelskapNavn,
      selskap_id: fSelskapId || null,
      sted: fSted || null,
      frist_dato: fFrist || null,
      type: fType,
      teknologier: fTeknologier,
      kommentar: fKommentar || null,
      status: "Ny",
      created_by: user?.id,
    });
    if (error) { toast.error("Kunne ikke opprette"); return; }
    toast.success("Forespørsel opprettet!");
    queryClient.invalidateQueries({ queryKey: ["foresporsler-list"] });
    setMessages(prev => [...prev, { role: "assistant", content: `✅ Forespørsel fra **${fSelskapNavn}** er opprettet med teknologier: ${fTeknologier.join(", ") || "ingen"}.` }]);
    setMode(null);
    setParsedForesp(null);
    setRawText("");
  };

  /* ── Pitch: search consultants */
  const searchConsultants = (query: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.length < 1) { setPitchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      const { data } = await supabase.from("stacq_ansatte").select("id, navn, kompetanse, bio").ilike("navn", `%${query}%`).limit(6);
      if (data) setPitchResults(data);
    }, 300);
  };

  const handleGeneratePitch = async () => {
    if (!pitchConsultantId) { toast.error("Velg en konsulent"); return; }
    setMode(null);

    const { data: consultant } = await supabase.from("stacq_ansatte")
      .select("navn, kompetanse, bio, geografi")
      .eq("id", pitchConsultantId).single();

    const system = "Du er salgsassistent for STACQ. Skriv en CV-pitch på 3-4 setninger på norsk, klar til å sende til kunde. Fremhev relevante teknologier og erfaring. Profesjonell men varm tone. Ingen hilsener.";
    await callAI(system, JSON.stringify({ consultant, context: pitchContext }), true);
    setPitchSearch("");
    setPitchConsultantId(null);
    setPitchConsultantName("");
    setPitchContext("");
  };

  /* ── Match */
  const handleMatch = async () => {
    if (!matchQuery.trim()) { toast.error("Beskriv kravene"); return; }
    setMode(null);

    const { data: consultants } = await supabase.from("stacq_ansatte")
      .select("id, navn, kompetanse, status, geografi")
      .in("status", ["AKTIV/SIGNERT", "Ledig"])
      .limit(20);

    const system = "Du er konsulentmatcher for STACQ. Analyser kravene og ranger de 3 beste konsulentene. For hver: navn, hvorfor de matcher (konkret), og eventuelle gaps. Norsk. Markdown.";
    await callAI(system, JSON.stringify({ requirements: matchQuery, consultants: consultants || [] }));
    setMatchQuery("");
  };

  /* ── Epost: search contacts */
  const searchContacts = (query: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.length < 1) { setEpostContactResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      const { data } = await supabase.from("contacts")
        .select("id, first_name, last_name, title, companies(name)")
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
        .limit(6);
      if (data) setEpostContactResults(data);
    }, 300);
  };

  const handleGenerateEpost = async () => {
    setMode(null);
    let lastActivities: any[] = [];
    if (epostContactId) {
      const { data } = await supabase.from("activities")
        .select("subject, description, created_at")
        .eq("contact_id", epostContactId)
        .order("created_at", { ascending: false })
        .limit(3);
      lastActivities = data || [];
    }

    const system = `Du er salgsassistent for STACQ. Skriv en kort oppfølgings-epost på norsk. Tone: ${epostTone}. Maks 5 setninger. Ingen generiske fraser. Henvis til siste kontakt hvis relevant.`;
    await callAI(system, JSON.stringify({ contact: epostContactName, lastActivities, tone: epostTone }), true);
    setEpostContactSearch("");
    setEpostContactId(null);
    setEpostContactName("");
  };

  /* ── Quick action dispatch */
  const handleQuickAction = (action: string) => {
    switch (action) {
      case "prioriteringer": handlePrioriteringer(); break;
      case "forespørsel": setMode("forespørsel"); break;
      case "pitch": setMode("pitch"); break;
      case "match": setMode("match"); break;
      case "epost": setMode("epost"); break;
      case "ukesoppsummering": handleUkesoppsummering(); break;
    }
  };

  /* ══════════════════════════════════════
     RENDER
     ══════════════════════════════════════ */

  const showGrid = messages.length === 0 && !mode && !contextLoading;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">AI-assistent</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleRefresh} className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" title="Oppdater kontekst">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <SheetClose asChild>
            <button className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </SheetClose>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

        {/* Quick action grid */}
        {showGrid && (
          <div className="grid grid-cols-2 gap-2.5 pb-2">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.action}
                onClick={() => handleQuickAction(a.action)}
                disabled={isLoading}
                className="flex flex-col items-start gap-2 p-3.5 rounded-xl border border-border bg-card hover:bg-muted/60 hover:border-primary/30 transition-all text-left cursor-pointer disabled:opacity-50"
              >
                <a.icon className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-[0.875rem] font-medium text-foreground">{a.label}</p>
                  <p className="text-[0.75rem] text-muted-foreground">{a.sub}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── Mode: Forespørsel */}
        {mode === "forespørsel" && !parsedForesp && (
          <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/40">
            <div className="flex items-center justify-between">
              <p className="text-[0.875rem] font-semibold">📥 Legg inn forespørsel</p>
              <button onClick={() => { setMode(null); setRawText(""); }} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-[0.8125rem] text-muted-foreground">
              Lim inn e-post, utlysning eller kravspesifikasjon. AI finner selskap, teknologier, frist og type automatisk.
            </p>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Lim inn tekst her..."
              className="w-full h-36 text-[0.875rem] rounded-lg border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={handleAnalyzeForespørsel}
              disabled={!rawText.trim() || analyzing}
              className="flex items-center gap-1.5 text-[0.8125rem] font-medium bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {analyzing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Analyserer...</> : <><Sparkles className="h-3.5 w-3.5" />Analyser tekst</>}
            </button>
          </div>
        )}

        {/* ── Mode: Forespørsel — review form */}
        {mode === "forespørsel" && parsedForesp && (
          <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/40">
            <div className="flex items-center justify-between">
              <p className="text-[0.875rem] font-semibold">📥 Bekreft forespørsel</p>
              <button onClick={() => { setParsedForesp(null); setRawText(""); }} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>

            {(parsedForesp.missing?.length > 0) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[0.8125rem] text-amber-800">
                ⚠ Mangler: {parsedForesp.missing.join(", ")}
              </div>
            )}

            <div>
              <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Selskap</label>
              <div className="relative mt-1">
                <Input value={fSelskapNavn} onChange={(e) => { setFSelskapNavn(e.target.value); setFSelskapId(null); setShowFDropdown(true); searchCompaniesF(e.target.value); }}
                  onFocus={() => setShowFDropdown(true)} placeholder="Selskapsnavn..." className="text-[0.875rem]" />
                {showFDropdown && fCompanyResults.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-md max-h-48 overflow-auto">
                    {fCompanyResults.map((c) => (
                      <button key={c.id} onClick={() => { setFSelskapNavn(c.name); setFSelskapId(c.id); setFSted(c.city || ""); setShowFDropdown(false); setFCompanyResults([]); }}
                        className="w-full text-left px-3 py-2 text-[0.8125rem] hover:bg-secondary transition-colors">
                        {c.name} {c.city && <span className="text-muted-foreground ml-1 text-[0.75rem]">{c.city}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Sted</label>
              <Input value={fSted} onChange={(e) => setFSted(e.target.value)} className="mt-1 text-[0.875rem]" />
            </div>

            <div>
              <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Frist</label>
              <Input type="date" value={fFrist} onChange={(e) => setFFrist(e.target.value)} className="mt-1 text-[0.875rem]" />
            </div>

            <div>
              <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Type</label>
              <div className="flex gap-2 mt-1">
                {["DIR", "VIA"].map(t => (
                  <button key={t} onClick={() => setFType(t)}
                    className={`h-8 px-4 text-[0.8125rem] rounded-lg border transition-colors ${fType === t ? "bg-foreground text-background border-foreground font-medium" : "border-border text-muted-foreground hover:bg-secondary"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Teknologier</label>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 p-2 border border-border rounded-lg bg-background min-h-[38px]">
                {fTeknologier.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[0.75rem] text-foreground">
                    {t}
                    <button onClick={() => setFTeknologier(fTeknologier.filter(x => x !== t))} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                  </span>
                ))}
                <input value={fTagInput} onChange={(e) => setFTagInput(e.target.value)}
                  onKeyDown={(e) => { if ((e.key === "Enter" || e.key === ",") && fTagInput.trim()) { e.preventDefault(); const t = fTagInput.trim(); if (!fTeknologier.includes(t)) setFTeknologier([...fTeknologier, t]); setFTagInput(""); } }}
                  placeholder={fTeknologier.length === 0 ? "Legg til..." : ""} className="flex-1 min-w-[60px] bg-transparent outline-none text-[0.8125rem] placeholder:text-muted-foreground" />
              </div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {SUGGESTED_TAGS.filter(s => !fTeknologier.includes(s)).slice(0, 8).map(s => (
                  <button key={s} onClick={() => setFTeknologier([...fTeknologier, s])} className="h-6 px-2 text-[0.6875rem] rounded-full border border-border text-muted-foreground hover:bg-secondary transition-colors">{s}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Kommentar</label>
              <textarea value={fKommentar} onChange={(e) => setFKommentar(e.target.value)} rows={2}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem] resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => { setParsedForesp(null); setRawText(""); }}
                className="flex-1 h-9 text-[0.8125rem] rounded-lg border border-border text-muted-foreground hover:bg-secondary transition-colors">
                ← Start på nytt
              </button>
              <button onClick={handleSaveForespørsel}
                className="flex-1 h-9 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
                ✓ Opprett forespørsel
              </button>
            </div>
          </div>
        )}

        {/* ── Mode: CV-pitch */}
        {mode === "pitch" && (
          <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/40">
            <div className="flex items-center justify-between">
              <p className="text-[0.875rem] font-semibold">✍️ CV-pitch generator</p>
              <button onClick={() => setMode(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div>
              <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Konsulent</label>
              <div className="relative mt-1">
                <Input value={pitchConsultantId ? pitchConsultantName : pitchSearch}
                  onChange={(e) => { setPitchSearch(e.target.value); setPitchConsultantId(null); setPitchConsultantName(""); searchConsultants(e.target.value); }}
                  placeholder="Søk etter konsulent..." className="text-[0.875rem]" />
                {pitchResults.length > 0 && !pitchConsultantId && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-md max-h-48 overflow-auto">
                    {pitchResults.map(c => (
                      <button key={c.id} onClick={() => { setPitchConsultantId(c.id); setPitchConsultantName(c.navn); setPitchSearch(""); setPitchResults([]); }}
                        className="w-full text-left px-3 py-2 text-[0.8125rem] hover:bg-secondary transition-colors">{c.navn}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Kunde / kontekst</label>
              <Input value={pitchContext} onChange={(e) => setPitchContext(e.target.value)} placeholder="f.eks. Kongsberg Defence, Embedded Linux" className="mt-1 text-[0.875rem]" />
            </div>
            <button onClick={handleGeneratePitch} disabled={!pitchConsultantId || isLoading}
              className="flex items-center gap-1.5 text-[0.8125rem] font-medium bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-50 transition-opacity">
              <Sparkles className="h-3.5 w-3.5" />Generer pitch
            </button>
          </div>
        )}

        {/* ── Mode: Match */}
        {mode === "match" && (
          <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/40">
            <div className="flex items-center justify-between">
              <p className="text-[0.875rem] font-semibold">🔍 Finn beste match</p>
              <button onClick={() => setMode(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <textarea value={matchQuery} onChange={(e) => setMatchQuery(e.target.value)}
              placeholder="Beskriv krav: f.eks. 'Embedded C++, Yocto, 5+ års erfaring, Kongsberg-området'"
              className="w-full h-24 text-[0.875rem] rounded-lg border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <button onClick={handleMatch} disabled={!matchQuery.trim() || isLoading}
              className="flex items-center gap-1.5 text-[0.8125rem] font-medium bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-50 transition-opacity">
              <Search className="h-3.5 w-3.5" />Finn match
            </button>
          </div>
        )}

        {/* ── Mode: Epost */}
        {mode === "epost" && (
          <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/40">
            <div className="flex items-center justify-between">
              <p className="text-[0.875rem] font-semibold">✉️ Oppfølgings-epost</p>
              <button onClick={() => setMode(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div>
              <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Kontakt</label>
              <div className="relative mt-1">
                <Input value={epostContactId ? epostContactName : epostContactSearch}
                  onChange={(e) => { setEpostContactSearch(e.target.value); setEpostContactId(null); setEpostContactName(""); searchContacts(e.target.value); }}
                  placeholder="Søk etter kontakt..." className="text-[0.875rem]" />
                {epostContactResults.length > 0 && !epostContactId && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-md max-h-48 overflow-auto">
                    {epostContactResults.map((c: any) => (
                      <button key={c.id} onClick={() => { setEpostContactId(c.id); setEpostContactName(`${c.first_name} ${c.last_name}`); setEpostContactSearch(""); setEpostContactResults([]); }}
                        className="w-full text-left px-3 py-2 text-[0.8125rem] hover:bg-secondary transition-colors">
                        {c.first_name} {c.last_name}
                        {c.companies?.name && <span className="text-muted-foreground ml-1.5 text-[0.75rem]">{c.companies.name}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1 block">Tone</label>
              <div className="flex gap-2">
                {["Vennlig", "Profesjonell", "Kort"].map(t => (
                  <button key={t} onClick={() => setEpostTone(t)} className={epostTone === t ? CHIP_ON : CHIP_OFF}>{t}</button>
                ))}
              </div>
            </div>
            <button onClick={handleGenerateEpost} disabled={isLoading}
              className="flex items-center gap-1.5 text-[0.8125rem] font-medium bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-50 transition-opacity">
              <Mail className="h-3.5 w-3.5" />Skriv epost
            </button>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[85%]">
              <div className={`px-4 py-2 text-[0.8125rem] leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
                  : msg.error
                    ? "bg-destructive/5 text-destructive/80 rounded-2xl rounded-tl-sm"
                    : "bg-secondary text-foreground rounded-2xl rounded-tl-sm"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>p+p]:mt-2 [&>ul]:mt-1 [&>ul]:pl-4">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : msg.content}
              </div>
              {msg.showCopy && msg.role === "assistant" && (
                <button
                  onClick={() => { navigator.clipboard.writeText(msg.content); toast.success("Kopiert!"); }}
                  className="flex items-center gap-1.5 text-[0.75rem] text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1 mt-1 transition-colors"
                >
                  <Copy className="h-3 w-3" /> Kopier
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-secondary rounded-2xl rounded-tl-sm px-4 py-3">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/40 mx-0.5 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/40 mx-0.5 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/40 mx-0.5 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-border px-4 py-3 flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); autoResize(); }}
          onKeyDown={handleKeyDown}
          rows={1}
          style={{ resize: "none" }}
          placeholder="Spør om kontakter, pipeline, e-post..."
          className="flex-1 text-sm bg-secondary rounded-xl px-3 py-2 border border-transparent focus:border-primary/30 focus:outline-none transition-colors placeholder:text-muted-foreground/50"
        />
        <button onClick={() => sendMessage()} disabled={!input.trim() || isLoading}
          className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 disabled:opacity-50 transition-opacity">
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
