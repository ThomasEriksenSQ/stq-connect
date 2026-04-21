import { forwardRef } from "react";
import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, ReactNode } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

import { C } from "./theme";

type ActionVariant = "primary" | "secondary" | "ghost";
type FilterActiveColors = {
  background?: string;
  color?: string;
  border?: string;
  fontWeight?: number;
};

type FilterHoverColors = {
  background?: string;
  color?: string;
  border?: string;
};

type StaticTagColors = {
  background?: string;
  color?: string;
  border?: string;
  fontWeight?: number;
};

export const DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS = {
  background: "transparent",
  color: C.textSecondary,
  border: `1px solid ${C.borderDefault}`,
  fontWeight: 500,
} satisfies FilterActiveColors;

export const DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS = {
  background: C.filterActiveBg,
  color: C.textPrimary,
  border: `1px solid ${C.filterActiveBorder}`,
  fontWeight: 600,
} satisfies FilterActiveColors;

export const DESIGN_LAB_NEUTRAL_TAG_INACTIVE_HOVER_COLORS = {
  background: C.hoverSubtle,
} satisfies FilterHoverColors;

export function DesignLabStaticTag({
  className,
  colors = DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS,
  style,
  children,
}: {
  className?: string;
  colors?: StaticTagColors;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <span
      className={cn("inline-flex items-center justify-center gap-1.5 whitespace-nowrap", className)}
      style={{
        height: "var(--dl-filter-height, 28px)",
        minWidth: "var(--dl-filter-min-width, 28px)",
        paddingInline: "var(--dl-filter-padding-x, 10px)",
        fontSize: "var(--dl-filter-font-size, 12px)",
        fontWeight: colors.fontWeight ?? 600,
        borderRadius: 6,
        border: colors.border ?? `1px solid ${C.filterActiveBorder}`,
        background: colors.background ?? C.filterActiveBg,
        color: colors.color ?? C.textPrimary,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

const FOCUS_VARS: CSSProperties = {
  ["--dl-focus-ring" as string]: C.borderFocus,
  ["--dl-focus-offset" as string]: C.surface,
};

function withFocusVars(style?: CSSProperties): CSSProperties {
  return {
    ...FOCUS_VARS,
    ...style,
  };
}

function handleInteractiveHover(
  element: HTMLButtonElement | HTMLInputElement,
  values: { background?: string; color?: string; border?: string },
) {
  if (typeof values.background === "string") element.style.background = values.background;
  if (typeof values.color === "string") element.style.color = values.color;
  if (typeof values.border === "string") element.style.border = values.border;
}

export const DesignLabFilterButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  activeColors?: FilterActiveColors;
  inactiveColors?: FilterActiveColors;
  inactiveHoverColors?: FilterHoverColors;
}>(function DesignLabFilterButton({
  active = false,
  activeColors,
  inactiveColors,
  inactiveHoverColors,
  className,
  disabled,
  onMouseEnter,
  onMouseLeave,
  style,
  children,
  ...props
}, ref) {
  const baseBorder = active
    ? activeColors?.border ?? `1px solid ${C.filterActiveBorder}`
    : inactiveColors?.border ?? `1px solid ${C.borderDefault}`;
  const baseBackground = active
    ? activeColors?.background ?? C.filterActiveBg
    : inactiveColors?.background ?? "transparent";
  const baseColor = active
    ? activeColors?.color ?? C.textPrimary
    : inactiveColors?.color ?? C.textSecondary;
  const baseFontWeight = active
    ? activeColors?.fontWeight ?? 600
    : inactiveColors?.fontWeight ?? 500;
  const hoverBackground = active
    ? activeColors?.background ?? C.filterActiveBg
    : inactiveHoverColors?.background ?? inactiveColors?.background ?? C.hoverSubtle;
  const hoverColor = active
    ? activeColors?.color ?? C.textPrimary
    : inactiveHoverColors?.color ?? inactiveColors?.color ?? baseColor;
  const hoverBorder = active
    ? activeColors?.border ?? baseBorder
    : inactiveHoverColors?.border ?? inactiveColors?.border ?? baseBorder;

  return (
    <button
      {...props}
      ref={ref}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dl-focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--dl-focus-offset)]",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        className,
      )}
      style={withFocusVars({
        height: "var(--dl-filter-height, 28px)",
        minWidth: "var(--dl-filter-min-width, 28px)",
        paddingInline: "var(--dl-filter-padding-x, 10px)",
        fontSize: "var(--dl-filter-font-size, 12px)",
        fontWeight: baseFontWeight,
        borderRadius: 6,
        border: baseBorder,
        background: baseBackground,
        color: disabled ? C.textGhost : baseColor,
        opacity: disabled ? 0.7 : 1,
        ...style,
      })}
      onMouseEnter={(event) => {
        if (!disabled) {
          handleInteractiveHover(event.currentTarget, {
            background: hoverBackground,
            color: hoverColor,
            border: hoverBorder,
          });
        }
        onMouseEnter?.(event);
      }}
      onMouseLeave={(event) => {
        handleInteractiveHover(event.currentTarget, {
          background: baseBackground,
          color: disabled ? C.textGhost : baseColor,
          border: baseBorder,
        });
        onMouseLeave?.(event);
      }}
    >
      {children}
    </button>
  );
});

