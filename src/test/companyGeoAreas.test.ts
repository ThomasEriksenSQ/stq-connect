import { describe, expect, it } from "vitest";

import {
  GEO_FILTERS,
  companyMatchesGeoFilter,
  getCompanyGeoAreas,
  getGeoFilterDescription,
  normalizeGeoFilter,
} from "@/lib/companyGeoAreas";

describe("companyGeoAreas", () => {
  it("uses the requested GEO filter order", () => {
    expect(GEO_FILTERS).toEqual([
      "Alle",
      "Oslo+",
      "Trondheim+",
      "Kongsberg+",
      "Stavanger+",
      "Bergen+",
      "Kristiansand+",
      "Østlandet",
      "Vestlandet",
      "Midt-Norge",
      "Nord-Norge",
      "Sørlandet",
      "Ukjent sted",
    ]);
  });

  it("maps important STACQ city areas", () => {
    expect(getCompanyGeoAreas({ city: "Bærum" })).toContain("Oslo+");
    expect(getCompanyGeoAreas({ city: "Sandnes" })).toContain("Stavanger+");
    expect(getCompanyGeoAreas({ city: "Hokksund" })).toContain("Kongsberg+");
    expect(getCompanyGeoAreas({ city: "Askøy" })).toContain("Bergen+");
    expect(getCompanyGeoAreas({ city: "Vennesla" })).toContain("Kristiansand+");
  });

  it("matches companies with several locations against several areas", () => {
    const areas = getCompanyGeoAreas({ city: "Oslo, Trondheim" });

    expect(areas).toContain("Oslo+");
    expect(areas).toContain("Trondheim+");
    expect(companyMatchesGeoFilter({ city: "Oslo, Trondheim" }, "Trondheim+")).toBe(true);
  });

  it("maps broader region labels instead of leaving them unknown", () => {
    expect(getCompanyGeoAreas({ city: "Viken" })).toContain("Østlandet");
    expect(getCompanyGeoAreas({ city: "Telemark" })).toContain("Østlandet");
    expect(getCompanyGeoAreas({ city: "Rogaland" })).toContain("Stavanger+");
    expect(getCompanyGeoAreas({ city: "Hordaland" })).toContain("Bergen+");
    expect(getCompanyGeoAreas({ city: "Møre og Romsdal" })).toContain("Vestlandet");
    expect(getCompanyGeoAreas({ city: "Trøndelag" })).toContain("Midt-Norge");
    expect(getCompanyGeoAreas({ city: "Troms og Finnmark" })).toContain("Nord-Norge");
    expect(getCompanyGeoAreas({ city: "Agder" })).toContain("Sørlandet");
  });

  it("keeps unmapped or missing locations in unknown place", () => {
    expect(getCompanyGeoAreas({ city: "" })).toEqual(["Ukjent sted"]);
    expect(getCompanyGeoAreas({ city: "Atlantis" })).toEqual(["Ukjent sted"]);
  });

  it("describes what an area includes", () => {
    expect(getGeoFilterDescription("Kongsberg+")).toContain("Kongsberg");
    expect(getGeoFilterDescription("Kongsberg+")).toContain("Drammen");
  });

  it("normalizes old filter labels and uses postal fallback", () => {
    expect(normalizeGeoFilter("Oslo-området")).toBe("Oslo+");
    expect(normalizeGeoFilter("Kongsberg-området")).toBe("Kongsberg+");
    expect(normalizeGeoFilter("Østlandet ellers")).toBe("Østlandet");
    expect(normalizeGeoFilter("Stavanger/Sandnes")).toBe("Stavanger+");
    expect(normalizeGeoFilter("Bergen-området")).toBe("Bergen+");
    expect(normalizeGeoFilter("Kristiansand-området")).toBe("Kristiansand+");
    expect(normalizeGeoFilter("Vestlandet ellers")).toBe("Vestlandet");
    expect(normalizeGeoFilter("Midt-Norge ellers")).toBe("Midt-Norge");
    expect(normalizeGeoFilter("Sørlandet/Telemark ellers")).toBe("Sørlandet");
    expect(getCompanyGeoAreas({ zip_code: "7010" })).toEqual(["Trondheim+"]);
    expect(getCompanyGeoAreas({ zip_code: "3050" })).toEqual(["Kongsberg+"]);
  });
});
