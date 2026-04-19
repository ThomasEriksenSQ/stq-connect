import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { C } from "@/components/designlab/theme";
import { getDesignLabTextSizeStyle, type TextSize } from "@/components/designlab/TextSizeControl";
import { usePersistentState } from "@/hooks/usePersistentState";
import { addDays, format, isAfter, isBefore, startOfDay } from "date-fns";
import { nb } from "date-fns/locale";
import { Plus, X, Search, CalendarIcon, Upload, CheckCircle2, Loader2, Users, User, Mail, Phone, Building2, Clock3, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatCleanupSummary } from "@/lib/candidateIdentity";
import { normalizeTechnologyTags } from "@/lib/technologyTags";
import { relativeFutureDate } from "@/lib/relativeDate";
import { OppdragsMatchPanel } from "@/components/OppdragsMatchPanel";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { DesignLabEntitySheet } from "@/components/designlab/DesignLabEntitySheet";
import {
  DesignLabFilterButton,
  DesignLabIconButton,
  DesignLabStaticTag,
  DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS,
  DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS,
  DESIGN_LAB_NEUTRAL_TAG_INACTIVE_HOVER_COLORS,
} from "@/components/designlab/controls";

type TypeFilter = "Alle" | "freelance" | "partner";
type StatusFilter = "Alle" | "ledig" | "utilgjengelig";

