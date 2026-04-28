import {
  DesignLabStaticTag,
  DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS,
} from "@/components/designlab/controls";

const DEAL_TYPE_TAG_COLORS = {
  direct: DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS,
  broker: { background: "#F5F3FF", color: "#6D28D9", border: "1px solid #DDD6FE", fontWeight: 600 },
  muted: { background: "#F7F8FA", color: "#8C929C", border: "1px solid #E3E6EB", fontWeight: 500 },
} as const;

export function ViaPartnerTag() {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-0.5 text-[0.6875rem] font-semibold">
      Via partner
    </span>
  );
}

export function DealTypeTag({ type }: { type: string | null | undefined }) {
  if (type === "DIR" || type === "direktekunde") {
    return <DesignLabStaticTag colors={DEAL_TYPE_TAG_COLORS.direct}>Direkte</DesignLabStaticTag>;
  }

  if (type === "VIA" || type === "via_partner") {
    return <ViaPartnerTag />;
  }

  if (type === "via_megler") {
    return <DesignLabStaticTag colors={DEAL_TYPE_TAG_COLORS.broker}>Megler</DesignLabStaticTag>;
  }

  return <DesignLabStaticTag colors={DEAL_TYPE_TAG_COLORS.muted}>—</DesignLabStaticTag>;
}
