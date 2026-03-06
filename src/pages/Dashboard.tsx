import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ContactCardContent } from "@/components/ContactCardContent";
import { FileText, Phone, Calendar, Mail, Plus } from "lucide-react";
import { format, isPast, isToday, startOfDay, endOfDay, endOfWeek } from "date-fns";
import { nb } from "date-fns/locale";
import { relativeTimeShort, fullDate } from "@/lib/relativeDate";
import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const typeIcons: Record<string, { icon: typeof FileText; color: string }> = {
  call: { icon: Phone, color: "text-success" },
  meeting: { icon: Calendar, color: "text-primary" },
  email: { icon: Mail, color: "text-warning" },
  task: { icon: FileText, color: "text-muted-foreground" },
  note: { icon: FileText, color: "text-muted-foreground" },
};

const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [contactSheetId, setContactSheetId] = useState<string | null>(null);
  const [pendingComplete, setPendingComplete] = useState<Set<string>>(new Set());
  const pendingTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

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

  const { data: allTasks = [] } = useQuery({
    queryKey: ["dashboard-focused-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, contacts(id, first_name, last_name, company_id, companies(name))")
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: recentActivities = [] } = useQuery({
    queryKey: ["dashboard-activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*, contacts(id, first_name, last_name)")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data;
    },
  });

  const { data: dormantContacts = [] } = useQuery({
    queryKey: ["dashboard-dormant"],
    queryFn: async () => {
      // Get all contacts with their latest activity date
      const { data: contacts, error: cErr } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, companies(name)")
        .order("first_name");
      if (cErr) throw cErr;
      if (!contacts || contacts.length === 0) return [];

      const contactIds = contacts.map(c => c.id);
      const { data: acts } = await supabase
        .from("activities")
        .select("contact_id, created_at")
        .in("contact_id", contactIds)
        .order("created_at", { ascending: false });

      const lastActMap: Record<string, string> = {};
      (acts || []).forEach(a => {
        if (a.contact_id && !lastActMap[a.contact_id]) lastActMap[a.contact_id] = a.created_at;
      });

      const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
      const dormant = contacts
        .map(c => ({
          ...c,
          lastActivity: lastActMap[c.id] || null,
          daysSince: lastActMap[c.id]
            ? Math.floor((Date.now() - new Date(lastActMap[c.id]).getTime()) / (1000 * 60 * 60 * 24))
            : null,
        }))
        .filter(c => {
          if (!c.lastActivity) return true; // never contacted
          return new Date(c.lastActivity).getTime() < cutoff;
        })
        .sort((a, b) => {
          if (!a.lastActivity) return -1;
          if (!b.lastActivity) return 1;
          return new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime();
        })
        .slice(0, 5);

      return dormant;
    },
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("tasks").update({
        status: "done", completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-focused-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const handleComplete = (taskId: string, title: string) => {
    setPendingComplete((prev) => new Set(prev).add(taskId));
    toast("Oppfølging fullført", {
      description: title,
      action: {
        label: "Angre",
        onClick: () => {
          const timer = pendingTimers.current.get(taskId);
          if (timer) clearTimeout(timer);
          pendingTimers.current.delete(taskId);
          setPendingComplete((prev) => { const s = new Set(prev); s.delete(taskId); return s; });
        },
      },
      duration: 4000,
    });
    const timer = setTimeout(() => {
      pendingTimers.current.delete(taskId);
      setPendingComplete((prev) => { const s = new Set(prev); s.delete(taskId); return s; });
      toggleTaskMutation.mutate(taskId);
    }, 4000);
    pendingTimers.current.set(taskId, timer);
  };

  // Group tasks
  const endToday = endOfDay(new Date());
  const endWeek = endOfWeek(new Date(), { weekStartsOn: 1 });

  const visibleTasks = allTasks.filter(t => !pendingComplete.has(t.id));

  const overdueTasks = visibleTasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
  const todayTasks = visibleTasks.filter(t => t.due_date && isToday(new Date(t.due_date)));
  const weekTasks = visibleTasks.filter(t => {
    if (!t.due_date) return false;
    const d = new Date(t.due_date);
    return d > endToday && d <= endWeek;
  });

  const overdueCount = overdueTasks.length;

  const getContactName = (task: any) => {
    const c = task.contacts as any;
    return c?.first_name ? `${c.first_name} ${c.last_name}` : null;
  };
  const getContactId = (task: any) => (task.contacts as any)?.id || null;
  const getCompanyName = (task: any) => (task.contacts as any)?.companies?.name || null;

  const TaskRow = ({ task }: { task: any }) => {
    const overdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
    const dueToday = task.due_date && isToday(new Date(task.due_date));
    const contactName = getContactName(task);
    const contactId = getContactId(task);
    const companyName = getCompanyName(task);

    return (
      <div className="flex items-center gap-3 h-[44px] px-0 group hover:bg-card transition-colors duration-75 rounded-md cursor-pointer"
           onClick={() => contactId && setContactSheetId(contactId)}>
        <Checkbox
          checked={false}
          onCheckedChange={(e) => { e && handleComplete(task.id, task.title); }}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded-[4px] border-2 border-muted-foreground/40 data-[state=checked]:border-primary flex-shrink-0"
        />
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-[0.8125rem] font-medium text-foreground truncate">
            {contactName && <>{contactName} <span className="text-muted-foreground font-normal">·</span> </>}
            <span className="font-normal text-foreground">{task.title}</span>
          </span>
        </div>
        <span className="text-[0.75rem] text-muted-foreground truncate max-w-[140px] hidden sm:block">
          {companyName}
        </span>
        {task.due_date && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`text-[0.75rem] font-medium px-2 py-0.5 rounded-md flex-shrink-0 ${
                overdue ? "bg-destructive/10 text-destructive" : dueToday ? "bg-warning/10 text-warning" : "bg-secondary text-muted-foreground"
              }`}>
                {format(new Date(task.due_date), "d. MMM", { locale: nb })}
              </span>
            </TooltipTrigger>
            <TooltipContent>{fullDate(task.due_date)}</TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left: Oppfølginger i fokus (60%) */}
        <div className="lg:col-span-3 space-y-5">
          <div className="flex items-center gap-2">
            <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">I dag</h2>
            {overdueCount > 0 && (
              <span className="text-[0.625rem] font-semibold bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-[4px]">
                {overdueCount} forfalt
              </span>
            )}
          </div>

          {overdueTasks.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-destructive">Forfalt</span>
                <div className="flex-1 h-px bg-destructive/20" />
              </div>
              {overdueTasks.map(t => <TaskRow key={t.id} task={t} />)}
            </div>
          )}

          {todayTasks.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-warning">I dag</span>
                <div className="flex-1 h-px bg-warning/20" />
              </div>
              {todayTasks.map(t => <TaskRow key={t.id} task={t} />)}
            </div>
          )}

          {weekTasks.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">Denne uken</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              {weekTasks.slice(0, 5).map(t => <TaskRow key={t.id} task={t} />)}
              {weekTasks.length > 5 && (
                <button onClick={() => navigate("/oppfolginger")} className="text-[0.75rem] text-primary hover:underline mt-1">
                  + {weekTasks.length - 5} til
                </button>
              )}
            </div>
          )}

          {overdueTasks.length === 0 && todayTasks.length === 0 && weekTasks.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">Ingen oppfølginger denne uken</p>
          )}

          <button onClick={() => navigate("/oppfolginger")} className="text-[0.75rem] text-primary hover:underline">
            + Ny oppfølging
          </button>
        </div>

        {/* Right: Puls + Fokus (40%) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats */}
          <div className="flex items-baseline gap-8">
            <button onClick={() => navigate("/selskaper")} className="group">
              <p className="text-2xl font-bold text-foreground">{stats?.companies ?? "–"}</p>
              <p className="text-[0.75rem] text-muted-foreground group-hover:text-foreground transition-colors">Selskaper</p>
            </button>
            <button onClick={() => navigate("/kontakter")} className="group">
              <p className="text-2xl font-bold text-foreground">{stats?.contacts ?? "–"}</p>
              <p className="text-[0.75rem] text-muted-foreground group-hover:text-foreground transition-colors">Kontakter</p>
            </button>
            <button onClick={() => navigate("/oppfolginger")} className="group">
              <p className="text-2xl font-bold text-foreground">{stats?.openTasks ?? "–"}</p>
              <p className="text-[0.75rem] text-muted-foreground group-hover:text-foreground transition-colors">Åpne oppfølginger</p>
            </button>
          </div>

          <div className="h-px bg-border" />

          {/* Recent activities */}
          <div className="space-y-0">
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">Siste aktiviteter</h3>
            {recentActivities.map((a) => {
              const iconCfg = typeIcons[a.type] || typeIcons.note;
              const Icon = iconCfg.icon;
              const contactName = (a.contacts as any)?.first_name
                ? `${(a.contacts as any).first_name} ${(a.contacts as any).last_name}` : null;
              const contactId = (a.contacts as any)?.id;
              const subjectTrunc = a.subject?.length > 35 ? a.subject.slice(0, 35) + "…" : a.subject;
              return (
                <button
                  key={a.id}
                  className="w-full flex items-center gap-2.5 py-2 hover:bg-card transition-colors duration-75 rounded-md text-left"
                  onClick={() => contactId && setContactSheetId(contactId)}
                >
                  <Icon className={`h-4 w-4 stroke-[1.5] flex-shrink-0 ${iconCfg.color}`} />
                  <span className="text-[0.8125rem] font-medium text-foreground truncate">
                    {contactName}
                  </span>
                  <span className="text-[0.75rem] text-muted-foreground/60 truncate flex-1 min-w-0">{subjectTrunc}</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-[0.6875rem] text-muted-foreground/40 flex-shrink-0 ml-1">
                        {relativeTimeShort(a.created_at)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{fullDate(a.created_at)}</TooltipContent>
                  </Tooltip>
                </button>
              );
            })}
          </div>

          <div className="h-px bg-border" />

          {/* Dormant contacts */}
          <div className="space-y-0">
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">Ikke kontaktet på 60+ dager</h3>
            {dormantContacts.length === 0 && (
              <p className="text-[0.8125rem] text-muted-foreground py-2">Alle kontakter er oppdatert</p>
            )}
            {dormantContacts.map((c: any) => (
              <button
                key={c.id}
                className="w-full flex items-center gap-2.5 py-2 hover:bg-card transition-colors duration-75 rounded-md text-left"
                onClick={() => setContactSheetId(c.id)}
              >
                <span className="text-[0.8125rem] font-medium text-foreground truncate flex-1">
                  {c.first_name} {c.last_name}
                </span>
                <span className="text-[0.75rem] text-muted-foreground/60 truncate max-w-[120px]">
                  {(c.companies as any)?.name}
                </span>
                <span className="text-[0.6875rem] text-destructive flex-shrink-0">
                  {c.daysSince !== null ? `${c.daysSince}d siden` : "Aldri kontaktet"}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contact Sheet */}
      <Sheet open={!!contactSheetId} onOpenChange={(open) => !open && setContactSheetId(null)}>
        <SheetContent className="sm:max-w-[640px] overflow-y-auto p-6">
          {contactSheetId && (
            <ContactCardContent
              contactId={contactSheetId}
              onNavigateToFullPage={() => { setContactSheetId(null); navigate(`/kontakter/${contactSheetId}`); }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Dashboard;
