import { getISOWeek, getISOWeekYear, parseISO, subDays } from "date-fns";

import { normalizeCompanyName } from "@/lib/companyMatch";
import { extractTechnologyTagsFromText, normalizeTechnologyTags } from "@/lib/technologyTags";

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
  matched_company_id?: string | null;
  teknologier_array?: string[] | null;
  created_at?: string | null;
};

export type RadarCompanyRef = {
  id: string;
  name: string;
  status: string | null;
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
  crmStatus: string | null;
  inCrm: boolean;
  isActionable: boolean;
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

const STRATEGIC_TECHNOLOGIES = new Set([
  "C++",
  "C",
  "Rust",
  "RTOS",
  "FreeRTOS",
  "NuttX",
  "Embedded Linux",
  "Yocto",
  "Zephyr",
  "Bare metal",
  "FPGA",
  "Microcontrollers",
  "ARM Cortex-M",
  "STM32",
  "Firmware",
  "Embedded systems",
]);

export function extractNormalizedTechnologies(raw: string | null | undefined): string[] {
  return extractTechnologyTagsFromText(raw);
}

export function getFinnAnnonseTechnologies(annonse: FinnAnnonseInput): string[] {
  if (annonse.teknologier_array && annonse.teknologier_array.length > 0) {
    return normalizeTechnologyTags(annonse.teknologier_array);
  }

  return extractNormalizedTechnologies(annonse.teknologier);
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
  crmStatus: string | null;
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

function normalizeCompanyStatus(status: string | null | undefined): string | null {
  if (!status) return null;
  const normalized = status.trim().toLowerCase();
  if (normalized === "kunde") return "customer";
  return normalized;
}

function isActionableCompanyStatus(status: string | null | undefined): boolean {
  const normalized = normalizeCompanyStatus(status);
  return normalized !== "partner" && normalized !== "churned";
}

function scoreCompany(
  company: MutableCompany,
  inCrm: boolean,
): { score: number; reasons: string[]; contactableNow: boolean } {
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
  if (reachableContacts > 0)
    reasons.push(`${reachableContacts} kontakt${reachableContacts > 1 ? "er" : ""} med direkte info`);

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
    const techs = getFinnAnnonseTechnologies(ad);
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
      entry[tech] = rows.filter((ad) => getFinnAnnonseTechnologies(ad).includes(tech)).length;
    });

    return entry;
  });
}

export function buildMarketRadar(
  ads: FinnAnnonseInput[],
  currentWeek: string,
  findCompany: (ad: FinnAnnonseInput) => RadarCompanyRef | null,
): RadarSnapshot {
  const cleanedAds = ads.filter((ad) => ad.dato && ad.selskap).sort((a, b) => b.dato.localeCompare(a.dato));

  const anchorDate = cleanedAds[0]?.dato ? parseISO(cleanedAds[0].dato) : new Date();
  const lastWeek = getIsoWeekStr(subDays(parseISO(`${anchorDate.toISOString().slice(0, 10)}`), 7));
  const start30 = subDays(anchorDate, 29).toISOString().slice(0, 10);

  const companies = new Map<string, MutableCompany>();

  cleanedAds.forEach((ad) => {
    const crmCompany = findCompany(ad);
    const companyName = crmCompany?.name || ad.selskap!.trim();
    const groupKey = crmCompany ? `crm:${crmCompany.id}` : `raw:${normalizeCompanyName(companyName)}`;
    const techs = getFinnAnnonseTechnologies(ad);

    let group = companies.get(groupKey);
    if (!group) {
      group = {
        key: groupKey,
        name: companyName,
        company: crmCompany,
        crmStatus: crmCompany?.status || null,
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
        crmStatus: company.crmStatus,
        inCrm: !!company.company,
        isActionable: !company.company || isActionableCompanyStatus(company.crmStatus),
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

  const actionableCompanies = finalizedCompanies.filter((company) => company.isActionable);
  const newCompaniesNotInCrm = actionableCompanies.filter((company) => !company.inCrm).slice(0, 8);
  const topHiringCompanies = actionableCompanies.slice(0, 12);
  const topContactOpportunities = uniqueBy(
    actionableCompanies.flatMap((company) =>
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
  const strategicFirst = technologyTrends
    .filter((t) => STRATEGIC_TECHNOLOGIES.has(t.name) && t.current > 0)
    .sort((a, b) => b.current - a.current)
    .map((t) => t.name);
  const rest = technologyTrends
    .filter((t) => !STRATEGIC_TECHNOLOGIES.has(t.name))
    .map((t) => t.name);
  const technologyOptions = [...strategicFirst, ...rest].slice(0, 14);
  const weeklyTechSeries = buildWeeklyTechSeries(cleanedAds, technologyOptions.slice(0, 6));

  const adsThisWeek = cleanedAds.filter((ad) => ad.uke === currentWeek).length;
  const adsLastWeek = cleanedAds.filter((ad) => ad.uke === lastWeek).length;
  const uniqueCompanies30d = new Set(
    cleanedAds.filter((ad) => ad.dato >= start30 && ad.selskap).map((ad) => normalizeCompanyName(ad.selskap!)),
  ).size;

  return {
    adsThisWeek,
    adsLastWeek,
    weekDiff: adsThisWeek - adsLastWeek,
    uniqueCompanies30d,
    hottestTech: technologyTrends[0]?.name || null,
    companies: actionableCompanies,
    newCompaniesNotInCrm,
    topHiringCompanies,
    topContactOpportunities,
    technologyTrends,
    technologyOptions,
    weeklyTechSeries,
  };
}
