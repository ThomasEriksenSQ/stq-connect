import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import finnIcon from "@/assets/finn-icon.webp";
import { differenceInDays, format } from "date-fns";
import { nb } from "date-fns/locale";
import { getEffectiveSignal, normalizeCategoryLabel } from "@/lib/categoryUtils";
import { toast } from "sonner";
import {
  getConsultantAvailabilityMeta,
  hasConsultantAvailability,
  hasRecentActualActivity,
  isActiveRequest,
  isColdCallCandidate,
  isCustomerCompany,
  sortHuntConsultants,
  type HuntChipValue,
} from "@/lib/contactHunt";
import { useAuth } from "@/hooks/useAuth";
import { ContactCardContent } from "@/components/ContactCardContent";
import { RenderErrorBoundary } from "@/components/RenderErrorBoundary";
import { getDesignLabTextSizeStyle, type TextSize } from "@/components/designlab/TextSizeControl";
import { C } from "@/components/designlab/theme";
import { CommandPalette } from "@/components/designlab/CommandPalette";
import { usePersistentState } from "@/hooks/usePersistentState";
import { getHeatResult, getTaskStatus, getActivityStatus, type HeatResult } from "@/lib/heatScore";
import { DesignLabSidebar } from "@/components/designlab/DesignLabSidebar";
import { CONTACT_CV_EMAIL_REQUIRED_MESSAGE, contactHasEmail } from "@/lib/contactCvEligibility";
import { crmQueryKeys, crmSummaryQueryKeys, invalidateQueryGroup } from "@/lib/queryKeys";
import { relativeDate } from "@/lib/relativeDate";
import { mergeTechnologyTags } from "@/lib/technologyTags";
import {
  getContactMatchScore,
  getMatchBand,
  type ConfidenceBand,
  type MatchBand,
} from "@/lib/contactMatchScore";
import { getConsultantMatchScoreColor } from "@/lib/consultantMatches";
import {
  MATCH_OWNER_FILTER_NONE,
  buildMatchLeadOwnerCandidate,
  getMatchLeadOwnerLabel,
  matchesMatchLeadOwnerFilter,
  resolveMatchLeadOwner,
  type MatchLeadOwnerSource,
} from "@/lib/matchLeadOwners";
import {
  DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS,
  DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS,
  DESIGN_LAB_NEUTRAL_TAG_INACTIVE_HOVER_COLORS,
  DesignLabActionButton,
  DesignLabControlLabel,
  DesignLabFilterButton,
  DesignLabIconButton,
  DesignLabSearchInput,
} from "@/components/designlab/controls";
import {
  DesignLabColumnHeader,
  DesignLabFilterRow,
  DesignLabHeatBadge,
  DesignLabMatchFilterChip,
  DesignLabPrimaryAction,
  DesignLabSignalBadge,
} from "@/components/designlab/system";

/* ═══════════════════════════════════════════════════════════
   TYPES & CONSTANTS
   ═══════════════════════════════════════════════════════════ */

type Signal = "Behov nå" | "Får fremtidig behov" | "Får kanskje behov" | "Ukjent om behov" | "Ikke aktuelt";

const SIGNAL_ORDER: Record<Signal, number> = {
  "Behov nå": 0,
  "Får fremtidig behov": 1,
  "Får kanskje behov": 2,
  "Ukjent om behov": 3,
  "Ikke aktuelt": 4,
};

const SIGNALS: Signal[] = ["Behov nå", "Får fremtidig behov", "Får kanskje behov", "Ukjent om behov", "Ikke aktuelt"];
const TYPES = ["Alle", "Innkjøper", "CV-Epost", "Ikke relevant kontakt"] as const;
type TypeFilter = (typeof TYPES)[number];

type SortField = "name" | "signal" | "company" | "title" | "owner" | "last_activity" | "priority" | "tags" | "finn";
type SortDir = "asc" | "desc";
type HuntSortField = "default" | "match" | "varme";

type OwnerPreview = { id: string; full_name: string } | null;

type CompanyPreview = {
  id: string;
  name: string;
  status: string | null;
  ikke_relevant: boolean | null;
  owner_id: string | null;
  profiles: OwnerPreview;
};

type CompanyTechLeadRow = {
  companyId: string;
  company: CompanyPreview | null;
  companyTechnologyTags: string[];
  sistFraFinn: string | null;
};

type RequestLeadRow = {
  id: number;
  companyId: string | null;
  contactId: string | null;
  companyName: string;
  company: CompanyPreview | null;
  mottattDato: string;
  fristDato: string | null;
  sted: string | null;
  status: string | null;
  technologyTags: string[];
  contactName: string | null;
  contactTitle: string | null;
};

type NormalizedContact = {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  phone: string;
  linkedin: string;
  location: string;
  locations: string[];
  department: string;
  notes: string;
  company: string;
  companyId: string | null;
  companyPreview: CompanyPreview | null;
  signal: Signal | "";
  eier: string;
  eierId: string | null;
  ownerProfile: OwnerPreview;
  cvEmail: boolean | null;
  callList: boolean | null;
  mailchimpStatus: string | null;
  ikkeAktuell: boolean;
  teknologier: string[];
  daysSince: number;
  lastActivityAt: string | null;
  lastActivitySubject: string;
  activities: any[];
  tasks: any[];
  openTasks: { count: number; overdue: boolean };
  heatResult: HeatResult;
  heatScore: number;
  temperature: "hett" | "lovende" | "mulig" | "sovende";
  tier: 1 | 2 | 3 | 4;
  needsReview: boolean;
  hasMarkedsradar: boolean;
  hasAktivForespørsel: boolean;
  hasTidligereForespørsel: boolean;
  companyStatus: string | null;
  contactTechnologyTags: string[];
  companyTechnologyTags: string[];
  requestTechnologyTags: string[];
};

type HuntConsultant = {
  id: number;
  navn: string;
  status: string | null;
  tilgjengelig_fra: string | null;
  kompetanse: string[] | null;
};

type MatchLeadBase = {
  leadKey: string;
  leadType: "contact" | "company" | "request";
  companyId: string | null;
  companyName: string;
  matchScore10: number;
  matchBand: MatchBand | null;
  confidenceScore: number;
  confidenceBand: ConfidenceBand;
  matchSources: HuntChipValue[];
  matchTags: string[];
  sourceDates: string[];
  chipUrgency: number;
  summary: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerSource: MatchLeadOwnerSource;
};

type ContactMatchLead = NormalizedContact & MatchLeadBase & {
  leadType: "contact";
  name: string;
};

type CompanyMatchLead = MatchLeadBase & {
  leadType: "company";
  companyId: string;
  name: string;
  status: string | null;
  companyTechnologyTags: string[];
  preferredContactName?: string | null;
  preferredContactTitle?: string | null;
};

type RequestMatchLead = MatchLeadBase & {
  leadType: "request";
  name: string;
  requestId: number;
  requestStatus: string | null;
  requestTechnologyTags: string[];
  fristDato: string | null;
  sted: string | null;
  contactId: string | null;
  contactName: string | null;
  contactTitle: string | null;
  tier?: 1 | 2 | 3 | 4;
  heatScore?: number;
  temperature?: "hett" | "lovende" | "mulig" | "sovende";
  needsReview?: boolean;
  signal?: string | null;
};

type MatchLead = ContactMatchLead | CompanyMatchLead | RequestMatchLead;

const JAKT_CHIPS: Array<{ value: HuntChipValue; label: string }> = [
  { value: "alle", label: "Alle" },
  { value: "foresporsler", label: "Forespørsler" },
  { value: "finn", label: "Finn-match" },
  { value: "siste_aktivitet", label: "Siste aktivitet" },
  { value: "innkjoper", label: "Innkjøper" },
  { value: "kunder", label: "Kunder" },
  { value: "cold_call", label: "Cold call" },
];

const JAKT_CHIP_HELP_TEXT: Record<HuntChipValue, string> = {
  alle: "Beste tekniske treff på tvers av kilder, sortert på match først.",
  foresporsler: "Aktive forespørsler de siste 45 dagene med teknisk match.",
  finn: "Tekniske treff fra Finn-annonser og selskapets tekniske DNA.",
  siste_aktivitet: "Kontakter med aktivitet de siste 45 dagene og teknisk match.",
  innkjoper: "Innkjøpere med teknisk match.",
  kunder: "Eksisterende kunder med teknisk match.",
  cold_call: "Kalde leads med teknisk match og lite nylig aktivitet.",
};

const CONFIDENCE_CONFIG: Record<ConfidenceBand, { label: string; tone: string }> = {
  high: { label: "Høy evidens", tone: C.dotSuccess },
  medium: { label: "Middels evidens", tone: C.warning },
  low: { label: "Lav evidens", tone: C.textFaint },
};

const DL_QUERY_KEYS = {
  contacts: ["dl-contacts-v9"] as const,
  contactsParity: ["dl-contacts-parity-v10"] as const,
  activities: ["dl-activities-v9"] as const,
  tasks: ["dl-tasks-v9"] as const,
  foresporsler: ["dl-foresporsler-v9"] as const,
  techProfiles: ["dl-tech-profiles-v9"] as const,
  consultants: ["dl-available-consultants-v9"] as const,
} as const;

/* Colors, signal colors, and heat colors imported from @/components/designlab/theme */

