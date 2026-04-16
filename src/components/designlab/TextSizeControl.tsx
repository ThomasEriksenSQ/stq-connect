import { Type } from "lucide-react";

import { DesignLabFilterButton } from "@/components/designlab/controls";

import { C } from "./theme";

const SIZES = ["S", "M", "L", "XL", "XXL"] as const;
export type TextSize = typeof SIZES[number];

export const SCALE_MAP: Record<TextSize, number> = {
  S: 0.875,
  M: 1,
  L: 1.125,
  XL: 1.25,
  XXL: 1.4,
};

interface Props {
  value: TextSize;
  onChange: (v: TextSize) => void;
}

export function TextSizeControl({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <Type size={13} color={C.textFaint} />
      {SIZES.map((s) => {
        const active = s === value;
        return (
          <DesignLabFilterButton
            key={s}
            onClick={() => onChange(s)}
            active={active}
            style={{
              minWidth: 28,
              paddingInline: 6,
              fontSize: 11,
              transition: "all 120ms ease",
            }}
          >
            {s}
          </DesignLabFilterButton>
        );
      })}
    </div>
  );
}
