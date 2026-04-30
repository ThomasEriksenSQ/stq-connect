import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type WashAction = "preview" | "execute";
type GeoArea =
  | "Oslo+"
  | "Trondheim+"
  | "Kongsberg+"
  | "Stavanger+"
  | "Bergen+"
  | "Kristiansand+"
  | "Vestfold"
  | "Østfold"
  | "Vestlandet"
  | "Midt-Norge"
  | "Nord-Norge"
  | "Sørlandet"
  | "Ukjent sted";

type CompanyRow = {
  id: string;
  name: string | null;
  org_number: string | null;
  address: string | null;
  city: string | null;
  zip_code: string | null;
  industry: string | null;
  geo_areas: string[] | null;
  geo_source: string | null;
  geo_unresolved_places: string[] | null;
  brreg_status: string | null;
  brreg_synced_at: string | null;
  brreg_deleted_at: string | null;
  brreg_last_error: string | null;
};

type BrregEntity = {
  navn?: string;
  organisasjonsnummer?: string;
  slettedato?: string;
  konkurs?: boolean;
  underAvvikling?: boolean;
  underKonkursbehandling?: boolean;
  underTvangsavviklingEllerTvangsopplosning?: boolean;
  forretningsadresse?: {
    adresse?: string[];
    postnummer?: string;
    poststed?: string;
    kommune?: string;
  };
  naeringskode1?: {
    beskrivelse?: string;
  };
};

type RowResult = {
  id: string;
  name: string | null;
  org_number: string | null;
  status: string;
  brreg_deleted_at?: string | null;
  geo_areas?: GeoArea[];
  changes?: Record<string, { from: unknown; to: unknown }>;
  error?: string;
};

type Summary = {
  action: WashAction;
  scanned: number;
  updated: number;
  unchanged: number;
  missingOrg: number;
  invalidOrg: number;
  deleted: number;
  orgNumberReview: number;
  notFound: number;
  errors: number;
  unresolvedGeo: number;
  hasMore: boolean;
  nextOffset: number;
  rows: RowResult[];
  deletedRows: RowResult[];
};