const CHIP_BASE = "h-7 px-2.5 text-[0.75rem] rounded-[6px] border transition-colors cursor-pointer font-medium";
const CHIP_OFF = `${CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;
const CHIP_ON = `${CHIP_BASE} bg-[#E8ECF5] text-[#1A1C1F] border-[#C5CBE8] font-semibold`;

const TYPE_LABELS: Record<string, string> = {
  freelance: "Freelance",
  partner: "Via partner",
};
const STATUS_TAG_COLORS: Record<string, { background: string; color: string; border: string; fontWeight: number }> = {
  ledig: { background: "#E8ECF5", color: "#1A1C1F", border: "1px solid #C5CBE8", fontWeight: 600 },
  aktiv: { background: "#E8ECF5", color: "#1A1C1F", border: "1px solid #C5CBE8", fontWeight: 600 },
  utilgjengelig: { background: "#F7F8FA", color: "#8C929C", border: "1px solid #E3E6EB", fontWeight: 500 },
  utgått: { background: "#F7F8FA", color: "#8C929C", border: "1px solid #E3E6EB", fontWeight: 500 },
};

const TYPE_TAG_COLORS: Record<string, { background: string; color: string; border: string; fontWeight: number }> = {
  freelance: { background: "#E8ECF5", color: "#1A1C1F", border: "1px solid #C5CBE8", fontWeight: 600 },
  partner: { background: "#F7F8FA", color: "#5C636E", border: "1px solid #DDE0E7", fontWeight: 500 },
};
const AVAILABILITY_WINDOW_DAYS = 60;

const SUGGESTED_TECH = [
  "C++", "C", "Embedded", "Yocto", "Linux", "Qt", "FPGA",
  "Python", "SPI/I2C", "MCU", "Embedded Linux", "Sikkerhet",
];

export function getExternalAvailabilityMeta(availableFrom: string | null | undefined) {
  if (!availableFrom) {
    return { isAvailable: false, statusKey: "utilgjengelig", label: "Ikke ledig" };
  }
  const startDate = startOfDay(new Date(availableFrom));
  if (Number.isNaN(startDate.getTime())) {
    return { isAvailable: false, statusKey: "utilgjengelig", label: "Ikke ledig" };
  }
  const today = startOfDay(new Date());
  const expiryDate = addDays(startDate, AVAILABILITY_WINDOW_DAYS);
  const isAvailable = !isBefore(today, startDate) && !isAfter(today, expiryDate);
  return {
    isAvailable,
    statusKey: isAvailable ? "ledig" : "utilgjengelig",
    label: isAvailable ? "Tilgjengelig" : "Ikke ledig",
  };
}

interface EksterneKonsulenterProps {
  hidePageTitle?: boolean;
  embeddedSplit?: boolean;
  showActionBar?: boolean;
  createRequestId?: number;
}

export default function EksterneKonsulenter({
  hidePageTitle = false,
  embeddedSplit = false,
  showActionBar = true,
  createRequestId,
}: EksterneKonsulenterProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("Alle");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Alle");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [textSize] = usePersistentState<TextSize>("dl-text-size", "M");

  useEffect(() => {
    if (!embeddedSplit) return;
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
  }, [embeddedSplit, cmdOpen]);

  useEffect(() => {
    if (createRequestId === undefined) return;
    if (createRequestId === 0) return;
    setEditId(null);
    setModalOpen(true);
  }, [createRequestId]);

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
    let items = rows;
    if (typeFilter !== "Alle") items = items.filter((r: any) => r.type === typeFilter);
    if (statusFilter !== "Alle") {
      if (statusFilter === "ledig") {
        items = items.filter((r: any) => getExternalAvailabilityMeta(r.tilgjengelig_fra).isAvailable);
      } else {
        items = items.filter((r: any) => !getExternalAvailabilityMeta(r.tilgjengelig_fra).isAvailable);
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((r: any) => {
        const name = (r as any).navn || "";
        const company = r.companies?.name || (r as any).selskap_tekst || "";
        const tech = (r.teknologier || []).join(" ");
        return [name, company, tech].join(" ").toLowerCase().includes(q);
      });
    }
    return items;
  }, [rows, typeFilter, statusFilter, search]);

  const selectedRow = useMemo(
    () => rows.find((row: any) => row.id === selectedId) ?? null,
    [rows, selectedId],
  );

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
      const { data, error } = await supabase.functions.invoke("cleanup-external-consultants", {
        body: {},
      });

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

  if (isLoading) {
    return <p className="text-muted-foreground py-12 text-center">Laster eksterne konsulenter...</p>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      {!hidePageTitle && (
        <div className="flex items-center justify-between">
          <h1 className="text-[1.375rem] font-bold">Eksterne konsulenter</h1>
        </div>
      )}

      {/* Search + count + Add */}
      {showActionBar && !embeddedSplit && (
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Søk navn, selskap, teknologi..."
              className="pl-9 h-9 rounded-lg text-[0.8125rem] bg-card border-border"
            />
          </div>
          <div className="ml-auto" />
          <button
            onClick={() => navigate("/stacq/importer-cver")}
            className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg border border-border bg-background text-foreground hover:bg-secondary transition-colors"
          >
            <Upload className="h-4 w-4" />
            Importer CVer
          </button>
          <button
            onClick={() => setCleanupOpen(true)}
            disabled={cleanupRunning}
            className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg border border-border bg-background text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            {cleanupRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            Rydd dubletter
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Legg til
          </button>
        </div>
      )}
      {/* Filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground w-16 shrink-0">Type</span>
          {(["Alle", "freelance", "partner"] as TypeFilter[]).map(f => (
            <button key={f} className={typeFilter === f ? CHIP_ON : CHIP_OFF} onClick={() => setTypeFilter(f)}>
              {f === "Alle" ? "Alle" : TYPE_LABELS[f]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground w-16 shrink-0">Status</span>
          {(["Alle", "ledig", "utilgjengelig"] as StatusFilter[]).map(f => (
            <button key={f} className={statusFilter === f ? CHIP_ON : CHIP_OFF} onClick={() => setStatusFilter(f)}>
              {f === "Alle" ? "Alle" : f === "ledig" ? "Tilgjengelig" : "Ikke ledig"}
            </button>
          ))}
        </div>
      </div>

      {embeddedSplit ? (
        <div className="hidden md:block h-[820px]">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={40} minSize={26}>
              <div className="h-full border border-border rounded-lg overflow-hidden bg-card shadow-card">
                <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_100px_110px_minmax(0,1.5fr)_100px] gap-3 px-4 py-2.5 border-b border-border bg-background sticky top-0 z-10">
                  {["NAVN", "SELSKAP", "TYPE", "STATUS", "TEKNOLOGIER", "TILGJ. FRA"].map(h => (
                    <span key={h} className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">{h}</span>
                  ))}
                </div>
                <div className="divide-y divide-border">
                  {filtered.map((row: any) => {
                    const name = (row as any).navn || "—";
                    const company = row.companies?.name || (row as any).selskap_tekst || "—";
                    const isSelected = selectedId === row.id;
                    const availability = getExternalAvailabilityMeta(row.tilgjengelig_fra);
                    return (
                      <div
                        key={row.id}
                        onClick={() => setSelectedId(row.id)}
                        className={cn(
                          "grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_100px_110px_minmax(0,1.5fr)_100px] gap-3 items-center px-4 min-h-[38px] py-1 transition-colors duration-75 cursor-pointer",
                          isSelected ? "bg-muted/60" : "hover:bg-background/80",
                        )}
                      >
                        <span className="text-[0.8125rem] font-medium text-foreground truncate">{name}</span>
                        <span className="text-[0.8125rem] text-muted-foreground truncate">{company}</span>
                        <div>
                          <span>
                            <DesignLabStaticTag colors={TYPE_TAG_COLORS[row.type] || DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}>
                            {TYPE_LABELS[row.type] || row.type}
                            </DesignLabStaticTag>
                          </span>
                        </div>
                        <div>
                          <DesignLabStaticTag colors={STATUS_TAG_COLORS[availability.statusKey] || DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}>
                            {availability.label}
                          </DesignLabStaticTag>
                        </div>
                        <div className="flex flex-nowrap overflow-hidden items-center gap-1">
                          {(row.teknologier || []).slice(0, 2).map((t: string) => (
                            <DesignLabStaticTag key={t} colors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}>{t}</DesignLabStaticTag>
                          ))}
                          {(row.teknologier || []).length > 2 && (
                            <span className="text-[0.6875rem] text-muted-foreground flex-shrink-0">+{row.teknologier.length - 2}</span>
                          )}
                        </div>
                        <span className="text-[0.8125rem] text-muted-foreground">
                          {relativeFutureDate(row.tilgjengelig_fra)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {filtered.length === 0 && (
                  <p className="text-muted-foreground text-center py-12">Ingen eksterne konsulenter å vise</p>
                )}
              </div>
            </ResizablePanel>

            <ResizableHandle
              withHandle
              className="bg-transparent hover:bg-[rgba(0,0,0,0.04)] transition-colors data-[resize-handle-active]:bg-[rgba(94,106,210,0.12)]"
            />

            <ResizablePanel defaultSize={60} minSize={34}>
              {selectedRow ? (
                <div
                  className="h-full flex flex-col"
                  style={{ background: C.panel, borderLeft: `1px solid ${C.borderLight}` }}
                >
                  <div
                    className="shrink-0 flex items-center justify-end px-4"
                    style={{ height: 32 }}
                  >
                    <DesignLabIconButton onClick={() => setSelectedId(null)} title="Lukk panel">
                      <X style={{ width: 16, height: 16 }} />
                    </DesignLabIconButton>
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 py-5 dl-v8-theme">
                    <ExternalConsultantDetailCard
                      row={selectedRow}
                      onEdit={() => openEdit(selectedRow)}
                    />
                  </div>
                </div>
              ) : (
                <div
                  className="flex h-full items-center justify-center"
                  style={{ borderLeft: `1px solid ${C.borderLight}`, background: C.appBg }}
                >
                  <p style={{ fontSize: 13, color: C.textFaint }}>
                    Trykk ⌘K for å søke.
                  </p>
                </div>
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-card shadow-card">
          <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_100px_110px_minmax(0,1.5fr)_100px] gap-3 px-4 py-2.5 border-b border-border bg-background">
            {["NAVN", "SELSKAP", "TYPE", "STATUS", "TEKNOLOGIER", "TILGJ. FRA"].map(h => (
              <span key={h} className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">{h}</span>
            ))}
          </div>
          <div className="divide-y divide-border">
            {filtered.map((row: any) => {
              const name = (row as any).navn || "—";
              const company = row.companies?.name || (row as any).selskap_tekst || "—";
              const availability = getExternalAvailabilityMeta(row.tilgjengelig_fra);
              return (
                <div
                  key={row.id}
                  onClick={() => openEdit(row)}
                  className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_100px_110px_minmax(0,1.5fr)_100px] gap-3 items-center px-4 min-h-[44px] py-2 hover:bg-background/80 transition-colors duration-75 cursor-pointer"
                >
                  <span className="text-[0.8125rem] font-medium text-foreground truncate">{name}</span>
                  <span className="text-[0.8125rem] text-muted-foreground truncate">{company}</span>
                  <div>
                    <DesignLabStaticTag colors={TYPE_TAG_COLORS[row.type] || DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}>
                      {TYPE_LABELS[row.type] || row.type}
                    </DesignLabStaticTag>
                  </div>
                  <div>
                    <DesignLabStaticTag colors={STATUS_TAG_COLORS[availability.statusKey] || DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}>
                      {availability.label}
                    </DesignLabStaticTag>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(row.teknologier || []).slice(0, 3).map((t: string) => (
                      <DesignLabStaticTag key={t} colors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}>{t}</DesignLabStaticTag>
                    ))}
                    {(row.teknologier || []).length > 3 && (
                      <span className="text-[0.6875rem] text-muted-foreground">+{row.teknologier.length - 3}</span>
                    )}
                  </div>
                  <span className="text-[0.8125rem] text-muted-foreground">
                    {relativeFutureDate(row.tilgjengelig_fra)}
                  </span>
                </div>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <p className="text-muted-foreground text-center py-12">Ingen eksterne konsulenter å vise</p>
          )}
        </div>
      )}

      {/* Modal */}
      <ConsultantModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editRow={editId ? rows.find((r: any) => r.id === editId) : null}
        userId={user?.id}
      />

      <AlertDialog open={cleanupOpen} onOpenChange={setCleanupOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rydd eksterne konsulenter?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette fjerner åpenbare dubletter og eksterne kandidater som matcher ansatte. Rader som allerede er koblet til en forespørsel blir hoppet over.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cleanupRunning}>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleCleanup} disabled={cleanupRunning}>
              {cleanupRunning ? "Rydder..." : "Ja, rydd nå"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {embeddedSplit && (
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
      )}
    </div>
  );
}

export function ExternalConsultantDetailCard({
  row,
  onEdit,
}: {
  row: any;
  onEdit: () => void;
}) {
  const consultantName = (row as any).navn || "Ukjent konsulent";
  const companyName = row.companies?.name || (row as any).selskap_tekst || "Ikke koblet til selskap";
  const technologies = Array.isArray(row.teknologier) ? row.teknologier : [];
  const note = (row as any).notat || "";
  const availability = getExternalAvailabilityMeta(row.tilgjengelig_fra);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2
            className="truncate"
            style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.2, color: C.text }}
          >
            {consultantName}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2" style={{ fontSize: 13, color: C.textMuted }}>
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              {companyName}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DesignLabStaticTag colors={TYPE_TAG_COLORS[row.type] || DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}>
            {TYPE_LABELS[row.type] || row.type}
          </DesignLabStaticTag>
          <DesignLabStaticTag colors={STATUS_TAG_COLORS[availability.statusKey] || DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}>
            {availability.label}
          </DesignLabStaticTag>
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 transition-colors"
            style={{
              height: 28,
              paddingInline: 10,
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: "transparent",
              color: C.textMuted,
            }}
          >
            <Pencil style={{ width: 12, height: 12 }} />
            Rediger
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-[13px] font-medium text-[#1A1C1F]">Kontakt</h3>
          <div className="space-y-1.5" style={{ fontSize: 13, color: C.text }}>
            {row.epost ? (
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5" style={{ color: C.textFaint }} />
                <span>{row.epost}</span>
              </div>
            ) : null}
            {row.telefon ? (
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" style={{ color: C.textFaint }} />
                <span>{row.telefon}</span>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <Clock3 className="h-3.5 w-3.5" style={{ color: C.textFaint }} />
              <span>{relativeFutureDate(row.tilgjengelig_fra)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-[13px] font-medium text-[#1A1C1F]">Teknologier</h3>
          {technologies.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {technologies.map((tech: string) => (
                <DesignLabStaticTag key={tech} colors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}>
                  {tech}
                </DesignLabStaticTag>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: C.textFaint }}>Ingen teknologier lagt til ennå.</p>
          )}
        </div>
      </div>

      {note ? (
        <div className="space-y-2">
          <h3 className="text-[13px] font-medium text-[#1A1C1F]">Kommentar</h3>
          <div
            className="rounded-md px-3 py-2.5"
            style={{ border: `1px solid ${C.borderLight}`, background: C.appBg }}
          >
            <p
              className="whitespace-pre-wrap"
              style={{ fontSize: 13, lineHeight: 1.5, color: C.text }}
            >
              {note}
            </p>
          </div>
        </div>
      ) : null}

      {technologies.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-[13px] font-medium text-[#1A1C1F]">Oppdragsmatch</h3>
          <div
            className="rounded-md px-3 py-3"
            style={{ border: `1px solid ${C.borderLight}`, background: C.appBg }}
          >
            <OppdragsMatchPanel
              konsulent={{
                navn: consultantName,
                teknologier: technologies,
                cv_tekst: (row as any).cv_tekst || null,
                ekstern_id: row.id,
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ─── Modal ─── */

interface ConsultantForm {
  type: string;
  navn: string;
  epost: string;
  telefon: string;
  company_id: string;
  selskap_tekst: string;
  teknologier: string[];
  status: string;
  tilgjengelig_fra: string;
  cv_tekst: string;
  kommentar: string;
}

const emptyForm: ConsultantForm = {
  type: "", navn: "", epost: "", telefon: "",
  company_id: "", selskap_tekst: "",
  teknologier: [], status: "ledig",
  tilgjengelig_fra: "", cv_tekst: "",
  kommentar: "",
};

export function ConsultantModal({ open, onClose, editRow, userId }: {
  open: boolean;
  onClose: () => void;
  editRow: any | null;
  userId?: string;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [cvParsing, setCvParsing] = useState(false);
  const [cvPrefilled, setCvPrefilled] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const isCreate = !editRow;

  const [form, setForm] = useState<ConsultantForm>({ ...emptyForm });
  const [lastId, setLastId] = useState<string | null>(null);

  if (open && (editRow?.id ?? null) !== lastId) {
    setLastId(editRow?.id ?? null);
    setTagInput("");
    setCompanySearch("");
    setCvPrefilled(new Set());
    setCvParsing(false);
    if (editRow) {
      setForm({
        type: editRow.type || "freelance",
        navn: (editRow as any).navn || "",
        epost: (editRow as any).epost || "",
        telefon: (editRow as any).telefon || "",
        company_id: editRow.company_id || "",
        selskap_tekst: (editRow as any).selskap_tekst || "",
        teknologier: editRow.teknologier || [],
        status: editRow.status || "ledig",
        tilgjengelig_fra: editRow.tilgjengelig_fra || "",
        cv_tekst: (editRow as any).cv_tekst || "",
        kommentar: (editRow as any).notat || "",
      });
    } else {
      setForm({ ...emptyForm });
    }
  }

  const set = (key: keyof ConsultantForm, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  // Company search for partner type
  const { data: companies = [] } = useQuery({
    queryKey: ["companies-for-ext"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name").order("name");
      return data || [];
    },
  });

  const filteredCompanies = companySearch.trim()
    ? companies.filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase())).slice(0, 8)
    : companies.slice(0, 8);

  const selectedCompany = companies.find(c => c.id === form.company_id);

  // Tag input
  const addTag = (tag: string) => {
    const normalized = normalizeTechnologyTags(tag);
    if (normalized.length > 0) {
      set("teknologier", normalizeTechnologyTags([...form.teknologier, ...normalized]));
    }
    setTagInput("");
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  // CV Upload & Parse
  const handleCvUpload = useCallback(async (file: File) => {
    if (!file || file.type !== "application/pdf") {
      toast.error("Kun PDF-filer støttes");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Filen er for stor (maks 10 MB)");
      return;
    }

    setCvParsing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      const { data, error } = await supabase.functions.invoke("extract-cv-contact", {
        body: { base64, filename: file.name },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const prefilled = new Set<string>();

      if (data.name && !form.navn) {
        set("navn", data.name);
        prefilled.add("navn");
      }
      if (data.email && !form.epost) {
        set("epost", data.email);
        prefilled.add("epost");
      }
      if (data.phone && !form.telefon) {
        set("telefon", data.phone);
        prefilled.add("telefon");
      }
      if (data.technologies?.length && form.teknologier.length === 0) {
        set("teknologier", normalizeTechnologyTags(data.technologies));
        prefilled.add("teknologier");
      }

      // Store raw CV text placeholder (the base64 is too large, but we mark it)
      set("cv_tekst", `[CV: ${file.name}]`);

      setCvPrefilled(prefilled);
      toast.success("CV analysert — felter fylt ut");
    } catch (err: any) {
      console.error("CV parsing error:", err);
      toast.error(err.message || "Kunne ikke analysere CV");
    } finally {
      setCvParsing(false);
    }
  }, [form.navn, form.epost, form.telefon, form.teknologier.length]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleCvUpload(file);
  }, [handleCvUpload]);

  const handleSave = async () => {
    if (!form.navn.trim()) { toast.error("Navn er påkrevd"); return; }
    if (form.type === "partner" && !form.company_id) { toast.error("Velg partnerselskap"); return; }

    setSaving(true);
    const availability = getExternalAvailabilityMeta(form.tilgjengelig_fra || null);
    const payload: any = {
      type: form.type,
      navn: form.navn.trim(),
      epost: form.epost.trim() || null,
      telefon: form.telefon.trim() || null,
      company_id: form.type === "partner" ? (form.company_id || null) : null,
      selskap_tekst: form.type === "freelance" ? (form.selskap_tekst.trim() || null) : null,
      teknologier: normalizeTechnologyTags(form.teknologier),
      status: availability.statusKey,
      tilgjengelig_fra: form.tilgjengelig_fra || null,
      cv_tekst: form.cv_tekst || null,
      notat: form.kommentar.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (isCreate) {
      ({ error } = await supabase.from("external_consultants").insert(payload));
    } else {
      ({ error } = await supabase.from("external_consultants").update(payload).eq("id", editRow.id));
    }
    setSaving(false);
    if (error) { toast.error("Kunne ikke lagre"); return; }
    toast.success(isCreate ? "Ekstern konsulent lagt til" : "Oppdatert");
    queryClient.invalidateQueries({ queryKey: ["external-consultants"] });
    onClose();
  };

  const handleDelete = () => setShowDeleteConfirm(true);

  const handleConfirmDelete = async () => {
    if (!editRow) return;
    const { error } = await supabase.from("external_consultants").delete().eq("id", editRow.id);
    if (error) { toast.error("Kunne ikke slette"); return; }
    toast.success("Slettet");
    queryClient.invalidateQueries({ queryKey: ["external-consultants"] });
    onClose();
  };

  const LABEL = "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";
  const showTypeSelection = isCreate && !form.type;

  const CvBadge = ({ field }: { field: string }) =>
    cvPrefilled.has(field) ? (
      <span className="inline-flex items-center gap-1 text-[0.6875rem] text-emerald-600 font-medium ml-2">
        <CheckCircle2 className="h-3 w-3" /> Hentet fra CV
      </span>
    ) : null;

  return (
    <>
      <DesignLabEntitySheet
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onClose();
        }}
        contentClassName="px-6 py-6"
      >
        <h2 className="text-[1.125rem] font-bold text-foreground mb-5">
          {isCreate ? "Ny ekstern konsulent" : "Rediger konsulent"}
        </h2>

        {/* STEP 1: Type selection (create only) */}
        {showTypeSelection && (
          <div className="space-y-3">
            <p className="text-[0.8125rem] text-muted-foreground">Velg type:</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => set("type", "freelance")}
                className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-center"
              >
                <User className="h-7 w-7 text-primary" />
                <span className="text-[0.9375rem] font-semibold">Freelance</span>
                <span className="text-[0.75rem] text-muted-foreground leading-snug">Selvstendig konsulent</span>
              </button>
              <button
                onClick={() => set("type", "partner")}
                className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-center"
              >
                <Users className="h-7 w-7 text-primary" />
                <span className="text-[0.9375rem] font-semibold">Via partner</span>
                <span className="text-[0.75rem] text-muted-foreground leading-snug">Kommer via et partnerselskap</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Fields (after type selected or edit mode) */}
        {(form.type || !isCreate) && (
          <div className="space-y-4">
            {/* Type toggle (always shown in edit, hidden in create until type selected via step 1) */}
            {!isCreate && (
              <div>
                <label className={LABEL}>Type</label>
                <div className="flex gap-2 mt-1">
                  <DesignLabFilterButton
                    type="button"
                    onClick={() => { set("type", "freelance"); set("company_id", ""); }}
                    active={form.type === "freelance"}
                    activeColors={DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS}
                    inactiveColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}
                    inactiveHoverColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_HOVER_COLORS}
                  >
                    Freelance
                  </DesignLabFilterButton>
                  <DesignLabFilterButton
                    type="button"
                    onClick={() => set("type", "partner")}
                    active={form.type === "partner"}
                    activeColors={DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS}
                    inactiveColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}
                    inactiveHoverColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_HOVER_COLORS}
                  >
                    Via partner
                  </DesignLabFilterButton>
                </div>
              </div>
            )}

            {/* Partner: Company picker */}
            {form.type === "partner" && (
              <div>
                <label className={LABEL}>Partnerselskap *</label>
                {selectedCompany ? (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[0.875rem] font-medium">{selectedCompany.name}</span>
                    <button onClick={() => set("company_id", "")} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <div className="mt-1">
                    <Input
                      value={companySearch}
                      onChange={e => setCompanySearch(e.target.value)}
                      placeholder="Søk selskaper..."
                      className="text-[0.875rem]"
                    />
                    {companySearch.trim() && filteredCompanies.length > 0 && (
                      <div className="border border-border rounded-lg mt-1 max-h-40 overflow-y-auto bg-popover">
                        {filteredCompanies.map(c => (
                          <button
                            key={c.id}
                            onClick={() => { set("company_id", c.id); setCompanySearch(""); }}
                            className="w-full text-left px-3 py-2 text-[0.8125rem] hover:bg-secondary transition-colors"
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Freelance: free-text selskap */}
            {form.type === "freelance" && (
              <div>
                <label className={LABEL}>Selskap</label>
                <Input value={form.selskap_tekst} onChange={e => set("selskap_tekst", e.target.value)} placeholder="Eget enkeltpersonforetak e.l." className="mt-1 text-[0.875rem]" />
                <p className="text-[0.6875rem] text-muted-foreground mt-1">Ikke et salgsselskap i CRM</p>
              </div>
            )}

            {/* CV Upload */}
            <div>
              <label className={LABEL}>CV-opplasting</label>
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "mt-1 flex flex-col items-center gap-2 p-5 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
                  cvParsing
                    ? "border-primary/40 bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-primary/5"
                )}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleCvUpload(file);
                    e.target.value = "";
                  }}
                />
                {cvParsing ? (
                  <>
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                    <span className="text-[0.8125rem] text-primary font-medium">Analyserer CV...</span>
                  </>
                ) : cvPrefilled.size > 0 ? (
                  <>
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    <span className="text-[0.8125rem] text-emerald-600 font-medium">CV analysert</span>
                    <span className="text-[0.6875rem] text-muted-foreground">Klikk for å laste opp ny</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-[0.8125rem] text-muted-foreground">Dra og slipp PDF, eller klikk for å velge</span>
                  </>
                )}
              </div>
            </div>

            {/* Navn */}
            <div>
              <div className="flex items-center">
                <label className={LABEL}>Navn *</label>
                <CvBadge field="navn" />
              </div>
              <Input value={form.navn} onChange={e => set("navn", e.target.value)} placeholder="Fullt navn" className="mt-1 text-[0.875rem]" />
            </div>

            {/* Epost */}
            <div>
              <div className="flex items-center">
                <label className={LABEL}>E-post</label>
                <CvBadge field="epost" />
              </div>
              <Input value={form.epost} onChange={e => set("epost", e.target.value)} placeholder="epost@eksempel.no" className="mt-1 text-[0.875rem]" />
            </div>

            {/* Telefon */}
            <div>
              <div className="flex items-center">
                <label className={LABEL}>Telefon</label>
                <CvBadge field="telefon" />
              </div>
              <Input value={form.telefon} onChange={e => set("telefon", e.target.value)} placeholder="+47 ..." className="mt-1 text-[0.875rem]" />
            </div>


            {/* Teknologier */}
            <div>
              <div className="flex items-center">
                <label className={LABEL}>Teknologier</label>
                <CvBadge field="teknologier" />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 p-2 border border-border rounded-lg bg-background min-h-[38px]">
                {form.teknologier.map(t => (
                  <DesignLabStaticTag key={t} colors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS} className="gap-1">
                    {t}
                    <button type="button" onClick={() => set("teknologier", form.teknologier.filter(x => x !== t))} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                  </DesignLabStaticTag>
                ))}
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder={form.teknologier.length === 0 ? "Legg til teknologi..." : ""}
                  className="flex-1 min-w-[100px] bg-transparent outline-none text-[0.8125rem] placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {SUGGESTED_TECH.filter(s => !form.teknologier.includes(s)).slice(0, 10).map(s => (
                  <DesignLabFilterButton
                    key={s}
                    type="button"
                    onClick={() => addTag(s)}
                    active={false}
                    activeColors={DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS}
                    inactiveColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS}
                    inactiveHoverColors={DESIGN_LAB_NEUTRAL_TAG_INACTIVE_HOVER_COLORS}
                  >
                    {s}
                  </DesignLabFilterButton>
                ))}
              </div>
            </div>

            {/* Oppdragsmatch — only in edit mode */}
            {!isCreate && form.teknologier.length > 0 && (
              <div className="pt-2 border-t border-border">
                <OppdragsMatchPanel
                  konsulent={{
                    navn: form.navn,
                    teknologier: form.teknologier,
                    cv_tekst: form.cv_tekst || null,
                    ekstern_id: editRow?.id,
                  }}
                />
              </div>
            )}

            {/* Tilgjengelig fra */}
            <div>
              <label className={LABEL}>Tilgjengelig fra</label>
              <p className="mt-1 text-[0.75rem] text-muted-foreground">
                Tilgjengelig-badge vises automatisk fra denne datoen og i {AVAILABILITY_WINDOW_DAYS} dager.
              </p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("mt-2 w-full justify-start text-left text-[0.875rem] font-normal", !form.tilgjengelig_fra && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.tilgjengelig_fra ? format(new Date(form.tilgjengelig_fra), "d. MMM yyyy", { locale: nb }) : "Velg dato"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.tilgjengelig_fra ? new Date(form.tilgjengelig_fra) : undefined}
                    onSelect={(d) => set("tilgjengelig_fra", d ? format(d, "yyyy-MM-dd") : "")}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Kommentar */}
            <div>
              <label className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">Kommentar</label>
              <textarea
                value={form.kommentar}
                onChange={(e) => set("kommentar", e.target.value)}
                rows={3}
                placeholder="Notater om konsulenten, kilde, hvordan dere kom i kontakt..."
                className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-[0.875rem] ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>
        )}

        {/* Footer */}
        {(form.type || !isCreate) && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
            <div>
              {!isCreate && (
                <button onClick={handleDelete} className="text-[0.8125rem] text-destructive hover:underline">
                  Slett
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors">
                Avbryt
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? "Lagrer..." : isCreate ? "Legg til" : "Lagre"}
              </button>
            </div>
          </div>
        )}
      </DesignLabEntitySheet>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slett konsulent?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil permanent slette {form.navn || "denne konsulenten"} fra Eksterne konsulenter. Handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ja, slett
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   ExternalCommandPalette (V2 only) — ⌘K søk på Eksterne
   ───────────────────────────────────────────────────────────── */

interface ExternalCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  textSize: TextSize;
  rows: any[];
  onSelect: (id: string) => void;
}

export function ExternalCommandPalette({ open, onClose, textSize, rows, onSelect }: ExternalCommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const items = useMemo(() => {
    const q = query.toLowerCase().trim();
    const matched = rows.filter((r: any) => {
      if (!q) return true;
      const name = (r.navn || "").toLowerCase();
      const company = (r.companies?.name || r.selskap_tekst || "").toLowerCase();
      const tech = (r.teknologier || []).join(" ").toLowerCase();
      return name.includes(q) || company.includes(q) || tech.includes(q);
    });
    return matched.slice(0, 12);
  }, [query, rows]);

  useEffect(() => {
    setActiveIdx((prev) => Math.min(prev, Math.max(0, items.length - 1)));
  }, [items.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setActiveIdx((p) => Math.min(p + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setActiveIdx((p) => Math.max(p - 1, 0));
      } else if (e.key === "Enter" && items[activeIdx]) {
        e.preventDefault();
        e.stopPropagation();
        onSelect(items[activeIdx].id);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    },
    [items, activeIdx, onSelect, onClose],
  );

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  if (!open) return null;

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.10)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          position: "fixed",
          top: "18vh",
          left: "50%",
          transform: "translateX(-50%)",
          width: 560,
          maxHeight: 420,
          background: "#FFFFFF",
          border: "1px solid #E2E4E9",
          borderRadius: 10,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.10), 0 24px 48px rgba(0,0,0,0.06)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          ...getDesignLabTextSizeStyle(textSize),
        }}
      >
        <div style={{ position: "relative", height: 44, borderBottom: "1px solid #EAECEF" }}>
          <Search
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              width: 15,
              height: 15,
              color: "#B0B7C3",
            }}
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            placeholder="Søk navn, selskap eller teknologi..."
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 13,
              fontWeight: 400,
              color: "#1A1C1F",
              fontFamily: "inherit",
              padding: "0 14px 0 40px",
            }}
          />
        </div>

        <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "4px 0 0" }}>
          {items.length === 0 ? (
            <div style={{ padding: "24px 16px", fontSize: 13, color: "#8C929C" }}>
              Ingen resultater for «{query}»
            </div>
          ) : (
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#8C929C",
                  padding: "8px 12px 4px",
                }}
              >
                Eksterne konsulenter
              </div>
              {items.map((row: any, idx: number) => {
                const isActive = idx === activeIdx;
                const company = row.companies?.name || row.selskap_tekst || "";
                return (
                  <div
                    key={row.id}
                    data-idx={idx}
                    onClick={() => onSelect(row.id)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    style={{
                      height: 28,
                      padding: "0 8px",
                      margin: "1px 6px",
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      fontWeight: 400,
                      color: "#1A1C1F",
                      cursor: "pointer",
                      background: isActive ? "#F3F5F9" : "#FFFFFF",
                      transition: "background 120ms ease",
                    }}
                  >
                    <User
                      style={{
                        width: 14,
                        height: 14,
                        color: isActive ? "#8C929C" : "#C1C7D0",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.navn || "—"}
                    </span>
                    {company && (
                      <span
                        style={{
                          fontSize: 11,
                          color: isActive ? "#6B7280" : "#8C929C",
                          marginLeft: "auto",
                          flexShrink: 0,
                        }}
                      >
                        {company}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
