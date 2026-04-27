import { describe, expect, it } from "vitest";

import { buildCompanyGeoSummary } from "@/lib/companyGeo";

describe("companyGeo", () => {
  it("groups companies that share the same known location", () => {
    const summary = buildCompanyGeoSummary([
      { id: "a", name: "Alpha", city: "Oslo", status: "customer" },
      { id: "b", name: "Beta", city: "Oslo", status: "prospect" },
    ]);

    expect(summary.missingCompanies).toHaveLength(0);
    expect(summary.clusters).toHaveLength(1);
    expect(summary.clusters[0].locationLabel).toBe("Oslo");
    expect(summary.clusters[0].companies.map((company) => company.companyName)).toEqual(["Alpha", "Beta"]);
  });

  it("plots one company in several branch locations", () => {
    const summary = buildCompanyGeoSummary([
      { id: "a", name: "Multi", city: "Oslo, Bergen, Trondheim", status: "partner" },
    ]);

    expect(summary.missingCompanies).toHaveLength(0);
    expect(summary.points).toHaveLength(3);
    expect(summary.clusters.map((cluster) => cluster.locationLabel).sort()).toEqual(["Bergen", "Oslo", "Trondheim"]);
  });

  it("keeps companies without known coordinates out of map clusters", () => {
    const summary = buildCompanyGeoSummary([
      { id: "a", name: "Known", city: "Stavanger", status: "customer" },
      { id: "b", name: "Unknown", city: "Atlantis", status: "prospect" },
    ]);

    expect(summary.clusters).toHaveLength(1);
    expect(summary.clusters[0].locationLabel).toBe("Stavanger");
    expect(summary.missingCompanies.map((company) => company.name)).toEqual(["Unknown"]);
  });
});

