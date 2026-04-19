import { useMemo, useState } from "react";
import { differenceInDays, differenceInMonths, format, isAfter } from "date-fns";
import { nb } from "date-fns/locale";
import { Plus, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { formatMonths, getInitials } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePersistentState } from "@/hooks/usePersistentState";
import { DesignLabSidebar } from "@/components/designlab/DesignLabSidebar";
import { getDesignLabTextSizeStyle, type TextSize } from "@/components/designlab/TextSizeControl";
import { C } from "@/components/designlab/theme";
import { DesignLabSearchInput, DesignLabIconButton } from "@/components/designlab/controls";
import {
  DesignLabPrimaryAction,
  DesignLabFilterRow,
  DesignLabReadonlyChip,
} from "@/components/designlab/system";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AnsattDetailSheet } from "@/components/AnsattDetailSheet";
import AnsattDetail from "./AnsattDetail";

type Filter = "Alle" | "Aktiv" | "Kommende" | "Sluttet";

const GRID_TEMPLATE = "minmax(220px,2.2fr) 140px 90px 120px 120px 110px 110px";
const ACTIVE_CHIP_COLORS = {
  background: C.successBg,
  color: C.success,
  border: `1px solid rgba(74,154,106,0.18)`,
  fontWeight: 600,
};

const UPCOMING_CHIP_COLORS = {
  background: C.warningBg,
  color: C.warning,
  border: `1px solid rgba(154,122,42,0.18)`,
  fontWeight: 600,
};

