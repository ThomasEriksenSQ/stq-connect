import { useState, useMemo } from "react";
import { DescriptionText } from "@/components/DescriptionText";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Phone, Mail, Globe, Linkedin, FileText, Calendar, CalendarDays, ExternalLink, ChevronRight, Pencil, User, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { format, isPast, isToday, getYear } from "date-fns";
import { nb } from "date-fns/locale";
import { relativeDate, fullDate } from "@/lib/relativeDate";
import { cleanDescription } from "@/lib/cleanDescription";
import InlineEdit from "@/components/InlineEdit";
import { cn } from "@/lib/utils";

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
  const profileMapFull = Object.fromEntries(allProfiles.map(p => [p.id, p.full_name]));

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

  if (isLoading) {
    return <div className="space-y-3 animate-pulse"><div className="h-7 w-48 bg-secondary rounded" /><div className="h-4 w-32 bg-secondary rounded" /></div>;
  }
  if (!company) return <p className="text-sm text-muted-foreground">Selskap ikke funnet</p>;

  const status = statusLabels[company.status] || { label: company.status, className: "bg-secondary text-muted-foreground" };
  const ownerFullName = (company as any).profiles?.full_name || null;

  return (
    <div>
      {/* ── ZONE A: Header ── */}
      <div className="mb-3">
        <div className="flex items-center gap-3">
          {editable ? (
            <h2 className="text-[1.5rem] font-bold truncate flex-1 min-w-0">
              <InlineEdit value={company.name} onSave={updateField("name")} className="text-[1.5rem] font-bold" />
            </h2>
          ) : (
            <h2 className="text-[1.5rem] font-bold truncate flex-1 min-w-0">{company.name}</h2>
          )}
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-medium ${status.className}`}>{status.label}</span>
            {ownerFullName && (
              <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[0.6875rem] font-medium">{ownerFullName}</span>
            )}
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

        {/* Line 2: org number · industry */}
        <p className="text-[0.9375rem] text-foreground/70 mt-0.5">
          {[company.org_number && `Org.nr ${company.org_number}`, company.industry].filter(Boolean).join(" · ")}
        </p>

        {/* Line 3: phone · links */}
        <div className="flex items-center gap-2 flex-wrap text-[0.9375rem] text-foreground/70 mt-1">
          {company.phone && (
            <a href={`tel:${company.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
              <Phone className="h-3 w-3" />{company.phone}
            </a>
          )}
          {company.website && (
            <>
              {company.phone && <span className="text-muted-foreground/40">·</span>}
              <a href={company.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                <Globe className="h-3 w-3" />{company.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
              </a>
            </>
          )}
          {company.linkedin && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <a href={company.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                <Linkedin className="h-3 w-3" />LinkedIn
              </a>
            </>
          )}
          {company.email && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <a href={`mailto:${company.email}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                <Mail className="h-3 w-3" />{company.email}
              </a>
            </>
          )}
        </div>
      </div>

      {/* Notes */}
      {editable && (editingNotes || company.notes) ? (
        <div className="mb-4">
          <InlineEdit value={company.notes || ""} onSave={(v) => { updateField("notes")(v); setEditingNotes(false); }} placeholder="Legg til notater..." multiline />
        </div>
      ) : company.notes ? (
        <p className="text-[0.8125rem] text-muted-foreground leading-relaxed whitespace-pre-wrap mb-4">{company.notes}</p>
      ) : null}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_minmax(0,260px)] gap-6">
        {/* Left: Tasks + Activities */}
        <div className="space-y-5">
          {/* ── Oppfølginger (card style matching ContactCardContent) ── */}
          {tasks.length > 0 && (
            <div className="bg-card border border-border rounded-lg shadow-card p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Oppfølginger · {tasks.length}
                </h3>
              </div>
              <div className="space-y-px">
                {tasks.map((task) => {
                  const overdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
                  const today = task.due_date && isToday(new Date(task.due_date));
                  const contactName = (task.contacts as any)?.first_name
                    ? `${(task.contacts as any).first_name} ${(task.contacts as any).last_name}` : null;
                  return (
                    <div key={task.id} className="flex items-start gap-2.5 py-2.5 px-1 rounded-md transition-all duration-200 group hover:bg-background/60">
                      <div>
                        <Checkbox checked={false} onCheckedChange={() => toggleTaskMutation.mutate(task.id)}
                          className="h-4 w-4 rounded-[4px] border-2 border-muted-foreground/40 flex-shrink-0 mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[1rem] font-bold text-foreground">{task.title}</div>
                        {(task.assigned_to || contactName) && (
                          <div className="flex items-center gap-1.5 mt-1">
                            {task.assigned_to && profileMapFull[task.assigned_to] && (
                              <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[0.6875rem] font-medium">{profileMapFull[task.assigned_to]}</span>
                            )}
                            {contactName && (
                              <span className="text-[0.6875rem] text-muted-foreground">{contactName}</span>
                            )}
                          </div>
                        )}
                        {task.description && (
                          <p className="text-[0.875rem] text-foreground/70 truncate mt-0.5">{task.description}</p>
                        )}
                      </div>
                      {task.due_date && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={cn(
                              "text-[0.8125rem] font-medium px-2 py-0.5 rounded-md flex-shrink-0 mt-0.5",
                              overdue ? "text-destructive" : today ? "text-[hsl(var(--warning))]" : "text-muted-foreground"
                            )}>
                              {format(new Date(task.due_date), "d. MMM yyyy", { locale: nb })}
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

          {/* ── Activities Timeline (matching ContactCardContent) ── */}
          <CompanyActivityTimeline activities={activities} profileMap={profileMapFull} />
        </div>

        {/* Right: Contacts */}
        <div className="space-y-2">
          <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">Kontakter · {contacts.length}</h3>
          {contacts.length === 0 ? (
            <p className="text-[0.8125rem] text-muted-foreground/60 py-2">Ingen kontakter</p>
          ) : (
            <div className="divide-y divide-border">
              {contacts.map((c) => {
                const contactOwner = (c as any).profiles?.full_name || null;
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

/* ── Company Activity Timeline (same visual as ContactCardContent) ── */
function CompanyActivityTimeline({ activities, profileMap }: { activities: any[]; profileMap: Record<string, string> }) {
  const currentYear = getYear(new Date());

  const grouped = useMemo(() => {
    const groups: { key: string; label: string; period: string; items: any[] }[] = [];
    let currentKey = "";
    for (const act of activities) {
      const d = new Date(act.created_at);
      const monthKey = format(d, "yyyy-MM");
      if (monthKey !== currentKey) {
        currentKey = monthKey;
        const label = format(d, "MMMM yyyy", { locale: nb }).toUpperCase();
        const yr = getYear(d);
        let period = "";
        if (yr === currentYear - 1) period = "I fjor";
        else if (yr < currentYear - 1) period = `${currentYear - yr} år siden`;
        groups.push({ key: monthKey, label, period, items: [] });
      }
      groups[groups.length - 1].items.push(act);
    }
    return groups;
  }, [activities, currentYear]);

  if (activities.length === 0) {
    return (
      <div>
        <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">Aktiviteter · 0</h3>
        <p className="text-[0.8125rem] text-muted-foreground/60 py-2">Ingen aktiviteter</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-4">
        Aktiviteter · {activities.length}
      </h3>

      {grouped.map((group, gi) => (
        <div key={group.key}>
          {/* Month header */}
          <div className={cn("flex items-center gap-3 mb-3", gi > 0 && "mt-6")}>
            <span className="text-[0.8125rem] font-bold tracking-[0.04em] text-foreground whitespace-nowrap">
              {group.label}
            </span>
            {group.period && <span className="text-[0.8125rem] text-muted-foreground/60">· {group.period}</span>}
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Timeline spine */}
          <div className="relative pl-7">
            <div className="absolute left-[5px] top-[5px] bottom-0 w-[2px] bg-border" />

            <div className="space-y-6">
              {group.items.map((activity) => {
                const desc = cleanDescription(activity.description);
                const ownerName = activity.created_by ? profileMap[activity.created_by] : null;
                const d = new Date(activity.created_at);
                const contactName = (activity.contacts as any)?.first_name
                  ? `${(activity.contacts as any).first_name} ${(activity.contacts as any).last_name}` : null;

                const typeIcon = activity.type === "call" || activity.type === "phone"
                  ? <MessageCircle className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
                  : <FileText className="h-3.5 w-3.5 text-primary" />;

                return (
                  <div key={activity.id} className="relative group">
                    {/* Icon on spine */}
                    <div className="absolute -left-7 top-[2px] w-[12px] h-[12px] flex items-center justify-center bg-background rounded-full">
                      {typeIcon}
                    </div>

                    <div className="min-w-0">
                      {/* Subject */}
                      <span className="text-[1.0625rem] font-bold text-foreground">{activity.subject}</span>

                      {/* Description */}
                      {desc && (
                        <div className="mt-1">
                          <p className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-foreground/70">{desc}</p>
                        </div>
                      )}

                      {/* Meta */}
                      <div className="flex items-center gap-2 mt-1.5">
                        {ownerName && (
                          <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[0.6875rem] font-medium">{ownerName}</span>
                        )}
                        {contactName && (
                          <span className="text-[0.8125rem] text-muted-foreground">{contactName}</span>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-[0.8125rem] text-muted-foreground">
                              {format(d, "d. MMM yyyy", { locale: nb })}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{fullDate(activity.created_at)}</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
