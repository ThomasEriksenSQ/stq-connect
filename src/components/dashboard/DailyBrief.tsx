import { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { relativeDate } from "@/lib/relativeDate";

const TRACKED_TECHS = ["C++", "Rust", "Zephyr", "Yocto", "FreeRTOS", "Embedded Linux"];

function matchTech(text: string, keyword: string): boolean {
  if (keyword === "C") return /\bC\b/.test(text);
  return text.toLowerCase().includes(keyword.toLowerCase());
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "God morgen";
  if (h < 18) return "God dag";
  return "God kveld";
}

interface OverdueTask {
  contactName: string;
  companyName: string;
  contactId: string;
}

interface BehovNaItem {
  contactName: string;
  companyName: string;
  contactId: string;
  daysSince: number;
}

interface RenewalItem {
  konsulent: string;
  kunde: string;
  daysUntil: number;
}

interface OpenForesporsel {
  id: number;
  selskap: string;
  teknologier: string[];
  mottattDato: string;
}

interface MulighetItem {
  selskap: string;
  konsulentNavn: string;
  status: string;
}

interface MarketData {
  techPulse: { name: string; count: number }[];
}

const DailyBrief = () => {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [overdue, setOverdue] = useState<OverdueTask[]>([]);
  const [behovNa, setBehovNa] = useState<BehovNaItem[]>([]);
  const [renewals, setRenewals] = useState<RenewalItem[]>([]);
  const [openForesp, setOpenForesp] = useState<OpenForesporsel[]>([]);
  const [muligheter, setMuligheter] = useState<MulighetItem[]>([]);
  const [market, setMarket] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();
      const d60 = new Date(now.getTime() - 60 * 86400000).toISOString().slice(0, 10);
      const d30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);

      const [
        profileRes,
        overdueTasksRes,
        contactsRes,
        activitiesRes,
        companiesRes,
        renewalRes,
        foresporlerRes,
        fkRes,
        fkActiveRes,
        ansatteRes,
        finnRes,
      ] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).single(),
        supabase.from("tasks").select("id, contact_id, company_id")
          .eq("status", "open").lt("due_date", todayStr),
        supabase.from("contacts").select("id, first_name, last_name, company_id"),
        supabase.from("activities").select("contact_id, subject, description, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("companies").select("id, name"),
        supabase.from("stacq_oppdrag").select("kandidat, kunde, forny_dato")
          .gte("forny_dato", todayStr).order("forny_dato", { ascending: true }).limit(3),
        supabase.from("foresporsler").select("id, selskap_navn, teknologier, mottatt_dato")
          .order("mottatt_dato", { ascending: true }),
        supabase.from("foresporsler_konsulenter").select("foresporsler_id, status, ansatt_id, ekstern_id"),
        supabase.from("foresporsler_konsulenter").select("foresporsler_id, status, ansatt_id, ekstern_id")
          .in("status", ["intervju", "sendt_cv", "Intervju", "Sendt CV"]),
        supabase.from("stacq_ansatte").select("id, navn"),
        supabase.from("finn_annonser").select("teknologier, dato").gte("dato", d60),
      ]);

      if (profileRes.data) {
        setFirstName(profileRes.data.full_name?.split(" ")[0] ?? "");
      }

      const contacts = contactsRes.data ?? [];
      const companies = companiesRes.data ?? [];
      const contactMap = new Map(contacts.map(c => [c.id, c]));
      const companyMap = new Map(companies.map(c => [c.id, c.name]));

      // SECTION 2a: Overdue tasks with contact/company names
      const overdueTasks = overdueTasksRes.data ?? [];
      const overdueItems: OverdueTask[] = [];
      for (const t of overdueTasks.slice(0, 3)) {
        const contact = t.contact_id ? contactMap.get(t.contact_id) : null;
        const companyName = t.company_id ? (companyMap.get(t.company_id) ?? "") : 
          (contact?.company_id ? (companyMap.get(contact.company_id) ?? "") : "");
        if (contact) {
          overdueItems.push({
            contactName: `${contact.first_name} ${contact.last_name}`.trim(),
            companyName,
            contactId: contact.id,
          });
        }
      }
      setOverdue(overdueItems);

      // SECTION 2b: Behov nå not contacted in 7+ days
      const { extractCategory } = await import("@/lib/categoryUtils");
      const activities = activitiesRes.data ?? [];
      const actByContact = new Map<string, typeof activities>();
      for (const a of activities) {
        if (!a.contact_id) continue;
        const list = actByContact.get(a.contact_id) || [];
        list.push(a);
        actByContact.set(a.contact_id, list);
      }
      const behovItems: BehovNaItem[] = [];
      for (const c of contacts) {
        const cActs = actByContact.get(c.id) || [];
        const sorted = [...cActs].sort((a, b) => b.created_at.localeCompare(a.created_at));
        for (const act of sorted) {
          const cat = extractCategory(act.subject, act.description);
          if (cat === "Behov nå") {
            const lastContactDate = new Date(sorted[0].created_at);
            const daysSince = Math.floor((now.getTime() - lastContactDate.getTime()) / 86400000);
            if (daysSince >= 7) {
              behovItems.push({
                contactName: `${c.first_name} ${c.last_name}`.trim(),
                companyName: c.company_id ? (companyMap.get(c.company_id) ?? "") : "",
                contactId: c.id,
                daysSince,
              });
            }
            break;
          }
          if (cat) break;
        }
      }
      setBehovNa(behovItems.slice(0, 3));

      // SECTION 2c: Nearest renewals
      const renewalItems: RenewalItem[] = (renewalRes.data ?? []).map(r => ({
        konsulent: r.kandidat,
        kunde: r.kunde ?? "",
        daysUntil: Math.max(0, Math.floor((new Date(r.forny_dato!).getTime() - now.getTime()) / 86400000)),
      }));
      setRenewals(renewalItems.slice(0, 3));

      // SECTION 3: Open forespørsler without consultants
      const allForesp = foresporlerRes.data ?? [];
      const fkData = fkRes.data ?? [];
      const fkByForesp = new Set(fkData.map(r => r.foresporsler_id));
      const openItems: OpenForesporsel[] = allForesp
        .filter(f => !fkByForesp.has(f.id))
        .slice(0, 3)
        .map(f => ({
          id: f.id,
          selskap: f.selskap_navn,
          teknologier: f.teknologier ?? [],
          mottattDato: f.mottatt_dato,
        }));
      setOpenForesp(openItems);

      // SECTION 4: Biggest opportunities (Intervju > Sendt CV)
      const activeFk = fkActiveRes.data ?? [];
      const ansatte = ansatteRes.data ?? [];
      const ansattMap = new Map(ansatte.map(a => [a.id, a.navn]));
      const forespMap = new Map(allForesp.map(f => [f.id, f.selskap_navn]));

      const mulighetItems: MulighetItem[] = activeFk
        .sort((a, b) => {
          const order = (s: string) => s.toLowerCase() === "intervju" ? 0 : 1;
          return order(a.status) - order(b.status);
        })
        .slice(0, 3)
        .map(fk => {
          const selskap = forespMap.get(fk.foresporsler_id) ?? "";
          let konsulentNavn = "";
          if (fk.ansatt_id) {
            const full = ansattMap.get(fk.ansatt_id) ?? "";
            konsulentNavn = full.split(" ")[0];
          }
          return {
            selskap,
            konsulentNavn,
            status: fk.status.toLowerCase() === "intervju" ? "Intervju" : "Sendt CV",
          };
        });
      setMuligheter(mulighetItems);

      // SECTION 5: Market tech tags
      const finnRows = finnRes.data ?? [];
      if (finnRows.length > 0) {
        const recentRows = finnRows.filter(r => r.dato >= d30);
        const counts: Record<string, number> = {};
        for (const r of recentRows) {
          if (!r.teknologier) continue;
          for (const kw of TRACKED_TECHS) {
            if (matchTech(r.teknologier, kw)) counts[kw] = (counts[kw] || 0) + 1;
          }
        }
        const techPulse = TRACKED_TECHS
          .map(t => ({ name: t, count: counts[t] || 0 }))
          .filter(t => t.count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        setMarket({ techPulse });
      } else {
        setMarket(null);
      }

      setFetchedAt(new Date());
      setLoading(false);
    } catch (e) {
      console.error("DailyBrief error:", e);
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const timeStr = fetchedAt
    ? `kl. ${fetchedAt.getHours().toString().padStart(2, "0")}:${fetchedAt.getMinutes().toString().padStart(2, "0")}`
    : "";

  const hasOppfolging = overdue.length > 0 || behovNa.length > 0 || renewals.length > 0;

  return (
    <div className="bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.07)] overflow-hidden px-5 pt-4 pb-4">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[1.25rem] font-bold text-foreground">
          {getGreeting()}, {firstName} 👋
        </h2>
        <div className="flex items-center gap-2 text-muted-foreground">
          <button onClick={fetchAll} className="p-1 rounded hover:bg-secondary transition-colors" title="Oppdater">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          {timeStr && <span className="text-[0.75rem]">{timeStr}</span>}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-6 w-full rounded" />)}
        </div>
      ) : (
        <div className="space-y-0">
          {/* SECTION 2: Oppfølging */}
          {hasOppfolging && (
            <>
              <div className="border-t border-border pt-3 pb-2">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Oppfølging</span>
              </div>
              <div className="space-y-1 pb-2">
                {overdue.map((item, i) => (
                  <Link key={`od-${i}`} to={`/kontakter/${item.contactId}`} className="block text-[0.875rem] text-foreground hover:bg-secondary/50 rounded px-1 -mx-1 py-0.5 transition-colors">
                    ⚠️ Forfalt: <span className="font-medium">{item.contactName}</span>
                    {item.companyName && <span className="text-muted-foreground"> · {item.companyName}</span>}
                  </Link>
                ))}
                {behovNa.map((item, i) => (
                  <Link key={`bn-${i}`} to={`/kontakter/${item.contactId}`} className="block text-[0.875rem] text-foreground hover:bg-secondary/50 rounded px-1 -mx-1 py-0.5 transition-colors">
                    🔥 Behov nå: <span className="font-medium">{item.contactName}</span>
                    {item.companyName && <span className="text-muted-foreground"> · {item.companyName}</span>}
                    <span className="text-muted-foreground"> · {item.daysSince}d siden</span>
                  </Link>
                ))}
                {renewals.map((item, i) => (
                  <Link key={`rn-${i}`} to="/stacq/prisen" className="block text-[0.875rem] text-foreground hover:bg-secondary/50 rounded px-1 -mx-1 py-0.5 transition-colors">
                    🔄 Fornyelse: <span className="font-medium">{item.konsulent}</span>
                    {item.kunde && <span className="text-muted-foreground"> · {item.kunde}</span>}
                    <span className="text-muted-foreground"> · om {item.daysUntil}d</span>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* SECTION 3: Åpne forespørsler */}
          {openForesp.length > 0 && (
            <>
              <div className="border-t border-border pt-3 pb-2">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Åpne forespørsler uten konsulent</span>
              </div>
              <div className="space-y-1 pb-2">
                {openForesp.map((item) => (
                  <Link key={item.id} to="/foresporsler" className="block text-[0.875rem] text-foreground hover:bg-secondary/50 rounded px-1 -mx-1 py-0.5 transition-colors">
                    📋 <span className="font-medium">{item.selskap}</span>
                    {item.teknologier.length > 0 && <span className="text-muted-foreground"> — {item.teknologier.slice(0, 3).join(", ")}</span>}
                    <span className="text-muted-foreground"> — {relativeDate(item.mottattDato)}</span>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* SECTION 4: Største muligheter */}
          {muligheter.length > 0 && (
            <>
              <div className="border-t border-border pt-3 pb-2">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Største muligheter</span>
              </div>
              <div className="space-y-1 pb-2">
                {muligheter.map((item, i) => (
                  <Link key={`mul-${i}`} to="/foresporsler" className="flex items-center gap-2 text-[0.875rem] text-foreground hover:bg-secondary/50 rounded px-1 -mx-1 py-0.5 transition-colors">
                    <span>🏆 <span className="font-medium">{item.selskap}</span></span>
                    {item.konsulentNavn && <span className="text-muted-foreground">— {item.konsulentNavn}</span>}
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold border ${
                      item.status === "Intervju"
                        ? "bg-purple-100 text-purple-700 border-purple-200"
                        : "bg-blue-100 text-blue-700 border-blue-200"
                    }`}>
                      {item.status}
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* SECTION 5: Marked */}
          {market && market.techPulse.length > 0 && (
            <>
              <div className="border-t border-border pt-3 pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Marked</span>
                  <Link to="/markedsradar" className="text-[0.75rem] text-primary hover:underline">Se mer →</Link>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pb-1">
                {market.techPulse.map(t => (
                  <span
                    key={t.name}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[0.75rem] font-medium text-muted-foreground"
                  >
                    {t.name} <span className="font-bold">{t.count}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DailyBrief;
