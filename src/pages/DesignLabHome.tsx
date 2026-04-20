import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, RefreshCw, Sparkles, X } from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { nb } from "date-fns/locale";

import { DesignLabPageShell } from "@/components/designlab/DesignLabPageShell";
import { C } from "@/components/designlab/theme";
import {
  DesignLabHeatBadge,
  DesignLabSignalBadge,
  DesignLabPrimaryAction,
} from "@/components/designlab/system";
import { DesignLabSearchInput } from "@/components/designlab/controls";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { hasConsultantAvailability } from "@/lib/contactHunt";
import { loadHomeQueueData, getTop10Leads, type HomeQueueLead } from "@/lib/homeQueueModel";

/* ─── Types ─── */

interface PipelinePulse {
  aktive_foresporsler: number;
  konsulenter_ledige_30d: number;
  fornyelser_uka: number;
  vunnet_i_gar: number;
}

interface InboxInsight {
  summary: string;
  type: "unanswered" | "buried" | "follow_up";
  email_id: string | null;
  contact_email: string | null;
  age_days: number;
  web_link: string | null;
}

interface InboxPulseResponse {
  insights: InboxInsight[];
  scanned_count: number;
  generated_at: string;
}

interface ConsultantMatch {
  consultant_id: number;
  best_contact_id: string | null;
  score: number;
  reasoning: string;
}

interface ForesporselRow {
  id: number;
  selskap_navn: string;
  mottatt_dato: string;
  sted: string | null;
  teknologier: string[] | null;
  status: string | null;
}

interface AvailableConsultant {
  id: number;
  navn: string;
  kompetanse: string[];
  tilgjengelig_fra: string | null;
}

const FALLBACK_PLACEHOLDER = "Hvem trenger C++ akkurat nå?";

const INSIGHT_TYPE_LABEL: Record<InboxInsight["type"], string> = {
  unanswered: "Ubesvart",
  buried: "Ligger begravd",
  follow_up: "Oppfølging",
};

/* ─── Section primitives (table-style, à la DesignLabContacts) ─── */

function Section({ children }: { children: React.ReactNode }) {
  return <div style={{ borderBottom: `1px solid ${C.borderLight}` }}>{children}</div>;
}

function SectionHeader({
  title,
  meta,
  right,
}: {
  title: string;
  meta?: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ padding: "16px 16px 6px" }}
    >
      <div className="flex items-baseline gap-2">
        <span style={{ fontSize: 12, fontWeight: 600, color: C.text, letterSpacing: "0.01em" }}>
          {title}
        </span>
        {meta ? (
          <span style={{ fontSize: 11, color: C.textFaint }}>{meta}</span>
        ) : null}
      </div>
      {right}
    </div>
  );
}

