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
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Plus, CalendarDays, Search, ArrowUpDown, User, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { format, isPast, isToday } from "date-fns";
import { nb } from "date-fns/locale";
import { ContactCardContent } from "@/components/ContactCardContent";
import { CompanyCardContent } from "@/components/CompanyCardContent";

const priorityConfig: Record<string, { label: string; className: string }> = {
  high: { label: "Høy", className: "bg-destructive/10 text-destructive border-destructive/20" },
  medium: { label: "Medium", className: "bg-primary/10 text-primary border-primary/20" },
  low: { label: "Lav", className: "bg-muted text-muted-foreground border-border" },
};

type SortField = "title" | "contact" | "company" | "priority" | "due_date";
type SortDir = "asc" | "desc";
const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

const Tasks = () => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", due_date: "", contact_id: "" });
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "due_date", dir: "asc" });
  const [showDone, setShowDone] = useState(false);
  const [contactSheetId, setContactSheetId] = useState<string | null>(null);
  const [companySheetId, setCompanySheetId] = useState<string | null>(null);
  const [pendingComplete, setPendingComplete] = useState<Set<string>>(new Set());
  const pendingTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, contacts(first_name, last_name, company_id, companies(id, name))")
        .order("status", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false });
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
        due_date: form.due_date || null, contact_id: form.contact_id,
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
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === "done" ? "open" : "done";
      const { error } = await supabase.from("tasks").update({
        status: newStatus, completed_at: newStatus === "done" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const handleComplete = (taskId: string, title: string) => {
    setPendingComplete((prev) => new Set(prev).add(taskId));
    const toastId = toast("Oppfølging fullført", {
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
      toggleMutation.mutate({ id: taskId, currentStatus: "open" });
    }, 4000);
    pendingTimers.current.set(taskId, timer);
  };

  const openTasks = tasks.filter(t => t.status !== "done");
  const doneTasks = tasks.filter(t => t.status === "done");

  const getContactName = (task: any) => {
    const c = task.contacts as any;
    return c?.first_name ? `${c.first_name} ${c.last_name}` : null;
  };
  const getContactId = (task: any) => (task as any).contact_id || null;
  const getCompanyName = (task: any) => (task.contacts as any)?.companies?.name || null;
  const getCompanyId = (task: any) => (task.contacts as any)?.companies?.id || (task as any).company_id || null;

  const filterTasks = (list: any[]) =>
    list.filter((t) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return t.title.toLowerCase().includes(q) || getContactName(t)?.toLowerCase().includes(q) || getCompanyName(t)?.toLowerCase().includes(q);
    });

  const sortTasks = (list: any[]) =>
    [...list].sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      switch (sort.field) {
        case "title": return dir * a.title.localeCompare(b.title, "nb");
        case "contact": return dir * (getContactName(a) || "").localeCompare(getContactName(b) || "", "nb");
        case "company": return dir * (getCompanyName(a) || "").localeCompare(getCompanyName(b) || "", "nb");
        case "priority": return dir * ((priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1));
        case "due_date":
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return dir * a.due_date.localeCompare(b.due_date);
        default: return 0;
      }
    });

  const toggleSort = (field: SortField) => {
    setSort((prev) => prev.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: "asc" });
  };

  const SortHeader = ({ field, children, className = "" }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <button onClick={() => toggleSort(field)} className={`flex items-center gap-1 text-[0.75rem] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors ${className}`}>
      {children}
      <ArrowUpDown className={`h-3 w-3 ${sort.field === field ? "text-foreground" : "text-muted-foreground/30"}`} />
    </button>
  );

  const filteredOpen = sortTasks(filterTasks(openTasks));
  const filteredDone = sortTasks(filterTasks(doneTasks));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-[1.75rem] font-bold tracking-tight">Oppfølginger</h1>
          <p className="text-[0.875rem] text-muted-foreground">
            {openTasks.length} åpne{doneTasks.length > 0 && ` · ${doneTasks.length} fullført`}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl h-10 px-4 text-[0.8125rem] font-semibold gap-2">
              <Plus className="h-4 w-4 stroke-[2]" />
              Ny oppfølging
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[440px] rounded-2xl">
            <DialogHeader><DialogTitle className="text-lg">Ny oppfølging</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-5 mt-4">
              <div className="space-y-2">
                <Label className="text-label">Tittel</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="h-11 rounded-xl text-[0.9375rem] bg-secondary/50" />
              </div>
              <div className="space-y-2">
                <Label className="text-label">Beskrivelse</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="rounded-xl text-[0.9375rem] bg-secondary/50 min-h-[80px]" />
              </div>
              <div className="space-y-2">
                <Label className="text-label">Kontaktperson *</Label>
                <Select value={form.contact_id} onValueChange={(v) => setForm({ ...form, contact_id: v })} required>
                  <SelectTrigger className="h-11 rounded-xl text-[0.9375rem] bg-secondary/50"><SelectValue placeholder="Velg kontaktperson" /></SelectTrigger>
                  <SelectContent>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.first_name} {c.last_name}{(c.companies as any)?.name && ` · ${(c.companies as any).name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-label">Prioritet</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger className="h-11 rounded-xl text-[0.9375rem] bg-secondary/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Lav</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">Høy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-label">Frist</Label>
                  <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="h-11 rounded-xl text-[0.9375rem] bg-secondary/50" />
                </div>
              </div>
              <Button type="submit" className="w-full h-11 rounded-xl text-[0.875rem] font-semibold" disabled={createMutation.isPending || !form.contact_id}>
                {createMutation.isPending ? "Oppretter..." : "Opprett"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 stroke-[1.5]" />
        <Input placeholder="Søk etter oppfølging, kontakt eller selskap..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="pl-11 h-11 rounded-xl bg-card border-border/40 text-[0.9375rem] placeholder:text-muted-foreground/40" />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-1">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-[52px] rounded-xl bg-secondary/50 animate-pulse" />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-24 text-center space-y-3">
          <p className="text-[1.0625rem] font-medium text-foreground/60">Ingen oppfølginger</p>
          <p className="text-[0.875rem] text-muted-foreground">Alt er i boks 🎉</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredOpen.length > 0 && (
            <div className="border border-border/40 rounded-2xl overflow-hidden bg-card">
              <div className="grid grid-cols-[40px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_70px_85px] gap-3 px-5 py-3 border-b border-border/40 bg-secondary/30">
                <span />
                <SortHeader field="title">Oppfølging</SortHeader>
                <SortHeader field="contact">Kontakt</SortHeader>
                <SortHeader field="company">Selskap</SortHeader>
                <SortHeader field="priority">Prioritet</SortHeader>
                <SortHeader field="due_date" className="justify-end">Frist</SortHeader>
              </div>
              <div className="divide-y divide-border/30">
                {filteredOpen.filter(t => !pendingComplete.has(t.id)).map((task) => {
                  const overdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
                  const dueToday = task.due_date && isToday(new Date(task.due_date));
                  const contactName = getContactName(task);
                  const companyName = getCompanyName(task);
                  const contactId = getContactId(task);
                  const companyId = getCompanyId(task);
                  const prio = priorityConfig[task.priority] || priorityConfig.medium;

                  return (
                    <div key={task.id} className="grid grid-cols-[40px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_70px_85px] gap-3 items-center px-5 py-3.5 hover:bg-accent/50 transition-colors duration-100">
                      <Checkbox checked={false} onCheckedChange={() => handleComplete(task.id, task.title)}
                        className="h-[18px] w-[18px] rounded-[5px] border-2 border-muted-foreground/50 data-[state=checked]:border-primary" />

                      <button className="min-w-0 text-left group" onClick={() => contactId && setContactSheetId(contactId)}>
                        <p className="text-[0.875rem] font-medium text-foreground truncate group-hover:text-primary transition-colors">{task.title}</p>
                        {task.description && <p className="text-[0.75rem] text-muted-foreground/50 truncate mt-0.5">{task.description}</p>}
                      </button>

                      <div className="min-w-0">
                        {contactName ? (
                          <button className="flex items-center gap-1 text-[0.8125rem] text-muted-foreground truncate hover:text-primary transition-colors"
                            onClick={() => contactId && setContactSheetId(contactId)}>
                            <User className="h-3 w-3 flex-shrink-0 stroke-[1.5]" />{contactName}
                          </button>
                        ) : <span className="text-[0.8125rem] text-muted-foreground/30">—</span>}
                      </div>

                      <div className="min-w-0">
                        {companyName ? (
                          <button className="flex items-center gap-1 text-[0.8125rem] text-muted-foreground truncate hover:text-primary transition-colors"
                            onClick={() => companyId && setCompanySheetId(companyId)}>
                            <Building2 className="h-3 w-3 flex-shrink-0 stroke-[1.5]" />{companyName}
                          </button>
                        ) : <span className="text-[0.8125rem] text-muted-foreground/30">—</span>}
                      </div>

                      <div>
                        <Badge variant="outline" className={`text-[0.6875rem] font-medium px-2 py-0.5 rounded-md ${prio.className}`}>{prio.label}</Badge>
                      </div>

                      <div className="text-right">
                        {task.due_date ? (
                          <span className={`inline-flex items-center gap-1 text-[0.8125rem] ${overdue ? "text-destructive font-medium" : dueToday ? "text-warning font-medium" : "text-muted-foreground"}`}>
                            <CalendarDays className="h-3 w-3 stroke-[1.5]" />
                            {format(new Date(task.due_date), "d. MMM", { locale: nb })}
                          </span>
                        ) : <span className="text-[0.8125rem] text-muted-foreground/30">—</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {filteredDone.length > 0 && (
            <div>
              <button onClick={() => setShowDone(!showDone)}
                className="text-[0.75rem] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors mb-2">
                Fullført · {filteredDone.length} {showDone ? "▴" : "▾"}
              </button>
              {showDone && (
                <div className="border border-border/30 rounded-2xl overflow-hidden bg-card/50">
                  <div className="divide-y divide-border/20">
                    {filteredDone.map((task) => {
                      const contactName = getContactName(task);
                      const companyName = getCompanyName(task);
                      return (
                        <div key={task.id} className="grid grid-cols-[40px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_70px_85px] gap-3 items-center px-5 py-3 opacity-50 hover:opacity-70 transition-opacity">
                          <Checkbox checked={true} onCheckedChange={() => toggleMutation.mutate({ id: task.id, currentStatus: task.status })}
                            className="h-[18px] w-[18px] rounded-[5px]" />
                          <span className="text-[0.875rem] line-through truncate">{task.title}</span>
                          <span className="text-[0.8125rem] text-muted-foreground truncate">{contactName || "—"}</span>
                          <span className="text-[0.8125rem] text-muted-foreground truncate">{companyName || "—"}</span>
                          <span />
                          <span className="text-[0.8125rem] text-muted-foreground/40 text-right">
                            {task.completed_at && format(new Date(task.completed_at), "d. MMM", { locale: nb })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Contact Sheet */}
      <Sheet open={!!contactSheetId} onOpenChange={(open) => !open && setContactSheetId(null)}>
        <SheetContent className="sm:max-w-[500px] overflow-y-auto p-6">
          {contactSheetId && (
            <ContactCardContent
              contactId={contactSheetId}
              onOpenCompany={(id) => { setContactSheetId(null); setCompanySheetId(id); }}
              onNavigateToFullPage={() => { setContactSheetId(null); navigate(`/kontakter/${contactSheetId}`); }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Company Sheet */}
      <Sheet open={!!companySheetId} onOpenChange={(open) => !open && setCompanySheetId(null)}>
        <SheetContent className="sm:max-w-[500px] overflow-y-auto p-6">
          {companySheetId && (
            <CompanyCardContent
              companyId={companySheetId}
              onOpenContact={(id) => { setCompanySheetId(null); setContactSheetId(id); }}
              onNavigateToFullPage={() => { setCompanySheetId(null); navigate(`/selskaper/${companySheetId}`); }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Tasks;
