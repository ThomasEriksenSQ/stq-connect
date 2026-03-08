import { useState, useMemo } from "react";
import { DescriptionText } from "@/components/DescriptionText";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Mail, Globe, Linkedin, FileText, Calendar, CalendarDays, ExternalLink, ChevronRight, Pencil, User, MessageCircle, Plus, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { format, isPast, isToday, getYear } from "date-fns";
import { nb } from "date-fns/locale";
import { relativeDate, fullDate } from "@/lib/relativeDate";
import { cleanDescription } from "@/lib/cleanDescription";
import InlineEdit from "@/components/InlineEdit";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { CATEGORIES as SIGNAL_CATEGORIES, getEffectiveSignal, extractCategory } from "@/lib/categoryUtils";


/* ── Category system (shared with ContactCardContent) ── */
const CATEGORIES = [
  { label: "Behov nå", badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200", selectedColor: "bg-emerald-500 text-white border-emerald-500" },
  { label: "Får fremtidig behov", badgeColor: "bg-blue-100 text-blue-800 border-blue-200", selectedColor: "bg-blue-500 text-white border-blue-500" },
  { label: "Vil kanskje få behov", badgeColor: "bg-amber-100 text-amber-800 border-amber-200", selectedColor: "bg-amber-500 text-white border-amber-500" },
  { label: "Ukjent om behov", badgeColor: "bg-gray-100 text-gray-600 border-gray-200", selectedColor: "bg-gray-400 text-white border-gray-400" },
  { label: "Ikke aktuelt", badgeColor: "bg-red-50 text-red-700 border-red-200", selectedColor: "bg-red-400 text-white border-red-400" },
] as const;

const LEGACY_CATEGORY_MAP: Record<string, string> = {
  "Fremtidig behov": "Får fremtidig behov",
  "Har kanskje behov": "Vil kanskje få behov",
  "Aldri aktuelt": "Ikke aktuelt",
};

function normalizeCategoryLabel(label: string): string {
  return LEGACY_CATEGORY_MAP[label] || label;
}

function getCategoryBadgeColor(label: string) {
  const normalized = normalizeCategoryLabel(label);
  const cat = CATEGORIES.find((c) => c.label === normalized);
  return cat?.badgeColor || "bg-secondary text-foreground border-border";
}

function CategoryBadge({ label, className }: { label: string; className?: string }) {
  const normalized = normalizeCategoryLabel(label);
  const color = getCategoryBadgeColor(normalized);
  const isKnown = CATEGORIES.some((c) => c.label === normalized);
  if (!isKnown) return null;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", color, className)}>
      {normalized}
    </span>
  );
}

