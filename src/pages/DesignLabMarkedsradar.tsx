import Markedsradar from "./Markedsradar";

import { DesignLabPageShell } from "@/components/designlab/DesignLabPageShell";

export default function DesignLabMarkedsradar() {
  return (
    <DesignLabPageShell activePath="/design-lab/markedsradar" title="Markedsradar" maxWidth={null}>
      <Markedsradar hidePageIntro designLabMode />
    </DesignLabPageShell>
  );
}
