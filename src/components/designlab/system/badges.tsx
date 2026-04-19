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
