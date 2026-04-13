import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePersistentState } from "@/hooks/usePersistentState";
import { BulkSignalModal } from "@/components/BulkSignalModal";
import { contactHasEmail } from "@/lib/contactCvEligibility";
import { mergeTechnologyTags } from "@/lib/technologyTags";
import { getSignalRank } from "@/lib/categoryUtils";
import { MATCH_OWNER_FILTER_NONE } from "@/lib/matchLeadOwners";
import type { HuntChipValue } from "@/lib/contactHunt";

import { useContactsData } from "@/hooks/useContactsData";
import { useContactMatches } from "@/hooks/useContactMatches";
import { ContactsHeader } from "@/components/contacts/ContactsHeader";
import { ContactFilterBar } from "@/components/contacts/ContactFilterBar";
import { ContactTable } from "@/components/contacts/ContactTable";
import { HuntTable } from "@/components/contacts/HuntTable";
import type { SortField, SortDir, HuntSortField, ContactRow } from "@/components/contacts/types";

const Contacts = () => {
  const navigate = useNavigate();
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [selectedConsultantId, setSelectedConsultantId] = useState<number | null>(null);
  const [jaktChip, setJaktChip] = useState<HuntChipValue>("alle");
  const [huntSort, setHuntSort] = useState<{ field: HuntSortField; dir: SortDir }>({ field: "default", dir: "desc" });

  // Persistent filter state
  const [search, setSearch] = usePersistentState("stacq:contacts:search", "");
  const [ownerFilter, setOwnerFilter] = usePersistentState("stacq:contacts:ownerFilter", "all");
  const [matchOwnerFilter, setMatchOwnerFilter] = usePersistentState("stacq:contacts:matchOwnerFilter", "all");
  const [signalFilter, setSignalFilter] = usePersistentState("stacq:contacts:signalFilter", "all");
  const [typeFilter, setTypeFilter] = usePersistentState("stacq:contacts:typeFilter", "all");
  const [sort, setSort] = usePersistentState<{ field: SortField; dir: SortDir }>("stacq:contacts:sort", { field: "priority", dir: "desc" });
  const [hotListActive, setHotListActive] = usePersistentState("stacq:contacts:hotListActive", true);

  // Data
  const {
    contacts,
    companyTechProfiles,
    requests,
    totalCount,
    capped,
    isLoading,
    huntConsultants,
    huntConsultantsLoading,
    handleToggle,
    setSignalMutation,
    uniqueOwners,
    getOwnerId,
    getOwnerName,
  } = useContactsData();

  const selectedConsultant = useMemo(
    () => huntConsultants.find((c) => c.id === selectedConsultantId) ?? null,
    [huntConsultants, selectedConsultantId],
  );
  const isHuntMode = selectedConsultant !== null;

  // Search + filter
  const searchTerm = search.trim().toLowerCase();

  const searchFilteredContacts = useMemo(
    () =>
      contacts.filter((contact) => {
        if (!searchTerm) return true;
        const technologyTags = mergeTechnologyTags(contact.contactTechnologyTags, contact.companyTechnologyTags, contact.requestTechnologyTags);
        return (
          `${contact.first_name} ${contact.last_name}`.toLowerCase().includes(searchTerm) ||
          contact.companies?.name?.toLowerCase().includes(searchTerm) ||
          contact.title?.toLowerCase().includes(searchTerm) ||
          technologyTags.join(" ").toLowerCase().includes(searchTerm)
        );
      }),
    [contacts, searchTerm],
  );

  const filteredContacts = useMemo(
    () =>
      searchFilteredContacts.filter((contact) => {
        const matchOwner = ownerFilter === "all" || (ownerFilter === "__none__" ? !getOwnerId(contact) : getOwnerId(contact) === ownerFilter);
        const matchSignal = signalFilter === "all" || contact.signal === signalFilter;
        const matchType =
          typeFilter === "all" ||
          (typeFilter === "call_list" && contact.call_list) ||
          (typeFilter === "not_call_list" && !contact.call_list) ||
          (typeFilter === "cv_email" && contact.cv_email) ||
          (typeFilter === "not_cv_email" && !contact.cv_email && contactHasEmail(contact)) ||
          (typeFilter === "ikke_aktuell" && contact.ikke_aktuell_kontakt);
        return matchOwner && matchSignal && matchType;
      }),
    [ownerFilter, searchFilteredContacts, signalFilter, typeFilter, getOwnerId],
  );

  const matchBaseContacts = useMemo(
    () =>
      searchFilteredContacts.filter(
        (c) => !c.ikke_aktuell_kontakt && !c.companies?.ikke_relevant && c.signal !== "Ikke aktuelt",
      ),
    [searchFilteredContacts],
  );

  // Sort
  const sortedContacts = useMemo(() => {
    if (isHuntMode) return [] as ContactRow[];
    return [...filteredContacts].sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      switch (sort.field) {
        case "name": return dir * `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, "nb");
        case "company": return dir * (a.companies?.name || "").localeCompare(b.companies?.name || "", "nb");
        case "title": return dir * (a.title || "").localeCompare(b.title || "", "nb");
        case "signal": return dir * (getSignalRank(a.signal) - getSignalRank(b.signal));
        case "owner": return dir * (getOwnerName(a) || "").localeCompare(getOwnerName(b) || "", "nb");
        case "last_activity":
          if (!a.lastActivity && !b.lastActivity) return 0;
          if (!a.lastActivity) return 1;
          if (!b.lastActivity) return -1;
          return dir * a.lastActivity.localeCompare(b.lastActivity);
        case "priority":
          if ((a.tier ?? 4) !== (b.tier ?? 4)) return (a.tier ?? 4) - (b.tier ?? 4);
          return (b.heatScore ?? -1000) - (a.heatScore ?? -1000);
        default: return 0;
      }
    });
  }, [filteredContacts, isHuntMode, sort, getOwnerName]);

  // Match computation
  const {
    allLeads,
    leads,
    visibleMatchLeads,
    emptyState,
    matchOwnerOptions,
  } = useContactMatches({
    contacts,
    matchBaseContacts,
    companyTechProfiles,
    requests,
    selectedConsultant,
    searchTerm,
    jaktChip,
    matchOwnerFilter,
    huntSort,
  });

  // Cleanup invalid matchOwnerFilter
  useEffect(() => {
    if (!selectedConsultant || matchOwnerFilter === "all") return;
    const validFilters = new Set(matchOwnerOptions.owners.map((o) => o.value));
    if (matchOwnerOptions.hasUnassigned) validFilters.add(MATCH_OWNER_FILTER_NONE);
    if (!validFilters.has(matchOwnerFilter)) setMatchOwnerFilter("all");
  }, [matchOwnerFilter, matchOwnerOptions, selectedConsultant, setMatchOwnerFilter]);

  // Derived
  const hasVisibleResults = isHuntMode ? visibleMatchLeads.length > 0 : sortedContacts.length > 0;
  const visibleResultCount = isHuntMode
    ? visibleMatchLeads.length
    : filteredContacts.length === contacts.length
      ? `${totalCount}${capped ? "+" : ""}`
      : filteredContacts.length;
  const visibleResultLabel = isHuntMode ? "treff" : "kontakter";

  const hasActiveFilters = isHuntMode
    ? matchOwnerFilter !== "all"
    : ownerFilter !== "all" || signalFilter !== "all" || typeFilter !== "all" || search.trim() !== "";

  // Handlers
  const activatePriorityMode = () => {
    if (!hotListActive) setHotListActive(true);
    setSort({ field: "priority", dir: "desc" });
  };

  const handleConsultantToggle = (consultantId: number) => {
    setSelectedConsultantId((current) => {
      const next = current === consultantId ? null : consultantId;
      if (next !== null) activatePriorityMode();
      setHuntSort({ field: "default", dir: "desc" });
      return next;
    });
  };

  const handleJaktChipChange = (value: HuntChipValue) => {
    setJaktChip(value);
    activatePriorityMode();
    setHuntSort({ field: "default", dir: "desc" });
  };

  const toggleSort = (field: SortField) => {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: field === "last_activity" ? "desc" : "asc" },
    );
  };

  const toggleHuntSort = (field: "match" | "varme") => {
    setHuntSort((prev) =>
      prev.field === field ? { field, dir: prev.dir === "desc" ? "asc" : "desc" } : { field, dir: "desc" },
    );
  };

  const resetFilters = () => {
    setSearch("");
    if (isHuntMode) {
      setMatchOwnerFilter("all");
    } else {
      setOwnerFilter("all");
      setSignalFilter("all");
      setTypeFilter("all");
    }
  };

  return (
    <div className="space-y-4">
      <ContactsHeader
        selectedConsultantId={selectedConsultantId}
        huntConsultants={huntConsultants}
        huntConsultantsLoading={huntConsultantsLoading}
        onConsultantToggle={handleConsultantToggle}
        resultCount={String(visibleResultCount)}
        resultLabel={visibleResultLabel}
      />

      <ContactFilterBar
        search={search}
        onSearchChange={setSearch}
        isHuntMode={isHuntMode}
        ownerFilter={ownerFilter}
        onOwnerFilterChange={setOwnerFilter}
        signalFilter={signalFilter}
        onSignalFilterChange={setSignalFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        uniqueOwners={uniqueOwners}
        matchOwnerFilter={matchOwnerFilter}
        onMatchOwnerFilterChange={setMatchOwnerFilter}
        matchOwnerOptions={matchOwnerOptions}
        jaktChip={jaktChip}
        onJaktChipChange={handleJaktChipChange}
        hasActiveFilters={hasActiveFilters}
        onReset={resetFilters}
      />

      {/* Table */}
      {isLoading ? (
        <div className="space-y-px">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-[52px] bg-secondary/50 animate-pulse rounded" />
          ))}
        </div>
      ) : !hasVisibleResults ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          {isHuntMode ? emptyState : "Ingen kontakter funnet"}
        </p>
      ) : isHuntMode ? (
        <HuntTable
          leads={visibleMatchLeads}
          huntSort={huntSort}
          onToggleHuntSort={toggleHuntSort}
        />
      ) : (
        sortedContacts.length > 0 && (
          <ContactTable
            contacts={sortedContacts}
            hotListActive={hotListActive}
            sort={sort}
            onToggleSort={toggleSort}
            onToggle={handleToggle}
            onSetSignal={(contactId, companyId, label) =>
              setSignalMutation.mutate({ contactId, companyId, label })
            }
          />
        )
      )}

      <BulkSignalModal open={bulkModalOpen} onClose={() => setBulkModalOpen(false)} />
    </div>
  );
};

export default Contacts;
