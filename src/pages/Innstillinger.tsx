import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Mail, Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VarslingsInnstillinger } from "@/components/VarslingsInnstillinger";
import { VarslingsInnstillingerV2 } from "@/components/VarslingsInnstillingerV2";
import { toast } from "@/components/ui/sonner";

import { useDesignVersion } from "@/context/DesignVersionContext";
import { DesignLabPageShell } from "@/components/designlab/DesignLabPageShell";
import { DesignLabPrimaryAction, DesignLabSecondaryAction } from "@/components/designlab/system/actions";
import { C } from "@/theme";
import { crmQueryKeys } from "@/lib/queryKeys";

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
  scanned_accounts?: number;
  skipped_accounts?: number;
  generated_at: string;
  accounts?: Array<{
    status: "ok" | "error" | "skipped";
    scanned_messages: number;
    matched_rows: number;
    error?: string;
  }>;
};

type BrregWashAction = "preview" | "execute";

type BrregWashRow = {
  id: string;
  name: string | null;
  org_number: string | null;
  status: string;
  brreg_deleted_at?: string | null;
};

type BrregWashResult = {
  action: BrregWashAction;
  scanned: number;
  updated: number;
  unchanged: number;
  missingOrg: number;
  invalidOrg: number;
  deleted: number;
  orgNumberReview?: number;
  notFound: number;
  errors: number;
  unresolvedGeo: number;
  hasMore?: boolean;
  nextOffset?: number;
  rows?: BrregWashRow[];
  deletedRows?: BrregWashRow[];
};

type BrregWashAggregate = BrregWashResult & {
  batches: number;
  rows: BrregWashRow[];
  deletedRows: BrregWashRow[];
};

function getBrregOrgNumberReviewCount(result: BrregWashResult) {
  return result.orgNumberReview ?? result.deleted;
}

function formatBrregDeletedDate(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("nb-NO");
}

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

function emptyBrregWashAggregate(action: BrregWashAction): BrregWashAggregate {
  return {
    action,
    scanned: 0,
    updated: 0,
    unchanged: 0,
    missingOrg: 0,
    invalidOrg: 0,
    deleted: 0,
    orgNumberReview: 0,
    notFound: 0,
    errors: 0,
    unresolvedGeo: 0,
    hasMore: false,
    nextOffset: 0,
    batches: 0,
    rows: [],
    deletedRows: [],
  };
}

function mergeBrregWashResult(current: BrregWashAggregate, next: BrregWashResult): BrregWashAggregate {
  return {
    action: current.action,
    scanned: current.scanned + next.scanned,
    updated: current.updated + next.updated,
    unchanged: current.unchanged + next.unchanged,
    missingOrg: current.missingOrg + next.missingOrg,
    invalidOrg: current.invalidOrg + next.invalidOrg,
    deleted: current.deleted + next.deleted,
    orgNumberReview: getBrregOrgNumberReviewCount(current) + getBrregOrgNumberReviewCount(next),
    notFound: current.notFound + next.notFound,
    errors: current.errors + next.errors,
    unresolvedGeo: current.unresolvedGeo + next.unresolvedGeo,
    hasMore: next.hasMore,
    nextOffset: next.nextOffset,
    batches: current.batches + 1,
    rows: [...current.rows, ...(next.rows || [])].slice(0, 50),
    deletedRows: [...current.deletedRows, ...(next.deletedRows || [])].slice(0, 100),
  };
}

