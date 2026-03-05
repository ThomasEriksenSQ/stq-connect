import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Building2, Plus, FileText, Phone, Calendar, Mail, Users } from "lucide-react";
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

const CompanyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activityOpen, setActivityOpen] = useState(false);
  const [actForm, setActForm] = useState({ type: "note", subject: "", description: "", contact_id: "" });

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

  const createActivityMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("activities").insert({
        type: actForm.type,
        subject: actForm.subject,
        description: actForm.description || null,
        company_id: id,
        contact_id: actForm.contact_id || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-activities", id] });
      setActivityOpen(false);
      setActForm({ type: "note", subject: "", description: "", contact_id: "" });
      toast.success("Aktivitet registrert");
    },
    onError: () => toast.error("Kunne ikke registrere aktivitet"),
  });

  // Group activities by month/year
  const groupedActivities = activities.reduce<Record<string, typeof activities>>((acc, act) => {
    const key = format(new Date(act.created_at), "MMMM yyyy", { locale: nb });
    if (!acc[key]) acc[key] = [];
    acc[key].push(act);
    return acc;
  }, {});

  if (isLoading) return <p className="text-muted-foreground p-6">Laster...</p>;
  if (!company) return <p className="text-muted-foreground p-6">Selskap ikke funnet</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/selskaper">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Building2 className="h-4 w-4" />
            <span>Selskap</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{company.name}</h1>
        </div>
      </div>

      {/* Company info summary */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {company.org_number && (
              <div>
                <span className="text-muted-foreground">Org.nr</span>
                <p className="font-medium">{company.org_number}</p>
              </div>
            )}
            {company.industry && (
              <div>
                <span className="text-muted-foreground">Bransje</span>
                <p className="font-medium">{company.industry}</p>
              </div>
            )}
            {company.city && (
              <div>
                <span className="text-muted-foreground">By</span>
                <p className="font-medium">{company.city}</p>
              </div>
            )}
            {company.phone && (
              <div>
                <span className="text-muted-foreground">Telefon</span>
                <p className="font-medium">{company.phone}</p>
              </div>
            )}
            {company.email && (
              <div>
                <span className="text-muted-foreground">E-post</span>
                <p className="font-medium">{company.email}</p>
              </div>
            )}
            {company.website && (
              <div>
                <span className="text-muted-foreground">Nettside</span>
                <p className="font-medium">{company.website}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Timeline - left 2/3 */}
        <div className="lg:col-span-2 space-y-4">
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
                  <div className="space-y-2">
                    <Label>Kontakt</Label>
                    <Select value={actForm.contact_id} onValueChange={(v) => setActForm({ ...actForm, contact_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Velg kontakt" /></SelectTrigger>
                      <SelectContent>
                        {contacts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              {(activity.contacts as any)?.first_name && (
                                <span>{(activity.contacts as any).first_name} {(activity.contacts as any).last_name}</span>
                              )}
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

        {/* Contacts panel - right 1/3 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              Kontakter ({contacts.length})
            </h2>
          </div>
          {contacts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground text-sm">Ingen kontakter</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Stilling</TableHead>
                    <TableHead>Telefon</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => window.location.href = `/kontakter/${c.id}`}>
                      <TableCell>
                        <Link to={`/kontakter/${c.id}`} className="font-medium text-primary hover:underline">
                          {c.first_name} {c.last_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{c.title || "—"}</TableCell>
                      <TableCell className="text-sm">{c.phone || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompanyDetail;
