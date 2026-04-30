import { Fragment, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, X } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { nb } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { DesignLabMobileNavButton, DesignLabSidebar } from "@/components/designlab/DesignLabSidebar";
import { DesignLabFilterButton, DesignLabSearchInput, DesignLabStaticTag } from "@/components/designlab/controls";
import {
  DesignLabGhostAction,
  DesignLabPrimaryAction,
  DesignLabReadonlyChip,
  DesignLabSecondaryAction,
} from "@/components/designlab/system";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { C } from "@/components/designlab/theme";
import { getDesignLabTextSizeStyle, type TextSize } from "@/components/designlab/TextSizeControl";
import { crmQueryKeys } from "@/lib/queryKeys";
import { getInitials } from "@/lib/utils";
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
type FilterStatus = "aktive" | "alle" | PipelineStatus;
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
};

type ExternalConsultantOption = {
  id: string;
  navn: string | null;
  status: string | null;
  type?: string | null;
  company_id?: string | null;
};

type RequestLinkRow = {
  id: string;
  ansatt_id: number | null;
  ekstern_id: string | null;
  konsulent_type: string;
  created_at: string | null;
  status: string;
  status_updated_at: string;
  stacq_ansatte: { id: number; navn: string; status: string | null } | null;
  external_consultants: { id: string; navn: string | null; status: string | null; type: string | null } | null;
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
  stacq_ansatte: { id: number; navn: string; status: string | null } | null;
  external_consultants: { id: string; navn: string | null; status: string | null; type: string | null } | null;
  companies: { id: string; name: string } | null;
  contacts: ContactPreview | null;
};

const STATUS_FILTERS: Array<{ value: FilterStatus; label: string }> = [
  { value: "aktive", label: "Aktive" },
  { value: "alle", label: "Alle" },
  ...PIPELINE_STATUS_VALUES.map((value) => ({ value, label: PIPELINE_STATUS_META[value].label })),
];

const TYPE_FILTERS: Array<{ value: TypeFilter; label: string }> = [
  { value: "alle", label: "Alle" },
  { value: "intern", label: "Ansatte" },
  { value: "ekstern", label: "Eksterne" },
];

const SOURCE_FILTERS: Array<{ value: SourceFilter; label: string }> = [
  { value: "alle", label: "Alle" },
  { value: "foresporsel", label: "Forespørsler" },
  { value: "mulighet", label: "Muligheter" },
];

const SELECT_CLASS =
  "h-9 rounded-md border border-[#D7DCE3] bg-white px-2.5 text-[13px] text-[#1F2328] outline-none focus:border-[#5E6AD2]";

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

function statusMatchesFilter(status: PipelineStatus, filter: FilterStatus) {
  if (filter === "alle") return true;
  if (filter === "aktive") return isOpenPipelineStatus(status);
  return status === filter;
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
        items: groupItems.sort(
          (left, right) => new Date(right.statusUpdatedAt).getTime() - new Date(left.statusUpdatedAt).getTime(),
        ),
        openItems: groupItems.filter((item) => isOpenPipelineStatus(item.status)).length,
        requestCount: groupItems.filter((item) => item.source === "foresporsel").length,
        opportunityCount: groupItems.filter((item) => item.source === "mulighet").length,
        highestStatus: getHighestStatus(groupItems),
        latestAt,
      } satisfies PipelineGroup;
    })
    .sort((left, right) => new Date(right.latestAt).getTime() - new Date(left.latestAt).getTime());
}

