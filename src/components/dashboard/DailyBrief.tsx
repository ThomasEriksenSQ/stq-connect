import { useState, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { differenceInDays, isPast, isToday, format, addWeeks, addMonths } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getEffectiveSignal, CATEGORIES } from "@/lib/categoryUtils";
import { Loader2, ExternalLink, ChevronDown, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ContactCardContent } from "@/components/ContactCardContent";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cleanDescription } from "@/lib/cleanDescription";

/* ── Scoring ── */
function calcHeatScore(params: {
  signal: string;
  isInnkjoper: boolean;
  hasFinnAd: boolean;
  hasOverdue: boolean;
  daysSinceLastContact: number;
}): number {
  let score = 0;
  if (params.signal === "Behov nå") score += 40;
  else if (params.signal === "Får fremtidig behov") score += 20;
  else if (params.signal === "Får kanskje behov") score += 8;
  else if (params.signal === "Ukjent om behov") score += 2;
  if (params.isInnkjoper) score += 15;
  if (params.hasFinnAd) score += 12;
  if (params.hasOverdue) score += 10;
  if (params.daysSinceLastContact > 90) score += 5;
  if (params.daysSinceLastContact > 180) score += 5;
  return score;
}

function getTemperatureLabel(score: number): { label: string; emoji: string; bg: string; text: string; border: string } {
  if (score >= 50) return { label: "Hett", emoji: "🔥", bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-200" };
  if (score >= 25) return { label: "Lovende", emoji: "", bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-200" };
  if (score >= 10) return { label: "Mulig", emoji: "", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" };
  return { label: "Sovende", emoji: "", bg: "bg-gray-100", text: "text-gray-500", border: "border-gray-200" };
}

const DATE_CHIPS = [
  { label: "1 uke", fn: () => addWeeks(new Date(), 1) },
  { label: "2 uker", fn: () => addWeeks(new Date(), 2) },
  { label: "1 måned", fn: () => addMonths(new Date(), 1) },
  { label: "3 måneder", fn: () => addMonths(new Date(), 3) },
];

interface ScoredLead {
  contact: any;
  signal: string;
  score: number;
  temp: ReturnType<typeof getTemperatureLabel>;
  lastAct: any;
  nextTask: any;
  hasOverdue: boolean;
  hasFinnAd: any; // the finn_annonser row or null
  isInnkjoper: boolean;
}

/* ── Main Component ── */
const DailyBrief = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cardRef = useRef<HTMLDivElement>(null);

  const [idx, setIdx] = useState(0);
  const [treated, setTreated] = useState<Set<string>>(new Set());
  const [signalOpen, setSignalOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [sheetContactId, setSheetContactId] = useState<string | null>(null);

  // ── Data queries ──
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["dailybrief-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select(`
          id, first_name, last_name, title, company_id,
          cv_email, call_list, ikke_aktuell_kontakt,
          companies(id, name, city),
          activities(created_at, subject, description),
          tasks(id, created_at, title, description, due_date, status)
        `)
        .or("ikke_aktuell_kontakt.is.null,ikke_aktuell_kontakt.eq.false")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: finnAds = [] } = useQuery({
    queryKey: ["finn-annonser"],
    queryFn: async () => {
      const { data } = await supabase
        .from("finn_annonser")
        .select("*")
        .order("dato", { ascending: false });
      return data || [];
    },
  });

  // ── Scored leads ──
  const scoredLeads = useMemo<ScoredLead[]>(() => {
    const now = new Date();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    return contacts
      .map((c: any) => {
        const acts = (c.activities || []).sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));
        const tasks = (c.tasks || []).filter((t: any) => t.status !== "done");
        const signal = getEffectiveSignal(
          acts.map((a: any) => ({ created_at: a.created_at, subject: a.subject, description: a.description })),
          tasks.map((t: any) => ({ created_at: t.created_at, title: t.title, description: t.description, due_date: t.due_date }))
        );
        if (signal === "Ikke aktuelt") return null;

        const lastAct = acts[0] || null;
        const daysSince = lastAct ? differenceInDays(now, new Date(lastAct.created_at)) : 999;
        const nextTask = tasks
          .filter((t: any) => t.due_date)
          .sort((a: any, b: any) => (a.due_date || "").localeCompare(b.due_date || ""))[0] || null;
        const hasOverdue = nextTask ? isPast(new Date(nextTask.due_date)) && !isToday(new Date(nextTask.due_date)) : false;

        // Finn.no match — check if company name appears in finn_annonser in last 90 days
        const companyName = c.companies?.name?.toLowerCase();
        const finnAd = companyName
          ? finnAds.find((fa: any) =>
              fa.selskap?.toLowerCase().includes(companyName) &&
              new Date(fa.dato) >= ninetyDaysAgo
            )
          : null;

        const isInnkjoper = !!c.call_list;
        const score = calcHeatScore({ signal, isInnkjoper, hasFinnAd: !!finnAd, hasOverdue, daysSinceLastContact: daysSince });
        const temp = getTemperatureLabel(score);

        return { contact: c, signal, score, temp, lastAct, nextTask, hasOverdue, hasFinnAd: finnAd, isInnkjoper };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.score - a.score) as ScoredLead[];
  }, [contacts, finnAds]);

  const current = scoredLeads[idx];
  const total = scoredLeads.length;

  // ── Swipe animation ──
  const goNext = useCallback((dir: "left" | "right" = "left") => {
    if (isAnimating) return;
    const nextIdx = dir === "left" ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= total) return;
    setIsAnimating(true);
    const card = cardRef.current;
    if (card) {
      card.style.transition = "transform 200ms ease, opacity 200ms ease";
      card.style.transform = dir === "left" ? "translateX(-52px)" : "translateX(52px)";
      card.style.opacity = "0";
    }
    setTimeout(() => {
      setIdx(nextIdx);
      if (card) {
        card.style.transition = "none";
        card.style.transform = dir === "left" ? "translateX(52px)" : "translateX(-52px)";
        card.style.opacity = "0";
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (card) {
            card.style.transition = "transform 180ms ease-out, opacity 180ms ease-out";
            card.style.transform = "translateX(0)";
            card.style.opacity = "1";
          }
          setIsAnimating(false);
        });
      });
    }, 200);
  }, [isAnimating, idx, total]);

  // ── Mutations ──
  const createActivityMutation = useMutation({
    mutationFn: async (params: { type: string; subject: string; description?: string | null; contactId: string; companyId: string | null }) => {
      const { error } = await supabase.from("activities").insert({
        type: params.type, subject: params.subject, description: params.description || null,
        contact_id: params.contactId, company_id: params.companyId, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dailybrief-contacts"] });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, dueDate }: { taskId: string; dueDate: string }) => {
      const { error } = await supabase.from("tasks").update({ due_date: dueDate, updated_at: new Date().toISOString() }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dailybrief-contacts"] }),
  });

  const toggleContactField = useCallback(async (contactId: string, field: "call_list" | "cv_email" | "ikke_aktuell_kontakt", currentVal: boolean) => {
    await supabase.from("contacts").update({ [field]: !currentVal }).eq("id", contactId);
    queryClient.invalidateQueries({ queryKey: ["dailybrief-contacts"] });
  }, [queryClient]);

  const handleSignalChange = useCallback((label: string) => {
    if (!current) return;
    createActivityMutation.mutate({
      type: "note", subject: label,
      contactId: current.contact.id, companyId: current.contact.company_id,
    }, { onSuccess: () => toast.success(`Signal: ${label}`) });
  }, [current, createActivityMutation]);

  const handleIkkeRelevant = useCallback(() => {
    if (!current) return;
    toggleContactField(current.contact.id, "ikke_aktuell_kontakt", false);
    toast.success("Merket som ikke relevant");
    goNext("left");
  }, [current, toggleContactField, goNext]);

  const progress = total > 0 ? (treated.size / total) * 100 : 0;

  // ── Done state ──
  if (!isLoading && idx >= total && total > 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-3xl mb-3">🎉</p>
        <p className="text-[1.125rem] font-semibold text-foreground">Alt gjennomgått for i dag</p>
        <p className="text-[0.8125rem] text-muted-foreground mt-1">{treated.size} kontakter behandlet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Counter row ── */}
      <div className="flex justify-between text-[0.75rem] text-muted-foreground" style={{ padding: "0 42px" }}>
        <span>{treated.size} behandlet i dag</span>
        <span>{Math.max(0, total - idx)} igjen</span>
      </div>

      {/* ── Card layout ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : total === 0 ? (
        <div className="text-center py-16">
          <p className="text-[0.9375rem] text-muted-foreground">Ingen kontakter å vise.</p>
        </div>
      ) : current ? (
        <div className="flex items-center gap-2">
          {/* Left nav chevron */}
          <button
            onClick={() => goNext("right")}
            disabled={idx === 0}
            className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground/40 hover:text-foreground hover:bg-secondary disabled:opacity-20 disabled:pointer-events-none transition-all"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Card */}
          <div ref={cardRef} className="flex-1 max-w-[480px] rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            {/* 1. Progressbar */}
            <div className="h-[3px] bg-border">
              <div className="h-full bg-amber-400 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
            </div>

            {/* 2. Header row */}
            <div className="flex items-center justify-between" style={{ padding: "16px 18px 0" }}>
              <span className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                current.temp.bg, current.temp.text, current.temp.border
              )}>
                {current.temp.emoji && `${current.temp.emoji} `}{current.temp.label}
              </span>
              <button
                onClick={() => setSheetContactId(current.contact.id)}
                className="w-[26px] h-[26px] rounded-lg bg-secondary border border-border inline-flex items-center justify-center hover:bg-muted transition-colors"
              >
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>

            {/* 3. Name + meta */}
            <div style={{ padding: "10px 18px 0" }}>
              <p className="text-[19px] font-medium text-foreground">
                {current.contact.first_name} {current.contact.last_name}
              </p>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {current.contact.title && <>{current.contact.title} · </>}
                {current.contact.companies?.name && (
                  <button
                    onClick={() => navigate(`/selskaper/${current.contact.company_id}`)}
                    className="text-primary hover:underline"
                  >
                    {current.contact.companies.name}
                  </button>
                )}
                {current.contact.companies?.city && <> · {current.contact.companies.city}</>}
              </p>
            </div>

            {/* 4. Snapshot row */}
            <div className="mt-[10px] mx-[18px]">
              <div className="border border-border rounded-xl overflow-hidden grid grid-cols-2 divide-x divide-border">
                {/* SISTE */}
                <div className="p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-1">Siste</p>
                  {current.lastAct ? (
                    <>
                      <p className="text-[13px] font-medium text-foreground truncate">
                        {cleanDescription(current.lastAct.subject) || current.lastAct.subject}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {format(new Date(current.lastAct.created_at), "d. MMM yyyy", { locale: nb })}
                        {" · "}
                        {differenceInDays(new Date(), new Date(current.lastAct.created_at))} dager siden
                      </p>
                    </>
                  ) : (
                    <p className="text-[12px] text-muted-foreground/60 italic">Ingen aktiviteter</p>
                  )}
                </div>

                {/* NESTE OPPFØLGING */}
                <div className="p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-1">Neste oppfølging</p>
                  {current.nextTask ? (() => {
                    const overdue = isPast(new Date(current.nextTask.due_date)) && !isToday(new Date(current.nextTask.due_date));
                    return (
                      <>
                        <p className="text-[13px] font-medium text-foreground truncate">{current.nextTask.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={cn("text-[11px]", overdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                            {format(new Date(current.nextTask.due_date), "d. MMM yyyy", { locale: nb })}
                          </span>
                          {overdue && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="text-[11px] text-muted-foreground/60 hover:text-amber-600 transition-colors">
                                  ↷ utsett
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-2 flex gap-1.5" align="start">
                                {DATE_CHIPS.map(chip => (
                                  <button
                                    key={chip.label}
                                    onClick={() => {
                                      updateTaskMutation.mutate({ taskId: current.nextTask.id, dueDate: format(chip.fn(), "yyyy-MM-dd") });
                                      toast.success("Oppfølging utsatt");
                                    }}
                                    className="h-7 px-2.5 text-[0.75rem] rounded-full border border-border text-muted-foreground hover:bg-secondary transition-colors"
                                  >
                                    {chip.label}
                                  </button>
                                ))}
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                      </>
                    );
                  })() : (
                    <p className="text-[12px] text-muted-foreground/60 italic">Ingen planlagt</p>
                  )}
                </div>
              </div>
            </div>

            {/* 5. Finn.no strip */}
            {current.hasFinnAd && (
              <div className="mt-2 mx-[18px]">
                <div className="bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-2.5" style={{ padding: "9px 12px" }}>
                  <div className="w-[22px] h-[22px] bg-blue-500 rounded-md flex items-center justify-center shrink-0">
                    <div className="w-2 h-2 bg-white rounded-sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-blue-800 truncate">
                      Finn.no: {current.hasFinnAd.teknologier_array?.join(", ") || current.hasFinnAd.teknologier || current.hasFinnAd.stillingsrolle || "Konsulent"}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {format(new Date(current.hasFinnAd.dato), "d. MMM yyyy", { locale: nb })}
                      {" · "}{differenceInDays(new Date(), new Date(current.hasFinnAd.dato))} dager siden
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-100 text-blue-700 border border-blue-200 text-[10px] px-2 py-0.5 font-medium shrink-0">
                    Aktiv nå
                  </span>
                </div>
              </div>
            )}

            <div className="mt-[10px] border-t border-border" style={{ padding: "10px 18px 0" }}>
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Signal dropdown */}
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setSignalOpen(!signalOpen)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-[10px] py-[4px] text-[11px] font-medium cursor-pointer transition-colors",
                      current.signal
                        ? CATEGORIES.find(c => c.label === current.signal)?.badgeColor || "border-border bg-secondary text-muted-foreground"
                        : "border-border bg-secondary text-muted-foreground"
                    )}
                  >
                    {current.signal || "Signal"} <ChevronDown className="h-3 w-3 opacity-50" />
                  </button>
                  {signalOpen && (
                    <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-md overflow-hidden min-w-[190px]">
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat.label}
                          onClick={() => {
                            handleSignalChange(cat.label);
                            setSignalOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-[0.8125rem] hover:bg-secondary transition-colors text-left"
                        >
                          <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold", cat.badgeColor)}>
                            {cat.label}
                          </span>
                          {current.signal === cat.label && <Check className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Innkjøper toggle */}
                <button
                  onClick={() => toggleContactField(current.contact.id, "call_list", current.contact.call_list)}
                  className={cn(
                    "rounded-full border px-[10px] py-[4px] text-[11px] font-medium cursor-pointer transition-colors",
                    current.contact.call_list
                      ? "bg-amber-100 text-amber-800 border-amber-200"
                      : "border-border bg-secondary text-muted-foreground"
                  )}
                >
                  {current.contact.call_list ? "✓ " : ""}Innkjøper
                </button>

                {/* CV-epost toggle */}
                <button
                  onClick={() => toggleContactField(current.contact.id, "cv_email", current.contact.cv_email)}
                  className={cn(
                    "rounded-full border px-[10px] py-[4px] text-[11px] font-medium cursor-pointer transition-colors",
                    current.contact.cv_email
                      ? "bg-blue-100 text-blue-800 border-blue-200"
                      : "border-border bg-secondary text-muted-foreground"
                  )}
                >
                  {current.contact.cv_email ? "✓ " : ""}CV-epost
                </button>

                {/* Ikke relevant person */}
                <button
                  onClick={handleIkkeRelevant}
                  className="rounded-full border px-[10px] py-[4px] text-[11px] font-medium cursor-pointer transition-colors border-border bg-secondary text-muted-foreground hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                >
                  Ikke relevant person
                </button>
              </div>
            </div>

            {/* 7. CTA */}
            <div style={{ padding: "10px 18px 0" }}>
              <button
                onClick={() => {
                  setTreated(prev => new Set([...prev, current.contact.id]));
                  setTimeout(() => goNext("left"), 100);
                }}
                disabled={idx >= total - 1 || isAnimating}
                className="w-full h-[46px] bg-foreground text-background rounded-xl text-[14px] font-medium hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-40"
              >
                Ok, neste →
              </button>
            </div>

            {/* 8. Dots */}
            <div className="flex items-center justify-center gap-1 pt-2 pb-3">
              {scoredLeads.slice(Math.max(0, idx - 2), idx + 5).map((_, i) => {
                const dotIdx = Math.max(0, idx - 2) + i;
                return (
                  <button
                    key={dotIdx}
                    onClick={() => { setIdx(dotIdx); setSignalOpen(false); }}
                    className={cn(
                      "rounded-full transition-all",
                      dotIdx === idx ? "w-4 h-2 bg-amber-400" : "w-2 h-2 bg-border hover:bg-muted-foreground/40"
                    )}
                  />
                );
              })}
            </div>
          </div>

          {/* Right nav chevron */}
          <button
            onClick={() => goNext("left")}
            disabled={idx >= total - 1}
            className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground/40 hover:text-foreground hover:bg-secondary disabled:opacity-20 disabled:pointer-events-none transition-all"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      ) : null}

      {/* ── Side panel (Sheet) ── */}
      <Sheet open={!!sheetContactId} onOpenChange={open => !open && setSheetContactId(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
          {sheetContactId && <ContactCardContent contactId={sheetContactId} editable />}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default DailyBrief;
