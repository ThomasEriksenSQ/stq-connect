import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Phone, Mail, MapPin, Globe, Linkedin, User, FileText, Calendar, CalendarDays, Building2, ExternalLink, ChevronRight } from "lucide-react";
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

const priorityConfig: Record<string, { label: string; className: string }> = {
  high: { label: "Høy", className: "bg-destructive/10 text-destructive border-destructive/20" },
  medium: { label: "Medium", className: "bg-primary/10 text-primary border-primary/20" },
  low: { label: "Lav", className: "bg-muted text-muted-foreground border-border" },
};

const statusLabels: Record<string, { label: string; className: string }> = {
  lead: { label: "Lead", className: "bg-primary/10 text-primary border-primary/20" },
  prospect: { label: "Prospekt", className: "bg-warning/10 text-warning border-warning/20" },
  customer: { label: "Kunde", className: "bg-success/10 text-success border-success/20" },
  churned: { label: "Tapt", className: "bg-destructive/10 text-destructive border-destructive/20" },
  active: { label: "Aktiv", className: "bg-success/10 text-success border-success/20" },
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

  const { data: company, isLoading } = useQuery({
    queryKey: ["company", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*, profiles!companies_owner_id_fkey(full_name)").eq("id", companyId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

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

  // Activities directly on company
  const { data: companyActivities = [] } = useQuery({
    queryKey: ["company-activities-direct", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*, contacts(first_name, last_name)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Activities on contacts of this company
  const { data: contactActivities = [] } = useQuery({
    queryKey: ["company-contact-activities", companyId, contactIds],
    queryFn: async () => {
      if (contactIds.length === 0) return [];
      const { data, error } = await supabase
        .from("activities")
        .select("*, contacts(first_name, last_name)")
        .in("contact_id", contactIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && contactIds.length > 0,
  });

  // Merge and deduplicate activities
  const allActivitiesMap = new Map<string, any>();
  companyActivities.forEach(a => allActivitiesMap.set(a.id, a));
  contactActivities.forEach(a => { if (!allActivitiesMap.has(a.id)) allActivitiesMap.set(a.id, a); });
  const activities = Array.from(allActivitiesMap.values()).sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Tasks directly on company
  const { data: companyTasks = [] } = useQuery({
    queryKey: ["company-tasks", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, contacts(first_name, last_name), profiles!tasks_assigned_to_fkey(full_name)")
        .eq("company_id", companyId)
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Tasks on contacts of this company (not already covered by company_id)
  const { data: contactTasks = [] } = useQuery({
    queryKey: ["company-contact-tasks", companyId, contactIds],
    queryFn: async () => {
      if (contactIds.length === 0) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("*, contacts(first_name, last_name), profiles!tasks_assigned_to_fkey(full_name)")
        .in("contact_id", contactIds)
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && contactIds.length > 0,
  });

  // Merge and deduplicate tasks
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
      queryClient.invalidateQueries({ queryKey: ["companies"] });
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

  const getOwnerFirstName = (profile: any) => {
    const fullName = profile?.full_name;
    return fullName ? fullName.split(" ")[0] : null;
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
  if (!company) return <p className="text-muted-foreground text-[0.875rem]">Selskap ikke funnet</p>;

  const status = statusLabels[company.status] || { label: company.status, className: "bg-secondary text-secondary-foreground border-border" };
  const companyOwner = getOwnerFirstName((company as any).profiles);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {editable ? (
              <InlineEdit value={company.name} onSave={updateField("name")} className="text-[1.5rem] font-bold" />
            ) : (
              <h2 className="text-[1.25rem] font-bold">{company.name}</h2>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="outline" className={`text-[0.6875rem] font-medium px-2 py-0.5 rounded-md ${status.className}`}>
              {status.label}
            </Badge>
            {!editable && onNavigateToFullPage && (
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onNavigateToFullPage}>
                <ExternalLink className="h-4 w-4 stroke-[1.5]" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-[0.8125rem] text-muted-foreground">
          {company.city && (
            <>
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 stroke-[1.5]" />{company.city}</span>
              <span className="text-muted-foreground/30">·</span>
            </>
          )}
          {company.org_number && (
            <>
              <span className="font-mono">Org.nr {company.org_number}</span>
              <span className="text-muted-foreground/30">·</span>
            </>
          )}
          {company.industry && (
            <span>{company.industry}</span>
          )}
          {companyOwner && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5 stroke-[1.5]" />{companyOwner}</span>
            </>
          )}
        </div>
      </div>

      {/* Company info links */}
      <div className="space-y-2">
        {company.website && (
          <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-[0.875rem] text-primary hover:underline">
            <Globe className="h-4 w-4 stroke-[1.5]" />{company.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
          </a>
        )}
        {company.linkedin && (
          <a href={company.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-[0.875rem] text-primary hover:underline">
            <Linkedin className="h-4 w-4 stroke-[1.5]" />LinkedIn
          </a>
        )}
        {company.phone && (
          <a href={`tel:${company.phone}`} className="flex items-center gap-2.5 text-[0.875rem] text-primary hover:underline">
            <Phone className="h-4 w-4 stroke-[1.5]" />{company.phone}
          </a>
        )}
        {company.email && (
          <a href={`mailto:${company.email}`} className="flex items-center gap-2.5 text-[0.875rem] text-primary hover:underline">
            <Mail className="h-4 w-4 stroke-[1.5]" />{company.email}
          </a>
        )}
      </div>

      {/* Notes */}
      {editable ? (
        <InlineEdit value={company.notes || ""} onSave={updateField("notes")} placeholder="Legg til notater..." multiline />
      ) : company.notes ? (
        <div className="bg-secondary/50 rounded-xl px-4 py-3">
          <p className="text-[0.8125rem] text-muted-foreground leading-relaxed whitespace-pre-wrap">{company.notes}</p>
        </div>
      ) : null}

      {/* Two-column layout: Left = Tasks + Activities, Right = Contacts */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_minmax(0,280px)] gap-6">
        {/* Left column: Oppfølginger + Aktiviteter */}
        <div className="space-y-6">
          {/* Oppfølginger */}
          <div className="space-y-3">
            <h3 className="text-[0.75rem] font-medium uppercase tracking-wider text-muted-foreground">Oppfølginger · {tasks.length}</h3>
            {tasks.length === 0 ? (
              <p className="text-[0.8125rem] text-muted-foreground/60 py-2">Ingen kommende oppfølginger</p>
            ) : (
              <div className="space-y-1">
                {tasks.map((task) => {
                  const overdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
                  const prio = priorityConfig[task.priority] || priorityConfig.medium;
                  const contactName = (task.contacts as any)?.first_name
                    ? `${(task.contacts as any).first_name} ${(task.contacts as any).last_name}`
                    : null;
                  const taskOwner = getOwnerFirstName((task as any).profiles);
                  return (
                    <div key={task.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                      <Checkbox
                        checked={false}
                        onCheckedChange={() => toggleTaskMutation.mutate(task.id)}
                        className="h-4 w-4 rounded-[5px] border-border/60 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.8125rem] font-medium truncate">{task.title}</p>
                        <div className="flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
                          {contactName && <span className="truncate">{contactName}</span>}
                          {contactName && taskOwner && <span className="text-muted-foreground/30">·</span>}
                          {taskOwner && <span className="flex items-center gap-0.5"><User className="h-2.5 w-2.5 stroke-[1.5]" />{taskOwner}</span>}
                        </div>
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
            <h3 className="text-[0.75rem] font-medium uppercase tracking-wider text-muted-foreground">Aktiviteter · {activities.length}</h3>
            {activities.length === 0 ? (
              <p className="text-[0.8125rem] text-muted-foreground/60 py-2">Ingen aktiviteter</p>
            ) : (
              <div className="space-y-1">
                {activities.map((a) => {
                  const cfg = typeConfig[a.type] || typeConfig.note;
                  const Icon = cfg.icon;
                  const contactName = (a.contacts as any)?.first_name
                    ? `${(a.contacts as any).first_name} ${(a.contacts as any).last_name}`
                    : null;
                  return (
                    <div key={a.id} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                      <Icon className={`h-3.5 w-3.5 mt-0.5 stroke-[1.5] flex-shrink-0 ${cfg.accent}`} />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="text-[0.8125rem] font-medium leading-snug truncate">{a.subject}</p>
                          <span className="text-[0.625rem] text-muted-foreground/60 flex-shrink-0">{cfg.label}</span>
                        </div>
                        {a.description && (
                          <p className="text-[0.75rem] text-muted-foreground leading-relaxed line-clamp-2">{a.description}</p>
                        )}
                        <p className="text-[0.6875rem] text-muted-foreground/60">
                          {contactName && <>{contactName} · </>}
                          {format(new Date(a.created_at), "d. MMM yyyy 'kl.' HH:mm", { locale: nb })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Kontakter */}
        <div className="space-y-3">
          <h3 className="text-[0.75rem] font-medium uppercase tracking-wider text-muted-foreground">Kontakter · {contacts.length}</h3>
          {contacts.length === 0 ? (
            <p className="text-[0.8125rem] text-muted-foreground/60 py-2">Ingen kontakter</p>
          ) : (
            <div className="space-y-1">
              {contacts.map((c) => {
                const contactOwner = getOwnerFirstName((c as any).profiles);
                return (
                  <button
                    key={c.id}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors text-left group"
                    onClick={() => onOpenContact ? onOpenContact(c.id) : navigate(`/kontakter/${c.id}`)}
                  >
                    <User className="h-3.5 w-3.5 stroke-[1.5] text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.8125rem] font-medium truncate group-hover:text-primary transition-colors">{c.first_name} {c.last_name}</p>
                      <p className="text-[0.6875rem] text-muted-foreground truncate">
                        {c.title || "—"}
                        {contactOwner && <span className="text-muted-foreground/40"> · {contactOwner}</span>}
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
