import { useState, useMemo, useEffect } from "react";
import { DescriptionText } from "@/components/DescriptionText";
import { MergeCompanyDialog } from "@/components/company/MergeCompanyDialog";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConsultantCache } from "@/hooks/useConsultantCache";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS,
  DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS,
  DESIGN_LAB_NEUTRAL_TAG_INACTIVE_HOVER_COLORS,
  DesignLabActionButton,
  DesignLabFilterButton,
  DesignLabIconButton,
  DesignLabStaticTag,
} from "@/components/designlab/controls";
import {
  DesignLabGhostAction,
  DesignLabModalActions,
  DesignLabModalChipGroup,
  DesignLabModalContent,
  DesignLabModalField,
  DesignLabModalFieldGrid,
  DesignLabModalForm,
  DesignLabModalInput,
  DesignLabModalLabel,
  DesignLabPrimaryAction,
  DesignLabSectionLabel,
} from "@/components/designlab/system";
import {
  DesignLabEntitySheet,
  DesignLabFormSheet,
  DesignLabFormSheetBody,
  DesignLabFormSheetFooter,
  DesignLabFormSheetHeader,
} from "@/components/designlab/DesignLabEntitySheet";
import {
  AktivOppdragStyleSheet,
  AktivOppdragLabel,
  AktivOppdragChip,
  AktivOppdragFooterRow,
  AktivOppdragCancelButton,
  AktivOppdragPrimaryButton,
} from "@/components/designlab/AktivOppdragStyleSheet";
import {
  Phone,
  Mail,
  Globe,
  Linkedin,
  FileText,
  Calendar,
  CalendarDays,
  ExternalLink,
  ChevronDown,
  Pencil,
  User,
  MessageCircle,
  Plus,
  Trash2,
  ArrowRightLeft,
  MapPin,
  Loader2,
  Target,
  Sparkles,
  MoreVertical,
  StickyNote,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { format, isPast, isToday, getYear } from "date-fns";
import { nb } from "date-fns/locale";
import { relativeDate, fullDate } from "@/lib/relativeDate";
import { cleanDescription } from "@/lib/cleanDescription";
import InlineEdit from "@/components/InlineEdit";
import { useClickWithoutSelection, activateOnEnterOrSpace } from "@/hooks/useClickWithoutSelection";
import { lookupByOrgNr } from "@/components/BrregSearch";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  filterConsultantMatches,
  formatConsultantMatchFreshness,
  getConsultantMatchScoreColor,
  sortConsultantMatches,
} from "@/lib/consultantMatches";
import {
  CONTACT_CV_EMAIL_REQUIRED_MESSAGE,
  contactHasEmail,
  sanitizeContactCvEmail,
} from "@/lib/contactCvEligibility";
import { getSortedTechnologyEntries, mergeTechnologyTags } from "@/lib/technologyTags";
import { crmQueryKeys, crmSummaryQueryKeys, invalidateQueryGroup } from "@/lib/queryKeys";
import {
  CATEGORIES as SIGNAL_CATEGORIES,
  getEffectiveSignal,
  extractCategory,
  getSignalBadgeStyle,
  upsertTaskSignalDescription,
} from "@/lib/categoryUtils";
import { coerceDisplayText } from "@/lib/outlookMail";
import { C, SIGNAL_COLORS } from "@/theme";
import { useCrmNavigation } from "@/lib/crmNavigation";

/** Wrapper for company notes — opens edit on click but allows text selection. */
function CompanyNotesEditTrigger({ onEdit, children }: { onEdit: () => void; children: React.ReactNode }) {
  const handlers = useClickWithoutSelection<HTMLDivElement>(onEdit);
  return (
    <div
      role="button"
      tabIndex={0}
      onMouseDown={handlers.onMouseDown}
      onClick={handlers.onClick}
      onKeyDown={activateOnEnterOrSpace(onEdit)}
      className="group relative block w-full text-left cursor-text focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-sm"
    >
      {children}
    </div>
  );
}

/** Wrapper for company activity row body — opens edit on click but allows text selection. */
function CompanyActivityRowBody({
  onActivate,
  editable,
  children,
}: {
  onActivate: () => void;
  editable: boolean;
  children: React.ReactNode;
}) {
  const handlers = useClickWithoutSelection<HTMLDivElement>(onActivate);
  return (
    <div
      role={editable ? "button" : undefined}
      tabIndex={editable ? 0 : undefined}
      onMouseDown={editable ? handlers.onMouseDown : undefined}
      onClick={editable ? handlers.onClick : undefined}
      onKeyDown={editable ? activateOnEnterOrSpace(onActivate) : undefined}
      className={cn(
        "flex items-start gap-3 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-sm",
        editable && "cursor-pointer",
      )}
    >
      {children}
    </div>
  );
}

/* ── Category system (shared with ContactCardContent) ── */
const CATEGORIES = [
  { label: "Behov nå" },
  { label: "Får fremtidig behov" },
  { label: "Får kanskje behov" },
  { label: "Ukjent om behov" },
  { label: "Ikke aktuelt" },
] as const;

const LEGACY_CATEGORY_MAP: Record<string, string> = {
  "Fremtidig behov": "Får fremtidig behov",
  "Har kanskje behov": "Får kanskje behov",
  "Vil kanskje få behov": "Får kanskje behov",
  "Aldri aktuelt": "Ikke aktuelt",
};

function normalizeCategoryLabel(label: string | null | undefined): string {
  const normalizedLabel = safeText(label).trim();
  return LEGACY_CATEGORY_MAP[normalizedLabel] || normalizedLabel;
}

function safeText(value: unknown): string {
  return coerceDisplayText(value);
}

function splitCommaSeparatedText(value: unknown): string[] {
  return safeText(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseValidDate(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getCategoryPickerActiveColors(label: string) {
  const normalized = normalizeCategoryLabel(label);
  const colors = SIGNAL_COLORS[normalized as keyof typeof SIGNAL_COLORS];
  if (!colors) return undefined;

  return {
    background: colors.bg,
    color: colors.color,
    border: `1px solid ${colors.border}`,
    fontWeight: 600,
  };
}

function CategoryBadge({ label, className }: { label: string; className?: string }) {
  const normalized = normalizeCategoryLabel(label);
  const isKnown = CATEGORIES.some((c) => c.label === normalized);
  if (!isKnown) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[6px] border px-2.5 py-0.5 text-[0.75rem] font-medium h-7",
        className,
      )}
      style={getSignalBadgeStyle(normalized)}
    >
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
            "h-7 px-2.5 text-[0.75rem] rounded-[6px] border transition-colors font-medium",
            selected === cat.label
              ? "bg-[#E8ECF5] text-[#1A1C1F] border-[#C5CBE8] font-semibold"
              : "border-border text-muted-foreground hover:bg-secondary",
          )}
          style={selected === cat.label ? getCategoryPickerActiveColors(cat.label) : undefined}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}

function buildDescriptionWithCategory(category: string | null | undefined, description: string | null | undefined): string {
  const normalizedCategory = normalizeCategoryLabel(category);
  const normalizedDescription = safeText(description);
  if (!normalizedCategory) return normalizedDescription;
  return normalizedDescription ? `[${normalizedCategory}]\n${normalizedDescription}` : `[${normalizedCategory}]`;
}

function parseDescriptionCategory(description: unknown): { category: string; text: string } {
  const normalizedDescription = safeText(description);
  if (!normalizedDescription) return { category: "", text: "" };
  const match = normalizedDescription.match(/^\[([^\]]+)\]\n?([\s\S]*)$/);
  if (match) {
    const cat = match[1];
    if (CATEGORIES.some((c) => c.label === cat) || Object.keys(LEGACY_CATEGORY_MAP).includes(cat)) {
      return { category: normalizeCategoryLabel(cat), text: match[2].trim() };
    }
  }
  return { category: "", text: normalizedDescription };
}

function extractTitleAndCategory(subject: unknown, description: unknown) {
  const safeSubject = safeText(subject);
  const normalizedSubject = normalizeCategoryLabel(safeSubject);
  if (CATEGORIES.some((c) => c.label === normalizedSubject)) {
    return { title: normalizedSubject, category: normalizedSubject, cleanDesc: "" };
  }
  const parsed = parseDescriptionCategory(description);
  return { title: safeSubject, category: parsed.category, cleanDesc: cleanDescription(parsed.text) || "" };
}

const statusLabels: Record<string, { label: string; className: string }> = {
  lead: { label: "Lead", className: "bg-tag text-tag-foreground" },
  prospect: { label: "Prospekt", className: "bg-warning/10 text-warning" },
  customer: { label: "Kunde", className: "bg-success/10 text-success" },
  churned: { label: "Tapt", className: "bg-destructive/10 text-destructive" },
  active: { label: "Aktiv", className: "bg-success/10 text-success" },
};

