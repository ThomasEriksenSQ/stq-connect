import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Mail, Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VarslingsInnstillinger } from "@/components/VarslingsInnstillinger";
import { VarslingsInnstillingerV2 } from "@/components/VarslingsInnstillingerV2";
import { toast } from "sonner";

import { useDesignVersion } from "@/context/DesignVersionContext";
import { DesignLabPageShell } from "@/components/designlab/DesignLabPageShell";
import { DesignLabPrimaryAction, DesignLabSecondaryAction } from "@/components/designlab/system/actions";
import { C } from "@/theme";

const SENT_CV_SYNC_OPTIONS = [
  { value: "7", label: "7 dager" },
  { value: "14", label: "14 dager" },
  { value: "30", label: "30 dager" },
  { value: "60", label: "60 dager" },
  { value: "90", label: "90 dager" },
  { value: "120", label: "120 dager" },
] as const;

type SentCvSyncResult = {
  scanned_messages: number;
  matched_rows: number;
  generated_at: string;
  accounts?: Array<{
    status: "ok" | "error";
    scanned_messages: number;
    matched_rows: number;
    error?: string;
  }>;
};

function useSentCvSync() {
  const [sentCvLookbackDays, setSentCvLookbackDays] = useState<string>("14");
  const [sentCvSyncing, setSentCvSyncing] = useState(false);
  const [sentCvResult, setSentCvResult] = useState<SentCvSyncResult | null>(null);

  const handleRunSentCvSync = async () => {
    setSentCvSyncing(true);
    try {
      const lookbackDays = Number(sentCvLookbackDays);
      const { data, error } = await supabase.functions.invoke<SentCvSyncResult>("sync-sent-cvs", {
        body: {
          trigger: "manual",
          lookbackDays,
          maxMessagesPerMailbox: 400,
        },
      });

      if (error) throw error;
      if (!data) throw new Error("Ingen respons fra Sendt CV-sync");

      setSentCvResult(data);

      const failedAccounts = (data.accounts || []).filter((account) => account.status === "error");
      if (failedAccounts.length > 0) {
        toast.warning(
          `Sendt CV-sync fullført med ${failedAccounts.length} kontoer som feilet. ${data.matched_rows} rader registrert.`,
        );
        return;
      }

      toast.success(
        `Sendt CV-sync fullført. ${data.matched_rows} rader registrert fra ${data.scanned_messages} sendte e-poster.`,
      );
    } catch (e) {
      toast.error(`Sendt CV-sync feilet: ${(e as Error).message}`);
    } finally {
      setSentCvSyncing(false);
    }
  };

  return {
    sentCvLookbackDays,
    setSentCvLookbackDays,
    sentCvSyncing,
    sentCvResult,
    handleRunSentCvSync,
  };
}

export default function Innstillinger() {
  const { isV2Active } = useDesignVersion();
  return isV2Active ? <InnstillingerV2 /> : <InnstillingerV1 />;
}

