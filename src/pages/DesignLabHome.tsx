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
  company_id: string | null;
  company_name: string | null;
  company_status: "prospect" | "customer" | null;
}

interface InboxPulseStats {
  scanned_total: number;
  scanned_relevant: number;
  filtered_out: number;
}

interface InboxPulseResponse {
  insights: InboxInsight[];
  scanned_count: number;
  stats?: InboxPulseStats;
  generated_at: string;
}

interface ConsultantLeadMatch {
  contact_id: string | null;
  score: number;
  reasoning: string;
}

interface ConsultantMatch {
  consultant_id: number;
  best_contact_id: string | null;
  score: number;
  reasoning: string;
  top_leads?: ConsultantLeadMatch[];
}

interface Renewal {
  id: number;
  kandidat: string;
  kunde: string | null;
  forny_dato: string;
  selskap_id: string | null;
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
      style={{ padding: "16px 24px 6px" }}
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
          paddingLeft: 24,
          paddingRight: 24,
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
        paddingLeft: 24,
        paddingRight: 24,
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

  /* ──────── Fornyelser neste 7 dager (til «Dagens 3») ──────── */
  const { data: upcomingRenewals = [] } = useQuery<Renewal[]>({
    queryKey: ["dl-home-renewals-7d"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const in7d = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("stacq_oppdrag")
        .select("id, kandidat, kunde, forny_dato, selskap_id")
        .gte("forny_dato", today)
        .lte("forny_dato", in7d)
        .order("forny_dato", { ascending: true })
        .limit(5);
      return (data as Renewal[]) || [];
    },
    staleTime: 5 * 60 * 1000,
  });

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

  /* Column templates — same family of widths as DesignLabContacts */
  const COLS_INBOX = "12px 110px minmax(260px,1fr) 150px 16px";
  const COLS_MATCH = "minmax(160px,1.2fr) 96px minmax(140px,1fr) 16px minmax(200px,1.5fr) 60px 110px 16px";
  const COLS_FORESP = "80px minmax(200px,1.4fr) minmax(220px,1.6fr) 140px 16px";
  const COLS_LEADS = "84px minmax(180px,1.4fr) minmax(180px,1.4fr) minmax(220px,2fr) 110px 16px";
  const COLS_DAGENS = "28px 110px minmax(260px,1fr) 140px 16px";

  /* ──────── Dagens 3: deterministisk topp-panel ──────── */
  type DagensType = "lead" | "inbox" | "renewal";
  interface DagensItem {
    type: DagensType;
    label: string;
    title: string;
    subtitle: string;
    onOpen: () => void;
    tone?: "hot" | "customer" | "renewal";
  }

