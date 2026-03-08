import { useState, useRef, useEffect, useMemo } from "react";
import { Plus, X, ArrowUpDown, Pencil, Trash2, Sparkles, Loader2, ChevronDown, Check } from "lucide-react";
import { relativeDate, fullDate } from "@/lib/relativeDate";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getInitials, cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { format, differenceInDays, parseISO, startOfDay } from "date-fns";
import { nb } from "date-fns/locale";

type StatusFilter = "aktive" | "utgatte" | "alle";
type TypeFilter = "Alle" | "DIR" | "VIA";
const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: "aktive", label: "Aktive, siste 45 dager" },
  { value: "utgatte", label: "Utgåtte, 45+ dager" },
  { value: "alle", label: "Alle" },
];

const CHIP_BASE = "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors cursor-pointer select-none";
const CHIP_OFF = `${CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;
const CHIP_ON = `${CHIP_BASE} bg-foreground text-background border-foreground font-medium`;

const SUGGESTED_TAGS = ["C++", "C", "Embedded", "Yocto", "Linux", "Qt", "FPGA", "Python", "SPI/I2C", "MCU", "Embedded Linux", "Sikkerhet"];

function getDaysAgo(d: string): number {
  return differenceInDays(new Date(), new Date(d));
}

function getMottattClass(days: number): string {
  if (days <= 7) return "text-foreground font-medium";
  if (days <= 21) return "text-amber-600 font-medium";
  return "text-destructive font-medium";
}

/* ─── Deadline helper ─── */

type Urgency = "overdue" | "critical" | "soon" | "ok" | "none";

function relativeDeadline(dateStr: string | null): { text: string; urgency: Urgency; tooltip: string } {
  if (!dateStr) return { text: "—", urgency: "none", tooltip: "" };
  const days = differenceInDays(parseISO(dateStr), startOfDay(new Date()));
  const tooltip = format(parseISO(dateStr), "EEEE d. MMMM yyyy", { locale: nb });
  if (days < 0) return { text: `Utgått ${Math.abs(days)}d`, urgency: "overdue", tooltip };
  if (days === 0) return { text: "Frist i dag", urgency: "critical", tooltip };
  if (days <= 3) return { text: `Frist om ${days}d`, urgency: "critical", tooltip };
  if (days <= 14) return { text: `Frist om ${days}d`, urgency: "soon", tooltip };
  return { text: `Frist ${format(parseISO(dateStr), "d. MMM", { locale: nb })}`, urgency: "ok", tooltip };
}

const URGENCY_COLOR: Record<Urgency, string> = {
  overdue: "text-destructive",
  critical: "text-amber-600",
  soon: "text-amber-500",
  ok: "text-muted-foreground",
  none: "text-muted-foreground",
};

/* ─── Type badge helper ─── */

function TypeBadge({ type }: { type: string | null }) {
  if (type === "DIR" || type === "direktekunde") return (
    <span className="inline-flex items-center rounded-full bg-foreground text-background px-2.5 py-0.5 text-[0.6875rem] font-semibold">DIR</span>
  );
  if (type === "VIA" || type === "via_partner") return (
    <span className="inline-flex items-center rounded-full bg-violet-100 text-violet-800 border border-violet-200 px-2.5 py-0.5 text-[0.6875rem] font-semibold">Partner</span>
  );
  if (type === "via_megler") return (
    <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 border border-blue-200 px-2.5 py-0.5 text-[0.6875rem] font-semibold">Megler</span>
  );
  return <span className="text-[0.8125rem] text-muted-foreground">—</span>;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

/* ─── AI Tech Analysis ─── */

const AI_SYSTEM_PROMPT = `Du er en teknisk rekrutterer for et norsk konsulentselskap som spesialiserer seg på embedded systems og ingeniørfag.
Analyser teksten og returner KUN en JSON-array med tekniske nøkkelord/teknologier som er nevnt eller sterkt implisert.
Eksempler: ["C++", "Embedded", "Linux", "Yocto", "Python", "FPGA", "ROS", "Rust", "Java", "Sikkerhet", "Lab", "C", "Qt", "CMake"]
Returner BARE arrayen, ingen annen tekst. Maks 8 tags. Bruk korte presise navn, ikke setninger.`;

async function analyzeTextForTech(rawText: string): Promise<string[]> {
  const { data, error } = await supabase.functions.invoke("chat", {
    body: {
      system: AI_SYSTEM_PROMPT,
      messages: [{ role: "user", content: rawText.trim() }],
    },
  });
  if (error) throw error;
  const text = data?.text ?? "[]";
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

function AiTeknologiBox({
  existingTags,
  onTagsFound,
}: {
  existingTags: string[];
  onTagsFound: (merged: string[]) => void;
}) {
  const [show, setShow] = useState(false);
  const [rawText, setRawText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    if (!rawText.trim()) return;
    setAnalyzing(true);
    try {
      const found = await analyzeTextForTech(rawText);
      const merged = [...new Set([...existingTags, ...found])];
      onTagsFound(merged);
      setShow(false);
      setRawText("");
      toast.success(`${found.length} teknologier lagt til`);
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke analysere teksten");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Teknologier
        </label>
        <button
          type="button"
          onClick={() => setShow((prev) => !prev)}
          className="flex items-center gap-1 text-[0.75rem] text-primary hover:underline"
        >
          <Sparkles className="h-3 w-3" />
          Analyser tekst
        </button>
      </div>
      {show && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2 mb-2">
          <p className="text-[0.75rem] text-muted-foreground">
            Lim inn stillingsbeskrivelse, e-post eller kravspesifikasjon — AI finner relevante teknologier automatisk.
          </p>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Lim inn tekst her..."
            className="w-full h-24 text-[0.875rem] rounded-md border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!rawText.trim() || analyzing}
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
              onClick={() => { setShow(false); setRawText(""); }}
              className="text-[0.8125rem] text-muted-foreground hover:text-foreground"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}
    </>
  );
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

/* ─── Ny forespørsel modal ─── */

function NyForesporselModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selskap, setSelskap] = useState("");
  const [selskapId, setSelskapId] = useState<string | null>(null);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [avdeling, setAvdeling] = useState("");
  const [sted, setSted] = useState("");
  const [kontakt, setKontakt] = useState("");
  const [kontaktId, setKontaktId] = useState<string | null>(null);
  const [showKontaktDropdown, setShowKontaktDropdown] = useState(false);
  const [kommentar, setKommentar] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [companyResults, setCompanyResults] = useState<Array<{ id: string; name: string; city: string | null; status: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [sluttkunde, setSluttkunde] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasMultipleLocations = selectedLocations.length > 1;

  useEffect(() => {
    if (open) {
      setSelskap(""); setSelskapId(null); setSelectedLocations([]);
      setAvdeling(""); setSted(""); setKontakt(""); setKontaktId(null);
      setKommentar(""); setTags([]); setTagInput("");
      setCompanyResults([]); setSluttkunde("");
    }
  }, [open]);

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

  const selectCompany = (c: { id: string; name: string; city: string | null; status: string }) => {
    setSelskap(c.name);
    setSelskapId(c.id);
    setAvdeling("");
    setKontakt("");
    setKontaktId(null);
    setShowKontaktDropdown(false);
    setSluttkunde("");
    const locations = c.city ? c.city.split(",").map(l => l.trim()).filter(Boolean) : [];
    setSelectedLocations(locations);
    if (locations.length === 1) {
      setSted(locations[0]);
    } else if (locations.length > 1) {
      setSted(c.city || "");
    } else {
      setSted("");
    }
    setShowDropdown(false);
  };

  const selectedCompany = companyResults.find(c => c.id === selskapId);
  const isPartner = selectedCompany?.status === "partner";

  const { data: companyContacts = [] } = useQuery({
    queryKey: ["foresporsler-kontakter", selskapId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, title")
        .eq("company_id", selskapId!)
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!selskapId,
  });

  const filteredContacts = useMemo(() => {
    if (!kontakt.trim()) return companyContacts;
    const q = kontakt.toLowerCase();
    return companyContacts.filter((c: any) =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q)
    );
  }, [companyContacts, kontakt]);

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  const handleSubmit = async () => {
    if (!selskap.trim() || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.from("foresporsler").insert({
      selskap_navn: selskap,
      selskap_id: selskapId,
      sted: sted || null,
      avdeling: avdeling || null,
      kontakt_id: kontaktId,
      teknologier: tags,
      kommentar: kommentar || null,
      type: isPartner ? "VIA" : "DIR",
      sluttkunde: isPartner ? (sluttkunde || null) : null,
      status: "Ny",
      created_by: user?.id,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Kunne ikke opprette forespørsel");
      return;
    }
    toast.success("Forespørsel opprettet");
    queryClient.invalidateQueries({ queryKey: ["foresporsler-list"] });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md rounded-xl p-6 gap-0" hideCloseButton onInteractOutside={(e) => e.preventDefault()}>
        <DialogTitle className="text-[1.125rem] font-bold text-foreground mb-5">Ny forespørsel</DialogTitle>

        <div className="space-y-4">
          {/* Selskap */}
          <div>
            <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Selskap</label>
            <div className="relative mt-1">
              <Input
                ref={inputRef}
                value={selskap}
                onChange={(e) => {
                  setSelskap(e.target.value);
                  setSelskapId(null);
                  setSelectedLocations([]);
                  setShowDropdown(true);
                  searchCompanies(e.target.value);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Søk etter selskap..."
                className="text-[0.875rem]"
              />
              {showDropdown && companyResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-md max-h-48 overflow-auto">
                  {companyResults.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => selectCompany(c)}
                      className="w-full text-left px-3 py-2 text-[0.8125rem] hover:bg-secondary transition-colors"
                    >
                      {c.name}
                      {c.city && <span className="text-muted-foreground ml-2 text-[0.75rem]">{c.city}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sluttkunde — conditional for Partner */}
          {isPartner && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-600 border border-gray-200 px-2 py-0.5 text-[0.6875rem] font-semibold">
                  Partner
                </span>
                <p className="text-[0.8125rem] text-amber-800">
                  Forespørselen kom via en partner — hvem er sluttkunden?
                </p>
              </div>
              <div>
                <label className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-amber-700 block mb-1">
                  SLUTTKUNDE
                </label>
                <Input
                  value={sluttkunde}
                  onChange={(e) => setSluttkunde(e.target.value)}
                  placeholder="f.eks. Kongsberg Defence, Equinor..."
                  className="h-10 rounded-lg bg-white"
                />
              </div>
            </div>
          )}

          {/* Avdeling — conditional */}
          {hasMultipleLocations && (
            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
              <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Avdeling</label>
              <select
                value={avdeling}
                onChange={(e) => {
                  setAvdeling(e.target.value);
                  if (e.target.value) setSted(e.target.value);
                }}
                className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-3 text-[0.875rem] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Velg avdeling...</option>
                {selectedLocations.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          )}

          {/* Sted */}
          <div>
            <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Sted</label>
            <Input
              value={sted}
              onChange={(e) => setSted(e.target.value)}
              placeholder="f.eks. Oslo, Kongsberg, Remote"
              className="mt-1 text-[0.875rem]"
            />
          </div>

          {/* Kontaktperson */}
          <div>
            <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Kontaktperson</label>
            <div className="relative mt-1">
              {!selskapId ? (
                <Input
                  disabled
                  placeholder="Velg selskap først..."
                  className="text-[0.875rem] opacity-50 cursor-not-allowed"
                />
              ) : (
                <>
                  <div className="relative">
                    <Input
                      value={kontakt}
                      onChange={(e) => {
                        setKontakt(e.target.value);
                        setKontaktId(null);
                        setShowKontaktDropdown(true);
                      }}
                      onFocus={() => setShowKontaktDropdown(true)}
                      onBlur={() => setTimeout(() => setShowKontaktDropdown(false), 200)}
                      placeholder="Søk etter kontaktperson..."
                      className="text-[0.875rem]"
                    />
                    {kontaktId && (
                      <button
                        onClick={() => { setKontakt(""); setKontaktId(null); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {showKontaktDropdown && !kontaktId && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-md max-h-[200px] overflow-y-auto">
                      {filteredContacts.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-3 py-2.5 italic">
                          Ingen kontakter registrert på dette selskapet
                        </p>
                      ) : (
                        filteredContacts.map((c: any) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setKontakt(`${c.first_name} ${c.last_name}`);
                              setKontaktId(c.id);
                              setShowKontaktDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
                          >
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

          {/* Teknologier */}
          <div>
            <AiTeknologiBox existingTags={tags} onTagsFound={setTags} />
            <div className="mt-1 flex flex-wrap items-center gap-1.5 p-2 border border-border rounded-lg bg-background min-h-[38px]">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[0.75rem] text-foreground">
                  {t}
                  <button onClick={() => setTags(tags.filter((x) => x !== t))} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={tags.length === 0 ? "Legg til teknologi..." : ""}
                className="flex-1 min-w-[100px] bg-transparent outline-none text-[0.8125rem] placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SUGGESTED_TAGS.filter((s) => !tags.includes(s)).map((s) => (
                <button
                  key={s}
                  onClick={() => addTag(s)}
                  className="h-6 px-2 text-[0.6875rem] rounded-full border border-border text-muted-foreground hover:bg-secondary transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Kommentar */}
          <div>
            <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Kommentar</label>
            <textarea
              value={kommentar}
              onChange={(e) => setKommentar(e.target.value)}
              placeholder="Notater, kilde, intern info..."
              rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <button onClick={onClose} className="text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors">
            Avbryt
          </button>
          <button
            disabled={!selskap.trim() || submitting}
            onClick={handleSubmit}
            className={`inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg transition-colors ${
              selskap.trim() && !submitting
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
          >
            {submitting ? "Oppretter..." : "Opprett forespørsel"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Detail/Edit Sheet Panel ─── */

function ForespørselSheet({
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
  const [kommentar, setKommentar] = useState("");
  const [sluttkunde, setSluttkunde] = useState("");

  // Company/contact search state
  const [selskapNavn, setSelskapNavn] = useState("");
  const [selskapId, setSelskapId] = useState<string | null>(null);
  const [companyResults, setCompanyResults] = useState<any[]>([]);
  const [showSelskapDropdown, setShowSelskapDropdown] = useState(false);
  const [kontakt, setKontakt] = useState("");
  const [kontaktId, setKontaktId] = useState<string | null>(null);
  const [showKontaktDropdown, setShowKontaktDropdown] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Linked consultants
  const { data: linkedKonsulenter = [], refetch: refetchLinked } = useQuery({
    queryKey: ["foresporsler-konsulenter", row?.id],
    enabled: !!row?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("foresporsler_konsulenter")
        .select("id, ansatt_id, stacq_ansatte(id, navn)")
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
        sted: sted || null,
        avdeling: avdeling || null,
        frist_dato: fristDato || null,
        type: type || null,
        teknologier,
        kommentar: kommentar || null,
        sluttkunde: sluttkunde || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    setSaving(false);
    if (error) {
      toast.error("Kunne ikke oppdatere");
      return;
    }
    toast.success("Forespørsel oppdatert");
    queryClient.invalidateQueries({ queryKey: ["foresporsler-list"] });
    setEditMode(false);
  };

  const handleDelete = async () => {
    if (!row) return;
    const { error } = await supabase.from("foresporsler").delete().eq("id", row.id);
    if (error) {
      toast.error("Kunne ikke slette");
      return;
    }
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

  if (!row) return null;

  const LABEL = "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

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
          <div className="space-y-4">
            {/* Sted */}
            <div>
              <label className={LABEL}>Sted</label>
              <Input value={sted} onChange={(e) => setSted(e.target.value)} className="mt-1 text-[0.875rem]" placeholder="f.eks. Oslo, Kongsberg" />
            </div>

            {/* Avdeling */}
            <div>
              <label className={LABEL}>Avdeling</label>
              <Input value={avdeling} onChange={(e) => setAvdeling(e.target.value)} className="mt-1 text-[0.875rem]" placeholder="f.eks. Defence, Maritime" />
            </div>

            {/* Frist dato */}
            <div>
              <label className={LABEL}>Frist dato</label>
              <Input type="date" value={fristDato} onChange={(e) => setFristDato(e.target.value)} className="mt-1 text-[0.875rem]" />
            </div>

            {/* Type */}
            <div>
              <label className={LABEL}>Type</label>
              <div className="flex gap-2 mt-1">
                {["DIR", "VIA"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`h-8 px-4 text-[0.8125rem] rounded-lg border transition-colors ${
                      type === t
                        ? "bg-foreground text-background border-foreground font-medium"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Sluttkunde */}
            <div>
              <label className={LABEL}>Sluttkunde</label>
              <Input value={sluttkunde} onChange={(e) => setSluttkunde(e.target.value)} className="mt-1 text-[0.875rem]" placeholder="f.eks. Kongsberg Defence, Equinor..." />
            </div>

            {/* Teknologier */}
            <div>
              <AiTeknologiBox existingTags={teknologier} onTagsFound={setTeknologier} />
              <div className="mt-1 flex flex-wrap items-center gap-1.5 p-2 border border-border rounded-lg bg-background min-h-[38px]">
                {teknologier.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[0.75rem] text-foreground">
                    {t}
                    <button onClick={() => setTeknologier(teknologier.filter((x) => x !== t))} className="hover:text-destructive">
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
                {SUGGESTED_TAGS.filter((s) => !teknologier.includes(s)).map((s) => (
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
        ) : (
          /* ─── VIEW MODE ─── */
          <div className="space-y-5">
            {/* Urgency banner */}
            {(() => {
              const dl = relativeDeadline(row.frist_dato);
              if (dl.urgency === "overdue") return (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-[0.8125rem] text-destructive font-medium">⚠ Fristen er utgått</div>
              );
              if (dl.urgency === "critical") return (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[0.8125rem] text-amber-700 font-medium">⏰ {dl.text}</div>
              );
              return null;
            })()}

            {/* Mottatt / Frist */}
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
                <p className={LABEL}>Frist</p>
                {(() => {
                  const dl = relativeDeadline(row.frist_dato);
                  return (
                    <div className="mt-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className={cn("text-[0.875rem] font-medium cursor-default", URGENCY_COLOR[dl.urgency])}>
                            {dl.text}
                          </p>
                        </TooltipTrigger>
                        {dl.tooltip && <TooltipContent>{dl.tooltip}</TooltipContent>}
                      </Tooltip>
                      {row.frist_dato && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(parseISO(row.frist_dato), "d. MMMM yyyy", { locale: nb })}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Type — inline editable dropdown */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className={LABEL}>Type</p>
                <div className="mt-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                        <TypeBadge type={row.type} />
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {[
                        { value: "DIR", label: "Direktekunde" },
                        { value: "VIA", label: "Via partner" },
                      ].map(opt => (
                        <DropdownMenuItem
                          key={opt.value}
                          onClick={async () => {
                            await supabase.from("foresporsler").update({ type: opt.value, updated_at: new Date().toISOString() }).eq("id", row.id);
                            queryClient.invalidateQueries({ queryKey: ["foresporsler-list"] });
                          }}
                        >
                          <TypeBadge type={opt.value} />
                          <span className="ml-2">{opt.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              {/* Sluttkunde */}
              {(row.type === "VIA" || row.type === "via_partner" || row.type === "via_megler") && (
                <div>
                  <p className={LABEL}>Sluttkunde</p>
                  <p className="text-[0.875rem] font-medium text-foreground mt-1">{row.sluttkunde || "—"}</p>
                </div>
              )}
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

            {/* Sendt inn — consultant linking */}
            <div>
              <p className={`${LABEL} mb-2`}>Sendt inn</p>

              <div className="space-y-1.5 mb-3">
                {linkedKonsulenter.length === 0 && (
                  <p className="text-[0.8125rem] text-amber-600">
                    Ikke sendt til noen ennå
                  </p>
                )}
                {linkedKonsulenter.map((k: any) => (
                  <div key={k.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[0.6875rem] font-semibold text-primary">
                        {getInitials(k.stacq_ansatte?.navn || "")}
                      </div>
                      <span className="text-[0.875rem] font-medium">
                        {k.stacq_ansatte?.navn || "Ukjent"}
                      </span>
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

            {/* Kommentar */}
            {row.kommentar && (
              <div>
                <p className={LABEL}>Kommentar</p>
                <p className="text-[0.875rem] text-foreground/70 mt-1 whitespace-pre-wrap leading-relaxed">
                  {row.kommentar}
                </p>
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

/* ─── Main page ─── */

export default function Foresporsler() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("aktive");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("Alle");
  const [sort, setSort] = useState<{
    field: "mottatt_dato" | "selskap_navn" | "sendt_count";
    dir: "asc" | "desc";
  }>({ field: "mottatt_dato", dir: "desc" });

  const toggleSort = (field: typeof sort.field) => {
    setSort(prev =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: field === "mottatt_dato" ? "desc" : "asc" }
    );
  };

  const { data: rows, isLoading } = useQuery({
    queryKey: ["foresporsler-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foresporsler")
        .select("*, contacts(id, first_name, last_name), foresporsler_konsulenter(id, stacq_ansatte(navn))")
        .order("mottatt_dato", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!rows) return [];
    let items = rows.filter((r: any) => {
      const days = getDaysAgo(r.mottatt_dato);
      if (statusFilter === "aktive") return days <= 45;
      if (statusFilter === "utgatte") return days > 45;
      return true;
    });
    if (typeFilter !== "Alle") {
      items = items.filter((r: any) => r.type === typeFilter);
    }
    return items;
  }, [rows, statusFilter, typeFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a: any, b: any) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      switch (sort.field) {
        case "mottatt_dato":
          return dir * (a.mottatt_dato || "").localeCompare(b.mottatt_dato || "");
        case "selskap_navn":
          return dir * (a.selskap_navn || "").localeCompare(b.selskap_navn || "", "nb");
        case "sendt_count":
          return dir * ((a.foresporsler_konsulenter?.length || 0) - (b.foresporsler_konsulenter?.length || 0));
        default: return 0;
      }
    });
  }, [filtered, sort]);

  const SortHeader = ({ field, children, className = "" }: { field: string; children: React.ReactNode; className?: string }) => (
    <button
      onClick={() => toggleSort(field as any)}
      className={`flex items-center gap-1 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      {children}
      <ArrowUpDown className={`h-3 w-3 ${sort.field === field ? "text-foreground" : "text-muted-foreground/20"}`} />
    </button>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[1.5rem] font-bold text-foreground">Forespørsler</h1>
          <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary/10 text-primary text-[0.6875rem] font-semibold">
            {filtered.length}
          </span>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Ny forespørsel
        </button>
      </div>

      {/* Filter chips */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground w-16 flex-shrink-0">Tid</span>
          <div className="flex items-center gap-1.5">
            {STATUS_CHIPS.map((f) => (
              <button key={f.value} className={statusFilter === f.value ? CHIP_ON : CHIP_OFF} onClick={() => setStatusFilter(f.value)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground w-16 flex-shrink-0">Type</span>
          <div className="flex items-center gap-1.5">
            {(["Alle", "DIR", "VIA"] as TypeFilter[]).map(f => (
              <button key={f} className={typeFilter === f ? CHIP_ON : CHIP_OFF} onClick={() => setTypeFilter(f)}>
                {f === "Alle" ? "Alle" : f === "DIR" ? "Direkte" : "Partner"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Laster...</div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-card shadow-[0_1px_3px_rgba(0,0,0,0.07)]">
          {/* Header row */}
          <div className="grid grid-cols-[90px_minmax(0,1.8fr)_70px_110px_minmax(0,1.5fr)_90px] gap-3 px-4 py-2.5 border-b border-border bg-background">
            <SortHeader field="mottatt_dato">Mottatt</SortHeader>
            <SortHeader field="selskap_navn">Selskap</SortHeader>
            <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">Type</span>
            <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">Frist</span>
            <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">Teknologier</span>
            <SortHeader field="sendt_count" className="justify-end">Sendt</SortHeader>
          </div>
          {/* Data rows */}
          <div className="divide-y divide-border">
          {sorted.map((row: any) => {
            const days = getDaysAgo(row.mottatt_dato);
            const sendt = row.foresporsler_konsulenter || [];
            const antall = sendt.length;
            const hvem = sendt.map((k: any) => k.stacq_ansatte?.navn?.split(" ")[0]).filter(Boolean).join(", ");
            const dl = relativeDeadline(row.frist_dato);

            const accentClass = dl.urgency === "overdue" ? "border-l-[3px] border-l-destructive"
              : dl.urgency === "critical" ? "border-l-[3px] border-l-amber-500"
              : "";

            return (
              <div
                key={row.id}
                onClick={() => setSelectedRow(row)}
                className={cn(
                  "grid grid-cols-[90px_minmax(0,1.8fr)_70px_110px_minmax(0,1.5fr)_90px] gap-3 items-center px-4 min-h-[48px] py-2.5 hover:bg-muted/40 transition-colors cursor-pointer",
                  accentClass
                )}
              >
                {/* Mottatt */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={cn("text-[0.8125rem]", getMottattClass(days))}>
                      {relativeDate(row.mottatt_dato)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{fullDate(row.mottatt_dato)}</TooltipContent>
                </Tooltip>
                {/* Selskap */}
                <span className="text-[0.875rem] font-semibold text-foreground truncate">
                  {row.selskap_navn}
                </span>
                {/* Type */}
                <TypeBadge type={row.type} />
                {/* Frist */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={cn("text-[0.8125rem] font-medium", URGENCY_COLOR[dl.urgency])}>
                      {dl.text}
                    </span>
                  </TooltipTrigger>
                  {dl.tooltip && <TooltipContent>{dl.tooltip}</TooltipContent>}
                </Tooltip>
                {/* Teknologier */}
                <div className="flex items-center gap-1 flex-wrap">
                  {(row.teknologier || []).slice(0, 3).map((t: string) => (
                    <span key={t} className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-foreground">
                      {t}
                    </span>
                  ))}
                  {(row.teknologier || []).length > 3 && (
                    <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-[0.6875rem] text-muted-foreground">
                      +{row.teknologier!.length - 3}
                    </span>
                  )}
                </div>
                {/* Sendt inn */}
                <div className="flex justify-end">
                  {antall === 0 ? (
                    <span className="text-[0.8125rem] text-muted-foreground">—</span>
                  ) : (
                    <span className="text-[0.8125rem] font-semibold text-foreground">
                      {antall}
                      {hvem && (
                        <span className="font-normal text-muted-foreground ml-1.5">
                          {truncate(hvem, 15)}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {sorted.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Ingen forespørsler å vise
            </div>
          )}
          </div>
        </div>
      )}

      <NyForesporselModal open={modalOpen} onClose={() => setModalOpen(false)} />

      {/* Detail/Edit Sheet */}
      <Sheet open={!!selectedRow} onOpenChange={(o) => { if (!o) setSelectedRow(null); }}>
        <SheetContent side="right" className="w-[420px] sm:w-[460px] p-0" hideCloseButton>
          <ForespørselSheet row={selectedRow} onClose={() => setSelectedRow(null)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
