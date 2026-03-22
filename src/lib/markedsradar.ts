import { getISOWeek, getISOWeekYear, parseISO, subDays } from "date-fns";

import { normalizeCompanyName } from "@/lib/companyMatch";

export type FinnAnnonseInput = {
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
  created_at?: string | null;
};

export type RadarCompanyRef = {
  id: string;
  name: string;
};

export type RadarTechnologyTrend = {
  name: string;
  current: number;
  previous: number;
  delta: number;
  momentumLabel: string;
  companies: string[];
};

export type RadarCompanyContact = {
  key: string;
  companyKey: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  adCount: number;
  score: number;
  companyName: string;
  company: RadarCompanyRef | null;
};

export type RadarCompany = {
  key: string;
  name: string;
  company: RadarCompanyRef | null;
  inCrm: boolean;
  adCount: number;
  currentWeekCount: number;
  recent30Count: number;
  latestDate: string;
  latestRole: string | null;
  latestLink: string | null;
  locations: string[];
  topTechnologies: string[];
  technologyCounts: Array<{ name: string; count: number }>;
  contacts: RadarCompanyContact[];
  score: number;
  scoreReasons: string[];
  primaryAction: "create_company" | "open_company" | "contact";
  contactableNow: boolean;
};

export type RadarWeeklyTechPoint = {
  uke: string;
  [key: string]: number | string;
};

export type RadarSnapshot = {
  adsThisWeek: number;
  adsLastWeek: number;
  weekDiff: number;
  uniqueCompanies30d: number;
  hottestTech: string | null;
  companies: RadarCompany[];
  newCompaniesNotInCrm: RadarCompany[];
  topHiringCompanies: RadarCompany[];
  topContactOpportunities: RadarCompanyContact[];
  technologyTrends: RadarTechnologyTrend[];
  technologyOptions: string[];
  weeklyTechSeries: RadarWeeklyTechPoint[];
};

const TECHNOLOGY_RULES: Array<{ label: string; patterns: RegExp[] }> = [
  { label: "C++", patterns: [/\bc\+\+\b/i, /\bmodern c\b/i] },
  { label: "C", patterns: [/(^|[^a-z0-9])c([^a-z0-9+#]|$)/i] },
  { label: "Rust", patterns: [/\brust\b/i] },
  { label: "Python", patterns: [/\bpython\b/i] },
  { label: "Zephyr", patterns: [/\bzephyr\b/i] },
  { label: "Yocto", patterns: [/\byocto\b/i] },
  { label: "Embedded Linux", patterns: [/\bembedded linux\b/i] },
  { label: "Linux", patterns: [/(^|[^a-z])linux([^a-z]|$)/i] },
  { label: "RTOS", patterns: [/\brtos\b/i, /\bfree rtos\b/i, /\bfreertos\b/i, /\bnuttx\b/i] },
  { label: "Bare metal", patterns: [/\bbare[- ]metal\b/i] },
  { label: "Buildroot", patterns: [/\bbuildroot\b/i] },
  { label: "FPGA", patterns: [/\bfpga\b/i, /\basic\b/i] },
  { label: "Device drivers", patterns: [/\bdevice drivers?\b/i, /\bkernel modules?\b/i] },
  { label: "Microcontrollers", patterns: [/\bmicrocontrollers?\b/i, /\bmicroprocessor systems?\b/i, /\barm cortex-m\b/i] },
  { label: "Firmware", patterns: [/\bfirmware\b/i] },
  { label: "Embedded systems", patterns: [/\bembedded systems?\b/i] },
  { label: "Robotics", patterns: [/\brobotics?\b/i, /\bcomputer vision\b/i] },
  { label: "PCB design", patterns: [/\bpcb design\b/i, /\bhigh-speed design\b/i, /\banalog electronics\b/i, /\bdigital design\b/i] },
  { label: "Electronics", patterns: [/\belectronics\b/i, /\belectronics design\b/i, /\belectronic design\b/i] },
  { label: "UAV", patterns: [/\buav\b/i, /\bpx4\b/i, /\bmavlink\b/i] },
  { label: "Testing", patterns: [/\btest\b/i, /\bquality assurance\b/i, /\bverification\b/i] },
];

const STRATEGIC_TECHNOLOGIES = new Set([
  "C++",
  "C",
  "Rust",
  "RTOS",
  "Embedded Linux",
  "Yocto",
  "Zephyr",
  "Bare metal",
  "FPGA",
  "Microcontrollers",
  "Firmware",
  "Embedded systems",
]);

function sanitizeTechToken(token: string): string {
  return token
    .replace(/^[\s(]+|[\s)]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTechSegments(raw: string): string[] {
  const segments: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of raw) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);

    if (char === "," && depth === 0) {
      const cleaned = sanitizeTechToken(current);
      if (cleaned) segments.push(cleaned);
      current = "";
      continue;
    }

    current += char;
  }

  const cleaned = sanitizeTechToken(current);
  if (cleaned) segments.push(cleaned);

  return segments;
}

function titleCaseToken(token: string): string {
  if (/^[A-Z0-9+#/-]+$/.test(token)) return token;
  return token.replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeTechnologyToken(token: string): string | null {
  const cleaned = sanitizeTechToken(token);
  if (!cleaned) return null;

  for (const rule of TECHNOLOGY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(cleaned))) return rule.label;
  }

  const lower = cleaned.toLowerCase();
  if (lower.length < 2) return null;
  if (lower === "software upgrades") return "Firmware";
  if (lower === "network devices") return "Embedded systems";

  return titleCaseToken(cleaned);
}

export function extractNormalizedTechnologies(raw: string | null | undefined): string[] {
  if (!raw) return [];

  const segments = splitTechSegments(raw);
  const tokens = new Set<string>();

  const pushToken = (value: string) => {
    const normalized = normalizeTechnologyToken(value);
    if (normalized) tokens.add(normalized);
  };

  segments.forEach((segment) => {
    pushToken(segment);

    const nestedMatches = [...segment.matchAll(/\(([^)]+)\)/g)];
    nestedMatches.forEach((match) => {
      splitTechSegments(match[1]).forEach(pushToken);
    });

    const withoutParens = sanitizeTechToken(segment.replace(/\([^)]*\)/g, " "));
    if (withoutParens && withoutParens !== segment) pushToken(withoutParens);
  });

  return [...tokens];
}

export function getIsoWeekStr(date: Date): string {
  return `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, "0")}`;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => (value || "").trim()).filter(Boolean))];
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  items.forEach((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(item);
  });

  return result;
}

