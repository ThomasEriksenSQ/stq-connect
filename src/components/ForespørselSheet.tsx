import { useState, useEffect, useRef, useMemo } from "react";
import { X, Pencil, Trash2, Sparkles, Loader2, ChevronDown, Plus, Target } from "lucide-react";
import { relativeDate, fullDate } from "@/lib/relativeDate";
import { relativeTime } from "@/lib/relativeDate";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getInitials, cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { format, parseISO } from "date-fns";
import { nb } from "date-fns/locale";

const LABEL = "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

const PIPELINE_CONFIG: Record<string, { label: string; dot: string; badge: string; step: number | null }> = {
  sendt_cv:  { label: "Sendt CV", dot: "bg-amber-400", badge: "bg-amber-50 text-amber-700 border-amber-200", step: 1 },
  intervju:  { label: "Intervju", dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700 border-blue-200", step: 2 },
  vunnet:    { label: "Vunnet 🎉", dot: "bg-green-500", badge: "bg-green-50 text-green-700 border-green-200", step: 3 },
  avslag:    { label: "Avslag", dot: "bg-red-400", badge: "bg-red-50 text-red-600 border-red-200", step: null },
  bortfalt:  { label: "Bortfalt", dot: "bg-gray-400", badge: "bg-gray-50 text-gray-500 border-gray-200", step: null },
};

const PIPELINE_BORDER_MAP: Record<string, string> = {
  sendt_cv: "border-l-amber-400",
  intervju: "border-l-blue-500",
  vunnet: "border-l-green-500",
  avslag: "border-l-red-400",
  bortfalt: "border-l-gray-400",
};

interface MatchResult {
  id: number | string;
  navn: string;
  type: "intern" | "ekstern";
  score: number;
  begrunnelse: string;
  match_tags: string[];
}

/* ─── Delete button with inline confirmation ─── */

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming)
    return (
      <button
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground hover:text-destructive transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Slett forespørsel
      </button>
    );

  return (
    <div className="flex items-center gap-3">
      <span className="text-[0.8125rem] text-foreground font-medium">Er du sikker?</span>
      <button
        onClick={onConfirm}
        className="text-[0.8125rem] text-destructive font-medium hover:underline"
      >
        Ja, slett
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="text-[0.8125rem] text-muted-foreground hover:text-foreground"
      >
        Avbryt
      </button>
    </div>
  );
}

/* ─── Score dot color ─── */
function ScoreDot({ score }: { score: number }) {
  const color = score >= 8 ? "bg-emerald-500" : score >= 6 ? "bg-amber-500" : "bg-red-500";
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full", color)} />;
}

/* ─── Missing Contact Banner ─── */

