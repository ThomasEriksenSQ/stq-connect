import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Upload, Users, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePersistentState } from "@/hooks/usePersistentState";
import { formatCleanupSummary } from "@/lib/candidateIdentity";
import { relativeFutureDate } from "@/lib/relativeDate";
import { DesignLabSidebar } from "@/components/designlab/DesignLabSidebar";
import { getDesignLabTextSizeStyle, type TextSize } from "@/components/designlab/TextSizeControl";
import { C } from "@/components/designlab/theme";
import {
  DesignLabIconButton,
  DesignLabStaticTag,
  DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS,
} from "@/components/designlab/controls";
import { DesignLabFilterRow, DesignLabPrimaryAction, DesignLabSecondaryAction } from "@/components/designlab/system";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ConsultantModal,
  ExternalCommandPalette,
  ExternalConsultantDetailCard,
  getExternalAvailabilityMeta,
} from "./EksterneKonsulenter";

type TypeFilter = "Alle" | "Freelance" | "Via partner";
type StatusFilter = "Alle" | "Tilgjengelig" | "Ikke ledig";

const GRID_TEMPLATE = "minmax(180px,1.6fr) minmax(140px,1.2fr) 110px 120px minmax(140px,1.4fr) 110px";

const TYPE_LABELS: Record<string, string> = {
  freelance: "Freelance",
  partner: "Via partner",
};

const TYPE_TAG_COLORS: Record<string, { background: string; color: string; border: string; fontWeight: number }> = {
  freelance: { background: "#E8ECF5", color: "#1A1C1F", border: "1px solid #C5CBE8", fontWeight: 600 },
  partner: { background: "#F7F8FA", color: "#5C636E", border: "1px solid #DDE0E7", fontWeight: 500 },
};

const STATUS_TAG_COLORS: Record<string, { background: string; color: string; border: string; fontWeight: number }> = {
  ledig: { background: "#E8ECF5", color: "#1A1C1F", border: "1px solid #C5CBE8", fontWeight: 600 },
  utilgjengelig: { background: "#F7F8FA", color: "#8C929C", border: "1px solid #E3E6EB", fontWeight: 500 },
};

export default function DesignLabEksterneKonsulenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const [textSize] = usePersistentState<TextSize>("dl-text-size", "M");

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("Alle");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Alle");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(true);
      }
      if (e.key === "Escape" && !cmdOpen) {
        setSelectedId(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [cmdOpen]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["external-consultants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_consultants")
        .select("*, companies(id, name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    let items = rows as any[];
    if (typeFilter === "Freelance") items = items.filter((r) => r.type === "freelance");
    if (typeFilter === "Via partner") items = items.filter((r) => r.type === "partner");
    if (statusFilter === "Tilgjengelig") {
      items = items.filter((r) => getExternalAvailabilityMeta(r.tilgjengelig_fra).isAvailable);
    } else if (statusFilter === "Ikke ledig") {
      items = items.filter((r) => !getExternalAvailabilityMeta(r.tilgjengelig_fra).isAvailable);
    }
    return items;
  }, [rows, typeFilter, statusFilter]);

  const selectedRow = useMemo(() => (rows as any[]).find((row) => row.id === selectedId) ?? null, [rows, selectedId]);

  const openEdit = (row: any) => {
    setEditId(row.id);
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditId(null);
    setModalOpen(true);
  };

  const handleCleanup = async () => {
    setCleanupRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("cleanup-external-consultants", { body: {} });
      if (error) throw error;
      if (!data?.summary) throw new Error("Ingen respons fra cleanup-external-consultants");
      toast.success(formatCleanupSummary(data.summary), {
        description: `${data.summary.kept_external} eksterne konsulenter gjenstår etter opprydding.`,
      });
      queryClient.invalidateQueries({ queryKey: ["external-consultants"] });
      setCleanupOpen(false);
    } catch (error) {
      console.error("cleanup-external-consultants failed:", error);
      toast.error(error instanceof Error ? error.message : "Kunne ikke rydde eksterne konsulenter");
    } finally {
      setCleanupRunning(false);
    }
  };

  const renderRow = (row: any) => {
    const name = row.navn || "—";
    const company = row.companies?.name || row.selskap_tekst || "—";
    const isSelected = selectedId === row.id;
    const availability = getExternalAvailabilityMeta(row.tilgjengelig_fra);

    return (
      <button
        key={row.id}
        type="button"
        onClick={() => setSelectedId(row.id)}
        className="grid w-full items-center text-left transition-colors"
        style={{
          gridTemplateColumns: GRID_TEMPLATE,
          minHeight: 38,
          paddingInline: 16,
          borderBottom: `1px solid ${C.borderLight}`,
          background: isSelected ? C.selected : "transparent",
        }}
        onMouseEnter={(event) => {
          if (!isSelected) event.currentTarget.style.background = C.hoverBg;
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.background = isSelected ? C.selected : "transparent";
        }}
      >
        <span className="truncate" style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
          {name}
        </span>
        <span className="truncate" style={{ fontSize: 13, color: C.textMuted }}>
          {company}
        </span>
        <div>
          <DesignLabStaticTag colors={TYPE_TAG_COLORS[row.type] || DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}>
            {TYPE_LABELS[row.type] || row.type}
          </DesignLabStaticTag>
        </div>
        <div>
          <DesignLabStaticTag
            colors={STATUS_TAG_COLORS[availability.statusKey] || DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}
          >
            {availability.label}
          </DesignLabStaticTag>
        </div>
        <div className="flex flex-nowrap items-center gap-1 overflow-hidden">
          {(row.teknologier || []).slice(0, 2).map((t: string) => (
            <DesignLabStaticTag key={t} colors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}>
              {t}
            </DesignLabStaticTag>
          ))}
          {(row.teknologier || []).length > 2 && (
            <span className="flex-shrink-0" style={{ fontSize: 11, color: C.textFaint }}>
              +{row.teknologier.length - 2}
            </span>
          )}
        </div>
        <span style={{ fontSize: 13, color: C.textMuted }}>{relativeFutureDate(row.tilgjengelig_fra)}</span>
      </button>
    );
  };

  return (
    <div
      className="flex h-screen overflow-hidden select-none"
      style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif", background: C.bg }}
    >
      <DesignLabSidebar navigate={navigate} signOut={signOut} user={user} activePath="/design-lab/eksterne" />

      <main
        className="flex-1 flex min-w-0 flex-col overflow-hidden"
        style={{ ...getDesignLabTextSizeStyle(textSize), background: C.appBg }}
      >
        <header
          className="flex items-center justify-between px-6 shrink-0"
          style={{ height: 40, borderBottom: `1px solid ${C.border}` }}
        >
          <div className="flex items-baseline gap-2.5">
            <h1 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Eksterne</h1>
            <span style={{ fontSize: 13, color: C.textGhost, fontWeight: 500 }}>· {filtered.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <DesignLabSecondaryAction onClick={() => navigate("/stacq/importer-cver")}>
              <Upload className="h-3.5 w-3.5" />
              Importer CVer
            </DesignLabSecondaryAction>
            <DesignLabSecondaryAction onClick={() => setCleanupOpen(true)} disabled={cleanupRunning}>
              {cleanupRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
              Rydd dubletter
            </DesignLabSecondaryAction>
            <DesignLabPrimaryAction onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              Legg til
            </DesignLabPrimaryAction>
          </div>
        </header>

        <div className="shrink-0" style={{ borderBottom: `1px solid ${C.border}`, padding: "8px 24px 10px" }}>
          <div className="space-y-1.5">
            <DesignLabFilterRow
              label="TYPE"
              options={["Alle", "Freelance", "Via partner"] as const}
              value={typeFilter}
              onChange={(value) => setTypeFilter(value)}
            />
            <DesignLabFilterRow
              label="STATUS"
              options={["Alle", "Tilgjengelig", "Ikke ledig"] as const}
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 flex">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={38} minSize={24} maxSize={60}>
              <div className="h-full overflow-y-auto" style={{ scrollbarColor: `${C.borderStrong} ${C.surfaceAlt}` }}>
                <div
                  className="sticky top-0 z-10"
                  style={{ background: C.surfaceAlt, borderBottom: `1px solid ${C.border}` }}
                >
                  <div
                    className="grid items-center"
                    style={{
                      gridTemplateColumns: GRID_TEMPLATE,
                      height: 32,
                      paddingInline: 16,
                    }}
                  >
                    {["Navn", "Selskap", "Type", "Status", "Teknologier", "Tilgj. fra"].map((label) => (
                      <span
                        key={label}
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
                </div>

                {isLoading ? (
                  <div style={{ textAlign: "center", padding: "48px 0", color: C.textFaint, fontSize: 13 }}>
                    Laster eksterne konsulenter…
                  </div>
                ) : filtered.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "48px 0", color: C.textFaint, fontSize: 13 }}>
                    Ingen eksterne konsulenter å vise
                  </div>
                ) : (
                  filtered.map((row) => renderRow(row))
                )}
              </div>
            </ResizablePanel>

            <ResizableHandle
              withHandle
              className="bg-transparent hover:bg-[rgba(0,0,0,0.04)] transition-colors data-[resize-handle-active]:bg-[rgba(94,106,210,0.12)]"
            />

            <ResizablePanel defaultSize={62} minSize={34}>
              {selectedRow ? (
                <div
                  className="flex h-full flex-col"
                  style={{ background: C.panel, borderLeft: `1px solid ${C.borderLight}` }}
                >
                  <div className="shrink-0 flex items-center justify-end px-4" style={{ height: 32 }}>
                    <DesignLabIconButton onClick={() => setSelectedId(null)} title="Lukk panel">
                      <X style={{ width: 16, height: 16 }} />
                    </DesignLabIconButton>
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 py-5 dl-v8-theme">
                    <ExternalConsultantDetailCard row={selectedRow} onEdit={() => openEdit(selectedRow)} />
                  </div>
                </div>
              ) : (
                <div
                  className="flex h-full items-center justify-center"
                  style={{ borderLeft: `1px solid ${C.borderLight}`, background: C.panel }}
                >
                  <p style={{ fontSize: 13, color: C.textFaint }}>Trykk ⌘K for å søke.</p>
                </div>
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </main>

      <ConsultantModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editRow={editId ? (rows as any[]).find((r) => r.id === editId) : null}
        userId={user?.id}
      />

      <AlertDialog open={cleanupOpen} onOpenChange={setCleanupOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rydd eksterne konsulenter?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette fjerner åpenbare dubletter og eksterne kandidater som matcher ansatte. Rader som allerede er koblet
              til en forespørsel blir hoppet over.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cleanupRunning}>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleCleanup} disabled={cleanupRunning}>
              {cleanupRunning ? "Rydder…" : "Ja, rydd nå"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExternalCommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        textSize={textSize}
        rows={rows}
        onSelect={(id) => {
          setSelectedId(id);
          setCmdOpen(false);
        }}
      />
    </div>
  );
}
