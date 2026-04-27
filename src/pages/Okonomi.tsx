import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
};

type RowDefinition = {
  label: string;
  values: number[];
  ytd: number;
  emphasis?: "default" | "subtotal" | "total";
  tone?: "default" | "result";
};

const currencyFormatter = new Intl.NumberFormat("nb-NO", {
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return `${currencyFormatter.format(Math.round(value)).replace(/\u00A0/g, " ")} kr`;
}

function LoadingTable() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <div className="border-b border-border px-6 py-5">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="mt-3 h-4 w-72" />
      </div>
      <div className="space-y-4 px-6 py-6">
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

export default function Okonomi() {
  const [months, setMonths] = useState<OkonomiMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOkonomi() {
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

        if (!cancelled) {
          setMonths(data.months);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Kunne ikke hente økonomidata.";
        if (!cancelled) {
          setError(message);
          setMonths([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadOkonomi();

    return () => {
      cancelled = true;
    };
  }, []);

  const monthLabels = useMemo(() => months.map((entry) => entry.month), [months]);

  const rows = useMemo<RowDefinition[]>(() => {
    const driftsresultat = months.map(
      (entry) => entry.omsetning - entry.lonnskostnader - entry.andreDriftskostnader,
    );

    const rowDefinitions: RowDefinition[] = [
      {
        label: "Omsetning",
        values: months.map((entry) => entry.omsetning),
        ytd: months.reduce((sum, entry) => sum + entry.omsetning, 0),
        emphasis: "default",
      },
      {
        label: "Lønnskostnader",
        values: months.map((entry) => entry.lonnskostnader),
        ytd: months.reduce((sum, entry) => sum + entry.lonnskostnader, 0),
        emphasis: "default",
      },
      {
        label: "Andre driftskostnader",
        values: months.map((entry) => entry.andreDriftskostnader),
        ytd: months.reduce((sum, entry) => sum + entry.andreDriftskostnader, 0),
        emphasis: "default",
      },
      {
        label: "Driftsresultat",
        values: driftsresultat,
        ytd: driftsresultat.reduce((sum, value) => sum + value, 0),
        emphasis: "subtotal",
        tone: "result",
      },
    ];

    return rowDefinitions;
  }, [months]);

  return (
    <div className="min-h-screen bg-white text-foreground">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
        <header className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Tripletex</p>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Økonomi 2026</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Månedlig resultatregnskap for 2026 hentet fra Tripletex. Tabellen utvider seg automatisk etter hvert
              som nye måneder passerer.
            </p>
          </div>
        </header>

        {loading ? <LoadingTable /> : null}

        {!loading && error ? (
          <Alert variant="destructive" className="max-w-3xl">
            <AlertTitle>Kunne ikke hente økonomidata</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!loading && !error && months.length === 0 ? (
          <Alert className="max-w-3xl">
            <AlertTitle>Ingen data tilgjengelig</AlertTitle>
            <AlertDescription>Edge function returnerte ingen måneder for 2026 ennå.</AlertDescription>
          </Alert>
        ) : null}

        {!loading && !error && months.length > 0 ? (
          <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            <div className="border-b border-border px-6 py-5">
              <h2 className="text-lg font-semibold text-foreground">Resultatregnskap per måned</h2>
              <p className="mt-1 text-sm text-muted-foreground">Jan til inneværende måned, med YTD-summer i siste kolonne.</p>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-[220px] bg-white font-semibold text-foreground">Kategori</TableHead>
                  {monthLabels.map((month) => (
                    <TableHead key={month} className="min-w-[120px] text-right font-semibold text-foreground">
                      {month}
                    </TableHead>
                  ))}
                  <TableHead className="min-w-[140px] text-right font-semibold text-foreground">YTD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.label}
                    className={cn(
                      "hover:bg-muted/30",
                      row.emphasis === "subtotal" && "bg-muted/20",
                      row.emphasis === "total" && "bg-muted/40",
                    )}
                  >
                    <TableCell
                      className={cn(
                        "font-medium text-foreground",
                        row.emphasis === "subtotal" && "font-semibold",
                        row.emphasis === "total" && "font-semibold",
                      )}
                    >
                      {row.label}
                    </TableCell>
                    {row.values.map((value, index) => (
                      <TableCell
                        key={`${row.label}-${monthLabels[index]}`}
                        className={cn(
                          "text-right tabular-nums text-foreground",
                          row.emphasis !== "default" && "font-medium",
                          row.tone === "result" && value < 0 && "text-destructive",
                        )}
                      >
                        {formatCurrency(value)}
                      </TableCell>
                    ))}
                    <TableCell
                      className={cn(
                        "text-right font-medium tabular-nums text-foreground",
                        row.tone === "result" && row.ytd < 0 && "text-destructive",
                      )}
                    >
                      {formatCurrency(row.ytd)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        ) : null}
      </main>
    </div>
  );
}
