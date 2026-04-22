import { describe, expect, it } from "vitest";

import { buildEmployeeAddressExportEntry } from "@/lib/employeeAddressPdf";

describe("buildEmployeeAddressExportEntry", () => {
  it("combines structured address fields into a printable line", () => {
    expect(
      buildEmployeeAddressExportEntry({
        navn: "Ada Lovelace",
        adresse: "Karl Johans gate 1",
        postnummer: "0154",
        poststed: "Oslo",
        geografi: null,
        epost: "ada@example.com",
        tlf: "12345678",
      }),
    ).toEqual({
      name: "Ada Lovelace",
      streetAddress: "Karl Johans gate 1",
      postalLine: "0154, Oslo",
      email: "ada@example.com",
      phone: "+47 12345678",
    });
  });

  it("falls back to legacy geography text and placeholder values", () => {
    expect(
      buildEmployeeAddressExportEntry({
        navn: " ",
        adresse: null,
        postnummer: null,
        poststed: null,
        geografi: "Hegsbroveien 8, 3413 Lier",
        epost: null,
        tlf: "",
      }),
    ).toEqual({
      name: "Ukjent ansatt",
      streetAddress: "Hegsbroveien 8",
      postalLine: "3413, Lier",
      email: "E-post mangler",
      phone: "Telefon mangler",
    });
  });
});
