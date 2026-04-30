import { Fragment, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, X } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { nb } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

import { DesignLabMobileNavButton, DesignLabSidebar } from "@/components/designlab/DesignLabSidebar";
import { CommandPalette } from "@/components/designlab/CommandPalette";
import { DesignLabStaticTag } from "@/components/designlab/controls";
import { DealTypeTag } from "@/components/designlab/DealTypeTag";
import {
  DesignLabGhostAction,
  DesignLabFilterRow,
  DesignLabPrimaryAction,
  DesignLabReadonlyChip,
  DesignLabSecondaryAction,
} from "@/components/designlab/system";
import {
  DesignLabFormSheet,
  DesignLabFormSheetBody,
  DesignLabFormSheetFooter,
  DesignLabFormSheetHeader,
} from "@/components/designlab/DesignLabEntitySheet";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { C } from "@/components/designlab/theme";
import { getDesignLabTextSizeStyle, type TextSize } from "@/components/designlab/TextSizeControl";
import { crmQueryKeys } from "@/lib/queryKeys";
import { getInitials } from "@/lib/utils";
import { hasConsultantAvailability, sortHuntConsultants, getConsultantAvailabilityMeta } from "@/lib/contactHunt";
import { isEmployeeEndDatePassed } from "@/lib/employeeStatus";
import {
  getPipelineStatusMeta,
  isOpenPipelineStatus,
  normalizePipelineStatus,
  PIPELINE_STATUS_META,
  PIPELINE_STATUS_VALUES,
  type PipelineStatus,
} from "@/lib/pipelineStatus";
import { toast } from "@/components/ui/sonner";

type ConsultantType = "intern" | "ekstern";
type SourceType = "foresporsel" | "mulighet";
type FilterStatus = "tilgjengelige" | "alle" | PipelineStatus;
type TypeFilter = "alle" | ConsultantType;
type SourceFilter = "alle" | SourceType;

type PipelineItem = {
  id: string;
  source: SourceType;
  sourceId: string | number;
  consultantKey: string;
  consultantType: ConsultantType;
  consultantId: string;
  consultantName: string;
  consultantStatus: string | null;
  consultantAvailableFrom: string | null;
  consultantEndDate: string | null;
  consultantImageUrl: string | null;
  title: string;
  companyId: string | null;
  companyName: string;
  contactId: string | null;
  contactName: string | null;
  contactTitle: string | null;
  status: PipelineStatus;
  statusUpdatedAt: string;
  createdAt: string;
  note: string | null;
  requestType?: string | null;
  requestReceivedAt?: string | null;
  requestDueAt?: string | null;
};

type PipelineGroup = {
  consultantKey: string;
  consultantType: ConsultantType;
  consultantId: string;
  consultantName: string;
  consultantStatus: string | null;
  consultantAvailableFrom: string | null;
  consultantImageUrl: string | null;
  items: PipelineItem[];
  openItems: number;
  requestCount: number;
  opportunityCount: number;
  highestStatus: PipelineStatus;
  latestAt: string;
};

type ContactPreview = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  email?: string | null;
  company_id?: string | null;
};

type CompanyOption = {
  id: string;
  name: string;
  status?: string | null;
};

type EmployeeOption = {
  id: number;
  navn: string;
  status: string | null;
  tilgjengelig_fra?: string | null;
  slutt_dato?: string | null;
  start_dato?: string | null;
  bilde_url?: string | null;
};

type ExternalConsultantOption = {
  id: string;
  navn: string | null;
  status: string | null;
  type?: string | null;
  company_id?: string | null;
};

type CvPortraitRow = {
  ansatt_id: number | null;
  portrait_url: string | null;
};

type RequestLinkRow = {
  id: string;
  ansatt_id: number | null;
  ekstern_id: string | null;
  konsulent_type: string;
  created_at: string | null;
  status: string;
  status_updated_at: string;
  stacq_ansatte: { id: number; navn: string; status: string | null; tilgjengelig_fra: string | null; slutt_dato: string | null; bilde_url: string | null } | null;
  external_consultants: { id: string; navn: string | null; status: string | null; type: string | null; tilgjengelig_fra: string | null } | null;
  foresporsler: {
    id: number;
    selskap_navn: string;
    selskap_id: string | null;
    kontakt_id: string | null;
    mottatt_dato: string;
    frist_dato: string | null;
    status: string | null;
    type: string | null;
    referanse: string | null;
    companies: { id: string; name: string } | null;
    contacts: ContactPreview | null;
  } | null;
};

type OpportunityRow = {
  id: string;
  ansatt_id: number | null;
  ekstern_id: string | null;
  konsulent_type: string;
  company_id: string | null;
  contact_id: string | null;
  tittel: string;
  notat: string | null;
  status: string;
  status_updated_at: string;
  created_at: string;
  updated_at: string;
  stacq_ansatte: { id: number; navn: string; status: string | null; tilgjengelig_fra: string | null; slutt_dato: string | null; bilde_url: string | null } | null;
  external_consultants: { id: string; navn: string | null; status: string | null; type: string | null; tilgjengelig_fra: string | null } | null;
  companies: { id: string; name: string } | null;
  contacts: ContactPreview | null;
};

const STATUS_FILTER_OPTIONS = ["Alle", "Tilgjengelige", ...PIPELINE_STATUS_VALUES.map((value) => PIPELINE_STATUS_META[value].label)] as const;
const TYPE_FILTER_OPTIONS = ["Alle", "Ansatte", "Eksterne"] as const;
const SOURCE_FILTER_OPTIONS = ["Alle", "Forespørsler", "Muligheter"] as const;

const PIPELINE_TABLE_COLUMNS = "minmax(210px,1.35fr) minmax(72px,0.45fr) minmax(104px,0.55fr) minmax(104px,0.55fr) minmax(136px,0.8fr) minmax(88px,0.55fr)";

const SELECT_CLASS =
  "h-[var(--dl-modal-control-height,32px)] w-full min-w-0 rounded-md border border-[#D7DCE3] bg-white px-2.5 text-[var(--dl-modal-font-size,13px)] text-[#1F2328] outline-none focus:border-[#5E6AD2] focus:shadow-[0_0_0_2px_rgba(94,106,210,0.15)]";

