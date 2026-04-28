import { describe, expect, it } from "vitest";

import { cleanCompanyImportNoteHeaders, hasCompanyImportNoteHeaders } from "@/lib/companyNotes";

describe("cleanCompanyImportNoteHeaders", () => {
  it("removes imported must-have/source/NACE headers and preserves people info", () => {
    expect(
      cleanCompanyImportNoteHeaders(
        [
          "[Must-have]",
          "Kilde: LinkedIn-import",
          "NACE: 30.110 Bygging av sivile skip og flytende materiell",
          "Ansatte: 3844",
          "Kontaktpersoner: 85 27 00 00",
        ].join("\n"),
      ),
    ).toBe(["Ansatte: 3844", "Kontaktpersoner: 85 27 00 00"].join("\n"));
  });

  it("handles common spacing and casing variants", () => {
    expect(
      cleanCompanyImportNoteHeaders(
        [" [ must have ] ", "Kilde Linkedin import", "nace 32.500 Produksjon av instrumenter", "Eget notat"].join(
          "\n",
        ),
      ),
    ).toBe("Eget notat");
  });

  it("detects import headers without flagging ordinary notes", () => {
    expect(hasCompanyImportNoteHeaders("NACE: 32.500 Produksjon av instrumenter")).toBe(true);
    expect(hasCompanyImportNoteHeaders("Ansatte: 6\nKontaktpersoner: Espen Westgaard / +47 920 41 000")).toBe(false);
  });
});
