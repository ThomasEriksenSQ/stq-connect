import { describe, expect, it } from "vitest";

import { dedupeTranslatedNewsItems, sortNewsItemsNewestFirst, type NewsItem } from "@/lib/news";

describe("sortNewsItemsNewestFirst", () => {
  it("sorts news items with newest published_at first", () => {
    const items: NewsItem[] = [
      {
        id: "oldest",
        variant: "feature",
        primary_company_id: "1",
        primary_company_name: "Alpha",
        also_matched_company_ids: [],
        also_matched_company_names: [],
        title: "Oldest",
        ingress: "Old",
        url: "https://example.com/oldest",
        source: "Source",
        source_tier: 1,
        published_at: "2026-04-20T08:00:00.000Z",
        image: { url: null, source: "placeholder" },
        score: 1,
      },
      {
        id: "newest",
        variant: "lead",
        primary_company_id: "2",
        primary_company_name: "Beta",
        also_matched_company_ids: [],
        also_matched_company_names: [],
        title: "Newest",
        ingress: "New",
        url: "https://example.com/newest",
        source: "Source",
        source_tier: 1,
        published_at: "2026-04-22T08:00:00.000Z",
        image: { url: null, source: "placeholder" },
        score: 2,
      },
      {
        id: "middle",
        variant: "feature",
        primary_company_id: "3",
        primary_company_name: "Gamma",
        also_matched_company_ids: [],
        also_matched_company_names: [],
        title: "Middle",
        ingress: "Middle",
        url: "https://example.com/middle",
        source: "Source",
        source_tier: 1,
        published_at: "2026-04-21T08:00:00.000Z",
        image: { url: null, source: "placeholder" },
        score: 3,
      },
    ];

    expect(sortNewsItemsNewestFirst(items).map((item) => item.id)).toEqual([
      "newest",
      "middle",
      "oldest",
    ]);
  });
});

describe("dedupeTranslatedNewsItems", () => {
  it("keeps the norwegian variant when norwegian and english article twins are present", () => {
    const norwegian: NewsItem = {
      id: "no",
      variant: "feature",
      primary_company_id: "1",
      primary_company_name: "Kongsberg Defence & Aerospace AS",
      also_matched_company_ids: [],
      also_matched_company_names: [],
      title: "Konkluderer et år med solide resultater og god vekst",
      ingress: "Pressemelding om resultater og vekst.",
      url: "https://kommunikasjon.ntb.no/pressemelding/12345?lang=no",
      source: "kommunikasjon.ntb.no",
      source_tier: 1,
      published_at: "2026-02-06T07:08:18.000Z",
      image: { url: "https://cdn.example.com/kda.jpg?size=large", source: "og" },
      score: 0.7,
    };

    const english: NewsItem = {
      ...norwegian,
      id: "en",
      title: "Concluding a year of solid performance and strong growth",
      ingress: "Press release about performance and growth.",
      url: "https://kommunikasjon.ntb.no/pressemelding/12345?lang=en",
      score: 0.9,
    };

    expect(dedupeTranslatedNewsItems([norwegian, english])).toMatchObject([
      {
        id: "no",
        title: norwegian.title,
        url: norwegian.url,
      },
    ]);
    expect(dedupeTranslatedNewsItems([english, norwegian])).toMatchObject([
      {
        id: "no",
        title: norwegian.title,
        url: norwegian.url,
      },
    ]);
  });
});