function MissingContactBanner({ row }: { row: any }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = (q: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim() || !row.selskap_id) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, title")
        .eq("company_id", row.selskap_id)
        .ilike("first_name", `%${q}%`)
        .limit(8);
      setResults(data || []);
    }, 250);
  };

  const selectContact = async (c: any) => {
    await supabase.from("foresporsler").update({
      kontakt_id: c.id,
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
    queryClient.invalidateQueries({ queryKey: ["foresporsler-list"] });
    toast.success(`Kontakt ${c.first_name} ${c.last_name} koblet til`);
    setSearch("");
    setShowDropdown(false);
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-2">
      <p className="text-[0.8125rem] text-amber-800">
        ⚠️ Denne forespørselen mangler kontakt — legg til en kontakt for å holde CRM oppdatert
      </p>
      {row.selskap_id && (
        <div className="relative">
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); doSearch(e.target.value); }}
            onFocus={() => { setShowDropdown(true); if (search) doSearch(search); }}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            placeholder="Søk etter kontakt..."
            className="text-[0.8125rem] h-8 bg-white"
          />
          {showDropdown && results.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-md max-h-[160px] overflow-y-auto">
              {results.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => selectContact(c)}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
                >
                  <p className="text-[0.8125rem] font-medium">{c.first_name} {c.last_name}</p>
                  {c.title && <p className="text-[0.6875rem] text-muted-foreground">{c.title}</p>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ForespørselSheet({
  row,
  onClose,
  onExpandChange,
}: {
  row: any;
  onClose: () => void;
  onExpandChange?: (expanded: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [mottattDato, setMottattDato] = useState("");
  const [sted, setSted] = useState("");
  const [avdeling, setAvdeling] = useState("");
  const [fristDato, setFristDato] = useState("");
  const [type, setType] = useState("");
  const [teknologier, setTeknologier] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [kommentar, setKommentar] = useState(row?.kommentar || "");
  const [sluttkunde, setSluttkunde] = useState("");
  const [status, setStatus] = useState("");
  const [editingKommentar, setEditingKommentar] = useState(false);
  const kommentarRef = useRef<HTMLTextAreaElement>(null);

  // Company/contact search state
  const [selskapNavn, setSelskapNavn] = useState("");
  const [selskapId, setSelskapId] = useState<string | null>(null);
  const [companyResults, setCompanyResults] = useState<any[]>([]);
  const [showSelskapDropdown, setShowSelskapDropdown] = useState(false);
  const [kontakt, setKontakt] = useState("");
  const [kontaktId, setKontaktId] = useState<string | null>(null);
  const [showKontaktDropdown, setShowKontaktDropdown] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Match state
  const [matching, setMatching] = useState(false);
  const [matchResults, setMatchResults] = useState<MatchResult[] | null>(null);
  const [matchSourceFilter, setMatchSourceFilter] = useState<"Alle" | "Ansatte" | "Eksterne">("Alle");

  // Linked consultants (both intern and ekstern)
  const { data: linkedKonsulenter = [], refetch: refetchLinked } = useQuery({
    queryKey: ["foresporsler-konsulenter", row?.id],
    enabled: !!row?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("foresporsler_konsulenter")
        .select("id, ansatt_id, ekstern_id, konsulent_type, created_at, status, status_updated_at, stacq_ansatte(id, navn), external_consultants(id, navn, type)")
        .eq("foresporsler_id", row.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Contacts for selected company
  const { data: companyContacts = [] } = useQuery({
    queryKey: ["foresporsler-edit-kontakter", selskapId],
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, title")
        .eq("company_id", selskapId!)
        .order("first_name");
      return data || [];
    },
    enabled: !!selskapId,
  });

  const filteredContacts = useMemo(() => {
    if (!kontakt.trim()) return companyContacts;
    const q = kontakt.toLowerCase();
    return (companyContacts as any[]).filter(c =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q)
    );
  }, [companyContacts, kontakt]);

  // Derived expanded state
  const showMatch = matching || (matchResults !== null && matchResults.length > 0);

  // Notify parent of expand state
  useEffect(() => {
    onExpandChange?.(showMatch);
  }, [showMatch, onExpandChange]);

  // Reset match when row changes
  useEffect(() => {
    setMatchResults(null);
    setMatching(false);
    setEditMode(false);
    setEditingKommentar(false);
    setKommentar(row?.kommentar || "");
  }, [row?.id]);

  // Sync form when entering edit mode
  useEffect(() => {
    if (editMode && row) {
      setMottattDato(row.mottatt_dato || "");
      setSelskapNavn(row.selskap_navn || "");
      setSelskapId(row.selskap_id || null);
      setKontakt(row.contacts ? `${row.contacts.first_name} ${row.contacts.last_name}` : "");
      setKontaktId(row.kontakt_id || null);
      setCompanyResults([]);
      setShowSelskapDropdown(false);
      setShowKontaktDropdown(false);
      setSted(row.sted || "");
      setAvdeling(row.avdeling || "");
      setFristDato(row.frist_dato || "");
      setType(row.type || "DIR");
      setTeknologier(row.teknologier || []);
      setKommentar(row.kommentar || "");
      setSluttkunde(row.sluttkunde || "");
      setStatus(row.status || "Ny");
      setTagInput("");
    }
  }, [editMode, row]);

  const searchCompanies = (query: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.length < 1) { setCompanyResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name, city, status")
        .ilike("name", `%${query}%`)
        .limit(8);
      if (data) setCompanyResults(data);
    }, 300);
  };

  const selectCompany = (c: any) => {
    setSelskapNavn(c.name);
    setSelskapId(c.id);
    setSted(c.city?.split(",")[0]?.trim() || "");
    setKontakt("");
    setKontaktId(null);
    setShowSelskapDropdown(false);
    setCompanyResults([]);
  };

  const isPartner = companyResults.find(c => c.id === selskapId)?.status === "partner"
    || row?.type === "VIA"
    || row?.type === "via_partner"
    || row?.type === "via_megler";

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !teknologier.includes(t)) setTeknologier([...teknologier, t]);
    setTagInput("");
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  const handleSave = async () => {
    if (!row || saving) return;
    setSaving(true);
    const { error } = await supabase
      .from("foresporsler")
      .update({
        selskap_navn: selskapNavn || row.selskap_navn,
        selskap_id: selskapId || row.selskap_id,
        kontakt_id: kontaktId,
        mottatt_dato: mottattDato || row.mottatt_dato,
        sted: sted || null,
        avdeling: avdeling || null,
        frist_dato: fristDato || null,
        type: isPartner ? "VIA" : "DIR",
        teknologier,
        kommentar: kommentar || null,
        sluttkunde: sluttkunde || null,
        status: status || row.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    setSaving(false);
    if (error) { toast.error("Kunne ikke oppdatere"); return; }
    toast.success("Forespørsel oppdatert");
    queryClient.invalidateQueries({ queryKey: ["foresporsler-list"] });
    setEditMode(false);
  };

  const handleDelete = async () => {
    if (!row) return;
    const { error } = await supabase.from("foresporsler").delete().eq("id", row.id);
    if (error) { toast.error("Kunne ikke slette"); return; }
    toast.success("Forespørsel slettet");
    queryClient.invalidateQueries({ queryKey: ["foresporsler-list"] });
    onClose();
  };

  const handleAddKonsulent = async (ansattId: number) => {
    await supabase.from("foresporsler_konsulenter").insert({
      foresporsler_id: row.id,
      ansatt_id: ansattId,
      konsulent_type: "intern",
    });
    queryClient.invalidateQueries({ queryKey: ["foresporsler-list"] });
    queryClient.invalidateQueries({ queryKey: ["foresporsler-konsulenter", row.id] });
  };

  const handleAddEkstern = async (eksternId: string) => {
    await supabase.from("foresporsler_konsulenter").insert({
      foresporsler_id: row.id,
      ekstern_id: eksternId,
      konsulent_type: "ekstern",
    });
    queryClient.invalidateQueries({ queryKey: ["foresporsler-list"] });
    queryClient.invalidateQueries({ queryKey: ["foresporsler-konsulenter", row.id] });
  };

  const handleRemoveKonsulent = async (linkId: string) => {
    await supabase.from("foresporsler_konsulenter").delete().eq("id", linkId);
    queryClient.invalidateQueries({ queryKey: ["foresporsler-list"] });
    queryClient.invalidateQueries({ queryKey: ["foresporsler-konsulenter", row.id] });
  };

  const fireConfetti = () => {
    import("canvas-confetti").then(({ default: confetti }) => {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ["#22c55e", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6"] });
      setTimeout(() => {
        confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0 }, colors: ["#22c55e", "#f59e0b"] });
        confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1 }, colors: ["#3b82f6", "#8b5cf6"] });
      }, 300);
    });
  };

  const updateKonsulentStatus = async (linkId: string, newStatus: string) => {
    await supabase
      .from("foresporsler_konsulenter")
      .update({ status: newStatus, status_updated_at: new Date().toISOString() })
      .eq("id", linkId);
    if (newStatus === "vunnet") fireConfetti();
    queryClient.invalidateQueries({ queryKey: ["foresporsler-konsulenter", row.id] });
    queryClient.invalidateQueries({ queryKey: ["foresporsler-list"] });
  };

  // Save kommentar inline
  const saveKommentar = async () => {
    setEditingKommentar(false);
    if (kommentar === (row?.kommentar || "")) return;
    await supabase
      .from("foresporsler")
      .update({ kommentar: kommentar || null, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    queryClient.invalidateQueries({ queryKey: ["foresporsler-list"] });
  };

  // AI Match
  const runMatch = async () => {
    setMatching(true);
    setMatchResults(null);
    try {
      const [{ data: interne }, { data: eksterne }] = await Promise.all([
        supabase.from("stacq_ansatte").select("id, navn, kompetanse, geografi, status").in("status", ["AKTIV/SIGNERT", "Ledig"]),
        supabase.from("external_consultants").select("id, navn, teknologier, status").in("status", ["ledig", "aktiv"]),
      ]);

      const { data, error } = await supabase.functions.invoke("match-consultants", {
        body: {
          teknologier: row.teknologier || [],
          sted: row.sted || "",
          interne: interne || [],
          eksterne: eksterne || [],
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMatchResults(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Match error:", err);
      toast.error(err.message || "Kunne ikke kjøre matching");
      setMatchResults([]);
    } finally {
      setMatching(false);
    }
  };

  // Add from match result
  const addFromMatch = async (match: MatchResult) => {
    if (match.type === "intern") {
      await handleAddKonsulent(match.id as number);
      toast.success(`${match.navn} lagt til`);
    } else {
      await handleAddEkstern(match.id as string);
      toast.success(`${match.navn} (ekstern) lagt til`);
    }
  };

  const SUGGESTED_TAGS = ["C++", "C", "Embedded", "Yocto", "Linux", "Qt", "FPGA", "Python", "SPI/I2C", "MCU", "Embedded Linux", "Sikkerhet"];

  if (!row) return null;

  const contactName = row.contacts ? `${row.contacts.first_name} ${row.contacts.last_name}` : null;
  const alreadyLinkedIds = new Set([
    ...linkedKonsulenter.filter((k: any) => k.konsulent_type === "intern").map((k: any) => k.ansatt_id),
    ...linkedKonsulenter.filter((k: any) => k.konsulent_type === "ekstern").map((k: any) => k.ekstern_id),
  ]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[1.25rem] font-bold text-foreground truncate">
              {row.selskap_navn}
            </h2>
            <p className="text-[0.8125rem] text-muted-foreground mt-0.5">
              {row.sted || "Ukjent sted"}
              {row.avdeling && ` · ${row.avdeling}`}
            </p>
          </div>
          {!editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors shrink-0"
            >
              <Pencil className="h-3.5 w-3.5" />
              Rediger
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={cn("flex-1 overflow-hidden", editMode ? "overflow-y-auto px-6 py-5" : "")}>
        {editMode ? (
          /* ─── EDIT MODE ─── */
          <EditMode
            row={row}
            mottattDato={mottattDato}
            setMottattDato={setMottattDato}
            selskapNavn={selskapNavn}
            setSelskapNavn={setSelskapNavn}
            setSelskapId={setSelskapId}
            setShowSelskapDropdown={setShowSelskapDropdown}
            showSelskapDropdown={showSelskapDropdown}
            companyResults={companyResults}
            searchCompanies={searchCompanies}
            selectCompany={selectCompany}
            isPartner={isPartner}
            sluttkunde={sluttkunde}
            setSluttkunde={setSluttkunde}
            sted={sted}
            setSted={setSted}
            selskapId={selskapId}
            kontakt={kontakt}
            setKontakt={setKontakt}
            kontaktId={kontaktId}
            setKontaktId={setKontaktId}
            showKontaktDropdown={showKontaktDropdown}
            setShowKontaktDropdown={setShowKontaktDropdown}
            filteredContacts={filteredContacts}
            fristDato={fristDato}
            setFristDato={setFristDato}
            status={status}
            setStatus={setStatus}
            avdeling={avdeling}
            setAvdeling={setAvdeling}
            teknologier={teknologier}
            setTeknologier={setTeknologier}
            tagInput={tagInput}
            setTagInput={setTagInput}
            addTag={addTag}
            handleTagKeyDown={handleTagKeyDown}
            kommentar={kommentar}
            setKommentar={setKommentar}
          />
        ) : (
          /* ─── VIEW MODE ─── */
          <div className={cn("h-full", showMatch ? "flex" : "")}>
            {/* LEFT COLUMN */}
            <div className={cn(
              "overflow-y-auto py-5 px-6",
              showMatch ? "w-[320px] flex-shrink-0" : "flex-1"
            )}>
              <div className="space-y-5">
                {/* Missing contact warning */}
                {!row.kontakt_id && (
                  <MissingContactBanner row={row} />
                )}

                {/* Info row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className={LABEL}>Mottatt</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-[0.875rem] text-foreground mt-1 cursor-default">
                          {row.mottatt_dato ? relativeDate(row.mottatt_dato) : "—"}
                        </p>
                      </TooltipTrigger>
                      {row.mottatt_dato && <TooltipContent>{fullDate(row.mottatt_dato)}</TooltipContent>}
                    </Tooltip>
                  </div>
                  <div>
                    <p className={LABEL}>Kontakt</p>
                    <p className="text-[0.875rem] text-foreground mt-1">
                      {contactName || "—"}
                    </p>
                  </div>
                </div>


                {/* Teknologier */}
                <div>
                  <p className={LABEL}>Teknologier</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {(row.teknologier || []).length > 0 ? (
                      row.teknologier.map((t: string) => (
                        <span key={t} className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-[0.75rem] font-medium text-foreground">
                          {t}
                        </span>
                      ))
                    ) : (
                      <span className="text-[0.8125rem] text-muted-foreground">—</span>
                    )}
                  </div>
                </div>

                {/* Finn match button (only when no results yet) */}
                {!matchResults && !matching && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="h-4 w-4 text-primary" />
                      <p className={`${LABEL} mb-0`}>Konsulentmatch</p>
                    </div>
                    <button
                      onClick={runMatch}
                      disabled={!(row.teknologier?.length)}
                      className="inline-flex items-center gap-2 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      <Sparkles className="h-4 w-4" />
                      Finn match
                    </button>
                  </div>
                )}

                {/* No results message */}
                {matchResults && matchResults.length === 0 && !matching && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="h-4 w-4 text-primary" />
                      <p className={`${LABEL} mb-0`}>Konsulentmatch</p>
                    </div>
                    <p className="text-[0.8125rem] text-muted-foreground">Ingen treff med score ≥ 4</p>
                  </div>
                )}

                {/* ─── Sendt inn (pipeline) ─── */}
                <div>
                  <p className={`${LABEL} mb-2`}>Sendt inn ({linkedKonsulenter.length})</p>
                  <div className="space-y-2 mb-3">
                    {linkedKonsulenter.length === 0 && (
                      <p className="text-[0.8125rem] text-muted-foreground">
                        Ingen konsulenter sendt inn ennå
                      </p>
                    )}
                    {linkedKonsulenter.map((k: any) => {
                      const isIntern = k.konsulent_type === "intern";
                      const navn = isIntern ? k.stacq_ansatte?.navn : k.external_consultants?.navn;
                      const status = k.status || "sendt_cv";
                      const PIPELINE = [
                        { key: "sendt_cv", label: "Sendt CV", color: "bg-blue-50 text-blue-700 border-blue-200" },
                        { key: "intervju", label: "Intervju", color: "bg-violet-50 text-violet-700 border-violet-200" },
                        { key: "vunnet", label: "Vunnet", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
                        { key: "avslag", label: "Avslag", color: "bg-red-50 text-red-700 border-red-200" },
                        { key: "bortfalt", label: "Bortfalt", color: "bg-gray-100 text-gray-500 border-gray-200" },
                      ];
                      return (
                        <div key={k.id} className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 mb-2">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[0.6875rem] font-semibold text-primary">
                                {getInitials(navn || "?")}
                              </div>
                              <span className="text-[0.875rem] font-medium">{navn || "Ukjent"}</span>
                              <span className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold",
                                isIntern ? "bg-foreground text-background" : "bg-blue-100 text-blue-700"
                              )}>
                                {isIntern ? "Intern" : "Ekstern"}
                              </span>
                            </div>
                            <button onClick={() => handleRemoveKonsulent(k.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {PIPELINE.map(s => (
                              <button
                                key={s.key}
                                onClick={async () => {
                                  await supabase.from("foresporsler_konsulenter").update({ status: s.key, status_updated_at: new Date().toISOString() }).eq("id", k.id);
                                  if (s.key === "vunnet") fireConfetti();
                                  queryClient.invalidateQueries({ queryKey: ["foresporsler-konsulenter", row.id] });
                                  queryClient.invalidateQueries({ queryKey: ["foresporsler-list"] });
                                }}
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-semibold transition-all ${
                                  status === s.key
                                    ? `${s.color} ring-2 ring-offset-1 ring-current`
                                    : "border-border text-muted-foreground hover:bg-secondary"
                                }`}
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <AddKonsulentCombobox
                    foresporslerID={row.id}
                    alreadyLinkedIntern={linkedKonsulenter.filter((k: any) => k.konsulent_type === "intern").map((k: any) => k.ansatt_id)}
                    alreadyLinkedEkstern={linkedKonsulenter.filter((k: any) => k.konsulent_type === "ekstern").map((k: any) => k.ekstern_id)}
                    onAddIntern={handleAddKonsulent}
                    onAddEkstern={handleAddEkstern}
                  />
                </div>

                {/* ─── Kommentar (inline edit) ─── */}
                <div>
                  <p className={LABEL}>Kommentar</p>
                  {editingKommentar ? (
                    <div className="mt-1">
                      <textarea
                        ref={kommentarRef}
                        value={kommentar}
                        onChange={e => setKommentar(e.target.value)}
                        onBlur={saveKommentar}
                        onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") saveKommentar(); }}
                        rows={3}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        placeholder="Notater, kilde, intern info..."
                        autoFocus
                      />
                      <p className="text-[0.6875rem] text-muted-foreground mt-1">Klikk utenfor eller Cmd+Enter for å lagre</p>
                    </div>
                  ) : (
                    <div
                      onClick={() => setEditingKommentar(true)}
                      className="mt-1 cursor-pointer rounded-lg px-3 py-2 hover:bg-muted/40 transition-colors min-h-[40px]"
                    >
                      {kommentar ? (
                        <p className="text-[0.875rem] text-foreground/70 whitespace-pre-wrap leading-relaxed">{kommentar}</p>
                      ) : (
                        <p className="text-[0.8125rem] text-muted-foreground/50 italic">Klikk for å legge til kommentar...</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN — Match results */}
            {showMatch && (
              <div className="flex-1 border-l border-border overflow-y-auto py-5 px-5 max-h-[calc(100vh-200px)]">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <p className={`${LABEL} mb-0`}>Konsulentmatch</p>
                  </div>
                  {matchResults && matchResults.length > 0 && (
                    <button
                      onClick={runMatch}
                      className="text-[0.75rem] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Kjør på nytt
                    </button>
                  )}
                </div>

                {matchResults && matchResults.length > 0 && (
                  <div className="flex items-center gap-1.5 mb-3">
                    {(["Alle", "Ansatte", "Eksterne"] as const).map(chip => {
                      const sel = matchSourceFilter === chip;
                      return (
                        <button
                          key={chip}
                          onClick={() => setMatchSourceFilter(chip)}
                          className={sel
                            ? "h-7 px-2.5 text-[0.75rem] rounded-full border bg-foreground border-foreground text-background font-medium transition-colors"
                            : "h-7 px-2.5 text-[0.75rem] rounded-full border border-border text-muted-foreground hover:bg-secondary transition-colors"
                          }
                        >
                          {chip}
                        </button>
                      );
                    })}
                  </div>
                )}

                {matching && (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
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

                {matchResults && matchResults.length > 0 && (
                  <div className="space-y-2">
                    {matchResults
                      .filter(m => matchSourceFilter === "Alle" ? true : matchSourceFilter === "Ansatte" ? m.type === "intern" : m.type === "ekstern")
                      .map((m, i) => {
                      const isLinked = alreadyLinkedIds.has(m.id);
                      return (
                        <div key={`${m.type}-${m.id}`} className="rounded-lg border border-border bg-card p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[0.75rem] font-bold text-muted-foreground">#{i + 1}</span>
                              <span className="text-[0.875rem] font-semibold text-foreground truncate">{m.navn}</span>
                              <span className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold shrink-0",
                                m.type === "intern"
                                  ? "bg-foreground text-background"
                                  : "bg-blue-100 text-blue-700"
                              )}>
                                {m.type === "intern" ? "Intern" : "Ekstern"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <ScoreDot score={m.score} />
                              <span className="text-[0.8125rem] font-bold text-foreground">{m.score}/10</span>
                            </div>
                          </div>
                          {/* Match tags */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {m.match_tags.map(t => (
                              <span key={t} className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[0.6875rem] font-medium">
                                {t}
                              </span>
                            ))}
                          </div>
                          {/* Begrunnelse */}
                          <p className="text-[0.8125rem] text-muted-foreground mt-1.5 italic">
                            {m.begrunnelse}
                          </p>
                          {/* Add button */}
                          {!isLinked && (
                            <button
                              onClick={() => addFromMatch(m)}
                              className="mt-2 inline-flex items-center gap-1 text-[0.75rem] text-primary hover:underline font-medium"
                            >
                              <Plus className="h-3 w-3" />
                              Legg til
                            </button>
                          )}
                          {isLinked && (
                            <span className="mt-2 inline-flex items-center gap-1 text-[0.75rem] text-emerald-600 font-medium">
                              ✓ Allerede lagt til
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border">
        {editMode ? (
          <div className="flex gap-3">
            <button
              onClick={() => setEditMode(false)}
              className="flex-1 h-9 text-[0.8125rem] rounded-lg border border-border text-muted-foreground hover:bg-secondary transition-colors"
            >
              Avbryt
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-9 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "Lagrer..." : "Lagre endringer"}
            </button>
          </div>
        ) : (
          <DeleteButton onConfirm={handleDelete} />
        )}
      </div>
    </div>
  );
}

/* ─── Edit Mode (extracted for readability) ─── */

function EditMode(props: any) {
  const {
    row, mottattDato, setMottattDato,
    selskapNavn, setSelskapNavn, setSelskapId, setShowSelskapDropdown,
    showSelskapDropdown, companyResults, searchCompanies, selectCompany,
    isPartner, sluttkunde, setSluttkunde, sted, setSted, selskapId,
    kontakt, setKontakt, kontaktId, setKontaktId, showKontaktDropdown,
    setShowKontaktDropdown, filteredContacts, fristDato, setFristDato,
    status, setStatus, avdeling, setAvdeling, teknologier, setTeknologier,
    tagInput, setTagInput, addTag, handleTagKeyDown, kommentar, setKommentar,
  } = props;

  const LABEL = "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";
  const SUGGESTED_TAGS = ["C++", "C", "Embedded", "Yocto", "Linux", "Qt", "FPGA", "Python", "SPI/I2C", "MCU", "Embedded Linux", "Sikkerhet"];

  const [showAnalyze, setShowAnalyze] = useState(false);
  const [analyzeText, setAnalyzeText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    if (!analyzeText.trim()) return;
    setAnalyzing(true);
    try {
      const AI_SYSTEM_PROMPT = `Du er en teknisk rekrutterer for et norsk konsulentselskap som spesialiserer seg på embedded systems og ingeniørfag.
Analyser teksten og returner KUN en JSON-array med tekniske nøkkelord/teknologier som er nevnt eller sterkt implisert.
Eksempler: ["C++", "Embedded", "Linux", "Yocto", "Python", "FPGA", "ROS", "Rust", "Java", "Sikkerhet", "Lab", "C", "Qt", "CMake"]
Returner BARE arrayen, ingen annen tekst. Maks 8 tags. Bruk korte presise navn, ikke setninger.`;
      const { data, error } = await supabase.functions.invoke("chat", {
        body: { system: AI_SYSTEM_PROMPT, messages: [{ role: "user", content: analyzeText.trim() }] },
      });
      if (error) throw error;
      const text = data?.text ?? "[]";
      const clean = text.replace(/```json|```/g, "").trim();
      const found: string[] = JSON.parse(clean);
      const merged = [...new Set([...teknologier, ...found])];
      setTeknologier(merged);
      setShowAnalyze(false);
      setAnalyzeText("");
      toast.success(`${found.length} teknologier lagt til`);
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke analysere teksten");
    } finally {
      setAnalyzing(false);
    }
  };

  // Fetch company locations (avdelinger) from companies.city
  const { data: companyCity } = useQuery({
    queryKey: ["company-city", selskapId],
    enabled: !!selskapId,
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("city").eq("id", selskapId!).single();
      return data?.city || null;
    },
  });
  const companyLocations: string[] = companyCity ? companyCity.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
  const hasAvdelinger = companyLocations.length > 1;

  return (
    <div className="space-y-4">
      {/* Mottatt dato */}
      <div>
        <label className={LABEL}>Mottatt</label>
        <Input
          type="date"
          value={mottattDato}
          onChange={(e: any) => setMottattDato(e.target.value)}
          className="mt-1 text-[0.875rem] w-full"
        />
      </div>

      {/* Selskap */}
      <div>
        <label className={LABEL}>Selskap</label>
        <div className="relative mt-1">
          <Input
            value={selskapNavn}
            onChange={(e: any) => {
              setSelskapNavn(e.target.value);
              setSelskapId(null);
              setShowSelskapDropdown(true);
              searchCompanies(e.target.value);
            }}
            onFocus={() => setShowSelskapDropdown(true)}
            placeholder="Søk etter selskap..."
            className="text-[0.875rem]"
          />
          {showSelskapDropdown && companyResults.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-md max-h-48 overflow-auto">
              {companyResults.map((c: any) => (
                <button key={c.id} onClick={() => selectCompany(c)}
                  className="w-full text-left px-3 py-2 text-[0.8125rem] hover:bg-secondary transition-colors">
                  {c.name}
                  {c.city && <span className="text-muted-foreground ml-2 text-[0.75rem]">{c.city}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Partner banner */}
      {isPartner && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-2">
          <p className="text-[0.8125rem] text-amber-800">
            Forespørselen kom via en partner — hvem er sluttkunden?
          </p>
          <Input
            value={sluttkunde}
            onChange={(e: any) => setSluttkunde(e.target.value)}
            placeholder="f.eks. Kongsberg Defence, Equinor..."
            className="h-10 rounded-lg bg-white"
          />
        </div>
      )}

      {/* Sted */}
      <div>
        <label className={LABEL}>Sted</label>
        <Input value={sted} onChange={(e: any) => setSted(e.target.value)}
          className="mt-1 text-[0.875rem]" placeholder="f.eks. Oslo, Kongsberg, Remote" />
      </div>

      {/* Kontaktperson */}
      <div>
        <label className={LABEL}>Kontaktperson</label>
        <div className="relative mt-1">
          {!selskapId ? (
            <Input disabled placeholder="Velg selskap først..."
              className="text-[0.875rem] opacity-50 cursor-not-allowed" />
          ) : (
            <>
              <Input
                value={kontakt}
                onChange={(e: any) => { setKontakt(e.target.value); setKontaktId(null); setShowKontaktDropdown(true); }}
                onFocus={() => setShowKontaktDropdown(true)}
                onBlur={() => setTimeout(() => setShowKontaktDropdown(false), 200)}
                placeholder="Søk etter kontaktperson..."
                className="text-[0.875rem]"
              />
              {showKontaktDropdown && !kontaktId && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-md max-h-[200px] overflow-y-auto">
                  {filteredContacts.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-3 py-2.5 italic">Ingen kontakter på dette selskapet</p>
                  ) : (
                    (filteredContacts as any[]).map((c) => (
                      <button key={c.id}
                        onClick={() => { setKontakt(`${c.first_name} ${c.last_name}`); setKontaktId(c.id); setShowKontaktDropdown(false); }}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors">
                        <p className="text-[0.875rem] font-medium">{c.first_name} {c.last_name}</p>
                        {c.title && <p className="text-xs text-muted-foreground">{c.title}</p>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>


      {/* Avdeling — only if company has multiple locations */}
      {hasAvdelinger && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          <label className={LABEL}>Avdeling</label>
          <select
            value={avdeling}
            onChange={(e) => setAvdeling(e.target.value)}
            className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-3 text-[0.875rem] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Ingen avdeling</option>
            {companyLocations.map((loc: string) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>
      )}

      {/* Teknologier */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className={LABEL}>Teknologier</label>
          <button
            type="button"
            onClick={() => setShowAnalyze((prev) => !prev)}
            className="flex items-center gap-1 text-[0.75rem] text-primary hover:underline"
          >
            <Sparkles className="h-3 w-3" />
            Analyser tekst
          </button>
        </div>
        {showAnalyze && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2 mb-2">
            <p className="text-[0.75rem] text-muted-foreground">
              Lim inn stillingsbeskrivelse, e-post eller kravspesifikasjon — AI finner relevante teknologier automatisk.
            </p>
            <textarea
              value={analyzeText}
              onChange={(e) => setAnalyzeText(e.target.value)}
              placeholder="Lim inn tekst her..."
              className="w-full h-24 text-[0.875rem] rounded-md border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!analyzeText.trim() || analyzing}
                className="flex items-center gap-1.5 text-[0.8125rem] font-medium bg-primary text-primary-foreground rounded-lg px-3 py-1.5 hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {analyzing ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />Analyserer...</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5" />Finn teknologier</>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setShowAnalyze(false); setAnalyzeText(""); }}
                className="text-[0.8125rem] text-muted-foreground hover:text-foreground"
              >
                Avbryt
              </button>
            </div>
          </div>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-1.5 p-2 border border-border rounded-lg bg-background min-h-[38px]">
          {teknologier.map((t: string) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[0.75rem] text-foreground">
              {t}
              <button onClick={() => setTeknologier(teknologier.filter((x: string) => x !== t))} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder={teknologier.length === 0 ? "Legg til..." : ""}
            className="flex-1 min-w-[80px] bg-transparent outline-none text-[0.8125rem] placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {SUGGESTED_TAGS.filter((s: string) => !teknologier.includes(s)).map((s: string) => (
            <button key={s} onClick={() => addTag(s)} className="h-6 px-2 text-[0.6875rem] rounded-full border border-border text-muted-foreground hover:bg-secondary transition-colors">
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Kommentar */}
      <div>
        <label className={LABEL}>Kommentar</label>
        <textarea
          value={kommentar}
          onChange={(e) => setKommentar(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          placeholder="Notater, kilde, intern info..."
        />
      </div>
    </div>
  );
}

/* ─── Add Konsulent Combobox ─── */

function AddKonsulentCombobox({
  foresporslerID,
  alreadyLinkedIntern,
  alreadyLinkedEkstern,
  onAddIntern,
  onAddEkstern,
}: {
  foresporslerID: number;
  alreadyLinkedIntern: number[];
  alreadyLinkedEkstern: string[];
  onAddIntern: (ansattId: number) => void;
  onAddEkstern: (eksternId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [subTab, setSubTab] = useState<"ansatte" | "eksterne">("ansatte");

  const { data: ansatte = [] } = useQuery({
    queryKey: ["stacq-ansatte-aktive"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stacq_ansatte")
        .select("id, navn, kompetanse, status")
        .in("status", ["AKTIV/SIGNERT", "Ledig"])
        .order("navn");
      return data || [];
    },
  });

  const { data: eksterne = [] } = useQuery({
    queryKey: ["external-consultants-legg-til"],
    queryFn: async () => {
      const { data } = await supabase
        .from("external_consultants")
        .select("id, navn, teknologier, type, status")
        .order("created_at", { ascending: true });
      // Deduplicate by navn
      const unique = (data || []).filter((c: any, i: number, arr: any[]) =>
        arr.findIndex((x: any) => x.navn === c.navn) === i
      );
      return unique;
    },
  });

  const q = search.toLowerCase();

  const filteredAnsatte = ansatte
    .filter((a: any) => !alreadyLinkedIntern.includes(a.id))
    .filter((a: any) => !q || a.navn?.toLowerCase().includes(q));

  const filteredEksterne = eksterne
    .filter((e: any) => !alreadyLinkedEkstern.includes(e.id))
    .filter((e: any) => !q || e.navn?.toLowerCase().includes(q));

  const CHIP_BASE_SM = "h-6 px-2 text-[0.6875rem] rounded-full border transition-colors cursor-pointer select-none font-medium";

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSearch(""); } }}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 text-[0.8125rem] text-primary hover:underline">
          <Plus className="h-3.5 w-3.5" />
          Legg til konsulent
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-3" align="start">
        {/* Sub-tabs */}
        <div className="flex gap-1.5 mb-2">
          <button
            className={`${CHIP_BASE_SM} ${subTab === "ansatte" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:bg-secondary"}`}
            onClick={() => setSubTab("ansatte")}
          >
            Ansatte
          </button>
          <button
            className={`${CHIP_BASE_SM} ${subTab === "eksterne" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:bg-secondary"}`}
            onClick={() => setSubTab("eksterne")}
          >
            Eksterne
          </button>
        </div>

        <Input
          placeholder="Søk etter konsulent..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm mb-2"
          autoFocus
        />

        <div className="space-y-0.5 max-h-[280px] overflow-y-auto">
          {subTab === "ansatte" ? (
            filteredAnsatte.length === 0 ? (
              <p className="text-[0.8125rem] text-muted-foreground px-2 py-2">Ingen treff</p>
            ) : (
              filteredAnsatte.map((a: any) => (
                <button
                  key={a.id}
                  onClick={() => { onAddIntern(a.id); setOpen(false); setSearch(""); }}
                  className="w-full text-left px-2 py-2 rounded hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[0.625rem] font-semibold text-primary shrink-0">
                      {getInitials(a.navn)}
                    </div>
                    <span className="text-[0.8125rem] font-medium text-foreground">{a.navn}</span>
                  </div>
                  {a.kompetanse?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 ml-8">
                      {(a.kompetanse as string[]).slice(0, 4).map((t: string) => (
                        <span key={t} className="inline-flex items-center rounded-full border border-border bg-muted px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">
                          {t}
                        </span>
                      ))}
                      {a.kompetanse.length > 4 && (
                        <span className="text-[0.625rem] text-muted-foreground">+{a.kompetanse.length - 4}</span>
                      )}
                    </div>
                  )}
                </button>
              ))
            )
          ) : (
            filteredEksterne.length === 0 ? (
              <p className="text-[0.8125rem] text-muted-foreground px-2 py-2">Ingen treff</p>
            ) : (
              filteredEksterne.map((e: any) => (
                <button
                  key={e.id}
                  onClick={() => { onAddEkstern(e.id); setOpen(false); setSearch(""); }}
                  className="w-full text-left px-2 py-2 rounded hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-[0.625rem] font-semibold text-blue-700 shrink-0">
                      {getInitials(e.navn || "?")}
                    </div>
                    <span className="text-[0.8125rem] font-medium text-foreground">{e.navn || "Ukjent"}</span>
                    <span className={cn(
                      "inline-flex items-center rounded-full px-1.5 py-0.5 text-[0.625rem] font-semibold",
                      e.type === "via_partner" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                    )}>
                      {e.type === "via_partner" ? "Partner" : "Freelance"}
                    </span>
                  </div>
                  {e.teknologier?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 ml-8">
                      {(e.teknologier as string[]).slice(0, 4).map((t: string) => (
                        <span key={t} className="inline-flex items-center rounded-full border border-border bg-muted px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">
                          {t}
                        </span>
                      ))}
                      {e.teknologier.length > 4 && (
                        <span className="text-[0.625rem] text-muted-foreground">+{e.teknologier.length - 4}</span>
                      )}
                    </div>
                  )}
                </button>
              ))
            )
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
