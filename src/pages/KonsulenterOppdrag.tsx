import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { cn, formatNOK, getInitials } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { Briefcase, CalendarCheck, BarChart2, Loader2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { OppdragEditSheet } from "@/components/OppdragEditSheet";
import { FornyelsesTimeline } from "@/components/FornyelsesTimeline";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Filter = "Alle" | "Aktiv" | "Oppstart" | "Inaktiv";
const TIMER_PER_DAG = 7.5;

function computeOppdragStatus(oppdrag: any): string {
  if (oppdrag.status === "Inaktiv") return "Inaktiv";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = oppdrag.start_dato ? new Date(oppdrag.start_dato) : null;
  if (startDate && startDate > today) return "Oppstart";
  return "Aktiv";
}

// --- Settings panel as a separate component ---
function VarslingsInnstillinger() {
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

  const renewalEmails = renewalEmailsLocal ?? (settings?.epost_mottakere as string[]) ?? [];
  const renewalAktiv = renewalAktivLocal ?? settings?.aktiv ?? true;
  const renewalTerskel = renewalTerskelLocal ?? String(settings?.terskel_dager ?? 90);

  const radarEmails = radarEmailsLocal ?? (settings?.markedsradar_epost_mottakere as string[]) ?? [];
  const radarAktiv = radarAktivLocal ?? settings?.markedsradar_aktiv ?? false;
  const radarAutoSend = radarAutoSendLocal ?? settings?.markedsradar_send_etter_import ?? true;
  const radarAi = radarAiLocal ?? settings?.markedsradar_inkluder_ai ?? true;

  const salgsagentAktiv = salgsagentAktivLocal ?? settings?.salgsagent_aktiv ?? true;

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
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Fornyelsesvarsler
          </p>
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
        <div className="space-y-4">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Salgsagent-påminnelse
          </p>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-[0.8125rem] text-foreground">Aktiver ukentlig påminnelse</Label>
              <p className="text-[0.75rem] text-muted-foreground mt-1">
                Sender e-post til bruker hvis Salgsagenten ikke er brukt på 7 dager.
              </p>
            </div>
            <Switch checked={salgsagentAktiv} onCheckedChange={(value) => setSalgsagentAktivLocal(value)} />
          </div>
        </div>

        <button
          onClick={async () => {
            setSavingSalgsagent(true);
            try {
              const { error } = await supabase
                .from("varslingsinnstillinger" as any)
                .update({ salgsagent_aktiv: salgsagentAktiv, updated_at: new Date().toISOString() } as any)
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
                toast.success("Test-påminnelse sendt til thomas@stacq.no");
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

export default function KonsulenterOppdrag() {
  const [filter, setFilter] = useState<Filter>("Aktiv");
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"oppdrag" | "innstillinger">("oppdrag");
  const today = new Date();

  const { data: oppdrag = [], isLoading } = useQuery({
    queryKey: ["stacq-oppdrag"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stacq_oppdrag")
        .select("*")
        .order("start_dato", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allCompanies = [] } = useQuery({
    queryKey: ["all-companies-status"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, status");
      return data || [];
    },
  });
  const companyStatusMap: Record<string, string> = Object.fromEntries(allCompanies.map((c: any) => [c.id, c.status]));

  const enriched = useMemo(
    () =>
      oppdrag.map((o: any) => {
        const computedStatus = computeOppdragStatus(o);
        const utpris = Number(o.utpris) || 0;
        const tilKons = Number(o.til_konsulent) || 0;
        const marginPerTime = utpris - tilKons;
        const margin = marginPerTime * TIMER_PER_DAG;
        const marginPct = utpris > 0 ? (marginPerTime / utpris) * 100 : 0;
        const daysUntilForny = o.lopende_30_dager
          ? 30
          : o.forny_dato
            ? differenceInDays(new Date(o.forny_dato), today)
            : null;
        return { ...o, status: computedStatus, margin, marginPerTime, marginPct, daysUntilForny };
      }),
    [oppdrag],
  );

  const stats = useMemo(() => {
    const aktive = enriched.filter((o: any) => o.status === "Aktiv");
    const oppstart = enriched.filter((o: any) => o.status === "Oppstart");
    const totalDagspris = aktive.reduce((s: number, o: any) => s + (Number(o.utpris) || 0) * TIMER_PER_DAG, 0);
    const avgMargin = aktive.length > 0 ? aktive.reduce((s: number, o: any) => s + o.marginPct, 0) / aktive.length : 0;
    const now = new Date();
    const y = now.getFullYear(),
      m = now.getMonth();
    const dim = new Date(y, m + 1, 0).getDate();
    let workdays = 0;
    for (let d = 1; d <= dim; d++) {
      const dow = new Date(y, m, d).getDay();
      if (dow !== 0 && dow !== 6) workdays++;
    }
    const stacqPerDag = aktive.reduce((s: number, o: any) => s + o.margin, 0);
    const stacqMonthly = stacqPerDag * workdays;
    const oppstartMarginPerTime =
      oppstart.length > 0 ? oppstart.reduce((s: number, o: any) => s + o.marginPerTime, 0) / oppstart.length : 0;
    const fornyelser30 = enriched.filter(
      (o: any) =>
        (o.status === "Aktiv" || o.status === "Oppstart") &&
        o.daysUntilForny !== null &&
        o.daysUntilForny >= 0 &&
        o.daysUntilForny <= 30,
    ).length;

    const fornyelser60 = enriched.filter(
      (o: any) =>
        (o.status === "Aktiv" || o.status === "Oppstart") &&
        o.daysUntilForny !== null &&
        o.daysUntilForny >= 0 &&
        o.daysUntilForny <= 60,
    ).length;

    return {
      aktive: aktive.length,
      oppstart: oppstart.length,
      totalDagspris,
      avgMargin,
      stacqMonthly,
      workdays,
      monthLabel: format(now, "MMMM yyyy"),
      oppstartMarginPerTime,
      fornyelser30,
      fornyelser60,
    };
  }, [enriched]);

  const filtered = useMemo(() => {
    let items = enriched;
    if (filter === "Aktiv") items = items.filter((o: any) => o.status === "Aktiv" || o.status === "Oppstart");
    else if (filter !== "Alle") items = items.filter((o: any) => o.status === filter);

    return [...items].sort((a: any, b: any) => {
      const order: Record<string, number> = { Oppstart: 0, Aktiv: 1, Inaktiv: 2 };
      const oa = order[a.status] ?? 3;
      const ob = order[b.status] ?? 3;
      if (oa !== ob) return oa - ob;
      if (a.status === "Oppstart") return (a.start_dato || "").localeCompare(b.start_dato || "");
      if (a.status === "Aktiv") {
        const af = a.forny_dato || "9999";
        const bf = b.forny_dato || "9999";
        return af.localeCompare(bf);
      }
      return (b.slutt_dato || "").localeCompare(a.slutt_dato || "");
    });
  }, [enriched, filter]);

  const chips: Filter[] = ["Alle", "Aktiv", "Oppstart", "Inaktiv"];

  if (isLoading) {
    return <p className="text-muted-foreground py-12 text-center">Laster oppdrag...</p>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-[1.375rem] font-bold">Aktive oppdrag</h1>
        <span className="bg-secondary text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
          {stats.aktive + stats.oppstart}
        </span>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-2 mb-6">
        {(
          [
            { key: "oppdrag", label: "Oppdrag" },
            { key: "innstillinger", label: "Varslingsinnstillinger" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors",
              activeTab === tab.key
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:bg-secondary",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "oppdrag" && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 rounded-xl px-5 py-4 shadow-sm">
              <Briefcase className="h-4 w-4 text-emerald-600 mb-1" />
              <p className="text-2xl font-bold text-emerald-600">{stats.aktive}</p>
              <p className="text-[0.8125rem] text-muted-foreground">Aktive oppdrag</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 rounded-xl px-5 py-4 shadow-sm">
              <CalendarCheck className="h-4 w-4 text-amber-600 mb-1" />
              <p className="text-2xl font-bold text-amber-600">{stats.oppstart}</p>
              <p className="text-[0.8125rem] text-muted-foreground">I oppstart</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 rounded-xl px-5 py-4 shadow-sm">
              <BarChart2 className="h-4 w-4 text-amber-600 mb-1" />
              <p className="text-2xl font-bold text-amber-600">{stats.fornyelser30}</p>
              <p className="text-[0.8125rem] text-muted-foreground">Fornyelser under 30 dager</p>
              <p className="text-xs text-muted-foreground">Krever oppfølging</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 rounded-xl px-5 py-4 shadow-sm">
              <BarChart2 className="h-4 w-4 text-amber-600 mb-1" />
              <p className="text-2xl font-bold text-amber-600">{stats.fornyelser60}</p>
              <p className="text-[0.8125rem] text-muted-foreground">Fornyelser under 60 dager</p>
              <p className="text-xs text-muted-foreground">Krever oppfølging</p>
            </div>
          </div>

          {/* Renewal timeline */}
          <FornyelsesTimeline enriched={enriched} />

          {/* Filter chips */}
          <div className="flex items-center gap-2 mb-4">
            {chips.map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={cn(
                  "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors",
                  filter === c
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:bg-secondary",
                )}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="border border-border rounded-lg overflow-hidden bg-card shadow-[0_1px_3px_rgba(0,0,0,0.07)]">
            {/* Header row */}
            <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_80px_90px_110px_100px_90px] gap-3 px-4 py-2.5 border-b border-border bg-background">
              {["Konsulent", "Kunde", "Type", "Utpris", "Margin", "Forny", "Status"].map((h) => (
                <span
                  key={h}
                  className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground"
                >
                  {h}
                </span>
              ))}
            </div>
            {/* Data rows */}
            <div className="divide-y divide-border">
              {filtered.map((o: any) => {
                const isInaktiv = o.status === "Inaktiv";

                return (
                  <div
                    key={o.id}
                    onClick={() => setSelectedRowId(o.id)}
                    className={cn(
                      "grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_80px_90px_110px_100px_90px] gap-3 items-center px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer",
                      isInaktiv && "opacity-60",
                    )}
                  >
                    {/* KONSULENT */}
                    <div className="min-w-0">
                      <p className="text-[0.875rem] font-semibold text-foreground truncate">{o.kandidat}</p>
                    </div>
                    {/* KUNDE */}
                    <span className="text-[0.875rem] font-medium text-foreground truncate">{o.kunde}</span>
                    {/* TYPE */}
                    <div>
                      {(() => {
                        const cs = o.selskap_id ? companyStatusMap[o.selskap_id] : null;
                        if (cs === "partner")
                          return (
                            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-0.5 text-[0.6875rem] font-semibold">
                              Partner
                            </span>
                          );
                        if (cs === "customer" || cs === "kunde")
                          return (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-[0.6875rem] font-semibold">
                              Kunde
                            </span>
                          );
                        if (cs === "prospect")
                          return (
                            <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-0.5 text-[0.6875rem] font-semibold">
                              Potensiell
                            </span>
                          );
                        return (
                          <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-500 border border-gray-200 px-2.5 py-0.5 text-[0.6875rem] font-semibold">
                            —
                          </span>
                        );
                      })()}
                    </div>
                    {/* UTPRIS */}
                    <span className="text-[0.8125rem] font-medium text-foreground">
                      kr {formatNOK(Number(o.utpris) || 0)}/t
                    </span>
                    {/* MARGIN */}
                    <div>
                      <p
                        className={cn(
                          "text-[0.8125rem] font-medium",
                          o.marginPct >= 28
                            ? "text-emerald-600"
                            : o.marginPct >= 20
                              ? "text-amber-600"
                              : "text-destructive",
                        )}
                      >
                        kr {formatNOK(o.marginPerTime)}/t
                      </p>
                      <p className="text-[0.6875rem] text-muted-foreground">{o.marginPct.toFixed(1)}%</p>
                    </div>
                    {/* FORNY */}
                    <div className="text-[0.8125rem]">
                      {o.daysUntilForny === null ? (
                        <span className="text-muted-foreground">–</span>
                      ) : o.daysUntilForny < 0 ? (
                        <span className="text-destructive font-medium">Utløpt</span>
                      ) : o.daysUntilForny <= 30 ? (
                        <span className="text-amber-600 font-medium">Om {o.daysUntilForny}d</span>
                      ) : o.daysUntilForny <= 90 ? (
                        <span className="text-amber-600">{format(new Date(o.forny_dato), "dd.MM.yy")}</span>
                      ) : (
                        <span className="text-muted-foreground">{format(new Date(o.forny_dato), "dd.MM.yy")}</span>
                      )}
                    </div>
                    {/* STATUS */}
                    <div>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold",
                          o.status === "Aktiv" && "bg-emerald-100 text-emerald-700",
                          o.status === "Oppstart" && "bg-amber-100 text-amber-700",
                          o.status === "Inaktiv" && "bg-muted text-muted-foreground",
                        )}
                      >
                        {o.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {filtered.length === 0 && <p className="text-muted-foreground text-center py-12">Ingen oppdrag å vise</p>}
          </div>
          <Sheet
            open={selectedRowId !== null}
            onOpenChange={(o) => {
              if (!o) setSelectedRowId(null);
            }}
          >
            <SheetContent side="right" className="w-[840px] sm:w-[920px] p-0" hideCloseButton>
              <OppdragEditSheet
                row={enriched.find((o: any) => o.id === selectedRowId) || null}
                onClose={() => setSelectedRowId(null)}
              />
            </SheetContent>
          </Sheet>
        </>
      )}

      {activeTab === "innstillinger" && <VarslingsInnstillinger />}
    </div>
  );
}
