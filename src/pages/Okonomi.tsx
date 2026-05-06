import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Banknote, ChartNoAxesCombined, CircleSlash, Info, Link2, Plus, RefreshCw, Trash2, TrendingUp } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { DesignLabMobileNavButton, DesignLabSidebar } from "@/components/designlab/DesignLabSidebar";
import { DesignLabGhostAction } from "@/components/designlab/system";
import { getDesignLabTextSizeStyle, type TextSize } from "@/components/designlab/TextSizeControl";
import { C } from "@/components/designlab/theme";
import { useAuth } from "@/hooks/useAuth";
import { usePersistentState } from "@/hooks/usePersistentState";
import { supabase } from "@/integrations/supabase/client";
import { getEmployeeLifecycleStatus } from "@/lib/employeeStatus";
import { cn, getInitials } from "@/lib/utils";

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

type OkonomiPageView = "okonomi" | "ansatte";

type EmployeeStatusFilter = "Aktiv" | "Sluttet";

type EmployeeMetric =
  | "billableHours"
  | "coverage"
  | "revenue"
  | "costs"
  | "result"
  | "salaryCost"
  | "sickPayCost";

type EmployeeRow = {
  id: number;
  ansatt_id: number | null;
  navn: string;
  bilde_url: string | null;
  start_dato: string | null;
  slutt_dato: string | null;
  status: string | null;
};

type EmployeePortraitRow = {
  ansatt_id: number;
  portrait_url: string | null;
};

type EmployeeTripletexMapping = {
  id: string;
  ansatt_id: number;
  stacq_oppdrag_id: number | null;
  tripletex_employee_id: number | null;
  tripletex_project_id: number | null;
  tripletex_project_number: string | null;
  project_name: string | null;
  active_from: string | null;
  active_to: string | null;
};

type EmployeeAssignment = {
  id: number;
  ansatt_id: number | null;
  kandidat: string;
  kunde: string | null;
  status: string | null;
  oppdrag_id: number | null;
  start_dato: string | null;
  slutt_dato: string | null;
};

type MappingForm = {
  stacqOppdragId: string;
  tripletexEmployeeId: string;
  tripletexProjectId: string;
  tripletexProjectNumber: string;
  projectName: string;
  activeFrom: string;
  activeTo: string;
};

type EmployeeMetricDefinition = {
  key: EmployeeMetric;
  label: string;
  chartLabel: string;
  kind: "hours" | "percent" | "currency";
};

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

const EMPLOYEE_METRICS: EmployeeMetricDefinition[] = [
  { key: "billableHours", label: "Fakturerte timer", chartLabel: "Fakturerte timer", kind: "hours" },
  { key: "coverage", label: "Dekningsgrad", chartLabel: "Dekningsgrad", kind: "percent" },
  { key: "revenue", label: "Omsetning", chartLabel: "Omsetning", kind: "currency" },
  { key: "costs", label: "Kostnader", chartLabel: "Kostnader", kind: "currency" },
  { key: "result", label: "Resultat", chartLabel: "Resultat", kind: "currency" },
  { key: "salaryCost", label: "Lønnskost", chartLabel: "Lønnskostnad", kind: "currency" },
  { key: "sickPayCost", label: "Sykelønn", chartLabel: "Sykelønnkostnad", kind: "currency" },
];

const EMPLOYEE_STATUS_FILTERS: EmployeeStatusFilter[] = ["Aktiv", "Sluttet"];

const MANUAL_ASSIGNMENT_VALUE = "__manual__";

const EMPTY_MAPPING_FORM: MappingForm = {
  stacqOppdragId: MANUAL_ASSIGNMENT_VALUE,
  tripletexEmployeeId: "",
  tripletexProjectId: "",
  tripletexProjectNumber: "",
  projectName: "",
  activeFrom: "",
  activeTo: "",
};

function formatCurrency(value: number) {
  return `${currencyFormatter.format(Math.round(value)).replace(/\u00A0/g, " ")} kr`;
}

