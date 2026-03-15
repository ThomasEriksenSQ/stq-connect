import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { ArrowLeft, Check, Download, History, Loader2, RotateCcw } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
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
  sidebarSections: [],
  introParagraphs: [],
  competenceGroups: [],
  projects: [],
  education: [],
  workExperience: [],
};

function dbRowToCvDoc(row: any): CVDocument {
  return {
    hero: {
      name: row.hero_name || "",
      title: row.hero_title || "",
      contact: DEFAULT_CONTACT,
      portrait_url: row.portrait_url || undefined,
    },
    sidebarSections: row.sidebar_sections || [],
    introParagraphs: row.intro_paragraphs || [],
    competenceGroups: row.competence_groups || [],
    projects: row.projects || [],
    education: row.education || [],
    workExperience: row.work_experience || [],
  };
}

function cvDocToDbRow(doc: CVDocument) {
  return {
    hero_name: doc.hero.name,
    hero_title: doc.hero.title,
    portrait_url: doc.hero.portrait_url || null,
    intro_paragraphs: doc.introParagraphs,
    competence_groups: doc.competenceGroups,
    projects: doc.projects,
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
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);

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
    };

    loadCvAdminData();

    return () => {
      cancelled = true;
    };
  }, [ansattId, user]);

  const handleSave = useCallback(
    async (doc: CVDocument) => {
      if (!cvId) return;

      const { error } = await supabase
        .from("cv_documents")
        .update(cvDocToDbRow(doc) as any)
        .eq("id", cvId);

      if (error) {
        throw error;
      }
    },
    [cvId],
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
      <div className="h-screen flex flex-col">
        <CvEditorPanel
          cvData={cvData}
          onSave={handleSave}
          savedBy={user.email || "crm"}
          imageUrl={imageUrl}
          onDownloadPdf={handleDownloadPdf}
          renderToolbar={({ saveStatus, onDownload }) => (
            <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
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
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={loadVersions}>
                  <History className="h-3.5 w-3.5 mr-1" />
                  Versjonshistorikk
                </Button>
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
