import { useParams, useNavigate, Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Phone, Mail, MapPin, Calendar, Briefcase, MessageCircle, FileText, Plus, User, Pencil, Trash2, Check, X, ExternalLink, Sparkles } from "lucide-react";
import { format, differenceInMonths, differenceInYears, differenceInDays, addDays } from "date-fns";
import { nb } from "date-fns/locale";
import { cn, getInitials, formatMonths } from "@/lib/utils";
import { relativeDate } from "@/lib/relativeDate";
import { calcStacqPris } from "@/lib/stacqPris";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { AnsattDetailSheet } from "@/components/AnsattDetailSheet";

const fmt = (d: string | null) => d ? format(new Date(d), "d. MMM yyyy", { locale: nb }) : "–";

const AnsattDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [actOpen, setActOpen] = useState(false);
  const [actForm, setActForm] = useState({ type: "samtale", subject: "", description: "" });
  const [editingActId, setEditingActId] = useState<string | null>(null);
  const [editActForm, setEditActForm] = useState({ type: "samtale", subject: "", description: "", created_at: "" });
  const [matchSheetOpen, setMatchSheetOpen] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  const ansattId = Number(id);

  const { data: ansatt, isLoading } = useQuery({
    queryKey: ["ansatt-detail", ansattId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stacq_ansatte")
        .select("*")
        .eq("id", ansattId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !isNaN(ansattId),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data;
    },
  });
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.full_name]));

  const { data: cvDoc } = useQuery({
    queryKey: ["ansatt-cv-doc", ansattId],
    queryFn: async () => {
      const { data } = await supabase
        .from("cv_documents")
        .select("portrait_url")
        .eq("ansatt_id", ansattId)
        .maybeSingle();
      return data;
    },
    enabled: !isNaN(ansattId),
  });

  const { data: oppdrag = [] } = useQuery({
    queryKey: ["ansatt-oppdrag", ansattId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stacq_oppdrag")
        .select("*")
        .eq("ansatt_id", ansattId)
        .order("start_dato", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !isNaN(ansattId),
  });

  const { data: aktiviteter = [] } = useQuery({
    queryKey: ["ansatt-aktiviteter", ansattId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ansatt_aktiviteter" as any)
        .select("*")
        .eq("ansatt_id", ansattId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !isNaN(ansattId),
  });

  const { data: aktiveProsesser = [] } = useQuery({
    queryKey: ["ansatt-aktive-prosesser", ansattId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foresporsler_konsulenter")
        .select("id, status, foresporsler_id, foresporsler(id, selskap_navn, teknologier, referanse, kontakt_id, contacts(first_name, last_name))")
        .eq("ansatt_id", ansattId)
        .in("status", ["sendt_cv", "intervju"]);
      if (error) throw error;
      return data as any[];
    },
    enabled: !isNaN(ansattId),
  });

  const { data: tidligereProsesser = [] } = useQuery({
    queryKey: ["ansatt-tidligere-prosesser", ansattId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foresporsler_konsulenter")
        .select("id, status, foresporsler_id, foresporsler(id, selskap_navn, teknologier, referanse, kontakt_id, contacts(first_name, last_name))")
        .eq("ansatt_id", ansattId)
        .in("status", ["vunnet", "avslag", "bortfalt"]);
      if (error) throw error;
      return data as any[];
    },
    enabled: !isNaN(ansattId),
  });

  const { data: vunnetKontakter = [] } = useQuery({
    queryKey: ["ansatt-vunnet-kontakter", ansattId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foresporsler_konsulenter")
        .select("foresporsler(selskap_id, kontakt_id, contacts(first_name, last_name))")
        .eq("ansatt_id", ansattId)
        .eq("status", "vunnet");
      if (error) throw error;
      return data as any[];
    },
    enabled: !isNaN(ansattId),
  });

  const saveNoteMutation = useMutation({
    mutationFn: async (kommentar: string) => {
      const { error } = await supabase
        .from("stacq_ansatte")
        .update({ kommentar } as any)
        .eq("id", ansattId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ansatt-detail", ansattId] });
      setEditingNote(false);
      toast.success("Notat lagret");
    },
  });

  const createActivityMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("ansatt_aktiviteter" as any)
        .insert({
          ansatt_id: ansattId,
          type: actForm.type,
          subject: actForm.subject,
          description: actForm.description || null,
          created_by: user?.id,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ansatt-aktiviteter", ansattId] });
      setActOpen(false);
      setActForm({ type: "samtale", subject: "", description: "" });
      toast.success("Aktivitet registrert");
    },
    onError: () => toast.error("Kunne ikke registrere aktivitet"),
  });

  const updateActivityMutation = useMutation({
    mutationFn: async (actId: string) => {
      const { error } = await supabase
        .from("ansatt_aktiviteter" as any)
        .update({
          type: editActForm.type,
          subject: editActForm.subject,
          description: editActForm.description || null,
          created_at: new Date(editActForm.created_at).toISOString(),
        } as any)
        .eq("id", actId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ansatt-aktiviteter", ansattId] });
      setEditingActId(null);
      toast.success("Aktivitet oppdatert");
    },
    onError: () => toast.error("Kunne ikke oppdatere aktivitet"),
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (actId: string) => {
      const { error } = await supabase
        .from("ansatt_aktiviteter" as any)
        .delete()
        .eq("id", actId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ansatt-aktiviteter", ansattId] });
      toast.success("Aktivitet slettet");
    },
    onError: () => toast.error("Kunne ikke slette aktivitet"),
  });

  const startEditActivity = (act: any) => {
    setEditingActId(act.id);
    setEditActForm({
      type: act.type,
      subject: act.subject,
      description: act.description || "",
      created_at: format(new Date(act.created_at), "yyyy-MM-dd'T'HH:mm"),
    });
  };

  if (isLoading) return <p className="text-muted-foreground py-12 text-center">Laster...</p>;
  if (!ansatt) return <p className="text-muted-foreground py-12 text-center">Ansatt ikke funnet</p>;

  const today = new Date();
  const status = ansatt.status === "SLUTTET" ? "Sluttet"
    : ansatt.start_dato && new Date(ansatt.start_dato) > today ? "Kommende" : "Aktiv";

  const portrait = cvDoc?.portrait_url || ansatt.bilde_url;
  const durationMonths = ansatt.start_dato
    ? differenceInMonths(ansatt.slutt_dato ? new Date(ansatt.slutt_dato) : today, new Date(ansatt.start_dato))
    : null;

  const activeOppdrag = oppdrag.filter((o: any) => o.status === "Aktiv" || o.status === "Oppstart");
  const previousOppdrag = oppdrag.filter((o: any) => o.status !== "Aktiv" && o.status !== "Oppstart");

  const statusColor = status === "Aktiv"
    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
    : status === "Kommende"
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : "bg-gray-100 text-gray-600 border-gray-200";

  const selskapIdToKontakt: Record<string, string> = {};
  for (const vk of vunnetKontakter) {
    const f = vk.foresporsler;
    if (f?.selskap_id && f?.contacts) {
      selskapIdToKontakt[f.selskap_id] = `${f.contacts.first_name} ${f.contacts.last_name}`.trim();
    }
  }

  const getContactName = (f: any) => {
    if (!f?.contacts) return null;
    return `${f.contacts.first_name} ${f.contacts.last_name}`.trim() || null;
  };

  return (
    <div className="max-w-5xl space-y-6">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5 stroke-[1.5]" />
        Tilbake
      </button>

      {/* HEADER */}
      <div className="flex items-center gap-5">
        {portrait ? (
          <img src={portrait} alt={ansatt.navn} className="w-20 h-20 rounded-full object-cover border-2 border-border" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-primary/10 text-primary text-xl font-bold flex items-center justify-center">
            {getInitials(ansatt.navn)}
          </div>
        )}
        <div>
          <h1 className="text-[1.5rem] font-bold">{ansatt.navn}</h1>
          <Badge className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold mt-1", statusColor)}>
            {status}
          </Badge>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => navigate(`/cv-admin/${ansatt.id}`)}
            className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            CV-editor
          </button>
          <button
            onClick={() => setMatchSheetOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Finn oppdrag
          </button>
          <button
            onClick={() => setEditSheetOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg border border-border bg-background text-foreground hover:bg-secondary"
          >
            <Pencil className="h-3.5 w-3.5" />
            Rediger
          </button>
        </div>
      </div>

      {/* INFO GRID */}
      <Card className="bg-card border border-border rounded-lg shadow-card">
        <CardContent className="p-5">
          <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-4">Informasjon</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
            {/* Kolonne 1 */}
            <InfoRow icon={Mail} label="E-post" value={ansatt.epost} />
            <InfoRow icon={Calendar} label="Tilgjengelig fra" value={fmt(ansatt.tilgjengelig_fra)} />
            <InfoRow icon={Calendar} label="Startdato" value={fmt(ansatt.start_dato)} />

            {/* Kolonne 2 */}
            <InfoRow icon={Phone} label="Telefon" value={ansatt.tlf} />
            <InfoRow icon={Briefcase} label="Års erfaring" value={ansatt.erfaring_aar ? `${new Date().getFullYear() - ansatt.erfaring_aar} år` : "–"} />
            <InfoRow icon={User} label="Ansatt i" value={durationMonths != null ? formatMonths(durationMonths) : "–"} />

            {/* Kolonne 3 */}
            <InfoRow icon={MapPin} label="Geografi" value={ansatt.geografi || "–"} />
            <InfoRow
              icon={Calendar}
              label="Fødselsdato"
              value={
                (ansatt as any).fodselsdato
                  ? `${fmt((ansatt as any).fodselsdato)} (${differenceInYears(new Date(), new Date((ansatt as any).fodselsdato))} år)`
                  : "–"
              }
            />
            <InfoRow icon={Calendar} label="Sluttdato" value={fmt(ansatt.slutt_dato)} />
          </div>
          {ansatt.kompetanse && ansatt.kompetanse.length > 0 && (
            <KompetanseCollapsible kompetanse={ansatt.kompetanse} />
          )}
        </CardContent>
      </Card>

      {/* OPPDRAG */}
      <Card className="bg-card border border-border rounded-lg shadow-card">
        <CardContent className="p-5">
          <Tabs defaultValue={ansatt.tilgjengelig_fra ? "prosesser" : "aktive"}>
            <TabsList>
              {ansatt.tilgjengelig_fra ? (
                <>
                  <TabsTrigger value="prosesser">Aktive prosesser ({aktiveProsesser.length})</TabsTrigger>
                  <TabsTrigger value="tidl-prosesser">Tidligere prosesser ({tidligereProsesser.length})</TabsTrigger>
                  <TabsTrigger value="aktive">Aktive oppdrag ({activeOppdrag.length})</TabsTrigger>
                  <TabsTrigger value="tidligere">Tidligere oppdrag ({previousOppdrag.length})</TabsTrigger>
                </>
              ) : (
                <>
                  <TabsTrigger value="aktive">Aktive oppdrag ({activeOppdrag.length})</TabsTrigger>
                  <TabsTrigger value="tidligere">Tidligere oppdrag ({previousOppdrag.length})</TabsTrigger>
                  <TabsTrigger value="prosesser">Aktive prosesser ({aktiveProsesser.length})</TabsTrigger>
                  <TabsTrigger value="tidl-prosesser">Tidligere prosesser ({tidligereProsesser.length})</TabsTrigger>
                </>
              )}
            </TabsList>
            <TabsContent value="aktive">
              {activeOppdrag.length === 0 ? (
                <p className="text-[0.8125rem] text-muted-foreground">Ingen aktive oppdrag</p>
              ) : (
                <div className="space-y-3">
                  {activeOppdrag.map((o: any) => (
                    <OppdragRow key={o.id} o={o} isActive kontaktNavn={selskapIdToKontakt[o.selskap_id]} />
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="tidligere">
              {previousOppdrag.length === 0 ? (
                <p className="text-[0.8125rem] text-muted-foreground">Ingen tidligere oppdrag</p>
              ) : (
                <div className="space-y-3">
                  {previousOppdrag.map((o: any) => (
                    <OppdragRow key={o.id} o={o} isActive={false} kontaktNavn={selskapIdToKontakt[o.selskap_id]} />
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="prosesser">
              {aktiveProsesser.length === 0 ? (
                <p className="text-[0.8125rem] text-muted-foreground">Ingen aktive prosesser</p>
              ) : (
                <div className="space-y-2">
                  {aktiveProsesser.map((ap: any) => {
                    const f = ap.foresporsler;
                    const kontaktNavn = getContactName(f);
                    const statusLabel = ap.status === "intervju" ? "Intervju" : "Sendt CV";
                    const statusColor = ap.status === "intervju"
                      ? "bg-amber-100 text-amber-800 border-amber-200"
                      : "bg-blue-100 text-blue-800 border-blue-200";
                    return (
                      <Link
                        key={ap.id}
                        to="/foresporsler"
                        className="flex flex-col gap-1 py-2 px-3 rounded-lg bg-background border border-border transition-colors hover:bg-secondary/40"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[0.9375rem] font-medium text-foreground">{f?.selskap_navn || "Ukjent"}</p>
                            {kontaktNavn && <p className="text-[0.75rem] text-muted-foreground">{kontaktNavn}</p>}
                          </div>
                          <Badge className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", statusColor)}>
                            {statusLabel}
                          </Badge>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </TabsContent>
            <TabsContent value="tidl-prosesser">
              {tidligereProsesser.length === 0 ? (
                <p className="text-[0.8125rem] text-muted-foreground">Ingen tidligere prosesser</p>
              ) : (
                <div className="space-y-2">
                  {tidligereProsesser.map((ap: any) => {
                    const f = ap.foresporsler;
                    const kontaktNavn = getContactName(f);
                    const statusLabel = ap.status === "vunnet" ? "Vunnet" : ap.status === "avslag" ? "Avslag" : "Bortfalt";
                    const statusColor = ap.status === "vunnet"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : ap.status === "avslag"
                        ? "bg-red-100 text-red-800 border-red-200"
                        : "bg-gray-100 text-gray-600 border-gray-200";
                    return (
                      <Link
                        key={ap.id}
                        to="/foresporsler"
                        className="flex flex-col gap-1 py-2 px-3 rounded-lg bg-background border border-border transition-colors hover:bg-secondary/40"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={cn("text-[0.9375rem] font-medium text-foreground", ap.status === "bortfalt" && "line-through text-muted-foreground")}>{f?.selskap_navn || "Ukjent"}</p>
                            {kontaktNavn && <p className={cn("text-[0.75rem] text-muted-foreground", ap.status === "bortfalt" && "line-through")}>{kontaktNavn}</p>}
                          </div>
                          <Badge className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", statusColor, ap.status === "bortfalt" && "line-through")}>
                            {statusLabel}
                          </Badge>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* NOTAT */}
      <Card className="bg-card border border-border rounded-lg shadow-card">
        <CardContent className="p-5">
          <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-3">Notat</h2>
          {editingNote ? (
            <div className="space-y-2">
              <Textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={4}
                className="text-[0.9375rem]"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveNoteMutation.mutate(noteDraft)} disabled={saveNoteMutation.isPending}>
                  Lagre
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingNote(false)}>Avbryt</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setNoteDraft(ansatt.kommentar || ""); setEditingNote(true); }}
              className="text-[0.9375rem] text-foreground/70 leading-relaxed whitespace-pre-wrap w-full text-left hover:text-foreground/90 transition-colors cursor-pointer"
            >
              {ansatt.kommentar || <span className="text-muted-foreground/40 italic">Klikk for å skrive notat...</span>}
            </button>
          )}
        </CardContent>
      </Card>

      {/* AKTIVITETER */}
      <Card className="bg-card border border-border rounded-lg shadow-card">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">Aktiviteter</h2>
            <Dialog open={actOpen} onOpenChange={setActOpen}>
              <DialogTrigger asChild>
                <button className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-[hsl(var(--success))] text-white hover:opacity-90">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Logg aktivitet
                </button>
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
                        <SelectItem value="samtale">Samtale</SelectItem>
                        <SelectItem value="møte">Møte</SelectItem>
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

          {aktiviteter.length === 0 ? (
            <p className="text-[0.8125rem] text-muted-foreground">Ingen aktiviteter registrert</p>
          ) : (
            <div className="relative ml-7 space-y-4">
              <div className="absolute left-[5px] top-[5px] bottom-0 w-[2px] bg-border" />
              {aktiviteter.map((act: any) => {
                const Icon = act.type === "møte" ? FileText : MessageCircle;
                const iconColor = act.type === "møte" ? "text-primary" : "text-[hsl(var(--success))]";
                const isEditing = editingActId === act.id;
                return (
                  <div key={act.id} className="group relative pl-7">
                    <div className={cn("absolute -left-7 top-[2px] w-[12px] h-[12px] bg-background rounded-full flex items-center justify-center")}>
                      <Icon className={cn("h-3 w-3", iconColor)} />
                    </div>
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Select value={editActForm.type} onValueChange={(v) => setEditActForm({ ...editActForm, type: v })}>
                            <SelectTrigger className="w-32 h-8 text-[0.8125rem]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="samtale">Samtale</SelectItem>
                              <SelectItem value="møte">Møte</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="datetime-local"
                            value={editActForm.created_at}
                            onChange={(e) => setEditActForm({ ...editActForm, created_at: e.target.value })}
                            className="w-52 h-8 text-[0.8125rem]"
                          />
                        </div>
                        <Input
                          value={editActForm.subject}
                          onChange={(e) => setEditActForm({ ...editActForm, subject: e.target.value })}
                          placeholder="Emne"
                          className="text-[0.9375rem]"
                        />
                        <Textarea
                          value={editActForm.description}
                          onChange={(e) => setEditActForm({ ...editActForm, description: e.target.value })}
                          placeholder="Beskrivelse"
                          rows={3}
                          className="text-[0.9375rem]"
                        />
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => updateActivityMutation.mutate(act.id)}
                            disabled={updateActivityMutation.isPending || !editActForm.subject.trim()}
                            className="p-1 rounded-md hover:bg-primary/10 text-primary transition-colors"
                          >
                            <Check className="h-4 w-4 stroke-[2]" />
                          </button>
                          <button onClick={() => setEditingActId(null)} className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground transition-colors">
                            <X className="h-4 w-4 stroke-[2]" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <span className="text-[1.0625rem] font-bold text-foreground">{act.subject}</span>
                            {act.description && (
                              <p className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-foreground/70 mt-0.5">{act.description}</p>
                            )}
                            <span className="text-[0.8125rem] text-muted-foreground">
                              {format(new Date(act.created_at), "d. MMM yyyy", { locale: nb })} · {relativeDate(act.created_at)}
                              {act.created_by && profileMap[act.created_by] && (
                                <> · <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[0.6875rem] font-medium">{profileMap[act.created_by]}</span></>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                            <button onClick={() => startEditActivity(act)} className="p-1 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
                                  <AlertDialogDescription>Aktiviteten "{act.subject}" vil bli permanent slettet.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Avbryt</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteActivityMutation.mutate(act.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Ja, slett
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <AnsattDetailSheet open={matchSheetOpen} onClose={() => setMatchSheetOpen(false)} ansatt={ansatt} openInEditMode={false} autoRunMatch={false} />
      <AnsattDetailSheet open={editSheetOpen} onClose={() => setEditSheetOpen(false)} ansatt={ansatt} openInEditMode={true} autoRunMatch={false} />
    </div>
  );
};

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      <span className="text-[0.75rem] text-muted-foreground w-28 flex-shrink-0">{label}</span>
      <span className="text-[0.875rem] font-medium text-foreground">{value || "–"}</span>
    </div>
  );
}

function OppdragRow({ o, isActive = false, kontaktNavn }: { o: any; isActive?: boolean; kontaktNavn?: string }) {
  const margin = o.utpris ? calcStacqPris({
    utpris: o.utpris,
    til_konsulent: o.til_konsulent,
    til_konsulent_override: o.til_konsulent_override,
    er_ansatt: !!o.er_ansatt,
    ekstra_kostnad: o.ekstra_kostnad,
  }) : null;

  // Renewal info for active assignments
  const renewalDate = isActive
    ? o.lopende_30_dager
      ? addDays(new Date(), 30)
      : o.forny_dato ? new Date(o.forny_dato) : null
    : null;
  const daysToRenewal = renewalDate ? differenceInDays(renewalDate, new Date()) : null;

  // Duration for previous assignments
  const duration = !isActive && o.start_dato && o.slutt_dato
    ? differenceInMonths(new Date(o.slutt_dato), new Date(o.start_dato))
    : null;

  return (
    <div className="flex flex-col gap-2 py-2 px-3 rounded-lg bg-background border border-border">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-0">
            <span className="text-[0.9375rem] font-medium text-foreground">{o.kunde || "Ukjent kunde"}</span>
            {o.start_dato && (
              <span className="text-[0.8125rem] text-muted-foreground sm:ml-2">
                {fmt(o.start_dato)} – {fmt(o.slutt_dato)}
              </span>
            )}
            {duration != null && (
              <span className="text-[0.8125rem] text-muted-foreground sm:ml-2">
                · {formatMonths(duration)}
              </span>
            )}
          </div>
          {kontaktNavn && <p className="text-[0.75rem] text-muted-foreground">{kontaktNavn}</p>}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem]">
          {o.utpris != null && <span className="text-muted-foreground">Utpris: <span className="font-medium text-foreground">{o.utpris} kr</span></span>}
          {o.til_konsulent != null && <span className="text-muted-foreground">Til kons: <span className="font-medium text-foreground">{o.til_konsulent_override ?? o.til_konsulent} kr</span></span>}
          {margin != null && <span className="text-muted-foreground">Margin: <span className="font-medium text-emerald-600">{margin} kr</span></span>}
        </div>
        <Badge variant="secondary" className={cn("text-xs self-start sm:self-auto",
          o.status === "Aktiv" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
          o.status === "Oppstart" ? "bg-amber-100 text-amber-700 border-amber-200" :
          "bg-gray-100 text-gray-600 border-gray-200"
        )}>
          {o.status || "–"}
        </Badge>
      </div>
      {isActive && renewalDate && daysToRenewal != null && (
        <div className="text-[0.8125rem]">
          <span className="text-muted-foreground">Fornyes: </span>
          <span className={cn(
            daysToRenewal <= 0 ? "text-destructive font-semibold" :
            daysToRenewal <= 30 ? "text-amber-600 font-semibold" :
            "text-muted-foreground"
          )}>
            {format(renewalDate, "d. MMM yyyy", { locale: nb })}
            {" "}({daysToRenewal <= 0 ? "utløpt" : `${daysToRenewal} dager`})
            {o.lopende_30_dager && <span className="text-muted-foreground font-normal ml-1">· Løpende 30d</span>}
          </span>
        </div>
      )}
    </div>
  );
}

function KompetanseCollapsible({ kompetanse }: { kompetanse: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [needsTruncation, setNeedsTruncation] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Check if content exceeds one line (~36px)
    setNeedsTruncation(el.scrollHeight > 40);
  }, [kompetanse]);

  return (
    <div className="mt-4">
      <span className="text-[0.6875rem] text-muted-foreground uppercase tracking-[0.08em] font-medium">Kompetanse</span>
      <div
        ref={containerRef}
        className={cn("flex flex-wrap gap-1.5 mt-1.5 overflow-hidden transition-all", !expanded && "max-h-[26px]")}
      >
        {kompetanse.map((k: string) => (
          <Badge key={k} variant="secondary" className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
            {k}
          </Badge>
        ))}
      </div>
      {needsTruncation && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[0.75rem] text-primary hover:underline mt-1"
        >
          {expanded ? "Vis mindre" : "Vis mer"}
        </button>
      )}
    </div>
  );
}

export default AnsattDetail;
