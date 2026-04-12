import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { crmQueryKeys, crmSummaryQueryKeys, invalidateQueryGroup } from "@/lib/queryKeys";
import { differenceInDays, isPast, isToday, format, addWeeks, addMonths } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getEffectiveSignal, upsertTaskSignalDescription } from "@/lib/categoryUtils";
import { CONTACT_CV_EMAIL_REQUIRED_MESSAGE, contactHasEmail } from "@/lib/contactCvEligibility";
import { getHeatResult, TEMP_CONFIG } from "@/lib/heatScore";
import { Flame, ChevronLeft, ChevronRight, Radio, Loader2, MapPin, ChevronDown, X, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ContactCardContent } from "@/components/ContactCardContent";
import { toast } from "sonner";

const DATE_CHIPS = [
  { label: "1 uke", fn: () => addWeeks(new Date(), 1) },
  { label: "2 uker", fn: () => addWeeks(new Date(), 2) },
  { label: "1 måned", fn: () => addMonths(new Date(), 1) },
  { label: "3 måneder", fn: () => addMonths(new Date(), 3) },
];

const SIGNAL_CATEGORIES = [
  { label: "Behov nå", badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { label: "Får fremtidig behov", badgeColor: "bg-blue-100 text-blue-800 border-blue-200" },
  { label: "Får kanskje behov", badgeColor: "bg-amber-100 text-amber-800 border-amber-200" },
  { label: "Ukjent om behov", badgeColor: "bg-gray-100 text-gray-600 border-gray-200" },
  { label: "Ikke aktuelt", badgeColor: "bg-red-50 text-red-700 border-red-200" },
];

interface ScoredLead {
  contact: any;
  signal: string;
  score: number;
  temperature: "hett" | "lovende" | "mulig" | "sovende";
  tier: 1 | 2 | 3 | 4;
  reasons: string[];
  needsReview: boolean;
  lastAct: any;
  nextTask: any;
  hasOverdue: boolean;
  hasMarkedsradar: boolean;
  isInnkjoper: boolean;
  hasAktivForespørsel: boolean;
  hasTidligereForespørsel: boolean;
}

function buildReasonLine(lead: ScoredLead, daysSince: number): string {
  const parts: string[] = [];
  if (lead.signal === "Behov nå" && lead.hasMarkedsradar) {
    parts.push("Annonserer aktivt på Finn.no med behov nå");
  } else if (lead.signal === "Behov nå") {
    parts.push("Aktivt behov nå");
  } else if (lead.signal === "Får fremtidig behov" && lead.hasMarkedsradar) {
    parts.push("Annonserer på Finn.no — fremtidig behov");
  } else if (lead.signal === "Får fremtidig behov") {
    parts.push("Fremtidig behov signalisert");
  } else if (lead.signal === "Får kanskje behov") {
    parts.push("Mulig fremtidig behov");
  } else if (lead.hasMarkedsradar) {
    parts.push("Annonserer på Finn.no");
  }
  if (lead.isInnkjoper) parts.push("innkjøper");
  if (lead.hasAktivForespørsel) parts.push("aktiv forespørsel");
  else if (lead.hasTidligereForespørsel) parts.push("tidligere forespørsel");
  if (lead.hasOverdue) {
    parts.push("forfalt oppfølging");
  } else if (daysSince === 999) {
    parts.push("aldri kontaktet");
  } else if (daysSince > 180) {
    parts.push(`ikke kontaktet på ${daysSince} dager`);
  } else if (daysSince > 90) {
    parts.push(`${daysSince} dager siden sist`);
  }
  if (parts.length === 0) return "";
  const joined = parts.join(" · ");
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

const COOLDOWN_DAYS: Record<number, number> = { 1: 14, 2: 45, 3: 60, 4: 90 };

function readTreatedFromStorage(key: string) {
  if (typeof window === "undefined") return new Set<string>();

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set<string>();

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();

    return new Set(parsed.filter((value): value is string => typeof value === "string"));
  } catch {
    return new Set<string>();
  }
}

function writeTreatedToStorage(key: string, treated: Set<string>) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(treated)));
  } catch {
    // Ignore storage errors and fall back to in-memory state
  }
}

function buildSignalSnapshot(lead: ScoredLead, signalOverride?: string) {
  return {
    signal: signalOverride || lead.signal || null,
    hasMarkedsradar: lead.hasMarkedsradar,
    hasAktivForespørsel: lead.hasAktivForespørsel,
    hasOverdue: lead.hasOverdue,
    tier: lead.tier,
  };
}

