import type { CSSProperties, ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet";
import { useDesignLabModalScale } from "@/components/designlab/system/modal";
import { DesignLabIconButton } from "@/components/designlab/controls";

interface DesignLabEntitySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  hideCloseButton?: boolean;
}

export function DesignLabEntitySheet({
  open,
  onOpenChange,
  children,
  className,
  contentClassName,
  hideCloseButton = false,
}: DesignLabEntitySheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        hideCloseButton={hideCloseButton}
        className={cn("w-full sm:w-[920px] p-0", className)}
      >
        <div className={cn("h-full overflow-y-auto", contentClassName)}>{children}</div>
      </SheetContent>
    </Sheet>
  );
}

/* ────────────────────────────────────────────────────────────
   V2 Form Sheet — header + body + footer building blocks.
   Designed to match "Ny forespørsel"-style sheets and to scale
   with the Design Lab text-size control via useDesignLabModalScale.
   ──────────────────────────────────────────────────────────── */

interface DesignLabFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /** Optional max width override; defaults to 560px which matches forespørsel-modalen */
  maxWidth?: number;
}

/**
 * Thin sheet shell for V2 form modals. Renders no header/footer chrome —
 * compose with `DesignLabFormSheetHeader`, `DesignLabFormSheetBody` and
 * `DesignLabFormSheetFooter`.
 */
export function DesignLabFormSheet({
  open,
  onOpenChange,
  children,
  maxWidth = 560,
}: DesignLabFormSheetProps) {
  const scale = useDesignLabModalScale();
  const scaleVars: CSSProperties = {
    ["--dl-modal-row-gap" as string]: `${scale.rowGap}px`,
    ["--dl-modal-section-gap" as string]: `${scale.sectionGap}px`,
    ["--dl-modal-label-gap" as string]: `${scale.labelGap}px`,
    ["--dl-modal-grid-gap" as string]: `${scale.gridGap}px`,
    ["--dl-modal-chip-gap" as string]: `${scale.chipGap}px`,
    ["--dl-modal-control-height" as string]: `${scale.controlHeight}px`,
    ["--dl-modal-action-height" as string]: `${scale.actionHeight}px`,
    ["--dl-modal-chip-height" as string]: `${scale.chipHeight}px`,
    ["--dl-modal-font-size" as string]: scale.fontSize,
    ["--dl-modal-action-font-size" as string]: `${scale.actionFontSize}px`,
    ["--dl-modal-chip-font-size" as string]: `${scale.chipFontSize}px`,
    ["--dl-modal-inline-action-font-size" as string]: `${scale.inlineActionFontSize}px`,
    ["--dl-modal-header-padding-x" as string]: `${scale.headerPaddingX}px`,
    ["--dl-modal-header-padding-top" as string]: `${scale.headerPaddingTop}px`,
    ["--dl-modal-header-padding-bottom" as string]: `${scale.headerPaddingBottom}px`,
    ["--dl-modal-body-padding-x" as string]: `${scale.bodyPaddingX}px`,
    ["--dl-modal-body-padding-bottom" as string]: `${scale.bodyPaddingBottom}px`,
    ["--dl-action-height" as string]: `${scale.actionHeight}px`,
    ["--dl-action-font-size" as string]: `${scale.actionFontSize}px`,
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        hideCloseButton
        className="w-full p-0 dl-v8-theme"
        style={{ maxWidth: `min(100vw, ${maxWidth}px)`, ...scaleVars }}
      >
        <div className="flex h-full flex-col bg-white">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

export function DesignLabFormSheetHeader({ title }: { title: string }) {
  return (
    <div
      className="shrink-0 flex items-center justify-between border-b border-[#E8EAEE]"
      style={{
        paddingLeft: "var(--dl-modal-header-padding-x, 24px)",
        paddingRight: "var(--dl-modal-header-padding-x, 24px)",
        paddingTop: "var(--dl-modal-header-padding-bottom, 16px)",
        paddingBottom: "var(--dl-modal-header-padding-bottom, 16px)",
      }}
    >
      <h2
        className="font-semibold text-[#1A1C1F]"
        style={{
          fontSize: `calc(var(--dl-modal-font-size, 13px) * 1.45)`,
          lineHeight: 1.2,
          letterSpacing: "-0.005em",
        }}
      >
        {title}
      </h2>
      <SheetClose asChild>
        <DesignLabIconButton aria-label="Lukk">
          <X style={{ width: 16, height: 16 }} />
        </DesignLabIconButton>
      </SheetClose>
    </div>
  );
}

export function DesignLabFormSheetBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex-1 overflow-y-auto", className)}
      style={{
        paddingLeft: "var(--dl-modal-body-padding-x, 24px)",
        paddingRight: "var(--dl-modal-body-padding-x, 24px)",
        paddingTop: "var(--dl-modal-header-padding-bottom, 16px)",
        paddingBottom: "var(--dl-modal-body-padding-bottom, 24px)",
      }}
    >
      <div style={{ display: "grid", rowGap: "var(--dl-modal-row-gap, 18px)" }}>{children}</div>
    </div>
  );
}

export function DesignLabFormSheetFooter({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className="shrink-0 flex items-center justify-between border-t border-[#E8EAEE] bg-white"
      style={{
        paddingLeft: "var(--dl-modal-body-padding-x, 24px)",
        paddingRight: "var(--dl-modal-body-padding-x, 24px)",
        paddingTop: "var(--dl-modal-header-padding-bottom, 16px)",
        paddingBottom: "var(--dl-modal-header-padding-bottom, 16px)",
      }}
    >
      {children}
    </div>
  );
}
