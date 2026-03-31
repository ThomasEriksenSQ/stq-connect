import { describe, expect, it } from "vitest";

import {
  areLikelyExternalDuplicates,
  buildExternalDuplicateGroups,
  matchExternalToEmployee,
  normalizeCandidateName,
  pickPrimaryExternalConsultant,
} from "@/lib/candidateIdentity";

describe("candidateIdentity", () => {
  it("normalizes nordic names consistently", () => {
    expect(normalizeCandidateName("Måns Ødegård")).toBe("maans oedegaard");
  });

  it("matches external consultants to employees on exact identity", () => {
    const match = matchExternalToEmployee(
      {
        id: "ext-1",
        navn: "Mattis Spieler Asp",
        epost: "mattis@stacq.no",
        telefon: "+47 900 11 222",
      },
      [
        {
          id: 12,
          navn: "Mattis Spieler Asp",
          epost: "mattis@stacq.no",
          tlf: "90011222",
        },
      ],
    );

    expect(match).not.toBeNull();
    expect(match?.employeeId).toBe(12);
    expect(match?.reasons).toEqual(expect.arrayContaining(["email", "phone", "name"]));
  });

  it("groups likely duplicate externals with the same identity", () => {
    const groups = buildExternalDuplicateGroups([
      {
        id: "ext-a",
        navn: "Kenneth Lindalen",
        rolle: "Embedded developer",
        teknologier: ["C++", "Yocto"],
      },
      {
        id: "ext-b",
        navn: "kenneth lindalen",
        rolle: "Embedded software developer",
        teknologier: ["Yocto", "Embedded Linux"],
      },
      {
        id: "ext-c",
        navn: "Anna Nordmann",
      },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].map((candidate) => candidate.id).sort()).toEqual(["ext-a", "ext-b"]);
  });

  it("keeps richer external records as primary", () => {
    const primary = pickPrimaryExternalConsultant([
      {
        id: "thin",
        navn: "Peder Ydalus",
        rolle: "Developer",
      },
      {
        id: "rich",
        navn: "Peder Ydalus",
        rolle: "Embedded software consultant",
        epost: "peder@example.com",
        telefon: "90011223",
        teknologier: ["C++", "Yocto", "Embedded Linux"],
        cv_tekst: "Long CV with embedded Linux, Yocto and C++ experience.",
      },
    ]);

    expect(primary.id).toBe("rich");
  });

  it("does not merge different people with similar names alone", () => {
    expect(
      areLikelyExternalDuplicates(
        {
          id: "left",
          navn: "Anders Olsen",
          rolle: "Firmware engineer",
          teknologier: ["C++"],
        },
        {
          id: "right",
          navn: "Anders Olsen",
          rolle: "Sales manager",
          teknologier: ["CRM"],
          selskap_tekst: "Commercial team",
        },
      ),
    ).toBe(false);
  });
});
