import { useState, useRef, useMemo, useEffect } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Search, ChevronDown, X, Phone, Mail, ExternalLink } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/useAuth";
import { format, isPast, isToday, endOfDay, endOfWeek } from "date-fns";
import { nb } from "date-fns/locale";
import { fullDate, relativeDate } from "@/lib/relativeDate";
import { cn } from "@/lib/utils";

const typeConfig: Record<string, { label: string; icon: typeof Phone; accent: string }> = {
  call: { label: "Samtale", icon: Phone, accent: "text-success" },
  meeting: { label: "Møte", icon: Mail, accent: "text-primary" },
  email: { label: "E-post", icon: Mail, accent: "text-warning" },
  task: { label: "Oppgave", icon: Phone, accent: "text-muted-foreground" },
  note: { label: "Notat", icon: Phone, accent: "text-muted-foreground" },
};

const Tasks = () => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const ownerFilterTouched = useRef(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", due_date: "", contact_id: "", company_id: "", email_notify: false });
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [pendingComplete, setPendingComplete] = useState<Set<string>>(new Set());
  const [showLater, setShowLater] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const pendingTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, contacts(id, first_name, last_name, phone, email, title, company_id, companies(id, name), call_list, cv_email)")
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, company_id, companies(id, name)")
        .neq("status", "deleted")
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-simple"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name").neq("status", "deleted").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data;
    },
  });

  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p.full_name]));
  const profileFirstName = Object.fromEntries(profiles.map(p => [p.id, p.full_name.split(" ")[0]]));

  // Default Eier-filter til innlogget bruker når profilene er lastet
  useEffect(() => {
    if (ownerFilterTouched.current) return;
    if (!user?.id) return;
    if (!profiles.some(p => p.id === user.id)) return;
    setOwnerFilter(user.id);
    ownerFilterTouched.current = true;
  }, [user?.id, profiles]);

  // Get activities for selected contact panel
  const { data: contactActivities = [] } = useQuery({
    queryKey: ["task-contact-activities", selectedContactId],
    queryFn: async () => {
      if (!selectedContactId) return [];
      const { data, error } = await supabase
        .from("activities").select("*")
        .eq("contact_id", selectedContactId)
        .order("created_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedContactId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const selectedContact = contacts.find(c => c.id === form.contact_id);
      const companyId = form.company_id || selectedContact?.company_id || null;
      const { error } = await supabase.from("tasks").insert({
        title: form.title, description: form.description || null, priority: form.priority,
        due_date: form.due_date || null, contact_id: form.contact_id || null,
        company_id: companyId, assigned_to: user?.id, created_by: user?.id,
        email_notify: form.email_notify,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setOpen(false);
      setForm({ title: "", description: "", priority: "medium", due_date: "", contact_id: "", company_id: "", email_notify: false });
      setContactSearch("");
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
      duration: 2000,
      action: {
        label: "Angre",
        onClick: () => {
          const timer = pendingTimers.current.get(taskId);
          if (timer) clearTimeout(timer);
          pendingTimers.current.delete(taskId);
          setPendingComplete((prev) => { const s = new Set(prev); s.delete(taskId); return s; });
        },
      },
    });
    const timer = setTimeout(() => {
      pendingTimers.current.delete(taskId);
      setPendingComplete((prev) => { const s = new Set(prev); s.delete(taskId); return s; });
      toggleMutation.mutate(taskId);
    }, 2500);
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
      if (ownerFilter !== "all" && t.assigned_to !== ownerFilter) return false;
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
    if (!t.due_date) return true;
    const d = new Date(t.due_date);
    return d > endWeekDate;
  });

  // Unique owners from tasks
  const ownerOptions = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach(t => {
      if (t.assigned_to && profileFirstName[t.assigned_to]) {
        map.set(t.assigned_to, profileFirstName[t.assigned_to]);
      }
    });
    return Array.from(map.entries());
  }, [tasks, profileFirstName]);

  // Selected contact data for right panel
  const selectedTask = tasks.find(t => getContactId(t) === selectedContactId);
  const selectedContact = selectedTask?.contacts as any;

  const handleContactSelect = (contactId: string) => {
    const c = contacts.find(x => x.id === contactId);
    if (c) {
      setForm({
        ...form,
        contact_id: contactId,
        company_id: c.company_id || form.company_id,
      });
      setContactSearch(`${c.first_name} ${c.last_name}`);
    }
  };

  const filteredContacts = contacts.filter(c => {
    if (!contactSearch) return true;
    const q = contactSearch.toLowerCase();
    return `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      (c.companies as any)?.name?.toLowerCase().includes(q);
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast("Kopiert!", { duration: 1500 });
  };

  const TaskRow = ({ task }: { task: any }) => {
    const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
    const isDueToday = task.due_date && isToday(new Date(task.due_date));
    const contactName = getContactName(task);
    const contactId = getContactId(task);
    const companyName = getCompanyName(task);
    const isPending = pendingComplete.has(task.id);

    return (
      <div
        className={cn(
          "flex items-center gap-3 min-h-[48px] py-2 px-1 group hover:bg-card transition-all duration-150 rounded-md cursor-pointer",
          isPending && "opacity-30 line-through"
        )}
        onClick={() => contactId && setSelectedContactId(contactId)}
      >
        <Checkbox
          checked={false}
          onCheckedChange={() => handleComplete(task.id, task.title)}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded-[4px] border-2 border-muted-foreground/40 flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className={cn("text-[0.8125rem] font-medium text-foreground truncate", isPending && "line-through")}>{task.title}</p>
          {task.description && <p className="text-[0.75rem] text-muted-foreground/60 truncate">{task.description}</p>}
        </div>
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
      <span className={`text-[0.6875rem] font-semibold uppercase tracking-[0.08em] ${color}`}>{label} · {count}</span>
      <div className={`flex-1 h-px ${color === "text-destructive" ? "bg-destructive/20" : color === "text-warning" ? "bg-warning/20" : "bg-border"}`} />
    </div>
  );

  return (
    <div className="flex gap-0">
      {/* Main content */}
      <div className={cn("flex-1 space-y-4 transition-all", selectedContactId && "pr-4")}>
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
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required autoFocus className="h-10 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-label">Kontaktperson</Label>
                  <div className="relative">
                    <Input
                      value={contactSearch}
                      onChange={(e) => {
                        setContactSearch(e.target.value);
                        if (!e.target.value) setForm({ ...form, contact_id: "", company_id: "" });
                      }}
                      placeholder="Søk etter kontakt..."
                      className="h-10 rounded-lg"
                    />
                    {contactSearch && !form.contact_id && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-card max-h-[200px] overflow-y-auto">
                        {filteredContacts.slice(0, 10).map(c => (
                          <button key={c.id} type="button"
                            onClick={() => handleContactSelect(c.id)}
                            className="w-full text-left px-3 py-2 text-[0.8125rem] hover:bg-secondary/50 transition-colors">
                            {c.first_name} {c.last_name}
                            {(c.companies as any)?.name && <span className="text-muted-foreground"> · {(c.companies as any).name}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-label">Selskap</Label>
                  <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                    <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Velg selskap" /></SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-label">Frist</Label>
                  <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full h-10 rounded-lg justify-start text-left font-normal", !form.due_date && "text-muted-foreground")}>
                        {form.due_date ? format(new Date(form.due_date), "d. MMMM yyyy", { locale: nb }) : "Velg dato"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={form.due_date ? new Date(form.due_date) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            setForm({ ...form, due_date: format(date, "yyyy-MM-dd") });
                            setDueDateOpen(false);
                          }
                        }}
                        locale={nb}
                        className={cn("p-3 pointer-events-auto")}
                      />
                      <div className="px-3 pb-3">
                        <Button type="button" variant="ghost" size="sm" className="w-full text-[0.8125rem]"
                          onClick={() => {
                            setForm({ ...form, due_date: format(new Date(), "yyyy-MM-dd") });
                            setDueDateOpen(false);
                          }}>
                          I dag
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-label">Beskrivelse</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="rounded-lg min-h-[60px]" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    checked={form.email_notify}
                    onCheckedChange={(v) => setForm({ ...form, email_notify: !!v })}
                    className="h-4 w-4"
                  />
                  <span className="text-[0.8125rem] text-foreground">Epostvarsling ved forfall</span>
                </label>
                <Button type="submit" className="w-full h-10 rounded-lg" disabled={createMutation.isPending || !form.title}>
                  {createMutation.isPending ? "Oppretter..." : "Opprett"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search + filters */}
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <Input placeholder="Søk..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 rounded-lg text-[0.8125rem] bg-card border-border" />
          </div>
          <Select value={ownerFilter} onValueChange={(v) => { ownerFilterTouched.current = true; setOwnerFilter(v); }}>
            <SelectTrigger className="h-9 w-auto min-w-[100px] rounded-lg text-[0.8125rem] border-border bg-card">
              <SelectValue placeholder="Eier: Alle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Eier: Alle</SelectItem>
              {ownerOptions.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      </div>

      {/* Right panel – contact info */}
      {selectedContactId && selectedContact && (
        <div className="w-[320px] flex-shrink-0 border-l border-border pl-4 space-y-4 animate-fade-up">
          <div className="flex items-center justify-between">
            <h3 className="text-[1.125rem] font-bold truncate">{selectedContact.first_name} {selectedContact.last_name}</h3>
            <button onClick={() => setSelectedContactId(null)} className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {selectedContact.title && <p className="text-[0.8125rem] text-muted-foreground">{selectedContact.title}</p>}
          {selectedContact.companies?.name && (
            <button onClick={() => navigate(`/selskaper/${selectedContact.companies.id}`)}
              className="text-[0.8125rem] text-primary hover:underline">{selectedContact.companies.name}</button>
          )}

          <div className="space-y-1.5">
            {selectedContact.phone && (
              <button onClick={() => copyToClipboard(selectedContact.phone)} className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground hover:text-foreground w-full text-left">
                <Phone className="h-3.5 w-3.5" />{selectedContact.phone}
              </button>
            )}
            {selectedContact.email && (
              <button onClick={() => copyToClipboard(selectedContact.email)} className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground hover:text-foreground w-full text-left truncate">
                <Mail className="h-3.5 w-3.5 flex-shrink-0" />{selectedContact.email}
              </button>
            )}
          </div>

          {/* Flags */}
          <div className="flex gap-3 text-[0.75rem]">
            {selectedContact.cv_email && <span className="px-1.5 py-0.5 rounded-[4px] bg-tag text-tag-foreground">CV-Epost</span>}
            {selectedContact.call_list && <span className="px-1.5 py-0.5 rounded-[4px] bg-tag text-tag-foreground">Innkjøper</span>}
          </div>

          {contactActivities.length > 0 && (
            <>
              <div className="h-px bg-border" />
              <div className="space-y-1">
                <h4 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Siste aktiviteter</h4>
                {contactActivities.map(a => (
                  <div key={a.id} className="flex items-start gap-2 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.75rem] font-medium truncate">{a.subject}</p>
                      <p className="text-[0.6875rem] text-muted-foreground">{relativeDate(a.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <button onClick={() => { setSelectedContactId(null); navigate(`/kontakter/${selectedContactId}`); }}
            className="flex items-center gap-1 text-[0.8125rem] text-primary hover:underline mt-2">
            Vis full kontakt <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
};

export default Tasks;
