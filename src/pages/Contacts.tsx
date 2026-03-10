import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Building2, ArrowUpDown, ChevronDown, Sparkles } from "lucide-react";
import { BulkSignalModal } from "@/components/BulkSignalModal";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { relativeDate } from "@/lib/relativeDate";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

type SortField = "name" | "company" | "title" | "signal" | "owner" | "last_activity";
type SortDir = "asc" | "desc";

import { CATEGORIES, getEffectiveSignal } from "@/lib/categoryUtils";

const SIGNAL_OPTIONS = CATEGORIES.map(c => ({ label: c.label, color: c.badgeColor }));

function getSignalBadge(category: string | null) {
  if (!category) return null;
  return SIGNAL_OPTIONS.find((s) => s.label === category) || null;
}

const CHIP_BASE = "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors cursor-pointer";
const CHIP_OFF = `${CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;
const CHIP_ON = `${CHIP_BASE} bg-foreground text-background border-foreground font-medium`;

const Contacts = () => {
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [signalFilter, setSignalFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "signal", dir: "asc" });
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: contactsResult, isLoading } = useQuery({
    queryKey: ["contacts-full"],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("contacts")
        .select("*, companies(name), profiles!contacts_owner_id_fkey(id, full_name)", { count: "exact" })
        .order("first_name")
        .limit(2000);
      if (error) throw error;

      const contactIds = new Set(data.map(c => c.id));

      const [{ data: acts }, { data: tasks }] = await Promise.all([
        supabase
          .from("activities")
          .select("contact_id, created_at, description, subject")
          .not("contact_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase
          .from("tasks")
          .select("contact_id, created_at, due_date, status, description, title")
          .not("contact_id", "is", null)
          .limit(5000),
      ]);

      // Last activity date map — only past activities count
      const lastActMap: Record<string, string> = {};
      const now = new Date().toISOString();
      (acts || []).forEach(a => {
        if (a.contact_id && a.created_at <= now && !lastActMap[a.contact_id]) lastActMap[a.contact_id] = a.created_at;
      });

      // Signal: effective (expiry-aware) signal per contact
      const contactActsMap: Record<string, typeof acts> = {};
      const contactTasksMap: Record<string, typeof tasks> = {};
      (acts || []).forEach(a => {
        if (a.contact_id) {
          if (!contactActsMap[a.contact_id]) contactActsMap[a.contact_id] = [];
          contactActsMap[a.contact_id]!.push(a);
        }
      });
      (tasks || []).forEach(t => {
        if (t.contact_id) {
          if (!contactTasksMap[t.contact_id]) contactTasksMap[t.contact_id] = [];
          contactTasksMap[t.contact_id]!.push(t);
        }
      });

      const signalMap: Record<string, string> = {};
      for (const cid of contactIds) {
        const sig = getEffectiveSignal(
          (contactActsMap[cid] || []).map(a => ({ created_at: a.created_at, subject: a.subject!, description: a.description })),
          (contactTasksMap[cid] || []).map(t => ({ created_at: t.created_at, title: t.title!, description: t.description, due_date: t.due_date })),
        );
        if (sig) signalMap[cid] = sig;
      }

      // Open tasks count + overdue flag per contact
      const openTasksMap: Record<string, { count: number; overdue: boolean }> = {};
      const today = new Date().toISOString().slice(0, 10);
      (tasks || []).forEach(t => {
        if (t.contact_id && t.status === "open") {
          if (!openTasksMap[t.contact_id]) openTasksMap[t.contact_id] = { count: 0, overdue: false };
          openTasksMap[t.contact_id].count++;
          if (t.due_date && t.due_date < today) openTasksMap[t.contact_id].overdue = true;
        }
      });

      const rows = data.map(c => ({
        ...c,
        lastActivity: lastActMap[c.id] || null,
        signal: signalMap[c.id] || null,
        openTasks: openTasksMap[c.id] || { count: 0, overdue: false },
      }));

      return { rows, totalCount: count ?? data.length, capped: data.length < (count ?? 0) };
    },
  });

  const contacts = contactsResult?.rows ?? [];
  const totalCount = contactsResult?.totalCount ?? 0;
  const capped = contactsResult?.capped ?? false;


  const pendingToggles = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const handleToggle = (contact: any, field: "cv_email" | "call_list", newValue: boolean) => {
    const key = `${contact.id}-${field}`;
    const label = field === "cv_email" ? "CV-Epost" : "Innkjøper";
    const msg = newValue ? `${label} aktivert` : `${label} deaktivert`;

    if (pendingToggles.current[key]) {
      clearTimeout(pendingToggles.current[key]);
      delete pendingToggles.current[key];
    }

    queryClient.setQueryData(["contacts-full"], (old: any) => ({
      ...old,
      rows: old?.rows?.map((c: any) => c.id === contact.id ? { ...c, [field]: newValue } : c),
    }));

    const timeout = setTimeout(async () => {
      delete pendingToggles.current[key];
      const { error } = await supabase.from("contacts").update({ [field]: newValue }).eq("id", contact.id);
      if (error) {
        toast.error("Kunne ikke oppdatere");
        queryClient.setQueryData(["contacts-full"], (old: any) => ({
          ...old,
          rows: old?.rows?.map((c: any) => c.id === contact.id ? { ...c, [field]: !newValue } : c),
        }));
      }
      queryClient.invalidateQueries({ queryKey: ["contacts-full"] });
    }, 10000);
    pendingToggles.current[key] = timeout;

    toast(msg, {
      duration: 10000,
      action: {
        label: "Angre",
        onClick: () => {
          clearTimeout(pendingToggles.current[key]);
          delete pendingToggles.current[key];
          queryClient.setQueryData(["contacts-full"], (old: any) => ({
            ...old,
            rows: old?.rows?.map((c: any) => c.id === contact.id ? { ...c, [field]: !newValue } : c),
          }));
        },
      },
    });
  };

  const setSignalMutation = useMutation({
    mutationFn: async ({ contactId, companyId, label }: { contactId: string; companyId: string | null; label: string }) => {
      const { error } = await supabase.from("activities").insert({
        type: "note",
        subject: label,
        description: `[${label}]`,
        contact_id: contactId,
        company_id: companyId,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onMutate: async ({ contactId, label }) => {
      // Optimistic update
      queryClient.setQueryData(["contacts-full"], (old: any[]) =>
        old?.map(c => c.id === contactId ? { ...c, signal: label } : c)
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts-full"] });
      queryClient.invalidateQueries({ queryKey: ["companies-full"] });
      toast.success("Signal oppdatert");
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts-full"] });
      toast.error("Kunne ikke oppdatere signal");
    },
  });

  const getOwnerId = (contact: any) => (contact.profiles as any)?.id || null;
  const getOwnerName = (contact: any) => (contact.profiles as any)?.full_name || null;

  const ownerMap = new Map<string, string>();
  contacts.forEach(c => {
    const id = getOwnerId(c);
    const name = getOwnerName(c);
    if (id && name) ownerMap.set(id, name);
  });
  const uniqueOwners = Array.from(ownerMap.entries());

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      (c.companies as any)?.name?.toLowerCase().includes(q) || c.title?.toLowerCase().includes(q);
    const matchOwner = ownerFilter === "all" || getOwnerId(c) === ownerFilter;
    const matchSignal = signalFilter === "all" || (c as any).signal === signalFilter;
    const matchType = typeFilter === "all" ||
      (typeFilter === "call_list" && c.call_list) ||
      (typeFilter === "cv_email" && c.cv_email);
    return matchSearch && matchOwner && matchSignal && matchType;
  });

  const SIGNAL_ORDER: Record<string, number> = {
    "Behov nå": 0,
    "Får fremtidig behov": 1,
    "Får kanskje behov": 2,
    "Ukjent om behov": 3,
    "Ikke aktuelt": 4,
  };

  const sorted = [...filtered].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    switch (sort.field) {
      case "name": return dir * `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, "nb");
      case "company": return dir * ((a.companies as any)?.name || "").localeCompare((b.companies as any)?.name || "", "nb");
      case "title": return dir * (a.title || "").localeCompare(b.title || "", "nb");
      case "signal": {
        const sa = (a as any).signal as string | null;
        const sb = (b as any).signal as string | null;
        const oa = sa ? (SIGNAL_ORDER[sa] ?? 5) : 6;
        const ob = sb ? (SIGNAL_ORDER[sb] ?? 5) : 6;
        return dir * (oa - ob);
      }
      case "owner": return dir * (getOwnerName(a) || "").localeCompare(getOwnerName(b) || "", "nb");
      case "last_activity":
        if (!(a as any).lastActivity && !(b as any).lastActivity) return 0;
        if (!(a as any).lastActivity) return 1;
        if (!(b as any).lastActivity) return -1;
        return dir * (a as any).lastActivity.localeCompare((b as any).lastActivity);
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

  const Chip = ({ label, value, current, onSelect }: { label: string; value: string; current: string; onSelect: (v: string) => void }) => (
    <button onClick={() => onSelect(value)} className={current === value ? CHIP_ON : CHIP_OFF}>{label}</button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[1.375rem] font-bold">Kontakter</h1>
        <button
          onClick={() => setBulkModalOpen(true)}
          className="inline-flex items-center gap-1.5 h-8 px-3 text-[0.8125rem] font-medium rounded-lg border border-border bg-background text-foreground hover:bg-secondary transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Oppdater signaler
        </button>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input placeholder="Søk..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-lg text-[0.8125rem] bg-card border-border" />
        </div>
      </div>

      {/* Chip filters */}
      <div className="space-y-2">
        {/* EIER */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground w-16 shrink-0">Eier</span>
          <Chip label="Alle" value="all" current={ownerFilter} onSelect={setOwnerFilter} />
          {uniqueOwners.map(([id, name]) => (
            <Chip key={id} label={name} value={id} current={ownerFilter} onSelect={setOwnerFilter} />
          ))}
        </div>
        {/* SIGNAL */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground w-16 shrink-0">Signal</span>
          <Chip label="Alle" value="all" current={signalFilter} onSelect={setSignalFilter} />
          {SIGNAL_OPTIONS.map((s) => (
            <Chip key={s.label} label={s.label} value={s.label} current={signalFilter} onSelect={setSignalFilter} />
          ))}
        </div>
        {/* TYPE */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground w-16 shrink-0">Type</span>
          <Chip label="Alle" value="all" current={typeFilter} onSelect={setTypeFilter} />
          <Chip label="Innkjøper" value="call_list" current={typeFilter} onSelect={setTypeFilter} />
          <Chip label="CV-Epost" value="cv_email" current={typeFilter} onSelect={setTypeFilter} />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-px">{[1,2,3,4,5].map(i => <div key={i} className="h-[44px] bg-secondary/50 animate-pulse rounded" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Ingen kontakter funnet</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-card shadow-card">
            <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_90px_90px] gap-3 px-4 py-2.5 border-b border-border bg-background">
            <SortHeader field="name">Navn</SortHeader>
            <SortHeader field="signal">Signal</SortHeader>
            <SortHeader field="company">Selskap</SortHeader>
            <SortHeader field="title">Stilling</SortHeader>
            <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">Tags</span>
            <SortHeader field="last_activity" className="justify-end">Siste akt.</SortHeader>
          </div>
          <div className="divide-y divide-border">
            {sorted.map((contact) => {
              const companyName = (contact.companies as any)?.name;
              const signal = (contact as any).signal as string | null;
              const signalBadge = getSignalBadge(signal);
              const openTasks = (contact as any).openTasks || { count: 0, overdue: false };

              return (
                <div key={contact.id} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_90px_90px] gap-3 items-center px-4 min-h-[44px] py-2 hover:bg-background/80 transition-colors duration-75">
                  {/* NAME - clickable */}
                  <button onClick={() => navigate(`/kontakter/${contact.id}`)} className="min-w-0 text-left cursor-pointer">
                    <p className="text-[0.8125rem] font-medium text-foreground truncate">
                      {contact.first_name} {contact.last_name}
                    </p>
                  </button>
                  {/* SIGNAL - inline editable */}
                  <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        {signalBadge ? (
                          <button className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold cursor-pointer ${signalBadge.color}`}>
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
                        {SIGNAL_OPTIONS.map(s => (
                          <DropdownMenuItem
                            key={s.label}
                            onClick={() => setSignalMutation.mutate({ contactId: contact.id, companyId: contact.company_id, label: s.label })}
                          >
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${s.color}`}>
                              {s.label}
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {/* COMPANY */}
                  <button onClick={() => navigate(`/kontakter/${contact.id}`)} className="text-[0.8125rem] text-muted-foreground truncate flex items-center gap-1 text-left cursor-pointer">
                    {companyName ? <><Building2 className="h-3 w-3 flex-shrink-0" />{companyName}</> : ""}
                  </button>
                  {/* TITLE */}
                  <button onClick={() => navigate(`/kontakter/${contact.id}`)} className="text-[0.8125rem] text-muted-foreground truncate text-left cursor-pointer">
                    {contact.title?.slice(0, 25) || ""}
                  </button>
                  {/* TAGS */}
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleToggle(contact, "cv_email", !contact.cv_email)}
                      className={contact.cv_email
                        ? "rounded-full bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 text-xs font-medium cursor-pointer"
                        : "rounded-full border border-border text-muted-foreground px-2 py-0.5 text-xs hover:bg-secondary cursor-pointer"
                      }
                    >CV</button>
                    <button
                      onClick={() => handleToggle(contact, "call_list", !contact.call_list)}
                      className={contact.call_list
                        ? "rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 text-xs font-medium cursor-pointer"
                        : "rounded-full border border-border text-muted-foreground px-2 py-0.5 text-xs hover:bg-secondary cursor-pointer"
                      }
                    >INN</button>
                  </div>
                  {/* SISTE AKT */}
                  <span className="text-[0.75rem] text-muted-foreground text-right">
                    {(contact as any).lastActivity ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{relativeDate((contact as any).lastActivity)}</span>
                        </TooltipTrigger>
                        <TooltipContent>{format(new Date((contact as any).lastActivity), "d. MMMM yyyy", { locale: nb })}</TooltipContent>
                      </Tooltip>
                    ) : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <BulkSignalModal open={bulkModalOpen} onClose={() => setBulkModalOpen(false)} />
    </div>
  );
};

export default Contacts;
