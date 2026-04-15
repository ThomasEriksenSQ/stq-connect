import { Type } from "lucide-react";
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
          <button
            key={s}
            onClick={() => onChange(s)}
            style={{
              height: 24,
              minWidth: 28,
              padding: "0 6px",
              fontSize: 11,
              fontWeight: active ? 600 : 500,
              borderRadius: 3,
              border: `1px solid ${active ? C.accent : C.border}`,
              background: active ? C.accent : "transparent",
              color: active ? "#fff" : C.textFaint,
              cursor: "pointer",
              transition: "all 120ms ease",
            }}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}
