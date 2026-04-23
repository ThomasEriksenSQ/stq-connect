import { Bell, CircleAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

function LegacyToastIcon({ variant }: { variant?: "default" | "destructive" | null }) {
  const destructive = variant === "destructive";

  return (
    <div
      className={
        destructive
          ? "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
          : "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
      }
    >
      {destructive ? <CircleAlert className="h-4 w-4 stroke-[1.9]" /> : <Bell className="h-4 w-4 stroke-[1.9]" />}
    </div>
  );
}

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        return (
          <Toast key={id} variant={variant} {...props}>
            <LegacyToastIcon variant={variant} />
            <div className="min-w-0 flex-1 pr-8">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action ? <div className="ml-[3.25rem] mt-3">{action}</div> : null}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
