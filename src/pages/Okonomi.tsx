import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Banknote, ChartNoAxesCombined, CircleSlash, Info, RefreshCw, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DesignLabMobileNavButton, DesignLabSidebar } from "@/components/designlab/DesignLabSidebar";
import { DesignLabGhostAction } from "@/components/designlab/system";
import { getDesignLabTextSizeStyle, type TextSize } from "@/components/designlab/TextSizeControl";
import { C } from "@/components/designlab/theme";
import { useAuth } from "@/hooks/useAuth";
import { usePersistentState } from "@/hooks/usePersistentState";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type OkonomiMonth = {
  month: string;
  omsetning: number;
  lonnskostnader: number;
  varekostnad?: number;
  andreDriftskostnader: number;
  finansnetto: number;
  resultatForSkatt: number;
};

type OkonomiResponse = {
  months: OkonomiMonth[];
  previousYearMonths?: OkonomiMonth[];
  years?: OkonomiYearData[];
  year?: number;
  previousYear?: number;
};

type OkonomiYearData = {
  year: number;
  months: OkonomiMonth[];
};

type RowDefinition = {
  label: string;
  values: Array<number | null>;
  previousValues: Array<number | null>;
  ytd: number;
  previousYtd: number;
  emphasis?: "default" | "subtotal" | "total";
  tone?: "default" | "result";
};

type MetricDefinition = {
  label: string;
  value: string;
  sub: string;
  icon: LucideIcon;
  tone?: "default" | "positive" | "negative";
};

type ChartMode = "resultat" | "omsetning" | "margin" | "lonnskostnader" | "varekostnad" | "andreDriftskostnader";

type OkonomiMonthStatus = {
  year: number;
  month: string;
  ready: boolean;
};

const currencyFormatter = new Intl.NumberFormat("nb-NO", {
  maximumFractionDigits: 0,
});

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];

const DEFAULT_CHART_YEARS = [2024, 2025, 2026];

const CHART_YEAR_COLORS: Record<number, string> = {
  2024: C.warning,
  2025: C.accent,
  2026: C.success,
};

const PAYROLL_PERIODIZATION_INFO = "Kan vise feil p.g.a feil periodisering av lønn";

function formatCurrency(value: number) {
  return `${currencyFormatter.format(Math.round(value)).replace(/\u00A0/g, " ")} kr`;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0,0%";
  return `${value.toLocaleString("nb-NO", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
}

function getChangePercent(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function formatChangePercent(value: number | null) {
  if (value === null) return "-";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatPercent(value)}`;
}

function getChangeColor(value: number | null) {
  if (value === null) return C.textGhost;
  if (value > 0) return C.success;
  if (value < 0) return C.danger;
  return C.textFaint;
}

function getMonthReadyKey(year: number, month: string) {
  return `${year}-${month}`;
}

function getReadyValue(year: number, month: OkonomiMonth, readyMonthKeys: Set<string>, value: number) {
  return readyMonthKeys.has(getMonthReadyKey(year, month.month)) ? value : null;
}

function getVarekostnad(month: OkonomiMonth | undefined) {
  return month?.varekostnad ?? 0;
}

function getDriftsresultat(month: OkonomiMonth) {
  return month.omsetning - month.lonnskostnader - getVarekostnad(month) - month.andreDriftskostnader;
}

