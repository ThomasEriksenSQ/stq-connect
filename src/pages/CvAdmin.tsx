import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CvEditorPanel } from "@/components/cv/CvEditorPanel";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { History, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import type { CVDocument } from "@/components/cv/CvRenderer";

const EMPTY_CV: CVDocument = {
  hero: { name: "", title: "", contact: { title: "Kontaktperson", name: "Jon Richard Nygaard", phone: "932 87 267", email: "jr@stacq.no" } },
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
      contact: { title: "Kontaktperson", name: "Jon Richard Nygaard", phone: "932 87 267", email: "jr@stacq.no" },
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
  const [cvData, setCvData] = useState<CVDocument | null>(null);
  const [cvId, setCvId] = useState<string | null>(null);
  const [ansattName, setAnsattName] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);

  useEffect(() => {
    if (!ansattId || !user) return;
    const id = parseInt(ansattId);
    if (isNaN(id)) return;

    (async () => {
      // Get ansatt info
      const { data: ansatt } = await supabase.from("stacq_ansatte").select("navn, bilde_url").eq("id", id).single();
      if (ansatt) {
        setAnsattName(ansatt.navn);
        if (ansatt.bilde_url) setImageUrl(ansatt.bilde_url);
      }

      // Get or create cv_documents
      let { data: cvRow } = await supabase.from("cv_documents").select("*").eq("ansatt_id", id).single();

      if (!cvRow) {
        const newDoc = {
          ansatt_id: id,
          hero_name: ansatt?.navn || "",
          hero_title: "",
          ...cvDocToDbRow(EMPTY_CV),
        };
        const { data: inserted } = await supabase.from("cv_documents").insert(newDoc).select().single();
        cvRow = inserted;
      }

      if (cvRow) {
        setCvId(cvRow.id);
        setCvData(dbRowToCvDoc(cvRow));
      }
    })();
  }, [ansattId, user]);

  const handleSave = async (data: CVDocument, savedByName: string) => {
    if (!cvId) return;
    await supabase.from("cv_documents").update(cvDocToDbRow(data)).eq("id", cvId);
    await supabase.from("cv_versions").insert({
      cv_id: cvId,
      snapshot: cvDocToDbRow(data) as any,
      saved_by: savedByName,
    });
  };

  const loadVersions = async () => {
    if (!cvId) return;
    const { data } = await supabase.from("cv_versions").select("*").eq("cv_id", cvId).order("created_at", { ascending: false });
    setVersions(data || []);
    setVersionsOpen(true);
  };

  const restoreVersion = (snapshot: any) => {
    setCvData(dbRowToCvDoc(snapshot));
    setVersionsOpen(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Laster...</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!cvData) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Laster CV...</p></div>;

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <div className="shrink-0 border-b border-border bg-background px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground">← Tilbake</a>
          <span className="text-sm font-bold text-foreground">{ansattName} — CV</span>
        </div>
        <Button size="sm" variant="outline" onClick={loadVersions}>
          <History className="h-3.5 w-3.5 mr-1" /> Versjonshistorikk
        </Button>
      </div>

      <div className="flex-1 overflow-hidden">
        <CvEditorPanel
          cvData={cvData}
          onSave={handleSave}
          savedBy="crm"
          imageUrl={imageUrl}
        />
      </div>

      {/* Version history sheet */}
      <Sheet open={versionsOpen} onOpenChange={setVersionsOpen}>
        <SheetContent side="right" className="w-full sm:w-[400px] max-w-[400px]">
          <h3 className="text-lg font-bold mb-4">Versjonshistorikk</h3>
          <div className="space-y-3 overflow-y-auto">
            {versions.length === 0 && <p className="text-sm text-muted-foreground">Ingen versjoner lagret ennå.</p>}
            {versions.map((v) => (
              <div key={v.id} className="border border-border rounded-lg p-3 bg-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {format(new Date(v.created_at), "d. MMM yyyy HH:mm", { locale: nb })}
                    </p>
                    <p className="text-xs text-muted-foreground">Lagret av: {v.saved_by || "ukjent"}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => restoreVersion(v.snapshot)}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Gjenopprett
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
