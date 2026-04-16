import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { CompanyCardContent } from "@/components/CompanyCardContent";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  ChevronDown, ChevronUp, X, Plus, Loader2,
} from "lucide-react";
import { differenceInDays } from "date-fns";
import { getEffectiveSignal, normalizeCategoryLabel } from "@/lib/categoryUtils";
import { useAuth } from "@/hooks/useAuth";
import { C } from "@/components/designlab/theme";
import { crmQueryKeys } from "@/lib/queryKeys";
import { DesignLabSidebar } from "@/components/designlab/DesignLabSidebar";
import { TextSizeControl, SCALE_MAP, type TextSize } from "@/components/designlab/TextSizeControl";
import { usePersistentState } from "@/hooks/usePersistentState";
import { BrregSearch, lookupByOrgNr } from "@/components/BrregSearch";
import { toast } from "sonner";
import {
  DesignLabActionButton,
  DesignLabControlLabel,
  DesignLabFilterButton,
  DesignLabIconButton,
  DesignLabSearchInput,
  DesignLabStaticTag,
} from "@/components/designlab/controls";

/* ═══════════════════════════════════════════════════════════
   TYPES & CONSTANTS
   ═══════════════════════════════════════════════════════════ */

type Signal = "Behov nå" | "Får fremtidig behov" | "Får kanskje behov" | "Ukjent om behov" | "Ikke aktuelt";

const SIGNAL_ORDER: Record<Signal, number> = {
  "Behov nå": 0, "Får fremtidig behov": 1, "Får kanskje behov": 2, "Ukjent om behov": 3, "Ikke aktuelt": 4,
};

const OWNERS = ["Alle", "Jon Richard Nygaard", "Thomas Eriksen", "Uten eier"];
const TYPE_FILTERS = ["Alle", "Potensiell kunde", "Kunde", "Partner", "Ikke relevant selskap"] as const;
type TypeFilter = typeof TYPE_FILTERS[number];

const TYPE_OPTIONS = [
  { value: "prospect", label: "Potensiell kunde" },
  { value: "customer", label: "Kunde" },
  { value: "partner", label: "Partner" },
  { value: "churned", label: "Ikke relevant selskap" },
];

const TYPE_VALUE_TO_LABEL: Record<string, string> = {
  prospect: "Potensiell kunde",
  customer: "Kunde",
  kunde: "Kunde",
  partner: "Partner",
  churned: "Ikke relevant selskap",
  lead: "Lead",
  active: "Aktiv",
};

const TYPE_LABEL_TO_VALUE: Record<string, string> = {
  "Potensiell kunde": "prospect",
  "Kunde": "customer",
  "Partner": "partner",
  "Ikke relevant selskap": "churned",
};

const MODAL_LABEL_CLASS = "mb-1 block text-[11px] font-medium text-[#8C929C]";
const MODAL_INPUT_CLASS =
  "h-8 rounded-[6px] border-[#DDE0E7] bg-white px-2.5 py-0 text-[13px] placeholder:text-[#8C929C] focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-[#5E6AD2] md:text-[13px]";

type SortField = "name" | "type" | "signal" | "city" | "last_activity" | "tasks";
type SortDir = "asc" | "desc";

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

function OrgNrInput({
  value,
  onChange,
  onLookup,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onLookup: (name: string | null, city: string | null) => void;
  className?: string;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cleaned = value.replace(/\s/g, "");
    if (cleaned.length !== 9 || !/^\d{9}$/.test(cleaned)) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      const r = await lookupByOrgNr(cleaned);
      if (r) onLookup(r.navn, r.forretningsadresse?.kommune || null);
      setLoading(false);
    }, 400);
    return () => clearTimeout(timerRef.current);
  }, [value, onLookup]);

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="923 456 789"
        className={className ?? MODAL_INPUT_CLASS}
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}




