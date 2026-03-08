import { useState, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Upload, FileText, Loader2, Check, X, AlertCircle, Search, CloudOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

/* ─── Types ─── */
type Tab = "ansatte" | "eksterne";
type ConsultantType = "freelance" | "via_partner";

interface ParsedCV {
  file: File;
  status: "pending" | "parsing" | "done" | "error";
  data: {
    navn?: string;
    erfaring_aar?: number;
    kompetanse?: string[];
    geografi?: string;
    bio?: string;
  } | null;
  matchedId: number | string | null;
  matchedName: string | null;
  matchScore: number;
  // for eksterne
  type: ConsultantType;
  partnerId: string | null;
  partnerName: string | null;
}

/* ─── Fuzzy match helper ─── */
function fuzzyScore(a: string, b: string): number {
  const al = a.toLowerCase().trim();
  const bl = b.toLowerCase().trim();
  if (al === bl) return 1;
  if (al.includes(bl) || bl.includes(al)) return 0.8;
  const aParts = al.split(/\s+/);
  const bParts = bl.split(/\s+/);
  const matches = aParts.filter(p => bParts.some(bp => bp === p || bp.startsWith(p) || p.startsWith(bp)));
  if (matches.length >= 2) return 0.7;
  if (matches.length === 1 && aParts.length <= 2) return 0.5;
  return 0;
}

/* ─── Chip styles ─── */
const CHIP_BASE = "h-8 px-4 text-[0.8125rem] rounded-full border transition-colors cursor-pointer select-none font-medium";
const CHIP_ON = `${CHIP_BASE} bg-foreground text-background border-foreground`;
const CHIP_OFF = `${CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;
const LABEL = "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

const TYPE_CHIP_BASE = "h-7 px-2.5 text-[0.75rem] rounded-full border transition-colors cursor-pointer select-none font-medium";
const TYPE_CHIP_ON = `${TYPE_CHIP_BASE} bg-foreground text-background border-foreground`;
const TYPE_CHIP_OFF = `${TYPE_CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;

export default function ImporterCver() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("ansatte");
  const [cvs, setCvs] = useState<ParsedCV[]>([]);
  const [processing, setProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Fetch existing records for matching
  const { data: ansatte = [] } = useQuery({
    queryKey: ["stacq-ansatte"],
    queryFn: async () => {
      const { data } = await supabase.from("stacq_ansatte").select("id, navn, kompetanse");
      return data || [];
    },
  });

  const { data: eksterne = [] } = useQuery({
    queryKey: ["external-consultants-all"],
    queryFn: async () => {
      const { data } = await supabase.from("external_consultants").select("id, navn, teknologier");
      return data || [];
    },
  });

  const parseSingleCv = async (file: File): Promise<ParsedCV["data"]> => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const { data, error } = await supabase.functions.invoke("parse-cv", {
      body: { base64, filename: file.name },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const matchToExisting = useCallback(
    (navn: string | undefined, currentTab: Tab) => {
      if (!navn) return { id: null, name: null, score: 0 };
      const list = currentTab === "ansatte" ? ansatte : eksterne;
      let bestId: number | string | null = null;
      let bestName: string | null = null;
      let bestScore = 0;
      for (const item of list) {
        const itemName = item.navn || "";
        const score = fuzzyScore(navn, itemName);
        if (score > bestScore) {
          bestScore = score;
          bestId = item.id;
          bestName = itemName;
        }
      }
      return bestScore >= 0.5 ? { id: bestId, name: bestName, score: bestScore } : { id: null, name: null, score: 0 };
    },
    [ansatte, eksterne]
  );

  const handleFiles = async (files: FileList | File[]) => {
    const pdfFiles = Array.from(files).filter(f => f.type === "application/pdf" || f.name.endsWith(".pdf"));
    if (pdfFiles.length === 0) { toast.error("Kun PDF-filer støttes"); return; }

    const newCvs: ParsedCV[] = pdfFiles.map(f => ({
      file: f,
      status: "pending" as const,
      data: null,
      matchedId: null,
      matchedName: null,
      matchScore: 0,
      type: "freelance" as ConsultantType,
      partnerId: null,
      partnerName: null,
    }));

    setCvs(prev => [...prev, ...newCvs]);
    setProcessing(true);

    const startIdx = cvs.length;
    for (let i = 0; i < pdfFiles.length; i++) {
      const idx = startIdx + i;
      setCvs(prev => prev.map((c, j) => j === idx ? { ...c, status: "parsing" } : c));

      try {
        const data = await parseSingleCv(pdfFiles[i]);
        const match = matchToExisting(data?.navn, tab);
        setCvs(prev => prev.map((c, j) =>
          j === idx ? { ...c, status: "done", data, matchedId: match.id, matchedName: match.name, matchScore: match.score } : c
        ));
      } catch (err: any) {
        console.error("CV parse error:", err);
        setCvs(prev => prev.map((c, j) => j === idx ? { ...c, status: "error" } : c));
      }
    }
    setProcessing(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleFiles(e.target.files);
    e.target.value = "";
  };

  const updateCv = (idx: number, update: Partial<ParsedCV>) => {
    setCvs(prev => prev.map((c, i) => i === idx ? { ...c, ...update } : c));
  };

  const removeCv = (idx: number) => {
    setCvs(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Save handlers ──

  const saveAnsattUpdate = async (cv: ParsedCV) => {
    if (!cv.matchedId || !cv.data) return;
    const { error } = await supabase.from("stacq_ansatte").update({
      kompetanse: cv.data.kompetanse || [],
      bio: cv.data.bio || null,
      erfaring_aar: cv.data.erfaring_aar || null,
      geografi: cv.data.geografi || null,
      updated_at: new Date().toISOString(),
    }).eq("id", cv.matchedId as number);
    if (error) throw error;
  };

  const saveAnsattNew = async (cv: ParsedCV) => {
    if (!cv.data) return;
    const { error } = await supabase.from("stacq_ansatte").insert({
      navn: cv.data.navn || cv.file.name.replace(".pdf", ""),
      kompetanse: cv.data.kompetanse || [],
      bio: cv.data.bio || null,
      erfaring_aar: cv.data.erfaring_aar || null,
      geografi: cv.data.geografi || null,
      status: "AKTIV/SIGNERT",
    });
    if (error) throw error;
  };

  const saveEksternUpdate = async (cv: ParsedCV) => {
    if (!cv.matchedId || !cv.data) return;
    const { error } = await supabase.from("external_consultants").update({
      teknologier: cv.data.kompetanse || [],
      cv_tekst: cv.data.bio || null,
      updated_at: new Date().toISOString(),
    }).eq("id", cv.matchedId as string);
    if (error) throw error;
  };

  const saveEksternNew = async (cv: ParsedCV) => {
    if (!cv.data) return;
    if (!cv.type) { toast.error("Velg type (Freelance / Via partner)"); return; }
    const { error } = await supabase.from("external_consultants").insert({
      navn: cv.data.navn || cv.file.name.replace(".pdf", ""),
      teknologier: cv.data.kompetanse || [],
      cv_tekst: cv.data.bio || null,
      type: cv.type,
      company_id: cv.type === "via_partner" ? cv.partnerId : null,
      status: "ledig",
    });
    if (error) throw error;
  };

  const handleSave = async (idx: number, mode: "update" | "new") => {
    const cv = cvs[idx];
    try {
      if (tab === "ansatte") {
        if (mode === "update") await saveAnsattUpdate(cv);
        else await saveAnsattNew(cv);
      } else {
        if (mode === "update") await saveEksternUpdate(cv);
        else await saveEksternNew(cv);
      }
      toast.success(mode === "update" ? `✓ Lagret — teknologier og CV oppdatert for ${cv.matchedName || cv.data?.navn || "konsulent"}` : `${cv.data?.navn || "Konsulent"} opprettet`);
      removeCv(idx);
      queryClient.invalidateQueries({ queryKey: tab === "ansatte" ? ["stacq-ansatte"] : ["external-consultants-all"] });
    } catch (err: any) {
      toast.error("Kunne ikke lagre: " + (err.message || "Ukjent feil"));
    }
  };

  const handleBulkUpdate = async () => {
    const matched = cvs.filter(c => c.status === "done" && c.matchedId);
    if (matched.length === 0) return;
    let success = 0;
    for (const cv of matched) {
      try {
        if (tab === "ansatte") await saveAnsattUpdate(cv);
        else await saveEksternUpdate(cv);
        success++;
      } catch { /* skip */ }
    }
    setCvs(prev => prev.filter(c => !(c.status === "done" && c.matchedId)));
    queryClient.invalidateQueries({ queryKey: tab === "ansatte" ? ["stacq-ansatte"] : ["external-consultants-all"] });
    toast.success(`${success} av ${matched.length} oppdatert`);
  };

  const doneCvs = cvs.filter(c => c.status === "done");
  const matchedCount = doneCvs.filter(c => c.matchedId).length;
  const parsingCount = cvs.filter(c => c.status === "parsing").length;
  const pendingCount = cvs.filter(c => c.status === "pending").length;
  const totalProcessing = parsingCount + pendingCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[1.5rem] font-bold text-foreground">Importer CVer</h1>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        <button className={tab === "ansatte" ? CHIP_ON : CHIP_OFF} onClick={() => { setTab("ansatte"); setCvs([]); }}>
          Ansatte
        </button>
        <button className={tab === "eksterne" ? CHIP_ON : CHIP_OFF} onClick={() => { setTab("eksterne"); setCvs([]); }}>
          Eksterne konsulenter
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-primary/5"
        )}
      >
        <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-[0.9375rem] font-medium text-foreground">
          Dra og slipp PDF-filer her, eller klikk for å velge
        </p>
        <p className="text-[0.8125rem] text-muted-foreground mt-1">
          CVer analyseres sekvensielt med AI — navn, kompetanse og erfaring hentes ut automatisk
        </p>
      </div>
      <input ref={fileRef} type="file" accept=".pdf" multiple className="hidden" onChange={handleFileInput} />

      {/* Progress */}
      {totalProcessing > 0 && (
        <div className="flex items-center gap-2 text-[0.8125rem] text-primary font-medium">
          <Loader2 className="h-4 w-4 animate-spin" />
          {cvs.filter(c => c.status === "done" || c.status === "error").length}/{cvs.length} behandlet...
        </div>
      )}

      {/* Bulk update */}
      {matchedCount > 0 && !processing && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleBulkUpdate}
            className="inline-flex items-center gap-2 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Check className="h-4 w-4" />
            Oppdater alle matchede ({matchedCount})
          </button>
        </div>
      )}

      {/* Results */}
      {doneCvs.length > 0 && (
        <div className="space-y-3">
          {cvs.map((cv, idx) => {
            if (cv.status === "pending" || cv.status === "parsing") {
              return (
                <div key={idx} className="rounded-lg border border-border bg-card p-4 animate-pulse">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-[0.875rem] font-medium text-foreground">{cv.file.name}</span>
                    <span className="text-[0.75rem] text-muted-foreground ml-auto">
                      {cv.status === "parsing" ? "Analyserer..." : "Venter..."}
                    </span>
                  </div>
                </div>
              );
            }

            if (cv.status === "error") {
              return (
                <div key={idx} className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-[0.875rem] font-medium text-foreground">{cv.file.name}</span>
                    <span className="text-[0.75rem] text-destructive ml-auto">Feilet</span>
                    <button onClick={() => removeCv(idx)} className="ml-2 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            }

            // Done
            return (
              <div key={idx} className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-[0.9375rem] font-bold text-foreground">{cv.data?.navn || cv.file.name}</span>
                    </div>
                    {cv.data?.geografi && (
                      <p className="text-[0.8125rem] text-muted-foreground mt-0.5">{cv.data.geografi} · {cv.data.erfaring_aar || "?"} års erfaring</p>
                    )}
                  </div>
                  <button onClick={() => removeCv(idx)} className="text-muted-foreground hover:text-foreground shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Kompetanse tags */}
                {cv.data?.kompetanse && cv.data.kompetanse.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {cv.data.kompetanse.map(t => (
                      <span key={t} className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-[0.6875rem] font-medium text-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Match info */}
                {cv.matchedId ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <p className="text-[0.8125rem] text-emerald-800 font-medium">
                      ✓ Matchet med: {cv.matchedName} ({Math.round(cv.matchScore * 100)}% sannsynlighet)
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-[0.8125rem] text-amber-800 font-medium">
                      Ingen eksisterende match funnet
                    </p>
                  </div>
                )}

                {/* TYPE selector for eksterne */}
                {tab === "eksterne" && !cv.matchedId && (
                  <div className="space-y-2">
                    <p className={LABEL}>Type</p>
                    <div className="flex gap-2">
                      <button
                        className={cv.type === "freelance" ? TYPE_CHIP_ON : TYPE_CHIP_OFF}
                        onClick={() => updateCv(idx, { type: "freelance", partnerId: null, partnerName: null })}
                      >
                        Freelance
                      </button>
                      <button
                        className={cv.type === "via_partner" ? TYPE_CHIP_ON : TYPE_CHIP_OFF}
                        onClick={() => updateCv(idx, { type: "via_partner" })}
                      >
                        Via partner
                      </button>
                    </div>
                    {cv.type === "via_partner" && (
                      <PartnerSearch
                        selectedId={cv.partnerId}
                        selectedName={cv.partnerName}
                        onSelect={(id, name) => updateCv(idx, { partnerId: id, partnerName: name })}
                      />
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  {cv.matchedId && (
                    <div className="flex flex-col gap-0.5">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleSave(idx, "update")}
                              className="inline-flex items-center gap-1.5 h-8 px-3 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Lagre til {cv.matchedName || "matchet"}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Lagrer: teknologier[], cv_tekst til {tab === "ansatte" ? "stacq_ansatte" : "external_consultants"}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <span className="text-[0.6875rem] text-muted-foreground">Oppdaterer teknologier og lagrer CV-tekst for matching</span>
                    </div>
                  )}
                  <button
                    onClick={() => handleSave(idx, "new")}
                    className="inline-flex items-center gap-1.5 h-8 px-3 text-[0.8125rem] font-medium rounded-lg border border-border bg-background text-foreground hover:bg-secondary transition-colors"
                  >
                    {tab === "ansatte" ? "Opprett ny ansatt" : "Opprett ny ekstern"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SharePoint placeholder */}
      <div className="rounded-xl border border-border bg-muted/30 p-6 opacity-50">
        <div className="flex items-center gap-3">
          <CloudOff className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-[0.875rem] font-medium text-muted-foreground">SharePoint-integrasjon</p>
            <p className="text-[0.8125rem] text-muted-foreground">Automatisk import fra SharePoint kommer snart</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Partner company search (inline) ─── */
function PartnerSearch({
  selectedId,
  selectedName,
  onSelect,
}: {
  selectedId: string | null;
  selectedName: string | null;
  onSelect: (id: string, name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const search = (q: string) => {
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.length < 2) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name")
        .ilike("name", `%${q}%`)
        .limit(5);
      setResults(data || []);
    }, 250);
  };

  if (selectedId) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[0.8125rem] font-medium text-foreground">{selectedName}</span>
        <button onClick={() => { onSelect("", ""); setQuery(""); }} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Søk partnerselskap..."
          className="pl-8 h-8 text-[0.8125rem]"
        />
      </div>
      {results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-md max-h-[160px] overflow-y-auto">
          {results.map(c => (
            <button
              key={c.id}
              onClick={() => { onSelect(c.id, c.name); setResults([]); setQuery(""); }}
              className="w-full text-left px-3 py-2 hover:bg-muted/50 text-[0.8125rem] font-medium"
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