function LoadingTable() {
  return (
    <div className="overflow-hidden" style={{ border: `1px solid ${C.border}`, background: C.panel, borderRadius: 8, boxShadow: C.shadow }}>
      <div className="px-4 py-4" style={{ borderBottom: `1px solid ${C.borderLight}` }}>
        <Skeleton className="h-5 w-44" />
        <Skeleton className="mt-3 h-4 w-72" />
      </div>
      <div className="space-y-3 px-4 py-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

function EmptyStatePanel({
  title,
  text,
  tone = "neutral",
}: {
  title: string;
  text: string;
  tone?: "neutral" | "danger";
}) {
  const Icon = tone === "danger" ? AlertCircle : CircleSlash;
  const color = tone === "danger" ? C.danger : C.textMuted;
  const background = tone === "danger" ? C.dangerBg : C.surface;

  return (
    <div
      className="flex max-w-3xl items-start gap-3 p-4"
      style={{ border: `1px solid ${tone === "danger" ? C.danger : C.border}`, background, borderRadius: 8 }}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} />
      <div className="min-w-0">
        <p style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{title}</p>
        <p className="mt-1" style={{ color: C.textMuted, fontSize: 12, lineHeight: 1.45 }}>{text}</p>
      </div>
    </div>
  );
}

function MetricCard({ metric }: { metric: MetricDefinition }) {
  const Icon = metric.icon;
  const color = metric.tone === "negative" ? C.danger : metric.tone === "positive" ? C.success : C.text;
  const background = metric.tone === "negative" ? C.dangerBg : metric.tone === "positive" ? C.successBg : C.surfaceAlt;

  return (
    <div
      className="min-w-0 p-3"
      style={{ border: `1px solid ${C.borderLight}`, background: C.panel, borderRadius: 8, boxShadow: C.shadow }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center"
          style={{ border: `1px solid ${C.borderLight}`, background, borderRadius: 6 }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </span>
        <p className="truncate" style={{ color: C.textMuted, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {metric.label}
        </p>
      </div>
      <p className="mt-3 truncate tabular-nums" style={{ color, fontSize: 18, fontWeight: 650 }}>
        {metric.value}
      </p>
      <p className="mt-1 truncate" style={{ color: C.textFaint, fontSize: 12 }}>
        {metric.sub}
      </p>
    </div>
  );
}

function formatCompactCurrency(value: number) {
  return `${Math.round(value / 1000).toLocaleString("nb-NO")}k`;
}

function getMonthMargin(month: OkonomiMonth | undefined) {
  if (!month || month.omsetning === 0) return 0;
  return (month.resultatForSkatt / month.omsetning) * 100;
}

function getChartValue(mode: ChartMode, month: OkonomiMonth | undefined) {
  if (!month) return 0;
  if (mode === "omsetning") return month.omsetning;
  if (mode === "margin") return getMonthMargin(month);
  if (mode === "lonnskostnader") return month.lonnskostnader;
  if (mode === "varekostnad") return getVarekostnad(month);
  if (mode === "andreDriftskostnader") return month.andreDriftskostnader;
  return month.resultatForSkatt;
}

function getChartLabel(mode: ChartMode) {
  if (mode === "omsetning") return "Omsetning";
  if (mode === "margin") return "Margin";
  if (mode === "lonnskostnader") return "Lønnskostnader";
  if (mode === "varekostnad") return "Varekostnad";
  if (mode === "andreDriftskostnader") return "Andre driftskostnader";
  return "Resultat før skatt";
}

function formatChartValue(mode: ChartMode, value: number) {
  if (mode === "margin") return formatPercent(value);
  return formatCurrency(value);
}

function ChartModeButton({
  active,
  children,
  info,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  info?: string;
  onClick: () => void;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 px-3 text-[12px] font-medium transition-colors"
      style={{
        border: `1px solid ${active ? C.accent : C.borderLight}`,
        background: active ? C.accentBg : C.surface,
        color: active ? C.accent : C.textMuted,
        borderRadius: 7,
      }}
    >
      {children}
      {info ? (
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded-full"
          style={{
            border: `1px solid ${active ? C.accent : C.border}`,
            background: active ? C.surface : C.surfaceAlt,
            color: active ? C.accent : C.textFaint,
          }}
          aria-label={info}
        >
          <Info className="h-3 w-3" />
        </span>
      ) : null}
    </button>
  );

  if (!info) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-[12px]">
        {info}
      </TooltipContent>
    </Tooltip>
  );
}

function getChartYearColor(year: number, index: number) {
  const fallbackColors = [C.accent, C.warning, C.success, C.danger, C.textMuted];
  return CHART_YEAR_COLORS[year] ?? fallbackColors[index % fallbackColors.length];
}

export default function Okonomi() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [textSize] = usePersistentState<TextSize>("dl-text-size", "M");
  const [readyMonths, setReadyMonths] = useState<Record<string, boolean>>({});
  const [savingReadyMonth, setSavingReadyMonth] = useState<string | null>(null);
  const [readyError, setReadyError] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>("resultat");
  const [visibleChartYears, setVisibleChartYears] = useState<number[]>(DEFAULT_CHART_YEARS);
  const [months, setMonths] = useState<OkonomiMonth[]>([]);
  const [previousYearMonths, setPreviousYearMonths] = useState<OkonomiMonth[]>([]);
  const [yearSeries, setYearSeries] = useState<OkonomiYearData[]>([]);
  const [year, setYear] = useState(2026);
  const [previousYear, setPreviousYear] = useState(2025);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReadyMonths = useCallback(async (targetYear: number, cancelled?: () => boolean) => {
    try {
      setReadyError(null);
      const { data, error: readyLoadError } = await supabase
        .from("okonomi_month_status" as any)
        .select("year, month, ready")
        .eq("year", targetYear);

      if (readyLoadError) {
        throw readyLoadError;
      }

      if (!cancelled?.()) {
        const nextReadyMonths = Object.fromEntries(
          ((data || []) as OkonomiMonthStatus[]).map((entry) => [getMonthReadyKey(entry.year, entry.month), entry.ready]),
        );
        setReadyMonths(nextReadyMonths);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kunne ikke hente ferdig-status.";
      if (!cancelled?.()) {
        setReadyError(message);
      }
    }
  }, []);

  const loadOkonomi = useCallback(async (cancelled?: () => boolean) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: invokeError } = await supabase.functions.invoke<OkonomiResponse>("tripletex-okonomis");
      if (invokeError) {
        throw invokeError;
      }

      if (!data?.months) {
        throw new Error("Mangler økonomidata fra edge function.");
      }

      if (!cancelled?.()) {
        const nextYear = data.year || 2026;
        const nextPreviousYear = data.previousYear || nextYear - 1;
        const nextYearSeries = data.years?.length
          ? data.years
          : [
              { year: nextPreviousYear, months: data.previousYearMonths || [] },
              { year: nextYear, months: data.months },
            ];
        setMonths(data.months);
        setPreviousYearMonths(data.previousYearMonths || []);
        setYearSeries(nextYearSeries);
        setYear(nextYear);
        setPreviousYear(nextPreviousYear);
        void loadReadyMonths(nextYear, cancelled);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kunne ikke hente økonomidata.";
      if (!cancelled?.()) {
        setError(message);
        setMonths([]);
        setPreviousYearMonths([]);
        setYearSeries([]);
      }
    } finally {
      if (!cancelled?.()) {
        setLoading(false);
      }
    }
  }, [loadReadyMonths]);

  useEffect(() => {
    let cancelled = false;
    void loadOkonomi(() => cancelled);

    return () => {
      cancelled = true;
    };
  }, [loadOkonomi]);

  useEffect(() => {
    const channel = supabase
      .channel(`okonomi-month-status-${year}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "okonomi_month_status", filter: `year=eq.${year}` },
        (payload) => {
          const entry = (payload.new || payload.old) as Partial<OkonomiMonthStatus>;
          if (!entry.month) return;
          setReadyMonths((current) => ({
            ...current,
            [getMonthReadyKey(entry.year || year, entry.month)]: payload.eventType === "DELETE" ? false : Boolean(entry.ready),
          }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [year]);

  const monthLabels = useMemo(() => months.map((entry) => entry.month), [months]);
  const readyMonthKeys = useMemo(() => {
    return new Set(months.filter((month) => readyMonths[getMonthReadyKey(year, month.month)]).map((month) => getMonthReadyKey(year, month.month)));
  }, [months, readyMonths, year]);
  const readyMonthsList = useMemo(() => months.filter((month) => readyMonthKeys.has(getMonthReadyKey(year, month.month))), [months, readyMonthKeys, year]);
  const previousByMonth = useMemo(() => {
    return new Map(previousYearMonths.map((entry) => [entry.month, entry]));
  }, [previousYearMonths]);
  const readyPreviousMonthsList = useMemo(
    () => readyMonthsList.map((month) => previousByMonth.get(month.month)).filter((month): month is OkonomiMonth => Boolean(month)),
    [previousByMonth, readyMonthsList],
  );
  const chartMonthsByYear = useMemo(() => {
    const sourceYears = yearSeries.length
      ? yearSeries
      : [
          { year: previousYear, months: previousYearMonths },
          { year, months },
        ];

    return new Map(sourceYears.map((entry) => [entry.year, entry.months]));
  }, [months, previousYear, previousYearMonths, year, yearSeries]);
  const availableChartYears = useMemo(() => {
    return Array.from(chartMonthsByYear.keys()).sort((a, b) => a - b);
  }, [chartMonthsByYear]);
  const activeChartYears = useMemo(() => {
    const selected = visibleChartYears.filter((chartYear) => chartMonthsByYear.has(chartYear));
    return selected.length ? selected : availableChartYears;
  }, [availableChartYears, chartMonthsByYear, visibleChartYears]);

  const toggleReadyMonth = async (month: string) => {
    const key = getMonthReadyKey(year, month);
    const nextReady = !readyMonths[key];

    setSavingReadyMonth(key);
    setReadyError(null);
    setReadyMonths((current) => ({
      ...current,
      [key]: nextReady,
    }));

    const { error: saveError } = await supabase
      .from("okonomi_month_status" as any)
      .upsert(
        {
          year,
          month,
          ready: nextReady,
          updated_by: user?.id ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "year,month" },
      );

    if (saveError) {
      setReadyMonths((current) => ({
        ...current,
        [key]: !nextReady,
      }));
      setReadyError(saveError.message);
    }

    setSavingReadyMonth(null);
  };

  const toggleChartYear = (chartYear: number) => {
    setVisibleChartYears((current) => {
      if (current.includes(chartYear)) {
        return current.length === 1 ? current : current.filter((entry) => entry !== chartYear);
      }

      return [...current, chartYear].sort((a, b) => a - b);
    });
  };

  const rows = useMemo<RowDefinition[]>(() => {
    const driftsresultat = months.map(getDriftsresultat);
    const previousDriftsresultatByMonth = new Map(
      previousYearMonths.map((entry) => [entry.month, getDriftsresultat(entry)]),
    );

    const rowDefinitions: RowDefinition[] = [
      {
        label: "Omsetning",
        values: months.map((entry) => getReadyValue(year, entry, readyMonthKeys, entry.omsetning)),
        previousValues: months.map((entry) => getReadyValue(year, entry, readyMonthKeys, previousByMonth.get(entry.month)?.omsetning ?? 0)),
        ytd: readyMonthsList.reduce((sum, entry) => sum + entry.omsetning, 0),
        previousYtd: readyPreviousMonthsList.reduce((sum, entry) => sum + entry.omsetning, 0),
        emphasis: "default",
      },
      {
        label: "Lønnskostnader",
        values: months.map((entry) => getReadyValue(year, entry, readyMonthKeys, entry.lonnskostnader)),
        previousValues: months.map((entry) => getReadyValue(year, entry, readyMonthKeys, previousByMonth.get(entry.month)?.lonnskostnader ?? 0)),
        ytd: readyMonthsList.reduce((sum, entry) => sum + entry.lonnskostnader, 0),
        previousYtd: readyPreviousMonthsList.reduce((sum, entry) => sum + entry.lonnskostnader, 0),
        emphasis: "default",
      },
      {
        label: "Varekostnad",
        values: months.map((entry) => getReadyValue(year, entry, readyMonthKeys, getVarekostnad(entry))),
        previousValues: months.map((entry) => getReadyValue(year, entry, readyMonthKeys, getVarekostnad(previousByMonth.get(entry.month)))),
        ytd: readyMonthsList.reduce((sum, entry) => sum + getVarekostnad(entry), 0),
        previousYtd: readyPreviousMonthsList.reduce((sum, entry) => sum + getVarekostnad(entry), 0),
        emphasis: "default",
      },
      {
        label: "Andre driftskostnader",
        values: months.map((entry) => getReadyValue(year, entry, readyMonthKeys, entry.andreDriftskostnader)),
        previousValues: months.map((entry) => getReadyValue(year, entry, readyMonthKeys, previousByMonth.get(entry.month)?.andreDriftskostnader ?? 0)),
        ytd: readyMonthsList.reduce((sum, entry) => sum + entry.andreDriftskostnader, 0),
        previousYtd: readyPreviousMonthsList.reduce((sum, entry) => sum + entry.andreDriftskostnader, 0),
        emphasis: "default",
      },
      {
        label: "Driftsresultat",
        values: months.map((entry, index) => getReadyValue(year, entry, readyMonthKeys, driftsresultat[index] || 0)),
        previousValues: months.map((entry) => getReadyValue(year, entry, readyMonthKeys, previousDriftsresultatByMonth.get(entry.month) ?? 0)),
        ytd: readyMonthsList.reduce((sum, entry) => sum + getDriftsresultat(entry), 0),
        previousYtd: readyPreviousMonthsList.reduce((sum, entry) => sum + getDriftsresultat(entry), 0),
        emphasis: "subtotal",
        tone: "result",
      },
      {
        label: "Finansnetto",
        values: months.map((entry) => getReadyValue(year, entry, readyMonthKeys, entry.finansnetto)),
        previousValues: months.map((entry) => getReadyValue(year, entry, readyMonthKeys, previousByMonth.get(entry.month)?.finansnetto ?? 0)),
        ytd: readyMonthsList.reduce((sum, entry) => sum + entry.finansnetto, 0),
        previousYtd: readyPreviousMonthsList.reduce((sum, entry) => sum + entry.finansnetto, 0),
        emphasis: "default",
        tone: "result",
      },
      {
        label: "Resultat før skatt",
        values: months.map((entry) => getReadyValue(year, entry, readyMonthKeys, entry.resultatForSkatt)),
        previousValues: months.map((entry) => getReadyValue(year, entry, readyMonthKeys, previousByMonth.get(entry.month)?.resultatForSkatt ?? 0)),
        ytd: readyMonthsList.reduce((sum, entry) => sum + entry.resultatForSkatt, 0),
        previousYtd: readyPreviousMonthsList.reduce((sum, entry) => sum + entry.resultatForSkatt, 0),
        emphasis: "total",
        tone: "result",
      },
    ];

    return rowDefinitions;
  }, [months, previousByMonth, previousYearMonths, readyMonthKeys, readyMonthsList, readyPreviousMonthsList, year]);

  const metrics = useMemo<MetricDefinition[]>(() => {
    const omsetningYtd = readyMonthsList.reduce((sum, entry) => sum + entry.omsetning, 0);
    const resultatYtd = readyMonthsList.reduce((sum, entry) => sum + entry.resultatForSkatt, 0);
    const previousOmsetningYtd = readyPreviousMonthsList.reduce((sum, entry) => sum + entry.omsetning, 0);
    const previousResultatYtd = readyPreviousMonthsList.reduce((sum, entry) => sum + entry.resultatForSkatt, 0);
    const latest = readyMonthsList.at(-1);
    const latestResult = latest?.resultatForSkatt ?? 0;
    const previousLatestResult = latest ? previousByMonth.get(latest.month)?.resultatForSkatt ?? null : null;
    const margin = omsetningYtd > 0 ? (resultatYtd / omsetningYtd) * 100 : 0;

    return [
      {
        label: "Omsetning YTD",
        value: formatCurrency(omsetningYtd),
        sub: `${formatChangePercent(getChangePercent(omsetningYtd, previousOmsetningYtd))} mot ${previousYear}`,
        icon: Banknote,
        tone: getChangePercent(omsetningYtd, previousOmsetningYtd) !== null && getChangePercent(omsetningYtd, previousOmsetningYtd)! < 0 ? "negative" : "positive",
      },
      {
        label: "Resultat YTD",
        value: formatCurrency(resultatYtd),
        sub: `${formatChangePercent(getChangePercent(resultatYtd, previousResultatYtd))} mot ${previousYear}`,
        icon: TrendingUp,
        tone: resultatYtd < 0 ? "negative" : "positive",
      },
      {
        label: "Margin YTD",
        value: formatPercent(margin),
        sub: "Resultat / omsetning",
        icon: ChartNoAxesCombined,
        tone: margin < 0 ? "negative" : "positive",
      },
      {
        label: "Siste måned",
        value: latest ? formatCurrency(latestResult) : "0 kr",
        sub: latest ? `${formatChangePercent(getChangePercent(latestResult, previousLatestResult))} mot ${latest.month} ${previousYear}` : "Ingen måneder ferdig",
        icon: RefreshCw,
        tone: latestResult < 0 ? "negative" : "positive",
      },
    ];
  }, [months.length, previousByMonth, previousYear, readyMonthsList, readyPreviousMonthsList]);

  const chartData = useMemo(() => {
    return MONTH_LABELS.map((monthLabel) => {
      const point: Record<string, number | string | null> = { month: monthLabel };

      activeChartYears.forEach((chartYear) => {
        const yearMonths = chartMonthsByYear.get(chartYear) || [];
        const month = yearMonths.find((entry) => entry.month === monthLabel);
        const hasFullYear = yearMonths.length >= 12;
        const isReadyMonth = readyMonths[getMonthReadyKey(chartYear, monthLabel)] === true;

        point[`year_${chartYear}`] = month && (hasFullYear || isReadyMonth) ? getChartValue(chartMode, month) : null;
      });

      return point;
    });
  }, [activeChartYears, chartMode, chartMonthsByYear, readyMonths]);

  return (
    <div
      className="dl-shell flex h-screen overflow-hidden select-none"
      style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif", background: C.bg }}
    >
      <DesignLabSidebar navigate={navigate} signOut={signOut} user={user} activePath="/okonomi" />

      <main className="flex-1 flex min-w-0 flex-col overflow-hidden" style={{ ...getDesignLabTextSizeStyle(textSize), background: C.appBg }}>
        <header className="dl-shell-header flex shrink-0 flex-wrap items-center justify-between gap-3" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex min-w-0 items-center gap-3">
            <DesignLabMobileNavButton navigate={navigate} signOut={signOut} user={user} activePath="/okonomi" />
            <div className="flex items-baseline gap-2.5">
              <h1 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Økonomi</h1>
              <span style={{ fontSize: 13, color: C.textGhost, fontWeight: 500 }}>· {year}</span>
            </div>
          </div>
          <DesignLabGhostAction onClick={() => void loadOkonomi()} disabled={loading}>
            <RefreshCw style={{ width: 14, height: 14 }} />
            Oppdater
          </DesignLabGhostAction>
        </header>

        <div className="flex-1 min-h-0 overflow-auto">
          <div className="flex w-full flex-col gap-4 p-4 md:p-5" style={{ maxWidth: "none", margin: 0 }}>
            {loading ? <LoadingTable /> : null}

            {!loading && error ? (
              <EmptyStatePanel title="Kunne ikke hente økonomidata" text={error} tone="danger" />
            ) : null}

            {!loading && !error && months.length === 0 ? (
              <EmptyStatePanel title="Ingen data tilgjengelig" text={`Edge function returnerte ingen måneder for ${year} ennå.`} />
            ) : null}

            {!loading && !error && months.length > 0 ? (
              <>
                <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {metrics.map((metric) => (
                    <MetricCard key={metric.label} metric={metric} />
                  ))}
                </section>

                <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(780px,1.18fr)_minmax(440px,0.82fr)] xl:items-start">
                <section className="min-w-0 overflow-hidden" style={{ border: `1px solid ${C.border}`, background: C.panel, borderRadius: 8, boxShadow: C.shadow }}>
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                    <div className="min-w-0">
                      <h2 style={{ color: C.text, fontSize: 13, fontWeight: 650 }}>Resultatregnskap</h2>
                      <p className="mt-0.5" style={{ color: C.textFaint, fontSize: 12 }}>
                        Jan til inneværende måned · YTD i siste kolonnepar · prosent mot {previousYear}
                      </p>
                      {readyError ? (
                        <p className="mt-1" style={{ color: C.danger, fontSize: 12 }}>
                          Kunne ikke lagre ferdig-status: {readyError}
                        </p>
                      ) : null}
                    </div>
                    <span style={{ color: C.textMuted, fontSize: 12, fontWeight: 500 }}>Tripletex</span>
                  </div>

                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent" style={{ borderColor: C.borderLight }}>
                          <TableHead className="sticky left-0 z-10 min-w-[220px] font-semibold" style={{ background: C.surfaceAlt, color: C.text }}>
                            Kategori
                          </TableHead>
                          {monthLabels.flatMap((month) => [
                            <TableHead key={`${month}-value`} className="min-w-[120px] text-right font-semibold" style={{ background: C.surfaceAlt, color: C.text }}>
                              {month}
                            </TableHead>,
                            <TableHead key={`${month}-change`} className="min-w-[72px] text-right font-semibold" style={{ background: C.surfaceAlt, color: C.textMuted }}>
                              %
                            </TableHead>,
                          ])}
                          <TableHead className="min-w-[130px] text-right font-semibold" style={{ background: C.surfaceAlt, color: C.text }}>
                            YTD
                          </TableHead>
                          <TableHead className="min-w-[72px] text-right font-semibold" style={{ background: C.surfaceAlt, color: C.textMuted }}>
                            %
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => {
                          const ytdChange = getChangePercent(row.ytd, row.previousYtd);

                          return (
                            <TableRow
                              key={row.label}
                              className="transition-colors"
                              style={{
                                borderColor: C.borderLight,
                                background:
                                  row.emphasis === "total"
                                    ? C.filterActiveBg
                                    : row.emphasis === "subtotal"
                                      ? C.surfaceAlt
                                      : C.panel,
                              }}
                            >
                              <TableCell
                                className="sticky left-0 z-10 font-medium"
                                style={{
                                  background:
                                    row.emphasis === "total"
                                      ? C.filterActiveBg
                                      : row.emphasis === "subtotal"
                                        ? C.surfaceAlt
                                        : C.panel,
                                  color: C.text,
                                  fontWeight: row.emphasis === "default" ? 500 : 650,
                                }}
                              >
                                {row.label}
                              </TableCell>
                              {row.values.flatMap((value, index) => {
                                const change = getChangePercent(value, row.previousValues[index]);
                                const month = monthLabels[index];

                                return [
                                  <TableCell
                                    key={`${row.label}-${month}-value`}
                                    className={cn(
                                      "text-right tabular-nums",
                                      row.emphasis !== "default" && "font-medium",
                                    )}
                                    style={{
                                      color: value === null ? C.textGhost : row.tone === "result" && value < 0 ? C.danger : C.text,
                                      fontWeight: row.emphasis === "total" ? 650 : undefined,
                                    }}
                                  >
                                    {value === null ? "Ikke klart" : formatCurrency(value)}
                                  </TableCell>,
                                  <TableCell
                                    key={`${row.label}-${month}-change`}
                                    className="text-right tabular-nums"
                                    style={{
                                      color: value === null ? C.textGhost : getChangeColor(change),
                                      fontSize: 12,
                                      fontWeight: 650,
                                    }}
                                  >
                                    {value === null ? "" : formatChangePercent(change)}
                                  </TableCell>,
                                ];
                              })}
                              <TableCell
                                className="text-right tabular-nums"
                                style={{
                                  color: row.tone === "result" && row.ytd < 0 ? C.danger : C.text,
                                  fontWeight: row.emphasis === "default" ? 600 : 700,
                                }}
                              >
                                {formatCurrency(row.ytd)}
                              </TableCell>
                              <TableCell
                                className="text-right tabular-nums"
                                style={{ color: getChangeColor(ytdChange), fontSize: 12, fontWeight: 700 }}
                              >
                                {formatChangePercent(ytdChange)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow className="transition-colors" style={{ borderColor: C.borderLight, background: C.panel }}>
                          <TableCell
                            className="sticky left-0 z-10 font-medium"
                            style={{ background: C.panel, color: C.text, fontWeight: 650 }}
                          >
                            Måned klar
                          </TableCell>
                          {monthLabels.flatMap((month) => {
                            const key = getMonthReadyKey(year, month);
                            const ready = readyMonths[key] === true;
                            return [
                              <TableCell key={`ready-${month}-value`} className="text-right">
                                <label className="inline-flex cursor-pointer select-none items-center justify-end gap-2">
                                  <input
                                    type="checkbox"
                                    checked={ready}
                                    disabled={savingReadyMonth === key}
                                    onChange={() => void toggleReadyMonth(month)}
                                    aria-label={`Marker ${month} som ferdig`}
                                    className="h-4 w-4 rounded border-border accent-[var(--dl-accent-check)] disabled:cursor-wait disabled:opacity-60"
                                    style={{ ["--dl-accent-check" as string]: C.accent }}
                                  />
                                  <span
                                    style={{
                                      color: ready ? C.success : C.textFaint,
                                      fontSize: 12,
                                      fontWeight: ready ? 650 : 500,
                                    }}
                                  >
                                    {ready ? "Ferdig" : "Ikke klart"}
                                  </span>
                                </label>
                              </TableCell>,
                              <TableCell key={`ready-${month}-change`} aria-hidden="true" />,
                            ];
                          })}
                          <TableCell className="text-right" style={{ color: C.textMuted, fontSize: 12, fontWeight: 600 }}>
                            {readyMonthsList.length}/{months.length} ferdig
                          </TableCell>
                          <TableCell aria-hidden="true" />
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </section>
                <aside className="min-w-0 xl:sticky xl:top-5">
                  <div
                    className="min-w-0"
                    style={{
                      border: `1px solid ${C.border}`,
                      background: C.panel,
                      borderRadius: 8,
                      boxShadow: C.shadow,
                      padding: 18,
                    }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p style={{ color: C.textMuted, fontSize: 11, fontWeight: 650, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                          Økonomiutvikling
                        </p>
                        <h2 className="mt-1" style={{ color: C.text, fontSize: 15, fontWeight: 700 }}>
                          {getChartLabel(chartMode)}
                        </h2>
                      </div>
                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          <ChartModeButton active={chartMode === "resultat"} info={PAYROLL_PERIODIZATION_INFO} onClick={() => setChartMode("resultat")}>
                            Resultat
                          </ChartModeButton>
                          <ChartModeButton active={chartMode === "omsetning"} onClick={() => setChartMode("omsetning")}>
                            Omsetning
                          </ChartModeButton>
                          <ChartModeButton active={chartMode === "margin"} info={PAYROLL_PERIODIZATION_INFO} onClick={() => setChartMode("margin")}>
                            Margin
                          </ChartModeButton>
                          <ChartModeButton active={chartMode === "lonnskostnader"} info={PAYROLL_PERIODIZATION_INFO} onClick={() => setChartMode("lonnskostnader")}>
                            Lønn
                          </ChartModeButton>
                          <ChartModeButton active={chartMode === "varekostnad"} onClick={() => setChartMode("varekostnad")}>
                            Varekost
                          </ChartModeButton>
                          <ChartModeButton active={chartMode === "andreDriftskostnader"} onClick={() => setChartMode("andreDriftskostnader")}>
                            Andre drift
                          </ChartModeButton>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          {availableChartYears.map((chartYear) => (
                            <ChartModeButton
                              key={chartYear}
                              active={activeChartYears.includes(chartYear)}
                              onClick={() => toggleChartYear(chartYear)}
                            >
                              {chartYear}
                            </ChartModeButton>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 h-[340px] md:h-[380px] xl:h-[clamp(360px,42vh,520px)]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
                          <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.textFaint }} stroke={C.border} />
                          <YAxis
                            tick={{ fontSize: 11, fill: C.textFaint }}
                            stroke={C.border}
                            tickFormatter={(value) => chartMode === "margin" ? `${Math.round(Number(value))}%` : formatCompactCurrency(Number(value))}
                          />
                          <ReTooltip
                            contentStyle={{
                              background: C.surface,
                              border: `1px solid ${C.border}`,
                              borderRadius: 8,
                              color: C.text,
                              fontSize: 13,
                            }}
                            formatter={(value: number, name) => [
                              formatChartValue(chartMode, value),
                              String(name).replace("year_", ""),
                            ]}
                            labelFormatter={(label) => `${label}`}
                          />
                          <Legend
                            iconType="circle"
                            formatter={(value) => (
                              <span style={{ color: C.textMuted, fontSize: 12 }}>
                                {String(value).replace("year_", "")}
                              </span>
                            )}
                          />
                          {activeChartYears.map((chartYear, index) => (
                            <Line
                              key={chartYear}
                              type="monotone"
                              dataKey={`year_${chartYear}`}
                              stroke={getChartYearColor(chartYear, index)}
                              strokeWidth={2.25}
                              connectNulls={false}
                              dot={{ r: 2.25 }}
                              activeDot={{ r: 4 }}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <p className="mt-3" style={{ color: C.textFaint, fontSize: 12, lineHeight: 1.45 }}>
                      Fullførte år vises med alle 12 måneder. Året som fortsatt pågår følger månedene som er markert ferdig.
                    </p>
                  </div>
                </aside>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
