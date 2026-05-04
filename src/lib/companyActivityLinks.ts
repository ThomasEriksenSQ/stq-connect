export type CompanyContactLink = {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

export type CompanyLinkedRecord = {
  contact_id?: string | null;
  contacts?: unknown;
};

function toCleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function buildActiveCompanyContactMap<T extends CompanyContactLink>(
  contacts: readonly T[],
): Map<string, T> {
  return new Map(
    contacts
      .map((contact) => {
        const contactId = toCleanString(contact.id);
        return contactId ? ([contactId, contact] as const) : null;
      })
      .filter((entry): entry is readonly [string, T] => Boolean(entry)),
  );
}

export function normalizeCompanyLinkedRecord<T extends CompanyLinkedRecord>(
  record: T,
  activeContactsById: Map<string, CompanyContactLink>,
): T & { contact_id: string | null; contacts: { first_name: string; last_name: string } | null } {
  const contactId = toCleanString(record.contact_id);
  const activeContact = contactId ? activeContactsById.get(contactId) : null;

  if (!activeContact) {
    return {
      ...record,
      contact_id: null,
      contacts: null,
    };
  }

  return {
    ...record,
    contact_id: contactId,
    contacts: {
      first_name: toCleanString(activeContact.first_name),
      last_name: toCleanString(activeContact.last_name),
    },
  };
}
