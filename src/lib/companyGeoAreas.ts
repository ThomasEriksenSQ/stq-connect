import { normalizeGeoText } from "@/lib/geographicMatch";

export const GEO_FILTERS = [
  "Alle",
  "Oslo+",
  "Trondheim+",
  "Kongsberg+",
  "Stavanger+",
  "Bergen+",
  "Kristiansand+",
  "Vestfold",
  "Østfold",
  "Vestlandet",
  "Midt-Norge",
  "Nord-Norge",
  "Sørlandet",
  "Ukjent sted",
] as const;

export type GeoFilter = (typeof GEO_FILTERS)[number];

export type CompanyGeoAreaInput = {
  city?: string | null;
  address?: string | null;
  zip_code?: string | null;
  locations?: Array<string | null | undefined> | null;
  geo_areas?: Array<string | null | undefined> | null;
  geo_source?: string | null;
};

export type ContactGeoAreaInput = {
  location?: string | null;
  locations?: Array<string | null | undefined> | null;
  company?: CompanyGeoAreaInput | null;
};

type GeoAreaDefinition = {
  label: Exclude<GeoFilter, "Alle">;
  places: string[];
};

export type CompanyGeoResolutionSource = "persisted" | "manual" | "postal" | "place" | "hybrid" | "unknown";

export type CompanyGeoResolution = {
  areas: Exclude<GeoFilter, "Alle">[];
  source: CompanyGeoResolutionSource;
  unresolvedPlaces: string[];
};

