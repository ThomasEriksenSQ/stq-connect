import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, FileText, Phone, Calendar, Mail, Building2, CalendarDays, Circle, MapPin } from "lucide-react";
import { toast } from "sonner";
import { format, isPast, isToday } from "date-fns";
import { nb } from "date-fns/locale";
import InlineEdit from "@/components/InlineEdit";

const typeConfig: Record<string, { label: string; icon: typeof FileText; accent: string }> = {
  note: { label: "Notat", icon: FileText, accent: "text-muted-foreground" },
  call: { label: "Samtale", icon: Phone, accent: "text-success" },
  meeting: { label: "Møte", icon: Calendar, accent: "text-primary" },
  email: { label: "E-post", icon: Mail, accent: "text-warning" },
};

const priorityDots: Record<string, string> = {
  low: "text-muted-foreground/30",
  medium: "text-primary",
  high: "text-destructive",
};

const ContactDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activityOpen, setActivityOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [actForm, setActForm] = useState({ type: "note", subject: "", description: "" });
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "medium", due_date: "" });

  const { data: contact, isLoading } = useQuery({
    queryKey: ["contact", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*, companies(id, name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["contact-activities", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("contact_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["contact-tasks", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("contact_id", id!)
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, string | null>) => {
      const { error } = await supabase.from("contacts").update(updates).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact", id] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Oppdatert");
    },
    onError: () => toast.error("Kunne ikke oppdatere"),
  });

  const updateField = (field: string) => (value: string) => {
    updateMutation.mutate({ [field]: value || null });
  };

  const createActivityMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("activities").insert({
        type: actForm.type,
        subject: actForm.subject,
        description: actForm.description || null,
        contact_id: id,
        company_id: contact?.company_id || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-activities", id] });
      queryClient.invalidateQueries({ queryKey: ["company-activities"] });
      setActivityOpen(false);
      setActForm({ type: "note", subject: "", description: "" });
      toast.success("Aktivitet registrert");
    },
    onError: () => toast.error("Kunne ikke registrere aktivitet"),
  });

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").insert({
        title: taskForm.title,
        description: taskForm.description || null,
        priority: taskForm.priority,
        due_date: taskForm.due_date || null,
        contact_id: id,
        company_id: contact?.company_id || null,
        assigned_to: user?.id,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-tasks", id] });
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
        status: "done",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-tasks", id] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-card animate-pulse rounded-xl" />
        <div className="h-40 bg-card animate-pulse rounded-2xl" />
      </div>
    );
  }
  if (!contact) return <p className="text-muted-foreground">Kontakt ikke funnet</p>;


  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <Link to="/kontakter" className="inline-flex items-center gap-2 text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-3.5 w-3.5 stroke-[1.5]" />
          Kontakter
        </Link>

        <div className="flex items-start gap-5">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold text-primary">{contact.first_name[0]}{contact.last_name[0]}</span>
          </div>
          <div className="space-y-1.5 min-w-0">
            <h1 className="text-[1.5rem] font-bold">
              {contact.first_name} {contact.last_name}
            </h1>
            <div className="flex items-center gap-2 flex-wrap text-[0.875rem] text-muted-foreground">
              {(contact.companies as any)?.name && (
                <>
                  <button
                    onClick={() => navigate(`/selskaper/${(contact.companies as any).id}`)}
                    className="text-primary hover:underline"
                  >
                    {(contact.companies as any).name}
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
              {contact.title && (
                <>
                  <span>{contact.title}</span>
                  <span className="text-muted-foreground/30">·</span>
                </>
              )}
              {contact.phone && (
                <>
                  <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1 font-mono text-primary hover:underline"><Phone className="h-3.5 w-3.5 stroke-[1.5]" />{contact.phone}</a>
                  <span className="text-muted-foreground/30">·</span>
                </>
              )}
              {contact.email && (
                <>
                  <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Mail className="h-3.5 w-3.5 stroke-[1.5]" />{contact.email}</a>
                  <span className="text-muted-foreground/30">·</span>
                </>
              )}
              {contact.linkedin && (
                <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">LinkedIn</a>
              )}
            </div>
            <div className="pt-2">
              <InlineEdit
                value={contact.notes || ""}
                onSave={updateField("notes")}
                placeholder="Legg til notater..."
                multiline
              />
            </div>
          </div>
        </div>
      </div>

      {/* Oppfølginger & Aktiviteter */}
      <div className="space-y-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-label">Oppfølginger · {tasks.length}</h2>
            <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-xl h-8 px-3 text-[0.75rem] font-medium gap-1.5 border-border/40 hover:bg-card">
                  <Plus className="h-3.5 w-3.5 stroke-[2]" />
                  Legg til oppfølging
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[440px] rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="text-lg">Ny oppfølging</DialogTitle>
                </DialogHeader>
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
          </div>

          {tasks.length === 0 ? (
            <p className="text-[0.875rem] text-muted-foreground py-4">Ingen kommende oppfølginger</p>
          ) : (
            <div className="space-y-1">
              {tasks.map((task) => {
                const overdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
                return (
                  <div key={task.id} className="flex items-center gap-3.5 px-4 py-3 rounded-xl hover:bg-card transition-colors">
                    <Checkbox
                      checked={false}
                      onCheckedChange={() => toggleTaskMutation.mutate(task.id)}
                      className="flex-shrink-0 h-4 w-4 rounded-md border-border"
                    />
                    <Circle className={`h-2 w-2 fill-current ${priorityDots[task.priority]} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.875rem] font-medium leading-snug">{task.title}</p>
                      {task.due_date && (
                        <span className={`flex items-center gap-1 text-[0.75rem] mt-0.5 ${overdue ? 'text-destructive' : 'text-muted-foreground/60'}`}>
                          <CalendarDays className="h-3 w-3 stroke-[1.5]" />
                          {format(new Date(task.due_date), "d. MMM yyyy", { locale: nb })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Aktiviteter */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-label">Aktiviteter · {activities.length}</h2>
            <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-xl h-8 px-3 text-[0.75rem] font-medium gap-1.5 border-border/40 hover:bg-card">
                  <Plus className="h-3.5 w-3.5 stroke-[2]" />
                  Logg aktivitet
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[440px] rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="text-lg">Ny aktivitet</DialogTitle>
                </DialogHeader>
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
          </div>

          {activities.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-[0.875rem] text-muted-foreground/60">Ingen aktiviteter ennå</p>
            </div>
          ) : (
            <div className="space-y-1">
              {activities.map((activity) => {
                const cfg = typeConfig[activity.type] || typeConfig.note;
                const Icon = cfg.icon;
                return (
                  <div key={activity.id} className="flex items-start gap-3.5 px-4 py-3.5 rounded-xl hover:bg-card transition-colors">
                    <div className="mt-0.5 flex-shrink-0">
                      <Icon className={`h-4 w-4 stroke-[1.5] ${cfg.accent}`} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="text-[0.9375rem] font-medium leading-snug">{activity.subject}</p>
                        <span className="text-[0.6875rem] text-muted-foreground/40 font-medium">{cfg.label}</span>
                      </div>
                      {activity.description && (
                        <p className="text-[0.875rem] text-muted-foreground leading-relaxed">{activity.description}</p>
                      )}
                      <p className="text-[0.75rem] text-muted-foreground/40 pt-0.5">
                        {format(new Date(activity.created_at), "d. MMMM yyyy 'kl.' HH:mm", { locale: nb })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactDetail;
