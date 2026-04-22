import { describe, expect, it } from "vitest";

import { sortNewsItemsNewestFirst, type NewsItem } from "@/lib/news";

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
