import { describe, expect, it } from "vitest";

import {
  buildEmployeeGeoText,
  getGeoCandidates,
  normalizeGeoText,
  rankGeoMatch,
} from "@/lib/geographicMatch";

describe("geographicMatch", () => {
  it("normalizes Norwegian place names for matching", () => {
    expect(normalizeGeoText("Tromsø / Bærum / Ås")).toBe("tromso baerum as");
  });

  it("extracts postal code and poststed from a full employee address", () => {
    const candidates = getGeoCandidates({
      address: "Singsakerbakken 1",
      postalCode: "7030",
      city: "Trondheim",
    });

    expect(candidates[0]).toMatchObject({
      postalCode: "7030",
      normalizedCity: "trondheim",
    });
  });

  it("ranks exact and nearby postal codes above city distance", () => {
    const exact = rankGeoMatch(
      { postalCode: "7030", city: "Trondheim" },
      [{ postalCode: "7030", city: "Trondheim" }],
    );
    const sameArea = rankGeoMatch(
      { postalCode: "7030", city: "Trondheim" },
      [{ postalCode: "7011", city: "Trondheim" }],
    );
    const horten = rankGeoMatch(
      { postalCode: "7030", city: "Trondheim" },
      [{ city: "Horten" }],
    );

    expect(exact.tier).toBe("postal-exact");
    expect(sameArea.tier).toBe("postal-2");
    expect(exact.score).toBeGreaterThan(sameArea.score);
    expect(sameArea.score).toBeGreaterThan(horten.score);
  });

  it("uses the nearest branch when a company has several locations", () => {
    const match = rankGeoMatch(
      { postalCode: "3187", city: "Horten" },
      [{ city: "Oslo, Trondheim, Horten, Moss" }],
    );

    expect(match.tier).toBe("city-exact");
    expect(match.label).toContain("Horten");
  });

  it("keeps companies with missing location at the bottom", () => {
    const match = rankGeoMatch({ postalCode: "7030", city: "Trondheim" }, [{ city: "" }]);

    expect(match.tier).toBe("company-unknown");
    expect(match.score10).toBe(1);
  });

  it("builds a safe geography fallback for existing consumers", () => {
    expect(buildEmployeeGeoText("7030", "Trondheim", "")).toBe("7030 Trondheim");
    expect(buildEmployeeGeoText("", "", "Oslo")).toBe("Oslo");
  });
});
