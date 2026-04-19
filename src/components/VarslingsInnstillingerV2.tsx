import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DesignLabPrimaryAction,
  DesignLabSecondaryAction,
  DesignLabGhostAction,
} from "@/components/designlab/system/actions";
import {
  DesignLabFieldLabel,
  DesignLabFieldStack,
  DesignLabTextField,
} from "@/components/designlab/system/fields";
import { C } from "@/theme";

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

function RecipientList({
  emails,
  onRemove,
  newValue,
  onNewChange,
  onAdd,
}: {
  emails: string[];
  onRemove: (email: string) => void;
  newValue: string;
  onNewChange: (value: string) => void;
  onAdd: () => void;
}) {
  return (
    <DesignLabFieldStack>
      <DesignLabFieldLabel>E-postmottakere</DesignLabFieldLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {emails.map((email) => (
          <div
            key={email}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              height: 28,
            }}
          >
            <span style={{ fontSize: 13, color: C.text }}>{email}</span>
            {emails.length > 1 && (
              <DesignLabGhostAction onClick={() => onRemove(email)} style={{ width: 28, minWidth: 28, paddingInline: 0 }}>
                ×
              </DesignLabGhostAction>
            )}
          </div>
        ))}
      </div>
      {emails.length >= 5 ? (
        <p style={{ fontSize: 12, color: C.textMuted }}>Maks 5 mottakere</p>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <DesignLabTextField
            placeholder="navn@domene.no"
            value={newValue}
            onChange={(e) => onNewChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onAdd();
            }}
            style={{ flex: 1 }}
          />
          <DesignLabSecondaryAction onClick={onAdd}>Legg til</DesignLabSecondaryAction>
        </div>
      )}
    </DesignLabFieldStack>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{label}</p>
        {description ? (
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2, lineHeight: 1.5 }}>{description}</p>
        ) : null}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function VarslingsInnstillingerV2() {
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
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: C.textMuted }} />
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
      const { error } = await supabase.functions.invoke("fornyelse-varsel-epost", { body: { test: true } });
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
      const { data, error } = await supabase.functions.invoke("markedsradar-ukesmail", { body: { test: true } });
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

  const handleSaveSalgsagent = async () => {
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
  };

  const handleSalgsagentTest = async () => {
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
  };

  return (
    <div style={{ display: "grid", gap: 16 }} className="xl:grid-cols-3">
      {/* Fornyelse */}
      <SectionCard title="Fornyelsesvarsler" description="Ukentlig e-post om oppdrag som nærmer seg slutt.">
        <RecipientList
          emails={renewalEmails}
          onRemove={(e) => removeRecipient(e, renewalEmails, setRenewalEmailsLocal)}
          newValue={newRenewalEmail}
          onNewChange={setNewRenewalEmail}
          onAdd={() => addRecipient(newRenewalEmail, renewalEmails, setRenewalEmailsLocal, () => setNewRenewalEmail(""))}
        />

        <ToggleRow
          label="Aktiver ukentlig e-postvarsel"
          checked={renewalAktiv}
          onCheckedChange={(v) => setRenewalAktivLocal(v)}
        />

        <DesignLabFieldStack>
          <DesignLabFieldLabel>Send varsler for oppdrag som utløper innen</DesignLabFieldLabel>
          <Select value={renewalTerskel} onValueChange={(v) => setRenewalTerskelLocal(v)}>
            <SelectTrigger
              style={{
                height: 32,
                borderRadius: 6,
                borderColor: "#DDE0E7",
                background: "#FFFFFF",
                fontSize: 13,
                color: C.text,
              }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 dager</SelectItem>
              <SelectItem value="60">60 dager</SelectItem>
              <SelectItem value="90">90 dager</SelectItem>
            </SelectContent>
          </Select>
        </DesignLabFieldStack>

        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4, borderTop: `1px solid ${C.borderLight}` }} className="pt-4">
          <DesignLabPrimaryAction onClick={handleSaveRenewal} disabled={savingRenewal}>
            {savingRenewal ? "Lagrer..." : "Lagre"}
          </DesignLabPrimaryAction>
          <DesignLabSecondaryAction onClick={handleTestEmail} disabled={sendingRenewalTest}>
            {sendingRenewalTest ? "Sender..." : "Send test-e-post"}
          </DesignLabSecondaryAction>
        </div>
      </SectionCard>

      {/* Markedsradar */}
      <SectionCard title="Markedsradar" description="Ukentlig oppsummering av markedsbevegelser.">
        <RecipientList
          emails={radarEmails}
          onRemove={(e) => removeRecipient(e, radarEmails, setRadarEmailsLocal)}
          newValue={newRadarEmail}
          onNewChange={setNewRadarEmail}
          onAdd={() => addRecipient(newRadarEmail, radarEmails, setRadarEmailsLocal, () => setNewRadarEmail(""))}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <ToggleRow
            label="Aktiver ukentlig markedsradar-mail"
            description="Brukes for manuell utsending og fremtidig automatisering."
            checked={radarAktiv}
            onCheckedChange={(v) => setRadarAktivLocal(v)}
          />
          <ToggleRow
            label="Send automatisk etter Finn-import"
            description="Når ukens Excel importeres, sendes mailen automatisk hvis aktivert."
            checked={radarAutoSend}
            onCheckedChange={(v) => setRadarAutoSendLocal(v)}
          />
          <ToggleRow
            label="Inkluder AI-oppsummering"
            description="Kort oppsummering av trender og hva som er viktigst kommersielt."
            checked={radarAi}
            onCheckedChange={(v) => setRadarAiLocal(v)}
          />
        </div>

        <div
          style={{
            borderRadius: 6,
            border: `1px solid ${C.borderLight}`,
            background: C.surfaceAlt,
            padding: "8px 12px",
          }}
        >
          <p style={{ fontSize: 12, color: C.textMuted }}>
            Sist sendt uke:{" "}
            <span style={{ color: C.text, fontWeight: 500 }}>
              {settings?.markedsradar_sist_sendt_uke || "Ikke sendt ennå"}
            </span>
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, borderTop: `1px solid ${C.borderLight}` }} className="pt-4">
          <DesignLabPrimaryAction onClick={handleSaveRadar} disabled={savingRadar}>
            {savingRadar ? "Lagrer..." : "Lagre"}
          </DesignLabPrimaryAction>
          <DesignLabSecondaryAction onClick={handleRadarTestEmail} disabled={sendingRadarTest}>
            {sendingRadarTest ? "Sender..." : "Send test"}
          </DesignLabSecondaryAction>
          <DesignLabSecondaryAction onClick={handleRadarSendNow} disabled={sendingRadarNow}>
            {sendingRadarNow ? "Sender..." : "Send nå"}
          </DesignLabSecondaryAction>
        </div>
      </SectionCard>

      {/* Salgsagent */}
      <SectionCard
        title="Salgsagent-påminnelse"
        description="Sender e-post til mottaker hvis Salgsagenten ikke er brukt på 7 dager."
      >
        <RecipientList
          emails={salgsagentEmails}
          onRemove={(email) =>
            salgsagentEmails.length > 1 &&
            setSalgsagentEmailsLocal(salgsagentEmails.filter((entry) => entry !== email))
          }
          newValue={newSalgsagentEmail}
          onNewChange={setNewSalgsagentEmail}
          onAdd={() =>
            addRecipient(newSalgsagentEmail, salgsagentEmails, setSalgsagentEmailsLocal, () =>
              setNewSalgsagentEmail(""),
            )
          }
        />

        <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${C.borderLight}` }} className="pt-4">
          <DesignLabPrimaryAction onClick={handleSaveSalgsagent} disabled={savingSalgsagent}>
            {savingSalgsagent ? "Lagrer..." : "Lagre"}
          </DesignLabPrimaryAction>
          <DesignLabSecondaryAction onClick={handleSalgsagentTest} disabled={sendingSalgsagentTest}>
            {sendingSalgsagentTest ? "Sender..." : "Send test-påminnelse"}
          </DesignLabSecondaryAction>
        </div>
      </SectionCard>
    </div>
  );
}
