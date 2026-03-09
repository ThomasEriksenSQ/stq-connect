import { useEffect, useState } from "react";
import { AlertCircle, ChevronRight, ClipboardList, Flame, RefreshCw, Sparkles, Radio, Search, ClipboardCheck, TrendingUp, Zap, PlusCircle, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { extractCategory } from "@/lib/categoryUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow, getISOWeek, getISOWeekYear } from "date-fns";
import { nb } from "date-fns/locale";
import { companiesMatch, normalizeCompanyName } from "@/lib/companyMatch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface BriefData {
  overdueCount: number;
  foresporslerCount: number;
  foresporslerNames: string[];
  behovNaCount: number;
  behovNaContacts: { id: string; name: string }[];
}

interface BuyerCandidate {
  id: string;
  name: string;
  companyName: string;
  signal: string;
  lastActivity: string | null;
}

const TECH_KEYWORDS = ["C++", "C", "Rust", "Python", "Zephyr", "Yocto", "Embedded Linux", "FreeRTOS", "FPGA"];
const TECH_COLORS: Record<string, string> = {
  "C++": "bg-blue-100 text-blue-800", C: "bg-emerald-100 text-emerald-800", Rust: "bg-orange-100 text-orange-800",
  Python: "bg-yellow-100 text-yellow-800", Zephyr: "bg-violet-100 text-violet-800", Yocto: "bg-pink-100 text-pink-800",
  "Embedded Linux": "bg-teal-100 text-teal-800", FreeRTOS: "bg-rose-100 text-rose-800", FPGA: "bg-indigo-100 text-indigo-800",
};

function matchTech(text: string, keyword: string): boolean {
  if (keyword === "C") return /\bC\b/.test(text);
  return text.toLowerCase().includes(keyword.toLowerCase());
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "God morgen";
  if (h < 18) return "God ettermiddag";
  return "God kveld";
}

const SIGNAL_ICONS: Record<string, string> = {
  "Behov nå": "🔥",
  "Får fremtidig behov": "⏳",
  "Får kanskje behov": "❓",
};

