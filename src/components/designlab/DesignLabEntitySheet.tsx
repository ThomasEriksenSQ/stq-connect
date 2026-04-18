import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";

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
