import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { findBestCompanyMatch, normalizeCompanyName } from "../_shared/companyMatch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type FinnAnnonse = {
  id: string;
  dato: string;
  uke: string | null;
  selskap: string | null;
  stillingsrolle: string | null;
  lokasjon: string | null;
  teknologier: string | null;
  lenke: string | null;
  kontaktnavn: string | null;
  kontakt_epost: string | null;
  kontakt_telefon: string | null;
};

type CompanyRef = {
  id: string;
  name: string;
  status: string | null;
  aliases?: string[];
};

type RadarCompany = {
  key: string;
  name: string;
  company: CompanyRef | null;
  inCrm: boolean;
  score: number;
  adCount: number;
  currentWeekCount: number;
  latestRole: string | null;
  latestLink: string | null;
  topTechnologies: string[];
  contacts: Array<{
    key: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    role: string | null;
    adCount: number;
    score: number;
    companyName: string;
    company: CompanyRef | null;
  }>;
  scoreReasons: string[];
};

type MarketSnapshot = {
  latestWeek: string | null;
  adsThisWeek: number;
  uniqueCompanies30d: number;
  technologyTrends: Array<{
    name: string;
    current: number;
    previous: number;
    delta: number;
  }>;
  topCompanies: RadarCompany[];
  topContacts: Array<{
    name: string | null;
    email: string | null;
    phone: string | null;
    role: string | null;
    companyName: string;
    company: CompanyRef | null;
    adCount: number;
    score: number;
  }>;
  newCompaniesNotInCrm: RadarCompany[];
};

const TECH_RULES: Array<{ label: string; patterns: RegExp[] }> = [
  { label: "C++", patterns: [/\bc\+\+\b/i, /\bmodern c\b/i] },
  { label: "C", patterns: [/(^|[^a-z0-9])c([^a-z0-9+#]|$)/i] },
  { label: "Rust", patterns: [/\brust\b/i] },
  { label: "Python", patterns: [/\bpython\b/i] },
  { label: "RTOS", patterns: [/\brtos\b/i, /\bfree rtos\b/i, /\bfreertos\b/i, /\bnuttx\b/i] },
  { label: "Embedded Linux", patterns: [/\bembedded linux\b/i] },
  { label: "Yocto", patterns: [/\byocto\b/i] },
  { label: "Zephyr", patterns: [/\bzephyr\b/i] },
  { label: "FPGA", patterns: [/\bfpga\b/i, /\basic\b/i] },
  { label: "Firmware", patterns: [/\bfirmware\b/i] },
  { label: "Embedded systems", patterns: [/\bembedded systems?\b/i] },
  { label: "Microcontrollers", patterns: [/\bmicrocontrollers?\b/i, /\barm cortex-m\b/i] },
  { label: "Robotics", patterns: [/\brobotics?\b/i, /\bcomputer vision\b/i] },
];

const STRATEGIC_TECHS = new Set([
  "C++",
  "C",
  "Rust",
  "RTOS",
  "Embedded Linux",
  "Yocto",
  "Zephyr",
  "FPGA",
  "Firmware",
  "Embedded systems",
  "Microcontrollers",
]);

function splitTechSegments(raw: string): string[] {
  const segments: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of raw) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);

    if (char === "," && depth === 0) {
      const cleaned = current.trim();
      if (cleaned) segments.push(cleaned);
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) segments.push(current.trim());
  return segments;
}

function normalizeTechnologyToken(token: string): string | null {
  const cleaned = token.trim();
  if (!cleaned) return null;

  for (const rule of TECH_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(cleaned))) return rule.label;
  }

  const lower = cleaned.toLowerCase();
  if (lower.length < 2) return null;
  if (lower === "software upgrades") return "Firmware";
  if (lower === "network devices") return "Embedded systems";

  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}

