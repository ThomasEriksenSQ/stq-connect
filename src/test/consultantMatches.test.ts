import { describe, expect, it } from "vitest";

import {
  filterConsultantMatches,
  formatConsultantMatchFreshness,
  getConsultantMatchScoreColor,
  sortConsultantMatches,
  type ConsultantMatchLike,
} from "@/lib/consultantMatches";

const MATCHES: ConsultantMatchLike[] = [
  {
    id: 3,
    navn: "Anders Test",
    type: "intern",
    score: 9,
    begrunnelse: "Sterk match",
    match_tags: ["C++"],
  },
  {
    id: 9,
    navn: "Zara Test",
    type: "ekstern",
    score: 7,
    begrunnelse: "Solid match",
    match_tags: ["Embedded Linux"],
  },
];

describe("consultantMatches", () => {
  it("filters consultant matches by source chip", () => {
    expect(filterConsultantMatches(MATCHES, "Alle")).toHaveLength(2);
    expect(filterConsultantMatches(MATCHES, "Ansatte")).toEqual([MATCHES[0]]);
    expect(filterConsultantMatches(MATCHES, "Eksterne")).toEqual([MATCHES[1]]);
  });

  it("sorts consultant matches deterministically", () => {
    expect(
      sortConsultantMatches([
        { ...MATCHES[1], score: 9 },
        { ...MATCHES[0], score: 9 },
      ]),
    ).toEqual([
      MATCHES[0],
      { ...MATCHES[1], score: 9 },
    ]);
  });

  it("returns stable score colors", () => {
    expect(getConsultantMatchScoreColor(9)).toBe("bg-emerald-500");
    expect(getConsultantMatchScoreColor(6)).toBe("bg-amber-500");
    expect(getConsultantMatchScoreColor(3)).toBe("bg-red-500");
  });

  it("formats freshness labels for current-session match runs", () => {
    expect(formatConsultantMatchFreshness(null)).toBeNull();
    expect(formatConsultantMatchFreshness(new Date().toISOString())).toBe("Sist kjørt nå");
  });
});
