import { describe, expect, it } from "vitest";

import {
  extractTechnologyTagsFromText,
  getSortedTechnologyEntries,
  mergeTechnologyTags,
  normalizeTechnologyTags,
} from "@/lib/technologyTags";

describe("technologyTags", () => {
  it("normalizes embedded aliases to canonical tags", () => {
    expect(
      normalizeTechnologyTags([
        "c/c++",
        "embedded linux",
        "freertos",
        "arm cortex-m",
        "stm32",
      ]),
    ).toEqual(["C", "C++", "Embedded Linux", "FreeRTOS", "ARM Cortex-M", "STM32"]);
  });

  it("extracts nested and compound technologies from text", () => {
    const extracted = extractTechnologyTagsFromText("C++, Embedded Linux (Yocto, Qt/QML), SPI/I2C, BLE");
    expect(extracted).toHaveLength(7);
    expect(extracted).toEqual(expect.arrayContaining(["C++", "Embedded Linux", "Yocto", "Qt", "SPI", "I2C", "BLE"]));
  });

  it("merges and de-duplicates technologies across sources", () => {
    expect(
      mergeTechnologyTags(["c++", "Yocto"], ["C++", "embedded linux"], "Qt/QML, Yocto"),
    ).toEqual(["C++", "Yocto", "Embedded Linux", "Qt"]);
  });

  it("sorts parsed frequency maps by count", () => {
    expect(
      getSortedTechnologyEntries({
        "embedded linux": 2,
        Yocto: 4,
        C: 1,
      }),
    ).toEqual([
      { name: "Yocto", count: 4 },
      { name: "Embedded Linux", count: 2 },
      { name: "C", count: 1 },
    ]);
  });
});