function extractNormalizedTechnologies(raw: string | null | undefined): string[] {
  if (!raw) return [];

  const tokens = new Set<string>();
  const push = (value: string) => {
    const normalized = normalizeTechnologyToken(value);
    if (normalized) tokens.add(normalized);
  };

  splitTechSegments(raw).forEach((segment) => {
    push(segment);
    const nestedMatches = [...segment.matchAll(/\(([^)]+)\)/g)];
    nestedMatches.forEach((match) => {
      splitTechSegments(match[1]).forEach(push);
    });
    const withoutParens = segment.replace(/\([^)]*\)/g, " ").trim();
    if (withoutParens && withoutParens !== segment) push(withoutParens);
  });

  return [...tokens];
}

function normalizeStatus(status: string | null | undefined): string | null {
  if (!status) return null;
  const normalized = status.trim().toLowerCase();
  if (normalized === "kunde") return "customer";
  return normalized;
}

function isActionableStatus(status: string | null | undefined): boolean {
  const normalized = normalizeStatus(status);
  return normalized !== "partner" && normalized !== "churned";
}

function dateDaysAgo(anchor: Date, days: number): string {
  const next = new Date(anchor);
  next.setDate(next.getDate() - days);
  return next.toISOString().slice(0, 10);
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildMarketSnapshot(annonser: FinnAnnonse[], companies: CompanyRef[]): MarketSnapshot {
  const cleanedAds = annonser.filter((ad) => ad.dato && ad.selskap).sort((a, b) => b.dato.localeCompare(a.dato));
  const latestWeek = cleanedAds.find((ad) => ad.uke)?.uke || null;
  const anchorDate = cleanedAds[0]?.dato ? new Date(`${cleanedAds[0].dato}T12:00:00Z`) : new Date();
  const current30 = dateDaysAgo(anchorDate, 29);
  const previous30 = dateDaysAgo(anchorDate, 59);
  const previous30End = dateDaysAgo(anchorDate, 30);

  const findCompany = (name: string | null): CompanyRef | null => {
    if (!name) return null;
    return findBestCompanyMatch(name, companies) || null;
  };

  const grouped = new Map<
    string,
    {
      key: string;
      name: string;
      company: CompanyRef | null;
      ads: FinnAnnonse[];
      techCounts: Map<string, number>;
      roles: string[];
      contacts: Map<
        string,
        {
          key: string;
          name: string | null;
          email: string | null;
          phone: string | null;
          role: string | null;
          adCount: number;
          score: number;
          companyName: string;
          company: CompanyRef | null;
        }
      >;
      currentWeekCount: number;
      recent30Count: number;
    }
  >();

  cleanedAds.forEach((ad) => {
    const crmCompany = findCompany(ad.selskap);
    const companyName = crmCompany?.name || ad.selskap!.trim();
    const key = crmCompany ? `crm:${crmCompany.id}` : `raw:${normalizeCompanyName(companyName)}`;
    const techs = extractNormalizedTechnologies(ad.teknologier);

    let group = grouped.get(key);
    if (!group) {
      group = {
        key,
        name: companyName,
        company: crmCompany,
        ads: [],
        techCounts: new Map<string, number>(),
        roles: [],
        contacts: new Map(),
        currentWeekCount: 0,
        recent30Count: 0,
      };
      grouped.set(key, group);
    }

    group.ads.push(ad);
    if (ad.uke === latestWeek) group.currentWeekCount += 1;
    if (ad.dato >= current30) group.recent30Count += 1;
    if (ad.stillingsrolle) group.roles.push(ad.stillingsrolle);

    techs.forEach((tech) => {
      group!.techCounts.set(tech, (group!.techCounts.get(tech) || 0) + 1);
    });

    const contactKey = [ad.kontaktnavn, ad.kontakt_epost, ad.kontakt_telefon]
      .map((value) => (value || "").trim().toLowerCase())
      .filter(Boolean)
      .join("|");

    if (contactKey) {
      const existing = group.contacts.get(contactKey);
      const nextScore = (ad.kontakt_epost ? 3 : 0) + (ad.kontakt_telefon ? 3 : 0) + (ad.uke === latestWeek ? 2 : 0);
      if (existing) {
        existing.adCount += 1;
        existing.score += nextScore;
        if (!existing.email && ad.kontakt_epost) existing.email = ad.kontakt_epost;
        if (!existing.phone && ad.kontakt_telefon) existing.phone = ad.kontakt_telefon;
        if (!existing.role && ad.stillingsrolle) existing.role = ad.stillingsrolle;
      } else {
        group.contacts.set(contactKey, {
          key: contactKey,
          name: ad.kontaktnavn || null,
          email: ad.kontakt_epost || null,
          phone: ad.kontakt_telefon || null,
          role: ad.stillingsrolle || null,
          adCount: 1,
          score: nextScore,
          companyName,
          company: crmCompany,
        });
      }
    }
  });

  const finalizedCompanies = [...grouped.values()]
    .map((group) => {
      const strategicHits = [...group.techCounts.entries()]
        .filter(([name]) => STRATEGIC_TECHS.has(name))
        .reduce((sum, [, count]) => sum + count, 0);
      const directContacts = [...group.contacts.values()].filter((contact) => contact.email || contact.phone).length;
      const score =
        group.ads.length * 3 +
        group.currentWeekCount * 5 +
        group.recent30Count * 4 +
        strategicHits * 2 +
        directContacts * 4 +
        (group.company ? 0 : 6);

      const technologyCounts = [...group.techCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "nb"))
        .map(([name, count]) => ({ name, count }));
      const contacts = [...group.contacts.values()]
        .sort((a, b) => b.score - a.score || a.companyName.localeCompare(b.companyName, "nb"))
        .map((contact) => ({ ...contact, score: contact.score + group.ads.length }));

      return {
        key: group.key,
        name: group.name,
        company: group.company,
        inCrm: !!group.company,
        score,
        adCount: group.ads.length,
        currentWeekCount: group.currentWeekCount,
        latestRole: group.roles[0] || null,
        latestLink: group.ads[0]?.lenke || null,
        topTechnologies: technologyCounts.slice(0, 5).map((item) => item.name),
        contacts,
        scoreReasons: [
          !group.company ? "ikke i CRM" : null,
          group.currentWeekCount > 0 ? `${group.currentWeekCount} annonser denne uken` : null,
          group.recent30Count > 1 ? `${group.recent30Count} annonser siste 30 dager` : null,
          strategicHits > 0 ? `${strategicHits} treff på kjernekompetanse` : null,
          directContacts > 0 ? `${directContacts} direkte kontaktpunkt` : null,
        ].filter(Boolean) as string[],
      } satisfies RadarCompany;
    })
    .sort((a, b) => b.score - a.score || b.adCount - a.adCount || a.name.localeCompare(b.name, "nb"));

  const actionableCompanies = finalizedCompanies.filter(
    (company) => !company.company || isActionableStatus(company.company.status),
  );

  const techCounts = new Map<string, { current: number; previous: number }>();
  cleanedAds.forEach((ad) => {
    extractNormalizedTechnologies(ad.teknologier).forEach((tech) => {
      const entry = techCounts.get(tech) || { current: 0, previous: 0 };
      if (ad.dato >= current30) entry.current += 1;
      else if (ad.dato >= previous30 && ad.dato <= previous30End) entry.previous += 1;
      techCounts.set(tech, entry);
    });
  });

  const technologyTrends = [...techCounts.entries()]
    .map(([name, entry]) => ({
      name,
      current: entry.current,
      previous: entry.previous,
      delta: entry.current - entry.previous,
    }))
    .filter((entry) => entry.current > 0)
    .sort((a, b) => b.delta - a.delta || b.current - a.current || a.name.localeCompare(b.name, "nb"))
    .slice(0, 8);

  const topContacts = uniqueBy(
    actionableCompanies.flatMap((company) =>
      company.contacts.map((contact) => ({
        ...contact,
        score: contact.score + company.score,
      })),
    ),
    (contact) => contact.key,
  )
    .filter((contact) => contact.email || contact.phone)
    .sort((a, b) => b.score - a.score || a.companyName.localeCompare(b.companyName, "nb"))
    .slice(0, 5);

  return {
    latestWeek,
    adsThisWeek: cleanedAds.filter((ad) => ad.uke === latestWeek).length,
    uniqueCompanies30d: new Set(
      cleanedAds.filter((ad) => ad.dato >= current30).map((ad) => normalizeCompanyName(ad.selskap!)),
    ).size,
    technologyTrends,
    topCompanies: actionableCompanies.slice(0, 5),
    topContacts,
    newCompaniesNotInCrm: actionableCompanies.filter((company) => !company.inCrm).slice(0, 5),
  };
}

