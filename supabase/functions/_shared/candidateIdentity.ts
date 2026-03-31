export type ExternalConsultantIdentity = {
  id: string;
  navn?: string | null;
  epost?: string | null;
  telefon?: string | null;
  rolle?: string | null;
  selskap_tekst?: string | null;
  cv_tekst?: string | null;
  teknologier?: string[] | null;
  status?: string | null;
  type?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type EmployeeIdentity = {
  id: number | string;
  navn?: string | null;
  epost?: string | null;
  tlf?: string | null;
  bio?: string | null;
  kompetanse?: string[] | null;
  geografi?: string | null;
  updated_at?: string | null;
};

export type CleanupSummary = {
  total_external: number;
  matched_to_ansatte: number;
  merged_duplicate_groups: number;
  deleted_external_ids: number;
  skipped_referenced: number;
  kept_external: number;
};

type EmployeeMatch = {
  employeeId: number | string;
  score: number;
  reasons: string[];
};

const CHARACTER_REPLACEMENTS: Record<string, string> = {
  ae: "ae",
  oe: "oe",
  aa: "aa",
  æ: "ae",
  ø: "oe",
  å: "aa",
};

function replaceNordicCharacters(value: string): string {
  return value.replace(/[æøå]/gi, (char) => CHARACTER_REPLACEMENTS[char.toLowerCase()] || char);
}

export function normalizeCandidateText(value: string | null | undefined): string {
  return replaceNordicCharacters(String(value || ""))
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeCandidateName(value: string | null | undefined): string {
  return normalizeCandidateText(value);
}

export function normalizeCandidateEmail(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

export function normalizeCandidatePhone(value: string | null | undefined): string {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length > 8 ? digits.slice(-8) : digits;
}

function toTokenSet(value: string | null | undefined): Set<string> {
  return new Set(normalizeCandidateText(value).split(" ").filter(Boolean));
}

function tokenJaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;

  let intersection = 0;
  left.forEach((token) => {
    if (right.has(token)) intersection += 1;
  });

  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

function technologyOverlap(left: string[] | null | undefined, right: string[] | null | undefined): number {
  const leftSet = new Set((left || []).map((item) => normalizeCandidateText(item)).filter(Boolean));
  const rightSet = new Set((right || []).map((item) => normalizeCandidateText(item)).filter(Boolean));
  if (leftSet.size === 0 || rightSet.size === 0) return 0;

  let matches = 0;
  leftSet.forEach((token) => {
    if (rightSet.has(token)) matches += 1;
  });
  return matches;
}

function contentRichness(value: string | null | undefined): number {
  return Math.min(normalizeCandidateText(value).length, 1200);
}

export function scoreExternalConsultantQuality(candidate: ExternalConsultantIdentity): number {
  let score = 0;
  if (normalizeCandidateEmail(candidate.epost)) score += 30;
  if (normalizeCandidatePhone(candidate.telefon)) score += 25;
  if (normalizeCandidateText(candidate.rolle)) score += 15;
  if (normalizeCandidateText(candidate.selskap_tekst)) score += 10;
  score += Math.min((candidate.teknologier || []).length * 6, 36);
  score += Math.round(contentRichness(candidate.cv_tekst) / 50);
  if ((candidate.status || "").toLowerCase() === "ledig") score += 4;
  if ((candidate.type || "").toLowerCase() === "freelance") score += 2;
  return score;
}

export function matchExternalToEmployee(
  candidate: ExternalConsultantIdentity,
  employees: EmployeeIdentity[],
): EmployeeMatch | null {
  const candidateName = normalizeCandidateName(candidate.navn);
  const candidateEmail = normalizeCandidateEmail(candidate.epost);
  const candidatePhone = normalizeCandidatePhone(candidate.telefon);
  const employeeNameCounts = new Map<string, number>();

  employees.forEach((employee) => {
    const normalizedName = normalizeCandidateName(employee.navn);
    if (!normalizedName) return;
    employeeNameCounts.set(normalizedName, (employeeNameCounts.get(normalizedName) || 0) + 1);
  });

  let bestMatch: EmployeeMatch | null = null;

  employees.forEach((employee) => {
    const reasons: string[] = [];
    let score = 0;

    const employeeName = normalizeCandidateName(employee.navn);
    const employeeEmail = normalizeCandidateEmail(employee.epost);
    const employeePhone = normalizeCandidatePhone(employee.tlf);

    if (candidateEmail && employeeEmail && candidateEmail === employeeEmail) {
      score += 100;
      reasons.push("email");
    }

    if (candidatePhone && employeePhone && candidatePhone === employeePhone) {
      score += 90;
      reasons.push("phone");
    }

    if (candidateName && employeeName && candidateName === employeeName) {
      score += employeeNameCounts.get(employeeName) === 1 ? 80 : 60;
      reasons.push("name");
    } else {
      const nameSimilarity = tokenJaccard(toTokenSet(candidate.navn), toTokenSet(employee.navn));
      if (nameSimilarity >= 1) {
        score += 60;
        reasons.push("name");
      } else if (nameSimilarity >= 0.85) {
        score += 40;
        reasons.push("name-fuzzy");
      }
    }

    const sharedTechnologies = technologyOverlap(candidate.teknologier, employee.kompetanse);
    if (sharedTechnologies >= 3) {
      score += 20;
      reasons.push("tech");
    } else if (sharedTechnologies >= 1) {
      score += 10;
      reasons.push("tech");
    }

    const roleVsBio = tokenJaccard(toTokenSet(candidate.rolle), toTokenSet(employee.bio));
    if (roleVsBio >= 0.5) {
      score += 10;
      reasons.push("role-bio");
    }

    if (score >= 80 || reasons.includes("email") || reasons.includes("phone")) {
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          employeeId: employee.id,
          score,
          reasons,
        };
      }
    }
  });

  return bestMatch;
}

export function areLikelyExternalDuplicates(
  left: ExternalConsultantIdentity,
  right: ExternalConsultantIdentity,
): boolean {
  if (left.id === right.id) return false;

  const leftEmail = normalizeCandidateEmail(left.epost);
  const rightEmail = normalizeCandidateEmail(right.epost);
  if (leftEmail && rightEmail && leftEmail === rightEmail) return true;

  const leftPhone = normalizeCandidatePhone(left.telefon);
  const rightPhone = normalizeCandidatePhone(right.telefon);
  if (leftPhone && rightPhone && leftPhone === rightPhone) return true;

  const leftName = normalizeCandidateName(left.navn);
  const rightName = normalizeCandidateName(right.navn);
  if (!leftName || !rightName) return false;

  if (leftName !== rightName) {
    const fuzzyNameSimilarity = tokenJaccard(toTokenSet(left.navn), toTokenSet(right.navn));
    if (fuzzyNameSimilarity < 0.95) return false;
  }

  const roleSimilarity = tokenJaccard(toTokenSet(left.rolle), toTokenSet(right.rolle));
  const companySimilarity = tokenJaccard(toTokenSet(left.selskap_tekst), toTokenSet(right.selskap_tekst));
  const cvSimilarity = tokenJaccard(toTokenSet(left.cv_tekst), toTokenSet(right.cv_tekst));
  const sharedTechnologies = technologyOverlap(left.teknologier, right.teknologier);

  if (roleSimilarity >= 0.8) return true;
  if (companySimilarity >= 0.8 && companySimilarity > 0) return true;
  if (cvSimilarity >= 0.85) return true;
  if (sharedTechnologies >= 1) return true;

  const sparseLeft = scoreExternalConsultantQuality(left) <= 25;
  const sparseRight = scoreExternalConsultantQuality(right) <= 25;
  const missingContextLeft =
    !normalizeCandidateText(left.rolle) &&
    !normalizeCandidateText(left.selskap_tekst) &&
    !normalizeCandidateText(left.cv_tekst) &&
    (left.teknologier || []).length === 0;
  const missingContextRight =
    !normalizeCandidateText(right.rolle) &&
    !normalizeCandidateText(right.selskap_tekst) &&
    !normalizeCandidateText(right.cv_tekst) &&
    (right.teknologier || []).length === 0;

  return (sparseLeft || sparseRight) && (missingContextLeft || missingContextRight);
}

export function pickPrimaryExternalConsultant(candidates: ExternalConsultantIdentity[]): ExternalConsultantIdentity {
  return [...candidates].sort((left, right) => {
    const qualityDelta = scoreExternalConsultantQuality(right) - scoreExternalConsultantQuality(left);
    if (qualityDelta !== 0) return qualityDelta;

    const updatedDelta = String(right.updated_at || "").localeCompare(String(left.updated_at || ""));
    if (updatedDelta !== 0) return updatedDelta;

    return String(right.created_at || "").localeCompare(String(left.created_at || ""));
  })[0];
}

export function buildExternalDuplicateGroups(candidates: ExternalConsultantIdentity[]): ExternalConsultantIdentity[][] {
  const parent = new Map<string, string>();

  const find = (id: string): string => {
    const current = parent.get(id) || id;
    if (current === id) return current;
    const root = find(current);
    parent.set(id, root);
    return root;
  };

  const union = (leftId: string, rightId: string) => {
    const leftRoot = find(leftId);
    const rightRoot = find(rightId);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  };

  const buckets = new Map<string, ExternalConsultantIdentity[]>();

  candidates.forEach((candidate) => {
    [normalizeCandidateName(candidate.navn), normalizeCandidateEmail(candidate.epost), normalizeCandidatePhone(candidate.telefon)]
      .filter(Boolean)
      .forEach((key) => {
        const existing = buckets.get(key) || [];
        existing.push(candidate);
        buckets.set(key, existing);
      });
  });

  buckets.forEach((bucket) => {
    if (bucket.length < 2) return;
    for (let index = 0; index < bucket.length; index += 1) {
      for (let compareIndex = index + 1; compareIndex < bucket.length; compareIndex += 1) {
        if (areLikelyExternalDuplicates(bucket[index], bucket[compareIndex])) {
          union(bucket[index].id, bucket[compareIndex].id);
        }
      }
    }
  });

  const grouped = new Map<string, ExternalConsultantIdentity[]>();
  candidates.forEach((candidate) => {
    const root = find(candidate.id);
    const existing = grouped.get(root) || [];
    existing.push(candidate);
    grouped.set(root, existing);
  });

  return [...grouped.values()].filter((group) => group.length > 1);
}

export function formatCleanupSummary(summary: CleanupSummary): string {
  return [
    `${summary.deleted_external_ids} slettet`,
    `${summary.matched_to_ansatte} ansatte-treff`,
    `${summary.merged_duplicate_groups} duplikatgrupper`,
    `${summary.skipped_referenced} hoppet over`,
  ].join(" · ");
}
