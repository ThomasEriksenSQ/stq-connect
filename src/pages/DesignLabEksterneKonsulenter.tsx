import EksterneKonsulenter from "./EksterneKonsulenter";

import { DesignLabPageShell } from "@/components/designlab/DesignLabPageShell";

export default function DesignLabEksterneKonsulenter() {
  return (
    <DesignLabPageShell activePath="/design-lab/eksterne" title="Eksterne" maxWidth={1180}>
      <EksterneKonsulenter hidePageTitle />
    </DesignLabPageShell>
  );
}
