import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { DesignLabPageShell } from "@/components/designlab/DesignLabPageShell";
import {
  DesignLabMediaFrame,
  DesignLabSectionHeader,
} from "@/components/designlab/system";
import { SourceListTab } from "@/components/designlab/news/SourceListTab";
import { C } from "@/components/designlab/theme";
import { supabase } from "@/integrations/supabase/client";
import { useCrmNavigation } from "@/lib/crmNavigation";
import {
  newsRelative,
  sortNewsItemsNewestFirst,
  withUtm,
  type NewsBrief,
  type NewsFeature,
  type NewsItem,
} from "@/lib/news";

/* ────────────────────── HEADER-META ────────────────────── */

function formatTodayLabel(): string {
  const d = new Date();
  const days = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
  const months = ["jan.", "feb.", "mar.", "apr.", "mai", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "des."];
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return `${days[d.getDay()]} ${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()} · uke ${week}`;
}

/* ────────────────────── MOCK DATA ─────────────────────────
   1 lead + 6 features + 5 briefs.
   Bruker companies fra porteføljen (Potensiell kunde / Kunde).
   Bilder satt til `null` så Plan C SVG-fallback rendres.
   ──────────────────────────────────────────────────────── */

function placeholderImage(label: string): string {
  // Plan C SVG-fallback hvis bilde-URL feiler i klient
  const safe = label.replace(/[<>&]/g, "");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675">
  <rect width="1200" height="675" fill="#FCFCFD"/>
  <rect x="0.5" y="0.5" width="1199" height="674" fill="none" stroke="#E8EAEE"/>
  <text x="600" y="345" text-anchor="middle" font-family="Inter, sans-serif" font-size="42" font-weight="600" fill="#1A1C1F">${safe}</text>
  <text x="600" y="395" text-anchor="middle" font-family="Inter, sans-serif" font-size="14" font-weight="500" fill="#8C929C" letter-spacing="2">STACQ DAILY</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const NOW = new Date();
const OSLO_DATE_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Oslo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/* ────────────────────── UTILS ────────────────────── */

const clampStyle = (lines: number): CSSProperties => ({
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
});

function trackedHref(url: string): string {
  return withUtm(url, { source: "stacq", medium: "daily" });
}

function getOsloDateKey(value: string | Date): string | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : OSLO_DATE_FORMATTER.format(date);
}

function isPublishedToday(iso: string, now: Date = NOW): boolean {
  const publishedKey = getOsloDateKey(iso);
  const todayKey = getOsloDateKey(now);
  return publishedKey !== null && publishedKey === todayKey;
}

function ensureImage(item: NewsItem): string {
  if (item.image.url) return item.image.url;
  return placeholderImage(item.primary_company_name);
}

type RenderableNewsStory = Exclude<NewsItem, NewsBrief>;

/* ────────────────────── LOKALE KOMPONENTER ────────────────────── */

function NewTodayBadge() {
  return (
    <span
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        zIndex: 2,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        minHeight: 28,
        padding: "0 10px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.7,
        textTransform: "uppercase",
        color: "#5F4300",
        background: "rgba(255, 239, 184, 0.96)",
        border: "1px solid rgba(146, 111, 17, 0.18)",
        boxShadow: "0 8px 24px rgba(17, 24, 39, 0.10)",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        backdropFilter: "blur(8px)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: "#A17400",
          boxShadow: "0 0 0 3px rgba(161, 116, 0, 0.12)",
          flexShrink: 0,
        }}
      />
      Ny i dag
    </span>
  );
}

function Kicker({ item }: { item: NewsItem }) {
  const { getCompanyPath } = useCrmNavigation();
  const extra = item.also_matched_company_names.slice(0, 2);
  const overflow =
    item.also_matched_company_names.length > 2
      ? ` + ${item.also_matched_company_names.length - 2} til`
      : "";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 6,
        fontSize: 11,
        fontWeight: 600,
        color: C.accent,
        letterSpacing: 0,
        marginBottom: 8,
      }}
    >
      <Link
        to={getCompanyPath(item.primary_company_id)}
        style={{ color: "inherit", textDecoration: "none" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
        onMouseLeave={(e) => (e.currentTarget.style.color = "inherit")}
      >
        {item.primary_company_name}
      </Link>
      {extra.length > 0 ? (
        <span style={{ color: C.textFaint, fontWeight: 500 }}>
          {" · også "}
          {extra.join(", ")}
          {overflow}
        </span>
      ) : null}
    </div>
  );
}

