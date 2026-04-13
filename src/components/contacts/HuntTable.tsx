import { useNavigate } from "react-router-dom";
import { cn, getInitials } from "@/lib/utils";
import { ArrowUpDown } from "lucide-react";
import { TEMP_CONFIG } from "@/lib/heatScore";
import { relativeDate } from "@/lib/relativeDate";
import { getConsultantMatchScoreColor } from "@/lib/consultantMatches";
import {
  getAvatarColor,
  getHeatBarColor,
  getMatchSourceLabel,
  getMatchLeadDate,
  isContactMatchLead,
  isRequestMatchLead,
  isCompanyMatchLead,
  CONFIDENCE_CONFIG,
} from "./types";
import type { MatchLead, HuntSortField, SortDir } from "./types";

interface Props {
  leads: MatchLead[];
  huntSort: { field: HuntSortField; dir: SortDir };
  onToggleHuntSort: (field: "match" | "varme") => void;
}

function getLeadHeatConfig(lead: MatchLead) {
  if (isContactMatchLead(lead)) return TEMP_CONFIG[lead.temperature];
  if (isRequestMatchLead(lead) && lead.temperature) return TEMP_CONFIG[lead.temperature];
  return null;
}

function getLeadHref(lead: MatchLead) {
  if (isContactMatchLead(lead)) return `/kontakter/${lead.id}`;
  if (isRequestMatchLead(lead)) return `/foresporsler?id=${lead.requestId}`;
  return `/selskaper/${lead.companyId}`;
}

