import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isPast, isToday, startOfDay, addDays, format, differenceInDays } from "date-fns";
import { nb } from "date-fns/locale";
import { CATEGORIES, getEffectiveSignal } from "@/lib/categoryUtils";
import { Check, Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const CHIP_BASE = "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors cursor-pointer";
const CHIP_OFF = `${CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;
const CHIP_ON = `${CHIP_BASE} bg-foreground text-background border-foreground font-medium`;

type NaarFilter = "Forfalt + I dag" | "Denne uken" | "Kommende" | "Alle";
type SignalFilter = "Alle" | string;

const SIGNAL_PRIORITY: Record<string, number> = {};
CATEGORIES.forEach((c, i) => { SIGNAL_PRIORITY[c.label] = i; });
SIGNAL_PRIORITY[""] = CATEGORIES.length; // no signal = last

const OppfolgingerSection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [naarFilter, setNaarFilter] = useState<NaarFilter>("Forfalt + I dag");
  const [ownerFilter, setOwnerFilter] = useState<string>("mine");
  const [signalFilter, setSignalFilter] = useState<SignalFilter>("Alle");
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());

  const { data: tasks = [] } = useQuery({
    queryKey: ["dashboard-oppfolginger-v3"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, contacts(id, first_name, last_name, company_id, companies(name)), profiles!tasks_assigned_to_fkey(id, full_name)")
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: signalData } = useQuery({
    queryKey: ["dashboard-signal-data"],
    queryFn: async () => {
      const [{ data: acts }, { data: allTasks }] = await Promise.all([
        supabase.from("activities").select("contact_id, created_at, subject, description").not("contact_id", "is", null),
        supabase.from("tasks").select("contact_id, created_at, title, description, due_date").not("contact_id", "is", null),
      ]);
      return { acts: acts || [], tasks: allTasks || [] };
    },
  });

  const getContactSignal = useCallback((contactId: string | null): string => {
    if (!contactId || !signalData) return "";
    const acts = signalData.acts.filter((a: any) => a.contact_id === contactId);
    const tks = signalData.tasks.filter((t: any) => t.contact_id === contactId);
    return getEffectiveSignal(acts as any, tks.map((t: any) => ({ ...t, title: t.title || "" })) as any);
  }, [signalData]);

  const today = startOfDay(new Date());
  const endOfWeek = addDays(today, 7);

  // Apply owner filter
  let filtered = tasks.filter(t => !fadingIds.has(t.id));
  if (ownerFilter === "mine") {
    filtered = filtered.filter(t => t.assigned_to === user?.id || t.created_by === user?.id);
  } else if (ownerFilter !== "all") {
    filtered = filtered.filter(t => t.assigned_to === ownerFilter || t.created_by === ownerFilter);
  }

  // Apply signal filter
  if (signalFilter !== "Alle") {
    filtered = filtered.filter(t => getContactSignal(t.contact_id) === signalFilter);
  }

  // Categorize into groups
  const overdue = filtered.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
  const todayTasks = filtered.filter(t => t.due_date && isToday(new Date(t.due_date)));
  const weekTasks = filtered.filter(t => {
    if (!t.due_date) return false;
    const d = new Date(t.due_date);
    return d > today && d <= endOfWeek && !isToday(d);
  });
  const komTasks = filtered.filter(t => {
    if (!t.due_date) return false;
    const d = new Date(t.due_date);
    return d > endOfWeek;
  });
  const noDueDateTasks = filtered.filter(t => !t.due_date);

  const sortBySignalThenDate = (arr: typeof filtered) => {
    return [...arr].sort((a, b) => {
      const sa = SIGNAL_PRIORITY[getContactSignal(a.contact_id)] ?? CATEGORIES.length;
      const sb = SIGNAL_PRIORITY[getContactSignal(b.contact_id)] ?? CATEGORIES.length;
      if (sa !== sb) return sa - sb;
      return (a.due_date || "9999").localeCompare(b.due_date || "9999");
    });
  };

  // Build visible groups based on NÅR filter
  type Group = { key: string; label: string; headerClass: string; badgeClass: string; items: typeof filtered };
  const allGroups: Group[] = [
    { key: "forfalt", label: "Forfalt", headerClass: "text-destructive", badgeClass: "bg-destructive/10 text-destructive", items: sortBySignalThenDate(overdue) },
    { key: "idag", label: "I dag", headerClass: "text-foreground", badgeClass: "bg-primary/10 text-primary", items: sortBySignalThenDate(todayTasks) },
    { key: "uke", label: "Denne uken", headerClass: "text-foreground", badgeClass: "bg-muted text-muted-foreground", items: sortBySignalThenDate(weekTasks) },
    { key: "kommende", label: "Kommende", headerClass: "text-foreground", badgeClass: "bg-muted text-muted-foreground", items: sortBySignalThenDate([...komTasks, ...noDueDateTasks]) },
  ];

  let visibleGroups: Group[];
  if (naarFilter === "Forfalt + I dag") {
    visibleGroups = allGroups.filter(g => g.key === "forfalt" || g.key === "idag");
  } else if (naarFilter === "Denne uken") {
    visibleGroups = allGroups.filter(g => g.key === "uke");
  } else if (naarFilter === "Kommende") {
    visibleGroups = allGroups.filter(g => g.key === "kommende");
  } else {
    visibleGroups = allGroups;
  }

  // Only show groups with items
  visibleGroups = visibleGroups.filter(g => g.items.length > 0);

  const totalCount = filtered.length;

  const handleComplete = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    setFadingIds(prev => new Set(prev).add(taskId));
    await supabase.from("tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", taskId);
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-oppfolginger-v3"] });
      setFadingIds(prev => { const n = new Set(prev); n.delete(taskId); return n; });
    }, 500);
  };

  const handleChangeOwner = async (e: React.MouseEvent, taskId: string, profileId: string) => {
    e.stopPropagation();
    await supabase.from("tasks").update({ assigned_to: profileId }).eq("id", taskId);
    queryClient.invalidateQueries({ queryKey: ["dashboard-oppfolginger-v3"] });
  };

  const handleChangeSignal = async (e: React.MouseEvent, contactId: string, signal: string) => {
    e.stopPropagation();
    // Log an activity with the signal as subject
    await supabase.from("activities").insert({
      contact_id: contactId,
      subject: signal,
      type: "note",
      created_by: user?.id,
    });
    queryClient.invalidateQueries({ queryKey: ["dashboard-signal-data"] });
  };

  const handlePostpone = async (e: React.MouseEvent, taskId: string, newDate: Date) => {
    e.stopPropagation();
    await supabase.from("tasks").update({ due_date: format(newDate, "yyyy-MM-dd") }).eq("id", taskId);
    queryClient.invalidateQueries({ queryKey: ["dashboard-oppfolginger-v3"] });
  };

  const currentUserProfile = profiles.find(p => p.id === user?.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <h2 className="text-[1.125rem] font-bold text-foreground">Oppfølginger</h2>
        <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary/10 text-primary text-[0.6875rem] font-semibold">
          {totalCount}
        </span>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground w-14 flex-shrink-0">Når</span>
          <div className="flex items-center gap-1.5">
            {(["Forfalt + I dag", "Denne uken", "Kommende", "Alle"] as NaarFilter[]).map(f => (
              <button key={f} className={naarFilter === f ? CHIP_ON : CHIP_OFF} onClick={() => setNaarFilter(f)}>{f}</button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground w-14 flex-shrink-0">Eier</span>
          <div className="flex items-center gap-1.5">
            <button className={ownerFilter === "mine" ? CHIP_ON : CHIP_OFF} onClick={() => setOwnerFilter("mine")}>
              {currentUserProfile?.full_name || "Mine"}
            </button>
            <button className={ownerFilter === "all" ? CHIP_ON : CHIP_OFF} onClick={() => setOwnerFilter("all")}>Alle</button>
            {profiles.filter(p => p.id !== user?.id).map(p => (
              <button key={p.id} className={ownerFilter === p.id ? CHIP_ON : CHIP_OFF} onClick={() => setOwnerFilter(p.id)}>
                {p.full_name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground w-14 flex-shrink-0">Signal</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button className={signalFilter === "Alle" ? CHIP_ON : CHIP_OFF} onClick={() => setSignalFilter("Alle")}>Alle</button>
            {CATEGORIES.map(c => (
              <button key={c.label} className={signalFilter === c.label ? CHIP_ON : CHIP_OFF} onClick={() => setSignalFilter(c.label)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Groups */}
      {visibleGroups.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[0.9375rem] text-muted-foreground">Ingen oppfølginger å vise 🎉</p>
        </div>
      ) : (
        <div className="space-y-6">
          {visibleGroups.map((group, gi) => (
            <div key={group.key}>
              {gi > 0 && <div className="h-px bg-border mb-6" />}
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-[0.6875rem] font-semibold uppercase tracking-[0.08em] ${group.headerClass}`}>{group.label}</span>
                <span className={`inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[0.6875rem] font-semibold ${group.badgeClass}`}>
                  {group.items.length}
                </span>
              </div>
              <div className="bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.07)] overflow-hidden">
                {group.items.map((task, i) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    isOverdue={group.key === "forfalt"}
                    isLast={i === group.items.length - 1}
                    profiles={profiles}
                    signal={getContactSignal(task.contact_id)}
                    onComplete={handleComplete}
                    onChangeOwner={handleChangeOwner}
                    onChangeSignal={handleChangeSignal}
                    onPostpone={handlePostpone}
                    navigate={navigate}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-center">
        <button onClick={() => navigate("/oppfolginger")} className="text-[0.8125rem] text-primary hover:underline">
          Vis alle oppfølginger →
        </button>
      </div>
    </div>
  );
};

