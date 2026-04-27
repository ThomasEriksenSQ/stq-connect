import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { MapPin } from "lucide-react";
import { buildCompanyGeoSummary, type CompanyGeoCluster, type CompanyGeoInput } from "@/lib/companyGeo";

type CompanyGeoOverviewProps = {
  companies: CompanyGeoInput[];
  isLoading?: boolean;
  selectedCompanyId?: string | null;
  compact?: boolean;
  mapHeight?: CSSProperties["height"];
  className?: string;
  onCompanySelect?: (companyId: string) => void;
};

const STATUS_COLORS: Record<string, string> = {
  prospect: "#d97706",
  customer: "#059669",
  kunde: "#059669",
  partner: "#64748b",
  churned: "#dc2626",
  lead: "#2563eb",
  active: "#2563eb",
  default: "#5E6AD2",
};

const MAP_WIDTH = 820;
const MAP_HEIGHT = 760;
const MAP_PADDING = 54;
const MIN_LAT = 57.4;
const MAX_LAT = 71.6;
const MIN_LON = 3.8;
const MAX_LON = 31.4;

const OUTLINE_COORDS: Array<[number, number]> = [
  [58.02, 7.05],
  [58.1, 8.05],
  [58.42, 8.75],
  [58.85, 9.55],
  [59.12, 10.35],
  [59.92, 10.75],
  [60.55, 11.45],
  [61.35, 12.1],
  [62.25, 12.25],
  [63.35, 12.0],
  [64.1, 13.45],
  [65.25, 14.25],
  [66.25, 15.9],
  [67.25, 16.65],
  [68.2, 18.1],
  [69.05, 19.25],
  [69.65, 21.15],
  [70.05, 23.3],
  [70.22, 25.55],
  [69.9, 28.2],
  [69.75, 30.25],
  [69.25, 30.85],
  [68.95, 29.55],
  [69.38, 27.25],
  [70.25, 25.4],
  [70.65, 23.4],
  [70.1, 21.0],
  [69.68, 18.95],
  [69.0, 17.15],
  [68.15, 15.6],
  [67.2, 14.25],
  [66.28, 13.45],
  [65.28, 12.2],
  [64.2, 11.25],
  [63.42, 10.38],
  [62.72, 8.15],
  [61.6, 6.2],
  [60.78, 5.08],
  [60.38, 5.32],
  [59.85, 5.25],
  [59.42, 5.25],
  [58.98, 5.73],
  [58.64, 6.05],
  [58.25, 6.65],
  [58.02, 7.05],
];

const ISLAND_COORDS: Array<Array<[number, number]>> = [
  [
    [68.22, 13.5],
    [68.42, 14.45],
    [68.2, 15.05],
    [67.88, 14.55],
    [68.0, 13.75],
    [68.22, 13.5],
  ],
  [
    [69.72, 18.25],
    [69.92, 18.95],
    [69.66, 19.45],
    [69.38, 18.8],
    [69.48, 18.35],
    [69.72, 18.25],
  ],
];

const CITY_LABELS: Array<{ label: string; coord: [number, number] }> = [
  { label: "Oslo", coord: [59.9139, 10.7522] },
  { label: "Bergen", coord: [60.3913, 5.3221] },
  { label: "Trondheim", coord: [63.4305, 10.3951] },
  { label: "Stavanger", coord: [58.97, 5.7331] },
  { label: "Tromsø", coord: [69.6496, 18.956] },
];

function projectCoord(coord: [number, number]) {
  const [lat, lon] = coord;
  const lonProgress = (lon - MIN_LON) / (MAX_LON - MIN_LON);
  const latProgress = (lat - MIN_LAT) / (MAX_LAT - MIN_LAT);
  const usableWidth = MAP_WIDTH - MAP_PADDING * 2;
  const lonWidth = usableWidth * 0.62;
  const northEastShear = usableWidth * 0.22;
  const x = MAP_PADDING + lonProgress * lonWidth + latProgress * northEastShear;
  const y = MAP_PADDING + ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * (MAP_HEIGHT - MAP_PADDING * 2);
  return { x, y };
}

