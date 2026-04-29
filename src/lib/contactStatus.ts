import { contactMatchesGeoFilter, type ContactGeoAreaInput } from "@/lib/companyGeoAreas";

export type ContactStatusCleanupCandidate = ContactGeoAreaInput & {
  company_id?: string | null;
  status?: string | null;
  title?: string | null;
};

function isBlank(value: string | null | undefined) {
  return !String(value || "").trim();
}

export function shouldSoftDeleteUnknownUnlinkedTitlelessContact(contact: ContactStatusCleanupCandidate) {
  return (
    contact.status !== "deleted" &&
    !contact.company_id &&
    isBlank(contact.title) &&
    contactMatchesGeoFilter(
      {
        location: contact.location,
        locations: contact.locations,
        company: null,
      },
      "Ukjent sted",
    )
  );
}
