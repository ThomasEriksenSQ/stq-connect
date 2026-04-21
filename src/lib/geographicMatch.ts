export type GeoMatchConfidenceBand = "high" | "medium" | "low";

export type GeoMatchInput = {
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  geography?: string | null;
  location?: string | null;
  locations?: Array<string | null | undefined> | null;
};

export type GeoCandidate = {
  raw: string;
  postalCode: string | null;
  city: string | null;
  normalizedCity: string | null;
  coord: [number, number] | null;
  postalRegion: string | null;
};

export type GeoMatchTier =
  | "postal-exact"
  | "postal-3"
  | "postal-2"
  | "postal-1"
  | "city-exact"
  | "distance"
  | "region"
  | "company-unknown"
  | "consultant-unknown";

export type GeoMatchResult = {
  score: number;
  score10: number;
  confidenceBand: GeoMatchConfidenceBand;
  tier: GeoMatchTier;
  label: string;
  detail: string;
  distanceKm: number | null;
  consultantLocation: string | null;
  companyLocation: string | null;
  consultantCandidates: GeoCandidate[];
  companyCandidates: GeoCandidate[];
};

const NORWAY_CITY_COORDS: Record<string, [number, number]> = {
  oslo: [59.9139, 10.7522],
  bergen: [60.3913, 5.3221],
  trondheim: [63.4305, 10.3951],
  stavanger: [58.97, 5.7331],
  tromso: [69.6496, 18.956],
  fredrikstad: [59.2181, 10.9298],
  drammen: [59.744, 10.2045],
  kristiansand: [58.1599, 8.0182],
  sandnes: [58.8516, 5.7355],
  alesund: [62.4722, 6.1495],
  sarpsborg: [59.2836, 11.1097],
  bodo: [67.2827, 14.3751],
  sandefjord: [59.1319, 10.2167],
  arendal: [58.4608, 8.7722],
  tonsberg: [59.2672, 10.4076],
  haugesund: [59.4138, 5.268],
  porsgrunn: [59.1407, 9.6556],
  skien: [59.209, 9.5528],
  moss: [59.433, 10.6584],
  hamar: [60.7945, 11.0679],
  lillehammer: [61.1153, 10.4662],
  gjovik: [60.7957, 10.6916],
  halden: [59.1229, 11.3878],
  molde: [62.7375, 7.1591],
  horten: [59.4141, 10.484],
  harstad: [68.7993, 16.5402],
  narvik: [68.4385, 17.4272],
  kongsberg: [59.6674, 9.6499],
  steinkjer: [64.0142, 11.4953],
  alta: [69.9688, 23.2716],
  jessheim: [60.1427, 11.1739],
  ski: [59.7186, 10.8374],
  elverum: [60.8836, 11.562],
  lillestrom: [59.9555, 11.0494],
  kongsvinger: [60.1893, 12.0027],
  bryne: [58.7375, 5.6433],
  egersund: [58.4505, 6.0018],
  kopervik: [59.2813, 5.3087],
  forde: [61.4524, 5.8571],
  sogndal: [61.2294, 7.0977],
  stord: [59.7792, 5.502],
  odda: [60.0674, 6.5461],
  voss: [60.6278, 6.4152],
  leirvik: [59.7792, 5.502],
  mosjoen: [65.8358, 13.1958],
  "mo i rana": [66.3127, 14.1427],
  sandnessjoen: [66.0147, 12.6363],
  bronnoysund: [65.4741, 12.2152],
  namsos: [64.4661, 11.4958],
  stjordal: [63.4717, 10.9248],
  levanger: [63.7461, 11.2994],
  verdal: [63.793, 11.4837],
  orkanger: [63.3083, 9.853],
  melhus: [63.283, 10.2696],
  oppdal: [62.5953, 9.6898],
  roros: [62.5742, 11.3872],
  tynset: [62.2766, 10.7786],
  ringebu: [61.5305, 10.1636],
  otta: [61.7731, 9.5356],
  raufoss: [60.7232, 10.6136],
  honefoss: [60.1704, 10.2527],
  nesbyen: [60.5709, 9.1156],
  al: [60.6285, 8.5657],
  geilo: [60.535, 8.2046],
  fla: [60.4272, 9.2804],
  lyngdal: [58.1379, 7.0773],
  farsund: [58.0955, 6.8013],
  flekkefjord: [58.2975, 6.6635],
  mandal: [58.0296, 7.4618],
  grimstad: [58.3406, 8.5932],
  risor: [58.7225, 9.2311],
  kragero: [58.8668, 9.4115],
  notodden: [59.5572, 9.257],
  notteroy: [59.2208, 10.41],
  larvik: [59.0572, 10.0282],
  holmestrand: [59.49, 10.3213],
  lier: [59.7915, 10.2365],
  hokksund: [59.7705, 9.9181],
  mjondalen: [59.7433, 10.0176],
  modum: [59.9833, 9.975],
  sigdal: [60.062, 9.717],
  asker: [59.8346, 10.4391],
  baerum: [59.894, 10.5298],
  lorenskog: [59.9212, 10.958],
  skedsmo: [59.9717, 11.0347],
  nittedal: [60.0654, 10.8686],
  raelingen: [59.9055, 11.0966],
  enebakk: [59.7457, 11.1451],
  frogn: [59.6866, 10.6701],
  vestby: [59.5672, 10.7474],
  as: [59.6631, 10.7956],
  nesodden: [59.8012, 10.7102],
  oppegard: [59.7933, 10.8022],
  kolbotn: [59.7933, 10.8022],
  langhus: [59.7359, 10.83],
  vinterbro: [59.68, 10.83],
  kjeller: [59.9717, 11.049],
  hvalstad: [59.858, 10.459],
};

