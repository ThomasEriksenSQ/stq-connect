import { describe, expect, it } from "vitest";

import {
  getExternalRecipientEmails,
  isExternalEmailAddress,
  matchSentCvEmployees,
  normalizeEmailAddress,
} from "@/lib/sentCvMatching";

describe("normalizeEmailAddress", () => {
  it("normalizes casing and whitespace", () => {
    expect(normalizeEmailAddress("  Thomas@Example.com ")).toBe("thomas@example.com");
  });
});

describe("isExternalEmailAddress", () => {
  it("filters out internal stacq domains", () => {
    expect(isExternalEmailAddress("thomas@stacq.no")).toBe(false);
    expect(isExternalEmailAddress("bot@alerts.stacq.no")).toBe(false);
    expect(isExternalEmailAddress("kunde@example.com")).toBe(true);
  });
});

describe("getExternalRecipientEmails", () => {
  it("returns unique external recipients only", () => {
    expect(
      getExternalRecipientEmails([
        "kunde@example.com",
        "KUNDE@example.com",
        "jr@stacq.no",
        "team@stacq.no",
        null,
      ]),
    ).toEqual(["kunde@example.com"]);
  });
});

describe("matchSentCvEmployees", () => {
  const employees = [
    { id: 9, navn: "Mattis Spieler Asp" },
    { id: 14, navn: "Trine Ødegård Olsen" },
  ];

  it("matches employees by attachment name", () => {
    expect(
      matchSentCvEmployees({
        attachmentNames: ["CV - Mattis Spieler Asp - STACQ.pdf"],
        employees,
      }),
    ).toEqual([
      {
        employeeId: 9,
        attachmentName: "CV - Mattis Spieler Asp - STACQ.pdf",
        matchedBy: "attachment-name",
        score: 120,
      },
    ]);
  });

  it("handles nordic characters in attachment names", () => {
    expect(
      matchSentCvEmployees({
        attachmentNames: ["CV - Trine Odegard Olsen - STACQ.pdf"],
        employees,
      }),
    ).toMatchObject([
      {
        employeeId: 14,
        attachmentName: "CV - Trine Odegard Olsen - STACQ.pdf",
        matchedBy: "attachment-name",
      },
    ]);
  });

  it("supports multiple employee attachments in one email", () => {
    expect(
      matchSentCvEmployees({
        attachmentNames: [
          "CV - Mattis Spieler Asp - STACQ.pdf",
          "CV - Trine Odegard Olsen - STACQ.pdf",
        ],
        employees,
      }),
    ).toMatchObject([
      {
        employeeId: 9,
        attachmentName: "CV - Mattis Spieler Asp - STACQ.pdf",
        matchedBy: "attachment-name",
      },
      {
        employeeId: 14,
        attachmentName: "CV - Trine Odegard Olsen - STACQ.pdf",
        matchedBy: "attachment-name",
      },
    ]);
  });

  it("falls back to message context only for single-attachment emails", () => {
    expect(
      matchSentCvEmployees({
        attachmentNames: ["CV.pdf"],
        subject: "Profil av Mattis Spieler Asp",
        employees,
      }),
    ).toEqual([
      {
        employeeId: 9,
        attachmentName: "CV.pdf",
        matchedBy: "message-context",
        score: 120,
      },
    ]);
  });
});
