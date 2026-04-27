import { useState, useMemo, useRef, useEffect } from "react";
import { C } from "@/components/designlab/theme";
import finnIcon from "@/assets/finn-icon.webp";
import {
  DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS,
  DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS,
  DESIGN_LAB_NEUTRAL_TAG_INACTIVE_HOVER_COLORS,
  DesignLabActionButton,
  DesignLabFilterButton,
  DesignLabIconButton,
} from "@/components/designlab/controls";
import { AiSignalBanner } from "@/components/AiSignalBanner";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConsultantCache } from "@/hooks/useConsultantCache";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { differenceInDays, format, isPast, isToday, getYear, addDays, addWeeks, addMonths, addYears } from "date-fns";
import { nb } from "date-fns/locale";
import { scaleTextMetric, type TextSize } from "@/components/designlab/TextSizeControl";
import { fullDate } from "@/lib/relativeDate";
import { cleanDescription } from "@/lib/cleanDescription";
import { cn } from "@/lib/utils";
import {
  buildDescriptionWithCategory,
  CATEGORIES,
  getEffectiveSignal,
  normalizeCategoryLabel,
  parseDescriptionCategory,
  upsertTaskSignalDescription,
} from "@/lib/categoryUtils";
import {
  filterConsultantMatches,
  formatConsultantMatchFreshness,
  getConsultantMatchScoreColor,
  sortConsultantMatches,
} from "@/lib/consultantMatches";
import { hasConsultantAvailability, isActiveRequest } from "@/lib/contactHunt";
import { isEmployeeEndDatePassed } from "@/lib/employeeStatus";
import {
  buildContactCvSafeUpdates,
  CONTACT_CV_EMAIL_REQUIRED_MESSAGE,
  contactHasEmail,
  sanitizeContactCvEmail,
} from "@/lib/contactCvEligibility";
import {
  DesignLabCategoryBadge,
  DesignLabCategoryPicker,
  DesignLabSignalBadge,
  DesignLabReadonlyChip,
  DesignLabStatusBadge,
  DESIGN_LAB_STATUS_NEUTRAL_CHIP_ACTIVE_COLORS,
  getDesignLabCategoryChipActiveColors,
} from "@/components/designlab/system";
import { DesignLabEntitySheet } from "@/components/designlab/DesignLabEntitySheet";
import { ForespørselSheet } from "@/components/ForespørselSheet";
import { NyForesporselModal, type NyForesporselInitialContext } from "@/pages/Foresporsler";
import {
  DesignLabFieldGrid,
  DesignLabFieldLabel,
  DesignLabFieldStack,
  DesignLabTextField,
} from "@/components/designlab/system/fields";
import { mergeTechnologyTags } from "@/lib/technologyTags";
import { getActivityStatus, getHeatResult, getTaskStatus } from "@/lib/heatScore";
import { crmQueryKeys, crmSummaryQueryKeys, invalidateQueryGroup } from "@/lib/queryKeys";
import { coerceDisplayText, normalizeOutlookMailItems } from "@/lib/outlookMail";
import { getInitials } from "@/lib/utils";
import { useClickWithoutSelection, activateOnEnterOrSpace } from "@/hooks/useClickWithoutSelection";
import { useCrmNavigation } from "@/lib/crmNavigation";
import { useSentCvLiveSync } from "@/hooks/useSentCvLiveSync";
import { usePersistentState } from "@/hooks/usePersistentState";
import { isLikelySentCvAttachmentName } from "@/lib/sentCvMatching";
/* ── Helpers for storing/retrieving category in description ── */

/**
 * For legacy data: subject IS the category. For new data: subject is free-text title, category in description.
 */
function extractTitleAndCategory(subject: unknown, description: unknown) {
  const subjectText = coerceDisplayText(subject);
  const normalizedSubject = normalizeCategoryLabel(subjectText);
  // Strip bracket-only descriptions (e.g. "[Behov nå]")
  const stripBracketOnly = (d: unknown): string => {
    const text = coerceDisplayText(d);
    if (!text) return "";
    return /^\[.+\]$/.test(text.trim()) ? "" : text;
  };
  // Legacy: subject is a known category label
  if (CATEGORIES.some((c) => c.label === normalizedSubject)) {
    return { title: normalizedSubject, category: normalizedSubject, cleanDesc: "" };
  }
  // New format: category in description prefix
  const parsed = parseDescriptionCategory(description);
  return {
    title: subjectText,
    category: parsed.category,
    cleanDesc: cleanDescription(stripBracketOnly(parsed.text)) || "",
  };
}

function parseSafeDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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
  enableProfileEditMode?: boolean;
  startInProfileEditMode?: boolean;
  onOpenCompany?: (companyId: string) => void;
  onNavigateToFullPage?: () => void;
  defaultHidden?: DefaultHiddenConfig;
  onDataChanged?: () => void;
  headerPaddingTop?: number;
}

interface ConsultantMatchResult {
  id: number | string;
  navn: string;
  type?: "intern" | "ekstern";
  score: number;
  begrunnelse: string;
  match_tags: string[];
}

type ContactSentCvRow = {
  id: string;
  ansatt_id: number;
  sender_user_id: string | null;
  sender_email: string;
  recipient_email: string;
  attachment_name: string;
  sent_at: string;
  message_web_link: string | null;
  message_subject: string | null;
  message_preview: string | null;
  message_body_text: string | null;
};

type ContactSentCvEntry = ContactSentCvRow & {
  consultantName: string;
};

type ContactSentCvEmployeeRow = {
  id: number;
  navn: string;
  tilgjengelig_fra: string | null;
  slutt_dato: string | null;
};

const SECTION_TITLE_STYLE = { color: C.text };
const SECTION_COUNT_STYLE = { color: C.textFaint };
const CONTACT_FINN_CHIP_COLORS = {
  background: C.infoBg,
  color: C.info,
  border: "1px solid rgba(26,79,160,0.18)",
  fontWeight: 500,
};
const CONTACT_REQUEST_CHIP_COLORS = {
  background: C.successBg,
  color: C.success,
  border: "1px solid rgba(45,106,79,0.18)",
  fontWeight: 500,
};
const CONTACT_PREVIOUS_REQUEST_CHIP_COLORS = {
  background: C.statusNeutralBg,
  color: C.statusNeutral,
  border: `1px solid ${C.statusNeutralBorder}`,
  fontWeight: 500,
};
const CONTACT_NOTE_BADGE_STYLE = {
  background: C.warningBg,
  color: C.warning,
  border: "1px solid rgba(229, 160, 48, 0.24)",
};
const CONTACT_HEAT_CHIP_COLORS = {
  hett: {
    background: "rgba(208, 64, 69, 0.10)",
    color: "#8B1D20",
    border: "1px solid rgba(208, 64, 69, 0.28)",
    fontWeight: 500,
  },
  lovende: {
    background: "rgba(229, 160, 48, 0.12)",
    color: "#7D4E00",
    border: "1px solid rgba(229, 160, 48, 0.32)",
    fontWeight: 500,
  },
  mulig: {
    background: "rgba(26, 79, 160, 0.10)",
    color: "#1A4FA0",
    border: "1px solid rgba(26, 79, 160, 0.28)",
    fontWeight: 500,
  },
  sovende: {
    background: C.statusNeutralBg,
    color: C.statusNeutral,
    border: `1px solid ${C.statusNeutralBorder}`,
    fontWeight: 500,
  },
} as const;
const CONTACT_HEAT_DOT_COLORS = {
  hett: "#D04045",
  lovende: "#E5A030",
  mulig: "#1A4FA0",
  sovende: C.textGhost,
} as const;
const CONTACT_HEAT_LABELS = {
  hett: "Hett",
  lovende: "Lovende",
  mulig: "Mulig",
  sovende: "Sovende",
} as const;
const REQUEST_HISTORY_PIPELINE = {
  sendt_cv: { label: "Sendt CV", color: C.warning },
  intervju: { label: "Intervju", color: C.accent },
  vunnet: { label: "Vunnet", color: C.success },
  avslag: { label: "Avslag", color: C.danger },
  bortfalt: { label: "Bortfalt", color: C.textFaint },
} as const;

function getRequestDaysAgo(date: string): number {
  return differenceInDays(new Date(), new Date(date));
}

