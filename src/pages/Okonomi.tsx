import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Banknote, ChartNoAxesCombined, CircleSlash, RefreshCw, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  andreDriftskostnader: number;
  finansnetto: number;
  resultatForSkatt: number;
};

type OkonomiResponse = {
  months: OkonomiMonth[];
  previousYearMonths?: OkonomiMonth[];
  year?: number;
  previousYear?: number;
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

const currencyFormatter = new Intl.NumberFormat("nb-NO", {
  maximumFractionDigits: 0,
});

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
  if (value === null) return "n/a";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatPercent(value)}`;
}

function getChangeColor(value: number | null) {
  if (value === null) return C.textGhost;
  if (value > 0) return C.success;
  if (value < 0) return C.danger;
  return C.textFaint;
}

function getMonthReadyKey(month: string) {
  return `2026-${month}`;
}

function getReadyValue(month: OkonomiMonth, readyMonthKeys: Set<string>, value: number) {
  return readyMonthKeys.has(getMonthReadyKey(month.month)) ? value : null;
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

export default function Okonomi() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [textSize] = usePersistentState<TextSize>("dl-text-size", "M");
  const [readyMonths, setReadyMonths] = usePersistentState<Record<string, boolean>>("okonomi-ready-months-2026", {});
  const [months, setMonths] = useState<OkonomiMonth[]>([]);
  const [previousYearMonths, setPreviousYearMonths] = useState<OkonomiMonth[]>([]);
  const [previousYear, setPreviousYear] = useState(2025);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setMonths(data.months);
        setPreviousYearMonths(data.previousYearMonths || []);
        setPreviousYear(data.previousYear || 2025);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kunne ikke hente økonomidata.";
      if (!cancelled?.()) {
        setError(message);
        setMonths([]);
        setPreviousYearMonths([]);
      }
    } finally {
      if (!cancelled?.()) {
        setLoading(false);
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

  const monthLabels = useMemo(() => months.map((entry) => entry.month), [months]);
  const readyMonthKeys = useMemo(() => {
    return new Set(months.filter((month) => readyMonths[getMonthReadyKey(month.month)]).map((month) => getMonthReadyKey(month.month)));
  }, [months, readyMonths]);
  const readyMonthsList = useMemo(() => months.filter((month) => readyMonthKeys.has(getMonthReadyKey(month.month))), [months, readyMonthKeys]);
  const previousByMonth = useMemo(() => {
    return new Map(previousYearMonths.map((entry) => [entry.month, entry]));
  }, [previousYearMonths]);
  const readyPreviousMonthsList = useMemo(
    () => readyMonthsList.map((month) => previousByMonth.get(month.month)).filter((month): month is OkonomiMonth => Boolean(month)),
    [previousByMonth, readyMonthsList],
  );

  const toggleReadyMonth = (month: string) => {
    const key = getMonthReadyKey(month);
    setReadyMonths((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const rows = useMemo<RowDefinition[]>(() => {
    const driftsresultat = months.map(
      (entry) => entry.omsetning - entry.lonnskostnader - entry.andreDriftskostnader,
    );
    const previousDriftsresultatByMonth = new Map(
      previousYearMonths.map((entry) => [entry.month, entry.omsetning - entry.lonnskostnader - entry.andreDriftskostnader]),
    );

    const rowDefinitions: RowDefinition[] = [
      {
        label: "Omsetning",
        values: months.map((entry) => getReadyValue(entry, readyMonthKeys, entry.omsetning)),
        previousValues: months.map((entry) => getReadyValue(entry, readyMonthKeys, previousByMonth.get(entry.month)?.omsetning ?? 0)),
        ytd: readyMonthsList.reduce((sum, entry) => sum + entry.omsetning, 0),
        previousYtd: readyPreviousMonthsList.reduce((sum, entry) => sum + entry.omsetning, 0),
        emphasis: "default",
      },
      {
        label: "Lønnskostnader",
        values: months.map((entry) => getReadyValue(entry, readyMonthKeys, entry.lonnskostnader)),
        previousValues: months.map((entry) => getReadyValue(entry, readyMonthKeys, previousByMonth.get(entry.month)?.lonnskostnader ?? 0)),
        ytd: readyMonthsList.reduce((sum, entry) => sum + entry.lonnskostnader, 0),
        previousYtd: readyPreviousMonthsList.reduce((sum, entry) => sum + entry.lonnskostnader, 0),
        emphasis: "default",
      },
      {
        label: "Andre driftskostnader",
        values: months.map((entry) => getReadyValue(entry, readyMonthKeys, entry.andreDriftskostnader)),
        previousValues: months.map((entry) => getReadyValue(entry, readyMonthKeys, previousByMonth.get(entry.month)?.andreDriftskostnader ?? 0)),
        ytd: readyMonthsList.reduce((sum, entry) => sum + entry.andreDriftskostnader, 0),
        previousYtd: readyPreviousMonthsList.reduce((sum, entry) => sum + entry.andreDriftskostnader, 0),
        emphasis: "default",
      },
      {
        label: "Driftsresultat",
        values: months.map((entry, index) => getReadyValue(entry, readyMonthKeys, driftsresultat[index] || 0)),
        previousValues: months.map((entry) => getReadyValue(entry, readyMonthKeys, previousDriftsresultatByMonth.get(entry.month) ?? 0)),
        ytd: readyMonthsList.reduce((sum, entry) => sum + entry.omsetning - entry.lonnskostnader - entry.andreDriftskostnader, 0),
        previousYtd: readyPreviousMonthsList.reduce((sum, entry) => sum + entry.omsetning - entry.lonnskostnader - entry.andreDriftskostnader, 0),
        emphasis: "subtotal",
        tone: "result",
      },
      {
        label: "Finansnetto",
        values: months.map((entry) => getReadyValue(entry, readyMonthKeys, entry.finansnetto)),
        previousValues: months.map((entry) => getReadyValue(entry, readyMonthKeys, previousByMonth.get(entry.month)?.finansnetto ?? 0)),
        ytd: readyMonthsList.reduce((sum, entry) => sum + entry.finansnetto, 0),
        previousYtd: readyPreviousMonthsList.reduce((sum, entry) => sum + entry.finansnetto, 0),
        emphasis: "default",
        tone: "result",
      },
      {
        label: "Resultat før skatt",
        values: months.map((entry) => getReadyValue(entry, readyMonthKeys, entry.resultatForSkatt)),
        previousValues: months.map((entry) => getReadyValue(entry, readyMonthKeys, previousByMonth.get(entry.month)?.resultatForSkatt ?? 0)),
        ytd: readyMonthsList.reduce((sum, entry) => sum + entry.resultatForSkatt, 0),
        previousYtd: readyPreviousMonthsList.reduce((sum, entry) => sum + entry.resultatForSkatt, 0),
        emphasis: "total",
        tone: "result",
      },
    ];

    return rowDefinitions;
  }, [months, previousByMonth, previousYearMonths, readyMonthKeys, readyMonthsList, readyPreviousMonthsList]);

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
              <span style={{ fontSize: 13, color: C.textGhost, fontWeight: 500 }}>· 2026</span>
            </div>
          </div>
          <DesignLabGhostAction onClick={() => void loadOkonomi()} disabled={loading}>
            <RefreshCw style={{ width: 14, height: 14 }} />
            Oppdater
          </DesignLabGhostAction>
        </header>

        <div className="flex-1 min-h-0 overflow-auto">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 p-4 md:p-5">
            {loading ? <LoadingTable /> : null}

            {!loading && error ? (
              <EmptyStatePanel title="Kunne ikke hente økonomidata" text={error} tone="danger" />
            ) : null}

            {!loading && !error && months.length === 0 ? (
              <EmptyStatePanel title="Ingen data tilgjengelig" text="Edge function returnerte ingen måneder for 2026 ennå." />
            ) : null}

            {!loading && !error && months.length > 0 ? (
              <>
                <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {metrics.map((metric) => (
                    <MetricCard key={metric.label} metric={metric} />
                  ))}
                </section>

                <section className="overflow-hidden" style={{ border: `1px solid ${C.border}`, background: C.panel, borderRadius: 8, boxShadow: C.shadow }}>
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                    <div className="min-w-0">
                      <h2 style={{ color: C.text, fontSize: 13, fontWeight: 650 }}>Resultatregnskap</h2>
                      <p className="mt-0.5" style={{ color: C.textFaint, fontSize: 12 }}>
                        Jan til inneværende måned · YTD i siste kolonne · prosent mot {previousYear}
                      </p>
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
                          {monthLabels.map((month) => (
                            <TableHead key={month} className="min-w-[120px] text-right font-semibold" style={{ background: C.surfaceAlt, color: C.text }}>
                              {month}
                            </TableHead>
                          ))}
                          <TableHead className="min-w-[140px] text-right font-semibold" style={{ background: C.surfaceAlt, color: C.text }}>
                            YTD
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => (
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
                            {row.values.map((value, index) => (
                              <TableCell
                                key={`${row.label}-${monthLabels[index]}`}
                                className={cn(
                                  "text-right tabular-nums",
                                  row.emphasis !== "default" && "font-medium",
                                )}
                                style={{
                                  color: value === null ? C.textGhost : row.tone === "result" && value < 0 ? C.danger : C.text,
                                  fontWeight: row.emphasis === "total" ? 650 : undefined,
                                }}
                              >
                                {value === null ? (
                                  "Ikke klart"
                                ) : (
                                  <>
                                    <div>{formatCurrency(value)}</div>
                                    <div
                                      className="mt-0.5"
                                      style={{ color: getChangeColor(getChangePercent(value, row.previousValues[index])), fontSize: 11, fontWeight: 600 }}
                                    >
                                      {formatChangePercent(getChangePercent(value, row.previousValues[index]))}
                                    </div>
                                  </>
                                )}
                              </TableCell>
                            ))}
                            <TableCell
                              className="text-right tabular-nums"
                              style={{
                                color: row.tone === "result" && row.ytd < 0 ? C.danger : C.text,
                                fontWeight: row.emphasis === "default" ? 600 : 700,
                              }}
                            >
                              <div>{formatCurrency(row.ytd)}</div>
                              <div
                                className="mt-0.5"
                                style={{ color: getChangeColor(getChangePercent(row.ytd, row.previousYtd)), fontSize: 11, fontWeight: 650 }}
                              >
                                {formatChangePercent(getChangePercent(row.ytd, row.previousYtd))}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="transition-colors" style={{ borderColor: C.borderLight, background: C.panel }}>
                          <TableCell
                            className="sticky left-0 z-10 font-medium"
                            style={{ background: C.panel, color: C.text, fontWeight: 650 }}
                          >
                            Måned klar
                          </TableCell>
                          {monthLabels.map((month) => {
                            const ready = readyMonths[getMonthReadyKey(month)] === true;
                            return (
                              <TableCell key={`ready-${month}`} className="text-right">
                                <label className="inline-flex cursor-pointer select-none items-center justify-end gap-2">
                                  <input
                                    type="checkbox"
                                    checked={ready}
                                    onChange={() => toggleReadyMonth(month)}
                                    aria-label={`Marker ${month} som ferdig`}
                                    className="h-4 w-4 rounded border-border accent-[var(--dl-accent-check)]"
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
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-right" style={{ color: C.textMuted, fontSize: 12, fontWeight: 600 }}>
                            {readyMonthsList.length}/{months.length} ferdig
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </section>
              </>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