export const DesignLabActionButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ActionVariant;
}>(function DesignLabActionButton({
  variant = "secondary",
  className,
  disabled,
  onMouseEnter,
  onMouseLeave,
  style,
  children,
  ...props
}, ref) {
  const variantMap: Record<ActionVariant, { background: string; border: string; color: string; hoverBackground: string }> = {
    primary: {
      background: C.accent,
      border: "1px solid transparent",
      color: C.onAccent,
      hoverBackground: C.accentHover,
    },
    secondary: {
      background: "transparent",
      border: `1px solid ${C.borderDefault}`,
      color: C.textSecondary,
      hoverBackground: C.hoverSubtle,
    },
    ghost: {
      background: "transparent",
      border: "1px solid transparent",
      color: C.textSecondary,
      hoverBackground: C.hoverSubtle,
    },
  };

  const config = variantMap[variant];
  const disabledBackground = variant === "primary" ? C.accentMuted : "transparent";
  const disabledBorder = variant === "secondary" ? `1px solid ${C.borderDefault}` : "1px solid transparent";
  const disabledColor = variant === "primary" ? C.accent : C.textGhost;

  return (
    <button
      {...props}
      ref={ref}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dl-focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--dl-focus-offset)]",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        className,
      )}
      style={withFocusVars({
        height: "var(--dl-action-height, 32px)",
        minWidth: "var(--dl-action-min-width, 32px)",
        paddingInline: "var(--dl-action-padding-x, 12px)",
        fontSize: "var(--dl-action-font-size, 13px)",
        fontWeight: 500,
        borderRadius: 6,
        border: disabled ? disabledBorder : config.border,
        background: disabled ? disabledBackground : config.background,
        color: disabled ? disabledColor : config.color,
        opacity: disabled ? 0.7 : 1,
        ...style,
      })}
      onMouseEnter={(event) => {
        if (!disabled) {
          handleInteractiveHover(event.currentTarget, {
            background: config.hoverBackground,
            color: config.color,
            border: config.border,
          });
        }
        onMouseEnter?.(event);
      }}
      onMouseLeave={(event) => {
        handleInteractiveHover(event.currentTarget, {
          background: disabled ? disabledBackground : config.background,
          color: disabled ? disabledColor : config.color,
          border: disabled ? disabledBorder : config.border,
        });
        onMouseLeave?.(event);
      }}
    >
      {children}
    </button>
  );
});

export const DesignLabIconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: 28 | 32;
}>(function DesignLabIconButton({
  size = 32,
  style,
  ...props
}, ref) {
  return (
    <DesignLabActionButton
      {...props}
      ref={ref}
      variant="ghost"
      style={{
        width: size,
        minWidth: size,
        paddingInline: 0,
        ...style,
      }}
    />
  );
});

export const DesignLabSearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, onFocus, onBlur, style, ...props }, ref) => {
    const border = `1px solid ${C.borderDefault}`;
    const focusBorder = `1px solid ${C.filterActiveBorder}`;

    return (
      <div className={cn("relative", className)} style={style}>
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
          style={{ width: 14, height: 14, color: C.textGhost }}
        />
        <input
          {...props}
          ref={ref}
          className={cn(
            "w-full focus-visible:outline-none placeholder:text-[var(--dl-placeholder)]",
            "focus-visible:ring-2 focus-visible:ring-[var(--dl-focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--dl-focus-offset)]",
          )}
          style={withFocusVars({
            ["--dl-placeholder" as string]: C.textGhost,
            height: 32,
            paddingLeft: 30,
            paddingRight: 10,
            borderRadius: 6,
            border,
            background: C.surface,
            color: C.textPrimary,
            fontSize: 13,
          })}
          onFocus={(event) => {
            event.currentTarget.style.border = focusBorder;
            onFocus?.(event);
          }}
          onBlur={(event) => {
            event.currentTarget.style.border = border;
            onBlur?.(event);
          }}
        />
      </div>
    );
  },
);

DesignLabSearchInput.displayName = "DesignLabSearchInput";

export function DesignLabControlLabel({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.04em",
        color: C.textMuted,
        width: 56,
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}
