import { describe, expect, it } from "vitest";

import { buildCvShareClipboardText, buildCvShareUrl } from "@/lib/cvAccess";

describe("cvAccess", () => {
  it("builds a share URL from the current app origin", () => {
    expect(buildCvShareUrl("abc123", "http://localhost:8080")).toBe("http://localhost:8080/cv/abc123");
  });

  it("formats the clipboard payload with URL and 90 day PIN text", () => {
    expect(buildCvShareClipboardText("https://crm.stacq.no/cv/abc123", "4821")).toBe(
      "https://crm.stacq.no/cv/abc123\nPIN: 4821 (90 dagers varighet)",
    );
  });
});
