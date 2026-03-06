import { Outlet, NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { useTheme } from "next-themes";
import { Moon, Sun, LogOut, Building2, Users, CalendarCheck, LayoutDashboard, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { AIChatPanel } from "@/components/AIChatPanel";

const navItems = [
  { title: "Hjem", url: "/", icon: LayoutDashboard, end: true },
  { title: "Selskaper", url: "/selskaper", icon: Building2 },
  { title: "Kontakter", url: "/kontakter", icon: Users },
  { title: "Oppfølginger", url: "/oppfolginger", icon: CalendarCheck },
];

export function AppLayout() {
  const { theme, setTheme } = useTheme();
  const { signOut, user } = useAuth();
  const location = useLocation();
  const [aiOpen, setAiOpen] = useState(false);

  const initials = user?.email
    ? user.email.split("@")[0].slice(0, 2).toUpperCase()
    : "??";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-8 flex items-center h-[52px] gap-8">
          <span className="text-[1.0625rem] font-bold tracking-tight text-foreground select-none">
            STACQ
          </span>

          <nav className="flex items-center gap-1 flex-1">
            {navItems.map((item) => {
              const isActive = item.end
                ? location.pathname === item.url
                : location.pathname.startsWith(item.url);
              return (
                <RouterNavLink
                  key={item.url}
                  to={item.url}
                  end={item.end}
                  className={cn(
                    "relative flex items-center gap-2 px-3 py-1.5 text-[0.8125rem] font-medium transition-colors",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 stroke-[1.5]" />
                  <span className="hidden sm:inline">{item.title}</span>
                  {isActive && (
                    <span className="absolute bottom-[-13px] left-3 right-3 h-[2px] bg-primary rounded-full" />
                  )}
                </RouterNavLink>
              );
            })}
          </nav>

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

      <main className="flex-1 px-8 py-7 overflow-auto">
        <div className="max-w-6xl mx-auto animate-fade-up">
          <Outlet />
        </div>
      </main>

      <Sheet open={aiOpen} onOpenChange={setAiOpen}>
        <SheetContent className="sm:max-w-[420px] p-0">
          <AIChatPanel />
        </SheetContent>
      </Sheet>
    </div>
  );
}
