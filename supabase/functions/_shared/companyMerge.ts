export type MergeableCompany = {
  id: string;
  name: string;
  org_number?: string | null;
  sf_account_id?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  zip_code?: string | null;
  linkedin?: string | null;
  industry?: string | null;
  owner_id?: string | null;
  notes?: string | null;
  status?: string | null;
};

export type CompanyMergeRelationCounts = {
  contacts: number;
  activities: number;
  tasks: number;
  foresporsler: number;
  finn_annonser: number;
  external_consultants: number;
  stacq_oppdrag: number;
  source_aliases: number;
};

export type CompanyMergePreview = {
  canMerge: boolean;
  blockingConflicts: string[];
  fieldTransfers: string[];
  relationCounts: CompanyMergeRelationCounts;
};

const FILLABLE_FIELDS: Array<{ key: keyof MergeableCompany; label: string }> = [
  { key: "website", label: "Nettside" },
  { key: "phone", label: "Telefon" },
  { key: "email", label: "E-post" },
  { key: "address", label: "Adresse" },
  { key: "city", label: "Sted" },
  { key: "zip_code", label: "Postnummer" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "industry", label: "Bransje" },
  { key: "owner_id", label: "Eier" },
  { key: "org_number", label: "Org.nr" },
  { key: "sf_account_id", label: "Salesforce-ID" },
];

function hasValue(value: string | null | undefined): boolean {
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

export function getCompanyMergeBlockingConflicts(source: MergeableCompany, target: MergeableCompany): string[] {
  const conflicts: string[] = [];

  if (
    hasValue(source.org_number) &&
    hasValue(target.org_number) &&
    source.org_number !== target.org_number
  ) {
    conflicts.push("Ulikt org.nr");
  }

  return conflicts;
}

export function getCompanyFieldTransfers(source: MergeableCompany, target: MergeableCompany): string[] {
  return FILLABLE_FIELDS.filter(({ key }) => hasValue(source[key]) && !hasValue(target[key])).map(({ label }) => label);
}

export function buildCompanyMergePreview(
  source: MergeableCompany,
  target: MergeableCompany,
  relationCounts: CompanyMergeRelationCounts,
): CompanyMergePreview {
  const blockingConflicts = getCompanyMergeBlockingConflicts(source, target);

  return {
    canMerge: blockingConflicts.length === 0,
    blockingConflicts,
    fieldTransfers: getCompanyFieldTransfers(source, target),
    relationCounts,
  };
}
