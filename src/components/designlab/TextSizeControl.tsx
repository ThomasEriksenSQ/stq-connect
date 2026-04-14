import { Type } from "lucide-react";

const SIZES = ["S", "M", "L", "XL"] as const;
export type TextSize = typeof SIZES[number];

export const SCALE_MAP: Record<TextSize, string> = {
  S: "87.5%",
  M: "100%",
  L: "112.5%",
  XL: "125%",
};

const C = {
  accent: "#01696F",
  border: "rgba(40,37,29,0.08)",
  text: "#28251D",
  textMuted: "#6B6B66",
};

interface Props {
  value: TextSize;
  onChange: (v: TextSize) => void;
}

export function TextSizeControl({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <Type size={13} color={C.textMuted} />
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
              borderRadius: 9999,
              border: `1px solid ${active ? C.accent : C.border}`,
              background: active ? C.accent : "transparent",
              color: active ? "#fff" : C.textMuted,
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
