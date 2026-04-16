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
  inactiveHoverColors?: FilterHoverColors;
}>(function DesignLabFilterButton({
  active = false,
  activeColors,
  inactiveHoverColors,
  className,
  disabled,
  onMouseEnter,
  onMouseLeave,
  style,
  children,
  ...props
}, ref) {
  const baseBorder = active ? activeColors?.border ?? `1px solid ${C.filterActiveBorder}` : `1px solid ${C.borderDefault}`;
  const baseBackground = active ? activeColors?.background ?? C.filterActiveBg : "transparent";
  const baseColor = active ? activeColors?.color ?? C.textPrimary : C.textSecondary;
  const baseFontWeight = active ? activeColors?.fontWeight ?? 600 : 500;
  const hoverBackground = active
    ? activeColors?.background ?? C.filterActiveBg
    : inactiveHoverColors?.background ?? C.hoverSubtle;
  const hoverColor = active
    ? activeColors?.color ?? C.textPrimary
    : inactiveHoverColors?.color ?? baseColor;
  const hoverBorder = active
    ? activeColors?.border ?? baseBorder
    : inactiveHoverColors?.border ?? baseBorder;

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
        height: 28,
        minWidth: 28,
        paddingInline: 10,
        fontSize: 12,
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
  const disabledBackground = variant === "primary" ? C.accentBg : "transparent";
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
        height: 32,
        minWidth: 32,
        paddingInline: 12,
        fontSize: 13,
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
