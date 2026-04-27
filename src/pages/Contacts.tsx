import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, ArrowUpDown, ChevronDown, Radio, Ban } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { BulkSignalModal } from "@/components/BulkSignalModal";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePersistentState } from "@/hooks/usePersistentState";
import { relativeDate } from "@/lib/relativeDate";
import { CONTACT_CV_EMAIL_REQUIRED_MESSAGE, contactHasEmail } from "@/lib/contactCvEligibility";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format, differenceInDays } from "date-fns";
import { nb } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";
import {
  TEMP_CONFIG,
  getHeatResult,
  getTaskStatus,
  getActivityStatus,
} from "@/lib/heatScore";
import { crmQueryKeys, crmSummaryQueryKeys, invalidateQueryGroup } from "@/lib/queryKeys";
import { mergeTechnologyTags } from "@/lib/technologyTags";
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
import {
  getContactMatchScore,
  getMatchBand,
  type ConfidenceBand,
  type MatchBand,
} from "@/lib/contactMatchScore";
import { getConsultantMatchScoreColor } from "@/lib/consultantMatches";
import { isEmployeeEndDatePassed } from "@/lib/employeeStatus";
import {
  MATCH_OWNER_FILTER_NONE,
  buildMatchLeadOwnerCandidate,
  getMatchLeadOwnerLabel,
  matchesMatchLeadOwnerFilter,
  resolveMatchLeadOwner,
  type MatchLeadOwnerSource,
} from "@/lib/matchLeadOwners";
import {
  GEO_FILTERS,
  contactMatchesGeoFilter,
  getGeoFilterDescription,
  normalizeGeoFilter,
  type GeoFilter,
} from "@/lib/companyGeoAreas";

type SortField = "name" | "company" | "title" | "signal" | "owner" | "last_activity" | "priority";
type SortDir = "asc" | "desc";
type HuntConsultant = Pick<
  Database["public"]["Tables"]["stacq_ansatte"]["Row"],
  "id" | "navn" | "status" | "tilgjengelig_fra" | "kompetanse" | "slutt_dato"
>;
type OwnerPreview = { id: string; full_name: string } | null;
type CompanyPreview = Pick<
  Database["public"]["Tables"]["companies"]["Row"],
  "id" | "name" | "address" | "city" | "zip_code" | "status" | "ikke_relevant" | "owner_id"
