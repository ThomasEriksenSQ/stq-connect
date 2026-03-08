import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, RefreshCw, ArrowUp, X, ClipboardList, Mail, Target, BarChart3, MessageSquare, Search } from "lucide-react";
import { SheetClose } from "@/components/ui/sheet";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getEffectiveSignal } from "@/lib/categoryUtils";
import { differenceInDays } from "date-fns";

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };

interface CrmContext {
  contacts: Array<{
    name: string;
    company: string;
    signal: string;
    daysAgo: number | null;
  }>;
  foresporsler: Array<{
    selskap: string;
    sted: string | null;
    teknologier: string[];
    daysOld: number;
  }>;
}

const QUICK_ACTIONS = [
  {
    icon: ClipboardList,
    label: "Hva bør jeg gjøre i dag?",
    prompt: "Basert på CRM-dataene, hva er de 3 viktigste salgsprioriteringene mine i dag? Vær konkret og nevn navn.",
  },
  {
    icon: Mail,
    label: "Skriv en e-post",
    prompt: "Hjelp meg å skrive en kort salgsmail på norsk (4–5 setninger) til en kontakt med Behov nå-signal. Bruk en konkret kontakt fra dataene om mulig.",
  },
  {
    icon: Target,
    label: "Analyser pipeline",
    prompt: "Analyser den aktive pipelinen min. Hvilke forespørsler haster mest? Hvilke kontakter matcher best?",
  },
  {
    icon: BarChart3,
    label: "Ukesoppsummering",
    prompt: "Lag en kort ukesoppsummering av salgsstatus basert på kontakter og forespørsler i systemet.",
  },
  {
    icon: MessageSquare,
    label: "CV-pitch til kunde",
    prompt: "Hjelp meg å formulere en kort CV-pitch (3–4 setninger) for en embedded-konsulent til en aktiv forespørsel. Velg den beste matchen fra dataene.",
  },
  {
    icon: Search,
    label: "Finn beste match",
    prompt: "Hvilken aktiv forespørsel har størst potensial nå, og hva bør neste steg være?",
  },
];

function buildSystemPrompt(userName: string, ctx: CrmContext): string {
  const contactLines = ctx.contacts
    .filter((c) => c.signal && c.signal !== "Ikke aktuelt")
    .slice(0, 30)
    .map((c) => `- ${c.name} (${c.company}) | ${c.signal} | ${c.daysAgo != null ? `${c.daysAgo} dager siden sist` : "aldri kontaktet"}`)
    .join("\n");

  const fLines = ctx.foresporsler
    .slice(0, 16)
    .map((f) => `- ${f.selskap} | ${f.sted || "?"} | ${f.teknologier.join(", ")} | ${f.daysOld} dager gammel`)
    .join("\n");

  return `Du er en presis og direkte salgsassistent for STACQ — et norsk IT-konsulentselskap som matcher embedded/tech-konsulenter med industrielle kunder (Kongsberg, Tomra, Cisco osv.).

Din bruker heter ${userName} og er logget inn nå.

KONTEKST — KONTAKTER MED SIGNAL:
${contactLines || "(ingen kontakter med signal)"}

KONTEKST — AKTIVE FORESPØRSLER (${ctx.foresporsler.length} stk):
${fLines || "(ingen aktive forespørsler)"}

RETNINGSLINJER:
- Svar alltid på norsk
- Vær konkret og handlingsorientert — ikke generell
- Når du foreslår neste steg, nevn spesifikke navn fra dataene
- Hold svar under 120 ord med mindre brukeren ber om mer
- Formater med linjeskift, bruk → for handlingspunkter
- Du kan hjelpe med: prioritering, e-utkast, CV-pitch-tekst, analyse av pipeline, forslag til oppfølging, tolke signaler, ukesplan`;
}

export function AIChatPanel() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [crmContext, setCrmContext] = useState<CrmContext | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const userName = user?.email?.split("@")[0] || "bruker";

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Fetch CRM context
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
          return {
            name: `${c.first_name} ${c.last_name}`,
            company: c.companies?.name || "Ukjent",
            signal,
            daysAgo: lastAct ? differenceInDays(now, new Date(lastAct)) : null,
          };
        })
        .filter((c) => c.signal && c.signal !== "Ikke aktuelt")
        .sort((a, b) => {
          const order = ["Behov nå", "Får fremtidig behov", "Får kanskje behov", "Ukjent om behov"];
          return order.indexOf(a.signal) - order.indexOf(b.signal);
        });

      const foresporsler: CrmContext["foresporsler"] = (foresporslerRes.data || []).map((f: any) => ({
        selskap: f.selskap_navn,
        sted: f.sted,
        teknologier: f.teknologier || [],
        antallSendt: f.antall_sendt,
        daysOld: differenceInDays(now, new Date(f.mottatt_dato)),
      }));

      setCrmContext({ contacts, foresporsler });
    } catch (e) {
      console.error("Failed to fetch CRM context:", e);
      setCrmContext({ contacts: [], foresporsler: [] });
    } finally {
      setContextLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  const handleRefresh = () => {
    setMessages([]);
    fetchContext();
  };

  // Auto-resize textarea
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 96) + "px";
  };

  const sendMessage = async (text?: string) => {
    const userInput = (text || input).trim();
    if (!userInput || isLoading) return;

    const userMsg: Msg = { role: "user", content: userInput };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setIsLoading(true);

    try {
      const systemPrompt = crmContext ? buildSystemPrompt(userName, crmContext) : undefined;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            system: systemPrompt,
            messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          }),
        }
      );

      const data = await resp.json();

      if (!resp.ok || data.error) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.error || "Beklager, noe gikk galt. Prøv igjen.", error: true }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.text || "Ingen respons." }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Beklager, noe gikk galt. Prøv igjen.", error: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">AI-assistent</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Oppdater kontekst"
          >
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
        {/* Quick actions when no messages */}
        {messages.length === 0 && !contextLoading && (
          <div className="grid grid-cols-2 gap-2 pb-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => sendMessage(action.prompt)}
                disabled={isLoading}
                className="bg-secondary hover:bg-secondary/70 rounded-xl px-3 py-2.5 text-left text-[0.8125rem] cursor-pointer transition-colors border border-border disabled:opacity-50"
              >
                <action.icon className="h-3.5 w-3.5 text-primary mb-1" />
                <div className="text-foreground leading-snug">{action.label}</div>
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] px-4 py-2 text-[0.8125rem] leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
                  : msg.error
                    ? "bg-destructive/5 text-destructive/80 rounded-2xl rounded-tl-sm"
                    : "bg-secondary text-foreground rounded-2xl rounded-tl-sm"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>p+p]:mt-2 [&>ul]:mt-1 [&>ul]:pl-4">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {/* Loading bubble */}
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
          onChange={(e) => {
            setInput(e.target.value);
            autoResize();
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          style={{ resize: "none" }}
          placeholder="Spør om kontakter, pipeline, e-post..."
          className="flex-1 text-sm bg-secondary rounded-xl px-3 py-2 border border-transparent focus:border-primary/30 focus:outline-none transition-colors placeholder:text-muted-foreground/50"
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || isLoading}
          className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 disabled:opacity-50 transition-opacity"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
