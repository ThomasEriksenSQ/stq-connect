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

export function ForespørselSheet({
  row,
  onClose,
}: {
  row: any;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
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

  // Linked consultants
  const { data: linkedKonsulenter = [], refetch: refetchLinked } = useQuery({
    queryKey: ["foresporsler-konsulenter", row?.id],
    enabled: !!row?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("foresporsler_konsulenter")
        .select("id, ansatt_id, created_at, stacq_ansatte(id, navn)")
        .eq("foresporsler_id", row.id);
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
    });
    queryClient.invalidateQueries({ queryKey: ["foresporsler-list"] });
    queryClient.invalidateQueries({ queryKey: ["foresporsler-konsulenter", row.id] });
  };

  const handleRemoveKonsulent = async (linkId: string) => {
    await supabase.from("foresporsler_konsulenter").delete().eq("id", linkId);
    queryClient.invalidateQueries({ queryKey: ["foresporsler-list"] });
    queryClient.invalidateQueries({ queryKey: ["foresporsler-konsulenter", row.id] });
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
      // Only stacq_ansatte can be linked via foresporsler_konsulenter
      await handleAddKonsulent(match.id as number);
      toast.success(`${match.navn} lagt til`);
    } else {
      // For now just show confirmation — external linking needs separate table
      toast.success(`${match.navn} (ekstern) registrert`);
    }
  };

  const SUGGESTED_TAGS = ["C++", "C", "Embedded", "Yocto", "Linux", "Qt", "FPGA", "Python", "SPI/I2C", "MCU", "Embedded Linux", "Sikkerhet"];

  if (!row) return null;

  const contactName = row.contacts ? `${row.contacts.first_name} ${row.contacts.last_name}` : null;
  const alreadyLinkedIds = new Set(linkedKonsulenter.map((k: any) => k.ansatt_id));

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
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {editMode ? (
          /* ─── EDIT MODE ─── */
          <EditMode
            row={row}
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
          <div className="space-y-5">
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

            {/* ─── Konsulentmatch ─── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-primary" />
                <p className={`${LABEL} mb-0`}>Konsulentmatch</p>
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

              {!matchResults && !matching && (
                <button
                  onClick={runMatch}
                  disabled={!(row.teknologier?.length)}
                  className="inline-flex items-center gap-2 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  Finn match
                </button>
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

              {matchResults && matchResults.length === 0 && !matching && (
                <p className="text-[0.8125rem] text-muted-foreground">Ingen treff med score ≥ 5</p>
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
                        {!isLinked && m.type === "intern" && (
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
                  <button
                    onClick={runMatch}
                    className="text-[0.75rem] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Kjør på nytt
                  </button>
                </div>
              )}
            </div>

            {/* ─── Sendt inn ─── */}
            <div>
              <p className={`${LABEL} mb-2`}>Sendt inn</p>
              <div className="space-y-1.5 mb-3">
                {linkedKonsulenter.length === 0 && (
                  <p className="text-[0.8125rem] text-muted-foreground">
                    Ingen konsulenter sendt inn ennå
                  </p>
                )}
                {linkedKonsulenter.map((k: any) => (
                  <div key={k.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[0.6875rem] font-semibold text-primary">
                        {getInitials(k.stacq_ansatte?.navn || "")}
                      </div>
                      <div>
                        <span className="text-[0.875rem] font-medium block">
                          {k.stacq_ansatte?.navn || "Ukjent"}
                        </span>
                        {k.created_at && (
                          <span className="text-[0.6875rem] text-muted-foreground">
                            lagt til {relativeTime(k.created_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveKonsulent(k.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <AddKonsulentCombobox
                foresporslerID={row.id}
                alreadyLinked={linkedKonsulenter.map((k: any) => k.ansatt_id)}
                onAdd={handleAddKonsulent}
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
    row, selskapNavn, setSelskapNavn, setSelskapId, setShowSelskapDropdown,
    showSelskapDropdown, companyResults, searchCompanies, selectCompany,
    isPartner, sluttkunde, setSluttkunde, sted, setSted, selskapId,
    kontakt, setKontakt, kontaktId, setKontaktId, showKontaktDropdown,
    setShowKontaktDropdown, filteredContacts, fristDato, setFristDato,
    status, setStatus, avdeling, setAvdeling, teknologier, setTeknologier,
    tagInput, setTagInput, addTag, handleTagKeyDown, kommentar, setKommentar,
  } = props;

  const LABEL = "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";
  const SUGGESTED_TAGS = ["C++", "C", "Embedded", "Yocto", "Linux", "Qt", "FPGA", "Python", "SPI/I2C", "MCU", "Embedded Linux", "Sikkerhet"];

  return (
    <div className="space-y-4">
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

      {/* Frist dato */}
      <div>
        <label className={LABEL}>Frist</label>
        <Input type="date" value={fristDato} onChange={(e: any) => setFristDato(e.target.value)} className="mt-1 text-[0.875rem]" />
      </div>

      {/* Status */}
      <div>
        <label className={LABEL}>Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-3 text-[0.875rem] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {["Ny", "Aktiv", "Tilbud sendt", "Vunnet", "Tapt", "Utgått"].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Avdeling */}
      <div>
        <label className={LABEL}>Avdeling</label>
        <Input value={avdeling} onChange={(e: any) => setAvdeling(e.target.value)} className="mt-1 text-[0.875rem]" placeholder="f.eks. Defence, Maritime" />
      </div>

      {/* Teknologier */}
      <div>
        <label className={LABEL}>Teknologier</label>
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
  alreadyLinked,
  onAdd,
}: {
  foresporslerID: number;
  alreadyLinked: number[];
  onAdd: (ansattId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: ansatte = [] } = useQuery({
    queryKey: ["stacq-ansatte-aktive"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stacq_ansatte")
        .select("id, navn, status")
        .in("status", ["AKTIV/SIGNERT"])
        .order("navn");
      return data || [];
    },
  });

  const filtered = ansatte
    .filter((a: any) => !alreadyLinked.includes(a.id))
    .filter((a: any) => a.navn.toLowerCase().includes(search.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 text-[0.8125rem] text-primary hover:underline">
          <Plus className="h-3.5 w-3.5" />
          Legg til konsulent
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-2" align="start">
        <Input
          placeholder="Søk konsulent..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm mb-2"
          autoFocus
        />
        <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
          {filtered.map((a: any) => (
            <button
              key={a.id}
              onClick={() => { onAdd(a.id); setOpen(false); setSearch(""); }}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-[0.875rem] flex items-center gap-2"
            >
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[0.625rem] font-semibold text-primary shrink-0">
                {getInitials(a.navn)}
              </div>
              {a.navn}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-[0.8125rem] text-muted-foreground px-2 py-2">
              Ingen treff
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
