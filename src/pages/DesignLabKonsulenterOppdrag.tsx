import { useState } from "react";

import KonsulenterOppdrag from "./KonsulenterOppdrag";

import { DesignLabPageShell } from "@/components/designlab/DesignLabPageShell";
import { DesignLabPrimaryAction } from "@/components/designlab/system";
import { Plus } from "lucide-react";

export default function DesignLabKonsulenterOppdrag() {
  const [createRequestId, setCreateRequestId] = useState(0);

  return (
    <DesignLabPageShell
      activePath="/design-lab/aktive-oppdrag"
      title="Aktive oppdrag"
      maxWidth={null}
      headerRight={(
        <DesignLabPrimaryAction onClick={() => setCreateRequestId((current) => current + 1)}>
          <Plus className="h-4 w-4" />
          Nytt oppdrag
        </DesignLabPrimaryAction>
      )}
    >
      <KonsulenterOppdrag hidePageIntro embeddedSplit showCreateButton={false} createRequestId={createRequestId} />
    </DesignLabPageShell>
  );
}
