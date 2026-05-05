export type CompanyContactLink = {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

export type CompanyLinkedRecord = {
  contact_id?: string | null;
  contacts?: unknown;
};

export type CompanyLinkedContactState = "active" | "historical" | "none";

export type NormalizedCompanyLinkedRecord<T extends CompanyLinkedRecord> = T & {
  contact_id: string | null;
  contacts: { first_name: string; last_name: string } | null;
  contact_link_state: CompanyLinkedContactState;
};

function toCleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getHistoricalContactName(contacts: unknown) {
  if (!contacts || typeof contacts !== "object") return null;
  const contact = contacts as { first_name?: unknown; last_name?: unknown };
  const firstName = toCleanString(contact.first_name);
  const lastName = toCleanString(contact.last_name);
  if (!firstName && !lastName) return null;

  return {
    first_name: firstName,
    last_name: lastName,
  };
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
): NormalizedCompanyLinkedRecord<T> {
  const contactId = toCleanString(record.contact_id);
  const activeContact = contactId ? activeContactsById.get(contactId) : null;

  if (!activeContact) {
    const historicalContact = getHistoricalContactName(record.contacts);

    return {
      ...record,
      contact_id: null,
      contacts: historicalContact,
      contact_link_state: historicalContact ? "historical" : "none",
    };
  }

  return {
    ...record,
    contact_id: contactId,
    contacts: {
      first_name: toCleanString(activeContact.first_name),
      last_name: toCleanString(activeContact.last_name),
    },
    contact_link_state: "active",
  };
}