async function generateAiSummary(snapshot: MarketSnapshot): Promise<string | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;

  const topTechs = snapshot.technologyTrends
    .slice(0, 5)
    .map((item) => `${item.name}: ${item.current} (${item.delta >= 0 ? "+" : ""}${item.delta})`)
    .join(", ");
  const topCompanies = snapshot.topCompanies
    .map(
      (company) =>
        `${company.name}: ${company.adCount} annonser, ${company.topTechnologies.slice(0, 3).join("/") || "ingen tech"}`,
    )
    .join(", ");
  const newCompanies = snapshot.newCompaniesNotInCrm.map((company) => company.name).join(", ");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "Du er markedsanalytiker for STACQ. Skriv en kort, konkret markedsoppsummering på norsk for en ukentlig e-post. Maks 3 setninger. Fokus på hva som betyr noe kommersielt akkurat nå.",
        },
        {
          role: "user",
          content: `Siste uke: ${snapshot.latestWeek}\nAntall annonser siste uke: ${snapshot.adsThisWeek}\nTeknologier: ${topTechs}\nSelskaper å følge opp: ${topCompanies}\nIkke i CRM: ${newCompanies}`,
        },
      ],
      max_tokens: 250,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.choices?.[0]?.message?.content || null;
}

function renderBulletRows(rows: string[]): string {
  if (rows.length === 0) {
    return `<p style="font-size:13px;color:#94a3b8;margin:0;padding:8px 0">Ingen funn denne uken.</p>`;
  }

  return rows
    .map(
      (row) => `
        <tr>
          <td style="padding:10px 0 10px 14px;border-left:3px solid #2563eb;font-size:14px;color:#1e293b;line-height:1.5">${row}</td>
        </tr>
        <tr><td style="height:1px;background:#f1f5f9"></td></tr>`,
    )
    .join("");
}

