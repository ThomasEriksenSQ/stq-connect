import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, FileText, Phone, Calendar, Mail, MapPin, ExternalLink, Building2, Linkedin } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

const typeConfig: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  note: { label: "Notat", icon: FileText, color: "bg-muted text-muted-foreground" },
  call: { label: "Samtale", icon: Phone, color: "bg-success/10 text-success" },
  meeting: { label: "Møte", icon: Calendar, color: "bg-primary/10 text-primary" },
  email: { label: "E-post", icon: Mail, color: "bg-warning/10 text-warning" },
};

const ContactDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activityOpen, setActivityOpen] = useState(false);
  const [actForm, setActForm] = useState({ type: "note", subject: "", description: "" });

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
        <div className="h-48 bg-card animate-pulse rounded-xl" />
      </div>
    );
  }
  if (!contact) return <p className="text-muted-foreground p-6">Kontakt ikke funnet</p>;

  const infoRows = [
    { label: "Stilling", value: contact.title },
    { label: "E-post", value: contact.email, href: contact.email ? `mailto:${contact.email}` : undefined },
    { label: "Telefon", value: contact.phone, href: contact.phone ? `tel:${contact.phone}` : undefined, mono: true },
    { label: "LinkedIn", value: (contact as any).linkedin, href: (contact as any).linkedin, external: true },
    { label: "Sted", value: (contact as any).location, icon: MapPin },
  ].filter(r => r.value);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/kontakter">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
            {contact.first_name[0]}{contact.last_name[0]}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Kontakt</p>
            <h1 className="text-xl font-bold tracking-tight truncate">
              {contact.first_name} {contact.last_name}
            </h1>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Timeline - 3/5 */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Aktiviteter ({activities.length})
            </h2>
            <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2 h-8 text-xs border-border/50">
                  <Plus className="h-3.5 w-3.5" />
                  Logg aktivitet
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Registrer aktivitet</DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createActivityMutation.mutate(); }} className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</Label>
                    <Select value={actForm.type} onValueChange={(v) => setActForm({ ...actForm, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="note">Notat</SelectItem>
                        <SelectItem value="call">Samtale</SelectItem>
                        <SelectItem value="meeting">Møte</SelectItem>
                        <SelectItem value="email">E-post</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Emne *</Label>
                    <Input value={actForm.subject} onChange={(e) => setActForm({ ...actForm, subject: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Beskrivelse</Label>
                    <Textarea value={actForm.description} onChange={(e) => setActForm({ ...actForm, description: e.target.value })} rows={3} />
                  </div>
                  <Button type="submit" className="w-full" disabled={createActivityMutation.isPending}>
                    {createActivityMutation.isPending ? "Registrerer..." : "Registrer"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {activities.length === 0 ? (
            <div className="rounded-xl bg-card border border-border/50 p-10 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Ingen aktiviteter ennå</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Logg din første aktivitet for denne kontakten</p>
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
                            <span className="text-[11px] text-muted-foreground/60 mt-1 block">
                              {format(new Date(activity.created_at), "d. MMM yyyy, HH:mm", { locale: nb })}
                            </span>
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

        {/* Info panel - 2/5 */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informasjon</h2>
          <div className="rounded-xl bg-card border border-border/50 divide-y divide-border/50">
            {/* Company link */}
            {(contact.companies as any)?.name && (
              <button
                onClick={() => navigate(`/selskaper/${(contact.companies as any).id}`)}
                className="w-full flex items-center gap-3 p-4 hover:bg-accent/30 transition-colors text-left group"
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider">Selskap</p>
                  <p className="text-sm font-medium group-hover:text-primary transition-colors truncate">{(contact.companies as any).name}</p>
                </div>
              </button>
            )}

            {/* Info rows */}
            {infoRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-muted-foreground">{row.label}</span>
                {row.href ? (
                  <a
                    href={row.href}
                    target={row.external ? "_blank" : undefined}
                    rel={row.external ? "noopener noreferrer" : undefined}
                    className={`text-sm font-medium text-primary hover:underline flex items-center gap-1 ${row.mono ? 'text-mono' : ''}`}
                  >
                    {row.external ? (
                      <>
                        {row.label === "LinkedIn" ? <Linkedin className="h-3 w-3" /> : null}
                        {row.label === "LinkedIn" ? "Profil" : row.value}
                        <ExternalLink className="h-3 w-3 opacity-50" />
                      </>
                    ) : row.value}
                  </a>
                ) : (
                  <span className={`text-sm font-medium flex items-center gap-1 ${row.mono ? 'text-mono' : ''}`}>
                    {row.icon && <row.icon className="h-3 w-3 text-muted-foreground" />}
                    {row.value}
                  </span>
                )}
              </div>
            ))}

            {/* Notes */}
            {contact.notes && (
              <div className="px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">Notater</p>
                <p className="text-sm leading-relaxed">{contact.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactDetail;
