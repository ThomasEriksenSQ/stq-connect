// Norske nyhetskilder rangert etter redaksjonell tyngde for B2B-prospects
export const SOURCE_TIERS: Record<string, 1 | 2 | 3> = {
  "e24.no": 1,
  "dn.no": 1,
  "finansavisen.no": 2,
  "tu.no": 2,
  "digi.no": 2,
  "nrk.no": 1,
  "aftenposten.no": 1,
  "kapital.no": 2,
  "hegnar.no": 2,
  "shifter.no": 2,
  "computerworld.no": 3,
  "inside-telecom.no": 3,
  "elektronikk-bransjen.no": 3,
  // Utvidet redaksjonell dekning (B2B / bransje / regional)
  "vg.no": 1,
  "dagbladet.no": 2,
  "borsen.no": 2,
  "bt.no": 2,
  "adressa.no": 2,
  "stavanger-aftenblad.no": 2,
  "smp.no": 3,
  "ilaks.no": 3,
  "intrafish.no": 2,
  "fiskeribladet.no": 2,
  "sysla.no": 2,
  "europower.com": 2,
  "europower.no": 2,
  "fanaposten.no": 3,
  "kommunal-rapport.no": 3,
  "anlegg.no": 3,
  "bygg.no": 3,
  "byggeindustrien.no": 3,
  "abcnyheter.no": 3,
  "nettavisen.no": 2,
  "altinget.no": 2,
  "khrono.no": 3,
  "forskning.no": 3,
  "ntbinfo.no": 2,
  "itromso.no": 3,
  "nordlys.no": 2,
  "an.no": 3,
};

export const SOURCE_DOMAINS: string[] = Object.keys(SOURCE_TIERS);

// Domener vi tillater å hente nyheter fra utover SOURCE_TIERS (presse, regjering, børs).
// Disse får fortsatt Tier 3 om de ikke er i SOURCE_TIERS, men passerer "trusted"-sjekken.
const TRUSTED_EXTRA = [
  "regjeringen.no",
  "stortinget.no",
  "newsweb.oslobors.no",
  "oslobors.no",
  "euronext.com",
  "ntb.no",
];

export function tierForUrl(url: string): 1 | 2 | 3 {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    for (const domain of SOURCE_DOMAINS) {
      if (host === domain || host.endsWith(`.${domain}`)) {
        return SOURCE_TIERS[domain];
      }
    }
  } catch {
    // ignore
  }
  return 3;
}

export function sourceForUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "ukjent";
  }
}

// True hvis URL kommer fra et redaksjonelt eller offisielt domene vi stoler på,
// ELLER fra selskapets eget domene (companyHost). Brukes for å filtrere bort
// støy som blogspot, medium, substack, link-farms.
export function isTrustedSource(url: string, companyHost: string | null): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (companyHost && (host === companyHost || host.endsWith(`.${companyHost}`))) return true;
    for (const domain of SOURCE_DOMAINS) {
      if (host === domain || host.endsWith(`.${domain}`)) return true;
    }
    for (const domain of TRUSTED_EXTRA) {
      if (host === domain || host.endsWith(`.${domain}`)) return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function hostFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