function formatDateShort(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function parseOptionalInteger(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : null;
}

function getAssignmentLabel(assignment: EmployeeAssignment) {
  const period = [formatDateShort(assignment.start_dato), formatDateShort(assignment.slutt_dato)].join(" - ");
  const projectId = assignment.oppdrag_id ? `Tripletex ${assignment.oppdrag_id}` : "uten Tripletex-ID";
  return `${assignment.kunde || assignment.kandidat || "Oppdrag"} · ${assignment.status || "Ukjent"} · ${period} · ${projectId}`;
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

function getEmployeeMetric(metric: EmployeeMetric) {
  return EMPLOYEE_METRICS.find((entry) => entry.key === metric) || EMPLOYEE_METRICS[0];
}

function formatEmployeeMetricValue(metric: EmployeeMetricDefinition, value: number | null) {
  if (value === null) return "-";
  if (metric.kind === "percent") return formatPercent(value);
  if (metric.kind === "hours") {
    return `${value.toLocaleString("nb-NO", { maximumFractionDigits: 1, minimumFractionDigits: 0 })} t`;
  }

  return formatCurrency(value);
}

function formatEmployeeAxisValue(metric: EmployeeMetricDefinition, value: number) {
  if (metric.kind === "percent") return `${Math.round(value)}%`;
  if (metric.kind === "hours") return `${Math.round(value)}t`;
  return formatCompactCurrency(value);
}

function isMappingActiveForYear(mapping: EmployeeTripletexMapping, targetYear: number) {
  const yearStart = new Date(targetYear, 0, 1).getTime();
  const yearEnd = new Date(targetYear, 11, 31).getTime();
  const activeFrom = mapping.active_from ? new Date(mapping.active_from).getTime() : null;
  const activeTo = mapping.active_to ? new Date(mapping.active_to).getTime() : null;

  return (activeFrom === null || activeFrom <= yearEnd) && (activeTo === null || activeTo >= yearStart);
}

function ChartModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 px-3 text-[12px] font-medium transition-colors"
      style={{
        border: `1px solid ${active ? C.accent : C.borderLight}`,
        background: active ? C.accentBg : C.surface,
        color: active ? C.accent : C.textMuted,
        borderRadius: 7,
      }}
    >
      {children}
    </button>
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
  const [activeView, setActiveView] = useState<OkonomiPageView>("okonomi");
  const [readyMonths, setReadyMonths] = useState<Record<string, boolean>>({});
  const [savingReadyMonth, setSavingReadyMonth] = useState<string | null>(null);
  const [readyError, setReadyError] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>("resultat");
  const [visibleChartYears, setVisibleChartYears] = useState<number[]>(DEFAULT_CHART_YEARS);
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState<EmployeeStatusFilter>("Aktiv");
  const [employeeMetric, setEmployeeMetric] = useState<EmployeeMetric>("billableHours");
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [employeePortraits, setEmployeePortraits] = useState<Record<number, string>>({});
  const [employeeMappings, setEmployeeMappings] = useState<EmployeeTripletexMapping[]>([]);
  const [employeeAssignments, setEmployeeAssignments] = useState<EmployeeAssignment[]>([]);
  const [mappingEmployeeId, setMappingEmployeeId] = useState<number | null>(null);
  const [mappingForm, setMappingForm] = useState<MappingForm>(EMPTY_MAPPING_FORM);
  const [savingMapping, setSavingMapping] = useState(false);
  const [deletingMappingId, setDeletingMappingId] = useState<string | null>(null);
  const [employeeMappingNotice, setEmployeeMappingNotice] = useState<string | null>(null);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState<string | null>(null);
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
        .from("okonomi_month_status" as never)
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

  const loadEmployees = useCallback(async (cancelled?: () => boolean) => {
    try {
      setEmployeesLoading(true);
      setEmployeesError(null);
      setEmployeeMappingNotice(null);

      const { data: employeeData, error: employeeLoadError } = await supabase
        .from("stacq_ansatte")
        .select("id, ansatt_id, navn, bilde_url, start_dato, slutt_dato, status")
        .order("navn", { ascending: true });

      if (employeeLoadError) {
        throw employeeLoadError;
      }

      const [{ data: portraitData }, { data: assignmentData }, mappingResult] = await Promise.all([
        supabase
          .from("cv_documents")
          .select("ansatt_id, portrait_url")
          .not("portrait_url", "is", null),
        supabase
          .from("stacq_oppdrag")
          .select("id, ansatt_id, kandidat, kunde, status, oppdrag_id, start_dato, slutt_dato")
          .not("ansatt_id", "is", null)
          .order("start_dato", { ascending: false }),
        supabase
          .from("okonomi_ansatt_tripletex_mapping" as never)
          .select("id, ansatt_id, stacq_oppdrag_id, tripletex_employee_id, tripletex_project_id, tripletex_project_number, project_name, active_from, active_to"),
      ]);

      if (!cancelled?.()) {
        const nextPortraits = Object.fromEntries(
          ((portraitData || []) as EmployeePortraitRow[])
            .filter((entry) => entry.portrait_url)
            .map((entry) => [entry.ansatt_id, entry.portrait_url as string]),
        );

        setEmployees((employeeData || []) as EmployeeRow[]);
        setEmployeeAssignments((assignmentData || []) as EmployeeAssignment[]);
        setEmployeePortraits(nextPortraits);

        if (mappingResult.error) {
          setEmployeeMappings([]);
          setEmployeeMappingNotice("Tripletex-kobling er ikke satt opp i dette miljøet ennå.");
        } else {
          setEmployeeMappings((mappingResult.data || []) as EmployeeTripletexMapping[]);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kunne ikke hente ansatte.";
      if (!cancelled?.()) {
        setEmployeesError(message);
        setEmployees([]);
        setEmployeePortraits({});
        setEmployeeMappings([]);
        setEmployeeAssignments([]);
      }
    } finally {
      if (!cancelled?.()) {
        setEmployeesLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadOkonomi(() => cancelled);

    return () => {
      cancelled = true;
    };
  }, [loadOkonomi]);

  useEffect(() => {
    if (activeView !== "ansatte") return;

    let cancelled = false;
    void loadEmployees(() => cancelled);

    return () => {
      cancelled = true;
    };
  }, [activeView, loadEmployees]);

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
      .from("okonomi_month_status" as never)
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
  }, [previousByMonth, previousYear, readyMonthsList, readyPreviousMonthsList]);

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
  const showPayrollPeriodizationInfo = chartMode === "resultat" || chartMode === "margin" || chartMode === "lonnskostnader";
  const selectedEmployeeMetric = useMemo(() => getEmployeeMetric(employeeMetric), [employeeMetric]);
  const activeEmployeeMappingsByEmployee = useMemo(() => {
    const map = new Map<number, EmployeeTripletexMapping[]>();

    employeeMappings
      .filter((mapping) => isMappingActiveForYear(mapping, year))
      .forEach((mapping) => {
        const current = map.get(mapping.ansatt_id) || [];
        current.push(mapping);
        map.set(mapping.ansatt_id, current);
      });

    return map;
  }, [employeeMappings, year]);
  const employeeAssignmentsByEmployee = useMemo(() => {
    const map = new Map<number, EmployeeAssignment[]>();

    employeeAssignments.forEach((assignment) => {
      if (!assignment.ansatt_id) return;
      const current = map.get(assignment.ansatt_id) || [];
      current.push(assignment);
      map.set(assignment.ansatt_id, current);
    });

    return map;
  }, [employeeAssignments]);
  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const status = getEmployeeLifecycleStatus(employee);
      if (employeeStatusFilter === "Sluttet") return status === "Sluttet";
      return status !== "Sluttet";
    });
  }, [employeeStatusFilter, employees]);
  const employeeTableRows = useMemo(() => {
    return filteredEmployees.map((employee) => ({
      employee,
      status: getEmployeeLifecycleStatus(employee),
      values: MONTH_LABELS.map(() => null as number | null),
      mappings: activeEmployeeMappingsByEmployee.get(employee.id) || [],
      assignments: employeeAssignmentsByEmployee.get(employee.id) || [],
    }));
  }, [activeEmployeeMappingsByEmployee, employeeAssignmentsByEmployee, filteredEmployees]);
  const hasEmployeeMetricData = useMemo(() => {
    return employeeTableRows.some((row) => row.values.some((value) => value !== null));
  }, [employeeTableRows]);
  const employeeChartData = useMemo(() => {
    return MONTH_LABELS.map((month, index) => {
      const monthValues = employeeTableRows
        .map((row) => row.values[index])
        .filter((value): value is number => value !== null);

      return {
        month,
        value: monthValues.length ? monthValues.reduce((sum, value) => sum + value, 0) : null,
      };
    });
  }, [employeeTableRows]);
  const selectedMappingEmployee = useMemo(
    () => employees.find((employee) => employee.id === mappingEmployeeId) || null,
    [employees, mappingEmployeeId],
  );
  const selectedEmployeeAssignments = useMemo(
    () => mappingEmployeeId ? employeeAssignmentsByEmployee.get(mappingEmployeeId) || [] : [],
    [employeeAssignmentsByEmployee, mappingEmployeeId],
  );
  const selectedEmployeeMappings = useMemo(
    () => mappingEmployeeId ? employeeMappings.filter((mapping) => mapping.ansatt_id === mappingEmployeeId) : [],
    [employeeMappings, mappingEmployeeId],
  );

  const fillMappingFormFromAssignment = (assignment: EmployeeAssignment | undefined) => {
    if (!assignment) {
      setMappingForm((current) => ({ ...current, stacqOppdragId: MANUAL_ASSIGNMENT_VALUE }));
      return;
    }

    setMappingForm((current) => ({
      ...current,
      stacqOppdragId: String(assignment.id),
      tripletexProjectId: assignment.oppdrag_id ? String(assignment.oppdrag_id) : current.tripletexProjectId,
      projectName: assignment.kunde || current.projectName,
      activeFrom: assignment.start_dato || current.activeFrom,
      activeTo: assignment.slutt_dato || current.activeTo,
    }));
  };

  const openMappingDialog = (employee: EmployeeRow) => {
    const assignments = employeeAssignmentsByEmployee.get(employee.id) || [];
    const firstAssignment = assignments[0];

    setMappingEmployeeId(employee.id);
    setMappingForm({
      ...EMPTY_MAPPING_FORM,
      stacqOppdragId: firstAssignment ? String(firstAssignment.id) : MANUAL_ASSIGNMENT_VALUE,
      tripletexProjectId: firstAssignment?.oppdrag_id ? String(firstAssignment.oppdrag_id) : "",
      projectName: firstAssignment?.kunde || "",
      activeFrom: firstAssignment?.start_dato || "",
      activeTo: firstAssignment?.slutt_dato || "",
    });
  };

  const saveEmployeeMapping = async () => {
    if (!selectedMappingEmployee) return;

    const selectedAssignment = selectedEmployeeAssignments.find((assignment) => String(assignment.id) === mappingForm.stacqOppdragId);
    const tripletexEmployeeId = parseOptionalInteger(mappingForm.tripletexEmployeeId);
    const tripletexProjectId = parseOptionalInteger(mappingForm.tripletexProjectId);
    const tripletexProjectNumber = mappingForm.tripletexProjectNumber.trim();
    const hasReference = tripletexEmployeeId !== null || tripletexProjectId !== null || tripletexProjectNumber.length > 0;

    if (!hasReference) {
      toast.error("Legg inn Tripletex ansatt-ID eller prosjekt-ID.");
      return;
    }

    setSavingMapping(true);
    const { data, error: saveError } = await supabase
      .from("okonomi_ansatt_tripletex_mapping" as never)
      .insert({
        ansatt_id: selectedMappingEmployee.id,
        stacq_oppdrag_id: selectedAssignment?.id ?? null,
        tripletex_employee_id: tripletexEmployeeId,
        tripletex_project_id: tripletexProjectId,
        tripletex_project_number: tripletexProjectNumber || null,
        project_name: mappingForm.projectName.trim() || selectedAssignment?.kunde || null,
        active_from: mappingForm.activeFrom || selectedAssignment?.start_dato || null,
        active_to: mappingForm.activeTo || selectedAssignment?.slutt_dato || null,
        source: "crm",
        created_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .select("id, ansatt_id, stacq_oppdrag_id, tripletex_employee_id, tripletex_project_id, tripletex_project_number, project_name, active_from, active_to")
      .single();

    setSavingMapping(false);

    if (saveError) {
      toast.error(saveError.message || "Kunne ikke lagre Tripletex-kobling.");
      return;
    }

    setEmployeeMappings((current) => [...current, data as EmployeeTripletexMapping]);
    setMappingForm(EMPTY_MAPPING_FORM);
    toast.success("Tripletex-kobling lagret.");
  };

  const deleteEmployeeMapping = async (mappingId: string) => {
    setDeletingMappingId(mappingId);
    const { error: deleteError } = await supabase
      .from("okonomi_ansatt_tripletex_mapping" as never)
      .delete()
      .eq("id", mappingId);
    setDeletingMappingId(null);

    if (deleteError) {
      toast.error(deleteError.message || "Kunne ikke slette Tripletex-kobling.");
      return;
    }

    setEmployeeMappings((current) => current.filter((mapping) => mapping.id !== mappingId));
    toast.success("Tripletex-kobling slettet.");
  };

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
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <div className="flex items-baseline gap-2.5">
                <h1 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Økonomi</h1>
                <span style={{ fontSize: 13, color: C.textGhost, fontWeight: 500 }}>· {year}</span>
              </div>
              <div className="flex rounded-md p-0.5" style={{ border: `1px solid ${C.borderLight}`, background: C.surfaceAlt }}>
                <button
                  type="button"
                  onClick={() => setActiveView("okonomi")}
                  className="h-7 px-3 text-[12px] font-semibold transition-colors"
                  style={{
                    borderRadius: 6,
                    background: activeView === "okonomi" ? C.panel : "transparent",
                    color: activeView === "okonomi" ? C.accent : C.textMuted,
                    boxShadow: activeView === "okonomi" ? C.shadow : "none",
                  }}
                >
                  Økonomi
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView("ansatte")}
                  className="h-7 px-3 text-[12px] font-semibold transition-colors"
                  style={{
                    borderRadius: 6,
                    background: activeView === "ansatte" ? C.panel : "transparent",
                    color: activeView === "ansatte" ? C.accent : C.textMuted,
                    boxShadow: activeView === "ansatte" ? C.shadow : "none",
                  }}
                >
                  Ansatte
                </button>
              </div>
            </div>
          </div>
          <DesignLabGhostAction
            onClick={() => activeView === "ansatte" ? void loadEmployees() : void loadOkonomi()}
            disabled={activeView === "ansatte" ? employeesLoading : loading}
          >
            <RefreshCw style={{ width: 14, height: 14 }} />
            Oppdater
          </DesignLabGhostAction>
        </header>

        <div className="flex-1 min-h-0 overflow-auto">
          <div className="flex w-full flex-col gap-4 p-4 md:p-5" style={{ maxWidth: "none", margin: 0 }}>
            {activeView === "okonomi" ? (
              <>
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
                          <ChartModeButton active={chartMode === "resultat"} onClick={() => setChartMode("resultat")}>
                            Resultat
                          </ChartModeButton>
                          <ChartModeButton active={chartMode === "omsetning"} onClick={() => setChartMode("omsetning")}>
                            Omsetning
                          </ChartModeButton>
                          <ChartModeButton active={chartMode === "margin"} onClick={() => setChartMode("margin")}>
                            Margin
                          </ChartModeButton>
                          <ChartModeButton active={chartMode === "lonnskostnader"} onClick={() => setChartMode("lonnskostnader")}>
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

                    <div className="relative mt-5 h-[340px] md:h-[380px] xl:h-[clamp(360px,42vh,520px)]">
                      {showPayrollPeriodizationInfo ? (
                        <div
                          className="pointer-events-none absolute left-3 top-3 z-10 inline-flex max-w-[calc(100%-24px)] items-center gap-2 rounded-md px-2.5 py-1.5"
                          style={{
                            border: `1px solid ${C.warning}`,
                            background: C.warningBg,
                            color: C.warning,
                            boxShadow: C.shadow,
                          }}
                        >
                          <Info className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate" style={{ fontSize: 12, fontWeight: 600 }}>
                            {PAYROLL_PERIODIZATION_INFO}
                          </span>
                        </div>
                      ) : null}
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: showPayrollPeriodizationInfo ? 50 : 10, right: 10, left: 0, bottom: 0 }}>
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
              </>
            ) : (
              <>
                {employeesLoading ? <LoadingTable /> : null}

                {!employeesLoading && employeesError ? (
                  <EmptyStatePanel title="Kunne ikke hente ansatte" text={employeesError} tone="danger" />
                ) : null}

                {!employeesLoading && !employeesError ? (
                  <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(780px,1.18fr)_minmax(440px,0.82fr)] xl:items-start">
                    <section
                      className="min-w-0 overflow-hidden"
                      style={{ border: `1px solid ${C.border}`, background: C.panel, borderRadius: 8, boxShadow: C.shadow }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                        <div className="min-w-0">
                          <h2 style={{ color: C.text, fontSize: 13, fontWeight: 650 }}>Ansatte</h2>
                          <p className="mt-0.5" style={{ color: C.textFaint, fontSize: 12 }}>
                            {employeeTableRows.length} {employeeStatusFilter.toLowerCase()}e · {selectedEmployeeMetric.label} · {year}
                          </p>
                          {employeeMappingNotice ? (
                            <p className="mt-1" style={{ color: C.warning, fontSize: 12 }}>
                              {employeeMappingNotice}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex max-w-full flex-col items-start gap-2 sm:items-end">
                          <div className="flex flex-wrap gap-2 sm:justify-end">
                            {EMPLOYEE_STATUS_FILTERS.map((statusFilter) => (
                              <ChartModeButton
                                key={statusFilter}
                                active={employeeStatusFilter === statusFilter}
                                onClick={() => setEmployeeStatusFilter(statusFilter)}
                              >
                                {statusFilter}
                              </ChartModeButton>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-2 sm:justify-end">
                            {EMPLOYEE_METRICS.map((metric) => (
                              <ChartModeButton
                                key={metric.key}
                                active={employeeMetric === metric.key}
                                onClick={() => setEmployeeMetric(metric.key)}
                              >
                                {metric.label}
                              </ChartModeButton>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent" style={{ borderColor: C.borderLight }}>
                              <TableHead className="sticky left-0 z-10 min-w-[280px] font-semibold" style={{ background: C.surfaceAlt, color: C.text }}>
                                Navn
                              </TableHead>
                              {MONTH_LABELS.map((month) => (
                                <TableHead key={month} className="min-w-[112px] text-right font-semibold" style={{ background: C.surfaceAlt, color: C.text }}>
                                  {month}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {employeeTableRows.length === 0 ? (
                              <TableRow className="hover:bg-transparent" style={{ borderColor: C.borderLight }}>
                                <TableCell colSpan={MONTH_LABELS.length + 1} style={{ color: C.textMuted, fontSize: 13 }}>
                                  Ingen ansatte i dette filteret.
                                </TableCell>
                              </TableRow>
                            ) : null}

                            {employeeTableRows.map((row) => {
                              const portrait = employeePortraits[row.employee.id] || row.employee.bilde_url || "";
                              const hasTripletexEmployee = row.mappings.some((mapping) => mapping.tripletex_employee_id);
                              const projectCount = new Set(row.mappings.map((mapping) => mapping.tripletex_project_id).filter(Boolean)).size;
                              const assignmentCount = row.assignments.length;

                              return (
                                <TableRow key={row.employee.id} className="transition-colors" style={{ borderColor: C.borderLight, background: C.panel }}>
                                  <TableCell className="sticky left-0 z-10" style={{ background: C.panel, color: C.text }}>
                                    <div className="flex min-w-0 items-center justify-between gap-3">
                                      <div className="flex min-w-0 items-center gap-3">
                                        <Avatar className="h-8 w-8" style={{ border: `1px solid ${C.borderLight}` }}>
                                          <AvatarImage src={portrait} alt={row.employee.navn} />
                                          <AvatarFallback style={{ background: C.surfaceAlt, color: C.textMuted, fontSize: 11, fontWeight: 700 }}>
                                            {getInitials(row.employee.navn)}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                          <p className="truncate" style={{ color: C.text, fontSize: 13, fontWeight: 650 }}>
                                            {row.employee.navn}
                                          </p>
                                          <p className="truncate" style={{ color: hasTripletexEmployee || projectCount > 0 ? C.success : C.textGhost, fontSize: 11 }}>
                                            {hasTripletexEmployee || projectCount > 0
                                              ? `${hasTripletexEmployee ? "Tripletex ansatt" : "Ansatt"} · ${projectCount} prosjekt`
                                              : `${row.status} · ${assignmentCount} CRM-oppdrag · mangler Tripletex-kobling`}
                                          </p>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => openMappingDialog(row.employee)}
                                        className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12px] font-semibold transition-colors"
                                        style={{ border: `1px solid ${C.borderLight}`, background: C.surfaceAlt, color: C.textMuted }}
                                        title="Koble Tripletex"
                                      >
                                        <Link2 className="h-3.5 w-3.5" />
                                        Koble
                                      </button>
                                    </div>
                                  </TableCell>
                                  {row.values.map((value, index) => (
                                    <TableCell
                                      key={`${row.employee.id}-${MONTH_LABELS[index]}`}
                                      className="text-right tabular-nums"
                                      style={{ color: value === null ? C.textGhost : C.text, fontSize: 12, fontWeight: value === null ? 500 : 650 }}
                                    >
                                      {formatEmployeeMetricValue(selectedEmployeeMetric, value)}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              );
                            })}
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
                              Ansattøkonomi
                            </p>
                            <h2 className="mt-1" style={{ color: C.text, fontSize: 15, fontWeight: 700 }}>
                              {selectedEmployeeMetric.chartLabel}
                            </h2>
                            <p className="mt-1" style={{ color: C.textFaint, fontSize: 12 }}>
                              Sum for {employeeStatusFilter.toLowerCase()}e ansatte
                            </p>
                          </div>
                          <span
                            className="inline-flex h-7 items-center rounded-md px-2.5 text-[12px] font-semibold"
                            style={{
                              border: `1px solid ${hasEmployeeMetricData ? C.success : C.borderLight}`,
                              background: hasEmployeeMetricData ? C.successBg : C.surfaceAlt,
                              color: hasEmployeeMetricData ? C.success : C.textMuted,
                            }}
                          >
                            {hasEmployeeMetricData ? "Tripletex" : "Kobling venter"}
                          </span>
                        </div>

                        <div className="relative mt-5 h-[340px] md:h-[380px] xl:h-[clamp(360px,42vh,520px)]">
                          {!hasEmployeeMetricData ? (
                            <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex items-start gap-2 rounded-md px-3 py-2" style={{ border: `1px solid ${C.borderLight}`, background: C.surface }}>
                              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: C.textMuted }} />
                              <p style={{ color: C.textMuted, fontSize: 12, lineHeight: 1.4 }}>
                                Legg inn Tripletex ansatt- og prosjektkoblinger før tall vises.
                              </p>
                            </div>
                          ) : null}
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={employeeChartData} margin={{ top: hasEmployeeMetricData ? 10 : 58, right: 10, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
                              <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.textFaint }} stroke={C.border} />
                              <YAxis
                                tick={{ fontSize: 11, fill: C.textFaint }}
                                stroke={C.border}
                                tickFormatter={(value) => formatEmployeeAxisValue(selectedEmployeeMetric, Number(value))}
                              />
                              <ReTooltip
                                contentStyle={{
                                  background: C.surface,
                                  border: `1px solid ${C.border}`,
                                  borderRadius: 8,
                                  color: C.text,
                                  fontSize: 13,
                                }}
                                formatter={(value: number) => [formatEmployeeMetricValue(selectedEmployeeMetric, value), selectedEmployeeMetric.label]}
                                labelFormatter={(label) => `${label} ${year}`}
                              />
                              <Line
                                type="monotone"
                                dataKey="value"
                                name={selectedEmployeeMetric.label}
                                stroke={C.accent}
                                strokeWidth={2.25}
                                connectNulls={false}
                                dot={{ r: 2.25 }}
                                activeDot={{ r: 4 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        <p className="mt-3" style={{ color: C.textFaint, fontSize: 12, lineHeight: 1.45 }}>
                          Koblingen bruker Tripletex employeeId og projectId per periode, slik at ansatte som har hatt flere prosjekter kan summeres korrekt.
                        </p>
                      </div>
                    </aside>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        <Dialog open={mappingEmployeeId !== null} onOpenChange={(open) => {
          if (!open) setMappingEmployeeId(null);
        }}>
          <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto" style={{ background: C.panel, borderColor: C.border }}>
            <DialogHeader>
              <DialogTitle style={{ color: C.text, fontSize: 16 }}>Tripletex-kobling</DialogTitle>
            </DialogHeader>

            {selectedMappingEmployee ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-md px-3 py-2" style={{ border: `1px solid ${C.borderLight}`, background: C.surfaceAlt }}>
                  <div className="min-w-0">
                    <p className="truncate" style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>
                      {selectedMappingEmployee.navn}
                    </p>
                    <p style={{ color: C.textMuted, fontSize: 12 }}>
                      {selectedEmployeeAssignments.length} CRM-oppdrag funnet
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold" style={{ background: C.accentBg, color: C.accent }}>
                    {selectedEmployeeMappings.length} koblinger
                  </span>
                </div>

                <div className="space-y-2">
                  <p style={{ color: C.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Eksisterende koblinger
                  </p>
                  {selectedEmployeeMappings.length === 0 ? (
                    <p className="rounded-md px-3 py-2" style={{ border: `1px solid ${C.borderLight}`, color: C.textMuted, fontSize: 12 }}>
                      Ingen Tripletex-koblinger er lagt inn for denne ansatte.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selectedEmployeeMappings.map((mapping) => {
                        const assignment = employeeAssignments.find((entry) => entry.id === mapping.stacq_oppdrag_id);
                        const projectLabel = mapping.project_name || assignment?.kunde || "Prosjekt";
                        const tripletexProject = mapping.tripletex_project_id || mapping.tripletex_project_number || "-";

                        return (
                          <div
                            key={mapping.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-md px-3 py-2"
                            style={{ border: `1px solid ${C.borderLight}`, background: C.surface }}
                          >
                            <div className="min-w-0">
                              <p className="truncate" style={{ color: C.text, fontSize: 13, fontWeight: 650 }}>{projectLabel}</p>
                              <p className="truncate" style={{ color: C.textMuted, fontSize: 12 }}>
                                Tripletex ansatt {mapping.tripletex_employee_id || "-"} · prosjekt {tripletexProject} · {formatDateShort(mapping.active_from)} - {formatDateShort(mapping.active_to)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void deleteEmployeeMapping(mapping.id)}
                              disabled={deletingMappingId === mapping.id}
                              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-semibold disabled:cursor-wait disabled:opacity-60"
                              style={{ border: `1px solid ${C.danger}`, background: C.dangerBg, color: C.danger }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Slett
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-3 rounded-md p-3" style={{ border: `1px solid ${C.borderLight}`, background: C.surface }}>
                  <p style={{ color: C.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Ny kobling
                  </p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="space-y-1 md:col-span-2">
                      <span style={{ color: C.textMuted, fontSize: 12, fontWeight: 650 }}>CRM-oppdrag</span>
                      <select
                        value={mappingForm.stacqOppdragId}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (value === MANUAL_ASSIGNMENT_VALUE) {
                            setMappingForm((current) => ({ ...current, stacqOppdragId: value }));
                            return;
                          }
                          fillMappingFormFromAssignment(selectedEmployeeAssignments.find((assignment) => String(assignment.id) === value));
                        }}
                        className="h-9 w-full rounded-md border px-3 text-[13px]"
                        style={{ borderColor: C.borderLight, background: C.panel, color: C.text }}
                      >
                        <option value={MANUAL_ASSIGNMENT_VALUE}>Manuell kobling uten CRM-oppdrag</option>
                        {selectedEmployeeAssignments.map((assignment) => (
                          <option key={assignment.id} value={assignment.id}>
                            {getAssignmentLabel(assignment)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1">
                      <span style={{ color: C.textMuted, fontSize: 12, fontWeight: 650 }}>Tripletex ansatt-ID</span>
                      <input
                        value={mappingForm.tripletexEmployeeId}
                        onChange={(event) => setMappingForm((current) => ({ ...current, tripletexEmployeeId: event.target.value }))}
                        inputMode="numeric"
                        className="h-9 w-full rounded-md border px-3 text-[13px]"
                        style={{ borderColor: C.borderLight, background: C.panel, color: C.text }}
                      />
                    </label>

                    <label className="space-y-1">
                      <span style={{ color: C.textMuted, fontSize: 12, fontWeight: 650 }}>Tripletex prosjekt-ID</span>
                      <input
                        value={mappingForm.tripletexProjectId}
                        onChange={(event) => setMappingForm((current) => ({ ...current, tripletexProjectId: event.target.value }))}
                        inputMode="numeric"
                        className="h-9 w-full rounded-md border px-3 text-[13px]"
                        style={{ borderColor: C.borderLight, background: C.panel, color: C.text }}
                      />
                    </label>

                    <label className="space-y-1">
                      <span style={{ color: C.textMuted, fontSize: 12, fontWeight: 650 }}>Prosjektnummer</span>
                      <input
                        value={mappingForm.tripletexProjectNumber}
                        onChange={(event) => setMappingForm((current) => ({ ...current, tripletexProjectNumber: event.target.value }))}
                        className="h-9 w-full rounded-md border px-3 text-[13px]"
                        style={{ borderColor: C.borderLight, background: C.panel, color: C.text }}
                      />
                    </label>

                    <label className="space-y-1">
                      <span style={{ color: C.textMuted, fontSize: 12, fontWeight: 650 }}>Prosjektnavn</span>
                      <input
                        value={mappingForm.projectName}
                        onChange={(event) => setMappingForm((current) => ({ ...current, projectName: event.target.value }))}
                        className="h-9 w-full rounded-md border px-3 text-[13px]"
                        style={{ borderColor: C.borderLight, background: C.panel, color: C.text }}
                      />
                    </label>

                    <label className="space-y-1">
                      <span style={{ color: C.textMuted, fontSize: 12, fontWeight: 650 }}>Aktiv fra</span>
                      <input
                        type="date"
                        value={mappingForm.activeFrom}
                        onChange={(event) => setMappingForm((current) => ({ ...current, activeFrom: event.target.value }))}
                        className="h-9 w-full rounded-md border px-3 text-[13px]"
                        style={{ borderColor: C.borderLight, background: C.panel, color: C.text }}
                      />
                    </label>

                    <label className="space-y-1">
                      <span style={{ color: C.textMuted, fontSize: 12, fontWeight: 650 }}>Aktiv til</span>
                      <input
                        type="date"
                        value={mappingForm.activeTo}
                        onChange={(event) => setMappingForm((current) => ({ ...current, activeTo: event.target.value }))}
                        className="h-9 w-full rounded-md border px-3 text-[13px]"
                        style={{ borderColor: C.borderLight, background: C.panel, color: C.text }}
                      />
                    </label>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void saveEmployeeMapping()}
                      disabled={savingMapping}
                      className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-[13px] font-semibold disabled:cursor-wait disabled:opacity-60"
                      style={{ border: `1px solid ${C.accent}`, background: C.accentBg, color: C.accent }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {savingMapping ? "Lagrer..." : "Legg til kobling"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
