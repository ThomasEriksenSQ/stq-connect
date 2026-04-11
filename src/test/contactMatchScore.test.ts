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
    expect(getContactMatchScore(["C++", "Qt"], ["Rust", "BLE"])).toMatchObject({
      score10: 0,
      matchBand: null,
      matchTags: [],
      coverage: 0,
      precision: 0,
      matchedWeight: 0,
      technicalFit: 0,
      evidence: 0,
      confidenceScore: 0,
      confidenceBand: "low",
      matchedLayerCount: 0,
    });
  });

  it("keeps sparse C/C++ overlaps below the strong band", () => {
    const result = getContactMatchScore(
      ["C", "C++", "Yocto", "Qt"],
      ["C", "C++"],
    );

    expect(result.score10).toBeGreaterThanOrEqual(5);
    expect(result.score10).toBeLessThan(7);
    expect(result.matchBand).toBe("related");
    expect(result.confidenceBand).toBe("low");
    expect(result.matchTags).toEqual(["C++", "C"]);
  });

  it("scores cohesive embedded Linux stacks strongly", () => {
    const result = getContactMatchScore(
      ["C++", "Qt", "Yocto"],
      ["C++", "Qt", "Yocto", "Embedded Linux"],
    );

    expect(result.score10).toBeGreaterThanOrEqual(8);
    expect(result.matchBand).toBe("strong");
    expect(result.confidenceBand).toBe("high");
    expect(result.matchTags).toEqual(["C++", "Yocto", "Qt"]);
  });

  it("scores MCU + RTOS + protocol stacks as strong high-confidence matches", () => {
    const result = getContactMatchScore(
      ["STM32", "FreeRTOS", "BLE"],
      ["C", "C++", "STM32", "FreeRTOS", "BLE"],
    );

    expect(result.score10).toBeGreaterThanOrEqual(9);
    expect(result.matchBand).toBe("strong");
    expect(result.confidenceBand).toBe("high");
    expect(result.matchedLayerCount).toBeGreaterThanOrEqual(3);
  });

  it("treats a single concrete overlap as low-confidence relevance, not a strong match", () => {
    const result = getContactMatchScore(
      ["C++", "Qt", "Yocto", "Embedded Linux"],
      ["C++", "Linux"],
    );

    expect(result.score10).toBeLessThan(4);
    expect(result.matchBand).toBeNull();
    expect(result.confidenceBand).toBe("low");
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