function coordPath(coords: Array<[number, number]>) {
  return coords.map((coord, index) => {
    const { x, y } = projectCoord(coord);
    return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ") + " Z";
}

function getClusterColor(cluster: CompanyGeoCluster) {
  const statuses = [...new Set(cluster.companies.map((company) => company.status || "default"))];
  if (statuses.length !== 1) return STATUS_COLORS.default;
  return STATUS_COLORS[statuses[0]] || STATUS_COLORS.default;
}

function getClusterCompanyCount(cluster: CompanyGeoCluster) {
  return new Set(cluster.companies.map((company) => company.companyId)).size;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function CompanyGeoOverview({
  companies,
  isLoading = false,
  selectedCompanyId,
  compact = false,
  mapHeight,
  className = "",
  onCompanySelect,
}: CompanyGeoOverviewProps) {
  const summary = useMemo(() => buildCompanyGeoSummary(companies), [companies]);
  const [activeClusterKey, setActiveClusterKey] = useState<string | null>(null);
  const activeCluster = activeClusterKey ? summary.clusters.find((cluster) => cluster.key === activeClusterKey) || null : null;
  const uniqueMappedCompanies = useMemo(
    () => new Set(summary.points.map((point) => point.companyId)).size,
    [summary.points],
  );
  const topClusters = summary.clusters.slice(0, compact ? 3 : 5);

  useEffect(() => {
    if (!activeClusterKey) return;
    if (!summary.clusters.some((cluster) => cluster.key === activeClusterKey)) setActiveClusterKey(null);
  }, [activeClusterKey, summary.clusters]);

  const activePosition = activeCluster ? projectCoord(activeCluster.coord) : null;
  const panelHeight = mapHeight ?? (compact ? 220 : 270);
  const wrapperStyle: CSSProperties = {
    borderColor: "#D9DDE7",
    background: "#F8FAFC",
  };

  return (
    <section
      className={`overflow-hidden rounded-[8px] border shadow-[0_1px_2px_rgba(15,23,42,0.06)] ${className}`}
      style={wrapperStyle}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E3E7EF] bg-white px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 text-[#5E6AD2]" />
          <span className="text-[0.8125rem] font-semibold text-[#1A1C1F]">Geografisk oversikt</span>
          <span className="text-[0.75rem] text-[#6B7280]">
            {uniqueMappedCompanies}/{companies.length} selskaper
          </span>
        </div>
        <div className="flex items-center gap-2 text-[0.75rem] text-[#6B7280]">
          <span>{summary.clusters.length} steder</span>
          {summary.missingCompanies.length > 0 && <span>{summary.missingCompanies.length} uten koordinat</span>}
        </div>
      </div>

      <div className="grid min-h-0 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative min-h-0" style={{ height: panelHeight }}>
          {isLoading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-[0.8125rem] text-[#6B7280]">
              Laster selskaper...
            </div>
          ) : null}

          <svg
            className="h-full w-full"
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            role="img"
            aria-label="Kart over selskaper"
            onClick={() => setActiveClusterKey(null)}
          >
            <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#EEF6FB" />
            {[60, 64, 68].map((lat) => {
              const { y } = projectCoord([lat, MIN_LON]);
              return <line key={`lat-${lat}`} x1={0} x2={MAP_WIDTH} y1={y} y2={y} stroke="#D7E3EA" strokeWidth={1} />;
            })}
            {[8, 16, 24].map((lon) => {
              const { x } = projectCoord([MIN_LAT, lon]);
              return <line key={`lon-${lon}`} x1={x} x2={x} y1={0} y2={MAP_HEIGHT} stroke="#D7E3EA" strokeWidth={1} />;
            })}
            <path d={coordPath(OUTLINE_COORDS)} fill="#E8F0E4" stroke="#9CB391" strokeWidth={2.2} opacity={0.96} />
            {ISLAND_COORDS.map((coords, index) => (
              <path
                key={`island-${index}`}
                d={coordPath(coords)}
                fill="#E8F0E4"
                stroke="#9CB391"
                strokeWidth={1.6}
                opacity={0.9}
              />
            ))}
            {CITY_LABELS.map((city) => {
              const { x, y } = projectCoord(city.coord);
              return (
                <text key={city.label} x={x + 8} y={y - 8} fill="#64748B" fontSize={18} fontWeight={600} opacity={0.72}>
                  {city.label}
                </text>
              );
            })}
            {summary.clusters.map((cluster) => {
              const { x, y } = projectCoord(cluster.coord);
              const count = getClusterCompanyCount(cluster);
              const isActive = activeClusterKey === cluster.key;
              const isSelected = cluster.companies.some((company) => company.companyId === selectedCompanyId);
              const radius = clamp(8 + Math.sqrt(count) * 4, 10, 26);
              const color = getClusterColor(cluster);

              return (
                <g
                  key={cluster.key}
                  role="button"
                  tabIndex={0}
                  aria-label={`${cluster.locationLabel}, ${count} selskaper`}
                  transform={`translate(${x} ${y})`}
                  className="cursor-pointer outline-none"
                  onMouseEnter={() => setActiveClusterKey(cluster.key)}
                  onFocus={() => setActiveClusterKey(cluster.key)}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (count === 1) onCompanySelect?.(cluster.companies[0].companyId);
                    else setActiveClusterKey(cluster.key);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    if (count === 1) onCompanySelect?.(cluster.companies[0].companyId);
                    else setActiveClusterKey(cluster.key);
                  }}
                >
                  <circle r={radius + 6} fill={color} opacity={isSelected || isActive ? 0.18 : 0.08} />
                  <circle r={radius} fill={color} stroke="#fff" strokeWidth={3} />
                  {count > 1 ? (
                    <text y="4" textAnchor="middle" fill="#fff" fontSize={13} fontWeight={700}>
                      {count}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>

          {activeCluster && activePosition ? (
            <div
              className="absolute z-20 max-h-[180px] w-[240px] overflow-auto rounded-[8px] border border-[#D9DDE7] bg-white p-2 shadow-[0_16px_40px_rgba(15,23,42,0.18)]"
              style={{
                left: `${clamp((activePosition.x / MAP_WIDTH) * 100, 16, 84)}%`,
                top: `${clamp((activePosition.y / MAP_HEIGHT) * 100, 18, 76)}%`,
                transform: "translate(-50%, -12px)",
              }}
              onMouseLeave={() => setActiveClusterKey(null)}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-[0.8125rem] font-semibold text-[#1A1C1F]">{activeCluster.locationLabel}</span>
                <span className="shrink-0 text-[0.6875rem] font-medium text-[#6B7280]">
                  {getClusterCompanyCount(activeCluster)}
                </span>
              </div>
              <div className="space-y-1">
                {activeCluster.companies.slice(0, 12).map((company) => (
                  <button
                    key={`${activeCluster.key}-${company.companyId}`}
                    type="button"
                    onClick={() => onCompanySelect?.(company.companyId)}
                    className="block w-full truncate rounded-[6px] px-2 py-1 text-left text-[0.75rem] text-[#374151] hover:bg-[#F1F4F9]"
                  >
                    {company.companyName}
                  </button>
                ))}
                {activeCluster.companies.length > 12 ? (
                  <div className="px-2 py-1 text-[0.6875rem] text-[#6B7280]">
                    +{activeCluster.companies.length - 12} flere
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="hidden border-l border-[#E3E7EF] bg-white md:block">
          <div className="border-b border-[#E3E7EF] px-3 py-2 text-[0.6875rem] font-semibold uppercase text-[#6B7280]">
            Flest selskaper
          </div>
          <div className="divide-y divide-[#EEF1F5]">
            {topClusters.length === 0 ? (
              <div className="px-3 py-4 text-[0.75rem] text-[#6B7280]">Ingen steder å vise</div>
            ) : (
              topClusters.map((cluster) => (
                <button
                  key={cluster.key}
                  type="button"
                  onClick={() => setActiveClusterKey(cluster.key)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-[#F8FAFC]"
                >
                  <span className="min-w-0 truncate text-[0.75rem] font-medium text-[#374151]">{cluster.locationLabel}</span>
                  <span className="shrink-0 rounded-[6px] bg-[#EEF1F5] px-2 py-0.5 text-[0.6875rem] font-semibold text-[#4B5563]">
                    {getClusterCompanyCount(cluster)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