const KNOWN_CITY_KEYS = Object.keys(NORWAY_CITY_COORDS).sort((left, right) => right.length - left.length);

export function normalizeGeoText(value: string): string {
  return value
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return;
    const key = normalizeGeoText(trimmed);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(trimmed);
  });
  return result;
}

function splitLocationText(value: string): string[] {
  const parts = [value];
  parts.push(...value.split(/[,;\n/]+|\s+\bog\b\s+/gi));
  for (const match of value.matchAll(/\(([^)]+)\)/g)) {
    parts.push(match[1]);
  }
  return uniqueNonEmpty(parts);
}

function findPostalCode(value: string | null | undefined): string | null {
  const match = String(value || "").match(/\b(\d{4})\b/);
  return match?.[1] || null;
}

function cleanCityCandidate(value: string): string {
  return value
    .replace(/\b\d{4}\b/g, "")
    .replace(/\b(norge|norway)\b/gi, "")
    .replace(/^[,\s-]+|[,\s-]+$/g, "")
    .trim();
}

function findKnownCity(value: string): string | null {
  const normalized = ` ${normalizeGeoText(value)} `;
  for (const key of KNOWN_CITY_KEYS) {
    if (normalized.includes(` ${key} `)) return key;
  }
  return null;
}

function titleCasePlace(value: string): string {
  return value
    .split(" ")
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(" ");
}

function findCityAfterPostal(value: string, postalCode: string | null): string | null {
  if (!postalCode) return null;
  const index = value.indexOf(postalCode);
  if (index < 0) return null;
  const after = cleanCityCandidate(value.slice(index + postalCode.length));
  if (!after) return null;
  const firstPart = after.split(/[,;/]/)[0]?.trim();
  return firstPart || null;
}

function looksLikeStreetOnly(value: string): boolean {
  const normalized = normalizeGeoText(value);
  return (
    /\d/.test(normalized) ||
    /\b(gate|gata|vei|veien|veg|vegen|alle|allé|plass|bakken|stien|ringen)\b/.test(normalized)
  );
}

function postalRegion(postalCode: string | null): string | null {
  if (!postalCode) return null;
  const first = postalCode[0];
  if (first === "0" || first === "1") return "oslo-viken";
  if (first === "2") return "innlandet";
  if (first === "3") return "buskerud-vestfold-telemark";
  if (first === "4") return "agder-rogaland";
  if (first === "5") return "vestland";
  if (first === "6") return "more-romsdal-vestland";
  if (first === "7") return "trondelag";
  if (first === "8") return "nordland";
  if (first === "9") return "troms-finnmark";
  return null;
}

function parseGeoCandidate(raw: string, explicitPostalCode?: string | null, explicitCity?: string | null): GeoCandidate | null {
  const postalCode = findPostalCode(explicitPostalCode) || findPostalCode(raw);
  const knownCity = findKnownCity(raw) || findKnownCity(explicitCity || "");
  const cityFromPostal = findCityAfterPostal(raw, postalCode);
  const fallbackCity = cleanCityCandidate(explicitCity || cityFromPostal || raw);
  const city = knownCity
    ? titleCasePlace(knownCity)
    : fallbackCity && !looksLikeStreetOnly(fallbackCity)
      ? fallbackCity
      : null;
  const normalizedCity = city ? normalizeGeoText(city) : null;
  const coord = normalizedCity ? NORWAY_CITY_COORDS[normalizedCity] || null : null;

  if (!postalCode && !city && !coord) return null;

  return {
    raw,
    postalCode,
    city,
    normalizedCity,
    coord,
    postalRegion: postalRegion(postalCode),
  };
}

