import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Users, ArrowUpDown, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

import { BrregSearch, lookupByOrgNr } from "@/components/BrregSearch";
import { relativeDate } from "@/lib/relativeDate";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

type SortField = "name" | "type" | "signal" | "contacts" | "last_activity" | "tasks";
type SortDir = "asc" | "desc";

import { CATEGORIES, LEGACY_CATEGORY_MAP, normalizeCategoryLabel, extractCategory, SIGNAL_ORDER, getEffectiveSignal } from "@/lib/categoryUtils";

const SIGNAL_OPTIONS = CATEGORIES.map(c => ({ label: c.label, color: c.badgeColor }));

function getSignalBadge(category: string | null) {
  if (!category) return null;
  return SIGNAL_OPTIONS.find((s) => s.label === category) || null;
}

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
  lead: { label: "Lead", className: "bg-tag text-tag-foreground", badgeColor: "bg-gray-100 text-gray-600 border-gray-200" },
  prospect: { label: "Potensiell kunde", className: "bg-warning/10 text-warning", badgeColor: "bg-amber-100 text-amber-800 border-amber-200" },
  customer: { label: "Kunde", className: "bg-success/10 text-success", badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  kunde: { label: "Kunde", className: "bg-success/10 text-success", badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  churned: { label: "Ikke relevant selskap", className: "bg-destructive/10 text-destructive", badgeColor: "bg-red-50 text-red-700 border-red-200" },
  partner: { label: "Partner", className: "bg-secondary text-muted-foreground", badgeColor: "bg-gray-100 text-gray-600 border-gray-200" },
};

const TYPE_ORDER = ["prospect", "customer", "churned", "partner", "lead"];

const CHIP_BASE = "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors cursor-pointer";
const CHIP_OFF = `${CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;
const CHIP_ON = `${CHIP_BASE} bg-foreground text-background border-foreground font-medium`;

const OrgNrInput = ({ value, onChange, onLookup }: { value: string; onChange: (v: string) => void; onLookup: (name: string | null, city: string | null) => void }) => {
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
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="923 456 789" className="h-10 rounded-lg" />
      {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />}
    </div>
  );
};

const Companies = () => {
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", org_number: "", city: "", website: "", linkedin: "", status: "prospect" });
  const [locations, setLocations] = useState<string[]>([""]);
  useEffect(() => {
    if (form.city && locations[0] === "") {
      setLocations((prev) => [form.city, ...prev.slice(1)]);
    }
  }, [form.city]);
  const [signalFilter, setSignalFilter] = useState("all");
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "last_activity", dir: "desc" });
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*, contacts(id), profiles!companies_owner_id_fkey(id, full_name)")
        .order("name");
      if (error) throw error;

      const companyIds = data.map(c => c.id);
      // Get contact IDs for each company
      const contactIds = data.flatMap(c => (c.contacts || []).map((ct: any) => ct.id));

      const [actRes, taskRes, contactActRes, contactTaskRes] = await Promise.all([
        supabase.from("activities").select("company_id, created_at, subject, description").in("company_id", companyIds).order("created_at", { ascending: false }),
        supabase.from("tasks").select("company_id, due_date, title, description, status, created_at").in("company_id", companyIds).neq("status", "done"),
        contactIds.length > 0
          ? supabase.from("activities").select("contact_id, created_at, subject, description").in("contact_id", contactIds).order("created_at", { ascending: false })
          : Promise.resolve({ data: [] }),
        contactIds.length > 0
          ? supabase.from("tasks").select("contact_id, due_date, title, description, status, created_at").in("contact_id", contactIds).neq("status", "done")
          : Promise.resolve({ data: [] }),
      ]);

      // Build contact→company map
      const contactToCompany: Record<string, string> = {};
      data.forEach(c => (c.contacts || []).forEach((ct: any) => { contactToCompany[ct.id] = c.id; }));

      const now = new Date();
      const isPast = (d: string) => new Date(d) <= now;
      const lastActivityMap: Record<string, string> = {};
      const taskCountMap: Record<string, number> = {};
      const overdueTaskMap: Record<string, boolean> = {};

      // Collect activities and tasks per company for signal calculation
      const companyActsMap: Record<string, any[]> = {};
      const companyTasksMap: Record<string, any[]> = {};

      function addAct(companyId: string, a: any) {
        if (!companyActsMap[companyId]) companyActsMap[companyId] = [];
        companyActsMap[companyId].push(a);
      }
      function addTask(companyId: string, t: any) {
        if (!companyTasksMap[companyId]) companyTasksMap[companyId] = [];
        companyTasksMap[companyId].push(t);
      }

      (actRes.data || []).forEach(a => {
        if (!a.company_id) return;
        if (isPast(a.created_at) && !lastActivityMap[a.company_id]) lastActivityMap[a.company_id] = a.created_at;
        addAct(a.company_id, a);
      });

      ((contactActRes as any).data || []).forEach((a: any) => {
        const cid = contactToCompany[a.contact_id];
        if (!cid) return;
        if (isPast(a.created_at) && (!lastActivityMap[cid] || a.created_at > lastActivityMap[cid])) lastActivityMap[cid] = a.created_at;
        addAct(cid, a);
      });

      (taskRes.data || []).forEach(t => {
        if (!t.company_id) return;
        taskCountMap[t.company_id] = (taskCountMap[t.company_id] || 0) + 1;
        if (t.due_date && new Date(t.due_date) < new Date()) overdueTaskMap[t.company_id] = true;
        addTask(t.company_id, t);
      });

      ((contactTaskRes as any).data || []).forEach((t: any) => {
        const cid = contactToCompany[t.contact_id];
        if (!cid) return;
        taskCountMap[cid] = (taskCountMap[cid] || 0) + 1;
        if (t.due_date && new Date(t.due_date) < new Date()) overdueTaskMap[cid] = true;
        addTask(cid, t);
      });

      // Compute effective signal per company
      const signalMap: Record<string, string> = {};
      for (const c of data) {
        const sig = getEffectiveSignal(
          (companyActsMap[c.id] || []).map((a: any) => ({ created_at: a.created_at, subject: a.subject, description: a.description })),
          (companyTasksMap[c.id] || []).map((t: any) => ({ created_at: t.created_at, title: t.title, description: t.description, due_date: t.due_date })),
        );
        if (sig) signalMap[c.id] = sig;
      }

      return data.map(c => ({
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
        name: form.name, org_number: form.org_number || null, city: form.city || null,
        website: form.website || null, linkedin: form.linkedin || null, created_by: user?.id,
        status: form.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies-full"] });
      setOpen(false);
      setForm({ name: "", org_number: "", city: "", website: "", linkedin: "", status: "prospect" });
      setLocations([""]);
      toast.success("Selskap opprettet");
    },
    onError: () => toast.error("Kunne ikke opprette selskap"),
  });

  const getOwnerId = (company: any) => (company.profiles as any)?.id || null;

  const ownerMap = new Map<string, string>();
  companies.forEach(c => {
    const id = getOwnerId(c);
    const fullName = (c.profiles as any)?.full_name;
    if (id && fullName) ownerMap.set(id, fullName);
  });
  const ownerList = Array.from(ownerMap.entries());

  const setSignalMutation = useMutation({
    mutationFn: async ({ companyId, label }: { companyId: string; label: string }) => {
      const { error } = await supabase.from("activities").insert({
        type: "note",
        subject: label,
        description: `[${label}]`,
        company_id: companyId,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onMutate: async ({ companyId, label }) => {
      queryClient.setQueryData(["companies-full"], (old: any[]) =>
        old?.map(c => c.id === companyId ? { ...c, signal: label } : c)
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies-full"] });
      toast.success("Signal oppdatert");
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["companies-full"] });
      toast.error("Kunne ikke oppdatere signal");
    },
  });

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
      queryClient.setQueryData(["companies-full"], (old: any[]) =>
        old?.map(c => c.id === companyId ? { ...c, status } : c)
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies-full"] });
      toast.success("Type oppdatert");
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["companies-full"] });
      toast.error("Kunne ikke oppdatere type");
    },
  });

  const filtered = companies.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.org_number?.includes(q) || c.industry?.toLowerCase().includes(q);
    const matchOwner = ownerFilter === "all" || getOwnerId(c) === ownerFilter;
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const matchSignal = signalFilter === "all" || c.signal === signalFilter;
    return matchSearch && matchOwner && matchStatus && matchSignal;
  });

  const sorted = [...filtered].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    switch (sort.field) {
      case "name": return dir * a.name.localeCompare(b.name, "nb");
      case "type": {
        const ai = TYPE_ORDER.indexOf(a.status);
        const bi = TYPE_ORDER.indexOf(b.status);
        return dir * ((ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi));
      }
      case "signal": {
        const ai = SIGNAL_ORDER.indexOf(a.signal as any || "");
        const bi = SIGNAL_ORDER.indexOf(b.signal as any || "");
        return dir * ((ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi));
      }
      case "contacts": return dir * ((a.contacts?.length || 0) - (b.contacts?.length || 0));
      case "last_activity":
        if (!a.lastActivity && !b.lastActivity) return 0;
        if (!a.lastActivity) return 1;
        if (!b.lastActivity) return -1;
        return dir * a.lastActivity.localeCompare(b.lastActivity);
      case "tasks": return dir * ((a.taskCount || 0) - (b.taskCount || 0));
      default: return 0;
    }
  });

  const toggleSort = (field: SortField) => {
    setSort((prev) => prev.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: field === "last_activity" ? "desc" : "asc" });
  };

  const SortHeader = ({ field, children, className = "" }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <button onClick={() => toggleSort(field)}
      className={`flex items-center gap-1 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors ${className}`}>
      {children}
      <ArrowUpDown className={`h-3 w-3 ${sort.field === field ? "text-foreground" : "text-muted-foreground/20"}`} />
    </button>
  );

  const getStatus = (status: string) => statusLabels[status] || { label: status, className: "bg-secondary text-muted-foreground", badgeColor: "bg-gray-100 text-gray-600 border-gray-200" };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[1.375rem] font-bold">Selskaper</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-lg h-9 px-3.5 text-[0.8125rem] font-medium gap-1.5">
              <Plus className="h-4 w-4" />Nytt selskap
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[440px] rounded-xl">
            <DialogHeader><DialogTitle>Nytt selskap</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4 mt-3">
              <div className="space-y-1.5">
                <Label className="text-label">Selskapsnavn</Label>
                <BrregSearch
                  value={form.name}
                  onChange={(name) => setForm((f) => ({ ...f, name }))}
                  onSelect={(r) => setForm((f) => ({ ...f, name: r.name, org_number: r.org_number, city: r.city }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-label">Org.nr</Label>
                  <OrgNrInput
                    value={form.org_number}
                    onChange={(org_number) => setForm((f) => ({ ...f, org_number }))}
                    onLookup={(name, city) => setForm((f) => ({ ...f, name: name || f.name, city: city || f.city }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-label">Sted</Label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Oslo" className="h-10 rounded-lg" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-label">Nettside</Label>
                <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" className="h-10 rounded-lg" type="url" />
              </div>
              {/* STATUS */}
              <div className="space-y-1.5">
                <Label className="text-label">Status</Label>
                <div className="flex gap-1.5">
                  {([
                    { value: "prospect", label: "Potensiell kunde", activeClass: "bg-blue-500 text-white border-blue-500" },
                    { value: "customer", label: "Kunde", activeClass: "bg-emerald-500 text-white border-emerald-500" },
                    { value: "partner", label: "Partner", activeClass: "bg-gray-400 text-white border-gray-400" },
                    { value: "churned", label: "Ikke relevant selskap", activeClass: "bg-red-400 text-white border-red-400" },
                  ] as const).map((opt) => (
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
              {/* AVDELINGER */}
              <div className="space-y-1.5">
                <Label className="text-label">Avdelinger</Label>
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
                    + Legg til avdeling
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full h-10 rounded-lg" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Oppretter..." : "Opprett"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <Input placeholder="Søk..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 rounded-lg text-[0.8125rem] bg-card border-border" />
          </div>
          <span className="text-[0.75rem] text-muted-foreground ml-auto">{filtered.length} selskaper</span>
        </div>
        {/* Eier chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground w-16 shrink-0">Eier</span>
          {[{ id: "all", name: "Alle" }, ...ownerList.map(([id, name]) => ({ id: id as string, name: name as string }))].map(o => (
            <button key={o.id} onClick={() => setOwnerFilter(o.id)}
              className={ownerFilter === o.id ? CHIP_ON : CHIP_OFF}>
              {o.name}
            </button>
          ))}
        </div>
        {/* Signal chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground w-16 shrink-0">Signal</span>
          {[{ value: "all", label: "Alle" }, ...CATEGORIES.map(c => ({ value: c.label, label: c.label }))].map(o => (
            <button key={o.value} onClick={() => setSignalFilter(o.value)}
              className={signalFilter === o.value ? CHIP_ON : CHIP_OFF}>
              {o.label}
            </button>
          ))}
        </div>
        {/* Type chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground w-16 shrink-0">Type</span>
          {[
            { value: "all", label: "Alle" },
            { value: "prospect", label: "Potensiell kunde" },
            { value: "customer", label: "Kunde" },
            { value: "partner", label: "Partner" },
            { value: "churned", label: "Ikke relevant selskap" },
          ].map(o => (
            <button key={o.value} onClick={() => setStatusFilter(o.value)}
              className={statusFilter === o.value ? CHIP_ON : CHIP_OFF}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-px">{[1,2,3,4,5].map(i => <div key={i} className="h-[44px] bg-secondary/50 animate-pulse rounded" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Ingen selskaper funnet</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-card shadow-card">
          <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1.2fr)_60px_70px_100px] gap-3 px-4 py-2.5 border-b border-border bg-background">
            <SortHeader field="name">Selskap</SortHeader>
            <SortHeader field="type">Type</SortHeader>
            <SortHeader field="signal">Signal</SortHeader>
            <SortHeader field="contacts">Kont.</SortHeader>
            <SortHeader field="tasks">Oppf.</SortHeader>
            <SortHeader field="last_activity" className="justify-end">Siste akt.</SortHeader>
          </div>
          <div className="divide-y divide-border">
            {sorted.map((company) => {
              const status = getStatus(company.status);
              const contactCount = company.contacts?.length || 0;
              return (
                <div key={company.id}
                  className="w-full grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1.2fr)_60px_70px_100px] gap-3 items-center px-4 min-h-[44px] py-2 hover:bg-background/80 transition-colors duration-75 text-left cursor-pointer"
                  onClick={() => navigate(`/selskaper/${company.id}`)}>
                  <div className="min-w-0">
                    <span className="text-[0.8125rem] font-medium text-foreground truncate block">{company.name}</span>
                    {company.industry && (
                      <p className="text-[0.6875rem] text-muted-foreground truncate mt-0.5">{company.industry}</p>
                    )}
                  </div>
                  {/* TYPE - inline editable */}
                  <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        {(() => {
                          const t = TYPE_OPTIONS.find(o => o.value === company.status || (o.value === "customer" && company.status === "kunde"));
                          const badge = t || { label: company.status, badgeColor: "bg-gray-100 text-gray-600 border-gray-200" };
                          return (
                            <button className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold cursor-pointer ${badge.badgeColor}`}>
                              {badge.label}
                            </button>
                          );
                        })()}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {TYPE_OPTIONS.map(o => (
                          <DropdownMenuItem
                            key={o.value}
                            onClick={() => setTypeMutation.mutate({ companyId: company.id, status: o.value })}
                          >
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${o.badgeColor}`}>
                              {o.label}
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {/* SIGNAL - inline editable */}
                  <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        {(() => {
                          const signalBadge = getSignalBadge(company.signal || null);
                          return signalBadge ? (
                            <button className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold cursor-pointer ${signalBadge.color}`}>
                              {company.signal}
                            </button>
                          ) : (
                            <button className="inline-flex items-center rounded-full border border-dashed border-border px-2 py-0.5 text-[0.6875rem] text-muted-foreground/50 cursor-pointer hover:text-muted-foreground hover:border-muted-foreground/40 transition-colors">
                              + Signal
                            </button>
                          );
                        })()}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {SIGNAL_OPTIONS.map(s => (
                          <DropdownMenuItem
                            key={s.label}
                            onClick={() => setSignalMutation.mutate({ companyId: company.id, label: s.label })}
                          >
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${s.color}`}>
                              {s.label}
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <span className="text-[0.8125rem] text-muted-foreground">
                    {contactCount > 0 ? <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{contactCount}</span> : ""}
                  </span>
                  <span className={`text-[0.8125rem] ${company.hasOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {company.taskCount > 0 ? company.taskCount : ""}
                  </span>
                  <span className="text-[0.75rem] text-muted-foreground text-right">
                    {company.lastActivity ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{relativeDate(company.lastActivity)}</span>
                        </TooltipTrigger>
                        <TooltipContent>{format(new Date(company.lastActivity), "d. MMMM yyyy", { locale: nb })}</TooltipContent>
                      </Tooltip>
                    ) : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Companies;
