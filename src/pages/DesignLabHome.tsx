import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

import { DesignLabPageShell } from "@/components/designlab/DesignLabPageShell";
import { C, SIGNAL_COLORS } from "@/theme";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getEffectiveSignal } from "@/lib/categoryUtils";

interface BriefAction {
  title: string;
  why_facts: string[];
  action_keys: Array<"J" | "M" | "V" | "S" | "F">;
  target_url: string | null;
  contact_name?: string | null;
  company_name?: string | null;
}

interface BriefResponse {
  actions: BriefAction[];
  placeholder_questions: string[];
  generated_at: string;
}

interface PipelinePulse {
  aktive_foresporsler: number;
  konsulenter_ledige_30d: number;
  fornyelser_uka: number;
  vunnet_i_gar: number;
}

interface SignalChange {
  contact_id: string;
  contact_name: string;
  company_name: string | null;
  from_signal: string;
  to_signal: string;
  changed_at: string;
  owner_name: string | null;
}

const ACTION_KEY_LABEL: Record<string, string> = {
  J: "ring",
  M: "e-post",
  V: "vis CV",
  S: "send CV",
  F: "flytt",
};

const FALLBACK_PLACEHOLDERS = [
  "Hvem bør jeg ringe i dag?",
  "Hvilke konsulenter er ledige?",
  "Hva skjedde i markedet i går?",
];

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "nå";
  if (hours < 24) return `${hours}t`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function DesignLabHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const searchRef = useRef<HTMLInputElement>(null);
  const [focusedActionIdx, setFocusedActionIdx] = useState(0);

  // ──────── Pipeline-puls ────────
  const { data: pulse } = useQuery<PipelinePulse>({
    queryKey: ["dl-home-pulse"],
    queryFn: async () => {
      const now = new Date();
      const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      const since45d = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      const [foresRes, ansatteRes, oppdragRes, vunnetRes] = await Promise.all([
        supabase
          .from("foresporsler")
          .select("id", { count: "exact", head: true })
          .gte("mottatt_dato", since45d),
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

  // ──────── Daily brief (AI) ────────
  const { data: brief, isLoading: briefLoading } = useQuery<BriefResponse>({
    queryKey: ["dl-home-brief"],
    queryFn: async () => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("no session");
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/daily-brief`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      if (!resp.ok) throw new Error("brief failed");
      return resp.json();
    },
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  // ──────── Din dag (oppfølginger forfalt + i dag) ────────
  const { data: dagensTasks = [] } = useQuery({
    queryKey: ["dl-home-tasks"],
    queryFn: async () => {
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const { data } = await supabase
        .from("tasks")
        .select("id, title, due_date, status, contact_id, company_id")
        .neq("status", "done")
        .lte("due_date", todayEnd.toISOString())
        .order("due_date", { ascending: true })
        .limit(10);
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  // ──────── Nye signaler siste 24t ────────
  const { data: signalChanges = [] } = useQuery<SignalChange[]>({
    queryKey: ["dl-home-signals"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: acts } = await supabase
        .from("activities")
        .select("contact_id, subject, description, created_at")
        .not("contact_id", "is", null)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!acts || acts.length === 0) return [];

      const contactIds = Array.from(new Set(acts.map((a) => a.contact_id).filter(Boolean)));
      if (contactIds.length === 0) return [];

      const [contactsRes, allActsRes, allTasksRes] = await Promise.all([
        supabase
          .from("contacts")
          .select("id, first_name, last_name, owner_id, company_id, companies(name), profiles:owner_id(full_name)")
          .in("id", contactIds),
        supabase
          .from("activities")
          .select("contact_id, subject, description, created_at")
          .in("contact_id", contactIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("tasks")
          .select("contact_id, title, description, created_at, due_date")
          .in("contact_id", contactIds)
          .order("created_at", { ascending: false }),
      ]);

      const contacts = contactsRes.data || [];
      const allActs = allActsRes.data || [];
      const allTasks = allTasksRes.data || [];

      const changes: SignalChange[] = [];
      for (const c of contacts) {
        const cActs = allActs
          .filter((a) => a.contact_id === c.id)
          .map((a) => ({ created_at: a.created_at, subject: a.subject, description: a.description }));
        const cTasks = allTasks
          .filter((t) => t.contact_id === c.id)
          .map((t) => ({
            created_at: t.created_at,
            title: t.title,
            description: t.description,
            due_date: t.due_date,
          }));

        // Current signal (alle data)
        const current = getEffectiveSignal(cActs, cTasks);
        // Forrige signal (uten siste 24t)
        const prevActs = cActs.filter(
          (a) => new Date(a.created_at).getTime() < Date.now() - 24 * 60 * 60 * 1000
        );
        const prevTasks = cTasks.filter(
          (t) => t.created_at && new Date(t.created_at).getTime() < Date.now() - 24 * 60 * 60 * 1000
        );
        const prev = getEffectiveSignal(prevActs, prevTasks);

        if (current !== prev) {
          const lastChangeAct = cActs.find(
            (a) => new Date(a.created_at).getTime() >= Date.now() - 24 * 60 * 60 * 1000
          );
          changes.push({
            contact_id: c.id,
            contact_name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Ukjent",
            company_name: (c as any).companies?.name || null,
            from_signal: prev || "Ukjent om behov",
            to_signal: current || "Ukjent om behov",
            changed_at: lastChangeAct?.created_at || new Date().toISOString(),
            owner_name: (c as any).profiles?.full_name || null,
          });
        }
      }

      return changes
        .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())
        .slice(0, 5);
    },
    staleTime: 5 * 60 * 1000,
  });

  // ──────── Tastatur: ⌘K, piltaster, J/M/V/S/F ────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isInput =
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA";

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (isInput) return;

      const actions = brief?.actions || [];
      if (actions.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedActionIdx((i) => Math.min(i + 1, actions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedActionIdx((i) => Math.max(i - 1, 0));
      } else if (["j", "m", "v", "s", "f"].includes(e.key.toLowerCase())) {
        const action = actions[focusedActionIdx];
        if (action?.target_url) navigate(action.target_url);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [brief, focusedActionIdx, navigate]);

  // ──────── Hilsen ────────
  const greeting = useMemo(() => {
    const fullName =
      (user?.user_metadata?.full_name as string | undefined) ||
      user?.email?.split("@")[0] ||
      "der";
    const firstName = fullName.split(" ")[0];
    const dateStr = format(new Date(), "EEE d. MMM yyyy", { locale: nb });
    const week = format(new Date(), "I", { locale: nb });
    return { firstName, dateStr, week };
  }, [user]);

  const placeholderQuestion =
    brief?.placeholder_questions?.[0] || FALLBACK_PLACEHOLDERS[0];

  return (
    <DesignLabPageShell
      activePath="/design-lab/home"
      title="Hjem"
      maxWidth={1280}
      contentStyle={{ padding: "0" }}
    >
      <div style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif" }}>
        {/* Hilsen */}
        <Section>
          <div className="flex items-baseline justify-between" style={{ padding: "20px 24px" }}>
            <div className="flex items-baseline gap-3">
              <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text }}>
                God morgen, {greeting.firstName}
              </h2>
              <span style={{ fontSize: 13, color: C.textMuted }}>
                {greeting.dateStr} · uke {greeting.week}
              </span>
            </div>
            <KbdHint label="⌘K søk" />
          </div>
        </Section>

        {/* Pipeline-puls */}
        <Section>
          <div className="flex items-center gap-1" style={{ padding: "12px 24px", flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: C.textMuted, marginRight: 8 }}>Pipeline nå:</span>
            <PulseSegment
              value={pulse?.aktive_foresporsler ?? "—"}
              label="forespørsler aktive"
              onClick={() => navigate("/design-lab/foresporsler")}
            />
            <Sep />
            <PulseSegment
              value={pulse?.konsulenter_ledige_30d ?? "—"}
              label="konsulenter ledige om 30d"
              onClick={() => navigate("/design-lab/ansatte")}
            />
            <Sep />
            <PulseSegment
              value={pulse?.fornyelser_uka ?? "—"}
              label="fornyelser denne uka"
              onClick={() => navigate("/design-lab/aktive-oppdrag")}
            />
            <Sep />
            <PulseSegment
              value={pulse?.vunnet_i_gar ?? "—"}
              label="vunnet i går"
              onClick={() => navigate("/design-lab/foresporsler")}
            />
          </div>
        </Section>

        {/* Brief + Din dag */}
        <Section>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 64fr) minmax(0, 36fr)",
              gap: 0,
            }}
          >
            {/* Dagens 3 trekk */}
            <div style={{ padding: "20px 24px", borderRight: `1px solid ${C.borderLight}` }}>
              <SectionLabel>Dagens 3 trekk</SectionLabel>
              {briefLoading ? (
                <BriefSkeleton />
              ) : brief?.actions && brief.actions.length > 0 ? (
                <div className="flex flex-col" style={{ gap: 16, marginTop: 12 }}>
                  {brief.actions.map((action, idx) => (
                    <ActionRow
                      key={idx}
                      idx={idx + 1}
                      action={action}
                      focused={focusedActionIdx === idx}
                      onFocus={() => setFocusedActionIdx(idx)}
                      onActivate={() => action.target_url && navigate(action.target_url)}
                    />
                  ))}
                  <div className="flex items-center justify-end" style={{ marginTop: 4 }}>
                    <button
                      onClick={() => {
                        const first = brief.actions[0];
                        if (first?.target_url) navigate(first.target_url);
                      }}
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: C.onAccent,
                        background: C.accent,
                        padding: "6px 14px",
                        borderRadius: 5,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Start dagen
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    fontSize: 13,
                    color: C.textFaint,
                    padding: "24px 0",
                    textAlign: "center",
                  }}
                >
                  Ingen anbefalinger akkurat nå.
                </div>
              )}
            </div>

            {/* Din dag */}
            <div style={{ padding: "20px 24px" }}>
              <SectionLabel>Din dag</SectionLabel>
              {dagensTasks.length === 0 ? (
                <div
                  style={{
                    fontSize: 13,
                    color: C.textFaint,
                    padding: "24px 0",
                    textAlign: "center",
                  }}
                >
                  Ingen oppfølginger i dag.
                </div>
              ) : (
                <div className="flex flex-col" style={{ marginTop: 12 }}>
                  {dagensTasks.slice(0, 5).map((t: any) => {
                    const overdue =
                      t.due_date &&
                      new Date(t.due_date).getTime() < Date.now() - 24 * 60 * 60 * 1000;
                    const time = t.due_date
                      ? format(new Date(t.due_date), "HH:mm")
                      : "—";
                    return (
                      <button
                        key={t.id}
                        onClick={() => navigate("/design-lab/oppfolginger")}
                        className="flex items-center gap-3 text-left"
                        style={{
                          padding: "6px 0",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        <Dot color={overdue ? C.danger : C.textGhost} />
                        <span
                          style={{
                            fontSize: 11,
                            color: C.textMuted,
                            fontVariantNumeric: "tabular-nums",
                            width: 38,
                          }}
                        >
                          {time}
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
                          {t.title}
                        </span>
                      </button>
                    );
                  })}
                  {dagensTasks.length > 5 ? (
                    <button
                      onClick={() => navigate("/design-lab/oppfolginger")}
                      style={{
                        fontSize: 12,
                        color: C.textMuted,
                        background: "transparent",
                        border: "none",
                        textAlign: "left",
                        padding: "6px 0",
                        cursor: "pointer",
                      }}
                    >
                      + {dagensTasks.length - 5} flere
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* Nye signaler */}
        <Section>
          <div style={{ padding: "16px 24px" }}>
            <div className="flex items-baseline gap-2" style={{ marginBottom: 8 }}>
              <SectionLabel>Nye signaler i går</SectionLabel>
              <span style={{ fontSize: 11, color: C.textFaint }}>
                ({signalChanges.length})
              </span>
            </div>
            {signalChanges.length === 0 ? (
              <div
                style={{
                  fontSize: 13,
                  color: C.textFaint,
                  padding: "16px 0",
                }}
              >
                Ingen signalendringer siste 24 timer.
              </div>
            ) : (
              <div className="flex flex-col">
                {signalChanges.map((sc) => {
                  const fromColor = (SIGNAL_COLORS as any)[sc.from_signal] || SIGNAL_COLORS["Ukjent om behov"];
                  const toColor = (SIGNAL_COLORS as any)[sc.to_signal] || SIGNAL_COLORS["Ukjent om behov"];
                  return (
                    <button
                      key={sc.contact_id}
                      onClick={() => navigate(`/design-lab/kontakter/${sc.contact_id}`)}
                      className="grid items-center text-left"
                      style={{
                        gridTemplateColumns: "minmax(160px, 1fr) minmax(280px, 2fr) 60px 100px 80px",
                        gap: 12,
                        padding: "8px 0",
                        background: "transparent",
                        border: "none",
                        borderTop: `1px solid ${C.borderLight}`,
                        cursor: "pointer",
                      }}
                    >
                      <div className="flex flex-col" style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
                          {sc.contact_name}
                        </span>
                        {sc.company_name ? (
                          <span style={{ fontSize: 11, color: C.textMuted }}>
                            {sc.company_name}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2" style={{ fontSize: 12 }}>
                        <span style={{ color: fromColor.color }}>{sc.from_signal}</span>
                        <ArrowRight size={11} color={C.textGhost} />
                        <span
                          style={{
                            color: toColor.color,
                            background: toColor.bg,
                            padding: "1px 7px",
                            borderRadius: 4,
                            fontWeight: 500,
                          }}
                        >
                          {sc.to_signal}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, color: C.textMuted, fontVariantNumeric: "tabular-nums" }}>
                        {formatRelative(sc.changed_at)}
                      </span>
                      <span style={{ fontSize: 12, color: C.textMuted }}>
                        {sc.owner_name?.split(" ")[0] || "—"}
                      </span>
                      <ArrowRight size={13} color={C.textGhost} style={{ justifySelf: "end" }} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Section>

        {/* Spør agenten */}
        <div style={{ padding: "16px 24px 32px" }}>
          <div
            className="flex items-center gap-2"
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: "8px 12px",
            }}
          >
            <Search size={14} color={C.textMuted} />
            <input
              ref={searchRef}
              placeholder={placeholderQuestion}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 13,
                color: C.text,
                fontFamily: "inherit",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.currentTarget.value.trim()) {
                  // Routes to chat panel via navigate state — fallback til Salgsagent
                  navigate("/design-lab/salgsagent");
                }
              }}
            />
            <KbdHint label="⌘K" />
            <button
              style={{
                background: "transparent",
                border: "none",
                color: C.textMuted,
                cursor: "pointer",
                padding: 2,
              }}
              onClick={() => navigate("/design-lab/salgsagent")}
            >
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </DesignLabPageShell>
  );
}

/* ─── Subkomponenter ─── */

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: `1px solid ${C.borderLight}` }}>{children}</div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 500,
        color: C.textMuted,
        textTransform: "none",
      }}
    >
      {children}
    </div>
  );
}

function Sep() {
  return <span style={{ color: C.textGhost, margin: "0 4px", fontSize: 13 }}>·</span>;
}

function PulseSegment({
  value,
  label,
  onClick,
}: {
  value: number | string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: "4px 6px",
        borderRadius: 4,
        fontSize: 13,
        color: C.text,
        display: "inline-flex",
        alignItems: "baseline",
        gap: 5,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = C.hoverBg)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ fontWeight: 600, color: C.text, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
      <span style={{ color: C.textMuted, fontWeight: 400 }}>{label}</span>
    </button>
  );
}

function ActionRow({
  idx,
  action,
  focused,
  onFocus,
  onActivate,
}: {
  idx: number;
  action: BriefAction;
  focused: boolean;
  onFocus: () => void;
  onActivate: () => void;
}) {
  return (
    <div
      onMouseEnter={onFocus}
      onClick={onActivate}
      style={{
        padding: "12px 14px",
        borderRadius: 6,
        cursor: "pointer",
        background: focused ? C.hoverBg : "transparent",
        border: `1px solid ${focused ? C.border : "transparent"}`,
        transition: "background 0.1s",
      }}
    >
      <div className="flex items-baseline gap-3" style={{ marginBottom: 6 }}>
        <span
          style={{
            fontSize: 11,
            color: C.textMuted,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            minWidth: 14,
          }}
        >
          {idx}
        </span>
        <span style={{ fontSize: 13, fontWeight: 500, color: C.text, flex: 1 }}>
          {action.title}
        </span>
      </div>
      {action.why_facts && action.why_facts.length > 0 ? (
        <div style={{ paddingLeft: 26, marginBottom: 8 }}>
          {action.why_facts.map((fact, i) => (
            <div
              key={i}
              style={{
                fontSize: 12,
                color: C.textMuted,
                lineHeight: 1.5,
              }}
            >
              {fact}
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-2" style={{ paddingLeft: 26 }}>
        {action.action_keys?.map((k) => (
          <span key={k} className="inline-flex items-center gap-1" style={{ fontSize: 11 }}>
            <Kbd>{k}</Kbd>
            <span style={{ color: C.textMuted }}>{ACTION_KEY_LABEL[k]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function BriefSkeleton() {
  return (
    <div className="flex flex-col" style={{ gap: 12, marginTop: 12 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ padding: "12px 14px" }}>
          <div
            style={{
              height: 14,
              background: C.surfaceAlt,
              borderRadius: 3,
              width: "60%",
              marginBottom: 8,
            }}
          />
          <div
            style={{
              height: 11,
              background: C.surfaceAlt,
              borderRadius: 3,
              width: "85%",
              marginBottom: 4,
              marginLeft: 26,
            }}
          />
          <div
            style={{
              height: 11,
              background: C.surfaceAlt,
              borderRadius: 3,
              width: "45%",
              marginLeft: 26,
            }}
          />
        </div>
      ))}
      <div style={{ fontSize: 11, color: C.textFaint, paddingLeft: 14 }}>Tenker…</div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        background: C.surfaceAlt,
        color: C.textMuted,
        padding: "1px 5px",
        borderRadius: 3,
        fontSize: 10,
        fontWeight: 500,
        border: `1px solid ${C.borderLight}`,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
      }}
    >
      {children}
    </span>
  );
}

function KbdHint({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        color: C.textMuted,
        background: C.surfaceAlt,
        padding: "2px 7px",
        borderRadius: 3,
        border: `1px solid ${C.borderLight}`,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
      }}
    >
      {label}
    </span>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      style={{
        width: 4,
        height: 4,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }}
    />
  );
}
