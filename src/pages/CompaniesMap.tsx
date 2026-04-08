import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2 } from "lucide-react";

const TYPE_OPTIONS = [
  { value: "all", label: "Alle" },
  { value: "prospect", label: "Potensiell kunde" },
  { value: "customer", label: "Kunde" },
  { value: "partner", label: "Partner" },
  { value: "churned", label: "Ikke relevant selskap" },
];

const TYPE_COLORS: Record<string, string> = {
  prospect: "#f59e0b",
  customer: "#10b981",
  partner: "#6b7280",
  churned: "#ef4444",
  default: "#3b82f6",
};

function getColor(status: string) {
  return TYPE_COLORS[status] || TYPE_COLORS.default;
}

const NO_CITIES: Record<string, [number, number]> = {
  "oslo": [59.9139, 10.7522], "bergen": [60.3913, 5.3221], "trondheim": [63.4305, 10.3951],
  "stavanger": [58.9700, 5.7331], "tromsø": [69.6496, 18.9560], "fredrikstad": [59.2181, 10.9298],
  "drammen": [59.7440, 10.2045], "kristiansand": [58.1599, 8.0182], "sandnes": [58.8516, 5.7355],
  "ålesund": [62.4722, 6.1495], "sarpsborg": [59.2836, 11.1097], "bodø": [67.2827, 14.3751],
  "sandefjord": [59.1319, 10.2167], "arendal": [58.4608, 8.7722], "tønsberg": [59.2672, 10.4076],
  "haugesund": [59.4138, 5.2680], "porsgrunn": [59.1407, 9.6556], "skien": [59.2090, 9.5528],
  "moss": [59.4330, 10.6584], "hamar": [60.7945, 11.0679], "lillehammer": [61.1153, 10.4662],
  "gjøvik": [60.7957, 10.6916], "halden": [59.1229, 11.3878], "molde": [62.7375, 7.1591],
  "horten": [59.4141, 10.4840], "harstad": [68.7993, 16.5402], "narvik": [68.4385, 17.4272],
  "kongsberg": [59.6674, 9.6499], "steinkjer": [64.0142, 11.4953], "alta": [69.9688, 23.2716],
  "jessheim": [60.1427, 11.1739], "ski": [59.7186, 10.8374], "elverum": [60.8836, 11.5620],
  "lillestrom": [59.9555, 11.0494], "lillestrøm": [59.9555, 11.0494], "kongsvinger": [60.1893, 12.0027],
  "bryne": [58.7375, 5.6433], "egersund": [58.4505, 6.0018], "kopervik": [59.2813, 5.3087],
  "forde": [61.4524, 5.8571], "førde": [61.4524, 5.8571], "sogndal": [61.2294, 7.0977],
  "stord": [59.7792, 5.5020], "odda": [60.0674, 6.5461], "voss": [60.6278, 6.4152],
  "leirvik": [59.7792, 5.5020], "mosjøen": [65.8358, 13.1958], "mo i rana": [66.3127, 14.1427],
  "sandnessjøen": [66.0147, 12.6363], "brønnøysund": [65.4741, 12.2152], "namsos": [64.4661, 11.4958],
  "stjørdal": [63.4717, 10.9248], "levanger": [63.7461, 11.2994], "verdal": [63.7930, 11.4837],
  "orkanger": [63.3083, 9.8530], "melhus": [63.2830, 10.2696], "oppdal": [62.5953, 9.6898],
  "røros": [62.5742, 11.3872], "tynset": [62.2766, 10.7786], "ringebu": [61.5305, 10.1636],
  "otta": [61.7731, 9.5356], "raufoss": [60.7232, 10.6136], "hønefoss": [60.1704, 10.2527],
  "nesbyen": [60.5709, 9.1156], "ål": [60.6285, 8.5657], "geilo": [60.5350, 8.2046],
  "flå": [60.4272, 9.2804], "lyngdal": [58.1379, 7.0773], "farsund": [58.0955, 6.8013],
  "flekkefjord": [58.2975, 6.6635], "mandal": [58.0296, 7.4618], "grimstad": [58.3406, 8.5932],
  "risør": [58.7225, 9.2311], "kragerø": [58.8668, 9.4115], "notodden": [59.5572, 9.2570],
  "nøtterøy": [59.2208, 10.4100], "larvik": [59.0572, 10.0282],
  "holmestrand": [59.4900, 10.3213], "lier": [59.7915, 10.2365], "hokksund": [59.7705, 9.9181],
  "mjøndalen": [59.7433, 10.0176], "nedre eiker": [59.7433, 10.0176], "øvre eiker": [59.8120, 9.8987],
  "modum": [59.9833, 9.9750], "sigdal": [60.0620, 9.7170], "numedal": [60.1200, 9.2000],
  "asker": [59.8346, 10.4391], "bærum": [59.8940, 10.5298], "lørenskog": [59.9212, 10.9580],
  "skedsmo": [59.9717, 11.0347], "nittedal": [60.0654, 10.8686], "rælingen": [59.9055, 11.0966],
  "enebakk": [59.7457, 11.1451], "frogn": [59.6866, 10.6701], "vestby": [59.5672, 10.7474],
  "ås": [59.6631, 10.7956], "nesodden": [59.8012, 10.7102], "oppegård": [59.7933, 10.8022],
  "kolbotn": [59.7933, 10.8022], "langhus": [59.7359, 10.8300], "vinterbro": [59.6800, 10.8300],
};

