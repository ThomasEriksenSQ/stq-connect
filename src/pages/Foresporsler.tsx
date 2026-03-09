import { useState, useRef, useEffect, useMemo } from "react";
import { Plus, X, ArrowUpDown, Pencil, Trash2, Sparkles, Loader2, ChevronDown, Check, FileUp, ClipboardList, UserX, Users, Trophy } from "lucide-react";
import { ImportForesporslerModal } from "@/components/ImportForesporslerModal";
import { ForespørselSheet } from "@/components/ForespørselSheet";
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
    <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-2.5 py-0.5 text-[0.6875rem] font-semibold">Direkte</span>
  );
  if (type === "VIA" || type === "via_partner") return (
    <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-2.5 py-0.5 text-[0.6875rem] font-semibold">Partner</span>
  );
  if (type === "via_megler") return (
    <span className="inline-flex items-center rounded-full bg-violet-100 text-violet-700 px-2.5 py-0.5 text-[0.6875rem] font-semibold">Megler</span>
  );
  return <span className="text-[0.8125rem] text-muted-foreground">—</span>;
}

/* ─── Pipeline config ─── */

const PIPELINE: Record<string, { label: string; dot: string; badge: string; step: number | null }> = {
  sendt_cv: { label: "Sendt CV", dot: "bg-amber-400", badge: "bg-amber-50 text-amber-700 border-amber-200", step: 1 },
  intervju: { label: "Intervju", dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700 border-blue-200", step: 2 },
  vunnet:   { label: "Vunnet 🎉", dot: "bg-green-500", badge: "bg-green-50 text-green-700 border-green-200", step: 3 },
  avslag:   { label: "Avslag", dot: "bg-red-400", badge: "bg-red-50 text-red-600 border-red-200", step: null },
};

const PIPELINE_BORDER: Record<string, string> = {
  sendt_cv: "border-l-amber-400",
  intervju: "border-l-blue-500",
  vunnet: "border-l-green-500",
  avslag: "border-l-red-400",
};

function PipelineTrack({ status }: { status: string }) {
  const steps = [1, 2, 3]; // sendt_cv, intervju, vunnet
  const cfg = PIPELINE[status] || PIPELINE.sendt_cv;
  const currentStep = cfg.step;
  const isAvslag = status === "avslag";

  // For avslag: find which step was the last before avslag (default sendt_cv = step 1)
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => {
        let filled = false;
        let color = "bg-muted-foreground/30";

        if (isAvslag) {
          // First node filled amber (was at sendt_cv), rest gray, last filled = red
          if (step === 1) { filled = true; color = "bg-red-400"; }
        } else if (currentStep !== null) {
          if (step <= currentStep) {
            filled = true;
            color = step === currentStep ? cfg.dot : PIPELINE[step === 1 ? "sendt_cv" : step === 2 ? "intervju" : "vunnet"].dot;
          }
        }

        return (
          <div key={step} className="flex items-center">
            {i > 0 && (
              <div className={cn("w-3 h-[2px]", filled ? color : "bg-muted-foreground/20")} />
            )}
            <div className={cn("h-2 w-2 rounded-full", filled ? color : "bg-muted-foreground/20")} />
          </div>
        );
      })}
    </div>
  );
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

