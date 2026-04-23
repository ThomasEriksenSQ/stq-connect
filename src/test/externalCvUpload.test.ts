import { describe, expect, it } from "vitest";

import { sanitizeExtractedCvTechnologies } from "@/lib/externalCvUpload";

describe("sanitizeExtractedCvTechnologies", () => {
  it("removes candidate names and CV section headings from technology tags", () => {
    expect(
      sanitizeExtractedCvTechnologies(
        [
          "Henrik Hole Olsson",
          "Sammendrag",
          "Kompetanse",
          "Git",
          "CI/CD",
          "YAML",
          "Pulumi",
          "Azure Devops",
          "Github Actions",
        ],
        "Henrik Hole Olsson",
      ),
    ).toEqual([
      "Git",
      "CI/CD",
      "YAML",
      "Pulumi",
      "Azure Devops",
      "Github Actions",
    ]);
  });
});
