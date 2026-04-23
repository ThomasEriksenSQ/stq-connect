import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { sortNewsItemsNewestFirst } from "@/lib/news";
import {
  fetchNewsDaily,
  getNewsDailyDateKey,
  getNewsDailyItems,
  getNewsDailyQueryKey,
  getNewsDailyTriggerStorageKey,
  triggerNewsDailyDigest,
} from "@/lib/newsDaily";

const TRIGGER_FLAG_MAX_AGE_MS = 10 * 60_000;

function readStorageFlag(key: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;

    const timestamp = Date.parse(raw);
    if (Number.isNaN(timestamp)) return true;
    if (Date.now() - timestamp <= TRIGGER_FLAG_MAX_AGE_MS) return true;

    window.localStorage.removeItem(key);
    return false;
  } catch {
    return false;
  }
}

function writeStorageFlag(key: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, new Date().toISOString());
  } catch {
    // Ignore storage errors and keep the trigger session-local
  }
}

function removeStorageFlag(key: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage errors
  }
}

interface UseNewsDailyDigestOptions {
  autoTrigger?: boolean;
}

export function useNewsDailyDigest({ autoTrigger = true }: UseNewsDailyDigestOptions = {}) {
  const dateKey = useMemo(() => getNewsDailyDateKey(), []);
  const triggerStorageKey = useMemo(
    () => getNewsDailyTriggerStorageKey(dateKey),
    [dateKey],
  );
  const [hasTriggeredToday, setHasTriggeredToday] = useState(() => readStorageFlag(triggerStorageKey));
  const [hasAttemptedTrigger, setHasAttemptedTrigger] = useState(() => readStorageFlag(triggerStorageKey));

  useEffect(() => {
    const hasRecentTrigger = readStorageFlag(triggerStorageKey);
    setHasTriggeredToday(hasRecentTrigger);
    setHasAttemptedTrigger(hasRecentTrigger);
  }, [triggerStorageKey]);

  const query = useQuery({
    queryKey: getNewsDailyQueryKey(dateKey),
    queryFn: () => fetchNewsDaily(dateKey),
    staleTime: 5 * 60_000,
    refetchInterval: (activeQuery) =>
      activeQuery.state.data === null && hasTriggeredToday ? 15_000 : false,
  });

  const { data, isError, isLoading, refetch } = query;

  useEffect(() => {
    if (!autoTrigger || isLoading || isError || data !== null || hasAttemptedTrigger) return;

    if (readStorageFlag(triggerStorageKey)) {
      setHasAttemptedTrigger(true);
      setHasTriggeredToday(true);
      return;
    }

    let cancelled = false;
    setHasAttemptedTrigger(true);
    setHasTriggeredToday(true);
    writeStorageFlag(triggerStorageKey);

    void triggerNewsDailyDigest()
      .then(() => {
        if (cancelled) return;
        void refetch();
      })
      .catch(() => {
        if (cancelled) return;
        setHasTriggeredToday(false);
        removeStorageFlag(triggerStorageKey);
      });

    return () => {
      cancelled = true;
    };
  }, [autoTrigger, data, hasAttemptedTrigger, isError, isLoading, refetch, triggerStorageKey]);

  const row = data ?? null;
  const items = useMemo(() => getNewsDailyItems(row), [row]);
  const latestItem = useMemo(
    () => sortNewsItemsNewestFirst(items)[0] ?? null,
    [items],
  );

  return {
    dateKey,
    row,
    items,
    latestItem,
    hasTriggeredToday,
    isLoadingNews:
      isLoading ||
      (data === null &&
        ((autoTrigger && !isError && !hasAttemptedTrigger) || hasTriggeredToday)),
    query,
  };
}