export default function Pipeline() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [textSize] = usePersistentState<TextSize>("dl-text-size", "M");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("aktive");
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
          "id, ansatt_id, ekstern_id, konsulent_type, created_at, status, status_updated_at, stacq_ansatte(id, navn, status), external_consultants(id, navn, status, type), foresporsler(id, selskap_navn, selskap_id, kontakt_id, mottatt_dato, frist_dato, status, type, referanse, companies!foresporsler_selskap_id_fkey(id, name), contacts!foresporsler_kontakt_id_fkey(id, first_name, last_name, title, email))",
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
          "id, ansatt_id, ekstern_id, konsulent_type, company_id, contact_id, tittel, notat, status, status_updated_at, created_at, updated_at, stacq_ansatte(id, navn, status), external_consultants(id, navn, status, type), companies!pipeline_muligheter_company_id_fkey(id, name), contacts!pipeline_muligheter_contact_id_fkey(id, first_name, last_name, title, email)",
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
        .select("id, navn, status, tilgjengelig_fra, slutt_dato")
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

  const pipelineItems = useMemo<PipelineItem[]>(() => {
    const requestItems = requestLinks.map((link): PipelineItem | null => {
      const request = link.foresporsler;
      if (!request) return null;

      const consultantType = link.konsulent_type === "ekstern" ? "ekstern" : "intern";
      const consultant = consultantType === "intern" ? link.stacq_ansatte : link.external_consultants;
      const consultantId = consultantType === "intern" ? link.ansatt_id : link.ekstern_id;
      const consultantName = consultant?.navn || "Ukjent konsulent";
      const contactName = getContactName(request.contacts);

      return {
        id: `foresporsel:${link.id}`,
        source: "foresporsel",
        sourceId: request.id,
        consultantKey: `${consultantType}:${consultantId}`,
        consultantType,
        consultantId: String(consultantId || ""),
        consultantName,
        consultantStatus: consultant?.status || null,
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

      return {
        id: `mulighet:${opportunity.id}`,
        source: "mulighet",
        sourceId: opportunity.id,
        consultantKey: `${consultantType}:${consultantId}`,
        consultantType,
        consultantId: String(consultantId || ""),
        consultantName: consultant?.navn || "Ukjent konsulent",
        consultantStatus: consultant?.status || null,
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
  }, [opportunities, requestLinks]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return pipelineItems.filter((item) => {
      if (typeFilter !== "alle" && item.consultantType !== typeFilter) return false;
      if (sourceFilter !== "alle" && item.source !== sourceFilter) return false;
      if (!statusMatchesFilter(item.status, statusFilter)) return false;
      if (!query) return true;

      return [
        item.consultantName,
        item.companyName,
        item.contactName,
        item.contactTitle,
        item.title,
        item.note,
        sourceLabel(item.source),
        getPipelineStatusMeta(item.status).label,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [pipelineItems, search, sourceFilter, statusFilter, typeFilter]);

  const groups = useMemo(() => buildPipelineGroups(filteredItems), [filteredItems]);
  const selectedGroup = useMemo(
    () => groups.find((group) => group.consultantKey === selectedGroupKey) || groups[0] || null,
    [groups, selectedGroupKey],
  );

  const stats = useMemo(() => {
    const openItems = pipelineItems.filter((item) => isOpenPipelineStatus(item.status));
    return {
      consultants: new Set(pipelineItems.map((item) => item.consultantKey)).size,
      open: openItems.length,
      sentCv: pipelineItems.filter((item) => item.status === "sendt_cv").length,
      interviews: pipelineItems.filter((item) => item.status === "intervju").length,
      won: pipelineItems.filter((item) => item.status === "vunnet").length,
      direct: pipelineItems.filter((item) => item.source === "mulighet").length,
    };
  }, [pipelineItems]);

  const isLoading = isLoadingRequestLinks || isLoadingOpportunities;

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("aktive");
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

        <div className="dl-filter-bar shrink-0 space-y-3" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_auto] md:items-center">
            <DesignLabSearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Søk konsulent, selskap, kontakt eller mulighet..."
            />
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <FilterGroup
                label="STATUS"
                options={STATUS_FILTERS}
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as FilterStatus)}
              />
              <FilterGroup
                label="TYPE"
                options={TYPE_FILTERS}
                value={typeFilter}
                onChange={(value) => setTypeFilter(value as TypeFilter)}
              />
              <FilterGroup
                label="KILDE"
                options={SOURCE_FILTERS}
                value={sourceFilter}
                onChange={(value) => setSourceFilter(value as SourceFilter)}
              />
              {(search || statusFilter !== "aktive" || typeFilter !== "alle" || sourceFilter !== "alle") && (
                <DesignLabGhostAction onClick={resetFilters}>
                  <X style={{ width: 12, height: 12 }} /> Nullstill
                </DesignLabGhostAction>
              )}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <PipelineStat label="Konsulenter" value={stats.consultants} />
            <PipelineStat label="Aktive løp" value={stats.open} />
            <PipelineStat label="Sendt CV" value={stats.sentCv} />
            <PipelineStat label="Intervju" value={stats.interviews} />
            <PipelineStat label="Vunnet" value={stats.won} />
            <PipelineStat label="Direkte" value={stats.direct} />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <section className="min-w-0 flex-1 overflow-y-auto" style={{ background: C.panel }}>
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
                    onClick={() => setSelectedGroupKey(group.consultantKey)}
                  />
                  {isMobile && selectedGroupKey === group.consultantKey && (
                    <PipelineDetail
                      group={group}
                      savingStatusId={savingStatusId}
                      onStatusChange={updateStatus}
                      onOpenRequest={(id) => navigate(`/foresporsler?id=${id}`)}
                      onDeleteOpportunity={deleteOpportunity}
                    />
                  )}
                </Fragment>
              ))
            )}
          </section>

          {!isMobile && (
            <aside
              className="hidden w-[42%] min-w-[420px] max-w-[680px] shrink-0 overflow-y-auto border-l lg:block"
              style={{ borderColor: C.borderLight, background: C.surface }}
            >
              {selectedGroup ? (
                <PipelineDetail
                  group={selectedGroup}
                  savingStatusId={savingStatusId}
                  onStatusChange={updateStatus}
                  onOpenRequest={(id) => navigate(`/foresporsler?id=${id}`)}
                  onDeleteOpportunity={deleteOpportunity}
                />
              ) : (
                <EmptyState text="Velg en konsulent for detaljer." />
              )}
            </aside>
          )}
        </div>
      </main>

      <NewOpportunityDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        employees={employees}
        externalConsultants={externalConsultants}
        companies={companies}
        contacts={contacts}
        userId={user?.id || null}
        onCreated={invalidatePipelineQueries}
      />
    </div>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span style={{ fontSize: 10, fontWeight: 600, color: C.textFaint, letterSpacing: "0.08em" }}>{label}</span>
      <div className="flex items-center gap-1">
        {options.map((option) => (
          <DesignLabFilterButton
            key={option.value}
            active={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </DesignLabFilterButton>
        ))}
      </div>
    </div>
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
  return (
    <div className="sticky top-0 z-10 grid items-center border-b" style={{ gridTemplateColumns: "minmax(220px,1.4fr) 120px 150px 140px 110px", height: 32, paddingInline: 16, borderColor: C.borderLight, background: C.surfaceAlt }}>
      {["Konsulent", "Type", "Pipeline", "Høyeste status", "Sist"].map((label) => (
        <span key={label} style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted }}>
          {label}
        </span>
      ))}
    </div>
  );
}

