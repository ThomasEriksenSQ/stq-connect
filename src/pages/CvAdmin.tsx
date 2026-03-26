import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import {
  ArrowLeft,
  Check,
  Download,
  History,
  Link2,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CvEditorPanel } from "@/components/cv/CvEditorPanel";
import { openCvPrintDialog, type CVDocument } from "@/components/cv/CvRenderer";
import { toast } from "sonner";

const DEFAULT_CONTACT = {
  title: "Kontaktperson",
  name: "Jon Richard Nygaard",
  phone: "932 87 267",
  email: "jr@stacq.no",
};

const EMPTY_CV: CVDocument = {
  hero: { name: "", title: "", contact: DEFAULT_CONTACT },
  sidebarSections: [
    { heading: "PERSONALIA", items: [] },
    { heading: "NØKKELPUNKTER", items: [] },
    { heading: "UTDANNELSE", items: [] },
  ],
  introParagraphs: [],
  competenceGroups: [{ label: "Programmeringsspråk", content: "" }],
  projects: [],
  additionalSections: [],
  education: [],
  workExperience: [],
};

type CvVersionMeta = {
  created_at: string | null;
  source: string | null;
};

function formatUpdatedAt(value?: string | null) {
  if (!value) return "Ikke registrert ennå";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ikke registrert ennå";

  return format(date, "d. MMM yyyy HH:mm", { locale: nb });
}

function getLatestVersionDates(versions: CvVersionMeta[]) {
  const lastAdmin = versions.find((version) => version.source === "admin")?.created_at ?? null;
  const lastAnsatt = versions.find((version) => version.source === "ansatt")?.created_at ?? null;

  return { lastAdmin, lastAnsatt };
}