function useBrregCompanyWash() {
  const queryClient = useQueryClient();
  const [brregRunningAction, setBrregRunningAction] = useState<BrregWashAction | null>(null);
  const [brregResult, setBrregResult] = useState<BrregWashAggregate | null>(null);

  const handleRunBrregWash = async (action: BrregWashAction) => {
    setBrregRunningAction(action);
    setBrregResult(null);
    try {
      let offset = 0;
      let aggregate = emptyBrregWashAggregate(action);

      while (true) {
        const { data, error } = await supabase.functions.invoke<BrregWashResult>("brreg-company-wash", {
          body: { action, offset, limit: 150 },
        });

        if (error) throw error;
        if (!data) throw new Error("Ingen respons fra BRREG-vask");

        aggregate = mergeBrregWashResult(aggregate, data);
        setBrregResult(aggregate);

        if (!data.hasMore || data.scanned === 0) break;
        offset = data.nextOffset ?? offset + 150;
      }

      if (action === "execute") {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: crmQueryKeys.companies.all() }),
          queryClient.invalidateQueries({ queryKey: crmQueryKeys.contacts.all() }),
        ]);
      }

      toast.success(
        action === "execute"
          ? `BRREG-vask fullført. ${aggregate.updated} selskaper oppdatert av ${aggregate.scanned} skannet.`
          : `Forhåndsvisning klar. ${aggregate.updated} selskaper vil oppdateres av ${aggregate.scanned} skannet.`,
      );
    } catch (e) {
      toast.error(`BRREG-vask feilet: ${(e as Error).message}`);
    } finally {
      setBrregRunningAction(null);
    }
  };

  return {
    brregRunningAction,
    brregResult,
    handleRunBrregWash,
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
  const {
    brregRunningAction,
    brregResult,
    handleRunBrregWash,
  } = useBrregCompanyWash();

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

      {/* BRREG company wash section */}
      <div className="mb-8">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3">
          BRREG-vask
        </p>
        <div className="border border-border rounded-xl bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.07)] max-w-md">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <RefreshCw className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[0.9375rem] font-semibold text-foreground">Vask selskaper mot BRREG</p>
              <p className="text-[0.8125rem] text-muted-foreground mt-1">
                Oppdaterer selskapsinformasjon og GEO. Hvis registrert org.nr er slettet i BRREG, flagges selskapet for org.nr-avklaring uten å endre CRM-status.
              </p>
              {brregResult ? (
                <>
                  <div className="mt-3 text-[0.8125rem]">
                    <span className="text-emerald-600 font-medium">
                      {brregResult.updated} {brregResult.action === "execute" ? "oppdatert" : "oppdateres"}
                    </span>
                    <span className="text-muted-foreground ml-2">{brregResult.scanned} skannet</span>
                    {getBrregOrgNumberReviewCount(brregResult) > 0 && <span className="text-amber-600 ml-2">{getBrregOrgNumberReviewCount(brregResult)} org.nr må avklares</span>}
                    {brregResult.unresolvedGeo > 0 && <span className="text-amber-600 ml-2">{brregResult.unresolvedGeo} ukjent GEO</span>}
                    {brregResult.errors > 0 && <span className="text-red-600 ml-2">{brregResult.errors} feil</span>}
                  </div>
                  {brregResult.deletedRows.length > 0 && (
                    <div className="mt-2 border-l-2 border-amber-500 pl-3 text-[0.75rem] text-muted-foreground">
                      <p className="font-medium text-foreground">Org.nr slettet i BRREG, selskap beholdt som aktiv CRM-rad:</p>
                      <ul className="mt-1 space-y-1">
                        {brregResult.deletedRows.slice(0, 8).map((row) => (
                          <li key={row.id}>
                            {row.name || "Ukjent selskap"}
                            {row.org_number ? ` (${row.org_number})` : ""}
                            {row.brreg_deleted_at ? ` - slettedato ${formatBrregDeletedDate(row.brreg_deleted_at)}` : ""}
                          </li>
                        ))}
                      </ul>
                      {getBrregOrgNumberReviewCount(brregResult) > brregResult.deletedRows.length && (
                        <p className="mt-1">+ {getBrregOrgNumberReviewCount(brregResult) - brregResult.deletedRows.length} flere til avklaring.</p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-3 text-[0.8125rem] text-muted-foreground">
                  Ingen BRREG-vask kjørt i denne økten.
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => handleRunBrregWash("preview")}
                  disabled={Boolean(brregRunningAction)}
                  className="inline-flex items-center justify-center gap-2 border border-border bg-card text-foreground h-9 px-4 rounded-lg text-[0.8125rem] font-medium hover:bg-secondary disabled:opacity-50"
                >
                  {brregRunningAction === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Forhåndsvis
                </button>
                <button
                  onClick={() => handleRunBrregWash("execute")}
                  disabled={Boolean(brregRunningAction)}
                  className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground h-9 px-4 rounded-lg text-[0.8125rem] font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {brregRunningAction === "execute" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Kjør vask
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
  const {
    brregRunningAction,
    brregResult,
    handleRunBrregWash,
  } = useBrregCompanyWash();

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

        <SectionCard
          title="Vask selskaper mot BRREG"
          description="Oppdater selskapsinformasjon og GEO. Hvis registrert org.nr er slettet i BRREG, flagges selskapet for org.nr-avklaring uten å endre CRM-status."
        >
          {brregResult ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
                <span style={{ color: C.success, fontWeight: 500 }}>
                  {brregResult.updated} {brregResult.action === "execute" ? "oppdatert" : "oppdateres"}
                </span>
                <span style={{ color: C.textMuted }}>{brregResult.scanned} skannet</span>
                {getBrregOrgNumberReviewCount(brregResult) > 0 && <span style={{ color: C.warning }}>{getBrregOrgNumberReviewCount(brregResult)} org.nr må avklares</span>}
                {brregResult.unresolvedGeo > 0 && <span style={{ color: C.warning }}>{brregResult.unresolvedGeo} ukjent GEO</span>}
                {brregResult.errors > 0 && <span style={{ color: "#C2410C" }}>{brregResult.errors} feil</span>}
              </div>
              {brregResult.deletedRows.length > 0 && (
                <div style={{ borderLeft: `2px solid ${C.warning}`, paddingLeft: 12, fontSize: 12, color: C.textMuted }}>
                  <p style={{ margin: 0, color: C.text, fontWeight: 500 }}>Org.nr slettet i BRREG, selskap beholdt som aktiv CRM-rad:</p>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>
                    {brregResult.deletedRows.slice(0, 8).map((row) => (
                      <li key={row.id}>
                        {row.name || "Ukjent selskap"}
                        {row.org_number ? ` (${row.org_number})` : ""}
                        {row.brreg_deleted_at ? ` - slettedato ${formatBrregDeletedDate(row.brreg_deleted_at)}` : ""}
                      </li>
                    ))}
                  </ul>
                  {getBrregOrgNumberReviewCount(brregResult) > brregResult.deletedRows.length && (
                    <p style={{ margin: "4px 0 0" }}>+ {getBrregOrgNumberReviewCount(brregResult) - brregResult.deletedRows.length} flere til avklaring.</p>
                  )}
                </div>
              )}
            </>
          ) : brregRunningAction ? (
            <StatusDot tone="loading" label="Kjører BRREG-vask..." />
          ) : (
            <StatusDot tone="muted" label="Ingen BRREG-vask kjørt i denne økten" />
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <DesignLabSecondaryAction onClick={() => handleRunBrregWash("preview")} disabled={Boolean(brregRunningAction)}>
              {brregRunningAction === "preview" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Forhåndsviser...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Forhåndsvis
                </>
              )}
            </DesignLabSecondaryAction>
            <DesignLabPrimaryAction onClick={() => handleRunBrregWash("execute")} disabled={Boolean(brregRunningAction)}>
              {brregRunningAction === "execute" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Kjører vask...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Kjør vask
                </>
              )}
            </DesignLabPrimaryAction>
          </div>
        </SectionCard>

        {/* Varslingsinnstillinger — flat-rendered cards i samme grid */}
        <VarslingsInnstillingerV2 />
      </div>
    </DesignLabPageShell>
  );
}
