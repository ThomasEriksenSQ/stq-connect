import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, Circle } from "lucide-react";

import type { TextSize } from "@/components/designlab/TextSizeControl";
import { usePersistentState } from "@/hooks/usePersistentState";
import { cn } from "@/lib/utils";

const MENU_TYPOGRAPHY = {
  S: {
    itemFontSize: 11,
    labelFontSize: 10,
    shortcutFontSize: 10,
    itemHeight: 30,
    itemPaddingX: 9,
    itemGap: 7,
    menuPadding: 4,
    labelPaddingY: 4,
    iconSize: 13,
    indicatorBox: 13,
    indicatorLeft: 8,
  },
  M: {
    itemFontSize: 12,
    labelFontSize: 11,
    shortcutFontSize: 10,
    itemHeight: 32,
    itemPaddingX: 10,
    itemGap: 8,
    menuPadding: 4,
    labelPaddingY: 4,
    iconSize: 14,
    indicatorBox: 14,
    indicatorLeft: 8,
  },
  L: {
    itemFontSize: 13,
    labelFontSize: 12,
    shortcutFontSize: 11,
    itemHeight: 34,
    itemPaddingX: 11,
    itemGap: 8,
    menuPadding: 5,
    labelPaddingY: 5,
    iconSize: 15,
    indicatorBox: 15,
    indicatorLeft: 9,
  },
  XL: {
    itemFontSize: 14,
    labelFontSize: 13,
    shortcutFontSize: 12,
    itemHeight: 36,
    itemPaddingX: 12,
    itemGap: 9,
    menuPadding: 5,
    labelPaddingY: 5,
    iconSize: 16,
    indicatorBox: 16,
    indicatorLeft: 10,
  },
  XXL: {
    itemFontSize: 15,
    labelFontSize: 14,
    shortcutFontSize: 13,
    itemHeight: 38,
    itemPaddingX: 13,
    itemGap: 10,
    menuPadding: 6,
    labelPaddingY: 6,
    iconSize: 17,
    indicatorBox: 17,
    indicatorLeft: 11,
  },
} satisfies Record<
  TextSize,
  {
    itemFontSize: number;
    labelFontSize: number;
    shortcutFontSize: number;
    itemHeight: number;
    itemPaddingX: number;
    itemGap: number;
    menuPadding: number;
    labelPaddingY: number;
    iconSize: number;
    indicatorBox: number;
    indicatorLeft: number;
  }
>;

function getMenuScaleVars(textSize: TextSize): React.CSSProperties {
  const metrics = MENU_TYPOGRAPHY[textSize];

  return {
    ["--dl-menu-font-size" as string]: `${metrics.itemFontSize}px`,
    ["--dl-menu-label-font-size" as string]: `${metrics.labelFontSize}px`,
    ["--dl-menu-shortcut-font-size" as string]: `${metrics.shortcutFontSize}px`,
    ["--dl-menu-item-height" as string]: `${metrics.itemHeight}px`,
    ["--dl-menu-item-padding-x" as string]: `${metrics.itemPaddingX}px`,
    ["--dl-menu-item-gap" as string]: `${metrics.itemGap}px`,
    ["--dl-menu-item-leading-padding" as string]: `${metrics.indicatorLeft + metrics.indicatorBox + 7}px`,
    ["--dl-menu-menu-padding" as string]: `${metrics.menuPadding}px`,
    ["--dl-menu-label-padding-y" as string]: `${metrics.labelPaddingY}px`,
    ["--dl-menu-icon-size" as string]: `${metrics.iconSize}px`,
    ["--dl-menu-indicator-size" as string]: `${metrics.indicatorBox}px`,
    ["--dl-menu-indicator-left" as string]: `${metrics.indicatorLeft}px`,
  };
}

function useDropdownTextSize(): TextSize {
  const [textSize] = usePersistentState<TextSize>("dl-text-size", "M");
  return textSize;
}

const DropdownMenu = DropdownMenuPrimitive.Root;

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuGroup = DropdownMenuPrimitive.Group;

const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const menuPanelClassName =
  "z-50 min-w-[8rem] overflow-hidden rounded-lg border border-[#E8EAEE] bg-white text-[#1A1C1F] shadow-[0_10px_30px_rgba(15,23,42,0.08)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2";

