import { Outlet, NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { FornyelsesVarsel } from "@/components/FornyelsesVarsel";
import { useTheme } from "next-themes";
import { Moon, Sun, LogOut, Building2, Users, LayoutDashboard, Sparkles, Briefcase, ChevronDown, Users2, TrendingUp, UserPlus, Radar, Globe, Menu, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { AIChatPanel } from "@/components/AIChatPanel";
import { useIsMobile } from "@/hooks/use-mobile";

const navItems = [
  { title: "Salgsagent", url: "/", icon: LayoutDashboard, end: true },
  { title: "Selskaper", url: "/selskaper", icon: Building2 },
  { title: "Kontakter", url: "/kontakter", icon: Users },
  { title: "Forespørsler", url: "/foresporsler", icon: Briefcase },
];

const stacqItems = [
  { title: "STACQ Prisen", url: "/stacq/prisen", icon: TrendingUp },
  { title: "Markedsradar", url: "/markedsradar", icon: Radar },
  { title: "Aktive oppdrag", url: "/konsulenter/i-oppdrag", icon: Briefcase },
  { title: "Ansatte", url: "/konsulenter/ansatte", icon: Users },
  { title: "Eksterne", url: "/konsulenter/eksterne", icon: UserPlus },
  { title: "stacq.no", url: "/nettside-ai", icon: Globe },
];

export function AppLayout() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { signOut, user } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [aiOpen, setAiOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [konsDropOpen, setKonsDropOpen] = useState(false);
  const konsRef = useRef<HTMLDivElement>(null);
  const isKonsActive = location.pathname.startsWith("/konsulenter") || location.pathname.startsWith("/stacq") || location.pathname.startsWith("/markedsradar") || location.pathname.startsWith("/nettside-ai") || location.pathname.startsWith("/cv-maker");

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
        <div className="max-w-6xl mx-auto px-4 md:px-8 flex items-center h-[53px] gap-3 md:gap-8">
          <div className="flex items-center gap-3 md:gap-8 min-w-0 flex-1">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setNavOpen(true)}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
              >
                <Menu className="h-4 w-4 stroke-[1.5]" />
              </Button>
            )}
            <span className="text-[1.0625rem] font-bold tracking-tight text-foreground select-none shrink-0">
              STACQ
            </span>

            <nav className="hidden md:flex items-center gap-1 flex-1 min-w-0">
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
                    "flex items-center gap-2 px-3 py-[14px] text-[0.8125rem] font-medium transition-colors border-b-2",
                    isActive
                      ? "text-foreground border-primary"
                      : "text-muted-foreground hover:text-foreground border-transparent"
                  )}
                >
                  <item.icon className="h-4 w-4 stroke-[1.5]" />
                  <span className="hidden sm:inline">{item.title}</span>
                </RouterNavLink>
              );
            })}

            {/* Konsulenter dropdown */}
            <div ref={konsRef} className="relative">
              <button
                onClick={() => setKonsDropOpen((v) => !v)}
                className={cn(
                  "flex items-center gap-2 px-3 py-[14px] text-[0.8125rem] font-medium transition-colors border-b-2",
                  isKonsActive
                    ? "text-foreground border-primary"
                    : "text-muted-foreground hover:text-foreground border-transparent"
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
              </button>

              {konsDropOpen && (
                <div className="absolute top-full left-0 mt-2 w-44 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50">
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
                    to="/markedsradar"
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
                    <Radar className="h-4 w-4 stroke-[1.5]" />
                    Markedsradar
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
                    to="/nettside-ai"
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
                    <Globe className="h-4 w-4 stroke-[1.5]" />
                    stacq.no
                  </RouterNavLink>
                </div>
              )}
            </div>
          </nav>
          </div>

          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="h-8 w-8 rounded-lg"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/innstillinger")}
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <Settings className="h-4 w-4 stroke-[1.5]" />
            </Button>
            <div className="h-7 w-7 rounded-full bg-primary/10 text-primary hidden sm:flex items-center justify-center text-[0.625rem] font-semibold select-none">
              {initials}
            </div>
            {!isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4 stroke-[1.5]" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <FornyelsesVarsel />
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-5 md:py-7 animate-fade-up">
          <Outlet />
        </div>
      </main>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-[300px] p-0">
          <div className="flex h-full flex-col">
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[1.0625rem] font-bold tracking-tight text-foreground">STACQ</p>
                  <p className="mt-1 text-[0.75rem] text-muted-foreground">{user?.email}</p>
                </div>
                <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[0.75rem] font-semibold select-none">
                  {initials}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              <div className="space-y-1">
                <p className="px-3 pb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  CRM
                </p>
                {navItems.map((item) => {
                  const isActive = item.end
                    ? location.pathname === item.url
                    : location.pathname.startsWith(item.url);
                  return (
                    <RouterNavLink
                      key={item.url}
                      to={item.url}
                      end={item.end}
                      onClick={() => setNavOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.875rem] font-medium transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <item.icon className="h-4 w-4 stroke-[1.5]" />
                      {item.title}
                    </RouterNavLink>
                  );
                })}
              </div>

              <div className="mt-5 space-y-1">
                <p className="px-3 pb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  STACQ
                </p>
                {stacqItems.map((item) => {
                  const isActive = location.pathname.startsWith(item.url);
                  return (
                    <RouterNavLink
                      key={item.url}
                      to={item.url}
                      onClick={() => setNavOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.875rem] font-medium transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <item.icon className="h-4 w-4 stroke-[1.5]" />
                      {item.title}
                    </RouterNavLink>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-border px-3 py-3 space-y-1">
              <button
                onClick={() => {
                  setTheme(theme === "dark" ? "light" : "dark");
                  setNavOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[0.875rem] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {theme === "dark" ? <Sun className="h-4 w-4 stroke-[1.5]" /> : <Moon className="h-4 w-4 stroke-[1.5]" />}
                Bytt tema
              </button>
              <button
                onClick={() => {
                  navigate("/innstillinger");
                  setNavOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[0.875rem] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Settings className="h-4 w-4 stroke-[1.5]" />
                Innstillinger
              </button>
              <button
                onClick={() => {
                  setNavOpen(false);
                  signOut();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[0.875rem] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogOut className="h-4 w-4 stroke-[1.5]" />
                Logg ut
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={aiOpen} onOpenChange={setAiOpen}>
        <SheetContent className="sm:max-w-[420px] p-0" hideCloseButton>
          <AIChatPanel />
        </SheetContent>
      </Sheet>
    </div>
  );
}