function ColHeader({
  cols,
  labels,
}: {
  cols: string;
  labels: (string | { label: string; align?: "left" | "right" })[];
}) {
  return (
    <div
      className="sticky top-0 z-10"
      style={{ background: C.surfaceAlt, borderBottom: `1px solid ${C.border}` }}
    >
      <div
        className="grid items-center"
        style={{
          gridTemplateColumns: cols,
          height: 32,
          paddingLeft: 16,
          paddingRight: 16,
          gap: 12,
        }}
      >
        {labels.map((l, i) => {
          const label = typeof l === "string" ? l : l.label;
          const align = typeof l === "string" ? "left" : l.align ?? "left";
          return (
            <span
              key={i}
              className={align === "right" ? "text-right" : ""}
              style={{
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: C.textMuted,
              }}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      style={{ width: 6, height: 6, borderRadius: 999, background: color, display: "inline-block", flexShrink: 0 }}
    />
  );
}

function TableRow({
  cols,
  children,
  onClick,
  focused,
  onMouseEnter,
  accentColor,
}: {
  cols: string;
  children: React.ReactNode;
  onClick?: () => void;
  focused?: boolean;
  onMouseEnter?: () => void;
  accentColor?: string;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className="group grid items-center transition-colors"
      style={{
        gridTemplateColumns: cols,
        minHeight: 36,
        paddingLeft: 16,
        paddingRight: 16,
        gap: 12,
        cursor: onClick ? "pointer" : "default",
        background: focused ? C.hoverBg : "transparent",
        borderBottom: `1px solid ${C.borderLight}`,
        boxShadow: accentColor ? `inset 3px 0 0 ${accentColor}` : undefined,
      }}
      onMouseLeave={(e) => {
        if (!focused) (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
      onMouseOver={(e) => {
        if (!focused) (e.currentTarget as HTMLDivElement).style.background = C.hoverBg;
      }}
    >
      {children}
    </div>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "16px", fontSize: 13, color: C.textFaint }}>{children}</div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      style={{
        fontFamily: "inherit",
        fontSize: 10,
        padding: "1px 5px",
        margin: "0 1px",
        background: C.surfaceAlt,
        color: C.textMuted,
        border: `1px solid ${C.borderLight}`,
        borderRadius: 3,
        verticalAlign: "baseline",
      }}
    >
      {children}
    </kbd>
  );
}

function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ padding: "8px 24px 12px" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 16,
            margin: "8px 0",
            background: C.surfaceAlt,
            borderRadius: 4,
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════ */

export default function DesignLabHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const searchRef = useRef<HTMLInputElement>(null);

  /* ──────── Brukerprofil for hilsen ──────── */
  const { data: profile } = useQuery<{ full_name: string | null } | null>({
    queryKey: ["dl-home-profile", user?.id || ""],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 60 * 60 * 1000,
  });

  const firstName = useMemo(() => {
    const full = profile?.full_name?.trim();
    if (!full) return "";
    return full.split(" ")[0];
  }, [profile]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return "God natt";
    if (h < 10) return "God morgen";
    if (h < 17) return "God dag";
    if (h < 22) return "God kveld";
    return "God natt";
  }, []);

  const todayLabel = useMemo(
    () => format(new Date(), "EEEE d. MMMM", { locale: nb }),
    [],
  );

  /* ──────── Pipeline ──────── */
  const { data: pulse } = useQuery<PipelinePulse>({
    queryKey: ["dl-home-pulse"],
    queryFn: async () => {
      const now = new Date();
      const in30d = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
      const in7d = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const yesterdayStart = new Date(todayStart.getTime() - 86400000);
      const since45d = new Date(now.getTime() - 45 * 86400000).toISOString().slice(0, 10);

      const [foresRes, ansatteRes, oppdragRes, vunnetRes] = await Promise.all([
        supabase.from("foresporsler").select("id", { count: "exact", head: true }).gte("mottatt_dato", since45d),
        supabase
          .from("stacq_ansatte")
          .select("id", { count: "exact", head: true })
          .lte("tilgjengelig_fra", in30d),
        supabase
          .from("stacq_oppdrag")
          .select("id", { count: "exact", head: true })
          .gte("forny_dato", todayStart.toISOString().slice(0, 10))
          .lte("forny_dato", in7d),
        supabase
          .from("foresporsler_konsulenter")
          .select("id", { count: "exact", head: true })
          .eq("status", "vunnet")
          .gte("status_updated_at", yesterdayStart.toISOString())
          .lte("status_updated_at", todayStart.toISOString()),
      ]);

      return {
        aktive_foresporsler: foresRes.count || 0,
        konsulenter_ledige_30d: ansatteRes.count || 0,
        fornyelser_uka: oppdragRes.count || 0,
        vunnet_i_gar: vunnetRes.count || 0,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  /* ──────── Innboks-puls (AI) ──────── */
  const {
    data: inbox,
    isLoading: inboxLoading,
    refetch: refetchInbox,
    isFetching: inboxFetching,
  } = useQuery<InboxPulseResponse>({
    queryKey: ["dl-home-inbox-pulse"],
    queryFn: async () => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("no session");
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inbox-pulse`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("inbox-pulse failed");
      return resp.json();
    },
    staleTime: 30 * 60 * 1000,
    retry: 0,
  });

  /* ──────── Tilgjengelige konsulenter ──────── */
  const { data: availableConsultants = [] } = useQuery<AvailableConsultant[]>({
    queryKey: ["dl-home-available-consultants"],
    queryFn: async () => {
      const in60d = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("stacq_ansatte")
        .select("id, navn, kompetanse, tilgjengelig_fra, status")
        .lte("tilgjengelig_fra", in60d)
        .not("tilgjengelig_fra", "is", null)
        .in("status", ["AKTIV/SIGNERT", "Ledig"]);
      return (data || [])
        .filter((c: any) => hasConsultantAvailability(c.tilgjengelig_fra))
        .map((c: any) => ({
          id: c.id,
          navn: c.navn,
          kompetanse: c.kompetanse || [],
          tilgjengelig_fra: c.tilgjengelig_fra,
        }))
        .slice(0, 5);
    },
    staleTime: 5 * 60 * 1000,
  });

  /* ──────── Topp 10 hotteste leads ──────── */
  const { data: queue = [], isLoading: queueLoading } = useQuery<HomeQueueLead[]>({
    queryKey: ["dl-home-queue", user?.id || ""],
    queryFn: () => loadHomeQueueData(user?.id || null),
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  const top10 = useMemo(() => getTop10Leads(queue), [queue]);

  /* ──────── AI-match konsulent → lead ──────── */
  const {
    data: matchData,
    isLoading: matchLoading,
  } = useQuery<{ matches: ConsultantMatch[] }>({
    queryKey: [
      "dl-home-cl-match",
      availableConsultants.map((c) => c.id).join(","),
      top10.map((l) => l.contactId).slice(0, 10).join(","),
    ],
    queryFn: async () => {
      if (availableConsultants.length === 0 || top10.length === 0) return { matches: [] };
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("no session");
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/consultant-lead-match`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            consultants: availableConsultants.map((c) => ({
              consultant_id: c.id,
              navn: c.navn,
              kompetanse: c.kompetanse,
              tilgjengelig_fra: c.tilgjengelig_fra,
            })),
            leads: top10.map((l) => ({
              contact_id: l.contactId,
              navn: l.contactName,
              selskap: l.companyName,
              signal: l.signal,
              teknologier: l.technologies,
              heat_score: l.heat.score,
            })),
          }),
        },
      );
      if (!resp.ok) return { matches: [] };
      return resp.json();
    },
    staleTime: 30 * 60 * 1000,
    enabled: availableConsultants.length > 0 && top10.length > 0,
  });

  const matches = matchData?.matches || [];

  /* ──────── Nye forespørsler (7d) ──────── */
  const { data: nyeForesporsler = [] } = useQuery<ForesporselRow[]>({
    queryKey: ["dl-home-foresp-7d"],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("foresporsler")
        .select("id, selskap_navn, mottatt_dato, sted, teknologier, status")
        .gte("mottatt_dato", since)
        .order("mottatt_dato", { ascending: false })
        .limit(8);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  /* ──────── Inline AI-søk ──────── */
  const [searchQuery, setSearchQuery] = useState("");
  const [aiAnswer, setAiAnswer] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);

  const askAgent = async () => {
    const q = searchQuery.trim();
    if (!q || aiLoading) return;
    setAiLoading(true);
    setAiAnswer("");
    try {
      // Bygg lett kontekst fra topp-leads og forespørsler — vi har dem allerede
      const context = {
        top_leads: top10.slice(0, 10).map((l) => ({
          navn: l.contactName,
          selskap: l.companyName,
          signal: l.signal,
          tek: l.technologies,
        })),
        nye_foresporsler: nyeForesporsler.map((f) => ({
          selskap: f.selskap_navn,
          tek: f.teknologier || [],
          sted: f.sted,
          dato: f.mottatt_dato,
        })),
        ledige_konsulenter: availableConsultants.map((c) => ({
          navn: c.navn,
          tek: c.kompetanse,
          ledig: c.tilgjengelig_fra,
        })),
      };

      const systemPrompt = `Du er salgsassistent for STACQ (norsk IT-konsulentbyrå, embedded/firmware/C/C++).
Bruk konteksten under til å svare presist. Nevn konkrete navn/selskap/teknologier fra dataene.
Norsk bokmål. Maks 80 ord. Ikke pad svaret. Bruk "konsulent".

KONTEKST:
${JSON.stringify(context)}`;

      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        setAiAnswer("Du må være logget inn for å spørre agenten.");
        setAiLoading(false);
        return;
      }

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          system: systemPrompt,
          messages: [{ role: "user", content: q }],
        }),
      });
      const data = await resp.json();
      setAiAnswer(data.text || data.error || "Ingen svar.");
    } catch {
      setAiAnswer("Beklager, noe gikk galt.");
    } finally {
      setAiLoading(false);
    }
  };

  /* ──────── Fokus-rad og tastatur ──────── */
  type FocusRow =
    | { kind: "inbox"; idx: number }
    | { kind: "match"; idx: number }
    | { kind: "foresporsel"; idx: number }
    | { kind: "lead"; idx: number };

  const [focused, setFocused] = useState<FocusRow | null>(null);

  const orderedRows: FocusRow[] = useMemo(() => {
    const rows: FocusRow[] = [];
    inbox?.insights.forEach((_, i) => rows.push({ kind: "inbox", idx: i }));
    matches.forEach((_, i) => rows.push({ kind: "match", idx: i }));
    nyeForesporsler.forEach((_, i) => rows.push({ kind: "foresporsel", idx: i }));
    top10.forEach((_, i) => rows.push({ kind: "lead", idx: i }));
    return rows;
  }, [inbox, matches, nyeForesporsler, top10]);

  const isFocused = (row: FocusRow) =>
    focused?.kind === row.kind && focused.idx === row.idx;

  const openFocused = () => {
    if (!focused) return;
    if (focused.kind === "inbox") {
      const link = inbox?.insights[focused.idx]?.web_link;
      if (link) window.open(link, "_blank");
    } else if (focused.kind === "match") {
      const m = matches[focused.idx];
      if (m?.best_contact_id) navigate(`/design-lab/kontakter/${m.best_contact_id}`);
    } else if (focused.kind === "foresporsel") {
      navigate("/design-lab/foresporsler");
    } else if (focused.kind === "lead") {
      const l = top10[focused.idx];
      if (l) navigate(`/design-lab/kontakter/${l.contactId}`);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isInput =
        document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA";

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "Escape") {
        if (aiAnswer) {
          setAiAnswer("");
          return;
        }
      }
      if (isInput) return;

      if (orderedRows.length === 0) return;

      const currentIdx = focused
        ? orderedRows.findIndex((r) => r.kind === focused.kind && r.idx === focused.idx)
        : -1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(currentIdx + 1, orderedRows.length - 1);
        setFocused(orderedRows[Math.max(0, next)]);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = Math.max(currentIdx - 1, 0);
        setFocused(orderedRows[next]);
      } else if (e.key === "Enter") {
        if (focused) {
          e.preventDefault();
          openFocused();
        }
      } else if (e.key.toLowerCase() === "j" && focused) {
        // Ring — naviger til kontakt
        if (focused.kind === "lead") {
          const l = top10[focused.idx];
          if (l) navigate(`/design-lab/kontakter/${l.contactId}`);
        }
      } else if (e.key.toLowerCase() === "m" && focused) {
        if (focused.kind === "lead") {
          const l = top10[focused.idx];
          if (l) navigate(`/design-lab/kontakter/${l.contactId}`);
        } else if (focused.kind === "inbox") {
          const link = inbox?.insights[focused.idx]?.web_link;
          if (link) window.open(link, "_blank");
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focused, orderedRows, top10, inbox, matches, navigate, aiAnswer]);

  /* ──────── Helper: lookup contact for match ──────── */
  const findLead = (contactId: string | null): HomeQueueLead | undefined => {
    if (!contactId) return undefined;
    return queue.find((l) => l.contactId === contactId);
  };

  return (
    <DesignLabPageShell
      activePath="/design-lab/home"
      title="Hjem · Morgenkø"
      maxWidth={1180}
      contentStyle={{ padding: "0" }}
    >
      <div style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif" }}>
        {/* VELKOMST */}
        <Section>
          <div style={{ padding: "22px 24px 18px" }}>
            <div
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: C.text,
                letterSpacing: "-0.01em",
                lineHeight: 1.25,
              }}
            >
              {greeting}
              {firstName ? `, ${firstName}` : ""}.
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 13,
                color: C.textMuted,
                lineHeight: 1.5,
                maxWidth: 760,
              }}
            >
              {todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)}. Her er
              dagens morgenkø — det viktigste fra innboksen, ledige konsulenter
              som venter på sitt neste oppdrag, ferske forespørsler og dine
              hotteste leads. Bla med <Kbd>↑</Kbd> <Kbd>↓</Kbd>, åpne med{" "}
              <Kbd>Enter</Kbd>, søk med <Kbd>⌘K</Kbd>.
            </div>
          </div>
        </Section>

        {/* PIPELINE */}
        <Section>
          <div className="flex items-center" style={{ padding: "16px 24px", gap: 28, flexWrap: "wrap" }}>
            <PulseStat
              value={pulse?.aktive_foresporsler ?? "—"}
              label="forespørsler aktive (45d)"
              onClick={() => navigate("/design-lab/foresporsler")}
            />
            <PulseStat
              value={pulse?.konsulenter_ledige_30d ?? "—"}
              label="konsulenter ledige (30d)"
              onClick={() => navigate("/design-lab/ansatte")}
            />
            <PulseStat
              value={pulse?.fornyelser_uka ?? "—"}
              label="fornyelser denne uka"
              onClick={() => navigate("/design-lab/aktive-oppdrag")}
            />
            <PulseStat
              value={pulse?.vunnet_i_gar ?? "—"}
              label="vunnet i går"
              onClick={() => navigate("/design-lab/foresporsler")}
            />
          </div>
        </Section>

        {/* INNBOKS-PULS */}
        <Section>
          <SectionHeader
            title="Innboks-puls"
            meta={
              inboxLoading
                ? "AI leser …"
                : inbox
                  ? `AI har lest ${inbox.scanned_count} e-poster siste 14 dager`
                  : "Ikke koblet til Outlook"
            }
            right={
              <button
                onClick={() => refetchInbox()}
                disabled={inboxFetching}
                title="Last på nytt"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: C.textFaint,
                  padding: 4,
                }}
              >
                <RefreshCw size={12} className={inboxFetching ? "animate-spin" : ""} />
              </button>
            }
          />
          {inboxLoading ? (
            <Skeleton rows={3} />
          ) : !inbox || inbox.insights.length === 0 ? (
            <EmptyText>Ingen handlingsverdige e-poster funnet.</EmptyText>
          ) : (
            <div style={{ paddingBottom: 8 }}>
              {inbox.insights.map((ins, idx) => {
                const focusedRow = isFocused({ kind: "inbox", idx });
                return (
                  <Row
                    key={`inbox-${idx}`}
                    focused={focusedRow}
                    onMouseEnter={() => setFocused({ kind: "inbox", idx })}
                    onClick={() => {
                      if (ins.web_link) window.open(ins.web_link, "_blank");
                    }}
                  >
                    <Dot color={ins.type === "unanswered" ? C.danger : ins.type === "buried" ? C.warning : C.info} />
                    <span style={{ fontSize: 11, color: C.textFaint, width: 92, flexShrink: 0 }}>
                      {INSIGHT_TYPE_LABEL[ins.type]} · {ins.age_days}d
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: C.text,
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ins.summary}
                    </span>
                    {ins.contact_email ? (
                      <span style={{ fontSize: 11, color: C.textFaint, flexShrink: 0 }}>
                        {ins.contact_email}
                      </span>
                    ) : null}
                    <ArrowRight size={12} className="opacity-0 group-hover:opacity-100" style={{ color: C.textFaint }} />
                  </Row>
                );
              })}
            </div>
          )}
        </Section>

        {/* KONSULENT → LEAD */}
        <Section>
          <SectionHeader
            title="Tilgjengelige konsulenter — AI foreslår beste lead"
            meta={
              availableConsultants.length === 0
                ? "Ingen ledige konsulenter neste 60d"
                : `${availableConsultants.length} ledig${availableConsultants.length === 1 ? "" : "e"}`
            }
          />
          {matchLoading ? (
            <Skeleton rows={3} />
          ) : availableConsultants.length === 0 ? (
            <EmptyText>Ingen konsulenter ledige innen 60 dager.</EmptyText>
          ) : matches.length === 0 ? (
            <EmptyText>Ingen leads matchet (henter forslag …).</EmptyText>
          ) : (
            <div style={{ paddingBottom: 8 }}>
              {matches.map((m, idx) => {
                const consultant = availableConsultants.find((c) => c.id === m.consultant_id);
                if (!consultant) return null;
                const lead = findLead(m.best_contact_id);
                const focusedRow = isFocused({ kind: "match", idx });
                const dateLabel = consultant.tilgjengelig_fra
                  ? format(new Date(consultant.tilgjengelig_fra), "d. MMM", { locale: nb })
                  : "—";

                return (
                  <Row
                    key={`match-${idx}`}
                    focused={focusedRow}
                    onMouseEnter={() => setFocused({ kind: "match", idx })}
                    onClick={() => {
                      if (lead) navigate(`/design-lab/kontakter/${lead.contactId}`);
                    }}
                  >
                    <span style={{ fontSize: 13, color: C.text, fontWeight: 500, width: 150, flexShrink: 0 }}>
                      {consultant.navn}
                    </span>
                    <span style={{ fontSize: 11, color: C.textMuted, width: 78, flexShrink: 0 }}>
                      ledig {dateLabel}
                    </span>
                    <span style={{ fontSize: 11, color: C.textFaint, width: 130, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {(consultant.kompetanse || []).slice(0, 3).join(" · ") || "—"}
                    </span>
                    <ArrowRight size={11} style={{ color: C.textGhost, flexShrink: 0 }} />
                    {lead ? (
                      <>
                        <span style={{ fontSize: 13, color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {lead.contactName} <span style={{ color: C.textFaint }}>· {lead.companyName}</span>
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: m.score >= 80 ? C.success : m.score >= 60 ? C.warning : C.textMuted,
                            flexShrink: 0,
                          }}
                        >
                          {m.score}%
                        </span>
                        <DesignLabSignalBadge signal={lead.signal} size="sm" />
                      </>
                    ) : (
                      <span style={{ fontSize: 12, color: C.textFaint, flex: 1 }}>
                        {m.reasoning || "Ingen passende lead nå."}
                      </span>
                    )}
                  </Row>
                );
              })}
              {matches.some((m) => m.reasoning) ? (
                <div style={{ padding: "4px 24px 8px", fontSize: 11, color: C.textFaint, fontStyle: "italic" }}>
                  {matches.find((m) => m.best_contact_id)?.reasoning}
                </div>
              ) : null}
            </div>
          )}
        </Section>

        {/* NYE FORESPØRSLER (7d) */}
        <Section>
          <SectionHeader
            title="Nye forespørsler (7 dager)"
            meta={`${nyeForesporsler.length}`}
          />
          {nyeForesporsler.length === 0 ? (
            <EmptyText>Ingen nye forespørsler siste 7 dager.</EmptyText>
          ) : (
            <div style={{ paddingBottom: 8 }}>
              {nyeForesporsler.map((f, idx) => {
                const ago = formatDistanceToNowStrict(new Date(f.mottatt_dato), { locale: nb });
                const focusedRow = isFocused({ kind: "foresporsel", idx });
                return (
                  <Row
                    key={`fr-${f.id}`}
                    focused={focusedRow}
                    onMouseEnter={() => setFocused({ kind: "foresporsel", idx })}
                    onClick={() => navigate("/design-lab/foresporsler")}
                  >
                    <span style={{ fontSize: 11, color: C.textFaint, width: 60, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                      {ago.replace(/\s/, "\u00A0")}
                    </span>
                    <span style={{ fontSize: 13, color: C.text, fontWeight: 500, width: 200, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.selskap_navn}
                    </span>
                    <span style={{ fontSize: 12, color: C.textMuted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {(f.teknologier || []).slice(0, 5).join(" · ") || "—"}
                    </span>
                    <span style={{ fontSize: 11, color: C.textFaint, width: 110, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.sted || ""}
                    </span>
                    <ArrowRight size={12} className="opacity-0 group-hover:opacity-100" style={{ color: C.textFaint }} />
                  </Row>
                );
              })}
            </div>
          )}
        </Section>

        {/* TOPP 10 LEADS */}
        <Section>
          <SectionHeader
            title="Topp 10 hotteste leads"
            meta={queueLoading ? "Beregner …" : `${top10.length} av ${queue.length}`}
          />
          {queueLoading ? (
            <Skeleton rows={6} />
          ) : top10.length === 0 ? (
            <EmptyText>Ingen leads tilgjengelig akkurat nå.</EmptyText>
          ) : (
            <div style={{ paddingBottom: 8 }}>
              {top10.map((lead, idx) => {
                const focusedRow = isFocused({ kind: "lead", idx });
                return (
                  <Row
                    key={`lead-${lead.contactId}`}
                    focused={focusedRow}
                    onMouseEnter={() => setFocused({ kind: "lead", idx })}
                    onClick={() => navigate(`/design-lab/kontakter/${lead.contactId}`)}
                  >
                    <span style={{ width: 72, flexShrink: 0 }}>
                      <DesignLabHeatBadge temperature={lead.heat.temperature} />
                    </span>
                    <span style={{ fontSize: 13, color: C.text, fontWeight: 500, width: 180, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {lead.contactName}
                    </span>
                    <span style={{ fontSize: 12, color: C.textMuted, width: 200, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {lead.companyName}
                    </span>
                    <span style={{ fontSize: 12, color: C.textFaint, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {lead.reasonLine}
                    </span>
                    {lead.signal ? <DesignLabSignalBadge signal={lead.signal} size="sm" /> : null}
                    <ArrowRight size={12} className="opacity-0 group-hover:opacity-100" style={{ color: C.textFaint, flexShrink: 0 }} />
                  </Row>
                );
              })}
            </div>
          )}
        </Section>

        {/* SPØR AGENTEN */}
        <Section>
          <div style={{ padding: "16px 24px 20px" }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
              <Sparkles size={12} style={{ color: C.accent }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Spør agenten</span>
              <span style={{ fontSize: 11, color: C.textFaint, marginLeft: "auto" }}>
                <kbd
                  style={{
                    fontFamily: "inherit",
                    fontSize: 10,
                    padding: "1px 5px",
                    background: C.surfaceAlt,
                    color: C.textMuted,
                    border: `1px solid ${C.borderLight}`,
                    borderRadius: 3,
                  }}
                >
                  ⌘K
                </kbd>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <DesignLabSearchInput
                ref={searchRef}
                placeholder={FALLBACK_PLACEHOLDER}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") askAgent();
                }}
                style={{ flex: 1 } as React.CSSProperties}
              />
              <DesignLabPrimaryAction
                onClick={askAgent}
                disabled={aiLoading || !searchQuery.trim()}
              >
                {aiLoading ? "…" : "Spør"}
              </DesignLabPrimaryAction>
            </div>
            {aiAnswer ? (
              <div
                style={{
                  marginTop: 12,
                  padding: "12px 14px",
                  background: C.surfaceAlt,
                  borderRadius: 6,
                  fontSize: 13,
                  color: C.text,
                  lineHeight: 1.55,
                  whiteSpace: "pre-wrap",
                  position: "relative",
                }}
              >
                <button
                  onClick={() => setAiAnswer("")}
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    background: "transparent",
                    border: "none",
                    color: C.textFaint,
                    cursor: "pointer",
                    padding: 2,
                  }}
                  title="Lukk (Esc)"
                >
                  <X size={12} />
                </button>
                {aiAnswer}
              </div>
            ) : null}
          </div>
        </Section>
      </div>
    </DesignLabPageShell>
  );
}

/* ─── Pulse stat ─── */

function PulseStat({
  value,
  label,
  onClick,
}: {
  value: number | string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-baseline gap-1.5 transition-colors"
      style={{
        background: "transparent",
        border: "none",
        cursor: onClick ? "pointer" : "default",
        padding: 0,
      }}
      onMouseEnter={(e) => ((e.currentTarget.querySelector(".v") as HTMLElement).style.color = C.accent)}
      onMouseLeave={(e) => ((e.currentTarget.querySelector(".v") as HTMLElement).style.color = C.text)}
    >
      <span
        className="v"
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: C.text,
          fontVariantNumeric: "tabular-nums",
          transition: "color 120ms",
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 12, color: C.textMuted }}>{label}</span>
    </button>
  );
}
