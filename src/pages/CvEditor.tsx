import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { CvEditorPanel } from "@/components/cv/CvEditorPanel";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { History, RotateCcw, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { toast } from "sonner";
import {
  invokeCvAccess,
  type CvAccessDocumentResponse,
  type CvAccessSaveResponse,
  type CvAccessSession,
  type CvAccessVersion,
  type CvAccessVersionsResponse,
} from "@/lib/cvAccess";
import { normalizeProjectsSectionTitle } from "@/lib/cvProjectsTitle";
import type { CVDocument } from "@/components/cv/CvRenderer";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://kbvzpcebfopqqrvmbiap.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtidnpwY2ViZm9wcXFydm1iaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MTgyNTEsImV4cCI6MjA4ODI5NDI1MX0.t_bvITh_RxMfYdutsqHD-IkArlcD8I7au5vxBkt0aVY";

// Anon client — no auth session
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const SESSION_KEY = "cv_session";

function formatUpdatedAt(value?: string | null) {
  if (!value) return "Ikke registrert ennå";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ikke registrert ennå";

  return format(date, "d. MMM yyyy HH:mm", { locale: nb });
}

function readStoredSession(token?: string) {
  if (!token) return null;

  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    if (parsed?.token !== token || !parsed?.session_key) return null;

    return parsed as CvAccessSession;
  } catch {
    return null;
  }
}

function getRowUpdatedAt(row: Record<string, unknown> | null | undefined) {
  return typeof row?.updated_at === "string" ? row.updated_at : null;
}

function getErrorMessage(error: unknown, fallback = "Ukjent feil") {
  return error instanceof Error ? error.message : fallback;
}

async function syncCompetenceFromCv(ansattId: number) {
  const { data, error } = await anonClient.functions.invoke("sync-cv-kompetanse", {
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
      contact: row.hero_contact || { title: "", name: "", phone: "", email: "" },
      portrait_url: row.portrait_url || undefined,
      portrait_position: row.portrait_position || "50% 50%",
    },
    sidebarSections: row.sidebar_sections || [],
    introParagraphs: row.intro_paragraphs || [],
    competenceGroups: row.competence_groups || [],
    projectsTitle: normalizeProjectsSectionTitle(row.title),
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
    title: normalizeProjectsSectionTitle(doc.projectsTitle) || null,
    projects: doc.projects,
    additional_sections: doc.additionalSections,
    education: doc.education,
    work_experience: doc.workExperience,
    sidebar_sections: doc.sidebarSections,
    updated_at: new Date().toISOString(),
  };
}

