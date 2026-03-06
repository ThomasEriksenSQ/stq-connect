import { useState, useMemo } from "react";
import { DescriptionText } from "@/components/DescriptionText";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Phone, Mail, Linkedin, FileText, Calendar as CalendarIcon, ExternalLink, Pencil, List, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { format, isPast, isToday, isSameYear, getYear } from "date-fns";
import { nb } from "date-fns/locale";
import { relativeDate, fullDate } from "@/lib/relativeDate";
import { cleanDescription } from "@/lib/cleanDescription";
import InlineEdit from "@/components/InlineEdit";
import { cn } from "@/lib/utils";

const dotColors: Record<string, string> = {
  call: "bg-[hsl(var(--success))]",
  meeting: "bg-[hsl(var(--primary))]",
  email: "bg-[hsl(var(--warning))]",
  note: "bg-muted-foreground",
  task: "bg-muted-foreground",
};

interface ContactCardContentProps {
  contactId: string;
  editable?: boolean;
  onOpenCompany?: (companyId: string) => void;
  onNavigateToFullPage?: () => void;
}

export function ContactCardContent({ contactId, editable = false, onOpenCompany, onNavigateToFullPage }: ContactCardContentProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activityOpen, setActivityOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [actForm, setActForm] = useState({ type: "note", subject: "", description: "" });
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "medium", due_date: "" });
  const [inlineLogOpen, setInlineLogOpen] = useState(false);
  const [inlineLogType, setInlineLogType] = useState<"call" | "other">("call");
  const [inlineLogSubject, setInlineLogSubject] = useState("");
  const [inlineLogActType, setInlineLogActType] = useState("call");
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());

  const { data: contact, isLoading } = useQuery({
    queryKey: ["contact", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*, companies(id, name), profiles!contacts_owner_id_fkey(full_name)")
        .eq("id", contactId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["contact-activities", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities").select("*").eq("contact_id", contactId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  const profileMap = Object.fromEntries(allProfiles.map(p => [p.id, p.full_name.split(" ")[0]]));

  const { data: tasks = [] } = useQuery({
    queryKey: ["contact-tasks", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks").select("*, companies(name)")
        .eq("contact_id", contactId).neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("contacts").update(updates).eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact", contactId] });
      queryClient.invalidateQueries({ queryKey: ["contacts-full"] });
      toast.success("Oppdatert");
    },
    onError: () => toast.error("Kunne ikke oppdatere"),
  });

  const createActivityMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("activities").insert({
        type: actForm.type, subject: actForm.subject, description: actForm.description || null,
        contact_id: contactId, company_id: contact?.company_id || null, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-activities", contactId] });
      setActivityOpen(false);
      setActForm({ type: "note", subject: "", description: "" });
      toast.success("Aktivitet registrert");
    },
    onError: () => toast.error("Kunne ikke registrere aktivitet"),
  });

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").insert({
        title: taskForm.title, description: taskForm.description || null, priority: taskForm.priority,
        due_date: taskForm.due_date || null, contact_id: contactId, company_id: contact?.company_id || null,
        assigned_to: user?.id, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-tasks", contactId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setTaskOpen(false);
      setTaskForm({ title: "", description: "", priority: "medium", due_date: "" });
      toast.success("Oppfølging opprettet");
    },
    onError: () => toast.error("Kunne ikke opprette oppfølging"),
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("tasks").update({
        status: "done", completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-tasks", contactId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const updateField = (field: string) => (value: string) => {
    updateMutation.mutate({ [field]: value || null });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast("Kopiert!", { duration: 1500 });
  };

  if (isLoading) {
    return <div className="space-y-3 animate-pulse"><div className="h-7 w-48 bg-secondary rounded" /><div className="h-4 w-32 bg-secondary rounded" /></div>;
  }
  if (!contact) return <p className="text-sm text-muted-foreground">Kontakt ikke funnet</p>;

  const companyName = (contact.companies as any)?.name;
  const companyId = (contact.companies as any)?.id;

  const TaskDialog = () => (
    <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
      <DialogTrigger asChild>
        <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px] rounded-xl">
        <DialogHeader><DialogTitle>Ny oppfølging</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); createTaskMutation.mutate(); }} className="space-y-4 mt-3">
          <div className="space-y-1.5">
            <Label className="text-label">Tittel</Label>
            <Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} required autoFocus className="h-10 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-label">Frist</Label>
            <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full h-10 rounded-lg justify-start text-left font-normal", !taskForm.due_date && "text-muted-foreground")}>
                  {taskForm.due_date ? format(new Date(taskForm.due_date), "d. MMMM yyyy", { locale: nb }) : "Velg dato"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={taskForm.due_date ? new Date(taskForm.due_date) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      setTaskForm({ ...taskForm, due_date: format(date, "yyyy-MM-dd") });
                      setDueDateOpen(false);
                    }
                  }}
                  locale={nb}
                  className={cn("p-3 pointer-events-auto")}
                />
                <div className="px-3 pb-3">
                  <Button type="button" variant="ghost" size="sm" className="w-full text-[0.8125rem]"
                    onClick={() => { setTaskForm({ ...taskForm, due_date: format(new Date(), "yyyy-MM-dd") }); setDueDateOpen(false); }}>
                    I dag
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <Label className="text-label">Beskrivelse</Label>
            <Textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} rows={2} className="rounded-lg min-h-[60px]" />
          </div>
          <Button type="submit" className="w-full h-10 rounded-lg" disabled={createTaskMutation.isPending}>
            {createTaskMutation.isPending ? "Oppretter..." : "Opprett"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-5">
      {/* Header – compact */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[1.375rem] font-bold truncate">
            {contact.first_name} {contact.last_name}
          </h2>
          <div className="flex items-center gap-1 flex-shrink-0">
            {editable && (
              <Select value={contact.owner_id || ""} onValueChange={(v) => updateMutation.mutate({ owner_id: v || null })}>
                <SelectTrigger className="h-7 w-auto gap-1 border-none bg-transparent p-0 px-2 text-[0.75rem] text-muted-foreground shadow-none hover:text-foreground">
                  <SelectValue placeholder="Eier" />
                </SelectTrigger>
                <SelectContent>
                  {allProfiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {editable && !editingNotes && !contact.notes && (
              <button onClick={() => setEditingNotes(true)} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {!editable && onNavigateToFullPage && (
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={onNavigateToFullPage}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-[0.8125rem] text-muted-foreground mt-1">
          {contact.title && <span>{editable ? <InlineEdit value={contact.title} onSave={updateField("title")} className="text-[0.8125rem] font-normal" /> : contact.title}</span>}
          {contact.title && companyName && <span className="text-muted-foreground/30">·</span>}
          {companyName && (
            <button className="text-primary hover:underline" onClick={() => onOpenCompany ? onOpenCompany(companyId) : navigate(`/selskaper/${companyId}`)}>
              {companyName}
            </button>
          )}
          {contact.phone && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <button onClick={() => copyToClipboard(contact.phone!)} className="inline-flex items-center gap-1 hover:text-foreground">
                <Phone className="h-3 w-3" />{contact.phone}
              </button>
            </>
          )}
          {contact.email && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <button onClick={() => copyToClipboard(contact.email!)} className="inline-flex items-center gap-1 hover:text-foreground">
                <Mail className="h-3 w-3" />{contact.email}
              </button>
            </>
          )}
          {contact.linkedin && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                <Linkedin className="h-3 w-3" />in
              </a>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 mt-2">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <Checkbox checked={(contact as any).cv_email ?? false}
              onCheckedChange={(checked) => updateMutation.mutate({ cv_email: checked as any })}
              className="h-3.5 w-3.5 rounded-[3px]" />
            <span className="text-[0.75rem] text-foreground">CV-Epost</span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <Checkbox checked={(contact as any).call_list ?? false}
              onCheckedChange={(checked) => updateMutation.mutate({ call_list: checked as any })}
              className="h-3.5 w-3.5 rounded-[3px]" />
            <span className="text-[0.75rem] text-foreground">Innkjøper</span>
          </label>
        </div>
      </div>

      {/* Notes */}
      {editable && (editingNotes || contact.notes) ? (
        <InlineEdit value={contact.notes || ""} onSave={(v) => { updateField("notes")(v); setEditingNotes(false); }} placeholder="Legg til notater..." multiline />
      ) : contact.notes ? (
        <p className="text-[0.8125rem] text-muted-foreground leading-relaxed whitespace-pre-wrap">{contact.notes}</p>
      ) : null}

      {/* Tasks – hidden if zero, +Ny in section header */}
      {tasks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Oppfølginger · {tasks.length}</h3>
            {editable && <TaskDialog />}
          </div>
          <div className="space-y-px">
            {tasks.map((task) => {
              const overdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
              return (
                <div key={task.id} className="flex items-center gap-2.5 py-2 hover:bg-secondary/50 rounded-md transition-colors duration-75">
                  <Checkbox checked={false} onCheckedChange={() => toggleTaskMutation.mutate(task.id)}
                    className="h-4 w-4 rounded-[4px] border-2 border-muted-foreground/40 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.8125rem] font-medium truncate">{task.title}</p>
                    {task.assigned_to && profileMap[task.assigned_to] && (
                      <span className="text-[0.6875rem] text-muted-foreground">{profileMap[task.assigned_to]}</span>
                    )}
                  </div>
                  {task.due_date && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={`text-[0.75rem] font-medium px-2 py-0.5 rounded-md flex-shrink-0 ${
                          overdue ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground"
                        }`}>
                          {format(new Date(task.due_date), "d. MMM", { locale: nb })}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{fullDate(task.due_date)}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* If editable and no tasks, show just the ⊕ icon in a minimal way */}
      {tasks.length === 0 && editable && (
        <div className="flex items-center gap-2">
          <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Oppfølginger</h3>
          <TaskDialog />
        </div>
      )}

      {/* Activities */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Aktiviteter · {activities.length}</h3>
          {editable && (
            <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
              <DialogTrigger asChild>
                <button className="text-[0.75rem] text-primary hover:underline">+ Logg</button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[440px] rounded-xl">
                <DialogHeader><DialogTitle>Ny aktivitet</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createActivityMutation.mutate(); }} className="space-y-4 mt-3">
                  <div className="space-y-1.5">
                    <Label className="text-label">Type</Label>
                    <Select value={actForm.type} onValueChange={(v) => setActForm({ ...actForm, type: v })}>
                      <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="note">Notat</SelectItem>
                        <SelectItem value="call">Samtale</SelectItem>
                        <SelectItem value="meeting">Møte</SelectItem>
                        <SelectItem value="email">E-post</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-label">Emne</Label>
                    <Input value={actForm.subject} onChange={(e) => setActForm({ ...actForm, subject: e.target.value })} required className="h-10 rounded-lg" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-label">Beskrivelse</Label>
                    <Textarea value={actForm.description} onChange={(e) => setActForm({ ...actForm, description: e.target.value })} rows={3} className="rounded-lg min-h-[80px]" />
                  </div>
                  <Button type="submit" className="w-full h-10 rounded-lg" disabled={createActivityMutation.isPending}>
                    {createActivityMutation.isPending ? "Registrerer..." : "Registrer"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground/60 py-2">Ingen aktiviteter ennå</p>
        ) : (
          <div className="divide-y divide-border">
            {activities.map((activity) => {
              const cfg = typeConfig[activity.type] || typeConfig.note;
              const Icon = cfg.icon;
              return (
                <div key={activity.id} className="flex items-start gap-2.5 py-3">
                  <Icon className={`h-4 w-4 mt-0.5 stroke-[1.5] flex-shrink-0 ${cfg.accent}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[0.8125rem] font-medium truncate">{activity.subject}</p>
                      <span className="text-[0.625rem] text-muted-foreground/60 flex-shrink-0">{cfg.label}</span>
                    </div>
                    <DescriptionText text={activity.description} maxLines={2} />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-[0.6875rem] text-muted-foreground/60 mt-0.5">{relativeDate(activity.created_at)}</p>
                      </TooltipTrigger>
                      <TooltipContent>{fullDate(activity.created_at)}</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