/* ── Main Component ── */
const DailyBrief = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"kort" | "liste">("kort");
  const [ownerFilter, setOwnerFilter] = useState(user?.id || "alle");
  const [currentContactId, setCurrentContactId] = useState<string | null>(null);
  const [completedAll, setCompletedAll] = useState(false);
  const [treated, setTreated] = useState<Set<string>>(new Set());
  const [activeForm, setActiveForm] = useState<"snooze" | "signal" | null>(null);
  const [reminderDismissed, setReminderDismissed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [localSignals, setLocalSignals] = useState<Record<string, string>>({});
  const [localIkkeAktuell, setLocalIkkeAktuell] = useState<Record<string, boolean>>({});
  const [selectedChipDate, setSelectedChipDate] = useState<Record<string, string | null>>({});
  const [customChipDate, setCustomChipDate] = useState<Record<string, string>>({});
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const [nudgeScenario, setNudgeScenario] = useState<
    "ingen_signal_ingen_task" | "ingen_signal_med_task" | "signal_ingen_task" | "forfalt" | null
  >(null);
  const [nudgeSignal, setNudgeSignal] = useState("");
  const [nudgeRequiresSignalChoice, setNudgeRequiresSignalChoice] = useState(false);
  const [nudgeDate, setNudgeDate] = useState("someday");
  const [nudgeCustomDate, setNudgeCustomDate] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);
  const dragStartXRef = useRef<number | null>(null);
  const dragDeltaXRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [futureHistory, setFutureHistory] = useState<string[]>([]);
  const historyRef = useRef<string[]>([]);
  const futureHistoryRef = useRef<string[]>([]);
  const scoredLeadsRef = useRef<ScoredLead[]>([]);
  const treatedRef = useRef<Set<string>>(new Set());
  const currentRef = useRef<ScoredLead | null>(null);
  const skipNextPersistRef = useRef(true);
  const todayKey = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const treatedStorageKey = useMemo(
    () => `daily-brief-treated:${user?.id || "anonymous"}:${ownerFilter}:${todayKey}`,
    [ownerFilter, todayKey, user?.id],
  );

  const { data: allProfiles = [] } = useQuery({
    queryKey: crmQueryKeys.profiles.all(),
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: salgsData, isLoading } = useQuery({
    queryKey: crmQueryKeys.dailyBrief.all(ownerFilter),
    queryFn: async () => {
      let q = supabase
        .from("contacts")
        .select("*, companies(id, name, city)")
        .or("ikke_aktuell_kontakt.is.null,ikke_aktuell_kontakt.eq.false");
      if (ownerFilter && ownerFilter !== "alle") q = q.eq("owner_id", ownerFilter);
      const { data: contacts, error } = await q.limit(2000);
      if (error) throw error;

      const contactIds = contacts.map((c: any) => c.id);
      const companyIds = [...new Set(contacts.map((c: any) => c.company_id).filter(Boolean))];

      const [{ data: activities }, { data: tasks }, { data: techProfiles }, { data: foresporsler }] = await Promise.all(
        [
          supabase
            .from("activities")
            .select("contact_id, created_at, subject, description, type")
            .not("contact_id", "is", null)
            .order("created_at", { ascending: false })
            .limit(10000),
          supabase
            .from("tasks")
            .select("id, contact_id, created_at, updated_at, due_date, status, description, title")
            .not("contact_id", "is", null)
            .neq("status", "done")
            .order("due_date", { ascending: true, nullsFirst: false })
            .limit(5000),
          companyIds.length > 0
            ? supabase
                .from("company_tech_profile")
                .select("company_id, konsulent_hyppighet, sist_fra_finn, teknologier")
                .in("company_id", companyIds)
            : Promise.resolve({ data: [] }),
          supabase
            .from("foresporsler")
            .select("id, selskap_id, status, mottatt_dato")
            .not("status", "in", '("avsluttet","tapt")'),
        ],
      );

      return {
        rawContacts: contacts,
        allActivities: activities || [],
        allTasks: tasks || [],
        techProfiles: techProfiles || [],
        foresporsler: foresporsler || [],
      };
    },
  });

  const rawContacts = salgsData?.rawContacts ?? [];
  const allActivities = salgsData?.allActivities ?? [];
  const allTasks = salgsData?.allTasks ?? [];
  const techProfiles = salgsData?.techProfiles ?? [];
  const foresporsler = salgsData?.foresporsler ?? [];

  const scoredLeads = useMemo(() => {
    return rawContacts
      .map((contact: any) => {
        const contactActs = allActivities.filter((a: any) => a.contact_id === contact.id);
        const contactTasks = allTasks.filter((t: any) => t.contact_id === contact.id);

        const signal = getEffectiveSignal(
          contactActs.map((a: any) => ({ created_at: a.created_at, subject: a.subject, description: a.description })),
          contactTasks.map((t: any) => ({
            created_at: t.created_at,
            title: t.title,
            description: t.description,
            due_date: t.due_date,
          })),
        );

        if (signal === "Ikke aktuelt") return null;
        const lastAct = contactActs[0];
        const daysSince = lastAct ? differenceInDays(new Date(), new Date(lastAct.created_at)) : 999;
        const nextTask = contactTasks.find((t: any) => t.due_date) ?? contactTasks[0] ?? null;
        const hasOverdue = nextTask?.due_date
          ? isPast(new Date(nextTask.due_date)) && !isToday(new Date(nextTask.due_date))
          : false;
        const techProfile = techProfiles.find((tp: any) => tp.company_id === contact.company_id);
        const hasMarkedsradar = !!(
          techProfile?.sist_fra_finn && differenceInDays(new Date(), new Date(techProfile.sist_fra_finn)) <= 90
        );
        const hasAktivForespørsel = foresporsler.some(
          (f: any) =>
            f.selskap_id === contact.company_id &&
            f.mottatt_dato &&
            differenceInDays(new Date(), new Date(f.mottatt_dato)) <= 45,
        );
        const hasTidligereForespørsel = foresporsler.some(
          (f: any) =>
            f.selskap_id === contact.company_id &&
            (!f.mottatt_dato || differenceInDays(new Date(), new Date(f.mottatt_dato)) > 45),
        );
        const isInnkjoper = !!contact.call_list;
        const heatResult = getHeatResult({
          signal,
          isInnkjoper,
          hasMarkedsradar,
          hasAktivForespørsel,
          hasOverdue,
          daysSinceLastContact: daysSince,
          hasTidligereForespørsel,
          ikkeAktuellKontakt: !!(contact as any).ikke_aktuell_kontakt,
        });
        return {
          contact,
          signal,
          score: heatResult.score,
          temperature: heatResult.temperature,
          tier: heatResult.tier,
          reasons: heatResult.reasons,
          needsReview: heatResult.needsReview,
          lastAct,
          nextTask,
          hasOverdue,
          hasMarkedsradar,
          isInnkjoper,
          hasAktivForespørsel,
          hasTidligereForespørsel,
        };
      })
      .filter((lead): lead is ScoredLead => {
        if (!lead) return false;
        const daysSince = lead.lastAct ? differenceInDays(new Date(), new Date(lead.lastAct.created_at)) : 999;
        const meetsMin = !!(
          lead.signal ||
          lead.nextTask ||
          lead.isInnkjoper ||
          lead.hasMarkedsradar ||
          (daysSince !== 999 && daysSince <= 730)
        );
        if (!meetsMin) return false;
        return true;
      })
      .sort((a, b) => {
        const ta = a.tier,
          tb = b.tier;
        if (ta !== tb) return ta - tb;
        const ra = a.contact.next_review_at ?? "1970-01-01T00:00:00Z";
        const rb = b.contact.next_review_at ?? "1970-01-01T00:00:00Z";
        if (ra !== rb) return ra.localeCompare(rb);
        return b.score - a.score;
      }) as ScoredLead[];
  }, [rawContacts, allActivities, allTasks, techProfiles, foresporsler]);

  const eligibleScoredLeads = useMemo(() => {
    const now = new Date();
    return scoredLeads.filter((lead) => {
      const nextReviewAt = lead.contact.next_review_at ? new Date(lead.contact.next_review_at) : null;
      return !(nextReviewAt && nextReviewAt > now);
    });
  }, [scoredLeads]);

  const queue = useMemo(() => {
    return eligibleScoredLeads.filter((l) => !treated.has(l.contact.id));
  }, [eligibleScoredLeads, treated]);

  const current = useMemo(() => {
    if (completedAll) return null;
    if (currentContactId) {
      return scoredLeads.find((l) => l.contact.id === currentContactId) ?? queue[0] ?? null;
    }
    return queue[0] ?? null;
  }, [currentContactId, scoredLeads, queue, completedAll]);

  scoredLeadsRef.current = scoredLeads;
  treatedRef.current = treated;
  currentRef.current = current;
  futureHistoryRef.current = futureHistory;

  useEffect(() => {
    const storedTreated = readTreatedFromStorage(treatedStorageKey);
    skipNextPersistRef.current = true;
    setTreated(storedTreated);
    treatedRef.current = storedTreated;
    setCurrentContactId(null);
    setCompletedAll(false);
    historyRef.current = [];
    futureHistoryRef.current = [];
    setHistory([]);
    setFutureHistory([]);
  }, [treatedStorageKey]);

  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    writeTreatedToStorage(treatedStorageKey, treated);
  }, [treated, treatedStorageKey]);

  useEffect(() => {
    if (!isLoading && !completedAll && currentContactId === null) {
      const now = new Date();
      const firstInQueue = scoredLeadsRef.current.find((l) => {
        if (treatedRef.current.has(l.contact.id)) return false;
        const nextReviewAt = l.contact.next_review_at ? new Date(l.contact.next_review_at) : null;
        return !(nextReviewAt && nextReviewAt > now);
      });
      if (firstInQueue) {
        setCurrentContactId(firstInQueue.contact.id);
      }
    }
  }, [isLoading, completedAll, currentContactId]);

  const treatedCount = treated.size;

  const daysSinceLast = current?.lastAct ? differenceInDays(new Date(), new Date(current.lastAct.created_at)) : 999;
  const reasonLine = current ? buildReasonLine(current, daysSinceLast) : "";
  const currentSignal = current ? (localSignals[current.contact.id] ?? current.signal) : "";
  const nudgeTargetTask = current?.nextTask ?? null;
  const nudgeHarEksisterendeTask = !!nudgeTargetTask;

  const persistSignalToFollowUp = useCallback(
    async ({
      contactId,
      companyId,
      signal,
      task,
      dueDate,
      createIfMissing = false,
    }: {
      contactId: string;
      companyId: string | null;
      signal: string;
      task?: { id: string; description: string | null; due_date?: string | null } | null;
      dueDate?: string | null;
      createIfMissing?: boolean;
    }) => {
      const effectiveDueDate = dueDate === undefined ? (task?.due_date ?? null) : dueDate;

      if (task) {
        const { error } = await supabase
          .from("tasks")
          .update({
            description: upsertTaskSignalDescription(task.description, signal, !effectiveDueDate),
            ...(dueDate !== undefined ? { due_date: dueDate } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq("id", task.id);
        if (error) throw error;
      } else if (createIfMissing) {
        const { error } = await supabase.from("tasks").insert({
          title: "Følg opp om behov",
          description: upsertTaskSignalDescription(null, signal, !effectiveDueDate),
          priority: "medium",
          due_date: effectiveDueDate,
          contact_id: contactId,
          company_id: companyId,
          assigned_to: user?.id,
          created_by: user?.id,
        });
        if (error) throw error;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: crmQueryKeys.dailyBrief.all(ownerFilter) }),
        queryClient.invalidateQueries({ queryKey: crmQueryKeys.contacts.tasks(contactId) }),
        invalidateQueryGroup(queryClient, crmSummaryQueryKeys),
      ]);
    },
    [ownerFilter, queryClient, user?.id],
  );

  const goNext = useCallback(
    (dir: "left" | "right" = "left", markCurrent = false) => {
      if (isAnimating) return;
      setIsAnimating(true);
      setIsDragging(false);
      const currentLead = currentRef.current;
      const scoredSnapshot = scoredLeadsRef.current;
      const treatedSnapshot = treatedRef.current;
      const futureSnapshot = futureHistoryRef.current;
      const contactIdToMark = markCurrent && currentLead ? currentLead.contact.id : null;
      const card = cardRef.current;
      if (card) {
        const outX = dir === "left" ? -80 : 80;
        card.style.transition = "transform 240ms cubic-bezier(0.4, 0, 1, 1), opacity 220ms cubic-bezier(0.4, 0, 1, 1)";
        card.style.transform = `translateX(${outX}px) scale(0.94)`;
        card.style.opacity = "0";
      }
      setTimeout(() => {
        setActiveForm(null);
        setLocalIkkeAktuell({});
        setSelectedChipDate({});
        setCustomChipDate({});
        const newTreatedSet = new Set([...treatedSnapshot, ...(contactIdToMark ? [contactIdToMark] : [])]);
        if (contactIdToMark) {
          setTreated(newTreatedSet);
          treatedRef.current = newTreatedSet;
        }
        if (dir === "left") {
          if (currentLead) {
            const newHist = [...historyRef.current, currentLead.contact.id];
            historyRef.current = newHist;
            setHistory(newHist);
          }
          if (!markCurrent && futureSnapshot.length > 0) {
            const newFuture = [...futureSnapshot];
            const nextId = newFuture.pop() ?? null;
            futureHistoryRef.current = newFuture;
            setFutureHistory(newFuture);
            setCurrentContactId(nextId);
          } else {
            if (futureSnapshot.length > 0) {
              futureHistoryRef.current = [];
              setFutureHistory([]);
            }
            const now = new Date();
            const eligibleSnapshot = scoredSnapshot.filter((lead) => {
              const nextReviewAt = lead.contact.next_review_at ? new Date(lead.contact.next_review_at) : null;
              return !(nextReviewAt && nextReviewAt > now);
            });
            const currentIdx = eligibleSnapshot.findIndex((l) => l.contact.id === currentLead?.contact.id);
            const afterCurrent = currentIdx >= 0 ? eligibleSnapshot.slice(currentIdx + 1) : eligibleSnapshot;
            const next =
              afterCurrent.find((l) => !newTreatedSet.has(l.contact.id)) ||
              eligibleSnapshot.find((l) => !newTreatedSet.has(l.contact.id));
            if (next) {
              setCurrentContactId(next.contact.id);
            } else {
              setCompletedAll(true);
              setCurrentContactId(null);
            }
          }
        } else {
          const newHistory = [...historyRef.current];
          const prevId = newHistory.pop() ?? null;
          const newFuture = currentLead ? [...futureSnapshot, currentLead.contact.id] : [...futureSnapshot];
          historyRef.current = newHistory;
          futureHistoryRef.current = newFuture;
          setHistory(newHistory);
          setFutureHistory(newFuture);
          setCurrentContactId(prevId);
        }
        if (card) {
          const inX = dir === "left" ? 80 : -80;
          card.style.transition = "none";
          card.style.transform = `translateX(${inX}px) scale(0.94)`;
          card.style.opacity = "0";
        }
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (card) {
              card.style.transition =
                "transform 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 300ms cubic-bezier(0.22, 1, 0.36, 1)";
              card.style.transform = "translateX(0) scale(1)";
              card.style.opacity = "1";
            }
            setTimeout(() => setIsAnimating(false), 420);
          }),
        );
      }, 240);
    },
    [isAnimating],
  );

  const saveReview = useCallback(
    async (contactId: string, actionTaken: string, lead: ScoredLead, signalOverride?: string) => {
      const cooldownDays = COOLDOWN_DAYS[lead.tier] ?? 90;
      const nextReviewAt = new Date();
      nextReviewAt.setDate(nextReviewAt.getDate() + cooldownDays);

      queryClient.setQueryData(["salgssenter-all", ownerFilter], (old: any) => ({
        ...old,
        rawContacts: old?.rawContacts?.map((c: any) =>
          c.id === contactId ? { ...c, next_review_at: nextReviewAt.toISOString() } : c,
        ),
      }));

      await supabase
        .from("contacts")
        .update({
          next_review_at: nextReviewAt.toISOString(),
        })
        .eq("id", contactId);

      await supabase.from("agent_contact_reviews").insert({
        contact_id: contactId,
        reviewed_by: user?.id,
        action_taken: actionTaken,
        signals_at_review: buildSignalSnapshot(lead, signalOverride),
      });
    },
    [user?.id, queryClient, ownerFilter],
  );

  const filterOptions = useMemo(() => {
    const me = allProfiles.find((p) => p.id === user?.id);
    const others = allProfiles
      .filter((p) => p.id !== user?.id)
      .map((p) => ({
        id: p.id,
        label: p.full_name,
      }));
    return [{ id: "alle", label: "Alle" }, ...(me ? [{ id: me.id, label: me.full_name }] : []), ...others];
  }, [allProfiles, user?.id]);

  const progress = eligibleScoredLeads.length > 0 ? (treatedCount / eligibleScoredLeads.length) * 100 : 0;

  const handleNudgeOkNeste = useCallback(async () => {
    if (!current) return;
    if (nudgeRequiresSignalChoice && !nudgeSignal) return;
    if (nudgeDate === "custom" && !nudgeCustomDate) return;

    const nextSignal = nudgeSignal || currentSignal;
    const isSomeday = nudgeDate === "someday";
    const newDate = isSomeday ? null : nudgeDate === "custom" ? nudgeCustomDate : nudgeDate;

    try {
      await persistSignalToFollowUp({
        contactId: current.contact.id,
        companyId: current.contact.company_id,
        signal: nextSignal,
        task: nudgeTargetTask,
        dueDate: newDate,
        createIfMissing: !nudgeHarEksisterendeTask,
      });

      setLocalSignals((prev) => ({ ...prev, [current.contact.id]: nextSignal }));

      const actionTaken = nudgeHarEksisterendeTask
        ? nextSignal !== current.signal
          ? "signal_updated"
          : "task_updated"
        : "task_created";
      await saveReview(current.contact.id, actionTaken, current, nextSignal);

      setNudgeOpen(false);
      goNext("left", true);
    } catch (error) {
      console.error("Kunne ikke oppdatere oppfølging i agenten:", error);
      toast.error("Kunne ikke oppdatere oppfølging");
    }
  }, [
    current,
    nudgeDate,
    nudgeCustomDate,
    nudgeSignal,
    nudgeRequiresSignalChoice,
    nudgeHarEksisterendeTask,
    nudgeTargetTask,
    currentSignal,
    goNext,
    persistSignalToFollowUp,
    saveReview,
  ]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("button, input, a")) return;
      dragStartXRef.current = e.clientX;
      dragDeltaXRef.current = 0;
      setIsDragging(true);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (dragStartXRef.current === null) return;
      const delta = e.clientX - dragStartXRef.current;
      dragDeltaXRef.current = delta;
      const resistance = 0.4;
      card.style.transition = "none";
      card.style.transform = `translateX(${delta * resistance}px) scale(${1 - Math.abs(delta) * 0.0003})`;
      card.style.opacity = `${Math.max(0.6, 1 - Math.abs(delta) * 0.003)}`;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (dragStartXRef.current === null) return;
      const delta = dragDeltaXRef.current;
      dragStartXRef.current = null;
      dragDeltaXRef.current = 0;
      setIsDragging(false);
      const threshold = 80;
      if (delta < -threshold && !isAnimating) {
        goNext("left");
      } else if (delta > threshold && !isAnimating) {
        goNext("right");
      } else {
        card.style.transition = "transform 380ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease";
        card.style.transform = "translateX(0) scale(1)";
        card.style.opacity = "1";
      }
    };
    card.addEventListener("pointerdown", onPointerDown);
    card.addEventListener("pointermove", onPointerMove);
    card.addEventListener("pointerup", onPointerUp);
    card.addEventListener("pointercancel", onPointerUp);
    return () => {
      card.removeEventListener("pointerdown", onPointerDown);
      card.removeEventListener("pointermove", onPointerMove);
      card.removeEventListener("pointerup", onPointerUp);
      card.removeEventListener("pointercancel", onPointerUp);
    };
  }, [isAnimating, goNext]);

  const showReminder = useMemo(() => {
    if (reminderDismissed) return false;
    if (isLoading) return false;
    if (rawContacts.length === 0) return false;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const userContacts = rawContacts.filter((c: any) => c.owner_id === user?.id);
    if (userContacts.length === 0) return true;
    const hasRecentReview = userContacts.some(
      (c: any) => c.next_review_at && new Date(c.next_review_at) > sevenDaysAgo,
    );
    return !hasRecentReview;
  }, [rawContacts, user?.id, reminderDismissed, isLoading]);

  return (
    <div className="space-y-4">
      {/* ── Ukentlig påminnelse ── */}
      {viewMode === "kort" && !completedAll && showReminder && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 sm:px-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Bell className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-900 text-[0.875rem]">Påminnelse!</p>
              <p className="text-amber-800 text-[0.8125rem] mt-0.5">
                Viktig at vi bruker salgsagenten jevnlig for å opprettholde en god kontaktliste.
              </p>
            </div>
          </div>
          <button
            onClick={() => setReminderDismissed(true)}
            className="self-end text-amber-400 hover:text-amber-700 flex-shrink-0 sm:self-auto sm:mt-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Filter + visningsvalg ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:w-14 sm:flex-shrink-0">
          Eier
        </span>
        <div className="flex flex-wrap items-center gap-1.5 sm:flex-1">
          {filterOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                if (opt.id === ownerFilter) return;
                setOwnerFilter(opt.id);
                setCurrentContactId(null);
                historyRef.current = [];
                futureHistoryRef.current = [];
                setHistory([]);
                setFutureHistory([]);
                setCompletedAll(false);
              }}
              className={cn(
                "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors",
                ownerFilter === opt.id
                  ? "bg-foreground text-background border-foreground font-medium"
                  : "border-border text-muted-foreground hover:bg-secondary",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

      </div>

      {/* ── KORTVISNING ── */}
      {viewMode === "kort" && (
        <div>
          {/* Progressbar */}
          <div className="mb-4">
            <div className="flex flex-col gap-1 text-[0.75rem] text-muted-foreground mb-1.5 sm:flex-row sm:items-center sm:justify-between">
              <span>{treatedCount} behandlet i dag</span>
              <span>{queue.length} igjen</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : queue.length === 0 || completedAll ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-4xl mb-3">🎉</p>
              <p className="text-[1.125rem] font-semibold text-foreground">Køen er tom!</p>
              <p className="text-[0.875rem] text-muted-foreground mt-1">Du har behandlet alle leads i dag.</p>
            </div>
          ) : current ? (
            <div className="space-y-2">
              <div
                ref={cardRef}
                className="w-full bg-card border border-border rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-visible"
                style={{ cursor: isDragging ? "grabbing" : "grab", touchAction: "pan-y" }}
              >
                {/* Temperaturstrek øverst */}
                <div className="rounded-t-2xl overflow-hidden">
                  <div className={cn("h-1", TEMP_CONFIG[current.temperature].bar)} />
                </div>

                <div className="flex items-center gap-2 px-4 pt-4 sm:px-5">
                  {/* Temperatur-badge */}
                  {(() => {
                    const tempBadge: Record<string, { bg: string; text: string }> = {
                      hett: { bg: "bg-red-50 border-red-100", text: "text-red-800" },
                      lovende: { bg: "bg-orange-50 border-orange-100", text: "text-orange-800" },
                      mulig: { bg: "bg-amber-50 border-amber-100", text: "text-amber-800" },
                      sovende: { bg: "bg-gray-50 border-gray-100", text: "text-gray-600" },
                    };
                    const emoji = current.temperature === "hett" ? "🔥" : current.temperature === "lovende" ? "⚡" : current.temperature === "mulig" ? "💡" : "💤";
                    const tb = tempBadge[current.temperature];
                    return (
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[0.75rem] font-medium", tb.bg, tb.text)}>
                        {emoji} {TEMP_CONFIG[current.temperature].label}
                      </span>
                    );
                  })()}
                  {/* Finn.no-badge */}
                  {(() => {
                    const companyTech = techProfiles.find((tp: any) => tp.company_id === current.contact.company_id);
                    if (!companyTech?.teknologier) return null;
                    const hasTech = Object.keys(companyTech.teknologier as Record<string, number>).length > 0;
                    if (!hasTech) return null;
                    return (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-blue-100 bg-blue-50 text-[0.75rem] font-medium text-blue-800">
                        <Radio className="h-3 w-3 text-blue-500" /> Finn.no
                      </span>
                    );
                  })()}
                  <button
                    onClick={() => setPanelOpen(true)}
                    className="ml-auto inline-flex items-center gap-1.5 h-7 px-3 rounded-lg bg-secondary border border-border text-[0.75rem] text-muted-foreground hover:text-foreground transition-all"
                  >
                    <span>↗</span>
                    <span>Åpne kontakt</span>
                  </button>
                </div>

                <div className="p-4 pt-3 sm:p-7 sm:pt-3">
                  {/* ── Sone 1: Navn + meta ── */}
                  <div className="pb-5">
                    <div className="space-y-1">
                      <button
                        onClick={() => navigate(`/kontakter/${current.contact.id}`)}
                        className="text-[1.5rem] font-bold text-foreground hover:text-primary transition-colors text-left leading-tight"
                      >
                        {current.contact.first_name} {current.contact.last_name}
                      </button>
                      <div className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground flex-wrap">
                        {current.contact.title && <span>{current.contact.title}</span>}
                        {current.contact.companies?.name && (
                          <>
                            {current.contact.title && <span>·</span>}
                            <button
                              onClick={() => navigate(`/selskaper/${current.contact.company_id}`)}
                              className="text-primary hover:underline font-medium"
                            >
                              {current.contact.companies.name}
                            </button>
                          </>
                        )}
                        {current.contact.companies?.city && (
                          <>
                            <span>·</span>
                            <span>{current.contact.companies.city}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border/50" />

                  {/* ── Sone 2: Siste + Neste oppfølging ── */}
                  <div className="py-6">
                    {/* Snapshot-grid */}
                    <div className="flex flex-col gap-8">
                      {/* Siste */}
                      <div className="flex flex-col gap-1">
                        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">
                          Siste oppfølging
                        </p>
                        {current.lastAct ? (
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <p className="text-[0.9375rem] font-medium text-foreground leading-snug min-w-0">
                              &ldquo;{current.lastAct.subject}&rdquo;
                            </p>
                            {(() => {
                              const d = new Date(current.lastAct.created_at);
                              const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
                              const diffMonths = Math.floor(diffDays / 30);
                              const diffYears = Math.floor(diffDays / 365);
                              const remainMonths = Math.floor((diffDays % 365) / 30);
                              const relText =
                                diffDays < 1 ? "i dag"
                                : diffDays === 1 ? "i går"
                                : diffDays < 7 ? `${diffDays} dager siden`
                                : diffDays < 28 ? `${Math.floor(diffDays / 7)} uker siden`
                                : diffDays < 365 ? `${diffMonths} mnd siden`
                                : remainMonths > 0 ? `${diffYears} år ${remainMonths} mnd siden`
                                : `${diffYears} år siden`;
                              const absText =
                                diffDays < 30
                                  ? format(d, "d. MMM yyyy", { locale: nb })
                                  : diffDays < 365
                                    ? format(d, "MMM yyyy", { locale: nb })
                                    : format(d, "MMM yyyy", { locale: nb });
                              const ageColor =
                                diffDays < 30 ? "text-muted-foreground"
                                : diffDays < 180 ? "text-amber-600"
                                : "text-destructive";
                              return (
                                <p className="text-[0.8125rem] whitespace-nowrap">
                                  <span className={ageColor}>{relText}</span>
                                  <span className="text-muted-foreground"> · {absText}</span>
                                </p>
                              );
                            })()}
                          </div>
                        ) : (
                          <p className="text-[0.8125rem] text-muted-foreground/60 italic">Ingen aktivitet</p>
                        )}
                      </div>

                      {/* Neste */}
                      <div className="flex flex-col gap-1.5">
                        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">
                          Neste oppfølging
                        </p>
                        <div className="flex items-baseline gap-2 flex-wrap">
                          {current.nextTask ? (
                            (() => {
                              const taskId = current.nextTask?.id;
                              const chipOptions = [
                                { label: "Følg opp på sikt", value: null },
                                { label: "1 uke", value: format(addWeeks(new Date(), 1), "yyyy-MM-dd") },
                                { label: "2 uker", value: format(addWeeks(new Date(), 2), "yyyy-MM-dd") },
                                { label: "1 måned", value: format(addMonths(new Date(), 1), "yyyy-MM-dd") },
                                { label: "3 måneder", value: format(addMonths(new Date(), 3), "yyyy-MM-dd") },
                              ];
                              const dueDateValue = current.nextTask?.due_date
                                ? format(new Date(current.nextTask.due_date), "yyyy-MM-dd")
                                : null;
                              const activeChipValue = (taskId ? selectedChipDate[taskId] : undefined) ?? dueDateValue;
                              const overdue =
                                current.hasOverdue ||
                                (current.nextTask.due_date
                                  ? isPast(new Date(current.nextTask.due_date)) &&
                                    !isToday(new Date(current.nextTask.due_date))
                                  : false);
                              const showChips =
                                overdue ||
                                chipOptions.some((chip) => chip.value === activeChipValue) ||
                                !!activeChipValue;
                              const isCustomSelected =
                                !!activeChipValue && !chipOptions.some((chip) => chip.value === activeChipValue);
                              const customInputValue = taskId
                                ? (customChipDate[taskId] ?? (isCustomSelected && activeChipValue ? activeChipValue : ""))
                                : "";
                              const updateTaskDueDate = async (newDate: string | null) => {
                                if (!taskId) return;
                                setSelectedChipDate((prev) => ({ ...prev, [taskId]: newDate }));
                                if (typeof newDate === "string") {
                                  setCustomChipDate((prev) => ({ ...prev, [taskId]: newDate }));
                                }
                                queryClient.setQueryData(["salgssenter-all", ownerFilter], (old: any) => ({
                                  ...old,
                                  allTasks: old?.allTasks?.map((t: any) =>
                                    t.id === taskId ? { ...t, due_date: newDate } : t,
                                  ),
                                }));
                                await supabase
                                  .from("tasks")
                                  .update({ due_date: newDate as any, updated_at: new Date().toISOString() })
                                  .eq("id", taskId);
                              };
                              return (
                                <>
                                  <p className="text-[0.9375rem] font-medium text-foreground leading-snug min-w-0">
                                    {current.nextTask.title}
                                  </p>
                                  <span
                                    className={cn(
                                      "text-[0.8125rem] whitespace-nowrap",
                                      overdue ? "text-destructive" : "text-muted-foreground italic",
                                    )}
                                  >
                                    {current.nextTask.due_date
                                      ? format(new Date(current.nextTask.due_date), "d. MMM yyyy", { locale: nb })
                                      : "Følg opp på sikt"}
                                  </span>
                                </>
                              );
                            })()
                          ) : (
                            <p className="text-[0.8125rem] text-muted-foreground/60 italic">Ingen planlagt</p>
                          )}
                        </div>
                        {current.nextTask && (() => {
                          const taskId = current.nextTask?.id;
                          const chipOptions = [
                            { label: "Følg opp på sikt", value: null },
                            { label: "1 uke", value: format(addWeeks(new Date(), 1), "yyyy-MM-dd") },
                            { label: "2 uker", value: format(addWeeks(new Date(), 2), "yyyy-MM-dd") },
                            { label: "1 måned", value: format(addMonths(new Date(), 1), "yyyy-MM-dd") },
                            { label: "3 måneder", value: format(addMonths(new Date(), 3), "yyyy-MM-dd") },
                          ];
                          const dueDateValue = current.nextTask?.due_date
                            ? format(new Date(current.nextTask.due_date), "yyyy-MM-dd")
                            : null;
                          const activeChipValue = (taskId ? selectedChipDate[taskId] : undefined) ?? dueDateValue;
                          const overdue =
                            current.hasOverdue ||
                            (current.nextTask.due_date
                              ? isPast(new Date(current.nextTask.due_date)) &&
                                !isToday(new Date(current.nextTask.due_date))
                              : false);
                          const showChips =
                            overdue ||
                            chipOptions.some((chip) => chip.value === activeChipValue) ||
                            !!activeChipValue;
                          const isCustomSelected =
                            !!activeChipValue && !chipOptions.some((chip) => chip.value === activeChipValue);
                          const customInputValue = taskId
                            ? (customChipDate[taskId] ?? (isCustomSelected && activeChipValue ? activeChipValue : ""))
                            : "";
                          const updateTaskDueDate = async (newDate: string | null) => {
                            if (!taskId) return;
                            setSelectedChipDate((prev) => ({ ...prev, [taskId]: newDate }));
                            if (typeof newDate === "string") {
                              setCustomChipDate((prev) => ({ ...prev, [taskId]: newDate }));
                            }
                            queryClient.setQueryData(["salgssenter-all", ownerFilter], (old: any) => ({
                              ...old,
                              allTasks: old?.allTasks?.map((t: any) =>
                                t.id === taskId ? { ...t, due_date: newDate } : t,
                              ),
                            }));
                            await supabase
                              .from("tasks")
                              .update({ due_date: newDate as any, updated_at: new Date().toISOString() })
                              .eq("id", taskId);
                          };
                          if (!showChips) return null;
                          return (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {chipOptions.map((chip) => {
                                const isActive = chip.value === activeChipValue;
                                return (
                                  <button
                                    key={chip.label}
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      await updateTaskDueDate(chip.value);
                                    }}
                                    className={cn(
                                      "h-9 px-4 text-[0.8125rem] rounded-full border transition-colors",
                                      isActive
                                        ? "bg-primary/10 text-primary border-primary/30 font-medium"
                                        : "border-border text-muted-foreground hover:bg-secondary",
                                    )}
                                  >
                                    {chip.label}
                                  </button>
                                );
                              })}
                              <input
                                type="date"
                                value={customInputValue}
                                onClick={(e) => e.stopPropagation()}
                                onChange={async (e) => {
                                  e.stopPropagation();
                                  const newDate = e.target.value;
                                  if (!newDate) return;
                                  if (taskId) setCustomChipDate((prev) => ({ ...prev, [taskId]: newDate }));
                                  await updateTaskDueDate(newDate);
                                }}
                                  className={cn(
                                   "h-9 px-3 text-[0.8125rem] rounded-full border bg-background transition-colors",
                                   isCustomSelected
                                     ? "bg-primary/10 text-primary border-primary/30 font-medium"
                                     : "border-border text-muted-foreground hover:bg-secondary",
                                )}
                              />
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border/50" />

                  {/* ── Sone 4: Toggle-piller ── */}
                  <div className="py-5">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Signal */}
                      <div className="relative">
                        <button
                          onClick={() => setActiveForm(activeForm === "signal" ? null : "signal")}
                          className={cn(
                            "inline-flex items-center gap-1.5 h-9 px-4 rounded-full border text-[0.8125rem] font-medium transition-colors",
                            currentSignal
                              ? SIGNAL_CATEGORIES.find((c) => c.label === currentSignal)?.badgeColor
                              : "bg-background text-muted-foreground border-border hover:bg-secondary",
                          )}
                        >
                          {currentSignal || "Signal"} <ChevronDown className="h-3 w-3" />
                        </button>
                        {activeForm === "signal" && (
                          <>
                          <div className="fixed inset-0 z-40" onClick={() => setActiveForm(null)} />
                          <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[200px]">
                            {SIGNAL_CATEGORIES.map((cat) => (
                              <button
                                key={cat.label}
                                onClick={async () => {
                                  const previousSignal = currentSignal;
                                  setLocalSignals((prev) => ({ ...prev, [current.contact.id]: cat.label }));
                                  setActiveForm(null);

                                  try {
                                    await persistSignalToFollowUp({
                                      contactId: current.contact.id,
                                      companyId: current.contact.company_id,
                                      signal: cat.label,
                                      task: current.nextTask,
                                      createIfMissing: !current.nextTask,
                                    });
                                  } catch (error) {
                                    console.error("Kunne ikke oppdatere signal i oppfolging:", error);
                                    setLocalSignals((prev) => {
                                      const next = { ...prev };
                                      if (previousSignal) next[current.contact.id] = previousSignal;
                                      else delete next[current.contact.id];
                                      return next;
                                    });
                                    toast.error("Kunne ikke oppdatere signal");
                                  }
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-[0.8125rem] hover:bg-secondary transition-colors text-left"
                              >
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold",
                                    cat.badgeColor,
                                  )}
                                >
                                  {cat.label}
                                </span>
                                {currentSignal === cat.label && <span className="ml-auto text-primary">✓</span>}
                              </button>
                            ))}
                          </div>
                          </>
                        )}
                      </div>

                      {/* Innkjøper */}
                      <button
                        onClick={() => {
                          const newVal = !current.contact.call_list;
                          supabase
                            .from("contacts")
                            .update({ call_list: newVal })
                            .eq("id", current.contact.id)
                            .then(() =>
                              queryClient.setQueryData(["salgssenter-all", ownerFilter], (old: any) => ({
                                ...old,
                                rawContacts: old?.rawContacts?.map((c: any) =>
                                  c.id === current.contact.id ? { ...c, call_list: newVal } : c,
                                ),
                              })),
                            );
                        }}
                        className={cn(
                          "inline-flex items-center h-9 px-4 rounded-full border text-[0.8125rem] font-medium transition-colors",
                          current.contact.call_list
                            ? "bg-amber-100 text-amber-800 border-amber-200"
                            : "bg-background text-muted-foreground border-border hover:bg-secondary",
                        )}
                      >
                        Innkjøper
                      </button>

                      {/* CV-epost */}
                      <button
                        onClick={() => {
                          const newVal = !current.contact.cv_email;
                          if (newVal && !contactHasEmail(current.contact)) {
                            toast.error(CONTACT_CV_EMAIL_REQUIRED_MESSAGE);
                            return;
                          }
                          supabase
                            .from("contacts")
                            .update({ cv_email: newVal })
                            .eq("id", current.contact.id)
                            .then(() =>
                              queryClient.setQueryData(["salgssenter-all", ownerFilter], (old: any) => ({
                                ...old,
                                rawContacts: old?.rawContacts?.map((c: any) =>
                                  c.id === current.contact.id ? { ...c, cv_email: newVal } : c,
                                ),
                              })),
                            );
                        }}
                        className={cn(
                          "inline-flex items-center h-9 px-4 rounded-full border text-[0.8125rem] font-medium transition-colors",
                          current.contact.cv_email
                            ? "bg-blue-100 text-blue-800 border-blue-200"
                            : "bg-background text-muted-foreground border-border hover:bg-secondary",
                        )}
                      >
                        CV-epost
                      </button>

                      {/* Ikke relevant person */}
                      <button
                        onClick={async () => {
                          const currentVal =
                            localIkkeAktuell[current.contact.id] ?? !!current.contact.ikke_aktuell_kontakt;
                          const newVal = !currentVal;
                          setLocalIkkeAktuell((prev) => ({ ...prev, [current.contact.id]: newVal }));
                          const { error } = await supabase
                            .from("contacts")
                            .update({ ikke_aktuell_kontakt: newVal })
                            .eq("id", current.contact.id);
                          if (error) {
                            console.error("Feil ved oppdatering av ikke_aktuell_kontakt:", error);
                            setLocalIkkeAktuell((prev) => ({ ...prev, [current.contact.id]: currentVal }));
                          }
                        }}
                        className={cn(
                          "inline-flex items-center h-9 px-4 rounded-full border text-[0.8125rem] font-medium transition-colors cursor-pointer ml-auto",
                          (localIkkeAktuell[current.contact.id] ?? !!current.contact.ikke_aktuell_kontakt)
                            ? "bg-destructive/10 text-destructive border-destructive/30"
                            : "bg-background text-muted-foreground border-border hover:bg-secondary",
                        )}
                      >
                        Ikke relevant person å kontakte igjen
                      </button>
                    </div>
                  </div>

                  {/* ── Sone 5: CTA ── */}
                  <div className="pt-1 pb-2">
                    <button
                      onClick={() => {
                        if (!current) return;
                        const harSignal = !!currentSignal;
                        const harTask = !!current.nextTask;
                        const harForfalt = current.hasOverdue;
                        const erIkkeAktuell =
                          localIkkeAktuell[current.contact.id] ?? !!current.contact.ikke_aktuell_kontakt;
                        if (erIkkeAktuell) {
                          void saveReview(current.contact.id, "ikke_aktuell", current, currentSignal);
                          goNext("left", true);
                          return;
                        }
                        const openNudge = (
                          scenario: typeof nudgeScenario,
                          options?: { requireSignalChoice?: boolean },
                        ) => {
                          setNudgeScenario(scenario);
                          setNudgeSignal(currentSignal || "");
                          setNudgeRequiresSignalChoice(!currentSignal && !!options?.requireSignalChoice);
                          // Preserve date chip selection from the card
                          const taskId = current.nextTask?.id;
                          const chipVal = taskId ? selectedChipDate[taskId] : undefined;
                          if (chipVal !== undefined) {
                            // null means "Følg opp på sikt" on the card → "someday" in modal
                            setNudgeDate(chipVal === null ? "someday" : chipVal);
                            setNudgeCustomDate(taskId && customChipDate[taskId] ? customChipDate[taskId] : "");
                          } else {
                            setNudgeDate("someday");
                            setNudgeCustomDate("");
                          }
                          setNudgeOpen(true);
                        };
                        if (harForfalt) {
                          openNudge("forfalt", { requireSignalChoice: !harSignal });
                          return;
                        }
                        if (!harSignal && harTask) {
                          openNudge("ingen_signal_med_task", { requireSignalChoice: true });
                          return;
                        }
                        if (!harSignal && !harTask) {
                          openNudge("ingen_signal_ingen_task", { requireSignalChoice: true });
                          return;
                        }
                        if (harSignal && !harTask) {
                          openNudge("signal_ingen_task");
                          return;
                        }
                        void saveReview(current.contact.id, "beholdt", current, currentSignal);
                        goNext("left", true);
                      }}
                      className="w-full h-[46px] rounded-xl bg-foreground text-background text-[0.9375rem] font-medium hover:opacity-90 active:scale-[0.99] transition-all"
                    >
                      Ok, neste →
                    </button>
                  </div>
                </div>
              </div>

              {/* Navigasjon under kortet */}
              <div className="flex items-center justify-between px-1 sm:px-2">
                <button
                  onClick={() => goNext("right")}
                  disabled={history.length === 0}
                  className="flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground/40 hover:text-foreground hover:bg-secondary disabled:opacity-15 disabled:pointer-events-none transition-all"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => goNext("left")}
                  disabled={(() => {
                    if (futureHistory.length > 0) return false;
                    const idx = eligibleScoredLeads.findIndex((s) => s.contact.id === current?.contact.id);
                    const afterCurrent = eligibleScoredLeads.slice(idx + 1).filter((l) => !treated.has(l.contact.id));
                    const beforeCurrent = eligibleScoredLeads
                      .slice(0, Math.max(idx, 0))
                      .filter((l) => !treated.has(l.contact.id));
                    return afterCurrent.length === 0 && beforeCurrent.length === 0;
                  })()}
                  className="flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground/40 hover:text-foreground hover:bg-secondary disabled:opacity-15 disabled:pointer-events-none transition-all"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ── LISTEVISNING ── */}
      {viewMode === "liste" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {eligibleScoredLeads.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">Ingen leads å vise</p>
          ) : (
            <div className="divide-y divide-border">
              {eligibleScoredLeads.map((lead) => {
                const temp = TEMP_CONFIG[lead.temperature];
                return (
                  <button
                    key={lead.contact.id}
                    onClick={() => navigate(`/kontakter/${lead.contact.id}`)}
                    className="w-full flex flex-col items-start gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left sm:flex-row sm:items-center"
                  >
                    <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", temp.dot)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[0.875rem] font-medium text-foreground truncate">
                          {lead.contact.first_name} {lead.contact.last_name}
                        </span>
                        {lead.signal && (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold flex-shrink-0",
                              SIGNAL_CATEGORIES.find((c) => c.label === lead.signal)?.badgeColor,
                            )}
                          >
                            {lead.signal}
                          </span>
                        )}
                        {lead.hasMarkedsradar && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[0.6875rem] font-semibold flex-shrink-0">
                            <Radio className="h-3 w-3" /> Finn.no
                          </span>
                        )}
                        {lead.isInnkjoper && (
                          <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-[0.6875rem] font-semibold flex-shrink-0">
                            Innkjøper
                          </span>
                        )}
                        {lead.needsReview && (
                          <span className="text-[0.6875rem]" title="Trenger oppfølging">
                            ⚠
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[0.75rem] text-muted-foreground truncate">
                          {lead.contact.companies?.name}
                          {lead.contact.title && ` · ${lead.contact.title}`}
                        </p>
                        {lead.reasons.length > 0 && (
                          <span className="text-[0.6875rem] text-muted-foreground/60 flex-shrink-0">
                            {lead.reasons.join(" · ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <span
                        className={cn(
                          "text-[0.75rem] font-medium flex-shrink-0 px-2 py-0.5 rounded-full",
                          temp.bg,
                          temp.text,
                        )}
                      >
                        {temp.label}
                      </span>
                      <span className="text-[0.6875rem] text-muted-foreground flex-shrink-0">T{lead.tier}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Nudge modal ── */}
      {nudgeOpen &&
        current &&
        (() => {
          const navn = `${current.contact.first_name} ${current.contact.last_name}`;
          const nudgeHasValidDate = nudgeDate !== "custom" || !!nudgeCustomDate;
          const nudgeCanSubmit = nudgeHasValidDate && (!nudgeRequiresSignalChoice || !!nudgeSignal);

          const NUDGE_DATE_CHIPS = [
            { label: "Følg opp på sikt", value: "someday" },
            { label: "1 uke", value: format(addWeeks(new Date(), 1), "yyyy-MM-dd") },
            { label: "2 uker", value: format(addWeeks(new Date(), 2), "yyyy-MM-dd") },
            { label: "1 måned", value: format(addMonths(new Date(), 1), "yyyy-MM-dd") },
            { label: "3 måneder", value: format(addMonths(new Date(), 3), "yyyy-MM-dd") },
          ];

          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center">
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setNudgeOpen(false)} />
              <div
                className="relative w-full max-w-2xl mx-4 bg-card border border-border rounded-2xl shadow-xl p-5 sm:p-10"
                style={{ animation: "shake 0.6s cubic-bezier(0.36, 0.07, 0.19, 0.97)" }}
              >
                <button
                  onClick={() => setNudgeOpen(false)}
                  className="absolute top-4 right-4 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>

                <p className="text-[1.5rem] font-bold text-foreground mb-6">Hva er status på {navn}?</p>

                {/* Oppfølging */}
                <div className="mb-6">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3">
                    {nudgeHarEksisterendeTask
                      ? nudgeScenario === "forfalt"
                        ? `Sett ny dato for: "${current.nextTask?.title}"`
                        : `Sett ny dato for oppfølging`
                      : 'Sett ny dato for: "Følg opp om behov"'}
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {NUDGE_DATE_CHIPS.map((chip) => (
                      <button
                        key={chip.value}
                        onClick={() => setNudgeDate(chip.value)}
                        className={cn(
                          "h-10 px-3 text-[0.8125rem] rounded-xl border transition-all font-medium flex items-center justify-center gap-1.5",
                          nudgeDate === chip.value
                            ? "bg-primary/10 border-primary/30 text-primary font-medium shadow-sm"
                            : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
                        )}
                      >
                        {nudgeDate === chip.value && <span className="text-sm">✓</span>}
                        {chip.label}
                      </button>
                    ))}
                    <input
                      type="date"
                      value={nudgeCustomDate}
                      onChange={(e) => {
                        setNudgeCustomDate(e.target.value);
                        setNudgeDate("custom");
                      }}
                      className={cn(
                        "h-10 px-3 text-[0.8125rem] rounded-xl border transition-all",
                        nudgeDate === "custom"
                          ? "border-foreground bg-secondary"
                          : "border-border text-muted-foreground bg-background",
                      )}
                    />
                  </div>
                </div>

                <div className="border-t border-border/50 mb-6" />

                {/* Signal */}
                <div className="mb-8">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                    Hva er signalet nå?
                  </p>
                  {nudgeRequiresSignalChoice && !nudgeSignal && (
                    <p className="text-[0.75rem] text-destructive mb-3">Velg et signal for å gå videre.</p>
                  )}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[
                      {
                        label: "Behov nå",
                        active: "bg-emerald-500 text-white border-emerald-500",
                        inactive: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
                      },
                      {
                        label: "Får fremtidig behov",
                        active: "bg-blue-500 text-white border-blue-500",
                        inactive: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
                      },
                      {
                        label: "Får kanskje behov",
                        active: "bg-amber-500 text-white border-amber-500",
                        inactive: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
                      },
                      {
                        label: "Ukjent om behov",
                        active: "bg-gray-400 text-white border-gray-400",
                        inactive: "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100",
                      },
                    ].map((cat) => (
                      <button
                        key={cat.label}
                        onClick={() => setNudgeSignal(cat.label)}
                        className={cn(
                          "h-10 px-3 rounded-xl border text-[0.8125rem] font-medium transition-all flex items-center justify-center gap-1.5",
                          nudgeSignal === cat.label ? cat.active + " shadow-sm" : cat.inactive,
                        )}
                      >
                        {nudgeSignal === cat.label && <span className="text-sm">✓</span>}
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <button
                  disabled={!nudgeCanSubmit}
                  onClick={handleNudgeOkNeste}
                  className={cn(
                    "w-full h-[52px] rounded-xl text-[1rem] font-medium transition-all",
                    nudgeCanSubmit
                      ? "bg-foreground text-background hover:opacity-90 active:scale-[0.99]"
                      : "bg-muted text-muted-foreground cursor-not-allowed",
                  )}
                >
                  Ok, neste →
                </button>
              </div>

              <style>{`
              @keyframes shake {
                0%, 100% { transform: translateX(0) rotate(0deg); }
                20% { transform: translateX(-3px) rotate(-0.5deg); }
                40% { transform: translateX(3px) rotate(0.5deg); }
                60% { transform: translateX(-2px) rotate(-0.3deg); }
                80% { transform: translateX(2px) rotate(0.3deg); }
              }
            `}</style>
            </div>
          );
        })()}

      {/* ── Side panel ── */}
      {current && (
        <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
          <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
            <div className="p-4 sm:p-6 max-w-2xl">
              <ContactCardContent contactId={current.contact.id} editable={true} />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
};

export default DailyBrief;
