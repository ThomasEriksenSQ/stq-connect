import { Outlet, NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { useTheme } from "next-themes";
import { Moon, Sun, LogOut, Building2, Users, LayoutDashboard, Sparkles, Briefcase, ChevronDown, Users2, TrendingUp, UserPlus, Upload, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { AIChatPanel } from "@/components/AIChatPanel";

const navItems = [
  { title: "Hjem", url: "/", icon: LayoutDashboard, end: true },
  { title: "Selskaper", url: "/selskaper", icon: Building2 },
  { title: "Kontakter", url: "/kontakter", icon: Users },
  { title: "Forespørsler", url: "/foresporsler", icon: Briefcase },
];

export function AppLayout() {
  const { theme, setTheme } = useTheme();
  const { signOut, user } = useAuth();
  const location = useLocation();
  const [aiOpen, setAiOpen] = useState(false);
  const [konsDropOpen, setKonsDropOpen] = useState(false);
  const konsRef = useRef<HTMLDivElement>(null);
  const isKonsActive = location.pathname.startsWith("/konsulenter") || location.pathname.startsWith("/stacq") || location.pathname.startsWith("/markedsradar");

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (konsRef.current && !konsRef.current.contains(e.target as Node))
        setKonsDropOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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

            {/* Konsulenter dropdown */}
            <div ref={konsRef} className="relative">
              <button
                onClick={() => setKonsDropOpen((v) => !v)}
                className={cn(
                  "relative flex items-center gap-2 px-3 py-1.5 text-[0.8125rem] font-medium transition-colors",
                  isKonsActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Users2 className="h-4 w-4 stroke-[1.5]" />
                <span className="hidden sm:inline">STACQ</span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    konsDropOpen && "rotate-180"
                  )}
                />
                {isKonsActive && (
                  <span className="absolute bottom-[-13px] left-3 right-3 h-[2px] bg-primary rounded-full" />
                )}
              </button>

              {konsDropOpen && (
                <div className="absolute top-full left-0 mt-2 w-44 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50">
                  <RouterNavLink
                    to="/konsulenter/ansatte"
                    onClick={() => setKonsDropOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-4 py-2.5 text-[0.8125rem] font-medium transition-colors",
                        isActive
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )
                    }
                  >
                    <Users className="h-4 w-4 stroke-[1.5]" />
                    Ansatte
                  </RouterNavLink>
                  <RouterNavLink
                    to="/konsulenter/i-oppdrag"
                    onClick={() => setKonsDropOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-4 py-2.5 text-[0.8125rem] font-medium transition-colors",
                        isActive
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )
                    }
                  >
                    <Briefcase className="h-4 w-4 stroke-[1.5]" />
                    Aktive oppdrag
                  </RouterNavLink>
                  <RouterNavLink
                    to="/konsulenter/eksterne"
                    onClick={() => setKonsDropOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-4 py-2.5 text-[0.8125rem] font-medium transition-colors",
                        isActive
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )
                    }
                  >
                    <UserPlus className="h-4 w-4 stroke-[1.5]" />
                    Eksterne
                  </RouterNavLink>
                  <RouterNavLink
                    to="/stacq/prisen"
                    onClick={() => setKonsDropOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-4 py-2.5 text-[0.8125rem] font-medium transition-colors",
                        isActive
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )
                    }
                  >
                    <TrendingUp className="h-4 w-4 stroke-[1.5]" />
                    STACQ Prisen
                  </RouterNavLink>
                  <RouterNavLink
                    to="/stacq/importer-cver"
                    onClick={() => setKonsDropOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-4 py-2.5 text-[0.8125rem] font-medium transition-colors",
                        isActive
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )
                    }
                  >
                    <Upload className="h-4 w-4 stroke-[1.5]" />
                    Importer CVer
                  </RouterNavLink>
                </div>
              )}
            </div>
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

      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-8 py-7 animate-fade-up">
          <Outlet />
        </div>
      </main>

      <Sheet open={aiOpen} onOpenChange={setAiOpen}>
        <SheetContent className="sm:max-w-[420px] p-0" hideCloseButton>
          <AIChatPanel />
        </SheetContent>
      </Sheet>
    </div>
  );
}
