import { describe, expect, it } from "vitest";

import {
  getContactMatchScore,
  getMatchBand,
  getMatchBandRank,
  normalizeMatchTags,
} from "@/lib/contactMatchScore";

describe("contactMatchScore", () => {
  it("normalizes and sorts tags consistently", () => {
    expect(normalizeMatchTags(["Linux", "Qt/QML", "Robotics"])).toEqual(["Qt", "Robotics", "Linux"]);
  });

  it("returns no score when there is no overlap", () => {
    expect(getContactMatchScore(["C++", "Qt"], ["Rust", "BLE"])).toEqual({
      score10: 0,
      matchBand: null,
      matchTags: [],
      coverage: 0,
      precision: 0,
      matchedWeight: 0,
    });
  });

  it("scores specific overlaps higher than broad-only overlaps", () => {
    const strong = getContactMatchScore(
      ["C++", "Qt", "Yocto", "Embedded Linux"],
      ["C++", "Qt"],
    );
    const broadOnly = getContactMatchScore(
      ["C++", "Qt", "Yocto", "Linux"],
      ["Linux"],
    );

    expect(strong.score10).toBeGreaterThanOrEqual(8);
    expect(strong.matchBand).toBe("strong");
    expect(broadOnly.score10).toBeGreaterThanOrEqual(4);
    expect(broadOnly.matchBand).toBe("related");
    expect(strong.score10).toBeGreaterThan(broadOnly.score10);
  });

  it("lets good partial matches land in the good band", () => {
    const result = getContactMatchScore(
      ["C++", "Qt", "Yocto", "Embedded Linux"],
      ["C++", "Linux"],
    );

    expect(result.score10).toBeGreaterThanOrEqual(6);
    expect(result.matchBand).toBe("good");
    expect(result.matchTags).toEqual(["C++"]);
  });

  it("returns stable band ranks", () => {
    expect(getMatchBand(9)).toBe("strong");
    expect(getMatchBand(6)).toBe("good");
    expect(getMatchBand(4)).toBe("related");
    expect(getMatchBand(3)).toBeNull();
    expect(getMatchBandRank("strong")).toBeGreaterThan(getMatchBandRank("good"));
  });
});
