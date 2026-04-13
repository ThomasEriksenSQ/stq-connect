import { Search, ChevronDown, RotateCcw, Ban } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { SIGNAL_OPTIONS } from "@/lib/categoryUtils";
import { MATCH_OWNER_FILTER_NONE } from "@/lib/matchLeadOwners";
import { JAKT_CHIPS, JAKT_CHIP_HELP_TEXT } from "./types";
import type { HuntChipValue } from "@/lib/contactHunt";
import { useState } from "react";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  // Normal mode filters
  isHuntMode: boolean;
  ownerFilter: string;
  onOwnerFilterChange: (v: string) => void;
  signalFilter: string;
  onSignalFilterChange: (v: string) => void;
  typeFilter: string;
  onTypeFilterChange: (v: string) => void;
  uniqueOwners: [string, string][];
  // Hunt mode filters
  matchOwnerFilter: string;
  onMatchOwnerFilterChange: (v: string) => void;
  matchOwnerOptions: { owners: { value: string; label: string }[]; hasUnassigned: boolean };
  jaktChip: HuntChipValue;
  onJaktChipChange: (v: HuntChipValue) => void;
  // Reset
  hasActiveFilters: boolean;
  onReset: () => void;
}

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeLabel = options.find((o) => o.value === value)?.label || "Alle";
  const isActive = value !== "all";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "h-8 px-3 rounded-full border text-[0.8125rem] inline-flex items-center gap-1.5 transition-colors shrink-0",
            isActive
              ? "bg-primary/10 border-primary/30 text-primary font-medium"
              : "border-border text-muted-foreground hover:bg-secondary",
          )}
        >
          {label}: {activeLabel}
          <ChevronDown className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1.5" align="start">
        <div className="space-y-0.5">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left px-3 py-1.5 text-[0.8125rem] rounded-md transition-colors",
                value === opt.value
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground hover:bg-secondary",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ContactFilterBar({
  search,
  onSearchChange,
  isHuntMode,
  ownerFilter,
  onOwnerFilterChange,
  signalFilter,
  onSignalFilterChange,
  typeFilter,
  onTypeFilterChange,
  uniqueOwners,
  matchOwnerFilter,
  onMatchOwnerFilterChange,
  matchOwnerOptions,
  jaktChip,
  onJaktChipChange,
  hasActiveFilters,
  onReset,
}: Props) {
  const ownerOptions = [
    { value: "all", label: "Alle" },
    ...uniqueOwners.map(([id, name]) => ({ value: id, label: name })),
    { value: "__none__", label: "Uten eier" },
  ];

  const signalOptions = [
    { value: "all", label: "Alle" },
    ...SIGNAL_OPTIONS.map((s) => ({ value: s.label, label: s.label })),
  ];

  const typeOptions = [
    { value: "all", label: "Alle" },
    { value: "call_list", label: "Innkjøper" },
    { value: "not_call_list", label: "Ikke innkjøper" },
    { value: "cv_email", label: "CV-Epost" },
    { value: "not_cv_email", label: "Ikke CV-Epost" },
    { value: "ikke_aktuell", label: "Ikke relevant" },
  ];

  const matchOwnerOpts = [
    { value: "all", label: "Alle" },
    ...matchOwnerOptions.owners,
    ...(matchOwnerOptions.hasUnassigned
      ? [{ value: MATCH_OWNER_FILTER_NONE, label: "Uten eier" }]
      : []),
  ];

  const CHIP_BASE = "h-7 px-2.5 text-[0.75rem] rounded-full border transition-colors cursor-pointer shrink-0";
  const CHIP_OFF = `${CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;
  const CHIP_ON = `${CHIP_BASE} bg-foreground text-background border-foreground font-medium`;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input
            placeholder="Søk navn, selskap, teknologi..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-8 rounded-full text-[0.8125rem] bg-card border-border"
          />
        </div>

        <div className="w-px h-6 bg-border shrink-0" />

        {/* Filters */}
        {!isHuntMode ? (
          <>
            <FilterDropdown label="Eier" value={ownerFilter} options={ownerOptions} onChange={onOwnerFilterChange} />
            <FilterDropdown label="Signal" value={signalFilter} options={signalOptions} onChange={onSignalFilterChange} />
            <FilterDropdown label="Type" value={typeFilter} options={typeOptions} onChange={onTypeFilterChange} />
          </>
        ) : (
          <>
            <FilterDropdown label="Eier" value={matchOwnerFilter} options={matchOwnerOpts} onChange={onMatchOwnerFilterChange} />
          </>
        )}

        {/* Reset */}
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="h-8 w-8 rounded-full border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors flex items-center justify-center shrink-0"
            title="Nullstill filtre"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Hunt mode: match chips */}
      {isHuntMode && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {JAKT_CHIPS.map((chip) => (
            <button
              key={chip.value}
              onClick={() => onJaktChipChange(chip.value)}
              className={jaktChip === chip.value ? CHIP_ON : CHIP_OFF}
            >
              {chip.label}
            </button>
          ))}
          <span className="text-[0.6875rem] text-muted-foreground ml-1">
            {JAKT_CHIP_HELP_TEXT[jaktChip]}
          </span>
        </div>
      )}
    </div>
  );
}
