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
  | "cold_call";

export interface HuntConsultantLike {
  navn: string;
  kompetanse?: string[] | null;
  tilgjengelig_fra?: string | null;
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

const AVAILABILITY_BADGE_WINDOW_DAYS = 60;

function toDateOnly(dateStr: string) {
  const date = new Date(dateStr);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function hasConsultantAvailability(dateStr?: string | null): boolean {
  return getConsultantAvailabilityMeta(dateStr).isVisible;
}

export function getConsultantAvailabilityMeta(dateStr?: string | null): HuntAvailabilityMeta {
  if (!dateStr) {
    return {
      daysUntil: Number.POSITIVE_INFINITY,
      label: "Tilgjengelighetsdato mangler",
      tone: "unknown",
      isVisible: false,
    };
  }

  const availableFrom = toDateOnly(dateStr);
  const today = toDateOnly(new Date().toISOString());
  const diff = differenceInCalendarDays(availableFrom, today);
  const daysSinceAvailable = differenceInCalendarDays(today, availableFrom);

  if (diff > 0) {
    return {
      daysUntil: diff,
      label: `Tilgjengelig ${format(availableFrom, "d. MMM", { locale: nb })}`,
      tone: "later",
      isVisible: false,
    };
  }

  if (daysSinceAvailable > AVAILABILITY_BADGE_WINDOW_DAYS) {
    return {
      daysUntil: diff,
      label: "Tilgjengelighet utløpt",
      tone: "unknown",
      isVisible: false,
    };
  }

  if (diff <= 0) {
    return {
      daysUntil: 0,
      label: "Tilgjengelig nå",
      tone: "ready",
      isVisible: true,
    };
  }

  return {
    daysUntil: diff,
    label: "Tilgjengelighetsdato ukjent",
    tone: "unknown",
    isVisible: false,
  };
}

export function sortHuntConsultants<T extends HuntConsultantLike>(consultants: T[]): T[] {
  return [...consultants].sort((left, right) => {
    const leftAvailability = getConsultantAvailabilityMeta(left.tilgjengelig_fra);
    const rightAvailability = getConsultantAvailabilityMeta(right.tilgjengelig_fra);

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
