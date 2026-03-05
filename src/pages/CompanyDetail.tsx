import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2, Globe, MapPin, ExternalLink, FileText, Phone, Calendar, Mail, Users, Linkedin } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

const typeConfig: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  note: { label: "Notat", icon: FileText, color: "bg-muted text-muted-foreground" },
  call: { label: "Samtale", icon: Phone, color: "bg-success/10 text-success" },
  meeting: { label: "Møte", icon: Calendar, color: "bg-primary/10 text-primary" },
  email: { label: "E-post", icon: Mail, color: "bg-warning/10 text-warning" },
};

const CompanyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("company_id", id!)
        .order("first_name");
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

  // Group activities by month
  const groupedActivities = activities.reduce<Record<string, typeof activities>>((acc, act) => {
    const key = format(new Date(act.created_at), "MMMM yyyy", { locale: nb });
    if (!acc[key]) acc[key] = [];
    acc[key].push(act);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-card animate-pulse rounded-lg" />
        <div className="h-32 bg-card animate-pulse rounded-xl" />
      </div>
    );
  }
  if (!company) return <p className="text-muted-foreground p-6">Selskap ikke funnet</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/selskaper">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Selskap</p>
          <h1 className="text-xl font-bold tracking-tight truncate">{company.name}</h1>
        </div>
      </div>

      {/* Info bar */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {company.org_number && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border/50 text-mono text-xs">
            {company.org_number}
          </span>
        )}
        {company.city && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border/50 text-xs">
            <MapPin className="h-3 w-3 text-muted-foreground" />{company.city}
          </span>
        )}
        {company.website && (
          <a href={company.website} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border/50 text-xs text-primary hover:border-primary/40 transition-colors">
            <Globe className="h-3 w-3" />{company.website.replace(/^https?:\/\//, '')}
            <ExternalLink className="h-3 w-3 opacity-50" />
          </a>
        )}
        {(company as any).linkedin && (
          <a href={(company as any).linkedin} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border/50 text-xs text-primary hover:border-primary/40 transition-colors">
            <Linkedin className="h-3 w-3" />LinkedIn
            <ExternalLink className="h-3 w-3 opacity-50" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Timeline - 3/5 */}
        <div className="lg:col-span-3 space-y-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Aktiviteter ({activities.length})
          </h2>

          {activities.length === 0 ? (
            <div className="rounded-xl bg-card border border-border/50 p-10 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Ingen aktiviteter ennå</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Logg aktiviteter fra en kontakt</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedActivities).map(([monthLabel, acts]) => (
                <div key={monthLabel}>
                  <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2 capitalize">{monthLabel}</p>
                  <div className="space-y-1 border-l border-border/50 ml-2">
                    {acts.map((activity) => {
                      const cfg = typeConfig[activity.type] || typeConfig.note;
                      const Icon = cfg.icon;
                      return (
                        <div key={activity.id} className="relative flex items-start gap-3 pl-5 py-2 group">
                          <div className="absolute left-[-5px] top-3.5 h-2.5 w-2.5 rounded-full bg-border group-hover:bg-primary transition-colors" />
                          <div className={`h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{activity.subject}</span>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{cfg.label}</Badge>
                            </div>
                            {activity.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{activity.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground/60">
                              {(activity.contacts as any)?.first_name && (
                                <span>{(activity.contacts as any).first_name} {(activity.contacts as any).last_name}</span>
                              )}
                              <span>·</span>
                              <span>{format(new Date(activity.created_at), "d. MMM yyyy, HH:mm", { locale: nb })}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contacts - 2/5 */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            Kontakter ({contacts.length})
          </h2>

          {contacts.length === 0 ? (
            <div className="rounded-xl bg-card border border-border/50 p-8 text-center">
              <p className="text-sm text-muted-foreground">Ingen kontakter</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {contacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/kontakter/${c.id}`)}
                  className="w-full text-left p-3 rounded-xl bg-card border border-border/50 hover:border-primary/30 hover:bg-accent/30 transition-all duration-150 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs flex-shrink-0">
                      {c.first_name[0]}{c.last_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {c.first_name} {c.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{c.title || "Ingen stilling"}</p>
                    </div>
                    {c.phone && (
                      <span className="text-[11px] text-muted-foreground/60 text-mono hidden sm:block">{c.phone}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompanyDetail;
