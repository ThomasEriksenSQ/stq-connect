import { useState } from "react";
import { Download } from "lucide-react";

import Markedsradar from "./Markedsradar";

import { DesignLabPageShell } from "@/components/designlab/DesignLabPageShell";
import { DesignLabPrimaryAction } from "@/components/designlab/system";

export default function DesignLabMarkedsradar() {
  const [importRequestId, setImportRequestId] = useState(0);

  return (
    <DesignLabPageShell
      activePath="/design-lab/markedsradar"
      title="Markedsradar"
      maxWidth={null}
      headerRight={(
        <DesignLabPrimaryAction onClick={() => setImportRequestId((current) => current + 1)}>
          <Download className="h-4 w-4" />
          Importer uke
        </DesignLabPrimaryAction>
      )}
    >
      <Markedsradar hidePageIntro designLabMode importRequestId={importRequestId} />
    </DesignLabPageShell>
  );
}
