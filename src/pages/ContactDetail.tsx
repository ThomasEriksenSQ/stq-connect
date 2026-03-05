import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, User, Plus, FileText, Phone, Calendar, Mail, Building2, MapPin, Linkedin, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { useState } from "react";

const typeLabels: Record<string, { label: string; icon: typeof FileText }> = {
  note: { label: "Notat", icon: FileText },
  call: { label: "Samtale", icon: Phone },
  meeting: { label: "Møte", icon: Calendar },
  email: { label: "E-post", icon: Mail },
};

const ContactDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
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

  if (isLoading) return <p className="text-muted-foreground p-6">Laster...</p>;
  if (!contact) return <p className="text-muted-foreground p-6">Kontakt ikke funnet</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/kontakter">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <User className="h-4 w-4" />
            <span>Kontakt</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {contact.first_name} {contact.last_name}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info - right panel on desktop */}
        <div className="lg:col-span-1 lg:order-2 space-y-4">
          <Card>
            <CardContent className="py-5 space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Kontaktinformasjon</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Navn</span>
                  <span className="font-medium">{contact.first_name} {contact.last_name}</span>
                </div>
                {contact.title && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stilling</span>
                    <span className="font-medium">{contact.title}</span>
                  </div>
                )}
                {(contact.companies as any)?.name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Selskap</span>
                    <Link to={`/selskaper/${(contact.companies as any).id}`} className="font-medium text-primary hover:underline">
                      {(contact.companies as any).name}
                    </Link>
                  </div>
                )}
                {contact.email && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">E-post</span>
                    <a href={`mailto:${contact.email}`} className="font-medium text-primary hover:underline">{contact.email}</a>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Telefon</span>
                    <a href={`tel:${contact.phone}`} className="font-medium text-primary hover:underline">{contact.phone}</a>
                  </div>
                )}
                {(contact as any).linkedin && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">LinkedIn</span>
                    <a href={(contact as any).linkedin} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline flex items-center gap-1">
                      Profil <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {(contact as any).location && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sted</span>
                    <span className="font-medium flex items-center gap-1">
                      <MapPin className="h-3 w-3" />{(contact as any).location}
                    </span>
                  </div>
                )}
                {contact.notes && (
                  <div className="pt-2 border-t">
                    <span className="text-muted-foreground block mb-1">Notater</span>
                    <p className="text-sm">{contact.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Timeline */}
        <div className="lg:col-span-2 lg:order-1 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Aktiviteter</h2>
            <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" />Logg aktivitet</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Registrer aktivitet</DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createActivityMutation.mutate(); }} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
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
                    <Label>Emne *</Label>
                    <Input value={actForm.subject} onChange={(e) => setActForm({ ...actForm, subject: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Beskrivelse</Label>
                    <Textarea value={actForm.description} onChange={(e) => setActForm({ ...actForm, description: e.target.value })} />
                  </div>
                  <Button type="submit" className="w-full" disabled={createActivityMutation.isPending}>
                    {createActivityMutation.isPending ? "Registrerer..." : "Registrer"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {activities.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground">Ingen aktiviteter registrert</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedActivities).map(([monthLabel, acts]) => (
                <div key={monthLabel}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 capitalize">{monthLabel}</h3>
                  <div className="space-y-2 border-l-2 border-border pl-4">
                    {acts.map((activity) => {
                      const typeInfo = typeLabels[activity.type] || typeLabels.note;
                      const Icon = typeInfo.icon;
                      return (
                        <div key={activity.id} className="relative flex items-start gap-3 pb-3">
                          <div className="absolute -left-[1.35rem] top-1 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{activity.subject}</span>
                              <Badge variant="secondary" className="text-xs">{typeInfo.label}</Badge>
                            </div>
                            {activity.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{activity.description}</p>
                            )}
                            <span className="text-xs text-muted-foreground mt-1">
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
      </div>
    </div>
  );
};

export default ContactDetail;