export function HuntTable({ leads, huntSort, onToggleHuntSort }: Props) {
  const navigate = useNavigate();

  return (
    <>
      {/* Mobile */}
      <div className="space-y-2 md:hidden">
        {leads.map((lead) => {
          const leadDate = getMatchLeadDate(lead);
          const heatConfig = getLeadHeatConfig(lead);
          const confidenceConfig = CONFIDENCE_CONFIG[lead.confidenceBand];

          return (
            <button
              key={lead.leadKey}
              type="button"
              onClick={() => navigate(getLeadHref(lead))}
              style={{ borderLeft: `3px solid ${heatConfig ? getHeatBarColor(isContactMatchLead(lead) ? lead.temperature : isRequestMatchLead(lead) ? lead.temperature : undefined) : "transparent"}` }}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-left shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[0.8125rem] font-medium text-foreground truncate">{lead.name}</span>
                    {isCompanyMatchLead(lead) && <span className="rounded-full border border-border px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground shrink-0">Selskap</span>}
                    {isRequestMatchLead(lead) && <span className="rounded-full border border-border px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground shrink-0">Forespørsel</span>}
                  </div>
                  <p className="mt-0.5 text-[0.75rem] text-muted-foreground truncate">
                    {isContactMatchLead(lead) ? lead.title || lead.companyName : isRequestMatchLead(lead) ? lead.contactName || "Ingen kontakt" : lead.summary}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className={cn("inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[0.75rem] font-semibold")}>
                    <span className={cn("inline-block h-2 w-2 rounded-full", getConsultantMatchScoreColor(lead.matchScore10))} />
                    {lead.matchScore10}/10
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[0.6875rem] text-muted-foreground">{lead.matchSources.map(getMatchSourceLabel).join(" · ")}</span>
                <span className="text-[0.6875rem] text-muted-foreground truncate">{lead.matchTags.slice(0, 3).join(", ")}</span>
                {leadDate && <span className="ml-auto text-[0.6875rem] text-muted-foreground shrink-0">{relativeDate(leadDate)}</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Desktop - Stacked rows */}
      <div className="hidden md:block border border-border rounded-lg overflow-hidden bg-card shadow-card">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-background">
          <div className="flex-[2] min-w-0">
            <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">Lead</span>
          </div>
          <div className="flex-[1.5] min-w-0">
            <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">Detaljer</span>
          </div>
          <div className="flex-[1.2] min-w-0">
            <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">Kilde</span>
          </div>
          <div className="w-[100px] shrink-0">
            <button onClick={() => onToggleHuntSort("match")} className="flex items-center gap-1 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors">
              Match <ArrowUpDown className={cn("h-3 w-3", huntSort.field === "match" && "text-primary")} />
            </button>
          </div>
          <div className="w-[100px] shrink-0">
            <button onClick={() => onToggleHuntSort("varme")} className="flex items-center gap-1 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors">
              Varme <ArrowUpDown className={cn("h-3 w-3", huntSort.field === "varme" && "text-primary")} />
            </button>
          </div>
          <div className="w-[80px] shrink-0">
            <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground text-right block">Sist</span>
          </div>
        </div>
        <div className="divide-y divide-border">
          {leads.map((lead) => {
            const leadDate = getMatchLeadDate(lead);
            const heatConfig = getLeadHeatConfig(lead);
            const confidenceConfig = CONFIDENCE_CONFIG[lead.confidenceBand];

            return (
              <button
                key={lead.leadKey}
                onClick={() => navigate(getLeadHref(lead))}
                style={{ borderLeft: `3px solid ${heatConfig ? getHeatBarColor(isContactMatchLead(lead) ? lead.temperature : isRequestMatchLead(lead) ? lead.temperature : undefined) : "transparent"}` }}
                className="flex w-full items-center gap-3 pl-3 pr-4 min-h-[52px] py-2 text-left hover:bg-background/80 transition-colors duration-75"
              >
                {/* Lead name */}
                <div className="flex-[2] min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-full text-[0.625rem] font-semibold shrink-0", getAvatarColor(lead.name))}>
                      {getInitials(lead.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[0.8125rem] font-medium text-foreground truncate">{lead.name}</p>
                      <p className="text-[0.6875rem] text-muted-foreground truncate">
                        {isContactMatchLead(lead) ? lead.title || "Kontaktlead"
                          : isRequestMatchLead(lead) ? `${lead.summary}${lead.sted ? ` · ${lead.sted}` : ""}`
                          : lead.summary}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="flex-[1.5] min-w-0">
                  {isContactMatchLead(lead) ? (
                    <>
                      <p className="text-[0.8125rem] text-muted-foreground truncate">{lead.companyName || "—"}</p>
                      {lead.signal && lead.signal !== "Ukjent om behov" && (
                        <p className="text-[0.6875rem] text-muted-foreground truncate">{lead.signal}</p>
                      )}
                    </>
                  ) : isRequestMatchLead(lead) ? (
                    <>
                      <p className="text-[0.8125rem] text-muted-foreground truncate">{lead.contactName || "Ingen kontakt"}</p>
                      <p className="text-[0.6875rem] text-muted-foreground truncate">
                        {lead.fristDato ? `Frist ${relativeDate(lead.fristDato)}` : lead.requestStatus || "Aktiv"}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[0.8125rem] text-muted-foreground truncate">{lead.preferredContactName || "Uten kontakt"}</p>
                      {lead.preferredContactTitle && <p className="text-[0.6875rem] text-muted-foreground truncate">{lead.preferredContactTitle}</p>}
                    </>
                  )}
                </div>

                {/* Sources */}
                <div className="flex-[1.2] min-w-0">
                  <p className="text-[0.75rem] font-medium text-foreground truncate">{lead.matchSources.map(getMatchSourceLabel).join(" · ")}</p>
                  <p className="text-[0.6875rem] text-muted-foreground truncate">{lead.matchTags.slice(0, 4).join(", ")}</p>
                </div>

                {/* Match score */}
                <div className="w-[100px] shrink-0">
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[0.75rem] font-semibold">
                    <span className={cn("inline-block h-2 w-2 rounded-full", getConsultantMatchScoreColor(lead.matchScore10))} />
                    {lead.matchScore10}/10
                  </span>
                  <p className={cn("mt-0.5 text-[0.6875rem]", confidenceConfig.tone)}>{confidenceConfig.label}</p>
                </div>

                {/* Heat */}
                <div className="w-[100px] shrink-0">
                  {heatConfig ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[0.6875rem] font-medium">
                      <span className={cn("inline-block h-2 w-2 rounded-full", heatConfig.dot)} />
                      {heatConfig.label}
                    </span>
                  ) : (
                    <span className="text-[0.6875rem] text-muted-foreground">—</span>
                  )}
                </div>

                {/* Date */}
                <div className="w-[80px] shrink-0 text-[0.75rem] text-muted-foreground text-right">
                  {leadDate ? relativeDate(leadDate) : ""}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
