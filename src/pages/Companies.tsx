import { useState, useEffect, useRef, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, ArrowUpDown, Loader2, X, ChevronDown, Map as MapIcon } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePersistentState } from "@/hooks/usePersistentState";
import { cn } from "@/lib/utils";

import { BrregSearch, lookupByOrgNr } from "@/components/BrregSearch";
import {
  DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS,
  DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS,
  DESIGN_LAB_NEUTRAL_TAG_INACTIVE_HOVER_COLORS,
  DesignLabFilterButton,
} from "@/components/designlab/controls";
import { relativeDate } from "@/lib/relativeDate";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { crmQueryKeys } from "@/lib/queryKeys";
import {
  GEO_FILTERS,
  companyMatchesGeoFilter,
  getGeoFilterDescription,
  normalizeGeoFilter,
  resolveCompanyGeoAreas,
  type GeoFilter,
} from "@/lib/companyGeoAreas";

type SortField = "name" | "type" | "city" | "last_activity" | "tasks";
type SortDir = "asc" | "desc";
const SHOW_GEO_MAP_ACTION = false;

import { getEffectiveSignal } from "@/lib/categoryUtils";
import {
  DesignLabGhostAction,
  DesignLabModalActions,
  DesignLabModalChipGroup,
  DesignLabModalContent,
  DesignLabModalField,
  DesignLabModalForm,
  DesignLabModalInlineAction,
  DesignLabModalInput,
  DesignLabModalLabel,
  DesignLabPrimaryAction,
  getDesignLabModalInputStyle,
  useDesignLabModalScale,
} from "@/components/designlab/system";
import { DesignLabEntitySheet } from "@/components/designlab/DesignLabEntitySheet";

const TYPE_BADGE_COLORS: Record<string, { label: string; badgeColor: string }> = {
  prospect: { label: "Potensiell kunde", badgeColor: "bg-amber-100 text-amber-800 border-amber-200" },
  customer: { label: "Kunde", badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  kunde: { label: "Kunde", badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  churned: { label: "Ikke relevant selskap", badgeColor: "bg-red-50 text-red-700 border-red-200" },
  partner: { label: "Partner", badgeColor: "bg-gray-100 text-gray-600 border-gray-200" },
  lead: { label: "Lead", badgeColor: "bg-gray-100 text-gray-600 border-gray-200" },
  active: { label: "Aktiv", badgeColor: "bg-gray-100 text-gray-600 border-gray-200" },
};

const statusLabels: Record<string, { label: string; className: string; badgeColor: string }> = {
  lead: {
    label: "Lead",
    className: "bg-tag text-tag-foreground",
    badgeColor: "bg-gray-100 text-gray-600 border-gray-200",
  },
  prospect: {
    label: "Potensiell kunde",
    className: "bg-warning/10 text-warning",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
  },
  customer: {
    label: "Kunde",
    className: "bg-success/10 text-success",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  kunde: {
    label: "Kunde",
    className: "bg-success/10 text-success",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  churned: {
    label: "Ikke relevant selskap",
    className: "bg-destructive/10 text-destructive",
    badgeColor: "bg-red-50 text-red-700 border-red-200",
  },
  partner: {
    label: "Partner",
    className: "bg-secondary text-muted-foreground",
    badgeColor: "bg-gray-100 text-gray-600 border-gray-200",
  },
};

const TYPE_ORDER = ["prospect", "customer", "churned", "partner", "lead"];

const CHIP_BASE = "h-7 px-2.5 text-[0.75rem] rounded-[6px] border transition-colors cursor-pointer font-medium";
const CHIP_OFF = `${CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;
const CHIP_ON = `${CHIP_BASE} bg-[#E8ECF5] text-[#1A1C1F] border-[#C5CBE8] font-semibold`;

const getPrimaryLocation = (value: string | null | undefined) => {
  if (!value) return "";
  return value
    .split(/[;,/]/)
    .map((part) => part.trim())
    .find(Boolean) || value.trim();
};

const OrgNrInput = ({
  value,
  onChange,
  onLookup,
  className,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  onLookup: (result: { name: string | null; city: string | null; zip_code: string | null; address: string | null; industry: string | null }) => void;
  className?: string;
  style?: CSSProperties;
}) => {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cleaned = value.replace(/\s/g, "");
    if (cleaned.length !== 9 || !/^\d{9}$/.test(cleaned)) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      const r = await lookupByOrgNr(cleaned);
      if (r) {
        onLookup({
          name: r.navn,
          city: r.forretningsadresse?.poststed || r.forretningsadresse?.kommune || null,
          zip_code: r.forretningsadresse?.postnummer || null,
          address: r.forretningsadresse?.adresse?.filter(Boolean).join(", ") || null,
          industry: r.naeringskode1?.beskrivelse || null,
        });
      }
      setLoading(false);
    }, 400);
    return () => clearTimeout(timerRef.current);
  }, [value]);

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="923 456 789"
        className={className ?? "h-10 rounded-lg"}
        style={style}
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
      )}
    </div>
  );
};

