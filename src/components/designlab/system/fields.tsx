import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function getDesignLabFieldLabelStyle(): CSSProperties {
  return {
    fontSize: "var(--dl-modal-font-size, inherit)",
    fontFamily: "inherit",
    fontWeight: 500,
    color: "#8C929C",
    lineHeight: 1.2,
  };
}

export function getDesignLabTextFieldStyle(): CSSProperties {
  return {
    height: "var(--dl-modal-control-height, 32px)",
    borderRadius: 6,
    borderColor: "#DDE0E7",
    background: "#FFFFFF",
    boxShadow: "inset 0 1px 0 rgba(0,0,0,0.02)",
    paddingInline: 10,
    paddingBlock: 0,
    fontSize: 13,
    fontFamily: "inherit",
    lineHeight: 1.2,
    color: "#1A1C1F",
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

export const DesignLabTextField = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<typeof Input>>(
  ({ className, style, ...props }, ref) => {
    return (
      <Input
        {...props}
        ref={ref}
        className={cn(
          "placeholder:text-[#8C929C] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#5E6AD2] focus-visible:shadow-[0_0_0_2px_rgba(94,106,210,0.15)]",
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
