import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { DesignLabPageShell } from "@/components/designlab/DesignLabPageShell";
import {
  DesignLabMediaFrame,
  DesignLabSectionHeader,
} from "@/components/designlab/system";
import { C } from "@/components/designlab/theme";
import { supabase } from "@/integrations/supabase/client";
import {
  newsRelative,
  withUtm,
  type NewsBrief,
  type NewsFeature,
  type NewsItem,
  type NewsLead,
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
  <rect width="1200" height="675" fill="${C.appBg}"/>
  <rect x="0.5" y="0.5" width="1199" height="674" fill="none" stroke="${C.borderLight}"/>
  <text x="600" y="345" text-anchor="middle" font-family="Inter, sans-serif" font-size="42" font-weight="600" fill="${C.text}">${safe}</text>
  <text x="600" y="395" text-anchor="middle" font-family="Inter, sans-serif" font-size="14" font-weight="500" fill="${C.textFaint}" letter-spacing="2">STACQ DAILY</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const NOW = new Date();

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

function ensureImage(item: NewsItem): string {
  if (item.image.url) return item.image.url;
  return placeholderImage(item.primary_company_name);
}

/* ────────────────────── LOKALE KOMPONENTER ────────────────────── */

function Kicker({ item }: { item: NewsItem }) {
  const extra = item.also_matched_company_names.slice(0, 2);
  const overflow =
    item.also_matched_company_names.length > 2
      ? ` + ${item.also_matched_company_names.length - 2} til`
      : "";
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: C.accent,
        letterSpacing: 0,
        marginBottom: 8,
      }}
    >
      {item.primary_company_name}
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
        marginTop: 10,
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
          Les saken →
        </a>
      ) : null}
    </div>
  );
}

function LeadStory({ item }: { item: NewsLead }) {
  return (
    <article className="news-lead">
      <a
        href={trackedHref(item.url)}
        target="_blank"
        rel="noopener noreferrer"
        className="news-lead-media"
        style={{ display: "block", textDecoration: "none", flexShrink: 0 }}
      >
        <DesignLabMediaFrame
          src={ensureImage(item)}
          alt={item.title}
          ratio="16:9"
        />
      </a>
      <div className="news-lead-text" style={{ minWidth: 0 }}>
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
        <MetaRow item={item} />
      </div>
    </article>
  );
}

function FeatureCard({ item }: { item: NewsFeature }) {
  return (
    <article style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <a
        href={trackedHref(item.url)}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: "block", textDecoration: "none" }}
      >
        <DesignLabMediaFrame
          src={ensureImage(item)}
          alt={item.title}
          ratio="4:3"
        />
      </a>
      <div>
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
        <MetaRow item={item} withReadMore={false} />
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

export default function DesignLabNews() {
  const todayLabel = formatTodayLabel();
  const [triggered, setTriggered] = useState(false);

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

  if (query.isLoading || (query.data === null && triggered)) {
    return (
      <DesignLabPageShell activePath="/design-lab/news" title="STACQ Daily" maxWidth={1100}>
        <LoadingSkeleton />
      </DesignLabPageShell>
    );
  }

  if (query.isError) {
    return (
      <DesignLabPageShell activePath="/design-lab/news" title="STACQ Daily" maxWidth={1100}>
        <EmptyState message="Kunne ikke hente nyheter" hint="Prøv å laste siden på nytt." />
      </DesignLabPageShell>
    );
  }

  const row = query.data;
  const items: NewsItem[] = row?.payload?.items ?? [];
  const lead = items.find((i): i is NewsLead => i.variant === "lead") ?? null;
  const features = items.filter((i): i is NewsFeature => i.variant === "feature");
  const briefs = items.filter((i): i is NewsBrief => i.variant === "brief");
  const total = items.length;

  const isEmpty = !row || row.status === "empty" || (!lead && features.length + briefs.length === 0);

  return (
    <DesignLabPageShell
      activePath="/design-lab/news"
      title="STACQ Daily"
      maxWidth={1100}
    >
      {/* Masthead */}
      <header style={{ marginBottom: 56 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 600,
            color: C.text,
            margin: 0,
            letterSpacing: -0.2,
          }}
        >
          STACQ Daily
        </h1>
        <p
          style={{
            fontSize: 12,
            fontWeight: 400,
            color: C.textFaint,
            margin: "8px 0 0",
          }}
        >
          {todayLabel} · {total} {total === 1 ? "sak" : "saker"}
        </p>
      </header>


      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          {/* Hovedoppslag */}
          <section style={{ marginBottom: 56 }}>{lead ? <LeadStory item={lead} /> : null}</section>

          {/* Features */}
          {features.length > 0 ? (
            <section style={{ marginBottom: 56 }}>
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
                  <FeatureCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          ) : null}

          {/* Briefs */}
          {briefs.length > 0 ? (
            <section style={{ marginBottom: 64 }}>
              <DesignLabSectionHeader
                title="Korte notiser"
                meta={`${briefs.length} saker`}
                style={{ marginBottom: 8 }}
              />
              <div>
                {briefs.map((item) => (
                  <BriefRow key={item.id} item={item} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      <style>{`
        .news-lead {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .news-lead-media { width: 100%; }
        @media (min-width: 760px) {
          .news-lead {
            flex-direction: row;
            align-items: center;
            gap: 32px;
          }
          .news-lead-media { width: 520px; }
          .news-lead-text { flex: 1; }
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
