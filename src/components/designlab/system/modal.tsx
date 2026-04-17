import type { ComponentPropsWithoutRef, CSSProperties, FormEvent, ReactNode } from "react";
import { X } from "lucide-react";

import { DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { usePersistentState } from "@/hooks/usePersistentState";

import type { TextSize } from "@/components/designlab/TextSizeControl";
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
};

const MODAL_LAYOUT_MAP: Record<TextSize, Omit<ModalScale, "textSize">> = {
  S: {
    width: 460,
    fontSize: "0.75rem",
    rowGap: 16,
    sectionGap: 20,
    labelGap: 4,
    gridGap: 12,
    chipGap: 6,
    controlHeight: 32,
    actionHeight: 32,
    chipHeight: 28,
  },
  M: {
    width: 460,
    fontSize: "0.8125rem",
    rowGap: 18,
    sectionGap: 22,
    labelGap: 4,
    gridGap: 12,
    chipGap: 6,
    controlHeight: 32,
    actionHeight: 32,
    chipHeight: 28,
  },
  L: {
    width: 460,
    fontSize: "0.875rem",
    rowGap: 18,
    sectionGap: 22,
    labelGap: 4,
    gridGap: 12,
    chipGap: 6,
    controlHeight: 32,
    actionHeight: 32,
    chipHeight: 28,
  },
  XL: {
    width: 460,
    fontSize: "0.9375rem",
    rowGap: 18,
    sectionGap: 22,
    labelGap: 4,
    gridGap: 12,
    chipGap: 6,
    controlHeight: 32,
    actionHeight: 32,
    chipHeight: 28,
  },
  XXL: {
    width: 480,
    fontSize: "1rem",
    rowGap: 18,
    sectionGap: 22,
    labelGap: 4,
    gridGap: 12,
    chipGap: 6,
    controlHeight: 32,
    actionHeight: 32,
    chipHeight: 28,
  },
};

export function useDesignLabModalScale(): ModalScale {
  const [textSize] = usePersistentState<TextSize>("dl-text-size", "M");
  return { textSize, ...MODAL_LAYOUT_MAP[textSize] };
}

function getDesignLabModalScaleVars(scale: ModalScale): CSSProperties {
  return {
    ["--dl-modal-row-gap" as string]: `${scale.rowGap}px`,
    ["--dl-modal-section-gap" as string]: `${scale.sectionGap}px`,
    ["--dl-modal-label-gap" as string]: `${scale.labelGap}px`,
    ["--dl-modal-grid-gap" as string]: `${scale.gridGap}px`,
    ["--dl-modal-chip-gap" as string]: `${scale.chipGap}px`,
    ["--dl-modal-control-height" as string]: `${scale.controlHeight}px`,
    ["--dl-modal-action-height" as string]: `${scale.actionHeight}px`,
    ["--dl-modal-chip-height" as string]: `${scale.chipHeight}px`,
    ["--dl-modal-font-size" as string]: scale.fontSize,
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
    fontSize: 12,
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
      <div className="flex items-center justify-between px-6 pb-4 pt-6">
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
              style={{ width: 32, minWidth: 32, paddingInline: 0 }}
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
          style={{ width: 32, minWidth: 32, paddingInline: 0 }}
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
    <form onSubmit={onSubmit} className="px-6 pb-6" style={{ display: "grid", rowGap: "var(--dl-modal-row-gap)" }}>
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
