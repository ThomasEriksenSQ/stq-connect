import { describe, expect, it } from "vitest";

import {
  buildMatchingProfile,
  normalizeMatchingTags,
  sanitizeAiMatchResults,
} from "../../supabase/functions/_shared/matchingProfile.ts";

describe("matchingProfile", () => {
  it("sorts concrete technologies before domain tags", () => {
    expect(
      normalizeMatchingTags([
        "uav",
        "embedded linux",
        "c++",
        "automation",
        "gis",
      ]),
    ).toEqual(["C++", "Embedded Linux", "Automation", "GIS", "UAV"]);
  });

  it("builds a prompt-friendly profile split into technologies and domains", () => {
    expect(
      buildMatchingProfile(["c++", "embedded linux", "uav", "gis"]),
    ).toEqual({
      tags: ["C++", "Embedded Linux", "GIS", "UAV"],
      technologyTags: ["C++", "Embedded Linux"],
      domainTags: ["GIS", "UAV"],
      promptText: "Teknologier: C++, Embedded Linux | Domener: GIS, UAV",
    });
  });

  it("sanitizes AI match tags down to canonical overlap", () => {
    const results = sanitizeAiMatchResults(
      [
        {
          id: 12,
          navn: "Test Konsulent",
          score: "8",
          begrunnelse: "Sterk match på embedded linux og drone-teknologi i flere prosjekter",
          match_tags: ["embedded linux", "uav", "bear metal as a service"],
          type: "intern",
        },
      ],
      {
        targetTags: ["Embedded Linux", "UAV", "GIS"],
        sourcesById: new Map([
          ["12", { tags: ["C++", "Embedded Linux", "Drone"], type: "intern" }],
        ]),
        allowedTypes: new Set(["intern", "ekstern"]),
      },
    );

    expect(results).toEqual([
      {
        id: 12,
        navn: "Test Konsulent",
        type: "intern",
        score: 8,
        begrunnelse: "Sterk match på embedded linux og drone-teknologi i flere prosjekter",
        match_tags: ["Embedded Linux", "UAV"],
      },
    ]);
  });

  it("deduplicates repeated consultant results and sorts deterministically", () => {
    const results = sanitizeAiMatchResults(
      [
        {
          id: 9,
          navn: "Zara Test",
          score: 7,
          begrunnelse: "Solid match",
          match_tags: ["C++"],
          type: "intern",
        },
        {
          id: 3,
          navn: "Anders Test",
          score: 9,
          begrunnelse: "Sterk match",
          match_tags: ["Embedded Linux", "C++"],
          type: "intern",
        },
        {
          id: 3,
          navn: "Anders Test",
          score: 8,
          begrunnelse: "Svakere duplikat",
          match_tags: ["C++"],
          type: "intern",
        },
      ],
      {
        targetTags: ["Embedded Linux", "C++"],
        sourcesById: new Map([
          ["3", { tags: ["Embedded Linux", "C++"], type: "intern" }],
          ["9", { tags: ["C++"], type: "intern" }],
        ]),
        allowedTypes: new Set(["intern", "ekstern"]),
      },
    );

    expect(results).toEqual([
      {
        id: 3,
        navn: "Anders Test",
        type: "intern",
        score: 9,
        begrunnelse: "Sterk match",
        match_tags: ["C++", "Embedded Linux"],
      },
      {
        id: 9,
        navn: "Zara Test",
        type: "intern",
        score: 7,
        begrunnelse: "Solid match",
        match_tags: ["C++"],
      },
    ]);
  });
});
