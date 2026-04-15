import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Search,
  ChevronDown,
  ChevronUp,
  X,
  Wifi,
} from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { nb } from "date-fns/locale";
import { getEffectiveSignal, normalizeCategoryLabel, upsertTaskSignalDescription } from "@/lib/categoryUtils";
import { toast } from "sonner";
import {
  getConsultantAvailabilityMeta,
  hasConsultantAvailability,
  isActiveRequest,
  sortHuntConsultants,
} from "@/lib/contactHunt";
import { useAuth } from "@/hooks/useAuth";
import { ContactCardContent } from "@/components/ContactCardContent";
import { TextSizeControl, SCALE_MAP, type TextSize } from "@/components/designlab/TextSizeControl";
import { C, SIGNAL_COLORS } from "@/components/designlab/theme";
import { CommandPalette } from "@/components/designlab/CommandPalette";
import { usePersistentState } from "@/hooks/usePersistentState";
import { getHeatResult, getTaskStatus, getActivityStatus, type HeatResult } from "@/lib/heatScore";
import { DesignLabSidebar } from "@/components/designlab/DesignLabSidebar";
import { CONTACT_CV_EMAIL_REQUIRED_MESSAGE, contactHasEmail } from "@/lib/contactCvEligibility";
import { crmQueryKeys, crmSummaryQueryKeys, invalidateQueryGroup } from "@/lib/queryKeys";

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
const OWNERS = ["Alle", "Jon Richard Nygaard", "Thomas Eriksen", "Uten eier"];
const TYPES = ["Alle", "Innkjøper", "CV-Epost", "Ikke relevant kontakt"] as const;
type TypeFilter = (typeof TYPES)[number];

type SortField = "name" | "signal" | "company" | "title" | "owner" | "last_activity" | "priority";
type SortDir = "asc" | "desc";

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
  if (heat.temperature === "lovende") return "#FB923C";
  if (heat.temperature === "mulig") return "#FBBF24";
  return "transparent";
}