export default function DesignLabKonsulenterAnsatte() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const selectedId = id ? Number(id) : null;
  const queryClient = useQueryClient();
  const { signOut, user } = useAuth();
  const [textSize] = usePersistentState<TextSize>("dl-text-size", "M");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("Aktiv");
  const [createOpen, setCreateOpen] = useState(false);
  const today = new Date();

  const { data: ansatte = [], isLoading } = useQuery({
    queryKey: ["stacq-ansatte"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stacq_ansatte")
        .select("*")
        .order("start_dato", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: oppdrag = [] } = useQuery({
    queryKey: ["stacq-oppdrag-active-names"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stacq_oppdrag")
        .select("kandidat, status, forny_dato, lopende_30_dager")
        .in("status", ["Aktiv", "Oppstart"]);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: cvDocs = [] } = useQuery({
    queryKey: ["cv-documents-updated"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cv_documents")
        .select("ansatt_id, portrait_url");
      if (error) throw error;
      return data || [];
    },
  });

  const cvPortraitMap = useMemo(() => {
    const portraitMap = new Map<number, string>();
    (cvDocs as any[]).forEach((c) => {
      if (c.ansatt_id && c.portrait_url) portraitMap.set(c.ansatt_id, c.portrait_url);
    });
    return portraitMap;
  }, [cvDocs]);

  const oppdragMap = useMemo(() => {
    const map = new Map<string, string>();
    (oppdrag as any[]).forEach((row) => {
      if (!map.has(row.kandidat) || row.status === "Aktiv") {
        map.set(row.kandidat, row.status);
      }
    });
    return map;
  }, [oppdrag]);

  const fornyMap = useMemo(() => {
    const map = new Map<string, { forny_dato: string | null; lopende_30_dager: boolean }>();
    (oppdrag as any[]).forEach((row) => {
      if (!map.has(row.kandidat) || row.status === "Aktiv") {
        map.set(row.kandidat, {
          forny_dato: row.forny_dato ?? null,
          lopende_30_dager: !!row.lopende_30_dager,
        });
      }
    });
    return map;
  }, [oppdrag]);

  const getStatus = (row: any) => {
    if (row.status === "SLUTTET") return "Sluttet";
    if (row.start_dato && isAfter(new Date(row.start_dato), today)) return "Kommende";
    return "Aktiv";
  };

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

  const stats = useMemo(() => {
    let aktive = 0;
    let kommende = 0;

    ansatte.forEach((row: any) => {
      const status = getStatus(row);
      if (status === "Aktiv") aktive += 1;
      if (status === "Kommende") kommende += 1;
    });

    return { aktive, kommende };
  }, [ansatte]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return ansatte.filter((row: any) => {
      const status = getStatus(row);

      if (filter === "Aktiv" && status !== "Aktiv" && status !== "Kommende") return false;
      if (filter !== "Alle" && filter !== "Aktiv" && status !== filter) return false;

      if (!query) return true;

      const haystack = [
        row.navn,
        row.epost,
        row.tlf,
        row.geografi,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [ansatte, filter, search]);

  const renderRenewal = (navn: string) => {
    const entry = fornyMap.get(navn);
    if (!entry) return <span style={{ fontSize: 13, color: C.textFaint }}>—</span>;

    const effectiveDate = entry.lopende_30_dager
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      : entry.forny_dato
        ? new Date(entry.forny_dato)
        : null;

    if (!effectiveDate) return <span style={{ fontSize: 13, color: C.textFaint }}>—</span>;

    const days = differenceInDays(effectiveDate, new Date());
    let label = format(effectiveDate, "dd.MM.yy");
    let color: string = C.textFaint;
    let weight: number | undefined;

    if (days < 0) {
      label = `Utløpt ${Math.abs(days)}d`;
      color = C.danger;
      weight = 600;
    } else if (days <= 30) {
      label = `Om ${days}d`;
      color = C.warning;
      weight = 600;
    } else if (days <= 60) {
      label = `Om ${days}d`;
      color = C.warning;
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span style={{ fontSize: 13, color, fontWeight: weight }}>{label}</span>
        </TooltipTrigger>
        <TooltipContent>{format(effectiveDate, "d. MMMM yyyy", { locale: nb })}</TooltipContent>
      </Tooltip>
    );
  };

  const renderOppdragBadge = (navn: string) => {
    const oppdragStatus = oppdragMap.get(navn) || null;

    if (oppdragStatus === "Aktiv") {
      return (
        <DesignLabReadonlyChip active={true} activeColors={ACTIVE_CHIP_COLORS}>
          I oppdrag
        </DesignLabReadonlyChip>
      );
    }

    if (oppdragStatus === "Oppstart") {
      return (
        <DesignLabReadonlyChip active={true} activeColors={UPCOMING_CHIP_COLORS}>
          Oppstart
        </DesignLabReadonlyChip>
      );
    }

    return <span style={{ fontSize: 13, color: C.textFaint }}>—</span>;
  };

  const renderRow = (row: any) => {
    const status = getStatus(row);
    const selected = selectedId === row.id;
    const portrait = cvPortraitMap.get(row.id) || row.bilde_url || null;

    return (
      <button
        key={row.id}
        type="button"
        onClick={() => navigate(`/design-lab/ansatte/${row.id}`)}
        className="grid w-full items-center text-left transition-colors"
        style={{
          gridTemplateColumns: GRID_TEMPLATE,
          minHeight: 38,
          paddingInline: 16,
          borderBottom: `1px solid ${C.borderLight}`,
          background: selected ? C.selected : "transparent",
          opacity: status === "Sluttet" ? 0.55 : status === "Kommende" ? 0.82 : 1,
        }}
        onMouseEnter={(event) => {
          if (!selected) event.currentTarget.style.background = C.hoverBg;
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.background = selected ? C.selected : "transparent";
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {portrait ? (
            <img src={portrait} alt={row.navn} className="h-6 w-6 rounded-full border object-cover" style={{ borderColor: C.border }} />
          ) : (
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full"
              style={{ background: C.accentBg, color: C.accent, fontSize: 10, fontWeight: 700 }}
            >
              {getInitials(row.navn)}
            </div>
          )}
          <span className="truncate" style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{row.navn}</span>
        </div>

        <div className="truncate" style={{ fontSize: 13, color: C.textMuted }}>
          {row.geografi || "–"}
        </div>

        <div style={{ fontSize: 13, color: C.textMuted }}>
          {row.erfaring_aar ? `${row.erfaring_aar} år` : "–"}
        </div>

        <div style={{ fontSize: 13, color: C.textMuted }}>
          {status === "Kommende" && row.start_dato ? (
            <DesignLabReadonlyChip active={true} activeColors={UPCOMING_CHIP_COLORS}>
              Starter {format(new Date(row.start_dato), "dd.MM")}
            </DesignLabReadonlyChip>
          ) : row.start_dato ? (
            format(new Date(row.start_dato), "dd.MM.yyyy")
          ) : "–"}
        </div>

        <div style={{ fontSize: 13, color: C.textMuted }}>
          {!row.start_dato
            ? "–"
            : status === "Kommende"
            ? "–"
            : formatMonths(
                differenceInMonths(
                  status === "Sluttet" && row.slutt_dato ? new Date(row.slutt_dato) : today,
                  new Date(row.start_dato),
                ),
              )}
        </div>

        <div onClick={(event) => event.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="transition-opacity hover:opacity-80">
                {renderOppdragBadge(row.navn)}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" onClick={(event) => event.stopPropagation()}>
              <DropdownMenuItem onClick={() => handleSetOppdragStatus(row.navn, "Aktiv")}>
                Sett til aktiv
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSetOppdragStatus(row.navn, "Oppstart")}>
                Sett til oppstart
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleSetOppdragStatus(row.navn, null)}>
                Ikke i oppdrag
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div>{renderRenewal(row.navn)}</div>
      </button>
    );
  };

  return (
    <div
      className="flex h-screen overflow-hidden select-none"
      style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif", background: C.bg }}
    >
      <DesignLabSidebar navigate={navigate} signOut={signOut} user={user} activePath="/design-lab/ansatte" />

      <main className="flex-1 flex min-w-0 flex-col overflow-hidden" style={{ ...getDesignLabTextSizeStyle(textSize), background: C.appBg }}>
        <header className="flex items-center justify-between px-6 shrink-0" style={{ height: 40, borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-baseline gap-2.5">
            <h1 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Ansatte</h1>
            <span style={{ fontSize: 13, color: C.textGhost, fontWeight: 500 }}>· {filtered.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <DesignLabSearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Søk ansatte…"
              style={{ width: 220 }}
            />
            <DesignLabPrimaryAction onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Ny ansatt
            </DesignLabPrimaryAction>
          </div>
        </header>

        <div className="shrink-0" style={{ borderBottom: `1px solid ${C.border}`, padding: "8px 24px 10px" }}>
          <div className="flex items-center justify-between gap-4">
            <DesignLabFilterRow
              label="STATUS"
              options={["Alle", "Aktiv", "Kommende", "Sluttet"] as const}
              value={filter}
              onChange={(value) => setFilter(value)}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 flex">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={34} minSize={22} maxSize={55}>
              <div className="h-full overflow-y-auto" style={{ scrollbarColor: `${C.borderStrong} ${C.surfaceAlt}` }}>
                <div
                  className="grid items-center sticky top-0 z-10"
                  style={{
                    gridTemplateColumns: GRID_TEMPLATE,
                    height: 32,
                    borderBottom: `1px solid ${C.border}`,
                    background: C.surfaceAlt,
                    paddingInline: 16,
                  }}
                >
                  {["Navn", "Geografi", "Erfaring", "Start", "Ansatt i", "Oppdrag", "Fornyes"].map((label, index) => (
                    <span
                      key={`${label}-${index}`}
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        letterSpacing: "0.08em",
                        color: C.textMuted,
                        textTransform: "uppercase",
                      }}
                    >
                      {label}
                    </span>
                  ))}
                </div>

                {isLoading ? (
                  <div style={{ textAlign: "center", padding: "48px 0", color: C.textFaint, fontSize: 13 }}>Laster ansatte…</div>
                ) : filtered.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "48px 0", color: C.textFaint, fontSize: 13 }}>Ingen ansatte funnet</div>
                ) : (
                  filtered.map((row: any) => renderRow(row))
                )}
              </div>
            </ResizablePanel>

            <ResizableHandle
              withHandle
              className="bg-transparent hover:bg-[rgba(0,0,0,0.04)] transition-colors data-[resize-handle-active]:bg-[rgba(94,106,210,0.12)]"
            />

            <ResizablePanel defaultSize={66} minSize={30}>
              {selectedId ? (
                <div className="flex h-full flex-col" style={{ background: C.panel, borderLeft: `1px solid ${C.borderLight}` }}>
                  <div className="shrink-0 flex items-center justify-end px-4" style={{ height: 32 }}>
                    <DesignLabIconButton onClick={() => navigate("/design-lab/ansatte")}>
                      <X style={{ width: 16, height: 16 }} />
                    </DesignLabIconButton>
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 py-5">
                    <AnsattDetail
                      ansattIdOverride={selectedId}
                      hideBackButton
                      embedded
                      designLabMode
                    />
                  </div>
                </div>
              ) : (
                <div
                  className="flex h-full items-center justify-center"
                  style={{ borderLeft: `1px solid ${C.borderLight}`, background: C.panel }}
                >
                  <p style={{ fontSize: 13, color: C.textFaint }}>
                    Velg en ansatt for å vise profil.
                  </p>
                </div>
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </main>

      <AnsattDetailSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        ansatt={null}
        openInEditMode={false}
        autoRunMatch={false}
      />
    </div>
  );
}
