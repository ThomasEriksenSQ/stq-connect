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

const GEOCODE_CACHE_KEY = "stacq_geocode_cache";

function loadCache(): Record<string, [number, number] | null> {
  try {
    return JSON.parse(sessionStorage.getItem(GEOCODE_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, [number, number] | null>) {
  try {
    sessionStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

async function geocodeCity(
  city: string,
  cache: Record<string, [number, number] | null>
): Promise<[number, number] | null> {
  const key = city.trim().toLowerCase();
  if (key in cache) return cache[key];

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city + ", Norway")}&format=json&limit=1`,
      { headers: { "Accept-Language": "nb" } }
    );
    const data = await res.json();
    if (data && data[0]) {
      const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      cache[key] = coords;
      saveCache(cache);
      return coords;
    }
    cache[key] = null;
    saveCache(cache);
    return null;
  } catch {
    return null;
  }
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

      const uniqueCities = [...new Set(companies.map((c) => c.city!.trim().toLowerCase()))];

      for (let i = 0; i < uniqueCities.length; i++) {
        const city = uniqueCities[i];
        if (!(city in cache)) {
          await geocodeCity(city, cache);
          if (i < uniqueCities.length - 1) await new Promise((r) => setTimeout(r, 1100));
        }
      }

      const result = companies
        .map((c) => {
          const coords = cache[c.city!.trim().toLowerCase()];
          if (!coords) return null;
          return { id: c.id, name: c.name, city: c.city!, status: c.status, coords };
        })
        .filter(Boolean) as Array<{
        id: string;
        name: string;
        city: string;
        status: string;
        coords: [number, number];
      }>;

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