function PipelineGroupRow({ group, active, onClick }: { group: PipelineGroup; active: boolean; onClick: () => void }) {
  const statusMeta = getPipelineStatusMeta(group.highestStatus);
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full cursor-pointer items-center border-b text-left transition-colors"
      style={{
        gridTemplateColumns: "minmax(220px,1.4fr) 120px 150px 140px 110px",
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
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: C.filterActiveBg, color: C.textPrimary, fontSize: 11, fontWeight: 650 }}>
          {getInitials(group.consultantName)}
        </div>
        <div className="min-w-0">
          <p className="truncate" style={{ fontSize: 13, color: C.text, fontWeight: 550 }}>{group.consultantName}</p>
          {group.consultantStatus && <p className="truncate" style={{ fontSize: 11, color: C.textFaint }}>{group.consultantStatus}</p>}
        </div>
      </div>
      <div>
        <ConsultantTypeTag type={group.consultantType} />
      </div>
      <div className="flex items-center gap-1.5">
        <DesignLabReadonlyChip active={false}>{group.requestCount} foresp.</DesignLabReadonlyChip>
        <DesignLabReadonlyChip active={false}>{group.opportunityCount} mul.</DesignLabReadonlyChip>
      </div>
      <div>
        <DesignLabStaticTag colors={statusMeta.colors}>{statusMeta.label}</DesignLabStaticTag>
      </div>
      <span style={{ fontSize: 12, color: C.textMuted }}>{timeAgo(group.latestAt)}</span>
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
        {group.items.map((item) => (
          <div key={item.id} className="border p-3" style={{ borderColor: C.borderLight, background: C.panel, borderRadius: 6 }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <DesignLabReadonlyChip active={item.source === "foresporsel"}>{sourceLabel(item.source)}</DesignLabReadonlyChip>
                  {item.requestType && <DesignLabReadonlyChip active={false}>{item.requestType}</DesignLabReadonlyChip>}
                </div>
                <p className="mt-2 truncate" style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{item.companyName}</p>
                <p className="truncate" style={{ fontSize: 12, color: C.textMuted }}>{item.title}</p>
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

function NewOpportunityDialog({
  open,
  onOpenChange,
  employees,
  externalConsultants,
  companies,
  contacts,
  userId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: EmployeeOption[];
  externalConsultants: ExternalConsultantOption[];
  companies: CompanyOption[];
  contacts: ContactPreview[];
  userId: string | null;
  onCreated: () => Promise<void>;
}) {
  const [consultantType, setConsultantType] = useState<ConsultantType>("intern");
  const [consultantId, setConsultantId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [contactId, setContactId] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const consultantOptions = consultantType === "intern" ? employees : externalConsultants;
  const companyContacts = useMemo(
    () => contacts.filter((contact) => !companyId || contact.company_id === companyId),
    [companyId, contacts],
  );

  const reset = () => {
    setConsultantType("intern");
    setConsultantId("");
    setCompanyId("");
    setContactId("");
    setTitle("");
    setNote("");
  };

  const createOpportunity = async () => {
    if (!consultantId || !companyId || !contactId) {
      toast.error("Velg konsulent, selskap og kontaktperson");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("pipeline_muligheter").insert({
        konsulent_type: consultantType,
        ansatt_id: consultantType === "intern" ? Number(consultantId) : null,
        ekstern_id: consultantType === "ekstern" ? consultantId : null,
        company_id: companyId,
        contact_id: contactId,
        tittel: title.trim() || "Direkte mulighet",
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
      toast.error("Kunne ikke opprette mulighet");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ny mulighet</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <FieldLabel>Konsulenttype</FieldLabel>
            <select
              className={SELECT_CLASS}
              value={consultantType}
              onChange={(event) => {
                setConsultantType(event.target.value as ConsultantType);
                setConsultantId("");
              }}
            >
              <option value="intern">Ansatt</option>
              <option value="ekstern">Ekstern</option>
            </select>

            <FieldLabel>Konsulent</FieldLabel>
            <select className={SELECT_CLASS} value={consultantId} onChange={(event) => setConsultantId(event.target.value)}>
              <option value="">Velg konsulent</option>
              {consultantOptions.map((consultant) => (
                <option key={String(consultant.id)} value={String(consultant.id)}>
                  {consultant.navn || "Uten navn"}{consultant.status ? ` · ${consultant.status}` : ""}
                </option>
              ))}
            </select>

            <FieldLabel>Selskap</FieldLabel>
            <select
              className={SELECT_CLASS}
              value={companyId}
              onChange={(event) => {
                setCompanyId(event.target.value);
                setContactId("");
              }}
            >
              <option value="">Velg selskap</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>

            <FieldLabel>Kontaktperson</FieldLabel>
            <select className={SELECT_CLASS} value={contactId} onChange={(event) => setContactId(event.target.value)}>
              <option value="">Velg kontakt</option>
              {companyContacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {getContactName(contact) || "Uten navn"}{contact.title ? ` · ${contact.title}` : ""}
                </option>
              ))}
            </select>

            <FieldLabel>Tittel</FieldLabel>
            <input
              className={SELECT_CLASS}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="F.eks. Embedded vurdering hos kunde"
            />

            <FieldLabel>Notat</FieldLabel>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="min-h-[88px] rounded-md border border-[#D7DCE3] bg-white px-2.5 py-2 text-[13px] text-[#1F2328] outline-none focus:border-[#5E6AD2]"
              placeholder="Kort kontekst, hva kunden vurderer, neste steg..."
            />
          </div>
        </div>

        <DialogFooter>
          <DesignLabSecondaryAction onClick={() => onOpenChange(false)} disabled={saving}>Avbryt</DesignLabSecondaryAction>
          <DesignLabPrimaryAction onClick={createOpportunity} disabled={saving}>
            {saving ? "Oppretter..." : "Opprett mulighet"}
          </DesignLabPrimaryAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="pt-2" style={{ fontSize: 11, color: C.textFaint, fontWeight: 650, letterSpacing: "0.08em", textTransform: "uppercase" }}>
      {children}
    </label>
  );
}
