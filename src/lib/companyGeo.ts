import { getGeoCandidates, normalizeGeoText } from "@/lib/geographicMatch";

export type CompanyGeoInput = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  zip_code?: string | null;
  status?: string | null;
};

export type CompanyGeoPoint = {
  companyId: string;
  companyName: string;
  status: string;
  coord: [number, number];
  coordKey: string;
  locationLabel: string;
};

export type CompanyGeoCluster = {
  key: string;
  coord: [number, number];
  locationLabel: string;
  companies: CompanyGeoPoint[];
};

export type CompanyGeoSummary = {
  points: CompanyGeoPoint[];
  clusters: CompanyGeoCluster[];
  missingCompanies: CompanyGeoInput[];
};

function splitLocationValue(value: string | null | undefined) {
  return String(value || "")
    .split(/[,;\n/]+|\s+\bog\b\s+/gi)
    .map((part) => part.trim())
    .filter(Boolean);
}

function cleanLocationLabel(value: string | null | undefined) {
  const cleaned = String(value || "")
    .replace(/\b\d{4}\b/g, "")
    .replace(/\b(norge|norway)\b/gi, "")
    .replace(/^[,\s-]+|[,\s-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

function candidateLabelScore(raw: string, label: string) {
  let score = raw.length;
  if (/[,;\n/]/.test(raw)) score += 60;
  if (/\d/.test(raw)) score += 16;
  if (normalizeGeoText(raw) === normalizeGeoText(label)) score -= 12;
  return score;
}

function coordKey(coord: [number, number]) {
  return `${coord[0].toFixed(4)},${coord[1].toFixed(4)}`;
}

function mostCommonLocationLabel(points: CompanyGeoPoint[]) {
  const counts = new Map<string, number>();
  points.forEach((point) => {
    counts.set(point.locationLabel, (counts.get(point.locationLabel) || 0) + 1);
  });
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "nb"))[0]?.[0] || "Ukjent sted";
}

export function buildCompanyGeoSummary(companies: CompanyGeoInput[]): CompanyGeoSummary {
  const points: CompanyGeoPoint[] = [];
  const missingCompanies: CompanyGeoInput[] = [];

  companies.forEach((company) => {
    const candidates = getGeoCandidates({
      address: company.address,
      postalCode: company.zip_code,
      city: company.city,
      locations: splitLocationValue(company.city),
    }).filter((candidate) => candidate.coord);

    const bestByCoord = new Map<string, { point: CompanyGeoPoint; score: number }>();

    candidates.forEach((candidate) => {
      if (!candidate.coord) return;
      const key = coordKey(candidate.coord);
      const label = cleanLocationLabel(candidate.raw) || candidate.city || candidate.postalCode || "Ukjent sted";
      const score = candidateLabelScore(candidate.raw, label);
      const point: CompanyGeoPoint = {
        companyId: company.id,
        companyName: company.name,
        status: company.status || "",
        coord: candidate.coord,
        coordKey: key,
        locationLabel: label,
      };
      const current = bestByCoord.get(key);
      if (!current || score < current.score) bestByCoord.set(key, { point, score });
    });

    if (bestByCoord.size === 0) {
      missingCompanies.push(company);
      return;
    }

    bestByCoord.forEach(({ point }) => points.push(point));
  });

  const clustersByCoord = new Map<string, CompanyGeoPoint[]>();
  points.forEach((point) => {
    const existing = clustersByCoord.get(point.coordKey) || [];
    existing.push(point);
    clustersByCoord.set(point.coordKey, existing);
  });

  const clusters = [...clustersByCoord.entries()]
    .map(([key, clusterPoints]) => ({
      key,
      coord: clusterPoints[0].coord,
      locationLabel: mostCommonLocationLabel(clusterPoints),
      companies: clusterPoints.sort((left, right) => left.companyName.localeCompare(right.companyName, "nb")),
    }))
    .sort(
      (left, right) =>
        right.companies.length - left.companies.length ||
        left.locationLabel.localeCompare(right.locationLabel, "nb"),
    );

  return { points, clusters, missingCompanies };
}

