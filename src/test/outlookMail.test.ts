import { describe, expect, it } from "vitest";

import { coerceDisplayText, normalizeOutlookMailItems } from "@/lib/outlookMail";

describe("coerceDisplayText", () => {
  it("joins nested arrays and objects into render-safe text", () => {
    expect(
      coerceDisplayText([
        { emailAddress: { address: "thomas@stacq.no" } },
        { name: "Thomas Eriksen" },
        "Hei",
      ]),
    ).toBe("thomas@stacq.no, Thomas Eriksen, Hei");
  });
});

describe("normalizeOutlookMailItems", () => {
  it("normalizes mixed payload shapes without leaking objects into the UI", () => {
    expect(
      normalizeOutlookMailItems([
        {
          id: 42,
          subject: { value: "Svar på forespørsel" },
          date: "2026-04-18T09:15:00.000Z",
          from: { emailAddress: { name: "Jean-Noel", address: "jean@example.com" } },
          toRecipients: [
            { emailAddress: { address: "thomas@stacq.no" } },
            { emailAddress: { address: "team@stacq.no" } },
          ],
          bodyPreview: { text: "Kort preview" },
          body: { content: "Hele meldingen" },
        },
      ]),
    ).toEqual([
      {
        id: "42",
        subject: "Svar på forespørsel",
        receivedAt: "2026-04-18T09:15:00.000Z",
        from: "Jean-Noel",
        fromName: "",
        to: "thomas@stacq.no, team@stacq.no",
        preview: "Kort preview",
        bodyText: "Hele meldingen",
        isRead: false,
      },
    ]);
  });
});
