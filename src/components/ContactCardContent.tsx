import { useState } from "react";
import { DescriptionText } from "@/components/DescriptionText";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Phone, Mail, MapPin, Linkedin, Building2, FileText, Calendar, CalendarDays, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format, isPast, isToday } from "date-fns";
import { nb } from "date-fns/locale";
import InlineEdit from "@/components/InlineEdit";

const typeConfig: Record<string, { label: string; icon: typeof FileText; accent: string }> = {
  note: { label: "Notat", icon: FileText, accent: "text-muted-foreground" },
  call: { label: "Samtale", icon: Phone, accent: "text-success" },
  meeting: { label: "Møte", icon: Calendar, accent: "text-primary" },
  email: { label: "E-post", icon: Mail, accent: "text-warning" },
  task: { label: "Oppgave", icon: FileText, accent: "text-muted-foreground" },
};

const priorityConfig: Record<string, { label: string; className: string }> = {
  high: { label: "Høy", className: "bg-destructive/10 text-destructive border-destructive/20" },
  medium: { label: "Medium", className: "bg-primary/10 text-primary border-primary/20" },
  low: { label: "Lav", className: "bg-muted text-muted-foreground border-border" },
};

interface ContactCardContentProps {
  contactId: string;
  /** If true, shows full editing + create forms. False = read-only summary for overlays */
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
  const [actForm, setActForm] = useState({ type: "note", subject: "", description: "" });
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "medium", due_date: "" });

  const { data: contact, isLoading } = useQuery({
    queryKey: ["contact", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*, companies(id, name), profiles!contacts_owner_id_fkey(full_name)")
        .eq("id", contactId)
        .single();
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
        .from("activities")
        .select("*")
        .eq("contact_id", contactId)
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
        .from("tasks")
        .select("*, companies(name)")
        .eq("contact_id", contactId)
        .neq("status", "done")
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
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
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

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-7 w-48 bg-secondary rounded-lg" />
        <div className="h-4 w-32 bg-secondary rounded-lg" />
        <div className="h-20 bg-secondary rounded-xl" />
      </div>
    );
  }
  if (!contact) return <p className="text-muted-foreground text-[0.875rem]">Kontakt ikke funnet</p>;

  const companyName = (contact.companies as any)?.name;
  const companyId = (contact.companies as any)?.id;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {editable ? (
              <h1 className="text-[1.5rem] font-bold">
                {contact.first_name} {contact.last_name}
                <Select value={contact.owner_id || ""} onValueChange={(v) => updateMutation.mutate({ owner_id: v || null })}>
                  <SelectTrigger className="inline-flex h-auto w-auto gap-1 border-none bg-transparent p-0 text-[0.875rem] font-normal text-muted-foreground shadow-none hover:text-foreground ml-2">
                    <SelectValue placeholder="Velg eier" />
                  </SelectTrigger>
                  <SelectContent>
                    {allProfiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name || "Uten navn"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </h1>
            ) : (
              <h2 className="text-[1.25rem] font-bold">{contact.first_name} {contact.last_name}</h2>
            )}
          </div>
          {!editable && onNavigateToFullPage && (
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg flex-shrink-0" onClick={onNavigateToFullPage}>
              <ExternalLink className="h-4 w-4 stroke-[1.5]" />
            </Button>
          )}
        </div>

        {/* Info stripe */}
        <div className="flex items-center gap-2 flex-wrap text-[0.8125rem] text-muted-foreground">
          {contact.title && (
            <>
              {editable ? <InlineEdit value={contact.title} onSave={updateField("title")} className="text-[0.8125rem] font-normal" /> : <span>{contact.title}</span>}
              <span className="text-muted-foreground/30">·</span>
            </>
          )}
          {companyName && (
            <>
              <button
                className="text-primary hover:underline"
                onClick={() => onOpenCompany ? onOpenCompany(companyId) : navigate(`/selskaper/${companyId}`)}
              >
                {companyName}
              </button>
              <span className="text-muted-foreground/30">·</span>
            </>
          )}
          {contact.location && (
            <>
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 stroke-[1.5]" />{contact.location}</span>
              <span className="text-muted-foreground/30">·</span>
            </>
          )}
        </div>
      </div>

      {/* Contact details */}
      <div className="space-y-2">
        {contact.phone && (
          <a href={`tel:${contact.phone}`} className="flex items-center gap-2.5 text-[0.875rem] text-primary hover:underline">
            <Phone className="h-4 w-4 stroke-[1.5]" />{contact.phone}
          </a>
        )}
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="flex items-center gap-2.5 text-[0.875rem] text-primary hover:underline">
            <Mail className="h-4 w-4 stroke-[1.5]" />{contact.email}
          </a>
        )}
        {contact.linkedin && (
          <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-[0.875rem] text-primary hover:underline">
            <Linkedin className="h-4 w-4 stroke-[1.5]" />LinkedIn
          </a>
        )}
      </div>

      {/* Flags */}
      <div className="flex items-center gap-3">
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <Checkbox
            checked={(contact as any).cv_email ?? false}
            onCheckedChange={(checked) => updateMutation.mutate({ cv_email: checked as any })}
            className="h-3.5 w-3.5 rounded-[4px]"
          />
          <span className="text-[0.8125rem] font-medium text-foreground">CV-Epost</span>
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <Checkbox
            checked={(contact as any).call_list ?? false}
            onCheckedChange={(checked) => updateMutation.mutate({ call_list: checked as any })}
            className="h-3.5 w-3.5 rounded-[4px]"
          />
          <span className="text-[0.8125rem] font-medium text-foreground">Innkjøper</span>
        </label>
      </div>

      {/* Notes */}
      {editable ? (
        <InlineEdit value={contact.notes || ""} onSave={updateField("notes")} placeholder="Legg til notater..." multiline />
      ) : contact.notes ? (
        <div className="bg-secondary/50 rounded-xl px-4 py-3">
          <p className="text-[0.8125rem] text-muted-foreground leading-relaxed whitespace-pre-wrap">{contact.notes}</p>
        </div>
      ) : null}

      {/* Oppfølginger */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[0.75rem] font-medium uppercase tracking-wider text-muted-foreground">Oppfølginger · {tasks.length}</h3>
          {editable && (
            <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-xl h-7 px-2.5 text-[0.6875rem] font-medium gap-1 border-border/40">
                  <Plus className="h-3 w-3 stroke-[2]" />Ny
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[440px] rounded-2xl">
                <DialogHeader><DialogTitle className="text-lg">Ny oppfølging</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createTaskMutation.mutate(); }} className="space-y-5 mt-4">
                  <div className="space-y-2">
                    <Label className="text-label">Tittel</Label>
                    <Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} required className="h-11 rounded-xl text-[0.9375rem] bg-secondary/50" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-label">Beskrivelse</Label>
                    <Textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} rows={2} className="rounded-xl text-[0.9375rem] bg-secondary/50 min-h-[60px]" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-label">Prioritet</Label>
                      <Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}>
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
                      <Input type="date" value={taskForm.due_date} onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })} className="h-11 rounded-xl text-[0.9375rem] bg-secondary/50" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-11 rounded-xl text-[0.875rem] font-semibold" disabled={createTaskMutation.isPending}>
                    {createTaskMutation.isPending ? "Oppretter..." : "Opprett"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
        {tasks.length === 0 ? (
          <p className="text-[0.8125rem] text-muted-foreground/60 py-2">Ingen kommende oppfølginger</p>
        ) : (
          <div className="space-y-1">
            {tasks.map((task) => {
              const overdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
              const prio = priorityConfig[task.priority] || priorityConfig.medium;
              return (
                <div key={task.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <Checkbox
                    checked={false}
                    onCheckedChange={() => toggleTaskMutation.mutate(task.id)}
                    className="h-4 w-4 rounded-[5px] border-border/60 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.8125rem] font-medium truncate">{task.title}</p>
                    <DescriptionText text={task.description} maxLines={2} />
                  </div>
                  <Badge variant="outline" className={`text-[0.625rem] px-1.5 py-0 rounded ${prio.className} flex-shrink-0`}>{prio.label}</Badge>
                  {task.due_date && (
                    <span className={`text-[0.75rem] flex-shrink-0 flex items-center gap-1 ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                      <CalendarDays className="h-3 w-3 stroke-[1.5]" />
                      {format(new Date(task.due_date), "d. MMM", { locale: nb })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Aktiviteter */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[0.75rem] font-medium uppercase tracking-wider text-muted-foreground">Aktiviteter · {activities.length}</h3>
          {editable && (
            <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-xl h-7 px-2.5 text-[0.6875rem] font-medium gap-1 border-border/40">
                  <Plus className="h-3 w-3 stroke-[2]" />Logg
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[440px] rounded-2xl">
                <DialogHeader><DialogTitle className="text-lg">Ny aktivitet</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createActivityMutation.mutate(); }} className="space-y-5 mt-4">
                  <div className="space-y-2">
                    <Label className="text-label">Type</Label>
                    <Select value={actForm.type} onValueChange={(v) => setActForm({ ...actForm, type: v })}>
                      <SelectTrigger className="h-11 rounded-xl text-[0.9375rem] bg-secondary/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="note">Notat</SelectItem>
                        <SelectItem value="call">Samtale</SelectItem>
                        <SelectItem value="meeting">Møte</SelectItem>
                        <SelectItem value="email">E-post</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-label">Emne</Label>
                    <Input value={actForm.subject} onChange={(e) => setActForm({ ...actForm, subject: e.target.value })} required className="h-11 rounded-xl text-[0.9375rem] bg-secondary/50" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-label">Beskrivelse</Label>
                    <Textarea value={actForm.description} onChange={(e) => setActForm({ ...actForm, description: e.target.value })} rows={3} className="rounded-xl text-[0.9375rem] bg-secondary/50 min-h-[80px]" />
                  </div>
                  <Button type="submit" className="w-full h-11 rounded-xl text-[0.875rem] font-semibold" disabled={createActivityMutation.isPending}>
                    {createActivityMutation.isPending ? "Registrerer..." : "Registrer"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
        {activities.length === 0 ? (
          <p className="text-[0.8125rem] text-muted-foreground/60 py-2">Ingen aktiviteter ennå</p>
        ) : (
          <div className="space-y-1">
            {activities.map((activity) => {
              const cfg = typeConfig[activity.type] || typeConfig.note;
              const Icon = cfg.icon;
              return (
                <div key={activity.id} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <Icon className={`h-3.5 w-3.5 mt-0.5 stroke-[1.5] flex-shrink-0 ${cfg.accent}`} />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="text-[0.8125rem] font-medium leading-snug truncate">{activity.subject}</p>
                      <span className="text-[0.625rem] text-muted-foreground/60 flex-shrink-0">{cfg.label}</span>
                    </div>
                        <DescriptionText text={activity.description} maxLines={2} />
                    <p className="text-[0.6875rem] text-muted-foreground/60">
                      {format(new Date(activity.created_at), "d. MMM yyyy 'kl.' HH:mm", { locale: nb })}
                    </p>
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
