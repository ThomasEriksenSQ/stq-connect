import { describe, expect, it } from "vitest";

import { getEffectiveSignal } from "@/lib/categoryUtils";

describe("getEffectiveSignal", () => {
  it("handles malformed activity payloads without crashing and still resolves the signal", () => {
    expect(
      getEffectiveSignal(
        [
          {
            created_at: { value: "2026-04-18T10:30:00.000Z" } as unknown as string,
            subject: { label: "Behov nå" } as unknown as string,
            description: null,
          },
          {
            created_at: "2026-04-10T08:00:00.000Z",
            subject: "Vanlig aktivitet",
            description: { text: "[Får kanskje behov]\nBa om kontakt senere." } as unknown as string,
          },
        ],
        [],
      ),
    ).toBe("Behov nå");
  });

  it("handles malformed task payloads without relying on raw localeCompare", () => {
    expect(
      getEffectiveSignal(
        [],
        [
          {
            created_at: "2026-04-01T09:00:00.000Z",
            updated_at: { value: "2026-04-02T09:00:00.000Z" } as unknown as string,
            title: { label: "Følg opp om behov" } as unknown as string,
            description: { text: "[Får fremtidig behov]\nPlanlagt oppfølging i juni." } as unknown as string,
            due_date: { value: "2026-06-01" } as unknown as string,
            status: "open",
          },
        ],
      ),
    ).toBe("Får fremtidig behov");
  });
});
