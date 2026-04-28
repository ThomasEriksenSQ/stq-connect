import { useState, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/sonner";
import { Upload, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { normalizeCompanyName } from "@/lib/companyMatch";

type ParsedRow = {
  mottatt: string;
  frist: string;
  selskap: string;
  sted: string;
  type: string;
  referanse: string;
  teknologier: string[];
  kommentar: string;
};

type ClassifiedRow = ParsedRow & {
  companyId: string | null;
  companyMatch: "found" | "new";
  isDuplicate: boolean;
};

function normalizeType(raw: string): string {
  const u = (raw || "").trim().toUpperCase();
  if (["DIR", "DUIR", "DI"].includes(u) || u.startsWith("DIR")) return "DIR";
  if (u === "VIA") return "VIA";
  return raw.trim() || "DIR";
}

function parseExcelDate(v: any): string {
  if (!v) return "";
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  // MM/DD/YY or MM/DD/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let year = parseInt(m[3]);
    if (year < 100) year += 2000;
    return `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return s;
}

export function ImportForesporslerModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [rows, setRows] = useState<ClassifiedRow[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [resultCount, setResultCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // Skip header row
    const dataRows = json.slice(1).filter((r) => r.length >= 4 && r[3]);

    const parsed: ParsedRow[] = dataRows.map((r) => {
      const techRaw = String(r[7] || "").trim();
      const teknologier = techRaw
        ? techRaw.split(/,\s*/).map((t: string) => t.trim()).filter(Boolean)
        : [];
      return {
        mottatt: parseExcelDate(r[1]),
        frist: parseExcelDate(r[2]),
        selskap: String(r[3] || "").trim(),
        sted: String(r[4] || "").trim(),
        type: normalizeType(String(r[5] || "")),
        referanse: String(r[6] || "").trim(),
        teknologier,
        kommentar: String(r[8] || "").trim(),
      };
    });

    // Fetch existing companies
    const { data: companies } = await supabase.from("companies").select("id, name");
    const companyList = companies || [];
    const companyMap = new Map<string, { id: string; name: string }>();
    companyList.forEach((c) => {
      companyMap.set(normalizeCompanyName(c.name), { id: c.id, name: c.name });
    });

    // Fetch existing forespørsler for duplicate check
    const { data: existing } = await supabase.from("foresporsler").select("selskap_id, mottatt_dato");

    const existingSet = new Set(
      (existing || []).map((e) => `${e.selskap_id}__${e.mottatt_dato}`)
    );

    const classified: ClassifiedRow[] = parsed.map((r) => {
      const norm = normalizeCompanyName(r.selskap);
      let companyId: string | null = null;
      let companyMatch: "found" | "new" = "new";

      // Try exact normalized match
      if (companyMap.has(norm)) {
        companyId = companyMap.get(norm)!.id;
        companyMatch = "found";
      } else {
        // Try substring match
        for (const [key, val] of companyMap.entries()) {
          if ((norm.length >= 4 && key.includes(norm)) || (key.length >= 4 && norm.includes(key))) {
            companyId = val.id;
            companyMatch = "found";
            break;
          }
        }
      }

      const isDuplicate = companyId ? existingSet.has(`${companyId}__${r.mottatt}`) : false;

      return { ...r, companyId, companyMatch, isDuplicate };
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

  const importable = useMemo(() => rows.filter((r) => !r.isDuplicate), [rows]);
  const duplicates = useMemo(() => rows.filter((r) => r.isDuplicate), [rows]);
  const newCompanies = useMemo(() => importable.filter((r) => r.companyMatch === "new"), [importable]);
  const uniqueNewCompanies = useMemo(() => {
    const seen = new Set<string>();
    return newCompanies.filter((r) => {
      const n = normalizeCompanyName(r.selskap);
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    });
  }, [newCompanies]);

  const handleImport = async () => {
    if (!user?.id) {
      toast.error("Du må være innlogget for å importere forespørsler");
      return;
    }

    setStep("importing");
    setProgress({ done: 0, total: importable.length });

    // Create new companies first
    const createdCompanies = new Map<string, string>();
    for (const r of uniqueNewCompanies) {
      const { data, error } = await supabase
        .from("companies")
        .insert({ name: r.selskap, status: "prospect", created_by: user.id, owner_id: user.id })
        .select("id")
        .single();
      if (data) {
        createdCompanies.set(normalizeCompanyName(r.selskap), data.id);
      }
    }

    let imported = 0;
    const batchSize = 25;

    for (let i = 0; i < importable.length; i += batchSize) {
      const batch = importable.slice(i, i + batchSize).map((r) => {
        let companyId = r.companyId;
        if (!companyId) {
          companyId = createdCompanies.get(normalizeCompanyName(r.selskap)) || null;
        }
        const kommentarParts = [r.referanse, r.kommentar].filter(Boolean);
        return {
          selskap_navn: r.selskap,
          selskap_id: companyId,
          mottatt_dato: r.mottatt || new Date().toISOString().slice(0, 10),
          frist_dato: r.frist || null,
          sted: r.sted || null,
          type: r.type,
          teknologier: r.teknologier,
          kommentar: kommentarParts.join(" · ") || null,
          status: "Ny",
          created_by: user.id,
        };
      });

      const { error } = await supabase.from("foresporsler").insert(batch);
      if (!error) imported += batch.length;
      else console.error("Batch error:", error);
      setProgress({ done: Math.min(i + batchSize, importable.length), total: importable.length });
    }

    setResultCount(imported);
    queryClient.invalidateQueries({ queryKey: ["foresporsler"] });
    setStep("done");
  };

  const reset = () => {
    setStep("upload");
    setRows([]);
    setProgress({ done: 0, total: 0 });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-xl p-6 gap-0">
        <DialogTitle className="text-[1.125rem] font-bold text-foreground mb-4">
          Importer forespørsler fra Excel
        </DialogTitle>

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

        {step === "preview" && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-3 text-[0.8125rem]">
              <span className="font-medium text-foreground">{importable.length} forespørsler</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-amber-600 font-medium">{uniqueNewCompanies.length} nye bedrifter</span>
              {duplicates.length > 0 && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{duplicates.length} duplikater hoppet over</span>
                </>
              )}
            </div>

            {/* Preview table */}
            <div className="border border-border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
              <div className="grid grid-cols-[90px_minmax(0,1.5fr)_60px_minmax(0,2fr)_100px] gap-2 px-3 py-2 border-b border-border bg-background text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground sticky top-0 z-10">
                <span>Mottatt</span>
                <span>Selskap</span>
                <span>Type</span>
                <span>Teknologier</span>
                <span>Match</span>
              </div>
              <div className="divide-y divide-border">
                {importable.map((r, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[90px_minmax(0,1.5fr)_60px_minmax(0,2fr)_100px] gap-2 px-3 py-2 items-center text-[0.8125rem]"
                  >
                    <span className="text-muted-foreground">{r.mottatt}</span>
                    <span className="font-medium text-foreground truncate">{r.selskap}</span>
                    <span className="text-muted-foreground">{r.type}</span>
                    <span className="text-muted-foreground truncate">{r.teknologier.join(", ") || "–"}</span>
                    <span className={`text-[0.75rem] font-medium ${r.companyMatch === "found" ? "text-emerald-600" : "text-amber-600"}`}>
                      {r.companyMatch === "found" ? "Funnet i CRM" : "Ny bedrift"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <button onClick={reset} className="text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors">
                Avbryt
              </button>
              <Button
                disabled={importable.length === 0}
                onClick={handleImport}
                className="rounded-lg h-9 px-4 text-[0.8125rem] font-medium gap-1.5"
              >
                Importer {importable.length} forespørsler
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
            <p className="text-[0.9375rem] font-medium text-foreground">Importerer forespørsler...</p>
            <div className="w-full max-w-xs mx-auto">
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-[0.8125rem] text-muted-foreground mt-2">{progress.done}/{progress.total}</p>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="py-8 text-center space-y-4">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <p className="text-[1.0625rem] font-bold text-foreground">
              ✓ {resultCount} forespørsler importert
            </p>
            {uniqueNewCompanies.length > 0 && (
              <p className="text-[0.8125rem] text-muted-foreground">
                {uniqueNewCompanies.length} nye bedrifter opprettet i CRM
              </p>
            )}
            <Button
              onClick={() => { reset(); onOpenChange(false); }}
              className="rounded-lg h-9 px-4 text-[0.8125rem] font-medium"
            >
              Lukk
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