const AREA_DEFINITIONS: GeoAreaDefinition[] = [
  {
    label: "Oslo+",
    places: [
      "Oslo",
      "Bærum",
      "Asker",
      "Sandvika",
      "Lysaker",
      "Fornebu",
      "Snarøya",
      "Stabekk",
      "Høvik",
      "Hovik",
      "Bekkestua",
      "Rud",
      "Billingstad",
      "Nesbru",
      "Slependen",
      "Heggedal",
      "Vollen",
      "Lillestrøm",
      "Lillestrom",
      "Strømmen",
      "Strommen",
      "Skjetten",
      "Fetsund",
      "Kløfta",
      "Klofta",
      "Jessheim",
      "Ullensaker",
      "Gardermoen",
      "Lørenskog",
      "Lorenskog",
      "Nordre Follo",
      "Ski",
      "Kolbotn",
      "Langhus",
      "Sofiemyr",
      "Ås",
      "As",
      "Vestby",
      "Drøbak",
      "Drobak",
      "Frogn",
      "Nesodden",
      "Nittedal",
      "Rælingen",
      "Raelingen",
      "Skedsmo",
      "Skedsmokorset",
      "Kjeller",
      "Hvalstad",
      "Trollåsen",
      "Trollasen",
      "Greverud",
      "Myrvoll",
      "Fjellhamar",
      "Løvenstad",
      "Lovenstad",
      "Sørumsand",
      "Sorumsand",
      "Aurskog",
      "Frogner",
      "Skøyen",
      "Skoyen",
      "Nydalen",
      "Aker Brygge",
      "Tjuvholmen",
      "Bjørvika",
      "Bjorvika",
      "Løren",
      "Loren",
      "Hasle",
      "Ensjø",
      "Ensjo",
      "Alnabru",
      "Alna",
      "Økern",
      "Okern",
      "Ullevål",
      "Ullevål Stadion",
      "Majorstuen",
      "Oppegård",
      "Oppegard",
      "Vinterbro",
      "Enebakk",
      "Akershus",
      "Follo",
      "Romerike",
      "Eidsvoll",
      "Hamar",
      "Lillehammer",
      "Gjøvik",
      "Gjovik",
      "Raufoss",
      "Brumunddal",
      "Moelv",
      "Otta",
      "Ringebu",
      "Elverum",
      "Trysil",
      "Kongsvinger",
      "Innlandet",
      "Stor-Oslo",
      "Oslo-området",
      "Osloområdet",
      "Oslo region",
      "Oslo-regionen",
    ],
  },
  {
    label: "Trondheim+",
    places: [
      "Trondheim",
      "Heimdal",
      "Tiller",
      "Ranheim",
      "Lade",
      "Byåsen",
      "Byasen",
      "Charlottenlund",
      "Rotvoll",
      "Sluppen",
      "Gløshaugen",
      "Gloshaugen",
      "Solsiden",
      "Moholt",
      "Stjørdal",
      "Stjordal",
      "Hell",
      "Malvik",
      "Hommelvik",
      "Vanvikan",
      "Skaun",
      "Børsa",
      "Borsa",
      "Selbu",
      "Melhus",
      "Orkanger",
      "Orkland",
      "Levanger",
      "Verdal",
      "Steinkjer",
      "Trondheim-området",
      "Trondheimsregionen",
    ],
  },
  {
    label: "Kongsberg+",
    places: [
      "Kongsberg",
      "Notodden",
      "Hokksund",
      "Drammen",
      "Lier",
      "Lierstranda",
      "Tranby",
      "Vestfossen",
      "Øvre Eiker",
      "Ovre Eiker",
      "Nedre Eiker",
      "Mjøndalen",
      "Mjondalen",
      "Sande",
      "Svelvik",
      "Holmestrand",
      "Horten",
      "Tønsberg",
      "Tonsberg",
      "Vikersund",
      "Modum",
      "Ringerike",
      "Hønefoss",
      "Honefoss",
      "Nesbyen",
      "Ål",
      "Al",
      "Geilo",
      "Flå",
      "Fla",
      "Gol",
      "Hemsedal",
      "Lampeland",
      "Buskerud",
      "Viken",
      "Kongsbergregionen",
      "Drammensregionen",
      "Numedal",
      "Hallingdal",
      "Hadeland",
    ],
  },
  {
    label: "Stavanger+",
    places: [
      "Stavanger",
      "Sandnes",
      "Forus",
      "Sola",
      "Tananger",
      "Randaberg",
      "Bryne",
      "Tau",
      "Jørpeland",
      "Jorpeland",
      "Strand",
      "Hjelmeland",
      "Hundvåg",
      "Hundvag",
      "Finnøy",
      "Finnoy",
      "Rennesøy",
      "Rennesoy",
      "Klepp",
      "Kleppe",
      "Time",
      "Nærbø",
      "Naerbo",
      "Varhaug",
      "Ålgård",
      "Algard",
      "Gjesdal",
      "Egersund",
      "Hinna",
      "Mariero",
      "Dusavik",
      "Kvadrat",
      "Jæren",
      "Jaeren",
      "Rogaland",
      "Sør-Rogaland",
      "Sor-Rogaland",
      "Stavanger-området",
      "Stavangerområdet",
      "Stavangerregionen",
      "Sandnes-området",
    ],
  },
  {
    label: "Bergen+",
    places: [
      "Bergen",
      "Fyllingsdalen",
      "Kokstad",
      "Sandsli",
      "Nesttun",
      "Åsane",
      "Asane",
      "Minde",
      "Nyborg",
      "Loddefjord",
      "Paradis",
      "Bønes",
      "Bones",
      "Godvik",
      "Eidsvåg",
      "Eidsvag",
      "Søreidgrend",
      "Soreidgrend",
      "Blomsterdalen",
      "Laksevåg",
      "Laksevag",
      "Arna",
      "Askøy",
      "Askoy",
      "Kleppestø",
      "Kleppesto",
      "Sotra",
      "Straume",
      "Øygarden",
      "Oygarden",
      "Os",
      "Bjørnafjorden",
      "Bjornafjorden",
      "Frekhaug",
      "Knarvik",
      "Alver",
      "Voss",
      "Stord",
      "Leirvik",
      "Bergen-området",
      "Bergensområdet",
      "Bergensregionen",
      "Hordaland",
      "Nordhordland",
      "Midthordland",
    ],
  },
  {
    label: "Kristiansand+",
    places: [
      "Kristiansand",
      "Vennesla",
      "Søgne",
      "Sogne",
      "Songdalen",
      "Birkeland",
      "Lillesand",
      "Iveland",
      "Kjevik",
      "Hånes",
      "Hanes",
      "Flekkerøy",
      "Flekkeroy",
      "Kongshavn",
      "Kristiansand-området",
      "Kristiansandsregionen",
    ],
  },
  {
    label: "Vestfold",
    places: [
      "Vestfold",
      "Tønsberg",
      "Tonsberg",
      "Sandefjord",
      "Larvik",
      "Horten",
      "Holmestrand",
      "Revetal",
      "Stokke",
      "Nøtterøy",
      "Notteroy",
      "Færder",
      "Faerder",
      "Tjøme",
      "Tjome",
      "Barkåker",
      "Barkaker",
      "Sem",
      "Vear",
      "Åsgårdstrand",
      "Asgardstrand",
      "Borre",
      "Skoppum",
      "Torp",
      "Tjølling",
      "Tjolling",
      "Sande",
      "Svelvik",
      "Drammen",
      "Lier",
      "Lierstranda",
      "Vestfoldregionen",
      "Vestfold og Telemark",
    ],
  },
  {
    label: "Østfold",
    places: [
      "Fredrikstad",
      "Gamle Fredrikstad",
      "Kråkerøy",
      "Krakeroy",
      "Rolvsøy",
      "Rolvsoy",
      "Gressvik",
      "Sellebakk",
      "Sarpsborg",
      "Moss",
      "Rygge",
      "Råde",
      "Rade",
      "Våler i Østfold",
      "Valer i Ostfold",
      "Halden",
      "Mysen",
      "Askim",
      "Indre Østfold",
      "Indre Ostfold",
      "Eidsberg",
      "Rakkestad",
      "Spydeberg",
      "Tomter",
      "Skiptvet",
      "Viken",
      "Østfold",
      "Ostfold",
      "Østfoldregionen",
      "Mosseregionen",
    ],
  },
  {
    label: "Vestlandet",
    places: [
      "Bergen",
      "Fyllingsdalen",
      "Kokstad",
      "Sandsli",
      "Nesttun",
      "Åsane",
      "Asane",
      "Stavanger",
      "Sandnes",
      "Forus",
      "Sola",
      "Tananger",
      "Randaberg",
      "Bryne",
      "Tau",
      "Jørpeland",
      "Jorpeland",
      "Haugesund",
      "Kopervik",
      "Førde",
      "Forde",
      "Sogndal",
      "Odda",
      "Ålesund",
      "Alesund",
      "Molde",
      "Kristiansund",
      "Bremanger",
      "Åkrehamn",
      "Akrehamn",
      "Karmøy",
      "Karmoy",
      "Tysvær",
      "Tysvaer",
      "Nedre Vats",
      "Vats",
      "Ølen",
      "Olen",
      "Florø",
      "Floro",
      "Ulsteinvik",
      "Volda",
      "Ørsta",
      "Orsta",
      "Stryn",
      "Nordfjordeid",
      "Måløy",
      "Maloy",
      "Kvam",
      "Norheimsund",
      "Sauda",
      "Mongstad",
      "Vestland",
      "Vestlandet",
      "Hordaland",
      "Rogaland",
      "Sogn og Fjordane",
      "Møre og Romsdal",
      "More og Romsdal",
      "Sunnmøre",
      "Sunnmore",
      "Nordmøre",
      "Nordmore",
      "Romsdal",
    ],
  },
  {
    label: "Midt-Norge",
    places: [
      "Trondheim",
      "Stjørdal",
      "Stjordal",
      "Orkanger",
      "Orkland",
      "Steinkjer",
      "Levanger",
      "Verdal",
      "Namsos",
      "Røros",
      "Roros",
      "Oppdal",
      "Tynset",
      "Rindal",
      "Trøndelag",
      "Trondelag",
      "Midt-Norge",
    ],
  },
  {
    label: "Nord-Norge",
    places: [
      "Bodø",
      "Bodo",
      "Fauske",
      "Tromsø",
      "Tromso",
      "Harstad",
      "Narvik",
      "Alta",
      "Andenes",
      "Andøya",
      "Andoya",
      "Andøy",
      "Andoy",
      "Hammerfest",
      "Kirkenes",
      "Vadsø",
      "Vadso",
      "Vardø",
      "Vardo",
      "Sortland",
      "Svolvær",
      "Svolvaer",
      "Leknes",
      "Finnsnes",
      "Mosjøen",
      "Mosjoen",
      "Mo i Rana",
      "Rana",
      "Sandnessjøen",
      "Sandnessjoen",
      "Brønnøysund",
      "Bronnoysund",
      "Nordland",
      "Troms",
      "Finnmark",
      "Troms og Finnmark",
      "Nord-Norge",
    ],
  },
  {
    label: "Sørlandet",
    places: [
      "Kristiansand",
      "Vennesla",
      "Søgne",
      "Sogne",
      "Songdalen",
      "Birkeland",
      "Lillesand",
      "Iveland",
      "Kjevik",
      "Hånes",
      "Hanes",
      "Flekkerøy",
      "Flekkeroy",
      "Kongshavn",
      "Grimstad",
      "Arendal",
      "Tvedestrand",
      "Mandal",
      "Lindesnes",
      "Lyngdal",
      "Flekkefjord",
      "Kragerø",
      "Kragero",
      "Risør",
      "Risor",
      "Farsund",
      "Evje",
      "Porsgrunn",
      "Skien",
      "Bø",
      "Bo",
      "Bø i Telemark",
      "Seljord",
      "Nome",
      "Telemark",
      "Vestfold og Telemark",
      "Setesdal",
      "Agder",
      "Aust-Agder",
      "Vest-Agder",
      "Sørlandet",
    ],
  },
];