function MetaRow({ item, withReadMore = true }: { item: NewsItem; withReadMore?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
        marginTop: 14,
        paddingTop: 12,
        borderTop: `1px solid ${C.borderLight}`,
        fontSize: 11,
        fontWeight: 400,
        color: C.textFaint,
      }}
    >
      <span>
        {item.source} · {newsRelative(item.published_at, NOW)}
      </span>
      {withReadMore ? (
        <a
          href={trackedHref(item.url)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: C.text,
            fontWeight: 500,
            textDecoration: "none",
            fontSize: 12,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.accent)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.text)}
        >
          Les mer →
        </a>
      ) : null}
    </div>
  );
}

function LeadStory({ item }: { item: RenderableNewsStory }) {
  return (
    <article className="news-lead news-surface news-surface-lead">
      <a
        href={trackedHref(item.url)}
        target="_blank"
        rel="noopener noreferrer"
        className="news-lead-media"
        style={{
          position: "relative",
          display: "block",
          textDecoration: "none",
          flexShrink: 0,
        }}
      >
        <DesignLabMediaFrame
          src={ensureImage(item)}
          alt={item.title}
          ratio="16:9"
        />
        {isPublishedToday(item.published_at) ? <NewTodayBadge /> : null}
      </a>
      <div className="news-lead-text" style={{ minWidth: 0 }}>
        <div className="news-story-overline">Dagens hovedsak</div>
        <Kicker item={item} />
        <h3
          style={{
            fontSize: 22,
            fontWeight: 600,
            lineHeight: 1.2,
            color: C.text,
            margin: 0,
            ...clampStyle(3),
          }}
        >
          <a
            href={trackedHref(item.url)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "inherit", textDecoration: "none" }}
          >
            {item.title}
          </a>
        </h3>
        <a
          href={trackedHref(item.url)}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none", color: "inherit", display: "block" }}
        >
          <p
            style={{
              fontSize: 13,
              fontWeight: 400,
              lineHeight: 1.5,
              color: C.textMuted,
              margin: "10px 0 0",
              ...clampStyle(3),
            }}
          >
            {item.ingress}
          </p>
        </a>
        <MetaRow item={item} />
      </div>
    </article>
  );
}

function FeatureCard({ item }: { item: RenderableNewsStory }) {
  return (
    <article className="news-feature-card news-surface">
      <a
        href={trackedHref(item.url)}
        target="_blank"
        rel="noopener noreferrer"
        style={{ position: "relative", display: "block", textDecoration: "none" }}
      >
        <DesignLabMediaFrame
          src={ensureImage(item)}
          alt={item.title}
          ratio="4:3"
        />
        {isPublishedToday(item.published_at) ? <NewTodayBadge /> : null}
      </a>
      <div>
        <div className="news-story-overline">Analyse</div>
        <Kicker item={item} />
        <h4
          style={{
            fontSize: 16,
            fontWeight: 600,
            lineHeight: 1.3,
            color: C.text,
            margin: 0,
            ...clampStyle(2),
          }}
        >
          <a
            href={trackedHref(item.url)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "inherit", textDecoration: "none" }}
          >
            {item.title}
          </a>
        </h4>
        <a
          href={trackedHref(item.url)}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none", color: "inherit", display: "block" }}
        >
          <p
            style={{
              fontSize: 13,
              fontWeight: 400,
              lineHeight: 1.5,
              color: C.textMuted,
              margin: "8px 0 0",
              ...clampStyle(3),
            }}
          >
            {item.ingress}
          </p>
        </a>
        <MetaRow item={item} />
      </div>
    </article>
  );
}

function BriefRow({ item }: { item: NewsBrief }) {
  return (
    <a
      href={trackedHref(item.url)}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "grid",
        gridTemplateColumns: "56px 1fr auto",
        gap: 14,
        alignItems: "center",
        padding: "12px 0",
        borderBottom: `1px solid ${C.borderLight}`,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 4,
          overflow: "hidden",
          background: C.overlay,
          flexShrink: 0,
        }}
      >
        <img
          src={ensureImage(item)}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.accent,
            marginBottom: 4,
          }}
        >
          {item.primary_company_name}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: C.text,
            ...clampStyle(2),
          }}
        >
          {item.title}
        </div>
      </div>
      <span
        style={{
          fontSize: 11,
          color: C.textFaint,
          whiteSpace: "nowrap",
          alignSelf: "flex-start",
          paddingTop: 2,
        }}
      >
        {item.source} · {newsRelative(item.published_at, NOW)}
      </span>
    </a>
  );
}