> & {
  profiles: OwnerPreview;
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
type CompanyMatchLead = MatchLeadBase & {
  leadType: "company";
  companyId: string;
  name: string;
  status: string | null;
  companyTechnologyTags: string[];
  preferredContactName?: string | null;
  preferredContactTitle?: string | null;
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
type CompanyTechLeadRow = {
  companyId: string;
  company: CompanyPreview | null;
  companyTechnologyTags: string[];
  sistFraFinn: string | null;
};
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"] & {
  companies: CompanyPreview | null;
  profiles: { id: string; full_name: string } | null;
  lastActivity: string | null;
  signal: string | null;
  openTasks: { count: number; overdue: boolean };
  heatScore: number;
  temperature: "hett" | "lovende" | "mulig" | "sovende";
  tier: 1 | 2 | 3 | 4;
  reasons: string[];
  needsReview: boolean;
  hasAktivForespørsel: boolean;
  hasTidligereForespørsel: boolean;
  daysSinceLastContact: number;
  contactTechnologyTags: string[];
  companyTechnologyTags: string[];
  requestTechnologyTags: string[];
  companyStatus: string | null;
  hasMarkedsradar: boolean;
};
type ContactMatchLead = ContactRow & MatchLeadBase & {
  leadType: "contact";
  name: string;
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

import {
  SIGNAL_OPTIONS,
  getEffectiveSignal,
  getSignalBadge,
  getSignalRank,
  upsertTaskSignalDescription,
} from "@/lib/categoryUtils";

const CHIP_BASE = "h-7 px-2.5 text-[0.75rem] rounded-[6px] border transition-colors cursor-pointer font-medium";
const CHIP_OFF = `${CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;
const CHIP_ON = `${CHIP_BASE} bg-[#E8ECF5] text-[#1A1C1F] border-[#C5CBE8] font-semibold`;

const JAKT_CHIPS: Array<{ value: HuntChipValue; label: string }> = [
  { value: "alle", label: "Alle" },
  { value: "foresporsler", label: "Forespørsler" },
  { value: "finn", label: "Finn annonser" },
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
  geografi: "Alle selskapene i kontaktlisten, sortert etter nærmeste sted mot konsulentens adresse/poststed.",
};

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
    case "geografi":
      return "Geografi";
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

const CONFIDENCE_CONFIG: Record<ConfidenceBand, { label: string; tone: string }> = {
  high: { label: "Høy evidens", tone: "text-emerald-700" },
  medium: { label: "Middels evidens", tone: "text-amber-700" },
  low: { label: "Lav evidens", tone: "text-muted-foreground" },
};

function getConfidenceConfig(confidenceBand: ConfidenceBand) {
  return CONFIDENCE_CONFIG[confidenceBand];
}

function isContactMatchLead(lead: MatchLead): lead is ContactMatchLead {
  return lead.leadType === "contact";
}

function isRequestMatchLead(lead: MatchLead): lead is RequestMatchLead {
  return lead.leadType === "request";
}

function isCompanyMatchLead(lead: MatchLead): lead is CompanyMatchLead {
  return lead.leadType === "company";
}

function getMatchLeadDate(lead: MatchLead): string | null {
  if (lead.sourceDates[0]) return lead.sourceDates[0];
  if (isContactMatchLead(lead)) return lead.lastActivity;
  return null;
}

const Contacts = () => {
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [selectedConsultantId, setSelectedConsultantId] = useState<number | null>(null);
  const [jaktChip, setJaktChip] = useState<HuntChipValue>("alle");
  type HuntSortField = "default" | "match" | "varme";
  const [huntSort, setHuntSort] = useState<{ field: HuntSortField; dir: SortDir }>({ field: "default", dir: "desc" });
  const [search, setSearch] = usePersistentState("stacq:contacts:search", "");
  const [ownerFilter, setOwnerFilter] = usePersistentState("stacq:contacts:ownerFilter", "all");
  const [matchOwnerFilter, setMatchOwnerFilter] = usePersistentState("stacq:contacts:matchOwnerFilter", "all");
  const [signalFilter, setSignalFilter] = usePersistentState("stacq:contacts:signalFilter", "all");
  const [typeFilter, setTypeFilter] = usePersistentState("stacq:contacts:typeFilter", "all");
  const [geoFilter, setGeoFilter] = usePersistentState<GeoFilter>("stacq:contacts:geoFilter", "Alle");
  const effectiveGeoFilter = normalizeGeoFilter(geoFilter);
  const [sort, setSort] = usePersistentState<{ field: SortField; dir: SortDir }>("stacq:contacts:sort", {
    field: "priority",
    dir: "desc",
  });
  const [hotListActive, setHotListActive] = usePersistentState("stacq:contacts:hotListActive", true);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  const activatePriorityMode = () => {
    if (!hotListActive) setHotListActive(true);
    setSort({ field: "priority", dir: "desc" });
  };

  const { data: contactsResult, isLoading } = useQuery({
    queryKey: crmQueryKeys.contacts.all(),
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("contacts")
        .select(
          "*, companies(id, name, address, city, zip_code, status, ikke_relevant, owner_id, profiles!companies_owner_id_fkey(id, full_name)), profiles!contacts_owner_id_fkey(id, full_name)",
          { count: "exact" },
        )
        .order("first_name")
        .limit(2000);
      if (error) throw error;

      const contactIds = new Set(data.map((c) => c.id));

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
            "company_id, sist_fra_finn, teknologier, companies!company_tech_profile_company_id_fkey(id, name, address, city, zip_code, status, ikke_relevant, owner_id, profiles!companies_owner_id_fkey(id, full_name))",
          )
          .not("company_id", "is", null)
          .limit(5000),
        supabase
          .from("foresporsler")
          .select(
            "id, selskap_id, kontakt_id, selskap_navn, sted, mottatt_dato, frist_dato, status, teknologier, companies!foresporsler_selskap_id_fkey(id, name, address, city, zip_code, status, ikke_relevant, owner_id, profiles!companies_owner_id_fkey(id, full_name)), contacts!foresporsler_kontakt_id_fkey(id, first_name, last_name, title)",
          )
          .not("kontakt_id", "is", null)
          .not("selskap_id", "is", null)
          .order("mottatt_dato", { ascending: false })
          .limit(5000),
      ]);

      // Last activity date map — only past activities count
      const lastActMap: Record<string, string> = {};
      const now = new Date().toISOString();
      (acts || []).forEach((a) => {
        if (a.contact_id && a.created_at <= now && !lastActMap[a.contact_id]) lastActMap[a.contact_id] = a.created_at;
      });

      // Signal: effective (expiry-aware) signal per contact
      const contactActsMap: Record<string, typeof acts> = {};
      const contactTasksMap: Record<string, typeof tasks> = {};
      (acts || []).forEach((a) => {
        if (a.contact_id) {
          if (!contactActsMap[a.contact_id]) contactActsMap[a.contact_id] = [];
          contactActsMap[a.contact_id]!.push(a);
        }
      });
      (tasks || []).forEach((t) => {
        if (t.contact_id && t.status !== "done") {
          if (!contactTasksMap[t.contact_id]) contactTasksMap[t.contact_id] = [];
          contactTasksMap[t.contact_id]!.push(t);
        }
      });

      const signalMap: Record<string, string> = {};
      for (const cid of contactIds) {
        const sig = getEffectiveSignal(
          (contactActsMap[cid] || []).map((a) => ({
            created_at: a.created_at,
            subject: a.subject!,
            description: a.description,
          })),
          (contactTasksMap[cid] || []).map((t) => ({
            created_at: t.created_at,
            updated_at: t.updated_at,
            title: t.title!,
            description: t.description,
            due_date: t.due_date,
            status: t.status,
          })),
        );
        if (sig) signalMap[cid] = sig;
      }

      // Open tasks count + overdue flag per contact
      const openTasksMap: Record<string, { count: number; overdue: boolean }> = {};
      const today = new Date().toISOString().slice(0, 10);
      (tasks || []).forEach((t) => {
        if (t.contact_id && t.status === "open") {
          if (!openTasksMap[t.contact_id]) openTasksMap[t.contact_id] = { count: 0, overdue: false };
          openTasksMap[t.contact_id].count++;
          if (t.due_date && t.due_date < today) openTasksMap[t.contact_id].overdue = true;
        }
      });

      const techProfileByCompanyId = new Map<string, CompanyTechLeadRow>();
      const normalizedCompanyTechProfiles: CompanyTechLeadRow[] = (companyTechProfiles || [])
        .filter((profile: any) => Boolean(profile?.company_id))
        .map((profile: any) => ({
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
        }));
      normalizedCompanyTechProfiles.forEach((profile) => {
        techProfileByCompanyId.set(profile.companyId, profile);
      });

      const normalizedRequests: RequestLeadRow[] = (requestRows || []).map((request: any) => ({
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
      }));

      const requestMap = new Map<string, RequestLeadRow[]>();
      normalizedRequests.forEach((request) => {
        if (!request.companyId) return;
        if (!requestMap.has(request.companyId)) requestMap.set(request.companyId, []);
        requestMap.get(request.companyId)?.push(request);
      });

      const rows: ContactRow[] = data.map((c) => {
        const lastActivity = lastActMap[c.id] || null;
        const signal = signalMap[c.id] || null;
        const openTasks = openTasksMap[c.id] || { count: 0, overdue: false };
        const isInnkjoper = !!c.call_list;
        const ikkeAktuellKontakt = !!(c as any).ikke_aktuell_kontakt;
        const techProfile = techProfileByCompanyId.get(c.company_id || "");
        const hasMarkedsradar = !!(
          techProfile?.sistFraFinn && differenceInDays(new Date(), new Date(techProfile.sistFraFinn)) <= 90
        );
        const daysSince = lastActivity ? differenceInDays(new Date(), new Date(lastActivity)) : 999;
        const companyTechnologyTags = techProfile?.companyTechnologyTags || [];
        const contactTechnologyTags = mergeTechnologyTags(c.teknologier || []);
        const companyRequests = requestMap.get(c.company_id || "") || [];
        const activeRequests = companyRequests.filter((request) => isActiveRequest(request.mottattDato, request.status));
        const hasAktivForespørsel = activeRequests.length > 0;
        const hasTidligereForespørsel =
          companyRequests.length > 0 &&
          companyRequests.some((request) => !isActiveRequest(request.mottattDato, request.status));
        const requestTechnologyTags = mergeTechnologyTags(
          ...activeRequests.map((request) => request.technologyTags),
        );

        // KES: finnes det aktivitet etter at signalet ble satt?
        const contactActs = contactActsMap[c.id] || [];
        const signalAct = contactActs.find((a: any) => {
          const cat = a.subject || "";
          return ["Behov nå", "Får fremtidig behov", "Får kanskje behov", "Ukjent om behov", "Ikke aktuelt"].includes(
            cat,
          );
        });
        const signalSetAt = signalAct ? new Date(signalAct.created_at) : null;
        const lastActDate = lastActivity ? new Date(lastActivity) : null;
        const kes = !!(signalSetAt && lastActDate && lastActDate > signalSetAt);

        // Task-status enum
        const contactTaskList = (contactTasksMap[c.id] || []).map((t: any) => ({
          due_date: t.due_date,
          status: t.status,
        }));
        const taskStatus = getTaskStatus(contactTaskList);
        const activityStatus = getActivityStatus(daysSince);

        const heatResult = getHeatResult({
          signal: signal || "",
          isInnkjoper,
          hasMarkedsradar,
          hasAktivForespørsel,
          hasOverdue: openTasks.overdue,
          daysSinceLastContact: daysSince,
          hasTidligereForespørsel,
          ikkeAktuellKontakt,
          ikkeRelevantSelskap: Boolean((c.companies as any)?.ikke_relevant),
          taskStatus,
          activityStatus,
          kes,
        });

        return {
          ...c,
          lastActivity,
          signal,
          openTasks,
          heatScore: heatResult.score,
          temperature: heatResult.temperature,
          tier: heatResult.tier,
          reasons: heatResult.reasons,
          needsReview: heatResult.needsReview,
          hasAktivForespørsel,
          hasTidligereForespørsel,
          daysSinceLastContact: daysSince,
          contactTechnologyTags,
          companyTechnologyTags,
          requestTechnologyTags,
          companyStatus: c.companies?.status || null,
          hasMarkedsradar,
        };
      });

      return {
        rows,
        totalCount: count ?? data.length,
        capped: data.length < (count ?? 0),
        companyTechProfiles: normalizedCompanyTechProfiles,
        requests: normalizedRequests,
      };
    },
  });

  const { data: huntConsultants = [], isLoading: huntConsultantsLoading } = useQuery({
    queryKey: ["contacts-hunt-consultants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stacq_ansatte")
        .select("id, navn, status, tilgjengelig_fra, kompetanse, slutt_dato")
        .in("status", ["AKTIV/SIGNERT", "Ledig"])
        .not("tilgjengelig_fra", "is", null);
      if (error) throw error;
      return sortHuntConsultants(((data || []) as HuntConsultant[]).filter((consultant) =>
        hasConsultantAvailability(consultant.tilgjengelig_fra) && !isEmployeeEndDatePassed(consultant.slutt_dato),
      ));
    },
  });

  const contacts = useMemo(() => contactsResult?.rows ?? [], [contactsResult]);
  const companyTechProfiles = useMemo(() => contactsResult?.companyTechProfiles ?? [], [contactsResult]);
  const requests = useMemo(() => contactsResult?.requests ?? [], [contactsResult]);
  const totalCount = contactsResult?.totalCount ?? 0;
  const capped = contactsResult?.capped ?? false;
  const selectedConsultant = useMemo(
    () => huntConsultants.find((consultant) => consultant.id === selectedConsultantId) ?? null,
    [huntConsultants, selectedConsultantId],
  );

  const pendingToggles = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const handleToggle = (contact: any, field: "cv_email" | "call_list", newValue: boolean) => {
    if (field === "cv_email" && newValue && !contactHasEmail(contact)) {
      toast.error(CONTACT_CV_EMAIL_REQUIRED_MESSAGE);
      return;
    }

    const key = `${contact.id}-${field}`;
    const label = field === "cv_email" ? "CV-Epost" : "Innkjøper";
    const msg = newValue ? `${label} aktivert` : `${label} deaktivert`;

    if (pendingToggles.current[key]) {
      clearTimeout(pendingToggles.current[key]);
      delete pendingToggles.current[key];
    }

    queryClient.setQueryData(crmQueryKeys.contacts.all(), (old: any) => ({
      ...old,
      rows: old?.rows?.map((c: any) => (c.id === contact.id ? { ...c, [field]: newValue } : c)),
    }));

    const timeout = setTimeout(async () => {
      delete pendingToggles.current[key];
      const { error } = await supabase
        .from("contacts")
        .update({ [field]: newValue } as any)
        .eq("id", contact.id);
      if (error) {
        toast.error("Kunne ikke oppdatere");
        queryClient.setQueryData(crmQueryKeys.contacts.all(), (old: any) => ({
          ...old,
          rows: old?.rows?.map((c: any) => (c.id === contact.id ? { ...c, [field]: !newValue } : c)),
        }));
      } else if (field === "cv_email") {
        supabase.functions.invoke("mailchimp-sync", {
          body: { action: "sync-contact", contactId: contact.id },
        }).then(({ data, error: mcErr }) => {
          if (mcErr) {
            console.error("Mailchimp sync feilet:", mcErr);
            toast.error("Mailchimp-synk feilet");
          } else {
            toast.success(`Mailchimp: ${data?.status || "synkronisert"}`);
          }
        });
      }
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.contacts.all() });
    }, 10000);
    pendingToggles.current[key] = timeout;

    toast(msg, {
      duration: 10000,
      action: {
        label: "Angre",
        onClick: () => {
          clearTimeout(pendingToggles.current[key]);
          delete pendingToggles.current[key];
          queryClient.setQueryData(crmQueryKeys.contacts.all(), (old: any) => ({
            ...old,
            rows: old?.rows?.map((c: any) => (c.id === contact.id ? { ...c, [field]: !newValue } : c)),
          }));
        },
      },
    });
  };

  const setSignalMutation = useMutation({
    mutationFn: async ({
      contactId,
      companyId,
      label,
    }: {
      contactId: string;
      companyId: string | null;
      label: string;
    }) => {
      const { data: existingTasks, error: taskLookupError } = await supabase
        .from("tasks")
        .select("id, description, due_date")
        .eq("contact_id", contactId)
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(1);
      if (taskLookupError) throw taskLookupError;

      const primaryTask = existingTasks?.[0];
      if (primaryTask) {
        const { error } = await supabase
          .from("tasks")
          .update({
            description: upsertTaskSignalDescription(primaryTask.description, label, !primaryTask.due_date),
            updated_at: new Date().toISOString(),
          })
          .eq("id", primaryTask.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("tasks").insert({
        title: "Følg opp om behov",
        description: upsertTaskSignalDescription(null, label, true),
        priority: "medium",
        due_date: null,
        contact_id: contactId,
        company_id: companyId,
        assigned_to: user?.id,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onMutate: async ({ contactId, label }) => {
      // Optimistic update
      queryClient.setQueryData(crmQueryKeys.contacts.all(), (old: any) => ({
        ...old,
        rows: old?.rows?.map((c: any) => (c.id === contactId ? { ...c, signal: label } : c)),
      }));
    },
    onSuccess: () => {
      invalidateQueryGroup(queryClient, crmSummaryQueryKeys);
      toast.success("Signal oppdatert");
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.contacts.all() });
      toast.error("Kunne ikke oppdatere signal");
    },
  });

  const getOwnerId = (contact: any) => (contact.profiles as any)?.id || null;
  const getOwnerName = (contact: any) => (contact.profiles as any)?.full_name || null;
  const getContactOwnerCandidate = (
    contact: Pick<ContactRow, "owner_id" | "profiles"> | null | undefined,
    source: Exclude<MatchLeadOwnerSource, "company" | "none"> = "contact",
  ) =>
    buildMatchLeadOwnerCandidate(
      contact
        ? {
            owner_id: contact.owner_id,
            profiles: contact.profiles,
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

  const ownerMap = new Map<string, string>();
  contacts.forEach((c) => {
    const id = getOwnerId(c);
    const name = getOwnerName(c);
    if (id && name) ownerMap.set(id, name);
  });
  const uniqueOwners = Array.from(ownerMap.entries()).sort((left, right) => left[1].localeCompare(right[1], "nb"));

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
          `${contact.first_name} ${contact.last_name}`.toLowerCase().includes(searchTerm) ||
          (contact.companies as any)?.name?.toLowerCase().includes(searchTerm) ||
          contact.title?.toLowerCase().includes(searchTerm) ||
          contact.location?.toLowerCase().includes(searchTerm) ||
          (contact.locations || []).join(" ").toLowerCase().includes(searchTerm) ||
          ((contact.companies as any)?.city || "").toLowerCase().includes(searchTerm) ||
          ((contact.companies as any)?.zip_code || "").toLowerCase().includes(searchTerm) ||
          technologyTags.join(" ").toLowerCase().includes(searchTerm)
        );
      }),
    [contacts, searchTerm],
  );

  const filteredContacts = useMemo(
    () =>
      searchFilteredContacts.filter((contact) => {
        const matchOwner = ownerFilter === "all" || (ownerFilter === "__none__" ? !getOwnerId(contact) : getOwnerId(contact) === ownerFilter);
        const matchSignal = signalFilter === "all" || (contact as any).signal === signalFilter;
        const matchType =
          typeFilter === "all" ||
          (typeFilter === "call_list" && contact.call_list) ||
          (typeFilter === "not_call_list" && !contact.call_list) ||
          (typeFilter === "cv_email" && contact.cv_email) ||
          (typeFilter === "not_cv_email" && !contact.cv_email && contactHasEmail(contact)) ||
          (typeFilter === "ikke_aktuell" && contact.ikke_aktuell_kontakt);
        const matchGeo = contactMatchesGeoFilter(
          {
            location: contact.location,
            locations: contact.locations,
            company: (contact.companies as CompanyPreview | null) || null,
          },
          effectiveGeoFilter,
        );
        return matchOwner && matchSignal && matchType && matchGeo;
      }),
    [effectiveGeoFilter, ownerFilter, searchFilteredContacts, signalFilter, typeFilter],
  );

  const matchBaseContacts = useMemo(
    () =>
      searchFilteredContacts.filter(
        (contact) =>
          !contact.ikke_aktuell_kontakt &&
          !(contact.companies as any)?.ikke_relevant &&
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
    const searchableContactsByCompanyId = new Map<string, ContactRow[]>();
    matchBaseContacts.forEach((contact) => {
      if (!contact.company_id) return;
      if (!searchableContactsByCompanyId.has(contact.company_id)) searchableContactsByCompanyId.set(contact.company_id, []);
      searchableContactsByCompanyId.get(contact.company_id)?.push(contact);
    });

    const companyTechById = new Map(companyTechProfiles.map((profile) => [profile.companyId, profile]));
    const companyNameMatchesSearch = (name: string, tags: string[]) =>
      !searchTerm || name.toLowerCase().includes(searchTerm) || tags.join(" ").toLowerCase().includes(searchTerm);
    const mergeTags = (...tagGroups: string[][]) => [...new Set(tagGroups.flat().filter(Boolean))];
    const mergeSources = (...sourceGroups: HuntChipValue[][]) => [...new Set(sourceGroups.flat())];
    const mergeDates = (...dateGroups: string[][]) =>
      [...new Set(dateGroups.flat().filter(Boolean))].sort((left, right) => right.localeCompare(left));
    const mergeUrgency = (...urgencies: number[]) => Math.max(0, ...urgencies);
    const getSourceUrgency = (chip: Exclude<HuntChipValue, "alle">, sourceDate?: string | null, contact?: ContactRow) => {
      if (chip === "cold_call") return contact?.daysSinceLastContact ?? 0;
      return sourceDate ? new Date(sourceDate).getTime() : 0;
    };
    const buildContactLeadTags = (contact: ContactRow) =>
      mergeTechnologyTags(contact.contactTechnologyTags, contact.companyTechnologyTags);
    const getLeadScore = (tags: string[]) => getContactMatchScore(consultantTags, tags);
    const resolveLeadOwner = ({
      contact,
      company,
      fallbackContact,
    }: {
      contact?: Pick<ContactRow, "owner_id" | "profiles"> | null;
      company?: CompanyPreview | null;
      fallbackContact?: Pick<ContactRow, "owner_id" | "profiles"> | null;
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
        if (rightScore.confidenceScore !== leftScore.confidenceScore) return rightScore.confidenceScore - leftScore.confidenceScore;

        const hotListCompare = compareByHotList(left, right);
        if (hotListCompare !== 0) return hotListCompare;

        return `${left.first_name} ${left.last_name}`.localeCompare(`${right.first_name} ${right.last_name}`, "nb");
      })[0];
    };

    const addContactLead = (
      chip: Exclude<HuntChipValue, "alle">,
      contact: ContactRow,
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
        name: `${contact.first_name} ${contact.last_name}`.trim(),
        companyId: contact.company_id,
        companyName: contact.companies?.name || "",
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
      fallbackContact?: ContactRow | null,
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
        matchSources: mergeSources(existing.matchSources, nextLead.matchSources),
        matchTags: mergeTags(existing.matchTags, nextLead.matchTags),
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
        contactName: request.contactName || (heatContact ? `${heatContact.first_name} ${heatContact.last_name}`.trim() : null),
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
        undefined,
        undefined,
      );
    });

    matchBaseContacts.forEach((contact) => {
      const contactLeadTags = buildContactLeadTags(contact);

      if (hasRecentActualActivity(contact.daysSinceLastContact, 45)) {
        addContactLead("siste_aktivitet", contact, contactLeadTags, contact.lastActivity, "Nylig aktivitet");
      }
      if (contact.call_list) {
        addContactLead("innkjoper", contact, contactLeadTags, contact.lastActivity, "Aktiv innkjøper");
      }
      if (
        isColdCallCandidate({
          daysSinceLastContact: contact.daysSinceLastContact,
          openTaskCount: contact.openTasks.count,
          isIkkeAktuellKontakt: Boolean(contact.ikke_aktuell_kontakt),
        })
      ) {
        addContactLead("cold_call", contact, contactLeadTags, contact.lastActivity, "Cold call-kandidat");
      }
    });

    const customerCompanyIds = new Set<string>();
    matchBaseContacts.forEach((contact) => {
      if (contact.company_id && isCustomerCompany(contact.companyStatus)) customerCompanyIds.add(contact.company_id);
    });
    companyTechProfiles.forEach((profile) => {
      if (profile.companyId && isCustomerCompany(profile.company?.status)) customerCompanyIds.add(profile.companyId);
    });

    customerCompanyIds.forEach((companyId) => {
      const companyContacts = searchableContactsByCompanyId.get(companyId) || [];
      const companyProfile = companyTechById.get(companyId);
      const company = companyContacts[0]?.companies || companyProfile?.company || null;
      if (!company || !isCustomerCompany(company.status) || company.ikke_relevant) return;

      const customerLeadTags = mergeTechnologyTags(
        companyProfile?.companyTechnologyTags || [],
        ...companyContacts.map((contact) => contact.contactTechnologyTags),
        ...companyContacts.map((contact) => contact.companyTechnologyTags),
      );
      const bestContact = getBestCompanyContact(companyId, customerLeadTags);
      const customerSourceDate = bestContact?.lastActivity || companyProfile?.sistFraFinn || null;

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
          name: bestContact ? `${bestContact.first_name} ${bestContact.last_name}`.trim() : null,
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
    const requestResults = jaktChip === "alle" ? mergeRequestPools() : jaktChip === "foresporsler" ? [...requestPools.foresporsler.values()] : [];

    const allLeads = [...contactResults, ...companyResults, ...requestResults];
    const leads = allLeads.filter((lead) => matchesMatchLeadOwnerFilter(lead.ownerId, matchOwnerFilter)).sort((left, right) => {
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

    const ownerMap = new Map<string, string>();
    let hasUnassigned = false;

    matchResults.allLeads.forEach((lead) => {
      if (lead.ownerId) {
        ownerMap.set(lead.ownerId, getMatchLeadOwnerLabel(lead.ownerId, lead.ownerName));
      } else {
        hasUnassigned = true;
      }
    });

    return {
      owners: Array.from(ownerMap.entries())
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
  }, [matchOwnerFilter, matchOwnerOptions, selectedConsultant, setMatchOwnerFilter]);

  const sortedContacts = useMemo(() => {
    if (selectedConsultant) return [] as ContactRow[];

    return [...filteredContacts].sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      switch (sort.field) {
        case "name":
          return dir * `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, "nb");
        case "company":
          return dir * ((a.companies as any)?.name || "").localeCompare((b.companies as any)?.name || "", "nb");
        case "title":
          return dir * (a.title || "").localeCompare(b.title || "", "nb");
        case "signal": {
          const sa = (a as any).signal as string | null;
          const sb = (b as any).signal as string | null;
          const oa = getSignalRank(sa);
          const ob = getSignalRank(sb);
          return dir * (oa - ob);
        }
        case "owner":
          return dir * (getOwnerName(a) || "").localeCompare(getOwnerName(b) || "", "nb");
        case "last_activity":
          if (!(a as any).lastActivity && !(b as any).lastActivity) return 0;
          if (!(a as any).lastActivity) return 1;
          if (!(b as any).lastActivity) return -1;
          return dir * (a as any).lastActivity.localeCompare((b as any).lastActivity);
        case "priority": {
          const sa = (a as any).heatScore ?? -1000;
          const sb = (b as any).heatScore ?? -1000;
          const ta = (a as any).tier ?? 4;
          const tb = (b as any).tier ?? 4;
          if (ta !== tb) return ta - tb;
          return sb - sa;
        }
        default:
          return 0;
      }
    });
  }, [filteredContacts, selectedConsultant, sort]);

  const visibleMatchLeads = useMemo(() => {
    if (!selectedConsultant) return [];
    const leads = [...matchResults.leads];
    if (huntSort.field === "default") return leads;
    const tempToNum = (t: string | undefined) =>
      t === "hett" ? 4 : t === "lovende" ? 3 : t === "mulig" ? 2 : t === "sovende" ? 1 : 0;
    leads.sort((a, b) => {
      let diff = 0;
      if (huntSort.field === "match") {
        diff = (a.matchScore10 ?? 0) - (b.matchScore10 ?? 0);
      } else {
        const getTemp = (l: MatchLead) =>
          l.leadType === "contact" ? l.temperature
          : l.leadType === "request" ? (l.temperature ?? undefined)
          : undefined;
        diff = tempToNum(getTemp(a)) - tempToNum(getTemp(b));
      }
      return huntSort.dir === "desc" ? -diff : diff;
    });
    return leads;
  }, [selectedConsultant, matchResults.leads, huntSort]);
  const hasVisibleResults = selectedConsultant ? visibleMatchLeads.length > 0 : sortedContacts.length > 0;
  const visibleResultCount = selectedConsultant
    ? visibleMatchLeads.length
    : filteredContacts.length === contacts.length
      ? `${totalCount}${capped ? "+" : ""}`
      : filteredContacts.length;
  const visibleResultLabel = selectedConsultant ? "treff" : "kontakter";

  const toggleSort = (field: SortField) => {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: field === "last_activity" ? "desc" : "asc" },
    );
  };

  const SortHeader = ({
    field,
    children,
    className = "",
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => (
    <button
      disabled={Boolean(selectedConsultant)}
      onClick={() => toggleSort(field)}
      className={cn(
        "flex items-center gap-1 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground transition-colors",
        selectedConsultant ? "cursor-default opacity-60" : "hover:text-foreground",
        className,
      )}
    >
      {children}
      <ArrowUpDown className={`h-3 w-3 ${sort.field === field ? "text-foreground" : "text-muted-foreground/20"}`} />
    </button>
  );

  const Chip = ({
    label,
    value,
    current,
    onSelect,
  }: {
    label: string;
    value: string;
    current: string;
    onSelect: (v: string) => void;
  }) => (
    <button onClick={() => onSelect(value)} className={current === value ? CHIP_ON : CHIP_OFF}>
      {label}
    </button>
  );

  const mobileSortValue = `${sort.field}:${sort.dir}`;

  const handleMobileSortChange = (value: string) => {
    const [field, dir] = value.split(":");
    setSort({ field: field as SortField, dir: dir as SortDir });
  };

  const handleConsultantToggle = (consultantId: number) => {
    setSelectedConsultantId((current) => {
      const next = current === consultantId ? null : consultantId;
      if (next !== null) activatePriorityMode();
      setHuntSort({ field: "default", dir: "desc" });
      return next;
    });
  };

  const handleJaktChipSelect = (value: HuntChipValue) => {
    setJaktChip(value);
    activatePriorityMode();
    setHuntSort({ field: "default", dir: "desc" });
  };

  const toggleHuntSort = (field: "match" | "varme") => {
    setHuntSort(prev =>
      prev.field === field
        ? { field, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { field, dir: "desc" }
    );
  };

  const getMatchLeadHref = (lead: MatchLead) =>
    isContactMatchLead(lead)
      ? `/kontakter/${lead.id}`
      : isRequestMatchLead(lead)
        ? `/foresporsler?id=${lead.requestId}`
        : `/selskaper/${lead.companyId}`;
  const getMatchLeadHeatConfig = (lead: MatchLead) => {
    if (isContactMatchLead(lead)) return TEMP_CONFIG[lead.temperature];
    if (isRequestMatchLead(lead) && lead.temperature) return TEMP_CONFIG[lead.temperature];
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[1.375rem] font-bold">Kontakter</h1>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Tilgjengelig for oppdrag
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {huntConsultantsLoading
            ? [1, 2, 3].map((item) => <div key={item} className="h-12 w-44 rounded-xl bg-secondary/50 animate-pulse" />)
            : huntConsultants.map((consultant) => {
                const isSelected = selectedConsultantId === consultant.id;
                const availability = getConsultantAvailabilityMeta(consultant.tilgjengelig_fra);

                return (
                  <button
                    key={consultant.id}
                    onClick={() => handleConsultantToggle(consultant.id)}
                    className={cn(
                      "inline-flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                      isSelected ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-muted/40",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-8 w-8 items-center justify-center rounded-full text-[0.75rem] font-semibold",
                        isSelected ? "bg-background/15 text-background" : "bg-muted text-foreground",
                      )}
                    >
                      {getInitials(consultant.navn)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[0.8125rem] font-medium">{consultant.navn}</span>
                      <span
                        className={cn(
                          "block text-[0.75rem]",
                          isSelected
                            ? "text-background/80"
                            : availability.tone === "ready"
                              ? "text-emerald-600"
                              : availability.tone === "soon"
                                ? "text-amber-600"
                                : "text-muted-foreground",
                        )}
                      >
                        {availability.label}
                      </span>
                    </span>
                  </button>
                );
              })}
        </div>
        {!huntConsultantsLoading && huntConsultants.length === 0 && (
          <p className="text-[0.8125rem] text-muted-foreground">
            Ingen konsulenter med satt tilgjengelighetsdato er klare for matchvisning ennå.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input
            placeholder="Søk..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-lg text-[0.8125rem] bg-card border-border"
          />
        </div>
        {!selectedConsultant && <div className="md:hidden">
          <select
            value={mobileSortValue}
            onChange={(e) => handleMobileSortChange(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-card px-3 text-[0.8125rem] text-foreground"
          >
            <option value="priority:desc">Sorter: Prioritet</option>
            <option value="name:asc">Sorter: Navn A-Å</option>
            <option value="name:desc">Sorter: Navn Å-A</option>
            <option value="company:asc">Sorter: Selskap A-Å</option>
            <option value="title:asc">Sorter: Stilling A-Å</option>
            <option value="signal:asc">Sorter: Signal</option>
            <option value="owner:asc">Sorter: Eier</option>
            <option value="last_activity:desc">Sorter: Siste aktivitet</option>
          </select>
        </div>}
      </div>

      {/* Chip filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="space-y-2 flex-1">
          {!selectedConsultant && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground w-16 shrink-0">
                  Eier
                </span>
                <Chip label="Alle" value="all" current={ownerFilter} onSelect={setOwnerFilter} />
                {uniqueOwners.map(([id, name]) => (
                  <Chip key={id} label={name} value={id} current={ownerFilter} onSelect={setOwnerFilter} />
                ))}
                <Chip label="Uten eier" value="__none__" current={ownerFilter} onSelect={setOwnerFilter} />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground w-16 shrink-0">
                  Signal
                </span>
                <button
                  onClick={() => {
                    setSignalFilter("all");
                    const next = !hotListActive;
                    setHotListActive(next);
                    setSort(next ? { field: "priority", dir: "desc" } : { field: "signal", dir: "asc" });
                  }}
                  className={cn(
                    "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors",
                    signalFilter === "all"
                      ? "bg-foreground text-background border-foreground font-medium"
                      : "border-border text-muted-foreground hover:bg-secondary",
                  )}
                >
                  Alle
                </button>
                {SIGNAL_OPTIONS.map((s) => (
                  <Chip key={s.label} label={s.label} value={s.label} current={signalFilter} onSelect={setSignalFilter} />
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground w-16 shrink-0">
                  Type
                </span>
                <Chip label="Alle" value="all" current={typeFilter} onSelect={setTypeFilter} />
                <button
                  className={`${typeFilter === "call_list" || typeFilter === "not_call_list" ? CHIP_ON : CHIP_OFF} inline-flex items-center gap-1.5`}
                  onClick={() => {
                    if (typeFilter === "call_list") setTypeFilter("not_call_list");
                    else if (typeFilter === "not_call_list") setTypeFilter("all");
                    else setTypeFilter("call_list");
                  }}
                >
                  {typeFilter === "not_call_list" && <Ban className="w-3.5 h-3.5 text-red-500" />}
                  {typeFilter === "not_call_list" ? "Ikke innkjøper" : "Innkjøper"}
                </button>
                <button
                  className={`${typeFilter === "cv_email" || typeFilter === "not_cv_email" ? CHIP_ON : CHIP_OFF} inline-flex items-center gap-1.5`}
                  onClick={() => {
                    if (typeFilter === "cv_email") setTypeFilter("not_cv_email");
                    else if (typeFilter === "not_cv_email") setTypeFilter("all");
                    else setTypeFilter("cv_email");
                  }}
                >
                  {typeFilter === "not_cv_email" && <Ban className="w-3.5 h-3.5 text-red-500" />}
                  {typeFilter === "not_cv_email" ? "Ikke CV-Epost" : "CV-Epost"}
                </button>
                <Chip label="Ikke relevant kontakt" value="ikke_aktuell" current={typeFilter} onSelect={setTypeFilter} />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground w-16 shrink-0">
                  Geo
                </span>
                {GEO_FILTERS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    title={getGeoFilterDescription(option)}
                    aria-label={`${option}. ${getGeoFilterDescription(option)}`}
                    onClick={() => setGeoFilter(option)}
                    className={effectiveGeoFilter === option ? CHIP_ON : CHIP_OFF}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {effectiveGeoFilter !== "Alle" && (
                <p className="pl-[4.5rem] text-[0.75rem] text-muted-foreground">
                  {getGeoFilterDescription(effectiveGeoFilter)}
                </p>
              )}
            </>
          )}
          {selectedConsultant && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground w-16 shrink-0">
                  Eier
                </span>
                <Chip label="Alle" value="all" current={matchOwnerFilter} onSelect={setMatchOwnerFilter} />
                {matchOwnerOptions.owners.map((owner) => (
                  <Chip
                    key={owner.value}
                    label={owner.label}
                    value={owner.value}
                    current={matchOwnerFilter}
                    onSelect={setMatchOwnerFilter}
                  />
                ))}
                {matchOwnerOptions.hasUnassigned && (
                  <Chip
                    label="Uten eier"
                    value={MATCH_OWNER_FILTER_NONE}
                    current={matchOwnerFilter}
                    onSelect={setMatchOwnerFilter}
                  />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground w-16 shrink-0">
                    Match
                  </span>
                  {JAKT_CHIPS.map((chip) => (
                    <button
                      key={chip.value}
                      onClick={() => handleJaktChipSelect(chip.value)}
                      className={jaktChip === chip.value ? CHIP_ON : CHIP_OFF}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
                <span className="text-[0.75rem] text-muted-foreground pl-[4.5rem]">
                  {JAKT_CHIP_HELP_TEXT[jaktChip]}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 md:ml-auto shrink-0">
          <div className="w-px h-8 bg-border" />
          <div className="text-right">
            <span className="text-[0.9375rem] font-semibold text-foreground">{visibleResultCount}</span>
            <span className="text-[0.9375rem] text-muted-foreground ml-1.5">{visibleResultLabel}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-px">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-[44px] bg-secondary/50 animate-pulse rounded" />
          ))}
        </div>
      ) : !hasVisibleResults ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          {selectedConsultant ? matchResults.emptyState : "Ingen kontakter funnet"}
        </p>
      ) : selectedConsultant ? (
        <>
          <div className="space-y-3 md:hidden">
            {visibleMatchLeads.map((lead) => {
              const leadDate = getMatchLeadDate(lead);
              const heatConfig = getMatchLeadHeatConfig(lead);
              const confidenceConfig = getConfidenceConfig(lead.confidenceBand);

              return (
                <button
                  key={lead.leadKey}
                  type="button"
                  onClick={() => navigate(getMatchLeadHref(lead))}
                  style={{
                    borderLeft: heatConfig ? `3px solid var(--match-heat)` : "3px solid transparent",
                    ["--match-heat" as string]:
                      heatConfig?.bar === "bg-red-500"
                        ? "rgb(239 68 68)"
                        : heatConfig?.bar === "bg-orange-400"
                          ? "rgb(251 146 60)"
                          : heatConfig?.bar === "bg-amber-400"
                            ? "rgb(251 191 36)"
                            : "transparent",
                  }}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-left shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[0.9375rem] font-semibold text-foreground truncate">{lead.name}</p>
                        {isCompanyMatchLead(lead) && (
                          <span className="rounded-full border border-border px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                            Selskapslead
                          </span>
                        )}
                        {isRequestMatchLead(lead) && (
                          <span className="rounded-full border border-border px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                            Forespørsel
                          </span>
                        )}
                        {isContactMatchLead(lead) && lead.needsReview && (
                          <span className="text-[0.75rem]" title="Trenger oppfølging">
                            ⚠
                          </span>
                        )}
                      </div>
                      {isContactMatchLead(lead) ? (
                        <>
                          {lead.companyName && (
                            <p className="mt-1 text-[0.8125rem] text-muted-foreground truncate">{lead.companyName}</p>
                          )}
                          {lead.title && (
                            <p className="text-[0.8125rem] text-muted-foreground truncate">{lead.title}</p>
                          )}
                        </>
                      ) : isRequestMatchLead(lead) ? (
                        <>
                          <p className="mt-1 text-[0.8125rem] text-muted-foreground truncate">
                            {lead.contactName || "Ingen kontakt koblet"}
                          </p>
                          {(lead.fristDato || lead.sted) && (
                            <p className="text-[0.8125rem] text-muted-foreground truncate">
                              {lead.fristDato ? `Frist ${relativeDate(lead.fristDato)}` : lead.sted}
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="mt-1 text-[0.8125rem] text-muted-foreground truncate">{lead.summary}</p>
                          {lead.preferredContactName && (
                            <p className="text-[0.8125rem] text-muted-foreground truncate">
                              {lead.preferredContactName}
                              {lead.preferredContactTitle ? ` · ${lead.preferredContactTitle}` : ""}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[0.75rem] font-semibold text-foreground">
                        <span
                          className={cn(
                            "inline-block h-2.5 w-2.5 rounded-full",
                            getConsultantMatchScoreColor(lead.matchScore10),
                          )}
                        />
                        Match {lead.matchScore10}/10
                      </div>
                      <p className={cn("mt-1 text-[0.6875rem]", confidenceConfig.tone)}>{confidenceConfig.label}</p>
                      {leadDate && (
                        <p className="mt-1 text-[0.75rem] text-muted-foreground">{relativeDate(leadDate)}</p>
                      )}
                    </div>
                  </div>

                  <p className="mt-2 text-[0.75rem] text-muted-foreground truncate">
                    {lead.matchSources.map(getMatchSourceLabel).join(" · ")}
                  </p>
                  <p className="mt-1 text-[0.75rem] text-muted-foreground truncate">
                    {lead.matchTags.slice(0, 4).join(", ")}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {heatConfig ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[0.6875rem] font-medium text-foreground">
                        <span className={cn("inline-block h-2 w-2 rounded-full", heatConfig.dot)} />
                        {heatConfig.label}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                        Ingen heat ennå
                      </span>
                    )}
                    {(isContactMatchLead(lead) || isRequestMatchLead(lead)) && lead.signal && lead.signal !== "Ukjent om behov" && (
                      <span className="text-[0.6875rem] text-muted-foreground truncate">{lead.signal}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="hidden md:block border border-border rounded-lg overflow-hidden bg-card shadow-card">
            <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_120px_130px_100px] gap-3 px-4 py-2.5 border-b border-border bg-background">
              <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">Lead</span>
              <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">Selskap</span>
              <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">Kilde</span>
              <button onClick={() => toggleHuntSort("match")} className="flex items-center gap-1 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors">
                Match <ArrowUpDown className={cn("h-3 w-3", huntSort.field === "match" && "text-primary")} />
              </button>
              <button onClick={() => toggleHuntSort("varme")} className="flex items-center gap-1 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors">
                Varme <ArrowUpDown className={cn("h-3 w-3", huntSort.field === "varme" && "text-primary")} />
              </button>
              <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground text-right">Sist</span>
            </div>
            <div className="divide-y divide-border">
              {visibleMatchLeads.map((lead) => {
                const leadDate = getMatchLeadDate(lead);
                const heatConfig = getMatchLeadHeatConfig(lead);
                const confidenceConfig = getConfidenceConfig(lead.confidenceBand);

                return (
                  <button
                    key={lead.leadKey}
                    onClick={() => navigate(getMatchLeadHref(lead))}
                    style={{
                      borderLeft: heatConfig ? `3px solid var(--match-heat)` : "3px solid transparent",
                      ["--match-heat" as string]:
                        heatConfig?.bar === "bg-red-500"
                          ? "rgb(239 68 68)"
                          : heatConfig?.bar === "bg-orange-400"
                            ? "rgb(251 146 60)"
                            : heatConfig?.bar === "bg-amber-400"
                              ? "rgb(251 191 36)"
                              : "transparent",
                    }}
                    className="grid w-full grid-cols-[minmax(0,1.8fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_120px_130px_100px] gap-3 items-center pl-3 pr-4 min-h-[52px] py-2 text-left hover:bg-background/80 transition-colors duration-75"
                  >
                    <div className="min-w-0">
                      <p className="text-[0.8125rem] font-medium text-foreground truncate">{lead.name}</p>
                      <p className="text-[0.6875rem] text-muted-foreground truncate">
                        {isContactMatchLead(lead)
                          ? lead.title || "Kontaktlead"
                          : isRequestMatchLead(lead)
                            ? `${lead.summary}${lead.sted ? ` · ${lead.sted}` : ""}`
                            : lead.summary}
                      </p>
                    </div>
                    <div className="min-w-0">
                      {isContactMatchLead(lead) ? (
                        <>
                          <p className="text-[0.8125rem] text-muted-foreground truncate">{lead.companyName || "—"}</p>
                          {lead.signal && lead.signal !== "Ukjent om behov" && (
                            <p className="text-[0.6875rem] text-muted-foreground truncate">{lead.signal}</p>
                          )}
                        </>
                      ) : isRequestMatchLead(lead) ? (
                        <>
                          <p className="text-[0.8125rem] text-muted-foreground truncate">
                            {lead.contactName || "Ingen kontakt koblet"}
                          </p>
                          <p className="text-[0.6875rem] text-muted-foreground truncate">
                            {lead.fristDato ? `Frist ${relativeDate(lead.fristDato)}` : lead.requestStatus || "Aktiv"}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-[0.8125rem] text-muted-foreground truncate">
                            {lead.preferredContactName || "Uten kontakt"}
                          </p>
                          {lead.preferredContactTitle && (
                            <p className="text-[0.6875rem] text-muted-foreground truncate">{lead.preferredContactTitle}</p>
                          )}
                        </>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[0.75rem] font-medium text-foreground truncate">
                        {lead.matchSources.map(getMatchSourceLabel).join(" · ")}
                      </p>
                      <p className="text-[0.6875rem] text-muted-foreground truncate">
                        {lead.matchTags.slice(0, 4).join(", ")}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <div>
                        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[0.75rem] font-semibold text-foreground">
                          <span
                            className={cn(
                              "inline-block h-2.5 w-2.5 rounded-full",
                              getConsultantMatchScoreColor(lead.matchScore10),
                            )}
                          />
                          {lead.matchScore10}/10
                        </span>
                        <p className={cn("mt-1 text-[0.6875rem]", confidenceConfig.tone)}>{confidenceConfig.label}</p>
                      </div>
                    </div>
                    <div className="min-w-0">
                      {heatConfig ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[0.6875rem] font-medium text-foreground">
                          <span className={cn("inline-block h-2 w-2 rounded-full", heatConfig.dot)} />
                          {heatConfig.label}
                        </span>
                      ) : (
                        <span className="text-[0.6875rem] text-muted-foreground">Ingen heat ennå</span>
                      )}
                    </div>
                    <div className="text-[0.75rem] text-muted-foreground text-right">
                      {leadDate ? relativeDate(leadDate) : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <>
          {sortedContacts.length > 0 && <div className="space-y-3 md:hidden">
            {sortedContacts.map((contact) => {
              const companyName = (contact.companies as any)?.name;
              const signal = (contact as any).signal as string | null;
              const signalBadge = getSignalBadge(signal);

              return (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => navigate(`/kontakter/${contact.id}`)}
                  style={{
                    borderLeft: hotListActive
                      ? (contact as any).temperature === "hett"
                        ? "3px solid rgb(239 68 68)"
                        : (contact as any).temperature === "lovende"
                          ? "3px solid rgb(251 146 60)"
                          : (contact as any).temperature === "mulig"
                            ? "3px solid rgb(251 191 36)"
                            : "3px solid rgb(229 231 235)"
                      : "3px solid transparent",
                  }}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-left shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[0.9375rem] font-semibold text-foreground truncate">
                          {contact.first_name} {contact.last_name}
                        </p>
                        {hotListActive && (contact as any).needsReview && (
                          <span className="text-[0.75rem]" title="Trenger oppfølging">
                            ⚠
                          </span>
                        )}
                      </div>
                      {companyName && (
                        <p className="mt-1 text-[0.8125rem] text-muted-foreground truncate">{companyName}</p>
                      )}
                      {contact.title && (
                        <p className="text-[0.8125rem] text-muted-foreground truncate">{contact.title}</p>
                      )}
                      {selectedConsultant && "matchSources" in contact && (contact as any).matchSources.length > 0 && (
                        <p className="mt-1 text-[0.75rem] text-muted-foreground truncate">
                          {(contact as any).matchSources.map(getMatchSourceLabel).join(" · ")}
                          {(contact as any).matchTags?.length > 0 ? ` · ${(contact as any).matchTags.slice(0, 3).join(", ")}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {(contact as any).lastActivity && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-[0.75rem] text-muted-foreground">
                              {relativeDate((contact as any).lastActivity)}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent>
                            {format(new Date((contact as any).lastActivity), "d. MMMM yyyy", { locale: nb })}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        {signalBadge ? (
                          <button
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold cursor-pointer ${signalBadge.badgeColor}`}
                          >
                            {signal}
                            <ChevronDown className="ml-1 h-3 w-3" />
                          </button>
                        ) : (
                          <button className="inline-flex items-center rounded-full border border-dashed border-border px-2 py-0.5 text-[0.6875rem] text-muted-foreground/50 cursor-pointer hover:text-muted-foreground hover:border-muted-foreground/40 transition-colors">
                            + Signal
                          </button>
                        )}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {SIGNAL_OPTIONS.map((s) => (
                          <DropdownMenuItem
                            key={s.label}
                            onClick={() =>
                              setSignalMutation.mutate({
                                contactId: contact.id,
                                companyId: contact.company_id,
                                label: s.label,
                              })
                            }
                          >
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${s.badgeColor}`}
                            >
                              {s.label}
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {(contact as any).hasMarkedsradar && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-blue-200 bg-blue-50">
                            <Radio className="h-3.5 w-3.5 text-blue-500 cursor-default" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          Selskapet har annonsert etter embedded på Finn.no siste 90 dager
                        </TooltipContent>
                      </Tooltip>
                    )}

                    <div className="ml-auto flex gap-1">
                      <button
                        onClick={() => {
                          if (contact.cv_email && (contact.mailchimp_status === "unsubscribed" || contact.mailchimp_status === "cleaned")) {
                            toast.info("Kontakten har avmeldt seg via Mailchimp og kan ikke re-abonneres.");
                            return;
                          }
                          handleToggle(contact, "cv_email", !contact.cv_email);
                        }}
                        className={
                          contact.cv_email && (contact.mailchimp_status === "unsubscribed" || contact.mailchimp_status === "cleaned")
                            ? "rounded-full bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 text-xs font-medium cursor-pointer"
                            : contact.cv_email
                              ? "rounded-full bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 text-xs font-medium cursor-pointer"
                              : "rounded-full border border-border text-muted-foreground px-2 py-0.5 text-xs hover:bg-secondary cursor-pointer"
                        }
                      >
                        {contact.cv_email && (contact.mailchimp_status === "unsubscribed" || contact.mailchimp_status === "cleaned") ? "CV ✗" : "CV"}
                      </button>
                      <button
                        onClick={() => handleToggle(contact, "call_list", !contact.call_list)}
                        className={
                          contact.call_list
                            ? "rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 text-xs font-medium cursor-pointer"
                            : "rounded-full border border-border text-muted-foreground px-2 py-0.5 text-xs hover:bg-secondary cursor-pointer"
                        }
                      >
                        Innkjøper
                      </button>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>}

          {sortedContacts.length > 0 && <div className="hidden md:block border border-border rounded-lg overflow-hidden bg-card shadow-card">
            <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1.4fr)_36px_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_100px] gap-3 px-4 py-2.5 border-b border-border bg-background">
              <SortHeader field="name">Navn</SortHeader>
              <SortHeader field="signal">Signal</SortHeader>
              <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">Finn</span>
              <SortHeader field="company">Selskap</SortHeader>
              <SortHeader field="title">Stilling</SortHeader>
              <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {selectedConsultant ? "Match" : "Tags"}
              </span>
              <SortHeader field="last_activity" className="justify-end">
                Siste akt.
              </SortHeader>
            </div>
            <div className="divide-y divide-border">
              {sortedContacts.map((contact) => {
                const companyName = (contact.companies as any)?.name;
                const signal = (contact as any).signal as string | null;
                const signalBadge = getSignalBadge(signal);

                return (
                  <div
                    key={contact.id}
                    style={{
                      borderLeft: hotListActive
                        ? (contact as any).temperature === "hett"
                          ? "3px solid rgb(239 68 68)"
                          : (contact as any).temperature === "lovende"
                            ? "3px solid rgb(251 146 60)"
                            : (contact as any).temperature === "mulig"
                              ? "3px solid rgb(251 191 36)"
                              : "3px solid rgb(229 231 235)"
                        : "3px solid transparent",
                    }}
                    className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1.4fr)_36px_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_100px] gap-3 items-center pl-3 pr-4 min-h-[44px] py-2 hover:bg-background/80 transition-colors duration-75"
                  >
                    <button
                      onClick={() => navigate(`/kontakter/${contact.id}`)}
                      className="min-w-0 text-left cursor-pointer flex items-center gap-2"
                    >
                      <p className="text-[0.8125rem] font-medium text-foreground truncate">
                        {contact.first_name} {contact.last_name}
                      </p>
                      {hotListActive && (contact as any).needsReview && (
                        <span className="text-[0.6875rem]" title="Trenger oppfølging">
                          ⚠
                        </span>
                      )}
                    </button>
                    <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          {signalBadge ? (
                            <button
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold cursor-pointer ${signalBadge.badgeColor}`}
                            >
                              {signal}
                              <ChevronDown className="h-3 w-3 ml-1" />
                            </button>
                          ) : (
                            <button className="inline-flex items-center rounded-full border border-dashed border-border px-2 py-0.5 text-[0.6875rem] text-muted-foreground/50 cursor-pointer hover:text-muted-foreground hover:border-muted-foreground/40 transition-colors">
                              + Signal
                            </button>
                          )}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {SIGNAL_OPTIONS.map((s) => (
                            <DropdownMenuItem
                              key={s.label}
                              onClick={() =>
                                setSignalMutation.mutate({
                                  contactId: contact.id,
                                  companyId: contact.company_id,
                                  label: s.label,
                                })
                              }
                            >
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${s.badgeColor}`}
                              >
                                {s.label}
                              </span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center justify-center">
                      {(contact as any).hasMarkedsradar && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Radio className="h-3.5 w-3.5 text-blue-500 cursor-default" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Selskapet har annonsert etter embedded på Finn.no siste 90 dager
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <button
                      onClick={() => navigate(`/kontakter/${contact.id}`)}
                      className="text-[0.8125rem] text-muted-foreground truncate flex items-center gap-1 text-left cursor-pointer"
                    >
                      {companyName || ""}
                    </button>
                    <button
                      onClick={() => navigate(`/kontakter/${contact.id}`)}
                      className="text-[0.8125rem] text-muted-foreground truncate text-left cursor-pointer"
                    >
                      {contact.title?.slice(0, 25) || ""}
                    </button>
                    {selectedConsultant && "matchSources" in contact ? (
                      <div className="min-w-0">
                        <p className="text-[0.75rem] font-medium text-foreground truncate">
                          {(contact as any).matchSources.map(getMatchSourceLabel).join(" · ")}
                        </p>
                        <p className="text-[0.6875rem] text-muted-foreground truncate">
                          {(contact as any).matchTags?.slice(0, 3).join(", ")}
                        </p>
                      </div>
                    ) : (
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            if (contact.cv_email && (contact.mailchimp_status === "unsubscribed" || contact.mailchimp_status === "cleaned")) {
                              toast.info("Kontakten har avmeldt seg via Mailchimp og kan ikke re-abonneres.");
                              return;
                            }
                            handleToggle(contact, "cv_email", !contact.cv_email);
                          }}
                          className={
                            contact.cv_email && (contact.mailchimp_status === "unsubscribed" || contact.mailchimp_status === "cleaned")
                              ? "rounded-full bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 text-xs font-medium cursor-pointer"
                              : contact.cv_email
                                ? "rounded-full bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 text-xs font-medium cursor-pointer"
                                : "rounded-full border border-border text-muted-foreground px-2 py-0.5 text-xs hover:bg-secondary cursor-pointer"
                          }
                        >
                          {contact.cv_email && (contact.mailchimp_status === "unsubscribed" || contact.mailchimp_status === "cleaned") ? "CV ✗" : "CV"}
                        </button>
                        <button
                          onClick={() => handleToggle(contact, "call_list", !contact.call_list)}
                          className={
                            contact.call_list
                              ? "rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 text-xs font-medium cursor-pointer"
                              : "rounded-full border border-border text-muted-foreground px-2 py-0.5 text-xs hover:bg-secondary cursor-pointer"
                          }
                        >
                          Innkjøper
                        </button>
                      </div>
                    )}
                    <span className="text-[0.75rem] text-muted-foreground text-right">
                      {(contact as any).lastActivity ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>{relativeDate((contact as any).lastActivity)}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {format(new Date((contact as any).lastActivity), "d. MMMM yyyy", { locale: nb })}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        ""
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>}
        </>
      )}
      <BulkSignalModal open={bulkModalOpen} onClose={() => setBulkModalOpen(false)} />
    </div>
  );
};

export default Contacts;
