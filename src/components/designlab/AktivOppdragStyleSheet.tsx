import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";

/* ────────────────────────────────────────────────────────────
   V1-stilet sheet-shell som matcher OppdragEditSheet
   (920px, hvit, 1.25rem fet tittel, mørke valgt-chips,
    blå primær + grå sekundær footer).
   Brukes for "Nytt selskap" og "Ny kontakt" i Design Lab.
   ──────────────────────────────────────────────────────────── */

export const AKTIV_OPPDRAG_LABEL =
  "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

export const AKTIV_OPPDRAG_CHIP_BASE =
  "h-7 px-2.5 text-[0.75rem] rounded-[6px] border transition-colors cursor-pointer select-none font-medium";

export const aktivOppdragChipActive =
  "bg-foreground text-background border-foreground";

export const aktivOppdragChipInactive =
  "bg-background text-muted-foreground border-border hover:bg-secondary";

export const AKTIV_OPPDRAG_INPUT = "mt-1 text-[0.875rem]";

interface AktivOppdragStyleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Optional content rendered inside the header (under the title). */
  headerSlot?: ReactNode;
  children: ReactNode;
  /** Footer content — typically a left-aligned destructive link plus the action buttons. */
  footer: ReactNode;
}

export function AktivOppdragStyleSheet({
  open,
  onOpenChange,
  title,
  headerSlot,
  children,
  footer,
}: AktivOppdragStyleSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        hideCloseButton
        className="w-full sm:w-[920px] p-0 bg-background"
      >
        <div className="flex h-full flex-col">
          <header className="px-6 py-5 border-b border-border shrink-0">
            <h2 className="text-[1.25rem] font-bold text-foreground">{title}</h2>
            {headerSlot ? <div className="mt-4 space-y-4">{headerSlot}</div> : null}
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {children}
          </div>

          <footer className="px-6 py-4 border-t border-border shrink-0">
            {footer}
          </footer>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ───── Footer building blocks ───── */

export function AktivOppdragFooterRow({ children }: { children: ReactNode }) {
  return <div className="flex gap-3">{children}</div>;
}

export function AktivOppdragCancelButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>,
) {
  const { className, type = "button", children, ...rest } = props;
  return (
    <button
      type={type}
      className={cn(
        "flex-1 h-10 rounded-lg border border-border bg-background text-[0.875rem] font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function AktivOppdragPrimaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>,
) {
  const { className, type = "button", children, ...rest } = props;
  return (
    <button
      type={type}
      className={cn(
        "flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-[0.875rem] font-medium hover:opacity-90 transition-opacity disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ───── Chip ───── */

interface AktivOppdragChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function AktivOppdragChip({
  active,
  className,
  type = "button",
  children,
  ...rest
}: AktivOppdragChipProps) {
  return (
    <button
      type={type}
      className={cn(
        AKTIV_OPPDRAG_CHIP_BASE,
        active ? aktivOppdragChipActive : aktivOppdragChipInactive,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ───── Label ───── */

export function AktivOppdragLabel({
  children,
  required,
  className,
}: {
  children: ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <p className={cn(AKTIV_OPPDRAG_LABEL, "mb-1.5", className)}>
      {children}
      {required ? <span className="text-destructive ml-1">*</span> : null}
    </p>
  );
}
