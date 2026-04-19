import { addDays, format, startOfDay } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

export type OppdragPersonType = "ansatt" | "ekstern";
export type OppdragStatus = "Aktiv" | "Oppstart" | "Inaktiv";

export interface OppdragFormState {
  kandidat: string;
  personType: OppdragPersonType;
  ansattId: number | null;
  eksternId: string | null;
  status: string;
  dealType: string;
  utpris: string;
  tilKonsulent: string;
  fornyDato: Date | undefined;
  startDato: Date | undefined;
  sluttDato: Date | undefined;
  kommentar: string;
  selskapId: string | null;
  selskapNavn: string | null;
  isLopende: boolean;
}

export interface OppdragWriteOptions {
  allowMissingRelation?: boolean;
}

type OppdragInsert = Database["public"]["Tables"]["stacq_oppdrag"]["Insert"];

export const OPPDRAG_DEFAULTS: OppdragFormState = {
  kandidat: "",
  personType: "ansatt",
  ansattId: null,
  eksternId: null,
  status: "Oppstart",
  dealType: "DIR",
  utpris: "",
  tilKonsulent: "",
  fornyDato: undefined,
  startDato: undefined,
  sluttDato: undefined,
  kommentar: "",
  selskapId: null,
  selskapNavn: null,
  isLopende: false,
};

function toNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const compact = trimmed.replace(/\s+/g, "");
  const normalized =
    compact.includes(",") && compact.includes(".")
      ? compact.replace(/\./g, "").replace(",", ".")
      : compact.replace(",", ".");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function toIsoDate(value: Date | string | undefined | null): string | null {
  if (!value) return null;
  if (typeof value === "string") return value || null;
  return format(value, "yyyy-MM-dd");
}

function getRenewalDate(value: OppdragFormState): string | null {
  if (value.isLopende) {
    return format(addDays(new Date(), 30), "yyyy-MM-dd");
  }
  return toIsoDate(value.fornyDato);
}

function hasSelectedPerson(value: OppdragFormState): boolean {
  return value.personType === "ansatt" ? value.ansattId !== null : value.eksternId !== null;
}

export function parseOppdragDate(value?: string | null): Date | null {
  if (!value) return null;
  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export function computeOppdragStatus(input: {
  status?: string | null;
  start_dato?: string | null;
  slutt_dato?: string | null;
}): OppdragStatus {
  const today = startOfDay(new Date());
  const slutt = parseOppdragDate(input.slutt_dato);
  const start = parseOppdragDate(input.start_dato);

  // Sluttdato passert → Inaktiv
  if (slutt && slutt < today) return "Inaktiv";

  // Startdato i fremtiden → Oppstart
  if (start && start > today) return "Oppstart";

  // Har gyldig dato-grunnlag for å være aktivt
  if (start || slutt) return "Aktiv";

  // Ingen datoer satt — respekter eksisterende manuell Inaktiv
  if (input.status === "Inaktiv") return "Inaktiv";

  return "Aktiv";
}

export function createOppdragFormState(
  overrides: Partial<OppdragFormState> = {},
): OppdragFormState {
  return {
    ...OPPDRAG_DEFAULTS,
    ...overrides,
  };
}

export function buildOppdragWritePayload(
  value: OppdragFormState,
  options: OppdragWriteOptions = {},
): OppdragInsert {
  const kandidat = value.kandidat.trim();

  if (!kandidat) {
    throw new Error("Velg konsulent først");
  }

  if (!options.allowMissingRelation && !hasSelectedPerson(value)) {
    throw new Error("Velg intern eller ekstern konsulent først");
  }

  const startIso = toIsoDate(value.startDato);
  const sluttIso = toIsoDate(value.sluttDato);

  const derivedStatus = computeOppdragStatus({
    status: value.status,
    start_dato: startIso,
    slutt_dato: sluttIso,
  });

  return {
    kandidat,
    er_ansatt: value.personType === "ansatt",
    ansatt_id: value.personType === "ansatt" ? value.ansattId : null,
    ekstern_id: value.personType === "ekstern" ? value.eksternId : null,
    status: derivedStatus,
    deal_type: value.dealType || OPPDRAG_DEFAULTS.dealType,
    utpris: toNullableNumber(value.utpris),
    til_konsulent: toNullableNumber(value.tilKonsulent),
    lopende_30_dager: value.isLopende,
    forny_dato: getRenewalDate(value),
    start_dato: startIso,
    slutt_dato: sluttIso,
    kunde: value.selskapNavn?.trim() || null,
    selskap_id: value.selskapId,
    kommentar: value.kommentar.trim() || null,
  };
}
