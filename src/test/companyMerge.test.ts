import { describe, expect, it } from "vitest";

import { findBestCompanyMatch } from "@/lib/companyMatch";
import {
  buildCompanyMergePreview,
  getCompanyFieldTransfers,
} from "../../supabase/functions/_shared/companyMerge";

describe("companyMerge", () => {
  it("blocks merges with conflicting org numbers but not Salesforce IDs", () => {
    const preview = buildCompanyMergePreview(
      {
        id: "source",
        name: "TOMRA",
        org_number: "123456789",
        sf_account_id: "001-source",
      },
      {
        id: "target",
        name: "TOMRA SYSTEMS ASA",
        org_number: "987654321",
        sf_account_id: "001-target",
      },
      {
        contacts: 1,
        activities: 0,
        tasks: 0,
        foresporsler: 0,
        finn_annonser: 0,
        external_consultants: 0,
        stacq_oppdrag: 0,
        source_aliases: 0,
      },
    );

    expect(preview.canMerge).toBe(false);
    expect(preview.blockingConflicts).toEqual(["Ulikt org.nr"]);
  });

  it("allows merges when only Salesforce IDs differ", () => {
    const preview = buildCompanyMergePreview(
      {
        id: "source",
        name: "LILAAS AS",
        org_number: "997346912",
        sf_account_id: "001-source",
      },
      {
        id: "target",
        name: "LILAAS AS",
        org_number: "997346912",
        sf_account_id: "001-target",
      },
      {
        contacts: 1,
        activities: 2,
        tasks: 0,
        foresporsler: 0,
        finn_annonser: 7,
        external_consultants: 0,
        stacq_oppdrag: 0,
        source_aliases: 0,
      },
    );

    expect(preview.canMerge).toBe(true);
    expect(preview.blockingConflicts).toEqual([]);
  });

  it("shows which company fields will be filled from source", () => {
    expect(
      getCompanyFieldTransfers(
        {
          id: "source",
          name: "TOMRA",
          website: "tomra.com",
          email: "hello@tomra.com",
          city: "Asker",
          linkedin: "https://linkedin.com/company/tomra",
        },
        {
          id: "target",
          name: "TOMRA SYSTEMS ASA",
          website: null,
          email: null,
          city: "Oslo",
          linkedin: null,
        },
      ),
    ).toEqual(["Nettside", "E-post", "LinkedIn"]);
  });

  it("matches merged company aliases back to the target company", () => {
    const matched = findBestCompanyMatch("TOMRA", [
      {
        name: "TOMRA SYSTEMS ASA",
        aliases: ["TOMRA"],
      },
    ]);

    expect(matched?.name).toBe("TOMRA SYSTEMS ASA");
  });
});
