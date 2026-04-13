import type { Database } from "@/integrations/supabase/types";
import type { HuntChipValue } from "@/lib/contactHunt";
import type { ConfidenceBand, MatchBand } from "@/lib/contactMatchScore";
import type { MatchLeadOwnerSource } from "@/lib/matchLeadOwners";

export type SortField = "name" | "company" | "title" | "signal" | "owner" | "last_activity" | "priority";
export type SortDir = "asc" | "desc";
export type HuntSortField = "default" | "match" | "varme";

export type HuntConsultant = Pick<
  Database["public"]["Tables"]["stacq_ansatte"]["Row"],
  "id" | "navn" | "status" | "tilgjengelig_fra" | "kompetanse"
>;

export type OwnerPreview = { id: string; full_name: string } | null;

export type CompanyPreview = Pick<
  Database["public"]["Tables"]["companies"]["Row"],
  "id" | "name" | "status" | "ikke_relevant" | "owner_id"
> & {
  profiles: OwnerPreview;
};

export type MatchLeadBase = {
  leadKey: string;
  leadType: "contact" | "company" | "request";
  companyId: string | null;
  companyName: string;
  matchScore10: number;
  matchBand: MatchBand | null;
  confidenceScore: number;
  confidenceBand: ConfidenceBand;
  matchSources: HuntChipValue[];
  matchTags: string[];
  sourceDates: string[];
  chipUrgency: number;
  summary: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerSource: MatchLeadOwnerSource;
};

export type CompanyMatchLead = MatchLeadBase & {
  leadType: "company";
  companyId: string;
  name: string;
  status: string | null;
  companyTechnologyTags: string[];
  preferredContactName?: string | null;
  preferredContactTitle?: string | null;
};

export type RequestLeadRow = {
  id: number;
  companyId: string | null;
  contactId: string | null;
  companyName: string;
  company: CompanyPreview | null;
  mottattDato: string;
  fristDato: string | null;
  sted: string | null;
  status: string | null;
  technologyTags: string[];
  contactName: string | null;
  contactTitle: string | null;
};

export type CompanyTechLeadRow = {
  companyId: string;
  company: CompanyPreview | null;
  companyTechnologyTags: string[];
  sistFraFinn: string | null;
};

export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"] & {
  companies: CompanyPreview | null;
  profiles: { id: string; full_name: string } | null;
  lastActivity: string | null;
  signal: string | null;
  openTasks: { count: number; overdue: boolean };
  heatScore: number;
  temperature: "hett" | "lovende" | "mulig" | "sovende";
  tier: 1 | 2 | 3 | 4;
  reasons: string[];
  needsReview: boolean;
  hasAktivForespørsel: boolean;
  hasTidligereForespørsel: boolean;
  daysSinceLastContact: number;
  contactTechnologyTags: string[];
  companyTechnologyTags: string[];
  requestTechnologyTags: string[];
  companyStatus: string | null;
  hasMarkedsradar: boolean;
};

export type ContactMatchLead = ContactRow &
  MatchLeadBase & {
    leadType: "contact";
    name: string;
  };

export type RequestMatchLead = MatchLeadBase & {
  leadType: "request";
  name: string;
  requestId: number;
  requestStatus: string | null;
  requestTechnologyTags: string[];
  fristDato: string | null;
  sted: string | null;
  contactId: string | null;
  contactName: string | null;
  contactTitle: string | null;
  tier?: 1 | 2 | 3 | 4;
  heatScore?: number;
  temperature?: "hett" | "lovende" | "mulig" | "sovende";
  needsReview?: boolean;
  signal?: string | null;
};

export type MatchLead = ContactMatchLead | CompanyMatchLead | RequestMatchLead;

// --- Constants ---

export const JAKT_CHIPS: Array<{ value: HuntChipValue; label: string }> = [
  { value: "alle", label: "Alle" },
  { value: "foresporsler", label: "Forespørsler" },
  { value: "finn", label: "Finn-match" },
  { value: "siste_aktivitet", label: "Siste aktivitet" },
  { value: "innkjoper", label: "Innkjøper" },
  { value: "kunder", label: "Kunder" },
  { value: "cold_call", label: "Cold call" },
];

export const JAKT_CHIP_HELP_TEXT: Record<HuntChipValue, string> = {
  alle: "Beste tekniske treff på tvers av kilder, sortert på match først.",
  foresporsler: "Aktive forespørsler de siste 45 dagene med teknisk match.",
  finn: "Tekniske treff fra Finn-annonser og selskapets tekniske DNA.",
  siste_aktivitet: "Kontakter med aktivitet de siste 45 dagene og teknisk match.",
  innkjoper: "Innkjøpere med teknisk match.",
  kunder: "Eksisterende kunder med teknisk match.",
  cold_call: "Kalde leads med teknisk match og lite nylig aktivitet.",
};

export const CONFIDENCE_CONFIG: Record<ConfidenceBand, { label: string; tone: string }> = {
  high: { label: "Høy evidens", tone: "text-emerald-700" },
  medium: { label: "Middels evidens", tone: "text-amber-700" },
  low: { label: "Lav evidens", tone: "text-muted-foreground" },
};

// --- Helper functions ---

export function getMatchSourceLabel(source: HuntChipValue): string {
  switch (source) {
    case "foresporsler": return "Forespørsel";
    case "finn": return "Finn";
    case "siste_aktivitet": return "Siste aktivitet";
    case "innkjoper": return "Innkjøper";
    case "kunder": return "Kunde";
    case "cold_call": return "Cold call";
    case "alle":
    default: return "Match";
  }
}

export function compareByHotList(
  left: { tier?: number | null; heatScore?: number | null },
  right: { tier?: number | null; heatScore?: number | null },
) {
  const leftTier = left.tier ?? 4;
  const rightTier = right.tier ?? 4;
  if (leftTier !== rightTier) return leftTier - rightTier;
  const leftHeatScore = left.heatScore ?? -1000;
  const rightHeatScore = right.heatScore ?? -1000;
  if (rightHeatScore !== leftHeatScore) return rightHeatScore - leftHeatScore;
  return 0;
}

export function isContactMatchLead(lead: MatchLead): lead is ContactMatchLead {
  return lead.leadType === "contact";
}
export function isRequestMatchLead(lead: MatchLead): lead is RequestMatchLead {
  return lead.leadType === "request";
}
export function isCompanyMatchLead(lead: MatchLead): lead is CompanyMatchLead {
  return lead.leadType === "company";
}

export function getMatchLeadDate(lead: MatchLead): string | null {
  if (lead.sourceDates[0]) return lead.sourceDates[0];
  if (isContactMatchLead(lead)) return lead.lastActivity;
  return null;
}

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-purple-100 text-purple-700",
    "bg-rose-100 text-rose-700",
    "bg-cyan-100 text-cyan-700",
    "bg-orange-100 text-orange-700",
    "bg-indigo-100 text-indigo-700",
  ];
  return colors[Math.abs(hash) % colors.length];
}

export function getHeatBarColor(temperature: string | undefined | null): string {
  switch (temperature) {
    case "hett": return "rgb(239 68 68)";
    case "lovende": return "rgb(251 146 60)";
    case "mulig": return "rgb(251 191 36)";
    default: return "rgb(229 231 235)";
  }
}
