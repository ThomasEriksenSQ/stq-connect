import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { companiesMatch, normalizeCompanyName } from "@/lib/companyMatch";

const TRACKED_TECHS = ["C++", "Rust", "Zephyr", "Yocto", "FreeRTOS", "Embedded Linux"];

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

interface SalesData {
  behovNaCount: number;
  behovNaContacts: { id: string; name: string }[];
  utenKonsulentCount: number;
  utenKonsulentNames: string[];
  overdueCount: number;
  renewalCount: number;
  renewalFirst: { name: string; dato: string } | null;
}

interface MarketData {
  techPulse: { name: string; count: number; growing: boolean }[];
  hotCompanies: string[];
  hotTotal: number;
}

const DailyBrief = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ full_name: string } | null>(null);
  const [sales, setSales] = useState<SalesData | null>(null);
  const [market, setMarket] = useState<MarketData | null>(null);
  const [hasFinn, setHasFinn] = useState<boolean | null>(null);
  const [aiPriority, setAiPriority] = useState<string | null>(null);
  const [aiMarket, setAiMarket] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setAiPriority(null);
    setAiMarket(null);

    try {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const d45 = new Date(now.getTime() - 45 * 86400000).toISOString();
      const d30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
      const d60 = new Date(now.getTime() - 60 * 86400000).toISOString().slice(0, 10);
      const d21 = new Date(now.getTime() - 21 * 86400000).toISOString().slice(0, 10);
      const d30future = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);

      // Parallel fetches
      const [
        profileRes,
        overdueRes,
        foresporlerRes,
        fkRes,
        contactsRes,
        activitiesRes,
        renewalRes,
        finnRes,
        companiesRes,
      ] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).single(),
        supabase.from("tasks").select("id", { count: "exact", head: true })
          .eq("status", "open").lt("due_date", todayStr).eq("assigned_to", user.id),
        supabase.from("foresporsler").select("id, selskap_navn, selskap_id")
          .gte("created_at", d45),
        supabase.from("foresporsler_konsulenter").select("foresporsler_id"),
        supabase.from("contacts").select("id, first_name, last_name, company_id"),
        supabase.from("activities").select("contact_id, subject, description, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("stacq_oppdrag").select("kandidat, forny_dato")
          .gte("forny_dato", todayStr).lte("forny_dato", d30future),
        supabase.from("finn_annonser").select("selskap, teknologier, dato").gte("dato", d60),
        supabase.from("companies").select("id, name, category"),
      ]);

      if (profileRes.data) setProfile(profileRes.data);

      const foresporsler = foresporlerRes.data ?? [];
      const fkIds = new Set((fkRes.data ?? []).map(r => r.foresporsler_id));
      const utenKonsulent = foresporsler.filter(f => !fkIds.has(f.id));

      // Behov nå contacts (from activity history using extractCategory)
      const { extractCategory } = await import("@/lib/categoryUtils");
      const activities = activitiesRes.data ?? [];
      const contacts = contactsRes.data ?? [];
      const actByContact = new Map<string, typeof activities>();
      for (const a of activities) {
        if (!a.contact_id) continue;
        const list = actByContact.get(a.contact_id) || [];
        list.push(a);
        actByContact.set(a.contact_id, list);
      }
      const behovNa: { id: string; name: string }[] = [];
      for (const c of contacts) {
        const cActs = actByContact.get(c.id) || [];
        const sorted = [...cActs].sort((a, b) => b.created_at.localeCompare(a.created_at));
        for (const act of sorted) {
          const cat = extractCategory(act.subject, act.description);
          if (cat === "Behov nå") {
            behovNa.push({ id: c.id, name: `${c.first_name} ${c.last_name}`.trim() });
            break;
          }
          if (cat) break;
        }
      }

      const renewals = renewalRes.data ?? [];

      const salesData: SalesData = {
        behovNaCount: behovNa.length,
        behovNaContacts: behovNa.slice(0, 2),
        utenKonsulentCount: utenKonsulent.length,
        utenKonsulentNames: [...new Set(utenKonsulent.map(f => f.selskap_navn))].slice(0, 2),
        overdueCount: overdueRes.count ?? 0,
        renewalCount: renewals.length,
        renewalFirst: renewals.length > 0
          ? { name: renewals[0].kandidat, dato: renewals[0].forny_dato! }
          : null,
      };
      setSales(salesData);

      // Market data
      const finnRows = finnRes.data ?? [];
      const companies = companiesRes.data ?? [];
      setHasFinn(finnRows.length > 0);

      if (finnRows.length > 0) {
        // Tech pulse: count per 30-day period
        const recent: typeof finnRows = [];
        const prev: typeof finnRows = [];
        for (const r of finnRows) {
          if (r.dato >= d30) recent.push(r);
          else prev.push(r);
        }

        const countTechs = (rows: typeof finnRows) => {
          const counts: Record<string, number> = {};
          for (const r of rows) {
            if (!r.teknologier) continue;
            for (const kw of TRACKED_TECHS) {
              if (matchTech(r.teknologier, kw)) counts[kw] = (counts[kw] || 0) + 1;
            }
          }
          return counts;
        };
        const recentCounts = countTechs(recent);
        const prevCounts = countTechs(prev);

        const techPulse = TRACKED_TECHS
          .map(t => ({ name: t, count: recentCounts[t] || 0, growing: (recentCounts[t] || 0) > (prevCounts[t] || 0) }))
          .filter(t => t.count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Hot companies not in CRM (last 21 days, 2+ ads)
        const recentFinn = finnRows.filter(r => r.dato >= d21 && r.selskap);
        const bySel = new Map<string, number>();
        for (const r of recentFinn) {
          const s = r.selskap!.trim();
          bySel.set(s, (bySel.get(s) || 0) + 1);
        }
        const hotNotCRM: string[] = [];
        for (const [sel, cnt] of bySel) {
          if (cnt >= 2 && !companies.some(c => companiesMatch(sel, c.name))) {
            hotNotCRM.push(sel);
          }
        }

        setMarket({
          techPulse,
          hotCompanies: hotNotCRM.slice(0, 2),
          hotTotal: hotNotCRM.length,
        });

        // AI call
        fetchAI(salesData, {
          techPulse,
          hotCompanies: hotNotCRM.slice(0, 2),
          hotTotal: hotNotCRM.length,
        }, renewals.length);
      } else {
        setMarket(null);
        fetchAI(salesData, null, renewals.length);
      }

      setFetchedAt(new Date());
      setLoading(false);
    } catch (e) {
      console.error("DailyBrief error:", e);
      setLoading(false);
    }
  }, [user?.id]);

  const fetchAI = async (s: SalesData, m: MarketData | null, renewals: number) => {
    try {
      const marketInfo = m
        ? `Teknologipuls: ${m.techPulse.map(t => `${t.name}(${t.count})`).join(",")}. ${m.hotTotal} selskaper på Finn ikke i CRM.`
        : "";
      const { data } = await supabase.functions.invoke("chat", {
        body: {
          system: `Du er salgsassistent for STACQ. Svar med NØYAKTIG denne strukturen, ingen annen tekst:\nPRIORITET: [én setning, maks 15 ord, hva haster mest]\nMARKED: [én setning, maks 15 ord, viktigste markedssignal]`,
          messages: [{
            role: "user",
            content: `Behov nå: ${s.behovNaCount}. Forespørsler uten konsulent: ${s.utenKonsulentCount}. Forfalt: ${s.overdueCount}. Fornyelser 30d: ${renewals}. ${marketInfo}`,
          }],
        },
      });
      if (data?.text) {
        const text = data.text as string;
        const pMatch = text.match(/PRIORITET:\s*(.+)/i);
        const mMatch = text.match(/MARKED:\s*(.+)/i);
        if (pMatch) setAiPriority(pMatch[1].trim());
        if (mMatch) setAiMarket(mMatch[1].trim());
      }
    } catch {
      // AI failure is fine — data still shows
    }
  };

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "";
  const timeStr = fetchedAt
    ? `kl. ${fetchedAt.getHours().toString().padStart(2, "0")}:${fetchedAt.getMinutes().toString().padStart(2, "0")}`
    : "";

  const showMarket = hasFinn === true && market !== null;

  return (
    <div className="bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.07)] overflow-hidden px-5 pt-4 pb-4">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[1.25rem] font-bold text-foreground">
          {getGreeting()}, {firstName} 👋
        </h2>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="text-[0.75rem]">AI</span>
          <button onClick={fetchAll} className="p-1 rounded hover:bg-secondary transition-colors" title="Oppdater">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          {timeStr && <span className="text-[0.75rem]">{timeStr}</span>}
        </div>
      </div>

      {/* AI PRIORITY LINE */}
      {loading ? (
        <Skeleton className="h-4 w-3/4 mb-3" />
      ) : aiPriority ? (
        <p className="text-[0.8125rem] italic text-muted-foreground mb-3 animate-in fade-in duration-500">{aiPriority}</p>
      ) : null}

      <div className="border-t border-border mb-3" />

      {/* TWO COLUMNS */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8 w-full rounded" />)}
        </div>
      ) : sales ? (
        <div className={`grid gap-4 ${showMarket ? "grid-cols-2" : "grid-cols-1"}`}>
          {/* LEFT: Salg */}
          <div className="space-y-2">
            {/* Row 1: Behov nå */}
            {sales.behovNaCount > 0 && (
              <Link to="/kontakter" className="flex items-center justify-between py-1.5 hover:bg-secondary/50 rounded px-1 -mx-1 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-[0.875rem]">🔥</span>
                  <span className="text-[0.8125rem] text-foreground">Behov nå</span>
                </div>
                <div className="text-right">
                  <span className="text-[0.875rem] font-bold text-foreground">{sales.behovNaCount}</span>
                  {sales.behovNaContacts.length > 0 && (
                    <span className="text-[0.75rem] text-muted-foreground ml-2">
                      {sales.behovNaContacts.map(c => c.name).join(", ")}
                    </span>
                  )}
                </div>
              </Link>
            )}

            {/* Row 2: Uten konsulent */}
            {sales.utenKonsulentCount > 0 && (
              <Link to="/foresporsler" className="flex items-center justify-between py-1.5 hover:bg-secondary/50 rounded px-1 -mx-1 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-[0.875rem]">📋</span>
                  <span className="text-[0.8125rem] text-foreground">Uten konsulent</span>
                </div>
                <div className="text-right">
                  <span className="text-[0.875rem] font-bold text-foreground">{sales.utenKonsulentCount}</span>
                  {sales.utenKonsulentNames.length > 0 && (
                    <span className="text-[0.75rem] text-muted-foreground ml-2">
                      {sales.utenKonsulentNames.join(", ")}
                    </span>
                  )}
                </div>
              </Link>
            )}

            {/* Row 3: Forfalt */}
            <div
              className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-secondary/50 rounded px-1 -mx-1 transition-colors"
              onClick={() => {
                const el = document.getElementById("oppfolginger-section");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[0.875rem]">⚠️</span>
                <span className="text-[0.8125rem] text-foreground">Forfalt i dag</span>
              </div>
              {sales.overdueCount > 0 ? (
                <span className="text-[0.875rem] font-bold text-destructive">{sales.overdueCount}</span>
              ) : (
                <span className="text-[0.8125rem] font-medium text-[hsl(var(--success))]">✓ Ingen</span>
              )}
            </div>

            {/* Row 4: Fornyelser */}
            {sales.renewalCount > 0 && (
              <Link to="/stacq/prisen" className="flex items-center justify-between py-1.5 hover:bg-secondary/50 rounded px-1 -mx-1 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-[0.875rem]">🔄</span>
                  <span className="text-[0.8125rem] text-foreground">Fornyelser (30d)</span>
                </div>
                <div className="text-right">
                  <span className="text-[0.875rem] font-bold text-foreground">{sales.renewalCount}</span>
                  {sales.renewalFirst && (
                    <span className="text-[0.75rem] text-muted-foreground ml-2">
                      {sales.renewalFirst.name} · {sales.renewalFirst.dato}
                    </span>
                  )}
                </div>
              </Link>
            )}
          </div>

          {/* RIGHT: Marked */}
          {showMarket && market && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[0.8125rem] font-semibold text-foreground">📡 Marked</span>
                <Link to="/markedsradar" className="text-[0.75rem] text-primary hover:underline">Se mer →</Link>
              </div>

              {/* AI market sentence */}
              {aiMarket && (
                <p className="text-[0.8125rem] italic text-muted-foreground">{aiMarket}</p>
              )}

              {/* Tech pulse chips */}
              {market.techPulse.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {market.techPulse.map(t => (
                    <span
                      key={t.name}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.75rem] font-medium ${
                        t.growing
                          ? "border-[hsl(var(--success))]/40 text-[hsl(var(--success))] bg-[hsl(var(--success))]/5"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {t.name} <span className="font-bold">{t.count}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Hot companies not in CRM */}
              {market.hotTotal > 0 && (
                <Link to="/markedsradar" className="block text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors">
                  🆕 {market.hotCompanies.join(" · ")}
                  {market.hotTotal > 2 && ` +${market.hotTotal - 2}`} ikke i CRM
                </Link>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground text-sm">Kunne ikke laste data.</div>
      )}
    </div>
  );
};

export default DailyBrief;