const LEGACY_GEO_FILTER_LABELS: Record<string, GeoFilter> = {
  "Oslo-området": "Oslo+",
  "Trondheim-området": "Trondheim+",
  "Stavanger/Sandnes": "Stavanger+",
  "Kongsberg-området": "Kongsberg+",
  "Bergen-området": "Bergen+",
  "Kristiansand-området": "Kristiansand+",
  "Østlandet": "Alle",
  "Ostlandet": "Alle",
  "Østlandet ellers": "Alle",
  "Sør-Østlandet": "Alle",
  "Sor-Ostlandet": "Alle",
  "Vestlandet ellers": "Vestlandet",
  "Midt-Norge ellers": "Midt-Norge",
  "Sørlandet/Telemark ellers": "Sørlandet",
};

const AREA_PLACE_KEYS = AREA_DEFINITIONS.map((definition) => ({
  ...definition,
  placeKeys: definition.places.map((place) => normalizeGeoText(place)),
}));

function splitLocationText(value: string | null | undefined): string[] {
  return String(value || "")
    .split(/[,;\n/]+|\s+\bog\b\s+/gi)
    .map((part) => part.trim())
    .filter(Boolean);
}

type GeoPartSource = "location" | "city" | "address" | "postal";

type GeoPart = {
  value: string;
  source: GeoPartSource;
};

