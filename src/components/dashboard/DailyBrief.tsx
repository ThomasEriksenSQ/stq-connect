import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ChevronRight, RefreshCw, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getEffectiveSignal, extractCategory, CATEGORIES } from "@/lib/categoryUtils";
import { Skeleton } from "@/components/ui/skeleton";

// Model constant — single place to change when upgrading.
// Note: actual model is controlled by the chat edge function (Lovable AI gateway).
const AI_MODEL = "claude-sonnet-4-20250514";

/* ── Scoring helpers (pure functions) ── */

interface ContactCandidate {
  id: string;
  name: string;
  company: string | null;
  signal: string;
  signalAge: number | null;
  daysSinceLastActivity: number | null;
  overdueTask: { title: string; daysOverdue: number } | null;
  todayTask: { title: string } | null;
  score: number;
  reason: string;
}

const SIGNAL_SCORE: Record<string, number> = {
  "Behov nå": 0,
  "Får fremtidig behov": 100,
  "Får kanskje behov": 200,
  "Ukjent om behov": 300,
};

function computeScore(c: Omit<ContactCandidate, "score" | "reason">): number {
  let score = SIGNAL_SCORE[c.signal] ?? 400;

  // Urgency modifiers (subtract = higher priority)
  if (c.overdueTask) score -= 50;
  if (c.todayTask) score -= 30;
  if (c.daysSinceLastActivity === null) score -= 10;
  else if (c.daysSinceLastActivity > 14) score -= 15;
  else if (c.daysSinceLastActivity > 7) score -= 8;

  // Staleness penalty
  if (c.signalAge !== null) {
    if (c.signalAge > 60) score += 80;
    else if (c.signalAge > 30) score += 30;
  }

  return score;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function buildReason(c: Omit<ContactCandidate, "score" | "reason">): string {
  const parts: string[] = [];

  if (c.overdueTask) {
    parts.push("Forfalt: " + truncate(c.overdueTask.title, 20));
  }
  if (c.todayTask && parts.length < 2) {
    parts.push("I dag: " + truncate(c.todayTask.title, 20));
  }
  if (parts.length < 2 && c.signal) {
    if (c.daysSinceLastActivity === null) {
      parts.push(c.signal + " · aldri kontaktet");
    } else if (c.daysSinceLastActivity > 14) {
      parts.push(c.signal + " · " + c.daysSinceLastActivity + " dager siden");
    } else {
      parts.push(c.signal);
    }
  }

  const joined = parts.join(" · ");
  return truncate(joined, 50);
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "God morgen";
  if (h < 18) return "God ettermiddag";
  return "God kveld";
}

function getUserFirstName(fullName: string | undefined): string {
  if (!fullName) return "";
  return fullName.split(" ")[0];
}

/* ── Component ── */

const DailyBrief = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [aiSentence, setAiSentence] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  // Fetch profile for greeting
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user!.id)
        .single();
      return data;
    },
  });

  // Main data query
  const { data: candidates, isLoading } = useQuery({
    queryKey: ["daily-brief-v2"],
    enabled: !!user?.id,
    queryFn: async () => {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);

      const [activitiesRes, tasksRes, contactsRes] = await Promise.all([
        supabase
          .from("activities")
          .select("contact_id, created_at, subject, description"),
        supabase
          .from("tasks")
          .select("contact_id, due_date, status, title, assigned_to, created_by, description"),
        supabase
          .from("contacts")
          .select("id, first_name, last_name, company_id, companies(name)"),
      ]);

      const activities = activitiesRes.data || [];
      const tasks = tasksRes.data || [];
      const contacts = contactsRes.data || [];

      // Group by contact
      const actByContact = new Map<string, typeof activities>();
      for (const a of activities) {
        if (!a.contact_id) continue;
        const list = actByContact.get(a.contact_id) || [];
        list.push(a);
        actByContact.set(a.contact_id, list);
      }

      const taskByContact = new Map<string, typeof tasks>();
      for (const t of tasks) {
        if (!t.contact_id) continue;
        const list = taskByContact.get(t.contact_id) || [];
        list.push(t);
        taskByContact.set(t.contact_id, list);
      }

      const results: ContactCandidate[] = [];

      for (const contact of contacts) {
        const cActivities = actByContact.get(contact.id) || [];
        const cTasks = taskByContact.get(contact.id) || [];

        const signal = getEffectiveSignal(
          cActivities.map((a) => ({
            created_at: a.created_at,
            subject: a.subject,
            description: a.description,
          })),
          cTasks.map((t) => ({
            created_at: "", // not used for signal extraction from tasks in the function
            title: t.title,
            description: t.description,
            due_date: t.due_date,
          }))
        );

        if (signal === "Ikke aktuelt") continue;

        // Days since last activity
        let daysSinceLastActivity: number | null = null;
        if (cActivities.length > 0) {
          const maxDate = cActivities.reduce(
            (max, a) => (a.created_at > max ? a.created_at : max),
            cActivities[0].created_at
          );
          daysSinceLastActivity = daysBetween(new Date(maxDate), now);
        }

        // Signal age: most recent activity that set the signal
        let signalAge: number | null = null;
        if (signal) {
          const signalActivities = cActivities
            .filter((a) => {
              const cat = extractCategory(a.subject, a.description);
              return cat === signal;
            })
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
          if (signalActivities.length > 0) {
            signalAge = daysBetween(new Date(signalActivities[0].created_at), now);
          }
        }

        // Overdue task (user's tasks only)
        const userOverdue = cTasks
          .filter(
            (t) =>
              t.status !== "completed" &&
              t.due_date &&
              t.due_date < todayStr &&
              (t.assigned_to === user!.id || t.created_by === user!.id)
          )
          .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
        const overdueTask = userOverdue.length > 0
          ? {
              title: userOverdue[0].title,
              daysOverdue: daysBetween(new Date(userOverdue[0].due_date!), now),
            }
          : null;

        // Today task
        const userToday = cTasks.filter(
          (t) =>
            t.status !== "completed" &&
            t.due_date === todayStr &&
            (t.assigned_to === user!.id || t.created_by === user!.id)
        );
        const todayTask = userToday.length > 0 ? { title: userToday[0].title } : null;

        // Filter: must have signal OR urgency
        if (!signal && !overdueTask && !todayTask) continue;

        const candidate: Omit<ContactCandidate, "score" | "reason"> = {
          id: contact.id,
          name: `${contact.first_name} ${contact.last_name}`,
          company: (contact.companies as any)?.name || null,
          signal,
          signalAge,
          daysSinceLastActivity,
          overdueTask,
          todayTask,
        };

        results.push({
          ...candidate,
          score: computeScore(candidate),
          reason: buildReason(candidate),
        });
      }

      results.sort((a, b) => a.score - b.score);
      setFetchedAt(new Date());
      return results.slice(0, 4);
    },
  });

  // AI sentence (phase 2 — non-blocking)
  useEffect(() => {
    if (!candidates || candidates.length === 0) return;
    let cancelled = false;

    const fetchAi = async () => {
      setAiLoading(true);
      setAiSentence(null);
      try {
        const payload = candidates.map((c) => ({
          name: c.name,
          company: c.company,
          signal: c.signal,
          daysSinceLastActivity: c.daysSinceLastActivity,
          signalAge: c.signalAge,
          overdueTask: c.overdueTask,
        }));

        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              messages: [
                {
                  role: "system",
                  content:
                    "Du er salgsassistent for STACQ, et norsk konsulentselskap som matcher IT-konsulenter med oppdrag hos kunder. Skriv ÉN setning på norsk, maks 20 ord, som peker på dagens viktigste salgsmulighet. Nevn ett navn og vær konkret. Ingen hilsener, ingen fyllord.",
                },
                {
                  role: "user",
                  content: JSON.stringify(payload),
                },
              ],
            }),
          }
        );

        if (!resp.ok || !resp.body) throw new Error("AI fetch failed");

        // Parse SSE stream
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let result = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, idx);
            buf = buf.slice(idx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") break;
            try {
              const parsed = JSON.parse(json);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) result += content;
            } catch {
              buf = line + "\n" + buf;
              break;
            }
          }
        }

        if (!cancelled && result.trim()) {
          setAiSentence(result.trim());
        }
      } catch {
        // Fail silently
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    };

    fetchAi();
    return () => { cancelled = true; };
  }, [candidates]);

  const handleRefresh = () => {
    setAiSentence(null);
    queryClient.invalidateQueries({ queryKey: ["daily-brief-v2"] });
  };

  const timeStr = fetchedAt
    ? `Oppdatert kl. ${fetchedAt.getHours().toString().padStart(2, "0")}:${fetchedAt.getMinutes().toString().padStart(2, "0")}`
    : "";

  const firstName = getUserFirstName(profile?.full_name);

  return (
    <div className="bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.07)] overflow-hidden px-5 pt-4 pb-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <h2 className="text-[1.25rem] font-bold text-foreground">
          {getGreeting()}, {firstName} 👋
        </h2>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[0.75rem] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            AI-generert
          </span>
          <button
            onClick={handleRefresh}
            className="p-1 rounded hover:bg-secondary text-muted-foreground transition-colors"
            title="Oppdater"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* AI sentence */}
      {aiLoading && (
        <Skeleton className="h-4 w-3/4 mb-3" />
      )}
      {aiSentence && !aiLoading && (
        <p className="text-sm italic text-muted-foreground mb-3 animate-in fade-in duration-500">
          {aiSentence}
        </p>
      )}

      {/* Cards */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : candidates && candidates.length > 0 ? (
        <div className="divide-y divide-border">
          {candidates.map((c, i) => {
            const accentColor = c.overdueTask
              ? "bg-destructive"
              : c.signal === "Behov nå"
              ? "bg-[hsl(var(--success))]"
              : "bg-transparent";

            return (
              <div
                key={c.id}
                onClick={() => navigate(`/kontakter/${c.id}`)}
                className="flex items-center gap-3 py-3 cursor-pointer hover:bg-secondary/50 transition-colors -mx-5 px-5 group"
              >
                {/* Accent border */}
                <div
                  className={`w-[3px] self-stretch rounded-full flex-shrink-0 ${accentColor}`}
                />

                {/* Rank circle */}
                <div className="w-5 h-5 rounded-full bg-foreground text-background flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium">{i + 1}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="text-[0.875rem] font-semibold text-foreground truncate">
                    {c.name}
                    {c.company && (
                      <span className="font-normal text-muted-foreground"> · {c.company}</span>
                    )}
                  </div>
                  <div className="text-[0.8125rem] text-muted-foreground truncate">
                    {c.reason}
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0 group-hover:text-foreground transition-colors" />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          Ingen prioriterte handlinger akkurat nå — bra jobbet! 🎉
        </div>
      )}

      {/* Footer */}
      {timeStr && (
        <div className="flex justify-end mt-3">
          <span className="text-[0.75rem] text-muted-foreground">{timeStr}</span>
        </div>
      )}
    </div>
  );
};

export default DailyBrief;
