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

  it("splits wide multi-column lines into separate segments", () => {
    const segments = buildCvPdfSegments(
      [
        { str: "•", transform: [1, 0, 0, 1, 16, 620], width: 4, height: 10 },
        { str: "Norsk, morsmål", transform: [1, 0, 0, 1, 24, 620], width: 70, height: 10 },
        { str: "Anders er en senior Embedded-ingeniør", transform: [1, 0, 0, 1, 190, 620], width: 210, height: 12 },
      ],
      1,
    );

    expect(segments.map((segment) => segment.text)).toEqual([
      "• Norsk, morsmål",
      "Anders er en senior Embedded-ingeniør",
    ]);
  });

  it("normalizes spaced label-like segments without touching paragraphs", () => {
    const segments = buildCvPdfSegments(
      [
        { str: "K", transform: [1, 0, 0, 1, 20, 700], width: 8, height: 16 },
        { str: "I", transform: [1, 0, 0, 1, 31, 700], width: 5, height: 16 },
        { str: "W", transform: [1, 0, 0, 1, 42, 700], width: 12, height: 16 },
        { str: "I", transform: [1, 0, 0, 1, 57, 700], width: 5, height: 16 },
        { str: ".", transform: [1, 0, 0, 1, 67, 700], width: 4, height: 16 },
        { str: "K", transform: [1, 0, 0, 1, 79, 700], width: 8, height: 16 },
        { str: "I", transform: [1, 0, 0, 1, 90, 700], width: 5, height: 16 },
        { str: "G", transform: [1, 0, 0, 1, 104, 700], width: 9, height: 16 },
        { str: "m", transform: [1, 0, 0, 1, 116, 700], width: 9, height: 16 },
        { str: "b", transform: [1, 0, 0, 1, 128, 700], width: 8, height: 16 },
        { str: "H", transform: [1, 0, 0, 1, 140, 700], width: 9, height: 16 },
        { str: "Anders er en senior Embedded-ingeniør", transform: [1, 0, 0, 1, 190, 660], width: 240, height: 12 },
      ],
      1,
    );

    expect(segments.map((segment) => segment.text)).toEqual([
      "KIWI.KI GmbH",
      "Anders er en senior Embedded-ingeniør",
    ]);
  });
});
