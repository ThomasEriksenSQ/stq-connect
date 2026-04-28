import { useState, useEffect, useRef, useCallback } from "react";
import type { CSSProperties } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface BrregResult {
  navn: string;
  organisasjonsnummer: string;
  slettedato?: string;
  forretningsadresse?: {
    adresse?: string[];
    kommune?: string;
    postnummer?: string;
    poststed?: string;
  };
  naeringskode1?: {
    beskrivelse?: string;
  };
}

interface BrregSearchProps {
  value: string;
  onChange: (name: string) => void;
  onSelect: (result: {
    name: string;
    org_number: string;
    city: string;
    zip_code: string;
    address: string;
    industry: string;
    slettedato?: string;
  }) => void;
  placeholder?: string;
  showSearchIcon?: boolean;
  inputClassName?: string;
  inputStyle?: CSSProperties;
  dropdownClassName?: string;
  dropdownStyle?: CSSProperties;
  resultClassName?: string;
  resultStyle?: CSSProperties;
  resultTitleClassName?: string;
  resultTitleStyle?: CSSProperties;
  resultMetaClassName?: string;
  resultMetaStyle?: CSSProperties;
  emptyStateClassName?: string;
  emptyStateStyle?: CSSProperties;
  required?: boolean;
}

const searchBRREG = async (query: string): Promise<BrregResult[]> => {
  if (query.length < 2) return [];
  const res = await fetch(
    `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(query)}&size=8`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data._embedded?.enheter ?? [];
};

export const lookupByOrgNr = async (orgNr: string): Promise<BrregResult | null> => {
  const cleaned = orgNr.replace(/\s/g, "");
  if (!/^\d{9}$/.test(cleaned)) return null;
  try {
    const res = await fetch(
      `https://data.brreg.no/enhetsregisteret/api/enheter/${cleaned}`
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

export const BrregSearch = ({
  value,
  onChange,
  onSelect,
  placeholder = "Søk etter selskap...",
  showSearchIcon = true,
  inputClassName,
  inputStyle,
  dropdownClassName,
  dropdownStyle,
  resultClassName,
  resultStyle,
  resultTitleClassName,
  resultTitleStyle,
  resultMetaClassName,
  resultMetaStyle,
  emptyStateClassName,
  emptyStateStyle,
  required = true,
}: BrregSearchProps) => {
  const [results, setResults] = useState<BrregResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setShowDropdown(false);
      setNoResults(false);
      return;
    }
    setLoading(true);
    try {
      const r = await searchBRREG(q);
      setResults(r);
      setNoResults(r.length === 0);
      setShowDropdown(true);
    } catch {
      setResults([]);
      setNoResults(true);
      setShowDropdown(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(value), 300);
    return () => clearTimeout(timerRef.current);
  }, [value, doSearch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (r: BrregResult) => {
    justSelectedRef.current = true;
    onSelect({
      name: r.navn,
      org_number: r.organisasjonsnummer,
      city: r.forretningsadresse?.poststed || r.forretningsadresse?.kommune || "",
      zip_code: r.forretningsadresse?.postnummer || "",
      address: r.forretningsadresse?.adresse?.filter(Boolean).join(", ") || "",
      industry: r.naeringskode1?.beskrivelse || "",
      slettedato: r.slettedato,
    });
    setShowDropdown(false);
    setResults([]);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        {showSearchIcon && (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
        )}
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => { if (results.length > 0 || noResults) setShowDropdown(true); }}
          required={required}
          placeholder={placeholder}
          className={cn("h-10 rounded-lg pr-9", showSearchIcon ? "pl-9" : undefined, inputClassName)}
          style={inputStyle}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>
      {showDropdown && (
        <div
          className={cn(
            "absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md",
            dropdownClassName,
          )}
          style={dropdownStyle}
        >
          {noResults ? (
            <div
              className={cn("px-3 py-3 text-[0.8125rem] text-muted-foreground", emptyStateClassName)}
              style={emptyStateStyle}
            >
              Ingen treff i Brønnøysundregisteret
            </div>
          ) : (
            results.map((r) => (
              <button
                key={r.organisasjonsnummer}
                type="button"
                onClick={() => handleSelect(r)}
                className={cn(
                  "w-full cursor-pointer px-3 py-2.5 text-left transition-colors hover:bg-accent",
                  resultClassName,
                )}
                style={resultStyle}
              >
                <div
                  className={cn("text-[0.875rem] font-semibold text-foreground", resultTitleClassName)}
                  style={resultTitleStyle}
                >
                  {r.navn}
                </div>
                <div
                  className={cn("mt-0.5 text-[0.75rem] text-muted-foreground", resultMetaClassName)}
                  style={resultMetaStyle}
                >
                  {r.organisasjonsnummer}
                  {r.forretningsadresse?.kommune && ` · ${r.forretningsadresse.kommune}`}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
