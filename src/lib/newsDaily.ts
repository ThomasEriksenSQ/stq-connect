import { supabase } from "@/integrations/supabase/client";
import type { NewsDailyPayload, NewsItem } from "@/lib/news";

export interface NewsDailyRow {
  date: string;
  generated_at: string;
  status: "ok" | "empty" | "error";
  payload: NewsDailyPayload;
  source_count: number;
}

export function getNewsDailyDateKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function getNewsDailyQueryKey(dateKey: string) {
  return ["news-daily", dateKey] as const;
}

export function getNewsDailyTriggerStorageKey(dateKey: string): string {
  return `news-daily-triggered:${dateKey}`;
}

export async function fetchNewsDaily(dateKey: string = getNewsDailyDateKey()): Promise<NewsDailyRow | null> {
  const { data, error } = await supabase
    .from("news_daily")
    .select("date, generated_at, status, payload, source_count")
    .eq("date", dateKey)
    .eq("is_current", true)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as NewsDailyRow) ?? null;
}

export async function triggerNewsDailyDigest(): Promise<void> {
  const { error } = await supabase.functions.invoke("news-daily-digest", {
    body: { trigger: "on-demand" },
  });

  if (error) throw error;
}

export function getNewsDailyItems(row: NewsDailyRow | null): NewsItem[] {
  const items = row?.payload?.items;
  return Array.isArray(items) ? (items as NewsItem[]) : [];
}