async function syncCompetenceFromCv(ansattId: number) {
  const { data, error } = await supabase.functions.invoke("sync-cv-kompetanse", {
    body: { ansatt_id: ansattId },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

function dbRowToCvDoc(row: any): CVDocument {
  return {
    hero: {
      name: row.hero_name || "",
      title: row.hero_title || "",
      contact: DEFAULT_CONTACT,
      portrait_url: row.portrait_url || undefined,
      portrait_position: row.portrait_position || "50% 50%",
    },
    sidebarSections: row.sidebar_sections || [],
    introParagraphs: row.intro_paragraphs || [],
    competenceGroups: row.competence_groups || [],
    projects: row.projects || [],
    additionalSections: row.additional_sections || [],
    education: row.education || [],
    workExperience: row.work_experience || [],
  };
}

function cvDocToDbRow(doc: CVDocument) {
  return {
    hero_name: doc.hero.name,
    hero_title: doc.hero.title,
    portrait_url: doc.hero.portrait_url || null,
    portrait_position: doc.hero.portrait_position || "50% 50%",
    intro_paragraphs: doc.introParagraphs,
    competence_groups: doc.competenceGroups,
    projects: doc.projects,
    additional_sections: doc.additionalSections,
    education: doc.education,
    work_experience: doc.workExperience,
    sidebar_sections: doc.sidebarSections,
    updated_at: new Date().toISOString(),
  };
}

export default function CvAdmin() {
  const { ansattId } = useParams<{ ansattId: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [cvData, setCvData] = useState<CVDocument | null>(null);
  const [cvId, setCvId] = useState<string | null>(null);
  const [ansattName, setAnsattName] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [lastAdminUpdatedAt, setLastAdminUpdatedAt] = useState<string | null>(null);
  const [lastAnsattUpdatedAt, setLastAnsattUpdatedAt] = useState<string | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [cvUploadParsing, setCvUploadParsing] = useState(false);
  const cvUploadRef = useRef<HTMLInputElement>(null);
  const [fullscreen, setFullscreen] = useState(true);

  const loadVersionDates = useCallback(async (currentCvId: string) => {
    const { data, error } = await supabase
      .from("cv_versions")
      .select("created_at, source")
      .eq("cv_id", currentCvId)
      .order("created_at", { ascending: false });

    if (error) return;

    const { lastAdmin, lastAnsatt } = getLatestVersionDates((data || []) as CvVersionMeta[]);
    setLastAdminUpdatedAt(lastAdmin);
    setLastAnsattUpdatedAt(lastAnsatt);
  }, []);

  useEffect(() => {
    if (!ansattId || !user) return;

    const parsedAnsattId = Number(ansattId);
    if (Number.isNaN(parsedAnsattId)) return;

    let cancelled = false;

    const loadCvAdminData = async () => {
      const { data: ansatt } = await supabase
        .from("stacq_ansatte")
        .select("navn, bilde_url")
        .eq("id", parsedAnsattId)
        .single();

      if (cancelled) return;

      if (ansatt) {
        setAnsattName(ansatt.navn || "");
        setImageUrl(ansatt.bilde_url || undefined);
      }

      let { data: cvRow } = await supabase.from("cv_documents").select("*").eq("ansatt_id", parsedAnsattId).single();

      if (!cvRow) {
        const newDocument = {
          ansatt_id: parsedAnsattId,
          ...cvDocToDbRow({
            ...EMPTY_CV,
            hero: {
              ...EMPTY_CV.hero,
              name: ansatt?.navn || "",
            },
          }),
        };

        const { data: insertedRow } = await supabase.from("cv_documents").insert(newDocument).select().single();

        cvRow = insertedRow;
      }

      if (cancelled || !cvRow) return;

      setCvId(cvRow.id);
      setCvData(dbRowToCvDoc(cvRow));
      void loadVersionDates(cvRow.id);
    };

    loadCvAdminData();

    return () => {
      cancelled = true;
    };
  }, [ansattId, user, loadVersionDates]);

  useEffect(() => {
    if (!ansattName) return;
    const title = `CV - ${ansattName} - STACQ`;
    document.title = title;
    return () => {
      document.title = "STACQ Hot & Fast";
    };
  }, [ansattName]);

  const runCompetenceSync = useCallback(async () => {
    const numericAnsattId = Number(ansattId);
    if (Number.isNaN(numericAnsattId)) return;

    try {
      await syncCompetenceFromCv(numericAnsattId);
    } catch (error) {
      console.error("Failed to sync competence from CV:", error);
      toast.error("CV ble lagret, men kompetanse kunne ikke synkroniseres til CRM.");
    }
  }, [ansattId]);

  const handleSave = useCallback(
    async (doc: CVDocument) => {
      if (!cvId) return;
      const savedAt = new Date().toISOString();
      const snapshot = { ...cvDocToDbRow(doc), updated_at: savedAt };

      const { error } = await supabase
        .from("cv_documents")
        .update(snapshot as any)
        .eq("id", cvId);

      if (error) {
        throw error;
      }

      const { error: versionError } = await supabase.from("cv_versions").insert({
        cv_id: cvId,
        snapshot: snapshot as any,
        saved_by: user?.email || "crm",
        source: "admin",
        created_at: savedAt,
      });

      if (versionError) {
        throw versionError;
      }

      setLastAdminUpdatedAt(savedAt);
      await runCompetenceSync();
    },
    [cvId, runCompetenceSync, user?.email],
  );

  const loadVersions = useCallback(async () => {
    if (!cvId) return;

    const { data, error } = await supabase
      .from("cv_versions")
      .select("*")
      .eq("cv_id", cvId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Kunne ikke laste versjonshistorikk");
      return;
    }

    setVersions(data || []);
    setVersionsOpen(true);
  }, [cvId]);

  const restoreVersion = useCallback((snapshot: any) => {
    setCvData(dbRowToCvDoc(snapshot));
    setVersionsOpen(false);
    toast.info("Versjon gjenopprettet — husk å kontrollere og la autosave lagre endringen.");
  }, []);

  const handleDownloadPdf = useCallback(
    async (doc: CVDocument) => {
      if (cvId) {
        await supabase.from("cv_versions").insert({
          cv_id: cvId,
          snapshot: cvDocToDbRow(doc) as any,
          saved_by: user?.email || "crm",
        });
      }

      await openCvPrintDialog(doc.hero.name ? `CV - ${doc.hero.name} - STACQ` : "CV - STACQ");
    },
    [cvId, user?.email],
  );

  const handleCvUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";

      setCvUploadParsing(true);
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const { data, error } = await supabase.functions.invoke("parse-cv", {
          body: { base64, filename: file.name },
        });

        if (error || !data) {
          toast.error(data?.error || "Kunne ikke analysere CV — fyll inn manuelt");
          return;
        }

        const currentCv = cvData || EMPTY_CV;

        const newCvData: CVDocument = {
          ...currentCv,
          hero: {
            ...currentCv.hero,
            name: data.navn || currentCv.hero.name,
            title: data.tittel || currentCv.hero.title,
          },
          introParagraphs: data.introParagraphs?.length ? data.introParagraphs : currentCv.introParagraphs,
          competenceGroups: data.competenceGroups?.length ? data.competenceGroups : currentCv.competenceGroups,
          projects: data.projects?.length ? data.projects : currentCv.projects,
          education: data.education?.length ? data.education : currentCv.education,
          workExperience: data.workExperience?.length ? data.workExperience : currentCv.workExperience,
          sidebarSections: data.sidebarSections?.length ? data.sidebarSections : currentCv.sidebarSections,
        };

        setCvData(newCvData);

        if (cvId) {
          const savedAt = new Date().toISOString();
          const snapshot = { ...cvDocToDbRow(newCvData), updated_at: savedAt };
          const { error: saveError } = await supabase
            .from("cv_documents")
            .update(snapshot as any)
            .eq("id", cvId);

          if (saveError) {
            toast.error("Kunne ikke lagre CV-data til databasen");
            return;
          }

          const { error: versionError } = await supabase.from("cv_versions").insert({
            cv_id: cvId,
            snapshot: snapshot as any,
            saved_by: user?.email || "crm",
            source: "admin",
            created_at: savedAt,
          });

          if (versionError) {
            toast.error("Kunne ikke lagre versjonshistorikk");
            return;
          }

          setLastAdminUpdatedAt(savedAt);
          await runCompetenceSync();
        }

        toast.success("CV fullstendig analysert — alle seksjoner er fylt inn");
      } catch {
        toast.error("Kunne ikke analysere CV — fyll inn manuelt");
      } finally {
        setCvUploadParsing(false);
      }
    },
    [cvData, cvId, runCompetenceSync, user?.email],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Laster...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!cvData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Laster CV...</p>
      </div>
    );
  }

  return (
    <>
      <div className={fullscreen ? "fixed inset-0 z-50 bg-background flex flex-col" : "h-screen flex flex-col"}>
        <CvEditorPanel
          cvData={cvData}
          onSave={handleSave}
          savedBy={user.email || "crm"}
          imageUrl={imageUrl}
          onDownloadPdf={handleDownloadPdf}
          renderToolbar={({ saveStatus, onDownload }) => (
            <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3 text-[0.8125rem]">
                  <button
                    onClick={() => navigate("/konsulenter/ansatte")}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Tilbake
                  </button>
                  <span className="text-foreground font-medium">{ansattName ? `${ansattName} — CV` : "CV"}</span>
                  {saveStatus === "saving" && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Lagrer...
                    </span>
                  )}
                  {saveStatus === "saved" && (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <Check className="h-3.5 w-3.5" />
                      Lagret
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.6875rem] text-muted-foreground">
                  <span>Sist oppdatert (admin): {formatUpdatedAt(lastAdminUpdatedAt)}</span>
                  <span>Sist oppdatert (ansatt): {formatUpdatedAt(lastAnsattUpdatedAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="border border-border h-9 w-9"
                        onClick={() => setFullscreen((prev) => !prev)}
                      >
                        {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{fullscreen ? "Avslutt fullskjerm" : "Fullskjerm"}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button size="sm" variant="ghost" onClick={loadVersions}>
                  <History className="h-3.5 w-3.5 mr-1" />
                  Versjonshistorikk
                </Button>
                <button
                  onClick={async () => {
                    const id = Number(ansattId);
                    if (Number.isNaN(id)) return;
                    try {
                      const pin = Math.floor(1000 + Math.random() * 9000).toString();
                      const encoder = new TextEncoder();
                      const d = encoder.encode(pin);
                      const hashBuffer = await crypto.subtle.digest("SHA-256", d);
                      const hashArray = Array.from(new Uint8Array(hashBuffer));
                      const pinHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
                      const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
                      const expires_at = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
                      const { error } = await supabase
                        .from("cv_access_tokens")
                        .upsert({ ansatt_id: id, token, pin_hash: pinHash, expires_at }, { onConflict: "ansatt_id" });
                      if (error) throw error;
                      await navigator.clipboard.writeText("https://crm.stacq.no/cv/" + token);
                      toast.success(`Link kopiert! PIN: ${pin} — del med ${cvData.hero.name || "konsulenten"}`, {
                        duration: 10000,
                      });
                    } catch (err: any) {
                      toast.error("Kunne ikke generere link: " + (err.message || "Ukjent feil"));
                    }
                  }}
                  className="inline-flex items-center gap-1.5 h-9 px-3 text-[0.8125rem] font-medium rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Del link med ansatt
                </button>
                {cvUploadParsing ? (
                  <span className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Analyserer CV med AI...
                  </span>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="border border-border"
                        onClick={() => cvUploadRef.current?.click()}
                      >
                        <Sparkles className="h-3.5 w-3.5 mr-1" />
                        AI-analyse av orginal CV
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Last opp eksisterende CV — AI fyller inn feltene automatisk</TooltipContent>
                  </Tooltip>
                )}
                <input ref={cvUploadRef} type="file" accept=".pdf" className="hidden" onChange={handleCvUpload} />
                <Button size="sm" onClick={onDownload}>
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Last ned PDF
                </Button>
              </div>
            </div>
          )}
        />
      </div>

      <Sheet open={versionsOpen} onOpenChange={setVersionsOpen}>
        <SheetContent side="right" className="w-full sm:w-[400px] max-w-[400px]">
          <h3 className="text-lg font-bold mb-4">Versjonshistorikk</h3>
          <div className="space-y-3 overflow-y-auto">
            {versions.length === 0 && <p className="text-sm text-muted-foreground">Ingen versjoner lagret ennå.</p>}
            {versions.map((version) => (
              <div key={version.id} className="border border-border rounded-lg p-3 bg-card">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {format(new Date(version.created_at), "dd.MM.yyyy HH:mm", { locale: nb })}
                    </p>
                    <p className="text-xs text-muted-foreground">Lagret av: {version.saved_by || "ukjent"}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => restoreVersion(version.snapshot)}>
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Gjenopprett
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
