import { describe, expect, it } from "vitest";

import { buildAiSignalUserContent, parseAiSignalResult } from "@/lib/aiSignal";

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

describe("buildAiSignalUserContent", () => {
  it("serializes malformed activity and email fields without throwing", () => {
    expect(
      buildAiSignalUserContent({
        currentSignal: "Behov nå",
        contactName: "Jean-Noel",
        lastTaskDueDate: null,
        currentTechnologies: { label: "C++" },
        activities: [
          {
            created_at: { value: "2026-04-18T10:30:00.000Z" } as unknown as string,
            type: { label: "meeting" } as unknown as string,
            subject: { text: "Oppfølging etter demo" } as unknown as string,
          },
        ],
        emails: [
          {
            received_at: { value: "2026-04-19T09:00:00.000Z" } as unknown as string,
            subject: { value: "Re: Status" } as unknown as string,
            body_text: { content: "Trenger hjelp med neste steg." } as unknown as string,
          },
        ],
      }),
    ).toContain("- 2026-04-18: [meeting] Oppfølging etter demo");
  });
});
