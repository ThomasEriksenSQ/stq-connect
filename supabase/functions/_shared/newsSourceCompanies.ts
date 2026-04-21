// Deno-port av src/lib/newsSourceCompanies.ts.
// Brukes av edge-funksjonen `news-daily-digest` for å rangere selskaper i nøyaktig
// samme rekkefølge som /kontakter (priority desc) og /design-lab/news → "Kildeliste".

import type { HeatResult } from "./heatScore.ts";

export interface CompanyMeta {
  id: string;
  name: string;
  org_number: string | null;
  website: string | null;
  linkedin: string | null;
  status: string | null;
  ikke_relevant: boolean | null;
}

export interface RankInputContact {
  companyId: string | null;
  heat: HeatResult;
  companyStatus: string | null;
  ikkeRelevantSelskap: boolean;
  ikkeAktuellKontakt: boolean;
}

export interface RankedSourceCompany {
  rank: number;
  companyId: string;
  name: string;
  orgNumber: string | null;
  website: string | null;
  linkedin: string | null;
  status: "prospect" | "customer";
  tier: 1 | 2 | 3 | 4;
  heatScore: number;
}

export function rankCompaniesFromContacts(
  contacts: RankInputContact[],
  companies: CompanyMeta[],
): RankedSourceCompany[] {
  const companyById = new Map<string, CompanyMeta>();
  for (const c of companies) companyById.set(c.id, c);

  const eligible = contacts.filter((c) => {
    if (!c.companyId) return false;
    if (c.ikkeAktuellKontakt) return false;
    if (c.ikkeRelevantSelskap) return false;
    const status = c.companyStatus;
    if (status !== "prospect" && status !== "customer") return false;
    return true;
  });

  const sorted = [...eligible].sort((a, b) => {
    if (a.heat.tier !== b.heat.tier) return a.heat.tier - b.heat.tier;
    return b.heat.score - a.heat.score;
  });

  const seen = new Set<string>();
  const out: RankedSourceCompany[] = [];
  for (const c of sorted) {
    const cid = c.companyId!;
    if (seen.has(cid)) continue;
    const meta = companyById.get(cid);
    if (!meta) continue;
    seen.add(cid);
    out.push({
      rank: out.length + 1,
      companyId: cid,
      name: meta.name,
      orgNumber: meta.org_number,
      website: meta.website,
      linkedin: meta.linkedin,
      status: c.companyStatus as "prospect" | "customer",
      tier: c.heat.tier,
      heatScore: c.heat.score,
    });
  }

  return out;
}