type MutableContact = RadarCompanyContact;

type MutableCompany = {
  key: string;
  name: string;
  company: RadarCompanyRef | null;
  ads: FinnAnnonseInput[];
  techCounts: Map<string, number>;
  locations: Set<string>;
  roles: string[];
  contacts: Map<string, MutableContact>;
  latestDate: string;
  currentWeekCount: number;
  recent30Count: number;
};

function buildContactKey(ad: FinnAnnonseInput): string | null {
  const parts = [ad.kontaktnavn, ad.kontakt_epost, ad.kontakt_telefon]
    .map((value) => (value || "").trim().toLowerCase())
    .filter(Boolean);
  return parts.length > 0 ? parts.join("|") : null;
}

function scoreCompany(company: MutableCompany, inCrm: boolean): { score: number; reasons: string[]; contactableNow: boolean } {
  const strategicHits = [...company.techCounts.entries()]
    .filter(([name]) => STRATEGIC_TECHNOLOGIES.has(name))
    .reduce((sum, [, count]) => sum + count, 0);
  const reachableContacts = [...company.contacts.values()].filter((contact) => contact.email || contact.phone).length;
  const adCount = company.ads.length;

  const score =
    adCount * 3 +
    company.currentWeekCount * 5 +
    company.recent30Count * 4 +
    strategicHits * 2 +
    reachableContacts * 4 +
    (inCrm ? 0 : 6);

  const reasons: string[] = [];
  if (!inCrm) reasons.push("ikke i CRM");
  if (company.currentWeekCount > 0) reasons.push(`${company.currentWeekCount} annonser denne uken`);
  if (company.recent30Count > 1) reasons.push(`${company.recent30Count} annonser siste 30 dager`);
  if (strategicHits > 0) reasons.push(`${strategicHits} treff pa kjernekompetanse`);
  if (reachableContacts > 0) reasons.push(`${reachableContacts} kontakt${reachableContacts > 1 ? "er" : ""} med direkte info`);

  return {
    score,
    reasons,
    contactableNow: reachableContacts > 0,
  };
}