function uniqueGeoParts(parts: GeoPart[]): GeoPart[] {
  const seen = new Set<string>();
  const result: GeoPart[] = [];

  parts.forEach((part) => {
    const trimmed = part.value.trim();
    const key = `${part.source}:${normalizeGeoText(trimmed)}`;
    if (!trimmed || !key || seen.has(key)) return;
    seen.add(key);
    result.push({ ...part, value: trimmed });
  });

  return result;
}

function getLocationParts(input: CompanyGeoAreaInput) {
  const parts: GeoPart[] = [
    ...(input.locations || []).flatMap((location) =>
      splitLocationText(location).map((value) => ({ value, source: "location" as const })),
    ),
    ...splitLocationText(input.city).map((value) => ({ value, source: "city" as const })),
    ...splitLocationText(input.address).map((value) => ({ value, source: "address" as const })),
  ];
  const zip = String(input.zip_code || "").trim();
  if (zip) parts.push({ value: zip, source: "postal" });
  return uniqueGeoParts(parts);
}

function getContactLocationParts(input: ContactGeoAreaInput) {
  return uniqueGeoParts(
    [input.location, ...(input.locations || [])].flatMap((location) =>
      splitLocationText(location).map((value) => ({ value, source: "location" as const })),
    ),
  );
}

