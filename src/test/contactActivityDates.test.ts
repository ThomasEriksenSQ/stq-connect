import { describe, expect, it } from "vitest";

import { updateLatestContactActivityDate } from "@/lib/contactActivityDates";

describe("updateLatestContactActivityDate", () => {
  it("keeps the newest past date from mixed activity sources", () => {
    const latestByContact: Record<string, string> = {};
    const now = new Date("2026-04-30T12:00:00.000Z");

    updateLatestContactActivityDate(latestByContact, "contact-1", "2026-03-15T09:00:00.000Z", now);
    updateLatestContactActivityDate(latestByContact, "contact-1", "2026-04-30T08:00:00.000Z", now);

    expect(latestByContact["contact-1"]).toBe("2026-04-30T08:00:00.000Z");
  });

  it("ignores future and invalid dates", () => {
    const latestByContact: Record<string, string> = {};
    const now = new Date("2026-04-30T12:00:00.000Z");

    updateLatestContactActivityDate(latestByContact, "contact-1", "2026-04-29T08:00:00.000Z", now);
    updateLatestContactActivityDate(latestByContact, "contact-1", "2026-05-01T08:00:00.000Z", now);
    updateLatestContactActivityDate(latestByContact, "contact-1", "not-a-date", now);

    expect(latestByContact["contact-1"]).toBe("2026-04-29T08:00:00.000Z");
  });
});
