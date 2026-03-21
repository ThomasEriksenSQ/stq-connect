import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { differenceInDays, isPast, isToday, format, addWeeks, addMonths } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getEffectiveSignal } from "@/lib/categoryUtils";
import { Flame, List, ChevronLeft, ChevronRight, Sparkles, Phone, Calendar, Check, X, Radio, Loader2, MapPin, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

/* ── Scoring ── */
function calcHeatScore(params: {
  signal: string;
  isInnkjoper: boolean;
  hasMarkedsradar: boolean;
  hasAktivForespørsel: boolean;
  hasOverdue: boolean;
  daysSinceLastContact: number;
}): number {
  let score = 0;
  if (params.signal === "Behov nå") score += 40;
  else if (params.signal === "Får fremtidig behov") score += 20;
  else if (params.signal === "Får kanskje behov") score += 8;
  else if (params.signal === "Ukjent om behov") score += 2;
  if (params.isInnkjoper) score += 15;
  if (params.hasMarkedsradar) score += 12;
  if (params.hasMarkedsradar && params.signal === "Behov nå") score += 8;
  if (params.hasAktivForespørsel) score += 15;
  if (params.hasOverdue) score += 10;
  if (params.daysSinceLastContact > 90) score += 5;
  if (params.daysSinceLastContact > 180) score += 5;
  return score;
}

function getTemperature(params: {
  score: number;
  signal: string;
  hasOverdue: boolean;
  hasMarkedsradar: boolean;
  isInnkjoper: boolean;
}): "hett" | "lovende" | "mulig" | "sovende" {
  const { signal, hasOverdue, hasMarkedsradar, isInnkjoper, score } = params;
  if (signal === "Behov nå" && hasOverdue) return "hett";
  if (signal === "Behov nå" && hasMarkedsradar) return "hett";
  if (isInnkjoper && signal === "Behov nå") return "hett";
  if (signal === "Behov nå") return "lovende";
  if (hasMarkedsradar && signal === "Får fremtidig behov") return "lovende";
  if (isInnkjoper && signal === "Får fremtidig behov") return "lovende";
  if (score >= 35) return "lovende";
  if (signal === "Får fremtidig behov") return "mulig";
  if (signal === "Får kanskje behov") return "mulig";
  if (hasMarkedsradar) return "mulig";
  if (isInnkjoper) return "mulig";
  return "sovende";
}

const TEMP_CONFIG = {
  hett:    { label: "Hett",    bg: "bg-red-500",    text: "text-white",     dot: "bg-red-500"    },
  lovende: { label: "Lovende", bg: "bg-orange-400", text: "text-white",     dot: "bg-orange-400" },
  mulig:   { label: "Mulig",   bg: "bg-amber-400",  text: "text-amber-900", dot: "bg-amber-400"  },
  sovende: { label: "Sovende", bg: "bg-gray-200",   text: "text-gray-600",  dot: "bg-gray-400"   },
};

const DATE_CHIPS = [
  { label: "1 uke",     fn: () => addWeeks(new Date(), 1) },
  { label: "2 uker",    fn: () => addWeeks(new Date(), 2) },
  { label: "1 måned",   fn: () => addMonths(new Date(), 1) },
  { label: "3 måneder", fn: () => addMonths(new Date(), 3) },
];

const SIGNAL_CATEGORIES = [
  { label: "Behov nå",            badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { label: "Får fremtidig behov", badgeColor: "bg-blue-100 text-blue-800 border-blue-200" },
  { label: "Får kanskje behov",   badgeColor: "bg-amber-100 text-amber-800 border-amber-200" },
  { label: "Ukjent om behov",     badgeColor: "bg-gray-100 text-gray-600 border-gray-200" },
  { label: "Ikke aktuelt",        badgeColor: "bg-red-50 text-red-700 border-red-200" },
];

/* ── Types ── */
interface ScoredLead {
  contact: any;
  signal: string;
  score: number;
  temperature: "hett" | "lovende" | "mulig" | "sovende";
  lastAct: any;
  nextTask: any;
  hasOverdue: boolean;
  hasMarkedsradar: boolean;
  isInnkjoper: boolean;
  hasAktivForespørsel: boolean;
}

/* ── Main Component ── */
const DailyBrief = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"kort" | "liste">("kort");
  const [ownerFilter, setOwnerFilter] = useState(user?.id || "");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [treated, setTreated] = useState<Set<string>>(new Set());
  const [animDir, setAnimDir] = useState<"left" | "right" | null>(null);
  const [aiText, setAiText] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [activeForm, setActiveForm] = useState<"call" | "meeting" | "task" | "snooze" | "signal" | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDate, setFormDate] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);

  // Set owner filter when user loads
  useEffect(() => {
    if (user?.id && !ownerFilter) setOwnerFilter(user.id);
  }, [user?.id]);

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: rawContacts = [], isLoading } = useQuery({
    queryKey: ["salgssenter-contacts", ownerFilter],
    queryFn: async () => {
      let q = supabase
        .from("contacts")
        .select("*, companies(id, name, city)")
        .or("ikke_aktuell_kontakt.is.null,ikke_aktuell_kontakt.eq.false");
      if (ownerFilter && ownerFilter !== "alle") {
        q = q.eq("owner_id", ownerFilter);
      }
      const { data, error } = await q.limit(500);
      if (error) throw error;
      return data;
    },
  });

  const contactIds = useMemo(() => rawContacts.map((c: any) => c.id), [rawContacts]);
  const companyIds = useMemo(() => [...new Set(rawContacts.map((c: any) => c.company_id).filter(Boolean))], [rawContacts]);

  const { data: allActivities = [] } = useQuery({
    queryKey: ["salgssenter-activities", contactIds],
    queryFn: async () => {
      if (contactIds.length === 0) return [];
      const { data, error } = await supabase
        .from("activities").select("*")
        .in("contact_id", contactIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: contactIds.length > 0,
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ["salgssenter-tasks", contactIds],
    queryFn: async () => {
      if (contactIds.length === 0) return [];
      const { data, error } = await supabase
        .from("tasks").select("*")
        .in("contact_id", contactIds)
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
    enabled: contactIds.length > 0,
  });

  const { data: techProfiles = [] } = useQuery({
    queryKey: ["salgssenter-tech", companyIds],
    queryFn: async () => {
      if (companyIds.length === 0) return [];
      const { data, error } = await supabase
        .from("company_tech_profile")
        .select("company_id, konsulent_hyppighet, sist_fra_finn")
        .in("company_id", companyIds);
      if (error) throw error;
      return data;
    },
    enabled: companyIds.length > 0,
  });

  const { data: foresporsler = [] } = useQuery({
    queryKey: ["salgssenter-foresporsler"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foresporsler")
        .select("id, selskap_id, status")
        .not("status", "in", '("avsluttet","tapt")');
      if (error) throw error;
      return data;
    },
  });

  // Build scored leads
  const scoredLeads = useMemo<ScoredLead[]>(() => {
    return rawContacts
      .map((contact: any) => {
        const contactActs = allActivities.filter((a: any) => a.contact_id === contact.id);
        const contactTasks = allTasks.filter((t: any) => t.contact_id === contact.id);
        const signal = getEffectiveSignal(
          contactActs.map((a: any) => ({ created_at: a.created_at, subject: a.subject, description: a.description })),
          contactTasks.map((t: any) => ({ created_at: t.created_at, title: t.title, description: t.description, due_date: t.due_date }))
        );
        if (signal === "Ikke aktuelt") return null;

        const lastAct = contactActs[0];
        const daysSince = lastAct ? differenceInDays(new Date(), new Date(lastAct.created_at)) : 999;
        const nextTask = contactTasks.find((t: any) => t.due_date);
        const hasOverdue = nextTask ? isPast(new Date(nextTask.due_date)) && !isToday(new Date(nextTask.due_date)) : false;
        const techProfile = techProfiles.find((tp: any) => tp.company_id === contact.company_id);
        const hasMarkedsradar = !!(techProfile?.sist_fra_finn &&
          differenceInDays(new Date(), new Date(techProfile.sist_fra_finn)) <= 90);
        const hasAktivForespørsel = foresporsler.some((f: any) => f.selskap_id === contact.company_id);
        const isInnkjoper = !!contact.call_list;

        const score = calcHeatScore({ signal, isInnkjoper, hasMarkedsradar, hasAktivForespørsel, hasOverdue, daysSinceLastContact: daysSince });
        const temperature = getTemperature({ score, signal, hasOverdue, hasMarkedsradar, isInnkjoper });

        return { contact, signal, score, temperature, lastAct, nextTask, hasOverdue, hasMarkedsradar, isInnkjoper, hasAktivForespørsel };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => {
        const tempOrder = { hett: 0, lovende: 1, mulig: 2, sovende: 3 };
        if (tempOrder[a.temperature as keyof typeof tempOrder] !== tempOrder[b.temperature as keyof typeof tempOrder])
          return tempOrder[a.temperature as keyof typeof tempOrder] - tempOrder[b.temperature as keyof typeof tempOrder];
        return b.score - a.score;
      }) as ScoredLead[];
  }, [rawContacts, allActivities, allTasks, techProfiles, foresporsler]);

  const queue = useMemo(() => scoredLeads.filter(l => !treated.has(l.contact.id)), [scoredLeads, treated]);
  const current = queue[currentIndex];
  const totalToday = scoredLeads.length;
  const treatedCount = treated.size;

  // Stats
  const forfalt = allTasks.filter((t: any) => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))).length;
  const iDag = allTasks.filter((t: any) => t.due_date && isToday(new Date(t.due_date))).length;
  const behovNaa = scoredLeads.filter(l => l.signal === "Behov nå").length;

  const goNext = useCallback((dir: "left" | "right" = "left") => {
    if (isAnimating) return;
    setIsAnimating(true);
    setAnimDir(dir);
    setTimeout(() => {
      setActiveForm(null);
      setFormTitle(""); setFormCategory(""); setFormDescription(""); setFormDate("");
      if (dir === "left") {
        setCurrentIndex(i => Math.min(i + 1, queue.length - 1));
      } else {
        setCurrentIndex(i => Math.max(i - 1, 0));
      }
      setAnimDir(null);
      setIsAnimating(false);
    }, 220);
  }, [isAnimating, queue.length]);

  const markTreated = useCallback((contactId: string) => {
    setTreated(prev => new Set([...prev, contactId]));
    setTimeout(() => goNext("left"), 100);
  }, [goNext]);

  // AI briefing via chat edge function
  const loadAi = useCallback(async (lead: ScoredLead) => {
    if (!lead || aiText[lead.contact.id] || aiLoading === lead.contact.id) return;
    setAiLoading(lead.contact.id);
    try {
      const lastActText = lead.lastAct
        ? `Siste aktivitet: "${lead.lastAct.subject}" (${format(new Date(lead.lastAct.created_at), "d. MMM yyyy", { locale: nb })})`
        : "Ingen aktiviteter registrert.";
      const nextTaskText = lead.nextTask
        ? `Neste oppfølging: "${lead.nextTask.title}" (${format(new Date(lead.nextTask.due_date), "d. MMM yyyy", { locale: nb })})`
        : "Ingen planlagte oppfølginger.";

      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          system: "Du er en erfaren konsulentmegler-assistent. Gi en kort, konkret briefing (maks 2 setninger) om hva selger bør si/fokusere på i neste kontakt med denne personen. Svar kun med briefing-teksten, ingen innledning.",
          messages: [{
            role: "user",
            content: `Kontakt: ${lead.contact.first_name} ${lead.contact.last_name}, ${lead.contact.title || ""} hos ${lead.contact.companies?.name || ""}.\nSignal: ${lead.signal}.\n${lastActText}\n${nextTaskText}\nInnkjøper: ${lead.isInnkjoper ? "Ja" : "Nei"}.\nMarkedsradar aktiv: ${lead.hasMarkedsradar ? "Ja" : "Nei"}.`
          }]
        }
      });
      if (error) throw error;
      const text = data?.text || "Ingen briefing tilgjengelig.";
      setAiText(prev => ({ ...prev, [lead.contact.id]: text }));
    } catch {
      setAiText(prev => ({ ...prev, [lead.contact.id]: "Kunne ikke generere briefing." }));
    } finally {
      setAiLoading(null);
    }
  }, [aiText, aiLoading]);

  useEffect(() => {
    if (current) loadAi(current);
  }, [current?.contact.id]);

  // Mutations
  const createActivityMutation = useMutation({
    mutationFn: async ({ type, subject, description, contactId, companyId }: any) => {
      const { error } = await supabase.from("activities").insert({
        type, subject, description: description || null,
        contact_id: contactId, company_id: companyId, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salgssenter-activities"] });
      queryClient.invalidateQueries({ queryKey: ["contact-activities"] });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async ({ title, description, dueDate, contactId, companyId }: any) => {
      const { error } = await supabase.from("tasks").insert({
        title, description: description || null, priority: "medium",
        due_date: dueDate, contact_id: contactId, company_id: companyId,
        assigned_to: user?.id, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salgssenter-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["contact-tasks"] });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, dueDate }: { taskId: string; dueDate: string }) => {
      const { error } = await supabase.from("tasks").update({ due_date: dueDate, updated_at: new Date().toISOString() }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["salgssenter-tasks"] }),
  });

  const markIkkeRelevantMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase.from("contacts").update({ ikke_aktuell_kontakt: true }).eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["salgssenter-contacts"] }),
  });

  const handleLoggSamtale = () => {
    if (!formTitle || !formCategory || !current) return;
    createActivityMutation.mutate({
      type: activeForm === "call" ? "call" : "meeting",
      subject: formTitle,
      description: formCategory ? `[${formCategory}]\n${formDescription}` : formDescription,
      contactId: current.contact.id,
      companyId: current.contact.company_id,
    }, {
      onSuccess: () => {
        toast.success(activeForm === "call" ? "Samtale logget" : "Møtereferat logget");
        markTreated(current.contact.id);
      }
    });
  };

  const handleNyOppfolging = () => {
    if (!formTitle || !formDate || !current) return;
    createTaskMutation.mutate({
      title: formTitle,
      description: formCategory ? `[${formCategory}]` : null,
      dueDate: formDate,
      contactId: current.contact.id,
      companyId: current.contact.company_id,
    }, {
      onSuccess: () => {
        toast.success("Oppfølging satt");
        markTreated(current.contact.id);
      }
    });
  };

  const handleSjekket = () => {
    if (!current) return;
    createActivityMutation.mutate({
      type: "check",
      subject: "Sjekket - ingen endring",
      description: null,
      contactId: current.contact.id,
      companyId: current.contact.company_id,
    }, {
      onSuccess: () => {
        toast.success("Sjekket ✓");
        markTreated(current.contact.id);
      }
    });
  };

  const handleIkkeRelevant = () => {
    if (!current) return;
    markIkkeRelevantMutation.mutate(current.contact.id, {
      onSuccess: () => {
        toast.success("Merket som ikke relevant");
        markTreated(current.contact.id);
      }
    });
  };

  const handleUtsett = (taskId: string, newDate: string) => {
    updateTaskMutation.mutate({ taskId, dueDate: newDate }, {
      onSuccess: () => toast.success("Oppfølging utsatt")
    });
    setActiveForm(null);
  };

  const progress = totalToday > 0 ? (treatedCount / totalToday) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* ── Stats ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "FORFALT", value: forfalt, color: forfalt > 0 ? "text-destructive" : "text-foreground" },
          { label: "I DAG", value: iDag, color: iDag > 0 ? "text-blue-600" : "text-foreground" },
          { label: "BEHOV NÅ", value: behovNaa, color: behovNaa > 0 ? "text-emerald-600" : "text-foreground" },
          { label: "FORESPØRSLER", value: foresporsler.length, color: "text-foreground" },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-lg px-4 py-3 text-center">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{stat.label}</p>
            <p className={cn("text-[1.5rem] font-bold", stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ── Mode + Owner filter ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1">
          {[
            { id: user?.id || "", label: "Mine" },
            { id: "alle", label: "Alle" },
            ...allProfiles.filter(p => p.id !== user?.id).map(p => ({ id: p.id, label: p.full_name.split(" ")[0] }))
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => { setOwnerFilter(opt.id); setCurrentIndex(0); setTreated(new Set()); }}
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

        <div className="flex items-center">
          <button
            onClick={() => setViewMode("kort")}
            className={cn(
              "h-8 px-3 text-[0.8125rem] rounded-l-full border transition-colors inline-flex items-center gap-1.5",
              viewMode === "kort" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:bg-secondary"
            )}
          >
            <Flame className="h-3.5 w-3.5" /> Kortvisning
          </button>
          <button
            onClick={() => setViewMode("liste")}
            className={cn(
              "h-8 px-3 text-[0.8125rem] rounded-r-full border-t border-b border-r transition-colors inline-flex items-center gap-1.5",
              viewMode === "liste" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:bg-secondary"
            )}
          >
            <List className="h-3.5 w-3.5" /> Liste
          </button>
        </div>
      </div>

      {viewMode === "kort" && (
        <div className="space-y-4">
          {/* ── Progressbar ── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[0.75rem] text-muted-foreground">
              <span>{treatedCount} behandlet i dag</span>
              <span>{queue.length} igjen</span>
            </div>
            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* ── Card ── */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : queue.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <p className="text-3xl mb-2">🎉</p>
              <p className="text-[1.125rem] font-semibold text-foreground">Køen er tom!</p>
              <p className="text-[0.875rem] text-muted-foreground mt-1">Du har behandlet alle leads i dag.</p>
            </div>
          ) : current ? (
            <div
              className={cn(
                "bg-card border border-border rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden transition-all duration-200",
                animDir === "left" && "translate-x-[-8px] opacity-90",
                animDir === "right" && "translate-x-[8px] opacity-90"
              )}
            >
              {/* Temperature bar */}
              <div className={cn("h-1", TEMP_CONFIG[current.temperature].bg)} />

              <div className="p-5 space-y-4">
                {/* ── Header ── */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-[0.6875rem] font-bold rounded-full px-2 py-0.5", TEMP_CONFIG[current.temperature].bg, TEMP_CONFIG[current.temperature].text)}>
                      {TEMP_CONFIG[current.temperature].label}
                    </span>
                    {current.isInnkjoper && (
                      <span className="rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 text-[0.625rem] font-bold">
                        INN
                      </span>
                    )}
                    {current.hasMarkedsradar && (
                      <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[0.625rem] font-bold inline-flex items-center gap-1">
                        <Radio className="h-3 w-3" /> Annonserer
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => navigate(`/kontakter/${current.contact.id}`)}
                    className="text-[1.375rem] font-bold text-foreground hover:text-primary transition-colors text-left"
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
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" />
                          {current.contact.companies.city}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* ── Snapshot ── */}
                <div className="space-y-1.5">
                  {current.lastAct && (
                    <div className="flex items-baseline gap-1.5 text-[0.8125rem]">
                      <span className="text-muted-foreground font-medium shrink-0">Siste:</span>
                      <span className="text-foreground">"{current.lastAct.subject}"</span>
                      <span className="text-muted-foreground text-[0.75rem]">
                        {format(new Date(current.lastAct.created_at), "d. MMM yyyy", { locale: nb })}
                      </span>
                    </div>
                  )}
                  {current.nextTask && (() => {
                    const overdue = isPast(new Date(current.nextTask.due_date)) && !isToday(new Date(current.nextTask.due_date));
                    return (
                      <div className="flex items-baseline gap-1.5 text-[0.8125rem]">
                        <span className="text-muted-foreground font-medium shrink-0">Neste:</span>
                        <span className="text-foreground">{current.nextTask.title}</span>
                        <span className={cn("text-[0.75rem]", overdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                          {format(new Date(current.nextTask.due_date), "d. MMM yyyy", { locale: nb })}
                        </span>
                        {overdue && (
                          <button
                            onClick={() => setActiveForm(activeForm === "snooze" ? null : "snooze")}
                            className="shrink-0 text-[0.6875rem] text-primary hover:underline"
                          >
                            Utsett
                          </button>
                        )}
                      </div>
                    );
                  })()}
                  {!current.lastAct && !current.nextTask && (
                    <p className="text-[0.8125rem] text-muted-foreground/60">Ingen aktiviteter eller oppfølginger ennå</p>
                  )}
                </div>

                {/* Snooze form */}
                {activeForm === "snooze" && current.nextTask && (
                  <div className="rounded-lg border border-border p-3 space-y-2 animate-in slide-in-from-top-1 duration-150">
                    <p className="text-[0.75rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">Utsett oppfølging til:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {DATE_CHIPS.map(chip => (
                        <button
                          key={chip.label}
                          onClick={() => handleUtsett(current.nextTask!.id, format(chip.fn(), "yyyy-MM-dd"))}
                          className="h-7 px-3 text-[0.75rem] rounded-full border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── AI Briefing ── */}
                <div className="rounded-lg bg-secondary/40 border border-border/50 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                    <Sparkles className="h-3 w-3" />
                    AI-briefing
                  </div>
                  {aiLoading === current.contact.id ? (
                    <div className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Analyserer kontakten...
                    </div>
                  ) : aiText[current.contact.id] ? (
                    <p className="text-[0.8125rem] text-foreground/80 leading-relaxed">{aiText[current.contact.id]}</p>
                  ) : (
                    <p className="text-[0.8125rem] text-muted-foreground">Laster briefing...</p>
                  )}
                </div>

                {/* ── Inline forms ── */}
                {(activeForm === "call" || activeForm === "meeting") && (
                  <div className="rounded-lg border border-border p-4 space-y-3 animate-in slide-in-from-top-1 duration-150">
                    <p className="text-[0.75rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                      {activeForm === "call" ? "Logg samtale" : "Logg møtereferat"}
                    </p>
                    <input
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      placeholder="Tittel (eks: Ringte om C++ behov)"
                      className="w-full text-[0.875rem] border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {SIGNAL_CATEGORIES.map(cat => (
                        <button
                          key={cat.label}
                          onClick={() => setFormCategory(cat.label)}
                          className={cn(
                            "h-7 px-2.5 text-[0.75rem] rounded-full border transition-colors",
                            formCategory === cat.label
                              ? "bg-foreground text-background border-foreground font-medium"
                              : "border-border text-muted-foreground hover:bg-secondary"
                          )}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={formDescription}
                      onChange={e => setFormDescription(e.target.value)}
                      placeholder="Beskrivelse (valgfritt)"
                      rows={2}
                      className="w-full text-[0.875rem] border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleLoggSamtale}
                        disabled={!formTitle || !formCategory}
                        className="h-8 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-colors"
                      >
                        Lagre og neste
                      </button>
                      <button
                        onClick={() => setActiveForm(null)}
                        className="h-8 px-3 text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Avbryt
                      </button>
                    </div>
                  </div>
                )}

                {activeForm === "task" && (
                  <div className="rounded-lg border border-border p-4 space-y-3 animate-in slide-in-from-top-1 duration-150">
                    <p className="text-[0.75rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">Ny oppfølging</p>
                    <input
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      placeholder="Hva skal følges opp?"
                      className="w-full text-[0.875rem] border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {SIGNAL_CATEGORIES.map(cat => (
                        <button
                          key={cat.label}
                          onClick={() => setFormCategory(cat.label)}
                          className={cn(
                            "h-7 px-2.5 text-[0.75rem] rounded-full border transition-colors",
                            formCategory === cat.label
                              ? "bg-foreground text-background border-foreground font-medium"
                              : "border-border text-muted-foreground hover:bg-secondary"
                          )}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {DATE_CHIPS.map(chip => (
                        <button
                          key={chip.label}
                          onClick={() => setFormDate(format(chip.fn(), "yyyy-MM-dd"))}
                          className={cn(
                            "h-7 px-2.5 text-[0.75rem] rounded-full border transition-colors",
                            formDate === format(chip.fn(), "yyyy-MM-dd")
                              ? "bg-primary/10 border-primary/30 text-primary font-medium"
                              : "border-border text-muted-foreground hover:bg-secondary"
                          )}
                        >
                          {chip.label}
                        </button>
                      ))}
                      <input
                        type="date"
                        value={formDate}
                        onChange={e => setFormDate(e.target.value)}
                        className="h-7 px-2 text-[0.75rem] rounded-full border border-border text-muted-foreground bg-background"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleNyOppfolging}
                        disabled={!formTitle || !formDate}
                        className="h-8 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-colors"
                      >
                        Lagre og neste
                      </button>
                      <button
                        onClick={() => setActiveForm(null)}
                        className="h-8 px-3 text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Avbryt
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Action buttons ── */}
                {!activeForm && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { setActiveForm("call"); setFormTitle(""); setFormCategory(""); setFormDescription(""); }}
                      className="h-11 rounded-xl bg-[hsl(var(--success))] text-white text-[0.875rem] font-medium hover:opacity-90 transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <Phone className="h-4 w-4" /> Logg samtale
                    </button>
                    <button
                      onClick={() => { setActiveForm("task"); setFormTitle("Følg opp om behov"); setFormCategory(""); setFormDate(""); }}
                      className="h-11 rounded-xl border border-border bg-background text-foreground text-[0.875rem] font-medium hover:bg-secondary transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <Calendar className="h-4 w-4" /> Ny oppfølging
                    </button>
                    <button
                      onClick={handleSjekket}
                      className="h-11 rounded-xl border border-border bg-background text-muted-foreground text-[0.875rem] font-medium hover:bg-secondary transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <Check className="h-4 w-4" /> Sjekket - neste
                    </button>
                    <button
                      onClick={handleIkkeRelevant}
                      className="h-11 rounded-xl border border-red-200 bg-red-50 text-red-700 text-[0.875rem] font-medium hover:bg-red-100 transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <X className="h-4 w-4" /> Ikke relevant
                    </button>
                  </div>
                )}

                {/* ── Navigation ── */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => goNext("right")}
                    disabled={currentIndex === 0}
                    className="inline-flex items-center gap-1 text-[0.8125rem] text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" /> Forrige
                  </button>
                  <div className="flex items-center gap-1">
                    {queue.slice(Math.max(0, currentIndex - 2), currentIndex + 5).map((_, i) => {
                      const idx = Math.max(0, currentIndex - 2) + i;
                      return (
                        <button
                          key={idx}
                          onClick={() => { setCurrentIndex(idx); setActiveForm(null); }}
                          className={cn(
                            "rounded-full transition-all",
                            idx === currentIndex ? "w-4 h-2 bg-primary" : "w-2 h-2 bg-border hover:bg-muted-foreground/40"
                          )}
                        />
                      );
                    })}
                  </div>
                  <button
                    onClick={() => goNext("left")}
                    disabled={currentIndex >= queue.length - 1}
                    className="inline-flex items-center gap-1 text-[0.8125rem] text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                  >
                    Neste <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {viewMode === "liste" && (
        <div className="bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.07)] overflow-hidden">
          <div className="divide-y divide-border">
            {scoredLeads.map(lead => {
              const temp = TEMP_CONFIG[lead.temperature];
              return (
                <button
                  key={lead.contact.id}
                  onClick={() => navigate(`/kontakter/${lead.contact.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                >
                  <div className={cn("w-2 h-2 rounded-full shrink-0", temp.dot)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[0.875rem] font-medium text-foreground truncate">
                        {lead.contact.first_name} {lead.contact.last_name}
                      </span>
                      {lead.isInnkjoper && (
                        <span className="rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0 text-[0.625rem] font-medium shrink-0">INN</span>
                      )}
                      {lead.hasMarkedsradar && (
                        <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0 text-[0.625rem] font-medium shrink-0">📡</span>
                      )}
                    </div>
                    <p className="text-[0.75rem] text-muted-foreground truncate">
                      {lead.contact.companies?.name}
                      {lead.signal && ` · ${lead.signal}`}
                    </p>
                  </div>
                  <span className={cn("text-[0.75rem] font-medium shrink-0 px-2 py-0.5 rounded-full", temp.bg, temp.text)}>
                    {temp.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyBrief;
