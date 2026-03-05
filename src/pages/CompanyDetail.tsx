import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Globe, MapPin, ExternalLink, FileText, Phone, Calendar, Mail, Linkedin, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { toast } from "sonner";
import InlineEdit from "@/components/InlineEdit";

const typeConfig: Record<string, { label: string; icon: typeof FileText; accent: string }> = {
  note: { label: "Notat", icon: FileText, accent: "text-muted-foreground" },
  call: { label: "Samtale", icon: Phone, accent: "text-success" },
  meeting: { label: "Møte", icon: Calendar, accent: "text-primary" },
  email: { label: "E-post", icon: Mail, accent: "text-warning" },
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
        <Link to="/selskaper" className="inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-3.5 w-3.5 stroke-[1.5]" />
          Selskaper
        </Link>

        <div className="flex items-start gap-5">
          <div className="h-14 w-14 rounded-2xl bg-card border border-border/60 flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-foreground/70">{company.name.charAt(0)}</span>
          </div>
          <div className="space-y-1 min-w-0">
            <InlineEdit value={company.name} onSave={updateField("name")} className="text-[24px] font-bold tracking-tight" />
            <div className="flex items-center gap-4 text-[14px] text-muted-foreground">
              {company.org_number && <span className="text-mono">{company.org_number}</span>}
              {company.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 stroke-[1.5]" />{company.city}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Editable fields */}
      <section className="space-y-4">
        <h2 className="text-label">Selskapsinformasjon</h2>
        <div className="rounded-2xl bg-card border border-border/40 divide-y divide-border/40">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-[13px] text-muted-foreground w-36 flex-shrink-0">Selskapsnavn</span>
            <InlineEdit value={company.name} onSave={updateField("name")} />
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-[13px] text-muted-foreground w-36 flex-shrink-0">Org.nr</span>
            <InlineEdit value={company.org_number || ""} onSave={updateField("org_number")} placeholder="Legg til org.nr" mono />
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-[13px] text-muted-foreground w-36 flex-shrink-0">Sted</span>
            <InlineEdit value={company.city || ""} onSave={updateField("city")} placeholder="Legg til sted" />
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-[13px] text-muted-foreground w-36 flex-shrink-0">Nettside</span>
            <InlineEdit value={company.website || ""} onSave={updateField("website")} placeholder="Legg til nettside" type="url" />
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-[13px] text-muted-foreground w-36 flex-shrink-0">LinkedIn</span>
            <InlineEdit value={company.linkedin || ""} onSave={updateField("linkedin")} placeholder="Legg til LinkedIn" type="url" />
          </div>
        </div>
      </section>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Kontakter */}
        <section className="space-y-4">
          <h2 className="text-label">Kontakter · {contacts.length}</h2>
          {contacts.length === 0 ? (
            <p className="text-[14px] text-muted-foreground/60 py-8">Ingen kontakter knyttet til dette selskapet</p>
          ) : (
            <div className="space-y-1">
              {contacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/kontakter/${c.id}`)}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl hover:bg-card active:bg-accent transition-colors group text-left"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-[12px] font-semibold text-primary">{c.first_name[0]}{c.last_name[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium truncate">{c.first_name} {c.last_name}</p>
                    <p className="text-[13px] text-muted-foreground truncate">{c.title || "—"}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Aktiviteter */}
        <section className="space-y-4">
          <h2 className="text-label">Siste aktiviteter · {activities.length}</h2>
          {activities.length === 0 ? (
            <p className="text-[14px] text-muted-foreground/60 py-8">Ingen aktiviteter registrert</p>
          ) : (
            <div className="space-y-1">
              {activities.map((activity) => {
                const cfg = typeConfig[activity.type] || typeConfig.note;
                const Icon = cfg.icon;
                const contactName = (activity.contacts as any)?.first_name
                  ? `${(activity.contacts as any).first_name} ${(activity.contacts as any).last_name}`
                  : null;

                return (
                  <div key={activity.id} className="flex items-start gap-3.5 px-4 py-3.5 rounded-2xl hover:bg-card transition-colors">
                    <div className="mt-0.5 flex-shrink-0">
                      <Icon className={`h-4 w-4 stroke-[1.5] ${cfg.accent}`} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-[15px] font-medium leading-snug">{activity.subject}</p>
                      {activity.description && (
                        <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-2">{activity.description}</p>
                      )}
                      <p className="text-[12px] text-muted-foreground/50 pt-0.5">
                        {contactName && <>{contactName} · </>}
                        {format(new Date(activity.created_at), "d. MMMM yyyy", { locale: nb })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default CompanyDetail;
