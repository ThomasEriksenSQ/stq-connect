import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Upload } from "lucide-react";

import EksterneKonsulenter from "./EksterneKonsulenter";
import { DesignLabPageShell } from "@/components/designlab/DesignLabPageShell";
import { DesignLabPrimaryAction, DesignLabSecondaryAction } from "@/components/designlab/system";
import { supabase } from "@/integrations/supabase/client";

export default function DesignLabEksterneKonsulenter() {
  const navigate = useNavigate();
  const [createRequestId, setCreateRequestId] = useState(0);

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
    <DesignLabPageShell
      activePath="/design-lab/eksterne"
      title="Eksterne"
      count={count ?? null}
      maxWidth={null}
      headerRight={(
        <>
          <DesignLabSecondaryAction onClick={() => navigate("/stacq/importer-cver")}>
            <Upload className="h-4 w-4" />
            Importer CVer
          </DesignLabSecondaryAction>
          <DesignLabPrimaryAction onClick={() => setCreateRequestId((current) => current + 1)}>
            <Plus className="h-4 w-4" />
            Legg til
          </DesignLabPrimaryAction>
        </>
      )}
    >
      <EksterneKonsulenter
        hidePageTitle
        embeddedSplit
        showActionBar={false}
        createRequestId={createRequestId}
      />
    </DesignLabPageShell>
  );
}
