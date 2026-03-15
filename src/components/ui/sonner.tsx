import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      gap={12}
      visibleToasts={4}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
        style: {
          fontSize: '1rem',
          padding: '16px 20px',
          minWidth: '360px',
          maxWidth: '520px',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          fontWeight: 500,
          gap: '12px',
        },
        duration: 6000,
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
