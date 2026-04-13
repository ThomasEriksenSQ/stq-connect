import { useMemo } from "react";
import { differenceInDays } from "date-fns";
import { mergeTechnologyTags } from "@/lib/technologyTags";
import {
  hasRecentActualActivity,
  isActiveRequest,
  isColdCallCandidate,
  isCustomerCompany,
  type HuntChipValue,
} from "@/lib/contactHunt";
import {
  getContactMatchScore,
  getMatchBand,
} from "@/lib/contactMatchScore";
import {
  MATCH_OWNER_FILTER_NONE,
  buildMatchLeadOwnerCandidate,
  getMatchLeadOwnerLabel,
  matchesMatchLeadOwnerFilter,
  resolveMatchLeadOwner,
} from "@/lib/matchLeadOwners";
import type {
  ContactRow,
  CompanyPreview,
  CompanyTechLeadRow,
  RequestLeadRow,
  HuntConsultant,
  MatchLead,
  ContactMatchLead,
  CompanyMatchLead,
  RequestMatchLead,
  HuntSortField,
  SortDir,
} from "@/components/contacts/types";
import { compareByHotList } from "@/components/contacts/types";

interface UseContactMatchesParams {
  contacts: ContactRow[];
  matchBaseContacts: ContactRow[];
  companyTechProfiles: CompanyTechLeadRow[];
  requests: RequestLeadRow[];
  selectedConsultant: HuntConsultant | null;
  searchTerm: string;
  jaktChip: HuntChipValue;
  matchOwnerFilter: string;
  huntSort: { field: HuntSortField; dir: SortDir };
}