const menuItemClassName =
  "relative flex cursor-default select-none items-center rounded-md font-medium text-[#1A1C1F] outline-none transition-colors gap-[var(--dl-menu-item-gap)] h-[var(--dl-menu-item-height)] px-[var(--dl-menu-item-padding-x)] text-[length:var(--dl-menu-font-size)] [&_svg]:shrink-0 [&_svg]:text-[#5C636E] [&_svg]:h-[var(--dl-menu-icon-size)] [&_svg]:w-[var(--dl-menu-icon-size)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-[#F8F9FB] focus:text-[#1A1C1F] data-[highlighted]:bg-[#F8F9FB] data-[highlighted]:text-[#1A1C1F]";

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, style, ...props }, ref) => {
  const textSize = useDropdownTextSize();

  return (
    <DropdownMenuPrimitive.SubTrigger
      ref={ref}
      className={cn(
        menuItemClassName,
        "data-[state=open]:bg-[#F8F9FB]",
        inset && "pl-[var(--dl-menu-item-leading-padding)]",
        className,
      )}
      style={{
        ...getMenuScaleVars(textSize),
        ...style,
      }}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto" />
    </DropdownMenuPrimitive.SubTrigger>
  );
});
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, style, ...props }, ref) => {
  const textSize = useDropdownTextSize();

  return (
    <DropdownMenuPrimitive.SubContent
      ref={ref}
      className={cn(menuPanelClassName, className)}
      style={{
        padding: "var(--dl-menu-menu-padding)",
        ...getMenuScaleVars(textSize),
        ...style,
      }}
      {...props}
    />
  );
});
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, style, ...props }, ref) => {
  const textSize = useDropdownTextSize();

  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(menuPanelClassName, className)}
        style={{
          padding: "var(--dl-menu-menu-padding)",
          ...getMenuScaleVars(textSize),
          ...style,
        }}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
});
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
  }
>(({ className, inset, style, ...props }, ref) => {
  const textSize = useDropdownTextSize();

  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(menuItemClassName, inset && "pl-[var(--dl-menu-item-leading-padding)]", className)}
      style={{
        ...getMenuScaleVars(textSize),
        ...style,
      }}
      {...props}
    />
  );
});
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, style, ...props }, ref) => {
  const textSize = useDropdownTextSize();

  return (
    <DropdownMenuPrimitive.CheckboxItem
      ref={ref}
      className={cn(
        menuItemClassName,
        "py-0 pl-[var(--dl-menu-item-leading-padding)] pr-[var(--dl-menu-item-padding-x)]",
        className,
      )}
      style={{
        ...getMenuScaleVars(textSize),
        ...style,
      }}
      checked={checked}
      {...props}
    >
      <span className="absolute left-[var(--dl-menu-indicator-left)] flex h-[var(--dl-menu-indicator-size)] w-[var(--dl-menu-indicator-size)] items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
});
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, style, ...props }, ref) => {
  const textSize = useDropdownTextSize();

  return (
    <DropdownMenuPrimitive.RadioItem
      ref={ref}
      className={cn(
        menuItemClassName,
        "py-0 pl-[var(--dl-menu-item-leading-padding)] pr-[var(--dl-menu-item-padding-x)]",
        className,
      )}
      style={{
        ...getMenuScaleVars(textSize),
        ...style,
      }}
      {...props}
    >
      <span className="absolute left-[var(--dl-menu-indicator-left)] flex h-[var(--dl-menu-indicator-size)] w-[var(--dl-menu-indicator-size)] items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Circle className="!h-[calc(var(--dl-menu-icon-size)-6px)] !w-[calc(var(--dl-menu-icon-size)-6px)] fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
});
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, style, ...props }, ref) => {
  const textSize = useDropdownTextSize();

  return (
    <DropdownMenuPrimitive.Label
      ref={ref}
      className={cn(
        "font-semibold text-[#5C636E] px-[var(--dl-menu-item-padding-x)] py-[var(--dl-menu-label-padding-y)] text-[length:var(--dl-menu-label-font-size)]",
        inset && "pl-[var(--dl-menu-item-leading-padding)]",
        className,
      )}
      style={{
        ...getMenuScaleVars(textSize),
        ...style,
      }}
      {...props}
    />
  );
});
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuShortcut = ({ className, style, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  const textSize = useDropdownTextSize();

  return (
    <span
      className={cn("ml-auto tracking-[0.08em] text-[#8C929C] text-[length:var(--dl-menu-shortcut-font-size)]", className)}
      style={{
        ...getMenuScaleVars(textSize),
        ...style,
      }}
      {...props}
    />
  );
};
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};
