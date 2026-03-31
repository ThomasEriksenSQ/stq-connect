import { describe, expect, it } from "vitest";

import { buildCvPdfSegments } from "@/lib/cvPdfExtract";

describe("cvPdfExtract", () => {
  it("groups text items into ordered line segments", () => {
    const segments = buildCvPdfSegments(
      [
        { str: "Christian", transform: [1, 0, 0, 1, 30, 760], width: 45, height: 18 },
        { str: "Poljac", transform: [1, 0, 0, 1, 82, 760], width: 34, height: 18 },
        { str: "Senior Embedded-utvikler", transform: [1, 0, 0, 1, 30, 736], width: 140, height: 12 },
      ],
      1,
    );

    expect(segments).toEqual([
      expect.objectContaining({
        id: "p1-s1",
        text: "Christian Poljac",
        isHeadingCandidate: false,
      }),
      expect.objectContaining({
        id: "p1-s2",
        text: "Senior Embedded-utvikler",
      }),
    ]);
  });

  it("avoids injecting spaces before punctuation and after hyphens", () => {
    const segments = buildCvPdfSegments(
      [
        { str: "C++", transform: [1, 0, 0, 1, 20, 700], width: 20, height: 10 },
        { str: ",", transform: [1, 0, 0, 1, 41, 700], width: 4, height: 10 },
        { str: "embedded-", transform: [1, 0, 0, 1, 20, 680], width: 50, height: 10 },
        { str: "linux", transform: [1, 0, 0, 1, 70, 680], width: 30, height: 10 },
      ],
      1,
    );

    expect(segments.map((segment) => segment.text)).toEqual(["C++,", "embedded-linux"]);
  });
});
