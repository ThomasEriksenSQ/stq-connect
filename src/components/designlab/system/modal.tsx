import type { ComponentPropsWithoutRef, CSSProperties, FormEvent, ReactNode } from "react";
import { X } from "lucide-react";

import { DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { usePersistentState } from "@/hooks/usePersistentState";

import { SCALE_MAP, getDesignLabTextSizeVars, type TextSize } from "@/components/designlab/TextSizeControl";
import {
  DesignLabFieldGrid,
  DesignLabFieldLabel,
  DesignLabFieldStack,
  DesignLabTextField,
  getDesignLabTextFieldStyle,
} from "./fields";
import {
  DesignLabGhostAction,
  DesignLabInlineActions,
  DesignLabInlineTextAction,
} from "./actions";

export type ModalScale = {
  textSize: TextSize;
  scaleFactor: number;
  width: number;
  fontSize: string;
  rowGap: number;
  sectionGap: number;
  labelGap: number;
  gridGap: number;
  chipGap: number;
  controlHeight: number;
  actionHeight: number;
  chipHeight: number;
  actionFontSize: number;
  chipFontSize: number;
  inlineActionFontSize: number;
  headerPaddingX: number;
  headerPaddingTop: number;
  headerPaddingBottom: number;
  bodyPaddingX: number;
  bodyPaddingBottom: number;
  closeButtonSize: number;
};

const MODAL_BASE_LAYOUT = {
  width: 460,
  fontSize: 13,
  rowGap: 18,
  sectionGap: 22,
  labelGap: 4,
  gridGap: 12,
  chipGap: 6,
  controlHeight: 32,
  actionHeight: 32,
  chipHeight: 28,
  actionFontSize: 12,
  chipFontSize: 12,
  inlineActionFontSize: 12,
  headerPaddingX: 24,
  headerPaddingTop: 24,
  headerPaddingBottom: 16,
  bodyPaddingX: 24,
  bodyPaddingBottom: 24,
  closeButtonSize: 32,
} as const;

function scaleMetric(value: number, scaleFactor: number): number {
  return Math.round(value * scaleFactor * 10) / 10;
}

export function useDesignLabModalScale(): ModalScale {
  const [textSize] = usePersistentState<TextSize>("dl-text-size", "M");
  const scaleFactor = SCALE_MAP[textSize];

  return {
    textSize,
    scaleFactor,
    width: scaleMetric(MODAL_BASE_LAYOUT.width, scaleFactor),
    fontSize: `${scaleMetric(MODAL_BASE_LAYOUT.fontSize, scaleFactor)}px`,
    rowGap: scaleMetric(MODAL_BASE_LAYOUT.rowGap, scaleFactor),
    sectionGap: scaleMetric(MODAL_BASE_LAYOUT.sectionGap, scaleFactor),
    labelGap: scaleMetric(MODAL_BASE_LAYOUT.labelGap, scaleFactor),
    gridGap: scaleMetric(MODAL_BASE_LAYOUT.gridGap, scaleFactor),
    chipGap: scaleMetric(MODAL_BASE_LAYOUT.chipGap, scaleFactor),
    controlHeight: scaleMetric(MODAL_BASE_LAYOUT.controlHeight, scaleFactor),
    actionHeight: scaleMetric(MODAL_BASE_LAYOUT.actionHeight, scaleFactor),
    chipHeight: scaleMetric(MODAL_BASE_LAYOUT.chipHeight, scaleFactor),
    actionFontSize: scaleMetric(MODAL_BASE_LAYOUT.actionFontSize, scaleFactor),
    chipFontSize: scaleMetric(MODAL_BASE_LAYOUT.chipFontSize, scaleFactor),
    inlineActionFontSize: scaleMetric(MODAL_BASE_LAYOUT.inlineActionFontSize, scaleFactor),
    headerPaddingX: scaleMetric(MODAL_BASE_LAYOUT.headerPaddingX, scaleFactor),
    headerPaddingTop: scaleMetric(MODAL_BASE_LAYOUT.headerPaddingTop, scaleFactor),
    headerPaddingBottom: scaleMetric(MODAL_BASE_LAYOUT.headerPaddingBottom, scaleFactor),
    bodyPaddingX: scaleMetric(MODAL_BASE_LAYOUT.bodyPaddingX, scaleFactor),
    bodyPaddingBottom: scaleMetric(MODAL_BASE_LAYOUT.bodyPaddingBottom, scaleFactor),
    closeButtonSize: scaleMetric(MODAL_BASE_LAYOUT.closeButtonSize, scaleFactor),
  };
}

function getDesignLabModalScaleVars(scale: ModalScale): CSSProperties {
  return {
    ...getDesignLabTextSizeVars(scale.textSize),
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
    ["--dl-modal-close-size" as string]: `${scale.closeButtonSize}px`,
    ["--dl-filter-height" as string]: `${scale.chipHeight}px`,
    ["--dl-filter-min-width" as string]: `${scale.chipHeight}px`,
    ["--dl-filter-padding-x" as string]: `${scaleMetric(10, scale.scaleFactor)}px`,
    ["--dl-filter-font-size" as string]: `${scale.chipFontSize}px`,
    ["--dl-action-height" as string]: `${scale.actionHeight}px`,
    ["--dl-action-min-width" as string]: `${scale.actionHeight}px`,
    ["--dl-action-padding-x" as string]: `${scaleMetric(12, scale.scaleFactor)}px`,
    ["--dl-action-font-size" as string]: `${scale.actionFontSize}px`,
  };
}

export function getDesignLabModalInputStyle(scale: ModalScale): CSSProperties {
  return {
    ...getDesignLabTextFieldStyle(),
    ["--dl-modal-font-size" as string]: scale.fontSize,
    ["--dl-modal-control-height" as string]: `${scale.controlHeight}px`,
  };
}

export function getDesignLabModalChipStyle(scale: ModalScale): CSSProperties {
  return {
    height: `${scale.chipHeight}px`,
    minWidth: `${scale.chipHeight}px`,
    paddingInline: 10,
  };
}

export function getDesignLabModalGridStyle(scale: ModalScale): CSSProperties {
  return { gap: `${scale.gridGap}px` };
}

export function getDesignLabModalChipGroupStyle(scale: ModalScale): CSSProperties {
  return {
    gap: `${scale.chipGap}px`,
    marginTop: "calc(var(--dl-modal-label-gap) + 2px)",
  };
}

export function getDesignLabModalInlineActionStyle(scale: ModalScale): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    minWidth: 0,
    height: "auto",
    padding: "4px 6px",
    borderRadius: 4,
    border: "none",
    fontSize: `${scale.inlineActionFontSize}px`,
    fontFamily: "inherit",
    fontWeight: 500,
    background: "transparent",
    color: "#5C636E",
    transition: "background-color 120ms cubic-bezier(0.16, 1, 0.3, 1)",
  };
}

