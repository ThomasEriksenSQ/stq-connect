import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { cn, getInitials, formatMonths } from "@/lib/utils";
import { format, differenceInMonths, isAfter } from "date-fns";

type Filter = "Alle" | "Aktiv" | "Kommende" | "Sluttet";

export default function KonsulenterAnsatte() {
  const [filter, setFilter] = useState<Filter>("Aktiv");
  const today = new Date();

  const { data: ansatte = [], isLoading } = useQuery({
    queryKey: ["stacq-ansatte"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stacq_ansatte")
        .select("*")
        .order("start_dato", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: oppdrag = [] } = useQuery({
    queryKey: ["stacq-oppdrag-active-names"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stacq_oppdrag")
        .select("kandidat")
        .in("status", ["Aktiv", "Oppstart"]);
      if (error) throw error;
      return data;
    },
  });

  const activeOppdragNames = useMemo(
    () => new Set(oppdrag.map((o: any) => o.kandidat)),
    [oppdrag]
  );

  const getStatus = (row: any) => {
    if (row.status === "SLUTTET") return "Sluttet";
    if (row.start_dato && isAfter(new Date(row.start_dato), today)) return "Kommende";
    return "Aktiv";
  };

  const stats = useMemo(() => {
    let aktive = 0, kommende = 0, sluttet = 0;
    ansatte.forEach((a: any) => {
      const s = getStatus(a);
      if (s === "Aktiv") aktive++;
      else if (s === "Kommende") kommende++;
      else sluttet++;
    });
    return { aktive, kommende, sluttet };
  }, [ansatte]);

  const filtered = useMemo(() => {
    return ansatte.filter((a: any) => {
      const s = getStatus(a);
      if (filter === "Alle") return true;
      if (filter === "Aktiv") return s === "Aktiv" || s === "Kommende";
      return s === filter;
    });
  }, [ansatte, filter]);

  const getDuration = (row: any) => {
    const s = getStatus(row);
    if (s === "Kommende") return "–";
    const start = new Date(row.start_dato);
    const end = s === "Sluttet" && row.slutt_dato ? new Date(row.slutt_dato) : today;
    const months = differenceInMonths(end, start);
    return formatMonths(months);
  };

  const chips: Filter[] = ["Alle", "Aktiv", "Kommende", "Sluttet"];

  if (isLoading) {
    return <p className="text-muted-foreground py-12 text-center">Laster ansatte...</p>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-[1.375rem] font-bold">Ansatte</h1>
        <span className="bg-secondary text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
          {stats.aktive + stats.kommende}
        </span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl px-5 py-4 shadow-sm">
          <p className="text-2xl font-bold text-emerald-600">{stats.aktive}</p>
          <p className="text-[0.8125rem] text-muted-foreground">Aktive ansatte</p>
          <p className="text-xs text-muted-foreground">i dag</p>
        </div>
        <div className="bg-card border border-border rounded-xl px-5 py-4 shadow-sm">
          <p className="text-2xl font-bold text-amber-600">{stats.kommende}</p>
          <p className="text-[0.8125rem] text-muted-foreground">Kommende</p>
          <p className="text-xs text-muted-foreground">venter oppstart</p>
        </div>
        <div className="bg-card border border-border rounded-xl px-5 py-4 shadow-sm">
          <p className="text-2xl font-bold text-muted-foreground">{stats.sluttet}</p>
          <p className="text-[0.8125rem] text-muted-foreground">Har sluttet</p>
          <p className="text-xs text-muted-foreground">tidligere ansatt</p>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 mb-4">
        {chips.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={cn(
              "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors",
              filter === c
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:bg-secondary"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["NAVN", "START", "ANSETTELSE", "STATUS", "KONTAKT"].map((h) => (
                <th
                  key={h}
                  className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground px-4 py-2.5 text-left"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((a: any, i: number) => {
              const status = getStatus(a);
              const isKommende = status === "Kommende";
              const isSluttet = status === "Sluttet";
              const inOppdrag = activeOppdragNames.has(a.navn);
              return (
                <tr
                  key={a.id}
                  className={cn(
                    "hover:bg-muted/30 transition-colors",
                    i < filtered.length - 1 && "border-b border-border",
                    isKommende && "opacity-80",
                    isSluttet && "opacity-50"
                  )}
                >
                  {/* NAVN */}
                  <td className="px-4 py-3 min-h-[52px]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-[0.6875rem] font-bold flex items-center justify-center flex-shrink-0">
                        {getInitials(a.navn)}
                      </div>
                      <span className="font-medium text-[0.875rem]">{a.navn}</span>
                      {inOppdrag && (
                        <span className="bg-emerald-100 text-emerald-700 text-[0.625rem] font-semibold uppercase rounded px-1.5 py-0.5 ml-1.5">
                          I OPPDRAG
                        </span>
                      )}
                    </div>
                  </td>
                  {/* START */}
                  <td className="px-4 py-3 text-[0.8125rem]">
                    {isKommende ? (
                      <span className="bg-amber-100 text-amber-700 text-xs font-medium rounded-full px-2.5 py-0.5">
                        Starter {format(new Date(a.start_dato), "dd.MM")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {format(new Date(a.start_dato), "dd.MM.yyyy")}
                      </span>
                    )}
                  </td>
                  {/* ANSETTELSE */}
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {getDuration(a)}
                  </td>
                  {/* STATUS */}
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        status === "Aktiv" && "bg-emerald-100 text-emerald-700",
                        status === "Kommende" && "bg-amber-100 text-amber-700",
                        status === "Sluttet" && "bg-muted text-muted-foreground"
                      )}
                    >
                      {status}
                    </span>
                  </td>
                  {/* KONTAKT */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">{a.tlf}</span>
                      <span className="text-xs text-muted-foreground/70 mt-0.5">{a.epost}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-muted-foreground text-center py-12">Ingen ansatte å vise</p>
        )}
      </div>
    </div>
  );
}