function findPostalCode(value: string | null | undefined): string | null {
  const match = String(value || "").match(/\b(\d{4})\b/);
  return match?.[1] || null;
}

function normalizeStoredGeoAreas(values: Array<string | null | undefined> | null | undefined) {
  const seen = new Set<Exclude<GeoFilter, "Alle">>();
  (values || []).forEach((value) => {
    const normalized = normalizeGeoFilter(value);
    if (normalized !== "Alle") seen.add(normalized);
  });
  return [...seen];
}

function partMatchesPlace(part: string, placeKey: string) {
  const normalized = normalizeGeoText(part);
  if (!normalized || !placeKey) return false;
  return normalized === placeKey || normalized.includes(` ${placeKey} `) || normalized.startsWith(`${placeKey} `) || normalized.endsWith(` ${placeKey}`);
}

function geoAreasFromPostalCode(postalCode: string | null): Exclude<GeoFilter, "Alle">[] {
  if (!postalCode) return [];
  const value = Number(postalCode);
  if (!Number.isFinite(value)) return [];

  if (value < 1500 || (value >= 1900 && value < 2200)) return ["Oslo+"];
  if (value >= 1500 && value < 1900) return ["Østfold"];
  if (value >= 3000 && value < 3100) return ["Kongsberg+", "Vestfold"];
  if (value >= 3100 && value < 3300) return ["Kongsberg+", "Vestfold"];
  if (value >= 3300 && value < 3700) return ["Kongsberg+"];
  if (value >= 3700 && value < 4000) return ["Sørlandet"];
  if (value >= 4000 && value < 4400) return ["Stavanger+", "Vestlandet"];
  if (value >= 4400 && value < 4500) return ["Sørlandet"];
  if (value >= 4500 && value < 4800) return ["Kristiansand+", "Sørlandet"];
  if (value >= 4800 && value < 5000) return ["Sørlandet"];
  if (value >= 5000 && value < 5400) return ["Bergen+", "Vestlandet"];
  if (value >= 5400 && value < 7000) return ["Vestlandet"];
  if (value >= 7000 && value < 7600) return ["Trondheim+", "Midt-Norge"];
  if (value >= 7600 && value < 8000) return ["Midt-Norge"];
  if (value >= 8000 && value < 10000) return ["Nord-Norge"];
  return [];
}

function getGeoResolutionFromParts(parts: GeoPart[]): CompanyGeoResolution {
  if (parts.length === 0) {
    return { areas: ["Ukjent sted"], source: "unknown", unresolvedPlaces: [] };
  }

  const matches = new Set<Exclude<GeoFilter, "Alle">>();
  const sourceMatches = new Set<Exclude<CompanyGeoResolutionSource, "persisted" | "manual" | "hybrid" | "unknown">>();
  const unresolvedPlaces = new Map<string, string>();

  parts.forEach((part) => {
    const postalAreas = geoAreasFromPostalCode(findPostalCode(part.value));
    let matched = false;
    if (postalAreas.length > 0) {
      postalAreas.forEach((area) => matches.add(area));
      sourceMatches.add("postal");
      matched = true;
    }

    AREA_PLACE_KEYS.forEach((definition) => {
      if (definition.placeKeys.some((placeKey) => partMatchesPlace(part.value, placeKey))) {
        matches.add(definition.label);
        sourceMatches.add("place");
        matched = true;
      }
    });

    if (!matched && (part.source === "location" || part.source === "city")) {
      unresolvedPlaces.set(normalizeGeoText(part.value), part.value);
    }
  });

  if (matches.size > 0) {
    const areas = GEO_FILTERS.filter(
      (filter): filter is Exclude<GeoFilter, "Alle"> => filter !== "Alle" && matches.has(filter),
    );
    const source = sourceMatches.size > 1 ? "hybrid" : sourceMatches.has("postal") ? "postal" : "place";
    return { areas, source, unresolvedPlaces: [...unresolvedPlaces.values()] };
  }

  return {
    areas: ["Ukjent sted"],
    source: "unknown",
    unresolvedPlaces: [...unresolvedPlaces.values()],
  };
}

