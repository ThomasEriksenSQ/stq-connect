import { Type } from "lucide-react";
import type { CSSProperties } from "react";

import { DesignLabFilterButton } from "@/components/designlab/controls";

import { C } from "./theme";

const SIZES = ["S", "M", "L", "XL", "XXL"] as const;
export type TextSize = typeof SIZES[number];

type TextSizePreset = {
  scale: number;
  description: string;
};

export const TEXT_SIZE_PRESETS: Record<TextSize, TextSizePreset> = {
  S: { scale: 0.95, description: "Kompakt" },
  M: { scale: 1.05, description: "Standard" },
  L: { scale: 1.15, description: "Litt større" },
  XL: { scale: 1.25, description: "Stor" },
  XXL: { scale: 1.4, description: "Ekstra stor" },
};

export const SCALE_MAP: Record<TextSize, number> = Object.fromEntries(
  SIZES.map((size) => [size, TEXT_SIZE_PRESETS[size].scale]),
) as Record<TextSize, number>;

export function scaleTextMetric(value: number, textSize: TextSize): number {
  return Math.round(value * SCALE_MAP[textSize] * 10) / 10;
}

export function getDesignLabTextSizeVars(textSize: TextSize): CSSProperties {
  const scale = SCALE_MAP[textSize];

  return {
    ["--dl-text-scale" as string]: String(scale),
    ["--dl-text-xs" as string]: `${scaleTextMetric(11, textSize)}px`,
    ["--dl-text-sm" as string]: `${scaleTextMetric(12, textSize)}px`,
    ["--dl-text-md" as string]: `${scaleTextMetric(13, textSize)}px`,
    ["--dl-text-lg" as string]: `${scaleTextMetric(14, textSize)}px`,
    ["--dl-text-xl" as string]: `${scaleTextMetric(16, textSize)}px`,
    ["--dl-line-height-tight" as string]: scale <= 1 ? "1.25" : "1.22",
    ["--dl-line-height-body" as string]: scale <= 1 ? "1.45" : "1.4",
  };
}

export function getDesignLabTextSizeStyle(textSize: TextSize): CSSProperties {
  return {
    ...getDesignLabTextSizeVars(textSize),
    zoom: SCALE_MAP[textSize],
  };
}

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
            title={`${s} · ${TEXT_SIZE_PRESETS[s].description} · ${Math.round(TEXT_SIZE_PRESETS[s].scale * 100)}%`}
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