function buildTechnologyTrends(ads: FinnAnnonseInput[], anchorDate: Date): RadarTechnologyTrend[] {
  const currentStart = subDays(anchorDate, 29).toISOString().slice(0, 10);
  const previousStart = subDays(anchorDate, 59).toISOString().slice(0, 10);
  const previousEnd = subDays(anchorDate, 30).toISOString().slice(0, 10);

  const counts = new Map<string, { current: number; previous: number; companies: Set<string> }>();

  ads.forEach((ad) => {
    const techs = extractNormalizedTechnologies(ad.teknologier);
    if (techs.length === 0) return;

    techs.forEach((tech) => {
      const entry = counts.get(tech) || { current: 0, previous: 0, companies: new Set<string>() };
      if (ad.dato >= currentStart) {
        entry.current += 1;
        if (ad.selskap) entry.companies.add(ad.selskap.trim());
      } else if (ad.dato >= previousStart && ad.dato <= previousEnd) {
        entry.previous += 1;
      }
      counts.set(tech, entry);
    });
  });

  return [...counts.entries()]
    .map(([name, entry]) => {
      const delta = entry.current - entry.previous;
      const momentumLabel = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "stabil";
      return {
        name,
        current: entry.current,
        previous: entry.previous,
        delta,
        momentumLabel,
        companies: [...entry.companies].sort((a, b) => a.localeCompare(b, "nb")).slice(0, 4),
      };
    })
    .filter((entry) => entry.current > 0)
    .sort((a, b) => {
      if (b.delta !== a.delta) return b.delta - a.delta;
      if (b.current !== a.current) return b.current - a.current;
      return a.name.localeCompare(b.name, "nb");
    });
}

function buildWeeklyTechSeries(ads: FinnAnnonseInput[], topTechs: string[]): RadarWeeklyTechPoint[] {
  const weeks = [...new Set(ads.map((ad) => ad.uke).filter(Boolean) as string[])].sort().slice(-8);

  return weeks.map((week) => {
    const rows = ads.filter((ad) => ad.uke === week);
    const entry: RadarWeeklyTechPoint = { uke: `Uke ${week.split("-W")[1]}` };

    topTechs.forEach((tech) => {
      entry[tech] = rows.filter((ad) => extractNormalizedTechnologies(ad.teknologier).includes(tech)).length;
    });

    return entry;
  });
}

