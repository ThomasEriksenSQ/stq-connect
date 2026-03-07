import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isPast, isToday, startOfDay, addDays, format } from "date-fns";
import { nb } from "date-fns/locale";
import { CATEGORIES } from "@/lib/categoryUtils";
import { getEffectiveSignal } from "@/lib/categoryUtils";

const CHIP_BASE = "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors cursor-pointer";
const CHIP_OFF = `${CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;
const CHIP_ON = `${CHIP_BASE} bg-foreground text-background border-foreground font-medium`;

type NaarFilter = "Forfalt" | "I dag" | "Denne uken" | "Alle";
type SignalFilter = "Alle" | string;

const OppfolgingerSection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [naarFilter, setNaarFilter] = useState<NaarFilter>("Forfalt");
  const [ownerFilter, setOwnerFilter] = useState<string>("mine");
  const [signalFilter, setSignalFilter] = useState<SignalFilter>("Alle");

  // Fetch tasks with contacts, companies, profiles
  const { data: tasks = [] } = useQuery({
    queryKey: ["dashboard-oppfolginger-v2"],
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

  // Fetch profiles for owner filter
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch activities + tasks for signal calculation per contact
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

  const getContactSignal = (contactId: string | null): string => {
    if (!contactId || !signalData) return "";
    const acts = signalData.acts.filter((a: any) => a.contact_id === contactId);
    const tks = signalData.tasks.filter((t: any) => t.contact_id === contactId);
    return getEffectiveSignal(acts as any, tks.map((t: any) => ({ ...t, title: t.title || "" })) as any);
  };

  const today = startOfDay(new Date());
  const endOfWeek = addDays(today, 7);

  // Apply owner filter
  let filtered = tasks;
  if (ownerFilter === "mine") {
    filtered = filtered.filter(t => t.assigned_to === user?.id || t.created_by === user?.id);
  } else if (ownerFilter !== "all") {
    filtered = filtered.filter(t => t.assigned_to === ownerFilter || t.created_by === ownerFilter);
  }

  // Apply signal filter
  if (signalFilter !== "Alle") {
    filtered = filtered.filter(t => getContactSignal(t.contact_id) === signalFilter);
  }

  // Split into groups
  const overdue = filtered.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
  const todayTasks = filtered.filter(t => t.due_date && isToday(new Date(t.due_date)));
  const weekTasks = filtered.filter(t => {
    if (!t.due_date) return false;
    const d = new Date(t.due_date);
    return d > today && d <= endOfWeek && !isToday(d);
  });
  const allOpen = filtered;

  // Determine which to display based on NÅR filter
  let leftTasks = overdue;
  let rightTodayTasks = todayTasks;
  let rightWeekTasks = weekTasks;

  if (naarFilter === "I dag") {
    leftTasks = [];
    rightWeekTasks = [];
  } else if (naarFilter === "Denne uken") {
    leftTasks = [];
  } else if (naarFilter === "Alle") {
    // show all in left+right naturally
  }

  const totalCount = allOpen.length;

  const getOwnerName = (task: any) => {
    const p = task.profiles as any;
    return p?.full_name || "";
  };

  const getContactName = (task: any) => {
    const c = task.contacts as any;
    return c?.first_name ? `${c.first_name} ${c.last_name}` : null;
  };

  const getContactId = (task: any) => (task.contacts as any)?.id || null;

  const TaskCard = ({ task, showRedBorder }: { task: any; showRedBorder?: boolean }) => {
    const contactName = getContactName(task);
    const contactId = getContactId(task);
    const ownerName = getOwnerName(task);
    const daysSince = task.due_date
      ? Math.floor((Date.now() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return (
      <div
        className={`bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.07)] p-3.5 cursor-pointer hover:bg-secondary/30 transition-colors overflow-hidden flex`}
        onClick={() => contactId && navigate(`/kontakter/${contactId}`)}
      >
        {showRedBorder && <div className="w-[3px] bg-destructive rounded-full flex-shrink-0 -ml-3.5 mr-3" />}
        <div className="flex-1 min-w-0">
          <p className="text-[0.875rem] font-bold text-foreground truncate">{task.title}</p>
          {contactName && (
            <p className="text-[0.8125rem] text-muted-foreground truncate mt-0.5">{contactName}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {showRedBorder && daysSince !== null && daysSince > 0 && (
              <span className="text-[0.75rem] font-medium text-destructive">{daysSince} dager siden</span>
            )}
            {!showRedBorder && task.due_date && (
              <span className="text-[0.75rem] text-muted-foreground">
                {format(new Date(task.due_date), "d. MMM yyyy", { locale: nb })}
              </span>
            )}
            {ownerName && (
              <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[0.6875rem] font-medium ml-auto">
                {ownerName}
              </span>
            )}
          </div>
        </div>
      </div>
    );
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
        {/* NÅR */}
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground w-14 flex-shrink-0">Når</span>
          <div className="flex items-center gap-1.5">
            {(["Forfalt", "I dag", "Denne uken", "Alle"] as NaarFilter[]).map(f => (
              <button key={f} className={naarFilter === f ? CHIP_ON : CHIP_OFF} onClick={() => setNaarFilter(f)}>{f}</button>
            ))}
          </div>
        </div>

        {/* EIER */}
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

        {/* SIGNAL */}
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

      {/* Two columns */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left: Forfalt */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-destructive">Forfalt</span>
            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-destructive/10 text-destructive text-[0.6875rem] font-semibold">
              {naarFilter === "I dag" || naarFilter === "Denne uken" ? 0 : overdue.length}
            </span>
          </div>
          {(naarFilter === "I dag" || naarFilter === "Denne uken") ? (
            <p className="text-[0.8125rem] text-muted-foreground text-center py-8">Filtrert bort</p>
          ) : overdue.length === 0 ? (
            <p className="text-[0.8125rem] text-muted-foreground text-center py-8">Ingen forfalte oppfølginger 🎉</p>
          ) : (
            <div className="space-y-2">
              {overdue.map(t => <TaskCard key={t.id} task={t} showRedBorder />)}
            </div>
          )}
        </div>

        {/* Right: I dag & Denne uken */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-primary">I dag & Denne uken</span>
            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary/10 text-primary text-[0.6875rem] font-semibold">
              {(naarFilter === "Forfalt" || naarFilter === "Alle" || naarFilter === "I dag" ? todayTasks.length : 0) +
                (naarFilter === "Forfalt" || naarFilter === "Alle" || naarFilter === "Denne uken" ? weekTasks.length : 0)}
            </span>
          </div>

          {/* Today group */}
          {(naarFilter !== "Denne uken") && todayTasks.length > 0 && (
            <div className="space-y-2">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">I dag</span>
              {todayTasks.map(t => <TaskCard key={t.id} task={t} />)}
            </div>
          )}

          {/* This week group */}
          {(naarFilter !== "I dag") && weekTasks.length > 0 && (
            <div className="space-y-2">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">Denne uken</span>
              {weekTasks.map(t => <TaskCard key={t.id} task={t} />)}
            </div>
          )}

          {todayTasks.length === 0 && weekTasks.length === 0 && (
            <p className="text-[0.8125rem] text-muted-foreground text-center py-8">Ingen planlagte oppfølginger denne uken</p>
          )}
        </div>
      </div>

      <div className="flex justify-center">
        <button onClick={() => navigate("/oppfolginger")} className="text-[0.8125rem] text-primary hover:underline">
          Vis alle oppfølginger →
        </button>
      </div>
    </div>
  );
};

export default OppfolgingerSection;