function CategoryPicker({ selected, onSelect }: { selected: string; onSelect: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.label}
          type="button"
          onClick={() => onSelect(cat.label)}
          className={cn(
            "h-7 px-2.5 text-[0.75rem] rounded-full border transition-all font-medium",
            selected === cat.label
              ? cat.selectedColor
              : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}

function buildDescriptionWithCategory(category: string, description: string): string {
  if (!category) return description;
  return description ? `[${category}]\n${description}` : `[${category}]`;
}

function parseDescriptionCategory(description: string | null): { category: string; text: string } {
  if (!description) return { category: "", text: "" };
  const match = description.match(/^\[([^\]]+)\]\n?([\s\S]*)$/);
  if (match) {
    const cat = match[1];
    if (CATEGORIES.some(c => c.label === cat) || Object.keys(LEGACY_CATEGORY_MAP).includes(cat)) {
      return { category: normalizeCategoryLabel(cat), text: match[2].trim() };
    }
  }
  return { category: "", text: description };
}

function extractTitleAndCategory(subject: string, description: string | null) {
  const normalizedSubject = normalizeCategoryLabel(subject);
  if (CATEGORIES.some(c => c.label === normalizedSubject)) {
    return { title: normalizedSubject, category: normalizedSubject, cleanDesc: "" };
  }
  const parsed = parseDescriptionCategory(description);
  return { title: subject, category: parsed.category, cleanDesc: cleanDescription(parsed.text) || "" };
}

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
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ first_name: "", last_name: "", email: "", phone: "", title: "", linkedin: "" });
  const { user } = useAuth();

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

  const changeSignalMutation = useMutation({
    mutationFn: async (newSignal: string) => {
      const { error } = await supabase.from("activities").insert({
        subject: newSignal,
        type: "note",
        company_id: companyId,
        created_by: user?.id,
        description: `[${newSignal}]`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-activities-direct", companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-contact-activities", companyId] });
      queryClient.invalidateQueries({ queryKey: ["companies-full"] });
      toast.success("Signal oppdatert");
    },
    onError: () => toast.error("Kunne ikke oppdatere signal"),
  });

  const updateField = (field: string) => (value: string) => {
    updateMutation.mutate({ [field]: value || null });
  };

  if (isLoading) {
    return <div className="space-y-3 animate-pulse"><div className="h-7 w-48 bg-secondary rounded" /><div className="h-4 w-32 bg-secondary rounded" /></div>;
  }
  if (!company) return <p className="text-sm text-muted-foreground">Selskap ikke funnet</p>;

  const STATUS_OPTIONS = [
    { value: "prospect", label: "Potensiell kunde", badgeColor: "bg-amber-100 text-amber-800 border-amber-200" },
    { value: "customer", label: "Kunde", badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    { value: "partner", label: "Partner", badgeColor: "bg-gray-100 text-gray-600 border-gray-200" },
    { value: "churned", label: "Ikke relevant selskap", badgeColor: "bg-red-50 text-red-700 border-red-200" },
  ] as const;
  const currentStatus = STATUS_OPTIONS.find(s => s.value === company.status || (s.value === "customer" && company.status === "kunde")) || STATUS_OPTIONS[0];
  const ownerFullName = (company as any).profiles?.full_name || null;

  const effectiveSignal = getEffectiveSignal(
    activities.map(a => ({ created_at: a.created_at, subject: a.subject, description: a.description })),
    tasks.map(t => ({ created_at: t.created_at, title: t.title, description: t.description, due_date: t.due_date }))
  );
  const signalBadgeColor = effectiveSignal
    ? SIGNAL_CATEGORIES.find(c => c.label === effectiveSignal)?.badgeColor || "bg-gray-100 text-gray-600 border-gray-200"
    : "bg-gray-100 text-gray-600 border-gray-200";

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
            {/* Signal badge FIRST */}
            {editable ? (
              <Select value={effectiveSignal || "__none__"} onValueChange={(v) => { if (v !== "__none__") changeSignalMutation.mutate(v); }}>
                <SelectTrigger className="h-auto w-auto gap-1 border-none shadow-none p-0 focus:ring-0 focus:ring-offset-0">
                  <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", signalBadgeColor)}>
                    {effectiveSignal || "Signal"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {SIGNAL_CATEGORIES.map((c) => <SelectItem key={c.label} value={c.label}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : effectiveSignal ? (
              <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", signalBadgeColor)}>
                {effectiveSignal}
              </span>
            ) : null}
            {/* Type badge SECOND — neutral style */}
            {editable ? (
              <Select value={company.status} onValueChange={(v) => updateMutation.mutate({ status: v })}>
                <SelectTrigger className="h-auto w-auto gap-1 border-none shadow-none p-0 focus:ring-0 focus:ring-offset-0">
                  <span className="inline-flex items-center rounded-full border bg-gray-100 text-gray-600 border-gray-200 px-2.5 py-0.5 text-xs font-semibold">
                    {currentStatus.label}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <span className="inline-flex items-center rounded-full border bg-gray-100 text-gray-600 border-gray-200 px-2.5 py-0.5 text-xs font-semibold">
                {currentStatus.label}
              </span>
            )}
            {editable ? (
              <Select value={company.owner_id || ""} onValueChange={(v) => updateMutation.mutate({ owner_id: v || null })}>
                <SelectTrigger className="h-auto w-auto gap-1 border-none shadow-none p-0 focus:ring-0 focus:ring-offset-0">
                  <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[0.6875rem] font-medium">
                    {company.owner_id && profileMapFull[company.owner_id] ? profileMapFull[company.owner_id] : "Eier"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {allProfiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : ownerFullName ? (
              <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[0.6875rem] font-medium">{ownerFullName}</span>
            ) : null}
            {editable && (
              <Dialog open={newContactOpen} onOpenChange={setNewContactOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
                    <Plus className="h-4 w-4" />Ny kontakt
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[440px] rounded-xl">
                  <DialogHeader><DialogTitle>Ny kontakt</DialogTitle></DialogHeader>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const { error } = await supabase.from("contacts").insert({
                      first_name: contactForm.first_name, last_name: contactForm.last_name,
                      email: contactForm.email || null, phone: contactForm.phone || null,
                      title: contactForm.title || null, linkedin: contactForm.linkedin || null,
                      company_id: companyId, created_by: user?.id, owner_id: user?.id,
                    });
                    if (error) { toast.error("Kunne ikke opprette kontakt"); return; }
                    queryClient.invalidateQueries({ queryKey: ["company-contacts", companyId] });
                    queryClient.invalidateQueries({ queryKey: ["contacts-full"] });
                    setNewContactOpen(false);
                    setContactForm({ first_name: "", last_name: "", email: "", phone: "", title: "", linkedin: "" });
                    toast.success("Kontakt opprettet");
                  }} className="space-y-4 mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-label">Fornavn</Label>
                        <Input value={contactForm.first_name} onChange={(e) => setContactForm({ ...contactForm, first_name: e.target.value })} required className="h-10 rounded-lg" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-label">Etternavn</Label>
                        <Input value={contactForm.last_name} onChange={(e) => setContactForm({ ...contactForm, last_name: e.target.value })} required className="h-10 rounded-lg" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-label">Stilling</Label>
                      <Input value={contactForm.title} onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })} className="h-10 rounded-lg" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-label">E-post</Label>
                        <Input value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} type="email" className="h-10 rounded-lg" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-label">Telefon</Label>
                        <Input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} className="h-10 rounded-lg" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-label">LinkedIn</Label>
                      <Input value={contactForm.linkedin} onChange={(e) => setContactForm({ ...contactForm, linkedin: e.target.value })} placeholder="https://linkedin.com/in/..." className="h-10 rounded-lg" />
                    </div>
                    <Button type="submit" className="w-full h-10 rounded-lg">Opprett kontakt</Button>
                  </form>
                </DialogContent>
              </Dialog>
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

        {/* Line 2: org number · city */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {company.org_number && <span>Org.nr {company.org_number}</span>}
          {company.city && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(company.city)},Norge`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <MapPin className="h-3.5 w-3.5" />
              {company.city}
            </a>
          )}
        </div>

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
          {/* ── Oppfølginger ── */}
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
                  const { title: displayTitle, category: displayCategory, cleanDesc: displayDesc } = extractTitleAndCategory(task.title, task.description);
                  return (
                    <div key={task.id} className="flex items-start gap-2.5 py-2.5 px-1 rounded-md transition-all duration-200 group hover:bg-background/60 cursor-pointer" onClick={() => { if (task.contact_id) navigate(`/kontakter/${task.contact_id}`); }}>
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={false} onCheckedChange={() => toggleTaskMutation.mutate(task.id)}
                          className="h-4 w-4 rounded-[4px] border-2 border-muted-foreground/40 flex-shrink-0 mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[1.0625rem] font-bold text-foreground">{displayTitle}</div>
                        {displayDesc && !/^\[.+\]$/.test(displayDesc.trim()) && (
                          <p className="text-[0.875rem] text-foreground/70 truncate mt-0.5">{displayDesc}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1">
                          {task.assigned_to && profileMapFull[task.assigned_to] && (
                            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[0.6875rem] font-medium">{profileMapFull[task.assigned_to]}</span>
                          )}
                          {contactName && (
                            <span className="text-[0.6875rem] text-muted-foreground">{contactName}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0 mt-0.5">
                        {task.due_date && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={cn(
                                "text-[0.8125rem] font-medium",
                                overdue ? "text-destructive" : today ? "text-[hsl(var(--warning))]" : "text-muted-foreground"
                              )}>
                                {format(new Date(task.due_date), "d. MMM yyyy", { locale: nb })}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{fullDate(task.due_date)}</TooltipContent>
                          </Tooltip>
                        )}
                        {displayCategory && <CategoryBadge label={displayCategory} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Activities Timeline ── */}
          <CompanyActivityTimeline activities={activities} profileMap={profileMapFull} companyId={companyId} />
        </div>

        {/* Right: Contacts */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">Kontakter · {contacts.length}</h3>
          </div>
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
                      <div className="flex items-center gap-1.5">
                        <p className="text-[0.8125rem] font-medium truncate group-hover:text-primary transition-colors">{c.first_name} {c.last_name}</p>
                        {c.cv_email && (
                          <span className="rounded-full bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 text-xs font-medium flex-shrink-0">CV</span>
                        )}
                        {c.call_list && (
                          <span className="rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 text-xs font-medium flex-shrink-0">INN</span>
                        )}
                      </div>
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

/* ── Company Activity Timeline ── */
function CompanyActivityTimeline({ activities, profileMap, companyId }: { activities: any[]; profileMap: Record<string, string>; companyId: string }) {
  const navigate = useNavigate();
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
          <div className={cn("flex items-center gap-3 mb-3", gi > 0 && "mt-6")}>
            <span className="text-[0.8125rem] font-bold tracking-[0.04em] text-foreground whitespace-nowrap">
              {group.label}
            </span>
            {group.period && <span className="text-[0.8125rem] text-muted-foreground/60">· {group.period}</span>}
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="relative pl-7">
            <div className="absolute left-[5px] top-[5px] bottom-0 w-[2px] bg-border" />
            <div className="space-y-6">
              {group.items.map((activity) => (
                <CompanyActivityRow
                  key={activity.id}
                  activity={activity}
                  profileMap={profileMap}
                  companyId={companyId}
                  navigate={navigate}
                />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Company Activity Row (with inline edit) ── */
function CompanyActivityRow({ activity, profileMap, companyId, navigate }: {
  activity: any;
  profileMap: Record<string, string>;
  companyId: string;
  navigate: (path: string) => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDate, setEditDate] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { title: displayTitle, category: displayCategory, cleanDesc } = extractTitleAndCategory(activity.subject, activity.description);
  const ownerName = activity.created_by ? profileMap[activity.created_by] : null;
  const d = new Date(activity.created_at);
  const contactName = (activity.contacts as any)?.first_name
    ? `${(activity.contacts as any).first_name} ${(activity.contacts as any).last_name}` : null;

  const typeIcon = activity.type === "call" || activity.type === "phone"
    ? <MessageCircle className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
    : <FileText className="h-3.5 w-3.5 text-primary" />;

  const handleRowClick = () => {
    if (editing) return;
    const parsed = extractTitleAndCategory(activity.subject, activity.description);
    let cat = parsed.category;
    if (!cat && CATEGORIES.some(c => c.label === activity.subject)) {
      cat = activity.subject;
    }
    setEditTitle(parsed.title);
    setEditCategory(cat);
    setEditDesc(parsed.cleanDesc);
    setEditDate(activity.created_at ? format(new Date(activity.created_at), "yyyy-MM-dd") : "");
    setConfirmDelete(false);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!editTitle.trim() || !editCategory) return;
    const descWithCat = buildDescriptionWithCategory(editCategory, editDesc.trim());
    const updates: Record<string, any> = { subject: editTitle.trim(), description: descWithCat || null };
    if (editDate) {
      updates.created_at = new Date(editDate).toISOString();
    }
    await supabase.from("activities").update(updates).eq("id", activity.id);
    queryClient.invalidateQueries({ queryKey: ["company-activities-direct", companyId] });
    queryClient.invalidateQueries({ queryKey: ["company-contact-activities", companyId] });
    setEditing(false);
    toast.success("Aktivitet oppdatert");
  };

  const handleDelete = async () => {
    await supabase.from("activities").delete().eq("id", activity.id);
    queryClient.invalidateQueries({ queryKey: ["company-activities-direct", companyId] });
    queryClient.invalidateQueries({ queryKey: ["company-contact-activities", companyId] });
    toast.success("Aktivitet slettet");
  };

  return (
    <div className="relative group">
      <div className="absolute -left-7 top-[2px] w-[12px] h-[12px] flex items-center justify-center bg-background rounded-full">
        {typeIcon}
      </div>

      <div className="min-w-0">
        {editing ? (
          <div className="space-y-2 animate-in fade-in duration-150">
            <div>
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5 block">Tittel</span>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-[0.9375rem] rounded-md" autoFocus />
            </div>
            <div>
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5 block">Kategori</span>
              <CategoryPicker selected={editCategory} onSelect={setEditCategory} />
            </div>
            <Textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={3}
              placeholder="Beskrivelse (valgfritt)"
              className="text-[0.875rem] rounded-md"
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditing(false);
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSave();
              }}
            />
            <div className="flex items-center gap-2">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Dato:</span>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="h-7 px-2 text-[0.75rem] rounded-full border border-border text-muted-foreground bg-background"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-6 text-[0.6875rem] px-2 rounded" disabled={!editTitle.trim() || !editCategory} onClick={handleSave}>Lagre</Button>
              <Button variant="ghost" size="sm" className="h-6 text-[0.6875rem] px-2 rounded" onClick={() => setEditing(false)}>Avbryt</Button>
              <div className="ml-auto">
                {confirmDelete ? (
                  <span className="text-[0.75rem] animate-in fade-in duration-150">
                    <span className="text-destructive mr-1">Er du sikker?</span>
                    <button onClick={() => { handleDelete(); setConfirmDelete(false); }} className="text-destructive font-medium hover:underline mr-1">Ja, slett</button>
                    <button onClick={() => setConfirmDelete(false)} className="text-muted-foreground hover:text-foreground">Avbryt</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmDelete(true)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div onClick={handleRowClick} className="cursor-pointer flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <span className="text-[1.0625rem] font-bold text-foreground">{displayTitle}</span>

              {cleanDesc && (
                <div className="mt-0.5">
                  <p className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-foreground/70">{cleanDesc}</p>
                </div>
              )}

              <div className="flex items-center gap-2 mt-1">
                {ownerName && (
                  <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[0.6875rem] font-medium">{ownerName}</span>
                )}
                {contactName && (
                  <span className="text-[0.8125rem] text-muted-foreground">{contactName}</span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 flex-shrink-0 mt-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[0.8125rem] text-muted-foreground">
                    {format(d, "d. MMM yyyy", { locale: nb })}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{fullDate(activity.created_at)}</TooltipContent>
              </Tooltip>
              {displayCategory && displayCategory !== displayTitle && <CategoryBadge label={displayCategory} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
