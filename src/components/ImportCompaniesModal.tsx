import { useState, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/sonner";
import { Upload, CheckCircle2, AlertTriangle, XCircle, Loader2, ArrowRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { findBestCompanyMatch, normalizeCompanyName } from "@/lib/companyMatch";

type ParsedRow = {
  selskap: string;
  bransje: string;
  sted: string;
  url: string;
  linkedin: string;
  org_nr: string;
  nace: string;
  ansatte: string;
  kontaktpersoner: string;
};

type ClassifiedRow = ParsedRow & {
  status: "new" | "duplicate" | "possible_duplicate";
  existingName?: string;
  existingId?: string;
  selected: boolean;
  forceImport?: boolean;
};

type ExistingCompanyCandidate = {
  id: string;
  name: string;
  org_number: string | null;
  aliases: string[];
};

function matchesExactCompanyIdentity(name: string, candidate: ExistingCompanyCandidate): boolean {
  const normalized = normalizeCompanyName(name);
  if (!normalized) return false;

  return [candidate.name, ...candidate.aliases].some((value) => normalizeCompanyName(value) === normalized);
}

export function ImportCompaniesModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [rows, setRows] = useState<ClassifiedRow[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState({ imported: 0, skipped: 0 });
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

    const parsed: ParsedRow[] = json.map((r) => ({
      selskap: String(r["Selskap"] || r["selskap"] || "").trim(),
      bransje: String(r["Bransje"] || r["bransje"] || "").trim(),
      sted: String(r["Sted"] || r["sted"] || "").trim(),
      url: String(r["URL"] || r["url"] || r["Url"] || "").trim(),
      linkedin: String(r["Linkedin"] || r["linkedin"] || r["LinkedIn"] || "").trim(),
      org_nr: String(r["Organisasjonsnummer"] || r["organisasjonsnummer"] || r["Org.nr"] || "").replace(/\D/g, "").trim(),
      nace: String(r["NACE"] || r["nace"] || "").trim(),
      ansatte: String(r["Antall ansatte"] || r["antall_ansatte"] || "").trim(),
      kontaktpersoner: String(r["Kontaktpersoner"] || r["kontaktpersoner"] || "").trim(),
    })).filter((r) => r.selskap);

    const [{ data: existing, error: existingError }, { data: aliases, error: aliasesError }] = await Promise.all([
      supabase.from("companies").select("id, name, org_number"),
      supabase.from("company_aliases").select("company_id, alias_name"),
    ]);

    if (existingError || aliasesError) {
      throw existingError || aliasesError;
    }

    const aliasMap = new Map<string, string[]>();
    (aliases || []).forEach((alias) => {
      const values = aliasMap.get(alias.company_id) || [];
      values.push(alias.alias_name);
      aliasMap.set(alias.company_id, values);
    });

    const existingCompanies: ExistingCompanyCandidate[] = (existing || []).map((company) => ({
      id: company.id,
      name: company.name,
      org_number: company.org_number,
      aliases: aliasMap.get(company.id) || [],
    }));

    const existingByOrg = new Map<string, ExistingCompanyCandidate>();
    existingCompanies.forEach((company) => {
      if (company.org_number) existingByOrg.set(company.org_number.replace(/\D/g, ""), company);
    });

    const classified: ClassifiedRow[] = parsed.map((r) => {
      // Exact org_nr match
      if (r.org_nr && existingByOrg.has(r.org_nr)) {
        const ex = existingByOrg.get(r.org_nr)!;
        return { ...r, status: "duplicate", existingName: ex.name, existingId: ex.id, selected: false };
      }
      const matchedCompany = findBestCompanyMatch(r.selskap, existingCompanies);
      if (matchedCompany) {
        const exactIdentityMatch = matchesExactCompanyIdentity(r.selskap, matchedCompany);
        return {
          ...r,
          status: exactIdentityMatch ? "duplicate" : "possible_duplicate",
          existingName: matchedCompany.name,
          existingId: matchedCompany.id,
          selected: false,
        };
      }
      return { ...r, status: "new", selected: true };
    });

    setRows(classified);
    setStep("preview");
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".xlsx")) handleFile(f);
    else toast.error("Kun .xlsx-filer støttes");
  }, [handleFile]);

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const newRows = useMemo(() => rows.filter((r) => r.status === "new"), [rows]);
  const possibleDups = useMemo(() => rows.filter((r) => r.status === "possible_duplicate"), [rows]);
  const exactDups = useMemo(() => rows.filter((r) => r.status === "duplicate"), [rows]);

  const toggleRow = (idx: number) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r));
  };

  const toggleForceImport = (idx: number) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, forceImport: !r.forceImport, selected: !r.forceImport } : r));
  };

  const selectedCount = rows.filter((r) => r.selected).length;

  const handleImport = async () => {
    const toImport = rows.filter((r) => r.selected);
    setStep("importing");
    setProgress({ done: 0, total: toImport.length });

    let imported = 0;
    const batchSize = 50;

    for (let i = 0; i < toImport.length; i += batchSize) {
      const batch = toImport.slice(i, i + batchSize).map((r) => ({
        name: r.selskap,
        industry: r.bransje || null,
        city: r.sted || null,
        website: r.url || null,
        linkedin: r.linkedin || null,
        org_number: r.org_nr || null,
        status: "prospect",
        
        notes: [
          "[Must-have]",
          `Kilde: LinkedIn-import`,
          r.nace ? `NACE: ${r.nace}` : null,
          r.ansatte ? `Ansatte: ${r.ansatte}` : null,
          r.kontaktpersoner ? `Kontaktpersoner: ${r.kontaktpersoner}` : null,
        ].filter(Boolean).join("\n"),
        created_by: user?.id,
      }));

      const { error } = await supabase.from("companies").insert(batch);
      if (error) {
        console.error("Batch insert error:", error);
        toast.error(`Feil ved import av batch ${Math.floor(i / batchSize) + 1}`);
      } else {
        imported += batch.length;
      }
      setProgress({ done: Math.min(i + batchSize, toImport.length), total: toImport.length });
    }

    setResult({ imported, skipped: rows.length - imported });
    queryClient.invalidateQueries({ queryKey: ["companies-full"] });
    setStep("done");
  };

  const reset = () => {
    setStep("upload");
    setRows([]);
    setProgress({ done: 0, total: 0 });
  };

  const [collapsedDups, setCollapsedDups] = useState(true);
  const [collapsedExact, setCollapsedExact] = useState(true);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-xl p-6 gap-0">
        <DialogTitle className="text-[1.125rem] font-bold text-foreground mb-4">
          Importer selskaper
        </DialogTitle>

        {/* STEP 1: Upload */}
        {step === "upload" && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-[0.9375rem] font-medium text-foreground mb-1">
              Dra og slipp en .xlsx-fil her
            </p>
            <p className="text-[0.8125rem] text-muted-foreground mb-4">
              Eller klikk for å velge fil
            </p>
            <label className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 cursor-pointer">
              Velg fil
              <input type="file" accept=".xlsx" onChange={onFileSelect} className="hidden" />
            </label>
          </div>
        )}

        {/* STEP 2: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            {/* Possible duplicates */}
            {possibleDups.length > 0 && (
              <section>
                <button
                  onClick={() => setCollapsedDups(!collapsedDups)}
                  className="flex items-center gap-2 w-full text-left"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-[0.8125rem] font-bold text-foreground">
                    Mulige duplikater ({possibleDups.length})
                  </span>
                  <span className="text-[0.75rem] text-muted-foreground">
                    {collapsedDups ? "Vis ▸" : "Skjul ▾"}
                  </span>
                </button>
                {!collapsedDups && (
                  <div className="mt-2 border border-amber-200 rounded-lg divide-y divide-border overflow-hidden">
                    {possibleDups.map((r) => {
                      const idx = rows.indexOf(r);
                      return (
                        <div key={idx} className="px-3 py-2.5 flex items-center gap-3 text-[0.8125rem]">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-foreground">{r.selskap}</span>
                            <span className="text-muted-foreground mx-1">→</span>
                            <span className="text-amber-600">ligner på "{r.existingName}"</span>
                          </div>
                          <button
                            onClick={() => toggleForceImport(idx)}
                            className={`h-7 px-2.5 text-[0.75rem] rounded-full border transition-colors ${
                              r.forceImport
                                ? "bg-primary/10 border-primary/30 text-primary font-medium"
                                : "border-border text-muted-foreground hover:bg-secondary"
                            }`}
                          >
                            {r.forceImport ? "Importeres" : "Importer likevel"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* New companies */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-[0.8125rem] font-bold text-foreground">
                  Nye selskaper ({newRows.length})
                </span>
              </div>
              <div className="border border-border rounded-lg overflow-hidden max-h-[320px] overflow-y-auto">
                <div className="grid grid-cols-[28px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_80px] gap-2 px-3 py-2 border-b border-border bg-background text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  <span />
                  <span>Selskap</span>
                  <span>Bransje</span>
                  <span>Sted</span>
                  <span>Ansatte</span>
                </div>
                <div className="divide-y divide-border">
                  {newRows.map((r) => {
                    const idx = rows.indexOf(r);
                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-[28px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_80px] gap-2 px-3 py-2 items-center hover:bg-muted/30 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={r.selected}
                          onChange={() => toggleRow(idx)}
                          className="h-4 w-4 rounded border-border accent-primary"
                        />
                        <span className="text-[0.8125rem] font-medium text-foreground truncate">{r.selskap}</span>
                        <span className="text-[0.8125rem] text-muted-foreground truncate">{r.bransje || "–"}</span>
                        <span className="text-[0.8125rem] text-muted-foreground truncate">{r.sted || "–"}</span>
                        <span className="text-[0.8125rem] text-muted-foreground">{r.ansatte || "–"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Exact duplicates */}
            {exactDups.length > 0 && (
              <section>
                <button
                  onClick={() => setCollapsedExact(!collapsedExact)}
                  className="flex items-center gap-2 w-full text-left"
                >
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[0.8125rem] font-bold text-muted-foreground">
                    Finnes allerede ({exactDups.length})
                  </span>
                  <span className="text-[0.75rem] text-muted-foreground">
                    {collapsedExact ? "Vis ▸" : "Skjul ▾"}
                  </span>
                </button>
                {!collapsedExact && (
                  <div className="mt-2 border border-border rounded-lg divide-y divide-border overflow-hidden opacity-60">
                    {exactDups.map((r, i) => (
                      <div key={i} className="px-3 py-2 text-[0.8125rem] text-muted-foreground">
                        {r.selskap} — org.nr matcher {r.existingName}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Import button */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <button onClick={() => { reset(); }} className="text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors">
                Avbryt
              </button>
              <Button
                disabled={selectedCount === 0}
                onClick={handleImport}
                className="rounded-lg h-9 px-4 text-[0.8125rem] font-medium gap-1.5"
              >
                Importer {selectedCount} selskaper
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Importing */}
        {step === "importing" && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
            <p className="text-[0.9375rem] font-medium text-foreground">
              Importerer selskaper...
            </p>
            <div className="w-full max-w-xs mx-auto">
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-[0.8125rem] text-muted-foreground mt-2">
                {progress.done}/{progress.total} behandlet
              </p>
            </div>
          </div>
        )}

        {/* STEP 4: Done */}
        {step === "done" && (
          <div className="py-8 text-center space-y-4">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <p className="text-[1.0625rem] font-bold text-foreground">
              ✓ {result.imported} selskaper importert
            </p>
            <p className="text-[0.8125rem] text-muted-foreground">
              {result.skipped > 0 && `${result.skipped} duplikater hoppet over · `}
              Alle importerte selskaper er tagget som «Must-have»
            </p>
            <Button
              onClick={() => { reset(); onOpenChange(false); }}
              className="rounded-lg h-9 px-4 text-[0.8125rem] font-medium"
            >
              Gå til Selskaper
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
