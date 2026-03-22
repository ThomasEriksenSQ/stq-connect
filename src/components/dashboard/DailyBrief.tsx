import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { differenceInDays, isPast, isToday, format, addWeeks, addMonths } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getEffectiveSignal } from "@/lib/categoryUtils";
import { getHeatResult, TEMP_CONFIG } from "@/lib/heatScore";
import { Flame, List, ChevronLeft, ChevronRight, Radio, Loader2, MapPin, ChevronDown, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ContactCardContent } from "@/components/ContactCardContent";

const DATE_CHIPS = [
  { label: "1 uke",     fn: () => addWeeks(new Date(), 1)  },
  { label: "2 uker",    fn: () => addWeeks(new Date(), 2)  },
  { label: "1 måned",   fn: () => addMonths(new Date(), 1) },
  { label: "3 måneder", fn: () => addMonths(new Date(), 3) },
];

const SIGNAL_CATEGORIES = [
  { label: "Behov nå",            badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { label: "Får fremtidig behov", badgeColor: "bg-blue-100 text-blue-800 border-blue-200"          },
  { label: "Får kanskje behov",   badgeColor: "bg-amber-100 text-amber-800 border-amber-200"       },
  { label: "Ukjent om behov",     badgeColor: "bg-gray-100 text-gray-600 border-gray-200"          },
  { label: "Ikke aktuelt",        badgeColor: "bg-red-50 text-red-700 border-red-200"              },
];

interface ScoredLead {
  contact: any; signal: string; score: number;
  temperature: "hett" | "lovende" | "mulig" | "sovende";
  tier: 1 | 2 | 3 | 4;
  reasons: string[];
  needsReview: boolean;
  lastAct: any; nextTask: any; hasOverdue: boolean;
  hasMarkedsradar: boolean; isInnkjoper: boolean; hasAktivForespørsel: boolean;
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

function buildSignalSnapshot(lead: ScoredLead) {
  return {
    signal: lead.signal || null,
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
  const [isAnimating, setIsAnimating] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [localSignals, setLocalSignals] = useState<Record<string, string>>({});
  const [localIkkeAktuell, setLocalIkkeAktuell] = useState<Record<string, boolean>>({});
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const [nudgeScenario, setNudgeScenario] = useState<"ingen_signal_ingen_task" | "signal_ingen_task" | "forfalt" | null>(null);
  const [nudgeSignal, setNudgeSignal] = useState("Ukjent om behov");
  const [nudgeDate, setNudgeDate] = useState("someday");
  const [nudgeCustomDate, setNudgeCustomDate] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [dragDeltaX, setDragDeltaX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const scoredLeadsRef = useRef<ScoredLead[]>([]);
  const treatedRef = useRef<Set<string>>(new Set());
  const currentRef = useRef<ScoredLead | null>(null);


  const { data: allProfiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: salgsData, isLoading } = useQuery({
    queryKey: ["salgssenter-all", ownerFilter],
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

      const [
        { data: activities },
        { data: tasks },
        { data: techProfiles },
        { data: foresporsler },
      ] = await Promise.all([
        supabase.from("activities")
          .select("contact_id, created_at, subject, description, type")
          .not("contact_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(10000),
        supabase.from("tasks")
          .select("contact_id, created_at, due_date, status, description, title")
          .not("contact_id", "is", null)
          .neq("status", "done")
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(5000),
        companyIds.length > 0
          ? supabase.from("company_tech_profile").select("company_id, konsulent_hyppighet, sist_fra_finn, teknologier").in("company_id", companyIds)
          : Promise.resolve({ data: [] }),
        supabase.from("foresporsler").select("id, selskap_id, status, mottatt_dato").not("status", "in", '("avsluttet","tapt")'),
      ]);

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

  const { data: agentReviews = [], isLoading: isLoadingReviews } = useQuery({
    queryKey: ["agent-reviews"],
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_contact_reviews")
        .select("contact_id, reviewed_at, action_taken, signals_at_review")
        .order("reviewed_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const reviewMap = useMemo(() => {
    const map: Record<string, any> = {};
    (agentReviews as any[]).forEach(r => {
      const existing = map[r.contact_id];
      if (!existing || r.reviewed_at > existing.reviewed_at) {
        map[r.contact_id] = r;
      }
    });
    return map;
  }, [agentReviews]);

  const scoredLeads = useMemo(() => {
    return rawContacts.map((contact: any) => {
      const contactActs = allActivities.filter((a: any) => a.contact_id === contact.id);
      const contactTasks = allTasks.filter((t: any) => t.contact_id === contact.id);
      if (contact.id === 'd60a7ed2-298d-402e-9a04-6442c27f068c') console.log('VICTOR ACTS', contactActs.map(a => a.subject));
      const signal = getEffectiveSignal(
        contactActs.map((a: any) => ({ created_at: a.created_at, subject: a.subject, description: a.description })),
        contactTasks.map((t: any) => ({ created_at: t.created_at, title: t.title, description: t.description, due_date: t.due_date }))
      );
      if (contact.id === 'd60a7ed2-298d-402e-9a04-6442c27f068c') console.log('VICTOR SIGNAL', signal);
      if (signal === "Ikke aktuelt") return null;
      const lastAct = contactActs[0];
      const daysSince = lastAct ? differenceInDays(new Date(), new Date(lastAct.created_at)) : 999;
      const nextTask = contactTasks.find((t: any) => t.due_date) ?? contactTasks[0] ?? null;
      const hasOverdue = nextTask?.due_date ? isPast(new Date(nextTask.due_date)) && !isToday(new Date(nextTask.due_date)) : false;
      const techProfile = techProfiles.find((tp: any) => tp.company_id === contact.company_id);
      const hasMarkedsradar = !!(techProfile?.sist_fra_finn && differenceInDays(new Date(), new Date(techProfile.sist_fra_finn)) <= 90);
      const hasAktivForespørsel = foresporsler.some((f: any) =>
        f.selskap_id === contact.company_id &&
        f.mottatt_dato &&
        differenceInDays(new Date(), new Date(f.mottatt_dato)) <= 45
      );
      const hasTidligereForespørsel = foresporsler.some((f: any) =>
        f.selskap_id === contact.company_id &&
        (!f.mottatt_dato || differenceInDays(new Date(), new Date(f.mottatt_dato)) > 45)
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
        contact, signal,
        score: heatResult.score,
        temperature: heatResult.temperature,
        tier: heatResult.tier,
        reasons: heatResult.reasons,
        needsReview: heatResult.needsReview,
        lastAct, nextTask, hasOverdue, hasMarkedsradar, isInnkjoper, hasAktivForespørsel, hasTidligereForespørsel,
      };
    }).filter((lead): lead is ScoredLead => {
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
    }).sort((a, b) => {
      const ta = a.tier, tb = b.tier;
      if (ta !== tb) return ta - tb;
      const ra = reviewMap[a.contact.id]?.reviewed_at ?? "1970-01-01T00:00:00Z";
      const rb = reviewMap[b.contact.id]?.reviewed_at ?? "1970-01-01T00:00:00Z";
      if (ra !== rb) return ra.localeCompare(rb);
      return b.score - a.score;
    }) as ScoredLead[];
  }, [rawContacts, allActivities, allTasks, techProfiles, foresporsler, reviewMap]);

  const queue = useMemo(() => {
    return scoredLeads.filter(l => {
      if (treated.has(l.contact.id)) return false;
      const lastReview = reviewMap[l.contact.id];
      if (l.contact.id === 'd60a7ed2-298d-402e-9a04-6442c27f068c') console.log('VICTOR REVIEW', lastReview);
      if (!lastReview) return true;
      const cooldownDays = COOLDOWN_DAYS[l.tier] ?? 90;
      const daysSinceReview = differenceInDays(new Date(), new Date(lastReview.reviewed_at));
      if (daysSinceReview >= cooldownDays) return true;
      const prevSnapshot = lastReview.signals_at_review;
      const currSnapshot = buildSignalSnapshot(l);
      const changed = JSON.stringify(prevSnapshot) !== JSON.stringify(currSnapshot);
      return changed;
    });
  }, [scoredLeads, treated, reviewMap]);

  const current = useMemo(() => {
    if (completedAll) return null;
    if (currentContactId) {
      return scoredLeads.find(l => l.contact.id === currentContactId) ?? queue[0] ?? null;
    }
    return queue[0] ?? null;
  }, [currentContactId, scoredLeads, queue, completedAll]);

  const currentIndexInQueue = currentContactId
    ? queue.findIndex(l => l.contact.id === currentContactId)
    : 0;
  const currentIndexInScored = currentContactId
    ? scoredLeads.findIndex(l => l.contact.id === currentContactId)
    : 0;
  scoredLeadsRef.current = scoredLeads;
  treatedRef.current = treated;
  currentRef.current = current;
  const treatedCount = treated.size;

  const daysSinceLast = current?.lastAct ? differenceInDays(new Date(), new Date(current.lastAct.created_at)) : 999;
  const reasonLine = current ? buildReasonLine(current, daysSinceLast) : "";
  const currentSignal = current ? (localSignals[current.contact.id] ?? current.signal) : "";

  const goNext = useCallback((dir: "left" | "right" = "left", markCurrent = false) => {
    if (isAnimating) return;
    setIsAnimating(true);
    setIsDragging(false);
    const currentLead = currentRef.current;
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
      const freshTreated = treatedRef.current;
      const freshScored = scoredLeadsRef.current;
      const newTreatedSet = new Set([...freshTreated, ...(contactIdToMark ? [contactIdToMark] : [])]);
      if (contactIdToMark) {
        setTreated(newTreatedSet);
        treatedRef.current = newTreatedSet;
      }
      if (dir === "left") {
        if (currentLead) {
          setHistory(prev => [...prev, currentLead.contact.id]);
        }
        const currentIdx = freshScored.findIndex(l => l.contact.id === currentLead?.contact.id);
        const next = freshScored.slice(currentIdx + 1).find(l => !newTreatedSet.has(l.contact.id));
        if (next) {
          setCurrentContactId(next.contact.id);
        } else {
          setCompletedAll(true);
          setCurrentContactId(null);
        }
      } else {
        setHistory(prev => {
          const newHistory = [...prev];
          const prevId = newHistory.pop();
          setCurrentContactId(prevId ?? null);
          return newHistory;
        });
      }
      if (card) {
        const inX = dir === "left" ? 80 : -80;
        card.style.transition = "none";
        card.style.transform = `translateX(${inX}px) scale(0.94)`;
        card.style.opacity = "0";
      }
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (card) {
          card.style.transition = "transform 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 300ms cubic-bezier(0.22, 1, 0.36, 1)";
          card.style.transform = "translateX(0) scale(1)";
          card.style.opacity = "1";
        }
        setTimeout(() => setIsAnimating(false), 420);
      }));
    }, 240);
  }, [isAnimating]);

  const saveReview = useCallback(async (contactId: string, actionTaken: string, lead: ScoredLead) => {
    const newReview = {
      contact_id: contactId,
      reviewed_by: user?.id,
      action_taken: actionTaken,
      signals_at_review: buildSignalSnapshot(lead),
      reviewed_at: new Date().toISOString(),
    };
    queryClient.setQueryData(["agent-reviews"], (old: any[]) => {
      const filtered = (old || []).filter((r: any) => r.contact_id !== contactId);
      return [newReview, ...filtered];
    });
    await supabase.from("agent_contact_reviews").insert({
      contact_id: contactId,
      reviewed_by: user?.id,
      action_taken: actionTaken,
      signals_at_review: buildSignalSnapshot(lead),
    });
    queryClient.invalidateQueries({ queryKey: ["agent-reviews"] });
  }, [user?.id, queryClient]);

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, dueDate }: { taskId: string; dueDate: string }) => {
      const { error } = await supabase.from("tasks").update({ due_date: dueDate, updated_at: new Date().toISOString() }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.setQueryData(["salgssenter-all", ownerFilter], (old: any) => ({
        ...old,
        allTasks: old?.allTasks?.map((t: any) =>
          t.id === variables.taskId ? { ...t, due_date: variables.dueDate } : t
        ),
      }));
      queryClient.invalidateQueries({ queryKey: ["salgssenter-all", ownerFilter] });
    },
  });

  const filterOptions = useMemo(() => {
    const me = allProfiles.find(p => p.id === user?.id);
    const others = allProfiles.filter(p => p.id !== user?.id).map(p => ({
      id: p.id,
      label: p.full_name,
    }));
    return [
      { id: "alle", label: "Alle" },
      ...(me ? [{ id: me.id, label: me.full_name }] : []),
      ...others,
    ];
  }, [allProfiles, user?.id]);

  const progress = scoredLeads.length > 0 ? (treatedCount / scoredLeads.length) * 100 : 0;

  const nudgeContactTasks = useMemo(() =>
    current ? (allTasks as any[]).filter((t: any) => t.contact_id === current.contact.id) : [],
    [allTasks, current]
  );
  const nudgeHarEksisterendeTask = nudgeContactTasks.length > 0;

  const handleNudgeOkNeste = useCallback(async () => {
    if (!current) return;
    const isSomeday = nudgeDate === "someday";
    const newDate = isSomeday ? null : (nudgeDate === "custom" ? nudgeCustomDate : nudgeDate);

    if (nudgeHarEksisterendeTask) {
      for (const task of nudgeContactTasks) {
        const rawDesc = (task.description || "")
          .replace(/^\[[^\]]+\]\n?/, "")
          .replace(/\[someday\]/g, "")
          .trim();
        const withSignal = nudgeSignal
          ? (rawDesc ? `[${nudgeSignal}]\n${rawDesc}` : `[${nudgeSignal}]`)
          : rawDesc;
        const finalDesc = isSomeday
          ? (withSignal ? withSignal + "\n[someday]" : "[someday]")
          : (withSignal || null);
        await supabase.from("tasks").update({
          due_date: newDate,
          description: finalDesc,
          updated_at: new Date().toISOString(),
        }).eq("id", task.id);
      }
    } else {
      const withSignal = nudgeSignal
        ? (isSomeday ? `[${nudgeSignal}]\n[someday]` : `[${nudgeSignal}]`)
        : (isSomeday ? "[someday]" : null);
      await supabase.from("tasks").insert({
        title: "Følg opp om behov",
        description: withSignal,
        priority: "medium",
        due_date: newDate,
        contact_id: current.contact.id,
        company_id: current.contact.company_id,
        assigned_to: user?.id,
        created_by: user?.id,
      });
    }

    if (nudgeSignal && nudgeSignal !== currentSignal) {
      setLocalSignals(prev => ({ ...prev, [current.contact.id]: nudgeSignal }));
      await supabase.from("activities").insert({
        type: "note",
        subject: nudgeSignal,
        description: `[${nudgeSignal}]`,
        contact_id: current.contact.id,
        company_id: current.contact.company_id,
        created_by: user?.id,
      });
      queryClient.invalidateQueries({ queryKey: ["salgssenter-activities"] });
    }

    queryClient.invalidateQueries({ queryKey: ["salgssenter-tasks"] });
    setNudgeOpen(false);
    goNext("left", true);
  }, [current, nudgeDate, nudgeCustomDate, nudgeSignal, nudgeHarEksisterendeTask, nudgeContactTasks, currentSignal, user?.id, goNext, queryClient]);

  return (
    <div className="space-y-4">

      {/* ── Filter + visningsvalg ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground w-14 flex-shrink-0">Eier</span>
        <div className="flex items-center gap-1.5 flex-1">
          {filterOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => { setOwnerFilter(opt.id); setCurrentContactId(null); setTreated(new Set()); setHistory([]); setCompletedAll(false); }}
              className={cn(
                "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors",
                ownerFilter === opt.id
                  ? "bg-foreground text-background border-foreground font-medium"
                  : "border-border text-muted-foreground hover:bg-secondary"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center flex-shrink-0 ml-auto">
          <button
            onClick={() => setViewMode("kort")}
            className={cn(
              "h-8 px-3 text-[0.8125rem] rounded-l-full border transition-colors inline-flex items-center gap-1.5",
              viewMode === "kort" ? "bg-foreground text-background border-foreground font-medium" : "border-border text-muted-foreground hover:bg-secondary"
            )}
          >
            <Flame className="h-3.5 w-3.5" /> Agent
          </button>
          <button
            onClick={() => setViewMode("liste")}
            className={cn(
              "h-8 px-3 text-[0.8125rem] rounded-r-full border-t border-b border-r transition-colors inline-flex items-center gap-1.5",
              viewMode === "liste" ? "bg-foreground text-background border-foreground font-medium" : "border-border text-muted-foreground hover:bg-secondary"
            )}
          >
            <List className="h-3.5 w-3.5" /> Hot list
          </button>
        </div>
      </div>

      {/* ── KORTVISNING ── */}
      {viewMode === "kort" && (
        <div>

          {/* Progressbar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-[0.75rem] text-muted-foreground mb-1.5">
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

          {(isLoading || isLoadingReviews) ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (queue.length === 0 || completedAll) ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-4xl mb-3">🎉</p>
              <p className="text-[1.125rem] font-semibold text-foreground">Køen er tom!</p>
              <p className="text-[0.875rem] text-muted-foreground mt-1">Du har behandlet alle leads i dag.</p>
            </div>
          ) : current ? (
            <div className="space-y-2">
              <div
                ref={cardRef}
                className="w-full bg-card border border-border rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-visible select-none"
                style={{ cursor: isDragging ? "grabbing" : "grab" }}
                onMouseDown={(e) => {
                  setDragStartX(e.clientX);
                  setIsDragging(true);
                  setDragDeltaX(0);
                }}
                onMouseMove={(e) => {
                  if (!isDragging || dragStartX === null) return;
                  const delta = e.clientX - dragStartX;
                  setDragDeltaX(delta);
                  if (cardRef.current) {
                    const resistance = 0.4;
                    cardRef.current.style.transition = "none";
                    cardRef.current.style.transform = `translateX(${delta * resistance}px) scale(${1 - Math.abs(delta) * 0.0003})`;
                    cardRef.current.style.opacity = `${Math.max(0.6, 1 - Math.abs(delta) * 0.003)}`;
                  }
                }}
                onMouseUp={(e) => {
                  if (!isDragging || dragStartX === null) return;
                  setIsDragging(false);
                  const delta = e.clientX - dragStartX;
                  const threshold = 80;
                  if (delta < -threshold && !isAnimating) {
                    goNext("left");
                  } else if (delta > threshold && !isAnimating) {
                    goNext("right");
                  } else {
                    if (cardRef.current) {
                      cardRef.current.style.transition = "transform 380ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease";
                      cardRef.current.style.transform = "translateX(0) scale(1)";
                      cardRef.current.style.opacity = "1";
                    }
                  }
                  setDragStartX(null);
                  setDragDeltaX(0);
                }}
                onMouseLeave={() => {
                  if (isDragging) {
                    setIsDragging(false);
                    setDragStartX(null);
                    setDragDeltaX(0);
                    if (cardRef.current) {
                      cardRef.current.style.transition = "transform 380ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease";
                      cardRef.current.style.transform = "translateX(0) scale(1)";
                      cardRef.current.style.opacity = "1";
                    }
                  }
                }}
                onTouchStart={(e) => {
                  setDragStartX(e.touches[0].clientX);
                  setIsDragging(true);
                }}
                onTouchMove={(e) => {
                  if (dragStartX === null) return;
                  const delta = e.touches[0].clientX - dragStartX;
                  setDragDeltaX(delta);
                  if (cardRef.current) {
                    cardRef.current.style.transition = "none";
                    cardRef.current.style.transform = `translateX(${delta * 0.4}px) scale(${1 - Math.abs(delta) * 0.0003})`;
                    cardRef.current.style.opacity = `${Math.max(0.6, 1 - Math.abs(delta) * 0.003)}`;
                  }
                }}
                onTouchEnd={() => {
                  if (dragStartX === null) return;
                  setIsDragging(false);
                  const threshold = 80;
                  if (dragDeltaX < -threshold && !isAnimating) {
                    goNext("left");
                  } else if (dragDeltaX > threshold && !isAnimating) {
                    goNext("right");
                  } else {
                    if (cardRef.current) {
                      cardRef.current.style.transition = "transform 380ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease";
                      cardRef.current.style.transform = "translateX(0) scale(1)";
                      cardRef.current.style.opacity = "1";
                    }
                  }
                  setDragStartX(null);
                  setDragDeltaX(0);
                }}
              >
                {/* Temperaturstrek øverst */}
                <div className="rounded-t-2xl overflow-hidden">
                  <div className={cn("h-1", TEMP_CONFIG[current.temperature].bar)} />
                </div>

                <div className="flex justify-end px-5 pt-4">
                  <button
                    onClick={() => setPanelOpen(true)}
                    className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg bg-secondary border border-border text-[0.75rem] text-muted-foreground hover:text-foreground transition-all"
                  >
                    <span>↗</span>
                    <span>Åpne kontakt</span>
                  </button>
                </div>

                <div className="p-7 pt-3">

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
                            <button onClick={() => navigate(`/selskaper/${current.contact.company_id}`)} className="text-primary hover:underline font-medium">
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
                  <div className="py-5">
                    {/* Snapshot-grid */}
                    <div className="grid grid-cols-2 gap-6">
                      {/* Siste */}
                      <div className="space-y-1.5">
                        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Siste</p>
                        {current.lastAct ? (
                          <>
                            <p className="text-[0.9375rem] font-medium text-foreground leading-snug">
                              &ldquo;{current.lastAct.subject}&rdquo;
                            </p>
                            <p className="text-[0.75rem] text-muted-foreground">
                              {format(new Date(current.lastAct.created_at), "d. MMM yyyy", { locale: nb })}
                              {" · "}{daysSinceLast === 999 ? "aldri" : `${daysSinceLast} dager siden`}
                            </p>
                          </>
                        ) : (
                          <p className="text-[0.8125rem] text-muted-foreground/60 italic">Ingen aktivitet</p>
                        )}
                      </div>

                      {/* Neste */}
                      <div className="space-y-1.5">
                        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Neste oppfølging</p>
                        {current.nextTask ? (() => {
                          const overdue = current.nextTask.due_date ? isPast(new Date(current.nextTask.due_date)) && !isToday(new Date(current.nextTask.due_date)) : false;
                          return (
                            <>
                              <p className="text-[0.9375rem] font-medium text-foreground leading-snug">{current.nextTask.title}</p>
                              <span className={cn(
                                "text-[0.75rem]",
                                overdue ? "text-destructive font-medium" : "text-muted-foreground italic"
                              )}>
                                {current.nextTask.due_date
                                  ? format(new Date(current.nextTask.due_date), "d. MMM yyyy", { locale: nb })
                                  : "Følg opp på sikt"}
                              </span>
                              {overdue && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {[
                                    { label: "Følg opp på sikt", value: null },
                                    { label: "1 uke", value: format(addWeeks(new Date(), 1), "yyyy-MM-dd") },
                                    { label: "2 uker", value: format(addWeeks(new Date(), 2), "yyyy-MM-dd") },
                                    { label: "1 måned", value: format(addMonths(new Date(), 1), "yyyy-MM-dd") },
                                    { label: "3 måneder", value: format(addMonths(new Date(), 3), "yyyy-MM-dd") },
                                  ].map(chip => (
                                    <button
                                      key={chip.label}
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const newDate = chip.value;
                                        const taskId = current.nextTask.id;
                                        queryClient.setQueryData(["salgssenter-all", ownerFilter], (old: any) => ({
                                          ...old,
                                          allTasks: old?.allTasks?.map((t: any) =>
                                            t.id === taskId ? { ...t, due_date: newDate } : t
                                          ),
                                        }));
                                        await supabase.from("tasks").update({ due_date: newDate, updated_at: new Date().toISOString() }).eq("id", taskId);
                                      }}
                                      className="h-7 px-3 text-[0.75rem] rounded-full border border-border text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                                    >
                                      {chip.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          );
                        })() : (
                          <p className="text-[0.8125rem] text-muted-foreground/60 italic">Ingen planlagt</p>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Divider */}
                  <div className="border-t border-border/50" />

                  {/* ── Sone 3: Lovende + Finn.no strips ── */}
                  <div className="py-5">
                    <div className="flex flex-col gap-2">
                      {/* Lovende-strip */}
                      {(() => {
                        const tempColors = {
                          hett:    { strip: "bg-red-50 border-red-100",     label: "text-red-800 font-medium",    reason: "text-red-600"    },
                          lovende: { strip: "bg-orange-50 border-orange-100", label: "text-orange-800 font-medium", reason: "text-orange-600" },
                          mulig:   { strip: "bg-amber-50 border-amber-100",  label: "text-amber-800 font-medium",  reason: "text-amber-600"  },
                          sovende: { strip: "bg-gray-50 border-gray-100",    label: "text-gray-600 font-medium",   reason: "text-gray-500"   },
                        };
                        const tc = tempColors[current.temperature];
                        const emoji = current.temperature === "hett" ? "🔥" : current.temperature === "lovende" ? "⚡" : current.temperature === "mulig" ? "💡" : "💤";
                        return (
                          <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border", tc.strip)}>
                            <span className="text-[0.875rem]">{emoji}</span>
                            <span className={cn("text-[0.8125rem]", tc.label)}>{TEMP_CONFIG[current.temperature].label}</span>
                            {reasonLine && (
                              <>
                                <span className={cn("text-[0.8125rem]", tc.reason)}>·</span>
                                <span className={cn("text-[0.8125rem]", tc.reason)}>{reasonLine}</span>
                              </>
                            )}
                          </div>
                        );
                      })()}

                      {/* Finn.no-strip */}
                      {(() => {
                        const companyTech = techProfiles.find((tp: any) => tp.company_id === current.contact.company_id);
                        if (!companyTech?.teknologier) return null;
                        const topTech = Object.entries(companyTech.teknologier as Record<string, number>)
                          .sort((a, b) => (b[1] as number) - (a[1] as number))
                          .slice(0, 5).map(([t]) => t);
                        if (topTech.length === 0) return null;
                        return (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 border border-blue-100">
                            <Radio className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                            <span className="text-[0.8125rem] text-blue-800 font-medium">Finn.no</span>
                            <span className="text-[0.75rem] text-blue-600">Søker: {topTech.join(", ")}</span>
                          </div>
                        );
                      })()}
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
                              ? SIGNAL_CATEGORIES.find(c => c.label === currentSignal)?.badgeColor
                              : "bg-background text-muted-foreground border-border hover:bg-secondary"
                          )}
                        >
                          {currentSignal || "Signal"} <ChevronDown className="h-3 w-3" />
                        </button>
                        {activeForm === "signal" && (
                          <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[200px]">
                            {SIGNAL_CATEGORIES.map(cat => (
                              <button
                                key={cat.label}
                                onClick={() => {
                                  setLocalSignals(prev => ({ ...prev, [current.contact.id]: cat.label }));
                                  supabase.from("activities").insert({
                                    type: "note", subject: cat.label, description: `[${cat.label}]`,
                                    contact_id: current.contact.id, company_id: current.contact.company_id, created_by: user?.id,
                                  }).then(() => queryClient.invalidateQueries({ queryKey: ["salgssenter-activities"] }));
                                  setActiveForm(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-[0.8125rem] hover:bg-secondary transition-colors text-left"
                              >
                                <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold", cat.badgeColor)}>
                                  {cat.label}
                                </span>
                                {currentSignal === cat.label && <span className="ml-auto text-primary">✓</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Innkjøper */}
                      <button
                        onClick={() => {
                          const newVal = !current.contact.call_list;
                          supabase.from("contacts").update({ call_list: newVal }).eq("id", current.contact.id)
                            .then(() => queryClient.setQueryData(["salgssenter-all", ownerFilter], (old: any) => ({
                              ...old,
                              rawContacts: old?.rawContacts?.map((c: any) =>
                                c.id === current.contact.id ? { ...c, call_list: newVal } : c
                              ),
                            })));
                        }}
                        className={cn(
                          "inline-flex items-center h-9 px-4 rounded-full border text-[0.8125rem] font-medium transition-colors",
                          current.contact.call_list
                            ? "bg-amber-100 text-amber-800 border-amber-200"
                            : "bg-background text-muted-foreground border-border hover:bg-secondary"
                        )}
                      >
                        Innkjøper
                      </button>

                      {/* CV-epost */}
                      <button
                        onClick={() => {
                          const newVal = !current.contact.cv_email;
                          supabase.from("contacts").update({ cv_email: newVal }).eq("id", current.contact.id)
                            .then(() => queryClient.setQueryData(["salgssenter-all", ownerFilter], (old: any) => ({
                              ...old,
                              rawContacts: old?.rawContacts?.map((c: any) =>
                                c.id === current.contact.id ? { ...c, cv_email: newVal } : c
                              ),
                            })));
                        }}
                        className={cn(
                          "inline-flex items-center h-9 px-4 rounded-full border text-[0.8125rem] font-medium transition-colors",
                          current.contact.cv_email
                            ? "bg-blue-100 text-blue-800 border-blue-200"
                            : "bg-background text-muted-foreground border-border hover:bg-secondary"
                        )}
                      >
                        CV-epost
                      </button>

                      {/* Ikke relevant person */}
                      <button
                        onClick={async () => {
                          const currentVal = localIkkeAktuell[current.contact.id] ?? !!current.contact.ikke_aktuell_kontakt;
                          const newVal = !currentVal;
                          setLocalIkkeAktuell(prev => ({ ...prev, [current.contact.id]: newVal }));
                          const { error } = await supabase.from("contacts").update({ ikke_aktuell_kontakt: newVal }).eq("id", current.contact.id);
                          if (error) {
                            console.error("Feil ved oppdatering av ikke_aktuell_kontakt:", error);
                            setLocalIkkeAktuell(prev => ({ ...prev, [current.contact.id]: currentVal }));
                          }
                        }}
                        className={cn(
                          "inline-flex items-center h-9 px-4 rounded-full border text-[0.8125rem] font-medium transition-colors cursor-pointer",
                          (localIkkeAktuell[current.contact.id] ?? !!current.contact.ikke_aktuell_kontakt)
                            ? "bg-destructive/10 text-destructive border-destructive/30"
                            : "border-border text-muted-foreground hover:bg-secondary"
                        )}
                      >
                        Ikke relevant person
                      </button>
                    </div>
                  </div>

                  {/* ── Sone 5: CTA ── */}
                  <div className="pt-1 pb-2">
                    <button
                      onClick={() => {
                        if (!current) return;
                        const harSignal = !!currentSignal && currentSignal !== "Ukjent om behov";
                        const harTask = !!current.nextTask;
                        const harForfalt = current.hasOverdue;
                        const erIkkeAktuell = localIkkeAktuell[current.contact.id] ?? !!current.contact.ikke_aktuell_kontakt;
                        if (erIkkeAktuell) {
                          saveReview(current.contact.id, "ikke_aktuell", current);
                          goNext("left", true);
                          return;
                        }
                        const openNudge = (scenario: typeof nudgeScenario) => {
                          setNudgeScenario(scenario);
                          setNudgeSignal(currentSignal || "Ukjent om behov");
                          setNudgeDate("someday");
                          setNudgeCustomDate("");
                          setNudgeOpen(true);
                        };
                        if (harForfalt) { openNudge("forfalt"); return; }
                        if (!harSignal && !harTask) { openNudge("ingen_signal_ingen_task"); return; }
                        if (harSignal && !harTask) { openNudge("signal_ingen_task"); return; }
                        saveReview(current.contact.id, "beholdt", current);
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
              <div className="flex items-center justify-between px-2">
                <button
                  onClick={() => goNext("right")}
                  disabled={history.length === 0}
                  className="flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground/40 hover:text-foreground hover:bg-secondary disabled:opacity-15 disabled:pointer-events-none transition-all"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => goNext("left")}
                  disabled={queue.filter(l => !treated.has(l.contact.id) && l.contact.id !== current?.contact.id).length === 0}
                  className="flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground/40 hover:text-foreground hover:bg-secondary disabled:opacity-15 disabled:pointer-events-none transition-all"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-border bg-card px-6 py-4 flex items-start gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center mt-0.5">
                  <Flame className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <div>
                  <p className="text-[0.8125rem] font-semibold text-foreground mb-1">Skape den beste kontaktlisten som er mulig</p>
                  <p className="text-[0.75rem] text-muted-foreground leading-relaxed">
                    Agenten prioriterer kontaktene med høyest sannsynlighet for oppdrag – basert på timing, signaler, aktivitet og Finn.no-annonsering. Dette skaper en liste over det absolutt mest aktuelle å kontakte nå!
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ── LISTEVISNING ── */}
      {viewMode === "liste" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {queue.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">Ingen leads å vise</p>
          ) : (
            <div className="divide-y divide-border">
              {queue.map(lead => {
                const temp = TEMP_CONFIG[lead.temperature];
                return (
                  <button
                    key={lead.contact.id}
                    onClick={() => navigate(`/kontakter/${lead.contact.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                  >
                    <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", temp.dot)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[0.875rem] font-medium text-foreground truncate">
                          {lead.contact.first_name} {lead.contact.last_name}
                        </span>
                        {lead.signal && (
                          <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold flex-shrink-0", SIGNAL_CATEGORIES.find(c => c.label === lead.signal)?.badgeColor)}>
                            {lead.signal}
                          </span>
                        )}
                        {lead.hasMarkedsradar && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[0.6875rem] font-semibold flex-shrink-0">
                            <Radio className="h-3 w-3" /> Finn.no
                          </span>
                        )}
                        {lead.isInnkjoper && (
                          <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-[0.6875rem] font-semibold flex-shrink-0">Innkjøper</span>
                        )}
                        {lead.needsReview && (
                          <span className="text-[0.6875rem]" title="Trenger oppfølging">⚠</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
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
                    <span className={cn("text-[0.75rem] font-medium flex-shrink-0 px-2 py-0.5 rounded-full", temp.bg, temp.text)}>
                      {temp.label}
                    </span>
                    <span className="text-[0.6875rem] text-muted-foreground flex-shrink-0">T{lead.tier}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Nudge modal ── */}
      {nudgeOpen && current && (() => {
        const navn = `${current.contact.first_name} ${current.contact.last_name}`;

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
              className="relative w-full max-w-2xl mx-4 bg-card border border-border rounded-2xl shadow-xl p-10"
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
                    ? (nudgeScenario === "forfalt" ? `Sett ny dato for: "${current.nextTask?.title}"` : `Sett ny dato for oppfølging`)
                    : "Sett ny dato for: \"Følg opp om behov\""}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {NUDGE_DATE_CHIPS.map(chip => (
                    <button
                      key={chip.value}
                      onClick={() => setNudgeDate(chip.value)}
                      className={cn(
                        "h-10 px-3 text-[0.8125rem] rounded-xl border transition-all font-medium",
                        nudgeDate === chip.value
                          ? "bg-primary/10 border-primary/30 text-primary font-medium shadow-sm"
                          : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      {chip.label}
                    </button>
                  ))}
                  <input
                    type="date"
                    value={nudgeCustomDate}
                    onChange={(e) => { setNudgeCustomDate(e.target.value); setNudgeDate("custom"); }}
                    className={cn(
                      "h-10 px-3 text-[0.8125rem] rounded-xl border transition-all",
                      nudgeDate === "custom"
                        ? "border-foreground bg-secondary"
                        : "border-border text-muted-foreground bg-background"
                    )}
                  />
                </div>
              </div>

              <div className="border-t border-border/50 mb-6" />

              {/* Signal */}
              <div className="mb-8">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">Hva er signalet nå?</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Behov nå",            active: "bg-emerald-500 text-white border-emerald-500", inactive: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" },
                    { label: "Får fremtidig behov", active: "bg-blue-500 text-white border-blue-500",       inactive: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"           },
                    { label: "Får kanskje behov",   active: "bg-amber-500 text-white border-amber-500",     inactive: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"       },
                    { label: "Ukjent om behov",     active: "bg-gray-400 text-white border-gray-400",       inactive: "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"           },
                  ].map(cat => (
                    <button
                      key={cat.label}
                      onClick={() => setNudgeSignal(cat.label)}
                      className={cn(
                        "h-10 px-3 rounded-xl border text-[0.8125rem] font-medium transition-all flex items-center justify-center gap-1.5",
                        nudgeSignal === cat.label ? cat.active + " shadow-sm" : cat.inactive
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
                onClick={async () => {
                  if (!current) return;
                  const isSomeday = nudgeDate === "someday";
                  const newDate = isSomeday ? null : (nudgeDate === "custom" ? nudgeCustomDate : nudgeDate);
                  const contactTasks = (allTasks as any[]).filter((t: any) => t.contact_id === current.contact.id);

                  if (contactTasks.length > 0) {
                    for (const task of contactTasks) {
                      const rawDesc = (task.description || "").replace(/^\[[^\]]+\]\n?/, "").replace(/\[someday\]/g, "").trim();
                      const withSignal = nudgeSignal ? (rawDesc ? `[${nudgeSignal}]\n${rawDesc}` : `[${nudgeSignal}]`) : rawDesc;
                      const finalDesc = isSomeday ? (withSignal ? withSignal + "\n[someday]" : "[someday]") : (withSignal || null);
                      await supabase.from("tasks").update({ due_date: newDate, description: finalDesc, updated_at: new Date().toISOString() }).eq("id", task.id);
                    }
                  } else {
                    const withSignal = nudgeSignal ? (isSomeday ? `[${nudgeSignal}]\n[someday]` : `[${nudgeSignal}]`) : (isSomeday ? "[someday]" : null);
                    await supabase.from("tasks").insert({
                      title: "Følg opp om behov", description: withSignal, priority: "medium",
                      due_date: newDate, contact_id: current.contact.id, company_id: current.contact.company_id,
                      assigned_to: user?.id, created_by: user?.id,
                    });
                  }

                  if (nudgeSignal && nudgeSignal !== currentSignal) {
                    setLocalSignals(prev => ({ ...prev, [current.contact.id]: nudgeSignal }));
                    await supabase.from("activities").insert({
                      type: "note", subject: nudgeSignal, description: `[${nudgeSignal}]`,
                      contact_id: current.contact.id, company_id: current.contact.company_id, created_by: user?.id,
                    });
                    queryClient.invalidateQueries({ queryKey: ["salgssenter-activities"] });
                  }

                  const actionTaken = (nudgeSignal && nudgeSignal !== currentSignal) ? "signal_updated" : "task_created";
                  await saveReview(current.contact.id, actionTaken, current);

                  queryClient.invalidateQueries({ queryKey: ["salgssenter-tasks"] });
                  setNudgeOpen(false);
                  goNext("left", true);
                }}
                className="w-full h-[52px] rounded-xl bg-foreground text-background text-[1rem] font-medium hover:opacity-90 active:scale-[0.99] transition-all"
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
          <SheetContent side="right" className="overflow-y-auto">
            <div className="p-6 max-w-2xl">
              <ContactCardContent contactId={current.contact.id} editable={true} />
            </div>
          </SheetContent>
        </Sheet>
      )}

    </div>
  );
};

export default DailyBrief;