// ─── TaskRow ───────────────────────────────────────────────

interface TaskRowProps {
  task: any;
  isOverdue: boolean;
  isLast: boolean;
  profiles: Array<{ id: string; full_name: string }>;
  signal: string;
  onComplete: (e: React.MouseEvent, id: string) => void;
  onChangeOwner: (e: React.MouseEvent, taskId: string, profileId: string) => void;
  onChangeSignal: (e: React.MouseEvent, contactId: string, signal: string) => void;
  onPostpone: (e: React.MouseEvent, taskId: string, newDate: Date) => void;
  navigate: (path: string) => void;
}

function TaskRow({ task, isOverdue, isLast, profiles, signal, onComplete, onChangeOwner, onChangeSignal, onPostpone, navigate }: TaskRowProps) {
  const contact = task.contacts as any;
  const contactName = contact?.first_name ? `${contact.first_name} ${contact.last_name}` : null;
  const contactId = contact?.id || null;
  const companyName = contact?.companies?.name || null;
  const ownerProfile = task.profiles as any;
  const ownerName = ownerProfile?.full_name || "";

  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const now = startOfDay(new Date());
  const dueDiff = dueDate ? differenceInDays(dueDate, now) : null;

  const dateColor = dueDate
    ? (isToday(dueDate) ? "text-primary" : isPast(dueDate) && !isToday(dueDate) ? "text-destructive" : "text-muted-foreground")
    : "text-muted-foreground";

  const dateSubtext = dueDate
    ? (isToday(dueDate) ? "I dag" : isPast(dueDate) ? `Forfalt ${Math.abs(dueDiff!)} dager siden` : `Om ${dueDiff} dager`)
    : null;

  const dateSubColor = dueDate
    ? (isToday(dueDate) ? "text-primary" : isPast(dueDate) ? "text-destructive" : "text-muted-foreground")
    : "text-muted-foreground";

  const signalCat = CATEGORIES.find(c => c.label === signal);

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-4 hover:bg-[hsl(210,20%,98%)] transition-colors cursor-pointer",
        !isLast && "border-b border-border",
        isOverdue && "border-l-[3px] border-l-destructive"
      )}
      onClick={() => contactId && navigate(`/kontakter/${contactId}`)}
    >
      {/* Checkbox */}
      <button
        className="mt-0.5 h-[18px] w-[18px] rounded border border-border flex-shrink-0 flex items-center justify-center hover:border-primary hover:bg-primary/5 transition-colors"
        onClick={(e) => onComplete(e, task.id)}
      >
        <Check className="h-3 w-3 text-transparent hover:text-primary/40" />
      </button>

      {/* Middle content */}
      <div className="flex-1 min-w-0">
        <p className="text-[0.875rem] font-bold text-foreground">{task.title}</p>
        {task.description && !/^\[.+\]$/.test(task.description.trim()) && (
          <p className="text-[0.8125rem] text-foreground/70 leading-relaxed whitespace-pre-wrap mt-0.5">
            {task.description.replace(/^\[[^\]]+\]\n?/, "").trim()}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {contactName ? (
            <button
              className="text-[0.8125rem] text-muted-foreground hover:text-primary hover:underline"
              onClick={(e) => { e.stopPropagation(); navigate(`/kontakter/${contactId}`); }}
            >
              {contactName}
            </button>
          ) : (
            <span className="text-[0.8125rem] text-muted-foreground italic">Ukjent kontakt</span>
          )}
          {companyName && (
            <>
              <span className="text-[0.8125rem] text-muted-foreground">·</span>
              <span className="text-[0.8125rem] text-muted-foreground">{companyName}</span>
            </>
          )}

          {/* Owner badge - inline editable */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[0.6875rem] font-medium ml-1 hover:bg-primary/20 transition-colors">
                {ownerName || "Ingen eier"}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[200px]" onClick={(e) => e.stopPropagation()}>
              {profiles.map(p => (
                <DropdownMenuItem key={p.id} onClick={(e) => onChangeOwner(e as any, task.id, p.id)}>
                  {p.full_name}
                  {p.id === task.assigned_to && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Right side */}
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        {/* Signal badge */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            {signal ? (
              <button className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold hover:opacity-80 transition-opacity", signalCat?.badgeColor)}>
                {signal}
              </button>
            ) : (
              <button className="text-[0.75rem] text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                + Signal
              </button>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[200px]" onClick={(e) => e.stopPropagation()}>
            {CATEGORIES.map(c => (
              <DropdownMenuItem
                key={c.label}
                disabled={!task.contact_id}
                onClick={(e) => task.contact_id && onChangeSignal(e as any, task.contact_id, c.label)}
              >
                <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold mr-2", c.badgeColor)}>
                  {c.label}
                </span>
                {signal === c.label && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Due date with postpone */}
        {dueDate && (
          <PostponeDate
            taskId={task.id}
            dueDate={dueDate}
            dateColor={dateColor}
            dateSubtext={dateSubtext}
            dateSubColor={dateSubColor}
            onPostpone={onPostpone}
          />
        )}
      </div>
    </div>
  );
}

// ─── PostponeDate ──────────────────────────────────────────

function PostponeDate({ taskId, dueDate, dateColor, dateSubtext, dateSubColor, onPostpone }: {
  taskId: string;
  dueDate: Date;
  dateColor: string;
  dateSubtext: string | null;
  dateSubColor: string;
  onPostpone: (e: React.MouseEvent, taskId: string, newDate: Date) => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button className="text-right hover:opacity-70 transition-opacity">
          <p className={cn("text-[0.8125rem] font-medium", dateColor)}>
            {format(dueDate, "dd.MM.yyyy")}
          </p>
          {dateSubtext && (
            <p className={cn("text-[0.6875rem]", dateSubColor)}>{dateSubtext}</p>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={(e) => onPostpone(e as any, taskId, addDays(dueDate, 7))}>1 uke</DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => onPostpone(e as any, taskId, addDays(dueDate, 14))}>2 uker</DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => onPostpone(e as any, taskId, addDays(dueDate, 30))}>1 måned</DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="p-0">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button
                className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded-sm flex items-center gap-2"
                onClick={(e) => { e.stopPropagation(); setCalendarOpen(true); }}
              >
                <CalendarIcon className="h-4 w-4" />
                Velg dato
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end" side="left">
              <Calendar
                mode="single"
                selected={dueDate}
                onSelect={(d) => {
                  if (d) {
                    // Create a synthetic mouse event for the handler
                    const syntheticEvent = { stopPropagation: () => {} } as React.MouseEvent;
                    onPostpone(syntheticEvent, taskId, d);
                    setCalendarOpen(false);
                  }
                }}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default OppfolgingerSection;