export function getGeoCandidates(input: GeoMatchInput): GeoCandidate[] {
  const combinedAddress = uniqueNonEmpty([
    [input.address, input.postalCode, input.city].filter(Boolean).join(" "),
    [input.postalCode, input.city].filter(Boolean).join(" "),
    input.city,
    input.geography,
    input.location,
    ...(input.locations || []),
  ]);

  const candidateTexts = combinedAddress.flatMap(splitLocationText);
  const seen = new Set<string>();
  const candidates: GeoCandidate[] = [];

  candidateTexts.forEach((text) => {
    const parsed = parseGeoCandidate(text, input.postalCode, input.city);
    if (!parsed) return;
    const key = [parsed.postalCode || "", parsed.normalizedCity || "", normalizeGeoText(parsed.raw)].join(":");
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(parsed);
  });

  return candidates;
}

function haversineKm(left: [number, number], right: [number, number]): number {
  const earthRadiusKm = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(right[0] - left[0]);
  const dLon = toRad(right[1] - left[1]);
  const lat1 = toRad(left[0]);
  const lat2 = toRad(right[0]);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function scoreToTen(score: number): number {
  if (score >= 9600) return 10;
  if (score >= 8800) return 9;
  if (score >= 7600) return 8;
  if (score >= 6400) return 7;
  if (score >= 5200) return 6;
  if (score >= 4200) return 5;
  if (score >= 3200) return 4;
  if (score >= 2200) return 3;
  if (score >= 800) return 2;
  return 1;
}

function confidenceForTier(tier: GeoMatchTier): GeoMatchConfidenceBand {
  if (tier === "postal-exact" || tier === "postal-3" || tier === "postal-2") return "high";
  if (tier === "postal-1" || tier === "city-exact" || tier === "distance") return "medium";
  return "low";
}

function publicLocationLabel(candidate: GeoCandidate | null): string | null {
  if (!candidate) return null;
  if (candidate.city) return candidate.city;
  if (candidate.postalCode) return `${candidate.postalCode.slice(0, 2)}xx`;
  return null;
}

function companyLocationLabel(candidate: GeoCandidate | null): string | null {
  if (!candidate) return null;
  if (candidate.postalCode && candidate.city) return `${candidate.postalCode} ${candidate.city}`;
  if (candidate.city) return candidate.city;
  if (candidate.postalCode) return candidate.postalCode;
  return candidate.raw;
}

function scoreCandidatePair(consultant: GeoCandidate, company: GeoCandidate): Omit<GeoMatchResult, "consultantCandidates" | "companyCandidates"> {
  const consultantPublic = publicLocationLabel(consultant);
  const companyPublic = companyLocationLabel(company);

  if (consultant.postalCode && company.postalCode) {
    if (consultant.postalCode === company.postalCode) {
      return {
        score: 10000,
        score10: 10,
        confidenceBand: "high",
        tier: "postal-exact",
        label: "Samme postnummer",
        detail: companyPublic ? `Selskap: ${companyPublic}` : "Eksakt postnummer",
        distanceKm: 0,
        consultantLocation: consultantPublic,
        companyLocation: companyPublic,
      };
    }
    if (consultant.postalCode.slice(0, 3) === company.postalCode.slice(0, 3)) {
      return {
        score: 9200,
        score10: 9,
        confidenceBand: "high",
        tier: "postal-3",
        label: `Samme postnummerområde ${company.postalCode.slice(0, 3)}x`,
        detail: companyPublic ? `Selskap: ${companyPublic}` : "Samme 3 første siffer",
        distanceKm: null,
        consultantLocation: consultantPublic,
        companyLocation: companyPublic,
      };
    }
    if (consultant.postalCode.slice(0, 2) === company.postalCode.slice(0, 2)) {
      return {
        score: 8200,
        score10: 8,
        confidenceBand: "high",
        tier: "postal-2",
        label: `Nært postnummerområde ${company.postalCode.slice(0, 2)}xx`,
        detail: companyPublic ? `Selskap: ${companyPublic}` : "Samme 2 første siffer",
        distanceKm: null,
        consultantLocation: consultantPublic,
        companyLocation: companyPublic,
      };
    }
  }

  if (consultant.normalizedCity && consultant.normalizedCity === company.normalizedCity) {
    return {
      score: 8600,
      score10: 9,
      confidenceBand: "medium",
      tier: "city-exact",
      label: `Samme sted: ${company.city}`,
      detail: companyPublic ? `Selskap: ${companyPublic}` : "Samme by/sted",
      distanceKm: 0,
      consultantLocation: consultantPublic,
      companyLocation: companyPublic,
    };
  }

  if (consultant.postalCode && company.postalCode && consultant.postalCode[0] === company.postalCode[0]) {
    return {
      score: 6100,
      score10: 7,
      confidenceBand: "medium",
      tier: "postal-1",
      label: "Samme grove postregion",
      detail: companyPublic ? `Selskap: ${companyPublic}` : "Samme første siffer i postnummer",
      distanceKm: null,
      consultantLocation: consultantPublic,
      companyLocation: companyPublic,
    };
  }

  if (consultant.coord && company.coord) {
    const distanceKm = haversineKm(consultant.coord, company.coord);
    const score = Math.max(1200, Math.round(7600 - Math.min(distanceKm, 520) * 12));
    const roundedDistance = Math.round(distanceKm);
    const label =
      roundedDistance <= 25
        ? `Nært ${company.city}`
        : roundedDistance <= 75
          ? `Samme område som ${company.city}`
          : `Ca. ${roundedDistance} km til ${company.city}`;

    return {
      score,
      score10: scoreToTen(score),
      confidenceBand: "medium",
      tier: "distance",
      label,
      detail: companyPublic ? `Selskap: ${companyPublic}` : `${roundedDistance} km`,
      distanceKm,
      consultantLocation: consultantPublic,
      companyLocation: companyPublic,
    };
  }

  if (consultant.postalRegion && consultant.postalRegion === company.postalRegion) {
    return {
      score: 2800,
      score10: 3,
      confidenceBand: "low",
      tier: "region",
      label: "Samme landsdel/postregion",
      detail: companyPublic ? `Selskap: ${companyPublic}` : "Regionalt treff",
      distanceKm: null,
      consultantLocation: consultantPublic,
      companyLocation: companyPublic,
    };
  }

  return {
    score: 200,
    score10: 1,
    confidenceBand: "low",
    tier: "region",
    label: companyPublic ? `Ukjent avstand til ${companyPublic}` : "Ukjent avstand",
    detail: companyPublic ? `Selskap: ${companyPublic}` : "Mangler presist sted",
    distanceKm: null,
    consultantLocation: consultantPublic,
    companyLocation: companyPublic,
  };
}

export function rankGeoMatch(consultantInput: GeoMatchInput, companyInputs: GeoMatchInput[]): GeoMatchResult {
  const consultantCandidates = getGeoCandidates(consultantInput);
  const companyCandidates = companyInputs.flatMap(getGeoCandidates);

  if (consultantCandidates.length === 0) {
    return {
      score: 0,
      score10: 0,
      confidenceBand: "low",
      tier: "consultant-unknown",
      label: "Mangler konsulentadresse",
      detail: "Legg inn adresse, postnummer eller poststed på ansattprofilen",
      distanceKm: null,
      consultantLocation: null,
      companyLocation: null,
      consultantCandidates,
      companyCandidates,
    };
  }

  if (companyCandidates.length === 0) {
    return {
      score: 100,
      score10: 1,
      confidenceBand: "low",
      tier: "company-unknown",
      label: "Mangler selskapssted",
      detail: "Selskapet/kontaktene mangler sted",
      distanceKm: null,
      consultantLocation: publicLocationLabel(consultantCandidates[0]),
      companyLocation: null,
      consultantCandidates,
      companyCandidates,
    };
  }

  let best: Omit<GeoMatchResult, "consultantCandidates" | "companyCandidates"> | null = null;

  consultantCandidates.forEach((consultant) => {
    companyCandidates.forEach((company) => {
      const scored = scoreCandidatePair(consultant, company);
      if (!best || scored.score > best.score) best = scored;
    });
  });

  const resolved = best || scoreCandidatePair(consultantCandidates[0], companyCandidates[0]);
  return {
    ...resolved,
    score10: resolved.score10 || scoreToTen(resolved.score),
    confidenceBand: confidenceForTier(resolved.tier),
    consultantCandidates,
    companyCandidates,
  };
}

export function buildEmployeeGeoText(postalCode?: string | null, city?: string | null, fallback?: string | null): string | null {
  const structured = [postalCode, city].map((value) => String(value || "").trim()).filter(Boolean).join(" ");
  return structured || String(fallback || "").trim() || null;
}
