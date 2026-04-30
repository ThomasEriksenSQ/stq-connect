import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { CompanyGeoOverview } from "@/components/company/CompanyGeoOverview";
import { DesignLabMobileNavButton, DesignLabSidebar } from "@/components/designlab/DesignLabSidebar";
import { DesignLabFilterRow, DesignLabGhostAction } from "@/components/designlab/system";
import { getDesignLabTextSizeStyle, type TextSize } from "@/components/designlab/TextSizeControl";
import { C } from "@/components/designlab/theme";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePersistentState } from "@/hooks/usePersistentState";
import {
  GEO_FILTERS,
  companyMatchesGeoFilter,
  getGeoFilterDescription,
  normalizeGeoFilter,
  type GeoFilter,
} from "@/lib/companyGeoAreas";

const TYPE_FILTERS = ["Alle", "Potensiell kunde", "Kunde", "Partner", "Ikke relevant selskap"] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

const TYPE_LABEL_TO_VALUE: Record<string, string> = {
  "Potensiell kunde": "prospect",
  Kunde: "customer",
  Partner: "partner",
  "Ikke relevant selskap": "churned",
};

const TYPE_VALUE_TO_LABEL: Record<string, TypeFilter> = {
  prospect: "Potensiell kunde",
  customer: "Kunde",
  kunde: "Kunde",
  partner: "Partner",
  churned: "Ikke relevant selskap",
};

function statusMatches(companyStatus: string | null | undefined, filter: TypeFilter) {
  if (filter === "Alle") return true;
  const dbValue = TYPE_LABEL_TO_VALUE[filter];
  if (dbValue === "customer") return companyStatus === "customer" || companyStatus === "kunde";
  return companyStatus === dbValue;
}

export default function CompaniesMap() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signOut, user } = useAuth();
  const [textSize] = usePersistentState<TextSize>("dl-text-size", "M");
  const [ownerFilter, setOwnerFilter] = useState("Alle");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(() => TYPE_VALUE_TO_LABEL[searchParams.get("type") || ""] || "Alle");
  const [geoFilter, setGeoFilter] = useState<GeoFilter>(() => normalizeGeoFilter(searchParams.get("geo")));
  const effectiveGeoFilter = normalizeGeoFilter(geoFilter);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies-map-fast"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, address, city, zip_code, geo_areas, geo_source, geo_unresolved_places, status, profiles!companies_owner_id_fkey(id, full_name)")
        .neq("status", "deleted")
        .order("name");
      if (error) throw error;
      return (data || []).map((company: any) => ({
        ...company,
        ownerId: company.profiles?.id || null,
        ownerName: company.profiles?.full_name || "",
      }));
    },
  });

  const ownerOptions = useMemo(() => {
    const owners = new Map<string, string>();
    companies.forEach((company: any) => {
      if (company.ownerId && company.ownerName) owners.set(company.ownerId, company.ownerName);
    });
    return ["Alle", ...[...owners.values()].sort((left, right) => left.localeCompare(right, "nb")), "Uten eier"];
  }, [companies]);

  useEffect(() => {
    const ownerName = searchParams.get("owner");
    const ownerId = searchParams.get("ownerId");
    if (ownerName) {
      setOwnerFilter(ownerName);
      return;
    }
    if (!ownerId || ownerId === "all" || companies.length === 0) return;
    const company = companies.find((item: any) => item.ownerId === ownerId);
    if (company?.ownerName) setOwnerFilter(company.ownerName);
  }, [companies, searchParams]);

  const filteredCompanies = useMemo(
    () =>
      companies.filter((company: any) => {
        const matchOwner =
          ownerFilter === "Alle" ||
          (ownerFilter === "Uten eier" ? !company.ownerId : company.ownerName === ownerFilter);
        return matchOwner && statusMatches(company.status, typeFilter) && companyMatchesGeoFilter(company, effectiveGeoFilter);
      }),
    [companies, effectiveGeoFilter, ownerFilter, typeFilter],
  );

  return (
    <div
      className="dl-shell flex h-screen overflow-hidden select-none"
      style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif", background: C.bg }}
    >
      <DesignLabSidebar navigate={navigate} signOut={signOut} user={user} activePath="/design-lab/selskaper" />

      <main
        className="flex min-w-0 flex-1 flex-col overflow-hidden"
        style={{ ...getDesignLabTextSizeStyle(textSize), background: C.appBg }}
      >
        <header
          className="dl-shell-header flex shrink-0 flex-wrap items-center justify-between gap-3"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <DesignLabMobileNavButton navigate={navigate} signOut={signOut} user={user} activePath="/design-lab/selskaper" />
            <div className="flex items-baseline gap-2.5">
              <h1 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Geografisk kart</h1>
              <span style={{ fontSize: 13, color: C.textGhost, fontWeight: 500 }}>· {filteredCompanies.length}</span>
            </div>
          </div>
        </header>

        <div className="dl-filter-bar shrink-0 space-y-0" style={{ borderBottom: `1px solid ${C.border}` }}>
          <DesignLabFilterRow label="EIER" options={ownerOptions} value={ownerFilter} onChange={setOwnerFilter} />
          <div className="flex items-center justify-between">
            <DesignLabFilterRow
              label="TYPE"
              options={[...TYPE_FILTERS]}
              value={typeFilter}
              onChange={(value) => setTypeFilter(value as TypeFilter)}
            />
            {(ownerFilter !== "Alle" || typeFilter !== "Alle" || effectiveGeoFilter !== "Alle") && (
              <DesignLabGhostAction
                onClick={() => {
                  setOwnerFilter("Alle");
                  setTypeFilter("Alle");
                  setGeoFilter("Alle");
                }}
              >
                <X style={{ width: 12, height: 12 }} />
                Nullstill
              </DesignLabGhostAction>
            )}
          </div>
          <DesignLabFilterRow
            label="GEO"
            options={GEO_FILTERS}
            value={effectiveGeoFilter}
            onChange={(value) => setGeoFilter(value as GeoFilter)}
            getOptionDescription={getGeoFilterDescription}
            description={effectiveGeoFilter !== "Alle" ? getGeoFilterDescription(effectiveGeoFilter) : undefined}
          />
        </div>

        <div className="min-h-0 flex-1 p-3">
          <CompanyGeoOverview
            companies={filteredCompanies}
            isLoading={isLoading}
            selectedCompanyId={selectedCompanyId}
            mapHeight="calc(100vh - 148px)"
            className="h-full"
            onCompanySelect={(companyId) => {
              setSelectedCompanyId(companyId);
              navigate(`/selskaper/${companyId}`);
            }}
          />
        </div>
      </main>
    </div>
  );
}
