import { useState, useEffect } from "react";
import { Sparkles, Loader2, Target, RefreshCw, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { differenceInDays, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";

export interface ForespørselMatch {
  id: number;
  selskap_navn: string;
  score: number;
  begrunnelse: string;
  match_tags: string[];
}

interface Konsulent {
  navn: string;
  teknologier: string[];
  cv_tekst?: string | null;
  geografi?: string | null;
  /** For linking: internal ansatt id or external consultant id */
  ansatt_id?: number;
  ekstern_id?: string;
}

type MatchFilter = "Alle" | "Høy score" | "Frist snart";

const CHIP_BASE = "h-7 px-2.5 text-[0.75rem] rounded-full border transition-colors cursor-pointer select-none";
const CHIP_OFF = `${CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;
const CHIP_ON = `${CHIP_BASE} bg-primary/10 border-primary/30 text-primary font-medium`;

function ScoreDot({ score }: { score: number }) {
  const color = score >= 8 ? "bg-emerald-500" : score >= 6 ? "bg-amber-500" : "bg-red-500";
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full", color)} />;
}

function FristBadge({ fristDato }: { fristDato: string | null }) {
  if (!fristDato) return <span className="text-[0.75rem] text-muted-foreground">Ingen frist</span>;
  const days = differenceInDays(parseISO(fristDato), new Date());
  const color = days <= 7 ? "text-destructive" : days <= 14 ? "text-amber-600" : "text-muted-foreground";
  const label = days < 0 ? `${Math.abs(days)}d siden` : days === 0 ? "I dag" : `om ${days}d`;
  return <span className={cn("text-[0.75rem] font-medium", color)}>Frist: {label}</span>;
}

export function OppdragsMatchPanel({
  konsulent,
  foresporslerData,
  autoRunMatch,
}: {
  konsulent: Konsulent;
  /** Pre-fetched forespørsler to avoid duplicate queries */
  foresporslerData?: any[] | null;
  autoRunMatch?: boolean;
}) {
  const navigate = useNavigate();
  const [matching, setMatching] = useState(false);
  const [results, setResults] = useState<ForespørselMatch[] | null>(null);
  const [filter, setFilter] = useState<MatchFilter>("Alle");
  const [foresporsler, setForesporsler] = useState<any[]>(foresporslerData || []);

  const runMatch = async () => {
    setMatching(true);
    setResults(null);
    try {
      let fData = foresporsler;
      if (!fData.length) {
        const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
        const { data } = await supabase
          .from("foresporsler")
          .select("id, selskap_navn, sted, teknologier, frist_dato, status")
          .gte("created_at", fortyFiveDaysAgo)
          .in("status", ["Ny", "Aktiv"])
          .order("frist_dato", { ascending: true });
        fData = data || [];
        setForesporsler(fData);
      }

      if (fData.length === 0) {
        toast("Ingen aktive forespørsler å matche mot");
        setResults([]);
        setMatching(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("match-foresporsler", {
        body: {
          konsulent: {
            navn: konsulent.navn,
            teknologier: konsulent.teknologier,
            cv_tekst: konsulent.cv_tekst,
            geografi: konsulent.geografi,
          },
          foresporsler: fData,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResults(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Match error:", err);
      toast.error(err.message || "Kunne ikke kjøre matching");
      setResults([]);
    } finally {
      setMatching(false);
    }
  };

  const addToForespørsel = async (forespørselId: number) => {
    try {
      if (konsulent.ansatt_id) {
        await supabase.from("foresporsler_konsulenter").insert({
          foresporsler_id: forespørselId,
          ansatt_id: konsulent.ansatt_id,
          konsulent_type: "intern",
        });
      } else if (konsulent.ekstern_id) {
        await supabase.from("foresporsler_konsulenter").insert({
          foresporsler_id: forespørselId,
          ekstern_id: konsulent.ekstern_id,
          konsulent_type: "ekstern",
        });
      }
      toast.success("Lagt til på forespørsel");
    } catch {
      toast.error("Kunne ikke legge til");
    }
  };

  const filtered = results
    ? results.filter((r) => {
        if (filter === "Høy score") return r.score >= 8;
        if (filter === "Frist snart") {
          const f = foresporsler.find((fp: any) => fp.id === r.id);
          if (!f?.frist_dato) return false;
          return differenceInDays(parseISO(f.frist_dato), new Date()) <= 14;
        }
        return true;
      })
    : [];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Target className="h-4 w-4 text-primary" />
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Oppdragsmatch
        </p>
      </div>

      {/* Initial state — show button */}
      {!results && !matching && (
        <button
          onClick={runMatch}
          disabled={!konsulent.teknologier?.length}
          className="inline-flex items-center gap-2 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          Finn passende oppdrag
        </button>
      )}

      {/* Loading */}
      {matching && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-border bg-muted/30 p-3 animate-pulse">
              <div className="h-4 bg-muted rounded w-2/3 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
          <p className="text-[0.8125rem] text-primary font-medium flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Analyserer match...
          </p>
        </div>
      )}

      {/* No results */}
      {results && results.length === 0 && !matching && (
        <div>
          <p className="text-[0.8125rem] text-muted-foreground mb-2">Ingen treff med score ≥ 4</p>
          <button
            onClick={runMatch}
            className="text-[0.75rem] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Kjør på nytt
          </button>
        </div>
      )}

      {/* Results */}
      {results && results.length > 0 && !matching && (
        <div>
          {/* Filter chips */}
          <div className="flex items-center gap-1.5 mb-3">
            {(["Alle", "Høy score", "Frist snart"] as MatchFilter[]).map((chip) => (
              <button
                key={chip}
                onClick={() => setFilter(chip)}
                className={filter === chip ? CHIP_ON : CHIP_OFF}
              >
                {chip}
              </button>
            ))}
            <button
              onClick={runMatch}
              className="ml-auto text-[0.75rem] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Kjør på nytt
            </button>
          </div>

          {/* Result cards */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filtered.map((m, i) => {
              const f = foresporsler.find((fp: any) => fp.id === m.id);
              return (
                <div key={m.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[0.75rem] font-bold text-muted-foreground">#{i + 1}</span>
                      <span className="text-[0.875rem] font-semibold text-foreground truncate">
                        {m.selskap_navn}
                      </span>
                      {f?.sted && (
                        <span className="text-[0.6875rem] text-muted-foreground shrink-0">
                          · {f.sted}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <ScoreDot score={m.score} />
                      <span className="text-[0.8125rem] font-bold text-foreground">{m.score}/10</span>
                    </div>
                  </div>

                  {/* Match tags */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {m.match_tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[0.6875rem] font-medium"
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  {/* Begrunnelse */}
                  <p className="text-[0.8125rem] text-muted-foreground mt-1.5 italic">{m.begrunnelse}</p>

                  {/* Footer: frist + action */}
                  <div className="flex items-center justify-between mt-2">
                    <FristBadge fristDato={f?.frist_dato || null} />
                    <button
                      onClick={() => addToForespørsel(m.id)}
                      className="inline-flex items-center gap-1 text-[0.75rem] text-primary hover:underline font-medium"
                    >
                      Legg til CV →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