const GEOCODE_CACHE_KEY = "stacq_geocode_cache_v2";

function loadCache(): Record<string, [number, number] | null> {
  try { return JSON.parse(sessionStorage.getItem(GEOCODE_CACHE_KEY) || "{}"); } catch { return {}; }
}

function saveCache(cache: Record<string, [number, number] | null>) {
  try { sessionStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

async function geocodeBatch(cities: string[], cache: Record<string, [number, number] | null>): Promise<void> {
  const unknown: string[] = [];
  for (const city of cities) {
    const key = city.trim().toLowerCase().replace(/\s+/g, " ");
    if (key in cache) continue;
    const hardcoded = NO_CITIES[key];
    if (hardcoded) { cache[key] = hardcoded; }
    else { unknown.push(key); }
  }

  const chunks: string[][] = [];
  for (let i = 0; i < unknown.length; i += 5) chunks.push(unknown.slice(i, i + 5));
  for (const chunk of chunks) {
    await Promise.all(chunk.map(async (key) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(key + ", Norway")}&format=json&limit=1`,
          { headers: { "Accept-Language": "nb" } }
        );
        const data = await res.json();
        cache[key] = data?.[0] ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] : null;
      } catch { cache[key] = null; }
    }));
    if (chunks.indexOf(chunk) < chunks.length - 1) await new Promise(r => setTimeout(r, 1100));
  }
  saveCache(cache);
}

declare global {
  interface Window {
    L: any;
  }
}

const CompaniesMap = () => {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [leafletReady, setLeafletReady] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [geocodedCompanies, setGeocodedCompanies] = useState<
    Array<{ id: string; name: string; city: string; status: string; coords: [number, number] }>
  >([]);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, city, status")
        .not("city", "is", null)
        .neq("city", "");
      if (error) throw error;
      return data || [];
    },
  });

  // Load Leaflet dynamically
  useEffect(() => {
    if (window.L) {
      setLeafletReady(true);
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => setLeafletReady(true);
    document.head.appendChild(script);
  }, []);

  // Geocode companies
  useEffect(() => {
    if (!companies.length) return;
    const run = async () => {
      setGeocoding(true);
      const cache = loadCache();
      const cities = [...new Set(companies.map(c => c.city!.trim().toLowerCase()))];
      await geocodeBatch(cities, cache);
      const result = companies
        .map(c => {
          const coords = cache[c.city!.trim().toLowerCase().replace(/\s+/g, " ")];
          if (!coords) return null;
          return { id: c.id, name: c.name, city: c.city!, status: c.status, coords };
        })
        .filter(Boolean) as Array<{ id: string; name: string; city: string; status: string; coords: [number, number] }>;
      setGeocodedCompanies(result);
      setGeocoding(false);
    };
    run();
  }, [companies]);

  // Init map
  useEffect(() => {
    if (!leafletReady || !mapRef.current || leafletMapRef.current) return;
    const L = window.L;
    const map = L.map(mapRef.current).setView([63.4, 10.4], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
    leafletMapRef.current = map;
  }, [leafletReady]);

  // Update markers when filter or geocoded data changes
  useEffect(() => {
    if (!leafletMapRef.current || !leafletReady) return;
    const L = window.L;
    const map = leafletMapRef.current;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const filtered =
      statusFilter === "all"
        ? geocodedCompanies
        : geocodedCompanies.filter((c) => c.status === statusFilter);

    const byCity: Record<string, typeof filtered> = {};
    filtered.forEach((c) => {
      const key = c.coords.join(",");
      if (!byCity[key]) byCity[key] = [];
      byCity[key].push(c);
    });

    Object.entries(byCity).forEach(([, group]) => {
      const coords = group[0].coords;
      const color = group.length === 1 ? getColor(group[0].status) : TYPE_COLORS.default;

      const icon = L.divIcon({
        className: "",
        html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      const popupContent =
        group.length === 1
          ? `<div style="min-width:120px"><strong style="cursor:pointer" data-id="${group[0].id}">${group[0].name}</strong><br/><span style="color:#888;font-size:12px">${group[0].city}</span></div>`
          : `<div style="min-width:140px"><strong>${group[0].city} (${group.length})</strong><br/>` +
            group
              .map(
                (c) =>
                  `<div style="cursor:pointer;color:#2563eb;margin-top:2px" data-id="${c.id}">${c.name}</div>`
              )
              .join("") +
            `</div>`;

      const marker = L.marker(coords, { icon }).addTo(map);
      marker.bindPopup(popupContent);
      marker.on("popupopen", () => {
        setTimeout(() => {
          document.querySelectorAll("[data-id]").forEach((el: Element) => {
            el.addEventListener("click", () => {
              navigate(`/selskaper/${(el as HTMLElement).dataset.id}`);
            });
          });
        }, 50);
      });

      markersRef.current.push(marker);
    });
  }, [geocodedCompanies, statusFilter, leafletReady, navigate]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  const filteredCount =
    statusFilter === "all"
      ? geocodedCompanies.length
      : geocodedCompanies.filter((c) => c.status === statusFilter).length;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button
          onClick={() => navigate("/selskaper")}
          className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Selskaper
        </button>
        <h1 className="text-[1.375rem] font-bold">Geografisk oversikt</h1>
      </div>

      <div className="flex items-center gap-2 px-4 pb-2 flex-wrap">
        <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Type
        </span>
        {TYPE_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => setStatusFilter(o.value)}
            className={`h-8 px-3 text-[0.8125rem] rounded-full border transition-colors ${
              statusFilter === o.value
                ? "bg-foreground text-background border-foreground font-medium"
                : "border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            {o.label}
          </button>
        ))}
        <span className="ml-auto text-[0.8125rem] text-muted-foreground">
          {geocoding ? "Geocoder..." : `${filteredCount} selskaper på kart`}
        </span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 pb-2">
        {TYPE_OPTIONS.filter((o) => o.value !== "all").map((o) => (
          <div key={o.value} className="flex items-center gap-1.5 text-[0.75rem] text-muted-foreground">
            <div
              className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
              style={{ background: TYPE_COLORS[o.value] }}
            />
            {o.label}
          </div>
        ))}
      </div>

      <div className="flex-1 relative mx-4 mb-4 rounded-lg overflow-hidden border border-border">
        {(isLoading || geocoding) && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
            <span className="text-[0.8125rem] text-muted-foreground">
              {isLoading ? "Henter selskaper..." : "Geocoder byer..."}
            </span>
          </div>
        )}
        <div ref={mapRef} className="absolute inset-0" />
      </div>
    </div>
  );
};

export default CompaniesMap;
