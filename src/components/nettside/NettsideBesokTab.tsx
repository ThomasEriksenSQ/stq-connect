import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Eye, TimerReset, ArrowDownUp, Monitor, Smartphone, Tablet } from "lucide-react";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar } from "recharts";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { nb } from "date-fns/locale";

const DATE_RANGES = [
  { label: "7 dager", value: "7d" },
  { label: "30 dager", value: "30d" },
  { label: "6 mnd", value: "6mo" },
  { label: "12 mnd", value: "12mo" },
] as const;

type DateRange = (typeof DATE_RANGES)[number]["value"];

function usePlausible(queryType: string, dateRange: DateRange) {
  return useQuery({
    queryKey: ["plausible", queryType, dateRange],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("plausible-stats", {
        body: { query_type: queryType, date_range: dateRange },
      });
      console.log(`[plausible] ${queryType}:`, JSON.stringify(data));
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function KpiCard({ label, value, icon: Icon, loading }: { label: string; value: string; icon: React.ElementType; loading: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      </div>
      {loading ? (
        <div className="h-7 w-20 bg-muted rounded animate-pulse" />
      ) : (
        <p className="text-[1.5rem] font-bold text-foreground">{value}</p>
      )}
    </div>
  );
}

function DeviceIcon({ device }: { device: string }) {
  const d = device.toLowerCase();
  if (d === "mobile") return <Smartphone className="h-4 w-4" />;
  if (d === "tablet") return <Tablet className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
}

export default function NettsideBesokTab() {
  const [dateRange, setDateRange] = useState<DateRange>("30d");

  const { data: aggData, isLoading: aggLoading } = usePlausible("aggregate", dateRange);
  const { data: tsData, isLoading: tsLoading } = usePlausible("timeseries", dateRange);
  const { data: pagesData, isLoading: pagesLoading } = usePlausible("top_pages", dateRange);
  const { data: sourcesData, isLoading: sourcesLoading } = usePlausible("top_sources", dateRange);
  const { data: countriesData, isLoading: countriesLoading } = usePlausible("top_countries", dateRange);
  const { data: devicesData, isLoading: devicesLoading } = usePlausible("devices", dateRange);

  // Parse aggregate results
  const agg = aggData?.results?.[0] ?? {};
  const visitors = agg.metrics?.[0] ?? 0;
  const visits = agg.metrics?.[1] ?? 0;
  const pageviews = agg.metrics?.[2] ?? 0;
  const bounceRate = agg.metrics?.[3] ?? 0;
  const visitDuration = agg.metrics?.[4] ?? 0;

  // Parse timeseries for chart
  const chartData = (tsData?.results ?? []).map((r: any) => ({
    date: r.dimensions?.[0] ?? "",
    visitors: r.metrics?.[0] ?? 0,
    pageviews: r.metrics?.[1] ?? 0,
  }));

  const chartConfig = {
    visitors: { label: "Besøkende", color: "hsl(var(--primary))" },
    pageviews: { label: "Sidevisninger", color: "hsl(var(--muted-foreground))" },
  };

  return (
    <div className="space-y-6">
      {/* Date range chips */}
      <div className="flex flex-wrap gap-2">
        {DATE_RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setDateRange(r.value)}
            className={cn(
              "h-7 px-2.5 text-[0.75rem] rounded-full border transition-colors",
              dateRange === r.value
                ? "bg-primary/10 border-primary/30 text-primary font-medium"
                : "border-border text-muted-foreground hover:bg-secondary"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Besøkende" value={visitors.toLocaleString("nb-NO")} icon={Users} loading={aggLoading} />
        <KpiCard label="Sidevisninger" value={pageviews.toLocaleString("nb-NO")} icon={Eye} loading={aggLoading} />
        <KpiCard label="Avvisningsrate" value={`${Math.round(bounceRate)} %`} icon={ArrowDownUp} loading={aggLoading} />
        <KpiCard label="Besøkstid" value={formatDuration(visitDuration)} icon={TimerReset} loading={aggLoading} />
      </div>

      {/* Time series chart */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3 block">
          Besøkende over tid
        </span>
        {tsLoading ? (
          <div className="h-64 bg-muted rounded animate-pulse" />
        ) : (
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => {
                  try { return format(parseISO(v), "d. MMM", { locale: nb }); } catch { return v; }
                }}
                className="text-[0.6875rem]"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} width={40} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(v) => {
                      try { return format(parseISO(v as string), "d. MMMM yyyy", { locale: nb }); } catch { return v as string; }
                    }}
                  />
                }
              />
              <Line type="monotone" dataKey="visitors" stroke="var(--color-visitors)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="pageviews" stroke="var(--color-pageviews)" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
            </LineChart>
          </ChartContainer>
        )}
      </div>

      {/* Tables grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Top pages */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3 block">
            Topp sider
          </span>
          {pagesLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-6 bg-muted rounded animate-pulse" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[0.75rem]">Side</TableHead>
                  <TableHead className="text-[0.75rem] text-right">Besøkende</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pagesData?.results ?? []).map((r: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-[0.8125rem] font-mono truncate max-w-[200px]">{r.dimensions?.[0]}</TableCell>
                    <TableCell className="text-[0.8125rem] text-right">{(r.metrics?.[0] ?? 0).toLocaleString("nb-NO")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Top sources */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3 block">
            Trafikkkilder
          </span>
          {sourcesLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-6 bg-muted rounded animate-pulse" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[0.75rem]">Kilde</TableHead>
                  <TableHead className="text-[0.75rem] text-right">Besøkende</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(sourcesData?.results ?? []).map((r: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-[0.8125rem]">{r.dimensions?.[0] || "(Direkte)"}</TableCell>
                    <TableCell className="text-[0.8125rem] text-right">{(r.metrics?.[0] ?? 0).toLocaleString("nb-NO")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Countries */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3 block">
            Land
          </span>
          {countriesLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-6 bg-muted rounded animate-pulse" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[0.75rem]">Land</TableHead>
                  <TableHead className="text-[0.75rem] text-right">Besøkende</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(countriesData?.results ?? []).map((r: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-[0.8125rem]">{r.dimensions?.[0] || "(Ukjent)"}</TableCell>
                    <TableCell className="text-[0.8125rem] text-right">{(r.metrics?.[0] ?? 0).toLocaleString("nb-NO")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Devices */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3 block">
            Enheter
          </span>
          {devicesLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-6 bg-muted rounded animate-pulse" />)}</div>
          ) : (
            <div className="space-y-3">
              {(devicesData?.results ?? []).map((r: any, i: number) => {
                const device = r.dimensions?.[0] ?? "Ukjent";
                const count = r.metrics?.[0] ?? 0;
                const pct = r.metrics?.[1] ?? 0;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <DeviceIcon device={device} />
                    <span className="text-[0.8125rem] text-foreground flex-1">{device}</span>
                    <span className="text-[0.8125rem] font-medium tabular-nums">{count.toLocaleString("nb-NO")}</span>
                    <span className="text-[0.75rem] text-muted-foreground w-12 text-right">{Math.round(pct)} %</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
