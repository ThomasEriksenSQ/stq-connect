import { useEffect, useState } from "react";
import { AlertCircle, ClipboardList, Flame, RefreshCw, Sparkles, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { extractCategory } from "@/lib/categoryUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";

interface BriefData {
  overdueCount: number;
  foresporslerCount: number;
  foresporslerNames: string[];
  behovNaCount: number;
  behovNaNames: string[];
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

// ── Markedsradar section ──
function MarkedsradarSection() {
  const [ready, setReady] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [topTechs, setTopTechs] = useState<{ name: string; count: number }[]>([]);
  const [topCompanies, setTopCompanies] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const d21 = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const [trendRes, hotRes] = await Promise.all([
          supabase.from("finn_annonser").select("teknologier").gte("dato", d90),
          supabase.from("finn_annonser").select("selskap").gte("dato", d21),
        ]);

        const trendRows = trendRes.data ?? [];
        const hotRows = hotRes.data ?? [];

        if (trendRows.length === 0 && hotRows.length === 0) return; // hide section

        // Tech counts
        const tc: Record<string, number> = {};
        for (const r of trendRows) {
          if (!r.teknologier) continue;
          for (const kw of TECH_KEYWORDS) {
            if (matchTech(r.teknologier, kw)) tc[kw] = (tc[kw] || 0) + 1;
          }
        }
        const sortedTechs = Object.entries(tc).sort((a, b) => b[1] - a[1]);
        setTopTechs(sortedTechs.slice(0, 3).map(([name, count]) => ({ name, count })));

        // Company counts
        const cc: Record<string, number> = {};
        for (const r of hotRows) {
          if (r.selskap) {
            const s = r.selskap.trim();
            cc[s] = (cc[s] || 0) + 1;
          }
        }
        const sortedCompanies = Object.entries(cc).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n);
        setTopCompanies(sortedCompanies);

        setReady(true);

        // AI call (non-blocking, fail silently)
        const techStr = sortedTechs.map(([k, v]) => `${k}: ${v}`).join(", ");
        const compStr = Object.entries(cc).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}: ${v}`).join(", ");

        try {
          const { data } = await supabase.functions.invoke("markedsradar-analyse", {
            body: {
              currentWeek: "",
              thisWeekRows: "",
              techCounts: techStr,
              topCompanies: compStr,
              notInCRM: "",
              brief: true,
            },
          });
          if (data?.analysis) setAiText(data.analysis);
        } catch {
          // fail silently
        }
      } catch {
        // fail silently
      }
    })();
  }, []);

  if (!ready) return null;

  return (
    <>
      <div className="border-t border-border my-3" />
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            <span className="text-[0.875rem] font-semibold text-foreground">Markedsradar</span>
          </div>
          <Link to="/markedsradar" className="text-[0.75rem] text-primary hover:underline">
            Se mer →
          </Link>
        </div>

        {aiText && (
          <p className="text-[0.8125rem] leading-relaxed text-foreground/70">{aiText}</p>
        )}

        {topTechs.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[0.75rem] text-muted-foreground font-medium">Varmest:</span>
            {topTechs.map((t) => (
              <span
                key={t.name}
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${TECH_COLORS[t.name] || "bg-secondary text-secondary-foreground"}`}
              >
                {t.name}
              </span>
            ))}
          </div>
        )}

        {topCompanies.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[0.75rem] text-muted-foreground font-medium">Aktive:</span>
            <span className="text-[0.8125rem] text-foreground">
              {topCompanies.join(" · ")}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

const DailyBrief = () => {
  const { user } = useAuth();
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

      // Compute "Behov nå" contacts from activities
      const activities = activitiesRes.data ?? [];
      const contacts = contactsRes.data ?? [];

      const actByContact = new Map<string, typeof activities>();
      for (const a of activities) {
        if (!a.contact_id) continue;
        const list = actByContact.get(a.contact_id) || [];
        list.push(a);
        actByContact.set(a.contact_id, list);
      }

      const behovNaContacts: { name: string; updated_at: string }[] = [];
      for (const c of contacts) {
        const cActs = actByContact.get(c.id) || [];
        const sorted = [...cActs].sort((a, b) => b.created_at.localeCompare(a.created_at));
        for (const act of sorted) {
          const cat = extractCategory(act.subject, act.description);
          if (cat === "Behov nå") {
            behovNaContacts.push({
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
        behovNaNames: behovNaContacts.slice(0, 2).map((c) => c.name),
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
            <div className="flex items-center gap-3 py-2">
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
              <span className="text-[0.875rem] text-foreground">
                <span className="font-semibold">{data.overdueCount}</span> oppfølginger er forfalt
              </span>
            </div>
          )}

          <div className="flex items-center gap-3 py-2">
            <ClipboardList className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-[0.875rem] text-foreground">
              <span className="font-semibold">{data.foresporslerCount}</span> forespørsler
              {data.foresporslerNames.length > 0 && (
                <span className="text-muted-foreground">
                  {" — "}
                  {formatNameList(data.foresporslerNames, data.foresporslerCount)}
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-3 py-2">
            <Flame className="h-4 w-4 text-[hsl(var(--warning))] flex-shrink-0" />
            <span className="text-[0.875rem] text-foreground">
              <span className="font-semibold">{data.behovNaCount}</span> kontakter har aktivt behov nå
              {data.behovNaNames.length > 0 && (
                <span className="text-muted-foreground">
                  {" — "}
                  {formatNameList(data.behovNaNames, data.behovNaCount)}
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
