import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MapPin, FileText, Phone, Calendar, Mail, ChevronRight, CalendarDays, Circle, Globe, Linkedin } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { nb } from "date-fns/locale";
import { toast } from "sonner";
import InlineEdit from "@/components/InlineEdit";
import { Checkbox } from "@/components/ui/checkbox";

const typeConfig: Record<string, { label: string; icon: typeof FileText; accent: string }> = {
  note: { label: "Notat", icon: FileText, accent: "text-muted-foreground" },
  call: { label: "Samtale", icon: Phone, accent: "text-success" },
  meeting: { label: "Møte", icon: Calendar, accent: "text-primary" },
  email: { label: "E-post", icon: Mail, accent: "text-warning" },
};

const priorityDots: Record<string, string> = {
  low: "text-muted-foreground",
  medium: "text-primary",
  high: "text-destructive",
};

const CompanyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: company, isLoading } = useQuery({
    queryKey: ["company", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["company-contacts", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*").eq("company_id", id!).order("first_name");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["company-activities", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*, contacts(first_name, last_name)")
        .eq("company_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["company-tasks", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, contacts(first_name, last_name)")
        .eq("company_id", id!)
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, string | null>) => {
      const { error } = await supabase.from("companies").update(updates).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", id] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Oppdatert");
    },
    onError: () => toast.error("Kunne ikke oppdatere"),
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
      queryClient.invalidateQueries({ queryKey: ["company-tasks", id] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const updateField = (field: string) => (value: string) => {
    updateMutation.mutate({ [field]: value || null });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-card animate-pulse rounded-xl" />
        <div className="h-20 bg-card animate-pulse rounded-2xl" />
      </div>
    );
  }
  if (!company) return <p className="text-muted-foreground">Selskap ikke funnet</p>;

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <Link to="/selskaper" className="inline-flex items-center gap-2 text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-3.5 w-3.5 stroke-[1.5]" />
          Selskaper
        </Link>

        <div>
          <div className="space-y-1.5 min-w-0">
            <InlineEdit value={company.name} onSave={updateField("name")} className="text-[1.5rem] font-bold" />
            <div className="flex items-center gap-2 flex-wrap text-[0.875rem] text-muted-foreground">
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
              {company.website && (
                <>
                  <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{company.website.replace(/^https?:\/\//, '')}</a>
                  <span className="text-muted-foreground/30">·</span>
                </>
              )}
              {company.linkedin && (
                <a href={company.linkedin} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">LinkedIn</a>
              )}
            </div>
            <div className="pt-2">
              <InlineEdit
                value={company.notes || ""}
                onSave={updateField("notes")}
                placeholder="Legg til notater..."
                multiline
              />
            </div>
          </div>
        </div>
      </div>

      {/* Two columns: Left = oppfølginger + aktiviteter, Right = kontakter */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        {/* Left — 3/5 */}
        <section className="lg:col-span-3 space-y-8">
          {/* Oppfølginger */}
          <div className="space-y-4">
            <h2 className="text-label">Oppfølginger · {tasks.length}</h2>
            {tasks.length === 0 ? (
              <p className="text-[0.875rem] text-muted-foreground py-4">Ingen kommende oppfølginger</p>
            ) : (
              <div className="space-y-1">
                {tasks.map((task) => {
                  const overdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
                  const contactName = (task.contacts as any)?.first_name
                    ? `${(task.contacts as any).first_name} ${(task.contacts as any).last_name}`
                    : null;
                  return (
                    <div key={task.id} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-card transition-colors">
                      <Checkbox
                        checked={false}
                        onCheckedChange={() => toggleTaskMutation.mutate(task.id)}
                        className="flex-shrink-0 h-4 w-4 rounded-md border-border/60"
                      />
                      <Circle className={`h-2 w-2 fill-current ${priorityDots[task.priority]} flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.875rem] font-medium leading-snug truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {contactName && <span className="text-[0.75rem] text-muted-foreground">{contactName}</span>}
                          {task.due_date && (
                            <span className={`flex items-center gap-1 text-[0.75rem] ${overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                              <CalendarDays className="h-3 w-3 stroke-[1.5]" />
                              {format(new Date(task.due_date), "d. MMM", { locale: nb })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Aktiviteter */}
          <div className="space-y-4">
            <h2 className="text-label">Aktiviteter · {activities.length}</h2>
            {activities.length === 0 ? (
              <p className="text-[0.875rem] text-muted-foreground py-4">Ingen aktiviteter</p>
            ) : (
              <div className="space-y-1">
                {activities.map((activity) => {
                  const cfg = typeConfig[activity.type] || typeConfig.note;
                  const Icon = cfg.icon;
                  const contactName = (activity.contacts as any)?.first_name
                    ? `${(activity.contacts as any).first_name} ${(activity.contacts as any).last_name}`
                    : null;
                  return (
                    <div key={activity.id} className="flex items-start gap-3.5 px-4 py-3.5 rounded-xl hover:bg-card transition-colors">
                      <div className="mt-0.5 flex-shrink-0">
                        <Icon className={`h-4 w-4 stroke-[1.5] ${cfg.accent}`} />
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="text-[0.875rem] font-medium leading-snug">{activity.subject}</p>
                        {activity.description && (
                          <p className="text-[0.8125rem] text-muted-foreground leading-relaxed line-clamp-2">{activity.description}</p>
                        )}
                        <p className="text-[0.75rem] text-muted-foreground pt-0.5">
                          {contactName && <>{contactName} · </>}
                          {format(new Date(activity.created_at), "d. MMM yyyy", { locale: nb })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Right — 2/5: Kontakter */}
        <section className="lg:col-span-2 space-y-4">
          <h2 className="text-label">Kontakter · {contacts.length}</h2>
          {contacts.length === 0 ? (
            <p className="text-[0.875rem] text-muted-foreground py-4">Ingen kontakter</p>
          ) : (
            <div className="space-y-1">
              {contacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/kontakter/${c.id}`)}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl hover:bg-card active:bg-accent transition-colors group text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.9375rem] font-medium truncate">{c.first_name} {c.last_name}</p>
                    <p className="text-[0.8125rem] text-muted-foreground truncate">{c.title || "—"}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default CompanyDetail;
