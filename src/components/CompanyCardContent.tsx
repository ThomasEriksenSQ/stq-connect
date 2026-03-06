import { useState } from "react";
import { DescriptionText } from "@/components/DescriptionText";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Phone, Mail, Globe, Linkedin, FileText, Calendar, CalendarDays, ExternalLink, ChevronRight, Pencil, User } from "lucide-react";
import { toast } from "sonner";
import { format, isPast, isToday } from "date-fns";
import { nb } from "date-fns/locale";
import { relativeDate, fullDate } from "@/lib/relativeDate";
import InlineEdit from "@/components/InlineEdit";

const typeConfig: Record<string, { label: string; icon: typeof FileText; accent: string }> = {
  note: { label: "Notat", icon: FileText, accent: "text-muted-foreground" },
  call: { label: "Samtale", icon: Phone, accent: "text-success" },
  meeting: { label: "Møte", icon: Calendar, accent: "text-primary" },
  email: { label: "E-post", icon: Mail, accent: "text-warning" },
  task: { label: "Oppgave", icon: FileText, accent: "text-muted-foreground" },
};

const statusLabels: Record<string, { label: string; className: string }> = {
  lead: { label: "Lead", className: "bg-tag text-tag-foreground" },
  prospect: { label: "Prospekt", className: "bg-warning/10 text-warning" },
  customer: { label: "Kunde", className: "bg-success/10 text-success" },
  churned: { label: "Tapt", className: "bg-destructive/10 text-destructive" },
  active: { label: "Aktiv", className: "bg-success/10 text-success" },
};

interface CompanyCardContentProps {
  companyId: string;
  editable?: boolean;
  onOpenContact?: (contactId: string) => void;
  onNavigateToFullPage?: () => void;
}

