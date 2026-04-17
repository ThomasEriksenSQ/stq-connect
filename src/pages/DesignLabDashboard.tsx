import DailyBrief from "@/components/dashboard/DailyBrief";

import { DesignLabPageShell } from "@/components/designlab/DesignLabPageShell";

export default function DesignLabDashboard() {
  return (
    <DesignLabPageShell
      activePath="/design-lab/salgsagent"
      title="Salgsagent"
      maxWidth={null}
      contentStyle={{ padding: 0 }}
      contentClassName="h-full"
    >
      <DailyBrief designLabMode />
    </DesignLabPageShell>
  );
}
