import { DesignLabPageShell } from "@/components/designlab/DesignLabPageShell";
import { C } from "@/theme";

/* ───────────────────────── MOCK DATA ─────────────────────────
   Alle verdier her er hardkodet for designformål.
   Ingen Supabase-kall, ingen edge functions.
   ─────────────────────────────────────────────────────────── */

const FIRST_NAME = "Jon Richard";
const TODAY_LABEL = "tirsdag 21. apr. 2026 · uke 17";

const WEEK_SUMMARY =
  "Forespørslene har økt 18 % mot forrige uke, og tre nye selskaper meldte interesse. Equinor har vært stille i 14 dager, mens Kongsberg-miljøet beveger seg merkbart raskere enn vanlig.";

const INBOX_SCAN_META = "Skannet 142 e-poster · siste 14 dager";

const INBOX_FINDS: Array<{
  sender: string;
  company: string;
  snippet: string;
  age: string;
  status: string;
  needsAction: boolean;
}> = [
  {
    sender: "Marius Solheim",
    company: "Kongsberg Defence",
    snippet: "…vurderer å hente inn ekstern kapasitet på embedded-siden…",
    age: "5d siden",
    status: "ubesvart",
    needsAction: true,
  },
  {
    sender: "Anne Lien",
    company: "Aker BP",
    snippet: "…trenger noen med IEC 61508-erfaring til høsten…",
    age: "2d siden",
    status: "ulest",
    needsAction: true,
  },
  {
    sender: "Lars Mo",
    company: "Defensico",
    snippet: "…kan vi ta en prat neste uke om to embedded-roller?",
    age: "8d siden",
    status: "ble liggende",
    needsAction: true,
  },
];

const MARKET_META = "Basert på 47 nye Finn-utlysninger";

const MARKET_TRENDS: Array<{
  delta: string;
  label: string;
  hint?: string;
  direction: "up" | "down" | "flat";
}> = [
  { delta: "+18 %", label: "C++-utlysninger", hint: "12 totalt", direction: "up" },
  { delta: "+3", label: "nye selskaper med embedded-behov", direction: "up" },
  { delta: "−22 %", label: "FPGA-aktivitet", hint: "stille uke", direction: "down" },
];

const NEW_COMPANIES = ["Defensico", "Nordic Semiconductor", "Kongsberg Geo"];

const AI_NEWS_META = "AI-research · 6 kilder · oppdatert 07:12";

const AI_NEWS: Array<{ headline: string; source: string; relevance: string }> = [
  {
    headline: "Forsvaret øker rammen for autonome systemer med 1,2 mrd",
    source: "Teknisk Ukeblad",
    relevance: "Embedded · sanntid",
  },
  {
    headline: "Kongsberg Discovery vant kontrakt for undervannssensorer",
    source: "DN",
    relevance: "Sensorikk · DSP",
  },
  {
    headline: "Nordic Semiconductor varsler ny BLE-plattform i Q3",
    source: "EE Times",
    relevance: "BLE · firmware",
  },
];

const BENCH_META = "4 personer tilgjengelig";

const BENCH: Array<{ name: string; tags: string[]; available: string }> = [
  { name: "Ola Nordmann", tags: ["C++", "Embedded Linux", "Yocto"], available: "fra 1. mai" },
  { name: "Kari Hansen", tags: ["Rust", "BLE", "sanntid"], available: "fra 15. mai" },
  { name: "Erik Solheim", tags: ["FPGA", "Verilog", "VHDL"], available: "fra 20. mai" },
];

const BENCH_OVERFLOW = "+ 1 til";
const MATCH_HINT = "Ola og Kari matcher Defensico-behovet fra innboksen.";

/* ───────────────────────── PAGE ───────────────────────── */

