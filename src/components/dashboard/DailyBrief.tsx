import { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { relativeDate } from "@/lib/relativeDate";

const TRACKED_TECHS = [
  "C++", "C", "Rust", "Python", "Zephyr", "Yocto", "Embedded Linux",
  "FreeRTOS", "FPGA", "Qt", "ROS", "CMake", "Linux", "ARM", "RTOS",
  "Bare metal", "Nordic", "STM32", "CAN", "Ethernet", "TCP/IP",
  "Bluetooth", "BLE", "Wi-Fi", "UART", "SPI", "I2C", "USB",
  "Docker", "Git", "Jenkins", "Buildroot", "OpenWRT",
  "Cortex-M", "NRF52", "ESP32", "Raspberry Pi",
  "AUTOSAR", "MISRA", "ISO 26262", "IEC 62443",
  "Modbus", "MQTT", "OPC-UA", "AWS IoT", "Azure IoT",
  "DSP", "Signal processing", "OpenCV", "CUDA",
  "Bootloader", "OTA", "Functional Safety",
  "WebAssembly", "Golang", "Java",
];

function matchTech(text: string, keyword: string): boolean {
  if (keyword === "C") return /\bC\b/.test(text);
  if (keyword === "C++") return text.includes("C++");
  if (keyword === "BLE") return /\bBLE\b/i.test(text);
  return text.toLowerCase().includes(keyword.toLowerCase());
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "God morgen";
  if (h < 18) return "God dag";
  return "God kveld";
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
  techPulse: { name: string; count: number; trend: "up" | "down" | "flat" }[];
}

const DailyBrief = () => {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [openForesp, setOpenForesp] = useState<OpenForesporsel[]>([]);
  const [muligheter, setMuligheter] = useState<MulighetItem[]>([]);
  const [market, setMarket] = useState<MarketData | null>(null);
  const [aiMarket, setAiMarket] = useState<string | null>(null);
  const [aiMarketLoading, setAiMarketLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  const fetchMarketAI = useCallback(async (techPulse: { name: string; count: number }[]) => {
    if (techPulse.length === 0) return;
    setAiMarketLoading(true);
    setAiMarket(null);
    try {
      const techStr = techPulse.map(t => `${t.name}(${t.count})`).join(", ");
      const { data } = await supabase.functions.invoke("chat", {
        body: {
          system: "Du er markedsanalytiker for STACQ, et norsk konsulentselskap innen embedded/firmware. Svar KUN med 2-3 korte setninger på norsk. Maks 40 ord totalt. Vær konkret og direkte.",
          messages: [{
            role: "user",
            content: `Basert på disse teknologifrekvensene fra bemanningsforespørsler og stillingsannonser siste 2 uker: ${techStr}. Oppsummer hva embedded/firmware-markedet etterspør akkurat nå.`,
          }],
        },
      });
      if (data?.text) setAiMarket(data.text as string);
    } catch {
      // AI failure is fine
    } finally {
      setAiMarketLoading(false);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const now = new Date();
      const d45 = new Date(now.getTime() - 45 * 86400000).toISOString().slice(0, 10);
      const d60 = new Date(now.getTime() - 60 * 86400000).toISOString().slice(0, 10);
      const d30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);

      const [
        profileRes,
        foresporlerRes,
        fkRes,
        fkActiveRes,
        ansatteRes,
        finnRes,
      ] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).single(),
        supabase.from("foresporsler").select("id, selskap_navn, teknologier, mottatt_dato")
          .gte("mottatt_dato", d45)
          .order("mottatt_dato", { ascending: false }),
        supabase.from("foresporsler_konsulenter").select("foresporsler_id, status, ansatt_id, ekstern_id"),
        supabase.from("foresporsler_konsulenter").select("foresporsler_id, status, ansatt_id, ekstern_id")
          .in("status", ["intervju", "sendt_cv", "Intervju", "Sendt CV"]),
        supabase.from("stacq_ansatte").select("id, navn"),
        supabase.from("finn_annonser").select("teknologier, dato, uke").gte("dato", d60),
      ]);

      if (profileRes.data) {
        setFirstName(profileRes.data.full_name?.split(" ")[0] ?? "");
      }

      // Åpne forespørsler without consultants (already filtered to 45 days by query)
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

      // Biggest opportunities (Intervju > Sendt CV)
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

      // Market tech tags — use finn_annonser + forespørsler combined
      const finnRows = finnRes.data ?? [];
      const allForespFull = foresporlerRes.data ?? [];

      // Get current ISO week number
      const getISOWeek = (d: Date) => {
        const date = new Date(d.getTime());
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
        const week1 = new Date(date.getFullYear(), 0, 4);
        return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
      };

      const currentWeek = getISOWeek(now);
      const currentYear = now.getFullYear();

      // Current period: last 2 weeks, Previous: 2 weeks before that
      const isInWeekRange = (dato: string, weeksAgo: number, weeksEnd: number) => {
        const d = new Date(dato);
        const diffMs = now.getTime() - d.getTime();
        const diffWeeks = diffMs / (7 * 86400000);
        return diffWeeks >= weeksAgo && diffWeeks < weeksEnd;
      };

      const currentCounts: Record<string, number> = {};
      const prevCounts: Record<string, number> = {};

      // Count from finn_annonser
      for (const r of finnRows) {
        if (!r.teknologier) continue;
        const isCurrent = isInWeekRange(r.dato, 0, 2);
        const isPrev = isInWeekRange(r.dato, 2, 4);
        if (!isCurrent && !isPrev) continue;
        const counts = isCurrent ? currentCounts : prevCounts;
        for (const kw of TRACKED_TECHS) {
          if (matchTech(r.teknologier, kw)) counts[kw] = (counts[kw] || 0) + 1;
        }
      }

      // Count from forespørsler teknologier
      for (const f of allForespFull) {
        if (!f.teknologier) continue;
        const isCurrent = isInWeekRange(f.mottatt_dato, 0, 2);
        const isPrev = isInWeekRange(f.mottatt_dato, 2, 4);
        if (!isCurrent && !isPrev) continue;
        const counts = isCurrent ? currentCounts : prevCounts;
        for (const tech of f.teknologier) {
          for (const kw of TRACKED_TECHS) {
            if (matchTech(tech, kw)) counts[kw] = (counts[kw] || 0) + 1;
          }
        }
      }

      // Also fetch previous period forespørsler (2-4 weeks ago) not in current query
      const d28 = new Date(now.getTime() - 28 * 86400000).toISOString().slice(0, 10);
      const d14 = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10);
      const { data: prevForesp } = await supabase.from("foresporsler")
        .select("teknologier, mottatt_dato")
        .gte("mottatt_dato", d28)
        .lt("mottatt_dato", d14);

      for (const f of (prevForesp ?? [])) {
        if (!f.teknologier) continue;
        for (const tech of f.teknologier) {
          for (const kw of TRACKED_TECHS) {
            if (matchTech(tech, kw)) prevCounts[kw] = (prevCounts[kw] || 0) + 1;
          }
        }
      }

      const techPulse = TRACKED_TECHS
        .map(t => {
          const curr = currentCounts[t] || 0;
          const prev = prevCounts[t] || 0;
          let trend: "up" | "down" | "flat" = "flat";
          if (prev > 0) {
            if (curr > prev * 1.15) trend = "up";
            else if (curr < prev * 0.85) trend = "down";
          } else if (curr > 0) {
            trend = "up";
          }
          return { name: t, count: curr, trend };
        })
        .filter(t => t.count >= 1)
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      if (techPulse.length > 0) {
        setMarket({ techPulse });
        fetchMarketAI(techPulse);
      } else {
        setMarket(null);
      }

      setFetchedAt(new Date());
      setLoading(false);
    } catch (e) {
      console.error("DailyBrief error:", e);
      setLoading(false);
    }
  }, [user?.id, fetchMarketAI]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const timeStr = fetchedAt
    ? `kl. ${fetchedAt.getHours().toString().padStart(2, "0")}:${fetchedAt.getMinutes().toString().padStart(2, "0")}`
    : "";

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
          {/* Åpne forespørsler */}
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

          {/* Største muligheter */}
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

          {/* Marked */}
          {market && market.techPulse.length > 0 && (
            <>
              <div className="border-t border-border pt-3 pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Marked siste 2 uker</span>
                  <Link to="/markedsradar" className="text-[0.75rem] text-primary hover:underline">Se mer →</Link>
                </div>
              </div>
              {/* AI market summary */}
              {aiMarketLoading ? (
                <Skeleton className="h-4 w-3/4 mb-3" />
              ) : aiMarket ? (
                <p className="text-sm text-muted-foreground mb-3 animate-in fade-in duration-500">{aiMarket}</p>
              ) : null}
              <span className="text-[0.6875rem] text-muted-foreground mb-2 block">Siste 2 uker · forespørsler + finn.no</span>
              <div className="flex flex-wrap gap-1.5 pb-1">
                {market.techPulse.map(t => (
                  <span
                    key={t.name}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[0.75rem] font-medium text-muted-foreground"
                  >
                    {t.name} <span className="font-bold">{t.count}</span>
                    {t.trend === "up" && <span className="text-emerald-500">↑</span>}
                    {t.trend === "down" && <span className="text-red-400">↓</span>}
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
