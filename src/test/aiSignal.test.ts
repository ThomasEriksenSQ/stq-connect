import { describe, expect, it } from "vitest";

import { parseAiSignalResult } from "@/lib/aiSignal";

describe("parseAiSignalResult", () => {
  it("accepts valid signal payloads and coerces nested text fields", () => {
    expect(
      parseAiSignalResult({
        anbefalt_signal: "Behov nå",
        begrunnelse: { text: "Nylig dialog om konkret behov" },
        konfidens: "høy",
        teknologier_funnet: ["C++", { label: "Zephyr" }],
        tidsramme: { value: "Q3 2026" },
      }),
    ).toEqual({
      anbefalt_signal: "Behov nå",
      begrunnelse: "Nylig dialog om konkret behov",
      konfidens: "høy",
      teknologier_funnet: ["C++", "Zephyr"],
      tidsramme: "Q3 2026",
    });
  });

  it("drops invalid payloads instead of returning render-breaking data", () => {
    expect(
      parseAiSignalResult({
        anbefalt_signal: "Absolutt kanskje",
        begrunnelse: "Hei",
        konfidens: "høy",
      }),
    ).toBeNull();
  });
});