const TEXTAREA_CLASS =
  "min-h-[112px] w-full min-w-0 resize-none rounded-md border border-[#D7DCE3] bg-white px-2.5 py-2 text-[var(--dl-modal-font-size,13px)] text-[#1F2328] outline-none focus:border-[#5E6AD2] focus:shadow-[0_0_0_2px_rgba(94,106,210,0.15)]";

function statusFilterLabel(value: FilterStatus) {
  if (value === "tilgjengelige") return "Tilgjengelige";
  if (value === "alle") return "Alle";
  return PIPELINE_STATUS_META[value].label;
}

function statusFilterValue(label: string): FilterStatus {
  if (label === "Tilgjengelige") return "tilgjengelige";
  if (label === "Alle") return "alle";
  return PIPELINE_STATUS_VALUES.find((value) => PIPELINE_STATUS_META[value].label === label) ?? "tilgjengelige";
}

function typeFilterLabel(value: TypeFilter) {
  if (value === "intern") return "Ansatte";
  if (value === "ekstern") return "Eksterne";
  return "Alle";
}

function typeFilterValue(label: string): TypeFilter {
  if (label === "Ansatte") return "intern";
  if (label === "Eksterne") return "ekstern";
  return "alle";
}

function sourceFilterLabel(value: SourceFilter) {
  if (value === "foresporsel") return "Forespørsler";
  if (value === "mulighet") return "Muligheter";
  return "Alle";
}

function sourceFilterValue(label: string): SourceFilter {
  if (label === "Forespørsler") return "foresporsel";
  if (label === "Muligheter") return "mulighet";
  return "alle";
}

function safeDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function timeAgo(value: string | null | undefined) {
  const date = safeDate(value);
  if (!date) return "—";
  return formatDistanceToNowStrict(date, { addSuffix: true, locale: nb });
}

function getContactName(contact: ContactPreview | null | undefined): string | null {
  if (!contact) return null;
  const name = `${contact.first_name || ""} ${contact.last_name || ""}`.trim();
  return name || null;
}

function getHighestStatus(items: PipelineItem[]): PipelineStatus {
  const openItems = items.filter((item) => isOpenPipelineStatus(item.status));
  const pool = openItems.length > 0 ? openItems : items;
  return pool
    .map((item) => item.status)
    .sort((left, right) => getPipelineStatusMeta(right).rank - getPipelineStatusMeta(left).rank)[0] ?? "sendt_cv";
}

function getLatestAt(items: PipelineItem[]) {
  return items
    .map((item) => item.statusUpdatedAt || item.createdAt)
    .filter(Boolean)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? "";
}

function isAvailableEmployee(employee: Pick<EmployeeOption, "status" | "tilgjengelig_fra" | "slutt_dato">) {
  return (
    ["AKTIV/SIGNERT", "Ledig"].includes(employee.status || "") &&
    hasConsultantAvailability(employee.tilgjengelig_fra) &&
    !isEmployeeEndDatePassed(employee.slutt_dato)
  );
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message || "");
  }
  return "";
}

function isSearchableOpportunityEmployee(employee: EmployeeOption) {
  return employee.status !== "SLUTTET" && !isEmployeeEndDatePassed(employee.slutt_dato);
}

function isActiveExternalConsultant(consultant: ExternalConsultantOption) {
  const normalized = String(consultant.status || "").trim().toLowerCase();
  return !["sluttet", "deleted", "slettet", "inactive", "inaktiv"].includes(normalized);
}

function isAvailablePipelineItem(item: PipelineItem) {
  if (!hasConsultantAvailability(item.consultantAvailableFrom)) return false;
  if (item.consultantType === "intern") {
    return ["AKTIV/SIGNERT", "Ledig"].includes(item.consultantStatus || "") && !isEmployeeEndDatePassed(item.consultantEndDate);
  }
  return true;
}

function statusMatchesFilter(item: PipelineItem, filter: FilterStatus) {
  if (filter === "alle") return true;
  if (filter === "tilgjengelige") return isAvailablePipelineItem(item);
  return item.status === filter;
}

function consultantTypeLabel(type: ConsultantType) {
  return type === "intern" ? "Ansatt" : "Ekstern";
}

function sourceLabel(source: SourceType) {
  return source === "foresporsel" ? "Forespørsel" : "Mulighet";
}

function buildPipelineGroups(items: PipelineItem[]): PipelineGroup[] {
  const map = new Map<string, PipelineItem[]>();
  items.forEach((item) => {
    const existing = map.get(item.consultantKey) || [];
    existing.push(item);
    map.set(item.consultantKey, existing);
  });

  return Array.from(map.entries())
    .map(([consultantKey, groupItems]) => {
      const first = groupItems[0];
      const latestAt = getLatestAt(groupItems);
      return {
        consultantKey,
        consultantType: first.consultantType,
        consultantId: first.consultantId,
        consultantName: first.consultantName,
        consultantStatus: first.consultantStatus,
        consultantAvailableFrom: first.consultantAvailableFrom,
        consultantImageUrl: first.consultantImageUrl,
        items: groupItems.sort(
          (left, right) => new Date(right.statusUpdatedAt).getTime() - new Date(left.statusUpdatedAt).getTime(),
        ),
        openItems: groupItems.filter((item) => isOpenPipelineStatus(item.status)).length,
        requestCount: groupItems.filter((item) => item.source === "foresporsel" && (item.status === "sendt_cv" || item.status === "intervju")).length,
        opportunityCount: groupItems.filter((item) => item.source === "mulighet" && (item.status === "sendt_cv" || item.status === "intervju")).length,
        highestStatus: getHighestStatus(groupItems),
        latestAt,
      } satisfies PipelineGroup;
    })
    .sort((left, right) => new Date(right.latestAt).getTime() - new Date(left.latestAt).getTime());
}

function compareAvailableGroups(left: PipelineGroup, right: PipelineGroup) {
  const leftAvailability = getConsultantAvailabilityMeta(left.consultantAvailableFrom);
  const rightAvailability = getConsultantAvailabilityMeta(right.consultantAvailableFrom);
  if (leftAvailability.daysUntil !== rightAvailability.daysUntil) {
    return leftAvailability.daysUntil - rightAvailability.daysUntil;
  }
  return left.consultantName.localeCompare(right.consultantName, "nb");
}