interface DefaultHiddenConfig {
  techDna?: boolean;
  notes?: boolean;
}

interface CompanyCardContentProps {
  companyId: string;
  editable?: boolean;
  onOpenContact?: (contactId: string) => void;
  onNavigateToFullPage?: () => void;
  headerPaddingTop?: number;
  defaultHidden?: DefaultHiddenConfig;
  showContactsDivider?: boolean;
  /** When true, the "Ny kontakt" overlay uses the V1-style sheet that mirrors OppdragEditSheet. */
  useV1CreateSheet?: boolean;
}

export function CompanyCardContent({
  companyId,
  editable = false,
  onOpenContact,
  onNavigateToFullPage,
  headerPaddingTop,
  defaultHidden,
  showContactsDivider = false,
  useV1CreateSheet = false,
}: CompanyCardContentProps) {
  const navigate = useNavigate();
  const { getContactPath, getCompanyPath } = useCrmNavigation();
  const queryClient = useQueryClient();
  const { interne: cachedInterne, eksterne: cachedEksterne } = useConsultantCache();
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    title: "",
    linkedin: "",
    location: "",
    cv_email: false,
    call_list: false,
  });
  const [editCompanyOpen, setEditCompanyOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    org_number: "",
    city: "",
    website: "",
    linkedin: "",
    locations: [] as string[],
  });
  const [newLocation, setNewLocation] = useState("");
  const [signalPickerOpen, setSignalPickerOpen] = useState(false);
  const [pendingSignal, setPendingSignal] = useState<string | null>(null);
  const [signalContactId, setSignalContactId] = useState<string>("");
  const [matchingKonsulenter, setMatchingKonsulenter] = useState(false);
  const [konsulentResults, setKonsulentResults] = useState<any[] | null>(null);
  const [konsulentFilter, setKonsulentFilter] = useState<"Alle" | "Ansatte" | "Eksterne">("Alle");
  const [konsulentMatchUpdatedAt, setKonsulentMatchUpdatedAt] = useState<string | null>(null);
  const { user } = useAuth();
  const [showAnalyze, setShowAnalyze] = useState(false);
  const [analyzeText, setAnalyzeText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [techTagInput, setTechTagInput] = useState("");
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [deleteCompanyDialogOpen, setDeleteCompanyDialogOpen] = useState(false);
  const [mergeCompanyDialogOpen, setMergeCompanyDialogOpen] = useState(false);
  const [showTechDna, setShowTechDna] = useState(!defaultHidden?.techDna);
  const [showNotes, setShowNotes] = useState(false);
  const resetNewContactForm = () => {
    setContactForm({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      title: "",
      linkedin: "",
      location: "",
      cv_email: false,
      call_list: false,
    });
  };

  const { data: company, isLoading } = useQuery({
    queryKey: crmQueryKeys.companies.detail(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*, profiles!companies_owner_id_fkey(full_name)")
        .eq("id", companyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Pre-fill edit form when dialog opens
  useEffect(() => {
    if (editCompanyOpen && company) {
      const locs = splitCommaSeparatedText(company.city);
      setEditForm({
        name: safeText(company.name),
        org_number: safeText(company.org_number),
        city: safeText(company.city),
        website: safeText(company.website),
        linkedin: safeText(company.linkedin),
        locations: locs.length > 0 ? locs : [],
      });
      setNewLocation("");
    }
  }, [editCompanyOpen, company]);

  // Pre-fill contact location when dialog opens
  useEffect(() => {
    if (newContactOpen && company) {
      const locs = splitCommaSeparatedText(company.city);
      if (locs.length === 1) {
        setContactForm((prev) => ({ ...prev, location: locs[0] }));
      }
    }
  }, [newContactOpen, company]);

  useEffect(() => {
    if (!company) return;
    setShowNotes(Boolean(safeText((company as any).notes).trim()));
  }, [companyId, company?.notes]);

  // BRREG lookup when org.nr is 9 digits
  useEffect(() => {
    const cleaned = editForm.org_number.replace(/\s/g, "");
    if (cleaned.length !== 9 || !/^\d{9}$/.test(cleaned)) return;
    lookupByOrgNr(cleaned).then((r) => {
      if (r) {
        if (!editForm.name) setEditForm((prev) => ({ ...prev, name: r.navn }));
        const city = r.forretningsadresse?.kommune || null;
        if (city && editForm.locations.length === 0) {
          setEditForm((prev) => ({ ...prev, locations: [city] }));
        }
      }
    });
  }, [editForm.org_number]);

  const { data: allProfiles = [] } = useQuery({
    queryKey: crmQueryKeys.profiles.all(),
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data;
    },
  });
  const profileMapFull = Object.fromEntries(allProfiles.map((p) => [p.id, safeText(p.full_name)]));

  const { data: contacts = [] } = useQuery({
    queryKey: crmQueryKeys.companies.contacts(companyId),
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

  const contactIds = contacts.map((c) => c.id);
  const sanitizedContacts = useMemo(
    () =>
      contacts.map((contact) => {
        const firstName = safeText((contact as any).first_name);
        const lastName = safeText((contact as any).last_name);
        const title = safeText((contact as any).title);
        const ownerName = safeText((contact as any).profiles?.full_name);
        const displayName = [firstName, lastName].filter(Boolean).join(" ").trim() || "Uten navn";

        return {
          ...contact,
          first_name: firstName,
          last_name: lastName,
          title,
          ownerName,
          displayName,
        };
      }),
    [contacts],
  );

  const { data: companyActivities = [] } = useQuery({
    queryKey: crmQueryKeys.companies.activities(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*, contacts(first_name, last_name)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: contactActivities = [] } = useQuery({
    queryKey: crmQueryKeys.companies.contactActivities(companyId, contactIds),
    queryFn: async () => {
      if (contactIds.length === 0) return [];
      const { data, error } = await supabase
        .from("activities")
        .select("*, contacts(first_name, last_name)")
        .in("contact_id", contactIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && contactIds.length > 0,
  });

  const activities = useMemo(() => {
    const allActivitiesMap = new Map<string, any>();
    const normalizeActivity = (activity: any, index: number) => ({
      ...activity,
      id: safeText(activity?.id) || `activity-${index}`,
      created_at: safeText(activity?.created_at),
      subject: safeText(activity?.subject),
      description: safeText(activity?.description) || null,
      type: safeText(activity?.type),
      created_by: safeText(activity?.created_by) || null,
      contact_id: safeText(activity?.contact_id) || null,
      contacts:
        activity?.contacts && typeof activity.contacts === "object"
          ? {
              ...activity.contacts,
              first_name: safeText((activity.contacts as any)?.first_name),
              last_name: safeText((activity.contacts as any)?.last_name),
            }
          : null,
    });

    companyActivities.forEach((activity: any, index: number) => {
      const normalized = normalizeActivity(activity, index);
      allActivitiesMap.set(normalized.id, normalized);
    });
    contactActivities.forEach((activity: any, index: number) => {
      const normalized = normalizeActivity(activity, index + companyActivities.length);
      if (!allActivitiesMap.has(normalized.id)) allActivitiesMap.set(normalized.id, normalized);
    });

    return Array.from(allActivitiesMap.values()).sort(
      (a, b) => (parseValidDate(b.created_at)?.getTime() ?? -Infinity) - (parseValidDate(a.created_at)?.getTime() ?? -Infinity),
    );
  }, [companyActivities, contactActivities]);

  const { data: companyTasks = [] } = useQuery({
    queryKey: crmQueryKeys.companies.tasks(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, contacts(first_name, last_name)")
        .eq("company_id", companyId)
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: contactTasks = [] } = useQuery({
    queryKey: crmQueryKeys.companies.contactTasks(companyId, contactIds),
    queryFn: async () => {
      if (contactIds.length === 0) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("*, contacts(first_name, last_name)")
        .in("contact_id", contactIds)
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && contactIds.length > 0,
  });

  const { data: techProfile } = useQuery({
    queryKey: crmQueryKeys.companies.techProfile(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_tech_profile")
        .select("teknologier, konsulent_hyppighet, sist_fra_finn")
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const allTasksMap = new Map<string, any>();
  companyTasks.forEach((t) => allTasksMap.set(t.id, t));
  contactTasks.forEach((t) => {
    if (!allTasksMap.has(t.id)) allTasksMap.set(t.id, t);
  });
  const tasks = Array.from(allTasksMap.values()).sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, string | null>) => {
      const { error } = await supabase.from("companies").update(updates as any).eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.companies.detail(companyId) });
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.companies.all() });
      toast.success("Oppdatert");
    },
    onError: () => toast.error("Kunne ikke oppdatere"),
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
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.companies.tasks(companyId) });
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.companies.contactTasks(companyId) });
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.generic.tasks() });
    },
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("companies").delete().eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.companies.all() });
      toast.success("Selskap slettet");
      navigate("/selskaper");
    },
    onError: () => toast.error("Kunne ikke slette selskap"),
  });

  const changeSignalMutation = useMutation({
    mutationFn: async ({ signal, contactId }: { signal: string; contactId: string }) => {
      const primaryTask = contactTasks.find((task: any) => task.contact_id === contactId);

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
        company_id: companyId,
        assigned_to: user?.id,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.companies.tasks(companyId) });
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.companies.contactTasks(companyId) });
      invalidateQueryGroup(queryClient, crmSummaryQueryKeys);
      toast.success("Signal oppdatert");
    },
    onError: () => toast.error("Kunne ikke oppdatere signal"),
  });

  const updateField = (field: string) => (value: string) => {
    updateMutation.mutate({ [field]: value || null });
  };

  const visibleKonsulentResults = useMemo(
    () => filterConsultantMatches(konsulentResults || [], konsulentFilter),
    [konsulentFilter, konsulentResults],
  );
  const konsulentMatchFreshness = formatConsultantMatchFreshness(konsulentMatchUpdatedAt);

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-7 w-48 bg-secondary rounded" />
        <div className="h-4 w-32 bg-secondary rounded" />
      </div>
    );
  }
  if (!company) return <p className="text-sm text-muted-foreground">Selskap ikke funnet</p>;

  const companyName = safeText(company.name) || "Uten navn";
  const companyOrgNumber = safeText(company.org_number);
  const companyCity = safeText(company.city);
  const companyWebsite = safeText(company.website);
  const companyLinkedin = safeText(company.linkedin);
  const companyEmail = safeText((company as any).email);
  const companyNotes = safeText((company as any).notes);
  const companyLocations = splitCommaSeparatedText(companyCity);

  const STATUS_OPTIONS = [
    { value: "prospect", label: "Potensiell kunde" },
    { value: "customer", label: "Kunde" },
    { value: "partner", label: "Partner" },
    { value: "churned", label: "Ikke relevant selskap" },
  ] as const;
  const currentStatus =
    STATUS_OPTIONS.find((s) => s.value === company.status || (s.value === "customer" && company.status === "kunde")) ||
    STATUS_OPTIONS[0];
  const ownerFullName = safeText((company as any).profiles?.full_name) || null;

  const effectiveSignal = getEffectiveSignal(
    activities.map((a) => ({ created_at: a.created_at, subject: a.subject, description: a.description })),
    tasks.map((t) => ({ created_at: t.created_at, title: t.title, description: t.description, due_date: t.due_date })),
  );
  const signalBadgeStyle = getSignalBadgeStyle(effectiveSignal);

  const handleFinnKonsulenter = async () => {
    setMatchingKonsulenter(true);
    setKonsulentResults(null);
    setKonsulentMatchUpdatedAt(null);
    try {
      const { data: foresporslerData } = await supabase
        .from("foresporsler")
        .select("teknologier")
        .eq("selskap_id", companyId)
        .gte("mottatt_dato", new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
      const teknologier = mergeTechnologyTags(
        techProfile?.teknologier ? Object.keys(techProfile.teknologier as Record<string, number>) : [],
        ...(foresporslerData || []).map((foresporsel) => foresporsel.teknologier || []),
        ...(contacts as any[]).map((contact) => (contact as any).teknologier || []),
      ).slice(0, 15);
      if (!teknologier.length) {
        toast("Ingen teknisk profil på selskapet ennå — legg til teknologier på forespørsler eller kontakter");
        setMatchingKonsulenter(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke("match-consultants", {
        body: {
          teknologier,
          sted: companyCity,
          interne: cachedInterne,
          eksterne: cachedEksterne,
          kontakt_er_innkjoper: false,
          kontakt_signal: effectiveSignal || "Ukjent om behov",
          siste_kontakt_dato: activities[0]?.created_at
            ? new Date(activities[0].created_at).toLocaleDateString("nb-NO", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : null,
          aktive_foresporsler: [],
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setKonsulentResults(sortConsultantMatches(Array.isArray(data) ? data : []));
      setKonsulentMatchUpdatedAt(new Date().toISOString());
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke kjøre matching");
      setKonsulentResults([]);
      setKonsulentMatchUpdatedAt(null);
    } finally {
      setMatchingKonsulenter(false);
    }
  };

  const handleAnalyzeText = async () => {
    if (!analyzeText.trim()) return;
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ tags: string[] }>("extract-technology-tags", {
        body: { text: analyzeText },
      });
      if (error) throw error;
      const tags: string[] = data?.tags || [];
      if (tags.length > 0) {
        toast.success(`${tags.length} teknologier funnet`);
      } else {
        toast("Ingen teknologier funnet i teksten");
      }
      setShowAnalyze(false);
      setAnalyzeText("");
    } catch {
      toast.error("Kunne ikke analysere tekst");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const openEditCompanyDialog = () => {
    if (!company) return;
    setEditForm({
      name: companyName,
      org_number: companyOrgNumber,
      city: companyCity,
      website: companyWebsite,
      linkedin: companyLinkedin,
      locations: companyLocations,
    });
    setNewLocation("");
    setEditCompanyOpen(true);
  };

  const companyDetailSections = (
    <div className="space-y-5">
      {/* ── Teknisk DNA ── */}
      {showTechDna && (() => {
        const techTags = getSortedTechnologyEntries(techProfile?.teknologier as any);
        const contactTechTags = mergeTechnologyTags(
          ...(contacts as any[]).map((contact) => (contact as any).teknologier || []),
        );
        const hasTech = techTags.length > 0 || contactTechTags.length > 0;

        return (
          <div className="mb-2">
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Teknisk DNA for {companyName}
                {techProfile?.konsulent_hyppighet ? (
                  <span className="ml-2 text-muted-foreground/50 font-normal normal-case tracking-normal">
                    · {techProfile.konsulent_hyppighet} annonser
                  </span>
                ) : null}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {hasTech && (
                  <DesignLabActionButton
                    onClick={handleFinnKonsulenter}
                    disabled={matchingKonsulenter}
                    variant="secondary"
                    style={{ height: 32, fontSize: 12 }}
                  >
                    {matchingKonsulenter ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Matcher...
                      </>
                    ) : (
                      <>
                        <Target className="h-3.5 w-3.5 text-primary" /> Finn konsulent
                      </>
                    )}
                  </DesignLabActionButton>
                )}
              </div>
            </div>

            <p className="text-[0.75rem] text-muted-foreground mb-2">
              Bygges automatisk fra forespørsler, aktivitet og selskapets eksisterende kontakt-DNA.
            </p>

            {showAnalyze && (
              <div className="mb-3 p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
                <p className="text-[0.75rem] text-muted-foreground">
                  Lim inn stillingsbeskrivelse, e-post eller kravspesifikasjon — AI finner relevante teknologier
                  automatisk.
                </p>
                <textarea
                  value={analyzeText}
                  onChange={(e) => setAnalyzeText(e.target.value)}
                  placeholder="Lim inn tekst her..."
                  rows={4}
                  className="w-full text-[0.875rem] rounded-md border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
                />

                <div className="flex items-center gap-2">
                  <DesignLabActionButton
                    onClick={handleAnalyzeText}
                    disabled={!analyzeText.trim() || isAnalyzing}
                    variant="primary"
                    style={{ height: 32, fontSize: 12 }}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {isAnalyzing ? "Analyserer..." : "Finn teknologier"}
                  </DesignLabActionButton>
                  <DesignLabActionButton
                    onClick={() => {
                      setShowAnalyze(false);
                      setAnalyzeText("");
                    }}
                    variant="ghost"
                    style={{ height: 32, fontSize: 12 }}
                  >
                    Avbryt
                  </DesignLabActionButton>
                </div>
              </div>
            )}

            {konsulentResults !== null && (
              <div className="space-y-3 mb-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <div>
                      <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Konsulentmatch
                      </span>
                      {konsulentMatchFreshness && (
                        <p className="text-[0.6875rem] text-muted-foreground normal-case tracking-normal">
                          {konsulentMatchFreshness}
                        </p>
                      )}
                    </div>
                    <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary/10 text-primary text-[0.6875rem] font-semibold">
                      {konsulentResults.length}
                    </span>
                  </div>
                  <button
                    onClick={handleFinnKonsulenter}
                    className="text-[0.75rem] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Kjør på nytt
                  </button>
                </div>
                {visibleKonsulentResults.length === 0 ? (
                  <p className="text-[0.8125rem] text-muted-foreground">Ingen treff med score ≥ 4</p>
                ) : (
                  <div className="space-y-2">
                    {konsulentResults.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        {(["Alle", "Ansatte", "Eksterne"] as const).map((f) => (
                          <DesignLabFilterButton
                            key={f}
                            onClick={() => setKonsulentFilter(f)}
                            active={konsulentFilter === f}
                          >
                            {f}
                          </DesignLabFilterButton>
                        ))}
                      </div>
                    )}
                    {visibleKonsulentResults.map((m: any, i: number) => (
                      <div key={`${m.type}-${m.id}`} className="rounded-lg border border-border bg-card p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[0.75rem] font-bold text-muted-foreground">#{i + 1}</span>
                            <span className="text-[0.875rem] font-semibold text-foreground truncate">{m.navn}</span>
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold shrink-0",
                                m.type === "intern" ? "bg-foreground text-background" : "bg-blue-100 text-blue-700",
                              )}
                            >
                              {m.type === "intern" ? "Ansatt" : "Ekstern"}
                            </span>
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
                            <span key={t} className="chip chip--tech">
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

            {techTags.length > 0 ? (
              <div className="space-y-3">
                <div>
                  <p className="text-[0.6875rem] text-muted-foreground/60 mb-1.5">Fra Finn og forespørsler</p>
                  <div className="flex flex-wrap gap-1">
                    {techTags.slice(0, 20).map(({ name, count }) => (
                      <span
                        key={name}
                        className="inline-flex items-center rounded-full bg-secondary text-foreground px-2.5 py-0.5 text-[0.75rem] font-mono border border-border"
                      >
                        {name}
                        {count > 1 ? <span className="ml-1 text-muted-foreground/60">×{count}</span> : null}
                      </span>
                    ))}
                  </div>
                  {techProfile?.sist_fra_finn && (
                    <p className="text-[0.6875rem] text-muted-foreground/40 mt-1.5">
                      Oppdatert{" "}
                      {new Date(techProfile.sist_fra_finn).toLocaleDateString("nb-NO", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
                {contactTechTags.length > 0 && (
                  <>
                    <div className="border-t border-border/50" />
                    <div>
                      <p className="text-[0.6875rem] text-muted-foreground/60 mb-1.5">Kontakt-DNA</p>
                      <div className="flex flex-wrap gap-1">
                        {contactTechTags.slice(0, 10).map((tech: string) => (
                          <span
                            key={tech}
                            className="inline-flex items-center rounded-full bg-secondary text-foreground px-2.5 py-0.5 text-[0.75rem] font-mono border border-border"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="text-[0.8125rem] text-muted-foreground/50">Ingen teknisk data ennå</p>
            )}
          </div>
        );
      })()}

      {tasks.length > 0 && (
        <div className="bg-card border border-border rounded-lg shadow-card p-4">
          <div className="flex items-center mb-3" style={{ minHeight: 32 }}>
            <h3 className="text-[13px] font-medium text-[#1A1C1F]">
              Oppfølginger <span className="font-normal text-[#8C929C]">· {tasks.length}</span>
            </h3>
          </div>
          <div className="space-y-px">
            {tasks.map((task) => {
              const dueDate = parseValidDate(task.due_date);
              const overdue = dueDate ? isPast(dueDate) && !isToday(dueDate) : false;
              const today = dueDate ? isToday(dueDate) : false;
              const contactName = (task.contacts as any)?.first_name
                ? `${(task.contacts as any).first_name} ${(task.contacts as any).last_name}`
                : null;
              const {
                title: displayTitle,
                category: displayCategory,
                cleanDesc: displayDesc,
              } = extractTitleAndCategory(task.title, task.description);
              return (
                <div
                  key={task.id}
                  className="flex items-start gap-2.5 py-2.5 px-1 rounded-md transition-all duration-200 group hover:bg-background/60 cursor-pointer"
                  onClick={() => {
                    if (task.contact_id) navigate(getContactPath(task.contact_id));
                  }}
                >
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={false}
                      onCheckedChange={() => toggleTaskMutation.mutate(task.id)}
                      className="h-4 w-4 rounded-[4px] border-2 border-muted-foreground/40 flex-shrink-0 mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[1.0625rem] font-bold text-foreground">{displayTitle}</div>
                    {contactName && (
                      <a
                        href={task.contact_id ? getContactPath(task.contact_id) : undefined}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[0.8125rem] font-semibold text-blue-600 hover:underline block mt-0.5"
                      >
                        → {contactName}
                      </a>
                    )}
                    {displayDesc && !/^\[.+\]$/.test(displayDesc.trim()) && (
                      <p className="text-[0.875rem] text-foreground/70 truncate mt-0.5">{displayDesc}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      {task.assigned_to && profileMapFull[task.assigned_to] && (
                        <span
                          className="inline-flex items-center rounded-[6px] border px-2.5 py-0.5 text-[0.75rem] font-medium h-7"
                          style={{
                            background: C.statusNeutralBg,
                            color: C.statusNeutral,
                            border: `1px solid ${C.statusNeutralBorder}`,
                          }}
                        >
                          {profileMapFull[task.assigned_to]}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0 mt-0.5">
                    {dueDate && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              "text-[0.8125rem] font-medium",
                              overdue
                                ? "text-destructive"
                                : today
                                  ? "text-[hsl(var(--warning))]"
                                  : "text-muted-foreground",
                            )}
                          >
                            {format(dueDate, "d. MMM yyyy", { locale: nb })}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{fullDate(dueDate.toISOString())}</TooltipContent>
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

      <div className={cn((tasks.length > 0 || showTechDna) && "mt-5")}>
        <CompanyActivityTimeline
          activities={activities}
          profileMap={profileMapFull}
          companyId={companyId}
          editable={editable}
        />
      </div>
    </div>
  );

  const relatedContactsContent = (
    <div className="pt-4 md:pt-0">
      <div className="mb-3 flex items-center justify-between gap-3" style={{ minHeight: 32 }}>
        <h3 className="text-[13px] font-medium text-[#1A1C1F]">
          Kontakter <span className="font-normal text-[#8C929C]">· {contacts.length}</span>
        </h3>
        {editable && (
          <>
            <DesignLabPrimaryAction onClick={() => setNewContactOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Ny kontakt
            </DesignLabPrimaryAction>
            {useV1CreateSheet ? (
              <AktivOppdragStyleSheet
                open={newContactOpen}
                onOpenChange={(nextOpen) => {
                  setNewContactOpen(nextOpen);
                  if (!nextOpen) resetNewContactForm();
                }}
                title="Ny kontakt"
                headerSlot={
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <AktivOppdragLabel required>Fornavn</AktivOppdragLabel>
                      <Input
                        value={contactForm.first_name}
                        onChange={(e) => setContactForm({ ...contactForm, first_name: e.target.value })}
                        required
                        className="text-[0.875rem]"
                      />
                    </div>
                    <div>
                      <AktivOppdragLabel required>Etternavn</AktivOppdragLabel>
                      <Input
                        value={contactForm.last_name}
                        onChange={(e) => setContactForm({ ...contactForm, last_name: e.target.value })}
                        required
                        className="text-[0.875rem]"
                      />
                    </div>
                  </div>
                }
                footer={
                  <AktivOppdragFooterRow>
                    <AktivOppdragCancelButton
                      onClick={() => {
                        setNewContactOpen(false);
                        resetNewContactForm();
                      }}
                    >
                      Avbryt
                    </AktivOppdragCancelButton>
                    <AktivOppdragPrimaryButton
                      type="submit"
                      form="design-lab-create-contact-form"
                      disabled={!contactForm.first_name.trim() || !contactForm.last_name.trim()}
                    >
                      Opprett kontakt
                    </AktivOppdragPrimaryButton>
                  </AktivOppdragFooterRow>
                }
              >
                <form
                  id="design-lab-create-contact-form"
                  className="space-y-5"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const { error } = await supabase.from("contacts").insert({
                      first_name: contactForm.first_name,
                      last_name: contactForm.last_name,
                      email: contactForm.email || null,
                      phone: contactForm.phone || null,
                      title: contactForm.title || null,
                      linkedin: contactForm.linkedin || null,
                      locations: contactForm.location ? [contactForm.location] : [],
                      cv_email: sanitizeContactCvEmail(contactForm.email, contactForm.cv_email),
                      call_list: contactForm.call_list,
                      company_id: companyId,
                      created_by: user?.id,
                      owner_id: user?.id,
                    });
                    if (error) {
                      toast.error("Kunne ikke opprette kontakt");
                      return;
                    }
                    queryClient.invalidateQueries({ queryKey: crmQueryKeys.companies.contacts(companyId) });
                    queryClient.invalidateQueries({ queryKey: crmQueryKeys.contacts.all() });
                    setNewContactOpen(false);
                    resetNewContactForm();
                    toast.success("Kontakt opprettet");
                  }}
                >
                  <div>
                    <AktivOppdragLabel>Stilling</AktivOppdragLabel>
                    <Input
                      value={contactForm.title}
                      onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
                      className="text-[0.875rem]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <AktivOppdragLabel>E-post</AktivOppdragLabel>
                      <Input
                        value={contactForm.email}
                        onChange={(e) =>
                          setContactForm({
                            ...contactForm,
                            email: e.target.value,
                            cv_email: sanitizeContactCvEmail(e.target.value, contactForm.cv_email),
                          })
                        }
                        type="email"
                        className="text-[0.875rem]"
                      />
                    </div>
                    <div>
                      <AktivOppdragLabel>Telefon</AktivOppdragLabel>
                      <Input
                        value={contactForm.phone}
                        onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                        className="text-[0.875rem]"
                      />
                    </div>
                  </div>

                  <div>
                    <AktivOppdragLabel>LinkedIn</AktivOppdragLabel>
                    <Input
                      value={contactForm.linkedin}
                      onChange={(e) => setContactForm({ ...contactForm, linkedin: e.target.value })}
                      placeholder="https://linkedin.com/in/..."
                      className="text-[0.875rem]"
                    />
                  </div>

                  {(() => {
                    const locs = companyLocations;
                    if (locs.length === 0) return null;
                    return (
                      <div>
                        <AktivOppdragLabel>Geografisk sted</AktivOppdragLabel>
                        <div className="flex flex-wrap gap-1.5">
                          {locs.map((loc) => (
                            <AktivOppdragChip
                              key={loc}
                              onClick={() =>
                                setContactForm({
                                  ...contactForm,
                                  location: loc === contactForm.location ? "" : loc,
                                })
                              }
                              active={contactForm.location === loc}
                            >
                              {loc}
                            </AktivOppdragChip>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div>
                    <AktivOppdragLabel>Egenskaper</AktivOppdragLabel>
                    <div className="flex flex-wrap gap-1.5">
                      <AktivOppdragChip
                        onClick={() => {
                          if (!contactForm.cv_email && !contactHasEmail(contactForm)) {
                            toast.error(CONTACT_CV_EMAIL_REQUIRED_MESSAGE);
                            return;
                          }
                          setContactForm({ ...contactForm, cv_email: !contactForm.cv_email });
                        }}
                        active={contactForm.cv_email}
                      >
                        CV-Epost
                      </AktivOppdragChip>
                      <AktivOppdragChip
                        onClick={() => setContactForm({ ...contactForm, call_list: !contactForm.call_list })}
                        active={contactForm.call_list}
                      >
                        Innkjøper
                      </AktivOppdragChip>
                    </div>
                  </div>
                </form>
              </AktivOppdragStyleSheet>
            ) : (
            <DesignLabFormSheet
              open={newContactOpen}
              onOpenChange={(nextOpen) => {
                setNewContactOpen(nextOpen);
                if (!nextOpen) resetNewContactForm();
              }}
            >
              <DesignLabFormSheetHeader title="Ny kontakt" />
              <form
                className="flex flex-1 flex-col min-h-0"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const { error } = await supabase.from("contacts").insert({
                    first_name: contactForm.first_name,
                    last_name: contactForm.last_name,
                    email: contactForm.email || null,
                    phone: contactForm.phone || null,
                    title: contactForm.title || null,
                    linkedin: contactForm.linkedin || null,
                    locations: contactForm.location ? [contactForm.location] : [],
                    cv_email: sanitizeContactCvEmail(contactForm.email, contactForm.cv_email),
                    call_list: contactForm.call_list,
                    company_id: companyId,
                    created_by: user?.id,
                    owner_id: user?.id,
                  });
                  if (error) {
                    toast.error("Kunne ikke opprette kontakt");
                    return;
                  }
                  queryClient.invalidateQueries({ queryKey: crmQueryKeys.companies.contacts(companyId) });
                  queryClient.invalidateQueries({ queryKey: crmQueryKeys.contacts.all() });
                  setNewContactOpen(false);
                  resetNewContactForm();
                  toast.success("Kontakt opprettet");
                }}
              >
                <DesignLabFormSheetBody>
                  <DesignLabModalFieldGrid>
                    <DesignLabModalField>
                      <DesignLabSectionLabel required>Fornavn</DesignLabSectionLabel>
                      <DesignLabModalInput
                        value={contactForm.first_name}
                        onChange={(e) => setContactForm({ ...contactForm, first_name: e.target.value })}
                        required
                      />
                    </DesignLabModalField>
                    <DesignLabModalField>
                      <DesignLabSectionLabel required>Etternavn</DesignLabSectionLabel>
                      <DesignLabModalInput
                        value={contactForm.last_name}
                        onChange={(e) => setContactForm({ ...contactForm, last_name: e.target.value })}
                        required
                      />
                    </DesignLabModalField>
                  </DesignLabModalFieldGrid>

                  <DesignLabModalField>
                    <DesignLabSectionLabel>Stilling</DesignLabSectionLabel>
                    <DesignLabModalInput
                      value={contactForm.title}
                      onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
                    />
                  </DesignLabModalField>

                  <DesignLabModalFieldGrid>
                    <DesignLabModalField>
                      <DesignLabSectionLabel>E-post</DesignLabSectionLabel>
                      <DesignLabModalInput
                        value={contactForm.email}
                        onChange={(e) =>
                          setContactForm({
                            ...contactForm,
                            email: e.target.value,
                            cv_email: sanitizeContactCvEmail(e.target.value, contactForm.cv_email),
                          })
                        }
                        type="email"
                      />
                    </DesignLabModalField>
                    <DesignLabModalField>
                      <DesignLabSectionLabel>Telefon</DesignLabSectionLabel>
                      <DesignLabModalInput
                        value={contactForm.phone}
                        onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                      />
                    </DesignLabModalField>
                  </DesignLabModalFieldGrid>

                  <DesignLabModalField>
                    <DesignLabSectionLabel>LinkedIn</DesignLabSectionLabel>
                    <DesignLabModalInput
                      value={contactForm.linkedin}
                      onChange={(e) => setContactForm({ ...contactForm, linkedin: e.target.value })}
                      placeholder="https://linkedin.com/in/..."
                    />
                  </DesignLabModalField>

                  {(() => {
                    const locs = companyLocations;
                    if (locs.length === 0) return null;
                    return (
                      <DesignLabModalField>
                        <DesignLabSectionLabel>Geografisk sted</DesignLabSectionLabel>
                        <DesignLabModalChipGroup>
                          {locs.map((loc) => (
                            <DesignLabFilterButton
                              key={loc}
                              type="button"
                              onClick={() =>
                                setContactForm({ ...contactForm, location: loc === contactForm.location ? "" : loc })
                              }
                              active={contactForm.location === loc}
                              activeColors={DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS}
                              inactiveColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}
                              inactiveHoverColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_HOVER_COLORS}
                            >
                              {loc}
                            </DesignLabFilterButton>
                          ))}
                        </DesignLabModalChipGroup>
                      </DesignLabModalField>
                    );
                  })()}

                  <DesignLabModalField>
                    <DesignLabSectionLabel>Egenskaper</DesignLabSectionLabel>
                    <DesignLabModalChipGroup>
                      <DesignLabFilterButton
                        type="button"
                        onClick={() => {
                          if (!contactForm.cv_email && !contactHasEmail(contactForm)) {
                            toast.error(CONTACT_CV_EMAIL_REQUIRED_MESSAGE);
                            return;
                          }
                          setContactForm({ ...contactForm, cv_email: !contactForm.cv_email });
                        }}
                        active={contactForm.cv_email}
                        activeColors={DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS}
                        inactiveColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}
                        inactiveHoverColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_HOVER_COLORS}
                      >
                        CV-Epost
                      </DesignLabFilterButton>
                      <DesignLabFilterButton
                        type="button"
                        onClick={() => setContactForm({ ...contactForm, call_list: !contactForm.call_list })}
                        active={contactForm.call_list}
                        activeColors={DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS}
                        inactiveColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}
                        inactiveHoverColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_HOVER_COLORS}
                      >
                        Innkjøper
                      </DesignLabFilterButton>
                    </DesignLabModalChipGroup>
                  </DesignLabModalField>
                </DesignLabFormSheetBody>

                <DesignLabFormSheetFooter>
                  <DesignLabGhostAction
                    type="button"
                    onClick={() => {
                      setNewContactOpen(false);
                      resetNewContactForm();
                    }}
                  >
                    Avbryt
                  </DesignLabGhostAction>
                  <DesignLabPrimaryAction
                    type="submit"
                    disabled={!contactForm.first_name.trim() || !contactForm.last_name.trim()}
                  >
                    Opprett kontakt
                  </DesignLabPrimaryAction>
                </DesignLabFormSheetFooter>
              </form>
            </DesignLabFormSheet>
            )}
          </>
        )}
      </div>

      {sanitizedContacts.length === 0 ? (
        <p className="py-2 text-[11px] text-[#8C929C]">Ingen kontakter</p>
      ) : (
        <div className="space-y-0.5">
          {sanitizedContacts.map((c) => {
            const isActive = activeContactId === c.id;
            const secondaryText = [c.title, c.ownerName].filter(Boolean).join(" · ");

            return (
              <button
                key={c.id}
                type="button"
                className={cn(
                  "w-full rounded-[6px] px-2 py-1.5 text-left transition-colors duration-100",
                  isActive ? "bg-[#F0F2F6]" : "hover:bg-[#F8F9FB]",
                )}
                onClick={() => {
                  setActiveContactId(c.id);
                  if (onOpenContact) {
                    onOpenContact(c.id);
                    return;
                  }
                  navigate(getContactPath(c.id));
                }}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate" style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                        {c.displayName}
                      </p>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {c.cv_email && <DesignLabStaticTag>CV</DesignLabStaticTag>}
                        {c.call_list && <DesignLabStaticTag>Innkjøper</DesignLabStaticTag>}
                      </div>
                    </div>
                    {secondaryText ? (
                      <p className="mt-[2px] truncate text-[11px] font-normal text-[#8C929C]">{secondaryText}</p>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {/* ── ZONE A: Header ── */}
      <div className="mb-5" style={headerPaddingTop ? { paddingTop: headerPaddingTop } : undefined}>
        <div className="flex items-center gap-3">
          {editable ? (
            <h2 className="text-[1.5rem] font-bold truncate flex-1 min-w-0">
              <InlineEdit value={companyName} onSave={updateField("name")} className="text-[1.5rem] font-bold" />
            </h2>
          ) : (
            <h2 className="text-[1.5rem] font-bold truncate flex-1 min-w-0">{companyName}</h2>
          )}
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {/* Signal badge */}
            {editable ? (
              <button
                onClick={() => {
                  const defaultContact = activities.find((a) => a.contact_id)?.contact_id || sanitizedContacts[0]?.id || "";
                  setSignalContactId(defaultContact);
                  setSignalPickerOpen(true);
                }}
                className={cn(
                  effectiveSignal
                    ? "inline-flex items-center rounded-[6px] border px-2.5 py-0.5 text-[0.75rem] font-medium h-7 cursor-pointer"
                    : "inline-flex items-center rounded-[6px] border border-dashed border-border px-2.5 py-0.5 text-[0.75rem] text-muted-foreground/50 h-7 cursor-pointer hover:text-muted-foreground hover:border-muted-foreground/40 transition-colors",
                )}
                style={effectiveSignal ? signalBadgeStyle : undefined}
              >
                {effectiveSignal || "Sett signal"}
              </button>
            ) : effectiveSignal ? (
              <span
                className="inline-flex items-center rounded-[6px] border px-2.5 py-0.5 text-[0.75rem] font-medium h-7"
                style={signalBadgeStyle}
              >
                {effectiveSignal}
              </span>
            ) : null}
            {/* Type badge */}
            {editable ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="inline-flex items-center rounded-[6px] border px-2.5 py-0.5 text-[0.75rem] font-medium whitespace-nowrap cursor-pointer h-7"
                    style={{
                      background: C.statusNeutralBg,
                      color: C.statusNeutral,
                      border: `1px solid ${C.statusNeutralBorder}`,
                    }}
                  >
                    {currentStatus.label}
                    <ChevronDown className="h-3 w-3 ml-1 flex-shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {STATUS_OPTIONS.map((s) => (
                    <DropdownMenuItem key={s.value} onClick={() => updateMutation.mutate({ status: s.value })}>
                      {s.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span
                className="inline-flex items-center rounded-[6px] border px-2.5 py-0.5 text-[0.75rem] font-medium h-7"
                style={{
                  background: C.statusNeutralBg,
                  color: C.statusNeutral,
                  border: `1px solid ${C.statusNeutralBorder}`,
                }}
              >
                {currentStatus.label}
              </span>
            )}
            {/* Owner badge */}
            {editable ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="inline-flex items-center rounded-[6px] border px-2.5 py-0.5 text-[0.75rem] font-medium whitespace-nowrap cursor-pointer h-7"
                    style={{
                      background: C.statusNeutralBg,
                      color: C.statusNeutral,
                      border: `1px solid ${C.statusNeutralBorder}`,
                    }}
                  >
                    {company.owner_id && profileMapFull[company.owner_id] ? profileMapFull[company.owner_id] : "Eier"}
                    <ChevronDown className="h-3 w-3 ml-1 flex-shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {allProfiles.map((p) => (
                    <DropdownMenuItem key={p.id} onClick={() => updateMutation.mutate({ owner_id: p.id })}>
                      <span
                        className="inline-flex items-center rounded-[6px] border px-2.5 py-0.5 text-[0.75rem] font-medium h-7"
                        style={{
                          background: C.statusNeutralBg,
                          color: C.statusNeutral,
                          border: `1px solid ${C.statusNeutralBorder}`,
                        }}
                      >
                        {safeText(p.full_name) || "Uten navn"}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : ownerFullName ? (
              <span
                className="inline-flex items-center rounded-[6px] border px-2.5 py-0.5 text-[0.75rem] font-medium h-7"
                style={{
                  background: C.statusNeutralBg,
                  color: C.statusNeutral,
                  border: `1px solid ${C.statusNeutralBorder}`,
                }}
              >
                {ownerFullName}
              </span>
            ) : null}
            {/* Signal picker dialog */}
            <Dialog open={signalPickerOpen} onOpenChange={setSignalPickerOpen}>
              <DialogContent className="sm:max-w-[360px] rounded-xl">
                <DialogHeader>
                  <DialogTitle>Sett signal</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div className="space-y-1.5">
                    <Label className="text-label">Signal</Label>
                    <div className="flex flex-wrap gap-2">
                      {SIGNAL_CATEGORIES.map((c) => (
                        <button
                          key={c.label}
                          type="button"
                          onClick={() => setPendingSignal(c.label)}
                          className={cn(
                            "inline-flex items-center rounded-[6px] border px-2.5 py-0.5 text-[0.75rem] font-medium cursor-pointer transition-colors h-7",
                            pendingSignal === c.label
                              ? "bg-[#E8ECF5] text-[#1A1C1F] border-[#C5CBE8] font-semibold"
                              : "border-border text-muted-foreground hover:bg-secondary",
                          )}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-label">Gjelder kontakt</Label>
                    <select
                      value={signalContactId}
                      onChange={(e) => setSignalContactId(e.target.value)}
                      className="w-full h-10 rounded-lg border border-input bg-background px-3 text-[0.8125rem]"
                    >
                      {sanitizedContacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    className="w-full h-10 rounded-lg"
                    disabled={!pendingSignal || !signalContactId}
                    onClick={() => {
                      if (pendingSignal && signalContactId) {
                        changeSignalMutation.mutate({ signal: pendingSignal, contactId: signalContactId });
                        setSignalPickerOpen(false);
                        setPendingSignal(null);
                      }
                    }}
                  >
                    Lagre signal
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            {/* Edit company dialog */}
            <DesignLabEntitySheet
              open={editCompanyOpen && !mergeCompanyDialogOpen}
              onOpenChange={(nextOpen) => {
                if (mergeCompanyDialogOpen && nextOpen) return;
                setEditCompanyOpen(nextOpen);
              }}
              contentClassName="px-6 py-6"
            >
              <div className="mb-5">
                <h2 className="text-[1.125rem] font-bold text-foreground">Rediger selskap</h2>
              </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const finalLocations = newLocation.trim()
                      ? [...editForm.locations, newLocation.trim()]
                      : editForm.locations;
                    setNewLocation("");
                    const cityValue = finalLocations.length > 0 ? finalLocations.join(", ") : editForm.city;
                    updateMutation.mutate({
                      name: editForm.name,
                      org_number: editForm.org_number || null,
                      city: cityValue || null,
                      website: editForm.website || null,
                      linkedin: editForm.linkedin || null,
                    });
                    setEditCompanyOpen(false);
                  }}
                  className="mt-3 w-full max-w-full min-w-0 space-y-4 overflow-x-hidden"
                >
                  <div className="max-w-full min-w-0 space-y-1.5">
                    <Label className="text-label">Selskapsnavn</Label>
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      required
                      className="h-10 max-w-full rounded-lg"
                    />
                  </div>
                  <div className="max-w-full min-w-0 space-y-1.5">
                    <Label className="text-label">Org.nr</Label>
                    <Input
                      value={editForm.org_number}
                      onChange={(e) => setEditForm({ ...editForm, org_number: e.target.value })}
                      className="h-10 max-w-full rounded-lg"
                    />
                  </div>
                  <div className="max-w-full min-w-0 space-y-1.5">
                    <Label className="text-label">Geografisk sted</Label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {editForm.locations.map((loc, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium text-foreground"
                        >
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {loc}
                          <button
                            type="button"
                            onClick={() =>
                              setEditForm({ ...editForm, locations: editForm.locations.filter((_, idx) => idx !== i) })
                            }
                            className="ml-0.5 text-muted-foreground hover:text-destructive"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex min-w-0 gap-2">
                      <Input
                        value={newLocation}
                        onChange={(e) => setNewLocation(e.target.value)}
                        placeholder="Legg til sted..."
                        className="h-9 min-w-0 max-w-full flex-1 rounded-lg"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newLocation.trim()) {
                            e.preventDefault();
                            setEditForm({ ...editForm, locations: [...editForm.locations, newLocation.trim()] });
                            setNewLocation("");
                          }
                        }}
                      />

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-lg"
                        onClick={() => {
                          if (newLocation.trim()) {
                            setEditForm({ ...editForm, locations: [...editForm.locations, newLocation.trim()] });
                            setNewLocation("");
                          }
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="max-w-full min-w-0 space-y-1.5">
                    <Label className="text-label">Nettside</Label>
                    <Input
                      value={editForm.website}
                      onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                      placeholder="https://..."
                      className="h-10 max-w-full rounded-lg"
                    />
                  </div>
                  <div className="max-w-full min-w-0 space-y-1.5">
                    <Label className="text-label">LinkedIn</Label>
                    <Input
                      value={editForm.linkedin}
                      onChange={(e) => setEditForm({ ...editForm, linkedin: e.target.value })}
                      placeholder="https://linkedin.com/company/..."
                      className="h-10 max-w-full rounded-lg"
                    />
                  </div>
                  <div className="mt-2 border-t border-border/80 pt-4">
                    <div className="flex flex-wrap items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 rounded-lg px-2.5 text-muted-foreground hover:text-foreground"
                        onClick={() => setMergeCompanyDialogOpen(true)}
                      >
                        <ArrowRightLeft className="h-4 w-4 mr-1" />
                        Slå sammen selskap
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 rounded-lg px-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteCompanyDialogOpen(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Slett selskap
                      </Button>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 min-w-[110px] rounded-lg"
                        onClick={() => setEditCompanyOpen(false)}
                      >
                        Avbryt
                      </Button>
                      <Button type="submit" className="h-10 min-w-[110px] rounded-lg">
                        Lagre
                      </Button>
                    </div>
                  </div>
                </form>
            </DesignLabEntitySheet>
            <AlertDialog open={deleteCompanyDialogOpen} onOpenChange={setDeleteCompanyDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Slett {company?.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Er du sikker på at du vil slette dette selskapet? Alle tilknyttede data vil forbli intakt, men selskapet fjernes permanent. Dette kan ikke angres.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Avbryt</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteCompanyMutation.mutate()}>
                    Slett selskap
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <MergeCompanyDialog
              open={mergeCompanyDialogOpen}
              onOpenChange={setMergeCompanyDialogOpen}
              sourceCompanyId={companyId}
              sourceCompanyName={companyName}
              onMerged={(targetCompanyId) => {
                setEditCompanyOpen(false);
                setMergeCompanyDialogOpen(false);
                queryClient.invalidateQueries();
                navigate(getCompanyPath(targetCompanyId));
              }}
            />
            {editable && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <DesignLabIconButton>
                    <MoreVertical className="h-4 w-4" />
                  </DesignLabIconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={4}>
                  <DropdownMenuItem onClick={openEditCompanyDialog}>
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Rediger selskap
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setShowTechDna(true);
                      void handleFinnKonsulenter();
                    }}
                  >
                    <Target className="h-3.5 w-3.5 mr-2" /> Finn konsulent
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      if (showNotes) {
                        setShowNotes(false);
                        setEditingNotes(false);
                        return;
                      }
                      setShowNotes(true);
                      if (!companyNotes) {
                        setNotesDraft("");
                        setTimeout(() => setEditingNotes(true), 50);
                      }
                    }}
                  >
                    <StickyNote className="h-3.5 w-3.5 mr-2" />
                    {showNotes ? "Skjul notat" : companyNotes ? "Vis notat" : "Legg til notat"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowTechDna((prev) => !prev)}>
                    {showTechDna ? <EyeOff className="h-3.5 w-3.5 mr-2" /> : <Eye className="h-3.5 w-3.5 mr-2" />}
                    {showTechDna ? "Skjul teknisk DNA" : "Vis teknisk DNA"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {!editable && onNavigateToFullPage && (
              <DesignLabIconButton onClick={onNavigateToFullPage}>
                <ExternalLink className="h-3.5 w-3.5" />
              </DesignLabIconButton>
            )}
          </div>
        </div>

        {/* Org.nr · city · phone · links */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap mt-0.5">
          {companyOrgNumber && <span>Org.nr {companyOrgNumber}</span>}
          {companyLocations.map((loc, i) => (
            <a
              key={i}
              href={`https://maps.google.com/?q=${encodeURIComponent(loc)},Norge`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <MapPin className="h-3.5 w-3.5" />
              {loc}
            </a>
          ))}
          {companyWebsite && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <a
                href={companyWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Globe className="h-3 w-3" />
                {companyWebsite.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
              </a>
            </>
          )}
          {companyLinkedin && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <a
                href={companyLinkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Linkedin className="h-3 w-3" />
                LinkedIn
              </a>
            </>
          )}
          {companyEmail && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <a
                href={`mailto:${companyEmail}`}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Mail className="h-3 w-3" />
                {companyEmail}
              </a>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-border/50 mb-5" />

      {/* Notat */}
      {showNotes && (
        <div className="mb-5">
          {editable && editingNotes ? (
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
                    setShowNotes(Boolean(notesDraft.trim()));
                    setEditingNotes(false);
                  }
                }}
              />

              <div className="flex gap-2 mt-1.5">
                <DesignLabActionButton
                  variant="primary"
                  style={{ height: 32, fontSize: 12 }}
                  onClick={() => {
                    updateField("notes")(notesDraft);
                    setShowNotes(Boolean(notesDraft.trim()));
                    setEditingNotes(false);
                  }}
                >
                  Lagre
                </DesignLabActionButton>
                <DesignLabActionButton
                  variant="ghost"
                  style={{ height: 32, fontSize: 12 }}
                  onClick={() => setEditingNotes(false)}
                >
                  Avbryt
                </DesignLabActionButton>
              </div>
            </div>
          ) : companyNotes ? (
            editable ? (
              <CompanyNotesEditTrigger
                onEdit={() => {
                  setNotesDraft(companyNotes);
                  setEditingNotes(true);
                }}
              >
                <p className="text-[0.8125rem] text-muted-foreground leading-relaxed whitespace-pre-wrap transition-colors group-hover:text-foreground/80">
                  {companyNotes}
                </p>
              </CompanyNotesEditTrigger>
            ) : (
              <div className="group relative">
                <p className="text-[0.8125rem] text-muted-foreground leading-relaxed whitespace-pre-wrap">{companyNotes}</p>
              </div>
            )
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

      {/* ── Snapshot-rad ── */}
      {(() => {
        const sisteAkt = activities[0] ?? null;
        const nesteOppf = tasks.filter((t) => t.due_date)[0] ?? null;
        if (!sisteAkt && !nesteOppf) return null;
        return;
      })()}

      <div className="md:hidden">
        <div className="space-y-5">{companyDetailSections}</div>
        <div className="mt-4">{relatedContactsContent}</div>
      </div>

      <div className="hidden md:block">
        <ResizablePanelGroup direction="horizontal" className="min-h-[520px] w-full">
          <ResizablePanel defaultSize={76} minSize={52}>
            <div className="pr-5">{companyDetailSections}</div>
          </ResizablePanel>
          <ResizableHandle className={cn(
            "group after:hidden hover:!bg-[#DDE0E7] data-[resize-handle-active]:!bg-[#5E6AD2] transition-colors focus-visible:!ring-0 focus-visible:!ring-offset-0",
            showContactsDivider ? "!w-px !bg-[#E8EAEE]" : "!w-1 !bg-transparent",
          )}>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 grid-cols-2 gap-[2px] opacity-0 transition-opacity group-hover:opacity-100"
            >
              {Array.from({ length: 6 }).map((_, index) => (
                <span key={index} className="h-[2px] w-[2px] rounded-full bg-[#8C929C]" />
              ))}
            </div>
          </ResizableHandle>
          <ResizablePanel defaultSize={24} minSize={18} maxSize={38}>
            <div className="pl-4">{relatedContactsContent}</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

/* ── Company Activity Timeline ── */
function CompanyActivityTimeline({
  activities,
  profileMap,
  companyId,
  editable,
}: {
  activities: any[];
  profileMap: Record<string, string>;
  companyId: string;
  editable: boolean;
}) {
  const navigate = useNavigate();
  const currentYear = getYear(new Date());

  const grouped = useMemo(() => {
    const groups: { key: string; label: string; period: string; items: any[] }[] = [];
    let currentKey = "";
    for (const act of activities) {
      const d = parseValidDate(act.created_at);
      if (!d) continue;
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
        <div className="flex items-center" style={{ minHeight: 32 }}>
          <h3 className="text-[13px] font-medium text-[#1A1C1F]">
            Aktiviteter <span className="font-normal text-[#8C929C]">· 0</span>
          </h3>
        </div>
        <p className="text-[0.8125rem] text-muted-foreground/60 py-2">Ingen aktiviteter</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center mb-3" style={{ minHeight: 32 }}>
        <h3 className="text-[13px] font-medium text-[#1A1C1F]">
          Aktiviteter <span className="font-normal text-[#8C929C]">· {activities.length}</span>
        </h3>
      </div>

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
                  editable={editable}
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
function CompanyActivityRow({
  activity,
  profileMap,
  companyId,
  editable,
  navigate,
}: {
  activity: any;
  profileMap: Record<string, string>;
  companyId: string;
  editable: boolean;
  navigate: (path: string) => void;
}) {
  const queryClient = useQueryClient();
  const { getContactPath } = useCrmNavigation();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDate, setEditDate] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const {
    title: displayTitle,
    category: displayCategory,
    cleanDesc,
  } = extractTitleAndCategory(activity.subject, activity.description);
  const ownerName = activity.created_by ? profileMap[activity.created_by] : null;
  const createdDate = parseValidDate(activity.created_at);
  const contactFirstName = safeText((activity.contacts as any)?.first_name);
  const contactLastName = safeText((activity.contacts as any)?.last_name);
  const contactName = [contactFirstName, contactLastName].filter(Boolean).join(" ").trim() || null;

  const typeIcon =
    activity.type === "call" || activity.type === "phone" ? (
      <MessageCircle className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
    ) : (
      <FileText className="h-3.5 w-3.5 text-primary" />
    );

  const handleRowClick = () => {
    if (!editable || editing) return;
    const parsed = extractTitleAndCategory(activity.subject, activity.description);
    let cat = parsed.category;
    const activitySubject = safeText(activity.subject);
    if (!cat && CATEGORIES.some((c) => c.label === activitySubject)) {
      cat = activitySubject;
    }
    setEditTitle(parsed.title);
    setEditCategory(cat);
    setEditDesc(parsed.cleanDesc);
    setEditDate(createdDate ? format(createdDate, "yyyy-MM-dd") : "");
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
    await supabase.from("activities").update(updates as any).eq("id", activity.id);
    queryClient.invalidateQueries({ queryKey: crmQueryKeys.companies.activities(companyId) });
    queryClient.invalidateQueries({ queryKey: crmQueryKeys.companies.contactActivities(companyId) });
    setEditing(false);
    toast.success("Aktivitet oppdatert");
  };

  const handleDelete = async () => {
    await supabase.from("activities").delete().eq("id", activity.id);
    queryClient.invalidateQueries({ queryKey: crmQueryKeys.companies.activities(companyId) });
    queryClient.invalidateQueries({ queryKey: crmQueryKeys.companies.contactActivities(companyId) });
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

            <div className="flex items-center gap-2">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Dato:
              </span>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                style={{
                  height: 28,
                  paddingInline: 8,
                  fontSize: 12,
                  borderRadius: 6,
                  border: `1px solid ${C.borderDefault}`,
                  color: C.textSecondary,
                  background: C.surface,
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <DesignLabActionButton
                variant="primary"
                style={{ height: 32, fontSize: 12 }}
                disabled={!editTitle.trim() || !editCategory}
                onClick={handleSave}
              >
                Lagre
              </DesignLabActionButton>
              <DesignLabActionButton
                variant="ghost"
                style={{ height: 32, fontSize: 12 }}
                onClick={() => setEditing(false)}
              >
                Avbryt
              </DesignLabActionButton>
              <div className="ml-auto">
                {confirmDelete ? (
                  <div className="flex items-center gap-2 text-[0.75rem] animate-in fade-in duration-150">
                    <span className="text-destructive">Er du sikker?</span>
                    <DesignLabActionButton
                      variant="secondary"
                      onClick={() => {
                        handleDelete();
                        setConfirmDelete(false);
                      }}
                      style={{ height: 32, fontSize: 12, color: C.danger }}
                    >
                      Ja, slett
                    </DesignLabActionButton>
                    <DesignLabActionButton
                      variant="ghost"
                      style={{ height: 32, fontSize: 12 }}
                      onClick={() => setConfirmDelete(false)}
                    >
                      Avbryt
                    </DesignLabActionButton>
                  </div>
                ) : (
                  <DesignLabIconButton
                    size={32}
                    onClick={() => setConfirmDelete(true)}
                    style={{ color: C.textSecondary }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </DesignLabIconButton>
                )}
              </div>
            </div>
          </div>
        ) : (
          <CompanyActivityRowBody onActivate={handleRowClick} editable={editable}>
            <div className="flex-1 min-w-0">
              <span className="text-[1.0625rem] font-bold text-foreground">{displayTitle}</span>

              {contactName && (
                <a
                  href={activity.contact_id ? getContactPath(activity.contact_id) : undefined}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[0.8125rem] font-semibold text-blue-600 hover:underline block mt-0.5"
                >
                  → {contactName}
                </a>
              )}

              {cleanDesc && (
                <div className="mt-0.5">
                  <p className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-foreground/70">{cleanDesc}</p>
                </div>
              )}

              <div className="flex items-center gap-2 mt-1">
                {ownerName && (
                  <span
                    className="inline-flex items-center rounded-[6px] border px-2.5 py-0.5 text-[0.75rem] font-medium h-7"
                    style={{
                      background: C.statusNeutralBg,
                      color: C.statusNeutral,
                      border: `1px solid ${C.statusNeutralBorder}`,
                    }}
                  >
                    {ownerName}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 flex-shrink-0 mt-0.5">
              {createdDate ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-[0.8125rem] text-muted-foreground">
                      {format(createdDate, "d. MMM yyyy", { locale: nb })}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{fullDate(createdDate.toISOString())}</TooltipContent>
                </Tooltip>
              ) : (
                <span className="text-[0.8125rem] text-muted-foreground/60">Ukjent dato</span>
              )}
              {displayCategory && <CategoryBadge label={displayCategory} />}
            </div>
          </CompanyActivityRowBody>
        )}
      </div>
    </div>
  );
}

/* ── Company DNA Panel ── */
function CompanyDnaPanel({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();

  const { data: dnaProfile } = useQuery({
    queryKey: crmQueryKeys.companies.techProfile(companyId),
    queryFn: async () => {
      const { data } = await supabase.from("company_tech_profile").select("*").eq("company_id", companyId).single();
      return data || null;
    },
    enabled: !!companyId,
  });

  // Hent teknologier fra forespørsler for dette selskapet
  const { data: foresporslerTags = [] } = useQuery({
    queryKey: ["company-foresporsler-tags", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("foresporsler").select("teknologier").eq("selskap_id", companyId);
      if (!data) return [];
      const all: string[] = [];
      data.forEach((f) => {
        if (f.teknologier) all.push(...f.teknologier);
      });
      // Tell frekvens
      const freq: Record<string, number> = {};
      all.forEach((t) => {
        freq[t] = (freq[t] || 0) + 1;
      });
      return Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .map(([tag, count]) => ({ tag, count }));
    },
    enabled: !!companyId,
  });

  // Hent teknologier fra kontakter på dette selskapet
  const { data: contactTags = [] } = useQuery({
    queryKey: ["company-contact-tags", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("teknologier").eq("company_id", companyId);
      if (!data) return [];
      const all: string[] = [];
      data.forEach((c) => {
        if ((c as any).teknologier) all.push(...(c as any).teknologier);
      });
      return [...new Set(all)];
    },
    enabled: !!companyId,
  });

  const hasDna =
    foresporslerTags.length > 0 ||
    contactTags.length > 0 ||
    (dnaProfile?.teknologier && Object.keys(dnaProfile.teknologier).length > 0);

  if (!hasDna) {
    return (
      <p className="text-[0.8125rem] text-muted-foreground/60 italic">
        Ingen teknisk profil ennå — legges til automatisk fra forespørsler og kontakter.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Fra forespørsler */}
      {foresporslerTags.length > 0 && (
        <div>
          <p className="text-[0.6875rem] font-medium text-muted-foreground mb-1.5">Fra forespørsler</p>
          <div className="flex flex-wrap gap-1.5">
            {foresporslerTags.map(({ tag, count }) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[0.75rem] font-medium text-foreground"
              >
                {tag}
                {count > 1 && <span className="text-[0.625rem] text-muted-foreground font-normal">×{count}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Fra kontakter */}
      {contactTags.length > 0 && (
        <div>
          <p className="text-[0.6875rem] font-medium text-muted-foreground mb-1.5">Fra kontakter</p>
          <div className="flex flex-wrap gap-1.5">
            {contactTags.map((tag: string) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[0.75rem] font-medium text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