function EmptyState({ message, hint }: { message?: string; hint?: string }) {
  return (
    <div
      style={{
        padding: "80px 0",
        textAlign: "center",
        color: C.textMuted,
      }}
    >
      <p style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>
        {message ?? "Ingen store nyheter i porteføljen i dag."}
      </p>
      <p style={{ fontSize: 13, fontWeight: 400, margin: "8px 0 0" }}>
        {hint ?? "Kom tilbake i morgen."}
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  const block = (h: number, w: string | number = "100%"): CSSProperties => ({
    height: h,
    width: w,
    background: C.overlay,
    borderRadius: 4,
  });
  return (
    <div>
      <div style={{ ...block(20, 320), marginBottom: 12 }} />
      <div style={{ ...block(14, 200), marginBottom: 48 }} />
      <div style={{ display: "flex", gap: 32, marginBottom: 56, flexWrap: "wrap" }}>
        <div style={{ ...block(293, 520) }} />
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ ...block(14, 100), marginBottom: 12 }} />
          <div style={{ ...block(28, "90%"), marginBottom: 12 }} />
          <div style={{ ...block(14, "100%"), marginBottom: 6 }} />
          <div style={{ ...block(14, "80%") }} />
        </div>
      </div>
    </div>
  );
}

interface NewsDailyRow {
  status: "ok" | "empty" | "error";
  payload: { items: NewsItem[] };
  source_count: number;
}

async function fetchNewsDaily(): Promise<NewsDailyRow | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("news_daily")
    .select("status, payload, source_count")
    .eq("date", today)
    .eq("is_current", true)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as NewsDailyRow) ?? null;
}

/* ────────────────────── SIDE ────────────────────── */

type NewsTab = "news" | "sources";

