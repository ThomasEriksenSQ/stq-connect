import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { differenceInDays } from "date-fns";
import { CONTACT_CV_EMAIL_REQUIRED_MESSAGE, contactHasEmail } from "@/lib/contactCvEligibility";
import { crmQueryKeys, crmSummaryQueryKeys, invalidateQueryGroup } from "@/lib/queryKeys";
import { mergeTechnologyTags } from "@/lib/technologyTags";
import {
  getConsultantAvailabilityMeta,
  hasConsultantAvailability,
  isActiveRequest,
  sortHuntConsultants,
} from "@/lib/contactHunt";
import {
  getEffectiveSignal,
  upsertTaskSignalDescription,
} from "@/lib/categoryUtils";
import {
  TEMP_CONFIG,
  getHeatResult,
  getTaskStatus,
  getActivityStatus,
} from "@/lib/heatScore";
import {
  buildMatchLeadOwnerCandidate,
  resolveMatchLeadOwner,
} from "@/lib/matchLeadOwners";
import type {
  ContactRow,
  CompanyPreview,
  CompanyTechLeadRow,
  RequestLeadRow,
  HuntConsultant,
  OwnerPreview,
} from "@/components/contacts/types";

export function useContactsData() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const pendingToggles = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const { data: contactsResult, isLoading } = useQuery({
    queryKey: crmQueryKeys.contacts.all(),
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("contacts")
        .select(
          "*, companies(id, name, status, ikke_relevant, owner_id, profiles!companies_owner_id_fkey(id, full_name)), profiles!contacts_owner_id_fkey(id, full_name)",
          { count: "exact" },
        )
        .order("first_name")
        .limit(2000);
      if (error) throw error;

      const contactIds = new Set(data.map((c) => c.id));

      const [{ data: acts }, { data: tasks }, { data: companyTechProfiles }, { data: requestRows }] = await Promise.all([
        supabase.from("activities").select("contact_id, created_at, description, subject").not("contact_id", "is", null).order("created_at", { ascending: false }).limit(5000),
        supabase.from("tasks").select("contact_id, created_at, updated_at, due_date, status, description, title").not("contact_id", "is", null).limit(5000),
        supabase.from("company_tech_profile").select("company_id, sist_fra_finn, teknologier, companies!company_tech_profile_company_id_fkey(id, name, status, ikke_relevant, owner_id, profiles!companies_owner_id_fkey(id, full_name))").not("company_id", "is", null).limit(5000),
        supabase.from("foresporsler").select("id, selskap_id, kontakt_id, selskap_navn, sted, mottatt_dato, frist_dato, status, teknologier, companies!foresporsler_selskap_id_fkey(id, name, status, ikke_relevant, owner_id, profiles!companies_owner_id_fkey(id, full_name)), contacts!foresporsler_kontakt_id_fkey(id, first_name, last_name, title)").order("mottatt_dato", { ascending: false }).limit(5000),
      ]);

      const lastActMap: Record<string, string> = {};
      const now = new Date().toISOString();
      (acts || []).forEach((a) => {
        if (a.contact_id && a.created_at <= now && !lastActMap[a.contact_id]) lastActMap[a.contact_id] = a.created_at;
      });

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
          (contactActsMap[cid] || []).map((a) => ({ created_at: a.created_at, subject: a.subject!, description: a.description })),
          (contactTasksMap[cid] || []).map((t) => ({ created_at: t.created_at, updated_at: t.updated_at, title: t.title!, description: t.description, due_date: t.due_date, status: t.status })),
        );
        if (sig) signalMap[cid] = sig;
      }

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
            Array.isArray(profile?.teknologier) ? profile.teknologier
              : profile?.teknologier && typeof profile.teknologier === "object" ? Object.keys(profile.teknologier as Record<string, number>)
              : [],
          ),
        }));
      normalizedCompanyTechProfiles.forEach((profile) => techProfileByCompanyId.set(profile.companyId, profile));

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
        contactName: request.contacts ? `${request.contacts.first_name || ""} ${request.contacts.last_name || ""}`.trim() || null : null,
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
        const hasMarkedsradar = !!(techProfile?.sistFraFinn && differenceInDays(new Date(), new Date(techProfile.sistFraFinn)) <= 90);
        const daysSince = lastActivity ? differenceInDays(new Date(), new Date(lastActivity)) : 999;
        const companyTechnologyTags = techProfile?.companyTechnologyTags || [];
        const contactTechnologyTags = mergeTechnologyTags(c.teknologier || []);
        const companyRequests = requestMap.get(c.company_id || "") || [];
        const activeRequests = companyRequests.filter((r) => isActiveRequest(r.mottattDato, r.status));
        const hasAktivForespørsel = activeRequests.length > 0;
        const hasTidligereForespørsel = companyRequests.length > 0 && companyRequests.some((r) => !isActiveRequest(r.mottattDato, r.status));
        const requestTechnologyTags = mergeTechnologyTags(...activeRequests.map((r) => r.technologyTags));

        const contactActs = contactActsMap[c.id] || [];
        const signalAct = contactActs.find((a: any) => {
          const cat = a.subject || "";
          return ["Behov nå", "Får fremtidig behov", "Får kanskje behov", "Ukjent om behov", "Ikke aktuelt"].includes(cat);
        });
        const signalSetAt = signalAct ? new Date(signalAct.created_at) : null;
        const lastActDate = lastActivity ? new Date(lastActivity) : null;
        const kes = !!(signalSetAt && lastActDate && lastActDate > signalSetAt);

        const contactTaskList = (contactTasksMap[c.id] || []).map((t: any) => ({ due_date: t.due_date, status: t.status }));
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
        .select("id, navn, status, tilgjengelig_fra, kompetanse")
        .in("status", ["AKTIV/SIGNERT", "Ledig"])
        .not("tilgjengelig_fra", "is", null);
      if (error) throw error;
      return sortHuntConsultants(((data || []) as HuntConsultant[]).filter((c) => hasConsultantAvailability(c.tilgjengelig_fra)));
    },
  });

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
      const { error } = await supabase.from("contacts").update({ [field]: newValue } as any).eq("id", contact.id);
      if (error) {
        toast.error("Kunne ikke oppdatere");
        queryClient.setQueryData(crmQueryKeys.contacts.all(), (old: any) => ({
          ...old,
          rows: old?.rows?.map((c: any) => (c.id === contact.id ? { ...c, [field]: !newValue } : c)),
        }));
      } else if (field === "cv_email") {
        supabase.functions.invoke("mailchimp-sync", { body: { action: "sync-contact", contactId: contact.id } }).then(({ data, error: mcErr }) => {
          if (mcErr) { console.error("Mailchimp sync feilet:", mcErr); toast.error("Mailchimp-synk feilet"); }
          else toast.success(`Mailchimp: ${data?.status || "synkronisert"}`);
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
    mutationFn: async ({ contactId, companyId, label }: { contactId: string; companyId: string | null; label: string }) => {
      const { data: existingTasks, error: taskLookupError } = await supabase
        .from("tasks").select("id, description, due_date").eq("contact_id", contactId).neq("status", "done").order("due_date", { ascending: true, nullsFirst: false }).limit(1);
      if (taskLookupError) throw taskLookupError;
      const primaryTask = existingTasks?.[0];
      if (primaryTask) {
        const { error } = await supabase.from("tasks").update({
          description: upsertTaskSignalDescription(primaryTask.description, label, !primaryTask.due_date),
          updated_at: new Date().toISOString(),
        }).eq("id", primaryTask.id);
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

  const contacts = contactsResult?.rows ?? [];
  const companyTechProfiles = contactsResult?.companyTechProfiles ?? [];
  const requests = contactsResult?.requests ?? [];
  const totalCount = contactsResult?.totalCount ?? 0;
  const capped = contactsResult?.capped ?? false;

  const getOwnerId = (contact: any) => (contact.profiles as any)?.id || null;
  const getOwnerName = (contact: any) => (contact.profiles as any)?.full_name || null;

  const ownerMap = new Map<string, string>();
  contacts.forEach((c) => {
    const id = getOwnerId(c);
    const name = getOwnerName(c);
    if (id && name) ownerMap.set(id, name);
  });
  const uniqueOwners = Array.from(ownerMap.entries()).sort((a, b) => a[1].localeCompare(b[1], "nb"));

  return {
    contacts,
    companyTechProfiles,
    requests,
    totalCount,
    capped,
    isLoading,
    huntConsultants,
    huntConsultantsLoading,
    handleToggle,
    setSignalMutation,
    uniqueOwners,
    getOwnerId,
    getOwnerName,
  };
}
