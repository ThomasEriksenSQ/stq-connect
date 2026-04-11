import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function VarslingsInnstillinger() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ["varslingsinnstillinger"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("varslingsinnstillinger" as any)
        .select("*")
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const [renewalEmailsLocal, setRenewalEmailsLocal] = useState<string[] | null>(null);
  const [renewalAktivLocal, setRenewalAktivLocal] = useState<boolean | null>(null);
  const [renewalTerskelLocal, setRenewalTerskelLocal] = useState<string | null>(null);
  const [newRenewalEmail, setNewRenewalEmail] = useState("");
  const [savingRenewal, setSavingRenewal] = useState(false);
  const [sendingRenewalTest, setSendingRenewalTest] = useState(false);

  const [radarEmailsLocal, setRadarEmailsLocal] = useState<string[] | null>(null);
  const [radarAktivLocal, setRadarAktivLocal] = useState<boolean | null>(null);
  const [radarAutoSendLocal, setRadarAutoSendLocal] = useState<boolean | null>(null);
  const [radarAiLocal, setRadarAiLocal] = useState<boolean | null>(null);
  const [newRadarEmail, setNewRadarEmail] = useState("");
  const [savingRadar, setSavingRadar] = useState(false);
  const [sendingRadarTest, setSendingRadarTest] = useState(false);
  const [sendingRadarNow, setSendingRadarNow] = useState(false);

  const [salgsagentEmailsLocal, setSalgsagentEmailsLocal] = useState<string[] | null>(null);
  const [newSalgsagentEmail, setNewSalgsagentEmail] = useState("");
  const [savingSalgsagent, setSavingSalgsagent] = useState(false);
  const [sendingSalgsagentTest, setSendingSalgsagentTest] = useState(false);

  const renewalEmails = renewalEmailsLocal ?? (settings?.epost_mottakere as string[]) ?? [];
  const renewalAktiv = renewalAktivLocal ?? settings?.aktiv ?? true;
  const renewalTerskel = renewalTerskelLocal ?? String(settings?.terskel_dager ?? 90);

  const radarEmails = radarEmailsLocal ?? (settings?.markedsradar_epost_mottakere as string[]) ?? [];
  const radarAktiv = radarAktivLocal ?? settings?.markedsradar_aktiv ?? false;
  const radarAutoSend = radarAutoSendLocal ?? settings?.markedsradar_send_etter_import ?? true;
  const radarAi = radarAiLocal ?? settings?.markedsradar_inkluder_ai ?? true;

  const salgsagentEmails = salgsagentEmailsLocal ?? (settings?.epost_mottakere as string[]) ?? ["thomas@stacq.no"];

  const isValidEmail = (email: string) => email.includes("@") && email.includes(".");

  const addRecipient = (
    value: string,
    currentEmails: string[],
    setEmails: (value: string[]) => void,
    clear: () => void,
  ) => {
    const trimmed = value.trim();
    if (!isValidEmail(trimmed)) return;
    if (currentEmails.length >= 5) return;
    if (currentEmails.includes(trimmed)) return;
    setEmails([...currentEmails, trimmed]);
    clear();
  };

  const removeRecipient = (email: string, currentEmails: string[], setEmails: (value: string[]) => void) => {
    if (currentEmails.length <= 1) return;
    setEmails(currentEmails.filter((entry) => entry !== email));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleSaveRenewal = async () => {
    setSavingRenewal(true);
    try {
      const { error } = await supabase
        .from("varslingsinnstillinger" as any)
        .update({
          epost_mottakere: renewalEmails,
          terskel_dager: Number(renewalTerskel),
          aktiv: renewalAktiv,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", settings.id);
      if (error) throw error;
      toast.success("Fornyelsesinnstillinger lagret");
      queryClient.invalidateQueries({ queryKey: ["varslingsinnstillinger"] });
    } catch {
      toast.error("Kunne ikke lagre innstillinger");
    } finally {
      setSavingRenewal(false);
    }
  };

  const handleTestEmail = async () => {
    setSendingRenewalTest(true);
    try {
      const { error } = await supabase.functions.invoke("fornyelse-varsel-epost", {
        body: { test: true },
      });
      if (error) throw error;
      toast.success("Test-e-post sendt til thomas@stacq.no");
    } catch {
      toast.error("Kunne ikke sende test-e-post");
    } finally {
      setSendingRenewalTest(false);
    }
  };

  const handleSaveRadar = async () => {
    setSavingRadar(true);
    try {
      const { error } = await supabase
        .from("varslingsinnstillinger" as any)
        .update({
          markedsradar_epost_mottakere: radarEmails,
          markedsradar_aktiv: radarAktiv,
          markedsradar_send_etter_import: radarAutoSend,
          markedsradar_inkluder_ai: radarAi,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", settings.id);
      if (error) throw error;
      toast.success("Markedsradar-innstillinger lagret");
      queryClient.invalidateQueries({ queryKey: ["varslingsinnstillinger"] });
    } catch {
      toast.error("Kunne ikke lagre markedsradar-innstillinger");
    } finally {
      setSavingRadar(false);
    }
  };

  const handleRadarTestEmail = async () => {
    setSendingRadarTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("markedsradar-ukesmail", {
        body: { test: true },
      });
      if (error) throw error;
      if (data?.skipped) {
        toast.message(data.reason || "Ingen markedsradar sendt");
      } else {
        toast.success(`Test av markedsradar sendt${data?.latestWeek ? ` for ${data.latestWeek}` : ""}`);
      }
    } catch {
      toast.error("Kunne ikke sende test av markedsradar");
    } finally {
      setSendingRadarTest(false);
    }
  };

  const handleRadarSendNow = async () => {
    setSendingRadarNow(true);
    try {
      const { data, error } = await supabase.functions.invoke("markedsradar-ukesmail", {
        body: { force: true, source: "manual" },
      });
      if (error) throw error;
      if (data?.skipped) {
        toast.message(data.reason || "Ingen markedsradar sendt");
      } else {
        toast.success(`Markedsradar sendt${data?.latestWeek ? ` for ${data.latestWeek}` : ""}`);
      }
      queryClient.invalidateQueries({ queryKey: ["varslingsinnstillinger"] });
    } catch {
      toast.error("Kunne ikke sende markedsradar nå");
    } finally {
      setSendingRadarNow(false);
    }
  };

  return (
    <div className="max-w-5xl grid gap-6 xl:grid-cols-3">
      <div className="border border-border rounded-xl bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.07)] space-y-6">
        <div className="space-y-3">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Fornyelsesvarsler
          </p>
        </div>
        <div className="space-y-3">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            E-postmottakere
          </p>
          <div className="space-y-2">
            {renewalEmails.map((email) => (
              <div key={email} className="flex items-center justify-between">
                <span className="text-[0.875rem] text-foreground">{email}</span>
                {renewalEmails.length > 1 && (
                  <button
                    onClick={() => removeRecipient(email, renewalEmails, setRenewalEmailsLocal)}
                    className="text-muted-foreground hover:text-destructive transition-colors text-sm"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {renewalEmails.length >= 5 ? (
            <p className="text-[0.75rem] text-muted-foreground">Maks 5 mottakere</p>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                placeholder="navn@domene.no"
                value={newRenewalEmail}
                onChange={(e) => setNewRenewalEmail(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  addRecipient(newRenewalEmail, renewalEmails, setRenewalEmailsLocal, () => setNewRenewalEmail(""))
                }
                className="h-9 text-[0.875rem]"
              />
              <button
                onClick={() =>
                  addRecipient(newRenewalEmail, renewalEmails, setRenewalEmailsLocal, () => setNewRenewalEmail(""))
                }
                className="h-9 px-3 text-[0.8125rem] font-medium rounded-lg border border-border bg-background text-foreground hover:bg-secondary shrink-0"
              >
                Legg til
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-[0.8125rem] text-foreground">Aktiver ukentlig e-postvarsel</Label>
            <Switch checked={renewalAktiv} onCheckedChange={(value) => setRenewalAktivLocal(value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[0.8125rem] text-foreground">Send varsler for oppdrag som utløper innen</Label>
            <Select value={renewalTerskel} onValueChange={(value) => setRenewalTerskelLocal(value)}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 dager</SelectItem>
                <SelectItem value="60">60 dager</SelectItem>
                <SelectItem value="90">90 dager</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <button
          onClick={handleSaveRenewal}
          disabled={savingRenewal}
          className="bg-primary text-primary-foreground h-9 px-4 rounded-lg text-[0.8125rem] font-medium hover:opacity-90 disabled:opacity-50"
        >
          {savingRenewal ? "Lagrer..." : "Lagre fornyelsesinnstillinger"}
        </button>

        <div className="border-t border-border pt-4">
          <button
            onClick={handleTestEmail}
            disabled={sendingRenewalTest}
            className="border border-border text-[0.8125rem] text-muted-foreground hover:text-foreground h-8 px-3 rounded-lg disabled:opacity-50"
          >
            {sendingRenewalTest ? "Sender..." : "Send test-e-post nå"}
          </button>
        </div>
      </div>

      <div className="border border-border rounded-xl bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.07)] space-y-6">
        <div className="space-y-3">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Markedsradar-mottakere
          </p>
          <div className="space-y-2">
            {radarEmails.map((email) => (
              <div key={email} className="flex items-center justify-between">
                <span className="text-[0.875rem] text-foreground">{email}</span>
                {radarEmails.length > 1 && (
                  <button
                    onClick={() => removeRecipient(email, radarEmails, setRadarEmailsLocal)}
                    className="text-muted-foreground hover:text-destructive transition-colors text-sm"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {radarEmails.length >= 5 ? (
            <p className="text-[0.75rem] text-muted-foreground">Maks 5 mottakere</p>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                placeholder="navn@domene.no"
                value={newRadarEmail}
                onChange={(e) => setNewRadarEmail(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  addRecipient(newRadarEmail, radarEmails, setRadarEmailsLocal, () => setNewRadarEmail(""))
                }
                className="h-9 text-[0.875rem]"
              />
              <button
                onClick={() =>
                  addRecipient(newRadarEmail, radarEmails, setRadarEmailsLocal, () => setNewRadarEmail(""))
                }
                className="h-9 px-3 text-[0.8125rem] font-medium rounded-lg border border-border bg-background text-foreground hover:bg-secondary shrink-0"
              >
                Legg til
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Markedsradar
          </p>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-[0.8125rem] text-foreground">Aktiver ukentlig markedsradar-mail</Label>
              <p className="text-[0.75rem] text-muted-foreground mt-1">
                Brukes for manuell utsending og fremtidig automatisering.
              </p>
            </div>
            <Switch checked={radarAktiv} onCheckedChange={(value) => setRadarAktivLocal(value)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-[0.8125rem] text-foreground">Send automatisk etter Finn-import</Label>
              <p className="text-[0.75rem] text-muted-foreground mt-1">
                Når ukens Excel importeres, sendes mailen automatisk hvis aktivert.
              </p>
            </div>
            <Switch checked={radarAutoSend} onCheckedChange={(value) => setRadarAutoSendLocal(value)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-[0.8125rem] text-foreground">Inkluder AI-oppsummering</Label>
              <p className="text-[0.75rem] text-muted-foreground mt-1">
                Kort oppsummering av trender og hva som er viktigst kommersielt.
              </p>
            </div>
            <Switch checked={radarAi} onCheckedChange={(value) => setRadarAiLocal(value)} />
          </div>
          <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2.5">
            <p className="text-[0.75rem] text-muted-foreground">
              Sist sendt uke:{" "}
              <span className="text-foreground font-medium">
                {settings?.markedsradar_sist_sendt_uke || "Ikke sendt ennå"}
              </span>
            </p>
          </div>
        </div>

        <button
          onClick={handleSaveRadar}
          disabled={savingRadar}
          className="bg-primary text-primary-foreground h-9 px-4 rounded-lg text-[0.8125rem] font-medium hover:opacity-90 disabled:opacity-50"
        >
          {savingRadar ? "Lagrer..." : "Lagre markedsradar-innstillinger"}
        </button>

        <div className="border-t border-border pt-4 flex flex-wrap gap-2">
          <button
            onClick={handleRadarTestEmail}
            disabled={sendingRadarTest}
            className="border border-border text-[0.8125rem] text-muted-foreground hover:text-foreground h-8 px-3 rounded-lg disabled:opacity-50"
          >
            {sendingRadarTest ? "Sender..." : "Send test av markedsradar"}
          </button>
          <button
            onClick={handleRadarSendNow}
            disabled={sendingRadarNow}
            className="border border-border text-[0.8125rem] text-muted-foreground hover:text-foreground h-8 px-3 rounded-lg disabled:opacity-50"
          >
            {sendingRadarNow ? "Sender..." : "Send markedsradar nå"}
          </button>
        </div>
      </div>

      <div className="border border-border rounded-xl bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.07)] space-y-6">
        <div className="space-y-3">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Salgsagent-påminnelse
          </p>
          <p className="text-[0.75rem] text-muted-foreground">
            Sender e-post til mottaker hvis Salgsagenten ikke er brukt på 7 dager.
          </p>
          <div className="space-y-2">
            {salgsagentEmails.map((email) => (
              <div key={email} className="flex items-center justify-between">
                <span className="text-[0.875rem] text-foreground">{email}</span>
                {salgsagentEmails.length > 1 && (
                  <button
                    onClick={() => setSalgsagentEmailsLocal(salgsagentEmails.filter((e) => e !== email))}
                    className="text-muted-foreground hover:text-destructive transition-colors text-sm"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {salgsagentEmails.length >= 5 ? (
            <p className="text-[0.75rem] text-muted-foreground">Maks 5 mottakere</p>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                placeholder="navn@domene.no"
                value={newSalgsagentEmail}
                onChange={(e) => setNewSalgsagentEmail(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  addRecipient(newSalgsagentEmail, salgsagentEmails, setSalgsagentEmailsLocal, () => setNewSalgsagentEmail(""))
                }
                className="h-9 text-[0.875rem]"
              />
              <button
                onClick={() =>
                  addRecipient(newSalgsagentEmail, salgsagentEmails, setSalgsagentEmailsLocal, () => setNewSalgsagentEmail(""))
                }
                className="h-9 px-3 text-[0.8125rem] font-medium rounded-lg border border-border bg-background text-foreground hover:bg-secondary shrink-0"
              >
                Legg til
              </button>
            </div>
          )}
        </div>

        <button
          onClick={async () => {
            setSavingSalgsagent(true);
            try {
              const { error } = await supabase
                .from("varslingsinnstillinger" as any)
                .update({ salgsagent_aktiv: true, updated_at: new Date().toISOString() } as any)
                .eq("id", settings.id);
              if (error) throw error;
              toast.success("Salgsagent-innstillinger lagret");
              queryClient.invalidateQueries({ queryKey: ["varslingsinnstillinger"] });
            } catch {
              toast.error("Kunne ikke lagre innstillinger");
            } finally {
              setSavingSalgsagent(false);
            }
          }}
          disabled={savingSalgsagent}
          className="bg-primary text-primary-foreground h-9 px-4 rounded-lg text-[0.8125rem] font-medium hover:opacity-90 disabled:opacity-50"
        >
          {savingSalgsagent ? "Lagrer..." : "Lagre salgsagent-innstillinger"}
        </button>

        <div className="border-t border-border pt-4">
          <button
            onClick={async () => {
              setSendingSalgsagentTest(true);
              try {
                const { error } = await supabase.functions.invoke("salgsagent-paaminning", { body: { test: true } });
                if (error) throw error;
                toast.success("Test-påminnelse sendt");
              } catch {
                toast.error("Kunne ikke sende test-påminnelse");
              } finally {
                setSendingSalgsagentTest(false);
              }
            }}
            disabled={sendingSalgsagentTest}
            className="border border-border text-[0.8125rem] text-muted-foreground hover:text-foreground h-8 px-3 rounded-lg disabled:opacity-50"
          >
            {sendingSalgsagentTest ? "Sender..." : "Send test-påminnelse"}
          </button>
        </div>
      </div>
    </div>
  );
}