export default function DesignLabHome() {
  return (
    <DesignLabPageShell
      activePath="/design-lab/home"
      title="Hjem"
      maxWidth={720}
      contentStyle={{ padding: "64px 24px 96px" }}
    >
      <Hero firstName={FIRST_NAME} dateLabel={TODAY_LABEL} />

      <Section title="Uken så langt" topSpace={56} firstSection>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: C.text, margin: 0, fontWeight: 400 }}>
          {WEEK_SUMMARY}
        </p>
      </Section>

      <Section title="Uoppdaget i innboksen" meta={INBOX_SCAN_META}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {INBOX_FINDS.map((row) => (
            <InboxRow key={row.sender} {...row} />
          ))}
        </div>
      </Section>

      <Section title="Markedet denne uken" meta={MARKET_META}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {MARKET_TRENDS.map((t) => (
            <TrendRow key={t.label} {...t} />
          ))}
        </div>

        <SubLabel>Nye selskaper på radaren</SubLabel>
        <p style={{ margin: 0, fontSize: 14, color: C.text, fontWeight: 400 }}>
          {NEW_COMPANIES.join("  ·  ")}
        </p>

        <SubLabel>Relevante nyheter</SubLabel>
        <div style={{ fontSize: 11, color: C.textFaint, marginTop: -6, marginBottom: 12, fontWeight: 400 }}>
          {AI_NEWS_META}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {AI_NEWS.map((n) => (
            <NewsRow key={n.headline} {...n} />
          ))}
        </div>
      </Section>

      <Section title="Konsulenter som trenger plassering" meta={BENCH_META}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {BENCH.map((c) => (
            <BenchRow key={c.name} {...c} />
          ))}
          <div style={{ fontSize: 12, color: C.textFaint, fontWeight: 400 }}>{BENCH_OVERFLOW}</div>
        </div>

        <div
          style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: `1px solid ${C.borderLight}`,
            fontSize: 12,
            color: C.textMuted,
            fontStyle: "italic",
          }}
        >
          {MATCH_HINT}
        </div>
      </Section>
    </DesignLabPageShell>
  );
}

/* ───────────────────────── HELPERS ───────────────────────── */

function Hero({ firstName, dateLabel }: { firstName: string; dateLabel: string }) {
  return (
    <header>
      <h2
        style={{
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: C.text,
          margin: 0,
          lineHeight: 1.2,
        }}
      >
        God morgen, {firstName}.
      </h2>
      <div style={{ fontSize: 12, color: C.textFaint, marginTop: 6, fontWeight: 400 }}>
        {dateLabel}
      </div>
    </header>
  );
}

function Section({
  title,
  meta,
  topSpace = 40,
  firstSection = false,
  children,
}: {
  title: string;
  meta?: string;
  topSpace?: number;
  firstSection?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        marginTop: topSpace,
        paddingTop: firstSection ? 0 : 40,
        borderTop: firstSection ? "none" : `1px solid ${C.borderLight}`,
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: 0 }}>{title}</h3>
        {meta ? (
          <div style={{ fontSize: 11, color: C.textFaint, marginTop: 4, fontWeight: 400 }}>
            {meta}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 500,
        color: C.textFaint,
        marginTop: 28,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function InboxRow({
  sender,
  company,
  snippet,
  age,
  status,
  needsAction,
}: {
  sender: string;
  company: string;
  snippet: string;
  age: string;
  status: string;
  needsAction: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: needsAction ? C.accent : "transparent",
          marginTop: 7,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
          {sender}
          <span style={{ color: C.textFaint, fontWeight: 400 }}> · {company}</span>
        </div>
        <div
          style={{
            fontSize: 13,
            color: C.textMuted,
            marginTop: 2,
            fontStyle: "italic",
            lineHeight: 1.45,
          }}
        >
          {snippet}
        </div>
        <div style={{ fontSize: 11, color: C.textFaint, marginTop: 4 }}>
          {age} · {status}
        </div>
      </div>
    </div>
  );
}

function TrendRow({
  delta,
  label,
  hint,
  direction,
}: {
  delta: string;
  label: string;
  hint?: string;
  direction: "up" | "down" | "flat";
}) {
  const glyph = direction === "up" ? "↗" : direction === "down" ? "↘" : "→";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "72px 1fr auto",
        alignItems: "baseline",
        gap: 16,
      }}
    >
      <span
        style={{
          fontSize: 16,
          fontWeight: 500,
          color: C.text,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {delta}
      </span>
      <span style={{ fontSize: 13, color: C.text, fontWeight: 400 }}>{label}</span>
      <span style={{ fontSize: 12, color: C.textFaint, fontWeight: 400 }}>
        {hint ? `${glyph} ${hint}` : glyph}
      </span>
    </div>
  );
}

function NewsRow({
  headline,
  source,
  relevance,
}: {
  headline: string;
  source: string;
  relevance: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 13, color: C.text, fontWeight: 500, lineHeight: 1.45 }}>
        {headline}
      </div>
      <div style={{ fontSize: 11, color: C.textFaint, marginTop: 3, fontWeight: 400 }}>
        {source} · {relevance}
      </div>
    </div>
  );
}

function BenchRow({
  name,
  tags,
  available,
}: {
  name: string;
  tags: string[];
  available: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "baseline",
        gap: 16,
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{name}</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2, fontWeight: 400 }}>
          {tags.join(" · ")}
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.textFaint, fontWeight: 400 }}>{available}</div>
    </div>
  );
}
