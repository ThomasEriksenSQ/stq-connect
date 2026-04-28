import type { CSSProperties } from "react";

import {
  DesignLabStaticTag,
  DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS,
} from "@/components/designlab/controls";

const DEAL_TYPE_TAG_COLORS = {
  direct: DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS,
  via: { background: "#FEF3C7", color: "#B45309", border: "1px solid #FDE68A", fontWeight: 600 },
  broker: { background: "#F5F3FF", color: "#6D28D9", border: "1px solid #DDD6FE", fontWeight: 600 },
  muted: { background: "#F7F8FA", color: "#8C929C", border: "1px solid #E3E6EB", fontWeight: 500 },
} as const;

const VIA_PARTNER_BADGE_STYLE = {
  height: "auto",
  minHeight: 20,
  paddingInline: 10,
  paddingBlock: 2,
  fontSize: 11,
  lineHeight: 1.25,
  borderRadius: 9999,
} satisfies CSSProperties;

export function DealTypeTag({ type }: { type: string | null | undefined }) {
  if (type === "DIR" || type === "direktekunde") {
    return <DesignLabStaticTag colors={DEAL_TYPE_TAG_COLORS.direct}>Direkte</DesignLabStaticTag>;
  }

  if (type === "VIA" || type === "via_partner") {
    return (
      <DesignLabStaticTag colors={DEAL_TYPE_TAG_COLORS.via} style={VIA_PARTNER_BADGE_STYLE}>
        Via partner
      </DesignLabStaticTag>
    );
  }

  if (type === "via_megler") {
    return <DesignLabStaticTag colors={DEAL_TYPE_TAG_COLORS.broker}>Megler</DesignLabStaticTag>;
  }

  return <DesignLabStaticTag colors={DEAL_TYPE_TAG_COLORS.muted}>—</DesignLabStaticTag>;
}
