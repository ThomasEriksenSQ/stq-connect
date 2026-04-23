import type React from "react";
import { Bell, Check, CircleAlert, Info, Loader2, TriangleAlert, X } from "lucide-react";
import { useTheme } from "next-themes";
import {
  Toaster as Sonner,
  toast as sonnerToast,
  type ExternalToast,
  type ToasterProps,
} from "sonner";

const TOAST_ICON_CLASS = "h-[0.875rem] w-[0.875rem] stroke-[1.9]";

const DEFAULT_TOAST_ICON = <Bell className={TOAST_ICON_CLASS} />;

const DEFAULT_TOAST_TONE =
  "[--crm-toast-icon-bg:#fff7ed] [--crm-toast-icon-border:#fde68a] [--crm-toast-icon-fg:#c2410c] dark:[--crm-toast-icon-bg:rgba(120,53,15,0.28)] dark:[--crm-toast-icon-border:rgba(251,191,36,0.24)] dark:[--crm-toast-icon-fg:#fbbf24]";
const SUCCESS_TOAST_TONE =
  "[--crm-toast-icon-bg:#ecfdf5] [--crm-toast-icon-border:#a7f3d0] [--crm-toast-icon-fg:#047857] dark:[--crm-toast-icon-bg:rgba(6,95,70,0.28)] dark:[--crm-toast-icon-border:rgba(52,211,153,0.24)] dark:[--crm-toast-icon-fg:#34d399]";
const INFO_TOAST_TONE =
  "[--crm-toast-icon-bg:#eff6ff] [--crm-toast-icon-border:#bfdbfe] [--crm-toast-icon-fg:#1d4ed8] dark:[--crm-toast-icon-bg:rgba(30,64,175,0.26)] dark:[--crm-toast-icon-border:rgba(96,165,250,0.22)] dark:[--crm-toast-icon-fg:#60a5fa]";
const WARNING_TOAST_TONE =
  "[--crm-toast-icon-bg:#fff7ed] [--crm-toast-icon-border:#fed7aa] [--crm-toast-icon-fg:#c2410c] dark:[--crm-toast-icon-bg:rgba(124,45,18,0.28)] dark:[--crm-toast-icon-border:rgba(251,146,60,0.24)] dark:[--crm-toast-icon-fg:#fb923c]";
const ERROR_TOAST_TONE =
  "[--crm-toast-icon-bg:#fef2f2] [--crm-toast-icon-border:#fecaca] [--crm-toast-icon-fg:#dc2626] dark:[--crm-toast-icon-bg:rgba(127,29,29,0.28)] dark:[--crm-toast-icon-border:rgba(248,113,113,0.24)] dark:[--crm-toast-icon-fg:#f87171]";
const LOADING_TOAST_TONE =
  "[--crm-toast-icon-bg:#f8fafc] [--crm-toast-icon-border:#e2e8f0] [--crm-toast-icon-fg:#475569] dark:[--crm-toast-icon-bg:rgba(51,65,85,0.3)] dark:[--crm-toast-icon-border:rgba(148,163,184,0.22)] dark:[--crm-toast-icon-fg:#cbd5e1]";

type ToastFn = typeof sonnerToast;
type ToastMessage = Parameters<ToastFn>[0];
type ToastData = Parameters<ToastFn>[1];
type TypedToast = (message: ToastMessage, data?: ToastData) => ReturnType<ToastFn>;

function withCloseButton<T extends ExternalToast | undefined>(data: T): T {
  if (!data) {
    return { closeButton: true } as T;
  }

  return { closeButton: true, ...data } as T;
}

function withDefaultIcon<T extends ExternalToast | undefined>(data: T): T {
  const next = withCloseButton(data);
  if (!next) return { closeButton: true, icon: DEFAULT_TOAST_ICON } as T;
  if (next.icon) return next;
  return { ...next, icon: DEFAULT_TOAST_ICON } as T;
}

const createTypedToast = (method: TypedToast): TypedToast => (message, data) => method(message, withCloseButton(data));

const toast = Object.assign(
  ((message: ToastMessage, data?: ToastData) => sonnerToast(message, withDefaultIcon(data))) as ToastFn,
  {
    success: createTypedToast(sonnerToast.success),
    info: createTypedToast(sonnerToast.info),
    warning: createTypedToast(sonnerToast.warning),
    error: createTypedToast(sonnerToast.error),
    loading: createTypedToast(sonnerToast.loading),
    message: ((message: ToastMessage, data?: ToastData) => sonnerToast.message(message, withDefaultIcon(data))) as typeof sonnerToast.message,
    promise: sonnerToast.promise,
    custom: sonnerToast.custom,
    dismiss: sonnerToast.dismiss,
    getHistory: sonnerToast.getHistory,
    getToasts: sonnerToast.getToasts,
  },
) satisfies ToastFn;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group crm-sonner"
      position="bottom-right"
      offset={20}
      mobileOffset={16}
      gap={14}
      visibleToasts={3}
      closeButton
      expand
      icons={{
        success: <Check className={TOAST_ICON_CLASS} />,
        info: <Info className={TOAST_ICON_CLASS} />,
        warning: <TriangleAlert className={TOAST_ICON_CLASS} />,
        error: <CircleAlert className={TOAST_ICON_CLASS} />,
        loading: <Loader2 className={`${TOAST_ICON_CLASS} animate-spin`} />,
        close: <X className="h-4 w-4" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast !flex !flex-wrap !items-start !gap-2.5 overflow-hidden !rounded-[24px] !border !border-border/80 !bg-card/95 !p-4 !text-foreground !shadow-[0_18px_48px_rgba(15,23,42,0.16)] backdrop-blur-md",
          title: "text-[0.9375rem] font-semibold leading-[1.35] tracking-[-0.01em] text-foreground",
          description: "mt-1 text-[0.8125rem] leading-[1.45] text-muted-foreground",
          content: "min-w-0 flex-1 basis-[calc(100%-4rem)] gap-0 self-center pr-8",
          icon:
            "mt-0.5 flex h-9 w-9 min-w-9 items-center justify-center rounded-xl border bg-[var(--crm-toast-icon-bg)] text-[var(--crm-toast-icon-fg)] border-[color:var(--crm-toast-icon-border)]",
          closeButton:
            "!left-auto !right-4 !top-4 !h-6 !w-6 !transform-none !rounded-full !border-0 !bg-transparent !p-1 !text-muted-foreground !opacity-100 !shadow-none hover:!bg-muted hover:!text-foreground",
          actionButton:
            "order-4 ml-[3rem] mt-3 inline-flex h-8 items-center justify-center rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground shadow-none transition-colors hover:border-primary/30 hover:bg-background hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
          cancelButton:
            "order-5 mt-3 inline-flex h-8 items-center justify-center rounded-full border-0 bg-transparent px-0 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:bg-transparent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
          default: DEFAULT_TOAST_TONE,
          success: SUCCESS_TOAST_TONE,
          info: INFO_TOAST_TONE,
          warning: WARNING_TOAST_TONE,
          error: ERROR_TOAST_TONE,
          loading: LOADING_TOAST_TONE,
        },
        style: {
          width: "min(calc(100vw - 2rem), 26rem)",
          minWidth: "min(calc(100vw - 2rem), 26rem)",
          maxWidth: "26rem",
          padding: "16px",
          borderRadius: "24px",
          boxShadow: "0 18px 48px rgba(15, 23, 42, 0.16)",
        } as React.CSSProperties,
        duration: 6000,
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
export type { ToasterProps };
