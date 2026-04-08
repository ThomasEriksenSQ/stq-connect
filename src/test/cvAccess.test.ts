import { afterEach, describe, expect, it, vi } from "vitest";

import { buildCvShareClipboardText, buildCvShareUrl, copyTextToClipboard } from "@/lib/cvAccess";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cvAccess", () => {
  it("builds a share URL from the current app origin", () => {
    expect(buildCvShareUrl("abc123", "http://localhost:8080")).toBe("http://localhost:8080/cv/abc123");
  });

  it("formats the clipboard payload with URL and 90 day PIN text", () => {
    expect(buildCvShareClipboardText("https://crm.stacq.no/cv/abc123", "4821")).toBe(
      "https://crm.stacq.no/cv/abc123\nPIN: 4821 (90 dagers varighet)",
    );
  });

  it("copies the full multiline share payload with execCommand when available", async () => {
    let copiedValue = "";
    const execCommand = vi.fn(() => {
      const activeElement = document.activeElement as HTMLTextAreaElement | null;
      copiedValue = activeElement?.value ?? "";
      return true;
    });

    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });

    await copyTextToClipboard("https://crm.stacq.no/cv/abc123\nPIN: 4821 (90 dagers varighet)");

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(copiedValue).toBe("https://crm.stacq.no/cv/abc123\nPIN: 4821 (90 dagers varighet)");
  });
});
