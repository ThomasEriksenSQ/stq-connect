import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isPast, isToday, startOfDay, addDays, addWeeks, addMonths, format, differenceInDays } from "date-fns";
import { CATEGORIES, getEffectiveSignal, extractCategory } from "@/lib/categoryUtils";
import { Check, Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import FollowUpModal from "./FollowUpModal";

const CHIP_BASE = "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors cursor-pointer";
const CHIP_OFF = `${CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;
const CHIP_ON = `${CHIP_BASE} bg-foreground text-background border-foreground font-medium`;

type NaarFilter = "Forfalt + I dag" | "Forfalt" | "I dag" | "Denne uken" | "Alle";
type SignalFilter = "Alle" | string;

const SIGNAL_PRIORITY: Record<string, number> = {};
CATEGORIES.forEach((c, i) => { SIGNAL_PRIORITY[c.label] = i; });
SIGNAL_PRIORITY[""] = CATEGORIES.length;

const SIGNAL_CATEGORIES_NO_IKKE = CATEGORIES.filter(c => c.label !== "Ikke aktuelt");

const MAX_UNFILTERED = 25;

const OppfolgingerSection = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [naarFilter, setNaarFilter] = useState<NaarFilter>("Forfalt + I dag");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [signalFilter, setSignalFilter] = useState<SignalFilter>("Alle");
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());

  // Follow-up modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTaskId, setModalTaskId] = useState<string | null>(null);
  const [modalData, setModalData] = useState<{
    name: string; company: string; task: string; signal: string;
    ownerProfileId: string; contactId: string | null; companyId: string | null;
  } | null>(null);

  const { data: tasks = [] } = useQuery({
    queryKey: ["oppfolginger-tasks-v1"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, contacts(id, first_name, last_name, title, company_id, companies(name)), profiles!tasks_assigned_to_fkey(id, full_name)")
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
    queryKey: ["oppfolginger-signal-v1"],
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

  // 1. Exclude "Ikke aktuelt"
  let filtered = tasks.filter(t => {
    if (fadingIds.has(t.id)) return false;
    const sig = getContactSignal(t.contact_id);
    return sig !== "Ikke aktuelt";
  });

  // 2. Owner filter
  if (ownerFilter === "mine") {
    filtered = filtered.filter(t => t.assigned_to === user?.id || t.created_by === user?.id);
  } else if (ownerFilter !== "all") {
    filtered = filtered.filter(t => t.assigned_to === ownerFilter || t.created_by === ownerFilter);
  }

  // 3. Når filter
  const applyNaarFilter = (arr: typeof filtered, f: NaarFilter) => {
    switch (f) {
      case "Forfalt + I dag":
        return arr.filter(t => !t.due_date || isPast(new Date(t.due_date)) || isToday(new Date(t.due_date)));
      case "Forfalt":
        return arr.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
      case "I dag":
        return arr.filter(t => !t.due_date || isToday(new Date(t.due_date)));
      case "Denne uken":
        return arr.filter(t => {
          if (!t.due_date) return false;
          const d = new Date(t.due_date);
          return d > today && d <= endOfWeek && !isToday(d);
        });
      default:
        return arr;
    }
  };

  let naarFiltered = applyNaarFilter(filtered, naarFilter);

  // 4. Signal filter
  if (signalFilter !== "Alle") {
    naarFiltered = naarFiltered.filter(t => getContactSignal(t.contact_id) === signalFilter);
  }

  // 5. Sort: signal priority, then due_date ASC
  const sorted = [...naarFiltered].sort((a, b) => {
    const sa = SIGNAL_PRIORITY[getContactSignal(a.contact_id)] ?? CATEGORIES.length;
    const sb = SIGNAL_PRIORITY[getContactSignal(b.contact_id)] ?? CATEGORIES.length;
    if (sa !== sb) return sa - sb;
    return (a.due_date || "9999").localeCompare(b.due_date || "9999");
  });

  // Limit for "Alle"
  const isAllFilter = naarFilter === "Alle";
  const hiddenCount = isAllFilter && sorted.length > MAX_UNFILTERED ? sorted.length - MAX_UNFILTERED : 0;
  const visible = isAllFilter ? sorted.slice(0, MAX_UNFILTERED) : sorted;

  // Empty state for "Forfalt + I dag" — show this week fallback
  const showForfaltEmpty = naarFilter === "Forfalt + I dag" && visible.length === 0;
  const weekFallback = showForfaltEmpty
    ? applyNaarFilter(filtered, "Denne uken")
        .filter(t => signalFilter === "Alle" || getContactSignal(t.contact_id) === signalFilter)
        .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"))
    : [];

  // Handlers
  const handleComplete = async (e: React.MouseEvent, task: any) => {
    e.stopPropagation();
    setFadingIds(prev => new Set(prev).add(task.id));

    await supabase.from("tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", task.id);

    setTimeout(() => {
      setFadingIds(prev => { const n = new Set(prev); n.delete(task.id); return n; });
      const contact = task.contacts as any;
      const sig = getContactSignal(task.contact_id);
      setModalTaskId(task.id);
      setModalData({
        name: contact ? `${contact.first_name} ${contact.last_name}` : "Ukjent",
        company: contact?.companies?.name || "",
        task: task.title,
        signal: sig,
        ownerProfileId: task.assigned_to || user?.id || "",
        contactId: task.contact_id,
        companyId: contact?.company_id || null,
      });
      setModalOpen(true);
    }, 400);
  };

  const handleModalCancel = async () => {
    setModalOpen(false);
    if (modalTaskId) {
      await supabase.from("tasks").update({ status: "open", completed_at: null }).eq("id", modalTaskId);
      queryClient.invalidateQueries({ queryKey: ["oppfolginger-tasks-v1"] });
    }
  };

  const handleModalSkip = () => {
    setModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ["oppfolginger-tasks-v1"] });
  };

  const handleModalSubmit = async (data: { title: string; dueDate: Date; owner: string }) => {
    setModalOpen(false);
    if (modalData) {
      await supabase.from("tasks").insert({
        title: data.title,
        due_date: format(data.dueDate, "yyyy-MM-dd"),
        contact_id: modalData.contactId,
        company_id: modalData.companyId,
        assigned_to: data.owner,
        created_by: user?.id,
      });
      const firstName = modalData.name.split(" ")[0];
      toast.success(`Oppfølging opprettet for ${firstName}`);
      queryClient.invalidateQueries({ queryKey: ["oppfolginger-tasks-v1"] });
    }
  };

  const handleChangeOwner = async (e: React.MouseEvent, taskId: string, profileId: string) => {
    e.stopPropagation();
    await supabase.from("tasks").update({ assigned_to: profileId }).eq("id", taskId);
    queryClient.invalidateQueries({ queryKey: ["oppfolginger-tasks-v1"] });
  };

  const handleChangeSignal = async (e: React.MouseEvent, contactId: string, signal: string) => {
    e.stopPropagation();
    await supabase.from("activities").insert({
      contact_id: contactId,
      subject: signal,
      type: "note",
      created_by: user?.id,
    });
    queryClient.invalidateQueries({ queryKey: ["oppfolginger-signal-v1"] });
  };

  const handlePostpone = async (e: React.MouseEvent, taskId: string, newDate: Date) => {
    e.stopPropagation();
    await supabase.from("tasks").update({ due_date: format(newDate, "yyyy-MM-dd") }).eq("id", taskId);
    queryClient.invalidateQueries({ queryKey: ["oppfolginger-tasks-v1"] });
  };

  const currentUserProfile = profiles.find(p => p.id === user?.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <h2 className="text-[1.125rem] font-bold text-foreground">Oppfølginger</h2>
        <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary/10 text-primary text-[0.6875rem] font-semibold">
          {visible.length}{hiddenCount > 0 ? "+" : ""}
        </span>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground w-14 flex-shrink-0">Når</span>
          <div className="flex items-center gap-1.5">
            {(["Forfalt + I dag", "Forfalt", "I dag", "Denne uken", "Alle"] as NaarFilter[]).map(f => (
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
            {profiles.filter(p => p.id !== user?.id).map(p => (
              <button key={p.id} className={ownerFilter === p.id ? CHIP_ON : CHIP_OFF} onClick={() => setOwnerFilter(p.id)}>
                {p.full_name}
              </button>
            ))}
            <button className={ownerFilter === "all" ? CHIP_ON : CHIP_OFF} onClick={() => setOwnerFilter("all")}>Alle</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground w-14 flex-shrink-0">Signal</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button className={signalFilter === "Alle" ? CHIP_ON : CHIP_OFF} onClick={() => setSignalFilter("Alle")}>Alle</button>
            {SIGNAL_CATEGORIES_NO_IKKE.map(c => (
              <button key={c.label} className={signalFilter === c.label ? CHIP_ON : CHIP_OFF} onClick={() => setSignalFilter(c.label)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Task list */}
      {visible.length === 0 && !showForfaltEmpty ? (
        <div className="text-center py-12 text-muted-foreground">
          Ingen oppfølginger å vise
        </div>
      ) : (
        <>
          {showForfaltEmpty && (
            <p className="text-[0.9375rem] text-emerald-600 text-center py-4">
              Ingen forfalne i dag 🎉
            </p>
          )}

          {visible.length > 0 && (
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              {visible.map((task, i) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  isLast={i === visible.length - 1}
                  profiles={profiles}
                  signal={getContactSignal(task.contact_id)}
                  fadingIds={fadingIds}
                  onComplete={handleComplete}
                  onChangeOwner={handleChangeOwner}
                  onChangeSignal={handleChangeSignal}
                  onPostpone={handlePostpone}
                  navigate={navigate}
                />
              ))}
            </div>
          )}

          {hiddenCount > 0 && (
            <p className="text-center text-[0.8125rem] text-muted-foreground py-2">
              + {hiddenCount} oppfølginger til — bruk filter for å avgrense
            </p>
          )}

          {/* Week fallback */}
          {showForfaltEmpty && weekFallback.length > 0 && (
            <>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mt-4">Denne uken</p>
              <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                {weekFallback.map((task, i) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    isLast={i === weekFallback.length - 1}
                    profiles={profiles}
                    signal={getContactSignal(task.contact_id)}
                    fadingIds={fadingIds}
                    onComplete={handleComplete}
                    onChangeOwner={handleChangeOwner}
                    onChangeSignal={handleChangeSignal}
                    onPostpone={handlePostpone}
                    navigate={navigate}
                  />
                ))}
              </div>
            </>
          )}

          {showForfaltEmpty && weekFallback.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Ingen oppfølginger å vise 🎉
            </div>
          )}
        </>
      )}

      <div className="flex justify-center">
        <button onClick={() => navigate("/oppfolginger")} className="text-[0.8125rem] text-primary hover:underline">
          Vis alle oppfølginger →
        </button>
      </div>

      {/* Follow-up modal */}
      <FollowUpModal
        open={modalOpen}
        onCancel={handleModalCancel}
        onClose={handleModalSkip}
        onSubmit={handleModalSubmit}
        data={modalData ? {
          name: modalData.name,
          company: modalData.company,
          task: modalData.task,
          signal: modalData.signal,
          ownerProfileId: modalData.ownerProfileId,
        } : null}
        profiles={profiles}
      />
    </div>
  );
};

// ─── TaskRow ───────────────────────────────────────────────

interface TaskRowProps {
  task: any;
  isLast: boolean;
  profiles: Array<{ id: string; full_name: string }>;
  signal: string;
  fadingIds: Set<string>;
  onComplete: (e: React.MouseEvent, task: any) => void;
  onChangeOwner: (e: React.MouseEvent, taskId: string, profileId: string) => void;
  onChangeSignal: (e: React.MouseEvent, contactId: string, signal: string) => void;
  onPostpone: (e: React.MouseEvent, taskId: string, newDate: Date) => void;
  navigate: (path: string) => void;
}

function TaskRow({ task, isLast, profiles, signal, fadingIds, onComplete, onChangeOwner, onChangeSignal, onPostpone, navigate }: TaskRowProps) {
  const contact = task.contacts as any;
  const contactName = contact?.first_name ? `${contact.first_name} ${contact.last_name}` : null;
  const contactId = contact?.id || null;
  const companyName = contact?.companies?.name || null;
  const ownerProfile = task.profiles as any;
  const ownerName = ownerProfile?.full_name || "";

  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const now = startOfDay(new Date());
  const dueDiff = dueDate ? differenceInDays(dueDate, now) : null;

  const isOverdue = dueDate ? (isPast(dueDate) && !isToday(dueDate)) : false;
  const isTodayDue = dueDate ? isToday(dueDate) : false;

  const dateColor = isTodayDue ? "text-primary" : isOverdue ? "text-destructive" : "text-muted-foreground";

  const relativeText = dueDate
    ? (isTodayDue ? "I dag" : isOverdue ? `Forfalt ${Math.abs(dueDiff!)} dager` : `Om ${dueDiff} dager`)
    : null;

  const absoluteText = dueDate ? format(dueDate, "dd.MM.yyyy") : null;

  const signalCat = CATEGORIES.find(c => c.label === signal);

  const desc = task.description && !/^\[.+\]$/.test(task.description.trim())
    ? task.description.replace(/^\[[^\]]+\]\n?/, "").trim()
    : null;

  const isFading = fadingIds.has(task.id);

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-all duration-300",
        !isLast && "border-b border-border",
        isOverdue && "border-l-[3px] border-l-destructive",
        !isOverdue && "border-l-[3px] border-l-transparent",
        isFading && "opacity-0 scale-95"
      )}
      onClick={() => contactId && navigate(`/kontakter/${contactId}`)}
    >
      {/* Checkbox */}
      <button
        className="h-[16px] w-[16px] rounded border border-border flex-shrink-0 flex items-center justify-center hover:border-primary hover:bg-primary/5 transition-colors mt-1"
        onClick={(e) => onComplete(e, task)}
      >
        <Check className={cn("h-3 w-3", isFading ? "text-primary" : "text-transparent")} />
      </button>

      {/* Middle content */}
      <div className="flex-1 min-w-0">
        {/* Line 1: Name · Company */}
        <div className="flex items-center gap-2 flex-wrap">
          {contactName ? (
            <button
              className="text-[0.9375rem] font-semibold text-foreground hover:text-primary hover:underline"
              onClick={(e) => { e.stopPropagation(); navigate(`/kontakter/${contactId}`); }}
            >
              {contactName}
            </button>
          ) : (
            <span className="text-[0.9375rem] font-semibold text-muted-foreground italic">Ukjent kontakt</span>
          )}
          {companyName && (
            <span className="text-[0.8125rem] text-muted-foreground">· {companyName}</span>
          )}
        </div>

        {/* Line 2: Task title */}
        <p className="text-[0.875rem] text-foreground mt-0.5">{task.title}</p>

        {/* Line 3: Owner pill */}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[0.75rem] font-medium hover:bg-primary/20 transition-colors">
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

        {/* Line 4: Description */}
        {desc && (
          <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{desc}</p>
        )}
      </div>

      {/* Right column */}
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        {/* Date — clickable PostponeDate */}
        {dueDate && (
          <PostponeDate
            taskId={task.id}
            dueDate={dueDate}
            dateColor={dateColor}
            relativeText={relativeText}
            absoluteText={absoluteText}
            onPostpone={onPostpone}
          />
        )}

        {/* Signal badge */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            {signal ? (
              <button className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold hover:opacity-80 transition-opacity mt-0.5", signalCat?.badgeColor)}>
                {signal}
                <ChevronDown className="h-3 w-3" />
              </button>
            ) : (
              <button className="text-[0.75rem] text-muted-foreground/50 hover:text-muted-foreground transition-colors mt-0.5">
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
      </div>
    </div>
  );
}

// ─── PostponeDate ──────────────────────────────────────────

function PostponeDate({ taskId, dueDate, dateColor, relativeText, absoluteText, onPostpone }: {
  taskId: string;
  dueDate: Date;
  dateColor: string;
  relativeText: string | null;
  absoluteText: string | null;
  onPostpone: (e: React.MouseEvent, taskId: string, newDate: Date) => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const w1 = addWeeks(dueDate, 1);
  const w2 = addWeeks(dueDate, 2);
  const m1 = addMonths(dueDate, 1);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button className="flex items-center gap-1.5 cursor-pointer hover:opacity-70 transition-opacity">
          <span className={cn("text-[0.8125rem] font-medium", dateColor)}>
            {relativeText}
          </span>
          <span className={cn("text-[0.8125rem] font-medium", dateColor)}>
            · {absoluteText}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground px-2 py-1.5">
          Utsett til
        </DropdownMenuLabel>
        <DropdownMenuItem className="cursor-pointer flex items-center" onClick={(e) => onPostpone(e as any, taskId, w1)}>
          <span className="text-foreground">+ 1 uke</span>
          <span className="text-muted-foreground text-xs ml-auto">{format(w1, "dd.MM.yyyy")}</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer flex items-center" onClick={(e) => onPostpone(e as any, taskId, w2)}>
          <span className="text-foreground">+ 2 uker</span>
          <span className="text-muted-foreground text-xs ml-auto">{format(w2, "dd.MM.yyyy")}</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer flex items-center" onClick={(e) => onPostpone(e as any, taskId, m1)}>
          <span className="text-foreground">+ 1 måned</span>
          <span className="text-muted-foreground text-xs ml-auto">{format(m1, "dd.MM.yyyy")}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="p-0">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button
                className="w-full text-left px-2 py-1.5 text-[0.8125rem] hover:bg-secondary rounded-sm flex items-center gap-2"
                onClick={(e) => { e.stopPropagation(); setCalendarOpen(true); }}
              >
                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                Velg dato
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end" side="left">
              <Calendar
                mode="single"
                selected={dueDate}
                onSelect={(d) => {
                  if (d) {
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
