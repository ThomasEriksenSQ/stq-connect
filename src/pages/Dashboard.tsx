import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Building2, Users, CalendarCheck, ArrowRight, Sparkles, Send, FileText, Phone, Calendar, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

const typeIcons: Record<string, typeof FileText> = {
  note: FileText, call: Phone, meeting: Calendar, email: Mail,
};
const typeAccents: Record<string, string> = {
  note: "text-muted-foreground", call: "text-success", meeting: "text-primary", email: "text-warning",
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [companies, contacts, tasks] = await Promise.all([
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "done"),
      ]);
      return {
        companies: companies.count ?? 0,
        contacts: contacts.count ?? 0,
        openTasks: tasks.count ?? 0,
      };
    },
  });

  const { data: recentActivities = [] } = useQuery({
    queryKey: ["dashboard-activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*, contacts(first_name, last_name), companies(name)")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: upcomingTasks = [] } = useQuery({
    queryKey: ["dashboard-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, contacts(first_name, last_name)")
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsStreaming(true);

    let assistantSoFar = "";

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: allMessages }),
        }
      );

      if (!resp.ok || !resp.body) {
        throw new Error(`Error ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Beklager, noe gikk galt. Prøv igjen." },
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  const statCards = [
    { label: "Selskaper", value: stats?.companies ?? "–", icon: Building2, href: "/selskaper", color: "text-primary" },
    { label: "Kontakter", value: stats?.contacts ?? "–", icon: Users, href: "/kontakter", color: "text-success" },
    { label: "Åpne oppfølginger", value: stats?.openTasks ?? "–", icon: CalendarCheck, href: "/oppfolginger", color: "text-warning" },
  ];

  const firstName = user?.email?.split("@")[0] ?? "bruker";

  return (
    <div className="space-y-10">
      {/* Welcome */}
      <div className="space-y-2">
        <h1 className="text-[1.75rem] font-bold">
          Hei, {firstName} 👋
        </h1>
        <p className="text-muted-foreground text-[0.9375rem] prose-measure">
          Her er en rask oversikt over CRM-et ditt. Bruk AI-assistenten for å stille spørsmål eller få hjelp.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((s) => (
          <button
            key={s.label}
            onClick={() => navigate(s.href)}
            className="group flex items-center gap-4 p-5 rounded-xl bg-card border border-border/50 hover:border-border transition-all text-left"
          >
            <div className={`p-2.5 rounded-lg bg-accent ${s.color}`}>
              <s.icon className="h-5 w-5 stroke-[1.5]" />
            </div>
            <div>
              <p className="text-[1.5rem] font-bold leading-none">{s.value}</p>
              <p className="text-[0.8125rem] text-muted-foreground mt-1">{s.label}</p>
            </div>
            <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground/20 group-hover:text-muted-foreground/60 transition-colors" />
          </button>
        ))}
      </div>

      {/* Two column: AI chat + activity/tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* AI Assistant — 3/5 */}
        <section className="lg:col-span-3 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-label">AI-assistent</h2>
          </div>
          <div className="rounded-xl bg-card border border-border/50 overflow-hidden flex flex-col" style={{ minHeight: "360px", maxHeight: "480px" }}>
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <Sparkles className="h-8 w-8 text-primary/30 mb-3" />
                  <p className="text-[0.875rem] text-muted-foreground">
                    Spør meg om kundene dine, oppfølginger, eller få hjelp med CRM-arbeid.
                  </p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-4 py-2.5 rounded-xl text-[0.875rem] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-foreground"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:my-1 [&>ol]:my-1">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border/50 p-3">
              <form
                onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="Skriv en melding..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isStreaming}
                  className="flex-1 bg-transparent text-[0.875rem] placeholder:text-muted-foreground/40 focus:outline-none px-2 py-1.5"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || isStreaming}
                  className="h-8 w-8 rounded-lg flex-shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>
          </div>
        </section>

        {/* Right column: Tasks + Activities — 2/5 */}
        <div className="lg:col-span-2 space-y-8">
          {/* Upcoming tasks */}
          <section className="space-y-3">
            <h2 className="text-label">Kommende oppfølginger</h2>
            {upcomingTasks.length === 0 ? (
              <p className="text-[0.8125rem] text-muted-foreground/60 py-4">Ingen kommende oppfølginger</p>
            ) : (
              <div className="space-y-1">
                {upcomingTasks.map((task) => {
                  const contactName = (task.contacts as any)?.first_name
                    ? `${(task.contacts as any).first_name} ${(task.contacts as any).last_name}`
                    : null;
                  return (
                    <div key={task.id} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-card transition-colors">
                      <CalendarCheck className="h-4 w-4 text-warning stroke-[1.5] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.875rem] font-medium truncate">{task.title}</p>
                        <p className="text-[0.75rem] text-muted-foreground truncate">
                          {[contactName, task.due_date ? format(new Date(task.due_date), "d. MMM", { locale: nb }) : null].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Recent activities */}
          <section className="space-y-3">
            <h2 className="text-label">Siste aktiviteter</h2>
            {recentActivities.length === 0 ? (
              <p className="text-[0.8125rem] text-muted-foreground/60 py-4">Ingen aktiviteter ennå</p>
            ) : (
              <div className="space-y-1">
                {recentActivities.map((a) => {
                  const Icon = typeIcons[a.type] || FileText;
                  const accent = typeAccents[a.type] || "text-muted-foreground";
                  const contactName = (a.contacts as any)?.first_name
                    ? `${(a.contacts as any).first_name} ${(a.contacts as any).last_name}`
                    : null;
                  return (
                    <div key={a.id} className="flex items-start gap-3 px-4 py-3 rounded-xl hover:bg-card transition-colors">
                      <Icon className={`h-4 w-4 mt-0.5 stroke-[1.5] ${accent} flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.875rem] font-medium truncate">{a.subject}</p>
                        <p className="text-[0.75rem] text-muted-foreground truncate">
                          {[contactName, format(new Date(a.created_at), "d. MMM", { locale: nb })].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
