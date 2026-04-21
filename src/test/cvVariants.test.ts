import { describe, expect, it } from "vitest";

import { formatProjectPeriod, type CVDocument } from "@/components/cv/CvRenderer";
import {
  ANONYMIZED_EN_CV_VARIANT,
  applyCvVariantInvariants,
  createAnonymizedCvDocument,
  normalizeAnonymizedCvDocument,
  replaceCandidateReferences,
} from "@/lib/cvVariants";

const baseDoc: CVDocument = {
  hero: {
    name: "Mattis Solheim",
    title: "Mattis er senior utvikler",
    contact: {
      title: "Kontaktperson",
      name: "Jon Richard Nygaard",
      phone: "932 87 267",
      email: "jr@stacq.no",
    },
    portrait_url: "https://example.com/portrait.png",
    portrait_position: "50% 50%",
  },
  sidebarSections: [{ heading: "PERSONALIA", items: ["Mattis Solheim", "Oslo"] }],
  introParagraphs: ["Mattis har over ti års erfaring med embedded og sky."],
  competenceGroups: [{ label: "ANNET", content: "Mattis driver med systemarkitektur." }],
  projectsTitle: "Utvalgte prosjekter",
  projects: [
    {
      company: "Konsulentoppdrag",
      subtitle: "Mattis ledet teamet",
      role: "Tech lead",
      period: "2024 - nåværende",
      paragraphs: ["Mattis bygget løsningene og Mattis sin erfaring var viktig."],
      technologies: "TypeScript, React",
    },
  ],
  additionalSections: [{ title: "FOREDRAG", format: "bullet", items: [{ period: "", primary: "Mattis på NDC" }] }],
  education: [{ period: "2010 - 2013", primary: "Mattis universitet", secondary: "Bachelor" }],
  workExperience: [{ period: "2015 - 2020", primary: "Mattis Consulting", secondary: "Utvikler" }],
};

describe("replaceCandidateReferences", () => {
  it("replaces full name and first-name references in prose", () => {
    expect(replaceCandidateReferences("Mattis har levert. Solheim støttet også teamet.", "Mattis Solheim")).toBe(
      "Konsulenten har levert. Konsulenten støttet også teamet.",
    );
  });

  it("handles simple possessive forms", () => {
    expect(replaceCandidateReferences("Mattis sin erfaring var avgjørende.", "Mattis Solheim")).toBe(
      "Konsulentens erfaring var avgjørende.",
    );
  });

  it("collapses duplicate placeholders after multiple adjacent name matches", () => {
    expect(replaceCandidateReferences("Mattis Solheim Mattis er en senior utvikler.", "Mattis Solheim")).toBe(
      "Konsulenten er en senior utvikler.",
    );
  });
});

describe("createAnonymizedCvDocument", () => {
  it("removes the candidate name and portrait without touching the contact person", () => {
    const anonymized = createAnonymizedCvDocument(baseDoc);

    expect(anonymized.hero.name).toBe("Anonymisert kandidat");
    expect(anonymized.hero.portrait_url).toBeUndefined();
    expect(anonymized.hero.contact.name).toBe("Jon Richard Nygaard");
  });

  it("replaces candidate references across the CV fields", () => {
    const anonymized = createAnonymizedCvDocument(baseDoc);

    expect(anonymized.introParagraphs[0]).toContain("Konsulenten");
    expect(anonymized.competenceGroups[0].content).toContain("Konsulenten");
    expect(anonymized.projects[0].paragraphs[0]).toContain("Konsulentens erfaring");
    expect(anonymized.sidebarSections[0].items[0]).toBe("Konsulenten");
  });

  it("normalizes duplicate consultant placeholders in already anonymized documents", () => {
    const normalized = normalizeAnonymizedCvDocument({
      ...baseDoc,
      hero: {
        ...baseDoc.hero,
        name: "Anonymisert kandidat",
      },
      introParagraphs: ["Konsulenten Konsulenten er en senior embedded-ingeniør med bred erfaring."],
    });

    expect(normalized.introParagraphs[0]).toBe("Konsulenten er en senior embedded-ingeniør med bred erfaring.");
  });

  it("localizes anonymized placeholders to english for english anonymized variants", () => {
    const englishAnonymous = applyCvVariantInvariants(
      {
        ...baseDoc,
        hero: {
          ...baseDoc.hero,
          name: "Anonymisert kandidat",
        },
        introParagraphs: ["Konsulenten Konsulenten er en senior embedded-ingeniør med bred erfaring."],
      },
      ANONYMIZED_EN_CV_VARIANT,
    );

    expect(englishAnonymous.hero.name).toBe("Anonymous candidate");
    expect(englishAnonymous.hero.portrait_url).toBeUndefined();
    expect(englishAnonymous.introParagraphs[0]).toBe(
      "The consultant er en senior embedded-ingeniør med bred erfaring.",
    );
  });
});

describe("formatProjectPeriod", () => {
  it("formats structured project periods in english without breaking the date model", () => {
    expect(
      formatProjectPeriod(
        {
          period: "",
          startMonth: 1,
          startYear: 2024,
          endMonth: null,
          endYear: null,
          isCurrent: true,
        },
        "en",
      ),
    ).toBe("Jan. 2024 - present");
  });
});
