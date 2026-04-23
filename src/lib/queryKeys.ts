import type { QueryClient, QueryKey } from "@tanstack/react-query";

export const crmQueryKeys = {
  contacts: {
    all: () => ["contacts-full"] as const,
    detail: (contactId: string) => ["contact", contactId] as const,
    activities: (contactId: string) => ["contact-activities", contactId] as const,
    tasks: (contactId: string) => ["contact-tasks", contactId] as const,
  },
  sentCv: {
    contact: (contactId: string) => ["contact-sent-cv", contactId] as const,
    employee: (ansattId: number | string) => ["ansatt-sent-cv", ansattId] as const,
    live: (scopeKey: string) => ["sent-cv-live-sync", scopeKey] as const,
  },
  companies: {
    all: () => ["companies-full"] as const,
    detail: (companyId: string) => ["company", companyId] as const,
    contacts: (companyId: string) => ["company-contacts", companyId] as const,
    activities: (companyId: string) => ["company-activities-direct", companyId] as const,
    contactActivities: (companyId: string, contactIds: unknown = []) =>
      ["company-contact-activities", companyId, contactIds] as const,
    tasks: (companyId: string) => ["company-tasks", companyId] as const,
    contactTasks: (companyId: string, contactIds: unknown = []) =>
      ["company-contact-tasks", companyId, contactIds] as const,
    techProfile: (companyId: string) => ["company-tech-profile", companyId] as const,
    foresporslerTags: (companyId: string) => ["company-foresporsler-tags", companyId] as const,
    contactTags: (companyId: string) => ["company-contact-tags", companyId] as const,
  },
  foresporsler: {
    list: () => ["foresporsler-list"] as const,
    kontakter: (selskapId: string | null) => ["foresporsler-kontakter", selskapId] as const,
    editKontakter: (selskapId: string | null) => ["foresporsler-edit-kontakter", selskapId] as const,
    konsulenter: (foresporselId: number | string | null | undefined) =>
      ["foresporsler-konsulenter", foresporselId] as const,
    senereKonsulenter: (foresporselId: number | string | null | undefined) =>
      ["foresporsler-senere-konsulenter", foresporselId] as const,
  },
  profiles: {
    all: () => ["profiles"] as const,
  },
  oppfolginger: {
    tasks: () => ["oppfolginger-tasks-v1"] as const,
    signal: () => ["oppfolginger-signal-v1"] as const,
  },
  dailyBrief: {
    all: (ownerFilter: string) => ["salgssenter-all", ownerFilter] as const,
  },
  generic: {
    tasks: () => ["tasks"] as const,
  },
  oppdrag: {
    all: () => ["stacq-oppdrag"] as const,
    prisen: () => ["stacq-oppdrag-prisen"] as const,
    activeNames: () => ["stacq-oppdrag-active-names"] as const,
    fornyelser: () => ["stacq-oppdrag-fornyelser"] as const,
  },
} as const;

export const crmSummaryQueryKeys = [
  crmQueryKeys.contacts.all(),
  crmQueryKeys.companies.all(),
  crmQueryKeys.oppfolginger.tasks(),
  crmQueryKeys.oppfolginger.signal(),
] as const satisfies readonly QueryKey[];

export const oppdragQueryKeys = [
  crmQueryKeys.oppdrag.all(),
  crmQueryKeys.oppdrag.prisen(),
  crmQueryKeys.oppdrag.activeNames(),
  crmQueryKeys.oppdrag.fornyelser(),
] as const satisfies readonly QueryKey[];

export async function invalidateQueryGroup(queryClient: QueryClient, queryKeys: readonly QueryKey[]) {
  await Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
