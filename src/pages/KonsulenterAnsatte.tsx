import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { cn, getInitials, formatMonths } from "@/lib/utils";
import { format, differenceInMonths, isAfter } from "date-fns";
import { FileText, Pencil, Plus, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AnsattDetailSheet } from "@/components/AnsattDetailSheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Filter = "Alle" | "Aktiv" | "Kommende" | "Sluttet";

export default function KonsulenterAnsatte() {
  const [filter, setFilter] = useState<Filter>("Aktiv");
  const [detailAnsatt, setDetailAnsatt] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [openEditMode, setOpenEditMode] = useState(false);
  const [autoRunMatch, setAutoRunMatch] = useState(false);
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
        .select("kandidat, status")
        .in("status", ["Aktiv", "Oppstart"]);
      if (error) throw error;
      return data;
    },
  });

  const oppdragMap = useMemo(() => {
    const m = new Map<string, string>();
    (oppdrag as any[]).forEach((o) => {
      if (!m.has(o.kandidat) || o.status === "Aktiv") m.set(o.kandidat, o.status);
    });
    return m;
  }, [oppdrag]);

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
    let aktive = 0, kommende = 0;
    ansatte.forEach((a: any) => {
      const s = getStatus(a);
      if (s === "Aktiv") aktive++;
      else if (s === "Kommende") kommende++;
    });
    return { aktive, kommende };
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

  const queryClient = useQueryClient();

  const handleSetOppdragStatus = async (navn: string, status: string | null) => {
    if (status === null) {
      await supabase
        .from("stacq_oppdrag")
        .update({ status: "Inaktiv" })
        .eq("kandidat", navn)
        .in("status", ["Aktiv", "Oppstart"]);
    } else {
      await supabase
        .from("stacq_oppdrag")
        .update({ status })
        .eq("kandidat", navn)
        .in("status", ["Aktiv", "Oppstart", "Inaktiv"]);
    }
    queryClient.invalidateQueries({ queryKey: ["stacq-ansatte"] });
    queryClient.invalidateQueries({ queryKey: ["stacq-oppdrag-active-names"] });
  };

  const chips: Filter[] = ["Alle", "Aktiv", "Kommende", "Sluttet"];

  if (isLoading) {
    return <p className="text-muted-foreground py-12 text-center">Laster ansatte...</p>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[1.375rem] font-bold">Ansatte</h1>
        <button
          onClick={() => { setDetailAnsatt(null); setOpenEditMode(false); setDetailOpen(true); }}
          className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Ny ansatt
        </button>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[0.75rem] text-muted-foreground ml-auto">
          {stats.aktive + stats.kommende} ansatte
        </span>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2">
        {chips.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={cn(
              "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors",
              filter === c
                ? "bg-foreground text-background border-foreground font-medium"
                : "border-border text-muted-foreground hover:bg-secondary"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-card shadow-card">
        {/* Header */}
        <div className="grid grid-cols-[minmax(0,2.5fr)_100px_110px_130px_160px] gap-3 px-4 py-2.5 border-b border-border bg-background">
          {["NAVN", "START", "ANSETTELSE", "OPPDRAG", "HANDLINGER"].map((h) => (
            <span key={h} className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">{h}</span>
          ))}
        </div>
        <div className="divide-y divide-border">
        {filtered.map((a: any) => {
          const status = getStatus(a);
          const isKommende = status === "Kommende";
          const isSluttet = status === "Sluttet";
          const inOppdrag = activeOppdragNames.has(a.navn);
          const oppdragStatus = oppdragMap.get(a.navn) || null;

          const oppdragBadge = oppdragStatus === "Aktiv" ? (
            <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 text-[0.75rem] font-semibold">
              I oppdrag
            </span>
          ) : oppdragStatus === "Oppstart" ? (
            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-0.5 text-[0.75rem] font-semibold">
              Oppstart
            </span>
          ) : (
            <span className="text-[0.8125rem] text-muted-foreground">—</span>
          );

          return (
            <div
              key={a.id}
              className={cn(
                "group grid grid-cols-[minmax(0,2.5fr)_100px_110px_130px_160px] gap-3 items-center px-4 min-h-[44px] py-2 hover:bg-background/80 transition-colors duration-75",
                isKommende && "opacity-80",
                isSluttet && "opacity-50"
              )}
            >
              {/* NAVN */}
              <div className="flex items-center gap-3 min-w-0">
                {a.bilde_url ? (
                  <img src={a.bilde_url} alt={a.navn} className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-border" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-[0.6875rem] font-bold flex items-center justify-center flex-shrink-0">
                    {getInitials(a.navn)}
                  </div>
                )}
                <span className="font-medium text-[0.8125rem] truncate">{a.navn}</span>
              </div>
              {/* START */}
              <div className="text-[0.8125rem]">
                {isKommende ? (
                  <span className="bg-amber-100 text-amber-700 text-xs font-medium rounded-full px-2.5 py-0.5">
                    Starter {format(new Date(a.start_dato), "dd.MM")}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {a.start_dato ? format(new Date(a.start_dato), "dd.MM.yyyy") : "–"}
                  </span>
                )}
              </div>
              {/* ANSETTELSE */}
              <div className="text-[0.8125rem] text-muted-foreground">{getDuration(a)}</div>
              {/* OPPDRAG */}
              <div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <button className="hover:opacity-70 transition-opacity">
                      {oppdragBadge}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => handleSetOppdragStatus(a.navn, "Aktiv")}>
                      <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-xs font-semibold mr-2">I oppdrag</span>
                      Sett til aktiv
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSetOppdragStatus(a.navn, "Oppstart")}>
                      <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 text-xs font-semibold mr-2">Oppstart</span>
                      Sett til oppstart
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleSetOppdragStatus(a.navn, null)}>
                      <span className="text-muted-foreground mr-2">—</span>
                      Ikke i oppdrag
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {/* HANDLINGER */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); setDetailAnsatt(a); setOpenEditMode(false); setAutoRunMatch(true); setDetailOpen(true); }}
                  className="inline-flex items-center gap-1 h-7 px-2.5 text-[0.75rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Finn oppdrag
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); setDetailAnsatt(a); setOpenEditMode(true); setDetailOpen(true); }}
                  className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground border border-border"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
        </div>
        {filtered.length === 0 && (
          <p className="text-muted-foreground text-center py-12">Ingen ansatte å vise</p>
        )}
      </div>

      <AnsattDetailSheet open={detailOpen} onClose={() => { setDetailOpen(false); setAutoRunMatch(false); }} ansatt={detailAnsatt} openInEditMode={openEditMode} autoRunMatch={autoRunMatch} />
    </div>
  );
}
