import KonsulenterOppdrag from "./KonsulenterOppdrag";

import { DesignLabPageShell } from "@/components/designlab/DesignLabPageShell";

export default function DesignLabKonsulenterOppdrag() {
  return (
    <DesignLabPageShell activePath="/design-lab/aktive-oppdrag" title="Aktive oppdrag" maxWidth={null}>
      <KonsulenterOppdrag hidePageIntro />
    </DesignLabPageShell>
  );
}
