import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { C } from "@/components/designlab/theme";

export function getDesignLabFieldLabelStyle(): CSSProperties {
  return {
    fontSize: "var(--dl-modal-font-size, inherit)",
    fontFamily: "inherit",
    fontWeight: 500,
    color: C.textFaint,
    lineHeight: 1.2,
  };
}

export function getDesignLabTextFieldStyle(): CSSProperties {
  return {
    height: "var(--dl-modal-control-height, 32px)",
    borderRadius: 6,
    borderColor: C.borderDefault,
    background: C.surface,
    boxShadow: "inset 0 1px 0 rgba(0,0,0,0.02)",
    paddingInline: 10,
    paddingBlock: 0,
    fontSize: "var(--dl-modal-font-size, 13px)",
    fontFamily: "inherit",
    lineHeight: 1.2,
    color: C.text,
  };
}

export function DesignLabFieldStack({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={className} style={{ display: "grid", rowGap: "var(--dl-modal-label-gap, 4px)", ...style }}>
      {children}
    </div>
  );
}

export function DesignLabFieldLabel({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={cn("block", className)} style={{ ...getDesignLabFieldLabelStyle(), ...style }}>
      {children}
    </span>
  );
}

/**
 * Uppercase, tracked section label used inside V2 form sheets
 * (matches the "MOTTATT", "SELSKAP *" headings in Ny forespørsel).
 */
export function DesignLabSectionLabel({
  children,
  required,
  className,
  style,
}: {
  children: ReactNode;
  required?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cn("block", className)}
      style={{
        fontSize: `calc(var(--dl-modal-font-size, 13px) * 0.82)`,
        fontFamily: "inherit",
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: C.textFaint,
        lineHeight: 1.2,
        ...style,
      }}
    >
      {children}
      {required ? <span style={{ color: C.danger, marginLeft: 3 }}>*</span> : null}
    </span>
  );
}

export const DesignLabTextField = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<typeof Input>>(
  ({ className, style, ...props }, ref) => {
    return (
      <Input
        {...props}
        ref={ref}
        className={cn(
          "placeholder:text-[var(--dl-text-faint)] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[var(--dl-border-focus)] focus-visible:shadow-[0_0_0_2px_var(--dl-accent-bg)]",
          className,
        )}
        style={{ ...getDesignLabTextFieldStyle(), ...style }}
      />
    );
  },
);

DesignLabTextField.displayName = "DesignLabTextField";

export function DesignLabFieldGrid({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn("grid grid-cols-1 sm:grid-cols-2", className)}
      style={{ gap: "var(--dl-modal-grid-gap, 12px)", ...style }}
    >
      {children}
    </div>
  );
}
