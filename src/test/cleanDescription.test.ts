import { describe, expect, it } from "vitest";

import { cleanDescription } from "@/lib/cleanDescription";

describe("cleanDescription", () => {
  it("preserves paragraphs and line breaks in activity notes", () => {
    expect(cleanDescription("Første punkt\n\nAndre punkt\nTredje punkt")).toBe(
      "Første punkt\n\nAndre punkt\nTredje punkt",
    );
  });

  it("normalizes noisy horizontal spacing without flattening paragraphs", () => {
    expect(cleanDescription("  Første    punkt  \n\n\n  Andre\tpunkt  ")).toBe("Første punkt\n\nAndre punkt");
  });
});