/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function DesignLabCompanies() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const queryClient = useQueryClient();
  const [textSize, setTextSize] = usePersistentState<TextSize>("dl-text-size", "M");
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("Alle");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("Alle");
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "name", dir: "asc" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    org_number: "",
    city: "",
    website: "",
    linkedin: "",
    status: "prospect",
    owner_id: "",
  });
  const [createLocations, setCreateLocations] = useState<string[]>([""]);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Data query (same pattern as Companies.tsx) ──
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
      const contactIds = data.flatMap((c) => (c.contacts || []).map((ct: any) => ct.id));

      const [actRes, taskRes, contactActRes, contactTaskRes] = await Promise.all([
        supabase.from("activities").select("company_id, created_at, subject, description")
          .not("company_id", "is", null).order("created_at", { ascending: false }).limit(2000),
        supabase.from("tasks").select("company_id, due_date, title, description, status, created_at")
          .not("company_id", "is", null).neq("status", "done").limit(2000),
        supabase.from("activities").select("contact_id, created_at, subject, description")
          .not("contact_id", "is", null).order("created_at", { ascending: false }).limit(2000),
        supabase.from("tasks").select("contact_id, due_date, title, description, status, created_at")
          .not("contact_id", "is", null).neq("status", "done").limit(2000),
      ]);

      const contactToCompany: Record<string, string> = {};
      data.forEach((c) => (c.contacts || []).forEach((ct: any) => { contactToCompany[ct.id] = c.id; }));

      const now = new Date();
      const isPast = (d: string) => new Date(d) <= now;
      const lastActivityMap: Record<string, string> = {};
      const taskCountMap: Record<string, number> = {};
      const overdueTaskMap: Record<string, boolean> = {};
      const companyActsMap: Record<string, any[]> = {};
      const companyTasksMap: Record<string, any[]> = {};

      (actRes.data || []).forEach((a) => {
        if (!a.company_id || !companyIdSet.has(a.company_id)) return;
        if (isPast(a.created_at) && !lastActivityMap[a.company_id]) lastActivityMap[a.company_id] = a.created_at;
      });

      ((contactActRes as any).data || []).forEach((a: any) => {
        const cid = contactToCompany[a.contact_id];
        if (!cid) return;
        if (isPast(a.created_at) && (!lastActivityMap[cid] || a.created_at > lastActivityMap[cid]))
          lastActivityMap[cid] = a.created_at;
        if (!companyActsMap[cid]) companyActsMap[cid] = [];
        companyActsMap[cid].push(a);
      });

      (taskRes.data || []).forEach((t) => {
        if (!t.company_id || !companyIdSet.has(t.company_id)) return;
        taskCountMap[t.company_id] = (taskCountMap[t.company_id] || 0) + 1;
        if (t.due_date && new Date(t.due_date) < new Date()) overdueTaskMap[t.company_id] = true;
      });

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
          (companyActsMap[c.id] || []).map((a: any) => ({ created_at: a.created_at, subject: a.subject, description: a.description })),
          (companyTasksMap[c.id] || []).map((t: any) => ({ created_at: t.created_at, title: t.title, description: t.description, due_date: t.due_date })),
        );
        signalMap[c.id] = sig || "";
      }

      return data.map((c) => ({
        ...c,
        lastActivity: lastActivityMap[c.id] || null,
        taskCount: taskCountMap[c.id] || 0,
        hasOverdue: overdueTaskMap[c.id] || false,
        signal: signalMap[c.id] || "",
        contactCount: (c.contacts || []).length,
        ownerName: (c.profiles as any)?.full_name || "",
        ownerId: (c.profiles as any)?.id || null,
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

  useEffect(() => {
    if (createForm.city && createLocations[0] === "") {
      setCreateLocations((prev) => [createForm.city, ...prev.slice(1)]);
    }
  }, [createForm.city, createLocations]);

  useEffect(() => {
    if (!createOpen || createForm.owner_id || !user?.id) return;
    if (allProfiles.some((profile) => profile.id === user.id)) {
      setCreateForm((prev) => ({ ...prev, owner_id: user.id }));
    }
  }, [allProfiles, createForm.owner_id, createOpen, user?.id]);

  const resetCreateForm = useCallback(() => {
    setCreateForm({
      name: "",
      org_number: "",
      city: "",
      website: "",
      linkedin: "",
      status: "prospect",
      owner_id: "",
    });
    setCreateLocations([""]);
  }, []);

  const createMutation = useMutation({
    mutationFn: async () => {
      const finalLocations = createLocations.map((location) => location.trim()).filter(Boolean);
      const cityValue = finalLocations.length > 0 ? finalLocations.join(", ") : createForm.city || null;
      const { error } = await supabase.from("companies").insert({
        name: createForm.name,
        org_number: createForm.org_number || null,
        city: cityValue,
        website: createForm.website || null,
        linkedin: createForm.linkedin || null,
        created_by: user?.id,
        status: createForm.status,
        owner_id: createForm.owner_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.companies.all() });
      setCreateOpen(false);
      resetCreateForm();
      toast.success("Selskap opprettet");
    },
    onError: () => {
      toast.error("Kunne ikke opprette selskap");
    },
  });

  const toggleSort = useCallback((field: SortField) => {
    setSort((p) => p.field === field ? { field, dir: p.dir === "asc" ? "desc" : "asc" } : { field, dir: field === "last_activity" ? "desc" : "asc" });
  }, []);

  // ── Filtering ──
  const filtered = useMemo(() => {
    let list = companies;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c: any) =>
        c.name.toLowerCase().includes(q) ||
        c.org_number?.includes(q) ||
        c.city?.toLowerCase().includes(q)
      );
    }
    if (ownerFilter === "Uten eier") list = list.filter((c: any) => !c.ownerId);
    else if (ownerFilter !== "Alle") list = list.filter((c: any) => c.ownerName === ownerFilter);
    if (typeFilter !== "Alle") {
      const dbValue = TYPE_LABEL_TO_VALUE[typeFilter];
      if (dbValue) list = list.filter((c: any) => c.status === dbValue || (dbValue === "customer" && c.status === "kunde"));
    }
    return list;
  }, [companies, search, ownerFilter, typeFilter]);

  // ── Sorting ──
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const d = sort.dir === "asc" ? 1 : -1;
    arr.sort((a: any, b: any) => {
      switch (sort.field) {
        case "name": return d * a.name.localeCompare(b.name, "nb");
        case "type": {
          const typeOrder = ["customer", "kunde", "prospect", "partner", "churned"];
          const ai = typeOrder.indexOf(a.status); const bi = typeOrder.indexOf(b.status);
          return d * ((ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi));
        }
        case "signal": {
          const as = SIGNAL_ORDER[mapToSignal(a.signal)] ?? 3;
          const bs = SIGNAL_ORDER[mapToSignal(b.signal)] ?? 3;
          return d * (as - bs);
        }
        case "city": return d * (a.city || "").localeCompare(b.city || "", "nb");
        case "last_activity": {
          if (!a.lastActivity && !b.lastActivity) return 0;
          if (!a.lastActivity) return 1;
          if (!b.lastActivity) return -1;
          return d * a.lastActivity.localeCompare(b.lastActivity);
        }
        case "tasks": return d * ((a.taskCount || 0) - (b.taskCount || 0));
        default: return 0;
      }
    });
    return arr;
  }, [filtered, sort]);

  const renderRow = useCallback((company: any) => {
    const daysSince = company.lastActivity ? differenceInDays(new Date(), new Date(company.lastActivity)) : null;
    const typeLabel = TYPE_VALUE_TO_LABEL[company.status] || company.status;
    const isSelected = selectedId === company.id;

    return (
      <div
        key={company.id}
        onClick={() => setSelectedId(isSelected ? null : company.id)}
        className="grid items-center cursor-pointer group"
        style={{
          gridTemplateColumns: "minmax(220px,2.2fr) minmax(140px,1.2fr) minmax(180px,1.4fr) 132px",
          minHeight: 38, paddingLeft: 16, paddingRight: 16,
          borderBottom: `1px solid ${C.borderLight}`,
          background: isSelected ? C.activeBg : "transparent",
        }}
        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = C.hoverBg; }}
        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
      >
        {/* Name */}
        <div className="min-w-0 flex items-center gap-2">
          <span className="truncate" style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{company.name}</span>
        </div>

        {/* Type */}
        <div className="min-w-0">
          <DesignLabStaticTag className="max-w-full">
            <span className="truncate">{typeLabel}</span>
          </DesignLabStaticTag>
        </div>

        {/* City */}
        <span className="truncate" style={{ fontSize: 12, color: C.textMuted }}>{company.city || ""}</span>

        {/* Last activity */}
        <span className="text-right" style={{ fontSize: 12, color: C.textFaint }}>
          {daysSince !== null ? relTime(daysSince) : ""}
        </span>
      </div>
    );
  }, [selectedId]);

  const ownerOptions = useMemo(
    () =>
      allProfiles
        .filter((profile) => Boolean(profile.full_name))
        .map((profile) => ({ id: profile.id, name: profile.full_name })),
    [allProfiles],
  );

  /* ═══ RENDER ═══ */
  return (
    <div className="flex h-screen overflow-hidden select-none" style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif", background: C.bg }}>

      <DesignLabSidebar navigate={navigate} signOut={signOut} user={user} activePath="/design-lab/selskaper" />

      {/* ═══ MAIN ═══ */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ zoom: SCALE_MAP[textSize], background: C.appBg }}>
        {/* Header bar */}
        <header className="flex items-center justify-between px-6 shrink-0" style={{ height: 40, borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-baseline gap-2.5">
            <h1 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Selskaper</h1>
            <span style={{ fontSize: 13, color: C.textGhost, fontWeight: 500 }}>· {filtered.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <TextSizeControl value={textSize} onChange={setTextSize} />
            <DesignLabSearchInput
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk selskaper…"
              style={{ width: 220 }}
            />
            <DesignLabActionButton
              variant="primary"
              onClick={() => setCreateOpen(true)}
            >
              + Nytt selskap
            </DesignLabActionButton>
          </div>
        </header>

        {/* Filters bar */}
        <div className="shrink-0 space-y-0" style={{ borderBottom: `1px solid ${C.border}`, padding: "8px 24px 10px" }}>
          <FilterRow label="EIER" options={OWNERS} value={ownerFilter} onChange={setOwnerFilter} />
          <div className="flex items-center justify-between">
            <FilterRow label="TYPE" options={[...TYPE_FILTERS]} value={typeFilter} onChange={(v) => setTypeFilter(v as TypeFilter)} />
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 12, color: C.textFaint, fontWeight: 500, whiteSpace: "nowrap", paddingLeft: 12 }}>
                {filtered.length} selskaper
              </span>
              {(ownerFilter !== "Alle" || typeFilter !== "Alle") && (
                <DesignLabActionButton
                  variant="ghost"
                  onClick={() => { setOwnerFilter("Alle"); setTypeFilter("Alle"); }}
                >
                  <X style={{ width: 12, height: 12 }} /> Nullstill
                </DesignLabActionButton>
              )}
            </div>
          </div>
        </div>

        {/* Content: list + detail */}
        <div className="flex-1 min-h-0 flex">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={35} minSize={20} maxSize={60}>
              <div className="h-full overflow-y-auto" style={{ scrollbarColor: `${C.borderStrong} ${C.surfaceAlt}` }}>
                <div
                  className="grid items-center sticky top-0 z-10"
                  style={{
                    gridTemplateColumns: "minmax(220px,2.2fr) minmax(140px,1.2fr) minmax(180px,1.4fr) 132px",
                    height: 32, borderBottom: `1px solid ${C.border}`,
                    background: C.surfaceAlt, paddingLeft: 16, paddingRight: 16,
                  }}
                >
                  <ColHeader label="Selskap" field="name" sort={sort} onSort={toggleSort} />
                  <ColHeader label="Type" field="type" sort={sort} onSort={toggleSort} />
                  <ColHeader label="Sted" field="city" sort={sort} onSort={toggleSort} />
                  <ColHeader label="Siste akt." field="last_activity" sort={sort} onSort={toggleSort} className="justify-end" />
                </div>
                {isLoading ? (
                  <div style={{ textAlign: "center", padding: "48px 0", color: C.textFaint, fontSize: 13 }}>Laster selskaper…</div>
                ) : sorted.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "48px 0", color: C.textFaint, fontSize: 13 }}>Ingen selskaper funnet</div>
                ) : (
                  sorted.map((company: any) => renderRow(company))
                )}
              </div>
            </ResizablePanel>
            <ResizableHandle
              withHandle
              className="bg-transparent hover:bg-[rgba(0,0,0,0.04)] transition-colors data-[resize-handle-active]:bg-[rgba(94,106,210,0.12)]"
            />
            <ResizablePanel defaultSize={65} minSize={30}>
              {selectedId ? (
                <div className="h-full flex flex-col" style={{ background: C.panel, borderLeft: `1px solid ${C.borderLight}` }}>
                  <div className="shrink-0 flex items-center justify-end px-4" style={{ height: 32 }}>
                    <DesignLabIconButton
                      onClick={() => setSelectedId(null)}
                    >
                      <X style={{ width: 16, height: 16 }} />
                    </DesignLabIconButton>
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 py-5 dl-v8-theme">
                    <CompanyCardContent
                      companyId={selectedId}
                      editable
                      headerPaddingTop={12}
                      defaultHidden={{
                        techDna: true,
                        notes: true,
                      }}
                      onNavigateToFullPage={() => navigate(`/selskaper/${selectedId}`)}
                    />
                  </div>
                </div>
              ) : (
                <div className="h-full" style={{ borderLeft: `1px solid ${C.borderLight}`, background: C.appBg }} />
              )}
            </ResizablePanel>
            <ResizableHandle
              withHandle
              className="bg-transparent hover:bg-[rgba(0,0,0,0.04)] transition-colors data-[resize-handle-active]:bg-[rgba(94,106,210,0.12)]"
            />
            <ResizablePanel defaultSize={0} minSize={0} maxSize={40}>
              <div className="h-full" style={{ background: C.appBg }} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </main>
      <Dialog
        open={createOpen}
        onOpenChange={(nextOpen) => {
          setCreateOpen(nextOpen);
          if (!nextOpen && !createMutation.isPending) resetCreateForm();
        }}
      >
        <DialogContent
          hideCloseButton
          overlayClassName="bg-[rgba(0,0,0,0.35)]"
          className="w-[calc(100vw-2rem)] max-w-[440px] gap-0 rounded-[10px] border-[#E8EAEE] bg-white p-0 shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
        >
          <div className="flex items-center justify-between px-4 pb-3 pt-4">
            <DialogTitle className="text-[14px] font-semibold text-[#1A1C1F]">Nytt selskap</DialogTitle>
            <DialogClose asChild>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-[#5C636E] transition-colors hover:bg-[#F0F2F6] hover:text-[#1A1C1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5E6AD2] focus-visible:ring-offset-2"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Lukk</span>
              </button>
            </DialogClose>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="space-y-3 px-4 pb-4"
          >
            <div>
              <Label className={MODAL_LABEL_CLASS}>Selskapsnavn</Label>
              <BrregSearch
                value={createForm.name}
                onChange={(name) => setCreateForm((prev) => ({ ...prev, name }))}
                onSelect={(result) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    name: result.name,
                    org_number: result.org_number,
                    city: result.city,
                  }))
                }
                inputClassName={MODAL_INPUT_CLASS}
                dropdownClassName="rounded-[8px] border-[#E8EAEE] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
                resultClassName="px-3 py-2 text-[13px] hover:bg-[#F8F9FB]"
                resultTitleClassName="text-[13px] font-medium text-[#1A1C1F]"
                resultMetaClassName="mt-0.5 text-[11px] text-[#8C929C]"
                emptyStateClassName="px-3 py-3 text-[12px] text-[#8C929C]"
              />
            </div>
            <div>
              <Label className={MODAL_LABEL_CLASS}>Org.nr</Label>
              <OrgNrInput
                value={createForm.org_number}
                onChange={(org_number) => setCreateForm((prev) => ({ ...prev, org_number }))}
                onLookup={(name, city) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    name: name || prev.name,
                    city: city || prev.city,
                  }))
                }
              />
            </div>
            <div>
              <Label className={MODAL_LABEL_CLASS}>Geografisk sted</Label>
              <div className="space-y-2">
                {createLocations.map((location, index) => (
                  <div key={`${index}-${location}`} className="flex items-center gap-2">
                    <Input
                      value={location}
                      onChange={(e) => {
                        const next = [...createLocations];
                        next[index] = e.target.value;
                        setCreateLocations(next);
                      }}
                      placeholder="By eller sted"
                      className={`flex-1 ${MODAL_INPUT_CLASS}`}
                    />
                    {createLocations.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setCreateLocations(createLocations.filter((_, itemIndex) => itemIndex !== index))}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-[#8C929C] transition-colors hover:bg-[#F0F2F6] hover:text-[#1A1C1F]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <DesignLabActionButton type="button" variant="secondary" style={{ width: "100%" }} onClick={() => setCreateLocations([...createLocations, ""])}>
                  <Plus className="h-3.5 w-3.5" />
                  Legg til sted
                </DesignLabActionButton>
              </div>
            </div>
            <div>
              <Label className={MODAL_LABEL_CLASS}>Nettside</Label>
              <Input
                value={createForm.website}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, website: e.target.value }))}
                placeholder="https://"
                className={MODAL_INPUT_CLASS}
                type="url"
              />
            </div>
            <div>
              <Label className={MODAL_LABEL_CLASS}>LinkedIn</Label>
              <Input
                value={createForm.linkedin}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, linkedin: e.target.value }))}
                placeholder="https://linkedin.com/company/..."
                className={MODAL_INPUT_CLASS}
                type="url"
              />
            </div>
            <div>
              <Label className={MODAL_LABEL_CLASS}>Type</Label>
              <div className="flex flex-wrap gap-1.5">
                {TYPE_OPTIONS.map((option) => (
                  <DesignLabFilterButton
                    key={option.value}
                    type="button"
                    onClick={() => setCreateForm((prev) => ({ ...prev, status: option.value }))}
                    active={createForm.status === option.value}
                    activeColors={{
                      background: "#E8ECF5",
                      color: "#1A1C1F",
                      border: "1px solid #C5CBE8",
                      fontWeight: 600,
                    }}
                    inactiveColors={{
                      background: "transparent",
                      color: "#5C636E",
                      border: "1px solid #DDE0E7",
                      fontWeight: 500,
                    }}
                    inactiveHoverColors={{
                      background: "#F8F9FB",
                      color: "#1A1C1F",
                      border: "1px solid #DDE0E7",
                    }}
                  >
                    {option.label}
                  </DesignLabFilterButton>
                ))}
              </div>
            </div>
            {ownerOptions.length > 0 && (
              <div>
                <Label className={MODAL_LABEL_CLASS}>Eier</Label>
                <div className="flex flex-wrap gap-1.5">
                  {ownerOptions.map((owner) => (
                    <DesignLabFilterButton
                      key={owner.id}
                      type="button"
                      onClick={() =>
                        setCreateForm((prev) => ({
                          ...prev,
                          owner_id: prev.owner_id === owner.id ? "" : owner.id,
                        }))
                      }
                      active={createForm.owner_id === owner.id}
                      activeColors={{
                        background: "#E8ECF5",
                        color: "#1A1C1F",
                        border: "1px solid #C5CBE8",
                        fontWeight: 600,
                      }}
                      inactiveColors={{
                        background: "transparent",
                        color: "#5C636E",
                        border: "1px solid #DDE0E7",
                        fontWeight: 500,
                      }}
                      inactiveHoverColors={{
                        background: "#F8F9FB",
                        color: "#1A1C1F",
                        border: "1px solid #DDE0E7",
                      }}
                    >
                      {owner.name}
                    </DesignLabFilterButton>
                  ))}
                </div>
              </div>
            )}
            <DesignLabActionButton type="submit" variant="primary" style={{ width: "100%", marginTop: 12 }} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Oppretter..." : "Opprett"}
            </DesignLabActionButton>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterRow({ label, options, value, onChange }: {
  label: string; options: readonly string[] | string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-[3px]">
      <DesignLabControlLabel>{label}</DesignLabControlLabel>
      <div className="flex items-center gap-1.5 flex-wrap">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <DesignLabFilterButton
              key={opt}
              onClick={() => onChange(opt)}
              active={active}
            >
              {opt}
            </DesignLabFilterButton>
          );
        })}
      </div>
    </div>
  );
}

function ColHeader({ label, field, sort, onSort, className }: {
  label: string; field: SortField; sort: { field: SortField; dir: SortDir };
  onSort: (f: SortField) => void; className?: string;
}) {
  const active = sort.field === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={`flex items-center gap-0.5 transition-colors ${className || ""}`}
      style={{
        fontSize: 11, fontWeight: active ? 600 : 500, letterSpacing: "0.01em",
        color: active ? C.text : C.textMuted,
      }}
    >
      {label}
      {active && (sort.dir === "asc" ? <ChevronUp style={{ width: 12, height: 12 }} /> : <ChevronDown style={{ width: 12, height: 12 }} />)}
    </button>
  );
}
