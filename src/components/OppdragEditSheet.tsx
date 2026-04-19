import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn, formatNOK, getInitials } from "@/lib/utils";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { CalendarIcon, Pencil, Search, X, Building2, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  createOppdragFormState,
  type OppdragFormState,
  type OppdragPersonType,
} from "@/lib/oppdragForm";
import {
  createOppdrag,
  invalidateOppdragQueries,
  terminateOppdrag,
  updateOppdrag,
} from "@/lib/oppdragPersistence";

const LABEL = "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";
const CHIP_BASE = "h-7 px-2.5 text-[0.75rem] rounded-[6px] border transition-colors cursor-pointer select-none font-medium";

const STATUS_OPTIONS = ["Aktiv", "Oppstart", "Inaktiv"] as const;
const TYPE_OPTIONS = [
  { value: "DIR", label: "Direkte" },
  { value: "VIA", label: "Via partner" },
] as const;

interface CompanyResult {
  id: string;
  name: string;
  org_number: string | null;
}

function CompanySearchField({
  currentName,
  currentId,
  onChange,
}: {
  currentName: string | null;
  currentId: string | null;
  onChange: (id: string | null, name: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (editing) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [editing]);

  const searchCompanies = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from("companies")
        .select("id, name, org_number")
        .ilike("name", `%${q.trim()}%`)
        .order("name")
        .limit(8);
      setResults(data || []);
      setLoading(false);
    }, 250);
  };

  const selectCompany = (company: CompanyResult) => {
    onChange(company.id, company.name);
    setEditing(false);
    setQuery("");
    setResults([]);
  };

  const unlinkCompany = () => {
    onChange(null, null);
    setEditing(false);
    setQuery("");
    setResults([]);
  };

  if (editing) {
    return (
      <div className="relative">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => searchCompanies(event.target.value)}
              placeholder="Søk etter selskap..."
              className="w-full h-8 pl-8 pr-3 rounded-lg border border-border bg-background text-[0.8125rem] focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={() => {
              setEditing(false);
              setQuery("");
              setResults([]);
            }}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {results.length > 0 && (
          <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
            {results.map((company) => (
              <button
                key={company.id}
                onClick={() => selectCompany(company)}
                className="w-full px-3 py-2 text-left hover:bg-secondary transition-colors flex items-center gap-2"
              >
                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-[0.8125rem] font-medium text-foreground truncate">{company.name}</p>
                  {company.org_number && (
                    <p className="text-[0.6875rem] text-muted-foreground">Org. {company.org_number}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
        {loading && (
          <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg px-3 py-2">
            <p className="text-[0.75rem] text-muted-foreground">Søker...</p>
          </div>
        )}
        {query.trim().length >= 2 && !loading && results.length === 0 && (
          <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg px-3 py-2">
            <p className="text-[0.75rem] text-muted-foreground">Ingen selskap funnet</p>
          </div>
        )}
      </div>
    );
  }

  if (currentId || currentName) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[0.8125rem] font-medium hover:bg-primary/15 transition-colors"
        >
          <Building2 className="h-3 w-3" />
          {currentName || "Ukjent selskap"}
          <Pencil className="h-3 w-3 opacity-60" />
        </button>
        <button
          onClick={unlinkCompany}
          className="text-muted-foreground hover:text-destructive transition-colors"
          title="Fjern kobling"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-1.5 text-[0.8125rem] text-primary hover:underline"
    >
      <Building2 className="h-3.5 w-3.5" />
      + Koble til selskap
    </button>
  );
}

function PersonSearchField({
  personType,
  selectedName,
  onSelect,
  onClear,
}: {
  personType: OppdragPersonType;
  selectedName: string;
  onSelect: (selection: { kandidat: string; ansattId: number | null; eksternId: string | null }) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: ansatte = [], isLoading: ansatteLoading } = useQuery({
    queryKey: ["oppdrag-create-ansatte"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stacq_ansatte")
        .select("id, navn, kompetanse, status")
        .in("status", ["AKTIV/SIGNERT", "Ledig"])
        .order("navn");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: eksterne = [], isLoading: eksterneLoading } = useQuery({
    queryKey: ["oppdrag-create-eksterne"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_consultants")
        .select("id, navn, teknologier, type, status")
        .in("status", ["aktiv", "ledig"])
        .order("navn");
      if (error) throw error;

      return (data || []).filter((candidate, index, array) => {
        if (!candidate.navn) return false;
        return array.findIndex((entry) => entry.navn === candidate.navn) === index;
      });
    },
  });

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const query = search.trim().toLowerCase();
  const isIntern = personType === "ansatt";
  const loading = isIntern ? ansatteLoading : eksterneLoading;

  const results = (isIntern ? ansatte : eksterne).filter((candidate: any) => {
    const navn = candidate.navn || "";
    return !query || navn.toLowerCase().includes(query);
  });

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSearch("");
      }}
    >
      <div className="flex items-center gap-2">
        <PopoverTrigger asChild>
          <button className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-background text-[0.875rem] text-left text-foreground hover:bg-secondary transition-colors min-w-0 flex-1">
            <UserRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{selectedName || (isIntern ? "Velg ansatt" : "Velg ekstern")}</span>
            <Search className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
          </button>
        </PopoverTrigger>
        {selectedName && (
          <button
            onClick={onClear}
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors"
            title="Fjern valgt person"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <PopoverContent className="w-[360px] p-3" align="start">
        <Input
          ref={inputRef}
          placeholder={isIntern ? "Søk etter ansatt..." : "Søk etter ekstern konsulent..."}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-8 text-sm mb-2"
        />

        <div className="space-y-0.5 max-h-[280px] overflow-y-auto">
          {loading ? (
            <p className="text-[0.8125rem] text-muted-foreground px-2 py-2">Laster...</p>
          ) : results.length === 0 ? (
            <p className="text-[0.8125rem] text-muted-foreground px-2 py-2">Ingen treff</p>
          ) : (
            results.map((candidate: any) => (
              <button
                key={candidate.id}
                onClick={() => {
                  onSelect({
                    kandidat: candidate.navn || "",
                    ansattId: isIntern ? candidate.id : null,
                    eksternId: isIntern ? null : candidate.id,
                  });
                  setOpen(false);
                  setSearch("");
                }}
                className="w-full text-left px-2 py-2 rounded hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "h-6 w-6 rounded-full flex items-center justify-center text-[0.625rem] font-semibold shrink-0",
                      isIntern ? "bg-primary/10 text-primary" : "bg-blue-100 text-blue-700",
                    )}
                  >
                    {getInitials(candidate.navn || "?")}
                  </div>
                  <span className="text-[0.8125rem] font-medium text-foreground">{candidate.navn || "Ukjent"}</span>
                </div>
                {isIntern && candidate.kompetanse?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 ml-8">
                    {(candidate.kompetanse as string[]).slice(0, 3).map((tag: string) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full border border-border bg-muted px-1.5 py-0.5 text-[0.625rem] text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {!isIntern && candidate.type && (
                  <p className="ml-8 mt-1 text-[0.6875rem] text-muted-foreground capitalize">{candidate.type}</p>
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function OppdragEditSheet({
  row,
  onClose,
}: {
  row: any;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [dealType, setDealType] = useState("");
  const [utpris, setUtpris] = useState("");
  const [tilKonsulent, setTilKonsulent] = useState("");
  const [fornyDato, setFornyDato] = useState<Date | undefined>();
  const [startDato, setStartDato] = useState<Date | undefined>();
  const [sluttDato, setSluttDato] = useState<Date | undefined>();
  const [kommentar, setKommentar] = useState("");
  const [selskapId, setSelskapId] = useState<string | null>(null);
  const [selskapNavn, setSelskapNavn] = useState<string | null>(null);
  const [isLopende, setIsLopende] = useState(false);
  const [kandidat, setKandidat] = useState("");
  const [personType, setPersonType] = useState<OppdragPersonType>("ansatt");
  const [ansattId, setAnsattId] = useState<number | null>(null);
  const [eksternId, setEksternId] = useState<string | null>(null);
  const [confirmTerminate, setConfirmTerminate] = useState(false);

  const isCreateMode = !row;

  useEffect(() => {
    if (!row) {
      const defaults = createOppdragFormState();
      setStatus(defaults.status);
      setDealType(defaults.dealType);
      setUtpris(defaults.utpris);
      setTilKonsulent(defaults.tilKonsulent);
      setFornyDato(defaults.fornyDato);
      setStartDato(defaults.startDato);
      setSluttDato(defaults.sluttDato);
      setKommentar(defaults.kommentar);
      setSelskapId(defaults.selskapId);
      setSelskapNavn(defaults.selskapNavn);
      setIsLopende(defaults.isLopende);
      setKandidat(defaults.kandidat);
      setPersonType(defaults.personType);
      setAnsattId(defaults.ansattId);
      setEksternId(defaults.eksternId);
      setConfirmTerminate(false);
      return;
    }

    setStatus(row.status || "Aktiv");
    setDealType(row.deal_type === "VIA_M" ? "VIA" : row.deal_type || "DIR");
    setUtpris(String(row.utpris || ""));
    setTilKonsulent(String(row.til_konsulent || ""));
    setStartDato(row.start_dato ? new Date(row.start_dato) : undefined);
    setSluttDato(row.slutt_dato ? new Date(row.slutt_dato) : undefined);
    setKommentar(row.kommentar || "");
    setSelskapId(row.selskap_id || null);
    setSelskapNavn(row.kunde || null);
    setKandidat(row.kandidat || "");
    setPersonType(
      row.ekstern_id ? "ekstern" : row.ansatt_id ? "ansatt" : row.er_ansatt === false ? "ekstern" : "ansatt",
    );
    setAnsattId(row.ansatt_id ?? null);
    setEksternId(row.ekstern_id ?? null);
    setConfirmTerminate(false);
    setIsLopende(row.lopende_30_dager === true);

    if (row.lopende_30_dager) {
      const renewal = new Date();
      renewal.setDate(renewal.getDate() + 30);
      setFornyDato(renewal);
    } else {
      setFornyDato(row.forny_dato ? new Date(row.forny_dato) : undefined);
    }
  }, [row?.id, isCreateMode]);

  const marginPerTime = (Number(utpris) || 0) - (Number(tilKonsulent) || 0);
  const marginPct = Number(utpris) > 0 ? (marginPerTime / Number(utpris)) * 100 : 0;

  const handleCompanyChange = (id: string | null, name: string | null) => {
    setSelskapId(id);
    setSelskapNavn(name);
  };

  const handlePersonChange = (type: OppdragPersonType) => {
    setPersonType(type);
    setKandidat("");
    setAnsattId(null);
    setEksternId(null);
  };

  const buildFormState = (): OppdragFormState =>
    createOppdragFormState({
      kandidat,
      personType,
      ansattId,
      eksternId,
      status,
      dealType,
      utpris,
      tilKonsulent,
      fornyDato,
      startDato,
      sluttDato,
      kommentar,
      selskapId,
      selskapNavn,
      isLopende,
    });

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);

    try {
      const formState = buildFormState();

      if (isCreateMode) {
        await createOppdrag(formState);
        toast.success("Oppdrag opprettet");
      } else {
        await updateOppdrag(row.id, formState, {
          allowMissingRelation: !row.ansatt_id && !row.ekstern_id,
        });
        toast.success("Oppdrag oppdatert");
      }

      await invalidateOppdragQueries(queryClient);
      onClose();
    } catch (error: any) {
      toast.error(error.message || (isCreateMode ? "Kunne ikke opprette oppdrag" : "Kunne ikke oppdatere oppdrag"));
    } finally {
      setSaving(false);
    }
  };

  const handleTerminate = async () => {
    try {
      await terminateOppdrag(row.id);
      await invalidateOppdragQueries(queryClient);
      toast.success("Oppdrag avsluttet");
      onClose();
    } catch {
      toast.error("Kunne ikke avslutte oppdrag");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border">
        <h2 className="text-[1.25rem] font-bold text-foreground">
          {isCreateMode ? "Nytt oppdrag" : kandidat || "Oppdrag"}
        </h2>

        {isCreateMode ? (
          <div className="mt-4 space-y-4">
            <div>
              <p className={cn(LABEL, "mb-1.5")}>Konsulenttype</p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handlePersonChange("ansatt")}
                  className={cn(
                    CHIP_BASE,
                    personType === "ansatt"
                      ? "bg-foreground text-background border-foreground"
                      : "border-border text-muted-foreground hover:bg-secondary",
                  )}
                >
                  Ansatt
                </button>
                <button
                  onClick={() => handlePersonChange("ekstern")}
                  className={cn(
                    CHIP_BASE,
                    personType === "ekstern"
                      ? "bg-foreground text-background border-foreground"
                      : "border-border text-muted-foreground hover:bg-secondary",
                  )}
                >
                  Ekstern
                </button>
              </div>
            </div>

            <div>
              <p className={cn(LABEL, "mb-1.5")}>Konsulent</p>
              <PersonSearchField
                personType={personType}
                selectedName={kandidat}
                onSelect={(selection) => {
                  setKandidat(selection.kandidat);
                  setAnsattId(selection.ansattId);
                  setEksternId(selection.eksternId);
                }}
                onClear={() => {
                  setKandidat("");
                  setAnsattId(null);
                  setEksternId(null);
                }}
              />
            </div>

            <div>
              <p className={cn(LABEL, "mb-1.5")}>Kunde</p>
              <CompanySearchField
                currentName={selskapNavn}
                currentId={selskapId}
                onChange={handleCompanyChange}
              />
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <p className={cn(LABEL, "mb-1.5")}>Kunde</p>
            <CompanySearchField
              currentName={selskapNavn}
              currentId={selskapId}
              onChange={handleCompanyChange}
            />
          </div>
        )}

        {row?.created_at && (
          <p className="text-[0.75rem] text-muted-foreground mt-2">
            Opprettet {format(new Date(row.created_at), "d. MMM yyyy", { locale: nb })}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <div>
          <p className={LABEL}>Status</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setStatus(option)}
                className={cn(
                  CHIP_BASE,
                  status === option
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:bg-secondary",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className={LABEL}>Type</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setDealType(option.value)}
                className={cn(
                  CHIP_BASE,
                  dealType === option.value
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:bg-secondary",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={LABEL}>Utpris / time</label>
          <Input
            type="number"
            value={utpris}
            onChange={(event) => setUtpris(event.target.value)}
            className="mt-1 text-[0.875rem]"
            placeholder="f.eks. 1550"
          />
        </div>

        <div>
          <label className={LABEL}>Innpris / time</label>
          <Input
            type="number"
            value={tilKonsulent}
            onChange={(event) => setTilKonsulent(event.target.value)}
            className="mt-1 text-[0.875rem]"
            placeholder="f.eks. 1100"
          />
        </div>

        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className={LABEL}>Margin (beregnet)</p>
          <p
            className={cn(
              "text-[1.0625rem] font-bold mt-1",
              marginPerTime > 0 ? "text-emerald-600" : marginPerTime < 0 ? "text-destructive" : "text-foreground",
            )}
          >
            kr {formatNOK(marginPerTime)}/t · {marginPct.toFixed(1)}%
          </p>
        </div>

        <div>
          <label className={LABEL}>Fornyes / utløper</label>
          <div className="mt-1">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  disabled={isLopende}
                  className={cn(
                    "w-full h-9 px-3 rounded-lg border border-border bg-background text-left text-[0.875rem] flex items-center gap-2",
                    !fornyDato && "text-muted-foreground",
                    isLopende && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  {fornyDato ? format(fornyDato, "d. MMMM yyyy", { locale: nb }) : "Velg dato"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fornyDato}
                  onSelect={setFornyDato}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              id="lopende"
              checked={isLopende}
              onChange={(event) => {
                const nextValue = event.target.checked;
                setIsLopende(nextValue);
                if (nextValue) {
                  const renewal = new Date();
                  renewal.setDate(renewal.getDate() + 30);
                  setFornyDato(renewal);
                }
              }}
              className="h-4 w-4 rounded border-border"
            />
            <label htmlFor="lopende" className="text-[0.8125rem] text-muted-foreground cursor-pointer select-none">
              Løpende 30 dager — oppsigelsestid fra dagens dato
            </label>
          </div>
          {isLopende && fornyDato && (
            <p className="text-[0.75rem] text-muted-foreground ml-6 mt-1">
              Utløper: {format(fornyDato, "d. MMMM yyyy", { locale: nb })}
            </p>
          )}
        </div>

        <div>
          <label className={LABEL}>Startdato</label>
          <div className="mt-1">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "w-full h-9 px-3 rounded-lg border border-border bg-background text-left text-[0.875rem] flex items-center gap-2",
                    !startDato && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  {startDato ? format(startDato, "d. MMMM yyyy", { locale: nb }) : "Velg dato"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDato}
                  onSelect={setStartDato}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div>
          <label className={LABEL}>Kommentar</label>
          <textarea
            value={kommentar}
            onChange={(event) => setKommentar(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            placeholder="Interne notater om oppdraget..."
          />
        </div>
      </div>

      <div className="px-6 py-4 border-t border-border space-y-3">
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-9 text-[0.8125rem] rounded-lg border border-border text-muted-foreground hover:bg-secondary transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-9 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "Lagrer..." : isCreateMode ? "Opprett oppdrag" : "Lagre endringer"}
          </button>
        </div>

        {!isCreateMode && status !== "Inaktiv" && (
          <div>
            {!confirmTerminate ? (
              <button
                onClick={() => setConfirmTerminate(true)}
                className="text-[0.8125rem] text-destructive hover:underline"
              >
                Avslutt oppdrag
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-[0.8125rem] text-foreground font-medium">Er du sikker?</span>
                <button
                  onClick={handleTerminate}
                  className="text-[0.8125rem] text-destructive font-medium hover:underline"
                >
                  Ja, avslutt
                </button>
                <button
                  onClick={() => setConfirmTerminate(false)}
                  className="text-[0.8125rem] text-muted-foreground hover:text-foreground"
                >
                  Avbryt
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