const AREA_PLACE_KEYS: Array<{ area: GeoArea; places: string[] }> = [
  {
    area: "Oslo+",
    places: [
      "oslo",
      "baerum",
      "asker",
      "sandvika",
      "lysaker",
      "fornebu",
      "lillestrom",
      "strommen",
      "jessheim",
      "lorenskog",
      "nordre follo",
      "ski",
      "kolbotn",
      "trollasen",
      "greverud",
      "myrvoll",
      "fjellhamar",
      "lovenstad",
      "sorumsand",
      "aurskog",
      "frogner",
      "as",
      "vestby",
      "drobak",
      "nesodden",
      "nittedal",
      "romerike",
      "akershus",
      "eidsvoll",
      "hamar",
      "lillehammer",
      "gjovik",
      "raufoss",
      "brumunddal",
      "moelv",
      "otta",
      "ringebu",
      "elverum",
      "trysil",
      "kongsvinger",
      "innlandet",
    ],
  },
  {
    area: "Trondheim+",
    places: ["trondheim", "heimdal", "tiller", "ranheim", "stjordal", "hell", "malvik", "hommelvik", "vanvikan", "skaun", "borsa", "selbu", "melhus", "orkanger", "orkland", "trondelag"],
  },
  {
    area: "Kongsberg+",
    places: [
      "kongsberg",
      "notodden",
      "hokksund",
      "drammen",
      "lier",
      "lierstranda",
      "mjondalen",
      "sande",
      "svelvik",
      "holmestrand",
      "horten",
      "tonsberg",
      "honefoss",
      "nesbyen",
      "al",
      "geilo",
      "fla",
      "gol",
      "hemsedal",
      "lampeland",
      "buskerud",
      "ringerike",
      "viken",
    ],
  },
  {
    area: "Stavanger+",
    places: ["stavanger", "sandnes", "forus", "sola", "tananger", "randaberg", "bryne", "tau", "jorpeland", "strand", "hjelmeland", "hundvag", "finnoy", "rennesoy", "klepp", "jaeren", "rogaland"],
  },
  {
    area: "Bergen+",
    places: ["bergen", "fyllingsdalen", "kokstad", "sandviken", "asane", "nesttun", "bones", "godvik", "eidsvag", "soreidgrend", "blomsterdalen", "laksevag", "sotra", "askoy", "osoyro"],
  },
  {
    area: "Kristiansand+",
    places: ["kristiansand", "flekkeroy", "kongshavn", "grimstad", "arendal", "lillesand", "vennesla", "mandal", "lindesnes", "agder"],
  },
  {
    area: "Vestfold",
    places: [
      "vestfold",
      "tonsberg",
      "sandefjord",
      "larvik",
      "horten",
      "holmestrand",
      "revetal",
      "stokke",
      "notteroy",
      "faerder",
      "tjome",
      "barkaker",
      "sem",
      "vear",
      "asgardstrand",
      "borre",
      "skoppum",
      "torp",
      "tjolling",
      "sande",
      "svelvik",
      "drammen",
      "lier",
      "lierstranda",
      "vestfold og telemark",
    ],
  },
  {
    area: "Østfold",
    places: [
      "fredrikstad",
      "gamle fredrikstad",
      "krakeroy",
      "rolvsoy",
      "gressvik",
      "sellebakk",
      "sarpsborg",
      "moss",
      "rygge",
      "rade",
      "valer i ostfold",
      "halden",
      "mysen",
      "askim",
      "indre ostfold",
      "eidsberg",
      "rakkestad",
      "spydeberg",
      "tomter",
      "skiptvet",
      "viken",
      "ostfold",
    ],
  },
  {
    area: "Vestlandet",
    places: [
      "vestlandet",
      "bergen",
      "fyllingsdalen",
      "kokstad",
      "sandsli",
      "nesttun",
      "asane",
      "stavanger",
      "sandnes",
      "forus",
      "sola",
      "tananger",
      "randaberg",
      "bryne",
      "tau",
      "jorpeland",
      "haugesund",
      "kopervik",
      "akrehamn",
      "karmoy",
      "tysvaer",
      "nedre vats",
      "vats",
      "olen",
      "stord",
      "forde",
      "sogndal",
      "bremanger",
      "alesund",
      "molde",
      "kristiansund",
      "hordaland",
      "rogaland",
      "møre og romsdal",
      "more og romsdal",
    ],
  },
  {
    area: "Midt-Norge",
    places: [
      "midt norge",
      "midtnorge",
      "trondheim",
      "stjordal",
      "orkanger",
      "orkland",
      "steinkjer",
      "levanger",
      "verdal",
      "namsos",
      "rindal",
      "trondelag",
    ],
  },
  {
    area: "Nord-Norge",
    places: ["nord norge", "nordnorge", "bodo", "tromso", "harstad", "narvik", "alta", "andenes", "andoya", "andoy", "mo i rana", "finnmark", "nordland", "troms"],
  },
  {
    area: "Sørlandet",
    places: [
      "sorlandet",
      "kristiansand",
      "vennesla",
      "sogne",
      "songdalen",
      "birkeland",
      "lillesand",
      "iveland",
      "kjevik",
      "hanes",
      "flekkeroy",
      "kongshavn",
      "grimstad",
      "arendal",
      "mandal",
      "lindesnes",
      "flekkefjord",
      "farsund",
      "lyngdal",
      "risor",
      "tvedestrand",
      "evje",
      "porsgrunn",
      "skien",
      "bo",
      "seljord",
      "nome",
      "telemark",
      "vestfold og telemark",
      "agder",
    ],
  },
];

const VALID_GEO_AREAS = new Set<GeoArea>(AREA_PLACE_KEYS.map((entry) => entry.area).concat("Ukjent sted"));
const GEO_AREA_ORDER: GeoArea[] = AREA_PLACE_KEYS.map((entry) => entry.area);

