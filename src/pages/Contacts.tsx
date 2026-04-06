import { useState, useRef } from "react";
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
import { Search, ArrowUpDown, ChevronDown, Sparkles, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { BulkSignalModal } from "@/components/BulkSignalModal";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePersistentState } from "@/hooks/usePersistentState";
import { relativeDate } from "@/lib/relativeDate";
import { CONTACT_CV_EMAIL_REQUIRED_MESSAGE, contactHasEmail } from "@/lib/contactCvEligibility";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format, differenceInDays } from "date-fns";
import { nb } from "date-fns/locale";
import {
  calcHeatScore,
  getTemperature,
  getHeatResult,
  getTier,
  getTaskStatus,
  getActivityStatus,
  TEMP_CONFIG,
} from "@/lib/heatScore";
import { crmQueryKeys, crmSummaryQueryKeys, invalidateQueryGroup } from "@/lib/queryKeys";

type SortField = "name" | "company" | "title" | "signal" | "owner" | "last_activity" | "priority";
type SortDir = "asc" | "desc";

import {
  CATEGORIES,
  SIGNAL_OPTIONS,
  getEffectiveSignal,
  getSignalBadge,
  getSignalRank,
  upsertTaskSignalDescription,
} from "@/lib/categoryUtils";

const CHIP_BASE = "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors cursor-pointer";
const CHIP_OFF = `${CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;
const CHIP_ON = `${CHIP_BASE} bg-foreground text-background border-foreground font-medium`;

const JAKT_KONSULENTER = [
  { id: 1, navn: "Erik Paulsen", initialer: "EP", ledigFra: "24. apr.", dager: "18 dager til", passert: false },
  { id: 2, navn: "Kari Hansen", initialer: "KH", ledigFra: "1. juni", dager: "56 dager til", passert: false },
  { id: 3, navn: "Jon Berg", initialer: "JB", ledigFra: "nå", dager: "3 dager siden", passert: true },
  { id: 4, navn: "Lars Moen", initialer: "LM", ledigFra: "15. mai", dager: "39 dager til", passert: false },
];

const JAKT_CHIPS = [
  { value: "alle", label: "Alle" },
  { value: "foresporsler", label: "Forespørsler" },
  { value: "finn", label: "Finn-match" },
  { value: "dialog", label: "Dialog" },
  { value: "innkjoper", label: "Innkjøper" },
  { value: "kunder", label: "Kunder" },
  { value: "kald", label: "Kald" },
];

const GRID_DEFAULT = "grid-cols-[minmax(0,1.8fr)_minmax(0,1.4fr)_36px_minmax(0,1.4fr)_minmax(0,1.2fr)_70px_70px_90px]";
const GRID_JAKT = "grid-cols-[80px_minmax(0,1.8fr)_minmax(0,1.4fr)_36px_minmax(0,1.4fr)_minmax(0,1.2fr)_70px_70px_90px]";

const FINN_SELSKAPER = [
  { selskap: "Kongsberg Defence & Aerospace", teknologier: ["C++", "Embedded", "RTOS"] },
  { selskap: "Norbit AS", teknologier: ["C", "Linux", "Yocto"] },
  { selskap: "Nordic Semiconductor", teknologier: ["C++", "BLE", "Zephyr"] },
];

const Contacts = () => {
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [selectedKonsulent, setSelectedKonsulent] = useState<number | null>(null);
  const [jaktChip, setJaktChip] = useState("alle");
  const [search, setSearch] = usePersistentState("stacq:contacts:search", "");
  const [ownerFilter, setOwnerFilter] = usePersistentState("stacq:contacts:ownerFilter", "all");
  const [signalFilter, setSignalFilter] = usePersistentState("stacq:contacts:signalFilter", "all");
  const [typeFilter, setTypeFilter] = usePersistentState("stacq:contacts:typeFilter", "all");
  const [sort, setSort] = usePersistentState<{ field: SortField; dir: SortDir }>("stacq:contacts:sort", {
    field: "priority",
    dir: "desc",
  });
  const [hotListActive, setHotListActive] = usePersistentState("stacq:contacts:hotListActive", true);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: contactsResult, isLoading } = useQuery({
    queryKey: crmQueryKeys.contacts.all(),
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("contacts")
        .select("*, companies(name), profiles!contacts_owner_id_fkey(id, full_name)", { count: "exact" })
        .order("first_name")
        .limit(2000);
      if (error) throw error;

      const contactIds = new Set(data.map((c) => c.id));

      const companyIds = [...new Set(data.map((c) => c.company_id).filter(Boolean))];

      const [{ data: acts }, { data: tasks }, { data: techProfiles }, { data: foresporsler }] = await Promise.all([
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
        companyIds.length > 0
          ? supabase
              .from("company_tech_profile")
              .select("company_id, sist_fra_finn, teknologier")
              .in("company_id", companyIds)
          : Promise.resolve({ data: [] }),
        supabase
          .from("foresporsler")
          .select("selskap_id, mottatt_dato, status")
          .not("status", "in", '("avsluttet","tapt")'),
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

      const rows = data.map((c) => {
        const lastActivity = lastActMap[c.id] || null;
        const signal = signalMap[c.id] || null;
        const openTasks = openTasksMap[c.id] || { count: 0, overdue: false };
        const isInnkjoper = !!c.call_list;
        const ikkeAktuellKontakt = !!(c as any).ikke_aktuell_kontakt;
        const techProfile = (techProfiles || []).find((tp: any) => tp.company_id === c.company_id);
        const hasMarkedsradar = !!(
          techProfile?.sist_fra_finn && differenceInDays(new Date(), new Date(techProfile.sist_fra_finn)) <= 90
        );
        const daysSince = lastActivity ? differenceInDays(new Date(), new Date(lastActivity)) : 999;

        const hasAktivForespørsel = (foresporsler || []).some(
          (f: any) =>
            f.selskap_id === c.company_id &&
            f.mottatt_dato &&
            differenceInDays(new Date(), new Date(f.mottatt_dato)) <= 45,
        );
        const hasTidligereForespørsel = (foresporsler || []).some(
          (f: any) =>
            f.selskap_id === c.company_id &&
            f.mottatt_dato &&
            differenceInDays(new Date(), new Date(f.mottatt_dato)) > 45,
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
          hasMarkedsradar,
        };
      });

      return { rows, totalCount: count ?? data.length, capped: data.length < (count ?? 0) };
    },
  });

  const contacts = contactsResult?.rows ?? [];
  const totalCount = contactsResult?.totalCount ?? 0;
  const capped = contactsResult?.capped ?? false;

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
        .update({ [field]: newValue })
        .eq("id", contact.id);
      if (error) {
        toast.error("Kunne ikke oppdatere");
        queryClient.setQueryData(crmQueryKeys.contacts.all(), (old: any) => ({
          ...old,
          rows: old?.rows?.map((c: any) => (c.id === contact.id ? { ...c, [field]: !newValue } : c)),
        }));
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

  const ownerMap = new Map<string, string>();
  contacts.forEach((c) => {
    const id = getOwnerId(c);
    const name = getOwnerName(c);
    if (id && name) ownerMap.set(id, name);
  });
  const uniqueOwners = Array.from(ownerMap.entries());

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      (c.companies as any)?.name?.toLowerCase().includes(q) ||
      c.title?.toLowerCase().includes(q);
    const matchOwner = ownerFilter === "all" || getOwnerId(c) === ownerFilter;
    const matchSignal = signalFilter === "all" || (c as any).signal === signalFilter;
    const matchType =
      typeFilter === "all" || (typeFilter === "call_list" && c.call_list) || (typeFilter === "cv_email" && c.cv_email);
    return matchSearch && matchOwner && matchSignal && matchType;
  });

  const sorted = [...filtered].sort((a, b) => {
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
        if (ta !== tb) return ta - tb; // tier ASC (1 best)
        return sb - sa; // score DESC innen tier
      }
      default:
        return 0;
    }
  });

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
      onClick={() => toggleSort(field)}
      className={`flex items-center gap-1 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors ${className}`}
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[1.375rem] font-bold">Kontakter</h1>
      </div>

      {/* Konsulent-velger — mellom h1 og søk */}
      <div className="flex flex-col">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
          Tilgjengelig for oppdrag
        </p>
        {JAKT_KONSULENTER.map((k) => {
          const erValgt = selectedKonsulent === k.id;
          return (
            <div
              key={k.id}
              onClick={() => setSelectedKonsulent(erValgt ? null : k.id)}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-lg bg-card cursor-pointer transition-colors mb-1.5",
                erValgt
                  ? "border-2 border-foreground"
                  : "border border-border hover:bg-muted/40"
              )}
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[0.6875rem] font-semibold shrink-0",
                  erValgt ? "border-2 border-foreground text-foreground" : "border border-border text-muted-foreground"
                )}
              >
                {k.initialer}
              </div>
              <span className={cn(
                "text-[0.875rem] text-foreground",
                erValgt ? "font-semibold" : "font-medium"
              )}>
                {k.navn}
              </span>
              <div className="text-right ml-auto">
                <span className="text-[0.75rem] text-muted-foreground">
                  Tilgjengelig {k.ledigFra}
                </span>
                <span className={`text-[0.75rem] ml-1.5 ${k.passert ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                  · {k.dager}
                </span>
              </div>
            </div>
          );
        })}
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
            <option value="priority:desc">Sorter: Prioritet</option>
            <option value="name:asc">Sorter: Navn A-Å</option>
            <option value="name:desc">Sorter: Navn Å-A</option>
            <option value="company:asc">Sorter: Selskap A-Å</option>
            <option value="title:asc">Sorter: Stilling A-Å</option>
            <option value="signal:asc">Sorter: Signal</option>
            <option value="owner:asc">Sorter: Eier</option>
            <option value="last_activity:desc">Sorter: Siste aktivitet</option>
          </select>
        </div>
      </div>

      {/* Chip filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="space-y-2 flex-1">
          {selectedKonsulent === null && (
            <div className="space-y-2">
              {/* EIER */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground w-16 shrink-0">
                  Eier
                </span>
                <Chip label="Alle" value="all" current={ownerFilter} onSelect={setOwnerFilter} />
                {uniqueOwners.map(([id, name]) => (
                  <Chip key={id} label={name} value={id} current={ownerFilter} onSelect={setOwnerFilter} />
                ))}
              </div>
              {/* SIGNAL */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground w-16 shrink-0">
                  Signal
                </span>
                <Chip label="Alle" value="all" current={signalFilter} onSelect={setSignalFilter} />
                {SIGNAL_OPTIONS.map((s) => (
                  <Chip key={s.label} label={s.label} value={s.label} current={signalFilter} onSelect={setSignalFilter} />
                ))}
                <div className="w-px h-5 bg-border mx-1" />
                <button
                  onClick={() => {
                    const next = !hotListActive;
                    setHotListActive(next);
                    setSort(next ? { field: "priority", dir: "desc" } : { field: "signal", dir: "asc" });
                  }}
                  className={cn(
                    "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors cursor-pointer inline-flex items-center gap-1.5",
                    hotListActive
                      ? "bg-red-500 text-white border-red-500 font-medium"
                      : "border-border text-muted-foreground hover:bg-secondary",
                  )}
                >
                  🔥 Hot list
                </button>
              </div>
              {/* TYPE */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground w-16 shrink-0">
                  Type
                </span>
                <Chip label="Alle" value="all" current={typeFilter} onSelect={setTypeFilter} />
                <Chip label="Innkjøper" value="call_list" current={typeFilter} onSelect={setTypeFilter} />
                <Chip label="CV-Epost" value="cv_email" current={typeFilter} onSelect={setTypeFilter} />
              </div>
            </div>
          )}

          {/* Jakt-filter — kun synlig når konsulent er valgt */}
          {selectedKonsulent !== null && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground w-16 shrink-0">
                Type
              </span>
              {JAKT_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  onClick={() => setJaktChip(chip.value)}
                  className={jaktChip === chip.value ? CHIP_ON : CHIP_OFF}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 md:ml-auto shrink-0">
          <div className="w-px h-8 bg-border" />
          <div className="text-right">
            <span className="text-[0.9375rem] font-semibold text-foreground">
              {filtered.length === contacts.length ? `${totalCount}${capped ? "+" : ""}` : filtered.length}
            </span>
            <span className="text-[0.9375rem] text-muted-foreground ml-1.5">kontakter</span>
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
        <p className="text-sm text-muted-foreground py-12 text-center">Ingen kontakter funnet</p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {sorted.map((contact) => {
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
                        onClick={() => handleToggle(contact, "cv_email", !contact.cv_email)}
                        className={
                          contact.cv_email
                            ? "rounded-full bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 text-xs font-medium cursor-pointer"
                            : "rounded-full border border-border text-muted-foreground px-2 py-0.5 text-xs hover:bg-secondary cursor-pointer"
                        }
                      >
                        CV
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
          </div>

          <div className="hidden md:block border border-border rounded-lg overflow-hidden bg-card shadow-card">
            <div className={`grid ${selectedKonsulent !== null ? GRID_JAKT : GRID_DEFAULT} gap-3 px-4 py-2.5 border-b border-border bg-background`}>
              {selectedKonsulent !== null && (
                <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">Handling</span>
              )}
              <SortHeader field="name">Navn</SortHeader>
              <SortHeader field="signal">Signal</SortHeader>
              <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">Finn</span>
              <SortHeader field="company">Selskap</SortHeader>
              <SortHeader field="title">Stilling</SortHeader>
              <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">Match</span>
              <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">Tags</span>
              <SortHeader field="last_activity" className="justify-end">
                Siste akt.
              </SortHeader>
            </div>
            <div className="divide-y divide-border">
              {sorted.map((contact) => {
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
                    className={`grid ${selectedKonsulent !== null ? GRID_JAKT : GRID_DEFAULT} gap-3 items-center pl-3 pr-4 min-h-[44px] py-2 hover:bg-background/80 transition-colors duration-75`}
                  >
                    {selectedKonsulent !== null && (
                      <div className="flex items-center">
                        {(() => {
                          const idx = sorted.indexOf(contact);
                          const quarter = Math.ceil(sorted.length / 4);
                          if (idx < quarter) {
                            return <span className="inline-flex items-center rounded-full bg-foreground text-background px-2.5 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap">🔥 Ring nå</span>;
                          } else if (idx < quarter * 2) {
                            return <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-[0.6875rem] font-medium text-foreground whitespace-nowrap">↩ Følg opp</span>;
                          } else if (idx < quarter * 3) {
                            return <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-[0.6875rem] font-medium text-foreground whitespace-nowrap">🎯 Ny match</span>;
                          } else {
                            return <span className="text-[0.75rem] text-muted-foreground">—</span>;
                          }
                        })()}
                      </div>
                    )}
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
                    {/* Match-kolonne — hardkodet designforslag */}
                    <div className="flex items-center">
                      {(() => {
                        const idx = sorted.indexOf(contact);
                        const third = Math.ceil(sorted.length / 3);
                        if (idx < third) {
                          return <span className="inline-flex items-center rounded-full bg-foreground text-background px-2.5 py-0.5 text-[0.6875rem] font-semibold">92%</span>;
                        } else if (idx < third * 2) {
                          return <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-[0.6875rem] font-medium text-foreground">61%</span>;
                        } else {
                          return <span className="text-[0.75rem] text-muted-foreground">—</span>;
                        }
                      })()}
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleToggle(contact, "cv_email", !contact.cv_email)}
                        className={
                          contact.cv_email
                            ? "rounded-full bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 text-xs font-medium cursor-pointer"
                            : "rounded-full border border-border text-muted-foreground px-2 py-0.5 text-xs hover:bg-secondary cursor-pointer"
                        }
                      >
                        CV
                      </button>
                      <button
                        onClick={() => handleToggle(contact, "call_list", !contact.call_list)}
                        className={
                          contact.call_list
                            ? "rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 text-xs font-medium cursor-pointer"
                            : "rounded-full border border-border text-muted-foreground px-2 py-0.5 text-xs hover:bg-secondary cursor-pointer"
                        }
                      >
                        INN
                      </button>
                    </div>
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
          </div>
        </>
      )}
      {selectedKonsulent !== null && (
        <div className="mt-4">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
            Selskaper med Finn-match uten kontakt
          </p>
          <div className="border border-border rounded-lg overflow-hidden bg-card divide-y divide-border">
            {FINN_SELSKAPER.map((s) => (
              <div key={s.selskap} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-[0.875rem] font-medium text-foreground">{s.selskap}</p>
                  <div className="flex gap-1 mt-1">
                    {s.teknologier.map((t) => (
                      <span key={t} className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <button className="text-[0.8125rem] text-primary hover:underline shrink-0 ml-4">
                  + Legg til kontakt
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <BulkSignalModal open={bulkModalOpen} onClose={() => setBulkModalOpen(false)} />
    </div>
  );
};

export default Contacts;
