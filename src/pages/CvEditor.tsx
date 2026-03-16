import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { CvEditorPanel } from "@/components/cv/CvEditorPanel";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { History, RotateCcw, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { openCvPrintDialog } from "@/components/cv/CvRenderer";
import { toast } from "sonner";
import { hashPin } from "@/lib/pinHash";
import type { CVDocument } from "@/components/cv/CvRenderer";

const SUPABASE_URL = "https://kbvzpcebfopqqrvmbiap.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtidnpwY2ViZm9wcXFydm1iaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MTgyNTEsImV4cCI6MjA4ODI5NDI1MX0.t_bvITh_RxMfYdutsqHD-IkArlcD8I7au5vxBkt0aVY";

// Anon client — no auth session
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SESSION_KEY = "cv_session";

type CvSession = {
  ansatt_id: number;
  cv_id: string;
  token: string;
  ansatt_name: string;
};

const EMPTY_CV: CVDocument = {
  hero: {
    name: "",
    title: "",
    contact: { title: "Kontaktperson", name: "Jon Richard Nygaard", phone: "932 87 267", email: "jr@stacq.no" },
  },
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

export default function CvEditor() {
  const { token } = useParams<{ token: string }>();
  const [session, setSession] = useState<CvSession | null>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.token === token) return parsed;
      }
    } catch {}
    return null;
  });
  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [shake, setShake] = useState(false);
  const [cvData, setCvData] = useState<CVDocument | null>(null);
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);

  useEffect(() => {
    if (!session?.ansatt_name) return;
    const title = `CV - ${session.ansatt_name} - STACQ`;
    document.title = title;
    return () => {
      document.title = "STACQ Hot & Fast";
    };
  }, [session?.ansatt_name]);

  // Load CV data after session is set
  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data } = await anonClient.from("cv_documents").select("*").eq("id", session.cv_id).single();
      if (data) setCvData(dbRowToCvDoc(data));
    })();
  }, [session]);

  const verifyPin = async (pinOverride?: string) => {
    if (!token) return;
    const pinStr = pinOverride || pin.join("");
    if (pinStr.length !== 4) return;

    setVerifying(true);
    setError("");

    try {
      const { data: tokenRow } = await anonClient.from("cv_access_tokens").select("*").eq("token", token).single();

      if (!tokenRow) {
        showError("Ugyldig PIN");
        return;
      }
      if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
        showError("Lenken har utløpt");
        return;
      }

      const hash = await hashPin(pinStr);
      if (hash !== tokenRow.pin_hash) {
        showError("Feil PIN-kode");
        return;
      }

      // Get CV document
      const { data: cvRow } = await anonClient
        .from("cv_documents")
        .select("*")
        .eq("ansatt_id", tokenRow.ansatt_id)
        .single();

      // Get ansatt name
      const { data: ansattRow } = await anonClient
        .from("stacq_ansatte")
        .select("navn, bilde_url")
        .eq("id", tokenRow.ansatt_id)
        .single();

      if (!cvRow) {
        showError("CV ikke funnet");
        return;
      }

      if (ansattRow?.bilde_url) setImageUrl(ansattRow.bilde_url);

      const newSession: CvSession = {
        ansatt_id: tokenRow.ansatt_id,
        cv_id: cvRow.id,
        token,
        ansatt_name: ansattRow?.navn || "Ansatt",
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
      setSession(newSession);
      setCvData(dbRowToCvDoc(cvRow));
    } catch {
      showError("Noe gikk galt");
    } finally {
      setVerifying(false);
    }
  };

  const showError = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
    setVerifying(false);
  };

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    if (value && index < 3) {
      const next = document.getElementById(`pin-${index + 1}`);
      next?.focus();
    }
    // Auto-submit when all 4 digits entered
    if (value && index === 3 && newPin.every((d) => d)) {
      setTimeout(() => {
        verifyPin(newPin.join(""));
      }, 50);
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      const prev = document.getElementById(`pin-${index - 1}`);
      prev?.focus();
    }
    if (e.key === "Enter") {
      verifyPin();
    }
  };

  const loadVersions = useCallback(async () => {
    if (!session) return;
    const { data, error } = await anonClient
      .from("cv_versions")
      .select("*")
      .eq("cv_id", session.cv_id)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Kunne ikke laste versjonshistorikk");
      return;
    }
    setVersions(data || []);
    setVersionsOpen(true);
  }, [session]);

  const restoreVersion = useCallback((snapshot: any) => {
    setCvData(dbRowToCvDoc(snapshot));
    setVersionsOpen(false);
    toast.info("Versjon gjenopprettet — autosave lagrer om noen sekunder.");
  }, []);

  const handleSave = async (data: CVDocument, savedByName: string) => {
    if (!session) return;
    await anonClient.from("cv_documents").update(cvDocToDbRow(data)).eq("id", session.cv_id);
    // Create version snapshot
    await anonClient.from("cv_versions").insert({
      cv_id: session.cv_id,
      snapshot: cvDocToDbRow(data) as any,
      saved_by: savedByName,
      source: "ansatt",
    });
  };

  // STATE 1 — PIN login
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-sm text-center space-y-8 px-6">
          <img src="/STACQ_logo_black.png" alt="STACQ" className="h-8 mx-auto dark:invert" />
          <div className="space-y-3">
            <h1 className="text-xl font-bold text-foreground">Tast inn din PIN-kode</h1>
          </div>
          <div className={`flex justify-center gap-3 ${shake ? "animate-shake" : ""}`}>
            {pin.map((digit, i) => (
              <input
                key={i}
                id={`pin-${i}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handlePinChange(i, e.target.value)}
                onKeyDown={(e) => handlePinKeyDown(i, e)}
                className="w-14 h-14 text-center text-2xl font-bold rounded-lg border-2 border-border bg-card text-foreground focus:border-primary focus:ring-2 focus:ring-ring outline-none transition-colors"
              />
            ))}
          </div>
          {error && <p className="text-sm text-destructive font-medium">{error}</p>}
          <button
            onClick={() => verifyPin()}
            disabled={pin.some((d) => !d) || verifying}
            className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {verifying ? "Verifiserer..." : "Logg inn"}
          </button>
        </div>
      </div>
    );
  }

  // STATE 2 — CV Editor
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
          savedBy={session.ansatt_name}
          imageUrl={imageUrl}
          renderToolbar={({ saveStatus, onDownload }) => (
            <div className="flex items-center justify-between w-full px-4 py-2 border-b border-border bg-background">
              <div className="flex items-center gap-2">
                <span className="text-[0.875rem] font-semibold text-foreground">
                  {cvData.hero.name || session.ansatt_name} — CV
                </span>
                {saveStatus === "saving" && (
                  <span className="flex items-center gap-1 text-[0.75rem] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Lagrer...
                  </span>
                )}
                {saveStatus === "saved" && (
                  <span className="text-[0.75rem] text-muted-foreground">
                    ✓ Lagret
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={loadVersions}>
                  <History className="h-4 w-4 mr-1" />
                  Versjonshistorikk
                </Button>
                <Button variant="outline" size="sm" onClick={onDownload}>
                  <Download className="h-4 w-4 mr-1" />
                  Last ned PDF
                </Button>
              </div>
            </div>
          )}
        />
      </div>

      <Sheet open={versionsOpen} onOpenChange={setVersionsOpen}>
        <SheetContent side="right" className="w-[400px] p-0 overflow-y-auto">
          <div className="p-5 space-y-4">
            <h2 className="text-[1.25rem] font-bold text-foreground">Versjonshistorikk</h2>
            <div className="space-y-3">
              {versions.length === 0 && (
                <p className="text-[0.8125rem] text-muted-foreground">
                  Ingen versjoner lagret ennå. Versjoner lagres automatisk ved hver autosave.
                </p>
              )}
              {versions.map((version: any) => (
                <div key={version.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[0.8125rem] font-medium text-foreground">
                        {format(new Date(version.created_at), "dd.MM.yyyy HH:mm", { locale: nb })}
                      </p>
                      <p className="text-[0.75rem] text-muted-foreground">
                        Lagret av: {version.saved_by || "ukjent"}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => restoreVersion(version.snapshot)}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Gjenopprett
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}