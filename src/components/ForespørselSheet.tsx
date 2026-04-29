import { Suspense, lazy, useState, useEffect, useRef, useMemo } from "react";
import { X, Pencil, Trash2, Loader2, ChevronDown, Plus, Target, Phone, Mail, MapPin, ArrowRight, Bell, CalendarDays, Clock3, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { relativeDate, fullDate } from "@/lib/relativeDate";
import { relativeTime } from "@/lib/relativeDate";
import { toast } from "@/components/ui/sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConsultantCache } from "@/hooks/useConsultantCache";
import { getInitials, cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { format, parseISO } from "date-fns";
import { nb } from "date-fns/locale";
import { getEffectiveSignal } from "@/lib/categoryUtils";
import {
  filterConsultantMatches,
  formatConsultantMatchFreshness,
  getConsultantMatchScoreColor,
  sortConsultantMatches,
} from "@/lib/consultantMatches";
import { mergeTechnologyTags } from "@/lib/technologyTags";
import { createOppdragFormState } from "@/lib/oppdragForm";
import { useCrmNavigation } from "@/lib/crmNavigation";
import { createOppdrag, invalidateOppdragQueries } from "@/lib/oppdragPersistence";
import { crmQueryKeys } from "@/lib/queryKeys";
import { DesignLabReadonlyChip } from "@/components/designlab/system";
import { DesignLabActionButton } from "@/components/designlab/controls";
import { useAuth } from "@/hooks/useAuth";

const ExternalConsultantModal = lazy(async () => {
  const module = await import("@/pages/EksterneKonsulenter");
  return { default: module.ConsultantModal };
});

const LABEL = "text-[13px] font-medium text-foreground";

const PIPELINE_CONFIG: Record<string, { label: string; dot: string; badge: string; step: number | null }> = {
  sendt_cv:  { label: "Sendt CV", dot: "bg-amber-400", badge: "bg-[#FBF3E6] text-[#7D4E00] border-[#E8D0A0]", step: 1 },
  intervju:  { label: "Intervju", dot: "bg-blue-500", badge: "bg-[#EAF0F9] text-[#1A4FA0] border-[#B3C8E8]", step: 2 },
  vunnet:    { label: "Vunnet 🎉", dot: "bg-green-500", badge: "bg-[#EBF3EE] text-[#2D6A4F] border-[#C0DEC8]", step: 3 },
  avslag:    { label: "Avslag", dot: "bg-red-400", badge: "bg-[#FAEBEC] text-[#8B1D20] border-[#E8B8BA]", step: null },
  bortfalt:  { label: "Bortfalt", dot: "bg-gray-400", badge: "bg-[#F0F2F6] text-[#3A3F4A] border-[#C8CDD6]", step: null },
};

const PIPELINE_BORDER_MAP: Record<string, string> = {
  sendt_cv: "border-l-amber-400",
  intervju: "border-l-blue-500",
  vunnet: "border-l-green-500",
  avslag: "border-l-red-400",
  bortfalt: "border-l-gray-400",
};

interface MatchResult {
  id: number | string;
  navn: string;
  type: "intern" | "ekstern";
  score: number;
  begrunnelse: string;
  match_tags: string[];
}

interface LaterReviewEntry {
  id: string;
  ansatt_id: number | null;
  consultant_name: string;
  created_at: string;
  date_notification_task_id: string | null;
  ekstern_id: string | null;
  external_type: string | null;
  foresporsler_id: number;
  konsulent_type: "intern" | "ekstern";
  notify_email_date: string | null;
  notify_on_pipeline_exit: boolean;
  notify_user_id: string;
  pipeline_notification_task_id: string | null;
  pipeline_notified_at: string | null;
  updated_at: string;
}

interface LaterReviewNotificationOptions {
  notifyOnPipelineExit: boolean;
  notifyEmailDate: string | null;
}

interface LaterReviewTaskMeta {
  consultantId: string;
  consultantName: string;
  consultantType: "intern" | "ekstern";
  dateNotificationTaskId: string | null;
  externalType: string | null;
  foresporselId: number;
  notifyEmailDate: string | null;
  notifyOnPipelineExit: boolean;
  notifyUserId: string;
  pipelineNotificationTaskId: string | null;
  pipelineNotifiedAt: string | null;
}

const LATER_REVIEW_HOLDER_TITLE_PREFIX = "LR-HOLD:";
const LATER_REVIEW_META_MARKER = "[crm-later-review]";
const LATER_REVIEW_REMINDER_MARKER = "[crm-later-review-reminder]";

function isPipelineExitStatus(status: string | null | undefined): boolean {
  return status === "avslag" || status === "bortfalt";
}

function formatNotificationDate(dateValue: string | null): string | null {
  if (!dateValue) return null;

  try {
    return format(parseISO(`${dateValue}T00:00:00`), "d. MMM yyyy", { locale: nb });
  } catch {
    return dateValue;
  }
}

function getLaterReviewName(entry: LaterReviewEntry): string {
  return entry.consultant_name || "Ukjent";
}

type ExternalConsultantCompanyMeta = {
  companies?: { name?: string | null } | null;
  selskap_tekst?: string | null;
  type?: string | null;
};

function isPartnerExternalConsultantType(type: string | null | undefined): boolean {
  return type === "partner" || type === "konsulenthus" || type === "via_partner";
}

function getExternalConsultantTypeLabel(type: string | null | undefined): string {
  if (isPartnerExternalConsultantType(type)) return "Partner";
  return "Freelance";
}

function getExternalConsultantPartnerCompanyName(
  consultant: ExternalConsultantCompanyMeta | null | undefined,
): string | null {
  if (!consultant || !isPartnerExternalConsultantType(consultant.type)) return null;
  const companyName = consultant.companies?.name?.trim() || consultant.selskap_tekst?.trim();
  return companyName || null;
}

function formatReceivedDateLabel(dateValue: string | null | undefined): string {
  if (!dateValue) return "—";

  try {
    return `${relativeDate(dateValue)} (${format(parseISO(dateValue), "dd.MM.yyyy")})`;
  } catch {
    return relativeDate(dateValue);
  }
}

function ExternalConsultantOriginBadge({
  type,
  partnerCompanyName,
}: {
  type: string | null | undefined;
  partnerCompanyName?: string | null;
}) {
  if (!type && !partnerCompanyName) return null;

  if (isPartnerExternalConsultantType(type) || partnerCompanyName) {
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[0.6875rem] font-semibold text-amber-700">
          Partner
        </span>
        {partnerCompanyName ? (
          <span className="truncate text-[0.75rem] text-muted-foreground">{partnerCompanyName}</span>
        ) : null}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-100 px-2 py-0.5 text-[0.6875rem] font-semibold text-blue-700">
      {getExternalConsultantTypeLabel(type)}
    </span>
  );
}

function buildLaterReviewHolderTitle(
  foresporselId: number,
  consultantType: "intern" | "ekstern",
  consultantId: string,
) {
  return `${LATER_REVIEW_HOLDER_TITLE_PREFIX}${foresporselId}:${consultantType}:${consultantId}`;
}

function serializeLaterReviewMeta(meta: LaterReviewTaskMeta): string {
  return `${LATER_REVIEW_META_MARKER}\n${JSON.stringify(meta)}`;
}

function parseLaterReviewMeta(description: string | null | undefined): LaterReviewTaskMeta | null {
  if (!description) return null;
  const [marker, ...jsonLines] = description.split("\n");
  if (marker !== LATER_REVIEW_META_MARKER) return null;

  try {
    const parsed = JSON.parse(jsonLines.join("\n")) as LaterReviewTaskMeta;
    if (
      !parsed ||
      !parsed.foresporselId ||
      !parsed.consultantId ||
      !parsed.consultantName ||
      !parsed.consultantType ||
      !parsed.notifyUserId
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function mapLaterReviewTaskToEntry(task: {
  id: string;
  created_at: string;
  description: string | null;
  updated_at: string;
}): LaterReviewEntry | null {
  const meta = parseLaterReviewMeta(task.description);
  if (!meta) return null;

  const parsedAnsattId = meta.consultantType === "intern" ? Number(meta.consultantId) : null;

  return {
    id: task.id,
    ansatt_id: meta.consultantType === "intern" && Number.isFinite(parsedAnsattId) ? parsedAnsattId : null,
    consultant_name: meta.consultantName,
    created_at: task.created_at,
    date_notification_task_id: meta.dateNotificationTaskId,
    ekstern_id: meta.consultantType === "ekstern" ? meta.consultantId : null,
    external_type: meta.externalType,
    foresporsler_id: meta.foresporselId,
    konsulent_type: meta.consultantType,
    notify_email_date: meta.notifyEmailDate,
    notify_on_pipeline_exit: meta.notifyOnPipelineExit,
    notify_user_id: meta.notifyUserId,
    pipeline_notification_task_id: meta.pipelineNotificationTaskId,
    pipeline_notified_at: meta.pipelineNotifiedAt,
    updated_at: task.updated_at,
  };
}

function entryToLaterReviewMeta(entry: LaterReviewEntry): LaterReviewTaskMeta {
  return {
    consultantId: entry.konsulent_type === "intern" ? String(entry.ansatt_id ?? "") : String(entry.ekstern_id ?? ""),
    consultantName: entry.consultant_name,
    consultantType: entry.konsulent_type,
    dateNotificationTaskId: entry.date_notification_task_id,
    externalType: entry.external_type,
    foresporselId: entry.foresporsler_id,
    notifyEmailDate: entry.notify_email_date,
    notifyOnPipelineExit: entry.notify_on_pipeline_exit,
    notifyUserId: entry.notify_user_id,
    pipelineNotificationTaskId: entry.pipeline_notification_task_id,
    pipelineNotifiedAt: entry.pipeline_notified_at,
  };
}

function buildLaterReviewReminderDescription(
  body: string,
  holderTaskId: string,
  reminderType: "date" | "pipeline",
): string {
  return `${body}\n\n${LATER_REVIEW_REMINDER_MARKER}\n${JSON.stringify({ holderTaskId, reminderType })}`;
}

/* ─── Delete button with inline confirmation ─── */

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming)
    return (
      <button
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground hover:text-destructive transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Slett forespørsel
      </button>
    );

  return (
    <div className="flex items-center gap-3">
      <span className="text-[0.8125rem] text-foreground font-medium">Er du sikker?</span>
      <button
        onClick={onConfirm}
        className="text-[0.8125rem] text-destructive font-medium hover:underline"
      >
        Ja, slett
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="text-[0.8125rem] text-muted-foreground hover:text-foreground"
      >
        Avbryt
      </button>
    </div>
  );
}

/* ─── Missing Contact Banner ─── */

function MissingContactBanner({ row }: { row: any }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = (q: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim() || !row.selskap_id) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, title")
        .eq("company_id", row.selskap_id)
        .neq("status", "deleted")
        .ilike("first_name", `%${q}%`)
        .limit(8);
      setResults(data || []);
    }, 250);
  };

  const selectContact = async (c: any) => {
    await supabase.from("foresporsler").update({
      kontakt_id: c.id,
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
    queryClient.invalidateQueries({ queryKey: crmQueryKeys.foresporsler.list() });
    toast.success(`Kontakt ${c.first_name} ${c.last_name} koblet til`);
    setSearch("");
    setShowDropdown(false);
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-2">
      <p className="text-[0.8125rem] text-amber-800">
        ⚠️ Denne forespørselen mangler kontakt — legg til en kontakt for å holde CRM oppdatert
      </p>
      {row.selskap_id && (
        <div className="relative">
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); doSearch(e.target.value); }}
            onFocus={() => { setShowDropdown(true); if (search) doSearch(search); }}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            placeholder="Søk etter kontakt..."
            className="text-[0.8125rem] h-8 bg-white"
          />
          {showDropdown && results.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-md max-h-[160px] overflow-y-auto">
              {results.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => selectContact(c)}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
                >
                  <p className="text-[0.8125rem] font-medium">{c.first_name} {c.last_name}</p>
                  {c.title && <p className="text-[0.6875rem] text-muted-foreground">{c.title}</p>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ForespørselSheet({
  row,
  onClose,
  onExpandChange,
  startInEditMode = false,
  onRequestEdit,
}: {
  row: any;
  onClose: () => void;
  onExpandChange?: (expanded: boolean) => void;
  startInEditMode?: boolean;
  onRequestEdit?: () => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getCompanyPath } = useCrmNavigation();
  const queryClient = useQueryClient();
  const { interne: cachedInterne, eksterne: cachedEksterne, isReady: consultantCacheReady } = useConsultantCache();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [mottattDato, setMottattDato] = useState("");
  const [sted, setSted] = useState("");
  const [avdeling, setAvdeling] = useState("");
  const [fristDato, setFristDato] = useState("");
  const [type, setType] = useState("");
  const [teknologier, setTeknologier] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [kommentar, setKommentar] = useState(row?.kommentar || "");
  const [sluttkunde, setSluttkunde] = useState("");
  const [status, setStatus] = useState("");
  const [editingKommentar, setEditingKommentar] = useState(false);
  const kommentarRef = useRef<HTMLTextAreaElement>(null);

  // Company/contact search state
  const [selskapNavn, setSelskapNavn] = useState("");
  const [selskapId, setSelskapId] = useState<string | null>(null);
  const [companyResults, setCompanyResults] = useState<any[]>([]);
  const [showSelskapDropdown, setShowSelskapDropdown] = useState(false);
  const [kontakt, setKontakt] = useState("");
  const [kontaktId, setKontaktId] = useState<string | null>(null);
  const [showKontaktDropdown, setShowKontaktDropdown] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Match state
  const [matching, setMatching] = useState(false);
  const [matchResults, setMatchResults] = useState<MatchResult[] | null>(null);
  const [matchSourceFilter, setMatchSourceFilter] = useState<"Alle" | "Ansatte" | "Eksterne">("Alle");
  const [matchUpdatedAt, setMatchUpdatedAt] = useState<string | null>(null);
  const [pendingMatchRequest, setPendingMatchRequest] = useState(false);

  // Opprett oppdrag modal state
  const [oppdragModalOpen, setOppdragModalOpen] = useState(false);
  const [oppdragKonsulentNavn, setOppdragKonsulentNavn] = useState("");
  const [oppdragUtpris, setOppdragUtpris] = useState("");
  const [oppdragInnpris, setOppdragInnpris] = useState("");
  const [oppdragStartDato, setOppdragStartDato] = useState("");
  const [oppdragFornyDato, setOppdragFornyDato] = useState("");
  const [oppdragKommentar, setOppdragKommentar] = useState("");
  const [oppdragSubmitting, setOppdragSubmitting] = useState(false);
  const [oppdragLopende, setOppdragLopende] = useState(false);
  const [oppdragAnsattId, setOppdragAnsattId] = useState<number | null>(null);
  const [oppdragEksternId, setOppdragEksternId] = useState<string | null>(null);
  const [oppdragErAnsatt, setOppdragErAnsatt] = useState(true);
  const [laterReviewActionId, setLaterReviewActionId] = useState<string | null>(null);

  // Portrait lookup for ansatte
  const { data: ansattePortraits = [] } = useQuery({
    queryKey: ["ansatte-portraits"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cv_documents")
        .select("ansatt_id, portrait_url")
        .not("portrait_url", "is", null);
      return data || [];
    },
  });

  const portraitByAnsattId = useMemo(() => {
    const m = new Map<number, string>();
    (ansattePortraits as any[]).forEach((c) => {
      if (c.ansatt_id && c.portrait_url) m.set(c.ansatt_id, c.portrait_url);
    });
    return m;
  }, [ansattePortraits]);

  // Linked consultants (both intern and ekstern)
  const { data: linkedKonsulenter = [] } = useQuery({
    queryKey: crmQueryKeys.foresporsler.konsulenter(row?.id),
    enabled: !!row?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("foresporsler_konsulenter")
        .select("id, ansatt_id, ekstern_id, konsulent_type, created_at, status, status_updated_at, stacq_ansatte(id, navn), external_consultants(id, navn, type)")
        .eq("foresporsler_id", row.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: laterReviewKonsulenter = [] } = useQuery({
    queryKey: crmQueryKeys.foresporsler.senereKonsulenter(row?.id),
    enabled: !!row?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, description, created_at, updated_at")
        .eq("status", "done")
        .like("title", `${LATER_REVIEW_HOLDER_TITLE_PREFIX}${row.id}:%`)
        .order("created_at", { ascending: false });
      return (data || [])
        .map((task) => mapLaterReviewTaskToEntry(task))
        .filter((entry): entry is LaterReviewEntry => Boolean(entry) && entry.foresporsler_id === row.id);
    },
  });

  const laterReviewNotifyUserIds = useMemo(
    () => Array.from(new Set(laterReviewKonsulenter.map((entry) => entry.notify_user_id).filter(Boolean))).sort(),
    [laterReviewKonsulenter],
  );

  const { data: laterReviewNotifyProfiles = [] } = useQuery({
    queryKey: ["foresporsler-later-review-notify-profiles", row?.id, laterReviewNotifyUserIds.join(",")],
    enabled: laterReviewNotifyUserIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", laterReviewNotifyUserIds);
      if (error) throw error;
      return data || [];
    },
  });

  const laterReviewNotifyUserNameById = useMemo(() => {
    const map = new Map<string, string>();
    (laterReviewNotifyProfiles as Array<{ id?: string | null; full_name?: string | null }>).forEach((profile) => {
      if (profile.id) map.set(profile.id, profile.full_name?.trim() || "Ukjent CRM-bruker");
    });
    return map;
  }, [laterReviewNotifyProfiles]);

  const externalConsultantIds = useMemo(() => {
    const ids = new Set<string>();

    linkedKonsulenter.forEach((entry: any) => {
      if (entry.konsulent_type === "ekstern" && entry.ekstern_id) {
        ids.add(entry.ekstern_id);
      }
    });

    laterReviewKonsulenter.forEach((entry) => {
      if (entry.konsulent_type === "ekstern" && entry.ekstern_id) {
        ids.add(entry.ekstern_id);
      }
    });

    return Array.from(ids).sort();
  }, [linkedKonsulenter, laterReviewKonsulenter]);

  const { data: externalConsultantMeta = [] } = useQuery({
    queryKey: ["foresporsler-external-consultant-meta", row?.id, externalConsultantIds.join(",")],
    enabled: externalConsultantIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("external_consultants")
        .select("id, type, selskap_tekst, companies(name)")
        .in("id", externalConsultantIds);
      return data || [];
    },
  });

  const externalConsultantMetaById = useMemo(() => {
    const map = new Map<string, any>();
    (externalConsultantMeta as any[]).forEach((consultant) => {
      if (consultant.id) {
        map.set(consultant.id, consultant);
      }
    });
    return map;
  }, [externalConsultantMeta]);

  // Contacts for selected company
  const { data: companyContacts = [] } = useQuery({
    queryKey: crmQueryKeys.foresporsler.editKontakter(selskapId),
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, title")
        .eq("company_id", selskapId!)
        .neq("status", "deleted")
        .order("first_name");
      return data || [];
    },
    enabled: !!selskapId,
  });

  const filteredContacts = useMemo(() => {
    if (!kontakt.trim()) return companyContacts;
    const q = kontakt.toLowerCase();
    return (companyContacts as any[]).filter(c =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q)
    );
  }, [companyContacts, kontakt]);

  const invalidateForesporselQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.foresporsler.list() }),
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.foresporsler.konsulenter(row.id) }),
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.foresporsler.senereKonsulenter(row.id) }),
    ]);
  };

  const createLaterReviewTask = async ({
    assignedTo,
    dueDate,
    emailNotify,
    title,
    description,
    reminderContext,
  }: {
    assignedTo: string;
    dueDate: string;
    emailNotify: boolean;
    title: string;
    description: string;
    reminderContext?: {
      holderTaskId: string;
      reminderType: "date" | "pipeline";
    };
  }): Promise<string> => {
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        assigned_to: assignedTo,
        company_id: row.selskap_id || null,
        contact_id: row.kontakt_id || null,
        created_by: user?.id || assignedTo,
        description: reminderContext
          ? buildLaterReviewReminderDescription(description, reminderContext.holderTaskId, reminderContext.reminderType)
          : description,
        due_date: dueDate,
        email_notify: emailNotify,
        priority: "medium",
        status: "open",
        title,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error || !data?.id) throw error || new Error("Kunne ikke opprette oppgave");
    return data.id;
  };

  const deleteLaterReviewTasks = async (entry: Pick<LaterReviewEntry, "date_notification_task_id" | "pipeline_notification_task_id">) => {
    const taskIds = [entry.date_notification_task_id, entry.pipeline_notification_task_id].filter(Boolean) as string[];
    if (taskIds.length === 0) return;

    const { error } = await supabase.from("tasks").delete().in("id", taskIds);
    if (error) throw error;
  };

  const removeLaterReviewEntry = async (entry: LaterReviewEntry) => {
    await deleteLaterReviewTasks(entry);
    const { error } = await supabase.from("tasks").delete().eq("id", entry.id);
    if (error) throw error;
  };

  const updateLaterReviewEntry = async (entryId: string, meta: LaterReviewTaskMeta) => {
    const { error } = await supabase
      .from("tasks")
      .update({
        description: serializeLaterReviewMeta(meta),
        updated_at: new Date().toISOString(),
      })
      .eq("id", entryId);

    if (error) throw error;
  };

  const triggerDueReminderEmails = async () => {
    try {
      await supabase.functions.invoke("task-due-reminder");
    } catch (error) {
      console.error("Kunne ikke trigge e-postpåminnelser", error);
    }
  };

  const syncLaterReviewAfterPipelineAdd = async (consultantType: "intern" | "ekstern", consultantId: number | string) => {
    const match = laterReviewKonsulenter.find((entry) =>
      consultantType === "intern"
        ? entry.konsulent_type === "intern" && entry.ansatt_id === consultantId
        : entry.konsulent_type === "ekstern" && entry.ekstern_id === consultantId
    );

    if (!match) return;
    await removeLaterReviewEntry(match);
  };

  const hasPipelineExit = useMemo(
    () => linkedKonsulenter.some((entry: any) => isPipelineExitStatus(entry.status)),
    [linkedKonsulenter],
  );

  const buildLaterReviewContext = (candidateName: string) => {
    const requestContext = row.contacts
      ? `${row.selskap_navn} · ${row.contacts.first_name} ${row.contacts.last_name}`.trim()
      : row.selskap_navn;
    return {
      requestContext,
      dateDescription: `${candidateName} er lagret for senere vurdering på forespørselen fra ${requestContext}.`,
      pipelineDescription: `${candidateName} er klar for vurdering igjen etter avslag eller bortfall i pipeline på forespørselen fra ${requestContext}.`,
    };
  };

  const createPipelineExitNotifications = async (triggerStatus: "avslag" | "bortfalt") => {
    const pendingEntries = laterReviewKonsulenter.filter(
      (entry) => entry.notify_on_pipeline_exit && !entry.pipeline_notification_task_id,
    );

    if (pendingEntries.length === 0) return;

    let createdCount = 0;
    const today = format(new Date(), "yyyy-MM-dd");

    for (const entry of pendingEntries) {
      const candidateName = getLaterReviewName(entry);
      const context = buildLaterReviewContext(candidateName);

      try {
        const taskId = await createLaterReviewTask({
          assignedTo: entry.notify_user_id,
          dueDate: today,
          emailNotify: true,
          title: `Klar for vurdering: ${candidateName}`,
          description: `${context.pipelineDescription} Trigger: ${PIPELINE_CONFIG[triggerStatus].label}.`,
          reminderContext: {
            holderTaskId: entry.id,
            reminderType: "pipeline",
          },
        });
        const meta = entryToLaterReviewMeta(entry);
        meta.pipelineNotificationTaskId = taskId;
        meta.pipelineNotifiedAt = new Date().toISOString();
        await updateLaterReviewEntry(entry.id, meta);
        createdCount += 1;
      } catch (error) {
        console.error("Kunne ikke opprette senere-vurdering-varsel", error);
      }
    }

    if (createdCount > 0) {
      await triggerDueReminderEmails();
      toast.success(
        createdCount === 1
          ? "1 e-postvarsel er sendt for senere vurdering"
          : `${createdCount} e-postvarsler er sendt for senere vurdering`,
      );
    }
  };

  const addLaterReviewConsultant = async (
    consultantType: "intern" | "ekstern",
    consultantId: number | string,
    candidateName: string,
    options: LaterReviewNotificationOptions,
    externalType?: string | null,
  ) => {
    if (!user?.id) {
      toast.error("Kunne ikke lagre senere vurdering uten innlogget bruker");
      return;
    }

    const alreadyExists = laterReviewKonsulenter.some((entry) =>
      consultantType === "intern"
        ? entry.konsulent_type === "intern" && entry.ansatt_id === consultantId
        : entry.konsulent_type === "ekstern" && entry.ekstern_id === consultantId,
    );

    if (alreadyExists) {
      throw new Error("Konsulenten er allerede lagret for senere vurdering");
    }

    const now = new Date().toISOString();
    const holderMeta: LaterReviewTaskMeta = {
      consultantId: String(consultantId),
      consultantName: candidateName,
      consultantType,
      dateNotificationTaskId: null,
      externalType: consultantType === "ekstern" ? externalType || null : null,
      foresporselId: row.id,
      notifyEmailDate: options.notifyEmailDate || null,
      notifyOnPipelineExit: options.notifyOnPipelineExit,
      notifyUserId: user.id,
      pipelineNotificationTaskId: null,
      pipelineNotifiedAt: null,
    };

    const { data: inserted, error } = await supabase
      .from("tasks")
      .insert({
        assigned_to: user.id,
        company_id: row.selskap_id || null,
        contact_id: row.kontakt_id || null,
        created_by: user.id,
        description: serializeLaterReviewMeta(holderMeta),
        due_date: null,
        email_notify: false,
        priority: "medium",
        status: "done",
        title: buildLaterReviewHolderTitle(row.id, consultantType, String(consultantId)),
        updated_at: now,
      })
      .select("id")
      .single();

    if (error || !inserted?.id) throw error || new Error("Kunne ikke lagre senere vurdering");

    const context = buildLaterReviewContext(candidateName);
    const updatedMeta = { ...holderMeta };
    const notificationErrors: string[] = [];
    let shouldTriggerEmailRun = false;

    if (options.notifyEmailDate) {
      try {
        const taskId = await createLaterReviewTask({
          assignedTo: user.id,
          dueDate: options.notifyEmailDate,
          emailNotify: true,
          title: `Vurder senere: ${candidateName}`,
          description: context.dateDescription,
          reminderContext: {
            holderTaskId: inserted.id,
            reminderType: "date",
          },
        });
        updatedMeta.dateNotificationTaskId = taskId;
        if (options.notifyEmailDate <= format(new Date(), "yyyy-MM-dd")) {
          shouldTriggerEmailRun = true;
        }
      } catch (notificationError) {
        console.error("Kunne ikke opprette e-postpåminnelse", notificationError);
        notificationErrors.push("E-postpåminnelse kunne ikke opprettes");
      }
    }

    if (options.notifyOnPipelineExit && hasPipelineExit) {
      try {
        const taskId = await createLaterReviewTask({
          assignedTo: user.id,
          dueDate: format(new Date(), "yyyy-MM-dd"),
          emailNotify: true,
          title: `Klar for vurdering: ${candidateName}`,
          description: context.pipelineDescription,
          reminderContext: {
            holderTaskId: inserted.id,
            reminderType: "pipeline",
          },
        });
        updatedMeta.pipelineNotificationTaskId = taskId;
        updatedMeta.pipelineNotifiedAt = new Date().toISOString();
        shouldTriggerEmailRun = true;
      } catch (notificationError) {
        console.error("Kunne ikke opprette pipeline-varsel", notificationError);
        notificationErrors.push("Varsel ved avslag/bortfall kunne ikke opprettes");
      }
    }

    await updateLaterReviewEntry(inserted.id, updatedMeta);

    await invalidateForesporselQueries();
    if (shouldTriggerEmailRun) {
      await triggerDueReminderEmails();
    }

    toast.success(`${candidateName} lagret for senere vurdering`);
    if (notificationErrors.length > 0) {
      toast.error(notificationErrors.join(" "));
    }
  };

  const handleRemoveLaterReview = async (entry: LaterReviewEntry) => {
    setLaterReviewActionId(entry.id);
    try {
      await removeLaterReviewEntry(entry);
      await invalidateForesporselQueries();
      toast.success(`${getLaterReviewName(entry)} fjernet fra senere vurdering`);
    } catch (error: any) {
      console.error("Kunne ikke fjerne senere vurdering", error);
      toast.error(error?.message || "Kunne ikke fjerne konsulenten");
    } finally {
      setLaterReviewActionId(null);
    }
  };

  const handlePromoteLaterReview = async (entry: LaterReviewEntry) => {
    const candidateName = getLaterReviewName(entry);
    setLaterReviewActionId(entry.id);
    try {
      if (entry.konsulent_type === "intern" && entry.ansatt_id) {
        await handleAddKonsulent(entry.ansatt_id);
      } else if (entry.konsulent_type === "ekstern" && entry.ekstern_id) {
        await handleAddEkstern(entry.ekstern_id);
      } else {
        throw new Error("Fant ikke konsulenten som skulle legges til");
      }

      toast.success(`${candidateName} lagt inn i pipeline`);
    } catch (error: any) {
      console.error("Kunne ikke legge konsulenten i pipeline", error);
      toast.error(error?.message || "Kunne ikke legge konsulenten til");
    } finally {
      setLaterReviewActionId(null);
    }
  };

  // Derived expanded state
  const showMatch = matching || (matchResults !== null && matchResults.length > 0);

  // Notify parent of expand state
  useEffect(() => {
    onExpandChange?.(showMatch);
  }, [showMatch, onExpandChange]);

  // Reset match when row changes
  useEffect(() => {
    setMatchResults(null);
    setMatchUpdatedAt(null);
    setMatching(false);
    setPendingMatchRequest(false);
    setEditMode(startInEditMode);
    setEditingKommentar(false);
    setKommentar(row?.kommentar || "");
  }, [row?.id, startInEditMode]);

  // Sync form when entering edit mode
  useEffect(() => {
    if (editMode && row) {
      setMottattDato(row.mottatt_dato || "");
      setSelskapNavn(row.selskap_navn || "");
      setSelskapId(row.selskap_id || null);
      setKontakt(row.contacts ? `${row.contacts.first_name} ${row.contacts.last_name}` : "");
      setKontaktId(row.kontakt_id || null);
      setCompanyResults([]);
      setShowSelskapDropdown(false);
      setShowKontaktDropdown(false);
      setSted(row.sted || "");
      setAvdeling(row.avdeling || "");
      setFristDato(row.frist_dato || "");
      setType(row.type || "DIR");
      setTeknologier(row.teknologier || []);
      setKommentar(row.kommentar || "");
      setSluttkunde(row.sluttkunde || "");
      setStatus(row.status || "Ny");
      setTagInput("");
    }
  }, [editMode, row]);

  const searchCompanies = (query: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.length < 1) { setCompanyResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name, city, status")
        .ilike("name", `%${query}%`)
        .limit(8);
      if (data) setCompanyResults(data);
    }, 300);
  };

  const selectCompany = (c: any) => {
    setSelskapNavn(c.name);
    setSelskapId(c.id);
    setSted(c.city?.split(",")[0]?.trim() || "");
    setKontakt("");
    setKontaktId(null);
    setShowSelskapDropdown(false);
    setCompanyResults([]);
  };

  const isPartner = companyResults.find(c => c.id === selskapId)?.status === "partner"
    || row?.type === "VIA"
    || row?.type === "via_partner"
    || row?.type === "via_megler";

  const addTag = (tag: string) => {
    const merged = mergeTechnologyTags(teknologier, [tag]);
    if (merged.length !== teknologier.length) setTeknologier(merged);
    setTagInput("");
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  const handleSave = async () => {
    if (!row || saving) return;
    setSaving(true);
    const normalizedTechnologies = mergeTechnologyTags(teknologier);
    const { error } = await supabase
      .from("foresporsler")
      .update({
        selskap_navn: selskapNavn || row.selskap_navn,
        selskap_id: selskapId || row.selskap_id,
        kontakt_id: kontaktId,
        mottatt_dato: mottattDato || row.mottatt_dato,
        sted: sted || null,
        avdeling: avdeling || null,
        frist_dato: fristDato || null,
        type: isPartner ? "VIA" : "DIR",
        teknologier: normalizedTechnologies,
        kommentar: kommentar || null,
        sluttkunde: sluttkunde || null,
        status: status || row.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    setSaving(false);
    if (error) { toast.error("Kunne ikke oppdatere"); return; }
    toast.success("Forespørsel oppdatert");
    queryClient.invalidateQueries({ queryKey: crmQueryKeys.foresporsler.list() });
    if (startInEditMode) onClose();
    else setEditMode(false);
  };

  const handleDelete = async () => {
    if (!row) return;
    const { error } = await supabase.from("foresporsler").delete().eq("id", row.id);
    if (error) { toast.error("Kunne ikke slette"); return; }
    toast.success("Forespørsel slettet");
    queryClient.invalidateQueries({ queryKey: crmQueryKeys.foresporsler.list() });
    onClose();
  };

  const handleAddKonsulent = async (ansattId: number) => {
    const { error } = await supabase.from("foresporsler_konsulenter").insert({
      foresporsler_id: row.id,
      ansatt_id: ansattId,
      konsulent_type: "intern",
    });
    if (error) throw error;
    await syncLaterReviewAfterPipelineAdd("intern", ansattId);
    await invalidateForesporselQueries();
  };

  const handleAddEkstern = async (eksternId: string) => {
    const { error } = await supabase.from("foresporsler_konsulenter").insert({
      foresporsler_id: row.id,
      ekstern_id: eksternId,
      konsulent_type: "ekstern",
    });
    if (error) throw error;
    await syncLaterReviewAfterPipelineAdd("ekstern", eksternId);
    await invalidateForesporselQueries();
  };

  const handleRemoveKonsulent = async (linkId: string) => {
    await supabase.from("foresporsler_konsulenter").delete().eq("id", linkId);
    await invalidateForesporselQueries();
  };

  const fireConfetti = () => {
    import("canvas-confetti").then(({ default: confetti }) => {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ["#22c55e", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6"] });
      setTimeout(() => {
        confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0 }, colors: ["#22c55e", "#f59e0b"] });
        confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1 }, colors: ["#3b82f6", "#8b5cf6"] });
      }, 300);
    });
  };

  const updateKonsulentStatus = async (linkedKonsulent: any, newStatus: string) => {
    await supabase
      .from("foresporsler_konsulenter")
      .update({ status: newStatus, status_updated_at: new Date().toISOString() })
      .eq("id", linkedKonsulent.id);
    if (newStatus === "vunnet") {
      fireConfetti();
      const isIntern = linkedKonsulent.konsulent_type === "intern";
      const konsulentNavn = isIntern
        ? linkedKonsulent.stacq_ansatte?.navn
        : linkedKonsulent.external_consultants?.navn;
      setOppdragKonsulentNavn(konsulentNavn || "");
      setOppdragUtpris("");
      setOppdragInnpris("");
      setOppdragStartDato("");
      setOppdragFornyDato("");
      setOppdragKommentar("");
      setOppdragLopende(false);
      setOppdragAnsattId(isIntern ? linkedKonsulent.ansatt_id ?? null : null);
      setOppdragEksternId(isIntern ? null : linkedKonsulent.ekstern_id ?? null);
      setOppdragErAnsatt(isIntern);
      setTimeout(() => setOppdragModalOpen(true), 600);
    }
    if (newStatus === "avslag" || newStatus === "bortfalt") {
      await createPipelineExitNotifications(newStatus);
    }
    await invalidateForesporselQueries();
  };

  const handleCreateOppdrag = async () => {
    setOppdragSubmitting(true);
    try {
      await createOppdrag(
        createOppdragFormState({
          kandidat: oppdragKonsulentNavn,
          personType: oppdragErAnsatt ? "ansatt" : "ekstern",
          ansattId: oppdragErAnsatt ? oppdragAnsattId : null,
          eksternId: oppdragErAnsatt ? null : oppdragEksternId,
          status: "Oppstart",
          dealType: row.type || "DIR",
          utpris: oppdragUtpris,
          tilKonsulent: oppdragInnpris,
          startDato: oppdragStartDato ? new Date(oppdragStartDato) : undefined,
          fornyDato: oppdragFornyDato ? new Date(oppdragFornyDato) : undefined,
          kommentar: oppdragKommentar,
          selskapId: row.selskap_id || null,
          selskapNavn: row.selskap_navn || null,
          isLopende: oppdragLopende,
        }),
      );
      await invalidateOppdragQueries(queryClient);
      toast.success("Oppdrag opprettet");
      setOppdragModalOpen(false);
    } catch {
      toast.error("Kunne ikke opprette oppdrag");
    } finally {
      setOppdragSubmitting(false);
    }
  };

  // Save kommentar inline
  const saveKommentar = async () => {
    setEditingKommentar(false);
    if (kommentar === (row?.kommentar || "")) return;
    await supabase
      .from("foresporsler")
      .update({ kommentar: kommentar || null, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    queryClient.invalidateQueries({ queryKey: crmQueryKeys.foresporsler.list() });
  };

  // AI Match
  const runMatchNow = async () => {
    setMatching(true);
    setPendingMatchRequest(false);
    try {
      const kontaktData = row.kontakt_id
          ? await Promise.all([
              supabase.from("activities").select("contact_id, created_at, subject, description").eq("contact_id", row.kontakt_id).order("created_at", { ascending: false }),
              supabase.from("tasks").select("contact_id, created_at, title, description, due_date").eq("contact_id", row.kontakt_id).neq("status", "done"),
              supabase.from("contacts").select("id, call_list").eq("id", row.kontakt_id).single(),
            ])
          : [{ data: [] }, { data: [] }, { data: null }];

      const [aktiviteterRes, tasksRes, kontaktRes] = kontaktData as any;
      const aktiviteter = aktiviteterRes?.data || [];
      const kontaktTasks = tasksRes?.data || [];
      const kontakt = kontaktRes?.data || null;

      const signal = row.kontakt_id
        ? getEffectiveSignal(
            aktiviteter.map((a: any) => ({ created_at: a.created_at, subject: a.subject, description: a.description })),
            kontaktTasks.map((t: any) => ({ created_at: t.created_at, title: t.title, description: t.description, due_date: t.due_date }))
          )
        : null;

      const sisteKontakt = aktiviteter[0]?.created_at
        ? new Date(aktiviteter[0].created_at).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" })
        : null;

      const { data, error } = await supabase.functions.invoke("match-consultants", {
        body: {
          teknologier: row.teknologier || [],
          sted: row.sted || "",
          interne: cachedInterne,
          eksterne: cachedEksterne,
          kontakt_er_innkjoper: kontakt?.call_list || false,
          kontakt_signal: signal || "Ukjent om behov",
          siste_kontakt_dato: sisteKontakt,
          aktive_foresporsler: [],
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMatchSourceFilter("Alle");
      setMatchResults(sortConsultantMatches(Array.isArray(data) ? data : []));
      setMatchUpdatedAt(new Date().toISOString());
    } catch (err: any) {
      console.error("Match error:", err);
      toast.error(err.message || "Kunne ikke kjøre matching");
      setMatchResults([]);
      setMatchUpdatedAt(null);
    } finally {
      setMatching(false);
    }
  };

  const runMatch = async () => {
    if (matching) return;

    setMatchSourceFilter("Alle");
    setMatchResults(null);
    setMatchUpdatedAt(null);

    if (!consultantCacheReady) {
      setPendingMatchRequest(true);
      setMatching(true);
      return;
    }

    await runMatchNow();
  };

  useEffect(() => {
    if (!pendingMatchRequest || !consultantCacheReady || !row?.id) return;
    void runMatchNow();
  }, [pendingMatchRequest, consultantCacheReady, row?.id]);

  // Add from match result
  const addFromMatch = async (match: MatchResult) => {
    try {
      if (match.type === "intern") {
        await handleAddKonsulent(match.id as number);
        toast.success(`${match.navn} lagt til`);
      } else {
        await handleAddEkstern(match.id as string);
        toast.success(`${match.navn} (ekstern) lagt til`);
      }
    } catch (error: any) {
      console.error("Kunne ikke legge til fra match", error);
      toast.error(error?.message || "Kunne ikke legge til konsulenten");
    }
  };

  const visibleMatchResults = useMemo(
    () => filterConsultantMatches(matchResults || [], matchSourceFilter),
    [matchResults, matchSourceFilter],
  );
  const matchFreshness = formatConsultantMatchFreshness(matchUpdatedAt);
  const isPreparingMatch = pendingMatchRequest && !consultantCacheReady;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast("Kopiert!", { duration: 1500 });
  };

  const SUGGESTED_TAGS = ["C++", "C", "Embedded", "Yocto", "Linux", "Qt", "FPGA", "Python", "SPI/I2C", "MCU", "Embedded Linux", "Sikkerhet"];

  if (!row) return null;

  const contactName = row.contacts ? `${row.contacts.first_name || ""} ${row.contacts.last_name || ""}`.trim() : null;
  const contactTitle = row.contacts?.title || null;
  const contactEmail = row.contacts?.email || null;
  const contactPhone = row.contacts?.phone || null;
  const companyHref = row.selskap_id ? getCompanyPath(row.selskap_id) : null;
  const linkedInternIds = linkedKonsulenter
    .filter((k: any) => k.konsulent_type === "intern")
    .map((k: any) => k.ansatt_id)
    .filter(Boolean);
  const linkedEksternIds = linkedKonsulenter
    .filter((k: any) => k.konsulent_type === "ekstern")
    .map((k: any) => k.ekstern_id)
    .filter(Boolean);
  const laterReviewInternIds = laterReviewKonsulenter
    .filter((entry) => entry.konsulent_type === "intern" && entry.ansatt_id)
    .map((entry) => entry.ansatt_id as number);
  const laterReviewEksternIds = laterReviewKonsulenter
    .filter((entry) => entry.konsulent_type === "ekstern" && entry.ekstern_id)
    .map((entry) => entry.ekstern_id as string);
  const alreadyLinkedIds = new Set([...linkedInternIds, ...linkedEksternIds]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[1.25rem] font-bold text-foreground truncate">
              {contactName || row.selskap_navn}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.8125rem] text-muted-foreground">
              {companyHref ? (
                <button
                  type="button"
                  onClick={() => navigate(companyHref)}
                  className="font-medium text-primary hover:underline"
                >
                  {row.selskap_navn}
                </button>
              ) : (
                <span className="font-medium text-primary">{row.selskap_navn}</span>
              )}
              {row.sted && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                    {row.sted}
                  </span>
                </>
              )}
              {(contactTitle || row.avdeling) && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span>{contactTitle || row.avdeling}</span>
                </>
              )}
            </div>
            {(contactPhone || contactEmail) && (
              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.8125rem] text-muted-foreground">
                {contactPhone && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(contactPhone)}
                    className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground cursor-pointer"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {contactPhone}
                  </button>
                )}
                {contactEmail && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(contactEmail)}
                    className="inline-flex items-center gap-1.5 break-all text-left transition-colors hover:text-foreground cursor-pointer"
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    {contactEmail}
                  </button>
                )}
              </div>
            )}
          </div>
          {!editMode && (
            <button
              onClick={() => {
                if (onRequestEdit) {
                  onRequestEdit();
                  return;
                }
                setEditMode(true);
              }}
              className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors shrink-0"
            >
              <Pencil className="h-3.5 w-3.5" />
              Rediger
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={cn("flex-1 overflow-hidden", editMode ? "overflow-y-auto px-6 py-5" : "")}>
        {editMode ? (
          /* ─── EDIT MODE ─── */
          <EditMode
            row={row}
            mottattDato={mottattDato}
            setMottattDato={setMottattDato}
            selskapNavn={selskapNavn}
            setSelskapNavn={setSelskapNavn}
            setSelskapId={setSelskapId}
            setShowSelskapDropdown={setShowSelskapDropdown}
            showSelskapDropdown={showSelskapDropdown}
            companyResults={companyResults}
            searchCompanies={searchCompanies}
            selectCompany={selectCompany}
            isPartner={isPartner}
            sluttkunde={sluttkunde}
            setSluttkunde={setSluttkunde}
            sted={sted}
            setSted={setSted}
            selskapId={selskapId}
            kontakt={kontakt}
            setKontakt={setKontakt}
            kontaktId={kontaktId}
            setKontaktId={setKontaktId}
            showKontaktDropdown={showKontaktDropdown}
            setShowKontaktDropdown={setShowKontaktDropdown}
            filteredContacts={filteredContacts}
            fristDato={fristDato}
            setFristDato={setFristDato}
            status={status}
            setStatus={setStatus}
            avdeling={avdeling}
            setAvdeling={setAvdeling}
            teknologier={teknologier}
            setTeknologier={setTeknologier}
            tagInput={tagInput}
            setTagInput={setTagInput}
            addTag={addTag}
            handleTagKeyDown={handleTagKeyDown}
            kommentar={kommentar}
            setKommentar={setKommentar}
          />
        ) : (
          /* ─── VIEW MODE ─── */
          <div className={cn("h-full min-h-0", showMatch ? "flex flex-col sm:flex-row" : "")}>
            {/* LEFT COLUMN */}
            <div className={cn(
              "min-h-0 overflow-y-auto py-5 px-6",
              showMatch ? "w-full sm:h-full sm:w-[320px] flex-shrink-0" : "h-full"
            )}>
              <div className="space-y-5">
                {/* Missing contact warning */}
                {!row.kontakt_id && (
                  <MissingContactBanner row={row} />
                )}

                {/* Info row */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div>
                    <p className={LABEL}>Mottatt</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-[0.875rem] text-foreground mt-1 cursor-default">
                          {formatReceivedDateLabel(row.mottatt_dato)}
                        </p>
                      </TooltipTrigger>
                      {row.mottatt_dato && <TooltipContent>{fullDate(row.mottatt_dato)}</TooltipContent>}
                    </Tooltip>
                  </div>
                  {!matchResults && !matching && (
                    <div className="sm:justify-self-end">
                      <DesignLabActionButton
                        onClick={runMatch}
                        disabled={!(row.teknologier?.length)}
                        variant="secondary"
                        style={{ height: 32, fontSize: 12 }}
                      >
                        <Target className="h-3.5 w-3.5" />
                        Finn konsulent match
                      </DesignLabActionButton>
                    </div>
                  )}
                </div>


                {/* Teknologier */}
                <div>
                  <p className={LABEL}>Teknologier</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {(row.teknologier || []).length > 0 ? (
                      row.teknologier.map((t: string) => (
                        <DesignLabReadonlyChip key={t} active={false}>
                          {t}
                        </DesignLabReadonlyChip>
                      ))
                    ) : (
                      <span className="text-[0.8125rem] text-muted-foreground">—</span>
                    )}
                  </div>
                </div>

                {/* Finn match button (only when no results yet) */}
                {/* No results message */}
                {matchResults && matchResults.length === 0 && !matching && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="h-4 w-4 text-primary" />
                      <p className={`${LABEL} mb-0`}>Konsulentmatch</p>
                    </div>
                    <p className="text-[0.8125rem] text-muted-foreground">Ingen treff med score ≥ 4</p>
                  </div>
                )}

                {/* ─── Sendt inn (pipeline) ─── */}
                <div>
                  <p className={`${LABEL} mb-2`}>Sendt inn ({linkedKonsulenter.length})</p>
                  <div className="space-y-2 mb-3">
                    {linkedKonsulenter.length === 0 && (
                      <p className="text-[0.8125rem] text-muted-foreground">
                        Ingen konsulenter sendt inn ennå
                      </p>
                    )}
                    {linkedKonsulenter.map((k: any) => {
                      const isIntern = k.konsulent_type === "intern";
                      const navn = isIntern ? k.stacq_ansatte?.navn : k.external_consultants?.navn;
                      const status = k.status || "sendt_cv";
                      const externalMeta = !isIntern && k.external_consultants?.id
                        ? externalConsultantMetaById.get(k.external_consultants.id)
                        : null;
                      const externalPartnerCompanyName = getExternalConsultantPartnerCompanyName(externalMeta);
                      const PIPELINE = [
                        { key: "sendt_cv", label: "Sendt CV", color: "bg-[#FBF3E6] text-[#7D4E00] border-[#E8D0A0]" },
                        { key: "intervju", label: "Intervju", color: "bg-[#EAF0F9] text-[#1A4FA0] border-[#B3C8E8]" },
                        { key: "vunnet", label: "Vunnet", color: "bg-[#EBF3EE] text-[#2D6A4F] border-[#C0DEC8]" },
                        { key: "avslag", label: "Avslag", color: "bg-[#FAEBEC] text-[#8B1D20] border-[#E8B8BA]" },
                        { key: "bortfalt", label: "Bortfalt", color: "bg-[#F0F2F6] text-[#3A3F4A] border-[#C8CDD6]" },
                      ];
                      return (
                        <div key={k.id} className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 mb-2">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {(() => {
                                const portrait = k.konsulent_type === "intern" && k.stacq_ansatte?.id
                                  ? portraitByAnsattId.get(k.stacq_ansatte.id)
                                  : undefined;
                                if (portrait) return <img src={portrait} alt={navn || ""} className="h-7 w-7 rounded-full object-cover border border-border flex-shrink-0" />;
                                return <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[0.6875rem] font-semibold text-primary flex-shrink-0">{getInitials(navn || "?")}</div>;
                              })()}
                              <span className="text-[0.875rem] font-medium">{navn || "Ukjent"}</span>
                              <span className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold",
                                isIntern ? "bg-foreground text-background" : "bg-blue-100 text-blue-700"
                              )}>
                                {isIntern ? "Ansatt" : "Ekstern"}
                              </span>
                              {!isIntern && (
                                <ExternalConsultantOriginBadge
                                  type={externalMeta?.type || k.external_consultants?.type}
                                  partnerCompanyName={externalPartnerCompanyName}
                                />
                              )}
                            </div>
                            <button onClick={() => handleRemoveKonsulent(k.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {PIPELINE.map(s => (
                              <button
                                key={s.key}
                                onClick={() => updateKonsulentStatus(k, s.key)}
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-semibold transition-all ${
                                  status === s.key
                                    ? `${s.color} ring-2 ring-offset-1 ring-current`
                                    : "border-border text-muted-foreground hover:bg-secondary"
                                }`}
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    <AddKonsulentCombobox
                      alreadyLinkedIntern={linkedInternIds as number[]}
                      alreadyLinkedEkstern={linkedEksternIds as string[]}
                      portraitByAnsattId={portraitByAnsattId}
                      onAddIntern={handleAddKonsulent}
                      onAddEkstern={handleAddEkstern}
                    />
                    <AddLaterReviewCombobox
                      alreadyLinkedIntern={[...(linkedInternIds as number[]), ...laterReviewInternIds]}
                      alreadyLinkedEkstern={[...(linkedEksternIds as string[]), ...laterReviewEksternIds]}
                      portraitByAnsattId={portraitByAnsattId}
                      onAddIntern={(ansattId, consultantName, options) =>
                        addLaterReviewConsultant("intern", ansattId, consultantName, options)
                      }
                      onAddEkstern={(eksternId, consultantName, options, externalType) =>
                        addLaterReviewConsultant("ekstern", eksternId, consultantName, options, externalType)
                      }
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className={LABEL}>Senere vurdering ({laterReviewKonsulenter.length})</p>
                    <span className="text-[0.6875rem] text-muted-foreground">
                      Utenfor pipeline
                    </span>
                  </div>
                  <div className="space-y-2">
                    {laterReviewKonsulenter.length === 0 && (
                      <p className="text-[0.8125rem] text-muted-foreground">
                        Ingen konsulenter lagret for senere vurdering ennå
                      </p>
                    )}
                    {laterReviewKonsulenter.map((entry) => {
                      const isIntern = entry.konsulent_type === "intern";
                      const name = getLaterReviewName(entry);
                      const isBusy = laterReviewActionId === entry.id;
                      const externalMeta = !isIntern && entry.ekstern_id
                        ? externalConsultantMetaById.get(entry.ekstern_id)
                        : null;
                      const externalPartnerCompanyName = getExternalConsultantPartnerCompanyName(externalMeta);
                      const pipelineNotificationReady = Boolean(entry.pipeline_notification_task_id);
                      const hasNotifications = entry.notify_on_pipeline_exit || Boolean(entry.notify_email_date);
                      const notifyUserName = laterReviewNotifyUserNameById.get(entry.notify_user_id) || "Ukjent CRM-bruker";

                      return (
                        <div
                          key={entry.id}
                          className="rounded-lg border border-dashed border-border bg-background/80 px-3 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {isIntern ? (
                                  (() => {
                                    const portrait = entry.ansatt_id
                                      ? portraitByAnsattId.get(entry.ansatt_id)
                                      : undefined;
                                    if (portrait) {
                                      return (
                                        <img
                                          src={portrait}
                                          alt={name}
                                          className="h-7 w-7 rounded-full object-cover border border-border shrink-0"
                                        />
                                      );
                                    }
                                    return (
                                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[0.6875rem] font-semibold text-primary shrink-0">
                                        {getInitials(name)}
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-[0.6875rem] font-semibold text-blue-700 shrink-0">
                                    {getInitials(name)}
                                  </div>
                                )}

                                <span className="text-[0.875rem] font-medium text-foreground">
                                  {name}
                                </span>
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold",
                                    isIntern ? "bg-foreground text-background" : "bg-blue-100 text-blue-700",
                                  )}
                                >
                                  {isIntern ? "Ansatt" : "Ekstern"}
                                </span>
                                {!isIntern && (
                                  <ExternalConsultantOriginBadge
                                    type={externalMeta?.type || entry.external_type}
                                    partnerCompanyName={externalPartnerCompanyName}
                                  />
                                )}
                              </div>

                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {entry.notify_on_pipeline_exit && (
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium",
                                      pipelineNotificationReady
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : "border-border bg-muted text-muted-foreground",
                                    )}
                                  >
                                    <Bell className="h-3 w-3" />
                                    {pipelineNotificationReady ? "E-post klargjort" : "E-post ved avslag/bortfall"}
                                  </span>
                                )}
                                {entry.notify_email_date && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                                    <CalendarDays className="h-3 w-3" />
                                    E-post {formatNotificationDate(entry.notify_email_date)}
                                  </span>
                                )}
                                {!hasNotifications && (
                                  <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                                    Ingen varsling
                                  </span>
                                )}
                                {hasNotifications && (
                                  <span
                                    className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground"
                                    title={`CRM-bruker: ${notifyUserName}`}
                                  >
                                    Varsles: {notifyUserName}
                                  </span>
                                )}
                              </div>

                              <p className="mt-2 text-[0.75rem] text-muted-foreground">
                                Holdes utenfor pipeline til du er klar til å legge konsulenten inn.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => void handleRemoveLaterReview(entry)}
                              disabled={isBusy}
                              className="mt-0.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <DesignLabActionButton
                              variant="secondary"
                              onClick={() => void handlePromoteLaterReview(entry)}
                              disabled={isBusy}
                              style={{ height: 32, fontSize: 12 }}
                            >
                              {isBusy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <ArrowRight className="h-3.5 w-3.5" />
                              )}
                              Legg konsulenten
                            </DesignLabActionButton>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ─── Kommentar (inline edit) ─── */}
                <div>
                  <p className={LABEL}>Kommentar</p>
                  {editingKommentar ? (
                    <div className="mt-1">
                      <textarea
                        ref={kommentarRef}
                        value={kommentar}
                        onChange={e => setKommentar(e.target.value)}
                        onBlur={saveKommentar}
                        onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") saveKommentar(); }}
                        rows={3}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        placeholder="Notater, kilde, intern info..."
                        autoFocus
                      />
                      <p className="text-[0.6875rem] text-muted-foreground mt-1">Klikk utenfor eller Cmd+Enter for å lagre</p>
                    </div>
                  ) : (
                    <div
                      onClick={() => setEditingKommentar(true)}
                      className="mt-1 cursor-pointer rounded-lg px-3 py-2 hover:bg-muted/40 transition-colors min-h-[40px]"
                    >
                      {kommentar ? (
                        <p className="text-[0.875rem] text-foreground/70 whitespace-pre-wrap leading-relaxed">{kommentar}</p>
                      ) : (
                        <p className="text-[0.8125rem] text-muted-foreground/50 italic">Klikk for å legge til kommentar...</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN — Match results */}
            {showMatch && (
              <div className="min-h-0 flex-1 overflow-y-auto border-t border-border py-5 px-5 sm:border-t-0 sm:border-l">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <div>
                      <p className={`${LABEL} mb-0`}>Konsulentmatch</p>
                      {matchFreshness && (
                        <p className="text-[0.6875rem] text-muted-foreground normal-case tracking-normal">
                          {matchFreshness}
                        </p>
                      )}
                    </div>
                  </div>
                  {matchResults && matchResults.length > 0 && (
                    <button
                      onClick={runMatch}
                      className="text-[0.75rem] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Kjør på nytt
                    </button>
                  )}
                </div>

                {matchResults && matchResults.length > 0 && (
                  <div className="flex items-center gap-1.5 mb-3">
                    {(["Alle", "Ansatte", "Eksterne"] as const).map(chip => {
                      const sel = matchSourceFilter === chip;
                      return (
                        <button
                          key={chip}
                          onClick={() => setMatchSourceFilter(chip)}
                          className={sel
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

                {matching && (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="rounded-lg border border-border bg-muted/30 p-3 animate-pulse">
                        <div className="h-4 bg-muted rounded w-2/3 mb-2" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    ))}
                    <p className="text-[0.8125rem] text-primary font-medium flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {isPreparingMatch ? "Laster kandidater..." : "Analyserer match..."}
                    </p>
                  </div>
                )}

                {matchResults && matchResults.length > 0 && (
                  <div className="space-y-2">
                    {visibleMatchResults.length === 0 ? (
                      <p className="text-[0.8125rem] text-muted-foreground">Ingen treff for valgt filter</p>
                    ) : (
                      visibleMatchResults.map((m, i) => {
                        const isLinked = alreadyLinkedIds.has(m.id);
                        return (
                          <div key={`${m.type}-${m.id}`} className="rounded-lg border border-border bg-card p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[0.75rem] font-bold text-muted-foreground">#{i + 1}</span>
                                <span className="text-[0.875rem] font-semibold text-foreground truncate">{m.navn}</span>
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
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={cn("inline-block h-2.5 w-2.5 rounded-full", getConsultantMatchScoreColor(m.score))}
                                />
                                <span className="text-[0.8125rem] font-bold text-foreground">{m.score}/10</span>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {m.match_tags.map((t) => (
                                <span
                                  key={t}
                                  className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[0.6875rem] font-medium text-primary"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                            <p className="mt-1.5 text-[0.8125rem] italic text-muted-foreground">{m.begrunnelse}</p>
                            {!isLinked && (
                              <button
                                onClick={() => addFromMatch(m)}
                                className="mt-2 inline-flex items-center gap-1 text-[0.75rem] font-medium text-primary hover:underline"
                              >
                                <Plus className="h-3 w-3" />
                                Legg til
                              </button>
                            )}
                            {isLinked && (
                              <span className="mt-2 inline-flex items-center gap-1 text-[0.75rem] font-medium text-emerald-600">
                                ✓ Allerede lagt til
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border">
        {editMode ? (
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button
              onClick={() => {
                if (startInEditMode) onClose();
                else setEditMode(false);
              }}
              className="flex-1 h-9 text-[0.8125rem] rounded-lg border border-border text-muted-foreground hover:bg-secondary transition-colors"
            >
              Avbryt
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-9 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "Lagrer..." : "Lagre endringer"}
            </button>
          </div>
        ) : (
          <DeleteButton onConfirm={handleDelete} />
        )}
      </div>

      {/* Opprett oppdrag modal */}
      <Dialog open={oppdragModalOpen} onOpenChange={setOppdragModalOpen}>
        <DialogContent className="max-w-md rounded-xl p-6 gap-0" hideCloseButton>
          <DialogTitle className="text-[1.125rem] font-bold text-foreground mb-5">Opprett oppdrag</DialogTitle>

          <div className="space-y-4">
            {/* Read-only fields */}
            <div>
              <p className={LABEL}>Konsulent</p>
              <p className="text-[0.875rem] font-medium text-foreground mt-0.5 mb-3">{oppdragKonsulentNavn}</p>
            </div>
            <div>
              <p className={LABEL}>Kunde</p>
              <p className="text-[0.875rem] font-medium text-foreground mt-0.5 mb-3">{row?.selskap_navn}</p>
            </div>
            <div>
              <p className={LABEL}>Type</p>
              <p className="text-[0.875rem] font-medium text-foreground mt-0.5 mb-3">{row?.type === "VIA" ? "Partner" : "Direkte"}</p>
            </div>

            {/* Editable fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Utpris / time</label>
                <Input
                  type="number"
                  value={oppdragUtpris}
                  onChange={(e) => setOppdragUtpris(e.target.value)}
                  placeholder="f.eks. 1500"
                  className="mt-1 text-[0.875rem]"
                />
              </div>
              <div>
                <label className={LABEL}>Innpris / time</label>
                <Input
                  type="number"
                  value={oppdragInnpris}
                  onChange={(e) => setOppdragInnpris(e.target.value)}
                  placeholder="f.eks. 1050"
                  className="mt-1 text-[0.875rem]"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Startdato</label>
                <Input
                  type="date"
                  value={oppdragStartDato}
                  onChange={(e) => setOppdragStartDato(e.target.value)}
                  className="mt-1 text-[0.875rem]"
                />
              </div>
              <div>
                <label className={LABEL}>Fornyelsesdato</label>
                <Input
                  type="date"
                  value={oppdragFornyDato}
                  onChange={(e) => setOppdragFornyDato(e.target.value)}
                  className="mt-1 text-[0.875rem]"
                  disabled={oppdragLopende}
                />
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="lopende-ny"
                    checked={oppdragLopende}
                    onChange={(e) => {
                      setOppdragLopende(e.target.checked);
                      if (e.target.checked) {
                        const d = new Date();
                        d.setDate(d.getDate() + 30);
                        setOppdragFornyDato(d.toISOString().slice(0, 10));
                      } else {
                        setOppdragFornyDato("");
                      }
                    }}
                    className="h-4 w-4 rounded border-border"
                  />
                  <label htmlFor="lopende-ny" className="text-[0.8125rem] text-muted-foreground cursor-pointer select-none">
                    Løpende 30 dager
                  </label>
                </div>
                {oppdragLopende && oppdragFornyDato && (
                  <p className="text-[0.75rem] text-muted-foreground ml-6 mt-1">
                    Utløper: {format(new Date(oppdragFornyDato), "d. MMMM yyyy", { locale: nb })}
                  </p>
                )}
              </div>
            </div>
            <div>
              <label className={LABEL}>Kommentar</label>
              <Textarea
                value={oppdragKommentar}
                onChange={(e) => setOppdragKommentar(e.target.value)}
                placeholder="Notater om oppdraget..."
                rows={3}
                className="mt-1 text-[0.875rem]"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
            <button
              onClick={() => setOppdragModalOpen(false)}
              className="text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors"
            >
              Avbryt
            </button>
            <button
              onClick={() => handleCreateOppdrag()}
              disabled={oppdragSubmitting}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-colors"
            >
              {oppdragSubmitting ? "Oppretter..." : "Opprett oppdrag"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Edit Mode (extracted for readability) ─── */

function EditMode(props: any) {
  const {
    row, mottattDato, setMottattDato,
    selskapNavn, setSelskapNavn, setSelskapId, setShowSelskapDropdown,
    showSelskapDropdown, companyResults, searchCompanies, selectCompany,
    isPartner, sluttkunde, setSluttkunde, sted, setSted, selskapId,
    kontakt, setKontakt, kontaktId, setKontaktId, showKontaktDropdown,
    setShowKontaktDropdown, filteredContacts, fristDato, setFristDato,
    status, setStatus, avdeling, setAvdeling, teknologier, setTeknologier,
    tagInput, setTagInput, addTag, handleTagKeyDown, kommentar, setKommentar,
  } = props;

  const LABEL = "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";
  const SUGGESTED_TAGS = ["C++", "C", "Embedded", "Yocto", "Linux", "Qt", "FPGA", "Python", "SPI/I2C", "MCU", "Embedded Linux", "Sikkerhet"];

  const [showAnalyze, setShowAnalyze] = useState(false);
  const [analyzeText, setAnalyzeText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    if (!analyzeText.trim()) return;
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ tags: string[] }>("extract-technology-tags", {
        body: {
          text: analyzeText.trim(),
          existing: teknologier,
        },
      });
      if (error) throw error;
      const merged = data?.tags || mergeTechnologyTags(teknologier);
      setTeknologier(merged);
      setShowAnalyze(false);
      setAnalyzeText("");
      toast.success(`${Math.max(merged.length - teknologier.length, 0)} teknologier lagt til`);
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke analysere teksten");
    } finally {
      setAnalyzing(false);
    }
  };

  // Fetch company locations (avdelinger) from companies.city
  const { data: companyCity } = useQuery({
    queryKey: ["company-city", selskapId],
    enabled: !!selskapId,
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("city").eq("id", selskapId!).single();
      return data?.city || null;
    },
  });
  const companyLocations: string[] = companyCity ? companyCity.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
  const hasAvdelinger = companyLocations.length > 1;

  return (
    <div className="space-y-4">
      {/* Mottatt dato */}
      <div>
        <label className={LABEL}>Mottatt</label>
        <Input
          type="date"
          value={mottattDato}
          onChange={(e: any) => setMottattDato(e.target.value)}
          className="mt-1 text-[0.875rem] w-full"
        />
      </div>

      {/* Selskap */}
      <div>
        <label className={LABEL}>Selskap</label>
        <div className="relative mt-1">
          <Input
            value={selskapNavn}
            onChange={(e: any) => {
              setSelskapNavn(e.target.value);
              setSelskapId(null);
              setShowSelskapDropdown(true);
              searchCompanies(e.target.value);
            }}
            onFocus={() => setShowSelskapDropdown(true)}
            placeholder="Søk etter selskap..."
            className="text-[0.875rem]"
          />
          {showSelskapDropdown && companyResults.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-md max-h-48 overflow-auto">
              {companyResults.map((c: any) => (
                <button key={c.id} onClick={() => selectCompany(c)}
                  className="w-full text-left px-3 py-2 text-[0.8125rem] hover:bg-secondary transition-colors">
                  {c.name}
                  {c.city && <span className="text-muted-foreground ml-2 text-[0.75rem]">{c.city}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Partner banner */}
      {isPartner && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-2">
          <p className="text-[0.8125rem] text-amber-800">
            Forespørselen kom via en partner — hvem er sluttkunden?
          </p>
          <Input
            value={sluttkunde}
            onChange={(e: any) => setSluttkunde(e.target.value)}
            placeholder="f.eks. Kongsberg Defence, Equinor..."
            className="h-10 rounded-lg bg-white"
          />
        </div>
      )}

      {/* Sted */}
      <div>
        <label className={LABEL}>Sted</label>
        <Input value={sted} onChange={(e: any) => setSted(e.target.value)}
          className="mt-1 text-[0.875rem]" placeholder="f.eks. Oslo, Kongsberg, Remote" />
      </div>

      {/* Kontaktperson */}
      <div>
        <label className={LABEL}>Kontaktperson</label>
        <div className="relative mt-1">
          {!selskapId ? (
            <Input disabled placeholder="Velg selskap først..."
              className="text-[0.875rem] opacity-50 cursor-not-allowed" />
          ) : (
            <>
              <Input
                value={kontakt}
                onChange={(e: any) => { setKontakt(e.target.value); setKontaktId(null); setShowKontaktDropdown(true); }}
                onFocus={() => setShowKontaktDropdown(true)}
                onBlur={() => setTimeout(() => setShowKontaktDropdown(false), 200)}
                placeholder="Søk etter kontaktperson..."
                className="text-[0.875rem]"
              />
              {showKontaktDropdown && !kontaktId && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-md max-h-[200px] overflow-y-auto">
                  {filteredContacts.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-3 py-2.5 italic">Ingen kontakter på dette selskapet</p>
                  ) : (
                    (filteredContacts as any[]).map((c) => (
                      <button key={c.id}
                        onClick={() => { setKontakt(`${c.first_name} ${c.last_name}`); setKontaktId(c.id); setShowKontaktDropdown(false); }}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors">
                        <p className="text-[0.875rem] font-medium">{c.first_name} {c.last_name}</p>
                        {c.title && <p className="text-xs text-muted-foreground">{c.title}</p>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>


      {/* Avdeling — only if company has multiple locations */}
      {hasAvdelinger && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          <label className={LABEL}>Avdeling</label>
          <select
            value={avdeling}
            onChange={(e) => setAvdeling(e.target.value)}
            className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-3 text-[0.875rem] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Ingen avdeling</option>
            {companyLocations.map((loc: string) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>
      )}

      {/* Teknologier */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className={LABEL}>Teknologier</label>
          <button
            type="button"
            onClick={() => setShowAnalyze((prev) => !prev)}
            className="flex items-center gap-1 text-[0.75rem] text-primary hover:underline"
          >
            <Sparkles className="h-3 w-3" />
            Analyser tekst
          </button>
        </div>
        {showAnalyze && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2 mb-2">
            <p className="text-[0.75rem] text-muted-foreground">
              Lim inn stillingsbeskrivelse, e-post eller kravspesifikasjon — AI finner relevante teknologier automatisk.
            </p>
            <textarea
              value={analyzeText}
              onChange={(e) => setAnalyzeText(e.target.value)}
              placeholder="Lim inn tekst her..."
              className="w-full h-24 text-[0.875rem] rounded-md border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!analyzeText.trim() || analyzing}
                className="flex items-center gap-1.5 text-[0.8125rem] font-medium bg-primary text-primary-foreground rounded-lg px-3 py-1.5 hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {analyzing ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />Analyserer...</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5" />Finn teknologier</>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setShowAnalyze(false); setAnalyzeText(""); }}
                className="text-[0.8125rem] text-muted-foreground hover:text-foreground"
              >
                Avbryt
              </button>
            </div>
          </div>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-1.5 p-2 border border-border rounded-lg bg-background min-h-[38px]">
          {teknologier.map((t: string) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[0.75rem] text-foreground">
              {t}
              <button onClick={() => setTeknologier(teknologier.filter((x: string) => x !== t))} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder={teknologier.length === 0 ? "Legg til..." : ""}
            className="flex-1 min-w-[80px] bg-transparent outline-none text-[0.8125rem] placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {SUGGESTED_TAGS.filter((s: string) => !teknologier.includes(s)).map((s: string) => (
            <button key={s} onClick={() => addTag(s)} className="h-7 px-2.5 text-[0.75rem] rounded-[6px] border border-border text-muted-foreground hover:bg-secondary transition-colors font-medium">
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Kommentar */}
      <div>
        <label className={LABEL}>Kommentar</label>
        <textarea
          value={kommentar}
          onChange={(e) => setKommentar(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          placeholder="Notater, kilde, intern info..."
        />
      </div>
    </div>
  );
}

/* ─── Add Konsulent Combobox ─── */

function AddKonsulentCombobox({
  alreadyLinkedIntern,
  alreadyLinkedEkstern,
  portraitByAnsattId,
  onAddIntern,
  onAddEkstern,
}: {
  alreadyLinkedIntern: number[];
  alreadyLinkedEkstern: string[];
  portraitByAnsattId: Map<number, string>;
  onAddIntern: (ansattId: number) => Promise<void>;
  onAddEkstern: (eksternId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [subTab, setSubTab] = useState<"ansatte" | "eksterne">("ansatte");
  const [addingKey, setAddingKey] = useState<string | null>(null);

  const { data: ansatte = [] } = useQuery({
    queryKey: ["stacq-ansatte-aktive"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stacq_ansatte")
        .select("id, navn, kompetanse, status")
        .in("status", ["AKTIV/SIGNERT", "Ledig"])
        .order("navn");
      return data || [];
    },
  });

  const { data: eksterne = [] } = useQuery({
    queryKey: ["external-consultants-legg-til"],
    queryFn: async () => {
      const { data } = await supabase
        .from("external_consultants")
        .select("id, navn, teknologier, type, status, selskap_tekst, companies(name)")
        .order("created_at", { ascending: true });
      // Deduplicate by navn
      const unique = (data || []).filter((c: any, i: number, arr: any[]) =>
        arr.findIndex((x: any) => x.navn === c.navn) === i
      );
      return unique;
    },
  });

  const q = search.toLowerCase();

  const filteredAnsatte = ansatte
    .filter((a: any) => !alreadyLinkedIntern.includes(a.id))
    .filter((a: any) => !q || a.navn?.toLowerCase().includes(q));

  const filteredEksterne = eksterne
    .filter((e: any) => !alreadyLinkedEkstern.includes(e.id))
    .filter((e: any) => !q || e.navn?.toLowerCase().includes(q));

  const CHIP_BASE_SM = "h-7 px-2.5 text-[0.75rem] rounded-[6px] border transition-colors cursor-pointer select-none font-medium";

  const handleSelectIntern = async (ansattId: number) => {
    setAddingKey(`intern-${ansattId}`);
    try {
      await onAddIntern(ansattId);
      toast.success("Konsulenten er lagt til");
      setOpen(false);
      setSearch("");
    } catch (error: any) {
      console.error("Kunne ikke legge til konsulent", error);
      toast.error(error?.message || "Kunne ikke legge til konsulenten");
    } finally {
      setAddingKey(null);
    }
  };

  const handleSelectEkstern = async (eksternId: string) => {
    setAddingKey(`ekstern-${eksternId}`);
    try {
      await onAddEkstern(eksternId);
      toast.success("Konsulenten er lagt til");
      setOpen(false);
      setSearch("");
    } catch (error: any) {
      console.error("Kunne ikke legge til ekstern konsulent", error);
      toast.error(error?.message || "Kunne ikke legge til konsulenten");
    } finally {
      setAddingKey(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSearch(""); } }}>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
          <Plus className="h-4 w-4" />
          Legg til konsulent
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-3" align="start">
        {/* Sub-tabs */}
        <div className="flex gap-1.5 mb-2">
          <button
            className={`${CHIP_BASE_SM} ${subTab === "ansatte" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:bg-secondary"}`}
            onClick={() => setSubTab("ansatte")}
          >
            Ansatte
          </button>
          <button
            className={`${CHIP_BASE_SM} ${subTab === "eksterne" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:bg-secondary"}`}
            onClick={() => setSubTab("eksterne")}
          >
            Eksterne
          </button>
        </div>

        <Input
          placeholder="Søk etter konsulent..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm mb-2"
          autoFocus
        />

        <div className="space-y-0.5 max-h-[280px] overflow-y-auto">
          {subTab === "ansatte" ? (
            filteredAnsatte.length === 0 ? (
              <p className="text-[0.8125rem] text-muted-foreground px-2 py-2">Ingen treff</p>
            ) : (
              filteredAnsatte.map((a: any) => (
                <button
                  key={a.id}
                  onClick={() => void handleSelectIntern(a.id)}
                  disabled={addingKey !== null}
                  className="w-full text-left px-2 py-2 rounded hover:bg-muted transition-colors disabled:opacity-60"
                >
                  <div className="flex items-center gap-2">
                    {(() => {
                      const portrait = portraitByAnsattId.get(a.id);
                      if (portrait) {
                        return (
                          <img
                            src={portrait}
                            alt={a.navn}
                            className="h-6 w-6 rounded-full object-cover border border-border shrink-0"
                          />
                        );
                      }
                      return (
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[0.625rem] font-semibold text-primary shrink-0">
                          {getInitials(a.navn)}
                        </div>
                      );
                    })()}
                    <span className="text-[0.8125rem] font-medium text-foreground">{a.navn}</span>
                    {addingKey === `intern-${a.id}` && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {a.kompetanse?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 ml-8">
                      {(a.kompetanse as string[]).slice(0, 4).map((t: string) => (
                        <span key={t} className="inline-flex items-center rounded-full border border-border bg-muted px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">
                          {t}
                        </span>
                      ))}
                      {a.kompetanse.length > 4 && (
                        <span className="text-[0.625rem] text-muted-foreground">+{a.kompetanse.length - 4}</span>
                      )}
                    </div>
                  )}
                </button>
              ))
            )
          ) : (
            filteredEksterne.length === 0 ? (
              <p className="text-[0.8125rem] text-muted-foreground px-2 py-2">Ingen treff</p>
            ) : (
              filteredEksterne.map((e: any) => (
                <button
                  key={e.id}
                  onClick={() => void handleSelectEkstern(e.id)}
                  disabled={addingKey !== null}
                  className="w-full text-left px-2 py-2 rounded hover:bg-muted transition-colors disabled:opacity-60"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-[0.625rem] font-semibold text-blue-700 shrink-0">
                      {getInitials(e.navn || "?")}
                    </div>
                    <span className="text-[0.8125rem] font-medium text-foreground">{e.navn || "Ukjent"}</span>
                    {addingKey === `ekstern-${e.id}` && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    )}
                    <ExternalConsultantOriginBadge
                      type={e.type}
                      partnerCompanyName={getExternalConsultantPartnerCompanyName(e)}
                    />
                  </div>
                  {e.teknologier?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 ml-8">
                      {(e.teknologier as string[]).slice(0, 4).map((t: string) => (
                        <span key={t} className="inline-flex items-center rounded-full border border-border bg-muted px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">
                          {t}
                        </span>
                      ))}
                      {e.teknologier.length > 4 && (
                        <span className="text-[0.625rem] text-muted-foreground">+{e.teknologier.length - 4}</span>
                      )}
                    </div>
                  )}
                </button>
              ))
            )
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AddLaterReviewCombobox({
  alreadyLinkedIntern,
  alreadyLinkedEkstern,
  portraitByAnsattId,
  onAddIntern,
  onAddEkstern,
}: {
  alreadyLinkedIntern: number[];
  alreadyLinkedEkstern: string[];
  portraitByAnsattId: Map<number, string>;
  onAddIntern: (
    ansattId: number,
    consultantName: string,
    options: LaterReviewNotificationOptions,
  ) => Promise<void>;
  onAddEkstern: (
    eksternId: string,
    consultantName: string,
    options: LaterReviewNotificationOptions,
    externalType?: string | null,
  ) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [subTab, setSubTab] = useState<"ansatte" | "eksterne">("ansatte");
  const [notifyOnPipelineExit, setNotifyOnPipelineExit] = useState(false);
  const [notifyEmailDate, setNotifyEmailDate] = useState("");
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [createExternalOpen, setCreateExternalOpen] = useState(false);

  const { data: ansatte = [] } = useQuery({
    queryKey: ["stacq-ansatte-aktive"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stacq_ansatte")
        .select("id, navn, kompetanse, status")
        .in("status", ["AKTIV/SIGNERT", "Ledig"])
        .order("navn");
      return data || [];
    },
  });

  const { data: eksterne = [] } = useQuery({
    queryKey: ["external-consultants-legg-til"],
    queryFn: async () => {
      const { data } = await supabase
        .from("external_consultants")
        .select("id, navn, teknologier, type, status, selskap_tekst, companies(name)")
        .order("created_at", { ascending: true });
      const unique = (data || []).filter((c: any, i: number, arr: any[]) =>
        arr.findIndex((x: any) => x.navn === c.navn) === i
      );
      return unique;
    },
  });

  const q = search.toLowerCase();
  const options: LaterReviewNotificationOptions = {
    notifyOnPipelineExit,
    notifyEmailDate: notifyEmailDate || null,
  };

  const filteredAnsatte = ansatte
    .filter((a: any) => !alreadyLinkedIntern.includes(a.id))
    .filter((a: any) => !q || a.navn?.toLowerCase().includes(q));

  const filteredEksterne = eksterne
    .filter((e: any) => !alreadyLinkedEkstern.includes(e.id))
    .filter((e: any) => !q || e.navn?.toLowerCase().includes(q));

  const CHIP_BASE_SM = "h-7 px-2.5 text-[0.75rem] rounded-[6px] border transition-colors cursor-pointer select-none font-medium";

  const resetState = () => {
    setSearch("");
    setNotifyOnPipelineExit(false);
    setNotifyEmailDate("");
    setAddingKey(null);
  };

  const handleSelectIntern = async (ansattId: number, consultantName: string) => {
    setAddingKey(`intern-${ansattId}`);
    try {
      await onAddIntern(ansattId, consultantName, options);
      setOpen(false);
      resetState();
    } catch (error: any) {
      console.error("Kunne ikke lagre intern konsulent for senere vurdering", error);
      toast.error(error?.message || "Kunne ikke lagre konsulenten");
      setAddingKey(null);
    }
  };

  const handleSelectEkstern = async (eksternId: string, consultantName: string, externalType?: string | null) => {
    setAddingKey(`ekstern-${eksternId}`);
    try {
      await onAddEkstern(eksternId, consultantName, options, externalType);
      setOpen(false);
      resetState();
    } catch (error: any) {
      console.error("Kunne ikke lagre ekstern konsulent for senere vurdering", error);
      toast.error(error?.message || "Kunne ikke lagre konsulenten");
      setAddingKey(null);
    }
  };

  const handleExternalCreated = async (consultant: any, mode: "create" | "update") => {
    if (mode !== "create" || !consultant?.id) return;
    await handleSelectEkstern(consultant.id, consultant.navn || "Ukjent", consultant.type || null);
    setCreateExternalOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetState();
      }}
    >
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg border border-border text-muted-foreground hover:bg-secondary transition-colors">
          <Clock3 className="h-4 w-4" />
          Legg til konsulent for senere vurdering
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-3" align="start">
        <div className="space-y-3">
          <div>
            <p className="text-[0.8125rem] font-medium text-foreground">Legg til for senere vurdering</p>
            <p className="text-[0.75rem] text-muted-foreground mt-1">
              Konsulenten lagres utenfor pipeline til du er klar til å legge den inn.
            </p>
          </div>

          <div className="flex gap-1.5">
            <button
              className={`${CHIP_BASE_SM} ${subTab === "ansatte" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:bg-secondary"}`}
              onClick={() => setSubTab("ansatte")}
            >
              Ansatte
            </button>
            <button
              className={`${CHIP_BASE_SM} ${subTab === "eksterne" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:bg-secondary"}`}
              onClick={() => setSubTab("eksterne")}
            >
              Eksterne
            </button>
          </div>

          <Input
            placeholder="Søk etter konsulent..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />

          {subTab === "eksterne" && (
            <button
              type="button"
              onClick={() => setCreateExternalOpen(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-[0.8125rem] font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Legg til ny ekstern konsulent
            </button>
          )}

          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <Checkbox
                checked={notifyOnPipelineExit}
                onCheckedChange={(value) => setNotifyOnPipelineExit(Boolean(value))}
                className="mt-0.5 h-4 w-4"
              />
                <span>
                <span className="block text-[0.8125rem] font-medium text-foreground">
                  E-postvarsel ved avslag eller bortfall
                </span>
                <span className="block text-[0.75rem] text-muted-foreground">
                  Sender e-post til deg når en konsulent i pipeline faller ut.
                </span>
              </span>
            </label>

            <div className="space-y-1.5 border-t border-border pt-3">
              <label htmlFor="later-review-email-date" className="block text-[0.8125rem] font-medium text-foreground">
                E-postpåminnelse på dato
              </label>
              <Input
                id="later-review-email-date"
                type="date"
                min={format(new Date(), "yyyy-MM-dd")}
                value={notifyEmailDate}
                onChange={(e) => setNotifyEmailDate(e.target.value)}
                className="h-8 text-sm"
              />
              <p className="text-[0.75rem] text-muted-foreground">
                Sender e-post til deg på valgt dato.
              </p>
            </div>
          </div>

          <div className="space-y-0.5 max-h-[260px] overflow-y-auto">
            {subTab === "ansatte" ? (
              filteredAnsatte.length === 0 ? (
                <p className="text-[0.8125rem] text-muted-foreground px-2 py-2">Ingen treff</p>
              ) : (
                filteredAnsatte.map((a: any) => (
                  <button
                    key={a.id}
                    onClick={() => void handleSelectIntern(a.id, a.navn || "Ukjent")}
                    disabled={addingKey !== null}
                    className="w-full text-left px-2 py-2 rounded hover:bg-muted transition-colors disabled:opacity-60"
                  >
                    <div className="flex items-center gap-2">
                      {(() => {
                        const portrait = portraitByAnsattId.get(a.id);
                        if (portrait) {
                          return (
                            <img
                              src={portrait}
                              alt={a.navn}
                              className="h-6 w-6 rounded-full object-cover border border-border shrink-0"
                            />
                          );
                        }
                        return (
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[0.625rem] font-semibold text-primary shrink-0">
                            {getInitials(a.navn)}
                          </div>
                        );
                      })()}
                      <span className="text-[0.8125rem] font-medium text-foreground">{a.navn}</span>
                      {addingKey === `intern-${a.id}` && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {a.kompetanse?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 ml-8">
                        {(a.kompetanse as string[]).slice(0, 4).map((t: string) => (
                          <span key={t} className="inline-flex items-center rounded-full border border-border bg-muted px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">
                            {t}
                          </span>
                        ))}
                        {a.kompetanse.length > 4 && (
                          <span className="text-[0.625rem] text-muted-foreground">+{a.kompetanse.length - 4}</span>
                        )}
                      </div>
                    )}
                  </button>
                ))
              )
            ) : (
              <div className="space-y-0.5">
                {filteredEksterne.length === 0 ? (
                  <p className="text-[0.8125rem] text-muted-foreground px-2 py-2">Ingen treff</p>
                ) : (
                  filteredEksterne.map((e: any) => (
                    <button
                      key={e.id}
                      onClick={() => void handleSelectEkstern(e.id, e.navn || "Ukjent", e.type || null)}
                      disabled={addingKey !== null}
                      className="w-full text-left px-2 py-2 rounded hover:bg-muted transition-colors disabled:opacity-60"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-[0.625rem] font-semibold text-blue-700 shrink-0">
                          {getInitials(e.navn || "?")}
                        </div>
                        <span className="text-[0.8125rem] font-medium text-foreground">{e.navn || "Ukjent"}</span>
                        {addingKey === `ekstern-${e.id}` && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        )}
                        <ExternalConsultantOriginBadge
                          type={e.type}
                          partnerCompanyName={getExternalConsultantPartnerCompanyName(e)}
                        />
                      </div>
                      {e.teknologier?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1 ml-8">
                          {(e.teknologier as string[]).slice(0, 4).map((t: string) => (
                            <span key={t} className="inline-flex items-center rounded-full border border-border bg-muted px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">
                              {t}
                            </span>
                          ))}
                          {e.teknologier.length > 4 && (
                            <span className="text-[0.625rem] text-muted-foreground">+{e.teknologier.length - 4}</span>
                          )}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
      <Suspense fallback={null}>
        <ExternalConsultantModal
          open={createExternalOpen}
          onClose={() => setCreateExternalOpen(false)}
          editRow={null}
          onSaved={(consultant, mode) => {
            void handleExternalCreated(consultant, mode);
          }}
        />
      </Suspense>
    </Popover>
  );
}