export function normalizeGeoFilter(value: string | null | undefined): GeoFilter {
  const normalized = String(value || "").trim();
  if (GEO_FILTERS.includes(normalized as GeoFilter)) return normalized as GeoFilter;
  return LEGACY_GEO_FILTER_LABELS[normalized] || "Alle";
}

export function resolveCompanyGeoAreas(input: CompanyGeoAreaInput): CompanyGeoResolution {
  const storedAreas = normalizeStoredGeoAreas(input.geo_areas);
  const inferredResolution = getGeoResolutionFromParts(getLocationParts(input));
  const inferredAreas = inferredResolution.areas.filter((area) => area !== "Ukjent sted");
  const storedKnownAreas = storedAreas.filter((area) => area !== "Ukjent sted");

  if (storedKnownAreas.length > 0) {
    const combined = GEO_FILTERS.filter(
      (filter): filter is Exclude<GeoFilter, "Alle"> =>
        filter !== "Alle" && (storedKnownAreas.includes(filter) || inferredAreas.includes(filter)),
    );

    return {
      areas: combined,
      source: input.geo_source === "manual" && inferredAreas.length === 0 ? "manual" : inferredAreas.length > 0 ? "hybrid" : "persisted",
      unresolvedPlaces: inferredAreas.length > 0 ? inferredResolution.unresolvedPlaces : [],
    };
  }

  if (storedAreas.includes("Ukjent sted") && inferredAreas.length === 0) {
    return {
      areas: ["Ukjent sted"],
      source: input.geo_source === "manual" ? "manual" : "persisted",
      unresolvedPlaces: inferredResolution.unresolvedPlaces,
    };
  }

  return inferredResolution;
}

export function getCompanyGeoAreas(input: CompanyGeoAreaInput): Exclude<GeoFilter, "Alle">[] {
  return resolveCompanyGeoAreas(input).areas;
}

export function getContactGeoAreas(input: ContactGeoAreaInput): Exclude<GeoFilter, "Alle">[] {
  const contactParts = getContactLocationParts(input);
  if (contactParts.length > 0) {
    const contactResolution = getGeoResolutionFromParts(contactParts);
    if (!contactResolution.areas.includes("Ukjent sted")) return contactResolution.areas;
  }
  return input.company ? getCompanyGeoAreas(input.company) : ["Ukjent sted"];
}

export function companyMatchesGeoFilter(input: CompanyGeoAreaInput, filter: GeoFilter | string) {
  const normalizedFilter = normalizeGeoFilter(filter);
  if (normalizedFilter === "Alle") return true;
  return getCompanyGeoAreas(input).includes(normalizedFilter);
}

export function contactMatchesGeoFilter(input: ContactGeoAreaInput, filter: GeoFilter | string) {
  const normalizedFilter = normalizeGeoFilter(filter);
  if (normalizedFilter === "Alle") return true;
  return getContactGeoAreas(input).includes(normalizedFilter);
}

export function getGeoFilterDescription(filter: GeoFilter | string) {
  const normalizedFilter = normalizeGeoFilter(filter);
  if (normalizedFilter === "Alle") return "Viser alle selskaper uavhengig av geografisk sted.";
  if (normalizedFilter === "Ukjent sted") return "Selskaper uten sted eller postnummer som kan plasseres i et definert område.";
  const definition = AREA_DEFINITIONS.find((area) => area.label === normalizedFilter);
  if (!definition) return "";
  return `${normalizedFilter} inkluderer ${definition.places.join(", ")}.`;
}
