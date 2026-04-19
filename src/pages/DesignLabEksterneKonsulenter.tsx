import EksterneKonsulenter from "./EksterneKonsulenter";
import { useQuery } from "@tanstack/react-query";

import { DesignLabPageShell } from "@/components/designlab/DesignLabPageShell";
import { supabase } from "@/integrations/supabase/client";

export default function DesignLabEksterneKonsulenter() {
  const { data: count } = useQuery({
    queryKey: ["external-consultants-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("external_consultants")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  return (
    <DesignLabPageShell activePath="/design-lab/eksterne" title="Eksterne" count={count ?? null} maxWidth={null}>
      <EksterneKonsulenter hidePageTitle embeddedSplit />
    </DesignLabPageShell>
  );
}
