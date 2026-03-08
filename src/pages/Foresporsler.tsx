import { useState, useRef, useEffect, useMemo } from "react";
import { Plus, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format, differenceInDays } from "date-fns";
import { nb } from "date-fns/locale";

type StatusFilter = "Alle" | "Ny" | "Aktiv" | "Fullført" | "Tapt";

const CHIP_BASE = "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors cursor-pointer select-none";
const CHIP_OFF = `${CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;
const CHIP_ON = `${CHIP_BASE} bg-foreground text-background border-foreground font-medium`;

const SUGGESTED_TAGS = ["C", "C++", "Embedded", "Python", "Yocto", "Linux", "Lab", "Sikkerhet", "Rust", "Java"];

function getDaysAgo(d: string): number {
  return differenceInDays(new Date(), new Date(d));
}

function getMottattClass(days: number): string {
  if (days <= 7) return "text-foreground font-medium";
  if (days <= 21) return "text-amber-600 font-medium";
  return "text-destructive font-medium";
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
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
  const [companyResults, setCompanyResults] = useState<Array<{ id: string; name: string; city: string | null }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasMultipleLocations = selectedLocations.length > 1;

  useEffect(() => {
    if (open) {
      setSelskap(""); setSelskapId(null); setSelectedLocations([]);
      setAvdeling(""); setSted(""); setKontakt(""); setKontaktId(null);
      setKommentar(""); setTags([]); setTagInput("");
      setCompanyResults([]);
    }
  }, [open]);

  // Debounced company search
  const searchCompanies = (query: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.length < 1) { setCompanyResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name, city")
        .ilike("name", `%${query}%`)
        .limit(8);
      if (data) setCompanyResults(data);
    }, 300);
  };

  const selectCompany = (c: { id: string; name: string; city: string | null }) => {
    setSelskap(c.name);
    setSelskapId(c.id);
    setAvdeling("");
    setKontakt("");
    setKontaktId(null);
    setShowKontaktDropdown(false);
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

  // Load contacts for selected company
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
              <Input
                value={kontakt}
                onChange={(e) => {
                  setKontakt(e.target.value);
                  setKontaktId(null);
                  setShowKontaktDropdown(true);
                  searchContacts(e.target.value);
                }}
                onFocus={() => setShowKontaktDropdown(true)}
                onBlur={() => setTimeout(() => setShowKontaktDropdown(false), 200)}
                placeholder="Søk etter kontaktperson..."
                className="text-[0.875rem]"
              />
              {showKontaktDropdown && contactResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-md max-h-48 overflow-auto">
                  {contactResults.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setKontakt(`${c.first_name} ${c.last_name}`);
                        setKontaktId(c.id);
                        setShowKontaktDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-[0.8125rem] hover:bg-secondary transition-colors"
                    >
                      {c.first_name} {c.last_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Teknologier */}
          <div>
            <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Teknologier</label>
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

/* ─── Detail placeholder ─── */

function ForespørselDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["foresporsel-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foresporsler")
        .select("*, contacts(id, first_name, last_name)")
        .eq("id", Number(id))
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <p className="text-muted-foreground py-12 text-center">Laster...</p>;
  if (!data) return <p className="text-muted-foreground py-12 text-center">Fant ikke forespørsel</p>;

  return (
    <div className="space-y-4">
      <button onClick={() => navigate("/foresporsler")} className="text-[0.8125rem] text-primary hover:underline">
        ← Tilbake til forespørsler
      </button>
      <h1 className="text-[1.5rem] font-bold text-foreground">{data.selskap_navn}</h1>
      <div className="text-muted-foreground text-[0.875rem] space-y-1">
        {data.sted && <p>Sted: {data.sted}</p>}
        {data.teknologier && data.teknologier.length > 0 && (
          <p>Teknologier: {data.teknologier.join(", ")}</p>
        )}
        {data.kommentar && <p>Kommentar: {data.kommentar}</p>}
        <p>Status: {data.status}</p>
        <p>Mottatt: {data.mottatt_dato}</p>
        {data.frist_dato && <p>Frist: {data.frist_dato}</p>}
      </div>
    </div>
  );
}

/* ─── Main page ─── */

export default function Foresporsler() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Alle");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["foresporsler-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foresporsler")
        .select("*, contacts(id, first_name, last_name)")
        .order("mottatt_dato", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (statusFilter === "Alle") return r.status !== "Tapt";
      return r.status === statusFilter;
    });
  }, [rows, statusFilter]);

  // If we have an ID param, show detail view
  if (id) return <ForespørselDetail id={id} />;

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
      <div className="flex items-center gap-2">
        {(["Alle", "Ny", "Aktiv", "Fullført", "Tapt"] as StatusFilter[]).map((f) => (
          <button key={f} className={statusFilter === f ? CHIP_ON : CHIP_OFF} onClick={() => setStatusFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Laster...</div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.07)] overflow-hidden">
          <table className="w-full text-[0.8125rem]">
            <thead>
              <tr className="border-b border-border">
                {["MOTTATT", "SELSKAP", "STED", "TEKNOLOGIER", "SENDT INN"].map((h) => (
                  <th key={h} className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground text-left px-3 py-2.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const days = getDaysAgo(row.mottatt_dato);
                const isNew = (row.status === "Ny" || row.status === "Aktiv") && row.antall_sendt === 0;
                const isAging = row.status === "Aktiv" && days > 21;

                return (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/foresporsler/${row.id}`)}
                    className={`border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer ${
                      isNew ? "border-l-[3px] border-l-amber-400" : isAging ? "border-l-[3px] border-l-destructive/40" : ""
                    }`}
                  >
                    <td className={`px-3 py-2.5 ${getMottattClass(days)}`}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{days} dager siden</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {format(new Date(row.mottatt_dato), "d. MMM yyyy", { locale: nb })}
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium hover:text-primary">{row.selskap_navn}</span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground text-sm">{row.sted}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {(row.teknologier || []).slice(0, 3).map((t: string) => (
                          <span key={t} className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[0.6875rem] text-muted-foreground">{t}</span>
                        ))}
                        {(row.teknologier || []).length > 3 && (
                          <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[0.6875rem] text-muted-foreground">
                            +{row.teknologier!.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {row.antall_sendt === 0 ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-[0.6875rem] font-semibold">
                          0 sendt
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground">{row.antall_sendt}</span>
                          {row.hvem_sendt && (
                            <span className="text-muted-foreground text-[0.75rem]">{truncate(row.hvem_sendt, 25)}</span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground">
                    Ingen forespørsler å vise
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <NyForesporselModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
