import type { ComponentProps, ReactNode } from "react";

import {
  DesignLabControlLabel,
  DesignLabFilterButton,
} from "@/components/designlab/controls";
import { C, SIGNAL_COLORS } from "@/components/designlab/theme";
import { CATEGORIES, normalizeCategoryLabel } from "@/lib/categoryUtils";

export type DesignLabFilterActiveColors = NonNullable<ComponentProps<typeof DesignLabFilterButton>["activeColors"]>;

export const DESIGN_LAB_STATUS_NEUTRAL_CHIP_ACTIVE_COLORS = {
  background: C.statusNeutralBg,
  color: C.statusNeutral,
  border: `1px solid ${C.statusNeutralBorder}`,
  fontWeight: 500,
} satisfies DesignLabFilterActiveColors;

export function getDesignLabCategoryChipActiveColors(label: string): DesignLabFilterActiveColors | undefined {
  const normalized = normalizeCategoryLabel(label);
  const colors = SIGNAL_COLORS[normalized as keyof typeof SIGNAL_COLORS];

  if (!colors) return undefined;

  return {
    background: colors.bg,
    color: colors.color,
    border: `1px solid ${colors.border}`,
    fontWeight: 600,
  };
}

export function DesignLabCategoryPicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CATEGORIES.map((category) => (
        <DesignLabFilterButton
          key={category.label}
          type="button"
          onClick={() => onSelect(category.label)}
          active={selected === category.label}
          activeColors={getDesignLabCategoryChipActiveColors(category.label)}
        >
          {category.label}
        </DesignLabFilterButton>
      ))}
    </div>
  );
}

export function DesignLabReadonlyChip({
  active,
  children,
  activeColors,
}: {
  active: boolean;
  children: ReactNode;
  activeColors?: DesignLabFilterActiveColors;
}) {
  const inactiveStyles = {
    background: "transparent",
    color: C.textSecondary,
    border: `1px solid ${C.borderDefault}`,
    fontWeight: 500,
  };
  const resolvedActiveStyles = activeColors ?? {
    background: C.filterActiveBg,
    color: C.textPrimary,
    border: `1px solid ${C.filterActiveBorder}`,
    fontWeight: 600,
  };
  const styles = active ? resolvedActiveStyles : inactiveStyles;

  return (
    <span
      className="inline-flex items-center whitespace-nowrap"
      style={{
        height: 28,
        padding: "0 10px",
        borderRadius: 6,
        fontSize: 12,
        ...styles,
      }}
    >
      {children}
    </span>
  );
}

export function DesignLabToggleChip(props: ComponentProps<typeof DesignLabFilterButton>) {
  return <DesignLabFilterButton {...props} />;
}

export function DesignLabChipGroup({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: ComponentProps<"div">["style"];
}) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function DesignLabMatchFilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <DesignLabFilterButton onClick={onClick} active={active}>
      {children}
    </DesignLabFilterButton>
  );
}

export function DesignLabFilterRow<TOption extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly TOption[];
  value: string;
  onChange: (value: TOption) => void;
}) {
  return (
    <div className="flex flex-wrap items-start gap-x-2 gap-y-1.5 py-[3px]">
      <DesignLabControlLabel>{label}</DesignLabControlLabel>
      <div className="flex items-center gap-1.5 flex-wrap">
        {options.map((option) => {
          const active = value === option;

          return (
            <DesignLabFilterButton
              key={option}
              onClick={() => onChange(option)}
              active={active}
            >
              {option}
            </DesignLabFilterButton>
          );
        })}
      </div>
    </div>
  );
}