export default function CvEditor() {
  const { token } = useParams<{ token: string }>();
  const [session, setSession] = useState<CvAccessSession | null>(() => readStoredSession(token));
  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [shake, setShake] = useState(false);
  const [cvData, setCvData] = useState<CVDocument | null>(null);
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<CvAccessVersion[]>([]);
  const [restoringSession, setRestoringSession] = useState(() => Boolean(readStoredSession(token)));

  const clearCvSession = useCallback((message?: string) => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setCvData(null);
    setImageUrl(undefined);
    setLastUpdatedAt(null);
    setVersions([]);
    setVersionsOpen(false);
    setPin(["", "", "", ""]);
    setRestoringSession(false);
    if (message) setError(message);
  }, []);

  useEffect(() => {
    const storedSession = readStoredSession(token);
    setSession(storedSession);
    setCvData(null);
    setImageUrl(undefined);
    setLastUpdatedAt(null);
    setVersions([]);
    setVersionsOpen(false);
    setPin(["", "", "", ""]);
    setError("");
    setRestoringSession(Boolean(storedSession));
  }, [token]);

  useEffect(() => {
    const name = cvData?.hero?.name || session?.ansatt_name;
    if (!name) return;
    const title = `CV - ${name} - STACQ`;
    document.title = title;
    return () => {
      document.title = "STACQ Hot & Fast";
    };
  }, [cvData?.hero?.name, session?.ansatt_name]);

  useEffect(() => {
    if (!session || cvData) {
      setRestoringSession(false);
      return;
    }

    let cancelled = false;

    const loadExistingSession = async () => {
      setRestoringSession(true);

      try {
        const data = await invokeCvAccess<CvAccessDocumentResponse>(anonClient, {
          action: "load",
          session_key: session.session_key,
          token: session.token,
        });

        if (cancelled) return;

        sessionStorage.setItem(SESSION_KEY, JSON.stringify(data.session));
        setSession(data.session);
        setCvData(dbRowToCvDoc(data.document));
        setLastUpdatedAt(getRowUpdatedAt(data.document));
        setImageUrl(data.employee_image_url || undefined);
      } catch (err: unknown) {
        if (cancelled) return;
        clearCvSession(getErrorMessage(err, "Økten er utløpt. Tast inn PIN-koden på nytt."));
      } finally {
        if (!cancelled) setRestoringSession(false);
      }
    };

    void loadExistingSession();

    return () => {
      cancelled = true;
    };
  }, [clearCvSession, cvData, session]);

  const verifyPin = async (pinOverride?: string) => {
    if (!token) return;
    const pinStr = pinOverride || pin.join("");
    if (pinStr.length !== 4) return;

    setVerifying(true);
    setError("");

    try {
      const data = await invokeCvAccess<CvAccessDocumentResponse>(anonClient, {
        action: "verify",
        pin: pinStr,
        token,
      });

      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data.session));
      setSession(data.session);
      setCvData(dbRowToCvDoc(data.document));
      setLastUpdatedAt(getRowUpdatedAt(data.document));
      setImageUrl(data.employee_image_url || undefined);

      const ansattNavn = data.session.ansatt_name || "Ukjent ansatt";
      const now = new Date();
      const timeStr = now.toLocaleString("nb-NO", {
        timeZone: "Europe/Oslo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      fetch(`${SUPABASE_URL}/functions/v1/slack-crm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          recipient: "#crm",
          message: `${ansattNavn} logget inn på CV-editoren — ${timeStr}`,
        }),
      }).catch(() => {});
    } catch (err: unknown) {
      showError(getErrorMessage(err, "Noe gikk galt"));
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
    try {
      const data = await invokeCvAccess<CvAccessVersionsResponse>(anonClient, {
        action: "versions",
        cv_id: session.cv_id,
        session_key: session.session_key,
        token: session.token,
      });
      setVersions(data.versions || []);
      setVersionsOpen(true);
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Kunne ikke laste versjonshistorikk");
      toast.error(message);
      if (/Økten|utløpt|Lenken/.test(message)) {
        clearCvSession(message);
      }
      return;
    }
  }, [clearCvSession, session]);

  const runCompetenceSync = useCallback(async (ansattId: number) => {
    try {
      await syncCompetenceFromCv(ansattId);
    } catch (error) {
      console.error("Failed to sync competence from CV:", error);
      toast.error("CV ble lagret, men kompetanse kunne ikke synkroniseres til CRM.");
    }
  }, []);

  const restoreVersion = useCallback((snapshot: Record<string, unknown>) => {
    setCvData(dbRowToCvDoc(snapshot));
    setVersionsOpen(false);
    toast.info("Versjon gjenopprettet — autosave lagrer om noen sekunder.");
  }, []);

  const handleSave = async (data: CVDocument, savedByName: string) => {
    if (!session) return;
    const savedAt = new Date().toISOString();
    const snapshot = { ...cvDocToDbRow(data), updated_at: savedAt };

    try {
      const result = await invokeCvAccess<CvAccessSaveResponse>(anonClient, {
        action: "save",
        cv_id: session.cv_id,
        saved_by: savedByName,
        session_key: session.session_key,
        snapshot,
        token: session.token,
      });
      setLastUpdatedAt(result.updated_at || savedAt);
      await runCompetenceSync(session.ansatt_id);
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Kunne ikke lagre CV");
      toast.error(message);
      if (/Økten|utløpt|Lenken/.test(message)) {
        clearCvSession(message);
      }
      throw err;
    }
  };

  if (restoringSession && !cvData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Laster CV...</p>
      </div>
    );
  }

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
          imageUrl={cvData.hero.portrait_url || imageUrl}
          renderToolbar={({ saveStatus, onDownload }) => (
            <div className="flex items-center justify-between w-full px-4 py-2 border-b border-border bg-background">
              <div className="flex flex-col gap-0.5">
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
                  {saveStatus === "saved" && <span className="text-[0.75rem] text-muted-foreground">✓ Lagret</span>}
                </div>
                <span className="text-[0.6875rem] text-muted-foreground">
                  Sist oppdatert dato: {formatUpdatedAt(lastUpdatedAt)}
                </span>
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
              {versions.map((version) => (
                <div key={version.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[0.8125rem] font-medium text-foreground">
                        {format(new Date(version.created_at), "dd.MM.yyyy HH:mm", { locale: nb })}
                      </p>
                      <p className="text-[0.75rem] text-muted-foreground">Lagret av: {version.saved_by || "ukjent"}</p>
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
