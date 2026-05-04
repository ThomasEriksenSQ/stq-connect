import { describe, expect, it } from "vitest";

import {
  buildActiveCompanyContactMap,
  normalizeCompanyLinkedRecord,
} from "@/lib/companyActivityLinks";

describe("companyActivityLinks", () => {
  const contactsById = buildActiveCompanyContactMap([
    {
      id: "active-contact",
      first_name: "Torgeir",
      last_name: "Troite",
    },
  ]);

  it("keeps contact links when the contact is active on the company", () => {
    expect(
      normalizeCompanyLinkedRecord(
        {
          id: "activity-1",
          contact_id: "active-contact",
          contacts: { first_name: "Old", last_name: "Name" },
        },
        contactsById,
      ),
    ).toMatchObject({
      id: "activity-1",
      contact_id: "active-contact",
      contacts: {
        first_name: "Torgeir",
        last_name: "Troite",
      },
    });
  });

  it("removes contact links that are not active company contacts", () => {
    expect(
      normalizeCompanyLinkedRecord(
        {
          id: "activity-2",
          contact_id: "deleted-contact",
          contacts: { first_name: "Deleted", last_name: "Contact" },
        },
        contactsById,
      ),
    ).toMatchObject({
      id: "activity-2",
      contact_id: null,
      contacts: null,
    });
  });

  it("normalizes blank contact ids", () => {
    expect(
      normalizeCompanyLinkedRecord(
        {
          id: "activity-3",
          contact_id: " ",
          contacts: { first_name: "No", last_name: "Link" },
        },
        contactsById,
      ),
    ).toMatchObject({
      id: "activity-3",
      contact_id: null,
      contacts: null,
    });
  });
});
