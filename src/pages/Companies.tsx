import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, ArrowUpDown, Loader2, X, MapPin, ChevronDown, Map as MapIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePersistentState } from "@/hooks/usePersistentState";

import { BrregSearch, lookupByOrgNr } from "@/components/BrregSearch";
import { relativeDate } from "@/lib/relativeDate";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { crmQueryKeys } from "@/lib/queryKeys";

type SortField = "name" | "type" | "city" | "last_activity" | "tasks";
type SortDir = "asc" | "desc";

import { getEffectiveSignal } from "@/lib/categoryUtils";

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

const CHIP_BASE = "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors cursor-pointer";
const CHIP_OFF = `${CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;
const CHIP_ON = `${CHIP_BASE} bg-foreground text-background border-foreground font-medium`;

const OrgNrInput = ({
  value,
  onChange,
  onLookup,
}: {
  value: string;
  onChange: (v: string) => void;
  onLookup: (name: string | null, city: string | null) => void;
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
      if (r) onLookup(r.navn, r.forretningsadresse?.kommune || null);
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
        className="h-10 rounded-lg"
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
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    org_number: "",
    city: "",
    website: "",
    linkedin: "",
    status: "prospect",
  });
  const [locations, setLocations] = useState<string[]>([""]);
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (form.city && locations[0] === "") {
      setLocations((prev) => [form.city, ...prev.slice(1)]);
    }
  }, [form.city]);
  const [sort, setSort] = usePersistentState<{ field: SortField; dir: SortDir }>("stacq:companies:sort", {
    field: "name",
    dir: "asc",
  });
  const [userHasSorted, setUserHasSorted] = usePersistentState("stacq:companies:userHasSorted", false);
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
        : { name: prefillCompanyName, org_number: "", city: "", website: "", linkedin: "", status: "prospect" },
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

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("companies").insert({
        name: form.name,
        org_number: form.org_number || null,
        city: form.city || null,
        website: form.website || null,
        linkedin: form.linkedin || null,
        created_by: user?.id,
        status: form.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.companies.all() });
      setOpen(false);
      setForm({ name: "", org_number: "", city: "", website: "", linkedin: "", status: "prospect" });
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

  const getOwnerId = (company: any) => (company.profiles as any)?.id || null;

  const ownerMap = new Map<string, string>();
  companies.forEach((c) => {
    const id = getOwnerId(c);
    const fullName = (c.profiles as any)?.full_name;
    if (id && fullName) ownerMap.set(id, fullName);
  });
  const ownerList = Array.from(ownerMap.entries());

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
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchOwner && matchStatus;
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

  const mobileSortValue = `${sort.field}:${sort.dir}`;

  const handleMobileSortChange = (value: string) => {
    const [field, dir] = value.split(":");
    setUserHasSorted(true);
    setSort({ field: field as SortField, dir: dir as SortDir });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[1.375rem] font-bold">Selskaper</h1>
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
        <Dialog open={open} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button className="rounded-lg h-9 px-3.5 text-[0.8125rem] font-medium gap-1.5 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Nytt selskap
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[440px] rounded-xl">
            <DialogHeader>
              <DialogTitle>Nytt selskap</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
              className="space-y-4 mt-3"
            >
              <div className="space-y-1.5">
                <Label className="text-label">Selskapsnavn</Label>
                <BrregSearch
                  value={form.name}
                  onChange={(name) => setForm((f) => ({ ...f, name }))}
                  onSelect={(r) => setForm((f) => ({ ...f, name: r.name, org_number: r.org_number, city: r.city }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-label">Org.nr</Label>
                <OrgNrInput
                  value={form.org_number}
                  onChange={(org_number) => setForm((f) => ({ ...f, org_number }))}
                  onLookup={(name, city) => setForm((f) => ({ ...f, name: name || f.name, city: city || f.city }))}
                />
              </div>
              {form.city && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {form.city}
                </div>
              )}
              {/* AVDELINGER */}
              <div className="space-y-1.5">
                <Label className="text-label">Geografiske steder</Label>
                <div className="space-y-2">
                  {locations.map((loc, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={loc}
                        onChange={(e) => {
                          const next = [...locations];
                          next[i] = e.target.value;
                          setLocations(next);
                        }}
                        placeholder="By eller sted"
                        className="h-10 rounded-lg flex-1"
                      />
                      {locations.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setLocations(locations.filter((_, j) => j !== i))}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setLocations([...locations, ""])}
                    className="w-full h-9 text-[0.8125rem] text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg border border-dashed border-border transition-colors"
                  >
                    + Legg til sted
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-label">Nettside</Label>
                <Input
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="https://"
                  className="h-10 rounded-lg"
                  type="url"
                />
              </div>
              {/* STATUS */}
              <div className="space-y-1.5">
                <Label className="text-label">Status</Label>
                <div className="flex gap-1.5">
                  {(
                    [
                      {
                        value: "prospect",
                        label: "Potensiell kunde",
                        activeClass: "bg-blue-500 text-white border-blue-500",
                      },
                      {
                        value: "customer",
                        label: "Kunde",
                        activeClass: "bg-emerald-500 text-white border-emerald-500",
                      },
                      { value: "partner", label: "Partner", activeClass: "bg-gray-400 text-white border-gray-400" },
                      {
                        value: "churned",
                        label: "Ikke relevant selskap",
                        activeClass: "bg-red-400 text-white border-red-400",
                      },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, status: opt.value }))}
                      className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                        form.status === opt.value
                          ? opt.activeClass
                          : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <Button type="submit" className="w-full h-10 rounded-lg" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Oppretter..." : "Opprett"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
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
        </div>
        <div className="flex items-center gap-3 md:ml-auto shrink-0">
          <div className="w-px h-8 bg-border" />
          <div className="text-right">
            <span className="text-[0.9375rem] font-semibold text-foreground">{filtered.length}</span>
            <span className="text-[0.9375rem] text-muted-foreground ml-1.5">selskaper</span>
            <button
              onClick={() => navigate("/selskaper/kart")}
              className="flex items-center gap-1 text-[0.75rem] text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-0.5 hover:bg-secondary transition-colors ml-3"
            >
              <MapIcon className="w-3.5 h-3.5" />
              Kart
            </button>
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
                          <button className="inline-flex items-center rounded-full border border-border px-3 py-1 text-[0.75rem] font-medium text-muted-foreground hover:text-foreground transition-colors text-left cursor-pointer">
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
                            <button className="inline-flex items-center text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors text-left cursor-pointer">
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
