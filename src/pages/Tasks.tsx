import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Search, CalendarDays, Phone, Mail, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { format, isPast, isToday, endOfDay, endOfWeek } from "date-fns";
import { nb } from "date-fns/locale";
import { ContactCardContent } from "@/components/ContactCardContent";
import { fullDate } from "@/lib/relativeDate";

const Tasks = () => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", due_date: "", contact_id: "" });
  const [contactSheetId, setContactSheetId] = useState<string | null>(null);
  const [pendingComplete, setPendingComplete] = useState<Set<string>>(new Set());
  const [showLater, setShowLater] = useState(false);
  const pendingTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, contacts(id, first_name, last_name, phone, email, title, company_id, companies(id, name))")
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: doneTasks = [] } = useQuery({
    queryKey: ["tasks-done"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, contacts(id, first_name, last_name, company_id, companies(name))")
        .eq("status", "done")
        .order("completed_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("id, first_name, last_name, company_id, companies(name)").order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const selectedContact = contacts.find(c => c.id === form.contact_id);
      const { error } = await supabase.from("tasks").insert({
        title: form.title, description: form.description || null, priority: form.priority,
        due_date: form.due_date || null, contact_id: form.contact_id || null,
        company_id: selectedContact?.company_id || null, assigned_to: user?.id, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setOpen(false);
      setForm({ title: "", description: "", priority: "medium", due_date: "", contact_id: "" });
      toast.success("Oppfølging opprettet");
    },
    onError: () => toast.error("Kunne ikke opprette oppfølging"),
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").update({
        status: "done", completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks-done"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-focused-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
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
      toggleMutation.mutate(taskId);
    }, 4000);
    pendingTimers.current.set(taskId, timer);
  };

  const getContactName = (task: any) => {
    const c = task.contacts as any;
    return c?.first_name ? `${c.first_name} ${c.last_name}` : null;
  };
  const getContactId = (task: any) => (task.contacts as any)?.id || null;
  const getCompanyName = (task: any) => (task.contacts as any)?.companies?.name || null;

  const filterTasks = (list: any[]) =>
    list.filter(t => {
      if (pendingComplete.has(t.id)) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return t.title.toLowerCase().includes(q) || getContactName(t)?.toLowerCase().includes(q) || getCompanyName(t)?.toLowerCase().includes(q);
    });

  const filtered = filterTasks(tasks);
  const endTodayDate = endOfDay(new Date());
  const endWeekDate = endOfWeek(new Date(), { weekStartsOn: 1 });

  const overdue = filtered.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
  const today = filtered.filter(t => t.due_date && isToday(new Date(t.due_date)));
  const thisWeek = filtered.filter(t => {
    if (!t.due_date) return false;
    const d = new Date(t.due_date);
    return d > endTodayDate && d <= endWeekDate;
  });
  const later = filtered.filter(t => {
    if (!t.due_date) return true; // no date = later
    const d = new Date(t.due_date);
    return d > endWeekDate;
  });

  const TaskRow = ({ task }: { task: any }) => {
    const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
    const isDueToday = task.due_date && isToday(new Date(task.due_date));
    const contactName = getContactName(task);
    const contactId = getContactId(task);
    const companyName = getCompanyName(task);

    return (
      <div className="flex items-center gap-3 min-h-[48px] py-2 px-1 group hover:bg-card transition-colors duration-75 rounded-md">
        <Checkbox
          checked={false}
          onCheckedChange={() => handleComplete(task.id, task.title)}
          className="h-4 w-4 rounded-[4px] border-2 border-muted-foreground/40 flex-shrink-0"
        />
        <button className="flex-1 min-w-0 text-left" onClick={() => contactId && setContactSheetId(contactId)}>
          <p className="text-[0.8125rem] font-medium text-foreground truncate">{task.title}</p>
          {task.description && <p className="text-[0.75rem] text-muted-foreground/60 truncate">{task.description}</p>}
        </button>
        <span className="text-[0.75rem] text-muted-foreground truncate max-w-[180px] hidden sm:block">
          {contactName}{companyName && ` · ${companyName}`}
        </span>
        {task.due_date && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`text-[0.75rem] font-medium px-2 py-0.5 rounded-md flex-shrink-0 ${
                isOverdue ? "bg-destructive/10 text-destructive" : isDueToday ? "bg-warning/10 text-warning" : "bg-secondary text-muted-foreground"
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

  const SectionHeader = ({ label, count, color }: { label: string; count: number; color: string }) => (
    <div className="flex items-center gap-2 mb-1 mt-3 first:mt-0">
      <span className={`text-[0.6875rem] font-semibold uppercase tracking-wider ${color}`}>{label} · {count}</span>
      <div className={`flex-1 h-px ${color === "text-destructive" ? "bg-destructive/20" : color === "text-warning" ? "bg-warning/20" : "bg-border"}`} />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[1.375rem] font-bold">Oppfølginger</h1>
          <p className="text-[0.8125rem] text-muted-foreground">{filtered.length} åpne</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-lg h-9 px-3.5 text-[0.8125rem] font-medium gap-1.5">
              <Plus className="h-4 w-4" />Ny oppfølging
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[440px] rounded-xl">
            <DialogHeader><DialogTitle>Ny oppfølging</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4 mt-3">
              <div className="space-y-1.5">
                <Label className="text-label">Tittel</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="h-10 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-label">Beskrivelse</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="rounded-lg min-h-[60px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-label">Kontaktperson</Label>
                <Select value={form.contact_id} onValueChange={(v) => setForm({ ...form, contact_id: v })}>
                  <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Velg kontaktperson" /></SelectTrigger>
                  <SelectContent>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.first_name} {c.last_name}{(c.companies as any)?.name && ` · ${(c.companies as any).name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-label">Frist</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="h-10 rounded-lg" />
              </div>
              <Button type="submit" className="w-full h-10 rounded-lg" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Oppretter..." : "Opprett"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
        <Input placeholder="Søk..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 rounded-lg text-[0.8125rem] bg-card border-border" />
      </div>

      {isLoading ? (
        <div className="space-y-px">{[1,2,3,4].map(i => <div key={i} className="h-[48px] bg-secondary/50 animate-pulse rounded" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Ingen oppfølginger</p>
      ) : (
        <div className="space-y-1">
          {overdue.length > 0 && (
            <>
              <SectionHeader label="Forfalt" count={overdue.length} color="text-destructive" />
              {overdue.map(t => <TaskRow key={t.id} task={t} />)}
            </>
          )}
          {today.length > 0 && (
            <>
              <SectionHeader label="I dag" count={today.length} color="text-warning" />
              {today.map(t => <TaskRow key={t.id} task={t} />)}
            </>
          )}
          {thisWeek.length > 0 && (
            <>
              <SectionHeader label="Denne uken" count={thisWeek.length} color="text-muted-foreground" />
              {thisWeek.map(t => <TaskRow key={t.id} task={t} />)}
            </>
          )}
          {later.length > 0 && (
            <>
              <SectionHeader label="Senere" count={later.length} color="text-muted-foreground" />
              {showLater ? (
                later.map(t => <TaskRow key={t.id} task={t} />)
              ) : (
                <button onClick={() => setShowLater(true)} className="flex items-center gap-1 text-[0.8125rem] text-primary hover:underline py-2">
                  <ChevronDown className="h-3.5 w-3.5" />
                  Vis {later.length} kommende oppfølginger
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Contact Sheet */}
      <Sheet open={!!contactSheetId} onOpenChange={(open) => !open && setContactSheetId(null)}>
        <SheetContent className="sm:max-w-[400px] overflow-y-auto p-5">
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

export default Tasks;
