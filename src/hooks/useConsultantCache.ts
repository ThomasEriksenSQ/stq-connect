import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 5 * 60 * 1000; // 5 minutes

export function useConsultantCache() {
  const interneQuery = useQuery({
    queryKey: ["consultant-cache-interne"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stacq_ansatte")
        .select("id, navn, kompetanse, geografi, erfaring_aar, status")
        .in("status", ["AKTIV/SIGNERT", "Ledig"]);
      return data || [];
    },
    staleTime: STALE_TIME,
  });

  const eksterneQuery = useQuery({
    queryKey: ["consultant-cache-eksterne"],
    queryFn: async () => {
      const { data } = await supabase
        .from("external_consultants")
        .select("id, navn, teknologier, status")
        .in("status", ["ledig", "aktiv"]);
      return data || [];
    },
    staleTime: STALE_TIME,
  });

  return {
    interne: interneQuery.data || [],
    eksterne: eksterneQuery.data || [],
    isReady: !interneQuery.isLoading && !eksterneQuery.isLoading,
  };
}
