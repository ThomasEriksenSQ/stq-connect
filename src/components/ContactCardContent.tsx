import { useState, useMemo, useRef, useEffect } from "react";
import { AiSignalBanner } from "@/components/AiSignalBanner";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConsultantCache } from "@/hooks/useConsultantCache";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Phone,
  Mail,
  Linkedin,
  FileText,
  Clock,
  ExternalLink,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Plus,
  MessageCircle,
  PhoneOff,
  Send,
  Signal,
  X,
  Target,
  Loader2,
  MapPin,
  MoreVertical,
  Eye,
  EyeOff,
  StickyNote,
  UserSearch,
} from "lucide-react";
import { toast } from "sonner";
import { format, isPast, isToday, getYear, addDays, addWeeks, addMonths, addYears } from "date-fns";
import { nb } from "date-fns/locale";
import { fullDate } from "@/lib/relativeDate";
import { cleanDescription } from "@/lib/cleanDescription";
import { cn } from "@/lib/utils";
import { getEffectiveSignal, upsertTaskSignalDescription } from "@/lib/categoryUtils";
import {
  filterConsultantMatches,
  formatConsultantMatchFreshness,
  getConsultantMatchScoreColor,
  sortConsultantMatches,
} from "@/lib/consultantMatches";
import {
  buildContactCvSafeUpdates,
  CONTACT_CV_EMAIL_REQUIRED_MESSAGE,
  contactHasEmail,
} from "@/lib/contactCvEligibility";
import { mergeTechnologyTags } from "@/lib/technologyTags";
import { crmQueryKeys, crmSummaryQueryKeys, invalidateQueryGroup } from "@/lib/queryKeys";

/* ── Category system ── */
const CATEGORIES = [
  {
    label: "Behov nå",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    selectedColor: "bg-emerald-500 text-white border-emerald-500",
  },
  {
    label: "Får fremtidig behov",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    selectedColor: "bg-blue-500 text-white border-blue-500",
  },
  {
    label: "Får kanskje behov",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    selectedColor: "bg-amber-500 text-white border-amber-500",
  },
  {
    label: "Ukjent om behov",
    badgeColor: "bg-gray-100 text-gray-600 border-gray-200",
    selectedColor: "bg-gray-400 text-white border-gray-400",
  },
  {
    label: "Ikke aktuelt",
    badgeColor: "bg-red-50 text-red-700 border-red-200",
    selectedColor: "bg-red-400 text-white border-red-400",
  },
] as const;

const LEGACY_CATEGORY_MAP: Record<string, string> = {
  "Fremtidig behov": "Får fremtidig behov",
  "Har kanskje behov": "Får kanskje behov",
  "Vil kanskje få behov": "Får kanskje behov",
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
    <span className={cn("chip chip--action is-signal", className)}>
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
            "h-8 px-3 text-[0.8125rem] rounded-full border transition-all font-medium",
            selected === cat.label
              ? cat.selectedColor
              : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
          )}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}

/* ── Helpers for storing/retrieving category in description ── */
function buildDescriptionWithCategory(category: string, description: string): string {
  if (!category) return description;
  return description ? `[${category}]\n${description}` : `[${category}]`;
}

function parseDescriptionCategory(description: string | null): { category: string; text: string } {
  if (!description) return { category: "", text: "" };
  const match = description.match(/^\[([^\]]+)\]\n?([\s\S]*)$/);
  if (match) {
    const cat = match[1];
    if (CATEGORIES.some((c) => c.label === cat) || Object.keys(LEGACY_CATEGORY_MAP).includes(cat)) {
      return { category: normalizeCategoryLabel(cat), text: match[2].trim() };
    }
  }
  return { category: "", text: description };
}

/**
 * For legacy data: subject IS the category. For new data: subject is free-text title, category in description.
 */
function extractTitleAndCategory(subject: string, description: string | null) {
  const normalizedSubject = normalizeCategoryLabel(subject);
  // Strip bracket-only descriptions (e.g. "[Behov nå]")
  const stripBracketOnly = (d: string | null | undefined): string => {
    if (!d) return "";
    return /^\[.+\]$/.test(d.trim()) ? "" : d || "";
  };
  // Legacy: subject is a known category label
  if (CATEGORIES.some((c) => c.label === normalizedSubject)) {
    return { title: normalizedSubject, category: normalizedSubject, cleanDesc: "" };
  }
  // New format: category in description prefix
  const parsed = parseDescriptionCategory(description);
  return {
    title: subject,
    category: parsed.category,
    cleanDesc: cleanDescription(stripBracketOnly(parsed.text)) || "",
  };
}

interface DefaultHiddenConfig {
  techDna?: boolean;
  notes?: boolean;
  consultantMatch?: boolean;
  linkedinIfEmpty?: boolean;
  locationsIfEmpty?: boolean;
}

interface ContactCardContentProps {
  contactId: string;
  editable?: boolean;
  onOpenCompany?: (companyId: string) => void;
  onNavigateToFullPage?: () => void;
  defaultHidden?: DefaultHiddenConfig;
}

interface ConsultantMatchResult {
  id: number | string;
  navn: string;
  type?: "intern" | "ekstern";
  score: number;
  begrunnelse: string;
  match_tags: string[];
}

// Inline editable text field
function InlineField({
  value,
  onSave,
  placeholder,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, value]);

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed !== value) onSave(trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        onBlur={save}
        className={cn("bg-transparent border-b border-primary/40 outline-none py-0.5 min-w-[60px]", className)}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn(
        "group inline-flex items-center gap-1 hover:text-foreground/60 transition-colors cursor-text",
        !value && "text-muted-foreground/40 italic",
        className,
      )}
    >
      <span>{value || placeholder || "—"}</span>
      <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
    </button>
  );
}

const DATE_CHIPS = [
  { label: "Følg opp på sikt", fn: (): Date | null => null },
  { label: "I dag", fn: () => new Date() },
  { label: "1 uke", fn: () => addWeeks(new Date(), 1) },
  { label: "2 uker", fn: () => addWeeks(new Date(), 2) },
  { label: "3 uker", fn: () => addWeeks(new Date(), 3) },
  { label: "1 måned", fn: () => addMonths(new Date(), 1) },
  { label: "3 måneder", fn: () => addMonths(new Date(), 3) },
  { label: "6 måneder", fn: () => addMonths(new Date(), 6) },
  { label: "1 år", fn: () => addYears(new Date(), 1) },
];

