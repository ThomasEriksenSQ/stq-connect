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
  // Plan C: server-generert SVG (her som data-URI for mock).
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

const NOW = new Date("2026-04-21T08:00:00+02:00");
function hoursAgo(h: number): string {
  return new Date(NOW.getTime() - h * 3_600_000).toISOString();
}

// Lead: mindre "Potensiell kunde" med Tier 1 (Hett) kontakt.
// score = (0.6 base + 2.0 heat) × recency × tier + keyword
//       = 2.6 × 0.95 × 0.8 + 0.10 ≈ 2.07 — slår store selskaper uten varme.
const MOCK_LEAD: NewsLead = {
  id: "lead-defensico",
  variant: "lead",
  primary_company_id: "c-defensico",
  primary_company_name: "Defensico",
  also_matched_company_ids: ["c-kongsberg-defence"],
  also_matched_company_names: ["Kongsberg Defence"],
  title: "Defensico utvider radaravdelingen med tjue nye ingeniører",
  ingress:
    "Vekstplanen er en respons på økte forsvarsbevilgninger og rekordmange åpne anbud på sensorelektronikk — selskapet sikter mot å doble omsetningen innen 2028.",
  url: "https://www.finansavisen.no/example/defensico",
  source: "finansavisen.no",
  source_tier: 2,
  published_at: hoursAgo(3),
  image: {
    url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=70&auto=format&fit=crop",
    source: "og",
  },
  score: 2.07,
};

// Features: blanding av varme prospekter og store kunder.
// Rekkefølgen reflekterer kombinert score (heat_boost + base × recency × tier).
const MOCK_FEATURES: NewsFeature[] = [
  {
    // Stort presse-selskap, men Hett kontakt → høy score
    id: "feat-kongsberg-defence-1",
    variant: "feature",
    primary_company_id: "c-kongsberg-defence",
    primary_company_name: "Kongsberg Defence",
    also_matched_company_ids: ["c-nammo"],
    also_matched_company_names: ["Nammo"],
    title: "Kongsberg Defence vinner forsvarskontrakt verdt 2,4 milliarder",
    ingress:
      "Kontrakten omfatter levering av missilkomponenter til NATO-landet Tyskland over fem år, og kan utvides med opsjoner verdt ytterligere 800 millioner kroner.",
    url: "https://e24.no/boers-og-finans/i/example-kongsberg",
    source: "e24.no",
    source_tier: 1,
    published_at: hoursAgo(2),
    image: {
      url: "https://images.unsplash.com/photo-1565043666747-69f6646db940?w=900&q=70&auto=format&fit=crop",
      source: "og",
    },
    score: 1.95,
  },
  {
    id: "feat-nordic-semi-1",
    variant: "feature",
    primary_company_id: "c-nordic-semiconductor",
    primary_company_name: "Nordic Semiconductor",
    also_matched_company_ids: [],
    also_matched_company_names: [],
    title: "Nordic Semiconductor lanserer ny generasjon Bluetooth-brikke",
    ingress:
      "nRF54-serien lover halvret strømforbruk og innebygd Matter-støtte for konsumentelektronikk og industri.",
    url: "https://www.tu.no/example/nordic-semi",
    source: "tu.no",
    source_tier: 2,
    published_at: hoursAgo(7),
    image: {
      url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&q=70&auto=format&fit=crop",
      source: "og",
    },
    score: 1.42,
  },
  {
    id: "feat-akerbp-1",
    variant: "feature",
    primary_company_id: "c-aker-bp",
    primary_company_name: "Aker BP",
    also_matched_company_ids: [],
    also_matched_company_names: [],
    title: "Aker BP løfter produksjonsmål etter sterkt kvartal",
    ingress:
      "Selskapet justerer produksjonsguidingen for 2026 oppover etter bedre enn ventet drift på Yggdrasil-feltet.",
    url: "https://www.dn.no/example/akerbp",
    source: "dn.no",
    source_tier: 1,
    published_at: hoursAgo(5),
    image: {
      url: "https://images.unsplash.com/photo-1605000797499-95a51c5269ae?w=900&q=70&auto=format&fit=crop",
      source: "og",
    },
    score: 1.38,
  },
  {
    id: "feat-defensico-2",
    variant: "feature",
    primary_company_id: "c-kongsberg-geo",
    primary_company_name: "Kongsberg Geospatial",
    also_matched_company_ids: [],
    also_matched_company_names: [],
    title: "Kongsberg Geospatial signerer NATO-rammeavtale om luftromsovervåking",
    ingress:
      "Avtalen åpner for leveranser av sanntidsovervåking til samtlige allianseland over en femårsperiode.",
    url: "https://e24.no/example/kongsberg-geo",
    source: "e24.no",
    source_tier: 1,
    published_at: hoursAgo(9),
    image: {
      url: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=900&q=70&auto=format&fit=crop",
      source: "og",
    },
    score: 1.05,
  },
  {
    id: "feat-equinor-1",
    variant: "feature",
    primary_company_id: "c-equinor",
    primary_company_name: "Equinor",
    also_matched_company_ids: [],
    also_matched_company_names: [],
    title: "Equinor signerer langsiktig hydrogenavtale med tysk industri",
    ingress:
      "Avtalen sikrer leveranser av lavkarbon-hydrogen fra Norge til tyske stålverk fra 2029, og styrker eksportposisjonen i Europa.",
    url: "https://www.tu.no/example/equinor",
    source: "tu.no",
    source_tier: 2,
    published_at: hoursAgo(8),
    image: {
      url: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=900&q=70&auto=format&fit=crop",
      source: "og",
    },
    score: 0.78,
  },
  {
    id: "feat-telenor-1",
    variant: "feature",
    primary_company_id: "c-telenor",
    primary_company_name: "Telenor",
    also_matched_company_ids: [],
    also_matched_company_names: [],
    title: "Telenor varsler ny strategi for industriell IoT i Norden",
    ingress:
      "Konsernet samler tre forretningsområder under én paraply for å akselerere salg mot industri- og energikunder.",
    url: "https://www.dn.no/example/telenor",
    source: "dn.no",
    source_tier: 1,
    published_at: hoursAgo(17),
    image: {
      url: "https://images.unsplash.com/photo-1473800447596-01729482b8eb?w=900&q=70&auto=format&fit=crop",
      source: "og",
    },
    score: 0.72,
  },
];