export function useContactMatches({
  contacts,
  matchBaseContacts,
  companyTechProfiles,
  requests,
  selectedConsultant,
  searchTerm,
  jaktChip,
  matchOwnerFilter,
  huntSort,
}: UseContactMatchesParams) {
  const selectedConsultantFirstName = selectedConsultant?.navn.split(" ")[0] || "konsulenten";

  const matchResults = useMemo(() => {
    if (!selectedConsultant) {
      return { allLeads: [] as MatchLead[], leads: [] as MatchLead[], emptyState: null as string | null };
    }

    const consultantTags = mergeTechnologyTags(selectedConsultant.kompetanse || []);
    if (consultantTags.length === 0) {
      return {
        allLeads: [] as MatchLead[],
        leads: [] as MatchLead[],
        emptyState: `${selectedConsultant.navn} mangler teknisk DNA i CRM. Legg inn kompetanse på konsulenten for å få match-treff her.`,
      };
    }

    const chipPoolKeys: Array<Exclude<HuntChipValue, "alle">> = ["foresporsler", "finn", "siste_aktivitet", "innkjoper", "kunder", "cold_call"];
    const contactPools = Object.fromEntries(chipPoolKeys.map((chip) => [chip, new Map<string, ContactMatchLead>()])) as Record<Exclude<HuntChipValue, "alle">, Map<string, ContactMatchLead>>;
    const companyPools = Object.fromEntries(chipPoolKeys.map((chip) => [chip, new Map<string, CompanyMatchLead>()])) as Record<Exclude<HuntChipValue, "alle">, Map<string, CompanyMatchLead>>;
    const requestPools = { foresporsler: new Map<number, RequestMatchLead>() };

    const allContactsById = new Map(contacts.map((c) => [c.id, c]));
    const searchableContactById = new Map(matchBaseContacts.map((c) => [c.id, c]));
    const searchableContactsByCompanyId = new Map<string, ContactRow[]>();
    matchBaseContacts.forEach((c) => {
      if (!c.company_id) return;
      if (!searchableContactsByCompanyId.has(c.company_id)) searchableContactsByCompanyId.set(c.company_id, []);
      searchableContactsByCompanyId.get(c.company_id)?.push(c);
    });

    const companyTechById = new Map(companyTechProfiles.map((p) => [p.companyId, p]));
    const companyNameMatchesSearch = (name: string, tags: string[]) =>
      !searchTerm || name.toLowerCase().includes(searchTerm) || tags.join(" ").toLowerCase().includes(searchTerm);
    const mergeTags = (...groups: string[][]) => [...new Set(groups.flat().filter(Boolean))];
    const mergeSources = (...groups: HuntChipValue[][]) => [...new Set(groups.flat())];
    const mergeDates = (...groups: string[][]) => [...new Set(groups.flat().filter(Boolean))].sort((a, b) => b.localeCompare(a));
    const mergeUrgency = (...u: number[]) => Math.max(0, ...u);
    const getSourceUrgency = (chip: Exclude<HuntChipValue, "alle">, sourceDate?: string | null, contact?: ContactRow) => {
      if (chip === "cold_call") return contact?.daysSinceLastContact ?? 0;
      return sourceDate ? new Date(sourceDate).getTime() : 0;
    };
    const buildContactLeadTags = (c: ContactRow) => mergeTechnologyTags(c.contactTechnologyTags, c.companyTechnologyTags);
    const getLeadScore = (tags: string[]) => getContactMatchScore(consultantTags, tags);

    const getContactOwnerCandidate = (contact: Pick<ContactRow, "owner_id" | "profiles"> | null | undefined, source: "contact" | "fallback_contact" = "contact") =>
      buildMatchLeadOwnerCandidate(contact ? { owner_id: contact.owner_id, profiles: contact.profiles } : null, source);
    const getCompanyOwnerCandidate = (company: CompanyPreview | null | undefined) =>
      buildMatchLeadOwnerCandidate(company ? { owner_id: company.owner_id, profiles: company.profiles } : null, "company");

    const resolveLeadOwner = ({ contact, company, fallbackContact }: { contact?: Pick<ContactRow, "owner_id" | "profiles"> | null; company?: CompanyPreview | null; fallbackContact?: Pick<ContactRow, "owner_id" | "profiles"> | null }) =>
      resolveMatchLeadOwner(getContactOwnerCandidate(contact, "contact"), getCompanyOwnerCandidate(company), getContactOwnerCandidate(fallbackContact, "fallback_contact"));

    const getBestCompanyContact = (companyId: string, sourceTags?: string[]) => {
      const candidates = searchableContactsByCompanyId.get(companyId) || [];
      if (candidates.length === 0) return null;
      return [...candidates].sort((a, b) => {
        const as_ = getLeadScore(sourceTags || buildContactLeadTags(a));
        const bs = getLeadScore(sourceTags || buildContactLeadTags(b));
        if (bs.score10 !== as_.score10) return bs.score10 - as_.score10;
        if (bs.confidenceScore !== as_.confidenceScore) return bs.confidenceScore - as_.confidenceScore;
        const hot = compareByHotList(a, b);
        if (hot !== 0) return hot;
        return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, "nb");
      })[0];
    };

    const addContactLead = (chip: Exclude<HuntChipValue, "alle">, contact: ContactRow, leadTags: string[], sourceDate?: string | null, summary?: string) => {
      const scoreResult = getLeadScore(leadTags);
      if (scoreResult.score10 < 4 || !scoreResult.matchBand) return;
      const owner = resolveLeadOwner({ contact });
      const nextLead: ContactMatchLead = {
        ...contact, leadKey: `contact:${contact.id}`, leadType: "contact",
        name: `${contact.first_name} ${contact.last_name}`.trim(),
        companyId: contact.company_id, companyName: contact.companies?.name || "",
        matchScore10: scoreResult.score10, matchBand: scoreResult.matchBand,
        confidenceScore: scoreResult.confidenceScore, confidenceBand: scoreResult.confidenceBand,
        matchSources: [chip], matchTags: scoreResult.matchTags,
        sourceDates: sourceDate ? [sourceDate] : [], chipUrgency: getSourceUrgency(chip, sourceDate, contact),
        summary: summary || contact.title || "Kontaktlead",
        ownerId: owner.ownerId, ownerName: owner.ownerName, ownerSource: owner.ownerSource,
      };
      const existing = contactPools[chip].get(contact.id);
      if (!existing) { contactPools[chip].set(contact.id, nextLead); return; }
      const mergedScore = Math.max(existing.matchScore10, nextLead.matchScore10);
      contactPools[chip].set(contact.id, {
        ...existing, matchScore10: mergedScore, matchBand: getMatchBand(mergedScore) || existing.matchBand,
        confidenceScore: Math.max(existing.confidenceScore, nextLead.confidenceScore),
        confidenceBand: existing.confidenceScore >= nextLead.confidenceScore ? existing.confidenceBand : nextLead.confidenceBand,
        matchSources: mergeSources(existing.matchSources, nextLead.matchSources),
        matchTags: mergeTags(existing.matchTags, nextLead.matchTags),
        sourceDates: mergeDates(existing.sourceDates, nextLead.sourceDates),
        chipUrgency: mergeUrgency(existing.chipUrgency, nextLead.chipUrgency),
        summary: existing.summary || nextLead.summary,
        ownerId: existing.ownerId || nextLead.ownerId, ownerName: existing.ownerName || nextLead.ownerName,
        ownerSource: existing.ownerId || existing.ownerName ? existing.ownerSource : nextLead.ownerSource,
      });
    };

    const addCompanyLead = (chip: Exclude<HuntChipValue, "alle">, companyId: string | null, company: CompanyPreview | null, fallbackName: string, leadTags: string[], companyTechnologyTags: string[], sourceDate?: string | null, summary?: string, preferredContact?: { name?: string | null; title?: string | null }, fallbackContact?: ContactRow | null, minimumScore = 4) => {
      const companyName = company?.name || fallbackName || "Ukjent selskap";
      if (!companyId || !companyNameMatchesSearch(companyName, leadTags) || company?.ikke_relevant) return;
      const scoreResult = getLeadScore(leadTags);
      if (scoreResult.score10 < minimumScore) return;
      const owner = resolveLeadOwner({ company, fallbackContact });
      const nextLead: CompanyMatchLead = {
        leadKey: `company:${companyId}`, leadType: "company", companyId, companyName, name: companyName,
        status: company?.status || null, companyTechnologyTags,
        matchScore10: scoreResult.score10, matchBand: scoreResult.matchBand,
        confidenceScore: scoreResult.confidenceScore, confidenceBand: scoreResult.confidenceBand,
        matchSources: [chip], matchTags: scoreResult.matchTags,
        sourceDates: sourceDate ? [sourceDate] : [], chipUrgency: getSourceUrgency(chip, sourceDate),
        summary: summary || "Selskapslead uten registrert kontakt",
        preferredContactName: preferredContact?.name || null, preferredContactTitle: preferredContact?.title || null,
        ownerId: owner.ownerId, ownerName: owner.ownerName, ownerSource: owner.ownerSource,
      };
      const existing = companyPools[chip].get(companyId);
      if (!existing) { companyPools[chip].set(companyId, nextLead); return; }
      const mergedScore = Math.max(existing.matchScore10, nextLead.matchScore10);
      companyPools[chip].set(companyId, {
        ...existing, matchScore10: mergedScore, matchBand: getMatchBand(mergedScore) || existing.matchBand,
        confidenceScore: Math.max(existing.confidenceScore, nextLead.confidenceScore),
        confidenceBand: existing.confidenceScore >= nextLead.confidenceScore ? existing.confidenceBand : nextLead.confidenceBand,
        matchSources: mergeSources(existing.matchSources, nextLead.matchSources),
        matchTags: mergeTags(existing.matchTags, nextLead.matchTags),
        sourceDates: mergeDates(existing.sourceDates, nextLead.sourceDates),
        chipUrgency: mergeUrgency(existing.chipUrgency, nextLead.chipUrgency),
        summary: existing.summary || nextLead.summary,
        preferredContactName: existing.preferredContactName || nextLead.preferredContactName || null,
        preferredContactTitle: existing.preferredContactTitle || nextLead.preferredContactTitle || null,
        ownerId: existing.ownerId || nextLead.ownerId, ownerName: existing.ownerName || nextLead.ownerName,
        ownerSource: existing.ownerId || existing.ownerName ? existing.ownerSource : nextLead.ownerSource,
      });
    };

    const addRequestLead = (request: RequestLeadRow) => {
      const scoreResult = getLeadScore(request.technologyTags);
      if (scoreResult.score10 === 0 && request.technologyTags.length === 0) return;
      const ownerContact = request.contactId ? allContactsById.get(request.contactId) || null : null;
      const linkedContact = request.contactId ? searchableContactById.get(request.contactId) || null : null;
      const bestCompanyContact = !linkedContact && request.companyId ? getBestCompanyContact(request.companyId, request.technologyTags) : null;
      const heatContact = linkedContact || bestCompanyContact;
      const owner = resolveLeadOwner({ contact: ownerContact, company: request.company, fallbackContact: bestCompanyContact });
      const requestName = request.companyName || "Ukjent selskap";
      if (searchTerm && !requestName.toLowerCase().includes(searchTerm) && !request.contactName?.toLowerCase().includes(searchTerm) && !request.technologyTags.join(" ").toLowerCase().includes(searchTerm)) return;

      requestPools.foresporsler.set(request.id, {
        leadKey: `request:${request.id}`, leadType: "request", requestId: request.id,
        companyId: request.companyId, companyName: requestName, name: requestName,
        matchScore10: scoreResult.score10, matchBand: scoreResult.matchBand,
        confidenceScore: scoreResult.confidenceScore, confidenceBand: scoreResult.confidenceBand,
        matchSources: ["foresporsler"], matchTags: scoreResult.matchTags,
        requestTechnologyTags: request.technologyTags,
        sourceDates: request.mottattDato ? [request.mottattDato] : [],
        chipUrgency: getSourceUrgency("foresporsler", request.mottattDato),
        summary: request.contactName ? "Aktiv forespørsel med kontakt" : "Aktiv forespørsel",
        requestStatus: request.status, fristDato: request.fristDato, sted: request.sted,
        contactId: request.contactId,
        contactName: request.contactName || (heatContact ? `${heatContact.first_name} ${heatContact.last_name}`.trim() : null),
        contactTitle: request.contactTitle || heatContact?.title || null,
        tier: heatContact?.tier, heatScore: heatContact?.heatScore, temperature: heatContact?.temperature,
        needsReview: heatContact?.needsReview, signal: heatContact?.signal || null,
        ownerId: owner.ownerId, ownerName: owner.ownerName, ownerSource: owner.ownerSource,
      });
    };

    // Populate pools
    const activeRequests = requests.filter((r) => isActiveRequest(r.mottattDato, r.status));
    activeRequests.forEach(addRequestLead);

    companyTechProfiles.forEach((profile) => {
      const hasFreshFinn = Boolean(profile.sistFraFinn) && differenceInDays(new Date(), new Date(profile.sistFraFinn!)) <= 90;
      if (!hasFreshFinn) return;
      const bestContact = getBestCompanyContact(profile.companyId, profile.companyTechnologyTags);
      if (bestContact) { addContactLead("finn", bestContact, profile.companyTechnologyTags, profile.sistFraFinn, "Finn-teknologimatch"); return; }
      addCompanyLead("finn", profile.companyId, profile.company, profile.company?.name || "Ukjent selskap", profile.companyTechnologyTags, profile.companyTechnologyTags, profile.sistFraFinn, "Finn-teknologimatch uten registrert kontakt");
    });

    matchBaseContacts.forEach((contact) => {
      const tags = buildContactLeadTags(contact);
      if (hasRecentActualActivity(contact.daysSinceLastContact, 45)) addContactLead("siste_aktivitet", contact, tags, contact.lastActivity, "Nylig aktivitet");
      if (contact.call_list) addContactLead("innkjoper", contact, tags, contact.lastActivity, "Aktiv innkjøper");
      if (isColdCallCandidate({ daysSinceLastContact: contact.daysSinceLastContact, openTaskCount: contact.openTasks.count, isIkkeAktuellKontakt: Boolean(contact.ikke_aktuell_kontakt) }))
        addContactLead("cold_call", contact, tags, contact.lastActivity, "Cold call-kandidat");
    });

    const customerCompanyIds = new Set<string>();
    matchBaseContacts.forEach((c) => { if (c.company_id && isCustomerCompany(c.companyStatus)) customerCompanyIds.add(c.company_id); });
    companyTechProfiles.forEach((p) => { if (p.companyId && isCustomerCompany(p.company?.status)) customerCompanyIds.add(p.companyId); });

    customerCompanyIds.forEach((companyId) => {
      const companyContacts = searchableContactsByCompanyId.get(companyId) || [];
      const companyProfile = companyTechById.get(companyId);
      const company = companyContacts[0]?.companies || companyProfile?.company || null;
      if (!company || !isCustomerCompany(company.status) || company.ikke_relevant) return;
      const customerLeadTags = mergeTechnologyTags(companyProfile?.companyTechnologyTags || [], ...companyContacts.map((c) => c.contactTechnologyTags), ...companyContacts.map((c) => c.companyTechnologyTags));
      const bestContact = getBestCompanyContact(companyId, customerLeadTags);
      const customerSourceDate = bestContact?.lastActivity || companyProfile?.sistFraFinn || null;
      addCompanyLead("kunder", companyId, company, company.name, customerLeadTags, companyProfile?.companyTechnologyTags || [], customerSourceDate, "Kundeselskap",
        { name: bestContact ? `${bestContact.first_name} ${bestContact.last_name}`.trim() : null, title: bestContact?.title || null }, bestContact, 1);
    });

    // Merge pools
    const mergeContactPools = (chips: Array<Exclude<HuntChipValue, "alle">>) => {
      const merged = new Map<string, ContactMatchLead>();
      chips.forEach((chip) => {
        contactPools[chip].forEach((lead, contactId) => {
          const existing = merged.get(contactId);
          if (!existing) { merged.set(contactId, { ...lead }); return; }
          const mergedScore = Math.max(existing.matchScore10, lead.matchScore10);
          merged.set(contactId, {
            ...existing, matchScore10: mergedScore, matchBand: getMatchBand(mergedScore) || existing.matchBand,
            confidenceScore: Math.max(existing.confidenceScore, lead.confidenceScore),
            confidenceBand: existing.confidenceScore >= lead.confidenceScore ? existing.confidenceBand : lead.confidenceBand,
            matchTags: mergeTags(existing.matchTags, lead.matchTags), matchSources: mergeSources(existing.matchSources, lead.matchSources),
            sourceDates: mergeDates(existing.sourceDates, lead.sourceDates), chipUrgency: mergeUrgency(existing.chipUrgency, lead.chipUrgency),
            summary: existing.summary || lead.summary, ownerId: existing.ownerId || lead.ownerId, ownerName: existing.ownerName || lead.ownerName,
            ownerSource: existing.ownerId || existing.ownerName ? existing.ownerSource : lead.ownerSource,
          });
        });
      });
      return [...merged.values()];
    };

    const mergeCompanyPools = (chips: Array<Exclude<HuntChipValue, "ale">>) => {
      const merged = new Map<string, CompanyMatchLead>();
      chips.forEach((chip) => {
        (companyPools as any)[chip]?.forEach((lead: CompanyMatchLead, companyId: string) => {
          const existing = merged.get(companyId);
          if (!existing) { merged.set(companyId, { ...lead }); return; }
          const mergedScore = Math.max(existing.matchScore10, lead.matchScore10);
          merged.set(companyId, {
            ...existing, matchScore10: mergedScore, matchBand: getMatchBand(mergedScore) || existing.matchBand,
            confidenceScore: Math.max(existing.confidenceScore, lead.confidenceScore),
            confidenceBand: existing.confidenceScore >= lead.confidenceScore ? existing.confidenceBand : lead.confidenceBand,
            matchTags: mergeTags(existing.matchTags, lead.matchTags), matchSources: mergeSources(existing.matchSources, lead.matchSources),
            sourceDates: mergeDates(existing.sourceDates, lead.sourceDates), chipUrgency: mergeUrgency(existing.chipUrgency, lead.chipUrgency),
            summary: existing.summary || lead.summary,
            ownerId: existing.ownerId || lead.ownerId, ownerName: existing.ownerName || lead.ownerName,
            ownerSource: existing.ownerId || existing.ownerName ? existing.ownerSource : lead.ownerSource,
          });
        });
      });
      return [...merged.values()];
    };

    const mergeRequestPools = () => [...requestPools.foresporsler.values()].filter((l) => l.matchScore10 >= 4);

    const contactResults = jaktChip === "alle" ? mergeContactPools(chipPoolKeys) : [...contactPools[jaktChip as Exclude<HuntChipValue, "alle">].values()];
    const companyResults = jaktChip === "alle" ? mergeCompanyPools(chipPoolKeys as any) : [...(companyPools[jaktChip as Exclude<HuntChipValue, "alle">]?.values() || [])];
    const requestResults = jaktChip === "alle" ? mergeRequestPools() : jaktChip === "foresporsler" ? [...requestPools.foresporsler.values()] : [];

    const allLeads = [...contactResults, ...companyResults, ...requestResults];
    const leads = allLeads.filter((l) => matchesMatchLeadOwnerFilter(l.ownerId, matchOwnerFilter)).sort((a, b) => {
      if (b.matchScore10 !== a.matchScore10) return b.matchScore10 - a.matchScore10;
      if (b.confidenceScore !== a.confidenceScore) return b.confidenceScore - a.confidenceScore;
      const hot = compareByHotList(a as any, b as any);
      if (hot !== 0) return hot;
      if (b.chipUrgency !== a.chipUrgency) return b.chipUrgency - a.chipUrgency;
      return a.name.localeCompare(b.name, "nb");
    });

    let emptyState: string | null = null;
    if (leads.length === 0) {
      if (matchOwnerFilter !== "all" && allLeads.length > 0) {
        emptyState = "Ingen match-treff for valgt eier akkurat nå.";
      } else {
        switch (jaktChip) {
          case "foresporsler": emptyState = activeRequests.length === 0 ? "Ingen aktive forespørsler siste 45 dager akkurat nå." : `Ingen aktive forespørsler er synlige for ${selectedConsultantFirstName} med dagens søk akkurat nå.`; break;
          case "finn": emptyState = `Ingen Finn-annonser matcher ${selectedConsultantFirstName} sin tekniske profil akkurat nå.`; break;
          case "siste_aktivitet": emptyState = `Ingen kontakter med nylig aktivitet matcher ${selectedConsultantFirstName} sin tekniske profil akkurat nå.`; break;
          case "innkjoper": emptyState = `Ingen aktive innkjøpere matcher ${selectedConsultantFirstName} sin tekniske profil akkurat nå.`; break;
          case "kunder": emptyState = `Ingen kundeselskaper med teknisk DNA matcher ${selectedConsultantFirstName} akkurat nå.`; break;
          case "cold_call": emptyState = `Ingen cold call-treff matcher ${selectedConsultantFirstName} sin tekniske profil akkurat nå.`; break;
          default: emptyState = `Ingen tekniske match-treff for ${selectedConsultantFirstName} akkurat nå.`; break;
        }
      }
    }

    return { allLeads, leads, emptyState };
  }, [companyTechProfiles, contacts, jaktChip, matchBaseContacts, matchOwnerFilter, requests, searchTerm, selectedConsultant, selectedConsultantFirstName]);

  const matchOwnerOptions = useMemo(() => {
    if (!selectedConsultant) return { owners: [] as Array<{ value: string; label: string }>, hasUnassigned: false };
    const ownerMap = new Map<string, string>();
    let hasUnassigned = false;
    matchResults.allLeads.forEach((l) => {
      if (l.ownerId) ownerMap.set(l.ownerId, getMatchLeadOwnerLabel(l.ownerId, l.ownerName));
      else hasUnassigned = true;
    });
    return {
      owners: Array.from(ownerMap.entries()).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "nb")),
      hasUnassigned,
    };
  }, [matchResults.allLeads, selectedConsultant]);

  const visibleMatchLeads = useMemo(() => {
    if (!selectedConsultant) return [];
    const leads = [...matchResults.leads];
    if (huntSort.field === "default") return leads;
    const tempToNum = (t: string | undefined) => t === "hett" ? 4 : t === "lovende" ? 3 : t === "mulig" ? 2 : t === "sovende" ? 1 : 0;
    leads.sort((a, b) => {
      let diff = 0;
      if (huntSort.field === "match") {
        diff = (a.matchScore10 ?? 0) - (b.matchScore10 ?? 0);
      } else {
        const getTemp = (l: MatchLead) => l.leadType === "contact" ? l.temperature : l.leadType === "request" ? (l.temperature ?? undefined) : undefined;
        diff = tempToNum(getTemp(a)) - tempToNum(getTemp(b));
      }
      return huntSort.dir === "desc" ? -diff : diff;
    });
    return leads;
  }, [selectedConsultant, matchResults.leads, huntSort]);

  return {
    allLeads: matchResults.allLeads,
    leads: matchResults.leads,
    visibleMatchLeads,
    emptyState: matchResults.emptyState,
    matchOwnerOptions,
  };
}
