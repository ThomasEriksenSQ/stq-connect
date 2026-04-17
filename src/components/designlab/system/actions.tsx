import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";

import { DesignLabActionButton } from "@/components/designlab/controls";
import { cn } from "@/lib/utils";

type ActionProps = ComponentPropsWithoutRef<typeof DesignLabActionButton>;

const DESIGN_LAB_V2_ACTION_STYLE: CSSProperties = {
  height: 32,
  fontSize: 12,
  fontWeight: 500,
};

function withV2ActionStyle(style?: CSSProperties): CSSProperties {
  return {
    ...DESIGN_LAB_V2_ACTION_STYLE,
    ...style,
  };
}

export function getDesignLabV2ActionStyle(style?: CSSProperties): CSSProperties {
  return withV2ActionStyle(style);
}

export const DesignLabPrimaryAction = forwardRef<HTMLButtonElement, ActionProps>(function DesignLabPrimaryAction(
  { style, ...props },
  ref,
) {
  return <DesignLabActionButton {...props} ref={ref} variant="primary" style={withV2ActionStyle(style)} />;
});

export const DesignLabSecondaryAction = forwardRef<HTMLButtonElement, ActionProps>(function DesignLabSecondaryAction(
  { style, ...props },
  ref,
) {
  return <DesignLabActionButton {...props} ref={ref} variant="secondary" style={withV2ActionStyle(style)} />;
});

export const DesignLabGhostAction = forwardRef<HTMLButtonElement, ActionProps>(function DesignLabGhostAction(
  { style, ...props },
  ref,
) {
  return <DesignLabActionButton {...props} ref={ref} variant="ghost" style={withV2ActionStyle(style)} />;
});

export function DesignLabInlineTextAction({
  className,
  style,
  children,
  onMouseEnter,
  onMouseLeave,
  ...props
}: ActionProps & { children: ReactNode }) {
  return (
    <DesignLabActionButton
      {...props}
      variant="ghost"
      className={cn("justify-start", className)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        width: "fit-content",
        minWidth: 0,
        height: "auto",
        padding: "4px 6px",
        borderRadius: 4,
        border: "none",
        fontSize: 12,
        fontFamily: "inherit",
        fontWeight: 500,
        background: "transparent",
        color: "#5C636E",
        transition: "background-color 120ms cubic-bezier(0.16, 1, 0.3, 1)",
        ...style,
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.border = "none";
        onMouseEnter?.(event);
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.border = "none";
        onMouseLeave?.(event);
      }}
    >
      {children}
    </DesignLabActionButton>
  );
}

export function DesignLabInlineActions({
  children,
  className,
  style,
  align = "start",
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  align?: "start" | "end" | "between";
}) {
  const justifyContent =
    align === "between" ? "space-between" : align === "end" ? "flex-end" : "flex-start";

  return (
    <div className={cn("flex items-center gap-2", className)} style={{ justifyContent, ...style }}>
      {children}
    </div>
  );
}
