import { Outlet } from "react-router-dom";
import { FornyelsesVarsel } from "@/components/FornyelsesVarsel";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "next-themes";
import { Moon, Sun, LogOut, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { AIChatPanel } from "@/components/AIChatPanel";

export function AppLayout() {
  const { theme, setTheme } = useTheme();
  const { signOut, user } = useAuth();
  const [aiOpen, setAiOpen] = useState(false);

  const initials = user?.email
    ? user.email.split("@")[0].slice(0, 2).toUpperCase()
    : "??";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />

        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-30 border-b border-border bg-card">
            <div className="px-4 flex items-center h-[52px] justify-between">
              <SidebarTrigger className="ml-1" />

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setAiOpen(true)}
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <Sparkles className="h-4 w-4 stroke-[1.5]" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="h-8 w-8 rounded-lg"
                >
                  <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                </Button>
                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[0.625rem] font-semibold select-none">
                  {initials}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={signOut}
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="h-4 w-4 stroke-[1.5]" />
                </Button>
              </div>
            </div>
          </header>

          <FornyelsesVarsel />
          <main className="flex-1 overflow-auto">
            <div className="max-w-6xl mx-auto px-8 py-7 animate-fade-up">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      <Sheet open={aiOpen} onOpenChange={setAiOpen}>
        <SheetContent className="sm:max-w-[420px] p-0" hideCloseButton>
          <AIChatPanel />
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  );
}
