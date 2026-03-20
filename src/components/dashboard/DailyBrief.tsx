import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getEffectiveSignal, CATEGORIES } from "@/lib/categoryUtils";
import { calcHeatScore } from "@/lib/heatScore";
import { differenceInDays, isPast, isToday, format, addWeeks, addMonths } from "date-fns";
import { nb } from "date-fns/locale";
import { Flame, Target, ChevronRight, Sparkles, Loader2, Calendar, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const DATE_CHIPS = [
  { label: "1 uke", fn: () => addWeeks(new Date(), 1) },
  { label: "2 uker", fn: () => addWeeks(new Date(), 2) },
  { label: "1 mnd", fn: () => addMonths(new Date(), 1) },
];

const SIGNAL_OPTIONS = CATEGORIES.map(c => c.label);

const DailyBrief = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCache, setAiCache] = useState<Record<string, string>>({});
  const [oppfolgingDato, setOppfolgingDato] = useState("");
  const [oppfolgingTittel, setOppfolgingTittel] = useState("Følg opp om behov");
  const [savingOppfolging, setSavingOppfolging] = useState(false);
  const [selectedChip, setSelectedChip] = useState<number | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null); // null = current user initially

  // Fetch profiles for the owner filter
  const { data: profiles } = useQuery({
    queryKey: ["profiles-for-filter"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return data || [];
    },
  });

  // Set initial owner filter to current user once we know both
  const effectiveOwnerFilter = ownerFilter === undefined ? null : ownerFilter;
  const activeOwnerId = useMemo(() => {
    if (effectiveOwnerFilter === "all") return null;
    if (effectiveOwnerFilter) return effectiveOwnerFilter;
    return user?.id || null;
  }, [effectiveOwnerFilter, user?.id]);

  const { data: rawData } = useQuery({
    queryKey: ["salgssenteret-data"],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const [
        { data: contacts },
        { data: activities },
        { data: tasks },
        { data: foresporsler },
        { data: oppdrag },
      ] = await Promise.all([
        supabase.from("contacts").select("id, first_name, last_name, company_id, call_list, phone, email, owner_id, companies(id, name)").limit(500),
        supabase.from("activities").select("contact_id, created_at, subject, description").not("contact_id", "is", null).order("created_at", { ascending: false }),
        supabase.from("tasks").select("contact_id, created_at, title, description, due_date, status, assigned_to").not("contact_id", "is", null).neq("status", "done"),
        supabase.from("foresporsler").select("id, selskap_id, selskap_navn, teknologier, mottatt_dato").gte("mottatt_dato", new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
        supabase.from("stacq_oppdrag").select("id, kandidat, kunde, forny_dato, status").in("status", ["Aktiv", "Oppstart"]),
      ]);
      return { contacts: contacts || [], activities: activities || [], tasks: tasks || [], foresporsler: foresporsler || [], oppdrag: oppdrag || [] };
    },
  });

  // Group activities and tasks by contact_id once
  const grouped = useMemo(() => {
    if (!rawData) return { actsByContact: new Map(), tasksByContact: new Map() };
    const actsByContact = new Map<string, any[]>();
    for (const a of rawData.activities) {
      if (!a.contact_id) continue;
      if (!actsByContact.has(a.contact_id)) actsByContact.set(a.contact_id, []);
      actsByContact.get(a.contact_id)!.push(a);
    }
    const tasksByContact = new Map<string, any[]>();
    for (const t of rawData.tasks) {
      if (!t.contact_id) continue;
      if (!tasksByContact.has(t.contact_id)) tasksByContact.set(t.contact_id, []);
      tasksByContact.get(t.contact_id)!.push(t);
    }
    return { actsByContact, tasksByContact };
  }, [rawData]);

  const rankedContacts = useMemo(() => {
    if (!rawData) return [];
    const { contacts, foresporsler } = rawData;
    const { actsByContact, tasksByContact } = grouped;

    return contacts
      .filter(contact => !activeOwnerId || contact.owner_id === activeOwnerId)
      .map(contact => {
        const cActs = actsByContact.get(contact.id) || [];
        const cTasks = tasksByContact.get(contact.id) || [];
        const score = calcHeatScore(contact, cActs, cTasks, foresporsler);
        const signal = getEffectiveSignal(
          cActs.map((a: any) => ({ created_at: a.created_at, subject: a.subject, description: a.description })),
          cTasks.map((t: any) => ({ created_at: t.created_at, title: t.title, description: t.description, due_date: t.due_date }))
        );
        const sisteAkt = cActs[0];
        const harForfalt = cTasks.some((t: any) => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
        return { ...contact, score, signal, sisteAkt, harForfalt, cActs, cTasks };
      })
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);
  }, [rawData, grouped, activeOwnerId]);

  const konsulenterLedig = useMemo(() => {
    if (!rawData) return [];
    return rawData.oppdrag
      .filter((o: any) => o.forny_dato)
      .map((o: any) => {
        const dager = differenceInDays(new Date(o.forny_dato), new Date());
        return { ...o, dager };
      })
      .filter((o: any) => o.dager <= 60)
      .sort((a: any, b: any) => a.dager - b.dager);
  }, [rawData]);

  const stats = useMemo(() => {
    if (!rawData) return { forfalt: 0, idag: 0, behovNa: 0, foresporsler: 0 };
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    // Filter tasks by owner if needed
    const filteredTasks = activeOwnerId
      ? rawData.tasks.filter((t: any) => t.assigned_to === activeOwnerId)
      : rawData.tasks;

    const forfalt = filteredTasks.filter((t: any) => t.due_date && t.due_date < todayStr).length;
    const idag = filteredTasks.filter((t: any) => t.due_date === todayStr).length;
    const behovNa = rankedContacts.filter(c => c.signal === "Behov nå").length;
    return { forfalt, idag, behovNa, foresporsler: rawData.foresporsler.length };
  }, [rawData, rankedContacts, activeOwnerId]);

  const handleSelectContact = async (contact: any) => {
    setSelectedContact(contact);
    setOppfolgingDato("");
    setOppfolgingTittel("Følg opp om behov");
    setSelectedChip(null);

    if (aiCache[contact.id]) {
      setAiText(aiCache[contact.id]);
      return;
    }

    setAiText(null);
    setAiLoading(true);
    try {
      const sisteAkts = contact.cActs.slice(0, 5).map((a: any) =>
        `${a.subject}${a.description ? ": " + a.description.slice(0, 100) : ""} (${format(new Date(a.created_at), "d. MMM", { locale: nb })})`
      ).join("\n");

      const { data } = await supabase.functions.invoke("chat", {
        body: {
          system: "Du er en hjelpsom salgsassistent for et norsk IT-konsulentselskap. Gi en kort, konkret briefing på 2 setninger på norsk basert på aktivitetshistorikken. Fokuser på hva som skjedde sist og hva som er anbefalt neste steg.",
          messages: [{
            role: "user",
            content: `Kontakt: ${contact.first_name} ${contact.last_name} hos ${(contact.companies as any)?.name || "ukjent selskap"}\nSignal: ${contact.signal || "ukjent"}\nInnkjøper: ${contact.call_list ? "ja" : "nei"}\nSiste aktiviteter:\n${sisteAkts || "Ingen aktiviteter"}`
          }]
        }
      });
      const text = data?.text || "Ingen briefing tilgjengelig.";
      setAiText(text);
      setAiCache(prev => ({ ...prev, [contact.id]: text }));
    } catch {
      setAiText("Kunne ikke generere briefing.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleLagreOppfolging = async () => {
    if (!selectedContact || !oppfolgingDato) return;
    setSavingOppfolging(true);
    try {
      await supabase.from("tasks").insert({
        title: oppfolgingTittel,
        contact_id: selectedContact.id,
        company_id: selectedContact.company_id,
        due_date: oppfolgingDato,
        assigned_to: user?.id,
        created_by: user?.id,
        priority: "medium",
        status: "open",
      });
      toast.success("Oppfølging satt");
      queryClient.invalidateQueries({ queryKey: ["salgssenteret-data"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-oppfolginger-v3"] });

      const idx = rankedContacts.findIndex(c => c.id === selectedContact.id);
      const neste = rankedContacts[idx + 1];
      if (neste) handleSelectContact(neste);
      else setSelectedContact(null);
    } catch {
      toast.error("Kunne ikke lagre oppfølging");
    } finally {
      setSavingOppfolging(false);
    }
  };

  const handleSetSignal = async (contactId: string, companyId: string | null, signalLabel: string) => {
    try {
      await supabase.from("activities").insert({
        subject: signalLabel,
        type: "note",
        contact_id: contactId,
        company_id: companyId,
        created_by: user?.id,
      });
      toast.success(`Signal satt: ${signalLabel}`);
      queryClient.invalidateQueries({ queryKey: ["salgssenteret-data"] });
    } catch {
      toast.error("Kunne ikke sette signal");
    }
  };

  const signalCat = selectedContact ? CATEGORIES.find(c => c.label === selectedContact.signal) : null;

  // Build owner filter pills
  const ownerPills = useMemo(() => {
    if (!profiles) return [];
    return [
      { id: "all", label: "Alle" },
      ...profiles.map(p => ({
        id: p.id,
        label: p.full_name || "Ukjent",
      })),
    ];
  }, [profiles]);

  return (
    <div className="space-y-4">
      {/* Owner filter pills */}
      {ownerPills.length > 1 && (
        <div className="flex items-center gap-1">
          {ownerPills.map(pill => {
            const isActive = pill.id === "all"
              ? effectiveOwnerFilter === "all"
              : pill.id === (effectiveOwnerFilter || user?.id);
            return (
              <button
                key={pill.id}
                onClick={() => setOwnerFilter(pill.id)}
                className={cn(
                  "h-7 px-3 text-[0.75rem] rounded-full border transition-colors",
                  isActive
                    ? "bg-foreground text-background border-foreground font-medium"
                    : "border-border text-muted-foreground hover:bg-secondary"
                )}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Live stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Forfalt", value: stats.forfalt, color: "text-destructive" },
          { label: "I dag", value: stats.idag, color: "text-primary" },
          { label: "Behov nå", value: stats.behovNa, color: "text-emerald-600" },
          { label: "Forespørsler", value: stats.foresporsler, color: "text-foreground" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-lg px-4 py-3 text-center">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{s.label}</p>
            <p className={cn("text-[1.5rem] font-bold", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Hoved-grid: Leads + Kø-modus */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4">
        {/* Venstre: Ranket liste */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.07)] overflow-hidden">
            <div className="flex items-center gap-2 px-5 pt-4 pb-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Varmeste leads</h2>
              <span className="ml-auto text-[0.75rem] text-muted-foreground">{rankedContacts.length}</span>
            </div>

            <div className="divide-y divide-border">
              {rankedContacts.length === 0 ? (
                <p className="px-5 py-8 text-[0.875rem] text-muted-foreground text-center">Ingen varme leads akkurat nå</p>
              ) : (
                rankedContacts.map(contact => {
                  const isSelected = selectedContact?.id === contact.id;
                  const sigCat = CATEGORIES.find(c => c.label === contact.signal);
                  return (
                    <div
                      key={contact.id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 transition-colors",
                        isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/40",
                        contact.harForfalt && !isSelected && "border-l-2 border-l-destructive"
                      )}
                    >
                      <button
                        onClick={() => handleSelectContact(contact)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-[0.875rem] font-medium text-foreground truncate">
                            {contact.first_name} {contact.last_name}
                          </span>
                          {contact.call_list && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0 text-[0.625rem] font-semibold">INN</span>
                          )}
                        </div>
                        <p className="text-[0.75rem] text-muted-foreground truncate">{(contact.companies as any)?.name || ""}</p>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={cn("text-[0.8125rem] font-bold", contact.score >= 60 ? "text-emerald-600" : contact.score >= 40 ? "text-amber-600" : "text-muted-foreground")}>{contact.score}p</span>

                        {/* Signal picker popover */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              className={cn(
                                "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold max-w-[5.5rem] truncate",
                                sigCat ? sigCat.badgeColor : "border-border text-muted-foreground/50 bg-transparent"
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {contact.signal || "—"}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-44 p-1" align="end" side="bottom">
                            {SIGNAL_OPTIONS.map(opt => {
                              const optCat = CATEGORIES.find(c => c.label === opt);
                              return (
                                <button
                                  key={opt}
                                  onClick={() => handleSetSignal(contact.id, contact.company_id, opt)}
                                  className={cn(
                                    "w-full text-left px-3 py-1.5 text-[0.8125rem] rounded-md hover:bg-muted transition-colors",
                                    contact.signal === opt && "font-semibold"
                                  )}
                                >
                                  <span className={cn("inline-block w-2 h-2 rounded-full mr-2", optCat?.badgeColor.split(" ")[0])} />
                                  {opt}
                                </button>
                              );
                            })}
                          </PopoverContent>
                        </Popover>

                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Konsulenter som nærmer seg ledig */}
          {konsulenterLedig.length > 0 && (
            <div className="bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.07)] overflow-hidden">
              <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                <Calendar className="h-4 w-4 text-primary" />
                <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Nærmer seg ledig</h2>
              </div>
              <div className="divide-y divide-border">
                {konsulenterLedig.map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-[0.875rem] font-medium text-foreground">{o.kandidat}</p>
                      <p className="text-[0.75rem] text-muted-foreground">{o.kunde || "Ukjent kunde"}</p>
                    </div>
                    <span className={cn("text-[0.75rem] font-semibold", o.dager <= 0 ? "text-emerald-600" : o.dager <= 14 ? "text-amber-600" : "text-muted-foreground")}>
                      {o.dager <= 0 ? "Ledig nå" : `Om ${o.dager}d`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Høyre: Kø-modus */}
        <div className="bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.07)] overflow-hidden">
          {!selectedContact ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[320px] text-center px-6">
              <Target className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-[0.9375rem] font-medium text-foreground">Velg en kontakt fra listen</p>
              <p className="text-[0.8125rem] text-muted-foreground mt-1">Klikk på en lead for å se briefing og sette oppfølging</p>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[1.25rem] font-bold text-foreground">
                      {selectedContact.first_name} {selectedContact.last_name}
                    </h3>
                    {selectedContact.call_list && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 text-[0.6875rem] font-semibold">Innkjøper</span>
                    )}
                    {signalCat && (
                      <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", signalCat.badgeColor)}>
                        {selectedContact.signal}
                      </span>
                    )}
                    <span className={cn("text-[0.8125rem] font-bold", selectedContact.score >= 60 ? "text-emerald-600" : "text-amber-600")}>Score: {selectedContact.score}p</span>
                  </div>
                  <button
                    onClick={() => navigate(`/kontakter/${selectedContact.id}`)}
                    className="text-[0.875rem] text-primary hover:underline mt-0.5"
                  >
                    {(selectedContact.companies as any)?.name || "Ukjent selskap"} →
                  </button>
                </div>
              </div>

              {/* AI Briefing */}
              <div className="rounded-lg bg-muted/50 border border-border px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">AI-briefing</span>
                </div>
                {aiLoading ? (
                  <div className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Analyserer historikk...
                  </div>
                ) : (
                  <p className="text-[0.8125rem] text-foreground/80 leading-relaxed">{aiText || "Ingen historikk å analysere."}</p>
                )}
              </div>

              {/* Siste aktivitet */}
              {selectedContact.sisteAkt && (
                <p className="text-[0.8125rem] text-muted-foreground">
                  <span className="font-medium">Siste:</span> "{selectedContact.sisteAkt.subject}"
                  {" — "}{format(new Date(selectedContact.sisteAkt.created_at), "d. MMM yyyy", { locale: nb })}
                </p>
              )}

              {/* Sett neste oppfølging */}
              <div className="space-y-2">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Sett neste oppfølging</p>
                <Input
                  value={oppfolgingTittel}
                  onChange={(e) => setOppfolgingTittel(e.target.value)}
                  placeholder="Tittel på oppfølging"
                  className="text-[0.875rem]"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  {DATE_CHIPS.map((chip, i) => (
                    <button
                      key={chip.label}
                      onClick={() => {
                        setOppfolgingDato(format(chip.fn(), "yyyy-MM-dd"));
                        setSelectedChip(i);
                      }}
                      className={cn(
                        "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors",
                        selectedChip === i
                          ? "bg-primary/10 border-primary/30 text-primary font-medium"
                          : "border-border text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      {chip.label}
                    </button>
                  ))}
                  <input
                    type="date"
                    value={oppfolgingDato}
                    onChange={(e) => { setOppfolgingDato(e.target.value); setSelectedChip(null); }}
                    className="h-8 px-2 text-[0.75rem] rounded-full border border-border text-muted-foreground bg-background"
                  />
                </div>
                {oppfolgingDato && (
                  <p className="text-[0.75rem] text-muted-foreground">
                    Frist: {format(new Date(oppfolgingDato), "d. MMMM yyyy", { locale: nb })}
                  </p>
                )}
              </div>

              {/* Knapper */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    const idx = rankedContacts.findIndex(c => c.id === selectedContact.id);
                    const neste = rankedContacts[idx + 1];
                    if (neste) handleSelectContact(neste);
                    else setSelectedContact(null);
                  }}
                  className="flex-1 h-9 text-[0.8125rem] rounded-lg border border-border text-muted-foreground hover:bg-secondary transition-colors"
                >
                  ← Hopp over
                </button>
                <button
                  onClick={handleLagreOppfolging}
                  disabled={!oppfolgingDato || savingOppfolging}
                  className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingOppfolging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Lagre og neste →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyBrief;