  const dagens3: DagensItem[] = useMemo(() => {
    const items: DagensItem[] = [];

    // 1) Sterkeste lead med tilgjengelig konsulent
    const bestMatchPair = (() => {
      if (matches.length === 0 || availableConsultants.length === 0) return null;
      let best: {
        consultant: AvailableConsultant;
        lead: HomeQueueLead;
        score: number;
      } | null = null;
      for (const m of matches) {
        const lead = findLead(m.best_contact_id);
        const consultant = availableConsultants.find((c) => c.id === m.consultant_id);
        if (!lead || !consultant) continue;
        const overlap = (consultant.kompetanse || []).filter((t) =>
          (lead.technologies || []).some((lt) => lt.toLowerCase() === t.toLowerCase()),
        ).length;
        const composite = lead.heat.score + overlap * 5 + m.score * 0.2;
        if (!best || composite > best.score) {
          best = { consultant, lead, score: composite };
        }
      }
      return best;
    })();

    if (bestMatchPair) {
      items.push({
        type: "lead",
        label: "Lead",
        title: `${bestMatchPair.lead.contactName} · ${bestMatchPair.lead.companyName}`,
        subtitle: `Match mot ${bestMatchPair.consultant.navn} — ${bestMatchPair.lead.signal || "signal ukjent"}`,
        onOpen: () => navigate(`/design-lab/kontakter/${bestMatchPair!.lead.contactId}`),
        tone: "hot",
      });
    }

    // 2) Mest kritiske kunde-e-post
    const customerInsights = (inbox?.insights || []).filter(
      (i) => i.company_status === "customer" || i.company_status === "prospect",
    );
    const critical = [...customerInsights].sort((a, b) => {
      // prioriter unanswered, så eldst først
      const typeRank = (t: InboxInsight["type"]) => (t === "unanswered" ? 0 : t === "buried" ? 1 : 2);
      const tA = typeRank(a.type);
      const tB = typeRank(b.type);
      if (tA !== tB) return tA - tB;
      return b.age_days - a.age_days;
    })[0];

    if (critical) {
      items.push({
        type: "inbox",
        label: "E-post",
        title: critical.summary,
        subtitle: `${critical.company_name || critical.contact_email || "ukjent"} · ${critical.age_days}d · ${
          INSIGHT_TYPE_LABEL[critical.type]
        }`,
        onOpen: () => {
          if (critical.web_link) window.open(critical.web_link, "_blank");
        },
        tone: "customer",
      });
    }

    // 3) Nærmeste fornyelse
    const nextRenewal = upcomingRenewals[0];
    if (nextRenewal) {
      const daysLeft = Math.max(
        0,
        Math.ceil((new Date(nextRenewal.forny_dato).getTime() - Date.now()) / 86400000),
      );
      items.push({
        type: "renewal",
        label: "Fornyelse",
        title: `${nextRenewal.kandidat}${nextRenewal.kunde ? ` · ${nextRenewal.kunde}` : ""}`,
        subtitle: `Fornyelse om ${daysLeft}d (${format(new Date(nextRenewal.forny_dato), "d. MMM", { locale: nb })})`,
        onOpen: () => navigate("/design-lab/aktive-oppdrag"),
        tone: "renewal",
      });
    }

    return items;
  }, [matches, availableConsultants, queue, inbox, upcomingRenewals, navigate]);