function InnstillingerV1() {
  const [connecting, setConnecting] = useState(false);
  const [mcSyncing, setMcSyncing] = useState(false);
  const [mcResult, setMcResult] = useState<{ total: number; active: number; inactive: number; batches: number } | null>(null);
  const {
    sentCvLookbackDays,
    setSentCvLookbackDays,
    sentCvSyncing,
    sentCvResult,
    handleRunSentCvSync,
  } = useSentCvSync();

  const { data: outlookStatus, isLoading: outlookLoading } = useQuery({
    queryKey: ["outlook-status"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { connected: false };
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || "https://kbvzpcebfopqqrvmbiap.supabase.co"}/functions/v1/outlook-auth?action=status`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtidnpwY2ViZm9wcXFydm1iaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI4Mjg3NDEsImV4cCI6MjA1ODQwNDc0MX0.8jzJm3oQ9GsA_j-mBYHbXPunEZs4jFd5VYNb-rNRHRE",
          },
        }
      );
      if (!res.ok) return { connected: false };
      return await res.json() as { connected: boolean };
    },
  });

  const handleConnectOutlook = async () => {
    setConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Ikke innlogget");
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || "https://kbvzpcebfopqqrvmbiap.supabase.co"}/functions/v1/outlook-auth?action=login`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtidnpwY2ViZm9wcXFydm1iaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI4Mjg3NDEsImV4cCI6MjA1ODQwNDc0MX0.8jzJm3oQ9GsA_j-mBYHbXPunEZs4jFd5VYNb-rNRHRE",
          },
        }
      );
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setConnecting(false);
    }
  };

  const handleMailchimpSyncAll = async () => {
    setMcSyncing(true);
    setMcResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("mailchimp-sync", {
        body: { action: "sync-all" },
      });
      if (error) throw error;
      setMcResult(data);
      toast.success(`${data.total} kontakter sendt til Mailchimp`);
    } catch (e) {
      toast.error(`Mailchimp-synk feilet: ${(e as Error).message}`);
    } finally {
      setMcSyncing(false);
    }
  };

  return (
    <div>
      <h1 className="text-[1.375rem] font-bold mb-6">Innstillinger</h1>

      {/* Outlook section */}
      <div className="mb-8">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3">
          Outlook-tilkobling
        </p>
        <div className="border border-border rounded-xl bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.07)] max-w-md">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[0.9375rem] font-semibold text-foreground">Microsoft Outlook</p>
              <p className="text-[0.8125rem] text-muted-foreground mt-1">
                Koble til Outlook for å synkronisere e-post og kalender.
              </p>
              <div className="mt-3 flex items-center gap-2">
                {outlookLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : outlookStatus?.connected ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-[0.8125rem] text-emerald-600 font-medium">Tilkoblet</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[0.8125rem] text-muted-foreground">Ikke tilkoblet</span>
                  </>
                )}
              </div>
              <button
                onClick={handleConnectOutlook}
                disabled={connecting}
                className="mt-4 bg-primary text-primary-foreground h-9 px-4 rounded-lg text-[0.8125rem] font-medium hover:opacity-90 disabled:opacity-50"
              >
                {connecting
                  ? "Kobler til..."
                  : outlookStatus?.connected
                    ? "Koble til på nytt"
                    : "Koble til Outlook"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sent CV sync section */}
      <div className="mb-8">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3">
          Sendt CV-synkronisering
        </p>
        <div className="border border-border rounded-xl bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.07)] max-w-md">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <RefreshCw className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[0.9375rem] font-semibold text-foreground">Backfill Sendt CV</p>
              <p className="text-[0.8125rem] text-muted-foreground mt-1">
                Skanner sendte e-poster for alle tilkoblede Outlook-kontoer og fyller opp "Sendt CV" på ansattprofiler.
              </p>
              {sentCvResult ? (
                <div className="mt-3 text-[0.8125rem]">
                  <span className="text-emerald-600 font-medium">{sentCvResult.matched_rows} rader registrert</span>
                  <span className="text-muted-foreground ml-2">{sentCvResult.scanned_messages} e-poster skannet</span>
                  {!!sentCvResult.accounts?.some((account) => account.status === "error") && (
                    <span className="text-amber-600 ml-2">
                      {sentCvResult.accounts.filter((account) => account.status === "error").length} kontoer med feil
                    </span>
                  )}
                </div>
              ) : (
                <div className="mt-3 text-[0.8125rem] text-muted-foreground">
                  Ingen manuell Sendt CV-sync kjørt i denne økten.
                </div>
              )}

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="w-full sm:w-36">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                    Periode
                  </p>
                  <Select value={sentCvLookbackDays} onValueChange={setSentCvLookbackDays}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SENT_CV_SYNC_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <button
                  onClick={handleRunSentCvSync}
                  disabled={sentCvSyncing}
                  className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground h-9 px-4 rounded-lg text-[0.8125rem] font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {sentCvSyncing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Kjører sync...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Kjør Sendt CV-sync
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mailchimp section */}
      <div className="mb-8">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3">
          Mailchimp-synkronisering
        </p>
        <div className="border border-border rounded-xl bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.07)] max-w-md">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[0.9375rem] font-semibold text-foreground">Mailchimp CV-Epost</p>
              <p className="text-[0.8125rem] text-muted-foreground mt-1">
                Synkroniser alle kontakter med CV-Epost aktivert til Mailchimp-audiencen.
                Endringer synkroniseres automatisk ved toggle.
              </p>
              {mcResult && (
                <div className="mt-3 text-[0.8125rem]">
                  <span className="text-emerald-600 font-medium">{mcResult.active} aktive</span>
                  <span className="text-muted-foreground ml-2">{mcResult.inactive} inaktive</span>
                  <span className="text-muted-foreground ml-2">{mcResult.total} totalt</span>
                </div>
              )}
              <button
                onClick={handleMailchimpSyncAll}
                disabled={mcSyncing}
                className="mt-4 inline-flex items-center gap-2 bg-primary text-primary-foreground h-9 px-4 rounded-lg text-[0.8125rem] font-medium hover:opacity-90 disabled:opacity-50"
              >
                {mcSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Synkroniserer...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Synk alle til Mailchimp
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Varslingsinnstillinger */}
      <div>
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3">
          Varslingsinnstillinger
        </p>
        <VarslingsInnstillinger />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   V2 — Linear-inspired settings page
   ───────────────────────────────────────────────────────────── */

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.borderLight}`,
        borderRadius: 10,
        padding: 20,
        boxShadow: C.shadow,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.2 }}>{title}</h2>
        {description ? (
          <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function StatusDot({ tone, label }: { tone: "success" | "muted" | "loading"; label: string }) {
  if (tone === "loading") {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <Loader2 className="h-3 w-3 animate-spin" style={{ color: C.textMuted }} />
        <span style={{ fontSize: 13, color: C.textMuted }}>{label}</span>
      </div>
    );
  }
  const dotColor = tone === "success" ? C.dotSuccess : C.dotNeutral;
  const textColor = tone === "success" ? C.text : C.textMuted;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: dotColor, display: "inline-block" }} />
      <span style={{ fontSize: 13, color: textColor }}>{label}</span>
    </div>
  );
}

export function InnstillingerV2() {
  const [connecting, setConnecting] = useState(false);
  const [mcSyncing, setMcSyncing] = useState(false);
  const [mcResult, setMcResult] = useState<{ total: number; active: number; inactive: number; batches: number } | null>(null);
  const {
    sentCvLookbackDays,
    setSentCvLookbackDays,
    sentCvSyncing,
    sentCvResult,
    handleRunSentCvSync,
  } = useSentCvSync();

  const { data: outlookStatus, isLoading: outlookLoading } = useQuery({
    queryKey: ["outlook-status"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { connected: false };
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || "https://kbvzpcebfopqqrvmbiap.supabase.co"}/functions/v1/outlook-auth?action=status`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtidnpwY2ViZm9wcXFydm1iaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI4Mjg3NDEsImV4cCI6MjA1ODQwNDc0MX0.8jzJm3oQ9GsA_j-mBYHbXPunEZs4jFd5VYNb-rNRHRE",
          },
        }
      );
      if (!res.ok) return { connected: false };
      return await res.json() as { connected: boolean };
    },
  });

  const handleConnectOutlook = async () => {
    setConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Ikke innlogget");
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || "https://kbvzpcebfopqqrvmbiap.supabase.co"}/functions/v1/outlook-auth?action=login`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtidnpwY2ViZm9wcXFydm1iaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI4Mjg3NDEsImV4cCI6MjA1ODQwNDc0MX0.8jzJm3oQ9GsA_j-mBYHbXPunEZs4jFd5VYNb-rNRHRE",
          },
        }
      );
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setConnecting(false);
    }
  };

  const handleMailchimpSyncAll = async () => {
    setMcSyncing(true);
    setMcResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("mailchimp-sync", { body: { action: "sync-all" } });
      if (error) throw error;
      setMcResult(data);
      toast.success(`${data.total} kontakter sendt til Mailchimp`);
    } catch (e) {
      toast.error(`Mailchimp-synk feilet: ${(e as Error).message}`);
    } finally {
      setMcSyncing(false);
    }
  };

  return (
    <DesignLabPageShell activePath="/design-lab/innstillinger" title="Innstillinger" maxWidth={null}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        <SectionCard title="Microsoft Outlook" description="Koble til Outlook for å synkronisere e-post og kalender.">
          {outlookLoading ? (
            <StatusDot tone="loading" label="Sjekker tilkobling..." />
          ) : outlookStatus?.connected ? (
            <StatusDot tone="success" label="Tilkoblet" />
          ) : (
            <StatusDot tone="muted" label="Ikke tilkoblet" />
          )}

          <div>
            <DesignLabPrimaryAction onClick={handleConnectOutlook} disabled={connecting}>
              {connecting
                ? "Kobler til..."
                : outlookStatus?.connected
                  ? "Koble til på nytt"
                  : "Koble til Outlook"}
            </DesignLabPrimaryAction>
          </div>
        </SectionCard>

        <SectionCard
          title="Mailchimp CV-Epost"
          description="Synkroniser alle kontakter med CV-Epost aktivert til Mailchimp-audiencen. Endringer synkroniseres automatisk ved toggle."
        >
          {mcResult ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
              <span style={{ color: C.success, fontWeight: 500 }}>{mcResult.active} aktive</span>
              <span style={{ color: C.textMuted }}>{mcResult.inactive} inaktive</span>
              <span style={{ color: C.textMuted }}>{mcResult.total} totalt</span>
            </div>
          ) : (
            <StatusDot tone="muted" label="Ikke synkronisert i denne økten" />
          )}

          <div>
            <DesignLabSecondaryAction onClick={handleMailchimpSyncAll} disabled={mcSyncing}>
              {mcSyncing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Synkroniserer...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Synk alle til Mailchimp
                </>
              )}
            </DesignLabSecondaryAction>
          </div>
        </SectionCard>

        <SectionCard
          title="Sendt CV-sync"
          description="Kjør en manuell backfill for alle tilkoblede Outlook-kontoer og fyll opp Sendt CV-listene på ansattprofiler."
        >
          {sentCvResult ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
              <span style={{ color: C.success, fontWeight: 500 }}>{sentCvResult.matched_rows} rader registrert</span>
              <span style={{ color: C.textMuted }}>{sentCvResult.scanned_messages} e-poster skannet</span>
              {!!sentCvResult.accounts?.some((account) => account.status === "error") && (
                <span style={{ color: C.warning }}>
                  {sentCvResult.accounts.filter((account) => account.status === "error").length} kontoer med feil
                </span>
              )}
            </div>
          ) : (
            <StatusDot tone="muted" label="Ingen manuell Sendt CV-sync kjørt i denne økten" />
          )}

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: 12 }}>
            <div style={{ minWidth: 148, display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textMuted }}>
                Periode
              </span>
              <Select value={sentCvLookbackDays} onValueChange={setSentCvLookbackDays}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SENT_CV_SYNC_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DesignLabSecondaryAction onClick={handleRunSentCvSync} disabled={sentCvSyncing}>
              {sentCvSyncing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Kjører sync...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Kjør Sendt CV-sync
                </>
              )}
            </DesignLabSecondaryAction>
          </div>
        </SectionCard>

        {/* Varslingsinnstillinger — flat-rendered cards i samme grid */}
        <VarslingsInnstillingerV2 />
      </div>
    </DesignLabPageShell>
  );
}
