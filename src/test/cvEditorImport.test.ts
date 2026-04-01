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

  it("drops contact/sidebar noise and project header duplication", () => {
    const result = buildCvEditorImportDocument(
      {
        sidebarSections: [
          {
            heading: "KONTAKTPERSON",
            items: ["Jon Richard Nygaard", "932 87 267 / jr@stacq.no"],
          },
          {
            heading: "PERSONALIA",
            items: ["Født 1988", "Dette er en altfor lang setning som egentlig hører hjemme i brødteksten."],
          },
        ],
        introParagraphs: ["• Dette er et sidebar-punkt", "Christian er en erfaren utvikler."],
        projects: [
          {
            company: "ACME",
            role: "Senior utvikler",
            period: "2024",
            paragraphs: ["Rolle: Senior utvikler", "Periode: 2024", "Bygget sikker firmware."],
            technologies: "Teknologier: C++, Zephyr",
          },
        ],
      },
      [],
    );

    expect(result.sidebarSections).toEqual([
      {
        heading: "PERSONALIA",
        items: ["Født 1988"],
      },
    ]);
    expect(result.introParagraphs).toEqual(["Christian er en erfaren utvikler."]);
    expect(result.projects[0]).toMatchObject({
      paragraphs: ["Bygget sikker firmware."],
      technologies: "C++, Zephyr",
    });
  });

  it("collapses OCR-style letter-spaced names without rewriting titles", () => {
    const result = buildCvEditorImportDocument(
      {
        navn: "A n d e r s N i l s e n",
        tittel: "S e n i o r E m b e d d e d -i n g e n i ø r m e d 5 å r s e r f a r i n g",
      },
      [],
    );

    expect(result.navn).toBe("Anders Nilsen");
    expect(result.tittel).toBe("Senior Embedded-ingeniør med 5 års erfaring");
  });

  it("keeps sidebar limited to the three allowed sections and reroutes extra sections", () => {
    const result = buildCvEditorImportDocument(
      {
        sidebarSections: [
          {
            heading: "P E R S O N A L I A",
            items: ["• Født 1995", "• Norsk, morsmål"],
          },
          {
            heading: "PROGRAMMERINGSSPRÅK",
            items: ["• C, C++, Python", "• Embedded Linux"],
          },
          {
            heading: "SERTIFISERINGER",
            items: ["• IEC 62443", "• Side channel security"],
          },
        ],
        projects: [
          {
            company: "K I W I . K I G m b H",
            subtitle: "Utvikling av digitale låsesystemer",
            role: "Rolle: Embedded-ingeniør",
            period: "Periode: 9 / 2 2 - 9 / 2 4",
            paragraphs: [],
            technologies: "",
          },
        ],
        education: [
          { period: "", primary: "Bachelor of Science", secondary: "" },
        ],
      },
      [],
    );

    expect(result.sidebarSections).toEqual([
      {
        heading: "PERSONALIA",
        items: ["Født 1995", "Norsk, morsmål"],
      },
    ]);
    expect(result.competenceGroups).toContainEqual({
      label: "Programmeringsspråk",
      content: "C, C++, Python, Embedded Linux",
    });
    expect(result.additionalSections).toContainEqual({
      title: "SERTIFISERINGER",
      format: "bullet",
      items: [
        { period: "", primary: "IEC 62443" },
        { period: "", primary: "Side channel security" },
      ],
    });
    expect(result.projects[0]).toMatchObject({
      company: "KIWI.KI GmbH",
      role: "Embedded-ingeniør",
      period: "9/22 - 9/24",
    });
    expect(result.education).toEqual([]);
  });

  it("folds duplicated core timeline sections out of additionalSections", () => {
    const result = buildCvEditorImportDocument(
      {
        workExperience: [
          {
            period: "2024 –",
            primary: "STACQ AS",
          },
        ],
        additionalSections: [
          {
            title: "Arbeidserfaring",
            format: "timeline",
            items: [
              { primary: "2024 – STACQ AS" },
              { primary: "2022 – 2024 KIWI.KI GmbH 2022 – 2024 KIWI.KI GmbH" },
            ],
          },
          {
            title: "UTDANNELSE",
            format: "timeline",
            items: [
              { primary: "2017 – 2019 Master i elektronikk fra NTNU" },
              { primary: "2014 – 2017 Bachelor i elektroingeniør fra HiST/NTNU" },
            ],
          },
        ],
      },
      [],
    );

    expect(result.additionalSections).toEqual([]);
    expect(result.workExperience).toEqual([
      { period: "2024 –", primary: "STACQ AS" },
      { period: "2022 – 2024", primary: "KIWI.KI GmbH" },
    ]);
    expect(result.education).toEqual([
      {
        period: "2017 – 2019",
        primary: "Master i elektronikk fra NTNU",
        secondary: "",
      },
      {
        period: "2014 – 2017",
        primary: "Bachelor i elektroingeniør fra HiST/NTNU",
        secondary: "",
      },
    ]);
  });
});