export function ContactCardContent({
  contactId,
  editable = false,
  onOpenCompany,
  onNavigateToFullPage,
  defaultHidden,
}: ContactCardContentProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { interne: cachedInterne, eksterne: cachedEksterne } = useConsultantCache();

  // Form states
  const [activeForm, setActiveForm] = useState<"call" | "meeting" | "task" | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formEmailNotify, setFormEmailNotify] = useState(false);
  const [formCalendarSync, setFormCalendarSync] = useState(false);
  const [selectedChipIdx, setSelectedChipIdx] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const descTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [changingCompany, setChangingCompany] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [companyResults, setCompanyResults] = useState<{ id: string; name: string }[]>([]);
  const companySearchRef = useRef<HTMLInputElement>(null);
  const [matchingConsultants, setMatchingConsultants] = useState(false);
  const [consultantResults, setConsultantResults] = useState<ConsultantMatchResult[] | null>(null);
  const [matchSourceFilter, setMatchSourceFilter] = useState<"Alle" | "Ansatte" | "Eksterne">("Alle");
  const [matchUpdatedAt, setMatchUpdatedAt] = useState<string | null>(null);
  const [showTechDna, setShowTechDna] = useState(!defaultHidden?.techDna);
  const [showNotes, setShowNotes] = useState(!defaultHidden?.notes);
  const [showConsultantMatch, setShowConsultantMatch] = useState(!defaultHidden?.consultantMatch);

  const { data: contact, isLoading } = useQuery({
    queryKey: crmQueryKeys.contacts.detail(contactId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*, companies(id, name, city), profiles!contacts_owner_id_fkey(full_name)")
        .eq("id", contactId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: crmQueryKeys.profiles.all(),
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: crmQueryKeys.contacts.activities(contactId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  const profileMap = Object.fromEntries(allProfiles.map((p) => [p.id, p.full_name.split(" ")[0]]));
  const profileMapFull = Object.fromEntries(allProfiles.map((p) => [p.id, p.full_name]));

  // Outlook connection status
  const { data: outlookStatus } = useQuery({
    queryKey: ["outlook-status"],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return { connected: false };
      const res = await fetch(
        `https://kbvzpcebfopqqrvmbiap.supabase.co/functions/v1/outlook-auth?action=status`,
        { headers: { Authorization: `Bearer ${token}`, apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtidnpwY2ViZm9wcXFydm1iaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MTgyNTEsImV4cCI6MjA4ODI5NDI1MX0.t_bvITh_RxMfYdutsqHD-IkArlcD8I7au5vxBkt0aVY" } },
      );
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const handleConnectOutlook = async () => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) { toast.error("Du må være logget inn"); return; }
    const res = await fetch(
      `https://kbvzpcebfopqqrvmbiap.supabase.co/functions/v1/outlook-auth?action=login`,
      { headers: { Authorization: `Bearer ${token}`, apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtidnpwY2ViZm9wcXFydm1iaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MTgyNTEsImV4cCI6MjA4ODI5NDI1MX0.t_bvITh_RxMfYdutsqHD-IkArlcD8I7au5vxBkt0aVY" } },
    );
    const data = await res.json();
    if (data.url) {
      // Open in new tab — Microsoft login blocks iframe embedding
      window.open(data.url, "_blank");
    } else {
      toast.error(data.error || "Kunne ikke starte Outlook-tilkobling");
    }
  };

  const { data: tasks = [] } = useQuery({
    queryKey: crmQueryKeys.contacts.tasks(contactId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, companies(name)")
        .eq("contact_id", contactId)
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const safeUpdates = buildContactCvSafeUpdates(contact as any, updates);
      const { error } = await supabase.from("contacts").update(safeUpdates as any).eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.contacts.detail(contactId) });
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.contacts.all() });
    },
    onError: () => toast.error("Kunne ikke oppdatere"),
  });

  const updateSignalMutation = useMutation({
    mutationFn: async (signal: string) => {
      const primaryTask = tasks[0];

      if (primaryTask) {
        const { error } = await supabase
          .from("tasks")
          .update({
            description: upsertTaskSignalDescription(primaryTask.description, signal, !primaryTask.due_date),
            updated_at: new Date().toISOString(),
          })
          .eq("id", primaryTask.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("tasks").insert({
        title: "Følg opp om behov",
        description: upsertTaskSignalDescription(null, signal, true),
        priority: "medium",
        due_date: null,
        contact_id: contactId,
        company_id: contact?.company_id || null,
        assigned_to: user?.id,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.contacts.tasks(contactId) });
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.generic.tasks() });
      invalidateQueryGroup(queryClient, crmSummaryQueryKeys);
      toast.success("Signal oppdatert");
      closeForm();
    },
    onError: () => toast.error("Kunne ikke oppdatere signal"),
  });

  const createActivityMutation = useMutation({
    mutationFn: async ({ type, subject, description }: { type: string; subject: string; description?: string }) => {
      const { error } = await supabase.from("activities").insert({
        type,
        subject: subject.trim(),
        description: description?.trim() || null,
        contact_id: contactId,
        company_id: contact?.company_id || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.contacts.activities(contactId) });
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.contacts.all() });
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.companies.all() });
      toast.success("Aktivitet registrert");
      closeForm();
    },
    onError: () => toast.error("Kunne ikke lagre"),
  });

  const createTaskMutation = useMutation({
    mutationFn: async ({ title, description }: { title: string; description?: string | null }) => {
      const { error } = await supabase.from("tasks").insert({
        title: title.trim(),
        description: description?.trim() || null,
        priority: "medium",
        due_date: formDate === "someday" ? null : formDate || null,
        contact_id: contactId,
        company_id: contact?.company_id || null,
        assigned_to: user?.id,
        created_by: user?.id,
        email_notify: formEmailNotify,
        calendar_synced: formCalendarSync && formDate && formDate !== "someday",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.contacts.tasks(contactId) });
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.generic.tasks() });
      toast.success("Oppfølging opprettet");

      // Fire-and-forget calendar sync
      if (formCalendarSync && formDate && formDate !== "someday") {
        const contactName = contact ? `${contact.first_name} ${contact.last_name}` : "";
        const companyName = (contact as any)?.companies?.name || "";
        const calTitle = `Følg opp ${contactName}, ${companyName}`;
        supabase.functions.invoke("outlook-calendar", {
          body: { title: calTitle, date: formDate },
        }).then(({ error }) => {
          if (error) {
            toast.error("Kunne ikke legge til i Outlook-kalender");
          } else {
            toast.success("Lagt til i Outlook-kalender");
          }
        });
      }

      closeForm();
    },
    onError: () => toast.error("Kunne ikke opprette oppfølging"),
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          status: "done",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.contacts.tasks(contactId) });
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.generic.tasks() });
      toast.success("Oppfølging fullført", { duration: 2000 });
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      const { error } = await supabase.from("activities").delete().eq("id", activityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.contacts.activities(contactId) });
      toast.success("Aktivitet slettet");
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("activities").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.contacts.activities(contactId) });
      toast.success("Oppdatert");
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.contacts.tasks(contactId) });
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.generic.tasks() });
      toast.success("Oppfølging slettet");
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.contacts.tasks(contactId) });
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.generic.tasks() });
      toast.success("Oppdatert");
    },
  });

  const handleFinnKonsulent = async () => {
    const teknologier = mergeTechnologyTags((contact as any).teknologier || []);
    if (!teknologier.length) {
      toast("Kontaktens tekniske DNA er tomt ennå");
      return;
    }
    setMatchingConsultants(true);
    setConsultantResults(null);
    setMatchUpdatedAt(null);
    try {
      const { data, error } = await supabase.functions.invoke("match-consultants", {
        body: {
          teknologier,
          sted: companyCity || "",
          interne: cachedInterne,
          eksterne: cachedEksterne,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMatchSourceFilter("Alle");
      setConsultantResults(sortConsultantMatches(Array.isArray(data) ? data : []));
      setMatchUpdatedAt(new Date().toISOString());
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke kjøre matching");
      setConsultantResults([]);
      setMatchUpdatedAt(null);
    } finally {
      setMatchingConsultants(false);
    }
  };

  const visibleConsultantResults = useMemo(
    () => filterConsultantMatches(consultantResults || [], matchSourceFilter),
    [consultantResults, matchSourceFilter],
  );
  const consultantMatchFreshness = formatConsultantMatchFreshness(matchUpdatedAt);

  const openForm = (type: "call" | "meeting" | "task") => {
    setActiveForm(type);
    setFormTitle(type === "task" ? "Følg opp om behov" : "");
    setFormCategory("");
    setFormDescription("");
    setFormDate("");
    setFormEmailNotify(false);
    setFormCalendarSync(false);
    setSelectedChipIdx(null);
  };

  const closeForm = () => {
    setActiveForm(null);
    setFormTitle("");
    setFormCategory("");
    setFormDescription("");
    setFormDate("");
    setFormEmailNotify(false);
    setFormCalendarSync(false);
    setSelectedChipIdx(null);
  };

  const handleFormSubmit = () => {
    if (!formTitle || !formCategory) return;
    if (activeForm === "task") {
      const descWithCat = buildDescriptionWithCategory(formCategory, formDescription);
      const finalDesc =
        formDate === "someday" ? (descWithCat ? descWithCat + "\n[someday]" : "[someday]") : descWithCat || null;
      createTaskMutation.mutate({ title: formTitle.trim(), description: finalDesc });
    } else {
      const descWithCat = buildDescriptionWithCategory(formCategory, formDescription);
      createActivityMutation.mutate({
        type: activeForm === "call" ? "call" : "meeting",
        subject: formTitle.trim(),
        description: descWithCat || undefined,
      });
    }
  };

  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") closeForm();
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleFormSubmit();
  };

  const updateField = (field: string) => (value: string) => {
    updateMutation.mutate({ [field]: value || null });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast("Kopiert!", { duration: 1500 });
  };

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-7 w-48 bg-secondary rounded" />
        <div className="h-4 w-32 bg-secondary rounded" />
      </div>
    );
  }
  if (!contact) return <p className="text-sm text-muted-foreground">Kontakt ikke funnet</p>;

  const companyName = (contact.companies as any)?.name;
  const companyId = (contact.companies as any)?.id;
  const companyCity = (contact.companies as any)?.city as string | null;
  const companyLocations: string[] = companyCity
    ? companyCity
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean)
    : [];
  const showAvdeling = companyLocations.length > 1;

  return (
    <div>
      {/* ── ZONE A: Contact Header ── */}
      <div className="mb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {editable ? (
            <h2 className="text-[1.5rem] font-bold truncate flex-1 min-w-0">
              <InlineField
                value={`${contact.first_name} ${contact.last_name}`}
                onSave={(v) => {
                  const parts = v.split(" ");
                  const first = parts[0] || "";
                  const last = parts.slice(1).join(" ") || "";
                  updateMutation.mutate({ first_name: first, last_name: last });
                }}
                className="text-[1.5rem] font-bold"
              />
            </h2>
          ) : (
            <h2 className="text-[1.5rem] font-bold truncate flex-1 min-w-0">
              {contact.first_name} {contact.last_name}
            </h2>
          )}
          {/* Owner badge */}
          <div className="flex items-center gap-2 flex-shrink-0 sm:ml-auto">
            {/* Signal badge */}
            {editable &&
              (() => {
                const effectiveSignal = getEffectiveSignal(
                  activities.map((a) => ({ created_at: a.created_at, subject: a.subject, description: a.description })),
                  tasks.map((t) => ({
                    created_at: t.created_at,
                    title: t.title,
                    description: t.description,
                    due_date: t.due_date,
                  })),
                );
                const signalCat = effectiveSignal ? CATEGORIES.find((c) => c.label === effectiveSignal) : null;
                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      {signalCat ? (
                        <button
                          className="chip chip--action is-signal cursor-pointer"
                        >
                          {signalCat.label}
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </button>
                      ) : (
                        <button className="inline-flex items-center rounded-full border border-dashed border-border px-2.5 py-0.5 text-[0.6875rem] text-muted-foreground/50 cursor-pointer hover:text-muted-foreground hover:border-muted-foreground/40 transition-colors">
                          Legg til signal
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </button>
                      )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {CATEGORIES.map((cat) => (
                        <DropdownMenuItem
                          key={cat.label}
                          onClick={() => {
                            updateSignalMutation.mutate(cat.label);
                          }}
                        >
                          <span
                            className="chip chip--action is-signal"
                          >
                            {cat.label}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })()}
            {editable && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="chip chip--action is-signal cursor-pointer whitespace-nowrap">
                    {contact.owner_id && profileMapFull[contact.owner_id] ? profileMapFull[contact.owner_id] : "Eier"}
                    <ChevronDown className="h-3 w-3 ml-1 flex-shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {allProfiles.map((p) => (
                    <DropdownMenuItem key={p.id} onClick={() => updateMutation.mutate({ owner_id: p.id })}>
                      <span className="chip chip--action is-signal">
                        {p.full_name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {!editable && onNavigateToFullPage && (
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={onNavigateToFullPage}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}
            {/* 3-dot menu for Design Lab */}
            {defaultHidden && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-secondary transition-colors text-muted-foreground">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={4}>
                  <DropdownMenuItem onClick={() => {
                    const nameEl = document.querySelector('[data-contact-name-field]') as HTMLElement;
                    nameEl?.click();
                  }}>
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Rediger profil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setShowConsultantMatch(true);
                    handleFinnKonsulent();
                  }}>
                    <UserSearch className="h-3.5 w-3.5 mr-2" /> Finn konsulent
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setShowNotes((prev) => !prev);
                    if (!showNotes && !contact.notes) {
                      setNotesDraft("");
                      setTimeout(() => setEditingNotes(true), 50);
                    }
                  }}>
                    <StickyNote className="h-3.5 w-3.5 mr-2" />
                    {showNotes ? "Skjul notat" : contact.notes ? "Vis notat" : "Legg til notat"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowTechDna((prev) => !prev)}>
                    {showTechDna ? <EyeOff className="h-3.5 w-3.5 mr-2" /> : <Eye className="h-3.5 w-3.5 mr-2" />}
                    {showTechDna ? "Skjul teknisk DNA" : "Vis teknisk DNA"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Line 2: Selskap · Sted */}
        <div className="flex items-center gap-1.5 flex-wrap text-[0.875rem] mt-1.5">
          {companyName && (
            <span className="group/co inline-flex items-center gap-1">
              <button
                className="text-primary font-medium hover:underline"
                onClick={() => (onOpenCompany ? onOpenCompany(companyId) : navigate(`/selskaper/${companyId}`))}
              >
                {companyName}
              </button>
              {editable && (
                <button
                  onClick={() => {
                    setChangingCompany(true);
                    setCompanySearch("");
                    setCompanyResults([]);
                    setTimeout(() => companySearchRef.current?.focus(), 0);
                  }}
                  className="opacity-0 group-hover/co:opacity-60 hover:!opacity-100 transition-opacity"
                >
                  <Pencil className="h-2.5 w-2.5" />
                </button>
              )}
            </span>
          )}
          {!companyName && editable && (
            <button
              onClick={() => {
                setChangingCompany(true);
                setCompanySearch("");
                setCompanyResults([]);
                setTimeout(() => companySearchRef.current?.focus(), 0);
              }}
              className="text-muted-foreground/40 italic inline-flex items-center gap-1 hover:text-foreground/60 transition-colors"
            >
              Selskap <Pencil className="h-2.5 w-2.5" />
            </button>
          )}
          {(() => {
            const contactLocations: string[] = (contact as any).locations || [];
            if (companyLocations.length === 0) return null;
            if (defaultHidden?.locationsIfEmpty && contactLocations.length === 0) return null;
            return (
              <>
                <span className="text-muted-foreground/40">·</span>
                <div className="inline-flex items-center gap-1 flex-wrap">
                  <MapPin className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                  {companyLocations.map((loc) => {
                    const isSelected = contactLocations.includes(loc);
                    return (
                      <button
                        key={loc}
                        onClick={() => {
                          const next = isSelected
                            ? contactLocations.filter((l) => l !== loc)
                            : [...contactLocations, loc];
                          updateMutation.mutate({ locations: next } as any);
                        }}
                        className={cn(
                          "text-[0.8125rem] px-1.5 py-0 rounded transition-colors",
                          isSelected
                            ? "text-foreground font-medium"
                            : "text-muted-foreground/40 hover:text-muted-foreground",
                        )}
                      >
                        {loc}
                      </button>
                    );
                  })}
                </div>
              </>
            );
          })()}
          {(contact as any).location && (
            <>
              <span className="text-muted-foreground/40">·</span>
            </>
          )}
          {/* Avdeling · Stilling — same line */}
          {showAvdeling && !(defaultHidden && !(contact as any).department) && (
            <>
              <span className="text-muted-foreground/40">·</span>
              {editable ? (
                <InlineField
                  value={(contact as any).department || ""}
                  onSave={updateField("department")}
                  placeholder="Avdeling"
                  className="text-[0.875rem]"
                />
              ) : (
                (contact as any).department && <span>{(contact as any).department}</span>
              )}
            </>
          )}
          {(contact.title || editable) && (
            <>
              <span className="text-muted-foreground/40">·</span>
              {editable ? (
                <InlineField
                  value={contact.title || ""}
                  onSave={updateField("title")}
                  placeholder="Stilling"
                  className="text-[0.875rem]"
                />
              ) : (
                <span>{contact.title}</span>
              )}
            </>
          )}
        </div>

        {/* Line 3: Telefon · E-post · LinkedIn */}
        <div className="flex items-center gap-4 flex-wrap mt-2">
          {contact.phone ? (
            <a
              href={`tel:${contact.phone}`}
              onClick={(e) => {
                e.preventDefault();
                copyToClipboard(contact.phone!);
              }}
              className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <Phone className="h-3.5 w-3.5" />
              {editable ? (
                <InlineField value={contact.phone} onSave={updateField("phone")} className="text-[0.8125rem]" />
              ) : (
                contact.phone
              )}
            </a>
          ) : editable ? (
            <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              <Phone className="h-3.5 w-3.5" />
              <InlineField value="" onSave={updateField("phone")} placeholder="Telefon" className="text-[0.8125rem]" />
            </span>
          ) : null}
          {contact.email ? (
            <a
              href={`mailto:${contact.email}`}
              onClick={(e) => {
                e.preventDefault();
                copyToClipboard(contact.email!);
              }}
              className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <Mail className="h-3.5 w-3.5" />
              {editable ? (
                <InlineField value={contact.email} onSave={updateField("email")} className="text-[0.8125rem]" />
              ) : (
                contact.email
              )}
            </a>
          ) : editable ? (
            <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              <Mail className="h-3.5 w-3.5" />
              <InlineField value="" onSave={updateField("email")} placeholder="E-post" className="text-[0.8125rem]" />
            </span>
          ) : null}
          {contact.linkedin ? (
            <a
              href={contact.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Linkedin className="h-3.5 w-3.5" />
              LinkedIn
            </a>
          ) : editable && !(defaultHidden?.linkedinIfEmpty) ? (
            <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              <Linkedin className="h-3.5 w-3.5" />
              <InlineField
                value=""
                onSave={updateField("linkedin")}
                placeholder="LinkedIn"
                className="text-[0.8125rem]"
              />
            </span>
          ) : null}
        </div>
        {/* Status-piller */}
        <div className="flex items-center gap-2 flex-wrap mt-2 pt-2 border-t border-border/40">
          {/* CV-Epost */}
          <button
            onClick={() => {
              const isUnsubscribed = (contact as any).mailchimp_status === "unsubscribed" || (contact as any).mailchimp_status === "cleaned";
              if ((contact as any).cv_email && isUnsubscribed) {
                toast.info("Kontakten har avmeldt seg via Mailchimp og kan ikke re-abonneres.");
                return;
              }
              if (!contact.cv_email && !contactHasEmail(contact as any)) {
                toast.error(CONTACT_CV_EMAIL_REQUIRED_MESSAGE);
                return;
              }
              const newVal = !(contact as any).cv_email;
              updateMutation.mutate({ cv_email: newVal }, {
                onSuccess: () => {
                  supabase.functions.invoke("mailchimp-sync", {
                    body: { action: "sync-contact", contactId },
                  }).then(({ data, error: mcErr }) => {
                    if (mcErr) {
                      console.error("Mailchimp sync feilet:", mcErr);
                      toast.error("Mailchimp-synk feilet");
                    } else {
                      toast.success(`Mailchimp: ${data?.status || "synkronisert"}`);
                    }
                  });
                },
              });
            }}
            className={`chip chip--action${
              (contact as any).cv_email && ((contact as any).mailchimp_status === "unsubscribed" || (contact as any).mailchimp_status === "cleaned")
                ? " is-muted"
                : (contact as any).cv_email
                  ? " is-active"
                  : ""
            }`}
          >
            {(contact as any).cv_email && ((contact as any).mailchimp_status === "unsubscribed" || (contact as any).mailchimp_status === "cleaned")
              ? "CV-Epost ✗"
              : (contact as any).cv_email ? "✓ CV-Epost" : "CV-Epost"}
          </button>
          {/* Innkjøper */}
          <button
            onClick={() => updateMutation.mutate({ call_list: !(contact as any).call_list })}
            className={`chip chip--action${(contact as any).call_list ? " is-active" : ""}`}
          >
            {(contact as any).call_list ? "✓ Innkjøper" : "Innkjøper"}
          </button>
          {/* Ikke aktuell å kontakte */}
          <button
            onClick={() => updateMutation.mutate({ ikke_aktuell_kontakt: !(contact as any).ikke_aktuell_kontakt })}
            className={`chip chip--action is-muted`}
          >
            {(contact as any).ikke_aktuell_kontakt
              ? "✕ Ikke relevant person å kontakte igjen"
              : "Ikke relevant person å kontakte igjen"}
          </button>
        </div>
        {changingCompany && (
          <div className="relative mt-1.5">
            <Input
              ref={companySearchRef}
              value={companySearch}
              onChange={async (e) => {
                const q = e.target.value;
                setCompanySearch(q);
                if (q.trim().length < 2) {
                  setCompanyResults([]);
                  return;
                }
                const { data } = await supabase
                  .from("companies")
                  .select("id, name")
                  .ilike("name", `%${q.trim()}%`)
                  .limit(8);
                setCompanyResults(data || []);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setChangingCompany(false);
              }}
              placeholder="Søk selskap..."
              className="h-8 text-sm rounded-lg w-64"
            />

            {companyResults.length > 0 && (
              <div className="absolute z-50 mt-1 w-64 bg-background border border-border rounded-lg shadow-md py-1 max-h-48 overflow-y-auto">
                {companyResults.map((c) => (
                  <button
                    key={c.id}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-secondary transition-colors"
                    onClick={() => {
                      updateMutation.mutate({ company_id: c.id });
                      setChangingCompany(false);
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-0">
        {/* ── Tekniske behov ── */}
        {(!defaultHidden?.techDna || showTechDna) && (
        <div className="mb-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Teknisk DNA for {contact.first_name} {contact.last_name}
              </span>
              {contact.teknologier && (contact.teknologier as string[]).length > 0 && (
                <button
                  onClick={handleFinnKonsulent}
                  disabled={matchingConsultants}
                  className="inline-flex items-center gap-1.5 h-7 px-3 text-[0.75rem] font-medium rounded-lg border border-border bg-background text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  {matchingConsultants ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Matcher...
                    </>
                  ) : (
                    <>
                      <Target className="h-3.5 w-3.5 text-primary" /> Finn konsulent
                    </>
                  )}
                </button>
              )}
            </div>

            <p className="text-[0.75rem] text-muted-foreground mb-2">
              Bygges automatisk fra foresporsler og sikre Finn-treff.
            </p>

            {(contact as any).teknologier?.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {((contact as any).teknologier as string[]).map((tag: string) => (
                  <span
                    key={tag}
                    className="chip chip--tech"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[0.8125rem] text-muted-foreground">Ingen teknisk profil ennå.</p>
            )}
          </div>

          {/* AI Signal suggestion */}
          {editable &&
            activities.length > 0 &&
            (() => {
              const effectiveSignal = getEffectiveSignal(
                activities.map((a) => ({ created_at: a.created_at, subject: a.subject, description: a.description })),
                tasks.map((t) => ({
                  created_at: t.created_at,
                  title: t.title,
                  description: t.description,
                  due_date: t.due_date,
                })),
              );
              const lastTaskDue = tasks.length > 0 ? tasks[0]?.due_date || null : null;
              return (
                <AiSignalBanner
                  contactId={contactId}
                  contactName={`${contact.first_name} ${contact.last_name}`}
                  contactEmail={contact.email || null}
                  currentSignal={effectiveSignal}
                  currentTechnologies={((contact as any).teknologier as string[]) || []}
                  activities={activities
                    .slice(0, 5)
                    .map((a) => ({ type: a.type, subject: a.subject, created_at: a.created_at }))}
                  lastTaskDueDate={lastTaskDue}
                  onUpdateSignal={(signal) => {
                    updateSignalMutation.mutate(signal);
                  }}
                  onAddTechnologies={async (techs) => {
                    const existing = ((contact as any).teknologier as string[]) || [];
                    const merged = [...new Set([...existing, ...techs])];
                    await supabase
                      .from("contacts")
                      .update({ teknologier: merged })
                      .eq("id", contactId);
                    queryClient.invalidateQueries({ queryKey: crmQueryKeys.contacts.detail(contactId) });
                  }}
                />
              );
            })()}
        </div>
        )}

        {/* ── Notat ── */}
        {(!defaultHidden?.notes || showNotes) && (
        <div className="mb-5">
          {editingNotes ? (
            <div>
              <Textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={3}
                autoFocus
                className="text-[0.875rem] rounded-md"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditingNotes(false);
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    updateField("notes")(notesDraft);
                    setEditingNotes(false);
                  }
                }}
              />

              <div className="flex gap-2 mt-1.5">
                <Button
                  size="sm"
                  className="h-7 text-[0.75rem] px-3 rounded-md"
                  onClick={() => {
                    updateField("notes")(notesDraft);
                    setEditingNotes(false);
                  }}
                >
                  Lagre
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[0.75rem] px-3 rounded-md"
                  onClick={() => setEditingNotes(false)}
                >
                  Avbryt
                </Button>
              </div>
            </div>
          ) : contact.notes ? (
            <div className="group relative">
              <p className="text-[0.8125rem] text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {contact.notes}
              </p>
              {editable}
            </div>
          ) : editable ? (
            <button
              onClick={() => {
                setNotesDraft("");
                setEditingNotes(true);
              }}
              className="text-[0.75rem] text-muted-foreground/50 hover:text-muted-foreground inline-flex items-center gap-1 transition-colors"
            >
              <Pencil className="h-3 w-3" /> Legg til notat
            </button>
          ) : null}
        </div>
        )}

        {/* ── Separator + Action Bar ── */}
        {editable && (
          <div className="border-t border-border pt-4 pb-6">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => openForm("call")}
                className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg transition-colors bg-[hsl(var(--success))] text-white hover:opacity-90"
              >
                <MessageCircle className="h-[15px] w-[15px]" /> Logg samtale
              </button>
              <button
                onClick={() => openForm("meeting")}
                className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg transition-colors bg-primary text-primary-foreground hover:opacity-90"
              >
                <FileText className="h-[15px] w-[15px]" /> Logg møtereferat
              </button>
              <button
                onClick={() => openForm("task")}
                className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg border border-border bg-background text-foreground hover:bg-secondary transition-colors"
              >
                <Clock className="h-[15px] w-[15px] text-[hsl(var(--warning))]" /> Ny oppfølging
              </button>
              {!outlookStatus?.connected && (
                <button
                  onClick={handleConnectOutlook}
                  className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg border border-dashed border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors ml-auto"
                >
                  <Mail className="h-[15px] w-[15px]" /> Koble til Outlook
                </button>
              )}
            </div>

            {/* Inline form */}
            {activeForm && (
              <div className="mt-3 animate-in slide-in-from-top-1 duration-200" onKeyDown={handleFormKeyDown}>
                <div className="mb-3">
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5 block">
                    Tittel
                  </span>
                  <Input
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Tittel"
                    className="text-[0.9375rem] rounded-md"
                    autoFocus
                  />

                  {activeForm === "call" && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <button
                        type="button"
                        onClick={() => setFormTitle("Ringte, ikke svar")}
                        className="inline-flex items-center gap-1 h-6 px-2.5 text-[0.6875rem] rounded-full border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                      >
                        <PhoneOff className="h-3 w-3" /> Ringte, ikke svar
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormTitle("Sendt LinkedIn melding")}
                        className="inline-flex items-center gap-1 h-6 px-2.5 text-[0.6875rem] rounded-full border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                      >
                        <Send className="h-3 w-3" /> Sendt LinkedIn melding
                      </button>
                    </div>
                  )}
                </div>

                <div className="mb-3">
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5 block">
                    Kategori
                  </span>
                  <CategoryPicker selected={formCategory} onSelect={setFormCategory} />
                </div>

                <Textarea
                  ref={descTextareaRef}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Beskrivelse (valgfritt)"
                  rows={3}
                  className="text-[0.9375rem] rounded-md border-border focus:ring-primary/30 resize-none"
                />

                {activeForm === "task" ? (
                  <div className="mt-3">
                    <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Når?
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {DATE_CHIPS.map((chip, i) => (
                        <button
                          key={chip.label}
                          type="button"
                          onClick={() => {
                            const d = chip.fn();
                            if (d === null) {
                              setFormDate("someday");
                              setSelectedChipIdx(i);
                            } else {
                              setFormDate(format(d, "yyyy-MM-dd"));
                              setSelectedChipIdx(i);
                            }
                          }}
                          className={cn(
                            "h-7 px-2.5 text-[0.75rem] rounded-full border transition-colors",
                            selectedChipIdx === i
                              ? "bg-primary/10 border-primary/30 text-primary font-medium"
                              : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
                          )}
                        >
                          {chip.label}
                        </button>
                      ))}
                      <input
                        type="date"
                        value={formDate}
                        onChange={(e) => {
                          setFormDate(e.target.value);
                          setSelectedChipIdx(null);
                        }}
                        className="h-7 px-2 text-[0.75rem] rounded-full border border-border text-muted-foreground bg-background"
                      />
                    </div>
                    {formDate === "someday" ? (
                      <p className="text-[0.75rem] text-muted-foreground mt-2">
                        Ingen fast dato — legges i "Følg opp på sikt"-listen
                      </p>
                    ) : formDate ? (
                      <p className="text-[0.75rem] text-muted-foreground mt-2">
                        Frist: {format(new Date(formDate), "d. MMMM yyyy", { locale: nb })}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-2">
                    <span className="text-[0.75rem] text-muted-foreground">
                      Dato: I dag, {format(new Date(), "d. MMMM", { locale: nb })}
                    </span>
                  </div>
                )}

                {activeForm === "task" && (
                  <>
                    <label className="flex items-center gap-2 cursor-pointer select-none mt-2">
                      <Checkbox
                        checked={formEmailNotify}
                        onCheckedChange={(v) => setFormEmailNotify(!!v)}
                        className="h-4 w-4"
                      />
                      <span className="text-[0.8125rem] text-foreground">Epostvarsling ved forfall</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <Checkbox
                        checked={formCalendarSync}
                        onCheckedChange={(v) => setFormCalendarSync(!!v)}
                        className="h-4 w-4"
                      />
                      <span className="text-[0.8125rem] text-foreground">Legg til i Outlook-kalender</span>
                    </label>
                  </>
                )}

                <div className="flex items-center gap-2 mt-3">
                  <Button
                    size="sm"
                    className="h-[34px] px-4 text-[0.8125rem] rounded-md"
                    disabled={
                      !formTitle.trim() ||
                      !formCategory ||
                      (activeForm === "task" && createTaskMutation.isPending) ||
                      (activeForm !== "task" && createActivityMutation.isPending)
                    }
                    onClick={handleFormSubmit}
                  >
                    {activeForm === "task"
                      ? "Lagre oppfølging"
                      : activeForm === "meeting"
                        ? "Lagre referat"
                        : "Lagre samtale"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-[34px] px-3 text-[0.8125rem] text-muted-foreground rounded-md"
                    onClick={closeForm}
                  >
                    Avbryt
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Konsulent match-resultater ── */}
        {(!defaultHidden?.consultantMatch || showConsultantMatch) && consultantResults !== null && (
          <div className="space-y-3 mb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <div>
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Konsulentmatch
                  </span>
                  {consultantMatchFreshness && (
                    <p className="text-[0.6875rem] text-muted-foreground normal-case tracking-normal">
                      {consultantMatchFreshness}
                    </p>
                  )}
                </div>
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary/10 text-primary text-[0.6875rem] font-semibold">
                  {consultantResults.length}
                </span>
              </div>
              <button
                onClick={handleFinnKonsulent}
                className="text-[0.75rem] text-muted-foreground hover:text-foreground transition-colors"
              >
                Kjør på nytt
              </button>
            </div>

            {visibleConsultantResults.length === 0 ? (
              <p className="text-[0.8125rem] text-muted-foreground">Ingen treff med score ≥ 4</p>
            ) : (
              <div className="space-y-2">
                {consultantResults.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {(["Alle", "Ansatte", "Eksterne"] as const).map((chip) => {
                      const selected = matchSourceFilter === chip;
                      return (
                        <button
                          key={chip}
                          onClick={() => setMatchSourceFilter(chip)}
                          className={selected
                            ? "h-7 px-2.5 text-[0.75rem] rounded-full border bg-foreground border-foreground text-background font-medium transition-colors"
                            : "h-7 px-2.5 text-[0.75rem] rounded-full border border-border text-muted-foreground hover:bg-secondary transition-colors"
                          }
                        >
                          {chip}
                        </button>
                      );
                    })}
                  </div>
                )}
                {visibleConsultantResults.map((m, i) => (
                  <div key={`${m.type || "ukjent"}-${m.id}`} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[0.75rem] font-bold text-muted-foreground">#{i + 1}</span>
                        <span className="text-[0.875rem] font-semibold text-foreground truncate">{m.navn}</span>
                        {m.type && (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold shrink-0",
                              m.type === "intern"
                                ? "bg-foreground text-background"
                                : "bg-blue-100 text-blue-700",
                            )}
                          >
                            {m.type === "intern" ? "Ansatt" : "Ekstern"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={cn(
                            "inline-block h-2.5 w-2.5 rounded-full",
                            getConsultantMatchScoreColor(m.score),
                          )}
                        />

                        <span className="text-[0.8125rem] font-bold text-foreground">{m.score}/10</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(m.match_tags || []).map((t: string) => (
                        <span
                          key={t}
                          className="chip chip--tech"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <p className="text-[0.8125rem] text-muted-foreground mt-1.5 italic">{m.begrunnelse}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
                return (
                  <TaskRow
                    key={task.id}
                    task={task}
                    overdue={!!overdue}
                    today={!!today}
                    profileMap={profileMapFull}
                    onToggle={() => toggleTaskMutation.mutate(task.id)}
                    onDelete={(id) => deleteTaskMutation.mutate(id)}
                    onUpdate={(id, updates) => updateTaskMutation.mutate({ id, updates })}
                    editable={editable}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* ── Aktiviteter ── */}
        <div className="mt-8">
          <ActivityTimeline
            activities={activities}
            profileMap={profileMapFull}
            editable={editable}
            onDelete={(id) => deleteActivityMutation.mutate(id)}
            onUpdateActivity={(id, updates) => updateActivityMutation.mutate({ id, updates })}
            contactEmail={contact.email || undefined}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Task Row ── */

function TaskRow({
  task,
  overdue,
  today,
  profileMap,
  onToggle,
  onDelete,
  onUpdate,
  editable,
}: {
  task: any;
  overdue: boolean;
  today: boolean;
  profileMap: Record<string, string>;
  onToggle: () => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Record<string, any>) => void;
  editable: boolean;
}) {
  const [completing, setCompleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editCategory, setEditCategory] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDate, setEditDate] = useState(task.due_date || "");
  const [editChipIdx, setEditChipIdx] = useState<number | null>(null);
  const [editEmailNotify, setEditEmailNotify] = useState(task.email_notify ?? false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    title: displayTitle,
    category: displayCategory,
    cleanDesc: displayDesc,
  } = extractTitleAndCategory(task.title, task.description);

  const handleCheck = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCompleting(true);
    setTimeout(() => onToggle(), 250);
  };

  const handleRowClick = () => {
    if (!editable || completing || editing) return;
    const parsed = extractTitleAndCategory(task.title, task.description);
    setEditTitle(parsed.title);
    setEditCategory(parsed.category);
    setEditDesc(parsed.cleanDesc);
    const isSomeday = !task.due_date;
    setEditDate(isSomeday ? "someday" : task.due_date || "");
    if (isSomeday) {
      setEditChipIdx(0);
    } else if (task.due_date) {
      const dueDateStr = task.due_date;
      const matchIdx = DATE_CHIPS.findIndex((chip, i) => {
        if (i === 0) return false;
        const d = chip.fn();
        if (!d) return false;
        return format(d, "yyyy-MM-dd") === dueDateStr;
      });
      setEditChipIdx(matchIdx >= 0 ? matchIdx : null);
    } else {
      setEditChipIdx(null);
    }
    setEditEmailNotify(task.email_notify ?? false);
    setEditing(true);
  };

  const handleSave = () => {
    if (!editTitle || !editCategory) return;
    const descWithCat = buildDescriptionWithCategory(editCategory, editDesc.trim());
    onUpdate(task.id, {
      title: editTitle.trim(),
      description: descWithCat || null,
      due_date: editDate === "someday" ? null : editDate || null,
      email_notify: editEmailNotify,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="py-2.5 px-1 space-y-2 animate-in fade-in duration-150">
        <div>
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5 block">
            Tittel
          </span>
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="text-[0.9375rem] rounded-md"
            autoFocus
          />
        </div>
        <div>
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5 block">
            Kategori
          </span>
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

        <div>
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Når?</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {DATE_CHIPS.map((chip, i) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => {
                  const d = chip.fn();
                  if (d === null) {
                    setEditDate("someday");
                    setEditChipIdx(i);
                  } else {
                    setEditDate(format(d, "yyyy-MM-dd"));
                    setEditChipIdx(i);
                  }
                }}
                className={cn(
                  "h-7 px-2.5 text-[0.75rem] rounded-full border transition-colors",
                  editChipIdx === i
                    ? "bg-primary/10 border-primary/30 text-primary font-medium"
                    : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {chip.label}
              </button>
            ))}
            <input
              type="date"
              value={editDate}
              onChange={(e) => {
                setEditDate(e.target.value);
                setEditChipIdx(null);
              }}
              className="h-7 px-2 text-[0.75rem] rounded-full border border-border text-muted-foreground bg-background"
            />
            {editDate === "someday" && (
              <p className="text-[0.75rem] text-muted-foreground mt-2">
                Ingen fast dato — legges i "Følg opp på sikt"-listen
              </p>
            )}
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <Checkbox
            checked={editEmailNotify}
            onCheckedChange={(v) => setEditEmailNotify(!!v)}
            className="h-4 w-4"
          />
          <span className="text-[0.8125rem] text-foreground">Epostvarsling ved forfall</span>
        </label>
        {task.calendar_synced ? (
          <div className="flex items-center gap-2">
            <span className="text-[0.8125rem] text-muted-foreground">✓ Lagt til i Outlook-kalender</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[0.8125rem] text-muted-foreground">Outlook-kalender ikke lagt til</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-6 text-[0.6875rem] px-2 rounded"
            disabled={!editTitle.trim() || !editCategory}
            onClick={handleSave}
          >
            Lagre
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[0.6875rem] px-2 rounded"
            onClick={() => setEditing(false)}
          >
            Avbryt
          </Button>
          <div className="ml-auto">
            {confirmDelete ? (
              <span className="text-[0.75rem] animate-in fade-in duration-150">
                <span className="text-destructive mr-1">Er du sikker?</span>
                <button
                  onClick={() => {
                    onDelete(task.id);
                    setConfirmDelete(false);
                  }}
                  className="text-destructive font-medium hover:underline mr-1"
                >
                  Ja, slett
                </button>
                <button onClick={() => setConfirmDelete(false)} className="text-muted-foreground hover:text-foreground">
                  Avbryt
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleRowClick}
      className={cn(
        "flex items-start gap-2.5 py-2.5 px-1 rounded-md transition-all duration-200 group hover:bg-background/60",
        completing && "opacity-30 line-through scale-[0.98]",
        editable && "cursor-pointer",
      )}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={completing}
          onCheckedChange={() => handleCheck({ stopPropagation: () => {} } as any)}
          className="h-4 w-4 rounded-[4px] border-2 border-muted-foreground/40 flex-shrink-0 mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[1.0625rem] font-bold text-foreground">{displayTitle}</div>
        {displayDesc && <p className="text-[0.875rem] text-foreground/70 truncate mt-0.5">{displayDesc}</p>}
        {task.assigned_to && profileMap[task.assigned_to] && (
          <div className="mt-1">
            <span className="chip chip--action is-signal">
              {profileMap[task.assigned_to]}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0 mt-0.5">
        {task.due_date ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "text-[0.8125rem] font-medium",
                  overdue ? "text-destructive" : today ? "text-[hsl(var(--warning))]" : "text-muted-foreground",
                )}
              >
                {format(new Date(task.due_date), "d. MMM yyyy", { locale: nb })}
              </span>
            </TooltipTrigger>
            <TooltipContent>{fullDate(task.due_date)}</TooltipContent>
          </Tooltip>
        ) : task.description?.includes("[someday]") || !task.due_date ? (
          <span className="text-[0.8125rem] font-medium text-muted-foreground italic">Følg opp på sikt</span>
        ) : null}
        {displayCategory && <CategoryBadge label={displayCategory} />}
      </div>
    </div>
  );
}

/* ── Activity Timeline ── */
function ActivityTimeline({
  activities,
  profileMap,
  editable,
  onDelete,
  onUpdateActivity,
  contactEmail,
}: {
  activities: any[];
  profileMap: Record<string, string>;
  editable: boolean;
  onDelete: (id: string) => void;
  onUpdateActivity: (id: string, updates: Record<string, any>) => void;
  contactEmail?: string;
}) {
  const currentYear = getYear(new Date());

  // Fetch Outlook emails for this contact
  const { data: outlookEmails = [] } = useQuery({
    queryKey: ["outlook-emails", contactEmail],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("outlook-mail", {
        body: { email: contactEmail, top: 30 },
      });
      if (error) throw error;
      if (data?.error === "no_outlook_connected") return [];
      return (data?.emails || []).map((e: any) => ({
        id: `outlook-${e.id}`,
        type: "email" as const,
        subject: e.subject,
        created_at: e.date,
        from: e.from,
        from_name: e.from_name,
        to: e.to,
        preview: e.preview,
        body_text: e.body_text,
        is_read: e.is_read,
      }));
    },
    enabled: !!contactEmail,
    staleTime: 5 * 60 * 1000,
  });

  // Merge activities and emails, sorted by date descending
  const mergedItems = useMemo(() => {
    const activityItems = activities.map((a) => ({ ...a, _source: "activity" as const }));
    const emailItems = (outlookEmails || []).map((e: any) => ({ ...e, _source: "email" as const }));
    return [...activityItems, ...emailItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [activities, outlookEmails]);

  const [showEmails, setShowEmails] = useState(true);

  const filteredItems = useMemo(() => {
    if (showEmails) return mergedItems;
    return mergedItems.filter((item) => item._source !== "email");
  }, [mergedItems, showEmails]);

  const grouped = useMemo(() => {
    const groups: { key: string; label: string; period: string; items: any[] }[] = [];
    let currentKey = "";
    for (const item of filteredItems) {
      const d = new Date(item.created_at);
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
      groups[groups.length - 1].items.push(item);
    }
    return groups;
  }, [filteredItems, currentYear]);

  const totalCount = filteredItems.length;
  const hasEmails = outlookEmails.length > 0;

  if (totalCount === 0) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Aktiviteter · 0
          </h3>
          {hasEmails && (
            <button
              onClick={() => setShowEmails((v) => !v)}
              className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-[0.75rem] rounded-full border transition-colors ${showEmails ? "bg-primary/10 border-primary/30 text-primary font-medium" : "bg-background border-border text-muted-foreground hover:bg-secondary"}`}
            >
              <Mail className="w-3.5 h-3.5" />
              {showEmails ? "Skjul e-post" : "Vis e-post"}
            </button>
          )}
        </div>
        <p className="text-[0.8125rem] text-muted-foreground/60 py-2">Ingen aktiviteter ennå</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 mt-8">
        <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Aktiviteter · {totalCount}
        </h3>
        {hasEmails && (
          <button
            onClick={() => setShowEmails((v) => !v)}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-[0.75rem] rounded-full border transition-colors ${showEmails ? "bg-primary/10 border-primary/30 text-primary font-medium" : "bg-background border-border text-muted-foreground hover:bg-secondary"}`}
          >
            <Mail className="w-3.5 h-3.5" />
            {showEmails ? "Skjul e-post" : "Vis e-post"}
          </button>
        )}
      </div>

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
            {/* Vertical line */}
            <div className="absolute left-[5px] top-[5px] bottom-0 w-[2px] bg-border" />

            <div className="space-y-6">
              {group.items.map((item) =>
                item._source === "email" ? (
                  <EmailRow key={item.id} email={item} />
                ) : (
                  <ActivityRow
                    key={item.id}
                    activity={item}
                    currentYear={currentYear}
                    profileMap={profileMap}
                    editable={editable}
                    onDelete={onDelete}
                    onUpdateActivity={onUpdateActivity}
                  />
                ),
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Split email thread into latest message + rest ── */
function splitEmailThread(bodyText: string): { latest: string; rest: string | null } {
  // Look for common thread separator patterns
  const threadPatterns = [
    /\n\s*(?:From|Fra)\s*:/i,
    /\n\s*_{5,}/,
    /\n\s*-{5,}/,
    /\n\s*On .+ wrote:/i,
    /\n\s*Den .+ skrev:/i,
  ];
  let splitIndex = -1;
  for (const pattern of threadPatterns) {
    const match = bodyText.match(pattern);
    if (match && match.index !== undefined && match.index > 20) {
      if (splitIndex === -1 || match.index < splitIndex) {
        splitIndex = match.index;
      }
    }
  }
  if (splitIndex > 0) {
    return { latest: bodyText.slice(0, splitIndex).trim(), rest: bodyText.slice(splitIndex).trim() };
  }
  return { latest: bodyText, rest: null };
}

/* ── Email Row (read-only, collapsible) ── */
function EmailRow({ email }: { email: any }) {
  const [expanded, setExpanded] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const d = new Date(email.created_at);
  const { latest, rest } = useMemo(() => splitEmailThread(email.body_text || ""), [email.body_text]);

  return (
    <div className="relative group">
      {/* Icon on spine */}
      <div className="absolute -left-7 top-[2px] w-[12px] h-[12px] flex items-center justify-center bg-background rounded-full">
        <Mail className="h-3.5 w-3.5 text-primary" />
      </div>

      <div
        className="min-w-0 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[1.0625rem] font-bold text-foreground truncate">{email.subject}</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground transition-transform flex-shrink-0",
                  expanded && "rotate-180",
                )}
              />
            </div>
            <p className="text-[0.8125rem] text-muted-foreground mt-0.5">
              {email.from_name || email.from} → {email.to}
            </p>

            {expanded ? (
              <div className="mt-2 border-t border-border pt-2">
                <p className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-foreground/70">
                  {latest}
                </p>
                {rest && (
                  <>
                    <button
                      className="mt-2 text-[0.75rem] text-muted-foreground hover:text-foreground transition-colors"
                      onClick={(e) => { e.stopPropagation(); setShowThread(!showThread); }}
                    >
                      {showThread ? "Skjul tråd ▴" : "Vis hele tråden ▾"}
                    </button>
                    {showThread && (
                      <div className="mt-2 bg-muted/30 rounded-lg p-3">
                        <p className="text-[0.8125rem] leading-relaxed whitespace-pre-wrap text-muted-foreground">
                          {rest}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : email.preview ? (
              <p className="text-[0.9375rem] text-foreground/70 line-clamp-2 mt-0.5">{email.preview}</p>
            ) : null}
          </div>

          <div className="flex flex-col items-end gap-1 flex-shrink-0 mt-0.5">
            <span className="text-[0.8125rem] text-muted-foreground">
              {format(d, "d. MMM yyyy", { locale: nb })}
            </span>
            <span className="chip chip--action is-signal">
              E-post
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Single Activity Row ── */
function ActivityRow({
  activity,
  currentYear,
  profileMap,
  editable,
  onDelete,
  onUpdateActivity,
}: {
  activity: any;
  currentYear: number;
  profileMap: Record<string, string>;
  editable: boolean;
  onDelete: (id: string) => void;
  onUpdateActivity: (id: string, updates: Record<string, any>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(activity.subject);
  const [editCategory, setEditCategory] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDate, setEditDate] = useState(
    activity.created_at ? format(new Date(activity.created_at), "yyyy-MM-dd") : "",
  );
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    title: displayTitle,
    category: displayCategory,
    cleanDesc,
  } = extractTitleAndCategory(activity.subject, activity.description);
  const ownerName = activity.created_by ? profileMap[activity.created_by] : null;
  const d = new Date(activity.created_at);

  const typeIcon =
    activity.type === "call" || activity.type === "phone" ? (
      <MessageCircle className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
    ) : (
      <FileText className="h-3.5 w-3.5 text-primary" />
    );

  const handleSaveEdit = () => {
    if (!editTitle || !editCategory) return;
    const descWithCat = buildDescriptionWithCategory(editCategory, editDesc.trim());
    const subjectValue = CATEGORIES.some((c) => c.label === editTitle.trim()) ? editCategory : editTitle.trim();
    const updates: Record<string, any> = { subject: subjectValue, description: descWithCat || null };
    if (editDate) {
      updates.created_at = new Date(editDate).toISOString();
    }
    onUpdateActivity(activity.id, updates);
    setEditing(false);
  };

  const handleRowClick = () => {
    if (!editable || editing) return;
    const parsed = extractTitleAndCategory(activity.subject, activity.description);
    let cat = parsed.category;
    // Signal-activities: subject IS the category label
    if (!cat && CATEGORIES.some((c) => c.label === activity.subject)) {
      cat = activity.subject;
    }
    setEditTitle(parsed.title);
    setEditCategory(cat);
    setEditDesc(parsed.cleanDesc);
    setEditDate(activity.created_at ? format(new Date(activity.created_at), "yyyy-MM-dd") : "");
    setConfirmDelete(false);
    setEditing(true);
  };

  return (
    <div className="relative group">
      {/* Icon on spine */}
      <div className="absolute -left-7 top-[2px] w-[12px] h-[12px] flex items-center justify-center bg-background rounded-full">
        {typeIcon}
      </div>

      <div className="min-w-0">
        {editing ? (
          <div className="space-y-2 animate-in fade-in duration-150">
            <div>
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5 block">
                Tittel
              </span>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="text-[0.9375rem] rounded-md"
                autoFocus
              />
            </div>
            <div>
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5 block">
                Kategori
              </span>
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
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSaveEdit();
              }}
            />

            <div className="flex items-center gap-2">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Dato:
              </span>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="h-7 px-2 text-[0.75rem] rounded-full border border-border text-muted-foreground bg-background"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-[34px] px-4 text-[0.8125rem] font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                disabled={!editTitle.trim() || !editCategory}
                onClick={handleSaveEdit}
              >
                Lagre
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-[34px] px-3 text-[0.8125rem] text-muted-foreground rounded-md hover:bg-secondary transition-colors"
                onClick={() => setEditing(false)}
              >
                Avbryt
              </Button>
              <div className="ml-auto">
                {confirmDelete ? (
                  <span className="text-[0.75rem] animate-in fade-in duration-150">
                    <span className="text-destructive mr-1">Er du sikker?</span>
                    <button
                      onClick={() => {
                        onDelete(activity.id);
                        setConfirmDelete(false);
                      }}
                      className="text-destructive font-medium hover:underline mr-1"
                    >
                      Ja, slett
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Avbryt
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div onClick={handleRowClick} className={cn("flex items-start gap-3", editable && "cursor-pointer")}>
            <div className="flex-1 min-w-0">
              {/* Title */}
              <span className="text-[1.0625rem] font-bold text-foreground">{displayTitle}</span>

              {/* Delete confirmation */}
              {confirmDelete && (
                <div className="flex items-center gap-2 mt-1 text-[0.75rem] animate-in fade-in duration-150">
                  <span className="text-destructive">Slett denne aktiviteten?</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(activity.id);
                      setConfirmDelete(false);
                    }}
                    className="text-destructive font-medium hover:underline"
                  >
                    Ja, slett
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(false);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Avbryt
                  </button>
                </div>
              )}

              {/* Description */}
              {cleanDesc ? (
                <div className="mt-0.5">
                  <p className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-foreground/70">{cleanDesc}</p>
                </div>
              ) : null}

              {/* Owner badge */}
              {ownerName && (
                <div className="mt-1">
                  <span className="chip chip--action is-signal">
                    {ownerName}
                  </span>
                </div>
              )}
            </div>

            {/* Right side: Date + Category + Delete */}
            <div className="flex flex-col items-end gap-1 flex-shrink-0 mt-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[0.8125rem] text-muted-foreground">
                    {format(d, "d. MMM yyyy", { locale: nb })}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{fullDate(activity.created_at)}</TooltipContent>
              </Tooltip>
              {displayCategory && <CategoryBadge label={displayCategory} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