export default function DesignLabNews() {
  const todayLabel = formatTodayLabel();
  const [triggered, setTriggered] = useState(false);
  const [tab, setTab] = useState<NewsTab>("news");

  const query = useQuery({
    queryKey: ["news-daily", new Date().toISOString().slice(0, 10)],
    queryFn: fetchNewsDaily,
    staleTime: 5 * 60_000,
  });

  // On-demand trigger hvis ingen rad finnes for dagen
  useEffect(() => {
    if (query.isLoading || query.isError || triggered) return;
    if (query.data === null) {
      setTriggered(true);
      void supabase.functions
        .invoke("news-daily-digest", { body: { trigger: "on-demand" } })
        .then(() => query.refetch());
    }
  }, [query, triggered]);

  const row = query.data ?? null;
  const items: NewsItem[] = row?.payload?.items ?? [];
  const sortedItems = sortNewsItemsNewestFirst(items);
  const stories = sortedItems.filter((i): i is RenderableNewsStory => i.variant !== "brief");
  const lead = stories[0] ?? null;
  const features = stories.slice(1);
  const total = items.length;

  const isLoadingNews = query.isLoading || (query.data === null && triggered);
  const isErrorNews = query.isError;
  const isEmpty = !row || row.status === "empty" || (!lead && features.length === 0);

  return (
    <DesignLabPageShell
      activePath="/design-lab/news"
      title="STACQ Nyheter"
      maxWidth={1100}
      contentClassName="dl-news-content"
      hideHeader
    >
      {/* Masthead */}
      <header className="news-masthead">
        <div style={{ minWidth: 0 }}>
          <div className="news-masthead-kicker">Dagens brief</div>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 600,
              lineHeight: 1.05,
              color: C.text,
              margin: 0,
              letterSpacing: -0.6,
            }}
          >
            STACQ Nyheter
          </h1>
          <p className="news-masthead-copy">
            Et kuratert overblikk over det som rører seg i porteføljen akkurat nå.
          </p>
        </div>
        <div className="news-masthead-stats">
          <div className="news-masthead-stat">
            <span className="news-masthead-stat-label">Oppdatert</span>
            <strong className="news-masthead-stat-value">{todayLabel}</strong>
          </div>
          <div className="news-masthead-stat">
            <span className="news-masthead-stat-label">Utvalg</span>
            <strong className="news-masthead-stat-value">
              {total} {total === 1 ? "sak" : "saker"}
            </strong>
          </div>
        </div>
      </header>

      {/* Tab-bar */}
      <div className="news-tab-shell" role="tablist">
        {([
          { value: "news", label: "Nyheter" },
          { value: "sources", label: "Kildeliste" },
        ] as const).map((t) => {
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.value)}
              className={`news-tab-button${active ? " is-active" : ""}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "sources" ? (
        <SourceListTab />
      ) : isLoadingNews ? (
        <LoadingSkeleton />
      ) : isErrorNews ? (
        <EmptyState message="Kunne ikke hente nyheter" hint="Prøv å laste siden på nytt." />
      ) : isEmpty ? (
        <EmptyState />
      ) : (
        <>
          {/* Hovedoppslag */}
          <section style={{ marginBottom: 56 }}>{lead ? <LeadStory item={lead} /> : null}</section>

          {/* Features (alle øvrige saker) */}
          {features.length > 0 ? (
            <section style={{ marginBottom: 64 }}>
              <DesignLabSectionHeader
                title="Mer fra porteføljen"
                meta={`${features.length} saker`}
                style={{ marginBottom: 28 }}
              />
              <div
                style={{
                  display: "grid",
                  gap: 32,
                  gridTemplateColumns: "repeat(var(--news-cols, 1), minmax(0, 1fr))",
                }}
                className="news-feature-grid"
              >
                {features.map((item) => (
                  <FeatureCard key={item.id} item={item as NewsFeature} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      <style>{`
        .news-masthead {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 24px;
          padding: clamp(20px, 3vw, 28px);
          margin-bottom: 28px;
          border: 1px solid ${C.borderLight};
          border-radius: 24px;
          background:
            radial-gradient(circle at top left, rgba(94, 106, 210, 0.08), transparent 34%),
            linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,251,252,0.96) 100%);
          box-shadow: 0 18px 52px rgba(17, 24, 39, 0.05);
        }
        .news-masthead-kicker {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: ${C.textFaint};
          margin-bottom: 14px;
        }
        .news-masthead-copy {
          max-width: 560px;
          margin: 14px 0 0;
          font-size: 14px;
          line-height: 1.6;
          color: ${C.textMuted};
        }
        .news-masthead-stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          align-self: start;
        }
        .news-masthead-stat {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 14px 16px;
          border: 1px solid ${C.borderLight};
          border-radius: 18px;
          background: rgba(255,255,255,0.84);
        }
        .news-masthead-stat-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: ${C.textFaint};
        }
        .news-masthead-stat-value {
          font-size: 13px;
          line-height: 1.5;
          color: ${C.text};
          font-weight: 600;
        }
        .news-tab-shell {
          display: inline-flex;
          gap: 6px;
          padding: 4px;
          margin-bottom: 36px;
          border: 1px solid ${C.borderLight};
          border-radius: 999px;
          background: rgba(255,255,255,0.9);
          box-shadow: 0 8px 24px rgba(17, 24, 39, 0.04);
        }
        .news-tab-button {
          background: transparent;
          border: none;
          border-radius: 999px;
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 600;
          color: ${C.textMuted};
          cursor: pointer;
          transition: background-color 160ms ease, color 160ms ease, box-shadow 160ms ease;
        }
        .news-tab-button.is-active {
          color: ${C.text};
          background: ${C.surface};
          box-shadow: inset 0 0 0 1px ${C.borderLight};
        }
        .news-surface {
          border: 1px solid ${C.borderLight};
          border-radius: 22px;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,251,252,0.96) 100%);
          box-shadow: 0 16px 42px rgba(17, 24, 39, 0.05);
        }
        .news-surface-lead {
          padding: clamp(16px, 2vw, 22px);
        }
        .news-feature-card {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 14px;
          transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
        }
        .news-story-overline {
          margin-bottom: 10px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: ${C.textFaint};
        }
        .news-lead {
          display: flex;
          flex-direction: column;
          gap: 22px;
        }
        .news-lead-media { width: 100%; }
        @media (hover: hover) {
          .news-feature-card:hover {
            transform: translateY(-2px);
            border-color: ${C.border};
            box-shadow: 0 20px 50px rgba(17, 24, 39, 0.08);
          }
          .news-tab-button:hover {
            color: ${C.text};
            background: rgba(255,255,255,0.72);
          }
        }
        @media (min-width: 860px) {
          .news-masthead {
            grid-template-columns: minmax(0, 1.5fr) minmax(260px, 0.9fr);
            align-items: end;
          }
        }
        @media (min-width: 760px) {
          .news-lead {
            flex-direction: row;
            align-items: stretch;
            gap: 32px;
          }
          .news-lead-media { width: 520px; }
          .news-lead-text { flex: 1; }
        }
        @media (max-width: 639px) {
          .news-tab-shell {
            width: 100%;
            justify-content: space-between;
          }
          .news-tab-button {
            flex: 1;
            text-align: center;
          }
          .news-masthead-stats {
            grid-template-columns: 1fr;
          }
        }
        .news-feature-grid { --news-cols: 1; }
        @media (min-width: 640px) {
          .news-feature-grid { --news-cols: 2; }
        }
        @media (min-width: 960px) {
          .news-feature-grid { --news-cols: 3; }
        }
      `}</style>
    </DesignLabPageShell>
  );
}
