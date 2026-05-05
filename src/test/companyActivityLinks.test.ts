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
      contact_link_state: "active",
      contacts: {
        first_name: "Torgeir",
        last_name: "Troite",
      },
    });
  });

  it("keeps a historical name without an active contact link", () => {
    expect(
      normalizeCompanyLinkedRecord(
        {
          id: "activity-2",
          contact_id: "deleted-contact",
          contacts: { first_name: "Torgeir", last_name: "Troite" },
        },
        contactsById,
      ),
    ).toMatchObject({
      id: "activity-2",
      contact_id: null,
      contact_link_state: "historical",
      contacts: {
        first_name: "Torgeir",
        last_name: "Troite",
      },
    });
  });

  it("removes contact display when no historical name exists", () => {
    expect(
      normalizeCompanyLinkedRecord(
        {
          id: "activity-2b",
          contact_id: "deleted-contact",
          contacts: null,
        },
        contactsById,
      ),
    ).toMatchObject({
      id: "activity-2b",
      contact_id: null,
      contact_link_state: "none",
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
      contact_link_state: "historical",
      contacts: {
        first_name: "No",
        last_name: "Link",
      },
    });
  });

  it("drops blank ids and blank names", () => {
    expect(
      normalizeCompanyLinkedRecord(
        {
          id: "activity-4",
          contact_id: " ",
          contacts: { first_name: " ", last_name: "" },
        },
        contactsById,
      ),
    ).toMatchObject({
      id: "activity-4",
      contact_id: null,
      contact_link_state: "none",
      contacts: null,
    });
  });
});
