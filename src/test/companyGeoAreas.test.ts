import { describe, expect, it } from "vitest";

import {
  GEO_FILTERS,
  companyMatchesGeoFilter,
  contactMatchesGeoFilter,
  getCompanyGeoAreas,
  getContactGeoAreas,
  getGeoFilterDescription,
  normalizeGeoFilter,
  resolveCompanyGeoAreas,
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
      "Vestfold",
      "Østfold",
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
    expect(getCompanyGeoAreas({ city: "Geilo" })).toContain("Kongsberg+");
    expect(getCompanyGeoAreas({ city: "Askøy" })).toContain("Bergen+");
    expect(getCompanyGeoAreas({ city: "Vennesla" })).toContain("Kristiansand+");
  });

  it("matches companies with several locations against several areas", () => {
    const areas = getCompanyGeoAreas({ city: "Oslo, Trondheim" });

    expect(areas).toContain("Oslo+");
    expect(areas).toContain("Trondheim+");
    expect(companyMatchesGeoFilter({ city: "Oslo, Trondheim" }, "Trondheim+")).toBe(true);
    expect(companyMatchesGeoFilter({ locations: ["Oslo", "Bergen"] }, "Oslo+")).toBe(true);
    expect(companyMatchesGeoFilter({ locations: ["Oslo", "Bergen"] }, "Bergen+")).toBe(true);
  });

  it("keeps all mapped locations even when one postal code is present", () => {
    const resolution = resolveCompanyGeoAreas({
      city: "Oslo, Bergen",
      zip_code: "0150",
      locations: ["Oslo", "Bergen"],
    });

    expect(resolution.areas).toEqual(["Oslo+", "Bergen+", "Vestlandet"]);
    expect(resolution.source).toBe("hybrid");
    expect(companyMatchesGeoFilter({ city: "Oslo, Bergen", zip_code: "0150" }, "Bergen+")).toBe(true);
  });

  it("keeps unknown location parts visible while storing mapped areas", () => {
    expect(resolveCompanyGeoAreas({ city: "Oslo, Atlantis" })).toMatchObject({
      areas: ["Oslo+"],
      source: "place",
      unresolvedPlaces: ["Atlantis"],
    });
  });

  it("lets contact geography override company geography", () => {
    const contact = {
      locations: ["Bergen"],
      company: { city: "Oslo" },
    };

    expect(getContactGeoAreas(contact)).toEqual(["Bergen+", "Vestlandet"]);
    expect(contactMatchesGeoFilter(contact, "Bergen+")).toBe(true);
    expect(contactMatchesGeoFilter(contact, "Vestlandet")).toBe(true);
    expect(contactMatchesGeoFilter(contact, "Oslo+")).toBe(false);
  });

  it("falls back to company geography when contact has no own geography", () => {
    const contact = {
      locations: [],
      company: { city: "Oslo, Trondheim" },
    };

    expect(getContactGeoAreas(contact)).toContain("Oslo+");
    expect(getContactGeoAreas(contact)).toContain("Trondheim+");
    expect(contactMatchesGeoFilter(contact, "Trondheim+")).toBe(true);
  });

  it("falls back to company geography when contact own geography is unmapped", () => {
    const contact = {
      location: "Atlantis",
      company: { city: "Oslo" },
    };

    expect(getContactGeoAreas(contact)).toEqual(["Oslo+"]);
    expect(contactMatchesGeoFilter(contact, "Ukjent sted")).toBe(false);
    expect(contactMatchesGeoFilter(contact, "Oslo+")).toBe(true);
  });

  it("maps broader region labels instead of leaving them unknown", () => {
    expect(getCompanyGeoAreas({ city: "Viken" })).toEqual(["Kongsberg+", "Østfold"]);
    expect(getCompanyGeoAreas({ city: "Telemark" })).toContain("Sørlandet");
    expect(getCompanyGeoAreas({ city: "Rogaland" })).toContain("Stavanger+");
    expect(getCompanyGeoAreas({ city: "Rogaland" })).toContain("Vestlandet");
    expect(getCompanyGeoAreas({ city: "Hordaland" })).toContain("Bergen+");
    expect(getCompanyGeoAreas({ city: "Hordaland" })).toContain("Vestlandet");
    expect(getCompanyGeoAreas({ city: "Møre og Romsdal" })).toContain("Vestlandet");
    expect(getCompanyGeoAreas({ city: "Trøndelag" })).toContain("Midt-Norge");
    expect(getCompanyGeoAreas({ city: "Troms og Finnmark" })).toContain("Nord-Norge");
    expect(getCompanyGeoAreas({ city: "Agder" })).toContain("Sørlandet");
  });

  it("maps Fredrikstad local places to Østfold without a postal code", () => {
    expect(getCompanyGeoAreas({ city: "KRÅKERØY" })).toEqual(["Østfold"]);
    expect(companyMatchesGeoFilter({ city: "KRÅKERØY" }, "Østfold")).toBe(true);
    expect(companyMatchesGeoFilter({ city: "KRÅKERØY" }, "Ukjent sted")).toBe(false);
  });

  it("maps local post places from the unknown filter screenshot to configured regions", () => {
    expect(getCompanyGeoAreas({ city: "TROLLÅSEN" })).toEqual(["Oslo+"]);
    expect(getCompanyGeoAreas({ city: "Andenes" })).toEqual(["Nord-Norge"]);
    expect(getCompanyGeoAreas({ city: "Andøya" })).toEqual(["Nord-Norge"]);
    expect(getCompanyGeoAreas({ city: "HELL" })).toEqual(["Trondheim+"]);
    expect(getCompanyGeoAreas({ city: "TAU" })).toEqual(["Stavanger+", "Vestlandet"]);
    expect(getCompanyGeoAreas({ city: "LIERSTRANDA" })).toEqual(["Kongsberg+", "Vestfold"]);
    expect(getCompanyGeoAreas({ city: "Bremanger" })).toEqual(["Vestlandet"]);
    expect(getCompanyGeoAreas({ city: "FLEKKERØY" })).toEqual(["Kristiansand+", "Sørlandet"]);
  });

  it("lets neighboring GEO filters overlap where it is useful", () => {
    expect(getCompanyGeoAreas({ city: "Horten" })).toEqual(["Kongsberg+", "Vestfold"]);
    expect(getCompanyGeoAreas({ city: "Drammen" })).toEqual(["Kongsberg+", "Vestfold"]);
    expect(companyMatchesGeoFilter({ city: "Drammen" }, "Kongsberg+")).toBe(true);
    expect(companyMatchesGeoFilter({ city: "Drammen" }, "Vestfold")).toBe(true);
    expect(getCompanyGeoAreas({ city: "Bergen" })).toEqual(["Bergen+", "Vestlandet"]);
    expect(getCompanyGeoAreas({ zip_code: "3180" })).toEqual(["Kongsberg+", "Vestfold"]);
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
    expect(normalizeGeoFilter("Østlandet ellers")).toBe("Alle");
    expect(normalizeGeoFilter("Stavanger/Sandnes")).toBe("Stavanger+");
    expect(normalizeGeoFilter("Bergen-området")).toBe("Bergen+");
    expect(normalizeGeoFilter("Kristiansand-området")).toBe("Kristiansand+");
    expect(normalizeGeoFilter("Vestlandet ellers")).toBe("Vestlandet");
    expect(normalizeGeoFilter("Midt-Norge ellers")).toBe("Midt-Norge");
    expect(normalizeGeoFilter("Sørlandet/Telemark ellers")).toBe("Sørlandet");
    expect(getCompanyGeoAreas({ zip_code: "7010" })).toEqual(["Trondheim+", "Midt-Norge"]);
    expect(getCompanyGeoAreas({ zip_code: "3050" })).toEqual(["Kongsberg+", "Vestfold"]);
  });

  it("uses persisted geo areas before text fallback", () => {
    expect(getCompanyGeoAreas({ city: "Atlantis", geo_areas: ["Vestlandet"] })).toEqual(["Vestlandet"]);
    expect(resolveCompanyGeoAreas({ city: "Atlantis", geo_areas: ["Oslo+"], geo_source: "manual" })).toMatchObject({
      areas: ["Oslo+"],
      source: "manual",
    });
  });

  it("recomputes obsolete Østlandet values and augments persisted areas", () => {
    expect(getCompanyGeoAreas({ city: "KRÅKERØY", geo_areas: ["Østlandet"] })).toEqual(["Østfold"]);
    expect(getCompanyGeoAreas({ city: "Drammen", geo_areas: ["Kongsberg+"] })).toEqual(["Kongsberg+", "Vestfold"]);
  });

  it("reports unresolved place names when nothing maps", () => {
    expect(resolveCompanyGeoAreas({ city: "Atlantis" })).toMatchObject({
      areas: ["Ukjent sted"],
      source: "unknown",
      unresolvedPlaces: ["Atlantis"],
    });
  });
});
