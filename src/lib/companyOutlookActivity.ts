import { normalizeOutlookMailItems } from "@/lib/outlookMail";

const OUTLOOK_LOOKUP_CONCURRENCY = 4;

type OutlookSupabaseClientLike = {
  functions: {
    invoke: (name: string, options?: { body?: unknown }) => Promise<{ data: any; error: any }>;
  };
};

type CompanyOutlookCandidate = {
  id: string;
  activityCount?: number | null;
  taskCount?: number | null;
  contactCount?: number | null;
  contacts?: Array<{ email?: string | null }> | null;
};

type EmailLookupRef = {
  companyId: string;
  email: string;
};

export type CompanyOutlookActivityMap = Record<string, string>;

const isValidDateString = (value: string | null | undefined) => {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
};

const isLater = (candidate: string, current: string | undefined) => {
  if (!current) return true;
  return new Date(candidate).getTime() > new Date(current).getTime();
};

const getContactEmails = (company: CompanyOutlookCandidate) =>
  Array.from(
    new Set(
      (company.contacts || [])
        .map((contact) => (contact.email || "").trim().toLowerCase())
        .filter(Boolean),
    ),
  );

export const getCompanyOutlookActivityCandidates = (companies: CompanyOutlookCandidate[]) =>
  companies.filter((company) => {
    const contactCount = company.contactCount ?? company.contacts?.length ?? 0;
    if (contactCount === 0) return false;
    if ((company.activityCount || 0) > 0 || (company.taskCount || 0) > 0) return false;
    return getContactEmails(company).length > 0;
  });

export const getCompanyOutlookActivityLookupKey = (companies: CompanyOutlookCandidate[]) =>
  getCompanyOutlookActivityCandidates(companies)
    .map((company) => `${company.id}:${getContactEmails(company).join(",")}`)
    .join("|");

async function runWithConcurrency<T>(items: T[], worker: (item: T) => Promise<void>) {
  let index = 0;
  const runners = Array.from({ length: Math.min(OUTLOOK_LOOKUP_CONCURRENCY, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

export async function fetchCompanyOutlookActivityMap(
  supabase: OutlookSupabaseClientLike,
  companies: CompanyOutlookCandidate[],
): Promise<CompanyOutlookActivityMap> {
  const refs: EmailLookupRef[] = [];
  const seen = new Set<string>();

  getCompanyOutlookActivityCandidates(companies).forEach((company) => {
    getContactEmails(company).forEach((email) => {
      const key = `${company.id}:${email}`;
      if (seen.has(key)) return;
      seen.add(key);
      refs.push({ companyId: company.id, email });
    });
  });

  const activityMap: CompanyOutlookActivityMap = {};

  await runWithConcurrency(refs, async ({ companyId, email }) => {
    try {
      const { data, error } = await supabase.functions.invoke("outlook-mail", {
        body: { email, top: 1 },
      });
      if (error || data?.error) return;

      const latest = normalizeOutlookMailItems(data?.emails)
        .map((item) => item.receivedAt)
        .filter(isValidDateString)
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];

      if (latest && isLater(latest, activityMap[companyId])) {
        activityMap[companyId] = latest;
      }
    } catch {
      // Outlook availability should not break the company list.
    }
  });

  return activityMap;
}
