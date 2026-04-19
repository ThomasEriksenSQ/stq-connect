import { describe, expect, it } from "vitest";
import { addDays, format } from "date-fns";
import { buildOppdragWritePayload, createOppdragFormState } from "@/lib/oppdragForm";

describe("oppdragForm", () => {
  it("builds payload for ansatte with relation", () => {
    const payload = buildOppdragWritePayload(
      createOppdragFormState({
        kandidat: "Anders Nilsen",
        personType: "ansatt",
        ansattId: 5,
        selskapNavn: "Autostore",
        selskapId: "company-1",
        utpris: "1 500,50",
        tilKonsulent: "1 050",
      }),
    );

    expect(payload.ansatt_id).toBe(5);
    expect(payload.ekstern_id).toBeNull();
    expect(payload.er_ansatt).toBe(true);
    expect(payload.kandidat).toBe("Anders Nilsen");
    expect(payload.utpris).toBe(1500.5);
    expect(payload.til_konsulent).toBe(1050);
  });

  it("builds payload for eksterne with relation", () => {
    const payload = buildOppdragWritePayload(
      createOppdragFormState({
        kandidat: "Lars Ødegård",
        personType: "ekstern",
        eksternId: "external-1",
      }),
    );

    expect(payload.ansatt_id).toBeNull();
    expect(payload.ekstern_id).toBe("external-1");
    expect(payload.er_ansatt).toBe(false);
  });

  it("allows legacy updates without relation when explicitly allowed", () => {
    const payload = buildOppdragWritePayload(
      createOppdragFormState({
        kandidat: "Ukjent kandidat",
        personType: "ansatt",
      }),
      { allowMissingRelation: true },
    );

    expect(payload.kandidat).toBe("Ukjent kandidat");
    expect(payload.ansatt_id).toBeNull();
  });

  it("requires selected person for new oppdrag", () => {
    expect(() =>
      buildOppdragWritePayload(
        createOppdragFormState({
          kandidat: "Ukjent kandidat",
          personType: "ansatt",
        }),
      ),
    ).toThrow("Velg intern eller ekstern konsulent først");
  });

  it("derives status Inaktiv when sluttdato is in the past", () => {
    const payload = buildOppdragWritePayload(
      createOppdragFormState({
        kandidat: "Anders Nilsen",
        personType: "ansatt",
        ansattId: 5,
        status: "Aktiv",
        startDato: addDays(new Date(), -60),
        sluttDato: addDays(new Date(), -1),
      }),
    );

    expect(payload.status).toBe("Inaktiv");
    expect(payload.slutt_dato).toBe(format(addDays(new Date(), -1), "yyyy-MM-dd"));
  });

  it("derives status Oppstart when startdato is in the future", () => {
    const payload = buildOppdragWritePayload(
      createOppdragFormState({
        kandidat: "Anders Nilsen",
        personType: "ansatt",
        ansattId: 5,
        status: "Aktiv",
        startDato: addDays(new Date(), 7),
      }),
    );

    expect(payload.status).toBe("Oppstart");
  });

  it("derives status Aktiv when startdato is today and no sluttdato", () => {
    const payload = buildOppdragWritePayload(
      createOppdragFormState({
        kandidat: "Anders Nilsen",
        personType: "ansatt",
        ansattId: 5,
        status: "Oppstart",
        startDato: new Date(),
      }),
    );

    expect(payload.status).toBe("Aktiv");
  });

  it("reactivates Inaktiv oppdrag when sluttdato is moved to the future", () => {
    const payload = buildOppdragWritePayload(
      createOppdragFormState({
        kandidat: "Anders Nilsen",
        personType: "ansatt",
        ansattId: 5,
        status: "Inaktiv",
        startDato: addDays(new Date(), -30),
        sluttDato: addDays(new Date(), 30),
      }),
    );

    expect(payload.status).toBe("Aktiv");
  });
});
