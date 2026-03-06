import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";

interface BrregResult {
  navn: string;
  organisasjonsnummer: string;
  forretningsadresse?: {
    kommune?: string;
    postnummer?: string;
  };
  naeringskode1?: {
    beskrivelse?: string;
  };
}

interface BrregSearchProps {
  value: string;
  onChange: (name: string) => void;
  onSelect: (result: { name: string; org_number: string; city: string }) => void;
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

export const BrregSearch = ({ value, onChange, onSelect }: BrregSearchProps) => {
  const [results, setResults] = useState<BrregResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

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
    onSelect({
      name: r.navn,
      org_number: r.organisasjonsnummer,
      city: r.forretningsadresse?.kommune || "",
    });
    setShowDropdown(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => { if (results.length > 0 || noResults) setShowDropdown(true); }}
          required
          placeholder="Søk etter selskap..."
          className="h-10 rounded-lg pl-9 pr-9"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>
      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-md overflow-hidden">
          {noResults ? (
            <div className="px-3 py-3 text-[0.8125rem] text-muted-foreground">
              Ingen treff i Brønnøysundregisteret
            </div>
          ) : (
            results.map((r) => (
              <button
                key={r.organisasjonsnummer}
                type="button"
                onClick={() => handleSelect(r)}
                className="w-full px-3 py-2.5 text-left hover:bg-accent transition-colors cursor-pointer"
              >
                <div className="text-[0.875rem] font-semibold text-foreground">{r.navn}</div>
                <div className="text-[0.75rem] text-muted-foreground mt-0.5">
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
