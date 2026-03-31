import { useState, useRef } from "react";
import { FileText, Upload, User, Handshake, KeyRound, X, Loader2, Search, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { normalizeTechnologyTags } from "@/lib/technologyTags";

interface CvData {
  navn: string;
  epost: string | null;
  telefon: string | null;
  kompetanse: string[];
  rolle: string | null;
  erfaring_aar: number | null;
  bio: string;
  geografi?: string;
}

type Step = "upload" | "analyzing" | "preview" | "type-select" | "intern" | "partner" | "freelance" | "saving" | "done";

interface CvUploadFlowProps {
  onClose: () => void;
  onAddMessage: (msg: { role: "user" | "assistant"; content: string }) => void;
}

export function CvUploadFlow({ onClose, onAddMessage }: CvUploadFlowProps) {
  const [step, setStep] = useState<Step>("upload");
  const [cvData, setCvData] = useState<CvData | null>(null);
  const [cvBase64, setCvBase64] = useState<string>("");
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Intern state
  const [internMatch, setInternMatch] = useState<any>(null);
  const [internSearching, setInternSearching] = useState(false);

  // Partner state
  const [partnerSearch, setPartnerSearch] = useState("");
  const [partnerResults, setPartnerResults] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<{ id: string; name: string } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Freelance state
  const [freelanceSelskapNavn, setFreelanceSelskapNavn] = useState("");

  // Done state
  const [savedName, setSavedName] = useState("");
  const [savedType, setSavedType] = useState("");

  const handleFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Kun PDF-filer støttes");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Filen er for stor (maks 20MB)");
      return;
    }

    setFileName(file.name);
    setStep("analyzing");

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      setCvBase64(base64);

      try {
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-cv`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ base64, filename: file.name }),
        });

        const data = await resp.json();
        if (!resp.ok || data.error) {
          toast.error(data.error || "Kunne ikke analysere CV");
          setStep("upload");
          return;
        }

        setCvData({
          navn: data.navn || "",
          epost: data.epost || null,
          telefon: data.telefon || null,
          kompetanse: normalizeTechnologyTags(data.kompetanse || []),
          rolle: data.rolle || null,
          erfaring_aar: data.erfaring_aar || null,
          bio: data.bio || "",
          geografi: data.geografi || null,
        });
        setStep("preview");
      } catch {
        toast.error("Feil under CV-analyse");
        setStep("upload");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const searchIntern = async (name: string) => {
    setInternSearching(true);
    const { data } = await supabase
      .from("stacq_ansatte")
      .select("id, navn, kompetanse, status")
      .ilike("navn", `%${name.split(" ")[0]}%`)
      .limit(5);
    setInternMatch(data && data.length > 0 ? data[0] : null);
    setInternSearching(false);
  };

  const searchCompanies = (query: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.length < 1) { setPartnerResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      const { data } = await supabase.from("companies").select("id, name, city").ilike("name", `%${query}%`).limit(8);
      if (data) setPartnerResults(data);
    }, 300);
  };

  const handleSelectType = async (type: "intern" | "partner" | "freelance") => {
    if (type === "intern") {
      setStep("intern");
      if (cvData?.navn) searchIntern(cvData.navn);
    } else if (type === "partner") {
      setStep("partner");
    } else {
      setStep("freelance");
    }
  };

  const saveIntern = async (updateExisting: boolean) => {
    if (!cvData) return;
    setStep("saving");
    try {
      if (updateExisting && internMatch) {
        const { error } = await supabase.from("stacq_ansatte").update({
          kompetanse: normalizeTechnologyTags(cvData.kompetanse),
          bio: cvData.bio,
          geografi: cvData.geografi || undefined,
          erfaring_aar: cvData.erfaring_aar,
          epost: cvData.epost || undefined,
          tlf: cvData.telefon || undefined,
        }).eq("id", internMatch.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stacq_ansatte").insert({
          navn: cvData.navn,
          kompetanse: normalizeTechnologyTags(cvData.kompetanse),
          bio: cvData.bio,
          geografi: cvData.geografi || null,
          erfaring_aar: cvData.erfaring_aar,
          epost: cvData.epost || null,
          tlf: cvData.telefon || null,
          status: "AKTIV/SIGNERT",
        });
        if (error) throw error;
      }
      setSavedName(cvData.navn);
      setSavedType("intern ansatt");
      setStep("done");
      onAddMessage({ role: "assistant", content: `✅ **${cvData.navn}** er ${updateExisting ? "oppdatert" : "registrert"} som intern ansatt!\nTeknologier: ${cvData.kompetanse.join(", ")}` });
    } catch {
      toast.error("Kunne ikke lagre");
      setStep("intern");
    }
  };

  const savePartner = async () => {
    if (!cvData || !selectedCompany) { toast.error("Velg et partnerselskap"); return; }
    setStep("saving");
    try {
      const { error } = await supabase.from("external_consultants").insert({
        navn: cvData.navn,
        epost: cvData.epost || null,
        telefon: cvData.telefon || null,
        teknologier: normalizeTechnologyTags(cvData.kompetanse),
        rolle: cvData.rolle || null,
        erfaring_aar: cvData.erfaring_aar,
        selskap_tekst: selectedCompany.name,
        company_id: selectedCompany.id,
        type: "partner",
        status: "ledig",
        notat: cvData.bio,
      });
      if (error) throw error;
      setSavedName(cvData.navn);
      setSavedType("partner-konsulent");
      setStep("done");
      onAddMessage({ role: "assistant", content: `✅ **${cvData.navn}** er registrert som partner-konsulent via **${selectedCompany.name}**!\nTeknologier: ${cvData.kompetanse.join(", ")}` });
    } catch {
      toast.error("Kunne ikke lagre");
      setStep("partner");
    }
  };

  const saveFreelance = async () => {
    if (!cvData) return;
    setStep("saving");
    try {
      const { error } = await supabase.from("external_consultants").insert({
        navn: cvData.navn,
        epost: cvData.epost || null,
        telefon: cvData.telefon || null,
        teknologier: normalizeTechnologyTags(cvData.kompetanse),
        rolle: cvData.rolle || null,
        erfaring_aar: cvData.erfaring_aar,
        selskap_tekst: freelanceSelskapNavn || null,
        type: "freelance",
        status: "ledig",
        notat: cvData.bio,
      });
      if (error) throw error;
      setSavedName(cvData.navn);
      setSavedType("freelance-konsulent");
      setStep("done");
      onAddMessage({ role: "assistant", content: `✅ **${cvData.navn}** er registrert som freelance-konsulent!\nTeknologier: ${cvData.kompetanse.join(", ")}` });
    } catch {
      toast.error("Kunne ikke lagre");
      setStep("freelance");
    }
  };

  const reset = () => {
    setCvData(null);
    setCvBase64("");
    setFileName("");
    setStep("upload");
    setInternMatch(null);
    setSelectedCompany(null);
    setPartnerSearch("");
    setFreelanceSelskapNavn("");
  };

  return (
    <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/40">
      <div className="flex items-center justify-between">
        <p className="text-[0.875rem] font-semibold flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-primary" />
          Last opp CV
        </p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      {/* STEP: Upload */}
      {step === "upload" && (
        <>
          <p className="text-[0.8125rem] text-muted-foreground">
            Last opp en CV (PDF) så analyserer jeg den automatisk.
          </p>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-8 cursor-pointer transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
            )}
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-[0.8125rem] text-muted-foreground">Dra og slipp PDF her, eller klikk for å velge</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </>
      )}

      {/* STEP: Analyzing */}
      {step === "analyzing" && (
        <div className="flex flex-col items-center gap-3 py-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-[0.875rem] text-foreground font-medium">Analyserer {fileName}...</p>
          <p className="text-[0.75rem] text-muted-foreground">Henter ut navn, teknologier og erfaring</p>
        </div>
      )}

      {/* STEP: Preview card */}
      {step === "preview" && cvData && (
        <>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[1rem] font-bold text-foreground">{cvData.navn}</p>
                <p className="text-[0.8125rem] text-muted-foreground mt-0.5">
                  {[cvData.rolle, cvData.erfaring_aar ? `${cvData.erfaring_aar} år` : null].filter(Boolean).join(" · ")}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {cvData.kompetanse.map((t) => (
                    <span key={t} className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[0.6875rem] text-foreground font-medium">{t}</span>
                  ))}
                </div>
                {cvData.bio && (
                  <p className="text-[0.8125rem] text-foreground/70 mt-2 italic">"{cvData.bio}"</p>
                )}
                {(cvData.epost || cvData.telefon) && (
                  <p className="text-[0.75rem] text-muted-foreground mt-1.5">
                    {[cvData.epost, cvData.telefon].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>
          </div>
          <p className="text-[0.8125rem] font-medium text-foreground mt-2">Hvem er dette?</p>
          <button onClick={() => setStep("type-select")} className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 transition-opacity">
            <Sparkles className="h-3.5 w-3.5" />Velg type
          </button>
        </>
      )}

      {/* STEP: Type selection */}
      {step === "type-select" && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { type: "intern" as const, icon: User, title: "Intern ansatt", sub: "Ansatt i STACQ" },
            { type: "partner" as const, icon: Handshake, title: "Via partner", sub: "Kommer via et partnerselskap" },
            { type: "freelance" as const, icon: KeyRound, title: "Freelance", sub: "Selvstendig konsulent" },
          ].map((opt) => (
            <button
              key={opt.type}
              onClick={() => handleSelectType(opt.type)}
              className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border bg-card hover:bg-muted/60 hover:border-primary/30 transition-all cursor-pointer text-center"
            >
              <opt.icon className="h-5 w-5 text-primary" />
              <div>
                <p className="text-[0.8125rem] font-medium text-foreground">{opt.title}</p>
                <p className="text-[0.6875rem] text-muted-foreground">{opt.sub}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* STEP: Intern */}
      {step === "intern" && cvData && (
        <div className="space-y-3">
          {internSearching ? (
            <div className="flex items-center gap-2 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-[0.8125rem]">Søker etter {cvData.navn}...</span>
            </div>
          ) : internMatch ? (
            <div className="space-y-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2.5">
                <p className="text-[0.8125rem] font-medium text-foreground">
                  Fant <strong>{internMatch.navn}</strong> i systemet
                </p>
                <p className="text-[0.75rem] text-muted-foreground mt-0.5">
                  Status: {internMatch.status} · Kompetanse: {(internMatch.kompetanse || []).slice(0, 4).join(", ")}
                </p>
              </div>
              <p className="text-[0.8125rem] text-foreground">Oppdatere teknologier og profil fra CV-en?</p>
              <div className="flex gap-2">
                <button onClick={() => saveIntern(true)}
                  className="flex-1 h-9 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
                  Ja, oppdater
                </button>
                <button onClick={() => { setInternMatch(null); }}
                  className="flex-1 h-9 text-[0.8125rem] rounded-lg border border-border text-muted-foreground hover:bg-secondary transition-colors">
                  Opprett ny
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[0.8125rem] text-muted-foreground">
                Ingen match funnet. Oppretter ny ansatt med data fra CV-en.
              </p>
              <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-[0.8125rem] space-y-1">
                <p><strong>Navn:</strong> {cvData.navn}</p>
                <p><strong>Teknologier:</strong> {cvData.kompetanse.join(", ")}</p>
                {cvData.rolle && <p><strong>Rolle:</strong> {cvData.rolle}</p>}
                {cvData.geografi && <p><strong>Sted:</strong> {cvData.geografi}</p>}
              </div>
              <button onClick={() => saveIntern(false)}
                className="h-9 w-full text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
                Opprett ansatt
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP: Partner */}
      {step === "partner" && cvData && (
        <div className="space-y-3">
          <p className="text-[0.8125rem] font-medium text-foreground">Hvilket partnerselskap?</p>
          <div className="relative">
            <Input
              value={selectedCompany ? selectedCompany.name : partnerSearch}
              onChange={(e) => { setPartnerSearch(e.target.value); setSelectedCompany(null); searchCompanies(e.target.value); }}
              placeholder="Søk etter selskap..."
              className="text-[0.875rem]"
            />
            {partnerResults.length > 0 && !selectedCompany && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-md max-h-48 overflow-auto">
                {partnerResults.map((c) => (
                  <button key={c.id} onClick={() => { setSelectedCompany({ id: c.id, name: c.name }); setPartnerResults([]); }}
                    className="w-full text-left px-3 py-2 text-[0.8125rem] hover:bg-secondary transition-colors">
                    {c.name} {c.city && <span className="text-muted-foreground ml-1 text-[0.75rem]">{c.city}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={savePartner} disabled={!selectedCompany}
            className="h-9 w-full text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">
            Lagre som partner-konsulent
          </button>
        </div>
      )}

      {/* STEP: Freelance */}
      {step === "freelance" && cvData && (
        <div className="space-y-3">
          <div>
            <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Selskapsnavn (valgfritt)</label>
            <Input value={freelanceSelskapNavn} onChange={(e) => setFreelanceSelskapNavn(e.target.value)} placeholder="f.eks. Konsulent AS" className="mt-1 text-[0.875rem]" />
          </div>
          <button onClick={saveFreelance}
            className="h-9 w-full text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
            Lagre som freelance-konsulent
          </button>
        </div>
      )}

      {/* STEP: Saving */}
      {step === "saving" && (
        <div className="flex flex-col items-center gap-3 py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-[0.875rem] text-foreground">Lagrer...</p>
        </div>
      )}

      {/* STEP: Done */}
      {step === "done" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2.5">
            <p className="text-[0.875rem] font-medium text-foreground">
              ✅ {savedName} er registrert som {savedType}!
            </p>
            {cvData && (
              <p className="text-[0.75rem] text-muted-foreground mt-0.5">
                Teknologier lagret: {cvData.kompetanse.join(", ")}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={reset}
              className="flex-1 h-9 text-[0.8125rem] font-medium rounded-lg border border-border text-foreground hover:bg-secondary transition-colors">
              Last opp en til
            </button>
            <button onClick={onClose}
              className="flex-1 h-9 text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors">
              Ferdig
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
