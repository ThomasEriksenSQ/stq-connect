import { normalizeCandidateText } from "./candidateIdentity.ts";

export type SentCvEmployeeCandidate = {
  id: number | string;
  navn?: string | null;
  heroName?: string | null;
};

export type SentCvAttachmentMatch = {
  employeeId: number | string;
  attachmentName: string;
  score: number;
  matchedBy: "attachment-name" | "message-context";
};

type PreparedEmployeeCandidate = {
  id: number | string;
  names: string[];
};

const DEFAULT_INTERNAL_DOMAINS = ["stacq.no"];

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

function normalizeAttachmentNameForClassification(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeName(value: string) {
  return normalizeCandidateText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function buildPreparedEmployeeCandidates(employees: SentCvEmployeeCandidate[]): PreparedEmployeeCandidate[] {
  return employees.map((employee) => ({
    id: employee.id,
    names: uniqueStrings([employee.navn, employee.heroName]).sort((left, right) => right.length - left.length),
  }));
}

function scoreNameMatch(haystack: string, candidateName: string) {
  const normalizedName = normalizeCandidateText(candidateName);
  if (!normalizedName) return 0;
  if (haystack.includes(normalizedName)) return normalizedName.split(" ").length >= 2 ? 120 : 90;

  const nameTokens = tokenizeName(candidateName);
  if (nameTokens.length < 2) return 0;

  const matchedTokens = nameTokens.filter((token) => haystack.includes(token));
  if (matchedTokens.length === nameTokens.length) {
    return 95;
  }

  if (matchedTokens.length >= Math.max(2, nameTokens.length - 1)) {
    return 72;
  }

  return 0;
}

function chooseBestEmployeeMatch(haystack: string, employees: PreparedEmployeeCandidate[]) {
  let best: { employeeId: number | string; score: number } | null = null;
  let runnerUp = 0;

  employees.forEach((employee) => {
    const score = employee.names.reduce((maxScore, name) => Math.max(maxScore, scoreNameMatch(haystack, name)), 0);
    if (score <= 0) return;

    if (!best || score > best.score) {
      runnerUp = best?.score ?? 0;
      best = { employeeId: employee.id, score };
      return;
    }

    if (score > runnerUp) {
      runnerUp = score;
    }
  });

  if (!best) return null;
  if (best.score >= 95) return best;
  if (best.score >= 72 && best.score - runnerUp >= 15) return best;
  return null;
}

export function normalizeEmailAddress(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export function isExternalEmailAddress(
  email: string | null | undefined,
  internalDomains: string[] = DEFAULT_INTERNAL_DOMAINS,
) {
  const normalizedEmail = normalizeEmailAddress(email);
  if (!normalizedEmail.includes("@")) return false;

  const domain = normalizedEmail.split("@").pop() || "";
  const normalizedInternalDomains = internalDomains.map((item) => item.trim().toLowerCase()).filter(Boolean);
  return !normalizedInternalDomains.some((internalDomain) => domain === internalDomain || domain.endsWith(`.${internalDomain}`));
}

export function getExternalRecipientEmails(
  recipients: Array<string | null | undefined>,
  internalDomains: string[] = DEFAULT_INTERNAL_DOMAINS,
) {
  return Array.from(
    new Set(
      recipients
        .map((recipient) => normalizeEmailAddress(recipient))
        .filter((recipient) => isExternalEmailAddress(recipient, internalDomains)),
    ),
  );
}

export function isLikelySentCvAttachmentName(attachmentName: string | null | undefined) {
  const normalized = normalizeAttachmentNameForClassification(attachmentName || "");
  if (!normalized) return false;
  if (normalized.includes("ssa b")) return false;
  return true;
}

export function matchSentCvEmployees(params: {
  attachmentNames: string[];
  subject?: string | null;
  bodyPreview?: string | null;
  employees: SentCvEmployeeCandidate[];
}) {
  const attachmentNames = params.attachmentNames
    .map((name) => String(name || "").trim())
    .filter((name) => isLikelySentCvAttachmentName(name));

  if (attachmentNames.length === 0 || params.employees.length === 0) return [] satisfies SentCvAttachmentMatch[];

  const preparedEmployees = buildPreparedEmployeeCandidates(params.employees);
  const matches: SentCvAttachmentMatch[] = [];
  const usedEmployeeIds = new Set<number | string>();

  attachmentNames.forEach((attachmentName) => {
    const match = chooseBestEmployeeMatch(normalizeCandidateText(attachmentName), preparedEmployees);
    if (!match || usedEmployeeIds.has(match.employeeId)) return;

    usedEmployeeIds.add(match.employeeId);
    matches.push({
      employeeId: match.employeeId,
      attachmentName,
      score: match.score,
      matchedBy: "attachment-name",
    });
  });

  if (matches.length > 0 || attachmentNames.length !== 1) return matches;

  const contextHaystack = normalizeCandidateText([params.subject, params.bodyPreview].filter(Boolean).join(" "));
  if (!contextHaystack) return matches;

  const fallbackMatch = chooseBestEmployeeMatch(contextHaystack, preparedEmployees);
  if (!fallbackMatch) return matches;

  return [
    {
      employeeId: fallbackMatch.employeeId,
      attachmentName: attachmentNames[0],
      score: fallbackMatch.score,
      matchedBy: "message-context",
    },
  ];
}