export function CompanyCardContent({ companyId, editable = false, onOpenContact, onNavigateToFullPage }: CompanyCardContentProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingNotes, setEditingNotes] = useState(false);

  const { data: company, isLoading } = useQuery({
    queryKey: ["company", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*, profiles!companies_owner_id_fkey(full_name)").eq("id", companyId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data;
    },
  });
  const profileMap = Object.fromEntries(allProfiles.map(p => [p.id, p.full_name.split(" ")[0]]));

  const { data: contacts = [] } = useQuery({
    queryKey: ["company-contacts", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*, profiles!contacts_owner_id_fkey(full_name)")
        .eq("company_id", companyId)
        .order("first_name");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const contactIds = contacts.map(c => c.id);

  const { data: companyActivities = [] } = useQuery({
    queryKey: ["company-activities-direct", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities").select("*, contacts(first_name, last_name)")
        .eq("company_id", companyId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: contactActivities = [] } = useQuery({
    queryKey: ["company-contact-activities", companyId, contactIds],
    queryFn: async () => {
      if (contactIds.length === 0) return [];
      const { data, error } = await supabase
        .from("activities").select("*, contacts(first_name, last_name)")
        .in("contact_id", contactIds).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && contactIds.length > 0,
  });

  const allActivitiesMap = new Map<string, any>();
  companyActivities.forEach(a => allActivitiesMap.set(a.id, a));
  contactActivities.forEach(a => { if (!allActivitiesMap.has(a.id)) allActivitiesMap.set(a.id, a); });
  const activities = Array.from(allActivitiesMap.values()).sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const { data: companyTasks = [] } = useQuery({
    queryKey: ["company-tasks", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks").select("*, contacts(first_name, last_name)")
        .eq("company_id", companyId).neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: contactTasks = [] } = useQuery({
    queryKey: ["company-contact-tasks", companyId, contactIds],
    queryFn: async () => {
      if (contactIds.length === 0) return [];
      const { data, error } = await supabase
        .from("tasks").select("*, contacts(first_name, last_name)")
        .in("contact_id", contactIds).neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && contactIds.length > 0,
  });

  const allTasksMap = new Map<string, any>();
  companyTasks.forEach(t => allTasksMap.set(t.id, t));
  contactTasks.forEach(t => { if (!allTasksMap.has(t.id)) allTasksMap.set(t.id, t); });
  const tasks = Array.from(allTasksMap.values()).sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, string | null>) => {
      const { error } = await supabase.from("companies").update(updates).eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", companyId] });
      queryClient.invalidateQueries({ queryKey: ["companies-full"] });
      toast.success("Oppdatert");
    },
    onError: () => toast.error("Kunne ikke oppdatere"),
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("tasks").update({
        status: "done", completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-tasks", companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-contact-tasks", companyId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const updateField = (field: string) => (value: string) => {
    updateMutation.mutate({ [field]: value || null });
  };

  const getOwnerFirstName = (profile: any) => profile?.full_name?.split(" ")[0] || null;

  if (isLoading) {
    return <div className="space-y-3 animate-pulse"><div className="h-7 w-48 bg-secondary rounded" /><div className="h-4 w-32 bg-secondary rounded" /></div>;
  }
  if (!company) return <p className="text-sm text-muted-foreground">Selskap ikke funnet</p>;

  const status = statusLabels[company.status] || { label: company.status, className: "bg-secondary text-muted-foreground" };
  const companyOwner = getOwnerFirstName((company as any).profiles);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {editable ? (
              <InlineEdit value={company.name} onSave={updateField("name")} className="text-[1.375rem] font-bold" />
            ) : (
              <h2 className="text-[1.25rem] font-bold">{company.name}</h2>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-[0.625rem] font-medium px-1.5 py-0.5 rounded-[4px] ${status.className}`}>{status.label}</span>
            {editable && company.notes === null && !editingNotes && (
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
        <p className="text-[0.8125rem] text-muted-foreground mt-1">
          {[company.org_number && `Org.nr ${company.org_number}`, company.industry, companyOwner].filter(Boolean).join(" · ")}
        </p>
        {company.phone && (
          <a href={`tel:${company.phone}`} className="text-[0.8125rem] text-primary hover:underline mt-1 inline-block">{company.phone}</a>
        )}
      </div>

      {/* Links */}
      {(company.website || company.linkedin || company.email) && (
        <div className="flex items-center gap-4 text-[0.8125rem]">
          {company.website && (
            <a href={company.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline">
              <Globe className="h-3.5 w-3.5" />{company.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
            </a>
          )}
          {company.linkedin && (
            <a href={company.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline">
              <Linkedin className="h-3.5 w-3.5" />LinkedIn
            </a>
          )}
          {company.email && (
            <a href={`mailto:${company.email}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
              <Mail className="h-3.5 w-3.5" />{company.email}
            </a>
          )}
        </div>
      )}

      {/* Notes */}
      {editable && (editingNotes || company.notes) ? (
        <InlineEdit value={company.notes || ""} onSave={(v) => { updateField("notes")(v); setEditingNotes(false); }} placeholder="Legg til notater..." multiline />
      ) : company.notes ? (
        <p className="text-[0.8125rem] text-muted-foreground leading-relaxed whitespace-pre-wrap">{company.notes}</p>
      ) : null}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_minmax(0,260px)] gap-6">
        {/* Left: Tasks + Activities */}
        <div className="space-y-5">
          {/* Tasks - hidden if zero */}
          {tasks.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Oppfølginger · {tasks.length}</h3>
              <div className="space-y-px">
                {tasks.map((task) => {
                  const overdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
                  const contactName = (task.contacts as any)?.first_name
                    ? `${(task.contacts as any).first_name} ${(task.contacts as any).last_name}` : null;
                  return (
                    <div key={task.id} className="flex items-center gap-2.5 py-2 hover:bg-secondary/50 rounded-md transition-colors duration-75">
                      <Checkbox checked={false} onCheckedChange={() => toggleTaskMutation.mutate(task.id)}
                        className="h-4 w-4 rounded-[4px] border-2 border-muted-foreground/40 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.8125rem] font-medium truncate">{task.title}</p>
                        <p className="text-[0.6875rem] text-muted-foreground truncate">
                          {[task.assigned_to && profileMap[task.assigned_to], contactName].filter(Boolean).join(" · ")}
                        </p>
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

          {/* Activities */}
          <div className="space-y-2">
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Aktiviteter · {activities.length}</h3>
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground/60 py-2">Ingen aktiviteter</p>
            ) : (
              <div className="divide-y divide-border">
                {activities.map((a) => {
                  const cfg = typeConfig[a.type] || typeConfig.note;
                  const Icon = cfg.icon;
                  const contactName = (a.contacts as any)?.first_name
                    ? `${(a.contacts as any).first_name} ${(a.contacts as any).last_name}` : null;
                  return (
                    <div key={a.id} className="flex items-start gap-2.5 py-3">
                      <Icon className={`h-4 w-4 mt-0.5 stroke-[1.5] flex-shrink-0 ${cfg.accent}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[0.8125rem] font-medium truncate">{a.subject}</p>
                          <span className="text-[0.625rem] text-muted-foreground/60 flex-shrink-0">{cfg.label}</span>
                        </div>
                        <DescriptionText text={a.description} maxLines={2} />
                        <p className="text-[0.6875rem] text-muted-foreground/60 mt-0.5">
                          {contactName && <>{contactName} · </>}
                          {relativeDate(a.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Contacts */}
        <div className="space-y-2">
          <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Kontakter · {contacts.length}</h3>
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground/60 py-2">Ingen kontakter</p>
          ) : (
            <div className="divide-y divide-border">
              {contacts.map((c) => {
                const contactOwner = getOwnerFirstName((c as any).profiles);
                return (
                  <button
                    key={c.id}
                    className="w-full flex items-center gap-2 py-2.5 hover:bg-secondary/50 transition-colors duration-75 text-left group rounded-md"
                    onClick={() => onOpenContact ? onOpenContact(c.id) : navigate(`/kontakter/${c.id}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.8125rem] font-medium truncate group-hover:text-primary transition-colors">{c.first_name} {c.last_name}</p>
                      <p className="text-[0.6875rem] text-muted-foreground truncate">
                        {[c.title, contactOwner].filter(Boolean).join(" · ") || ""}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/60 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
