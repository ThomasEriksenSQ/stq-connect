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
};

export const SOURCE_DOMAINS: string[] = Object.keys(SOURCE_TIERS);

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