  /* Tastatur 1/2/3 → åpne Dagens-rad */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isInput =
        document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA";
      if (isInput || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "1" && dagens3[0]) {
        e.preventDefault();
        dagens3[0].onOpen();
      } else if (e.key === "2" && dagens3[1]) {
        e.preventDefault();
        dagens3[1].onOpen();
      } else if (e.key === "3" && dagens3[2]) {
        e.preventDefault();
        dagens3[2].onOpen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dagens3]);

  /* Expand-state for konsulent-match (viser topp-3 leads) */
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);

  return (
    <DesignLabPageShell
      activePath="/design-lab/home"
      title="Hjem · Morgenkø"
      maxWidth={null}
      contentStyle={{ padding: "0" }}
      contentClassName=""
    >
      <div style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif", width: "38%", minWidth: 720 }}>
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
              <Kbd>Enter</Kbd>, <Kbd>1</Kbd> <Kbd>2</Kbd> <Kbd>3</Kbd> for
              dagens tre, søk med <Kbd>⌘K</Kbd>.
            </div>
          </div>
        </Section>

        {/* DAGENS 3 */}
        <Section>
          <SectionHeader
            title="Dagens 3"
            meta={
              dagens3.length === 0
                ? "Samler data …"
                : `${dagens3.length} sak${dagens3.length === 1 ? "" : "er"} som trenger deg nå`
            }
          />
          {dagens3.length === 0 ? (
            <EmptyText>Ingen prioriterte saker akkurat nå — 🎉</EmptyText>
          ) : (
            <>
              <ColHeader
                cols={COLS_DAGENS}
                labels={["", "Type", "Hva", "Kontekst", ""]}
              />
              {dagens3.map((item, idx) => {
                const toneColor =
                  item.tone === "hot"
                    ? C.danger
                    : item.tone === "customer"
                      ? C.success
                      : item.tone === "renewal"
                        ? C.accent
                        : C.textMuted;
                return (
                  <TableRow
                    key={`dagens-${idx}`}
                    cols={COLS_DAGENS}
                    onClick={item.onOpen}
                    accentColor={toneColor}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: C.textFaint,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {idx + 1}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: toneColor,
                      }}
                    >
                      {item.label}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: C.text,
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.title}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: C.textMuted,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.subtitle}
                    </span>
                    <Kbd>{idx + 1}</Kbd>
                  </TableRow>
                );
              })}
            </>
          )}
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
                  ? inbox.stats
                    ? `${inbox.stats.scanned_relevant} av ${inbox.stats.scanned_total} e-post fra Kunder/Potensielle kunder (14d)`
                    : `AI har lest ${inbox.scanned_count} e-poster siste 14 dager`
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
            <>
              <ColHeader
                cols={COLS_INBOX}
                labels={["", "Type · Alder", "Oppsummering", "Selskap", ""]}
              />
              {inbox.insights.map((ins, idx) => {
                const focusedRow = isFocused({ kind: "inbox", idx });
                const dotColor =
                  ins.type === "unanswered" ? C.danger : ins.type === "buried" ? C.warning : C.info;
                return (
                  <TableRow
                    key={`inbox-${idx}`}
                    cols={COLS_INBOX}
                    focused={focusedRow}
                    onMouseEnter={() => setFocused({ kind: "inbox", idx })}
                    onClick={() => {
                      if (ins.web_link) window.open(ins.web_link, "_blank");
                    }}
                  >
                    <Dot color={dotColor} />
                    <span style={{ fontSize: 11, color: C.textFaint, whiteSpace: "nowrap" }}>
                      {INSIGHT_TYPE_LABEL[ins.type]} · {ins.age_days}d
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: C.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ins.summary}
                    </span>
                    <span
                      className="flex items-center gap-1.5"
                      style={{
                        fontSize: 11,
                        color: C.textMuted,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={ins.contact_email || ""}
                    >
                      {ins.company_status ? (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 600,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            padding: "1px 5px",
                            borderRadius: 3,
                            flexShrink: 0,
                            background:
                              ins.company_status === "customer" ? C.successBg : C.infoBg,
                            color:
                              ins.company_status === "customer" ? C.success : C.info,
                          }}
                        >
                          {ins.company_status === "customer" ? "Kunde" : "Prospect"}
                        </span>
                      ) : null}
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {ins.company_name || ins.contact_email || ""}
                      </span>
                    </span>
                    <ArrowRight size={12} className="opacity-0 group-hover:opacity-100" style={{ color: C.textFaint }} />
                  </TableRow>
                );
              })}
            </>
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
            <>
              <ColHeader
                cols={COLS_MATCH}
                labels={["Konsulent", "Klar fra", "Kompetanse", "", "Beste lead", "Match", "Signal", ""]}
              />
              {matches.map((m, idx) => {
                const consultant = availableConsultants.find((c) => c.id === m.consultant_id);
                if (!consultant) return null;
                const lead = findLead(m.best_contact_id);
                const focusedRow = isFocused({ kind: "match", idx });
                const dateLabel = consultant.tilgjengelig_fra
                  ? format(new Date(consultant.tilgjengelig_fra), "d. MMM", { locale: nb })
                  : "—";
                const extraLeads = (m.top_leads || []).slice(1, 3);
                const isExpanded = expandedMatch === idx;

                return (
                  <div key={`match-${idx}`}>
                    <TableRow
                      cols={COLS_MATCH}
                      focused={focusedRow}
                      onMouseEnter={() => setFocused({ kind: "match", idx })}
                      onClick={() => {
                        if (lead) navigate(`/design-lab/kontakter/${lead.contactId}`);
                      }}
                    >
                      <span style={{ fontSize: 13, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {consultant.navn}
                      </span>
                      <span style={{ fontSize: 11, color: C.textMuted, whiteSpace: "nowrap" }} title="Bruker tilgjengelig_fra (ikke sluttdato)">
                        {dateLabel}
                      </span>
                      <span style={{ fontSize: 11, color: C.textFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {(consultant.kompetanse || []).slice(0, 3).join(" · ") || "—"}
                      </span>
                      <ArrowRight size={11} style={{ color: C.textGhost }} />
                      {lead ? (
                        <span
                          className="flex items-center gap-1.5"
                          style={{ fontSize: 13, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {lead.contactName} <span style={{ color: C.textFaint }}>· {lead.companyName}</span>
                          </span>
                          {extraLeads.length > 0 ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedMatch(isExpanded ? null : idx);
                              }}
                              title={`Se ${extraLeads.length} flere forslag`}
                              style={{
                                flexShrink: 0,
                                fontSize: 10,
                                fontWeight: 600,
                                padding: "1px 5px",
                                borderRadius: 3,
                                border: `1px solid ${C.borderLight}`,
                                background: isExpanded ? C.accentBg : C.surfaceAlt,
                                color: isExpanded ? C.accent : C.textMuted,
                                cursor: "pointer",
                              }}
                            >
                              +{extraLeads.length}
                            </button>
                          ) : null}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: C.textFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.reasoning || "Ingen passende lead nå."}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: m.score >= 80 ? C.success : m.score >= 60 ? C.warning : C.textMuted,
                        }}
                      >
                        {m.score}%
                      </span>
                      <span>
                        {lead?.signal ? <DesignLabSignalBadge signal={lead.signal} size="sm" /> : null}
                      </span>
                      <ArrowRight size={12} className="opacity-0 group-hover:opacity-100" style={{ color: C.textFaint }} />
                    </TableRow>
                    {isExpanded && extraLeads.length > 0 ? (
                      <div style={{ background: C.surfaceAlt, borderBottom: `1px solid ${C.borderLight}` }}>
                        {extraLeads.map((lm, i) => {
                          const subLead = findLead(lm.contact_id);
                          return (
                            <div
                              key={`match-${idx}-sub-${i}`}
                              onClick={() => {
                                if (subLead) navigate(`/design-lab/kontakter/${subLead.contactId}`);
                              }}
                              style={{
                                display: "grid",
                                gridTemplateColumns: COLS_MATCH,
                                alignItems: "center",
                                minHeight: 32,
                                paddingLeft: 24,
                                paddingRight: 24,
                                gap: 12,
                                fontSize: 12,
                                color: C.textMuted,
                                cursor: subLead ? "pointer" : "default",
                              }}
                            >
                              <span />
                              <span style={{ fontSize: 10, color: C.textFaint, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                Alt. {i + 2}
                              </span>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {lm.reasoning}
                              </span>
                              <ArrowRight size={11} style={{ color: C.textGhost }} />
                              <span style={{ color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {subLead
                                  ? (
                                    <>
                                      {subLead.contactName}{" "}
                                      <span style={{ color: C.textFaint }}>· {subLead.companyName}</span>
                                    </>
                                  )
                                  : "—"}
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: lm.score >= 80 ? C.success : lm.score >= 60 ? C.warning : C.textMuted,
                                }}
                              >
                                {lm.score}%
                              </span>
                              <span>
                                {subLead?.signal ? <DesignLabSignalBadge signal={subLead.signal} size="sm" /> : null}
                              </span>
                              <span />
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </>
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
            <>
              <ColHeader
                cols={COLS_FORESP}
                labels={["Mottatt", "Selskap", "Teknologier", "Sted", ""]}
              />
              {nyeForesporsler.map((f, idx) => {
                const ago = formatDistanceToNowStrict(new Date(f.mottatt_dato), { locale: nb });
                const focusedRow = isFocused({ kind: "foresporsel", idx });
                return (
                  <TableRow
                    key={`fr-${f.id}`}
                    cols={COLS_FORESP}
                    focused={focusedRow}
                    onMouseEnter={() => setFocused({ kind: "foresporsel", idx })}
                    onClick={() => navigate("/design-lab/foresporsler")}
                  >
                    <span style={{ fontSize: 11, color: C.textFaint, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      {ago.replace(/\s/, "\u00A0")}
                    </span>
                    <span style={{ fontSize: 13, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.selskap_navn}
                    </span>
                    <span style={{ fontSize: 12, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {(f.teknologier || []).slice(0, 5).join(" · ") || "—"}
                    </span>
                    <span style={{ fontSize: 11, color: C.textFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.sted || ""}
                    </span>
                    <ArrowRight size={12} className="opacity-0 group-hover:opacity-100" style={{ color: C.textFaint }} />
                  </TableRow>
                );
              })}
            </>
          )}
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
