// Forenklet port av src/lib/heatScore.ts → tier per selskap basert på kontaktenes signaler/aktivitet.
// Tier 1 = Behov nå, Tier 2 = Får fremtidig behov, Tier 3 = Får kanskje behov / FN, Tier 4 = ellers.

export type Tier = 1 | 2 | 3 | 4;

interface ContactSignal {
  company_id: string;
  signal: string | null; // siste signal-kategori
  days_since_last_activity: number; // 999 = aldri
  ikke_aktuell: boolean;
}

const SIGNAL_TIER: Record<string, Tier> = {
  "Behov nå": 1,
  "Får fremtidig behov": 2,
  "Får kanskje behov": 3,
  "Ukjent om behov": 4,
  "Ikke aktuelt": 4,
};

export const HEAT_BOOST: Record<Tier, number> = {
  1: 2.0,
  2: 1.2,
  3: 0.6,
  4: 0.0,
};

export function tierForContact(c: ContactSignal): Tier {
  if (c.ikke_aktuell) return 4;
  // Signal expirerer etter 30 dager (jf. memory: signal-synchronization)
  if (c.days_since_last_activity > 30) return 4;
  const t = c.signal ? SIGNAL_TIER[c.signal] : undefined;
  return t ?? 4;
}

// Returnerer høyeste tier (lavest tall) per company_id
export function aggregateHeatTiers(contacts: ContactSignal[]): Map<string, Tier> {
  const map = new Map<string, Tier>();
  for (const c of contacts) {
    const t = tierForContact(c);
    const cur = map.get(c.company_id);
    if (cur === undefined || t < cur) {
      map.set(c.company_id, t);
    }
  }
  return map;
}
