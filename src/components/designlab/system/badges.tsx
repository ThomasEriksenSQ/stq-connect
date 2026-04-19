import type { ReactNode } from "react";

import { C, HEAT_COLORS, SIGNAL_COLORS } from "@/components/designlab/theme";
import { CATEGORIES, normalizeCategoryLabel } from "@/lib/categoryUtils";
import type { HeatResult } from "@/lib/heatScore";
import { cn } from "@/lib/utils";

export type DesignLabStatusBadgeTone = "default" | "signal" | "muted";

function getDesignLabStatusBadgeStyles(category?: string | null, tone: DesignLabStatusBadgeTone = "default") {
  const normalizedCategory = category ? normalizeCategoryLabel(category) : null;
  const categoryColors = normalizedCategory
    ? SIGNAL_COLORS[normalizedCategory as keyof typeof SIGNAL_COLORS]
    : null;

  if (categoryColors) {
    return {
      background: categoryColors.bg,
      color: categoryColors.color,
      border: `1px solid ${categoryColors.border}`,
    };
  }

  if (tone === "muted") {
    return {
      background: "transparent",
      color: C.textFaint,
      border: `1px solid ${C.borderDefault}`,
    };
  }

  return {
    background: C.statusNeutralBg,
    color: C.statusNeutral,
    border: `1px solid ${C.statusNeutralBorder}`,
  };
}

export function DesignLabStatusBadge({
  children,
  className,
  category,
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  category?: string;
  tone?: DesignLabStatusBadgeTone;
}) {
  return (
    <span
      className={cn("inline-flex items-center whitespace-nowrap", className)}
      style={{
        height: 28,
        padding: "0 10px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 500,
        ...getDesignLabStatusBadgeStyles(category, tone),
      }}
    >
      {children}
    </span>
  );
}

export function DesignLabCategoryBadge({ label, className }: { label: string; className?: string }) {
  const normalized = normalizeCategoryLabel(label);
  const isKnown = CATEGORIES.some((category) => category.label === normalized);

  if (!isKnown) return null;

  return (
    <DesignLabStatusBadge category={normalized} className={className}>
      {normalized}
    </DesignLabStatusBadge>
  );
}

const SIGNAL_SHORT_LABELS: Record<string, string> = {
  "Behov nå": "Behov nå",
  "Får fremtidig behov": "Fremtidig",
  "Får kanskje behov": "Kanskje",
  "Ukjent om behov": "Ukjent",
  "Ikke aktuelt": "Ikke aktuelt",
};

export function DesignLabSignalBadge({
  signal,
  size = "sm",
  className,
}: {
  signal: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const normalized = normalizeCategoryLabel(signal);
  const colors = SIGNAL_COLORS[normalized as keyof typeof SIGNAL_COLORS];

  if (!colors) return null;

  return (
    <span
      className={cn("inline-flex items-center whitespace-nowrap", className)}
      style={{
        height: 28,
        padding: "0 10px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 500,
        background: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.border}`,
      }}
    >
      {size === "sm" ? SIGNAL_SHORT_LABELS[normalized] ?? normalized : normalized}
    </span>
  );
}

const HEAT_BADGE_TONES: Record<HeatResult["temperature"], { bg: string; color: string; border: string; dot: string; label: string }> = {
  hett:    { bg: "rgba(208, 64, 69, 0.10)", color: "#8B1D20", border: "rgba(208, 64, 69, 0.28)", dot: "#D04045", label: "Hett" },
  lovende: { bg: "rgba(229, 160, 48, 0.12)", color: "#7D4E00", border: "rgba(229, 160, 48, 0.32)", dot: "#E5A030", label: "Lovende" },
  mulig:   { bg: "rgba(26, 79, 160, 0.10)",  color: "#1A4FA0", border: "rgba(26, 79, 160, 0.28)", dot: "#1A4FA0", label: "Mulig" },
  sovende: { bg: "transparent",              color: C.textFaint, border: C.borderDefault,         dot: C.textGhost, label: "Sovende" },
};

export function DesignLabHeatBadge({
  temperature,
  className,
}: {
  temperature?: HeatResult["temperature"] | null;
  className?: string;
}) {
  if (!temperature) {
    return (
      <span className={cn("inline-flex items-center", className)} style={{ fontSize: 11, color: C.textFaint }}>
        —
      </span>
    );
  }

  const tone = HEAT_BADGE_TONES[temperature];

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}
      style={{
        height: 22,
        padding: "0 8px",
        borderRadius: 5,
        fontSize: 11,
        fontWeight: 500,
        background: tone.bg,
        color: tone.color,
        border: `1px solid ${tone.border}`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: tone.dot,
          flexShrink: 0,
        }}
      />
      {tone.label}
    </span>
  );
}
