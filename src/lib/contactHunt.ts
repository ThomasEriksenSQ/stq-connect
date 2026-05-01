import { differenceInCalendarDays, differenceInDays, format } from "date-fns";
import { nb } from "date-fns/locale";

import { mergeTechnologyTags } from "@/lib/technologyTags";

export type HuntChipValue =
  | "alle"
  | "foresporsler"
  | "finn"
  | "siste_aktivitet"
  | "innkjoper"
  | "kunder"
  | "cold_call"
  | "geografi";

export interface HuntConsultantLike {
  navn: string;
  kompetanse?: string[] | null;
  tilgjengelig_fra?: string | null;
  availability_blocked_until?: string | null;
  geografi?: string | null;
  adresse?: string | null;
  postnummer?: string | null;
  poststed?: string | null;
}

export interface HuntContactLike {
  daysSinceLastContact: number;
  openTaskCount: number;
  isIkkeAktuellKontakt?: boolean;
  contactTechnologies?: string[] | null;
  companyTechnologies?: string[] | null;
}

export interface HuntAvailabilityMeta {
  daysUntil: number;
  label: string;
  tone: "ready" | "soon" | "later" | "unknown";
  isVisible: boolean;
}

export interface HuntAssignmentAvailabilityLike {
  ansatt_id?: number | null;
  slutt_dato?: string | null;
  forny_dato?: string | null;
}

function toDateOnly(dateStr: string) {
  const date = new Date(dateStr);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getLaterDateString(left?: string | null, right?: string | null) {
  if (!left) return right || null;
  if (!right) return left;
  return new Date(right).getTime() > new Date(left).getTime() ? right : left;
}

export function getConsultantAvailabilityBlockDates(rows: HuntAssignmentAvailabilityLike[]) {
  const byAnsattId = new Map<number, string>();

  rows.forEach((row) => {
    if (!row.ansatt_id) return;
    const assignmentEnd = getLaterDateString(row.slutt_dato, row.forny_dato);
    if (!assignmentEnd) return;
    byAnsattId.set(row.ansatt_id, getLaterDateString(byAnsattId.get(row.ansatt_id), assignmentEnd) || assignmentEnd);
  });

  return byAnsattId;
}

function getEffectiveAvailableFrom(availableFrom: Date, blockedUntilStr: string | null | undefined, today: Date) {
  if (!blockedUntilStr) return availableFrom;

  const blockedUntil = toDateOnly(blockedUntilStr);
  const blockedUntilIsFuture = differenceInCalendarDays(blockedUntil, today) > 0;
  const blockedUntilIsLater = differenceInCalendarDays(blockedUntil, availableFrom) > 0;
  return blockedUntilIsFuture && blockedUntilIsLater ? blockedUntil : availableFrom;
}

export function hasConsultantAvailability(dateStr?: string | null, blockedUntilStr?: string | null): boolean {
  return getConsultantAvailabilityMeta(dateStr, blockedUntilStr).isVisible;
}

export function getConsultantAvailabilityMeta(
  dateStr?: string | null,
  blockedUntilStr?: string | null,
  todayDate = new Date(),
): HuntAvailabilityMeta {
  if (!dateStr) {
    return {
      daysUntil: Number.POSITIVE_INFINITY,
      label: "Tilgjengelighetsdato mangler",
      tone: "unknown",
      isVisible: false,
    };
  }

  const availableFrom = toDateOnly(dateStr);
  const today = toDateOnly(todayDate.toISOString());
  const effectiveAvailableFrom = getEffectiveAvailableFrom(availableFrom, blockedUntilStr, today);
  const diff = differenceInCalendarDays(effectiveAvailableFrom, today);

  if (diff > 0) {
    const tone: HuntAvailabilityMeta["tone"] = diff <= 30 ? "soon" : "later";
    return {
      daysUntil: diff,
      label: `Tilgjengelig ${format(effectiveAvailableFrom, "d. MMM", { locale: nb })}`,
      tone,
      isVisible: true,
    };
  }

  if (diff === 0) {
    return {
      daysUntil: 0,
      label: "Tilgjengelig nå",
      tone: "ready",
      isVisible: true,
    };
  }

  return {
    daysUntil: diff,
    label: "Tilgjengelighet utløpt",
    tone: "unknown",
    isVisible: true,
  };
}

export function sortHuntConsultants<T extends HuntConsultantLike>(consultants: T[]): T[] {
  return [...consultants].sort((left, right) => {
    const leftAvailability = getConsultantAvailabilityMeta(left.tilgjengelig_fra, left.availability_blocked_until);
    const rightAvailability = getConsultantAvailabilityMeta(right.tilgjengelig_fra, right.availability_blocked_until);

    if (leftAvailability.daysUntil !== rightAvailability.daysUntil) {
      return leftAvailability.daysUntil - rightAvailability.daysUntil;
    }

    return left.navn.localeCompare(right.navn, "nb");
  });
}

export function getTechnologyMatchTags(
  leftTechnologies?: string[] | null,
  rightTechnologies?: string[] | null,
): string[] {
  const leftTags = new Set(mergeTechnologyTags(leftTechnologies || []));
  if (leftTags.size === 0) return [];

  const rightTags = mergeTechnologyTags(rightTechnologies || []);
  return rightTags.filter((tag) => leftTags.has(tag));
}

export function getConsultantMatchTags(
  consultant: HuntConsultantLike,
  contact: Pick<HuntContactLike, "contactTechnologies" | "companyTechnologies">,
): string[] {
  return getTechnologyMatchTags(
    consultant.kompetanse || [],
    mergeTechnologyTags(contact.contactTechnologies || [], contact.companyTechnologies || []),
  );
}

export function hasRecentActivity(daysSinceLastContact: number, openTaskCount: number): boolean {
  return (
    openTaskCount > 0 ||
    (daysSinceLastContact >= 0 && daysSinceLastContact !== 999 && daysSinceLastContact <= 30)
  );
}

export function hasRecentActualActivity(daysSinceLastContact: number, windowDays = 45): boolean {
  return daysSinceLastContact >= 0 && daysSinceLastContact !== 999 && daysSinceLastContact <= windowDays;
}

export function isActiveRequest(mottattDato?: string | null, status?: string | null, activeWindowDays = 45): boolean {
  if (!mottattDato) return false;

  const normalized = String(status || "").toLowerCase();
  if (normalized === "avsluttet" || normalized === "tapt") return false;

  return differenceInDays(new Date(), new Date(mottattDato)) <= activeWindowDays;
}

export function isColdCallCandidate(contact: Pick<HuntContactLike, "daysSinceLastContact" | "openTaskCount" | "isIkkeAktuellKontakt">): boolean {
  return (
    contact.openTaskCount === 0 &&
    (contact.daysSinceLastContact === 999 || contact.daysSinceLastContact > 90) &&
    !contact.isIkkeAktuellKontakt
  );
}

export function isCustomerCompany(status?: string | null): boolean {
  const normalized = String(status || "").toLowerCase();
  return normalized === "customer" || normalized === "kunde";
}

export function isProspectCompany(status?: string | null): boolean {
  const normalized = String(status || "").toLowerCase();
  return normalized === "prospect" || normalized === "potensiell kunde" || normalized === "potensiell";
}

export function isProspectOrCustomerCompany(status?: string | null): boolean {
  return isProspectCompany(status) || isCustomerCompany(status);
}
