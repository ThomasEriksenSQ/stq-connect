import { describe, expect, it } from "vitest";

import {
  MATCH_OWNER_FILTER_NONE,
  buildMatchLeadOwnerCandidate,
  getMatchLeadOwnerLabel,
  matchesMatchLeadOwnerFilter,
  resolveMatchLeadOwner,
} from "@/lib/matchLeadOwners";

describe("matchLeadOwners", () => {
  it("builds owner candidates from CRM relations", () => {
    expect(
      buildMatchLeadOwnerCandidate(
        {
          owner_id: "owner-1",
          profiles: { id: "owner-1", full_name: "Thomas Eriksen" },
        },
        "contact",
      ),
    ).toEqual({
      ownerId: "owner-1",
      ownerName: "Thomas Eriksen",
      ownerSource: "contact",
    });
  });

  it("resolves the first available owner candidate by priority", () => {
    const companyOwner = buildMatchLeadOwnerCandidate(
      { owner_id: "company-owner", profiles: { id: "company-owner", full_name: "Jon Richard Nygaard" } },
      "company",
    );
    const fallbackOwner = buildMatchLeadOwnerCandidate(
      { owner_id: "fallback-owner", profiles: { id: "fallback-owner", full_name: "Thomas Eriksen" } },
      "fallback_contact",
    );

    expect(resolveMatchLeadOwner(companyOwner, fallbackOwner)).toEqual({
      ownerId: "company-owner",
      ownerName: "Jon Richard Nygaard",
      ownerSource: "company",
    });
  });

  it("returns an explicit none owner when no candidates exist", () => {
    expect(resolveMatchLeadOwner(null, undefined)).toEqual({
      ownerId: null,
      ownerName: null,
      ownerSource: "none",
    });
  });

  it("matches assigned and unassigned owner filters", () => {
    expect(matchesMatchLeadOwnerFilter("owner-1", "all")).toBe(true);
    expect(matchesMatchLeadOwnerFilter("owner-1", "owner-1")).toBe(true);
    expect(matchesMatchLeadOwnerFilter("owner-1", "owner-2")).toBe(false);
    expect(matchesMatchLeadOwnerFilter(null, MATCH_OWNER_FILTER_NONE)).toBe(true);
    expect(matchesMatchLeadOwnerFilter("owner-1", MATCH_OWNER_FILTER_NONE)).toBe(false);
  });

  it("builds stable chip labels for known and unknown owners", () => {
    expect(getMatchLeadOwnerLabel("owner-1", "Thomas Eriksen")).toBe("Thomas Eriksen");
    expect(getMatchLeadOwnerLabel("owner-1", null)).toBe("Ukjent eier");
    expect(getMatchLeadOwnerLabel(null, null)).toBe("Uten eier");
  });
});