function DesignLabModalSurface({
  title,
  children,
  closeSlot,
  useDialogTitle = false,
}: {
  title: string;
  children: ReactNode;
  closeSlot?: ReactNode;
  useDialogTitle?: boolean;
}) {
  const scale = useDesignLabModalScale();
  const titleStyle: CSSProperties = {
    fontSize: "var(--dl-modal-font-size)",
    fontFamily: "inherit",
    lineHeight: 1.2,
  };

  return (
    <div
      className="w-[calc(100vw-2rem)] gap-0 rounded-[10px] border border-[#E8EAEE] bg-white p-0 shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
      style={{
        width: `min(calc(100vw - 2rem), ${scale.width}px)`,
        maxWidth: "100%",
        fontFamily: "inherit",
        ...getDesignLabModalScaleVars(scale),
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{
          paddingInline: "var(--dl-modal-header-padding-x)",
          paddingTop: "var(--dl-modal-header-padding-top)",
          paddingBottom: "var(--dl-modal-header-padding-bottom)",
        }}
      >
        {useDialogTitle ? (
          <DialogTitle className="font-semibold text-[#1A1C1F]" style={titleStyle}>
            {title}
          </DialogTitle>
        ) : (
          <h2 className="font-semibold text-[#1A1C1F]" style={titleStyle}>
            {title}
          </h2>
        )}
        {closeSlot}
      </div>
      {children}
    </div>
  );
}

export function DesignLabModalContent({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <DialogContent
      hideCloseButton
      overlayClassName="bg-[rgba(0,0,0,0.35)] backdrop-blur-[2px]"
      className="border-none bg-transparent p-0 shadow-none"
    >
      <DesignLabModalSurface
        title={title}
        useDialogTitle
        closeSlot={
          <DialogClose asChild>
            <DesignLabGhostAction
              type="button"
              style={{ width: "var(--dl-modal-close-size)", minWidth: "var(--dl-modal-close-size)", paddingInline: 0 }}
              className="text-[#5C636E] hover:bg-[#F0F2F6] hover:text-[#1A1C1F] focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Lukk</span>
            </DesignLabGhostAction>
          </DialogClose>
        }
      >
        {children}
      </DesignLabModalSurface>
    </DialogContent>
  );
}

export function DesignLabModalPreviewSurface({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <DesignLabModalSurface
      title={title}
      closeSlot={
        <DesignLabGhostAction
          type="button"
          style={{ width: "var(--dl-modal-close-size)", minWidth: "var(--dl-modal-close-size)", paddingInline: 0 }}
          className="pointer-events-none text-[#5C636E]"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Lukk</span>
        </DesignLabGhostAction>
      }
    >
      {children}
    </DesignLabModalSurface>
  );
}

export function DesignLabModalForm({
  children,
  onSubmit,
}: {
  children: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "grid",
        rowGap: "var(--dl-modal-row-gap)",
        paddingInline: "var(--dl-modal-body-padding-x)",
        paddingBottom: "var(--dl-modal-body-padding-bottom)",
      }}
    >
      {children}
    </form>
  );
}

export function DesignLabModalField({ children }: { children: ReactNode }) {
  return <DesignLabFieldStack>{children}</DesignLabFieldStack>;
}

export function DesignLabModalLabel({ children }: { children: ReactNode }) {
  return <DesignLabFieldLabel>{children}</DesignLabFieldLabel>;
}

export const DesignLabModalInput = DesignLabTextField;

export function DesignLabModalFieldGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <DesignLabFieldGrid className={className}>{children}</DesignLabFieldGrid>;
}

export function DesignLabModalChipGroup({
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
      className={className}
      style={{
        display: "flex",
        flexWrap: "wrap",
        ...getDesignLabModalChipGroupStyle(useDesignLabModalScale()),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function DesignLabModalActions({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <DesignLabInlineActions
      className={className}
      style={{ marginTop: "var(--dl-modal-section-gap)", ...style }}
    >
      {children}
    </DesignLabInlineActions>
  );
}

export function DesignLabModalInlineAction(props: ComponentPropsWithoutRef<typeof DesignLabInlineTextAction>) {
  const scale = useDesignLabModalScale();
  return <DesignLabInlineTextAction {...props} style={{ ...getDesignLabModalInlineActionStyle(scale), ...props.style }} />;
}
