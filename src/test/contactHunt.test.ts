import { describe, expect, it } from "vitest";

import {
  getConsultantAvailabilityMeta,
  getConsultantMatchTags,
  getTechnologyMatchTags,
  hasRecentActivity,
  hasRecentActualActivity,
  hasConsultantAvailability,
  isActiveRequest,
  isColdCallCandidate,
  isCustomerCompany,
  isProspectCompany,
  isProspectOrCustomerCompany,
  sortHuntConsultants,
} from "@/lib/contactHunt";

function isoDate(offsetDays: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

describe("contactHunt", () => {
  it("sorts consultants with known availability first", () => {
    const sorted = sortHuntConsultants([
      { navn: "Zara", tilgjengelig_fra: isoDate(20) },
      { navn: "Anders", tilgjengelig_fra: null },
      { navn: "Bente", tilgjengelig_fra: isoDate(-2) },
    ]);

    expect(sorted.map((consultant) => consultant.navn)).toEqual(["Bente", "Zara", "Anders"]);
  });

  it("marks availability as visible whenever a date is set", () => {
    expect(hasConsultantAvailability(null)).toBe(false);
    expect(getConsultantAvailabilityMeta(null)).toEqual({
      daysUntil: Number.POSITIVE_INFINITY,
      label: "Tilgjengelighetsdato mangler",
      tone: "unknown",
      isVisible: false,
    });

    expect(getConsultantAvailabilityMeta(isoDate(1))).toMatchObject({
      daysUntil: 1,
      tone: "soon",
      isVisible: true,
    });
    expect(getConsultantAvailabilityMeta(isoDate(1)).label).toMatch(/^Tilgjengelig /);

    expect(getConsultantAvailabilityMeta(isoDate(120))).toMatchObject({
      daysUntil: 120,
      tone: "later",
      isVisible: true,
    });

    expect(hasConsultantAvailability(isoDate(0))).toBe(true);
    expect(hasConsultantAvailability(isoDate(45))).toBe(true);
    expect(getConsultantAvailabilityMeta(isoDate(-61))).toEqual({
      daysUntil: -61,
      label: "Tilgjengelighet utløpt",
      tone: "unknown",
      isVisible: true,
    });
  });

  it("derives consultant overlap tags across contact and company dna", () => {
    const consultant = {
      navn: "Ada Lovelace",
      kompetanse: ["C++", "Qt", "Embedded Linux", "Yocto"],
      tilgjengelig_fra: null,
    };
    const contact = {
      hasAktivForesporsel: false,
      hasTidligereForesporsel: false,
      hasMarkedsradar: true,
      isInnkjoper: false,
      daysSinceLastContact: 21,
      openTaskCount: 0,
      contactTechnologies: ["C++", "Qt"],
      companyTechnologies: ["Embedded Linux", "Yocto"],
    };

    expect(getConsultantMatchTags(consultant, contact)).toEqual([
      "C++",
      "Qt",
      "Embedded Linux",
      "Yocto",
    ]);
    expect(getTechnologyMatchTags(["Qt", "Rust"], ["C++", "Qt", "Yocto"])).toEqual(["Qt"]);
  });

  it("recognizes recent activity, cold call candidates and customer companies", () => {
    expect(hasRecentActivity(12, 0)).toBe(true);
    expect(hasRecentActivity(60, 0)).toBe(false);
    expect(hasRecentActualActivity(12)).toBe(true);
    expect(hasRecentActualActivity(60)).toBe(false);
    expect(isActiveRequest(isoDate(-7), "åpen")).toBe(true);
    expect(isActiveRequest(isoDate(-60), "åpen")).toBe(false);
    expect(isActiveRequest(isoDate(-7), "tapt")).toBe(false);

    expect(
      isColdCallCandidate({
        daysSinceLastContact: 120,
        openTaskCount: 0,
        isIkkeAktuellKontakt: false,
      }),
    ).toBe(true);

    expect(
      isColdCallCandidate({
        daysSinceLastContact: 20,
        openTaskCount: 1,
        isIkkeAktuellKontakt: false,
      }),
    ).toBe(false);

    expect(isCustomerCompany("customer")).toBe(true);
    expect(isCustomerCompany("kunde")).toBe(true);
    expect(isCustomerCompany("prospect")).toBe(false);
    expect(isProspectCompany("prospect")).toBe(true);
    expect(isProspectCompany("Potensiell kunde")).toBe(true);
    expect(isProspectOrCustomerCompany("prospect")).toBe(true);
    expect(isProspectOrCustomerCompany("customer")).toBe(true);
    expect(isProspectOrCustomerCompany("partner")).toBe(false);
  });
});