type GeoPart = {
  value: string;
  source: "city" | "address" | "postal";
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeGeoText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function splitLocationText(value: unknown): string[] {
  return String(value || "")
    .split(/[,;\n/]+|\s+\bog\b\s+/gi)
    .map((part) => part.trim())
    .filter(Boolean);
}

function uniqueLocationValues(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  values.flatMap(splitLocationText).forEach((value) => {
    const key = normalizeGeoText(value);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(value.trim());
  });
  return result;
}

function mergeLocationText(...values: unknown[]) {
  const locations = uniqueLocationValues(values);
  return locations.length > 0 ? locations.join(", ") : null;
}

function cleanOrgNumber(value: unknown) {
  return String(value || "")
    .replace(/^NO/i, "")
    .replace(/MVA$/i, "")
    .replace(/\D/g, "");
}

function findPostalCode(value: unknown) {
  const match = String(value || "").match(/\b(\d{4})\b/);
  return match?.[1] || null;
}

function geoAreasFromPostalCode(postalCode: string | null): GeoArea[] {
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

function normalizeStoredGeoAreas(values: string[] | null | undefined): GeoArea[] {
  const seen = new Set<GeoArea>();
  (values || []).forEach((value) => {
    if (VALID_GEO_AREAS.has(value as GeoArea)) seen.add(value as GeoArea);
  });
  return [...seen];
}

function uniqueGeoParts(parts: GeoPart[]): GeoPart[] {
  const seen = new Set<string>();
  const result: GeoPart[] = [];
  parts.forEach((part) => {
    const value = part.value.trim();
    const key = `${part.source}:${normalizeGeoText(value)}`;
    if (!value || seen.has(key)) return;
    seen.add(key);
    result.push({ ...part, value });
  });
  return result;
}

function resolveGeo(input: {
  city?: string | null;
  address?: string | null;
  zip_code?: string | null;
  existingAreas?: string[] | null;
  existingSource?: string | null;
}) {
  const manualAreas = normalizeStoredGeoAreas(input.existingSource === "manual" ? input.existingAreas : null);
  const manualKnownAreas = manualAreas.filter((area) => area !== "Ukjent sted");

  const parts = uniqueGeoParts([
    ...splitLocationText(input.city).map((value) => ({ value, source: "city" as const })),
    ...splitLocationText(input.address).map((value) => ({ value, source: "address" as const })),
    ...(String(input.zip_code || "").trim() ? [{ value: String(input.zip_code || "").trim(), source: "postal" as const }] : []),
  ]);
  const matched = new Set<GeoArea>();
  const sourceMatches = new Set<"postal" | "place">();
  const unresolvedPlaces = new Map<string, string>();

  parts.forEach((part) => {
    const postalAreas = geoAreasFromPostalCode(findPostalCode(part.value));
    let matchedPart = false;
    if (postalAreas.length > 0) {
      postalAreas.forEach((area) => matched.add(area));
      sourceMatches.add("postal");
      matchedPart = true;
    }

    const normalizedPart = normalizeGeoText(part.value);
    AREA_PLACE_KEYS.forEach((entry) => {
      if (entry.places.some((place) => {
        const normalizedPlace = normalizeGeoText(place);
        return normalizedPart === normalizedPlace ||
          normalizedPart.includes(` ${normalizedPlace} `) ||
          normalizedPart.startsWith(`${normalizedPlace} `) ||
          normalizedPart.endsWith(` ${normalizedPlace}`);
      })) {
        matched.add(entry.area);
        sourceMatches.add("place");
        matchedPart = true;
      }
    });

    if (!matchedPart && part.source === "city") {
      unresolvedPlaces.set(normalizeGeoText(part.value), part.value);
    }
  });

  if (matched.size > 0) {
    const areas = GEO_AREA_ORDER.filter((area) => matched.has(area) || manualKnownAreas.includes(area));
    const source = sourceMatches.size > 1 || manualKnownAreas.length > 0 ? "brreg_hybrid" : sourceMatches.has("postal") ? "brreg_postal" : "brreg_place";
    return { areas, source, unresolvedPlaces: [...unresolvedPlaces.values()] };
  }

  if (manualKnownAreas.length > 0) {
    return { areas: manualKnownAreas, source: "manual", unresolvedPlaces: [] as string[] };
  }

  if (manualAreas.includes("Ukjent sted")) {
    return { areas: ["Ukjent sted" as GeoArea], source: "manual", unresolvedPlaces: [...unresolvedPlaces.values()] };
  }

  return { areas: ["Ukjent sted" as GeoArea], source: "unknown", unresolvedPlaces: [...unresolvedPlaces.values()] };
}

function brregStatus(entity: BrregEntity) {
  if (entity.slettedato) return "org_number_needs_review";
  if (entity.konkurs || entity.underKonkursbehandling) return "bankrupt";
  if (entity.underAvvikling || entity.underTvangsavviklingEllerTvangsopplosning) return "winding_up";
  return "active";
}

function getBrregFields(entity: BrregEntity) {
  const address = entity.forretningsadresse?.adresse?.filter(Boolean).join(", ") || null;
  const city = entity.forretningsadresse?.poststed || entity.forretningsadresse?.kommune || null;
  return {
    name: entity.navn || null,
    org_number: entity.organisasjonsnummer || null,
    address,
    city,
    zip_code: entity.forretningsadresse?.postnummer || null,
    industry: entity.naeringskode1?.beskrivelse || null,
  };
}

function valuesEqual(left: unknown, right: unknown) {
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(left || []) === JSON.stringify(right || []);
  }
  return (left ?? null) === (right ?? null);
}

function buildChanges(company: CompanyRow, updates: Record<string, unknown>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  Object.entries(updates).forEach(([key, value]) => {
    if (!valuesEqual((company as unknown as Record<string, unknown>)[key], value)) {
      changes[key] = { from: (company as unknown as Record<string, unknown>)[key] ?? null, to: value ?? null };
    }
  });
  return changes;
}

async function fetchBrregEntity(orgNumber: string): Promise<{ type: "ok"; entity: BrregEntity } | { type: "not_found" }> {
  const response = await fetch(`https://data.brreg.no/enhetsregisteret/api/enheter/${orgNumber}`, {
    headers: { Accept: "application/json", "User-Agent": "stq-connect-brreg-company-wash/1.0" },
  });
  if (response.status === 404 || response.status === 410) return { type: "not_found" };
  if (!response.ok) throw new Error(`BRREG svarte ${response.status}`);
  return { type: "ok", entity: await response.json() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims?.sub) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await anonClient.rpc("has_role", {
      _user_id: claimsData.claims.sub,
      _role: "admin",
    });
    if (!isAdmin) return jsonResponse({ error: "Forbidden: admin role required" }, 403);

    const body = await req.json().catch(() => ({}));
    const action: WashAction = body?.action === "execute" ? "execute" : "preview";
    const limit = Math.min(Math.max(Number(body?.limit) || 100, 1), 250);
    const offset = Math.max(Number(body?.offset) || 0, 0);
    const now = new Date().toISOString();

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: companies, error, count } = await supabase
      .from("companies")
      .select(
        "id, name, org_number, address, city, zip_code, industry, geo_areas, geo_source, geo_unresolved_places, brreg_status, brreg_synced_at, brreg_deleted_at, brreg_last_error",
        { count: "exact" },
      )
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const summary: Summary = {
      action,
      scanned: companies?.length || 0,
      updated: 0,
      unchanged: 0,
      missingOrg: 0,
      invalidOrg: 0,
      deleted: 0,
      orgNumberReview: 0,
      notFound: 0,
      errors: 0,
      unresolvedGeo: 0,
      hasMore: count ? offset + (companies?.length || 0) < count : (companies?.length || 0) === limit,
      nextOffset: offset + (companies?.length || 0),
      rows: [],
      deletedRows: [],
    };

    for (const company of (companies || []) as CompanyRow[]) {
      const orgNumber = cleanOrgNumber(company.org_number);
      try {
        if (!orgNumber) {
          summary.missingOrg++;
          const geo = resolveGeo({
            city: company.city,
            address: company.address,
            zip_code: company.zip_code,
            existingAreas: company.geo_areas,
            existingSource: company.geo_source,
          });
          if (geo.areas.includes("Ukjent sted")) summary.unresolvedGeo++;

          const updates = {
            geo_areas: geo.areas,
            geo_source: geo.source,
            geo_unresolved_places: geo.unresolvedPlaces,
            geo_updated_at: now,
            brreg_status: "missing_org",
            brreg_synced_at: now,
            brreg_last_error: "Mangler organisasjonsnummer",
          };
          const changes = buildChanges(company, updates);
          if (Object.keys(changes).length > 0) {
            summary.updated++;
            if (action === "execute") await supabase.from("companies").update(updates).eq("id", company.id);
          } else {
            summary.unchanged++;
          }
          if (summary.rows.length < 50) {
            summary.rows.push({ id: company.id, name: company.name, org_number: null, status: "missing_org", geo_areas: geo.areas, changes });
          }
          continue;
        }

        if (!/^\d{9}$/.test(orgNumber)) {
          summary.invalidOrg++;
          const updates = { brreg_status: "invalid_org", brreg_synced_at: now, brreg_last_error: "Ugyldig organisasjonsnummer" };
          const changes = buildChanges(company, updates);
          if (Object.keys(changes).length > 0) {
            summary.updated++;
            if (action === "execute") await supabase.from("companies").update(updates).eq("id", company.id);
          } else {
            summary.unchanged++;
          }
          if (summary.rows.length < 50) {
            summary.rows.push({ id: company.id, name: company.name, org_number: company.org_number, status: "invalid_org", changes });
          }
          continue;
        }

        const brreg = await fetchBrregEntity(orgNumber);
        if (brreg.type === "not_found") {
          summary.notFound++;
          const updates = {
            org_number: orgNumber,
            brreg_status: "not_found",
            brreg_synced_at: now,
            brreg_last_error: "Fant ikke organisasjonsnummer i BRREG",
          };
          const changes = buildChanges(company, updates);
          if (Object.keys(changes).length > 0) {
            summary.updated++;
            if (action === "execute") await supabase.from("companies").update(updates).eq("id", company.id);
          } else {
            summary.unchanged++;
          }
          if (summary.rows.length < 50) {
            summary.rows.push({ id: company.id, name: company.name, org_number: orgNumber, status: "not_found", changes });
          }
          continue;
        }

        const fields = getBrregFields(brreg.entity);
        const status = brregStatus(brreg.entity);
        const orgNumberNeedsReview = status === "org_number_needs_review";
        if (orgNumberNeedsReview) {
          summary.deleted++;
          summary.orgNumberReview++;
        }

        const nextAddress = orgNumberNeedsReview ? company.address : fields.address || company.address;
        const nextCity = orgNumberNeedsReview ? company.city : mergeLocationText(company.city, fields.city);
        const nextZipCode = orgNumberNeedsReview ? company.zip_code : fields.zip_code || company.zip_code;
        const geo = resolveGeo({
          city: nextCity,
          address: nextAddress,
          zip_code: nextZipCode,
          existingAreas: company.geo_areas,
          existingSource: company.geo_source,
        });
        if (geo.areas.includes("Ukjent sted")) summary.unresolvedGeo++;

        const updates = orgNumberNeedsReview
          ? {
              org_number: orgNumber,
              geo_areas: geo.areas,
              geo_source: geo.source,
              geo_unresolved_places: geo.unresolvedPlaces,
              geo_updated_at: now,
              brreg_status: status,
              brreg_synced_at: now,
              brreg_deleted_at: null,
              brreg_last_error: `Org.nr ${orgNumber} er slettet i BRREG (${brreg.entity.slettedato}). Avklar korrekt org.nr manuelt.`,
            }
          : {
              name: fields.name || company.name,
              org_number: fields.org_number || orgNumber,
              address: nextAddress,
              city: nextCity,
              zip_code: nextZipCode,
              industry: fields.industry || company.industry,
              geo_areas: geo.areas,
              geo_source: geo.source,
              geo_unresolved_places: geo.unresolvedPlaces,
              geo_updated_at: now,
              brreg_status: status,
              brreg_synced_at: now,
              brreg_deleted_at: null,
              brreg_last_error: null,
            };
        const changes = buildChanges(company, updates);
        if (Object.keys(changes).length > 0) {
          summary.updated++;
          if (action === "execute") await supabase.from("companies").update(updates).eq("id", company.id);
        } else {
          summary.unchanged++;
        }
        const rowResult = {
          id: company.id,
          name: company.name,
          org_number: orgNumber,
          status,
          brreg_deleted_at: brreg.entity.slettedato || null,
          geo_areas: geo.areas,
          changes,
        };
        if (orgNumberNeedsReview && summary.deletedRows.length < 100) summary.deletedRows.push(rowResult);
        if (summary.rows.length < 50) summary.rows.push(rowResult);

        await new Promise((resolve) => setTimeout(resolve, 60));
      } catch (err) {
        summary.errors++;
        const message = err instanceof Error ? err.message : "Ukjent feil";
        if (action === "execute") {
          await supabase
            .from("companies")
            .update({ brreg_status: "error", brreg_synced_at: now, brreg_last_error: message })
            .eq("id", company.id);
        }
        if (summary.rows.length < 50) {
          summary.rows.push({ id: company.id, name: company.name, org_number: company.org_number, status: "error", error: message });
        }
      }
    }

    return jsonResponse(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ukjent feil";
    return jsonResponse({ error: message }, 500);
  }
});
