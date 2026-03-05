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
import { ArrowLeft, Plus, FileText, Phone, Calendar, Mail, Building2, Linkedin, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import InlineEdit from "@/components/InlineEdit";

const typeConfig: Record<string, { label: string; icon: typeof FileText; accent: string }> = {
  note: { label: "Notat", icon: FileText, accent: "text-muted-foreground" },
  call: { label: "Samtale", icon: Phone, accent: "text-success" },
  meeting: { label: "Møte", icon: Calendar, accent: "text-primary" },
  email: { label: "E-post", icon: Mail, accent: "text-warning" },
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-card animate-pulse rounded-xl" />
        <div className="h-40 bg-card animate-pulse rounded-2xl" />
      </div>
    );
  }
  if (!contact) return <p className="text-muted-foreground">Kontakt ikke funnet</p>;

  const detailFields = [
    { label: "Fornavn", field: "first_name", value: contact.first_name },
    { label: "Etternavn", field: "last_name", value: contact.last_name },
    { label: "Stilling", field: "title", value: contact.title || "" },
    { label: "E-post", field: "email", value: contact.email || "", type: "email" as const },
    { label: "Telefon", field: "phone", value: contact.phone || "", type: "tel" as const, mono: true },
    { label: "LinkedIn", field: "linkedin", value: contact.linkedin || "", type: "url" as const },
    { label: "Sted", field: "location", value: contact.location || "" },
  ];

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <Link to="/kontakter" className="inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-3.5 w-3.5 stroke-[1.5]" />
          Kontakter
        </Link>

        <div className="flex items-start gap-5">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold text-primary">{contact.first_name[0]}{contact.last_name[0]}</span>
          </div>
          <div className="space-y-1.5 min-w-0">
            <h1 className="text-[24px] font-bold tracking-tight">
              {contact.first_name} {contact.last_name}
            </h1>
            <div className="flex items-center gap-3 flex-wrap">
              {contact.title && <span className="text-[15px] text-muted-foreground">{contact.title}</span>}
              {(contact.companies as any)?.name && (
                <button
                  onClick={() => navigate(`/selskaper/${(contact.companies as any).id}`)}
                  className="inline-flex items-center gap-1.5 text-[14px] text-primary hover:underline"
                >
                  <Building2 className="h-3.5 w-3.5 stroke-[1.5]" />
                  {(contact.companies as any).name}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Two column */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        {/* Left: Activity timeline — 3/5 */}
        <section className="lg:col-span-3 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-label">Aktiviteter · {activities.length}</h2>
            <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-xl h-8 px-3 text-[12px] font-medium gap-1.5 border-border/40 hover:bg-card">
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
                      <SelectTrigger className="h-11 rounded-xl text-[15px] bg-secondary/50"><SelectValue /></SelectTrigger>
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
                    <Input value={actForm.subject} onChange={(e) => setActForm({ ...actForm, subject: e.target.value })} required className="h-11 rounded-xl text-[15px] bg-secondary/50" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-label">Beskrivelse</Label>
                    <Textarea value={actForm.description} onChange={(e) => setActForm({ ...actForm, description: e.target.value })} rows={3} className="rounded-xl text-[15px] bg-secondary/50 min-h-[80px]" />
                  </div>
                  <Button type="submit" className="w-full h-11 rounded-xl text-[14px] font-semibold" disabled={createActivityMutation.isPending}>
                    {createActivityMutation.isPending ? "Registrerer..." : "Registrer"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {activities.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[15px] text-muted-foreground/60">Ingen aktiviteter ennå</p>
            </div>
          ) : (
            <div className="space-y-1">
              {activities.map((activity) => {
                const cfg = typeConfig[activity.type] || typeConfig.note;
                const Icon = cfg.icon;
                return (
                  <div key={activity.id} className="flex items-start gap-3.5 px-4 py-3.5 rounded-2xl hover:bg-card transition-colors">
                    <div className="mt-0.5 flex-shrink-0">
                      <Icon className={`h-4 w-4 stroke-[1.5] ${cfg.accent}`} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="text-[15px] font-medium leading-snug">{activity.subject}</p>
                        <span className="text-[11px] text-muted-foreground/40 font-medium">{cfg.label}</span>
                      </div>
                      {activity.description && (
                        <p className="text-[14px] text-muted-foreground leading-relaxed">{activity.description}</p>
                      )}
                      <p className="text-[12px] text-muted-foreground/40 pt-0.5">
                        {format(new Date(activity.created_at), "d. MMMM yyyy 'kl.' HH:mm", { locale: nb })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right: Editable details — 2/5 */}
        <section className="lg:col-span-2 space-y-5">
          <h2 className="text-label">Detaljer</h2>
          <div className="rounded-2xl bg-card border border-border/40 divide-y divide-border/40">
            {detailFields.map((row) => (
              <div key={row.field} className="flex items-center justify-between px-5 py-4">
                <span className="text-[13px] text-muted-foreground w-24 flex-shrink-0">{row.label}</span>
                <InlineEdit
                  value={row.value}
                  onSave={updateField(row.field)}
                  placeholder={`Legg til ${row.label.toLowerCase()}`}
                  type={row.type}
                  mono={row.mono}
                />
              </div>
            ))}

            {/* Notes as multiline */}
            <div className="px-5 py-4 space-y-2">
              <span className="text-[13px] text-muted-foreground">Notater</span>
              <InlineEdit
                value={contact.notes || ""}
                onSave={updateField("notes")}
                placeholder="Legg til notater..."
                multiline
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ContactDetail;