const Companies = () => {
  const [search, setSearch] = usePersistentState("stacq:companies:search", "");
  const [ownerFilter, setOwnerFilter] = usePersistentState("stacq:companies:ownerFilter", "all");
  const [statusFilter, setStatusFilter] = usePersistentState("stacq:companies:statusFilter", "all");
  const [geoFilter, setGeoFilter] = usePersistentState<GeoFilter>("stacq:companies:geoFilter", "Alle");
  const effectiveGeoFilter = normalizeGeoFilter(geoFilter);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    org_number: "",
    city: "",
    zip_code: "",
    address: "",
    industry: "",
    website: "",
    linkedin: "",
    status: "prospect",
    owner_id: "",
  });
  const [locations, setLocations] = useState<string[]>([""]);
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const primaryLocation = getPrimaryLocation(form.city);
    if (primaryLocation && locations[0] === "") {
      setLocations((prev) => [primaryLocation, ...prev.slice(1)]);
    }
  }, [form.city]);
  const [sort, setSort] = usePersistentState<{ field: SortField; dir: SortDir }>("stacq:companies:sort", {
    field: "name",
    dir: "asc",
  });
  const [userHasSorted, setUserHasSorted] = usePersistentState("stacq:companies:userHasSorted", false);
  const modalScale = useDesignLabModalScale();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  const prefillCompanyName = searchParams.get("ny")?.trim() || "";

  useEffect(() => {
    if (!prefillCompanyName) return;
    setOpen(true);
    setForm((prev) =>
      prev.name === prefillCompanyName
        ? prev
        : {
            name: prefillCompanyName,
            org_number: "",
            city: "",
            zip_code: "",
            address: "",
            industry: "",
            website: "",
            linkedin: "",
            status: "prospect",
            owner_id: "",
          },
    );
    setLocations([""]);
  }, [prefillCompanyName]);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: crmQueryKeys.companies.all(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*, contacts(id), profiles!companies_owner_id_fkey(id, full_name)")
        .order("name");
      if (error) throw error;

      const companyIds = data.map((c) => c.id);
      const companyIdSet = new Set(companyIds);
      // Get contact IDs for each company
      const contactIds = data.flatMap((c) => (c.contacts || []).map((ct: any) => ct.id));
      const contactIdSet = new Set(contactIds);

      // Fetch ALL activities/tasks without .in() to avoid URL length limits (400 errors)
      const [actRes, taskRes, contactActRes, contactTaskRes] = await Promise.all([
        supabase
          .from("activities")
          .select("company_id, created_at, subject, description")
          .not("company_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase
          .from("tasks")
          .select("company_id, due_date, title, description, status, created_at")
          .not("company_id", "is", null)
          .neq("status", "done")
          .limit(2000),
        supabase
          .from("activities")
          .select("contact_id, created_at, subject, description")
          .not("contact_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase
          .from("tasks")
          .select("contact_id, due_date, title, description, status, created_at")
          .not("contact_id", "is", null)
          .neq("status", "done")
          .limit(2000),
      ]);

      // Build contact→company map
      const contactToCompany: Record<string, string> = {};
      data.forEach((c) =>
        (c.contacts || []).forEach((ct: any) => {
          contactToCompany[ct.id] = c.id;
        }),
      );

      const now = new Date();
      const isPast = (d: string) => new Date(d) <= now;
      const lastActivityMap: Record<string, string> = {};
      const taskCountMap: Record<string, number> = {};
      const overdueTaskMap: Record<string, boolean> = {};

      // Signal maps: ONLY contact-sourced activities/tasks (not company-level)
      const companyActsMap: Record<string, any[]> = {};
      const companyTasksMap: Record<string, any[]> = {};

      // Company-level activities: only for lastActivityMap (not signal)
      (actRes.data || []).forEach((a) => {
        if (!a.company_id || !companyIdSet.has(a.company_id)) return;
        if (isPast(a.created_at) && !lastActivityMap[a.company_id]) lastActivityMap[a.company_id] = a.created_at;
      });

      // Contact-level activities: for lastActivityMap AND signal
      ((contactActRes as any).data || []).forEach((a: any) => {
        const cid = contactToCompany[a.contact_id];
        if (!cid) return;
        if (isPast(a.created_at) && (!lastActivityMap[cid] || a.created_at > lastActivityMap[cid]))
          lastActivityMap[cid] = a.created_at;
        if (!companyActsMap[cid]) companyActsMap[cid] = [];
        companyActsMap[cid].push(a);
      });

      // Company-level tasks: only for taskCount/overdue (not signal)
      (taskRes.data || []).forEach((t) => {
        if (!t.company_id || !companyIdSet.has(t.company_id)) return;
        taskCountMap[t.company_id] = (taskCountMap[t.company_id] || 0) + 1;
        if (t.due_date && new Date(t.due_date) < new Date()) overdueTaskMap[t.company_id] = true;
      });

      // Contact-level tasks: for taskCount/overdue AND signal
      ((contactTaskRes as any).data || []).forEach((t: any) => {
        const cid = contactToCompany[t.contact_id];
        if (!cid) return;
        taskCountMap[cid] = (taskCountMap[cid] || 0) + 1;
        if (t.due_date && new Date(t.due_date) < new Date()) overdueTaskMap[cid] = true;
        if (!companyTasksMap[cid]) companyTasksMap[cid] = [];
        companyTasksMap[cid].push(t);
      });

      const signalMap: Record<string, string> = {};
      for (const c of data) {
        const sig = getEffectiveSignal(
          (companyActsMap[c.id] || []).map((a: any) => ({
            created_at: a.created_at,
            subject: a.subject,
            description: a.description,
          })),
          (companyTasksMap[c.id] || []).map((t: any) => ({
            created_at: t.created_at,
            title: t.title,
            description: t.description,
            due_date: t.due_date,
          })),
        );
        signalMap[c.id] = sig || "";
      }

      return data.map((c) => ({
        ...c,
        lastActivity: lastActivityMap[c.id] || null,
        taskCount: taskCountMap[c.id] || 0,
        hasOverdue: overdueTaskMap[c.id] || false,
        signal: signalMap[c.id] || "",
      }));
    },
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: crmQueryKeys.profiles.all(),
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.owner_id) throw new Error("Missing company owner");
      const finalLocations = locations.map((location) => location.trim()).filter(Boolean);
      const cityValue = finalLocations.length > 0 ? finalLocations.join(", ") : form.city || null;
      const geoResolution = resolveCompanyGeoAreas({
        city: cityValue,
        address: form.address,
        zip_code: form.zip_code,
        locations: finalLocations,
      });
      const { error } = await supabase.from("companies").insert({
        name: form.name,
        org_number: form.org_number || null,
        address: form.address || null,
        city: cityValue,
        zip_code: form.zip_code || null,
        industry: form.industry || null,
        website: form.website || null,
        linkedin: form.linkedin || null,
        geo_areas: geoResolution.areas,
        geo_source: geoResolution.source,
        geo_unresolved_places: geoResolution.unresolvedPlaces,
        geo_updated_at: new Date().toISOString(),
        created_by: user?.id,
        status: form.status,
        owner_id: form.owner_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.companies.all() });
      setOpen(false);
      setForm({
        name: "",
        org_number: "",
        city: "",
        zip_code: "",
        address: "",
        industry: "",
        website: "",
        linkedin: "",
        status: "prospect",
        owner_id: "",
      });
      setLocations([""]);
      if (prefillCompanyName) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("ny");
        setSearchParams(nextParams, { replace: true });
      }
      toast.success("Selskap opprettet");
    },
    onError: () => toast.error("Kunne ikke opprette selskap"),
  });

  const getOwnerId = (company: any) => (company.profiles as any)?.id || company.owner_id || null;

  const ownerList = allProfiles
    .filter((profile) => Boolean(profile.full_name))
    .map((profile) => [profile.id, profile.full_name] as const);

  useEffect(() => {
    if (!open || form.owner_id || !user?.id) return;
    if (ownerList.some(([id]) => id === user.id)) {
      setForm((prev) => ({ ...prev, owner_id: user.id }));
    }
  }, [open, form.owner_id, ownerList, user?.id]);

  // Signal is read-only in company list — users set signals from the company detail page

  const TYPE_OPTIONS = [
    { value: "prospect", label: "Potensiell kunde", badgeColor: "bg-amber-100 text-amber-800 border-amber-200" },
    { value: "customer", label: "Kunde", badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    { value: "partner", label: "Partner", badgeColor: "bg-gray-100 text-gray-600 border-gray-200" },
    { value: "churned", label: "Ikke relevant selskap", badgeColor: "bg-red-50 text-red-700 border-red-200" },
  ];

  const setTypeMutation = useMutation({
    mutationFn: async ({ companyId, status }: { companyId: string; status: string }) => {
      const { error } = await supabase.from("companies").update({ status }).eq("id", companyId);
      if (error) throw error;
    },
    onMutate: async ({ companyId, status }) => {
      queryClient.setQueryData(crmQueryKeys.companies.all(), (old: any[]) =>
        old?.map((c) => (c.id === companyId ? { ...c, status } : c)),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.companies.all() });
      toast.success("Type oppdatert");
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.companies.all() });
      toast.error("Kunne ikke oppdatere type");
    },
  });

  const filtered = companies.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q || c.name.toLowerCase().includes(q) || c.org_number?.includes(q) || c.industry?.toLowerCase().includes(q);
    const matchOwner = ownerFilter === "all" || getOwnerId(c) === ownerFilter;
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "__never_contacted__" ? ((c.contacts || []).length === 0 || !c.lastActivity) : c.status === statusFilter);
    const matchGeo = companyMatchesGeoFilter(c, effectiveGeoFilter);
    return matchSearch && matchOwner && matchStatus && matchGeo;
  });

  const SIGNAL_PRIORITY: Record<string, number> = {
    "Behov nå": 0,
    "Får fremtidig behov": 1,
    "Får kanskje behov": 2,
    "Ukjent om behov": 3,
    "Ikke aktuelt": 4,
  };

  const TYPE_PRIORITY: Record<string, number> = {
    customer: 0,
    kunde: 0,
    prospect: 1,
    partner: 2,
    churned: 3,
  };

  const sorted = [...filtered].sort((a, b) => {
    if (!userHasSorted) {
      const at = TYPE_PRIORITY[a.status ?? ""] ?? 5;
      const bt = TYPE_PRIORITY[b.status ?? ""] ?? 5;
      if (at !== bt) return at - bt;
      return a.name.localeCompare(b.name, "nb");
    }
    const dir = sort.dir === "asc" ? 1 : -1;
    switch (sort.field) {
      case "name":
        return dir * a.name.localeCompare(b.name, "nb");
      case "type": {
        const ai = TYPE_ORDER.indexOf(a.status);
        const bi = TYPE_ORDER.indexOf(b.status);
        return dir * ((ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi));
      }
      case "city":
        return dir * (a.city || "").localeCompare(b.city || "", "nb");
      case "last_activity":
        if (!a.lastActivity && !b.lastActivity) return 0;
        if (!a.lastActivity) return 1;
        if (!b.lastActivity) return -1;
        return dir * a.lastActivity.localeCompare(b.lastActivity);
      case "tasks":
        return dir * ((a.taskCount || 0) - (b.taskCount || 0));
      default:
        return 0;
    }
  });

  const toggleSort = (field: SortField) => {
    setUserHasSorted(true);
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
      onClick={() => toggleSort(field)}
      className={`flex items-center gap-1 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      {children}
      <ArrowUpDown className={`h-3 w-3 ${sort.field === field ? "text-foreground" : "text-muted-foreground/20"}`} />
    </button>
  );

  const getStatus = (status: string) =>
    statusLabels[status] || {
      label: status,
      className: "bg-secondary text-muted-foreground",
      badgeColor: "bg-gray-100 text-gray-600 border-gray-200",
    };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen && prefillCompanyName) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("ny");
      setSearchParams(nextParams, { replace: true });
    }
  };

  const handleCreateSubmit = () => {
    if (!form.name.trim() || createMutation.isPending) return;
    if (!form.owner_id) {
      toast.error("Velg eier før du oppretter selskapet");
      return;
    }
    const cleanedOrgNumber = form.org_number.replace(/\D/g, "");
    if (!cleanedOrgNumber) {
      const finalLocations = locations.map((location) => location.trim()).filter(Boolean);
      const cityValue = finalLocations.length > 0 ? finalLocations.join(", ") : form.city || null;
      const geoResolution = resolveCompanyGeoAreas({
        city: cityValue,
        address: form.address,
        zip_code: form.zip_code,
        locations: finalLocations,
      });
      const confirmed = window.confirm(
        geoResolution.areas.includes("Ukjent sted")
          ? "Vil du opprette selskap uten organisasjonsnummer og uten kjent GEO-område?"
          : `Vil du opprette selskap uten organisasjonsnummer? GEO lagres som ${geoResolution.areas.join(", ")}.`,
      );
      if (!confirmed) return;
    }

    createMutation.mutate();
  };

  const mobileSortValue = `${sort.field}:${sort.dir}`;

  const handleMobileSortChange = (value: string) => {
    const [field, dir] = value.split(":");
    setUserHasSorted(true);
    setSort({ field: field as SortField, dir: dir as SortDir });
  };

  const openGeoMap = () => {
    const params = new URLSearchParams();
    if (ownerFilter !== "all") params.set("ownerId", ownerFilter);
    if (statusFilter !== "all") params.set("type", statusFilter);
    if (effectiveGeoFilter !== "Alle") params.set("geo", effectiveGeoFilter);
    navigate(`/selskaper/kart${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[1.375rem] font-bold">Selskaper</h1>
        <Button
          className="rounded-lg h-9 px-3.5 text-[0.8125rem] font-medium gap-1.5 w-full sm:w-auto"
          onClick={() => handleDialogOpenChange(true)}
        >
          <Plus className="h-4 w-4" />
          Nytt selskap
        </Button>
      </div>
      <DesignLabEntitySheet open={open} onOpenChange={handleDialogOpenChange} contentClassName="px-6 py-6 dl-v8-theme">
        <div className="mb-5">
          <h2 className="text-[1.125rem] font-bold text-foreground">Nytt selskap</h2>
        </div>
        <DesignLabModalForm
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateSubmit();
          }}
        >
          <DesignLabModalField>
            <DesignLabModalLabel>Selskapsnavn</DesignLabModalLabel>
            <BrregSearch
              value={form.name}
              onChange={(name) => setForm((f) => ({ ...f, name }))}
              onSelect={(r) =>
                setForm((f) => ({
                  ...f,
                  name: r.name,
                  org_number: r.org_number,
                  city: r.city,
                  zip_code: r.zip_code,
                  address: r.address,
                  industry: r.industry,
                }))
              }
              showSearchIcon={false}
              inputClassName="focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#5E6AD2] focus-visible:shadow-[0_0_0_2px_rgba(94,106,210,0.15)]"
              inputStyle={getDesignLabModalInputStyle(modalScale)}
              dropdownClassName="rounded-[8px] border-[#E8EAEE] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
              resultClassName="px-3 py-2 hover:bg-[#F8F9FB]"
              resultStyle={{ font: "inherit" }}
              resultTitleClassName="font-medium text-[#1A1C1F]"
              resultTitleStyle={{ fontSize: "inherit", lineHeight: 1.25 }}
              resultMetaClassName="mt-0.5 text-[#8C929C]"
              resultMetaStyle={{ fontSize: "inherit", lineHeight: 1.2 }}
              emptyStateClassName="px-3 py-3 text-[#8C929C]"
              emptyStateStyle={{ fontSize: "inherit", lineHeight: 1.2 }}
            />
          </DesignLabModalField>
          <DesignLabModalField>
            <DesignLabModalLabel>Org.nr</DesignLabModalLabel>
            <OrgNrInput
              value={form.org_number}
              onChange={(org_number) => setForm((f) => ({ ...f, org_number }))}
              onLookup={(result) =>
                setForm((f) => ({
                  ...f,
                  name: result.name || f.name,
                  city: result.city || f.city,
                  zip_code: result.zip_code || f.zip_code,
                  address: result.address || f.address,
                  industry: result.industry || f.industry,
                }))
              }
              className="focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-[#5E6AD2] focus-visible:shadow-[0_0_0_2px_rgba(94,106,210,0.15)]"
              style={getDesignLabModalInputStyle(modalScale)}
            />
          </DesignLabModalField>
          <DesignLabModalField>
            <DesignLabModalLabel>Geografisk sted</DesignLabModalLabel>
            <div style={{ display: "grid", rowGap: "var(--dl-modal-chip-gap)" }}>
              {locations.map((loc, i) => (
                <div key={i} className="flex items-center gap-2">
                  <DesignLabModalInput
                    value={loc}
                    onChange={(e) => {
                      const next = [...locations];
                      next[i] = e.target.value;
                      setLocations(next);
                    }}
                    placeholder="By eller sted"
                    style={{ flex: 1 }}
                  />
                  {locations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLocations(locations.filter((_, j) => j !== i))}
                      className="inline-flex items-center justify-center rounded-[6px] text-[#8C929C] transition-colors hover:bg-[#F0F2F6] hover:text-[#1A1C1F]"
                      style={{ width: modalScale.controlHeight, height: modalScale.controlHeight }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <DesignLabModalInlineAction type="button" onClick={() => setLocations([...locations, ""])}>
                <Plus className="h-3.5 w-3.5" />
                Legg til sted
              </DesignLabModalInlineAction>
            </div>
          </DesignLabModalField>
          <DesignLabModalField>
            <DesignLabModalLabel>Nettside</DesignLabModalLabel>
            <DesignLabModalInput
              value={form.website}
              onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))}
              placeholder="https://"
              type="url"
            />
          </DesignLabModalField>
          <DesignLabModalField>
            <DesignLabModalLabel>LinkedIn</DesignLabModalLabel>
            <DesignLabModalInput
              value={form.linkedin}
              onChange={(e) => setForm((prev) => ({ ...prev, linkedin: e.target.value }))}
              placeholder="https://linkedin.com/company/..."
              type="url"
            />
          </DesignLabModalField>
          <DesignLabModalField>
            <DesignLabModalLabel>Type</DesignLabModalLabel>
            <DesignLabModalChipGroup>
              {TYPE_OPTIONS.map((option) => (
                <DesignLabFilterButton
                  key={option.value}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, status: option.value }))}
                  active={form.status === option.value}
                  activeColors={DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS}
                  inactiveColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}
                  inactiveHoverColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_HOVER_COLORS}
                >
                  {option.label}
                </DesignLabFilterButton>
              ))}
            </DesignLabModalChipGroup>
          </DesignLabModalField>
          {ownerList.length > 0 && (
            <DesignLabModalField>
              <DesignLabModalLabel>Eier</DesignLabModalLabel>
              <DesignLabModalChipGroup>
                {ownerList.map(([id, name]) => (
                  <DesignLabFilterButton
                    key={id}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, owner_id: id }))}
                    active={form.owner_id === id}
                    activeColors={DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS}
                    inactiveColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}
                    inactiveHoverColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_HOVER_COLORS}
                  >
                    {name}
                  </DesignLabFilterButton>
                ))}
              </DesignLabModalChipGroup>
            </DesignLabModalField>
          )}
          <DesignLabModalActions style={{ marginTop: 24 }}>
            <DesignLabPrimaryAction type="submit" disabled={createMutation.isPending || !form.name.trim() || !form.owner_id}>
              {createMutation.isPending ? "Oppretter..." : "Opprett"}
            </DesignLabPrimaryAction>
            <DesignLabGhostAction type="button" onClick={() => handleDialogOpenChange(false)}>
              Avbryt
            </DesignLabGhostAction>
          </DesignLabModalActions>
        </DesignLabModalForm>
      </DesignLabEntitySheet>
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
        <div className="md:hidden">
          <select
            value={mobileSortValue}
            onChange={(e) => handleMobileSortChange(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-card px-3 text-[0.8125rem] text-foreground"
          >
            <option value="name:asc">Sorter: Navn A-Å</option>
            <option value="name:desc">Sorter: Navn Å-A</option>
            <option value="type:asc">Sorter: Type</option>
            <option value="city:asc">Sorter: Sted A-Å</option>
            <option value="last_activity:desc">Sorter: Siste aktivitet</option>
          </select>
        </div>
      </div>

      {/* Chip filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground w-16 shrink-0">
              Eier
            </span>
            {[
              { id: "all", name: "Alle" },
              ...ownerList.map(([id, name]) => ({ id: id as string, name: name as string })),
            ].map((o) => (
              <button
                key={o.id}
                onClick={() => setOwnerFilter(o.id)}
                className={ownerFilter === o.id ? CHIP_ON : CHIP_OFF}
              >
                {o.name}
              </button>
            ))}
          </div>
          {/* Type chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground w-16 shrink-0">
              Type
            </span>
            {[
              { value: "all", label: "Alle" },
              { value: "prospect", label: "Potensiell kunde" },
              { value: "customer", label: "Kunde" },
              { value: "partner", label: "Partner" },
              { value: "__never_contacted__", label: "Aldri kontaktet" },
              { value: "churned", label: "Ikke relevant selskap" },
            ].map((o) => (
              <button
                key={o.value}
                onClick={() => setStatusFilter(o.value)}
                className={statusFilter === o.value ? CHIP_ON : CHIP_OFF}
              >
                {o.label}
              </button>
            ))}
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
        </div>
        <div className="flex items-center gap-3 md:ml-auto shrink-0">
          <div className="w-px h-8 bg-border" />
          <div className="text-right">
            <span className="text-[0.9375rem] font-semibold text-foreground">{filtered.length}</span>
            <span className="text-[0.9375rem] text-muted-foreground ml-1.5">selskaper</span>
            {SHOW_GEO_MAP_ACTION && (
              <button
                type="button"
                onClick={openGeoMap}
                className="ml-3 inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[0.75rem] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <MapIcon className="h-3.5 w-3.5" />
                Geografisk kart
              </button>
            )}
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
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Ingen selskaper funnet</p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {sorted.map((company) => (
              <button
                key={company.id}
                type="button"
                onClick={() => navigate(`/selskaper/${company.id}`)}
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-left shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[0.9375rem] font-semibold text-foreground truncate">{company.name}</p>
                    {company.org_number && (
                      <p className="mt-1 text-[0.75rem] text-muted-foreground truncate">Org.nr {company.org_number}</p>
                    )}
                    {company.city && (
                      <p className="text-[0.8125rem] text-muted-foreground truncate">{company.city}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {company.lastActivity && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-[0.75rem] text-muted-foreground">{relativeDate(company.lastActivity)}</p>
                        </TooltipTrigger>
                        <TooltipContent>
                          {format(new Date(company.lastActivity), "d. MMMM yyyy", { locale: nb })}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      {(() => {
                        const t = TYPE_OPTIONS.find(
                          (o) => o.value === company.status || (o.value === "customer" && company.status === "kunde"),
                        );
                        const label = t?.label || company.status;
                        return (
                          <button
                            className={cn(
                              "inline-flex items-center rounded-full border px-3 py-1 text-[0.75rem] font-medium transition-colors text-left cursor-pointer",
                              t?.badgeColor || "border-border text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {label}
                            <ChevronDown className="ml-1 h-3 w-3 flex-shrink-0" />
                          </button>
                        );
                      })()}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {TYPE_OPTIONS.map((o) => (
                        <DropdownMenuItem
                          key={o.value}
                          onClick={() => setTypeMutation.mutate({ companyId: company.id, status: o.value })}
                        >
                          {o.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </button>
            ))}
          </div>

          <div className="hidden md:block border border-border rounded-lg overflow-hidden bg-card shadow-card">
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_100px] gap-3 px-4 py-2.5 border-b border-border bg-background">
              <SortHeader field="name">Selskap</SortHeader>
              <SortHeader field="type">Type</SortHeader>
              <SortHeader field="city">Sted</SortHeader>
              <SortHeader field="last_activity" className="justify-end">
                Siste akt.
              </SortHeader>
            </div>
            <div className="divide-y divide-border">
              {sorted.map((company) => (
                <div
                  key={company.id}
                  className="w-full grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_100px] gap-3 items-center px-4 min-h-[44px] py-2 hover:bg-background/80 transition-colors duration-75 text-left cursor-pointer"
                  onClick={() => navigate(`/selskaper/${company.id}`)}
                >
                  <div className="min-w-0">
                    <span className="text-[0.8125rem] font-medium text-foreground truncate block">{company.name}</span>
                  </div>
                  <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        {(() => {
                          const t = TYPE_OPTIONS.find(
                            (o) => o.value === company.status || (o.value === "customer" && company.status === "kunde"),
                          );
                          const label = t?.label || company.status;
                          return (
                            <button
                              className={cn(
                                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors text-left cursor-pointer",
                                t?.badgeColor || "border-border text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {label}
                              <ChevronDown className="h-3 w-3 ml-1 flex-shrink-0" />
                            </button>
                          );
                        })()}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {TYPE_OPTIONS.map((o) => (
                          <DropdownMenuItem
                            key={o.value}
                            onClick={() => setTypeMutation.mutate({ companyId: company.id, status: o.value })}
                          >
                            {o.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <span className="text-[0.8125rem] text-muted-foreground truncate">{company.city || ""}</span>
                  <span className="text-[0.75rem] text-muted-foreground text-right">
                    {company.lastActivity ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{relativeDate(company.lastActivity)}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {format(new Date(company.lastActivity), "d. MMMM yyyy", { locale: nb })}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      ""
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Companies;