function section(title: string, subtitle: string, body: string) {
  return `
    <div style="padding:28px 40px 0">
      <p style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;margin:0 0 4px">${title}</p>
      <p style="font-size:13px;color:#94a3b8;margin:0 0 14px">${subtitle}</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table>
    </div>`;
}

function buildHtml(snapshot: MarketSnapshot, aiSummary: string | null) {
  const dateLabel = new Date().toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });
  const techRows = snapshot.technologyTrends.slice(0, 5).map((trend) => {
    const delta = trend.delta > 0 ? `+${trend.delta}` : `${trend.delta}`;
    return `<strong>${trend.name}</strong> — ${trend.current} annonser siste 30 dager (${delta} mot forrige periode)`;
  });
  const companyRows = snapshot.topCompanies.map((company) => {
    const companyUrl = company.company
      ? `https://crm.stacq.no/selskaper/${company.company.id}`
      : `https://crm.stacq.no/selskaper?ny=${encodeURIComponent(company.name)}`;
    const label = company.company ? company.name : `${company.name} (ikke i CRM)`;
    return `<a href="${companyUrl}" style="color:#1e293b;text-decoration:none"><strong>${label}</strong></a> — ${company.adCount} annonser · ${company.topTechnologies.slice(0, 3).join(", ") || "ingen teknologi"}${company.latestRole ? ` · ${company.latestRole}` : ""}`;
  });
  const contactRows = snapshot.topContacts.map((contact) => {
    const parts = [
      contact.name || "Kontaktperson",
      contact.companyName,
      contact.role,
      contact.phone,
      contact.email,
    ].filter(Boolean);
    return parts.join(" · ");
  });
  const newCompanyRows = snapshot.newCompaniesNotInCrm.map(
    (company) =>
      `<strong>${company.name}</strong> — ${company.adCount} annonser · ${company.topTechnologies.slice(0, 3).join(", ") || "ingen teknologi"}`,
  );

  const statBox = (value: string | number, label: string) => `
    <td style="text-align:center;padding:16px 0">
      <div style="font-size:28px;font-weight:700;color:#2563eb;letter-spacing:-0.5px">${value}</div>
      <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;margin-top:4px">${label}</div>
    </td>`;

  return `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',Helvetica,Arial,sans-serif">
    <div style="padding:40px 20px">
      <div style="max-width:620px;margin:0 auto">
        <div style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06)">

          <!-- Header -->
          <div style="padding:24px 40px;border-bottom:2px solid #2563eb">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#0f172a">STACQ</span>
                  <span style="font-size:11px;font-weight:600;color:#2563eb;margin-left:8px;letter-spacing:0.1em;text-transform:uppercase">CRM</span>
                </td>
                <td style="text-align:right">
                  <span style="font-size:12px;color:#94a3b8;letter-spacing:0.02em">${dateLabel}</span>
                </td>
              </tr>
            </table>
          </div>

          <!-- Title -->
          <div style="padding:28px 40px 20px">
            <p style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#2563eb;margin:0 0 8px">Ukentlig rapport</p>
            <h1 style="font-size:24px;font-weight:700;color:#0f172a;margin:0 0 4px;letter-spacing:-0.3px">Markedsradar ${snapshot.latestWeek || ""}</h1>
          </div>

          <!-- Stats -->
          <div style="padding:0 40px 24px">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:8px;overflow:hidden">
              <tr>
                ${statBox(snapshot.adsThisWeek, "Annonser denne uken")}
                <td style="width:1px;background:#e2e8f0;padding:0"></td>
                ${statBox(snapshot.uniqueCompanies30d, "Unike selskaper")}
                <td style="width:1px;background:#e2e8f0;padding:0"></td>
                ${statBox(snapshot.technologyTrends.filter(t => t.delta > 0).length, "Teknologier i vekst")}
              </tr>
            </table>
          </div>

          ${
            aiSummary
              ? `<div style="padding:0 40px 8px">
                  <div style="background:#eff6ff;border-radius:8px;padding:20px 24px;border-left:3px solid #2563eb">
                    <p style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#2563eb;margin:0 0 10px">AI-oppsummering</p>
                    <p style="font-size:14px;color:#1e293b;margin:0;line-height:1.65">${aiSummary}</p>
                  </div>
                </div>`
              : ""
          }

          ${section("Teknologier i vekst", "Hvilke signaler som øker i stillingsmarkedet.", renderBulletRows(techRows))}
          ${section("Selskaper å følge opp", "De mest relevante selskapene basert på annonser, kontaktdata og teknologi-fit.", renderBulletRows(companyRows))}
          ${section("Kontaktpersoner", "Direkte kontaktpunkter som er verdt å bruke denne uken.", renderBulletRows(contactRows))}
          ${section("Ikke i CRM", "Selskaper som kan være verdt å opprette som nye leads.", renderBulletRows(newCompanyRows))}

          <!-- CTA -->
          <div style="padding:32px 40px">
            <a href="https://crm.stacq.no/markedsradar" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:13px;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none;letter-spacing:0.02em">Åpne markedsradar →</a>
          </div>

          <!-- Footer -->
          <div style="padding:20px 40px;border-top:1px solid #e2e8f0">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td><span style="font-size:12px;color:#94a3b8">STACQ CRM · Automatisk rapport</span></td>
                <td style="text-align:right"><span style="font-size:12px;color:#94a3b8">crm.stacq.no</span></td>
              </tr>
            </table>
          </div>

        </div>
      </div>
    </div>
  </body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let isTest = false;
    let force = false;
    let source = "manual";
    try {
      const body = await req.json();
      isTest = body?.test === true;
      force = body?.force === true;
      source = body?.source || "manual";
    } catch {
      // no body
    }

    const { data: settings, error: settingsErr } = await supabase.from("varslingsinnstillinger").select("*").single();
    if (settingsErr || !settings) {
      return new Response(JSON.stringify({ error: "Ingen innstillinger funnet" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!settings.markedsradar_aktiv && !isTest && !force) {
      return new Response(JSON.stringify({ skipped: true, reason: "Markedsradar-varsler er deaktivert" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (source === "import" && !settings.markedsradar_send_etter_import && !isTest && !force) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Automatisk utsending etter import er deaktivert" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const ninetyDaysAgo = dateDaysAgo(new Date(), 90);
    const [{ data: annonser, error: annonserErr }, { data: companies, error: companiesErr }, { data: aliases, error: aliasesErr }] = await Promise.all([
      supabase
        .from("finn_annonser")
        .select(
          "id, dato, uke, selskap, stillingsrolle, lokasjon, teknologier, lenke, kontaktnavn, kontakt_epost, kontakt_telefon",
        )
        .gte("dato", ninetyDaysAgo)
        .order("dato", { ascending: false }),
      supabase.from("companies").select("id, name, status"),
      supabase.from("company_aliases").select("company_id, alias_name"),
    ]);

    if (annonserErr || companiesErr || aliasesErr) {
      throw annonserErr || companiesErr || aliasesErr;
    }

    if (!annonser || annonser.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "Ingen Finn-data å bygge markedsradar fra" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aliasMap = new Map<string, string[]>();
    (aliases || []).forEach((alias) => {
      const values = aliasMap.get(alias.company_id) || [];
      values.push(alias.alias_name);
      aliasMap.set(alias.company_id, values);
    });

    const companiesWithAliases = ((companies || []) as CompanyRef[]).map((company) => ({
      ...company,
      aliases: aliasMap.get(company.id) || [],
    }));

    const snapshot = buildMarketSnapshot(annonser as FinnAnnonse[], companiesWithAliases);
    if (!snapshot.latestWeek) {
      return new Response(JSON.stringify({ skipped: true, reason: "Fant ingen uke i Finn-data" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isTest && !force && settings.markedsradar_sist_sendt_uke === snapshot.latestWeek) {
      return new Response(
        JSON.stringify({ skipped: true, reason: `Markedsradar for ${snapshot.latestWeek} er allerede sendt` }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const aiSummary = settings.markedsradar_inkluder_ai ? await generateAiSummary(snapshot) : null;
    const html = buildHtml(snapshot, aiSummary);
    const recipients = isTest ? ["thomas@stacq.no"] : (settings.markedsradar_epost_mottakere as string[]) || [];
    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Ingen mottakere er konfigurert for markedsradar" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const subject = `Markedsradar ${snapshot.latestWeek} — ${snapshot.adsThisWeek} annonser, ${snapshot.newCompaniesNotInCrm.length} nye selskaper`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "STACQ CRM <thomas@stacq.no>",
        to: recipients,
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errorText = await resendRes.text();
      return new Response(JSON.stringify({ error: errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isTest) {
      await supabase
        .from("varslingsinnstillinger")
        .update({
          markedsradar_sist_sendt_uke: snapshot.latestWeek,
          updated_at: new Date().toISOString(),
        })
        .eq("id", settings.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: true,
        latestWeek: snapshot.latestWeek,
        sent_to: recipients,
        subject,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