/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function DesignLabContacts() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { signOut, user } = useAuth();
  const queryClient = useQueryClient();
  const [textSize, setTextSize] = usePersistentState<TextSize>("dl-text-size", "M");
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("Alle");
  const [signalFilter, setSignalFilter] = useState("Alle");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("Alle");
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "priority", dir: "desc" });
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
      queryClient.setQueryData(DL_QUERY_KEYS.contacts, (old: any) =>
        Array.isArray(old) ? old.map((contact) => (contact.id === contactId ? { ...contact, ...updates } : contact)) : old,
      );
      queryClient.setQueryData(DL_QUERY_KEYS.contactsParity, (old: any) =>
        Array.isArray(old) ? old.map((contact) => (contact.id === contactId ? { ...contact, ...updates } : contact)) : old,
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
    if (selectedId) {
      setSearchParams({ contact: selectedId }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [selectedId, setSearchParams]);

  // ── Queries ──
  const { data: rawContacts = [], isLoading } = useQuery({
    queryKey: DL_QUERY_KEYS.contacts,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select(
          "id, first_name, last_name, title, email, phone, cv_email, call_list, ikke_aktuell_kontakt, teknologier, company_id, location, linkedin, department, notes, locations, mailchimp_status, companies(id, name, ikke_relevant), profiles:owner_id(id, full_name)",
        )
        .order("updated_at", { ascending: false })
        .limit(500);
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
        .select("id, selskap_id, mottatt_dato, status")
        .not("selskap_id", "is", null)
        .order("mottatt_dato", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
    enabled: companyIds.size > 0,
  });

  const foresporslerMap = useMemo(() => {
    const map: Record<string, typeof allForesporsler> = {};
    allForesporsler.forEach((foresporsel) => {
      if (foresporsel.selskap_id && companyIds.has(foresporsel.selskap_id)) {
        (map[foresporsel.selskap_id] ??= []).push(foresporsel);
      }
    });
    return map;
  }, [allForesporsler, companyIds]);

  // ── Company tech profiles for FINN column ──

  const { data: allTechProfiles = [] } = useQuery({
    queryKey: DL_QUERY_KEYS.techProfiles,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_tech_profile")
        .select("company_id, sist_fra_finn")
        .not("company_id", "is", null)
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
    enabled: companyIds.size > 0,
  });

  const techProfileMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    allTechProfiles.forEach((profile) => {
      if (profile.company_id && companyIds.has(profile.company_id)) {
        map[profile.company_id] = profile.sist_fra_finn;
      }
    });
    return map;
  }, [allTechProfiles, companyIds]);

  // ── Consultants available ──
  const { data: availableConsultants = [] } = useQuery({
    queryKey: DL_QUERY_KEYS.consultants,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stacq_ansatte")
        .select("id, navn, status, tilgjengelig_fra")
        .in("status", ["AKTIV/SIGNERT", "Ledig"])
        .not("tilgjengelig_fra", "is", null);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const sortedConsultants = useMemo(() => {
    return sortHuntConsultants(
      (availableConsultants as Array<{ id: number; navn: string; tilgjengelig_fra: string | null }>).filter((consultant) =>
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
          "*, companies(id, name, ikke_relevant), profiles!contacts_owner_id_fkey(id, full_name)",
        )
        .order("updated_at", { ascending: false })
        .limit(500);
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
          .select("company_id, sist_fra_finn")
          .not("company_id", "is", null)
          .limit(5000),
        supabase
          .from("foresporsler")
          .select("selskap_id, mottatt_dato, status")
          .order("mottatt_dato", { ascending: false })
          .limit(5000),
      ]);

      const now = new Date();
      const nowIso = now.toISOString();
      const lastActMap: Record<string, string> = {};
      const contactActsMap: Record<string, NonNullable<typeof acts>> = {};
      const contactTasksMap: Record<string, NonNullable<typeof tasks>> = {};

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

      const techProfileMap: Record<string, string | null> = {};
      (companyTechProfiles || []).forEach((profile) => {
        if (profile.company_id) techProfileMap[profile.company_id] = profile.sist_fra_finn || null;
      });

      const requestMap: Record<string, NonNullable<typeof requestRows>> = {};
      (requestRows || []).forEach((request) => {
        if (!request.selskap_id) return;
        (requestMap[request.selskap_id] ??= []).push(request);
      });

      return data.map((contact) => {
        const company = (contact as any).companies;
        const owner = (contact as any).profiles;
        const companyId = contact.company_id || "";
        const actsForContact = contactActsMap[contact.id] || [];
        const tasksForContact = contactTasksMap[contact.id] || [];
        const foresporslerForCompany = requestMap[companyId] || [];
        const signal = signalMap[contact.id] ? mapToSignal(signalMap[contact.id]) : "";
        const lastActivityAt = lastActMap[contact.id] || null;
        const daysSince = lastActivityAt ? differenceInDays(now, new Date(lastActivityAt)) : 999;
        const hasOverdue = tasksForContact.some(
          (task) =>
            task.status !== "done" &&
            task.status !== "completed" &&
            task.due_date &&
            new Date(task.due_date) < now,
        );
        const hasAktivForespørsel = foresporslerForCompany.some((request) =>
          isActiveRequest(request.mottatt_dato, request.status),
        );
        const hasTidligereForespørsel =
          foresporslerForCompany.length > 0 &&
          foresporslerForCompany.some((request) => !isActiveRequest(request.mottatt_dato, request.status));
        const sistFraFinn = techProfileMap[companyId] || null;
        const hasMarkedsradar = Boolean(sistFraFinn && differenceInDays(now, new Date(sistFraFinn)) <= 90);
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
          hasOverdue,
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
          signal,
          eier: owner?.full_name || "",
          eierId: owner?.id || null,
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
          heatResult,
          hasMarkedsradar,
        };
      });
    },
  });

  // ── Computed with heat score ──
  const fallbackContacts = useMemo(() => {
    const now = new Date();
    const nowIso = now.toISOString();
    return rawContacts.map((c) => {
      const acts = (activitiesMap as any)[c.id] || [];
      const tasks = (tasksMap as any)[c.id] || [];
      const companyId = (c as any).company_id || "";
      const foresps = (foresporslerMap as any)[companyId] || [];
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
      const company = (c as any).companies;
      const owner = (c as any).profiles;

      const hasOverdue = tasks.some(
        (t: any) => t.status !== "done" && t.status !== "completed" && t.due_date && new Date(t.due_date) < now,
      );
      const hasAktivForespørsel = foresps.some((request: any) => isActiveRequest(request.mottatt_dato, request.status));
      const hasTidligereForespørsel =
        foresps.length > 0 && foresps.some((request: any) => !isActiveRequest(request.mottatt_dato, request.status));
      const sistFraFinn = (techProfileMap as any)[companyId] || null;
      const hasMarkedsradar = !!(sistFraFinn && differenceInDays(now, new Date(sistFraFinn)) <= 90);
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
        hasOverdue,
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
        signal,
        eier: owner?.full_name || "",
        eierId: owner?.id || null,
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
        heatResult,
        hasMarkedsradar,
      };
    });
  }, [rawContacts, activitiesMap, tasksMap, foresporslerMap, techProfileMap]);

  const contacts = useMemo(
    () => (parityContacts.length > 0 || (rawContacts.length === 0 && !isLoadingParity) ? parityContacts : fallbackContacts),
    [fallbackContacts, isLoadingParity, parityContacts, rawContacts.length],
  );

  const toggleSort = useCallback((field: SortField) => {
    setSort((current) =>
      current.field === field
        ? { field, dir: current.dir === "asc" ? "desc" : "asc" }
        : { field, dir: field === "last_activity" || field === "priority" ? "desc" : "asc" },
    );
  }, []);

  const filtered = useMemo(() => {
    let list = contacts;
    // Default: hide ikke-relevante unless explicitly filtering for them
    if (typeFilter !== "Ikke relevant kontakt") {
      list = list.filter((c) => !c.ikkeAktuell);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
          c.company.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q),
      );
    }
    if (ownerFilter === "Uten eier") list = list.filter((c) => !c.eier);
    else if (ownerFilter !== "Alle") list = list.filter((c) => c.eier === ownerFilter);
    if (signalFilter !== "Alle") list = list.filter((c) => c.signal === signalFilter);
    if (typeFilter === "Innkjøper") list = list.filter((c) => c.callList === true);
    else if (typeFilter === "CV-Epost") list = list.filter((c) => c.cvEmail === true);
    else if (typeFilter === "Ikke relevant kontakt") list = list.filter((c) => c.ikkeAktuell);
    return list;
  }, [contacts, search, ownerFilter, signalFilter, typeFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const d = sort.dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sort.field) {
        case "name":
          return d * `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "nb");
        case "signal": {
          const leftRank = a.signal ? SIGNAL_ORDER[a.signal as Signal] : SIGNALS.length + 1;
          const rightRank = b.signal ? SIGNAL_ORDER[b.signal as Signal] : SIGNALS.length + 1;
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
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sort]);

  const setSignalMutation = useMutation({
    mutationFn: async ({
      contactId,
      companyId,
      label,
    }: {
      contactId: string;
      companyId: string | null;
      label: Signal;
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
    onSuccess: async (_, variables) => {
      await Promise.all([
        invalidateDesignLabQueries(),
        queryClient.invalidateQueries({ queryKey: crmQueryKeys.contacts.detail(variables.contactId) }),
        queryClient.invalidateQueries({ queryKey: crmQueryKeys.contacts.tasks(variables.contactId) }),
        queryClient.invalidateQueries({ queryKey: crmQueryKeys.generic.tasks() }),
        invalidateQueryGroup(queryClient, crmSummaryQueryKeys),
      ]);
      toast.success("Signal oppdatert");
    },
    onError: () => {
      toast.error("Kunne ikke oppdatere signal");
    },
  });

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
  }, [sorted, selectedId]);

  /* ═══ RENDER ═══ */
  return (
    <div
      className="flex h-screen overflow-hidden select-none"
      style={{
        fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
        background: C.bg,
        zoom: SCALE_MAP[textSize],
      }}
    >
      <DesignLabSidebar navigate={navigate} signOut={signOut} user={user} activePath="/design-lab/kontakter" />

      {/* ═══ MAIN ═══ */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: C.appBg }}>
        {/* Header bar */}
        <header
          className="flex items-center justify-between px-6 shrink-0"
          style={{ height: 40, borderBottom: `1px solid ${C.border}` }}
        >
          <div className="flex items-baseline gap-2.5">
            <h1 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Kontakter</h1>
            <span style={{ fontSize: 13, color: C.textGhost, fontWeight: 500 }}>{filtered.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <TextSizeControl value={textSize} onChange={setTextSize} />
            <div className="relative" style={{ width: 220 }}>
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2"
                style={{ width: 14, height: 14, color: C.textGhost }}
              />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Søk kontakter…"
                className="w-full outline-none placeholder:text-[#a2a5ab]"
                style={{
                  height: 30,
                  paddingLeft: 30,
                  paddingRight: 9,
                  borderRadius: 5,
                  border: `1px solid ${C.border}`,
                  background: C.surfaceAlt,
                  color: C.text,
                  fontSize: 13,
                }}
              />
            </div>
            <button
              className="inline-flex items-center gap-1.5 rounded-md transition-opacity hover:opacity-90"
              style={{
                height: 30,
                paddingInline: 11,
                fontSize: 13,
                fontWeight: 500,
                background: C.accent,
                color: "#fff",
                borderRadius: 5,
              }}
            >
              + Ny kontakt
            </button>
          </div>
        </header>

        {/* Filters bar */}
        <div className="shrink-0 space-y-0" style={{ borderBottom: `1px solid ${C.border}`, padding: "8px 24px 10px" }}>
          <FilterRow label="EIER" options={OWNERS} value={ownerFilter} onChange={setOwnerFilter} />
          <div className="flex items-center justify-between">
            <FilterRow label="SIGNAL" options={["Alle", ...SIGNALS]} value={signalFilter} onChange={setSignalFilter} />
            <span style={{ fontSize: 12, color: C.textFaint, fontWeight: 500, whiteSpace: "nowrap", paddingLeft: 12 }}>
              {filtered.length} kontakter
            </span>
          </div>
          <div className="flex items-center justify-between">
            <FilterRow
              label="TYPE"
              options={[...TYPES]}
              value={typeFilter}
              onChange={(v) => setTypeFilter(v as TypeFilter)}
            />
            {(ownerFilter !== "Alle" || signalFilter !== "Alle" || typeFilter !== "Alle") && (
              <button
                onClick={() => {
                  setOwnerFilter("Alle");
                  setSignalFilter("Alle");
                  setTypeFilter("Alle");
                }}
                className="inline-flex items-center gap-1 rounded transition-colors shrink-0"
                style={{ fontSize: 12, color: C.textFaint, padding: "2px 6px" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = C.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = C.textFaint;
                }}
              >
                <X style={{ width: 12, height: 12 }} /> Nullstill
              </button>
            )}
          </div>
        </div>

        {/* Available consultants bar */}
        {sortedConsultants.length > 0 && (
          <div className="shrink-0" style={{ borderBottom: `1px solid ${C.border}`, padding: "8px 24px 10px" }}>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: C.textGhost, marginBottom: 6 }}>
              Tilgjengelig for oppdrag
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {sortedConsultants.map((con) => {
                const meta = getConsultantAvailabilityMeta(con.tilgjengelig_fra);
                const nameParts = con.navn.split(" ");
                const initials = (nameParts[0]?.[0] || "") + (nameParts[nameParts.length - 1]?.[0] || "");
                const toneColor = meta.tone === "ready" ? C.dotSuccess : meta.tone === "soon" ? C.warning : C.textFaint;
                return (
                  <div
                    key={con.id ?? con.navn}
                    className="flex items-center gap-2.5 shrink-0 rounded-lg"
                    style={{ border: `1px solid ${C.border}`, padding: "8px 14px", background: C.panel }}
                  >
                    <div
                      className="flex items-center justify-center rounded-full shrink-0"
                      style={{
                        width: 36,
                        height: 36,
                        background: "rgba(0,0,0,0.06)",
                        fontSize: 12,
                        fontWeight: 600,
                        color: C.text,
                      }}
                    >
                      {initials.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate" style={{ fontSize: 13, fontWeight: 500, color: C.text, maxWidth: 140 }}>
                        {con.navn}
                      </p>
                      <p style={{ fontSize: 12, color: toneColor, fontWeight: 500 }}>{meta.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Content: list + detail */}
        <div className="flex-1 min-h-0 flex">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={35} minSize={20} maxSize={60}>
              <div className="h-full overflow-y-auto" style={{ scrollbarColor: `${C.borderStrong} ${C.surfaceAlt}` }}>
                <div
                  className="grid items-center sticky top-0 z-10"
                  style={{
                    gridTemplateColumns: "minmax(160px,2fr) 132px 52px minmax(120px,1.5fr) minmax(100px,1fr) 132px 80px",
                    height: 32,
                    borderBottom: `1px solid ${C.border}`,
                    background: C.surfaceAlt,
                    paddingLeft: 16,
                    paddingRight: 16,
                  }}
                >
                  <ColHeader label="Navn" field="name" sort={sort} onSort={toggleSort} />
                  <ColHeader label="Signal" field="signal" sort={sort} onSort={toggleSort} />
                  <span style={{ fontSize: 11, fontWeight: 500, color: C.textFaint }}>Finn</span>
                  <ColHeader label="Selskap" field="company" sort={sort} onSort={toggleSort} />
                  <ColHeader label="Stilling" field="title" sort={sort} onSort={toggleSort} />
                  <ColHeader label="Tags" field="priority" sort={sort} onSort={toggleSort} />
                  <ColHeader label="Siste akt." field="last_activity" sort={sort} onSort={toggleSort} className="justify-end" />
                </div>
                {isLoading || isLoadingParity ? (
                  <div style={{ textAlign: "center", padding: "48px 0", color: C.textFaint, fontSize: 13 }}>
                    Laster kontakter…
                  </div>
                ) : sorted.length === 0 ? (
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
                          gridTemplateColumns: "minmax(160px,2fr) 132px 52px minmax(120px,1.5fr) minmax(100px,1fr) 132px 80px",
                          minHeight: 38,
                          paddingLeft: 16,
                          paddingRight: 16,
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
                        {/* Navn */}
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

                        {/* Signal */}
                        <div className="flex items-center gap-1.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                onClick={(event) => event.stopPropagation()}
                                className="inline-flex items-center"
                              >
                                {c.signal ? (
                                  <SignalChip signal={c.signal as Signal} />
                                ) : (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 500,
                                      padding: "2px 8px",
                                      borderRadius: 999,
                                      border: `1px dashed ${C.borderStrong}`,
                                      color: C.textFaint,
                                    }}
                                  >
                                    + Signal
                                  </span>
                                )}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              {SIGNALS.map((signalOption) => (
                                <DropdownMenuItem
                                  key={signalOption}
                                  onClick={() =>
                                    setSignalMutation.mutate({
                                      contactId: c.id,
                                      companyId: c.companyId,
                                      label: signalOption,
                                    })
                                  }
                                >
                                  <SignalChip signal={signalOption} />
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Finn */}
                        <div
                          className="flex items-center justify-center"
                          title={
                            c.hasMarkedsradar
                              ? "Selskapet har annonsert etter embedded på Finn.no siste 90 dager"
                              : ""
                          }
                        >
                          {c.hasMarkedsradar && (
                            <Wifi style={{ width: 14, height: 14, color: C.info }} />
                          )}
                        </div>

                        {/* Selskap */}
                        <div className="min-w-0">
                          <span className="truncate block" style={{ fontSize: 12, color: C.textMuted }}>{c.company}</span>
                        </div>

                        {/* Stilling */}
                        <span className="truncate" style={{ fontSize: 12, color: C.textMuted }}>{c.title}</span>

                        {/* Heat / Tags */}
                        <div className="flex items-center gap-1.5 min-w-0" onClick={(event) => event.stopPropagation()}>
                          <button
                            type="button"
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
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              padding: "1px 6px",
                              borderRadius: 3,
                              background:
                                c.cvEmail && (c.mailchimpStatus === "unsubscribed" || c.mailchimpStatus === "cleaned")
                                  ? C.dangerBg
                                  : c.cvEmail
                                    ? C.toggleCv.activeBg
                                    : C.toggleInactive.bg,
                              color:
                                c.cvEmail && (c.mailchimpStatus === "unsubscribed" || c.mailchimpStatus === "cleaned")
                                  ? C.danger
                                  : c.cvEmail
                                    ? C.toggleCv.activeText
                                    : C.toggleInactive.text,
                              border:
                                c.cvEmail && (c.mailchimpStatus === "unsubscribed" || c.mailchimpStatus === "cleaned")
                                  ? `1px solid ${C.danger}`
                                  : c.cvEmail
                                    ? "none"
                                    : `1px solid ${C.toggleInactive.border}`,
                            }}
                          >
                            {c.cvEmail && (c.mailchimpStatus === "unsubscribed" || c.mailchimpStatus === "cleaned")
                              ? "CV ✗"
                              : "CV"}
                          </button>
                          <button
                            type="button"
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
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              padding: "1px 6px",
                              borderRadius: 3,
                              background: c.callList ? C.toggleBuyer.activeBg : C.toggleInactive.bg,
                              color: c.callList ? C.toggleBuyer.activeText : C.toggleInactive.text,
                              border: c.callList ? "none" : `1px solid ${C.toggleInactive.border}`,
                            }}
                          >
                            Innkjøper
                          </button>
                        </div>

                        {/* Siste akt. */}
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
              </div>
            </ResizablePanel>
            <ResizableHandle
              withHandle
              className="bg-transparent hover:bg-[rgba(0,0,0,0.04)] transition-colors data-[resize-handle-active]:bg-[rgba(94,106,210,0.12)]"
            />
            <ResizablePanel defaultSize={65} minSize={30}>
              {sel ? (
                <div
                  className="h-full flex flex-col"
                  style={{ background: C.panel, borderLeft: `1px solid ${C.borderLight}` }}
                >
                  <div
                    className="shrink-0 flex items-center justify-end px-4"
                    style={{ height: 32, borderBottom: `1px solid ${C.border}` }}
                  >
                    <button
                      onClick={() => setSelectedId(null)}
                      className="rounded p-1 hover:bg-black/5 transition-colors"
                      style={{ color: C.textFaint }}
                    >
                      <X style={{ width: 16, height: 16 }} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 py-5 dl-v8-theme">
                    <ContactCardContent
                      contactId={sel.id}
                      editable
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

      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
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
        onSelectContact={(id) => setSelectedId(id)}
        onFilterByCompany={(name) => setSearch(name)}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SIGNAL CHIP (V8 color-coded)
   ═══════════════════════════════════════════════════════════ */

function SignalChip({ signal, size = "sm" }: { signal: Signal; size?: "sm" | "md" }) {
  const shortLabels: Record<Signal, string> = {
    "Behov nå": "Behov nå",
    "Får fremtidig behov": "Fremtidig",
    "Får kanskje behov": "Kanskje",
    "Ukjent om behov": "Ukjent",
    "Ikke aktuelt": "Ikke aktuelt",
  };
  const modifier = signal === "Ikke aktuelt" ? " is-muted" : " is-signal";
  return <span className={`chip chip--action${modifier}`}>{size === "sm" ? shortLabels[signal] : signal}</span>;
}

/* ═══════════════════════════════════════════════════════════
   CONTACT INDICATORS (Innkjøper / CV dots)
   ═══════════════════════════════════════════════════════════ */

function ContactIndicators({ callList, cvEmail }: { callList: boolean; cvEmail: boolean }) {
  if (!callList && !cvEmail) return null;
  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      {callList && (
        <span
          title="Innkjøper"
          className="rounded-full inline-block"
          style={{ width: 6, height: 6, background: C.toggleBuyer.activeText }}
        />
      )}
      {cvEmail && (
        <span
          title="CV-epost"
          className="rounded-full inline-block"
          style={{ width: 6, height: 6, background: C.toggleCv.activeText }}
        />
      )}
    </span>
  );
}



function IconBtn({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center rounded transition-colors"
      style={{ width: 28, height: 28, color: C.textFaint }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = C.hoverBg;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {icon}
    </button>
  );
}

const TYPE_TOGGLE_MAP: Record<string, { activeBg: string; activeText: string }> = {
  "CV-Epost":              C.toggleCv,
  "Innkjøper":             C.toggleBuyer,
  "Ikke relevant kontakt": C.toggleIrrelevant,
};

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-[3px]">
      <span
        style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: C.textMuted, width: 56, flexShrink: 0 }}
      >
        {label}
      </span>
      <div className="flex items-center gap-1 flex-wrap">
        {options.map((opt) => {
          const active = value === opt;
          const toggle = label === "TYPE" ? TYPE_TOGGLE_MAP[opt] : undefined;

          // Active style: use toggle color if available, otherwise default accent
          const activeBg = toggle ? toggle.activeBg : C.accent;
          const activeColor = toggle ? toggle.activeText : "#fff";
          const inactiveBorder = `1px solid ${C.toggleInactive.border}`;

          return (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className="inline-flex items-center transition-colors"
              style={{
                height: 24,
                paddingInline: 10,
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 3,
                border: active ? (toggle ? `1px solid transparent` : "none") : inactiveBorder,
                background: active ? activeBg : C.toggleInactive.bg,
                color: active ? activeColor : C.toggleInactive.text,
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = C.hoverBg;
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = active ? activeBg : C.toggleInactive.bg;
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ColHeader({
  label,
  field,
  sort,
  onSort,
  className,
}: {
  label: string;
  field: SortField;
  sort: { field: SortField; dir: SortDir };
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const active = sort.field === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={`flex items-center gap-0.5 transition-colors ${className || ""}`}
      style={{
        fontSize: 11,
        fontWeight: active ? 600 : 500,
        letterSpacing: "0.01em",
        color: active ? C.text : C.textMuted,
      }}
    >
      {label}
      {active &&
        (sort.dir === "asc" ? (
          <ChevronUp style={{ width: 12, height: 12 }} />
        ) : (
          <ChevronDown style={{ width: 12, height: 12 }} />
        ))}
    </button>
  );
}
