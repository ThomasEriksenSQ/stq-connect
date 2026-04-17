import NettsideAI from "./NettsideAI";

import { DesignLabPageShell } from "@/components/designlab/DesignLabPageShell";

export default function DesignLabNettsideAI() {
  return (
    <DesignLabPageShell activePath="/design-lab/nettside-ai" title="stacq.no" maxWidth={null}>
      <NettsideAI hidePageIntro />
    </DesignLabPageShell>
  );
}