export default function Pipeline() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [textSize] = usePersistentState<TextSize>("dl-text-size", "M");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("tilgjengelige");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("alle");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("alle");
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);

  const { data: requestLinks = [], isLoading: isLoadingRequestLinks } = useQuery({
    queryKey: ["pipeline-request-links-v1"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foresporsler_konsulenter")
        .select(
          "id, ansatt_id, ekstern_id, konsulent_type, created_at, status, status_updated_at, stacq_ansatte(id, navn, status, tilgjengelig_fra, slutt_dato, bilde_url), external_consultants(id, navn, status, type, tilgjengelig_fra), foresporsler(id, selskap_navn, selskap_id, kontakt_id, mottatt_dato, frist_dato, status, type, referanse, companies!foresporsler_selskap_id_fkey(id, name), contacts!foresporsler_kontakt_id_fkey(id, first_name, last_name, title, email))",
        )
        .order("status_updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as RequestLinkRow[];
    },
  });

  const { data: opportunities = [], isLoading: isLoadingOpportunities } = useQuery({
    queryKey: crmQueryKeys.pipeline.opportunities(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_muligheter")
        .select(
          "id, ansatt_id, ekstern_id, konsulent_type, company_id, contact_id, tittel, notat, status, status_updated_at, created_at, updated_at, stacq_ansatte(id, navn, status, tilgjengelig_fra, slutt_dato, bilde_url), external_consultants(id, navn, status, type, tilgjengelig_fra), companies!pipeline_muligheter_company_id_fkey(id, name), contacts!pipeline_muligheter_contact_id_fkey(id, first_name, last_name, title, email)",
        )
        .order("status_updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as OpportunityRow[];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["pipeline-employees-v1"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stacq_ansatte")
        .select("id, navn, status, tilgjengelig_fra, slutt_dato, start_dato, bilde_url")
        .order("navn", { ascending: true });
      if (error) throw error;
      return (data || []) as EmployeeOption[];
    },
  });

  const { data: externalConsultants = [] } = useQuery({
    queryKey: ["pipeline-external-consultants-v1"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_consultants")
        .select("id, navn, status, type, company_id")
        .order("navn", { ascending: true });
      if (error) throw error;
      return (data || []) as ExternalConsultantOption[];
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["pipeline-companies-v1"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, status")
        .neq("status", "deleted")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as CompanyOption[];
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["pipeline-contacts-v1"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, title, email, company_id, status")
        .neq("status", "deleted")
        .order("first_name", { ascending: true });
      if (error) throw error;
      return (data || []) as ContactPreview[];
    },
  });

  const { data: cvPortraits = [] } = useQuery({
    queryKey: ["pipeline-cv-portraits-v1"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cv_documents")
        .select("ansatt_id, portrait_url")
        .not("portrait_url", "is", null);
      if (error) throw error;
      return (data || []) as CvPortraitRow[];
    },
  });

  const cvPortraitMap = useMemo(() => {
    const map = new Map<number, string>();
    cvPortraits.forEach((row) => {
      if (row.ansatt_id && row.portrait_url) map.set(row.ansatt_id, row.portrait_url);
    });
    return map;
  }, [cvPortraits]);

  const availableEmployees = useMemo(
    () => sortHuntConsultants(employees.filter(isAvailableEmployee)),
    [employees],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCmdOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const pipelineItems = useMemo<PipelineItem[]>(() => {
    const requestItems = requestLinks.map((link): PipelineItem | null => {
      const request = link.foresporsler;
      if (!request) return null;

      const consultantType = link.konsulent_type === "ekstern" ? "ekstern" : "intern";
      const consultant = consultantType === "intern" ? link.stacq_ansatte : link.external_consultants;
      const consultantId = consultantType === "intern" ? link.ansatt_id : link.ekstern_id;
      const consultantName = consultant?.navn || "Ukjent konsulent";
      const contactName = getContactName(request.contacts);
      const consultantImageUrl =
        consultantType === "intern" && link.ansatt_id
          ? cvPortraitMap.get(link.ansatt_id) || link.stacq_ansatte?.bilde_url || null
          : null;

      return {
        id: `foresporsel:${link.id}`,
        source: "foresporsel",
        sourceId: request.id,
        consultantKey: `${consultantType}:${consultantId}`,
        consultantType,
        consultantId: String(consultantId || ""),
        consultantName,
        consultantStatus: consultant?.status || null,
        consultantAvailableFrom: consultant?.tilgjengelig_fra || null,
        consultantEndDate: consultantType === "intern" ? link.stacq_ansatte?.slutt_dato || null : null,
        consultantImageUrl,
        title: request.referanse || request.type ? `${request.referanse || "Forespørsel"} ${request.type ? `(${request.type})` : ""}` : "Forespørsel",
        companyId: request.selskap_id || null,
        companyName: request.companies?.name || request.selskap_navn || "Ukjent selskap",
        contactId: request.kontakt_id || null,
        contactName,
        contactTitle: request.contacts?.title || null,
        status: normalizePipelineStatus(link.status),
        statusUpdatedAt: link.status_updated_at || link.created_at,
        createdAt: link.created_at || request.mottatt_dato,
        note: null,
        requestType: request.type || null,
        requestReceivedAt: request.mottatt_dato || null,
        requestDueAt: request.frist_dato || null,
      };
    });

    const opportunityItems = opportunities.map((opportunity): PipelineItem => {
      const consultantType = opportunity.konsulent_type === "ekstern" ? "ekstern" : "intern";
      const consultant = consultantType === "intern" ? opportunity.stacq_ansatte : opportunity.external_consultants;
      const consultantId = consultantType === "intern" ? opportunity.ansatt_id : opportunity.ekstern_id;
      const consultantImageUrl =
        consultantType === "intern" && opportunity.ansatt_id
          ? cvPortraitMap.get(opportunity.ansatt_id) || opportunity.stacq_ansatte?.bilde_url || null
          : null;

      return {
        id: `mulighet:${opportunity.id}`,
        source: "mulighet",
        sourceId: opportunity.id,
        consultantKey: `${consultantType}:${consultantId}`,
        consultantType,
        consultantId: String(consultantId || ""),
        consultantName: consultant?.navn || "Ukjent konsulent",
        consultantStatus: consultant?.status || null,
        consultantAvailableFrom: consultant?.tilgjengelig_fra || null,
        consultantEndDate: consultantType === "intern" ? opportunity.stacq_ansatte?.slutt_dato || null : null,
        consultantImageUrl,
        title: opportunity.tittel || "Direkte mulighet",
        companyId: opportunity.company_id || null,
        companyName: opportunity.companies?.name || "Ukjent selskap",
        contactId: opportunity.contact_id || null,
        contactName: getContactName(opportunity.contacts),
        contactTitle: opportunity.contacts?.title || null,
        status: normalizePipelineStatus(opportunity.status),
        statusUpdatedAt: opportunity.status_updated_at || opportunity.updated_at || opportunity.created_at,
        createdAt: opportunity.created_at,
        note: opportunity.notat || null,
      };
    });

    return [...requestItems.filter(Boolean), ...opportunityItems] as PipelineItem[];
  }, [cvPortraitMap, opportunities, requestLinks]);

  const filteredItems = useMemo(() => {
    return pipelineItems.filter((item) => {
      if (typeFilter !== "alle" && item.consultantType !== typeFilter) return false;
      if (sourceFilter !== "alle" && item.source !== sourceFilter) return false;
      return statusMatchesFilter(item, statusFilter);
    });
  }, [pipelineItems, sourceFilter, statusFilter, typeFilter]);

  const groups = useMemo(() => {
    const pipelineGroups = buildPipelineGroups(filteredItems);
    if (statusFilter !== "tilgjengelige" || sourceFilter !== "alle" || typeFilter === "ekstern") {
      return pipelineGroups;
    }

    const existingKeys = new Set(pipelineGroups.map((group) => group.consultantKey));
    const benchGroups = availableEmployees
      .filter((employee) => !existingKeys.has(`intern:${employee.id}`))
      .map((employee) => ({
        consultantKey: `intern:${employee.id}`,
        consultantType: "intern" as const,
        consultantId: String(employee.id),
        consultantName: employee.navn,
        consultantStatus: employee.status,
        consultantAvailableFrom: employee.tilgjengelig_fra || null,
        consultantImageUrl: cvPortraitMap.get(employee.id) || employee.bilde_url || null,
        items: [],
        openItems: 0,
        requestCount: 0,
        opportunityCount: 0,
        highestStatus: "sendt_cv" as PipelineStatus,
        latestAt: employee.tilgjengelig_fra || "",
      }));

    return [...pipelineGroups, ...benchGroups].sort(compareAvailableGroups);
  }, [availableEmployees, cvPortraitMap, filteredItems, sourceFilter, statusFilter, typeFilter]);
  const selectedGroup = useMemo(
    () => (selectedGroupKey ? groups.find((group) => group.consultantKey === selectedGroupKey) || null : null),
    [groups, selectedGroupKey],
  );

  const commandGroups = useMemo(() => buildPipelineGroups(pipelineItems), [pipelineItems]);
  const commandConsultants = useMemo(
    () =>
      commandGroups.map((group) => ({
        id: group.consultantKey,
        firstName: group.consultantName,
        lastName: "",
        company: "",
        meta: `${group.items.length} løp`,
        searchText: [
          group.consultantName,
          consultantTypeLabel(group.consultantType),
          ...group.items.flatMap((item) => [item.companyName, item.contactName, item.title]),
        ].filter(Boolean).join(" "),
        companyId: null,
        email: "",
        phone: "",
        signal: consultantTypeLabel(group.consultantType),
        daysSince: 0,
      })),
    [commandGroups],
  );

  const commandCompanies = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    pipelineItems.forEach((item) => {
      const id = item.companyId || item.companyName;
      const existing = map.get(id);
      if (existing) existing.count += 1;
      else map.set(id, { id, name: item.companyName, count: 1 });
    });
    return Array.from(map.values()).map((company) => ({
      id: company.id,
      name: company.name,
      contactCount: company.count,
    }));
  }, [pipelineItems]);

  const stats = useMemo(() => {
    const openItems = pipelineItems.filter((item) => isOpenPipelineStatus(item.status));
    const availableConsultants = new Set(pipelineItems.filter(isAvailablePipelineItem).map((item) => item.consultantKey));
    availableEmployees.forEach((employee) => availableConsultants.add(`intern:${employee.id}`));
    return {
      consultants: new Set([...pipelineItems.map((item) => item.consultantKey), ...availableEmployees.map((employee) => `intern:${employee.id}`)]).size,
      open: openItems.length,
      available: availableConsultants.size,
      sentCv: pipelineItems.filter((item) => item.status === "sendt_cv").length,
      interviews: pipelineItems.filter((item) => item.status === "intervju").length,
      won: pipelineItems.filter((item) => item.status === "vunnet").length,
      direct: pipelineItems.filter((item) => item.source === "mulighet").length,
    };
  }, [availableEmployees, pipelineItems]);

  const isLoading = isLoadingRequestLinks || isLoadingOpportunities;

  const resetFilters = () => {
    setStatusFilter("tilgjengelige");
    setTypeFilter("alle");
    setSourceFilter("alle");
  };

  const invalidatePipelineQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.pipeline.opportunities() }),
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.foresporsler.list() }),
      queryClient.invalidateQueries({ queryKey: ["pipeline-request-links-v1"] }),
    ]);
  };

  const updateStatus = async (item: PipelineItem, status: PipelineStatus) => {
    if (status === item.status) return;
    setSavingStatusId(item.id);
    try {
      const rawId = item.id.split(":")[1];
      const statusPatch = { status, status_updated_at: new Date().toISOString() };
      const { error } =
        item.source === "foresporsel"
          ? await supabase.from("foresporsler_konsulenter").update(statusPatch).eq("id", rawId)
          : await supabase.from("pipeline_muligheter").update(statusPatch).eq("id", rawId);
      if (error) throw error;
      await invalidatePipelineQueries();
      toast.success(`${item.consultantName}: ${getPipelineStatusMeta(status).label}`);
    } catch (error) {
      console.error(error);
      toast.error("Kunne ikke oppdatere status");
    } finally {
      setSavingStatusId(null);
    }
  };

  const deleteOpportunity = async (item: PipelineItem) => {
    if (item.source !== "mulighet") return;
    const confirmed = window.confirm(`Slette muligheten "${item.title}"?`);
    if (!confirmed) return;
    const { error } = await supabase.from("pipeline_muligheter").delete().eq("id", item.sourceId as string);
    if (error) {
      toast.error("Kunne ikke slette mulighet");
      return;
    }
    await invalidatePipelineQueries();
    toast.success("Mulighet slettet");
  };

  return (
    <div className="dl-shell flex h-screen overflow-hidden select-none" style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif", background: C.bg }}>
      <DesignLabSidebar navigate={navigate} signOut={signOut} user={user} activePath="/pipeline" />

      <main className="flex-1 flex min-w-0 flex-col overflow-hidden" style={{ ...getDesignLabTextSizeStyle(textSize), background: C.appBg }}>
        <header className="dl-shell-header flex shrink-0 flex-wrap items-center justify-between gap-3" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex min-w-0 items-center gap-3">
            <DesignLabMobileNavButton navigate={navigate} signOut={signOut} user={user} activePath="/pipeline" />
            <div className="flex items-baseline gap-2.5">
              <h1 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Pipeline</h1>
              <span style={{ fontSize: 13, color: C.textGhost, fontWeight: 500 }}>{stats.consultants}</span>
            </div>
          </div>
          <DesignLabPrimaryAction onClick={() => setCreateOpen(true)}>
            <Plus style={{ width: 14, height: 14 }} /> Ny mulighet
          </DesignLabPrimaryAction>
        </header>

        <div className="dl-filter-bar shrink-0 space-y-0" style={{ borderBottom: `1px solid ${C.border}` }}>
          <DesignLabFilterRow
            label="STATUS"
            options={STATUS_FILTER_OPTIONS}
            value={statusFilterLabel(statusFilter)}
            onChange={(value) => setStatusFilter(statusFilterValue(value))}
          />
          <div className="flex items-center justify-between">
            <DesignLabFilterRow
              label="TYPE"
              options={TYPE_FILTER_OPTIONS}
              value={typeFilterLabel(typeFilter)}
              onChange={(value) => setTypeFilter(typeFilterValue(value))}
            />
            {(statusFilter !== "tilgjengelige" || typeFilter !== "alle" || sourceFilter !== "alle") && (
              <DesignLabGhostAction onClick={resetFilters}>
                <X style={{ width: 12, height: 12 }} /> Nullstill
              </DesignLabGhostAction>
            )}
          </div>
          <DesignLabFilterRow
            label="KILDE"
            options={SOURCE_FILTER_OPTIONS}
            value={sourceFilterLabel(sourceFilter)}
            onChange={(value) => setSourceFilter(sourceFilterValue(value))}
          />

          <div className="grid gap-2 pt-3 sm:grid-cols-3">
            <PipelineStat label="Sendt CV" value={stats.sentCv} />
            <PipelineStat label="Intervju" value={stats.interviews} />
            <PipelineStat label="Vunnet" value={stats.won} />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {isMobile ? (
            <PipelineList
              groups={groups}
              isLoading={isLoading}
              isMobile
              selectedGroupKey={selectedGroupKey}
              selectedGroup={selectedGroup}
              savingStatusId={savingStatusId}
              onSelectGroup={setSelectedGroupKey}
              onStatusChange={updateStatus}
              onOpenRequest={(id) => navigate(`/foresporsler?id=${id}`)}
              onDeleteOpportunity={deleteOpportunity}
            />
          ) : (
            <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
              <ResizablePanel defaultSize={38} minSize={28}>
                <PipelineList
                  groups={groups}
                  isLoading={isLoading}
                  isMobile={false}
                  selectedGroupKey={selectedGroupKey}
                  selectedGroup={selectedGroup}
                  savingStatusId={savingStatusId}
                  onSelectGroup={setSelectedGroupKey}
                  onStatusChange={updateStatus}
                  onOpenRequest={(id) => navigate(`/foresporsler?id=${id}`)}
                  onDeleteOpportunity={deleteOpportunity}
                />
              </ResizablePanel>
              <ResizableHandle
                withHandle
                className="bg-transparent transition-colors hover:bg-[rgba(0,0,0,0.04)] data-[resize-handle-active]:bg-[rgba(94,106,210,0.12)]"
              />
              <ResizablePanel defaultSize={62} minSize={34}>
                <aside className="h-full overflow-y-auto" style={{ background: C.surface, borderLeft: `1px solid ${C.borderLight}` }}>
                  {selectedGroup ? (
                    <PipelineDetail
                      group={selectedGroup}
                      savingStatusId={savingStatusId}
                      onStatusChange={updateStatus}
                      onOpenRequest={(id) => navigate(`/foresporsler?id=${id}`)}
                      onDeleteOpportunity={deleteOpportunity}
                    />
                  ) : (
                    <EmptyState text="Trykk ⌘K for å søke." />
                  )}
                </aside>
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </div>
      </main>

      <NewOpportunitySheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        employees={employees}
        externalConsultants={externalConsultants}
        companies={companies}
        contacts={contacts}
        cvPortraitMap={cvPortraitMap}
        userId={user?.id || null}
        onCreated={invalidatePipelineQueries}
      />

      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        textSize={textSize}
        searchPlaceholder="Søk konsulent eller selskap..."
        contactSectionLabel="Konsulenter"
        companySectionLabel="Selskaper"
        companyMetaSuffix="løp"
        contacts={commandConsultants}
        companies={commandCompanies}
        selectedContact={
          selectedGroup
            ? {
                id: selectedGroup.consultantKey,
                firstName: selectedGroup.consultantName,
                lastName: "",
                email: "",
                signal: consultantTypeLabel(selectedGroup.consultantType),
              }
            : null
        }
        onSelectContact={(id) => setSelectedGroupKey(id)}
        onSelectCompany={(id) => {
          const matchingGroup = commandGroups.find((group) =>
            group.items.some((item) => (item.companyId || item.companyName) === id),
          );
          if (matchingGroup) setSelectedGroupKey(matchingGroup.consultantKey);
        }}
        onFilterByCompany={() => undefined}
      />
    </div>
  );
}

function PipelineList({
  groups,
  isLoading,
  isMobile,
  selectedGroupKey,
  selectedGroup,
  savingStatusId,
  onSelectGroup,
  onStatusChange,
  onOpenRequest,
  onDeleteOpportunity,
}: {
  groups: PipelineGroup[];
  isLoading: boolean;
  isMobile: boolean;
  selectedGroupKey: string | null;
  selectedGroup: PipelineGroup | null;
  savingStatusId: string | null;
  onSelectGroup: (key: string) => void;
  onStatusChange: (item: PipelineItem, status: PipelineStatus) => void;
  onOpenRequest: (id: string | number) => void;
  onDeleteOpportunity: (item: PipelineItem) => void;
}) {
  return (
    <section className="h-full min-w-0 overflow-y-auto" style={{ background: C.panel }}>
      <PipelineTableHeader />
      {isLoading ? (
        <EmptyState text="Laster pipeline..." />
      ) : groups.length === 0 ? (
        <EmptyState text="Ingen pipeline-løp matcher filtrene." />
      ) : (
        groups.map((group) => (
          <Fragment key={group.consultantKey}>
            <PipelineGroupRow
              group={group}
              active={
                selectedGroupKey
                  ? selectedGroupKey === group.consultantKey
                  : !isMobile && selectedGroup?.consultantKey === group.consultantKey
              }
              onClick={() => onSelectGroup(group.consultantKey)}
            />
            {isMobile && selectedGroupKey === group.consultantKey && (
              <PipelineDetail
                group={group}
                savingStatusId={savingStatusId}
                onStatusChange={onStatusChange}
                onOpenRequest={onOpenRequest}
                onDeleteOpportunity={onDeleteOpportunity}
              />
            )}
          </Fragment>
        ))
      )}
    </section>
  );
}

function PipelineStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border px-3 py-2" style={{ borderColor: C.borderLight, background: C.surface, borderRadius: 6 }}>
      <p style={{ fontSize: 11, color: C.textFaint, fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: 18, color: C.text, fontWeight: 650 }}>{value}</p>
    </div>
  );
}