function relTime(days: number): string {
  if (days === 0) return "I dag";
  if (days === 1) return "1d";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}u`;
  if (days < 365) return `${Math.floor(days / 30)}m`;
  return `${Math.floor(days / 365)}å`;
}

function mapToSignal(raw: string): Signal {
  const normalized = normalizeCategoryLabel(raw);
  if (Object.keys(SIGNAL_ORDER).includes(normalized)) return normalized as Signal;
  return "Ukjent om behov";
}

function compareByPriority(
  left: { heatResult: HeatResult },
  right: { heatResult: HeatResult },
  dir: SortDir,
) {
  const diff =
    left.heatResult.tier !== right.heatResult.tier
      ? left.heatResult.tier - right.heatResult.tier
      : right.heatResult.score - left.heatResult.score;
  return dir === "desc" ? diff : -diff;
}

function getHeatBarColor(heat: HeatResult) {
  if (heat.temperature === "hett") return C.danger;
  if (heat.temperature === "lovende") return C.heatPromising;
  if (heat.temperature === "mulig") return C.heatPossible;
  return "transparent";
}

function getMatchSourceLabel(source: HuntChipValue): string {
  switch (source) {
    case "foresporsler":
      return "Forespørsel";
    case "finn":
      return "Finn";
    case "siste_aktivitet":
      return "Siste aktivitet";
    case "innkjoper":
      return "Innkjøper";
    case "kunder":
      return "Kunde";
    case "cold_call":
      return "Cold call";
    case "alle":
    default:
      return "Match";
  }
}

function compareByHotList(
  left: { tier?: number | null; heatScore?: number | null },
  right: { tier?: number | null; heatScore?: number | null },
) {
  const leftTier = left.tier ?? 4;
  const rightTier = right.tier ?? 4;
  if (leftTier !== rightTier) return leftTier - rightTier;

  const leftHeatScore = left.heatScore ?? -1000;
  const rightHeatScore = right.heatScore ?? -1000;
  if (rightHeatScore !== leftHeatScore) return rightHeatScore - leftHeatScore;

  return 0;
}

function getConfidenceConfig(confidenceBand: ConfidenceBand) {
  return CONFIDENCE_CONFIG[confidenceBand];
}

function isContactMatchLead(lead: MatchLead): lead is ContactMatchLead {
  return lead.leadType === "contact";
}

function isCompanyMatchLead(lead: MatchLead): lead is CompanyMatchLead {
  return lead.leadType === "company";
}

function isRequestMatchLead(lead: MatchLead): lead is RequestMatchLead {
  return lead.leadType === "request";
}

function getMatchLeadDate(lead: MatchLead): string | null {
  if (lead.sourceDates[0]) return lead.sourceDates[0];
  if (isContactMatchLead(lead)) return lead.lastActivityAt;
  return null;
}



/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function DesignLabContacts() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { signOut, user } = useAuth();
  const queryClient = useQueryClient();
  const [textSize] = usePersistentState<TextSize>("dl-text-size", "M");
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("Alle");
  const [signalFilter, setSignalFilter] = useState("Alle");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("Alle");
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "priority", dir: "desc" });
  const [selectedConsultantId, setSelectedConsultantId] = useState<number | null>(null);
  const [jaktChip, setJaktChip] = useState<HuntChipValue>("alle");
  const [huntSort, setHuntSort] = useState<{ field: HuntSortField; dir: SortDir }>({ field: "default", dir: "desc" });
  const [matchOwnerFilter, setMatchOwnerFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("contact"));
  const searchRef = useRef<HTMLInputElement>(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const pendingToggles = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const invalidateDesignLabQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: DL_QUERY_KEYS.contacts }),
      queryClient.invalidateQueries({ queryKey: DL_QUERY_KEYS.contactsParity }),
      queryClient.invalidateQueries({ queryKey: DL_QUERY_KEYS.activities }),
      queryClient.invalidateQueries({ queryKey: DL_QUERY_KEYS.tasks }),
      queryClient.invalidateQueries({ queryKey: DL_QUERY_KEYS.foresporsler }),
      queryClient.invalidateQueries({ queryKey: DL_QUERY_KEYS.techProfiles }),
      queryClient.invalidateQueries({ queryKey: DL_QUERY_KEYS.consultants }),
    ]);
  }, [queryClient]);

  const updateCachedContactFields = useCallback(
    (contactId: string, updates: Record<string, any>) => {
      const normalizedUpdates = {
        ...updates,
        ...(Object.prototype.hasOwnProperty.call(updates, "cv_email") ? { cvEmail: updates.cv_email } : {}),
        ...(Object.prototype.hasOwnProperty.call(updates, "call_list") ? { callList: updates.call_list } : {}),
      };

      queryClient.setQueryData(DL_QUERY_KEYS.contacts, (old: any) =>
        Array.isArray(old) ? old.map((contact) => (contact.id === contactId ? { ...contact, ...updates } : contact)) : old,
      );
      queryClient.setQueryData(DL_QUERY_KEYS.contactsParity, (old: any) =>
        Array.isArray(old)
          ? old.map((contact) => (contact.id === contactId ? { ...contact, ...normalizedUpdates } : contact))
          : old,
      );
      queryClient.setQueryData(crmQueryKeys.contacts.detail(contactId), (old: any) =>
        old ? { ...old, ...updates } : old,
      );
      queryClient.setQueryData(crmQueryKeys.contacts.all(), (old: any) =>
        old?.rows
          ? {
              ...old,
              rows: old.rows.map((contact: any) =>
                contact.id === contactId ? { ...contact, ...updates } : contact,
              ),
            }
          : old,
      );
    },
    [queryClient],
  );


  // ⌘K shortcut → open command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(true);
      }
      if (e.key === "Escape" && !cmdOpen) {
        setSelectedId(null);
        searchRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [cmdOpen]);

  // sync selectedId to URL
  useEffect(() => {
    const currentContact = searchParams.get("contact");
    if (selectedId) {
      if (currentContact !== selectedId) {
        setSearchParams({ contact: selectedId }, { replace: true });
      }
    } else if (currentContact !== null) {
      setSearchParams({}, { replace: true });
    }
  }, [selectedId, searchParams, setSearchParams]);

  useEffect(() => {
    const contactFromUrl = searchParams.get("contact");
    if (contactFromUrl !== selectedId) {
      setSelectedId(contactFromUrl);
    }
  }, [searchParams]);

  // ── Queries ──
  const { data: rawContacts = [], isLoading } = useQuery({
    queryKey: DL_QUERY_KEYS.contacts,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select(
          "id, first_name, last_name, title, email, phone, cv_email, call_list, ikke_aktuell_kontakt, teknologier, company_id, location, linkedin, department, notes, locations, mailchimp_status, owner_id, companies(id, name, status, ikke_relevant, owner_id, profiles!companies_owner_id_fkey(id, full_name)), profiles!contacts_owner_id_fkey(id, full_name)",
        )
        .order("updated_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data;
    },
  });

  const contactIds = useMemo(() => new Set(rawContacts.map((c) => c.id)), [rawContacts]);

  const { data: allActivities = [] } = useQuery({
    queryKey: DL_QUERY_KEYS.activities,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("id, contact_id, subject, description, created_at, type, created_by, profiles:created_by(full_name)")
        .not("contact_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
    enabled: rawContacts.length > 0,
  });

  const activitiesMap = useMemo(() => {
    const map: Record<string, typeof allActivities> = {};
    allActivities.forEach((activity) => {
      if (activity.contact_id && contactIds.has(activity.contact_id)) {
        (map[activity.contact_id] ??= []).push(activity);
      }
    });
    return map;
  }, [allActivities, contactIds]);

  const { data: allTasks = [] } = useQuery({
    queryKey: DL_QUERY_KEYS.tasks,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(
          "id, contact_id, title, description, due_date, status, priority, created_at, updated_at, assigned_to, profiles:assigned_to(full_name), companies:company_id(name)",
        )
        .not("contact_id", "is", null)
        .neq("status", "done")
        .order("due_date", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
    enabled: rawContacts.length > 0,
  });

  const tasksMap = useMemo(() => {
    const map: Record<string, typeof allTasks> = {};
    allTasks.forEach((task) => {
      if (task.contact_id && contactIds.has(task.contact_id)) {
        (map[task.contact_id] ??= []).push(task);
      }
    });
    return map;
  }, [allTasks, contactIds]);

  const companyIds = useMemo(() => {
    const ids = new Set<string>();
    rawContacts.forEach((c) => {
      if ((c as any).company_id) ids.add((c as any).company_id);
    });
    return ids;
  }, [rawContacts]);

  // ── Forespørsler for heat score ──
  const { data: allForesporsler = [] } = useQuery({
    queryKey: DL_QUERY_KEYS.foresporsler,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foresporsler")
        .select(
          "id, selskap_id, kontakt_id, selskap_navn, sted, mottatt_dato, frist_dato, status, teknologier, companies!foresporsler_selskap_id_fkey(id, name, status, ikke_relevant, owner_id, profiles!companies_owner_id_fkey(id, full_name)), contacts!foresporsler_kontakt_id_fkey(id, first_name, last_name, title)",
        )
        .not("selskap_id", "is", null)
        .order("mottatt_dato", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
    enabled: companyIds.size > 0,
  });

  const requests = useMemo<RequestLeadRow[]>(
    () =>
      (allForesporsler as any[]).map((request) => ({
        id: request.id,
        companyId: request.selskap_id || null,
        contactId: request.kontakt_id || null,
        companyName: request.companies?.name || request.selskap_navn || "Ukjent selskap",
        company: (request.companies || null) as CompanyPreview | null,
        mottattDato: request.mottatt_dato,
        fristDato: request.frist_dato || null,
        sted: request.sted || null,
        status: request.status || null,
        technologyTags: mergeTechnologyTags(request.teknologier || []),
        contactName: request.contacts
          ? `${request.contacts.first_name || ""} ${request.contacts.last_name || ""}`.trim() || null
          : null,
        contactTitle: request.contacts?.title || null,
      })),
    [allForesporsler],
  );

  const foresporslerMap = useMemo(() => {
    const map = new Map<string, RequestLeadRow[]>();
    requests.forEach((request) => {
      if (request.companyId && companyIds.has(request.companyId)) {
        const existing = map.get(request.companyId) || [];
        existing.push(request);
        map.set(request.companyId, existing);
      }
    });
    return map;
  }, [companyIds, requests]);

  // ── Company tech profiles for FINN column ──

  const { data: allTechProfiles = [] } = useQuery({
    queryKey: DL_QUERY_KEYS.techProfiles,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_tech_profile")
        .select(
          "company_id, sist_fra_finn, teknologier, companies!company_tech_profile_company_id_fkey(id, name, status, ikke_relevant, owner_id, profiles!companies_owner_id_fkey(id, full_name))",
        )
        .not("company_id", "is", null)
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
    enabled: companyIds.size > 0,
  });

  const companyTechProfiles = useMemo<CompanyTechLeadRow[]>(
    () =>
      (allTechProfiles as any[])
        .filter((profile) => Boolean(profile?.company_id))
        .map((profile) => ({
          companyId: profile.company_id,
          company: (profile.companies || null) as CompanyPreview | null,
          sistFraFinn: profile.sist_fra_finn || null,
          companyTechnologyTags: mergeTechnologyTags(
            Array.isArray(profile?.teknologier)
              ? profile.teknologier
              : profile?.teknologier && typeof profile.teknologier === "object"
                ? Object.keys(profile.teknologier as Record<string, number>)
                : [],
          ),
        })),
    [allTechProfiles],
  );

  const techProfileMap = useMemo(() => {
    const map = new Map<string, CompanyTechLeadRow>();
    companyTechProfiles.forEach((profile) => {
      if (companyIds.has(profile.companyId)) {
        map.set(profile.companyId, profile);
      }
    });
    return map;
  }, [companyIds, companyTechProfiles]);

  // ── Consultants available ──
  const { data: availableConsultants = [] } = useQuery({
    queryKey: DL_QUERY_KEYS.consultants,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stacq_ansatte")
        .select("id, navn, status, tilgjengelig_fra, kompetanse")
        .in("status", ["AKTIV/SIGNERT", "Ledig"])
        .not("tilgjengelig_fra", "is", null);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const sortedConsultants = useMemo(() => {
    return sortHuntConsultants(
      (availableConsultants as HuntConsultant[]).filter((consultant) =>
        hasConsultantAvailability(consultant.tilgjengelig_fra),
      ),
    );
  }, [availableConsultants]);

  const { data: parityContacts = [], isLoading: isLoadingParity } = useQuery({
    queryKey: DL_QUERY_KEYS.contactsParity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select(
          "*, companies(id, name, status, ikke_relevant, owner_id, profiles!companies_owner_id_fkey(id, full_name)), profiles!contacts_owner_id_fkey(id, full_name)",
        )
        .order("updated_at", { ascending: false })
        .limit(2000);
      if (error) throw error;

      const contactIdSet = new Set(data.map((contact) => contact.id));

      const [{ data: acts }, { data: tasks }, { data: companyTechProfiles }, { data: requestRows }] = await Promise.all([
        supabase
          .from("activities")
          .select("contact_id, created_at, description, subject")
          .not("contact_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase
          .from("tasks")
          .select("contact_id, created_at, updated_at, due_date, status, description, title")
          .not("contact_id", "is", null)
          .limit(5000),
        supabase
          .from("company_tech_profile")
          .select(
            "company_id, sist_fra_finn, teknologier, companies!company_tech_profile_company_id_fkey(id, name, status, ikke_relevant, owner_id, profiles!companies_owner_id_fkey(id, full_name))",
          )
          .not("company_id", "is", null)
          .limit(5000),
        supabase
          .from("foresporsler")
          .select(
            "id, selskap_id, kontakt_id, selskap_navn, sted, mottatt_dato, frist_dato, status, teknologier, companies!foresporsler_selskap_id_fkey(id, name, status, ikke_relevant, owner_id, profiles!companies_owner_id_fkey(id, full_name)), contacts!foresporsler_kontakt_id_fkey(id, first_name, last_name, title)",
          )
          .order("mottatt_dato", { ascending: false })
          .limit(5000),
      ]);

      const now = new Date();
      const nowIso = now.toISOString();
      const lastActMap: Record<string, string> = {};
      const contactActsMap: Record<string, NonNullable<typeof acts>> = {};
      const contactTasksMap: Record<string, NonNullable<typeof tasks>> = {};
      const openTasksMap: Record<string, { count: number; overdue: boolean }> = {};
      const today = new Date().toISOString().slice(0, 10);

      (acts || []).forEach((activity) => {
        if (!activity.contact_id || !contactIdSet.has(activity.contact_id)) return;
        if (activity.created_at <= nowIso && !lastActMap[activity.contact_id]) {
          lastActMap[activity.contact_id] = activity.created_at;
        }
        (contactActsMap[activity.contact_id] ??= []).push(activity);
      });

      (tasks || []).forEach((task) => {
        if (!task.contact_id || !contactIdSet.has(task.contact_id) || task.status === "done") return;
        (contactTasksMap[task.contact_id] ??= []).push(task);
        if (task.status === "open") {
          if (!openTasksMap[task.contact_id]) openTasksMap[task.contact_id] = { count: 0, overdue: false };
          openTasksMap[task.contact_id].count++;
          if (task.due_date && task.due_date < today) openTasksMap[task.contact_id].overdue = true;
        }
      });

      const signalMap: Record<string, string> = {};
      for (const contactId of contactIdSet) {
        const effectiveSignal = getEffectiveSignal(
          (contactActsMap[contactId] || []).map((activity) => ({
            created_at: activity.created_at,
            subject: activity.subject || "",
            description: activity.description,
          })),
          (contactTasksMap[contactId] || []).map((task) => ({
            created_at: task.created_at,
            updated_at: task.updated_at,
            title: task.title || "",
            description: task.description,
            due_date: task.due_date,
            status: task.status,
          })),
        );
        if (effectiveSignal) signalMap[contactId] = effectiveSignal;
      }

      const techProfileByCompanyId = new Map<string, CompanyTechLeadRow>();
      (companyTechProfiles || [])
        .filter((profile: any) => Boolean(profile?.company_id))
        .forEach((profile: any) => {
          techProfileByCompanyId.set(profile.company_id, {
            companyId: profile.company_id,
            company: (profile.companies || null) as CompanyPreview | null,
            sistFraFinn: profile.sist_fra_finn || null,
            companyTechnologyTags: mergeTechnologyTags(
              Array.isArray(profile?.teknologier)
                ? profile.teknologier
                : profile?.teknologier && typeof profile.teknologier === "object"
                  ? Object.keys(profile.teknologier as Record<string, number>)
                  : [],
            ),
          });
        });

      const requestMap = new Map<string, RequestLeadRow[]>();
      (requestRows || []).forEach((request: any) => {
        if (!request.selskap_id) return;
        const row: RequestLeadRow = {
          id: request.id,
          companyId: request.selskap_id || null,
          contactId: request.kontakt_id || null,
          companyName: request.companies?.name || request.selskap_navn || "Ukjent selskap",
          company: (request.companies || null) as CompanyPreview | null,
          mottattDato: request.mottatt_dato,
          fristDato: request.frist_dato || null,
          sted: request.sted || null,
          status: request.status || null,
          technologyTags: mergeTechnologyTags(request.teknologier || []),
          contactName: request.contacts
            ? `${request.contacts.first_name || ""} ${request.contacts.last_name || ""}`.trim() || null
            : null,
          contactTitle: request.contacts?.title || null,
        };
        const existing = requestMap.get(request.selskap_id) || [];
        existing.push(row);
        requestMap.set(request.selskap_id, existing);
      });

      return data.map((contact): NormalizedContact => {
        const company = (contact as any).companies as CompanyPreview | null;
        const owner = ((contact as any).profiles || null) as OwnerPreview;
        const companyId = contact.company_id || "";
        const actsForContact = contactActsMap[contact.id] || [];
        const tasksForContact = contactTasksMap[contact.id] || [];
        const foresporslerForCompany = requestMap.get(companyId) || [];
        const signal = signalMap[contact.id] ? mapToSignal(signalMap[contact.id]) : "";
        const lastActivityAt = lastActMap[contact.id] || null;
        const daysSince = lastActivityAt ? differenceInDays(now, new Date(lastActivityAt)) : 999;
        const openTasks = openTasksMap[contact.id] || { count: 0, overdue: false };
        const techProfile = techProfileByCompanyId.get(companyId);
        const companyTechnologyTags = techProfile?.companyTechnologyTags || [];
        const activeRequests = foresporslerForCompany.filter((request) =>
          isActiveRequest(request.mottattDato, request.status),
        );
        const hasAktivForespørsel = activeRequests.length > 0;
        const hasTidligereForespørsel =
          foresporslerForCompany.length > 0 &&
          foresporslerForCompany.some((request) => !isActiveRequest(request.mottattDato, request.status));
        const requestTechnologyTags = mergeTechnologyTags(...activeRequests.map((request) => request.technologyTags));
        const hasMarkedsradar = Boolean(
          techProfile?.sistFraFinn && differenceInDays(now, new Date(techProfile.sistFraFinn)) <= 90,
        );
        const taskStatus = getTaskStatus(
          tasksForContact.map((task) => ({ due_date: task.due_date, status: task.status })),
        );
        const activityStatus = getActivityStatus(daysSince);
        const signalAct = actsForContact.find((activity) => {
          const normalizedSubject = normalizeCategoryLabel(activity.subject || "");
          return SIGNALS.includes(normalizedSubject as Signal);
        });
        const signalSetAt = signalAct ? new Date(signalAct.created_at) : null;
        const lastActDate = lastActivityAt ? new Date(lastActivityAt) : null;
        const kes = Boolean(signalSetAt && lastActDate && lastActDate > signalSetAt);

        const heatResult = getHeatResult({
          signal,
          isInnkjoper: contact.call_list === true,
          hasMarkedsradar,
          hasAktivForespørsel,
          hasOverdue: openTasks.overdue,
          daysSinceLastContact: daysSince,
          hasTidligereForespørsel,
          ikkeAktuellKontakt: contact.ikke_aktuell_kontakt ?? false,
          ikkeRelevantSelskap: company?.ikke_relevant ?? false,
          taskStatus,
          activityStatus,
          kes,
        });

        return {
          id: contact.id,
          firstName: contact.first_name,
          lastName: contact.last_name,
          title: contact.title || "",
          email: contact.email || "",
          phone: contact.phone || "",
          linkedin: contact.linkedin || "",
          location: contact.location || "",
          locations: contact.locations || [],
          department: contact.department || "",
          notes: contact.notes || "",
          company: company?.name || "",
          companyId: company?.id || null,
          companyPreview: company,
          signal,
          eier: owner?.full_name || "",
          eierId: owner?.id || null,
          ownerProfile: owner,
          cvEmail: contact.cv_email,
          callList: contact.call_list,
          mailchimpStatus: contact.mailchimp_status || null,
          ikkeAktuell: contact.ikke_aktuell_kontakt ?? false,
          teknologier: contact.teknologier || [],
          daysSince,
          lastActivityAt,
          lastActivitySubject: actsForContact[0]?.subject || "",
          activities: actsForContact,
          tasks: tasksForContact,
          openTasks,
          heatResult,
          heatScore: heatResult.score,
          temperature: heatResult.temperature,
          tier: heatResult.tier,
          needsReview: heatResult.needsReview,
          hasMarkedsradar,
          hasAktivForespørsel,
          hasTidligereForespørsel,
          companyStatus: company?.status || null,
          contactTechnologyTags: mergeTechnologyTags(contact.teknologier || []),
          companyTechnologyTags,
          requestTechnologyTags,
        };
      });
    },
  });

  // ── Computed with heat score ──
  const fallbackContacts = useMemo(() => {
    const now = new Date();
    const nowIso = now.toISOString();
    const today = new Date().toISOString().slice(0, 10);
    return rawContacts.map((c): NormalizedContact => {
      const acts = (activitiesMap as any)[c.id] || [];
      const tasks = (tasksMap as any)[c.id] || [];
      const companyId = (c as any).company_id || "";
      const foresps = foresporslerMap.get(companyId) || [];
      const effectiveSignal = getEffectiveSignal(
        acts.map((activity: any) => ({
          created_at: activity.created_at,
          subject: activity.subject,
          description: activity.description,
        })),
        tasks.map((task: any) => ({
          created_at: task.created_at,
          updated_at: task.updated_at,
          title: task.title,
          description: task.description,
          due_date: task.due_date,
          status: task.status,
        })),
      );
      const signal = effectiveSignal ? mapToSignal(effectiveSignal) : "";
      const pastActivities = acts.filter((activity: any) => activity.created_at <= nowIso);
      const lastAct = pastActivities[0] || null;
      const daysSince = lastAct ? differenceInDays(now, new Date(lastAct.created_at)) : 999;
      const company = ((c as any).companies || null) as CompanyPreview | null;
      const owner = (((c as any).profiles || null) as OwnerPreview);
      const openTasks = tasks.reduce(
        (acc: { count: number; overdue: boolean }, task: any) => {
          if (task.status === "open") {
            acc.count += 1;
            if (task.due_date && task.due_date < today) acc.overdue = true;
          }
          return acc;
        },
        { count: 0, overdue: false },
      );

      const activeRequests = foresps.filter((request) => isActiveRequest(request.mottattDato, request.status));
      const hasAktivForespørsel = activeRequests.length > 0;
      const hasTidligereForespørsel =
        foresps.length > 0 && foresps.some((request) => !isActiveRequest(request.mottattDato, request.status));
      const techProfile = techProfileMap.get(companyId) || null;
      const companyTechnologyTags = techProfile?.companyTechnologyTags || [];
      const requestTechnologyTags = mergeTechnologyTags(...activeRequests.map((request) => request.technologyTags));
      const hasMarkedsradar = Boolean(
        techProfile?.sistFraFinn && differenceInDays(now, new Date(techProfile.sistFraFinn)) <= 90,
      );
      const taskStatus = getTaskStatus(tasks.map((t: any) => ({ due_date: t.due_date, status: t.status })));
      const activityStatus = getActivityStatus(daysSince);
      const signalAct = acts.find((activity: any) => {
        const normalizedSubject = normalizeCategoryLabel(activity.subject || "");
        return SIGNALS.includes(normalizedSubject as Signal);
      });
      const signalSetAt = signalAct ? new Date(signalAct.created_at) : null;
      const lastActDate = lastAct ? new Date(lastAct.created_at) : null;
      const kes = Boolean(signalSetAt && lastActDate && lastActDate > signalSetAt);

      const heatResult = getHeatResult({
        signal,
        isInnkjoper: c.call_list === true,
        hasMarkedsradar,
        hasAktivForespørsel,
        hasOverdue: openTasks.overdue,
        daysSinceLastContact: daysSince,
        hasTidligereForespørsel,
        ikkeAktuellKontakt: c.ikke_aktuell_kontakt ?? false,
        ikkeRelevantSelskap: company?.ikke_relevant ?? false,
        taskStatus,
        activityStatus,
        kes,
      });

      return {
        id: c.id,
        firstName: c.first_name,
        lastName: c.last_name,
        title: c.title || "",
        email: c.email || "",
        phone: c.phone || "",
        linkedin: c.linkedin || "",
        location: c.location || "",
        locations: c.locations || [],
        department: c.department || "",
        notes: c.notes || "",
        company: company?.name || "",
        companyId: company?.id || null,
        companyPreview: company,
        signal,
        eier: owner?.full_name || "",
        eierId: owner?.id || null,
        ownerProfile: owner,
        cvEmail: c.cv_email,
        callList: c.call_list,
        mailchimpStatus: c.mailchimp_status || null,
        ikkeAktuell: c.ikke_aktuell_kontakt ?? false,
        teknologier: c.teknologier || [],
        daysSince,
        lastActivityAt: lastAct?.created_at || null,
        lastActivitySubject: lastAct?.subject || "",
        activities: acts,
        tasks,
        openTasks,
        heatResult,
        heatScore: heatResult.score,
        temperature: heatResult.temperature,
        tier: heatResult.tier,
        needsReview: heatResult.needsReview,
        hasMarkedsradar,
        hasAktivForespørsel,
        hasTidligereForespørsel,
        companyStatus: company?.status || null,
        contactTechnologyTags: mergeTechnologyTags(c.teknologier || []),
        companyTechnologyTags,
        requestTechnologyTags,
      };
    });
  }, [rawContacts, activitiesMap, tasksMap, foresporslerMap, techProfileMap]);

  const contacts = useMemo(
    () => (parityContacts.length > 0 || (rawContacts.length === 0 && !isLoadingParity) ? parityContacts : fallbackContacts),
    [fallbackContacts, isLoadingParity, parityContacts, rawContacts.length],
  );

  const selectedConsultant = useMemo(
    () => sortedConsultants.find((consultant) => consultant.id === selectedConsultantId) ?? null,
    [selectedConsultantId, sortedConsultants],
  );

  const ownerOptions = useMemo(() => {
    const names = Array.from(new Set(contacts.map((contact) => contact.eier).filter(Boolean)));
    return ["Alle", ...names.sort((left, right) => left.localeCompare(right, "nb")), "Uten eier"];
  }, [contacts]);

  const toggleSort = useCallback((field: SortField) => {
    setSort((current) =>
      current.field === field
        ? { field, dir: current.dir === "asc" ? "desc" : "asc" }
        : { field, dir: field === "last_activity" || field === "priority" || field === "tags" || field === "finn" ? "desc" : "asc" },
    );
  }, []);

  const searchTerm = search.trim().toLowerCase();

  const searchFilteredContacts = useMemo(
    () =>
      contacts.filter((contact) => {
        if (!searchTerm) return true;
        const technologyTags = mergeTechnologyTags(
          contact.contactTechnologyTags,
          contact.companyTechnologyTags,
          contact.requestTechnologyTags,
        );

        return (
          `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(searchTerm) ||
          contact.company.toLowerCase().includes(searchTerm) ||
          contact.title.toLowerCase().includes(searchTerm) ||
          contact.email.toLowerCase().includes(searchTerm) ||
          technologyTags.join(" ").toLowerCase().includes(searchTerm)
        );
      }),
    [contacts, searchTerm],
  );

  const filteredContacts = useMemo(() => {
    let list = searchFilteredContacts;

    if (ownerFilter === "Uten eier") list = list.filter((contact) => !contact.eier);
    else if (ownerFilter !== "Alle") list = list.filter((contact) => contact.eier === ownerFilter);
    if (signalFilter !== "Alle") list = list.filter((contact) => contact.signal === signalFilter);
    if (typeFilter === "Innkjøper") list = list.filter((contact) => contact.callList === true);
    else if (typeFilter === "CV-Epost") list = list.filter((contact) => contact.cvEmail === true);
    else if (typeFilter === "Ikke relevant kontakt") list = list.filter((contact) => contact.ikkeAktuell);

    return list;
  }, [ownerFilter, searchFilteredContacts, signalFilter, typeFilter]);

  const matchBaseContacts = useMemo(
    () =>
      searchFilteredContacts.filter(
        (contact) =>
          !contact.ikkeAktuell &&
          !contact.companyPreview?.ikke_relevant &&
          contact.signal !== "Ikke aktuelt",
      ),
    [searchFilteredContacts],
  );

  const selectedConsultantFirstName = selectedConsultant?.navn.split(" ")[0] || "konsulenten";

  const matchResults = useMemo(() => {
    if (!selectedConsultant) {
      return {
        allLeads: [] as MatchLead[],
        leads: [] as MatchLead[],
        emptyState: null as string | null,
      };
    }

    const consultantTags = mergeTechnologyTags(selectedConsultant.kompetanse || []);
    if (consultantTags.length === 0) {
      return {
        allLeads: [] as MatchLead[],
        leads: [] as MatchLead[],
        emptyState: `${selectedConsultant.navn} mangler teknisk DNA i CRM. Legg inn kompetanse på konsulenten for å få match-treff her.`,
      };
    }

    const chipPoolKeys: Array<Exclude<HuntChipValue, "alle">> = [
      "foresporsler",
      "finn",
      "siste_aktivitet",
      "innkjoper",
      "kunder",
      "cold_call",
    ];
    const contactPools = Object.fromEntries(
      chipPoolKeys.map((chip) => [chip, new Map<string, ContactMatchLead>()]),
    ) as Record<Exclude<HuntChipValue, "alle">, Map<string, ContactMatchLead>>;
    const companyPools = Object.fromEntries(
      chipPoolKeys.map((chip) => [chip, new Map<string, CompanyMatchLead>()]),
    ) as Record<Exclude<HuntChipValue, "alle">, Map<string, CompanyMatchLead>>;
    const requestPools = {
      foresporsler: new Map<number, RequestMatchLead>(),
    };

    const allContactsById = new Map(contacts.map((contact) => [contact.id, contact]));
    const searchableContactById = new Map(matchBaseContacts.map((contact) => [contact.id, contact]));
    const searchableContactsByCompanyId = new Map<string, NormalizedContact[]>();
    matchBaseContacts.forEach((contact) => {
      if (!contact.companyId) return;
      const existing = searchableContactsByCompanyId.get(contact.companyId) || [];
      existing.push(contact);
      searchableContactsByCompanyId.set(contact.companyId, existing);
    });

    const companyTechById = new Map(companyTechProfiles.map((profile) => [profile.companyId, profile]));
    const companyNameMatchesSearch = (name: string, tags: string[]) =>
      !searchTerm || name.toLowerCase().includes(searchTerm) || tags.join(" ").toLowerCase().includes(searchTerm);
    const mergeTags = (...tagGroups: string[][]) => [...new Set(tagGroups.flat().filter(Boolean))];
    const mergeSources = (...sourceGroups: HuntChipValue[][]) => [...new Set(sourceGroups.flat())];
    const mergeDates = (...dateGroups: string[][]) =>
      [...new Set(dateGroups.flat().filter(Boolean))].sort((left, right) => right.localeCompare(left));
    const mergeUrgency = (...urgencies: number[]) => Math.max(0, ...urgencies);
    const getSourceUrgency = (
      chip: Exclude<HuntChipValue, "alle">,
      sourceDate?: string | null,
      contact?: NormalizedContact,
    ) => {
      if (chip === "cold_call") return contact?.daysSince ?? 0;
      return sourceDate ? new Date(sourceDate).getTime() : 0;
    };
    const buildContactLeadTags = (contact: NormalizedContact) =>
      mergeTechnologyTags(contact.contactTechnologyTags, contact.companyTechnologyTags);
    const getLeadScore = (tags: string[]) => getContactMatchScore(consultantTags, tags);
    const getContactOwnerCandidate = (
      contact: Pick<NormalizedContact, "eierId" | "ownerProfile"> | null | undefined,
      source: Exclude<MatchLeadOwnerSource, "company" | "none"> = "contact",
    ) =>
      buildMatchLeadOwnerCandidate(
        contact
          ? {
              owner_id: contact.eierId,
              profiles: contact.ownerProfile,
            }
          : null,
        source,
      );
    const getCompanyOwnerCandidate = (company: CompanyPreview | null | undefined) =>
      buildMatchLeadOwnerCandidate(
        company
          ? {
              owner_id: company.owner_id,
              profiles: company.profiles,
            }
          : null,
        "company",
      );
    const resolveLeadOwner = ({
      contact,
      company,
      fallbackContact,
    }: {
      contact?: Pick<NormalizedContact, "eierId" | "ownerProfile"> | null;
      company?: CompanyPreview | null;
      fallbackContact?: Pick<NormalizedContact, "eierId" | "ownerProfile"> | null;
    }) =>
      resolveMatchLeadOwner(
        getContactOwnerCandidate(contact, "contact"),
        getCompanyOwnerCandidate(company),
        getContactOwnerCandidate(fallbackContact, "fallback_contact"),
      );

    const getBestCompanyContact = (companyId: string, sourceTags?: string[]) => {
      const candidates = searchableContactsByCompanyId.get(companyId) || [];
      if (candidates.length === 0) return null;

      return [...candidates].sort((left, right) => {
        const leftScore = getLeadScore(sourceTags || buildContactLeadTags(left));
        const rightScore = getLeadScore(sourceTags || buildContactLeadTags(right));
        if (rightScore.score10 !== leftScore.score10) return rightScore.score10 - leftScore.score10;
        if (rightScore.confidenceScore !== leftScore.confidenceScore) {
          return rightScore.confidenceScore - leftScore.confidenceScore;
        }

        const hotListCompare = compareByHotList(left, right);
        if (hotListCompare !== 0) return hotListCompare;

        return `${left.firstName} ${left.lastName}`.localeCompare(`${right.firstName} ${right.lastName}`, "nb");
      })[0];
    };

    const addContactLead = (
      chip: Exclude<HuntChipValue, "alle">,
      contact: NormalizedContact,
      leadTags: string[],
      sourceDate?: string | null,
      summary?: string,
    ) => {
      const scoreResult = getLeadScore(leadTags);
      if (scoreResult.score10 < 4 || !scoreResult.matchBand) return;
      const owner = resolveLeadOwner({ contact });

      const nextLead: ContactMatchLead = {
        ...contact,
        leadKey: `contact:${contact.id}`,
        leadType: "contact",
        name: `${contact.firstName} ${contact.lastName}`.trim(),
        companyId: contact.companyId,
        companyName: contact.company,
        matchScore10: scoreResult.score10,
        matchBand: scoreResult.matchBand,
        confidenceScore: scoreResult.confidenceScore,
        confidenceBand: scoreResult.confidenceBand,
        matchSources: [chip],
        matchTags: scoreResult.matchTags,
        sourceDates: sourceDate ? [sourceDate] : [],
        chipUrgency: getSourceUrgency(chip, sourceDate, contact),
        summary: summary || contact.title || "Kontaktlead",
        ownerId: owner.ownerId,
        ownerName: owner.ownerName,
        ownerSource: owner.ownerSource,
      };

      const existing = contactPools[chip].get(contact.id);
      if (!existing) {
        contactPools[chip].set(contact.id, nextLead);
        return;
      }

      const mergedScore = Math.max(existing.matchScore10, nextLead.matchScore10);
      contactPools[chip].set(contact.id, {
        ...existing,
        matchScore10: mergedScore,
        matchBand: getMatchBand(mergedScore) || existing.matchBand,
        confidenceScore: Math.max(existing.confidenceScore, nextLead.confidenceScore),
        confidenceBand:
          existing.confidenceScore >= nextLead.confidenceScore ? existing.confidenceBand : nextLead.confidenceBand,
        matchSources: mergeSources(existing.matchSources, nextLead.matchSources),
        matchTags: mergeTags(existing.matchTags, nextLead.matchTags),
        sourceDates: mergeDates(existing.sourceDates, nextLead.sourceDates),
        chipUrgency: mergeUrgency(existing.chipUrgency, nextLead.chipUrgency),
        summary: existing.summary || nextLead.summary,
        ownerId: existing.ownerId || nextLead.ownerId,
        ownerName: existing.ownerName || nextLead.ownerName,
        ownerSource: existing.ownerId || existing.ownerName ? existing.ownerSource : nextLead.ownerSource,
      });
    };

    const addCompanyLead = (
      chip: Exclude<HuntChipValue, "alle">,
      companyId: string | null,
      company: CompanyPreview | null,
      fallbackName: string,
      leadTags: string[],
      companyTechnologyTags: string[],
      sourceDate?: string | null,
      summary?: string,
      preferredContact?: { name?: string | null; title?: string | null },
      fallbackContact?: NormalizedContact | null,
      minimumScore = 4,
    ) => {
      const companyName = company?.name || fallbackName || "Ukjent selskap";
      if (!companyId || !companyNameMatchesSearch(companyName, leadTags) || company?.ikke_relevant) return;

      const scoreResult = getLeadScore(leadTags);
      if (scoreResult.score10 < minimumScore) return;
      const owner = resolveLeadOwner({ company, fallbackContact });

      const nextLead: CompanyMatchLead = {
        leadKey: `company:${companyId}`,
        leadType: "company",
        companyId,
        companyName,
        name: companyName,
        status: company?.status || null,
        companyTechnologyTags,
        matchScore10: scoreResult.score10,
        matchBand: scoreResult.matchBand,
        confidenceScore: scoreResult.confidenceScore,
        confidenceBand: scoreResult.confidenceBand,
        matchSources: [chip],
        matchTags: scoreResult.matchTags,
        sourceDates: sourceDate ? [sourceDate] : [],
        chipUrgency: getSourceUrgency(chip, sourceDate),
        summary: summary || "Selskapslead uten registrert kontakt",
        preferredContactName: preferredContact?.name || null,
        preferredContactTitle: preferredContact?.title || null,
        ownerId: owner.ownerId,
        ownerName: owner.ownerName,
        ownerSource: owner.ownerSource,
      };

      const existing = companyPools[chip].get(companyId);
      if (!existing) {
        companyPools[chip].set(companyId, nextLead);
        return;
      }

      const mergedScore = Math.max(existing.matchScore10, nextLead.matchScore10);
      companyPools[chip].set(companyId, {
        ...existing,
        matchScore10: mergedScore,
        matchBand: getMatchBand(mergedScore) || existing.matchBand,
        confidenceScore: Math.max(existing.confidenceScore, nextLead.confidenceScore),
        confidenceBand:
          existing.confidenceScore >= nextLead.confidenceScore ? existing.confidenceBand : nextLead.confidenceBand,
        matchTags: mergeTags(existing.matchTags, nextLead.matchTags),
        matchSources: mergeSources(existing.matchSources, nextLead.matchSources),
        sourceDates: mergeDates(existing.sourceDates, nextLead.sourceDates),
        chipUrgency: mergeUrgency(existing.chipUrgency, nextLead.chipUrgency),
        summary: existing.summary || nextLead.summary,
        preferredContactName: existing.preferredContactName || nextLead.preferredContactName || null,
        preferredContactTitle: existing.preferredContactTitle || nextLead.preferredContactTitle || null,
        ownerId: existing.ownerId || nextLead.ownerId,
        ownerName: existing.ownerName || nextLead.ownerName,
        ownerSource: existing.ownerId || existing.ownerName ? existing.ownerSource : nextLead.ownerSource,
      });
    };

    const addRequestLead = (request: RequestLeadRow) => {
      const scoreResult = getLeadScore(request.technologyTags);
      if (scoreResult.score10 === 0 && request.technologyTags.length === 0) return;

      const ownerContact = request.contactId ? allContactsById.get(request.contactId) || null : null;
      const linkedContact = request.contactId ? searchableContactById.get(request.contactId) || null : null;
      const bestCompanyContact =
        !linkedContact && request.companyId ? getBestCompanyContact(request.companyId, request.technologyTags) : null;
      const heatContact = linkedContact || bestCompanyContact;
      const owner = resolveLeadOwner({
        contact: ownerContact,
        company: request.company,
        fallbackContact: bestCompanyContact,
      });
      const requestName = request.companyName || "Ukjent selskap";

      if (
        searchTerm &&
        !requestName.toLowerCase().includes(searchTerm) &&
        !request.contactName?.toLowerCase().includes(searchTerm) &&
        !request.technologyTags.join(" ").toLowerCase().includes(searchTerm)
      ) {
        return;
      }

      requestPools.foresporsler.set(request.id, {
        leadKey: `request:${request.id}`,
        leadType: "request",
        requestId: request.id,
        companyId: request.companyId,
        companyName: requestName,
        name: requestName,
        matchScore10: scoreResult.score10,
        matchBand: scoreResult.matchBand,
        confidenceScore: scoreResult.confidenceScore,
        confidenceBand: scoreResult.confidenceBand,
        matchSources: ["foresporsler"],
        matchTags: scoreResult.matchTags,
        requestTechnologyTags: request.technologyTags,
        sourceDates: request.mottattDato ? [request.mottattDato] : [],
        chipUrgency: getSourceUrgency("foresporsler", request.mottattDato),
        summary: request.contactName ? "Aktiv forespørsel med kontakt" : "Aktiv forespørsel",
        requestStatus: request.status,
        fristDato: request.fristDato,
        sted: request.sted,
        contactId: request.contactId,
        contactName: request.contactName || (heatContact ? `${heatContact.firstName} ${heatContact.lastName}`.trim() : null),
        contactTitle: request.contactTitle || heatContact?.title || null,
        tier: heatContact?.tier,
        heatScore: heatContact?.heatScore,
        temperature: heatContact?.temperature,
        needsReview: heatContact?.needsReview,
        signal: heatContact?.signal || null,
        ownerId: owner.ownerId,
        ownerName: owner.ownerName,
        ownerSource: owner.ownerSource,
      });
    };

    const activeRequests = requests.filter((request) => isActiveRequest(request.mottattDato, request.status));
    activeRequests.forEach((request) => {
      addRequestLead(request);
    });

    companyTechProfiles.forEach((profile) => {
      const hasFreshFinn =
        Boolean(profile.sistFraFinn) && differenceInDays(new Date(), new Date(profile.sistFraFinn!)) <= 90;
      if (!hasFreshFinn) return;

      const bestContact = getBestCompanyContact(profile.companyId, profile.companyTechnologyTags);
      if (bestContact) {
        addContactLead("finn", bestContact, profile.companyTechnologyTags, profile.sistFraFinn, "Finn-teknologimatch");
        return;
      }

      addCompanyLead(
        "finn",
        profile.companyId,
        profile.company,
        profile.company?.name || "Ukjent selskap",
        profile.companyTechnologyTags,
        profile.companyTechnologyTags,
        profile.sistFraFinn,
        "Finn-teknologimatch uten registrert kontakt",
      );
    });

    matchBaseContacts.forEach((contact) => {
      const contactLeadTags = buildContactLeadTags(contact);

      if (hasRecentActualActivity(contact.daysSince, 45)) {
        addContactLead("siste_aktivitet", contact, contactLeadTags, contact.lastActivityAt, "Nylig aktivitet");
      }
      if (contact.callList) {
        addContactLead("innkjoper", contact, contactLeadTags, contact.lastActivityAt, "Aktiv innkjøper");
      }
      if (
        isColdCallCandidate({
          daysSinceLastContact: contact.daysSince,
          openTaskCount: contact.openTasks.count,
          isIkkeAktuellKontakt: Boolean(contact.ikkeAktuell),
        })
      ) {
        addContactLead("cold_call", contact, contactLeadTags, contact.lastActivityAt, "Cold call-kandidat");
      }
    });

    const customerCompanyIds = new Set<string>();
    matchBaseContacts.forEach((contact) => {
      if (contact.companyId && isCustomerCompany(contact.companyStatus)) customerCompanyIds.add(contact.companyId);
    });
    companyTechProfiles.forEach((profile) => {
      if (profile.companyId && isCustomerCompany(profile.company?.status)) customerCompanyIds.add(profile.companyId);
    });

    customerCompanyIds.forEach((companyId) => {
      const companyContacts = searchableContactsByCompanyId.get(companyId) || [];
      const companyProfile = companyTechById.get(companyId);
      const company = companyContacts[0]?.companyPreview || companyProfile?.company || null;
      if (!company || !isCustomerCompany(company.status) || company.ikke_relevant) return;

      const customerLeadTags = mergeTechnologyTags(
        companyProfile?.companyTechnologyTags || [],
        ...companyContacts.map((contact) => contact.contactTechnologyTags),
        ...companyContacts.map((contact) => contact.companyTechnologyTags),
      );
      const bestContact = getBestCompanyContact(companyId, customerLeadTags);
      const customerSourceDate = bestContact?.lastActivityAt || companyProfile?.sistFraFinn || null;

      addCompanyLead(
        "kunder",
        companyId,
        company,
        company.name,
        customerLeadTags,
        companyProfile?.companyTechnologyTags || [],
        customerSourceDate,
        "Kundeselskap",
        {
          name: bestContact ? `${bestContact.firstName} ${bestContact.lastName}`.trim() : null,
          title: bestContact?.title || null,
        },
        bestContact,
        1,
      );
    });

    const mergeContactPools = (chips: Array<Exclude<HuntChipValue, "alle">>) => {
      const merged = new Map<string, ContactMatchLead>();
      chips.forEach((chip) => {
        contactPools[chip].forEach((lead, contactId) => {
          const existing = merged.get(contactId);
          if (!existing) {
            merged.set(contactId, { ...lead });
            return;
          }

          const mergedScore = Math.max(existing.matchScore10, lead.matchScore10);
          merged.set(contactId, {
            ...existing,
            matchScore10: mergedScore,
            matchBand: getMatchBand(mergedScore) || existing.matchBand,
            confidenceScore: Math.max(existing.confidenceScore, lead.confidenceScore),
            confidenceBand:
              existing.confidenceScore >= lead.confidenceScore ? existing.confidenceBand : lead.confidenceBand,
            matchTags: mergeTags(existing.matchTags, lead.matchTags),
            matchSources: mergeSources(existing.matchSources, lead.matchSources),
            sourceDates: mergeDates(existing.sourceDates, lead.sourceDates),
            chipUrgency: mergeUrgency(existing.chipUrgency, lead.chipUrgency),
            summary: existing.summary || lead.summary,
            ownerId: existing.ownerId || lead.ownerId,
            ownerName: existing.ownerName || lead.ownerName,
            ownerSource: existing.ownerId || existing.ownerName ? existing.ownerSource : lead.ownerSource,
          });
        });
      });
      return [...merged.values()];
    };

    const mergeCompanyPools = (chips: Array<Exclude<HuntChipValue, "alle">>) => {
      const merged = new Map<string, CompanyMatchLead>();
      chips.forEach((chip) => {
        companyPools[chip].forEach((lead, companyId) => {
          const existing = merged.get(companyId);
          if (!existing) {
            merged.set(companyId, { ...lead });
            return;
          }

          const mergedScore = Math.max(existing.matchScore10, lead.matchScore10);
          merged.set(companyId, {
            ...existing,
            matchScore10: mergedScore,
            matchBand: getMatchBand(mergedScore) || existing.matchBand,
            confidenceScore: Math.max(existing.confidenceScore, lead.confidenceScore),
            confidenceBand:
              existing.confidenceScore >= lead.confidenceScore ? existing.confidenceBand : lead.confidenceBand,
            matchTags: mergeTags(existing.matchTags, lead.matchTags),
            matchSources: mergeSources(existing.matchSources, lead.matchSources),
            sourceDates: mergeDates(existing.sourceDates, lead.sourceDates),
            chipUrgency: mergeUrgency(existing.chipUrgency, lead.chipUrgency),
            summary: existing.summary || lead.summary,
            ownerId: existing.ownerId || lead.ownerId,
            ownerName: existing.ownerName || lead.ownerName,
            ownerSource: existing.ownerId || existing.ownerName ? existing.ownerSource : lead.ownerSource,
          });
        });
      });
      return [...merged.values()];
    };

    const mergeRequestPools = () => [...requestPools.foresporsler.values()].filter((lead) => lead.matchScore10 >= 4);

    const contactResults =
      jaktChip === "alle" ? mergeContactPools(chipPoolKeys) : [...contactPools[jaktChip as Exclude<HuntChipValue, "alle">].values()];
    const companyResults =
      jaktChip === "alle" ? mergeCompanyPools(chipPoolKeys) : [...companyPools[jaktChip as Exclude<HuntChipValue, "alle">].values()];
    const requestResults =
      jaktChip === "alle"
        ? mergeRequestPools()
        : jaktChip === "foresporsler"
          ? [...requestPools.foresporsler.values()]
          : [];

    const allLeads = [...contactResults, ...companyResults, ...requestResults];
    const leads = allLeads
      .filter((lead) => matchesMatchLeadOwnerFilter(lead.ownerId, matchOwnerFilter))
      .sort((left, right) => {
        if (right.matchScore10 !== left.matchScore10) return right.matchScore10 - left.matchScore10;
        if (right.confidenceScore !== left.confidenceScore) return right.confidenceScore - left.confidenceScore;

        const hotListCompare = compareByHotList(left as any, right as any);
        if (hotListCompare !== 0) return hotListCompare;

        if (right.chipUrgency !== left.chipUrgency) return right.chipUrgency - left.chipUrgency;

        return left.name.localeCompare(right.name, "nb");
      });

    let emptyState: string | null = null;
    if (leads.length === 0) {
      if (allLeads.length > 0 && matchOwnerFilter !== "all") {
        emptyState = "Ingen match-treff for valgt eier akkurat nå.";
      } else {
        switch (jaktChip) {
          case "foresporsler":
            emptyState = activeRequests.length === 0
              ? "Ingen aktive forespørsler siste 45 dager akkurat nå."
              : `Ingen aktive forespørsler er synlige for ${selectedConsultantFirstName} med dagens søk akkurat nå.`;
            break;
          case "finn":
            emptyState = `Ingen Finn-annonser matcher ${selectedConsultantFirstName} sin tekniske profil akkurat nå.`;
            break;
          case "siste_aktivitet":
            emptyState = `Ingen kontakter med nylig aktivitet matcher ${selectedConsultantFirstName} sin tekniske profil akkurat nå.`;
            break;
          case "innkjoper":
            emptyState = `Ingen aktive innkjøpere matcher ${selectedConsultantFirstName} sin tekniske profil akkurat nå.`;
            break;
          case "kunder":
            emptyState = `Ingen kundeselskaper med teknisk DNA matcher ${selectedConsultantFirstName} akkurat nå.`;
            break;
          case "cold_call":
            emptyState = `Ingen cold call-treff matcher ${selectedConsultantFirstName} sin tekniske profil akkurat nå.`;
            break;
          case "alle":
          default:
            emptyState = `Ingen tekniske match-treff for ${selectedConsultantFirstName} akkurat nå.`;
            break;
        }
      }
    }

    return {
      allLeads,
      leads,
      emptyState,
    };
  }, [
    companyTechProfiles,
    contacts,
    jaktChip,
    matchBaseContacts,
    matchOwnerFilter,
    requests,
    searchTerm,
    selectedConsultant,
    selectedConsultantFirstName,
  ]);

  const matchOwnerOptions = useMemo(() => {
    if (!selectedConsultant) {
      return {
        owners: [] as Array<{ value: string; label: string }>,
        hasUnassigned: false,
      };
    }

    const owners = new Map<string, string>();
    let hasUnassigned = false;

    matchResults.allLeads.forEach((lead) => {
      if (lead.ownerId) owners.set(lead.ownerId, getMatchLeadOwnerLabel(lead.ownerId, lead.ownerName));
      else hasUnassigned = true;
    });

    return {
      owners: Array.from(owners.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((left, right) => left.label.localeCompare(right.label, "nb")),
      hasUnassigned,
    };
  }, [matchResults.allLeads, selectedConsultant]);

  useEffect(() => {
    if (!selectedConsultant || matchOwnerFilter === "all") return;

    const validFilters = new Set(matchOwnerOptions.owners.map((owner) => owner.value));
    if (matchOwnerOptions.hasUnassigned) validFilters.add(MATCH_OWNER_FILTER_NONE);
    if (!validFilters.has(matchOwnerFilter)) {
      setMatchOwnerFilter("all");
    }
  }, [matchOwnerFilter, matchOwnerOptions, selectedConsultant]);

  const sorted = useMemo(() => {
    if (selectedConsultant) return [] as NormalizedContact[];

    const arr = [...filteredContacts];
    const d = sort.dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sort.field) {
        case "name":
          return d * `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "nb");
        case "signal": {
          const leftRank = a.signal ? SIGNAL_ORDER[a.signal] : SIGNALS.length + 1;
          const rightRank = b.signal ? SIGNAL_ORDER[b.signal] : SIGNALS.length + 1;
          return d * (leftRank - rightRank);
        }
        case "company":
          return d * a.company.localeCompare(b.company, "nb");
        case "title":
          return d * a.title.localeCompare(b.title, "nb");
        case "owner":
          return d * a.eier.localeCompare(b.eier, "nb");
        case "last_activity":
          if (!a.lastActivityAt && !b.lastActivityAt) return 0;
          if (!a.lastActivityAt) return 1;
          if (!b.lastActivityAt) return -1;
          return d * a.lastActivityAt.localeCompare(b.lastActivityAt);
        case "priority":
          return compareByPriority(a, b, sort.dir);
        case "tags": {
          const aCount = mergeTechnologyTags(a.contactTechnologyTags, a.companyTechnologyTags, a.requestTechnologyTags).length;
          const bCount = mergeTechnologyTags(b.contactTechnologyTags, b.companyTechnologyTags, b.requestTechnologyTags).length;
          return d * (aCount - bCount);
        }
        case "finn": {
          const aFinn = a.hasMarkedsradar ? 1 : 0;
          const bFinn = b.hasMarkedsradar ? 1 : 0;
          return d * (aFinn - bFinn);
        }
        default:
          return 0;
      }
    });
    return arr;
  }, [filteredContacts, selectedConsultant, sort]);

  const visibleMatchLeads = useMemo(() => {
    if (!selectedConsultant) return [] as MatchLead[];

    const leads = [...matchResults.leads];
    if (huntSort.field === "default") return leads;

    const tempToNum = (temperature?: string) =>
      temperature === "hett" ? 4 : temperature === "lovende" ? 3 : temperature === "mulig" ? 2 : temperature === "sovende" ? 1 : 0;

    leads.sort((left, right) => {
      let diff = 0;
      if (huntSort.field === "match") {
        diff = (left.matchScore10 ?? 0) - (right.matchScore10 ?? 0);
      } else {
        const leftTemp = isContactMatchLead(left) ? left.temperature : isRequestMatchLead(left) ? left.temperature : undefined;
        const rightTemp = isContactMatchLead(right) ? right.temperature : isRequestMatchLead(right) ? right.temperature : undefined;
        diff = tempToNum(leftTemp) - tempToNum(rightTemp);
      }
      return huntSort.dir === "desc" ? -diff : diff;
    });

    return leads;
  }, [huntSort, matchResults.leads, selectedConsultant]);

  const hasVisibleResults = selectedConsultant ? visibleMatchLeads.length > 0 : sorted.length > 0;
  const visibleResultCount = selectedConsultant ? visibleMatchLeads.length : filteredContacts.length;

  const handleToggle = useCallback(
    (contact: {
      id: string;
      email: string;
      cvEmail: boolean | null;
      callList: boolean | null;
      mailchimpStatus: string | null;
    }, field: "cv_email" | "call_list", newValue: boolean) => {
      if (field === "cv_email" && newValue && !contactHasEmail(contact)) {
        toast.error(CONTACT_CV_EMAIL_REQUIRED_MESSAGE);
        return;
      }

      const key = `${contact.id}-${field}`;
      const label = field === "cv_email" ? "CV-Epost" : "Innkjøper";
      const message = newValue ? `${label} aktivert` : `${label} deaktivert`;

      if (pendingToggles.current[key]) {
        clearTimeout(pendingToggles.current[key]);
        delete pendingToggles.current[key];
      }

      updateCachedContactFields(contact.id, { [field]: newValue });

      const timeout = setTimeout(async () => {
        delete pendingToggles.current[key];
        const { error } = await supabase
          .from("contacts")
          .update({ [field]: newValue } as any)
          .eq("id", contact.id);

        if (error) {
          updateCachedContactFields(contact.id, { [field]: !newValue });
          toast.error("Kunne ikke oppdatere");
          return;
        }

        if (field === "cv_email") {
          supabase.functions
            .invoke("mailchimp-sync", {
              body: { action: "sync-contact", contactId: contact.id },
            })
            .then(({ data, error: mailchimpError }) => {
              if (mailchimpError) {
                console.error("Mailchimp sync feilet:", mailchimpError);
                toast.error("Mailchimp-synk feilet");
              } else {
                toast.success(`Mailchimp: ${data?.status || "synkronisert"}`);
              }
            });
        }

        await Promise.all([
          invalidateDesignLabQueries(),
          queryClient.invalidateQueries({ queryKey: crmQueryKeys.contacts.detail(contact.id) }),
          queryClient.invalidateQueries({ queryKey: crmQueryKeys.contacts.all() }),
        ]);
      }, 10000);

      pendingToggles.current[key] = timeout;

      toast(message, {
        duration: 10000,
        action: {
          label: "Angre",
          onClick: () => {
            clearTimeout(pendingToggles.current[key]);
            delete pendingToggles.current[key];
            updateCachedContactFields(contact.id, { [field]: !newValue });
          },
        },
      });
    },
    [invalidateDesignLabQueries, queryClient, updateCachedContactFields],
  );

  const handleConsultantToggle = useCallback((consultantId: number) => {
    setSelectedConsultantId((current) => {
      const next = current === consultantId ? null : consultantId;
      setHuntSort({ field: "default", dir: "desc" });
      setJaktChip("alle");
      setMatchOwnerFilter("all");
      if (next !== current) {
        setSelectedId(null);
      }
      return next;
    });
  }, []);

  const handleJaktChipSelect = useCallback((value: HuntChipValue) => {
    setJaktChip(value);
    setHuntSort({ field: "default", dir: "desc" });
    setSelectedId(null);
  }, []);

  const toggleHuntSort = useCallback((field: "match" | "varme") => {
    setHuntSort((current) =>
      current.field === field
        ? { field, dir: current.dir === "desc" ? "asc" : "desc" }
        : { field, dir: "desc" },
    );
  }, []);

  const getMatchLeadHref = useCallback((lead: MatchLead) => {
    if (isContactMatchLead(lead)) return `/design-lab/kontakter?contact=${lead.id}`;
    if (isRequestMatchLead(lead)) return `/foresporsler?id=${lead.requestId}`;
    return `/design-lab/selskaper?company=${lead.companyId}`;
  }, []);

  const handleMatchLeadSelect = useCallback(
    (lead: MatchLead) => {
      if (isContactMatchLead(lead)) {
        setSelectedId((current) => (current === lead.id ? null : lead.id));
        return;
      }
      navigate(getMatchLeadHref(lead));
    },
    [getMatchLeadHref, navigate],
  );

  const sel = selectedId ? (contacts.find((c) => c.id === selectedId) ?? null) : null;

  // Derived companies for command palette
  const companiesList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    contacts.forEach((c) => {
      if (c.companyId && c.company) {
        const existing = map.get(c.companyId);
        if (existing) existing.count++;
        else map.set(c.companyId, { id: c.companyId, name: c.company, count: 1 });
      }
    });
    return Array.from(map.values()).map((c) => ({ id: c.id, name: c.name, contactCount: c.count }));
  }, [contacts]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (cmdOpen) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!sorted.length) return;
        e.preventDefault();
        const idx = sorted.findIndex((c) => c.id === selectedId);
        const next = e.key === "ArrowDown" ? Math.min(idx + 1, sorted.length - 1) : Math.max(idx - 1, 0);
        setSelectedId(sorted[next].id);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [cmdOpen, sorted, selectedId]);

  /* ═══ RENDER ═══ */
  return (
    <div
      className="flex h-screen overflow-hidden select-none"
      style={{
        fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
        background: C.bg,
      }}
    >
      <DesignLabSidebar navigate={navigate} signOut={signOut} user={user} activePath="/design-lab/kontakter" />

      {/* ═══ MAIN ═══ */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ ...getDesignLabTextSizeStyle(textSize), background: C.appBg }}>
        {/* Header bar */}
        <header
          className="flex items-center justify-between px-6 shrink-0"
          style={{ height: 40, borderBottom: `1px solid ${C.border}` }}
        >
          <div className="flex items-baseline gap-2.5">
            <h1 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Kontakter</h1>
            <span style={{ fontSize: 13, color: C.textGhost, fontWeight: 500 }}>
              · {visibleResultCount}
            </span>
          </div>
          <div className="flex items-center gap-2" />
        </header>

        {/* Filters bar */}
        <div className="shrink-0 space-y-0" style={{ borderBottom: `1px solid ${C.border}`, padding: "8px 24px 10px" }}>
          {!selectedConsultant ? (
            <>
              <DesignLabFilterRow label="EIER" options={ownerOptions} value={ownerFilter} onChange={setOwnerFilter} />
              <DesignLabFilterRow label="SIGNAL" options={["Alle", ...SIGNALS]} value={signalFilter} onChange={setSignalFilter} />
              <div className="flex items-center justify-between">
                <DesignLabFilterRow
                  label="TYPE"
                  options={[...TYPES]}
                  value={typeFilter}
                  onChange={(v) => setTypeFilter(v as TypeFilter)}
                />
                {(ownerFilter !== "Alle" || signalFilter !== "Alle" || typeFilter !== "Alle") && (
                  <DesignLabActionButton
                    variant="ghost"
                    onClick={() => {
                      setOwnerFilter("Alle");
                      setSignalFilter("Alle");
                      setTypeFilter("Alle");
                    }}
                  >
                    <X style={{ width: 12, height: 12 }} /> Nullstill
                  </DesignLabActionButton>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                    Matcher for {selectedConsultant.navn}
                  </p>
                  <p style={{ fontSize: 12, color: C.textFaint }}>
                    {JAKT_CHIP_HELP_TEXT[jaktChip]}
                  </p>
                </div>
                <DesignLabActionButton
                  variant="ghost"
                  onClick={() => handleConsultantToggle(selectedConsultant.id)}
                >
                  <X style={{ width: 12, height: 12 }} /> Vis alle kontakter
                </DesignLabActionButton>
              </div>
              <div className="flex items-start justify-between gap-6">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <DesignLabControlLabel>EIER</DesignLabControlLabel>
                    <DesignLabMatchFilterChip active={matchOwnerFilter === "all"} onClick={() => setMatchOwnerFilter("all")}>
                      Alle
                    </DesignLabMatchFilterChip>
                    {matchOwnerOptions.owners.map((owner) => (
                      <DesignLabMatchFilterChip
                        key={owner.value}
                        active={matchOwnerFilter === owner.value}
                        onClick={() => setMatchOwnerFilter(owner.value)}
                      >
                        {owner.label}
                      </DesignLabMatchFilterChip>
                    ))}
                    {matchOwnerOptions.hasUnassigned && (
                      <DesignLabMatchFilterChip
                        active={matchOwnerFilter === MATCH_OWNER_FILTER_NONE}
                        onClick={() => setMatchOwnerFilter(MATCH_OWNER_FILTER_NONE)}
                      >
                        Uten eier
                      </DesignLabMatchFilterChip>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DesignLabControlLabel>MATCH</DesignLabControlLabel>
                    {JAKT_CHIPS.map((chip) => (
                      <DesignLabMatchFilterChip
                        key={chip.value}
                        active={jaktChip === chip.value}
                        onClick={() => handleJaktChipSelect(chip.value)}
                      >
                        {chip.label}
                      </DesignLabMatchFilterChip>
                    ))}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: C.textFaint, fontWeight: 500, whiteSpace: "nowrap" }}>
                  {visibleResultCount} treff
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Available consultants bar */}
        {sortedConsultants.length > 0 && (
          <div className="shrink-0" style={{ borderBottom: `1px solid ${C.border}`, padding: "8px 24px 10px" }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: "#5C636E", marginBottom: 6 }}>
              Tilgjengelig for oppdrag
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {sortedConsultants.map((con) => {
                const isSelected = selectedConsultantId === con.id;
                const meta = getConsultantAvailabilityMeta(con.tilgjengelig_fra);
                const nameParts = con.navn.split(" ");
                const initials = (nameParts[0]?.[0] || "") + (nameParts[nameParts.length - 1]?.[0] || "");
                const toneColor = isSelected
                  ? C.onAccent
                  : meta.tone === "ready"
                    ? C.dotSuccess
                    : meta.tone === "soon"
                      ? C.warning
                      : C.textFaint;
                return (
                  <button
                    key={con.id ?? con.navn}
                    type="button"
                    onClick={() => handleConsultantToggle(con.id)}
                    className="flex items-center gap-2.5 shrink-0 rounded-lg transition-colors"
                    style={{
                      border: `1px solid ${isSelected ? C.accent : C.border}`,
                      padding: "8px 14px",
                      background: isSelected ? C.accent : C.panel,
                    }}
                  >
                    <div
                      className="flex items-center justify-center rounded-full shrink-0"
                      style={{
                        width: 36,
                        height: 36,
                        background: isSelected ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.06)",
                        fontSize: 12,
                        fontWeight: 600,
                        color: isSelected ? C.onAccent : C.text,
                      }}
                    >
                      {initials.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p
                        className="truncate"
                        style={{ fontSize: 13, fontWeight: 500, color: isSelected ? C.onAccent : C.text, maxWidth: 140 }}
                      >
                        {con.navn}
                      </p>
                      <p style={{ fontSize: 12, color: toneColor, fontWeight: 500 }}>{meta.label}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Content: list + detail */}
        <div className="flex-1 min-h-0 flex">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={38} minSize={24} maxSize={60}>
              <div className="h-full overflow-y-auto" style={{ scrollbarColor: `${C.borderStrong} ${C.surfaceAlt}` }}>
                {selectedConsultant ? (
                  <>
                     <div
                      className="sticky top-0 z-10"
                      style={{
                        background: C.surfaceAlt,
                        borderBottom: `1px solid ${C.border}`,
                      }}
                    >
                      <div
                        className="grid items-center"
                        style={{
                          gridTemplateColumns: "minmax(220px,1.6fr) minmax(140px,1fr) minmax(140px,1fr) 140px 120px 110px",
                          height: 32,
                          paddingLeft: 16,
                          paddingRight: 16,
                        }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted }}>Lead</span>
                        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted }}>Selskap</span>
                        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted }}>Kilde</span>
                        <button
                          onClick={() => toggleHuntSort("match")}
                          className="flex items-center gap-0.5 transition-colors"
                          style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted }}
                        >
                          Match
                          {huntSort.field === "match"
                            ? huntSort.dir === "asc"
                              ? <ChevronUp style={{ width: 12, height: 12 }} />
                              : <ChevronDown style={{ width: 12, height: 12 }} />
                            : <ArrowUpDown style={{ width: 12, height: 12 }} />}
                        </button>
                        <button
                          onClick={() => toggleHuntSort("varme")}
                          className="flex items-center gap-0.5 transition-colors"
                          style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted }}
                        >
                          Varme
                          {huntSort.field === "varme"
                            ? huntSort.dir === "asc"
                              ? <ChevronUp style={{ width: 12, height: 12 }} />
                              : <ChevronDown style={{ width: 12, height: 12 }} />
                            : <ArrowUpDown style={{ width: 12, height: 12 }} />}
                        </button>
                        <span className="text-right" style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted }}>
                          Sist
                        </span>
                      </div>
                    </div>
                    {isLoading || isLoadingParity ? (
                      <div style={{ textAlign: "center", padding: "48px 0", color: C.textFaint, fontSize: 13 }}>
                        Laster kontakter…
                      </div>
                    ) : !hasVisibleResults ? (
                      <div style={{ textAlign: "center", padding: "48px 0", color: C.textFaint, fontSize: 13 }}>
                        {matchResults.emptyState}
                      </div>
                    ) : (
                      visibleMatchLeads.map((lead) => {
                        const isActive = isContactMatchLead(lead) && selectedId === lead.id;
                        const leadDate = getMatchLeadDate(lead);
                        const confidence = getConfidenceConfig(lead.confidenceBand);
                        const requestTemp = isRequestMatchLead(lead) ? lead.temperature : undefined;
                        const heatColor = isContactMatchLead(lead)
                          ? getHeatBarColor(lead.heatResult)
                          : requestTemp === "hett"
                            ? C.danger
                            : requestTemp === "lovende"
                              ? C.heatPromising
                              : requestTemp === "mulig"
                                ? C.heatPossible
                                : "transparent";
                        const heatLabel = isContactMatchLead(lead)
                          ? lead.temperature
                          : isRequestMatchLead(lead) && lead.temperature
                            ? lead.temperature
                            : null;

                        return (
                          <div
                            key={lead.leadKey}
                            onClick={() => handleMatchLeadSelect(lead)}
                            className="grid items-center cursor-pointer"
                            style={{
                              gridTemplateColumns: "minmax(220px,1.6fr) minmax(140px,1fr) minmax(140px,1fr) 140px 120px 110px",
                              minHeight: 48,
                              paddingLeft: 16,
                              paddingRight: 16,
                              borderBottom: `1px solid ${C.borderLight}`,
                              background: isActive ? C.activeBg : "transparent",
                              boxShadow: `inset 3px 0 0 ${heatColor}`,
                            }}
                            onMouseEnter={(e) => {
                              if (!isActive) e.currentTarget.style.background = C.hoverBg;
                            }}
                            onMouseLeave={(e) => {
                              if (!isActive) e.currentTarget.style.background = "transparent";
                            }}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="truncate" style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                                  {lead.name}
                                </span>
                                {isCompanyMatchLead(lead) && (
                                  <span style={{ fontSize: 10, color: C.textFaint, flexShrink: 0 }}>Selskap</span>
                                )}
                                {isRequestMatchLead(lead) && (
                                  <span style={{ fontSize: 10, color: C.textFaint, flexShrink: 0 }}>Forespørsel</span>
                                )}
                              </div>
                              <p className="truncate" style={{ fontSize: 11, color: C.textMuted }}>
                                {isContactMatchLead(lead)
                                  ? lead.title || lead.summary
                                  : isRequestMatchLead(lead)
                                    ? lead.contactName || lead.summary
                                    : lead.preferredContactName || lead.summary}
                              </p>
                            </div>
                            <div className="min-w-0">
                              <p className="truncate" style={{ fontSize: 12, color: C.textMuted }}>
                                {isContactMatchLead(lead)
                                  ? lead.companyName
                                  : isRequestMatchLead(lead)
                                    ? lead.contactTitle || lead.companyName
                                    : lead.status || lead.companyName}
                              </p>
                            </div>
                            <div className="min-w-0">
                              <p className="truncate" style={{ fontSize: 11, color: C.textMuted }}>
                                {lead.matchSources.map(getMatchSourceLabel).join(" · ")}
                              </p>
                              <p className="truncate" style={{ fontSize: 11, color: C.textFaint }}>
                                {lead.matchTags.slice(0, 3).join(", ")}
                              </p>
                            </div>
                            <div className="min-w-0">
                              <p style={{ fontSize: 12, fontWeight: 600, color: C.text, display: "flex", alignItems: "center", gap: 6 }}>
                                <span
                                  className={getConsultantMatchScoreColor(lead.matchScore10)}
                                  style={{ width: 8, height: 8, borderRadius: 999, display: "inline-block" }}
                                />
                                Match {lead.matchScore10}/10
                              </p>
                              <p className="truncate" style={{ fontSize: 10, color: confidence.tone }}>
                                {confidence.label}
                              </p>
                            </div>
                            <div className="min-w-0">
                              {heatLabel ? (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 500,
                                    color: heatColor,
                                    textTransform: "capitalize",
                                  }}
                                >
                                  {heatLabel}
                                </span>
                              ) : (
                                <span style={{ fontSize: 11, color: C.textFaint }}>Ingen heat</span>
                              )}
                            </div>
                            <div className="text-right" style={{ fontSize: 11, color: C.textFaint }}>
                              {leadDate ? relativeDate(leadDate) : ""}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </>
                ) : (
                  <>
                    <div
                      className="sticky top-0 z-10"
                      style={{
                        background: C.surfaceAlt,
                        borderBottom: `1px solid ${C.border}`,
                      }}
                    >
                    <div
                      className="grid items-center"
                      style={{
                        gridTemplateColumns: "minmax(180px,1.4fr) 120px 48px minmax(140px,1.4fr) minmax(140px,1.5fr) 132px 96px",
                        height: 32,
                        paddingLeft: 16,
                        paddingRight: 16,
                      }}
                    >
                      <DesignLabColumnHeader label="Navn" field="name" sort={sort} onSort={toggleSort} />
                      <DesignLabColumnHeader label="Signal" field="signal" sort={sort} onSort={toggleSort} />
                      <DesignLabColumnHeader label="Finn" field="finn" sort={sort} onSort={toggleSort} className="justify-center" />
                      <DesignLabColumnHeader label="Selskap" field="company" sort={sort} onSort={toggleSort} />
                      <DesignLabColumnHeader label="Stilling" field="title" sort={sort} onSort={toggleSort} />
                      <DesignLabColumnHeader label="Tags" field="tags" sort={sort} onSort={toggleSort} />
                      <DesignLabColumnHeader label="Siste akt." field="last_activity" sort={sort} onSort={toggleSort} className="justify-end" />
                    </div>
                    </div>
                    {isLoading || isLoadingParity ? (
                      <div style={{ textAlign: "center", padding: "48px 0", color: C.textFaint, fontSize: 13 }}>
                        Laster kontakter…
                      </div>
                    ) : !hasVisibleResults ? (
                      <div style={{ textAlign: "center", padding: "48px 0", color: C.textFaint, fontSize: 13 }}>
                        Ingen kontakter funnet
                      </div>
                    ) : (
                      sorted.map((c) => {
                        const isActive = selectedId === c.id;
                        return (
                          <div
                            key={c.id}
                            onClick={() => setSelectedId(isActive ? null : c.id)}
                            className="grid items-center cursor-pointer group"
                            style={{
                              gridTemplateColumns: "minmax(180px,1.4fr) 120px 48px minmax(140px,1.4fr) minmax(140px,1.5fr) 132px 96px",
                              minHeight: 38,
                              paddingLeft: 16,
                              paddingRight: 16,
                              paddingTop: 4,
                              paddingBottom: 4,
                              borderBottom: `1px solid ${C.borderLight}`,
                              background: isActive ? C.activeBg : "transparent",
                              boxShadow: `inset 3px 0 0 ${getHeatBarColor(c.heatResult)}`,
                            }}
                            onMouseEnter={(e) => {
                              if (!isActive) e.currentTarget.style.background = C.hoverBg;
                            }}
                            onMouseLeave={(e) => {
                              if (!isActive) e.currentTarget.style.background = isActive ? C.activeBg : "transparent";
                            }}
                          >
                            <div className="min-w-0 flex items-center gap-2">
                              <span className="truncate" style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                                {c.firstName} {c.lastName}
                              </span>
                              {c.heatResult.needsReview && (
                                <span
                                  title="Trenger oppfølging"
                                  style={{ fontSize: 11, fontWeight: 700, color: C.warning, flexShrink: 0 }}
                                >
                                  !
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {c.signal ? (
                                <DesignLabSignalBadge signal={c.signal as Signal} />
                              ) : (
                                <span style={{ fontSize: 11, color: C.textGhost }}>—</span>
                              )}
                            </div>
                            <div
                              className="flex items-center justify-center"
                              title={
                                c.hasMarkedsradar
                                  ? "Selskapet har annonsert etter embedded på Finn.no siste 90 dager"
                                  : ""
                              }
                            >
                              {c.hasMarkedsradar && (
                                <img
                                  src={finnIcon}
                                  alt="Finn"
                                  style={{
                                    width: 14,
                                    height: 14,
                                    filter: "grayscale(1) opacity(0.65)",
                                    objectFit: "contain",
                                  }}
                                />
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="truncate block" style={{ fontSize: 12, color: C.textMuted }}>{c.company}</span>
                            </div>
                            <span className="truncate" style={{ fontSize: 12, color: C.textMuted }}>{c.title}</span>
                            <div className="flex items-center gap-1.5 min-w-0" onClick={(event) => event.stopPropagation()}>
                              <DesignLabFilterButton
                                type="button"
                                active={Boolean(c.cvEmail)}
                                activeColors={DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS}
                                inactiveColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}
                                inactiveHoverColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_HOVER_COLORS}
                                disabled={c.cvEmail && (c.mailchimpStatus === "unsubscribed" || c.mailchimpStatus === "cleaned")}
                                title={
                                  c.cvEmail && (c.mailchimpStatus === "unsubscribed" || c.mailchimpStatus === "cleaned")
                                    ? "Kontakten har avmeldt seg via Mailchimp og kan ikke re-abonneres"
                                    : c.cvEmail
                                      ? "CV-Epost aktiv"
                                      : contactHasEmail(c)
                                        ? "Aktiver CV-Epost"
                                        : CONTACT_CV_EMAIL_REQUIRED_MESSAGE
                                }
                                onClick={() => {
                                  if (c.cvEmail && (c.mailchimpStatus === "unsubscribed" || c.mailchimpStatus === "cleaned")) {
                                    toast.info("Kontakten har avmeldt seg via Mailchimp og kan ikke re-abonneres.");
                                    return;
                                  }
                                  handleToggle(
                                    {
                                      id: c.id,
                                      email: c.email,
                                      cvEmail: c.cvEmail,
                                      callList: c.callList,
                                      mailchimpStatus: c.mailchimpStatus,
                                    },
                                    "cv_email",
                                    !c.cvEmail,
                                  );
                                }}
                              >
                                {c.cvEmail && (c.mailchimpStatus === "unsubscribed" || c.mailchimpStatus === "cleaned")
                                  ? "CV ✗"
                                  : "CV"}
                              </DesignLabFilterButton>
                              <DesignLabFilterButton
                                type="button"
                                active={Boolean(c.callList)}
                                activeColors={DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS}
                                inactiveColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}
                                inactiveHoverColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_HOVER_COLORS}
                                title={c.callList ? "Innkjøper aktiv" : "Aktiver innkjøper"}
                                onClick={() =>
                                  handleToggle(
                                    {
                                      id: c.id,
                                      email: c.email,
                                      cvEmail: c.cvEmail,
                                      callList: c.callList,
                                      mailchimpStatus: c.mailchimpStatus,
                                    },
                                    "call_list",
                                    !c.callList,
                                  )
                                }
                              >
                                Innkjøper
                              </DesignLabFilterButton>
                            </div>
                            <span
                              className="text-right"
                              title={c.lastActivityAt ? format(new Date(c.lastActivityAt), "d. MMM yyyy", { locale: nb }) : ""}
                              style={{ fontSize: 12, color: C.textFaint }}
                            >
                              {c.daysSince < 999 ? relTime(c.daysSince) : ""}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </>
                )}
              </div>
            </ResizablePanel>
            <ResizableHandle
              withHandle
              className="bg-transparent hover:bg-[rgba(0,0,0,0.04)] transition-colors data-[resize-handle-active]:bg-[rgba(94,106,210,0.12)]"
            />
            <ResizablePanel defaultSize={62} minSize={34}>
              {sel ? (
                <div
                  className="h-full flex flex-col"
                  style={{ background: C.panel, borderLeft: `1px solid ${C.borderLight}` }}
                >
                  <div
                    className="shrink-0 flex items-center justify-end px-4"
                    style={{ height: 32 }}
                  >
                    <DesignLabIconButton onClick={() => setSelectedId(null)} title="Lukk kontaktpanel">
                      <X style={{ width: 16, height: 16 }} />
                    </DesignLabIconButton>
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 py-5 dl-v8-theme">
                    <RenderErrorBoundary
                      resetKey={sel.id}
                      fallbackMessage="Kunne ikke laste kontaktkortet. Prøv en annen kontakt eller last siden på nytt."
                    >
                      <ContactCardContent
                        contactId={sel.id}
                        editable
                        enableProfileEditMode
                        headerPaddingTop={12}
                        onDataChanged={() => {
                          void invalidateDesignLabQueries();
                        }}
                        defaultHidden={{
                          techDna: true,
                          notes: true,
                          consultantMatch: true,
                          linkedinIfEmpty: true,
                          locationsIfEmpty: true,
                        }}
                      />
                    </RenderErrorBoundary>
                  </div>
                </div>
              ) : (
                <div
                  className="flex h-full items-center justify-center"
                  style={{ borderLeft: `1px solid ${C.borderLight}`, background: C.appBg }}
                >
                  <p style={{ fontSize: 13, color: C.textFaint }}>
                    Trykk ⌘K for å søke.
                  </p>
                </div>
              )}
            </ResizablePanel>
            <ResizableHandle
              withHandle
              className="bg-transparent hover:bg-[rgba(0,0,0,0.04)] transition-colors data-[resize-handle-active]:bg-[rgba(94,106,210,0.12)]"
            />
            <ResizablePanel defaultSize={0} minSize={0} maxSize={30}>
              <div className="h-full" style={{ background: C.appBg }} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </main>

      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        textSize={textSize}
        contacts={contacts.map((c) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          company: c.company,
          companyId: c.companyId,
          email: c.email,
          phone: c.phone,
          signal: c.signal,
          daysSince: c.daysSince,
        }))}
        companies={companiesList}
        selectedContact={
          sel
            ? { id: sel.id, firstName: sel.firstName, lastName: sel.lastName, email: sel.email, signal: sel.signal }
            : null
        }
        onSelectContact={(id) => {
          setSearch("");
          setSelectedId(id);
        }}
        onFilterByCompany={(name) => setSearch(name)}
        onResetSearch={search.trim() ? () => setSearch("") : undefined}
      />
    </div>
  );
}