// ── Innkjøper-kandidater section ──
function InnkjoperSection() {
  const [candidates, setCandidates] = useState<BuyerCandidate[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const [contactsRes, activitiesRes, companiesRes] = await Promise.all([
          supabase.from("contacts").select("id, first_name, last_name, company_id, call_list"),
          supabase.from("activities").select("contact_id, subject, description, created_at").order("created_at", { ascending: false }),
          supabase.from("companies").select("id, name"),
        ]);

        const contacts = contactsRes.data ?? [];
        const activities = activitiesRes.data ?? [];
        const companies = companiesRes.data ?? [];

        const companyMap = new Map(companies.map(c => [c.id, c.name]));

        // Group activities by contact
        const actByContact = new Map<string, typeof activities>();
        for (const a of activities) {
          if (!a.contact_id) continue;
          const list = actByContact.get(a.contact_id) || [];
          list.push(a);
          actByContact.set(a.contact_id, list);
        }

        const targetSignals = ["Behov nå", "Får fremtidig behov", "Får kanskje behov"];
        const results: BuyerCandidate[] = [];

        for (const c of contacts) {
          if (c.call_list) continue; // already on list

          const cActs = actByContact.get(c.id) || [];
          const sorted = [...cActs].sort((a, b) => b.created_at.localeCompare(a.created_at));

          let signal = "";
          for (const act of sorted) {
            const cat = extractCategory(act.subject, act.description);
            if (cat && targetSignals.includes(cat)) {
              signal = cat;
              break;
            }
            if (cat) break;
          }

          if (!signal) continue;

          const lastAct = sorted[0]?.created_at || null;

          results.push({
            id: c.id,
            name: `${c.first_name} ${c.last_name}`.trim(),
            companyName: c.company_id ? (companyMap.get(c.company_id) || "") : "",
            signal,
            lastActivity: lastAct,
          });
        }

        // Sort by signal priority
        const priority = { "Behov nå": 0, "Får fremtidig behov": 1, "Får kanskje behov": 2 };
        results.sort((a, b) => (priority[a.signal as keyof typeof priority] ?? 9) - (priority[b.signal as keyof typeof priority] ?? 9));

        setCandidates(results.slice(0, 4));
      } catch {
        // fail silently
      }
    })();
  }, []);

  const handleAdd = async (contactId: string) => {
    try {
      const { error } = await supabase.from("contacts").update({ call_list: true }).eq("id", contactId);
      if (error) throw error;
      setAddedIds(prev => new Set(prev).add(contactId));
      toast({ title: "Lagt til innkjøperlisten" });
    } catch {
      toast({ title: "Kunne ikke legge til", variant: "destructive" });
    }
  };

  if (candidates.length === 0) return null;

  return (
    <>
      <div className="border-t border-border my-3" />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            <span className="text-[0.875rem] font-semibold text-foreground">Innkjøper-kandidater</span>
          </div>
          <Link to="/kontakter" className="text-[0.75rem] text-primary hover:underline">
            Se alle →
          </Link>
        </div>

        <div className="space-y-1.5">
          {candidates.map((c) => {
            const added = addedIds.has(c.id);
            const icon = SIGNAL_ICONS[c.signal] || "";
            const timeAgo = c.lastActivity
              ? formatDistanceToNow(new Date(c.lastActivity), { locale: nb, addSuffix: false })
              : null;

            return (
              <div key={c.id} className="flex items-start justify-between gap-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[0.8125rem]">{icon}</span>
                    <Link
                      to={`/kontakter/${c.id}`}
                      className="text-[0.8125rem] font-medium text-foreground hover:underline truncate"
                    >
                      {c.name}
                    </Link>
                    {c.companyName && (
                      <span className="text-[0.75rem] text-muted-foreground">· {c.companyName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[0.6875rem] text-muted-foreground">{c.signal}</span>
                    {timeAgo && (
                      <span className="text-[0.6875rem] text-muted-foreground">· Sist kontakt: {timeAgo}</span>
                    )}
                  </div>
                </div>
                {added ? (
                  <span className="text-[hsl(var(--success))] text-[0.75rem] font-medium flex-shrink-0 mt-0.5">✓</span>
                ) : (
                  <button
                    onClick={() => handleAdd(c.id)}
                    className="text-[0.75rem] text-primary hover:underline flex-shrink-0 mt-0.5"
                  >
                    + Add
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Ukjent potensial section ──
function UkjentPotensialSection() {
  const [unmatchedNames, setUnmatchedNames] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const d30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const [finnRes, companiesRes] = await Promise.all([
          supabase.from("finn_annonser").select("selskap").gte("dato", d30),
          supabase.from("companies").select("name"),
        ]);

        const finnRows = finnRes.data ?? [];
        const companies = companiesRes.data ?? [];

        const uniqueFinn = new Set<string>();
        for (const r of finnRows) {
          if (r.selskap) uniqueFinn.add(r.selskap.trim());
        }

        const unmatched = [...uniqueFinn].filter(n => !companies.some(c => companiesMatch(n, c.name)));
        setTotalCount(unmatched.length);
        setUnmatchedNames(unmatched.slice(0, 3));
      } catch {
        // fail silently
      }
    })();
  }, []);

  if (totalCount === 0) return null;

  const remaining = totalCount - unmatchedNames.length;

  return (
    <>
      <div className="border-t border-border my-3" />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-[hsl(var(--warning))]" />
            <span className="text-[0.875rem] font-semibold text-foreground">Ukjent potensial</span>
          </div>
          <Link to="/markedsradar" className="text-[0.75rem] text-primary hover:underline">
            Se i Markedsradar →
          </Link>
        </div>
        <p className="text-[0.8125rem] text-foreground">
          <span className="font-semibold">{totalCount}</span> selskaper på Finn.no er ikke i CRM
        </p>
        <p className="text-[0.75rem] text-muted-foreground">
          {unmatchedNames.join(" · ")}
          {remaining > 0 && ` +${remaining} til`}
        </p>
      </div>
    </>
  );
}

// ── Markedsradar section ──
interface StaleAd { selskap: string; antall_uker: number; antall_annonser: number; roller: string; inCRM: boolean; companyId?: string }
interface NewThisWeek { selskap: string; stillingsrolle: string | null; teknologier: string | null; lenke: string | null }
interface SignalCandidate { selskap: string; companyId: string; crmName: string; finnCount: number; category: string }

function MarkedsradarSection() {
  const [ready, setReady] = useState(false);
  const [marketSentence, setMarketSentence] = useState<string | null>(null);
  const [staleAds, setStaleAds] = useState<StaleAd[]>([]);
  const [newThisWeek, setNewThisWeek] = useState<NewThisWeek[]>([]);
  const [techSpike, setTechSpike] = useState<{ name: string; thisWeek: number; lastWeek: number; delta: number } | null>(null);
  const [signalCandidates, setSignalCandidates] = useState<SignalCandidate[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const currentWeek = `${getISOWeekYear(now)}-W${String(getISOWeek(now)).padStart(2, "0")}`;
        const prevWeekDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const prevWeek = `${getISOWeekYear(prevWeekDate)}-W${String(getISOWeek(prevWeekDate)).padStart(2, "0")}`;
        const d60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const d21 = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const [finnRes, companiesRes, thisWeekRes, lastWeekRes] = await Promise.all([
          supabase.from("finn_annonser").select("selskap, dato, uke, stillingsrolle, teknologier, lenke").gte("dato", d60),
          supabase.from("companies").select("id, name, category"),
          supabase.from("finn_annonser").select("teknologier").eq("uke", currentWeek),
          supabase.from("finn_annonser").select("teknologier").eq("uke", prevWeek),
        ]);

        const finnRows = finnRes.data ?? [];
        const companies = companiesRes.data ?? [];
        const thisWeekRows = thisWeekRes.data ?? [];
        const lastWeekRows = lastWeekRes.data ?? [];

        if (finnRows.length === 0) return;

        // 6. STALE ADS — companies appearing 3+ weeks
        const bySelskap = new Map<string, { uker: Set<string>; count: number; roller: Set<string> }>();
        for (const r of finnRows) {
          if (!r.selskap || !r.uke) continue;
          const s = r.selskap.trim();
          const entry = bySelskap.get(s) || { uker: new Set(), count: 0, roller: new Set() };
          entry.uker.add(r.uke);
          entry.count++;
          if (r.stillingsrolle) entry.roller.add(r.stillingsrolle);
          bySelskap.set(s, entry);
        }
        const staleResults: StaleAd[] = [];
        for (const [selskap, info] of bySelskap) {
          if (info.uker.size >= 3) {
            const matched = companies.find(c => companiesMatch(selskap, c.name));
            staleResults.push({
              selskap,
              antall_uker: info.uker.size,
              antall_annonser: info.count,
              roller: [...info.roller].join(" / "),
              inCRM: !!matched,
              companyId: matched?.id,
            });
          }
        }
        staleResults.sort((a, b) => b.antall_uker - a.antall_uker);
        setStaleAds(staleResults.slice(0, 5));

        // 7. NEW THIS WEEK — not in CRM
        const thisWeekAds = finnRows.filter(r => r.uke === currentWeek && r.selskap);
        const uniqueNew = new Map<string, NewThisWeek>();
        for (const r of thisWeekAds) {
          const s = r.selskap!.trim();
          if (!companies.some(c => companiesMatch(s, c.name)) && !uniqueNew.has(normalizeCompanyName(s))) {
            uniqueNew.set(normalizeCompanyName(s), { selskap: s, stillingsrolle: r.stillingsrolle, teknologier: r.teknologier, lenke: r.lenke });
          }
        }
        setNewThisWeek([...uniqueNew.values()]);

        // 8. TECH SPIKE
        const SPIKE_TECHS = ["C++", "Rust", "Zephyr", "Yocto", "FreeRTOS", "FPGA"];
        const countTech = (rows: typeof thisWeekRows) => {
          const counts: Record<string, number> = {};
          for (const r of rows) {
            if (!r.teknologier) continue;
            for (const kw of SPIKE_TECHS) {
              if (matchTech(r.teknologier, kw)) counts[kw] = (counts[kw] || 0) + 1;
            }
          }
          return counts;
        };
        const twCounts = countTech(thisWeekRows);
        const lwCounts = countTech(lastWeekRows);
        let bestSpike: typeof techSpike = null;
        for (const tech of SPIKE_TECHS) {
          const tw = twCounts[tech] || 0;
          const lw = lwCounts[tech] || 0;
          const delta = tw - lw;
          if (delta > 0 && (!bestSpike || delta > bestSpike.delta)) {
            bestSpike = { name: tech, thisWeek: tw, lastWeek: lw, delta };
          }
        }
        setTechSpike(bestSpike);

        // 9. CRM SIGNAL UPGRADE CANDIDATES
        const upgradeCategories = ["Ukjent om behov", "Aldri aktuelt", "Har kanskje behov"];
        const recentFinn = finnRows.filter(r => r.dato >= d21 && r.selskap);
        const candidateMap = new Map<string, { selskap: string; companyId: string; crmName: string; finnCount: number; category: string }>();
        for (const r of recentFinn) {
          const s = r.selskap!.trim();
          for (const c of companies) {
            if (c.category && upgradeCategories.includes(c.category) && companiesMatch(s, c.name)) {
              const key = c.id;
              const existing = candidateMap.get(key);
              if (existing) {
                existing.finnCount++;
              } else {
                candidateMap.set(key, { selskap: s, companyId: c.id, crmName: c.name, finnCount: 1, category: c.category });
              }
            }
          }
        }
        const candidates = [...candidateMap.values()].filter(c => c.finnCount >= 2).sort((a, b) => b.finnCount - a.finnCount).slice(0, 5);
        setSignalCandidates(candidates);

        const hasAnyRow = staleResults.length > 0 || uniqueNew.size > 0 || bestSpike || candidates.length > 0;
        if (!hasAnyRow) return;

        setReady(true);

        // AI call for market sentence
        try {
          const staleStr = staleResults.slice(0, 5).map(s => `${s.selskap} (${s.antall_uker} uker, ${s.roller})`).join(", ");
          const newStr = [...uniqueNew.values()].slice(0, 5).map(r => r.selskap).join(", ");
          const spikeStr = bestSpike ? `${bestSpike.name} +${bestSpike.delta} annonser fra forrige uke` : "ingen spike";
          const candStr = candidates.map(s => `${s.crmName} (${s.finnCount} annonser, nå: ${s.category})`).join(", ");

          const { data } = await supabase.functions.invoke("markedsradar-analyse", {
            body: {
              currentWeek,
              thisWeekRows: "",
              techCounts: `Selskaper som sliter med rekruttering (3+ uker): ${staleStr}\nNye selskaper ikke i CRM: ${newStr}\nTeknologi-spike: ${spikeStr}\nCRM-signal kandidater: ${candStr}\nAvslutt med én setning merket 'MARKED:' om det viktigste markedssignalet (maks 15 ord).`,
              topCompanies: "",
              notInCRM: "",
              brief: true,
            },
          });
          if (data?.analysis) {
            const text = data.analysis as string;
            const markedMatch = text.match(/MARKED:\s*(.+)/i);
            if (markedMatch) {
              setMarketSentence(markedMatch[1].trim());
            } else {
              setMarketSentence(text.split("\n")[0].trim());
            }
          }
        } catch {
          // fail silently
        }
      } catch {
        // fail silently
      }
    })();
  }, []);

  if (!ready) return null;

  const topStale = staleAds[0];
  const spikePercent = techSpike && techSpike.lastWeek > 0
    ? Math.round(((techSpike.thisWeek - techSpike.lastWeek) / techSpike.lastWeek) * 100)
    : null;
  const topCandidate = signalCandidates[0];

  return (
    <TooltipProvider>
      <div className="border-t border-border my-3" />
      <div className="space-y-2.5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            <span className="text-[0.875rem] font-semibold text-foreground">📡 Markedsradar</span>
          </div>
          <Link to="/markedsradar" className="text-[0.75rem] text-primary hover:underline">
            Se full radar →
          </Link>
        </div>

        {/* AI market sentence */}
        {marketSentence && (
          <p className="text-[0.8125rem] italic text-muted-foreground">{marketSentence}</p>
        )}

        {/* ROW A: Sliter med rekruttering */}
        {topStale && (
          <div className="flex items-start justify-between gap-2 py-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="min-w-0 flex-1 cursor-default">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[0.8125rem]">🔥</span>
                    <span className="text-[0.75rem] font-medium text-muted-foreground">Sliter med rekruttering</span>
                  </div>
                  <p className="text-[0.8125rem] text-foreground mt-0.5">
                    <span className="font-semibold">{topStale.selskap}</span> har søkt {topStale.roller || "stilling"} i <span className="font-semibold">{topStale.antall_uker} uker</span> — ring nå
                  </p>
                </div>
              </TooltipTrigger>
              {staleAds.length > 1 && (
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="text-[0.75rem] space-y-1">
                    {staleAds.map(s => (
                      <div key={s.selskap}>{s.selskap} — {s.antall_uker} uker, {s.roller}</div>
                    ))}
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
            <div className="flex-shrink-0 mt-1">
              {topStale.inCRM && topStale.companyId ? (
                <button
                  onClick={() => navigate(`/selskaper/${topStale.companyId}`)}
                  className="text-[0.75rem] text-primary hover:underline flex items-center gap-1"
                >
                  <Phone className="h-3 w-3" /> Ring →
                </button>
              ) : (
                <Link to="/markedsradar" className="text-[0.75rem] text-primary hover:underline flex items-center gap-1">
                  <PlusCircle className="h-3 w-3" /> Legg til CRM
                </Link>
              )}
            </div>
          </div>
        )}

        {/* ROW B: Nye denne uken */}
        {newThisWeek.length > 0 && (
          <div className="flex items-start justify-between gap-2 py-1">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[0.8125rem]">🆕</span>
                <span className="text-[0.75rem] font-medium text-muted-foreground">Nye denne uken</span>
              </div>
              <p className="text-[0.8125rem] text-foreground mt-0.5">
                <span className="font-semibold">{newThisWeek.length}</span> nye selskaper på Finn ikke i CRM
              </p>
              <p className="text-[0.75rem] text-muted-foreground mt-0.5">
                {newThisWeek.slice(0, 2).map(r => r.selskap).join(" · ")}
                {newThisWeek.length > 2 && ` +${newThisWeek.length - 2} til`}
              </p>
            </div>
            <Link to="/markedsradar" className="text-[0.75rem] text-primary hover:underline flex-shrink-0 mt-1">
              Se i radar →
            </Link>
          </div>
        )}

        {/* ROW C: Teknologi-spike */}
        {techSpike && techSpike.delta > 0 && (
          <div className="py-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[0.8125rem]">📈</span>
              <span className="text-[0.75rem] font-medium text-muted-foreground">Teknologi-spike</span>
            </div>
            <p className="text-[0.8125rem] text-foreground mt-0.5">
              <span className="font-semibold">{techSpike.name}</span>
              {spikePercent !== null ? ` +${spikePercent}%` : ` +${techSpike.delta}`} fra forrige uke ({techSpike.lastWeek} → {techSpike.thisWeek} annonser)
            </p>
          </div>
        )}

        {/* ROW D: Oppgrader CRM-signal */}
        {topCandidate && (
          <div className="flex items-start justify-between gap-2 py-1">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[0.8125rem]">⚡</span>
                <span className="text-[0.75rem] font-medium text-muted-foreground">Oppgrader CRM-signal</span>
              </div>
              <p className="text-[0.8125rem] text-foreground mt-0.5">
                <span className="font-semibold">{topCandidate.crmName}</span> har {topCandidate.finnCount} Finn-annonser men er markert «{topCandidate.category}» i CRM
              </p>
            </div>
            <button
              onClick={() => navigate(`/selskaper/${topCandidate.companyId}`)}
              className="text-[0.75rem] text-primary hover:underline flex-shrink-0 mt-1"
            >
              Oppdater signal →
            </button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

const DailyBrief = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ full_name: string } | null>(null);
  const [data, setData] = useState<BriefData | null>(null);
  const [aiSentence, setAiSentence] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);
    setAiSentence(null);

    try {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const fortyFiveDaysAgo = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString();

      const [profileRes, overdueRes, foresporslerRes, foresporslerCountRes, activitiesRes, contactsRes] =
        await Promise.all([
          supabase.from("profiles").select("full_name").eq("id", user.id).single(),
          supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("status", "open")
            .lt("due_date", todayStr)
            .eq("assigned_to", user.id),
          supabase
            .from("foresporsler")
            .select("selskap_navn")
            .gte("created_at", fortyFiveDaysAgo)
            .order("created_at", { ascending: false })
            .limit(3),
          supabase
            .from("foresporsler")
            .select("id", { count: "exact", head: true })
            .gte("created_at", fortyFiveDaysAgo),
          supabase
            .from("activities")
            .select("contact_id, subject, description, created_at")
            .order("created_at", { ascending: false }),
          supabase
            .from("contacts")
            .select("id, first_name, last_name, updated_at"),
        ]);

      if (profileRes.data) setProfile(profileRes.data);

      const overdueCount = overdueRes.count ?? 0;
      const foresporslerCount = foresporslerCountRes.count ?? 0;
      const foresporslerNames = (foresporslerRes.data ?? []).map((f) => f.selskap_navn);

      const activities = activitiesRes.data ?? [];
      const contacts = contactsRes.data ?? [];

      const actByContact = new Map<string, typeof activities>();
      for (const a of activities) {
        if (!a.contact_id) continue;
        const list = actByContact.get(a.contact_id) || [];
        list.push(a);
        actByContact.set(a.contact_id, list);
      }

      const behovNaContacts: { id: string; name: string; updated_at: string }[] = [];
      for (const c of contacts) {
        const cActs = actByContact.get(c.id) || [];
        const sorted = [...cActs].sort((a, b) => b.created_at.localeCompare(a.created_at));
        for (const act of sorted) {
          const cat = extractCategory(act.subject, act.description);
          if (cat === "Behov nå") {
            behovNaContacts.push({
              id: c.id,
              name: `${c.first_name} ${c.last_name}`.trim(),
              updated_at: c.updated_at,
            });
            break;
          }
          if (cat) break;
        }
      }

      behovNaContacts.sort((a, b) => b.updated_at.localeCompare(a.updated_at));

      const briefData: BriefData = {
        overdueCount,
        foresporslerCount,
        foresporslerNames,
        behovNaCount: behovNaContacts.length,
        behovNaContacts: behovNaContacts.slice(0, 2).map((c) => ({ id: c.id, name: c.name })),
      };

      setData(briefData);
      setFetchedAt(new Date());
      setLoading(false);

      fetchAiSentence(briefData);
    } catch (e) {
      console.error("DailyBrief fetch error:", e);
      setLoading(false);
    }
  };

  const fetchAiSentence = async (d: BriefData) => {
    setAiLoading(true);
    try {
      const resp = await supabase.functions.invoke("chat", {
        body: {
          messages: [
            {
              role: "user",
              content: `Forfalt: ${d.overdueCount}, Forespørsler siste 45 dager: ${d.foresporslerCount}, Kontakter med behov nå: ${d.behovNaCount}`,
            },
          ],
          system:
            "Du er en norsk CRM-assistent for STACQ, et IT-konsulentbyrå. Skriv én kort, naturlig norsk setning (maks 20 ord) som oppsummerer dagens situasjon basert på dataene. Vær direkte og handlingsorientert.",
        },
      });

      if (resp.data?.text) {
        setAiSentence(resp.data.text);
      }
    } catch {
      // Fail silently
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  const timeStr = fetchedAt
    ? `Oppdatert kl. ${fetchedAt.getHours().toString().padStart(2, "0")}:${fetchedAt.getMinutes().toString().padStart(2, "0")}`
    : "";

  const formatNameList = (names: string[], total: number) => {
    if (names.length === 0) return "";
    const shown = names.join(", ");
    const remaining = total - names.length;
    return remaining > 0 ? `${shown} +${remaining} til` : shown;
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.07)] overflow-hidden px-5 pt-4 pb-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <h2 className="text-[1.25rem] font-bold text-foreground">
          {getGreeting()}, {firstName} 👋
        </h2>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[0.75rem] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            AI-generert
          </span>
          <button
            onClick={fetchData}
            className="p-1 rounded hover:bg-secondary text-muted-foreground transition-colors"
            title="Oppdater"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* AI sentence */}
      {(aiLoading || loading) && <Skeleton className="h-4 w-3/4 mb-3" />}
      {aiSentence && !aiLoading && !loading && (
        <p className="text-sm italic text-muted-foreground mb-3 animate-in fade-in duration-500">
          {aiSentence}
        </p>
      )}

      {/* Data rows */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : data ? (
        <div className="space-y-2">
          {data.overdueCount > 0 && (
            <div
              className="flex items-center gap-3 py-2 cursor-pointer hover:bg-secondary/50 rounded-md px-1 -mx-1 transition-colors"
              onClick={() => navigate("/oppgaver")}
            >
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
              <span className="text-[0.875rem] text-foreground flex-1">
                <span className="font-semibold">{data.overdueCount}</span> oppfølginger er forfalt
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            </div>
          )}

          <div
            className="flex items-center gap-3 py-2 cursor-pointer hover:bg-secondary/50 rounded-md px-1 -mx-1 transition-colors"
            onClick={() => navigate("/foresporsler")}
          >
            <ClipboardList className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-[0.875rem] text-foreground flex-1">
              <span className="font-semibold">{data.foresporslerCount}</span> forespørsler
              {data.foresporslerNames.length > 0 && (
                <span className="text-muted-foreground">
                  {" — "}
                  {formatNameList(data.foresporslerNames, data.foresporslerCount)}
                </span>
              )}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          </div>

          <div className="flex items-center gap-3 py-2">
            <Flame className="h-4 w-4 text-[hsl(var(--warning))] flex-shrink-0" />
            <span className="text-[0.875rem] text-foreground flex-1">
              <span className="font-semibold">{data.behovNaCount}</span> kontakter har aktivt behov nå
              {data.behovNaContacts.length > 0 && (
                <span className="text-muted-foreground">
                  {" — "}
                  {data.behovNaContacts.map((c, i) => (
                    <span key={c.id}>
                      {i > 0 && ", "}
                      <Link
                        to={`/kontakter/${c.id}`}
                        className="text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.name}
                      </Link>
                    </span>
                  ))}
                  {data.behovNaCount > data.behovNaContacts.length && (
                    <span> +{data.behovNaCount - data.behovNaContacts.length} til</span>
                  )}
                </span>
              )}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          Kunne ikke laste data.
        </div>
      )}

      {/* Innkjøper-kandidater section */}
      <InnkjoperSection />

      {/* Ukjent potensial section */}
      <UkjentPotensialSection />

      {/* Markedsradar section */}
      <MarkedsradarSection />

      {/* Footer */}
      {timeStr && (
        <div className="flex justify-end mt-3">
          <span className="text-[0.75rem] text-muted-foreground">{timeStr}</span>
        </div>
      )}
    </div>
  );
};

export default DailyBrief;