function PipelineTableHeader() {
  const labels = ["Konsulent", "Type", "Aktive foresp.", "Aktive muligheter", "Høyeste status", "Sist"];
  return (
    <div className="sticky top-0 z-10 grid items-center gap-3 border-b" style={{ gridTemplateColumns: PIPELINE_TABLE_COLUMNS, height: 32, paddingInline: 16, borderColor: C.borderLight, background: C.surfaceAlt }}>
      {labels.map((label) => (
        <span
          key={label}
          className={`truncate ${label === "Sist" ? "text-right" : ""}`}
          style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function PipelineGroupRow({ group, active, onClick }: { group: PipelineGroup; active: boolean; onClick: () => void }) {
  const statusMeta = getPipelineStatusMeta(group.highestStatus);
  const hasPipelineItems = group.items.length > 0;
  const availability = getConsultantAvailabilityMeta(group.consultantAvailableFrom);
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full cursor-pointer items-center gap-3 border-b text-left transition-colors"
      style={{
        gridTemplateColumns: PIPELINE_TABLE_COLUMNS,
        minHeight: 46,
        paddingInline: 16,
        borderColor: C.borderLight,
        background: active ? C.activeBg : "transparent",
        boxShadow: active ? `inset 3px 0 0 ${C.accent}` : "inset 3px 0 0 transparent",
      }}
      onMouseEnter={(event) => {
        if (!active) event.currentTarget.style.background = C.hoverBg;
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = active ? C.activeBg : "transparent";
      }}
    >
      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
        {group.consultantType === "intern" && group.consultantImageUrl ? (
          <img
            src={group.consultantImageUrl}
            alt={group.consultantName}
            className="h-7 w-7 shrink-0 rounded-full border object-cover"
            style={{ borderColor: C.borderLight }}
          />
        ) : (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: C.filterActiveBg, color: C.textPrimary, fontSize: 11, fontWeight: 650 }}>
            {getInitials(group.consultantName)}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate" style={{ fontSize: 13, color: C.text, fontWeight: 550 }}>{group.consultantName}</p>
        </div>
      </div>
      <div className="min-w-0 overflow-hidden">
        <ConsultantTypeTag type={group.consultantType} />
      </div>
      <div className="min-w-0 overflow-hidden">
        <span style={{ fontSize: 13, color: C.textMuted }}>{group.requestCount}</span>
      </div>
      <div className="min-w-0 overflow-hidden">
        <span style={{ fontSize: 13, color: C.textMuted }}>{group.opportunityCount}</span>
      </div>
      <div className="min-w-0 overflow-hidden">
        {hasPipelineItems ? (
          <DesignLabStaticTag colors={statusMeta.colors}>{statusMeta.label}</DesignLabStaticTag>
        ) : (
          <DesignLabReadonlyChip active={false}>{availability.label}</DesignLabReadonlyChip>
        )}
      </div>
      <span className="truncate text-right" style={{ fontSize: 12, color: C.textMuted }}>
        {hasPipelineItems ? timeAgo(group.latestAt) : "—"}
      </span>
    </button>
  );
}

function PipelineDetail({
  group,
  savingStatusId,
  onStatusChange,
  onOpenRequest,
  onDeleteOpportunity,
}: {
  group: PipelineGroup;
  savingStatusId: string | null;
  onStatusChange: (item: PipelineItem, status: PipelineStatus) => void;
  onOpenRequest: (id: string | number) => void;
  onDeleteOpportunity: (item: PipelineItem) => void;
}) {
  return (
    <div className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p style={{ fontSize: 18, color: C.text, fontWeight: 650 }}>{group.consultantName}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ConsultantTypeTag type={group.consultantType} />
            <DesignLabReadonlyChip active={false}>{group.openItems} aktive løp</DesignLabReadonlyChip>
          </div>
        </div>
        <DesignLabStaticTag colors={getPipelineStatusMeta(group.highestStatus).colors}>
          {getPipelineStatusMeta(group.highestStatus).label}
        </DesignLabStaticTag>
      </div>

      <div className="space-y-2">
        {group.items.length === 0 ? (
          <div className="border p-3" style={{ borderColor: C.borderLight, background: C.panel, borderRadius: 6 }}>
            <p style={{ fontSize: 13, color: C.textMuted }}>Ingen pipeline-løp ennå.</p>
          </div>
        ) : null}
        {group.items.map((item) => (
          <div key={item.id} className="border p-3" style={{ borderColor: C.borderLight, background: C.panel, borderRadius: 6 }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <DesignLabReadonlyChip active={item.source === "foresporsel"}>{sourceLabel(item.source)}</DesignLabReadonlyChip>
                  {item.requestType && <DealTypeTag type={item.requestType} />}
                </div>
                <p className="mt-2 truncate" style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{item.companyName}</p>
                {item.contactName && (
                  <p className="mt-1 truncate" style={{ fontSize: 12, color: C.textFaint }}>
                    {item.contactName}{item.contactTitle ? ` · ${item.contactTitle}` : ""}
                  </p>
                )}
                {item.note && (
                  <p className="mt-2 line-clamp-2" style={{ fontSize: 12, color: C.textMuted }}>{item.note}</p>
                )}
              </div>
              <span className="shrink-0" style={{ fontSize: 11, color: C.textFaint }}>{timeAgo(item.statusUpdatedAt)}</span>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {PIPELINE_STATUS_VALUES.map((status) => {
                  const meta = getPipelineStatusMeta(status);
                  return (
                    <button
                      key={status}
                      type="button"
                      disabled={savingStatusId === item.id}
                      onClick={() => onStatusChange(item, status)}
                      className="inline-flex items-center justify-center whitespace-nowrap transition-colors"
                      style={{
                        height: 26,
                        paddingInline: 9,
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: item.status === status ? 650 : 500,
                        ...(item.status === status
                          ? meta.colors
                          : { background: "transparent", color: C.textSecondary, border: `1px solid ${C.borderDefault}` }),
                        opacity: savingStatusId === item.id ? 0.6 : 1,
                      }}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                {item.source === "foresporsel" ? (
                  <DesignLabGhostAction onClick={() => onOpenRequest(item.sourceId)}>Åpne forespørsel</DesignLabGhostAction>
                ) : (
                  <DesignLabGhostAction onClick={() => onDeleteOpportunity(item)}>
                    <Trash2 style={{ width: 12, height: 12 }} /> Slett
                  </DesignLabGhostAction>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConsultantTypeTag({ type }: { type: ConsultantType }) {
  return (
    <DesignLabStaticTag
      colors={
        type === "intern"
          ? { background: "#111827", color: "#FFFFFF", border: "1px solid #111827", fontWeight: 650 }
          : { background: "#EAF0F9", color: "#1A4FA0", border: "1px solid #B3C8E8", fontWeight: 600 }
      }
    >
      {consultantTypeLabel(type)}
    </DesignLabStaticTag>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-48 items-center justify-center" style={{ color: C.textFaint, fontSize: 13 }}>
      {text}
    </div>
  );
}

function NewOpportunitySheet({
  open,
  onOpenChange,
  employees,
  externalConsultants,
  companies,
  contacts,
  cvPortraitMap,
  userId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: EmployeeOption[];
  externalConsultants: ExternalConsultantOption[];
  companies: CompanyOption[];
  contacts: ContactPreview[];
  cvPortraitMap: Map<number, string>;
  userId: string | null;
  onCreated: () => Promise<void>;
}) {
  const [consultantType, setConsultantType] = useState<ConsultantType>("intern");
  const [consultantId, setConsultantId] = useState("");
  const [consultantSearch, setConsultantSearch] = useState("");
  const [consultantPickerOpen, setConsultantPickerOpen] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [contactId, setContactId] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const consultantOptions = useMemo(
    () =>
      consultantType === "intern"
        ? employees.filter(isSearchableOpportunityEmployee)
        : externalConsultants.filter(isActiveExternalConsultant),
    [consultantType, employees, externalConsultants],
  );
  const filteredConsultants = useMemo(() => {
    const query = consultantSearch.trim().toLowerCase();
    return consultantOptions
      .filter((consultant) => {
        if (!query) return true;
        return [consultant.navn, consultant.status].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
      })
      .slice(0, 30);
  }, [consultantOptions, consultantSearch]);

  const filteredCompanies = useMemo(() => {
    const query = companySearch.trim().toLowerCase();
    return companies
      .filter((company) => !query || [company.name, company.status].filter(Boolean).some((value) => String(value).toLowerCase().includes(query)))
      .slice(0, 30);
  }, [companies, companySearch]);

  const companyContacts = useMemo(
    () => contacts.filter((contact) => !companyId || contact.company_id === companyId),
    [companyId, contacts],
  );
  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    return companyContacts
      .filter((contact) => {
        if (!query) return true;
        return [getContactName(contact), contact.title, contact.email]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .slice(0, 30);
  }, [companyContacts, contactSearch]);

  const reset = () => {
    setConsultantType("intern");
    setConsultantId("");
    setConsultantSearch("");
    setConsultantPickerOpen(false);
    setCompanyId("");
    setCompanySearch("");
    setCompanyPickerOpen(false);
    setContactId("");
    setContactSearch("");
    setContactPickerOpen(false);
    setTitle("");
    setNote("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const createOpportunity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!consultantId || !companyId || !contactId || !trimmedTitle) {
      toast.error("Fyll ut alle obligatoriske felt");
      return;
    }

    setSaving(true);
    try {
      if (!userId) {
        toast.error("Du må være innlogget for å opprette mulighet");
        return;
      }

      const { error } = await supabase.from("pipeline_muligheter").insert({
        konsulent_type: consultantType,
        ansatt_id: consultantType === "intern" ? Number(consultantId) : null,
        ekstern_id: consultantType === "ekstern" ? consultantId : null,
        company_id: companyId,
        contact_id: contactId,
        tittel: trimmedTitle,
        notat: note.trim() || null,
        status: "sendt_cv",
        created_by: userId,
      });
      if (error) throw error;

      await onCreated();
      toast.success("Mulighet opprettet");
      reset();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      const message = getErrorMessage(error);
      toast.error(message ? `Kunne ikke opprette mulighet: ${message}` : "Kunne ikke opprette mulighet");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DesignLabFormSheet open={open} onOpenChange={handleOpenChange} maxWidth={560}>
      <DesignLabFormSheetHeader title="Ny mulighet" subtitle="Når det er en mulighet uten direkte forespørsel" />
      <form onSubmit={createOpportunity} className="flex min-h-0 flex-1 flex-col">
        <DesignLabFormSheetBody>
          <SheetField>
            <FieldLabel required>Konsulenttype</FieldLabel>
            <select
              className={SELECT_CLASS}
              value={consultantType}
              required
              aria-required="true"
              onChange={(event) => {
                setConsultantType(event.target.value as ConsultantType);
                setConsultantId("");
                setConsultantSearch("");
                setConsultantPickerOpen(false);
              }}
            >
              <option value="intern">Ansatt</option>
              <option value="ekstern">Ekstern</option>
            </select>
          </SheetField>

          <SheetField>
            <FieldLabel required>Konsulent</FieldLabel>
            <SearchSelect
              value={consultantId}
              search={consultantSearch}
              onSearchChange={(value) => {
                setConsultantSearch(value);
                setConsultantId("");
              }}
              open={consultantPickerOpen}
              onOpenChange={setConsultantPickerOpen}
              placeholder="Søk etter konsulent..."
              emptyText="Ingen konsulenter funnet"
              required
              options={filteredConsultants.map((consultant) => ({
                id: String(consultant.id),
                label: consultant.navn || "Uten navn",
                avatarUrl:
                  consultantType === "intern"
                    ? cvPortraitMap.get(Number(consultant.id)) || (consultant as EmployeeOption).bilde_url || null
                    : null,
              }))}
              showAvatar
              onSelect={(option) => {
                setConsultantId(option.id);
                setConsultantSearch(option.label);
                setConsultantPickerOpen(false);
              }}
              onClear={() => {
                setConsultantId("");
                setConsultantSearch("");
              }}
            />
          </SheetField>

          <SheetField>
            <FieldLabel required>Selskap</FieldLabel>
            <SearchSelect
              value={companyId}
              search={companySearch}
              onSearchChange={(value) => {
                setCompanySearch(value);
                setCompanyId("");
                setContactId("");
                setContactSearch("");
              }}
              open={companyPickerOpen}
              onOpenChange={setCompanyPickerOpen}
              placeholder="Søk etter selskap..."
              emptyText="Ingen selskaper funnet"
              required
              options={filteredCompanies.map((company) => ({
                id: company.id,
                label: company.name,
              }))}
              onSelect={(option) => {
                setCompanyId(option.id);
                setCompanySearch(option.label);
                setContactId("");
                setContactSearch("");
                setCompanyPickerOpen(false);
              }}
              onClear={() => {
                setCompanyId("");
                setCompanySearch("");
                setContactId("");
                setContactSearch("");
              }}
            />
          </SheetField>

          <SheetField>
            <FieldLabel required>Kontaktperson</FieldLabel>
            <SearchSelect
              value={contactId}
              search={contactSearch}
              onSearchChange={(value) => {
                setContactSearch(value);
                setContactId("");
              }}
              open={contactPickerOpen}
              onOpenChange={setContactPickerOpen}
              placeholder={companyId ? "Søk etter kontaktperson..." : "Velg selskap først..."}
              emptyText={companyId ? "Ingen kontakter på dette selskapet" : "Velg selskap først"}
              disabled={!companyId}
              required
              options={filteredContacts.map((contact) => ({
                id: contact.id,
                label: getContactName(contact) || "Uten navn",
                meta: contact.title || contact.email || null,
              }))}
              onSelect={(option) => {
                setContactId(option.id);
                setContactSearch(option.label);
                setContactPickerOpen(false);
              }}
              onClear={() => {
                setContactId("");
                setContactSearch("");
              }}
            />
          </SheetField>

          <SheetField>
            <FieldLabel required>Tittel</FieldLabel>
            <input
              className={SELECT_CLASS}
              value={title}
              required
              aria-required="true"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="F.eks. Kunden vurderer kandidaten"
            />
          </SheetField>

          <SheetField>
            <FieldLabel>Notat</FieldLabel>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className={TEXTAREA_CLASS}
              placeholder="Kort kontekst, hva kunden vurderer, neste steg..."
            />
          </SheetField>
        </DesignLabFormSheetBody>

        <DesignLabFormSheetFooter>
          <DesignLabSecondaryAction type="button" onClick={() => handleOpenChange(false)} disabled={saving}>Avbryt</DesignLabSecondaryAction>
          <DesignLabPrimaryAction type="submit" disabled={saving}>
            {saving ? "Oppretter..." : "Opprett mulighet"}
          </DesignLabPrimaryAction>
        </DesignLabFormSheetFooter>
      </form>
    </DesignLabFormSheet>
  );
}

function SheetField({ children }: { children: ReactNode }) {
  return <div className="grid min-w-0 gap-1.5">{children}</div>;
}

type SearchSelectOption = {
  id: string;
  label: string;
  meta?: string | null;
  avatarUrl?: string | null;
};

function SearchSelect({
  value,
  search,
  onSearchChange,
  open,
  onOpenChange,
  placeholder,
  emptyText,
  disabled = false,
  required = false,
  showAvatar = false,
  options,
  onSelect,
  onClear,
}: {
  value: string;
  search: string;
  onSearchChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder: string;
  emptyText: string;
  disabled?: boolean;
  required?: boolean;
  showAvatar?: boolean;
  options: SearchSelectOption[];
  onSelect: (option: SearchSelectOption) => void;
  onClear: () => void;
}) {
  return (
    <div className="relative min-w-0">
      <input
        className={`${SELECT_CLASS} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        value={search}
        required={required}
        aria-required={required}
        disabled={disabled}
        onChange={(event) => {
          onSearchChange(event.target.value);
          onOpenChange(true);
        }}
        onFocus={() => onOpenChange(true)}
        onBlur={() => window.setTimeout(() => onOpenChange(false), 160)}
        placeholder={placeholder}
      />
      {value && !disabled ? (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onClear}
          className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-sm text-[#8C929C] hover:text-[#1F2328]"
          style={{ width: 22, height: 22 }}
          aria-label="Nullstill valg"
        >
          <X style={{ width: 13, height: 13 }} />
        </button>
      ) : null}
      {open && !disabled ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border bg-white shadow-lg" style={{ borderColor: C.borderDefault }}>
          {options.length === 0 ? (
            <p className="px-3 py-2.5" style={{ fontSize: 12, color: C.textFaint }}>{emptyText}</p>
          ) : (
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(option)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[#F6F7F9]"
              >
                {showAvatar ? (
                  option.avatarUrl ? (
                    <img
                      src={option.avatarUrl}
                      alt={option.label}
                      className="h-7 w-7 shrink-0 rounded-full border object-cover"
                      style={{ borderColor: C.borderLight }}
                    />
                  ) : (
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                      style={{ background: C.filterActiveBg, color: C.textPrimary, fontSize: 10, fontWeight: 650 }}
                    >
                      {getInitials(option.label)}
                    </span>
                  )
                ) : null}
                <span className="min-w-0">
                  <p className="truncate" style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{option.label}</p>
                  {option.meta ? (
                    <p className="truncate" style={{ fontSize: 11, color: C.textFaint }}>{option.meta}</p>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function FieldLabel({ children, required = false }: { children: ReactNode; required?: boolean }) {
  return (
    <label style={{ fontSize: 11, color: C.textFaint, fontWeight: 650, letterSpacing: "0.08em", textTransform: "uppercase" }}>
      {children}
      {required ? <span style={{ color: C.danger, marginLeft: 3 }}>*</span> : null}
    </label>
  );
}