const MOCK_BRIEFS: NewsBrief[] = [
  {
    id: "brief-kongsberg-geo-1",
    variant: "brief",
    primary_company_id: "c-kongsberg-geo",
    primary_company_name: "Kongsberg Geospatial",
    also_matched_company_ids: [],
    also_matched_company_names: [],
    title: "Kongsberg Geospatial signerer NATO-avtale om luftromsovervåking",
    ingress: null,
    url: "https://e24.no/example/kongsberg-geo",
    source: "e24.no",
    source_tier: 1,
    published_at: hoursAgo(24),
    image: { url: null, source: "placeholder" },
    score: 2.3,
  },
  {
    id: "brief-storebrand-1",
    variant: "brief",
    primary_company_id: "c-storebrand",
    primary_company_name: "Storebrand",
    also_matched_company_ids: [],
    also_matched_company_names: [],
    title: "Storebrand løfter teknologi-budsjettet for 2026",
    ingress: null,
    url: "https://www.dn.no/example/storebrand",
    source: "dn.no",
    source_tier: 1,
    published_at: hoursAgo(28),
    image: { url: null, source: "placeholder" },
    score: 2.1,
  },
  {
    id: "brief-dnv-1",
    variant: "brief",
    primary_company_id: "c-dnv",
    primary_company_name: "DNV",
    also_matched_company_ids: [],
    also_matched_company_names: [],
    title: "DNV publiserer ny standard for cybersikkerhet i maritime systemer",
    ingress: null,
    url: "https://www.tu.no/example/dnv",
    source: "tu.no",
    source_tier: 2,
    published_at: hoursAgo(34),
    image: { url: null, source: "placeholder" },
    score: 2.0,
  },
  {
    id: "brief-norsk-hydro-1",
    variant: "brief",
    primary_company_id: "c-norsk-hydro",
    primary_company_name: "Norsk Hydro",
    also_matched_company_ids: [],
    also_matched_company_names: [],
    title: "Norsk Hydro inngår batterimaterialavtale med Volvo Cars",
    ingress: null,
    url: "https://e24.no/example/hydro",
    source: "e24.no",
    source_tier: 1,
    published_at: hoursAgo(40),
    image: { url: null, source: "placeholder" },
    score: 1.9,
  },
  {
    id: "brief-tomra-1",
    variant: "brief",
    primary_company_id: "c-tomra",
    primary_company_name: "Tomra",
    also_matched_company_ids: [],
    also_matched_company_names: [],
    title: "Tomra justerer marginprognose etter svakere Asia-marked",
    ingress: null,
    url: "https://www.finansavisen.no/example/tomra",
    source: "finansavisen.no",
    source_tier: 2,
    published_at: hoursAgo(46),
    image: { url: null, source: "placeholder" },
    score: 1.8,
  },
];

const MOCK_ITEMS: NewsItem[] = [MOCK_LEAD, ...MOCK_FEATURES, ...MOCK_BRIEFS];

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
        gridTemplateColumns: "1fr auto",
        gap: 16,
        alignItems: "baseline",
        padding: "12px 0",
        borderBottom: `1px solid ${C.borderLight}`,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.accent,
            marginRight: 8,
          }}
        >
          {item.primary_company_name}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: C.text,
            ...clampStyle(1),
            display: "inline",
          }}
        >
          {item.title}
        </span>
      </div>
      <span
        style={{
          fontSize: 11,
          color: C.textFaint,
          whiteSpace: "nowrap",
        }}
      >
        {item.source} · {newsRelative(item.published_at, NOW)}
      </span>
    </a>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: "80px 0",
        textAlign: "center",
        color: C.textMuted,
      }}
    >
      <p style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>
        Ingen store nyheter i porteføljen i dag.
      </p>
      <p style={{ fontSize: 13, fontWeight: 400, margin: "8px 0 0" }}>
        Kom tilbake i morgen.
      </p>
    </div>
  );
}

/* ────────────────────── SIDE ────────────────────── */

export default function DesignLabNews() {
  const items = MOCK_ITEMS;
  const lead = items.find((i): i is NewsLead => i.variant === "lead") ?? null;
  const features = items.filter((i): i is NewsFeature => i.variant === "feature");
  const briefs = items.filter((i): i is NewsBrief => i.variant === "brief");
  const total = items.length;

  const isEmpty = !lead || features.length + briefs.length === 0;

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
          {TODAY_LABEL} · {total} saker
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
