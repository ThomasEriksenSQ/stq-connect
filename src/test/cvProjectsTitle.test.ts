import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROJECTS_SECTION_TITLE,
  getProjectsSectionTitle,
  normalizeProjectsSectionTitle,
} from "@/lib/cvProjectsTitle";

describe("cv project section title", () => {
  it("treats the legacy CV database default as empty", () => {
    expect(normalizeProjectsSectionTitle("CV")).toBe("");
    expect(normalizeProjectsSectionTitle("  CV  ")).toBe("");
  });

  it("falls back to the default projects heading when empty", () => {
    expect(getProjectsSectionTitle("")).toBe(DEFAULT_PROJECTS_SECTION_TITLE);
    expect(getProjectsSectionTitle(undefined)).toBe(DEFAULT_PROJECTS_SECTION_TITLE);
  });

  it("keeps a custom projects heading", () => {
    expect(normalizeProjectsSectionTitle(" Kundereferanser ")).toBe("Kundereferanser");
    expect(getProjectsSectionTitle(" Kundereferanser ")).toBe("Kundereferanser");
  });
});
