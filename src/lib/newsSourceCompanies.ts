// Delt rangerings-/dedupliseringslogikk for "kildeliste" på STACQ Daily.
// Tar samme rådata som Contacts-siden bruker, og returnerer en ordnet, deduplisert
// liste over selskaper i nøyaktig samme rekkefølge som /kontakter (priority desc).

import type { HeatResult } from "@/lib/heatScore";

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

export interface RankInputContact {
  companyId: string | null;
  heat: HeatResult;
  // Kontaktens companyStatus etter samme regler som Contacts.tsx
  companyStatus: string | null;
  ikkeRelevantSelskap: boolean;
  ikkeAktuellKontakt: boolean;
}

export interface CompanyMeta {
  id: string;
  name: string;
  org_number: string | null;
  website: string | null;
  linkedin: string | null;
  status: string | null;
  ikke_relevant: boolean | null;
}

/**
 * Rangerer selskaper i samme rekkefølge som /kontakter (default sort = priority desc):
 *  1) Filtrer kontakter: ikke "ikke aktuell", selskap ikke "ikke relevant", selskapsstatus i {prospect, customer}
 *  2) Sorter kontaktene: tier asc, deretter heatScore desc (samme som Contacts.tsx case "priority")
 *  3) Gå listen ovenfra og ned, ta selskap til hver kontakt, dedupliser på companyId
 *     (første forekomst vinner — selskapets rang = rangen til dets høyest rangerte kontakt)
 */
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

  // Samme sortering som Contacts.tsx case "priority" (dir = -1 fordi desc):
  //   if (ta !== tb) return ta - tb;   // tier asc
  //   return sb - sa;                  // heatScore desc
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
      linkedin: (meta as unknown as { linkedin: string | null }).linkedin ?? null,
      status: c.companyStatus as "prospect" | "customer",
      tier: c.heat.tier,
      heatScore: c.heat.score,
    });
  }

  return out;
}

/** Formatter et norsk org.nummer med tusenskilletegn (mellomrom). */
export function formatOrgNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 9) return value;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
}

/** Vis vennlig versjon av en URL (uten protokoll og trailing slash). */
export function prettyUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname.replace(/\/$/, "");
    return path && path !== "" ? `${host}${path}` : host;
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

/** Sikre at en URL har et protokoll for `href`. */
export function ensureHref(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}