export function buildMarketRadar(
  ads: FinnAnnonseInput[],
  currentWeek: string,
  findCompany: (name: string | null) => RadarCompanyRef | null,
): RadarSnapshot {
  const cleanedAds = ads
    .filter((ad) => ad.dato && ad.selskap)
    .sort((a, b) => b.dato.localeCompare(a.dato));

  const anchorDate = cleanedAds[0]?.dato ? parseISO(cleanedAds[0].dato) : new Date();
  const lastWeek = getIsoWeekStr(subDays(parseISO(`${anchorDate.toISOString().slice(0, 10)}`), 7));
  const start30 = subDays(anchorDate, 29).toISOString().slice(0, 10);

  const companies = new Map<string, MutableCompany>();

  cleanedAds.forEach((ad) => {
    const crmCompany = findCompany(ad.selskap);
    const companyName = crmCompany?.name || ad.selskap!.trim();
    const groupKey = crmCompany ? `crm:${crmCompany.id}` : `raw:${normalizeCompanyName(companyName)}`;
    const techs = extractNormalizedTechnologies(ad.teknologier);

    let group = companies.get(groupKey);
    if (!group) {
      group = {
        key: groupKey,
        name: companyName,
        company: crmCompany,
        ads: [],
        techCounts: new Map<string, number>(),
        locations: new Set<string>(),
        roles: [],
        contacts: new Map<string, MutableContact>(),
        latestDate: ad.dato,
        currentWeekCount: 0,
        recent30Count: 0,
      };
      companies.set(groupKey, group);
    }

    group.ads.push(ad);
    if (ad.dato > group.latestDate) group.latestDate = ad.dato;
    if (ad.uke === currentWeek) group.currentWeekCount += 1;
    if (ad.dato >= start30) group.recent30Count += 1;
    if (ad.lokasjon) group.locations.add(ad.lokasjon.trim());
    if (ad.stillingsrolle) group.roles.push(ad.stillingsrolle.trim());

    techs.forEach((tech) => {
      group!.techCounts.set(tech, (group!.techCounts.get(tech) || 0) + 1);
    });

    const contactKey = buildContactKey(ad);
    if (contactKey) {
      const existing = group.contacts.get(contactKey);
      const nextScore = (ad.kontakt_epost ? 3 : 0) + (ad.kontakt_telefon ? 3 : 0) + (ad.uke === currentWeek ? 2 : 0);

      if (existing) {
        existing.adCount += 1;
        existing.score += nextScore;
        if (!existing.email && ad.kontakt_epost) existing.email = ad.kontakt_epost;
        if (!existing.phone && ad.kontakt_telefon) existing.phone = ad.kontakt_telefon;
        if (!existing.role && ad.stillingsrolle) existing.role = ad.stillingsrolle;
      } else {
        group.contacts.set(contactKey, {
          key: contactKey,
          companyKey: groupKey,
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

  const finalizedCompanies = [...companies.values()]
    .map((company) => {
      const technologyCounts = [...company.techCounts.entries()]
        .sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1];
          return a[0].localeCompare(b[0], "nb");
        })
        .map(([name, count]) => ({ name, count }));
      const contacts = [...company.contacts.values()]
        .sort((a, b) => b.score - a.score || a.companyName.localeCompare(b.companyName, "nb"))
        .map((contact) => ({ ...contact, score: contact.score + company.ads.length }));
      const scoring = scoreCompany(company, !!company.company);

      return {
        key: company.key,
        name: company.name,
        company: company.company,
        inCrm: !!company.company,
        adCount: company.ads.length,
        currentWeekCount: company.currentWeekCount,
        recent30Count: company.recent30Count,
        latestDate: company.latestDate,
        latestRole: company.roles[0] || null,
        latestLink: company.ads[0]?.lenke || null,
        locations: [...company.locations],
        topTechnologies: technologyCounts.slice(0, 5).map((item) => item.name),
        technologyCounts,
        contacts,
        score: scoring.score,
        scoreReasons: uniqueStrings(scoring.reasons).slice(0, 4),
        primaryAction: !company.company ? "create_company" : scoring.contactableNow ? "contact" : "open_company",
        contactableNow: scoring.contactableNow,
      } satisfies RadarCompany;
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.currentWeekCount !== a.currentWeekCount) return b.currentWeekCount - a.currentWeekCount;
      if (b.adCount !== a.adCount) return b.adCount - a.adCount;
      return a.name.localeCompare(b.name, "nb");
    });

  const newCompaniesNotInCrm = finalizedCompanies.filter((company) => !company.inCrm).slice(0, 8);
  const topHiringCompanies = finalizedCompanies.slice(0, 12);
  const topContactOpportunities = uniqueBy(
    finalizedCompanies.flatMap((company) =>
      company.contacts.map((contact) => ({
        ...contact,
        score: contact.score + company.score,
      })),
    ),
    (contact) => contact.key,
  )
    .sort((a, b) => b.score - a.score || a.companyName.localeCompare(b.companyName, "nb"))
    .slice(0, 10);

  const technologyTrends = buildTechnologyTrends(cleanedAds, anchorDate);
  const technologyOptions = technologyTrends.slice(0, 14).map((item) => item.name);
  const weeklyTechSeries = buildWeeklyTechSeries(cleanedAds, technologyOptions.slice(0, 6));

  const adsThisWeek = cleanedAds.filter((ad) => ad.uke === currentWeek).length;
  const adsLastWeek = cleanedAds.filter((ad) => ad.uke === lastWeek).length;
  const uniqueCompanies30d = new Set(
    cleanedAds
      .filter((ad) => ad.dato >= start30 && ad.selskap)
      .map((ad) => normalizeCompanyName(ad.selskap!)),
  ).size;

  return {
    adsThisWeek,
    adsLastWeek,
    weekDiff: adsThisWeek - adsLastWeek,
    uniqueCompanies30d,
    hottestTech: technologyTrends[0]?.name || null,
    companies: finalizedCompanies,
    newCompaniesNotInCrm,
    topHiringCompanies,
    topContactOpportunities,
    technologyTrends,
    technologyOptions,
    weeklyTechSeries,
  };
}
