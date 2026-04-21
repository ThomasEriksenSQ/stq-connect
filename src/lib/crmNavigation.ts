import { useLocation } from "react-router-dom";

import { useDesignVersion } from "@/context/DesignVersionContext";

export type CrmRouteAlias = "root" | "design-lab";

export type CrmNavItem =
  | "dashboard"
  | "companies"
  | "contacts"
  | "requests"
  | "followUps"
  | "stacqPrisen"
  | "markedsradar"
  | "activeAssignments"
  | "employees"
  | "externalConsultants"
  | "websiteAi"
  | "settings";

const ROOT_NAV_PATHS: Record<CrmNavItem, string> = {
  dashboard: "/",
  companies: "/selskaper",
  contacts: "/kontakter",
  requests: "/foresporsler",
  followUps: "/oppfolginger",
  stacqPrisen: "/stacq/prisen",
  markedsradar: "/markedsradar",
  activeAssignments: "/konsulenter/i-oppdrag",
  employees: "/konsulenter/ansatte",
  externalConsultants: "/konsulenter/eksterne",
  websiteAi: "/nettside-ai",
  settings: "/innstillinger",
};

const DESIGN_LAB_NAV_PATHS: Record<CrmNavItem, string> = {
  dashboard: "/design-lab/salgsagent",
  companies: "/design-lab/selskaper",
  contacts: "/design-lab/kontakter",
  requests: "/design-lab/foresporsler",
  followUps: "/design-lab/oppfolginger",
  stacqPrisen: "/design-lab/stacq-prisen",
  markedsradar: "/design-lab/markedsradar",
  activeAssignments: "/design-lab/aktive-oppdrag",
  employees: "/design-lab/ansatte",
  externalConsultants: "/design-lab/eksterne",
  websiteAi: "/design-lab/nettside-ai",
  settings: "/design-lab/innstillinger",
};

const ALL_NAV_ITEMS = Object.keys(ROOT_NAV_PATHS) as CrmNavItem[];

function withQuery(base: string, key: string, value: string | number) {
  return `${base}?${key}=${encodeURIComponent(String(value))}`;
}

export function getCrmRouteAlias(pathname: string): CrmRouteAlias {
  return pathname.startsWith("/design-lab") ? "design-lab" : "root";
}

export function getModernNavPath(item: CrmNavItem, alias: CrmRouteAlias = "root") {
  return alias === "design-lab" ? DESIGN_LAB_NAV_PATHS[item] : ROOT_NAV_PATHS[item];
}

export function getModernContactPath(contactId: string, alias: CrmRouteAlias = "root") {
  return withQuery(getModernNavPath("contacts", alias), "contact", contactId);
}

export function getModernCompanyPath(companyId: string, alias: CrmRouteAlias = "root") {
  return withQuery(getModernNavPath("companies", alias), "company", companyId);
}

export function getModernRequestPath(requestId: number, alias: CrmRouteAlias = "root") {
  return withQuery(getModernNavPath("requests", alias), "id", requestId);
}

export function getModernCompanyCreatePath(name: string, alias: CrmRouteAlias = "root") {
  return withQuery(getModernNavPath("companies", alias), "ny", name);
}

export function getModernEmployeePath(employeeId: number, alias: CrmRouteAlias = "root") {
  return `${getModernNavPath("employees", alias)}/${employeeId}`;
}

export function getLegacyContactPath(contactId: string) {
  return `/kontakter/${contactId}`;
}

export function getLegacyCompanyPath(companyId: string) {
  return `/selskaper/${companyId}`;
}

export function getLegacyRequestPath(requestId: number) {
  return withQuery("/foresporsler", "id", requestId);
}

export function getLegacyCompanyCreatePath(name: string) {
  return withQuery("/selskaper", "ny", name);
}

export function getNavItemFromPath(path: string): CrmNavItem | null {
  for (const item of ALL_NAV_ITEMS) {
    if (ROOT_NAV_PATHS[item] === path || DESIGN_LAB_NAV_PATHS[item] === path) {
      return item;
    }
  }

  return null;
}

export function useCrmNavigation() {
  const location = useLocation();
  const { isV2Active } = useDesignVersion();
  const routeAlias = getCrmRouteAlias(location.pathname);
  const useModernRoutes = routeAlias === "design-lab" || isV2Active;

  return {
    routeAlias,
    useModernRoutes,
    getNavPath: (item: CrmNavItem) => getModernNavPath(item, routeAlias),
    getContactPath: (contactId: string) =>
      useModernRoutes
        ? getModernContactPath(contactId, routeAlias)
        : getLegacyContactPath(contactId),
    getCompanyPath: (companyId: string) =>
      useModernRoutes
        ? getModernCompanyPath(companyId, routeAlias)
        : getLegacyCompanyPath(companyId),
    getRequestPath: (requestId: number) =>
      useModernRoutes
        ? getModernRequestPath(requestId, routeAlias)
        : getLegacyRequestPath(requestId),
    getCreateCompanyPath: (name: string) =>
      useModernRoutes
        ? getModernCompanyCreatePath(name, routeAlias)
        : getLegacyCompanyCreatePath(name),
    getEmployeePath: (employeeId: number) => getModernEmployeePath(employeeId, routeAlias),
  };
}
