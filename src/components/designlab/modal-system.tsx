import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, CSSProperties, FormEvent, ReactNode } from "react";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { usePersistentState } from "@/hooks/usePersistentState";

import type { TextSize } from "./TextSizeControl";

type ModalScale = {
  textSize: TextSize;
  width: number;
  titleSize: number;
  labelSize: number;
  controlSize: number;
  chipSize: number;
  rowGap: number;
  labelGap: number;
  controlHeight: number;
  chipHeight: number;
};

const MODAL_SCALE_MAP: Record<TextSize, Omit<ModalScale, "textSize">> = {
  S: {
    width: 440,
    titleSize: 13,
    labelSize: 10,
    controlSize: 11,
    chipSize: 11,
    rowGap: 10,
    labelGap: 3,
    controlHeight: 28,
    chipHeight: 28,
  },
  M: {
    width: 440,
    titleSize: 14,
    labelSize: 11,
    controlSize: 13,
    chipSize: 12,
    rowGap: 12,
    labelGap: 4,
    controlHeight: 32,
    chipHeight: 28,
  },
  L: {
    width: 460,
    titleSize: 15,
    labelSize: 12,
    controlSize: 14,
    chipSize: 13,
    rowGap: 14,
    labelGap: 4,
    controlHeight: 34,
    chipHeight: 30,
  },
  XL: {
    width: 460,
    titleSize: 16,
    labelSize: 13,
    controlSize: 15,
    chipSize: 14,
    rowGap: 16,
    labelGap: 5,
    controlHeight: 36,
    chipHeight: 32,
  },
  XXL: {
    width: 480,
    titleSize: 17,
    labelSize: 14,
    controlSize: 16,
    chipSize: 15,
    rowGap: 18,
    labelGap: 6,
    controlHeight: 38,
    chipHeight: 34,
  },
};

export function useDesignLabModalScale(): ModalScale {
  const [textSize] = usePersistentState<TextSize>("dl-text-size", "M");
  return {
    textSize,
    ...MODAL_SCALE_MAP[textSize],
  };
}

export function getDesignLabModalInputStyle(scale: ModalScale): CSSProperties {
  return {
    height: scale.controlHeight,
    borderRadius: 6,
    borderColor: "#DDE0E7",
    background: "#FFFFFF",
    paddingInline: 10,
    paddingBlock: 0,
    fontSize: scale.controlSize,
    lineHeight: 1.2,
    color: "#1A1C1F",
  };
}

export function getDesignLabModalLabelStyle(scale: ModalScale): CSSProperties {
  return {
    fontSize: scale.labelSize,
    fontWeight: 500,
    color: "#8C929C",
    lineHeight: 1.2,
  };
}

export function getDesignLabModalChipStyle(scale: ModalScale): CSSProperties {
  return {
    height: scale.chipHeight,
    minWidth: scale.chipHeight,
    paddingInline: 10,
    fontSize: scale.chipSize,
  };
}

export function getDesignLabModalActionStyle(scale: ModalScale): CSSProperties {
  return {
    width: "100%",
    height: scale.controlHeight,
    marginTop: scale.rowGap,
    fontSize: scale.controlSize,
  };
}

export function DesignLabModalContent({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const scale = useDesignLabModalScale();

  return (
    <DialogContent
      hideCloseButton
      overlayClassName="bg-[rgba(0,0,0,0.35)]"
      className="w-[calc(100vw-2rem)] gap-0 rounded-[10px] border-[#E8EAEE] bg-white p-0 shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
      style={{ maxWidth: scale.width }}
    >
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <DialogTitle
          className="font-semibold text-[#1A1C1F]"
          style={{ fontSize: scale.titleSize, lineHeight: 1.2 }}
        >
          {title}
        </DialogTitle>
        <DialogClose asChild>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] border border-transparent text-[#5C636E] transition-colors hover:bg-[#F0F2F6] hover:text-[#1A1C1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5E6AD2] focus-visible:ring-offset-2"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Lukk</span>
          </button>
        </DialogClose>
      </div>
      {children}
    </DialogContent>
  );
}

export function DesignLabModalForm({
  children,
  onSubmit,
}: {
  children: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const scale = useDesignLabModalScale();

  return (
    <form onSubmit={onSubmit} className="px-4 pb-4" style={{ display: "grid", rowGap: scale.rowGap }}>
      {children}
    </form>
  );
}

export function DesignLabModalField({ children }: { children: ReactNode }) {
  const scale = useDesignLabModalScale();
  return <div style={{ display: "grid", rowGap: scale.labelGap }}>{children}</div>;
}

export function DesignLabModalLabel({ children }: { children: ReactNode }) {
  const scale = useDesignLabModalScale();
  return (
    <span className="block" style={getDesignLabModalLabelStyle(scale)}>
      {children}
    </span>
  );
}

export const DesignLabModalInput = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<typeof Input>>(
  ({ className, style, ...props }, ref) => {
    const scale = useDesignLabModalScale();

    return (
      <Input
        {...props}
        ref={ref}
        className={cn("placeholder:text-[#8C929C] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#5E6AD2]", className)}
        style={{ ...getDesignLabModalInputStyle(scale), ...style }}
      />
    );
  },
);

DesignLabModalInput.displayName = "DesignLabModalInput";
