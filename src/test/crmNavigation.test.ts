import { describe, expect, it } from "vitest";

import {
  getCrmRouteAlias,
  getLegacyCompanyPath,
  getLegacyContactPath,
  getModernCompanyCreatePath,
  getModernCompanyPath,
  getModernContactPath,
  getModernNavPath,
  getModernRequestPath,
  getNavItemFromPath,
} from "@/lib/crmNavigation";

describe("crmNavigation", () => {
  it("builds root modern paths for primary entities", () => {
    expect(getModernNavPath("dashboard")).toBe("/");
    expect(getModernContactPath("contact-1")).toBe("/kontakter?contact=contact-1");
    expect(getModernCompanyPath("company-1")).toBe("/selskaper?company=company-1");
    expect(getModernRequestPath(42)).toBe("/foresporsler?id=42");
    expect(getModernCompanyCreatePath("Acme AS")).toBe("/selskaper?ny=Acme%20AS");
  });

  it("builds design-lab alias paths", () => {
    expect(getModernNavPath("dashboard", "design-lab")).toBe("/design-lab/salgsagent");
    expect(getModernContactPath("contact-1", "design-lab")).toBe("/design-lab/kontakter?contact=contact-1");
    expect(getModernCompanyPath("company-1", "design-lab")).toBe("/design-lab/selskaper?company=company-1");
    expect(getModernRequestPath(42, "design-lab")).toBe("/design-lab/foresporsler?id=42");
  });

  it("keeps legacy detail paths intact", () => {
    expect(getLegacyContactPath("contact-1")).toBe("/kontakter/contact-1");
    expect(getLegacyCompanyPath("company-1")).toBe("/selskaper/company-1");
  });

  it("resolves aliases and nav items from paths", () => {
    expect(getCrmRouteAlias("/design-lab/kontakter")).toBe("design-lab");
    expect(getCrmRouteAlias("/kontakter")).toBe("root");
    expect(getNavItemFromPath("/design-lab/oppfolginger")).toBe("followUps");
    expect(getNavItemFromPath("/konsulenter/ansatte")).toBe("employees");
    expect(getNavItemFromPath("/ukjent")).toBeNull();
  });
});