function getRequestRelativeTime(days: number): string {
  if (days === 0) return "I dag";
  if (days === 1) return "1d";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}u`;
  if (days < 365) return `${Math.floor(days / 30)}m`;
  return `${Math.floor(days / 365)}å`;
}

function getRequestReceivedParts(date: string) {
  return {
    dateLabel: format(new Date(date), "dd.MM.yyyy"),
    relativeLabel: getRequestRelativeTime(getRequestDaysAgo(date)),
  };
}

function getRequestVisibleTechnologies(tags: unknown): { visible: string[]; hiddenCount: number } {
  const normalized = Array.isArray(tags)
    ? tags
        .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
        .filter(Boolean)
    : [];

  const visible: string[] = [];
  let charBudget = 18;

  for (const tag of normalized) {
    const nextCost = tag.length + (visible.length > 0 ? 2 : 0);
    if (visible.length >= 2 || nextCost > charBudget) break;
    visible.push(tag);
    charBudget -= nextCost;
  }

  return { visible, hiddenCount: Math.max(0, normalized.length - visible.length) };
}

function splitSentCvThread(bodyText: string): { latest: string; rest: string | null } {
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
      if (splitIndex === -1 || match.index < splitIndex) splitIndex = match.index;
    }
  }
  if (splitIndex > 0) {
    return { latest: bodyText.slice(0, splitIndex).trim(), rest: bodyText.slice(splitIndex).trim() };
  }
  return { latest: bodyText.trim(), rest: null };
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

  const startEdit = () => setEditing(true);
  const clickHandlers = useClickWithoutSelection<HTMLSpanElement>(startEdit);

  return (
    <span
      role="button"
      tabIndex={0}
      onMouseDown={clickHandlers.onMouseDown}
      onClick={clickHandlers.onClick}
      onKeyDown={activateOnEnterOrSpace(startEdit)}
      className={cn(
        "group inline-flex items-center gap-1 hover:text-foreground/60 transition-colors cursor-text focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-sm",
        !value && "text-muted-foreground/40 italic",
        className,
      )}
    >
      <span>{value || placeholder || "—"}</span>
      <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
    </span>
  );
}

/** Wrapper that triggers `onEdit` on click but allows text selection / copy. */
function NotesEditTrigger({ onEdit, children }: { onEdit: () => void; children: React.ReactNode }) {
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

function ContactNoteBadge() {
  return (
    <span
      className="mr-2 inline-flex h-5 align-middle items-center gap-1 rounded-md px-1.5 text-[0.6875rem] font-medium leading-none"
      style={CONTACT_NOTE_BADGE_STYLE}
    >
      <StickyNote className="h-3 w-3" aria-hidden="true" />
      Notat
    </span>
  );
}

/** Wrapper for email row body — toggles expand on click but allows text selection. */
function EmailRowBody({ onToggle, children }: { onToggle: () => void; children: React.ReactNode }) {
  const handlers = useClickWithoutSelection<HTMLDivElement>(onToggle);
  return (
    <div
      role="button"
      tabIndex={0}
      onMouseDown={handlers.onMouseDown}
      onClick={handlers.onClick}
      onKeyDown={activateOnEnterOrSpace(onToggle)}
      className="min-w-0 cursor-pointer select-text focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-sm"
    >
      {children}
    </div>
  );
}

function ContactSentCvEmailBody({ entry }: { entry: ContactSentCvEntry }) {
  const [showThread, setShowThread] = useState(false);
  const bodyText = coerceDisplayText(entry.message_body_text);
  const preview = coerceDisplayText(entry.message_preview);
  const subject = coerceDisplayText(entry.message_subject) || "Uten emne";
  const { latest, rest } = useMemo(() => splitSentCvThread(bodyText), [bodyText]);
  const visibleBody = latest || preview;

  return (
    <div className="mt-3 rounded-lg border border-border bg-background px-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-[0.875rem] font-semibold text-foreground">{subject}</p>
        <p className="mt-0.5 break-all text-[0.75rem] text-muted-foreground">
          {entry.sender_email} → {entry.recipient_email}
        </p>
      </div>

      {visibleBody ? (
        <p className="mt-3 whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-foreground/80">
          {visibleBody}
        </p>
      ) : (
        <p className="mt-3 text-[0.8125rem] text-muted-foreground">
          Epostinnhold mangler. Kjør Sendt CV-sync på nytt for å fylle inn meldingen her.
        </p>
      )}

      {rest ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowThread((current) => !current)}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[0.75rem] text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showThread && "rotate-180")} />
            {showThread ? "Skjul hele tråden" : "Vis hele tråden"}
          </button>
          {showThread ? (
            <div className="mt-2 rounded-lg bg-muted/30 p-3">
              <p className="whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-muted-foreground">{rest}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ContactSentCvNotice({
  entries,
  profileMap,
}: {
  entries: ContactSentCvEntry[];
  profileMap: Record<string, string>;
}) {
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  if (entries.length === 0) return null;

  return (
    <div className="mb-5">
      <h3 className="mb-3 text-[13px] font-medium" style={SECTION_TITLE_STYLE}>CV sendt</h3>
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
        <div className="divide-y divide-primary/10">
          {entries.map((entry) => {
            const senderName =
              entry.sender_user_id
                ? profileMap[entry.sender_user_id] || entry.sender_email || "Ukjent avsender"
                : entry.sender_email || "Ukjent avsender";
            const hasMailDetails = Boolean(
              entry.message_subject ||
              entry.message_preview ||
              entry.message_body_text ||
              entry.message_web_link,
            );
            const isExpanded = expandedEntryId === entry.id;

            return (
              <div key={entry.id} className="py-2 first:pt-0 last:pb-0">
                <div className="grid gap-2 md:grid-cols-[minmax(0,1.35fr)_128px_minmax(0,1fr)_minmax(0,1.45fr)_48px] md:items-center">
                  <div className="min-w-0">
                    <p className="mb-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground md:hidden">
                      Konsulent
                    </p>
                    <p className="truncate text-[0.875rem] font-semibold text-foreground">{entry.consultantName}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="mb-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground md:hidden">
                      Sendt
                    </p>
                    <p className="truncate text-[0.8125rem] text-muted-foreground">
                      {format(new Date(entry.sent_at), "d. MMM yyyy HH:mm", { locale: nb })}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="mb-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground md:hidden">
                      Av CRM-bruker
                    </p>
                    <p className="truncate text-[0.8125rem] text-muted-foreground">{senderName}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="mb-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground md:hidden">
                      CV-fil
                    </p>
                    <p className="truncate text-[0.8125rem] text-muted-foreground">{entry.attachment_name}</p>
                  </div>
                  {hasMailDetails ? (
                    <button
                      type="button"
                      onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? "Skjul sendt CV-epost" : "Vis sendt CV-epost"}
                      title={isExpanded ? "Skjul epost" : "Vis epost"}
                      className="inline-flex h-8 w-fit items-center justify-center gap-1 rounded-md border border-primary/20 bg-background px-2 text-[0.75rem] text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground md:ml-auto"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")} />
                    </button>
                  ) : (
                    <span className="hidden text-right text-[0.75rem] text-muted-foreground md:block">–</span>
                  )}
                </div>

                {isExpanded ? <ContactSentCvEmailBody entry={entry} /> : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Wrapper for activity row body — opens edit on click but allows text selection. */
function ActivityRowBody({
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

const MODERN_CHECKBOX_CLASS =
  "h-4 w-4 rounded-[4px] border-[#DDE0E7] bg-white text-white " +
  "hover:border-[#C5CBE8] hover:bg-[#F8F9FB] " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8ECF5] focus-visible:outline-offset-2 " +
  "data-[state=checked]:border-transparent data-[state=checked]:bg-[#5E6AD2] data-[state=checked]:text-white";

const MODERN_CHECKBOX_LABEL_CLASS = "text-[12px] text-[#5C636E]";

const MODERN_CHECKBOX_ROW_CLASS =
  "flex w-fit items-center gap-1.5 cursor-pointer select-none rounded-[6px] px-2 py-1 transition-colors hover:bg-[#F8F9FB]";

export function ContactCardContent({
  contactId,
  editable = false,
  enableProfileEditMode = false,
  startInProfileEditMode = false,
  onOpenCompany,
  onNavigateToFullPage,
  defaultHidden,
  onDataChanged,
  headerPaddingTop = 0,
}: ContactCardContentProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { getCompanyPath, useModernRoutes } = useCrmNavigation();
  const { interne: cachedInterne, eksterne: cachedEksterne, isReady: consultantCacheReady } = useConsultantCache();

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
  const [consultantMatchMessage, setConsultantMatchMessage] = useState<string | null>(null);
  const [pendingConsultantMatch, setPendingConsultantMatch] = useState(false);
  const [showTechDna, setShowTechDna] = useState(!defaultHidden?.techDna);
  const [hasVisibleAiSuggestion, setHasVisibleAiSuggestion] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [showConsultantMatch, setShowConsultantMatch] = useState(!defaultHidden?.consultantMatch);
  const [profileEditMode, setProfileEditMode] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [createRequestOpen, setCreateRequestOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [contactActionMenuOpen, setContactActionMenuOpen] = useState(false);
  const [textSize] = usePersistentState<TextSize>("dl-text-size", "M");
  const notifyDataChanged = () => {
    onDataChanged?.();
  };

  const contactActionMenuMetrics = useMemo(
    () => ({
      triggerSize: Math.max(scaleTextMetric(32, textSize), 32),
      triggerIconSize: scaleTextMetric(15, textSize),
      triggerRadius: scaleTextMetric(8, textSize),
      menuMinWidth: scaleTextMetric(248, textSize),
      menuPadding: scaleTextMetric(6, textSize),
      labelFontSize: scaleTextMetric(10.5, textSize),
      labelPaddingX: scaleTextMetric(12, textSize),
      labelPaddingTop: scaleTextMetric(6, textSize),
      labelPaddingBottom: scaleTextMetric(4, textSize),
      itemMinHeight: scaleTextMetric(52, textSize),
      itemPaddingY: scaleTextMetric(10, textSize),
      itemRadius: scaleTextMetric(10, textSize),
      itemIconBoxSize: scaleTextMetric(28, textSize),
      itemIconSize: scaleTextMetric(14, textSize),
      itemTitleFontSize: scaleTextMetric(12, textSize),
      itemDescriptionFontSize: scaleTextMetric(10, textSize),
    }),
    [textSize],
  );

  const { data: contact, isLoading } = useQuery({
    queryKey: crmQueryKeys.contacts.detail(contactId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*, companies(id, name, city, status, ikke_relevant), profiles!contacts_owner_id_fkey(full_name)")
        .eq("id", contactId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });
  const companyId = ((contact?.companies as any)?.id as string | null | undefined) ?? null;

  const { data: companyTechProfile } = useQuery({
    queryKey: crmQueryKeys.companies.techProfile(companyId ?? "__none__"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_tech_profile")
        .select("sist_fra_finn")
        .eq("company_id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(companyId),
  });

  const { data: companyRequests = [] } = useQuery({
    queryKey: crmQueryKeys.companies.foresporslerTags(companyId ?? "__none__"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foresporsler")
        .select("mottatt_dato, status")
        .eq("selskap_id", companyId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(companyId),
  });

  const requestHistoryQuery = useQuery({
    queryKey: ["contact-card-request-history", contactId],
    enabled: showRequests && Boolean(contactId),
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foresporsler")
        .select(
          "*, contacts(id, first_name, last_name, title, email, phone), foresporsler_konsulenter(id, konsulent_type, status, status_updated_at, stacq_ansatte(id, navn), external_consultants(id, navn))",
        )
        .eq("kontakt_id", contactId)
        .order("mottatt_dato", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
  const requestHistoryRows = requestHistoryQuery.data ?? [];
  const isLoadingRequestHistory =
    requestHistoryQuery.fetchStatus === "fetching" && !requestHistoryQuery.isFetched;
  const requestHistoryError =
    requestHistoryQuery.error instanceof Error ? requestHistoryQuery.error.message : null;

  const requestHistoryHasInternalConsultants = useMemo(
    () =>
      (requestHistoryRows as any[]).some((row) =>
        (row.foresporsler_konsulenter || []).some(
          (consultant: any) => consultant.konsulent_type === "intern" && consultant.stacq_ansatte?.id,
        ),
      ),
    [requestHistoryRows],
  );

  const { data: requestHistoryPortraits = [] } = useQuery({
    queryKey: ["contact-card-request-portraits"],
    enabled: showRequests && requestHistoryHasInternalConsultants,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cv_documents")
        .select("ansatt_id, portrait_url")
        .not("portrait_url", "is", null);
      if (error) throw error;
      return data || [];
    },
  });

  const requestPortraitByAnsattId = useMemo(() => {
    const map = new Map<number, string>();
    (requestHistoryPortraits as any[]).forEach((item) => {
      if (item.ansatt_id && item.portrait_url) {
        map.set(item.ansatt_id, item.portrait_url);
      }
    });
    return map;
  }, [requestHistoryPortraits]);

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

  const sanitizedActivities = useMemo(
    () =>
      activities.map((activity: any, index: number) => ({
        ...activity,
        id: coerceDisplayText(activity?.id) || `activity-${index}`,
        created_at: coerceDisplayText(activity?.created_at),
        subject: coerceDisplayText(activity?.subject),
        description: coerceDisplayText(activity?.description) || null,
        type: coerceDisplayText(activity?.type),
        created_by: coerceDisplayText(activity?.created_by) || null,
      })),
    [activities],
  );

  const profileMap = Object.fromEntries(
    allProfiles
      .filter((p) => p?.id)
      .map((p) => {
        const fullName = typeof p.full_name === "string" ? p.full_name.trim() : "";
        return [p.id, fullName ? fullName.split(/\s+/)[0] : "Ukjent"];
      }),
  );
  const profileMapFull = Object.fromEntries(
    allProfiles
      .filter((p) => p?.id)
      .map((p) => [p.id, typeof p.full_name === "string" && p.full_name.trim() ? p.full_name.trim() : "Ukjent"]),
  );

  const { data: sentCvEntries = [] } = useQuery({
    queryKey: crmQueryKeys.sentCv.contact(contactId),
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("sent_cv_log")
        .select("id, ansatt_id, sender_user_id, sender_email, recipient_email, attachment_name, sent_at, message_web_link, message_subject, message_preview, message_body_text")
        .eq("contact_id", contactId)
        .order("sent_at", { ascending: false });
      if (error) throw error;

      const sentRows = ((rows || []) as ContactSentCvRow[]).filter((row) =>
        isLikelySentCvAttachmentName(row.attachment_name),
      );
      if (sentRows.length === 0) return [] as ContactSentCvEntry[];

      const employeeIds = Array.from(new Set(sentRows.map((row) => row.ansatt_id).filter(Boolean)));
      const { data: employees, error: employeesError } = employeeIds.length
        ? await supabase
            .from("stacq_ansatte")
            .select("id, navn, tilgjengelig_fra, slutt_dato")
            .in("id", employeeIds)
            .not("tilgjengelig_fra", "is", null)
        : { data: [], error: null };
      if (employeesError) throw employeesError;

      const availableEmployeeMap = new Map<number, ContactSentCvEmployeeRow>();
      ((employees || []) as ContactSentCvEmployeeRow[]).forEach((employee) => {
        if (
          hasConsultantAvailability(employee.tilgjengelig_fra) &&
          !isEmployeeEndDatePassed(employee.slutt_dato)
        ) {
          availableEmployeeMap.set(employee.id, employee);
        }
      });

      return sentRows
        .map((row) => {
          const employee = availableEmployeeMap.get(row.ansatt_id);
          if (!employee) return null;
          return {
            ...row,
            consultantName: employee.navn,
          } satisfies ContactSentCvEntry;
        })
        .filter((entry): entry is ContactSentCvEntry => Boolean(entry));
    },
    enabled: !!contactId,
  });

  const sentCvInvalidateKeys = useMemo(
    () => [crmQueryKeys.sentCv.contact(contactId)],
    [contactId],
  );

  useSentCvLiveSync({
    scopeKey: `contact:${contactId}`,
    enabled: !!contactId,
    invalidateQueryKeys: sentCvInvalidateKeys,
  });

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

  useEffect(() => {
    if (!contact) return;
    setShowNotes(Boolean(coerceDisplayText(contact.notes).trim()));
  }, [contactId, contact?.notes]);

  useEffect(() => {
    setShowRequests(false);
    setSelectedRequestId(null);
  }, [contactId]);

  useEffect(() => {
    setHasVisibleAiSuggestion(false);
  }, [contactId]);

  useEffect(() => {
    setConsultantResults(null);
    setMatchSourceFilter("Alle");
    setMatchUpdatedAt(null);
    setConsultantMatchMessage(null);
    setMatchingConsultants(false);
    setPendingConsultantMatch(false);
    setShowConsultantMatch(!defaultHidden?.consultantMatch);
  }, [contactId, defaultHidden?.consultantMatch]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const safeUpdates = buildContactCvSafeUpdates(contact as any, updates);
      const { error } = await supabase.from("contacts").update(safeUpdates as any).eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.contacts.detail(contactId) });
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.contacts.all() });
      notifyDataChanged();
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
      notifyDataChanged();
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
      notifyDataChanged();
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
      notifyDataChanged();
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
      notifyDataChanged();
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
      notifyDataChanged();
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
      notifyDataChanged();
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
      notifyDataChanged();
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
      notifyDataChanged();
      toast.success("Oppdatert");
    },
  });

  const runConsultantMatchNow = async () => {
    const teknologier = mergeTechnologyTags((contact as any).teknologier || []);
    if (!teknologier.length) {
      setPendingConsultantMatch(false);
      setConsultantResults([]);
      setConsultantMatchMessage("Kontaktens tekniske DNA er tomt ennå. Legg inn teknologier for å få match-treff.");
      setMatchUpdatedAt(null);
      setMatchingConsultants(false);
      toast("Kontaktens tekniske DNA er tomt ennå");
      return;
    }

    setPendingConsultantMatch(false);
    setMatchingConsultants(true);
    setConsultantMatchMessage(null);
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
      const sortedResults = sortConsultantMatches(Array.isArray(data) ? data : []);
      setConsultantResults(sortedResults);
      setConsultantMatchMessage(sortedResults.length === 0 ? "Ingen treff med score ≥ 4" : null);
      setMatchUpdatedAt(new Date().toISOString());
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke kjøre matching");
      setConsultantResults([]);
      setConsultantMatchMessage(err?.message || "Kunne ikke kjøre matching");
      setMatchUpdatedAt(null);
    } finally {
      setMatchingConsultants(false);
    }
  };

  const handleFinnKonsulent = async () => {
    if (matchingConsultants) return;

    const teknologier = mergeTechnologyTags((contact as any).teknologier || []);

    setShowConsultantMatch(true);
    setMatchSourceFilter("Alle");
    setConsultantResults(null);
    setMatchUpdatedAt(null);
    setConsultantMatchMessage(null);

    if (!teknologier.length) {
      await runConsultantMatchNow();
      return;
    }

    if (!consultantCacheReady) {
      setPendingConsultantMatch(true);
      setMatchingConsultants(true);
      return;
    }

    await runConsultantMatchNow();
  };

  useEffect(() => {
    if (!pendingConsultantMatch || !consultantCacheReady) return;
    void runConsultantMatchNow();
  }, [pendingConsultantMatch, consultantCacheReady, contactId]);

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

  const exitProfileEditMode = () => {
    setProfileEditMode(false);
    setChangingCompany(false);
    setCompanySearch("");
    setCompanyResults([]);
    setEditingNotes(false);
  };

  useEffect(() => {
    setProfileEditMode(startInProfileEditMode);
  }, [contactId, startInProfileEditMode]);

  const useProfileEditSheet = useModernRoutes && editable && enableProfileEditMode && !startInProfileEditMode;
  const openProfileEditor = () => {
    if (useProfileEditSheet) {
      setEditSheetOpen(true);
      return;
    }
    setProfileEditMode(true);
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
  const companyCity = (contact.companies as any)?.city as string | null;
  const companyStatus = (contact.companies as any)?.status as string | null;
  const contactTechnologies = mergeTechnologyTags((contact as any).teknologier || []);
  const companyLocations: string[] = companyCity
    ? companyCity
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean)
    : [];
  const createRequestInitialContext: NyForesporselInitialContext = {
    companyCity,
    companyId,
    companyName: companyName || null,
    companyStatus,
    contactId: contact.id,
    contactName: `${contact.first_name || ""} ${contact.last_name || ""}`.trim(),
  };
  const consultantMatchVisible = !defaultHidden?.consultantMatch || showConsultantMatch;
  const showConsultantMatchPane = consultantMatchVisible && (matchingConsultants || consultantResults !== null);
  const isPreparingConsultantMatch = pendingConsultantMatch && !consultantCacheReady;
  const showAvdeling = companyLocations.length > 1;
  const canEditProfile = editable && (!enableProfileEditMode || profileEditMode);
  const canToggleContactFlags = editable;
  const showProfileEditMenu = editable && enableProfileEditMode;
  const effectiveSignal = getEffectiveSignal(
    sanitizedActivities.map((a) => ({ created_at: a.created_at, subject: a.subject, description: a.description })),
    tasks.map((t) => ({
      created_at: t.created_at,
      title: t.title,
      description: t.description,
      due_date: t.due_date,
    })),
  );
  const signalCat = effectiveSignal ? CATEGORIES.find((c) => c.label === effectiveSignal) : null;
  const lastActivityAt = sanitizedActivities[0]?.created_at || null;
  const daysSinceLastContact = lastActivityAt ? differenceInDays(new Date(), new Date(lastActivityAt)) : 999;
  const hasMarkedsradar = Boolean(
    companyTechProfile?.sist_fra_finn && differenceInDays(new Date(), new Date(companyTechProfile.sist_fra_finn)) <= 90,
  );
  const hasAktivForespørsel = companyRequests.some((request) => isActiveRequest(request.mottatt_dato, request.status));
  const hasTidligereForespørsel =
    companyRequests.length > 0 && companyRequests.some((request) => !isActiveRequest(request.mottatt_dato, request.status));
  const taskStatus = getTaskStatus(tasks.map((task) => ({ due_date: task.due_date, status: task.status })));
  const activityStatus = getActivityStatus(daysSinceLastContact);
  const signalAct = sanitizedActivities.find((activity) => {
    const normalizedSubject = normalizeCategoryLabel(activity.subject || "");
    return CATEGORIES.some((category) => category.label === normalizedSubject);
  });
  const signalSetAt = signalAct ? new Date(signalAct.created_at) : null;
  const lastActivityDate = lastActivityAt ? new Date(lastActivityAt) : null;
  const kes = Boolean(signalSetAt && lastActivityDate && lastActivityDate > signalSetAt);
  const hasOverdueTask = tasks.some((task) => {
    const dueDate = parseSafeDate(task.due_date);
    return Boolean(dueDate && isPast(dueDate) && !isToday(dueDate));
  });
  const contactHeatResult = getHeatResult({
    signal: effectiveSignal || "",
    isInnkjoper: Boolean((contact as any).call_list),
    hasMarkedsradar,
    hasAktivForespørsel,
    hasOverdue: hasOverdueTask,
    daysSinceLastContact,
    hasTidligereForespørsel,
    ikkeAktuellKontakt: Boolean((contact as any).ikke_aktuell_kontakt),
    ikkeRelevantSelskap: Boolean((contact.companies as any)?.ikke_relevant),
    taskStatus,
    activityStatus,
    kes,
  });
  const selectedRequestRow = (requestHistoryRows as any[]).find((row) => row.id === selectedRequestId) ?? null;
  const shouldAnalyzeAiSignal = editable && sanitizedActivities.length > 0;
  const shouldHideTechDnaSection = Boolean(defaultHidden?.techDna && !showTechDna && !hasVisibleAiSuggestion);
  const shouldRenderTechDnaSection =
    !defaultHidden?.techDna || showTechDna || hasVisibleAiSuggestion || shouldAnalyzeAiSignal;
  const aiSignalActivities = sanitizedActivities
    .slice(0, 5)
    .map((activity) => ({ type: activity.type, subject: activity.subject, created_at: activity.created_at }));
  const lastTaskDueDate = tasks.length > 0 ? tasks[0]?.due_date || null : null;
  const handleAddAiTechnologies = async (techs: string[]) => {
    const existing = ((contact as any).teknologier as string[]) || [];
    const merged = [...new Set([...existing, ...techs])];
    await supabase
      .from("contacts")
      .update({ teknologier: merged })
      .eq("id", contactId);
    queryClient.invalidateQueries({ queryKey: crmQueryKeys.contacts.detail(contactId) });
  };
  const handleToggleCvEmail = () => {
    const isUnsubscribed =
      (contact as any).mailchimp_status === "unsubscribed" || (contact as any).mailchimp_status === "cleaned";
    if ((contact as any).cv_email && isUnsubscribed) {
      toast.info("Kontakten har avmeldt seg via Mailchimp og kan ikke re-abonneres.");
      return;
    }
    if (!(contact as any).cv_email && !contactHasEmail(contact as any)) {
      toast.error(CONTACT_CV_EMAIL_REQUIRED_MESSAGE);
      return;
    }
    const newVal = !(contact as any).cv_email;
    updateMutation.mutate(
      { cv_email: newVal },
      {
        onSuccess: () => {
          supabase.functions
            .invoke("mailchimp-sync", {
              body: { action: "sync-contact", contactId },
            })
            .then(({ data, error: mcErr }) => {
              if (mcErr) {
                console.error("Mailchimp sync feilet:", mcErr);
                toast.error("Mailchimp-synk feilet");
              } else {
                toast.success(`Mailchimp: ${data?.status || "synkronisert"}`);
              }
            });
        },
      },
    );
  };

  return (
    <div>
      {/* ── ZONE A: Contact Header ── */}
      <div className="mb-5" style={headerPaddingTop ? { paddingTop: headerPaddingTop } : undefined}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
              {canEditProfile ? (
                <h2 className="min-w-0 shrink text-[1.5rem] font-bold truncate">
                  <InlineField
                    value={`${contact.first_name} ${contact.last_name}`}
                    onSave={(v) => {
                      const parts = v.split(" ");
                      const first = parts[0] || "";
                      const last = parts.slice(1).join(" ") || "";
                      updateMutation.mutate({ first_name: first, last_name: last });
                    }}
                    className="text-[1.5rem] font-bold text-foreground"
                  />
                </h2>
              ) : (
                <h2 className="min-w-0 shrink text-[1.5rem] font-bold truncate">
                  {contact.first_name} {contact.last_name}
                </h2>
              )}
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                <span className="text-sm leading-none text-muted-foreground/70 select-none">|</span>
                <DesignLabReadonlyChip
                  active={true}
                  activeColors={CONTACT_HEAT_CHIP_COLORS[contactHeatResult.temperature]}
                >
                  <span
                    className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: CONTACT_HEAT_DOT_COLORS[contactHeatResult.temperature] }}
                  />
                  {CONTACT_HEAT_LABELS[contactHeatResult.temperature]}
                </DesignLabReadonlyChip>
                {hasMarkedsradar && (
                  <DesignLabReadonlyChip active={true} activeColors={CONTACT_FINN_CHIP_COLORS}>
                    <img
                      src={finnIcon}
                      alt="Finn"
                      className="mr-1.5 h-3 w-3 object-contain grayscale opacity-70"
                    />
                    Finn.no annonsering siste 90 dager
                  </DesignLabReadonlyChip>
                )}
                {hasAktivForespørsel ? (
                  <DesignLabReadonlyChip active={true} activeColors={CONTACT_REQUEST_CHIP_COLORS}>
                    Forespørsel siste 45 dager
                  </DesignLabReadonlyChip>
                ) : hasTidligereForespørsel ? (
                  <DesignLabReadonlyChip active={true} activeColors={CONTACT_PREVIOUS_REQUEST_CHIP_COLORS}>
                    Tidligere fått forespørsel
                  </DesignLabReadonlyChip>
                ) : null}
              </div>
            </div>
          </div>
          {/* Owner badge */}
          <div className="flex items-center gap-2 flex-shrink-0 sm:ml-auto">
            {showProfileEditMenu && profileEditMode && (
              <DesignLabActionButton variant="ghost" onClick={exitProfileEditMode}>
                Avslutt redigering
              </DesignLabActionButton>
            )}
            {/* Signal badge */}
            {canEditProfile ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <DesignLabFilterButton
                    active={Boolean(signalCat)}
                    className="whitespace-nowrap"
                    activeColors={signalCat ? getDesignLabCategoryChipActiveColors(signalCat.label) : undefined}
                  >
                    <span>{signalCat ? signalCat.label : "Legg til signal"}</span>
                    <ChevronDown className="h-3 w-3" />
                  </DesignLabFilterButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {CATEGORIES.map((cat) => (
                    <DropdownMenuItem
                      key={cat.label}
                      onClick={() => {
                        updateSignalMutation.mutate(cat.label);
                      }}
                    >
                      <DesignLabStatusBadge category={cat.label}>
                        {cat.label}
                      </DesignLabStatusBadge>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : signalCat ? (
              <DesignLabStatusBadge category={signalCat.label}>{signalCat.label}</DesignLabStatusBadge>
            ) : null}
            {canEditProfile ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <DesignLabFilterButton
                    active={Boolean(contact.owner_id)}
                    activeColors={DESIGN_LAB_STATUS_NEUTRAL_CHIP_ACTIVE_COLORS}
                    className="whitespace-nowrap"
                  >
                    <span>{contact.owner_id && profileMapFull[contact.owner_id] ? profileMapFull[contact.owner_id] : "Eier"}</span>
                    <ChevronDown className="h-3 w-3 flex-shrink-0" />
                  </DesignLabFilterButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {allProfiles.map((p) => (
                    <DropdownMenuItem key={p.id} onClick={() => updateMutation.mutate({ owner_id: p.id })}>
                      <DesignLabStatusBadge tone={p.id === contact.owner_id ? "signal" : "default"}>
                        {p.full_name}
                      </DesignLabStatusBadge>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : contact.owner_id && profileMapFull[contact.owner_id] ? (
              <DesignLabStatusBadge tone="signal">{profileMapFull[contact.owner_id]}</DesignLabStatusBadge>
            ) : null}
            {!editable && onNavigateToFullPage && (
              <DesignLabIconButton size={32} onClick={onNavigateToFullPage}>
                <ExternalLink className="h-3.5 w-3.5" />
              </DesignLabIconButton>
            )}
            {/* 3-dot menu for Design Lab */}
            {showProfileEditMenu && (
              <DropdownMenu modal={false} open={contactActionMenuOpen} onOpenChange={setContactActionMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <DesignLabIconButton
                    size={32}
                    aria-label="Flere handlinger"
                    title="Flere handlinger"
                    style={{
                      width: contactActionMenuMetrics.triggerSize,
                      minWidth: contactActionMenuMetrics.triggerSize,
                      height: contactActionMenuMetrics.triggerSize,
                      borderRadius: contactActionMenuMetrics.triggerRadius,
                      border: `1px solid ${contactActionMenuOpen ? C.borderFocus : C.borderDefault}`,
                      background: contactActionMenuOpen ? C.panel : "transparent",
                      color: contactActionMenuOpen ? C.textPrimary : C.textSecondary,
                      boxShadow: contactActionMenuOpen ? "0 8px 24px rgba(15,23,42,0.10)" : "none",
                    }}
                  >
                    <MoreVertical
                      style={{
                        width: contactActionMenuMetrics.triggerIconSize,
                        height: contactActionMenuMetrics.triggerIconSize,
                      }}
                    />
                  </DesignLabIconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className="rounded-[14px] border-[color:var(--dl-border-light)] bg-[color:var(--dl-surface)] shadow-[0_18px_48px_rgba(0,0,0,0.24)] backdrop-blur-[10px]"
                  style={{
                    minWidth: contactActionMenuMetrics.menuMinWidth,
                    padding: contactActionMenuMetrics.menuPadding,
                  }}
                >
                  <DropdownMenuLabel
                    className="font-semibold uppercase tracking-[0.12em] text-[color:var(--dl-text-faint)]"
                    style={{
                      fontSize: contactActionMenuMetrics.labelFontSize,
                      paddingLeft: contactActionMenuMetrics.labelPaddingX,
                      paddingRight: contactActionMenuMetrics.labelPaddingX,
                      paddingTop: contactActionMenuMetrics.labelPaddingTop,
                      paddingBottom: contactActionMenuMetrics.labelPaddingBottom,
                    }}
                  >
                    Profil
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    className="rounded-[10px] px-2.5"
                    style={{
                      height: "auto",
                      minHeight: contactActionMenuMetrics.itemMinHeight,
                      borderRadius: contactActionMenuMetrics.itemRadius,
                      alignItems: "flex-start",
                      paddingTop: contactActionMenuMetrics.itemPaddingY,
                      paddingBottom: contactActionMenuMetrics.itemPaddingY,
                    }}
                    onClick={() => {
                      if (!useProfileEditSheet && profileEditMode) exitProfileEditMode();
                      else openProfileEditor();
                    }}
                  >
                    <span
                      className="mt-0.5 flex shrink-0 items-center justify-center rounded-[8px] border border-[color:var(--dl-border-light)] bg-[color:var(--dl-surface-alt)] text-[color:var(--dl-text-muted)]"
                      style={{
                        width: contactActionMenuMetrics.itemIconBoxSize,
                        height: contactActionMenuMetrics.itemIconBoxSize,
                      }}
                    >
                      <Pencil
                        style={{
                          width: contactActionMenuMetrics.itemIconSize,
                          height: contactActionMenuMetrics.itemIconSize,
                        }}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate font-semibold text-[color:var(--dl-text)]"
                        style={{ fontSize: contactActionMenuMetrics.itemTitleFontSize }}
                      >
                        {!useProfileEditSheet && profileEditMode ? "Avslutt redigering" : "Rediger profil"}
                      </span>
                      <span
                        className="mt-0.5 block text-[color:var(--dl-text-muted)]"
                        style={{
                          fontSize: contactActionMenuMetrics.itemDescriptionFontSize,
                          lineHeight: 1.35,
                        }}
                      >
                        Oppdater kontaktinfo, eierskap og felter.
                      </span>
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="rounded-[10px] px-2.5"
                    disabled={!companyId}
                    style={{
                      height: "auto",
                      minHeight: contactActionMenuMetrics.itemMinHeight,
                      borderRadius: contactActionMenuMetrics.itemRadius,
                      alignItems: "flex-start",
                      paddingTop: contactActionMenuMetrics.itemPaddingY,
                      paddingBottom: contactActionMenuMetrics.itemPaddingY,
                    }}
                    onClick={() => {
                      if (!companyId) {
                        toast.error("Kontakten må være koblet til et selskap for å opprette forespørsel");
                        return;
                      }
                      setCreateRequestOpen(true);
                    }}
                  >
                    <span
                      className="mt-0.5 flex shrink-0 items-center justify-center rounded-[8px] border border-[color:var(--dl-border-light)] bg-[color:var(--dl-surface-alt)] text-[color:var(--dl-text-muted)]"
                      style={{
                        width: contactActionMenuMetrics.itemIconBoxSize,
                        height: contactActionMenuMetrics.itemIconBoxSize,
                      }}
                    >
                      <Plus
                        style={{
                          width: contactActionMenuMetrics.itemIconSize,
                          height: contactActionMenuMetrics.itemIconSize,
                        }}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate font-semibold text-[color:var(--dl-text)]"
                        style={{ fontSize: contactActionMenuMetrics.itemTitleFontSize }}
                      >
                        Opprett forespørsel
                      </span>
                      <span
                        className="mt-0.5 block text-[color:var(--dl-text-muted)]"
                        style={{
                          fontSize: contactActionMenuMetrics.itemDescriptionFontSize,
                          lineHeight: 1.35,
                        }}
                      >
                        {companyId
                          ? "Start en ny forespørsel med kontakt og selskap fylt inn."
                          : "Krever at kontakten er koblet til et selskap."}
                      </span>
                    </span>
                  </DropdownMenuItem>
                  {defaultHidden && (
                    <>
                      <DropdownMenuSeparator className="my-2 bg-[color:var(--dl-border-light)]" />
                      <DropdownMenuLabel
                        className="font-semibold uppercase tracking-[0.12em] text-[color:var(--dl-text-faint)]"
                        style={{
                          fontSize: contactActionMenuMetrics.labelFontSize,
                          paddingLeft: contactActionMenuMetrics.labelPaddingX,
                          paddingRight: contactActionMenuMetrics.labelPaddingX,
                          paddingTop: contactActionMenuMetrics.labelPaddingTop,
                          paddingBottom: contactActionMenuMetrics.labelPaddingBottom,
                        }}
                      >
                        Visning og verktøy
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        className="rounded-[10px] px-2.5"
                        style={{
                          height: "auto",
                          minHeight: contactActionMenuMetrics.itemMinHeight,
                          borderRadius: contactActionMenuMetrics.itemRadius,
                          alignItems: "flex-start",
                          paddingTop: contactActionMenuMetrics.itemPaddingY,
                          paddingBottom: contactActionMenuMetrics.itemPaddingY,
                        }}
                        onClick={() => {
                          void handleFinnKonsulent();
                        }}
                      >
                        <span
                          className="mt-0.5 flex shrink-0 items-center justify-center rounded-[8px] border border-[color:var(--dl-border-light)] bg-[color:var(--dl-surface-alt)] text-[color:var(--dl-text-muted)]"
                          style={{
                            width: contactActionMenuMetrics.itemIconBoxSize,
                            height: contactActionMenuMetrics.itemIconBoxSize,
                          }}
                        >
                          <Target
                            style={{
                              width: contactActionMenuMetrics.itemIconSize,
                              height: contactActionMenuMetrics.itemIconSize,
                            }}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className="block truncate font-semibold text-[color:var(--dl-text)]"
                            style={{ fontSize: contactActionMenuMetrics.itemTitleFontSize }}
                          >
                            Finn konsulent match
                          </span>
                          <span
                            className="mt-0.5 block text-[color:var(--dl-text-muted)]"
                            style={{
                              fontSize: contactActionMenuMetrics.itemDescriptionFontSize,
                              lineHeight: 1.35,
                            }}
                          >
                            Kjør match mot tilgjengelige konsulenter.
                          </span>
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="rounded-[10px] px-2.5"
                        style={{
                          height: "auto",
                          minHeight: contactActionMenuMetrics.itemMinHeight,
                          borderRadius: contactActionMenuMetrics.itemRadius,
                          alignItems: "flex-start",
                          paddingTop: contactActionMenuMetrics.itemPaddingY,
                          paddingBottom: contactActionMenuMetrics.itemPaddingY,
                        }}
                        onClick={() => {
                          setShowRequests((prev) => !prev);
                          if (showRequests) setSelectedRequestId(null);
                        }}
                      >
                        <span
                          className="mt-0.5 flex shrink-0 items-center justify-center rounded-[8px] border border-[color:var(--dl-border-light)] bg-[color:var(--dl-surface-alt)] text-[color:var(--dl-text-muted)]"
                          style={{
                            width: contactActionMenuMetrics.itemIconBoxSize,
                            height: contactActionMenuMetrics.itemIconBoxSize,
                          }}
                        >
                          <FileText
                            style={{
                              width: contactActionMenuMetrics.itemIconSize,
                              height: contactActionMenuMetrics.itemIconSize,
                            }}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className="block truncate font-semibold text-[color:var(--dl-text)]"
                            style={{ fontSize: contactActionMenuMetrics.itemTitleFontSize }}
                          >
                            {showRequests ? "Skjul forespørsler" : "Vis forespørsler"}
                          </span>
                          <span
                            className="mt-0.5 block text-[color:var(--dl-text-muted)]"
                            style={{
                              fontSize: contactActionMenuMetrics.itemDescriptionFontSize,
                              lineHeight: 1.35,
                            }}
                          >
                            {showRequests
                              ? "Skjul listen over tidligere forespørsler."
                              : "Vis forespørsler som er koblet til kontakten."}
                          </span>
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="rounded-[10px] px-2.5"
                        style={{
                          height: "auto",
                          minHeight: contactActionMenuMetrics.itemMinHeight,
                          borderRadius: contactActionMenuMetrics.itemRadius,
                          alignItems: "flex-start",
                          paddingTop: contactActionMenuMetrics.itemPaddingY,
                          paddingBottom: contactActionMenuMetrics.itemPaddingY,
                        }}
                        onClick={() => {
                          setShowNotes((prev) => !prev);
                          if (!showNotes && !contact.notes) {
                            setNotesDraft("");
                            setTimeout(() => setEditingNotes(true), 50);
                          }
                        }}
                      >
                        <span
                          className="mt-0.5 flex shrink-0 items-center justify-center rounded-[8px] border border-[color:var(--dl-border-light)] bg-[color:var(--dl-surface-alt)] text-[color:var(--dl-text-muted)]"
                          style={{
                            width: contactActionMenuMetrics.itemIconBoxSize,
                            height: contactActionMenuMetrics.itemIconBoxSize,
                          }}
                        >
                          <StickyNote
                            style={{
                              width: contactActionMenuMetrics.itemIconSize,
                              height: contactActionMenuMetrics.itemIconSize,
                            }}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className="block truncate font-semibold text-[color:var(--dl-text)]"
                            style={{ fontSize: contactActionMenuMetrics.itemTitleFontSize }}
                          >
                            {showNotes ? "Skjul notat" : contact.notes ? "Vis notat" : "Legg til notat"}
                          </span>
                          <span
                            className="mt-0.5 block text-[color:var(--dl-text-muted)]"
                            style={{
                              fontSize: contactActionMenuMetrics.itemDescriptionFontSize,
                              lineHeight: 1.35,
                            }}
                          >
                            {contact.notes
                              ? "Åpne eller skjul interne notater på kontaktkortet."
                              : "Opprett et nytt notat direkte på kontakten."}
                          </span>
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="rounded-[10px] px-2.5"
                        style={{
                          height: "auto",
                          minHeight: contactActionMenuMetrics.itemMinHeight,
                          borderRadius: contactActionMenuMetrics.itemRadius,
                          alignItems: "flex-start",
                          paddingTop: contactActionMenuMetrics.itemPaddingY,
                          paddingBottom: contactActionMenuMetrics.itemPaddingY,
                        }}
                        onClick={() => setShowTechDna((prev) => !prev)}
                      >
                        <span
                          className="mt-0.5 flex shrink-0 items-center justify-center rounded-[8px] border border-[color:var(--dl-border-light)] bg-[color:var(--dl-surface-alt)] text-[color:var(--dl-text-muted)]"
                          style={{
                            width: contactActionMenuMetrics.itemIconBoxSize,
                            height: contactActionMenuMetrics.itemIconBoxSize,
                          }}
                        >
                          {showTechDna ? (
                            <EyeOff
                              style={{
                                width: contactActionMenuMetrics.itemIconSize,
                                height: contactActionMenuMetrics.itemIconSize,
                              }}
                            />
                          ) : (
                            <Eye
                              style={{
                                width: contactActionMenuMetrics.itemIconSize,
                                height: contactActionMenuMetrics.itemIconSize,
                              }}
                            />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className="block truncate font-semibold text-[color:var(--dl-text)]"
                            style={{ fontSize: contactActionMenuMetrics.itemTitleFontSize }}
                          >
                            {showTechDna ? "Skjul tech stack" : "Vis tech stack"}
                          </span>
                          <span
                            className="mt-0.5 block text-[color:var(--dl-text-muted)]"
                            style={{
                              fontSize: contactActionMenuMetrics.itemDescriptionFontSize,
                              lineHeight: 1.35,
                            }}
                          >
                            {showTechDna
                              ? "Skjul teknologier og identifiserte behov."
                              : "Vis teknologier og identifiserte behov."}
                          </span>
                        </span>
                      </DropdownMenuItem>
                    </>
                  )}
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
                onClick={() => (onOpenCompany ? onOpenCompany(companyId) : navigate(getCompanyPath(companyId)))}
              >
                {companyName}
              </button>
              {canEditProfile && (
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
          {!companyName && canEditProfile && (
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
            if (!canEditProfile && defaultHidden?.locationsIfEmpty && contactLocations.length === 0) return null;
            const visibleLocations = canEditProfile
              ? companyLocations
              : defaultHidden
              ? companyLocations.filter((loc) => contactLocations.includes(loc))
              : companyLocations;
            if (visibleLocations.length === 0) return null;
            return (
              <>
                <div className="inline-flex items-center gap-1 flex-wrap">
                  <MapPin className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                  {visibleLocations.map((loc) => {
                    const isSelected = contactLocations.includes(loc);
                    return canEditProfile ? (
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
                    ) : (
                      <span
                        key={loc}
                        className={cn(
                          "text-[0.8125rem] px-1.5 py-0 rounded",
                          isSelected ? "text-foreground font-medium" : "text-muted-foreground/60",
                        )}
                      >
                        {loc}
                      </span>
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
          {(showAvdeling || canEditProfile) && !(defaultHidden && !(contact as any).department && !canEditProfile) && (
            <>
              <span className="text-muted-foreground/40">·</span>
              {canEditProfile ? (
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
          {(contact.title || canEditProfile) && (
            <>
              <span className="text-muted-foreground/40">·</span>
              {canEditProfile ? (
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
              {canEditProfile ? (
                <InlineField value={contact.phone} onSave={updateField("phone")} className="text-[0.8125rem]" />
              ) : (
                contact.phone
              )}
            </a>
          ) : canEditProfile ? (
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
              {canEditProfile ? (
                <InlineField value={contact.email} onSave={updateField("email")} className="text-[0.8125rem]" />
              ) : (
                contact.email
              )}
            </a>
          ) : canEditProfile ? (
            <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              <Mail className="h-3.5 w-3.5" />
              <InlineField value="" onSave={updateField("email")} placeholder="E-post" className="text-[0.8125rem]" />
            </span>
          ) : null}
          {contact.linkedin && !canEditProfile ? (
            <a
              href={contact.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Linkedin className="h-3.5 w-3.5" />
              LinkedIn
            </a>
          ) : canEditProfile ? (
            <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              <Linkedin className="h-3.5 w-3.5" />
              <InlineField
                value={contact.linkedin || ""}
                onSave={updateField("linkedin")}
                placeholder="LinkedIn"
                className="text-[0.8125rem]"
              />
            </span>
          ) : editable && !(defaultHidden?.linkedinIfEmpty) ? null : null}
        </div>
        {/* Status-piller */}
        <div className="flex items-center gap-2 flex-wrap mt-2 pt-2 border-t border-border/40">
          {/* CV-Epost */}
          {canToggleContactFlags ? (
            <DesignLabFilterButton
              onClick={handleToggleCvEmail}
              active={(contact as any).cv_email && !((contact as any).mailchimp_status === "unsubscribed" || (contact as any).mailchimp_status === "cleaned")}
              activeColors={DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS}
              inactiveColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}
              inactiveHoverColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_HOVER_COLORS}
              style={((contact as any).cv_email && ((contact as any).mailchimp_status === "unsubscribed" || (contact as any).mailchimp_status === "cleaned"))
                ? { color: C.textFaint }
                : undefined}
            >
              {(contact as any).cv_email && ((contact as any).mailchimp_status === "unsubscribed" || (contact as any).mailchimp_status === "cleaned")
                ? "CV-Epost ✗"
                : (contact as any).cv_email ? "✓ CV-Epost" : "CV-Epost"}
            </DesignLabFilterButton>
          ) : (
            <DesignLabReadonlyChip
              active={Boolean((contact as any).cv_email && !((contact as any).mailchimp_status === "unsubscribed" || (contact as any).mailchimp_status === "cleaned"))}
              activeColors={DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS}
            >
              {(contact as any).cv_email && ((contact as any).mailchimp_status === "unsubscribed" || (contact as any).mailchimp_status === "cleaned")
                ? "CV-Epost ✗"
                : (contact as any).cv_email ? "✓ CV-Epost" : "CV-Epost"}
            </DesignLabReadonlyChip>
          )}
          {/* Innkjøper */}
          {canToggleContactFlags ? (
            <DesignLabFilterButton
              onClick={() => updateMutation.mutate({ call_list: !(contact as any).call_list })}
              active={Boolean((contact as any).call_list)}
              activeColors={DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS}
              inactiveColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}
              inactiveHoverColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_HOVER_COLORS}
            >
              {(contact as any).call_list ? "✓ Innkjøper" : "Innkjøper"}
            </DesignLabFilterButton>
          ) : (
            <DesignLabReadonlyChip
              active={Boolean((contact as any).call_list)}
              activeColors={DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS}
            >
              {(contact as any).call_list ? "✓ Innkjøper" : "Innkjøper"}
            </DesignLabReadonlyChip>
          )}
          {/* Ikke aktuell å kontakte */}
          {canToggleContactFlags ? (
            <DesignLabFilterButton
              onClick={() => updateMutation.mutate({ ikke_aktuell_kontakt: !(contact as any).ikke_aktuell_kontakt })}
              active={Boolean((contact as any).ikke_aktuell_kontakt)}
              activeColors={getDesignLabCategoryChipActiveColors("Ikke aktuelt")}
            >
              {(contact as any).ikke_aktuell_kontakt
                ? "✕ Ikke relevant person å kontakte igjen"
                : "Ikke relevant person å kontakte igjen"}
            </DesignLabFilterButton>
          ) : (
            <DesignLabReadonlyChip
              active={Boolean((contact as any).ikke_aktuell_kontakt)}
              activeColors={getDesignLabCategoryChipActiveColors("Ikke aktuelt")}
            >
              {(contact as any).ikke_aktuell_kontakt
                ? "✕ Ikke relevant person å kontakte igjen"
                : "Ikke relevant person å kontakte igjen"}
            </DesignLabReadonlyChip>
          )}
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

      <div className={cn("space-y-0", showConsultantMatchPane && "lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-6")}>
        <div className={cn(showConsultantMatchPane && "lg:min-w-0")}>
        {/* ── Notat ── */}
        {showNotes && (
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
                <DesignLabActionButton variant="ghost" style={{ height: 32, fontSize: 12 }} onClick={() => setEditingNotes(false)}>
                  Avbryt
                </DesignLabActionButton>
              </div>
            </div>
          ) : contact.notes ? (
            editable ? (
              <NotesEditTrigger
                onEdit={() => {
                  setNotesDraft(contact.notes || "");
                  setEditingNotes(true);
                }}
              >
                <p className="text-[0.8125rem] text-muted-foreground leading-relaxed whitespace-pre-wrap transition-colors group-hover:text-foreground/80">
                  <ContactNoteBadge />
                  {contact.notes}
                </p>
              </NotesEditTrigger>
            ) : (
              <div className="group relative">
                <p className="text-[0.8125rem] text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  <ContactNoteBadge />
                  {contact.notes}
                </p>
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

        <ContactSentCvNotice entries={sentCvEntries} profileMap={profileMapFull} />

        {showRequests && (
          <ContactRequestHistorySection
            rows={requestHistoryRows as any[]}
            isLoading={isLoadingRequestHistory}
            errorMessage={requestHistoryError}
            portraitByAnsattId={requestPortraitByAnsattId}
            onSelectRow={(row) => setSelectedRequestId(row.id)}
          />
        )}

        {/* ── Tekniske behov ── */}
        {shouldRenderTechDnaSection && (
        <div className={cn("mb-5", shouldHideTechDnaSection && "hidden")} aria-hidden={shouldHideTechDnaSection || undefined}>
          <div>
            <div className="flex items-center justify-between mb-3" style={{ minHeight: 32 }}>
              <h3 className="text-[13px] font-medium" style={SECTION_TITLE_STYLE}>
                Teknologier
              </h3>
              {!showConsultantMatchPane && (
                <DesignLabActionButton
                  onClick={handleFinnKonsulent}
                  variant="secondary"
                  style={{ height: 32, fontSize: 12 }}
                >
                  <Target className="h-3.5 w-3.5" /> Finn konsulent match
                </DesignLabActionButton>
              )}
            </div>

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
          {shouldAnalyzeAiSignal && (
            <AiSignalBanner
              contactId={contactId}
              contactName={`${contact.first_name} ${contact.last_name}`}
              contactEmail={contact.email || null}
              currentSignal={effectiveSignal}
              currentTechnologies={((contact as any).teknologier as string[]) || []}
              activities={aiSignalActivities}
              lastTaskDueDate={lastTaskDueDate}
              onUpdateSignal={(signal) => {
                updateSignalMutation.mutate(signal);
              }}
              onAddTechnologies={handleAddAiTechnologies}
              onVisibilityChange={setHasVisibleAiSuggestion}
              hideContent={shouldHideTechDnaSection}
            />
          )}
        </div>
        )}

        {/* ── Separator + Action Bar ── */}
        {editable && (
          <div className="border-t border-border pt-4 pb-6">
            <div className="flex items-center gap-2 flex-wrap">
              <DesignLabActionButton
                onClick={() => openForm("call")}
                variant="primary"
              >
                <MessageCircle className="h-[15px] w-[15px]" /> Logg samtale
              </DesignLabActionButton>
              <DesignLabActionButton
                onClick={() => openForm("meeting")}
                variant="primary"
              >
                <FileText className="h-[15px] w-[15px]" /> Logg møtereferat
              </DesignLabActionButton>
              <DesignLabActionButton
                onClick={() => openForm("task")}
                variant="ghost"
              >
                <Clock className="h-[15px] w-[15px] text-[hsl(var(--warning))]" /> Ny oppfølging
              </DesignLabActionButton>
              {!outlookStatus?.connected && (
                <DesignLabActionButton
                  onClick={handleConnectOutlook}
                  variant="secondary"
                  className="ml-auto"
                >
                  <Mail className="h-[15px] w-[15px]" /> Koble til Outlook
                </DesignLabActionButton>
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
                      <DesignLabFilterButton
                        type="button"
                        onClick={() => setFormTitle("Ringte, ikke svar")}
                      >
                        <PhoneOff className="h-3 w-3" /> Ringte, ikke svar
                      </DesignLabFilterButton>
                      <DesignLabFilterButton
                        type="button"
                        onClick={() => setFormTitle("Sendt LinkedIn melding")}
                      >
                        <Send className="h-3 w-3" /> Sendt LinkedIn melding
                      </DesignLabFilterButton>
                    </div>
                  )}
                </div>

                <div className="mb-3">
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5 block">
                    Kategori
                  </span>
                  <DesignLabCategoryPicker selected={formCategory} onSelect={setFormCategory} />
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
                        <DesignLabFilterButton
                          key={chip.label}
                          type="button"
                          active={selectedChipIdx === i}
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
                        >
                          {chip.label}
                        </DesignLabFilterButton>
                      ))}
                      <input
                        type="date"
                        value={formDate}
                        onChange={(e) => {
                          setFormDate(e.target.value);
                          setSelectedChipIdx(null);
                        }}
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
                    <label className={`${MODERN_CHECKBOX_ROW_CLASS} mt-2`}>
                      <Checkbox
                        checked={formEmailNotify}
                        onCheckedChange={(v) => setFormEmailNotify(!!v)}
                        className={MODERN_CHECKBOX_CLASS}
                      />
                      <span className={MODERN_CHECKBOX_LABEL_CLASS}>Epostvarsling ved forfall</span>
                    </label>
                    <label className={MODERN_CHECKBOX_ROW_CLASS}>
                      <Checkbox
                        checked={formCalendarSync}
                        onCheckedChange={(v) => setFormCalendarSync(!!v)}
                        className={MODERN_CHECKBOX_CLASS}
                      />
                      <span className={MODERN_CHECKBOX_LABEL_CLASS}>Legg til i Outlook-kalender</span>
                    </label>
                  </>
                )}

                <div className="flex items-center gap-2 mt-3">
                  <DesignLabActionButton
                    variant="primary"
                    disabled={
                      !formTitle.trim() ||
                      !formCategory ||
                      (activeForm === "task" && !formDate) ||
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
                  </DesignLabActionButton>
                  <DesignLabActionButton variant="ghost" onClick={closeForm}>
                    Avbryt
                  </DesignLabActionButton>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Oppfølginger ── */}
        {tasks.length > 0 && (
          <div className="bg-card border border-border rounded-lg shadow-card p-4 mb-6">
            <div className="flex items-center justify-between mb-3" style={{ minHeight: 32 }}>
              <h3 className="text-[13px] font-medium" style={SECTION_TITLE_STYLE}>
                Oppfølginger <span className="font-normal" style={SECTION_COUNT_STYLE}>· {tasks.length}</span>
              </h3>
            </div>
            <div className="space-y-px">
              {tasks.map((task) => {
                const dueDate = parseSafeDate(task.due_date);
                const overdue = Boolean(dueDate && isPast(dueDate) && !isToday(dueDate));
                const today = Boolean(dueDate && isToday(dueDate));
                return (
                  <TaskRow
                    key={task.id}
                    task={task}
                    overdue={overdue}
                    today={today}
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
        <div className="mt-5">
          <ActivityTimeline
            activities={sanitizedActivities}
            profileMap={profileMapFull}
            editable={editable}
            onDelete={(id) => deleteActivityMutation.mutate(id)}
            onUpdateActivity={(id, updates) => updateActivityMutation.mutate({ id, updates })}
            contactEmail={contact.email || undefined}
          />
        </div>
        </div>

        {showConsultantMatchPane && (
          <div className="mt-5 border-t border-border pt-5 lg:mt-0 lg:min-w-0 lg:border-t-0 lg:border-l lg:pl-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Target className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Konsulentmatch
                    </span>
                    {consultantMatchFreshness && (
                      <p className="text-[0.6875rem] text-muted-foreground normal-case tracking-normal">
                        {consultantMatchFreshness}
                      </p>
                    )}
                  </div>
                  {consultantResults && (
                    <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary/10 text-primary text-[0.6875rem] font-semibold shrink-0">
                      {consultantResults.length}
                    </span>
                  )}
                </div>
                {!matchingConsultants && (
                  <button
                    onClick={handleFinnKonsulent}
                    className="text-[0.75rem] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    Kjør på nytt
                  </button>
                )}
              </div>

              {matchingConsultants ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-lg border border-border bg-muted/30 p-3 animate-pulse">
                      <div className="h-4 bg-muted rounded w-2/3 mb-2" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  ))}
                  <p className="text-[0.8125rem] text-primary font-medium flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {isPreparingConsultantMatch ? "Laster kandidater..." : "Analyserer match..."}
                  </p>
                </div>
              ) : visibleConsultantResults.length === 0 ? (
                <p className="text-[0.8125rem] text-muted-foreground">
                  {consultantResults && consultantResults.length > 0
                    ? "Ingen treff for valgt filter"
                    : consultantMatchMessage || "Ingen treff med score ≥ 4"}
                </p>
              ) : (
                <div className="space-y-2">
                  {consultantResults && consultantResults.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      {(["Alle", "Ansatte", "Eksterne"] as const).map((chip) => {
                        const selected = matchSourceFilter === chip;
                        return (
                          <DesignLabFilterButton
                            key={chip}
                            onClick={() => setMatchSourceFilter(chip)}
                            active={selected}
                          >
                            {chip}
                          </DesignLabFilterButton>
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
          </div>
        )}
      </div>

      <DesignLabEntitySheet
        open={Boolean(selectedRequestRow)}
        onOpenChange={(open) => {
          if (!open) setSelectedRequestId(null);
        }}
        contentClassName="dl-v8-theme"
      >
        {selectedRequestRow ? (
          <ForespørselSheet
            row={selectedRequestRow}
            onClose={() => setSelectedRequestId(null)}
            onExpandChange={() => {}}
          />
        ) : null}
      </DesignLabEntitySheet>

      <NyForesporselModal
        open={createRequestOpen}
        onClose={() => setCreateRequestOpen(false)}
        initialContext={createRequestInitialContext}
      />

      <DesignLabEntitySheet
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        contentClassName="px-6 py-5 dl-v8-theme"
      >
        <ContactProfileEditor
          contact={contact}
          companyName={companyName}
          companyLocations={companyLocations}
          profiles={allProfiles}
          onCancel={() => setEditSheetOpen(false)}
          onSave={async (updates) => {
            await updateMutation.mutateAsync(updates);
            setEditSheetOpen(false);
          }}
          defaultHidden={defaultHidden}
        />
      </DesignLabEntitySheet>
    </div>
  );
}

function ContactRequestTypeChip({ type }: { type: string | null }) {
  const isDirect = type === "DIR" || type === "direktekunde";
  const isPartner = type === "VIA" || type === "via_partner";
  const label = isDirect ? "Direkte" : isPartner ? "Via" : "—";
  const color = isDirect ? C.accent : isPartner ? C.warning : C.textGhost;

  return (
    <span
      className="inline-flex items-center rounded-[6px]"
      style={{
        height: 28,
        fontSize: 12,
        fontWeight: 500,
        padding: "0 10px",
        background: `${color}10`,
        color,
        border: `1px solid ${color}20`,
      }}
    >
      {label}
    </span>
  );
}

function ContactRequestHistorySection({
  rows,
  isLoading,
  errorMessage,
  portraitByAnsattId,
  onSelectRow,
}: {
  rows: any[];
  isLoading: boolean;
  errorMessage?: string | null;
  portraitByAnsattId: Map<number, string>;
  onSelectRow: (row: any) => void;
}) {
  const cols =
    "minmax(170px,1.2fr) minmax(160px,1.15fr) 80px minmax(150px,1.1fr) minmax(170px,1.15fr) minmax(110px,0.8fr) 146px";

  return (
    <div className="bg-card border border-border rounded-lg shadow-card p-4 mb-5">
      <div className="flex items-center justify-between mb-3" style={{ minHeight: 32 }}>
        <h3 className="text-[13px] font-medium" style={SECTION_TITLE_STYLE}>
          Forespørsler <span className="font-normal" style={SECTION_COUNT_STYLE}>· {rows.length}</span>
        </h3>
      </div>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: C.textFaint, fontSize: 13 }}>
          Laster forespørsler…
        </div>
      ) : errorMessage ? (
        <div style={{ textAlign: "center", padding: "20px 0", color: C.textFaint, fontSize: 13 }}>
          Kunne ikke laste forespørsler
        </div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "20px 0", color: C.textFaint, fontSize: 13 }}>
          Ingen tidligere forespørsler
        </div>
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {rows.map((row) => {
              const consultants = row.foresporsler_konsulenter || [];
              const days = getRequestDaysAgo(row.mottatt_dato);
              const received = getRequestReceivedParts(row.mottatt_dato);
              const firstConsultant = consultants[0] || null;
              const consultantName = firstConsultant
                ? (firstConsultant.konsulent_type === "intern"
                    ? firstConsultant.stacq_ansatte?.navn
                    : firstConsultant.external_consultants?.navn) || "Ukjent"
                : null;
              const statusCfg = firstConsultant ? REQUEST_HISTORY_PIPELINE[firstConsultant.status as keyof typeof REQUEST_HISTORY_PIPELINE] : null;

              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onSelectRow(row)}
                  className="w-full rounded-lg border text-left transition-colors"
                  style={{ borderColor: C.borderLight, background: C.panel, padding: 14 }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.background = C.hoverBg;
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background = C.panel;
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate" style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                        {row.contacts ? `${row.contacts.first_name} ${row.contacts.last_name}`.trim() : "Ingen kontakt"}
                      </p>
                      <p className="truncate" style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                        {row.selskap_navn}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <ContactRequestTypeChip type={row.type} />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {getRequestVisibleTechnologies(row.teknologier).visible.map((tag) => (
                      <DesignLabReadonlyChip key={tag} active={false}>
                        {tag}
                      </DesignLabReadonlyChip>
                    ))}
                    {getRequestVisibleTechnologies(row.teknologier).hiddenCount > 0 ? (
                      <span style={{ fontSize: 11, color: C.textGhost }}>
                        +{getRequestVisibleTechnologies(row.teknologier).hiddenCount}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3" style={{ fontSize: 12, color: C.textFaint }}>
                    <div className="min-w-0">
                      {consultantName ? (
                        <span className="truncate block" style={{ color: C.text }}>
                          {consultantName}
                        </span>
                      ) : (
                        <span>Ingen konsulent lagt til</span>
                      )}
                      {statusCfg ? (
                        <span style={{ color: statusCfg.color }}>{statusCfg.label}</span>
                      ) : null}
                    </div>
                    <span
                      title={format(new Date(row.mottatt_dato), "d. MMM yyyy", { locale: nb })}
                      className="inline-grid items-center gap-x-2"
                      style={{
                        gridTemplateColumns: "auto auto",
                        color: days <= 7 ? C.text : days <= 21 ? C.warning : C.danger,
                        fontWeight: 500,
                      }}
                    >
                      <span>{received.dateLabel}</span>
                      <span style={{ minWidth: 24, textAlign: "right" }}>{received.relativeLabel}</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <div style={{ minWidth: 1060 }}>
              <div
                className="grid items-center px-4 pb-2"
                style={{ gridTemplateColumns: cols, borderBottom: `1px solid ${C.borderLight}` }}
              >
                {["Kontakt", "Selskap", "Type", "Teknologier", "Konsulent", "Status", "Mottatt"].map((label) => (
                  <span
                    key={label}
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: C.textMuted,
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>

              {rows.map((row) => {
                const days = getRequestDaysAgo(row.mottatt_dato);
                const received = getRequestReceivedParts(row.mottatt_dato);
                const contactName = row.contacts ? `${row.contacts.first_name} ${row.contacts.last_name}`.trim() : "";
                const consultants = row.foresporsler_konsulenter || [];
                const technologies = getRequestVisibleTechnologies(row.teknologier);

                return (
                  <div
                    key={row.id}
                    onClick={() => onSelectRow(row)}
                    className="grid items-start cursor-pointer"
                    style={{
                      gridTemplateColumns: cols,
                      minHeight: 38,
                      paddingLeft: 16,
                      paddingRight: 16,
                      paddingTop: 4,
                      paddingBottom: 4,
                      borderBottom: `1px solid ${C.borderLight}`,
                      transition: "background 80ms ease",
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = C.hoverBg;
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = "transparent";
                    }}
                  >
                    <div className="min-w-0 pr-4" style={{ paddingTop: 2 }}>
                      {contactName ? (
                        <span className="block truncate" style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                          {contactName}
                        </span>
                      ) : (
                        <span style={{ fontSize: 13, color: C.textGhost }}>—</span>
                      )}
                    </div>

                    <div className="min-w-0 pr-4" style={{ paddingTop: 2 }}>
                      <span className="block truncate" style={{ fontSize: 12, color: C.textMuted }}>
                        {row.selskap_navn}
                      </span>
                    </div>

                    <div style={{ paddingTop: 1 }}>
                      <ContactRequestTypeChip type={row.type} />
                    </div>

                    <div className="min-w-0 pr-4" style={{ overflow: "hidden" }}>
                      <div className="flex items-center gap-1.5 flex-nowrap" style={{ minWidth: 0, overflow: "hidden" }}>
                        {technologies.visible.map((tag) => (
                          <DesignLabReadonlyChip key={tag} active={false}>
                            {tag}
                          </DesignLabReadonlyChip>
                        ))}
                        {technologies.hiddenCount > 0 ? (
                          <span className="shrink-0" style={{ fontSize: 11, color: C.textGhost }}>
                            +{technologies.hiddenCount}
                          </span>
                        ) : null}
                        {technologies.visible.length === 0 && technologies.hiddenCount === 0 ? (
                          <span style={{ fontSize: 12, color: C.textGhost }}>—</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col items-start gap-2 pr-8 min-w-0" style={{ paddingTop: 2, overflow: "hidden" }}>
                      {consultants.length === 0 ? (
                        <div style={{ minHeight: 28, display: "flex", alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: C.textGhost }}>—</span>
                        </div>
                      ) : (
                        consultants.map((consultant: any) => {
                          const name =
                            (consultant.konsulent_type === "intern"
                              ? consultant.stacq_ansatte?.navn
                              : consultant.external_consultants?.navn) || "Ukjent";
                          const portrait =
                            consultant.konsulent_type === "intern" && consultant.stacq_ansatte?.id
                              ? portraitByAnsattId.get(consultant.stacq_ansatte.id) || null
                              : null;

                          return (
                            <div
                              key={consultant.id}
                              style={{ minHeight: 32, display: "flex", alignItems: "center", gap: 12, width: "100%", minWidth: 0 }}
                            >
                              {portrait ? (
                                <img
                                  src={portrait}
                                  alt={name}
                                  className="h-8 w-8 rounded-full border object-cover"
                                  style={{ borderColor: C.border, flexShrink: 0 }}
                                />
                              ) : (
                                <div
                                  className="flex h-8 w-8 items-center justify-center rounded-full"
                                  style={{
                                    flexShrink: 0,
                                    background: C.accentBg,
                                    color: C.accent,
                                    fontSize: 11,
                                    fontWeight: 700,
                                  }}
                                >
                                  {getInitials(name)}
                                </div>
                              )}
                              <span
                                className="truncate"
                                style={{ fontSize: 13, fontWeight: 500, color: C.text, lineHeight: 1.2, flex: "1 1 auto", minWidth: 0 }}
                              >
                                {name}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="flex flex-col items-start gap-2" style={{ paddingTop: 1 }}>
                      {consultants.length === 0 ? (
                        <div style={{ minHeight: 28, display: "flex", alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: C.textGhost }}>—</span>
                        </div>
                      ) : (
                        consultants.map((consultant: any) => {
                          const cfg =
                            REQUEST_HISTORY_PIPELINE[consultant.status as keyof typeof REQUEST_HISTORY_PIPELINE] ||
                            { label: "Ny", color: C.textFaint };

                          return (
                            <div key={consultant.id} style={{ minHeight: 32, display: "flex", alignItems: "center" }}>
                              <span
                                className="inline-flex items-center rounded-[6px]"
                                style={{
                                  height: 28,
                                  width: "fit-content",
                                  fontSize: 12,
                                  fontWeight: 500,
                                  padding: "0 10px",
                                  background: `${cfg.color}10`,
                                  color: cfg.color,
                                  border: `1px solid ${cfg.color}20`,
                                }}
                              >
                                {cfg.label}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="flex items-start justify-end" style={{ paddingTop: 2 }}>
                      <span
                        title={format(new Date(row.mottatt_dato), "d. MMM yyyy", { locale: nb })}
                        className="inline-grid items-center gap-x-3"
                        style={{
                          gridTemplateColumns: "84px 28px",
                          justifyItems: "end",
                          fontSize: 13,
                          fontWeight: 500,
                          color: days <= 7 ? C.text : days <= 21 ? C.warning : C.danger,
                          paddingTop: 2,
                        }}
                      >
                        <span>{received.dateLabel}</span>
                        <span>{received.relativeLabel}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ContactProfileEditor({
  contact,
  companyName,
  companyLocations,
  profiles,
  defaultHidden,
  onCancel,
  onSave,
}: {
  contact: any;
  companyName?: string | null;
  companyLocations: string[];
  profiles: Array<{ id: string; full_name: string }>;
  defaultHidden?: DefaultHiddenConfig;
  onCancel: () => void;
  onSave: (updates: Record<string, any>) => Promise<unknown>;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    title: "",
    department: "",
    email: "",
    phone: "",
    linkedin: "",
    owner_id: "",
    locations: [] as string[],
    cv_email: false,
    call_list: false,
    ikke_aktuell_kontakt: false,
    notes: "",
  });

  useEffect(() => {
    setForm({
      first_name: contact?.first_name || "",
      last_name: contact?.last_name || "",
      title: contact?.title || "",
      department: (contact as any)?.department || "",
      email: contact?.email || "",
      phone: contact?.phone || "",
      linkedin: contact?.linkedin || "",
      owner_id: contact?.owner_id || "",
      locations: Array.isArray((contact as any)?.locations) ? (contact as any).locations : [],
      cv_email: Boolean((contact as any)?.cv_email),
      call_list: Boolean((contact as any)?.call_list),
      ikke_aktuell_kontakt: Boolean((contact as any)?.ikke_aktuell_kontakt),
      notes: contact?.notes || "",
    });
  }, [contact]);

  const isUnsubscribed =
    (contact as any)?.mailchimp_status === "unsubscribed" || (contact as any)?.mailchimp_status === "cleaned";

  const setField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleLocation = (location: string) => {
    setForm((prev) => ({
      ...prev,
      locations: prev.locations.includes(location)
        ? prev.locations.filter((item) => item !== location)
        : [...prev.locations, location],
    }));
  };

  const toggleCvEmail = () => {
    if (!form.cv_email && !contactHasEmail({ email: form.email })) {
      toast.error(CONTACT_CV_EMAIL_REQUIRED_MESSAGE);
      return;
    }
    if (!form.cv_email && isUnsubscribed) {
      toast.info("Kontakten har avmeldt seg via Mailchimp og kan ikke re-abonneres.");
      return;
    }
    setField("cv_email", !form.cv_email);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error("Fornavn og etternavn må fylles ut");
      return;
    }
    if (form.cv_email && !contactHasEmail({ email: form.email })) {
      toast.error(CONTACT_CV_EMAIL_REQUIRED_MESSAGE);
      return;
    }

    setSaving(true);
    try {
      await onSave({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        title: form.title.trim() || null,
        department: form.department.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        linkedin: form.linkedin.trim() || null,
        owner_id: form.owner_id || null,
        locations: form.locations,
        cv_email: sanitizeContactCvEmail(form.email, form.cv_email),
        call_list: form.call_list,
        ikke_aktuell_kontakt: form.ikke_aktuell_kontakt,
        notes: form.notes.trim() || null,
      });
    } catch (error) {
      return;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-full min-w-0">
      <div className="mb-5">
        <h2 className="text-[1.125rem] font-bold text-foreground">Rediger profil</h2>
        <p className="mt-1 text-[0.8125rem] text-muted-foreground">
          {companyName ? companyName : "Kontakt"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-full min-w-0 space-y-4 overflow-x-hidden">
        <DesignLabFieldGrid>
          <DesignLabFieldStack>
            <DesignLabFieldLabel>Fornavn</DesignLabFieldLabel>
            <DesignLabTextField
              value={form.first_name}
              onChange={(e) => setField("first_name", e.target.value)}
              required
              className="h-10 rounded-lg"
            />
          </DesignLabFieldStack>
          <DesignLabFieldStack>
            <DesignLabFieldLabel>Etternavn</DesignLabFieldLabel>
            <DesignLabTextField
              value={form.last_name}
              onChange={(e) => setField("last_name", e.target.value)}
              required
              className="h-10 rounded-lg"
            />
          </DesignLabFieldStack>
        </DesignLabFieldGrid>

        <DesignLabFieldGrid>
          <DesignLabFieldStack>
            <DesignLabFieldLabel>Stilling</DesignLabFieldLabel>
            <DesignLabTextField
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              className="h-10 rounded-lg"
            />
          </DesignLabFieldStack>
          <DesignLabFieldStack>
            <DesignLabFieldLabel>Avdeling</DesignLabFieldLabel>
            <DesignLabTextField
              value={form.department}
              onChange={(e) => setField("department", e.target.value)}
              className="h-10 rounded-lg"
            />
          </DesignLabFieldStack>
        </DesignLabFieldGrid>

        <DesignLabFieldGrid>
          <DesignLabFieldStack>
            <DesignLabFieldLabel>E-post</DesignLabFieldLabel>
            <DesignLabTextField
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              className="h-10 rounded-lg"
            />
          </DesignLabFieldStack>
          <DesignLabFieldStack>
            <DesignLabFieldLabel>Telefon</DesignLabFieldLabel>
            <DesignLabTextField
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              className="h-10 rounded-lg"
            />
          </DesignLabFieldStack>
        </DesignLabFieldGrid>

        <DesignLabFieldStack>
          <DesignLabFieldLabel>LinkedIn</DesignLabFieldLabel>
          <DesignLabTextField
            value={form.linkedin}
            onChange={(e) => setField("linkedin", e.target.value)}
            placeholder="https://linkedin.com/in/..."
            className="h-10 rounded-lg"
          />
        </DesignLabFieldStack>

        {companyLocations.length > 0 && (
          <DesignLabFieldStack>
            <DesignLabFieldLabel>Geografisk sted</DesignLabFieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {companyLocations.map((location) => (
                <DesignLabFilterButton
                  key={location}
                  type="button"
                  onClick={() => toggleLocation(location)}
                  active={form.locations.includes(location)}
                  activeColors={DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS}
                  inactiveColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}
                  inactiveHoverColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_HOVER_COLORS}
                >
                  {location}
                </DesignLabFilterButton>
              ))}
            </div>
          </DesignLabFieldStack>
        )}

        <DesignLabFieldStack>
          <DesignLabFieldLabel>Eier</DesignLabFieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {profiles.map((profile) => (
              <DesignLabFilterButton
                key={profile.id}
                type="button"
                onClick={() => setField("owner_id", profile.id)}
                active={form.owner_id === profile.id}
              >
                {profile.full_name}
              </DesignLabFilterButton>
            ))}
          </div>
        </DesignLabFieldStack>

        <DesignLabFieldStack>
          <DesignLabFieldLabel>Egenskaper</DesignLabFieldLabel>
          <div className="flex flex-wrap gap-1.5">
            <DesignLabFilterButton
              type="button"
              onClick={toggleCvEmail}
              active={form.cv_email && !isUnsubscribed}
              activeColors={DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS}
              inactiveColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}
              inactiveHoverColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_HOVER_COLORS}
              style={form.cv_email && isUnsubscribed ? { color: C.textFaint } : undefined}
            >
              {form.cv_email && isUnsubscribed ? "CV-Epost ✗" : form.cv_email ? "✓ CV-Epost" : "CV-Epost"}
            </DesignLabFilterButton>
            <DesignLabFilterButton
              type="button"
              onClick={() => setField("call_list", !form.call_list)}
              active={form.call_list}
              activeColors={DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS}
              inactiveColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}
              inactiveHoverColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_HOVER_COLORS}
            >
              {form.call_list ? "✓ Innkjøper" : "Innkjøper"}
            </DesignLabFilterButton>
            <DesignLabFilterButton
              type="button"
              onClick={() => setField("ikke_aktuell_kontakt", !form.ikke_aktuell_kontakt)}
              active={form.ikke_aktuell_kontakt}
              activeColors={getDesignLabCategoryChipActiveColors("Ikke aktuelt")}
            >
              {form.ikke_aktuell_kontakt ? "✕ Ikke relevant person å kontakte igjen" : "Ikke relevant person å kontakte igjen"}
            </DesignLabFilterButton>
          </div>
        </DesignLabFieldStack>

        {!(defaultHidden?.notes && !form.notes) && (
          <DesignLabFieldStack>
            <DesignLabFieldLabel>Notat</DesignLabFieldLabel>
            <Textarea
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              rows={6}
              className="min-h-[140px] rounded-lg text-[0.875rem]"
            />
          </DesignLabFieldStack>
        )}

        <div className="mt-2 border-t border-border/80 pt-4">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="inline-flex h-10 min-w-[110px] items-center justify-center rounded-lg border border-input bg-background px-4 text-[0.8125rem] font-medium text-foreground transition-colors hover:bg-accent"
              onClick={onCancel}
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 min-w-[110px] items-center justify-center rounded-lg bg-primary px-4 text-[0.8125rem] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Lagrer..." : "Lagre"}
            </button>
          </div>
        </div>
      </form>
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
  const [editTitle, setEditTitle] = useState(coerceDisplayText(task.title));
  const [editCategory, setEditCategory] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const parsedDueDate = parseSafeDate(task.due_date);
  const [editDate, setEditDate] = useState(parsedDueDate ? format(parsedDueDate, "yyyy-MM-dd") : task.due_date || "");
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

  const taskRowClickHandlers = useClickWithoutSelection<HTMLDivElement>(handleRowClick);

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
          <DesignLabCategoryPicker selected={editCategory} onSelect={setEditCategory} />
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
              <DesignLabFilterButton
                key={chip.label}
                type="button"
                active={editChipIdx === i}
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
              >
                {chip.label}
              </DesignLabFilterButton>
            ))}
            <input
              type="date"
              value={editDate}
              onChange={(e) => {
                setEditDate(e.target.value);
                setEditChipIdx(null);
              }}
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
            {editDate === "someday" && (
              <p className="text-[0.75rem] text-muted-foreground mt-2">
                Ingen fast dato — legges i "Følg opp på sikt"-listen
              </p>
            )}
          </div>
        </div>
        <label className={MODERN_CHECKBOX_ROW_CLASS}>
          <Checkbox
            checked={editEmailNotify}
            onCheckedChange={(v) => setEditEmailNotify(!!v)}
            className={MODERN_CHECKBOX_CLASS}
          />
          <span className={MODERN_CHECKBOX_LABEL_CLASS}>Epostvarsling ved forfall</span>
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
          <DesignLabActionButton
            variant="primary"
            style={{ height: 32, fontSize: 12 }}
            disabled={!editTitle.trim() || !editCategory}
            onClick={handleSave}
          >
            Lagre
          </DesignLabActionButton>
          <DesignLabActionButton variant="ghost" style={{ height: 32, fontSize: 12 }} onClick={() => setEditing(false)}>
            Avbryt
          </DesignLabActionButton>
          <div className="ml-auto">
            {confirmDelete ? (
              <div className="flex items-center gap-2 text-[0.75rem] animate-in fade-in duration-150">
                <span className="text-destructive">Er du sikker?</span>
                <DesignLabActionButton
                  variant="secondary"
                  onClick={() => {
                    onDelete(task.id);
                    setConfirmDelete(false);
                  }}
                  style={{ height: 32, fontSize: 12, color: C.danger }}
                >
                  Ja, slett
                </DesignLabActionButton>
                <DesignLabActionButton variant="ghost" style={{ height: 32, fontSize: 12 }} onClick={() => setConfirmDelete(false)}>
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
    );
  }
  return (
    <div
      onMouseDown={taskRowClickHandlers.onMouseDown}
      onClick={taskRowClickHandlers.onClick}
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
          className="h-[18px] w-[18px] rounded border-[1.5px] border-muted-foreground/30 flex-shrink-0 mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[1.0625rem] font-bold text-foreground">{displayTitle}</div>
        {displayDesc && <p className="text-[0.875rem] text-foreground/70 truncate mt-0.5">{displayDesc}</p>}
        {task.assigned_to && profileMap[task.assigned_to] && (
          <div className="mt-1">
            <DesignLabStatusBadge tone="signal">
              {profileMap[task.assigned_to]}
            </DesignLabStatusBadge>
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
                {parsedDueDate ? format(parsedDueDate, "d. MMM yyyy", { locale: nb }) : "Ukjent dato"}
              </span>
            </TooltipTrigger>
            <TooltipContent>{parsedDueDate ? fullDate(task.due_date) : "Ukjent dato"}</TooltipContent>
          </Tooltip>
        ) : task.description?.includes("[someday]") || !task.due_date ? (
          <span className="text-[0.8125rem] font-medium text-muted-foreground italic">Følg opp på sikt</span>
        ) : null}
        {displayCategory && <DesignLabCategoryBadge label={displayCategory} />}
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
  const parseSafeDate = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  // Fetch Outlook emails for this contact
  const { data: outlookEmails = [] } = useQuery({
    queryKey: ["outlook-emails", contactEmail],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("outlook-mail", {
        body: { email: contactEmail, top: 30 },
      });
      if (error) throw error;
      if (data?.error === "no_outlook_connected") return [];
      return normalizeOutlookMailItems(data?.emails)
        .map((email) => {
          const createdAt = email.receivedAt;
          return {
            id: `outlook-${email.id}`,
            type: "email" as const,
            subject: email.subject,
            created_at: createdAt,
            from: email.from,
            from_name: email.fromName,
            to: email.to,
            preview: email.preview,
            body_text: email.bodyText,
            is_read: email.isRead,
          };
        })
        .filter((e: any) => parseSafeDate(e.created_at));
    },
    enabled: !!contactEmail,
    staleTime: 5 * 60 * 1000,
  });

  // Merge activities and emails, sorted by date descending
  const mergedItems = useMemo(() => {
    const activityItems = activities.map((a) => ({ ...a, _source: "activity" as const }));
    const emailItems = (outlookEmails || []).map((e: any) => ({ ...e, _source: "email" as const }));
    return [...activityItems, ...emailItems].sort(
      (a, b) => {
        const aTime = parseSafeDate(a.created_at)?.getTime() ?? 0;
        const bTime = parseSafeDate(b.created_at)?.getTime() ?? 0;
        return bTime - aTime;
      },
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
      const d = parseSafeDate(item.created_at);
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
      groups[groups.length - 1].items.push(item);
    }
    return groups;
  }, [filteredItems, currentYear]);

  const totalCount = filteredItems.length;
  const hasEmails = outlookEmails.length > 0;

  if (totalCount === 0) {
    return (
      <div>
        <div className="flex items-center justify-between" style={{ minHeight: 32 }}>
          <h3 className="text-[13px] font-medium" style={SECTION_TITLE_STYLE}>
            Aktiviteter <span className="font-normal" style={SECTION_COUNT_STYLE}>· 0</span>
          </h3>
          {hasEmails && (
            <DesignLabFilterButton
              onClick={() => setShowEmails((v) => !v)}
              active={showEmails}
              activeColors={DESIGN_LAB_STATUS_NEUTRAL_CHIP_ACTIVE_COLORS}
            >
              <Mail className="w-3.5 h-3.5" />
              {showEmails ? "Skjul e-post" : "Vis e-post"}
            </DesignLabFilterButton>
          )}
        </div>
        <p className="text-[0.8125rem] text-muted-foreground/60 py-2">Ingen aktiviteter ennå</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 mt-5" style={{ minHeight: 32 }}>
        <h3 className="text-[13px] font-medium" style={SECTION_TITLE_STYLE}>
          Aktiviteter <span className="font-normal" style={SECTION_COUNT_STYLE}>· {totalCount}</span>
        </h3>
        {hasEmails && (
          <DesignLabFilterButton
            onClick={() => setShowEmails((v) => !v)}
            active={showEmails}
            activeColors={DESIGN_LAB_STATUS_NEUTRAL_CHIP_ACTIVE_COLORS}
          >
            <Mail className="w-3.5 h-3.5" />
            {showEmails ? "Skjul e-post" : "Vis e-post"}
          </DesignLabFilterButton>
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
  const parsedDate = email.created_at ? new Date(email.created_at) : null;
  const hasValidDate = parsedDate && !Number.isNaN(parsedDate.getTime());
  const { latest, rest } = useMemo(() => splitEmailThread(email.body_text || ""), [email.body_text]);
  const fromLabel = coerceDisplayText(email.from_name || email.from) || "Ukjent avsender";
  const toLabel = coerceDisplayText(email.to) || "Ukjent mottaker";
  const subject = coerceDisplayText(email.subject) || "Uten emne";
  const preview = coerceDisplayText(email.preview);

  return (
    <div className="relative group">
      {/* Icon on spine */}
      <div className="absolute -left-7 top-[2px] w-[12px] h-[12px] flex items-center justify-center bg-background rounded-full">
        <Mail className="h-3.5 w-3.5 text-primary" />
      </div>

      <EmailRowBody onToggle={() => setExpanded(!expanded)}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[1.0625rem] font-bold text-foreground truncate">{subject}</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground transition-transform flex-shrink-0",
                  expanded && "rotate-180",
                )}
              />
            </div>
            <p className="text-[0.8125rem] text-muted-foreground mt-0.5">
              {fromLabel} → {toLabel}
            </p>

            {!expanded && preview ? (
              <p className="text-[0.9375rem] text-foreground/70 line-clamp-2 mt-0.5">{preview}</p>
            ) : null}
          </div>

          <div className="flex flex-col items-end gap-1 flex-shrink-0 mt-0.5">
            <span className="text-[0.8125rem] text-muted-foreground">
              {hasValidDate ? format(parsedDate, "d. MMM yyyy", { locale: nb }) : "Ukjent dato"}
            </span>
            <DesignLabStatusBadge tone="signal">
              E-post
            </DesignLabStatusBadge>
          </div>
        </div>
      </EmailRowBody>

      {expanded && (
        <div className="mt-2 border-t border-border pt-2 cursor-text select-text">
          <p className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-foreground/70">
            {latest}
          </p>
          {rest && (
            <>
              <DesignLabActionButton
                variant="ghost"
                style={{ marginTop: 8, height: 32, fontSize: 12 }}
                onClick={(e) => { e.stopPropagation(); setShowThread(!showThread); }}
              >
                {showThread ? "Skjul tråd ▴" : "Vis hele tråden ▾"}
              </DesignLabActionButton>
              {showThread && (
                <div className="mt-2 bg-muted/30 rounded-lg p-3 select-text">
                  <p className="text-[0.8125rem] leading-relaxed whitespace-pre-wrap text-muted-foreground">
                    {rest}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
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
  const [editTitle, setEditTitle] = useState(coerceDisplayText(activity.subject));
  const [editCategory, setEditCategory] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const parsedActivityDate = parseSafeDate(activity.created_at);
  const [editDate, setEditDate] = useState(parsedActivityDate ? format(parsedActivityDate, "yyyy-MM-dd") : "");
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    title: displayTitle,
    category: displayCategory,
    cleanDesc,
  } = extractTitleAndCategory(activity.subject, activity.description);
  const ownerName = activity.created_by ? profileMap[activity.created_by] : null;
  const d = parsedActivityDate;

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
    setEditDate(parsedActivityDate ? format(parsedActivityDate, "yyyy-MM-dd") : "");
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
              <DesignLabCategoryPicker selected={editCategory} onSelect={setEditCategory} />
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
                disabled={!editTitle.trim() || !editCategory}
                onClick={handleSaveEdit}
              >
                Lagre
              </DesignLabActionButton>
              <DesignLabActionButton variant="ghost" onClick={() => setEditing(false)}>
                Avbryt
              </DesignLabActionButton>
              <div className="ml-auto">
                {confirmDelete ? (
                  <div className="flex items-center gap-2 text-[0.75rem] animate-in fade-in duration-150">
                    <span className="text-destructive">Er du sikker?</span>
                    <DesignLabActionButton
                      variant="secondary"
                      onClick={() => {
                        onDelete(activity.id);
                        setConfirmDelete(false);
                      }}
                      style={{ height: 32, fontSize: 12, color: C.danger }}
                    >
                      Ja, slett
                    </DesignLabActionButton>
                    <DesignLabActionButton variant="ghost" style={{ height: 32, fontSize: 12 }} onClick={() => setConfirmDelete(false)}>
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
          <ActivityRowBody onActivate={handleRowClick} editable={editable}>
            <div className="flex-1 min-w-0">
              {/* Title */}
              <span className="text-[1.0625rem] font-bold text-foreground">{displayTitle}</span>

              {/* Delete confirmation */}
              {confirmDelete && (
                <div className="flex items-center gap-2 mt-1 text-[0.75rem] animate-in fade-in duration-150">
                  <span className="text-destructive">Slett denne aktiviteten?</span>
                  <DesignLabActionButton
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(activity.id);
                      setConfirmDelete(false);
                    }}
                    style={{ height: 32, fontSize: 12, color: C.danger }}
                  >
                    Ja, slett
                  </DesignLabActionButton>
                  <DesignLabActionButton
                    variant="ghost"
                    style={{ height: 32, fontSize: 12 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(false);
                    }}
                  >
                    Avbryt
                  </DesignLabActionButton>
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
                  <DesignLabStatusBadge tone="signal">
                    {ownerName}
                  </DesignLabStatusBadge>
                </div>
              )}
            </div>

            {/* Right side: Date + Category + Delete */}
            <div className="flex flex-col items-end gap-1 flex-shrink-0 mt-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[0.8125rem] text-muted-foreground">
                    {d ? format(d, "d. MMM yyyy", { locale: nb }) : "Ukjent dato"}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{d ? fullDate(activity.created_at) : "Ukjent dato"}</TooltipContent>
              </Tooltip>
              {displayCategory && <DesignLabCategoryBadge label={displayCategory} />}
            </div>
          </ActivityRowBody>
        )}
      </div>
    </div>
  );
}
