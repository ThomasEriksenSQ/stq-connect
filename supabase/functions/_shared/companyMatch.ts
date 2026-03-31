const COMPANY_SUFFIX_PATTERN =
  /\b(as|asa|ab|ag|bv|gmbh|group|holding|holdings|ltd|limited|inc|llc|plc|oy|oyj|sa|sarl|the|norway|norge|no)\b/g;

function stripDiacritics(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function tokenizeCompanyName(name: string): string[] {
  return normalizeCompanyName(name)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function getCompanyMatchScore(a: string, b: string): number {
  const normalizedA = normalizeCompanyName(a);
  const normalizedB = normalizeCompanyName(b);
  if (!normalizedA || !normalizedB) return 0;
  if (normalizedA === normalizedB) return 100;

  const shorter = normalizedA.length <= normalizedB.length ? normalizedA : normalizedB;
  const longer = shorter === normalizedA ? normalizedB : normalizedA;
  if (shorter.length >= 5 && longer.includes(shorter)) return 86;

  const tokensA = tokenizeCompanyName(a);
  const tokensB = tokenizeCompanyName(b);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const sharedTokens = tokensA.filter((token) => tokensB.includes(token));
  if (sharedTokens.length === 0) return 0;

  const denominator = Math.max(tokensA.length, tokensB.length);
  if (sharedTokens.length === denominator) return 82;
  if (sharedTokens.length >= 2 && sharedTokens.length / denominator >= 0.66) return 74;
  if (sharedTokens.length === 1 && denominator === 1 && sharedTokens[0].length >= 6) return 72;
  return 0;
}

export function normalizeCompanyName(name: string): string {
  return stripDiacritics(name)
    .toLowerCase()
    .replace(COMPANY_SUFFIX_PATTERN, "")
    .replace(/[&/]/g, " ")
    .replace(/[.\-_,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function companiesMatch(a: string, b: string): boolean {
  return getCompanyMatchScore(a, b) >= 72;
}

type CompanyMatchCandidate = {
  name: string;
  aliases?: string[] | null;
};

function getCandidateNames(candidate: CompanyMatchCandidate): string[] {
  const names = [candidate.name, ...(candidate.aliases || [])]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return [...new Set(names)];
}

export function findBestCompanyMatch<T extends CompanyMatchCandidate>(
  companyName: string | null | undefined,
  companies: T[],
): T | null {
  if (!companyName) return null;

  let best: T | null = null;
  let bestScore = 0;

  companies.forEach((company) => {
    getCandidateNames(company).forEach((candidateName) => {
      const score = getCompanyMatchScore(companyName, candidateName);
      if (score > bestScore) {
        best = company;
        bestScore = score;
      }
    });
  });

  return bestScore >= 72 ? best : null;
}