/* DeleteButton and AddKonsulentCombobox moved to ForespørselSheet component */

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
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creatingContact, setCreatingContact] = useState(false);
  const [kontaktError, setKontaktError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasMultipleLocations = selectedLocations.length > 1;

  useEffect(() => {
    if (open) {
      setSelskap(""); setSelskapId(null); setSelectedLocations([]);
      setAvdeling(""); setSted(""); setKontakt(""); setKontaktId(null);
      setKommentar(""); setTags([]); setTagInput("");
      setCompanyResults([]); setSluttkunde("");
      setShowCreateContact(false); setNewFirstName(""); setNewLastName("");
      setNewTitle(""); setNewEmail(""); setKontaktError(false);
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
    setShowCreateContact(false);
    setKontaktError(false);
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

  const handleCreateContact = async () => {
    if (!newFirstName.trim() || !newLastName.trim() || !selskapId || creatingContact) return;
    setCreatingContact(true);
    const { data, error } = await supabase.from("contacts").insert({
      first_name: newFirstName.trim(),
      last_name: newLastName.trim(),
      title: newTitle.trim() || null,
      email: newEmail.trim() || null,
      company_id: selskapId,
      created_by: user?.id,
    }).select("id, first_name, last_name").single();
    setCreatingContact(false);
    if (error || !data) {
      toast.error("Kunne ikke opprette kontakt");
      return;
    }
    setKontakt(`${data.first_name} ${data.last_name}`);
    setKontaktId(data.id);
    setShowCreateContact(false);
    setKontaktError(false);
    queryClient.invalidateQueries({ queryKey: ["foresporsler-kontakter", selskapId] });
    toast.success(`${data.first_name} ${data.last_name} opprettet`);
  };

  const handleSubmit = async () => {
    if (!selskap.trim() || submitting) return;
    if (!kontaktId) {
      setKontaktError(true);
      return;
    }
    setSubmitting(true);

    // 1. Insert forespørsel
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

    if (error) {
      setSubmitting(false);
      toast.error("Kunne ikke opprette forespørsel");
      return;
    }

    // 2. Auto-signal: insert "Behov nå" activity
    await supabase.from("activities").insert({
      type: "note",
      subject: "Behov nå",
      description: "[Behov nå]",
      contact_id: kontaktId,
      company_id: selskapId,
      created_by: user?.id,
    });

    // 3. Update company category
    if (selskapId) {
      await supabase.from("companies").update({ category: "Behov nå" }).eq("id", selskapId);
    }

    setSubmitting(false);
    const contactDisplayName = kontakt || "kontakten";
    toast.success(`Forespørsel opprettet · 🔥 Behov nå satt på ${contactDisplayName}`);
    queryClient.invalidateQueries({ queryKey: ["foresporsler-list"] });
    onClose();
  };

  const canSubmit = selskap.trim() && kontaktId && !submitting;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md rounded-xl p-6 gap-0" hideCloseButton>
        <DialogTitle className="text-[1.125rem] font-bold text-foreground mb-5">Ny forespørsel</DialogTitle>

        <div className="space-y-4">
          {/* Selskap */}
          <div>
            <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Selskap <span className="text-destructive">*</span></label>
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

          {/* Kontaktperson — REQUIRED */}
          <div>
            <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Kontaktperson <span className="text-destructive">*</span>
            </label>
            <div className="relative mt-1">
              {!selskapId ? (
                <Input
                  disabled
                  placeholder="Velg selskap først..."
                  className="text-[0.875rem] opacity-50 cursor-not-allowed"
                />
              ) : showCreateContact ? (
                /* Inline create contact form */
                <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-[0.75rem] font-medium text-foreground">Ny kontakt for {selskap}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                      placeholder="Fornavn *"
                      className="text-[0.8125rem] h-8"
                      autoFocus
                    />
                    <Input
                      value={newLastName}
                      onChange={(e) => setNewLastName(e.target.value)}
                      placeholder="Etternavn *"
                      className="text-[0.8125rem] h-8"
                    />
                  </div>
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Tittel (valgfritt)"
                    className="text-[0.8125rem] h-8"
                  />
                  <Input
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="E-post (valgfritt)"
                    className="text-[0.8125rem] h-8"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCreateContact}
                      disabled={!newFirstName.trim() || !newLastName.trim() || creatingContact}
                      className="inline-flex items-center gap-1 h-7 px-3 text-[0.75rem] font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-colors"
                    >
                      {creatingContact ? "Oppretter..." : "Opprett kontakt"}
                    </button>
                    <button
                      onClick={() => setShowCreateContact(false)}
                      className="text-[0.75rem] text-muted-foreground hover:text-foreground"
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Input
                      value={kontakt}
                      onChange={(e) => {
                        setKontakt(e.target.value);
                        setKontaktId(null);
                        setKontaktError(false);
                        setShowKontaktDropdown(true);
                      }}
                      onFocus={() => setShowKontaktDropdown(true)}
                      onBlur={() => setTimeout(() => setShowKontaktDropdown(false), 200)}
                      placeholder="Søk etter kontaktperson..."
                      className={cn("text-[0.875rem]", kontaktError && "border-destructive")}
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
                      {filteredContacts.map((c: any) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setKontakt(`${c.first_name} ${c.last_name}`);
                            setKontaktId(c.id);
                            setKontaktError(false);
                            setShowKontaktDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                          <p className="text-[0.875rem] font-medium">{c.first_name} {c.last_name}</p>
                          {c.title && <p className="text-xs text-muted-foreground">{c.title}</p>}
                        </button>
                      ))}
                      {/* Create new contact option */}
                      <button
                        onClick={() => {
                          setShowKontaktDropdown(false);
                          setShowCreateContact(true);
                          setNewFirstName("");
                          setNewLastName("");
                          setNewTitle("");
                          setNewEmail("");
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors border-t border-border"
                      >
                        <p className="text-[0.8125rem] font-medium text-primary flex items-center gap-1">
                          <Plus className="h-3.5 w-3.5" />
                          Opprett ny kontakt for {selskap}
                        </p>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            {kontaktError && (
              <p className="text-[0.75rem] text-destructive mt-1">
                En forespørsel må alltid knyttes til en kontakt
              </p>
            )}
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
            disabled={!canSubmit}
            onClick={handleSubmit}
            className={`inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg transition-colors ${
              canSubmit
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

/* ForespørselSheet moved to src/components/ForespørselSheet.tsx */

/* ─── Main page ─── */

export default function Foresporsler() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
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
        .select("*, contacts(id, first_name, last_name), foresporsler_konsulenter(id, konsulent_type, status, status_updated_at, stacq_ansatte(navn), external_consultants(navn))")
        .order("mottatt_dato", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const selectedRow = useMemo(() => {
    if (!selectedRowId || !rows) return null;
    return rows.find((r: any) => r.id === selectedRowId) || null;
  }, [selectedRowId, rows]);

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

  const stats = useMemo(() => {
    if (!rows) return { aktive: 0, utenKonsulent: 0, iProsess: 0, vunnet: 0 };
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 45);

    const aktive = rows.filter((r: any) => new Date(r.mottatt_dato) >= cutoff);
    const utenKonsulent = aktive.filter((r: any) => !r.foresporsler_konsulenter || r.foresporsler_konsulenter.length === 0).length;

    const allKonsulenter = aktive.flatMap((r: any) => r.foresporsler_konsulenter || []);
    const iProsess = allKonsulenter.filter((k: any) => k.status === "sendt_cv" || k.status === "intervju").length;

    const allKonsulenterAll = rows.flatMap((r: any) => r.foresporsler_konsulenter || []);
    const vunnet = allKonsulenterAll.filter((k: any) =>
      k.status === "vunnet" && k.status_updated_at && new Date(k.status_updated_at) >= cutoff
    ).length;

    return { aktive: aktive.length, utenKonsulent, iProsess, vunnet };
  }, [rows]);

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg border border-border bg-background text-foreground hover:bg-secondary"
          >
            <FileUp className="h-4 w-4" />
            Importer historikk
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Ny forespørsel
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 rounded-xl px-5 py-4 shadow-sm">
          <ClipboardList className="h-4 w-4 text-blue-600 mb-1" />
          <p className="text-2xl font-bold text-blue-600">{stats.aktive}</p>
          <p className="text-[0.8125rem] text-muted-foreground">Aktive forespørsler</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 rounded-xl px-5 py-4 shadow-sm">
          <UserX className="h-4 w-4 text-amber-600 mb-1" />
          <p className="text-2xl font-bold text-amber-600">{stats.utenKonsulent}</p>
          <p className="text-[0.8125rem] text-muted-foreground">Uten konsulent</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 rounded-xl px-5 py-4 shadow-sm">
          <Users className="h-4 w-4 text-blue-600 mb-1" />
          <p className="text-2xl font-bold text-blue-600">{stats.iProsess}</p>
          <p className="text-[0.8125rem] text-muted-foreground">I prosess</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 rounded-xl px-5 py-4 shadow-sm">
          <Trophy className="h-4 w-4 text-emerald-600 mb-1" />
          <p className="text-2xl font-bold text-emerald-600">{stats.vunnet}</p>
          <p className="text-[0.8125rem] text-muted-foreground">Vunnet (siste 45d)</p>
        </div>
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
          <div className="grid grid-cols-[90px_minmax(0,1.5fr)_minmax(0,1fr)_80px_minmax(0,1.3fr)_minmax(220px,1fr)] gap-3 px-4 py-2.5 border-b border-border bg-background">
            <SortHeader field="mottatt_dato">Mottatt</SortHeader>
            <SortHeader field="selskap_navn">Selskap</SortHeader>
            <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">Kontakt</span>
            <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">Type</span>
            <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">Teknologier</span>
            <SortHeader field="sendt_count">Sendt inn</SortHeader>
          </div>
          {/* Data rows */}
          <div className="divide-y divide-border">
          {sorted.map((row: any) => {
            const days = getDaysAgo(row.mottatt_dato);
            const sendt = row.foresporsler_konsulenter || [];

            return (
              <div
                key={row.id}
                onClick={() => setSelectedRowId(row.id)}
                className="grid grid-cols-[90px_minmax(0,1.5fr)_minmax(0,1fr)_80px_minmax(0,1.3fr)_minmax(220px,1fr)] gap-3 items-center px-4 min-h-[48px] py-2.5 hover:bg-muted/40 transition-colors cursor-pointer"
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
                {/* Kontakt */}
                <span className="text-[0.8125rem] text-foreground truncate">
                  {row.contacts
                    ? `${row.contacts.first_name} ${row.contacts.last_name}`.trim()
                    : <span className="text-muted-foreground">—</span>}
                </span>
                {/* Type */}
                <TypeBadge type={row.type} />
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
                {/* Sendt inn — pipeline */}
                <div className="space-y-1">
                  {sendt.length === 0 ? (
                    <span className="text-[0.8125rem] text-muted-foreground">—</span>
                  ) : (
                    <>
                      {sendt.slice(0, 3).map((k: any) => {
                        const fullName = k.konsulent_type === "intern"
                          ? k.stacq_ansatte?.navn
                          : k.external_consultants?.navn;
                        const shortName = fullName
                          ? `${fullName.split(" ")[0]} ${(fullName.split(" ").pop() || "")[0]}.`
                          : "?";
                        const status = k.status || "sendt_cv";
                        return (
                          <div key={k.id} className="flex items-center gap-2">
                            <span className="text-[0.75rem] text-foreground min-w-[70px] truncate">{shortName}</span>
                            <PipelineTrack status={status} />
                          </div>
                        );
                      })}
                      {sendt.length > 3 && (
                        <span className="text-[0.6875rem] text-muted-foreground">+{sendt.length - 3} til</span>
                      )}
                    </>
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
      <ImportForesporslerModal open={importOpen} onOpenChange={setImportOpen} />

      {/* Detail/Edit Sheet */}
      <Sheet open={!!selectedRow} onOpenChange={(o) => { if (!o) { setSelectedRowId(null); setSheetExpanded(false); } }}>
        <SheetContent side="right" className={cn("p-0 transition-all duration-300 ease-in-out", sheetExpanded ? "w-[860px] sm:max-w-[860px]" : "w-[520px] sm:max-w-[520px]")} hideCloseButton>
          <ForespørselSheet row={selectedRow} onClose={() => { setSelectedRowId(null); setSheetExpanded(false); }} onExpandChange={setSheetExpanded} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
