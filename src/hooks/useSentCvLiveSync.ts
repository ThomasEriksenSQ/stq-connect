import { useEffect, useRef } from "react";
import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { crmQueryKeys } from "@/lib/queryKeys";

type SentCvLiveSyncResult = {
  trigger: string;
  scanned_messages: number;
  matched_rows: number;
  generated_at: string;
  scanned_accounts?: number;
  skipped_accounts?: number;
};

type UseSentCvLiveSyncOptions = {
  scopeKey: string;
  enabled: boolean;
  invalidateQueryKeys: readonly QueryKey[];
  intervalMs?: number;
  maxMessagesPerMailbox?: number;
};

const DEFAULT_INTERVAL_MS = 2 * 60 * 1000;
const DEFAULT_MAX_MESSAGES_PER_MAILBOX = 120;

export function useSentCvLiveSync({
  scopeKey,
  enabled,
  invalidateQueryKeys,
  intervalMs = DEFAULT_INTERVAL_MS,
  maxMessagesPerMailbox = DEFAULT_MAX_MESSAGES_PER_MAILBOX,
}: UseSentCvLiveSyncOptions) {
  const queryClient = useQueryClient();
  const lastHandledRunAtRef = useRef<string | null>(null);

  const query = useQuery({
    queryKey: crmQueryKeys.sentCv.live(scopeKey),
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<SentCvLiveSyncResult>("sync-sent-cvs", {
        body: {
          trigger: "live",
          maxMessagesPerMailbox,
        },
      });

      if (error) {
        return null;
      }

      return data ?? null;
    },
    enabled,
    retry: false,
    staleTime: 0,
    refetchInterval: enabled ? intervalMs : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    const generatedAt = query.data?.generated_at;
    if (!generatedAt || lastHandledRunAtRef.current === generatedAt) return;

    lastHandledRunAtRef.current = generatedAt;

    if ((query.data?.matched_rows ?? 0) <= 0) return;

    void Promise.all(
      invalidateQueryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
  }, [invalidateQueryKeys, query.data, queryClient]);

  return {
    isRefreshing: query.isFetching,
    lastRunAt: query.data?.generated_at ?? null,
  };
}
