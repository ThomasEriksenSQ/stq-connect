import { describe, expect, it } from "vitest";

import { buildCvEditorImportDocument } from "../../supabase/functions/_shared/cvEditorImport";

describe("buildCvEditorImportDocument", () => {
  it("hydrates fields from segment ids without rewriting source text", () => {
    const result = buildCvEditorImportDocument(
      {
        navnIds: ["p1-s1"],
        tittelIds: ["p1-s2"],
        introParagraphs: [["p1-s3", "p1-s4"]],
        projects: [
          {
            companyIds: ["p1-s5"],
            subtitleIds: ["p1-s6"],
            roleIds: ["p1-s7"],
            periodIds: ["p1-s8"],
            paragraphs: [["p1-s9", "p1-s10"]],
            technologyIds: ["p1-s11", "p1-s12"],
          },
        ],
        education: [
          {
            periodIds: ["p1-s13"],
            primaryIds: ["p1-s14"],
            secondaryIds: ["p1-s15"],
          },
        ],
        workExperience: [
          {
            periodIds: ["p1-s16"],
            primaryIds: ["p1-s17"],
          },
        ],
      },
      [
        { id: "p1-s1", page: 1, order: 1, text: "Christian Steffen Poljac" },
        { id: "p1-s2", page: 1, order: 2, text: "Senior Embedded-ingeniør med 10+ års erfaring" },
        { id: "p1-s3", page: 1, order: 3, text: "Christian startet sin teknologiske reise tidlig." },
        { id: "p1-s4", page: 1, order: 4, text: "Han har jobbet bredt med embedded-systemer." },
        { id: "p1-s5", page: 1, order: 5, text: "SIX ROBOTICS" },
        { id: "p1-s6", page: 1, order: 6, text: "Autonomous drone platform" },
        { id: "p1-s7", page: 1, order: 7, text: "Lead developer" },
        { id: "p1-s8", page: 1, order: 8, text: "2022 - 2024" },
        { id: "p1-s9", page: 1, order: 9, text: "Utviklet innebygget programvare for UAV-plattform." },
        { id: "p1-s10", page: 1, order: 10, text: "Bygget sikker OTA-oppdatering og HIL-testløp." },
        { id: "p1-s11", page: 1, order: 11, text: "C++" },
        { id: "p1-s12", page: 1, order: 12, text: "Embedded Linux" },
        { id: "p1-s13", page: 1, order: 13, text: "2010 - 2013" },
        { id: "p1-s14", page: 1, order: 14, text: "NTNU - Datateknikk" },
        { id: "p1-s15", page: 1, order: 15, text: "Mastergrad" },
        { id: "p1-s16", page: 1, order: 16, text: "2018 - 2022" },
        { id: "p1-s17", page: 1, order: 17, text: "Seniorutvikler i Acme Robotics" },
      ],
    );

    expect(result.navn).toBe("Christian Steffen Poljac");
    expect(result.tittel).toBe("Senior Embedded-ingeniør med 10+ års erfaring");
    expect(result.introParagraphs).toEqual([
      "Christian startet sin teknologiske reise tidlig. Han har jobbet bredt med embedded-systemer.",
    ]);
    expect(result.projects[0]).toMatchObject({
      company: "SIX ROBOTICS",
      subtitle: "Autonomous drone platform",
      role: "Lead developer",
      period: "2022 - 2024",
      technologies: "C++, Embedded Linux",
    });
    expect(result.projects[0].paragraphs).toEqual([
      "Utviklet innebygget programvare for UAV-plattform. Bygget sikker OTA-oppdatering og HIL-testløp.",
    ]);
    expect(result.education[0]).toEqual({
      period: "2010 - 2013",
      primary: "NTNU - Datateknikk",
      secondary: "Mastergrad",
    });
    expect(result.workExperience[0]).toEqual({
      period: "2018 - 2022",
      primary: "Seniorutvikler i Acme Robotics",
    });
  });

  it("builds additional sections and normalizes custom titles", () => {
    const result = buildCvEditorImportDocument(
      {
        additionalSections: [
          {
            title: "Sertifiseringer:",
            format: "bullet",
            items: [{ primaryIds: ["p2-s1"] }],
          },
          {
            titleIds: ["p2-s2"],
            items: [{ periodIds: ["p2-s3"], primaryIds: ["p2-s4"] }],
          },
        ],
      },
      [
        { id: "p2-s1", page: 2, order: 1, text: "IEC 62443 Foundation" },
        { id: "p2-s2", page: 2, order: 2, text: "Foredrag" },
        { id: "p2-s3", page: 2, order: 3, text: "2024" },
        { id: "p2-s4", page: 2, order: 4, text: "Embedded Security Summit" },
      ],
    );

    expect(result.additionalSections).toEqual([
      {
        title: "SERTIFISERINGER",
        format: "bullet",
        items: [{ period: "", primary: "IEC 62443 Foundation" }],
      },
      {
        title: "FOREDRAG",
        format: "timeline",
        items: [{ period: "2024", primary: "Embedded Security Summit" }],
      },
    ]);
  });
});
