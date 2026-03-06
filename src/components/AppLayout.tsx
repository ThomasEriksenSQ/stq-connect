import { Outlet, NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { useTheme } from "next-themes";
import { Moon, Sun, LogOut, Building2, Users, CalendarCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Hjem", url: "/", icon: Sparkles, end: true },
  { title: "Selskaper", url: "/selskaper", icon: Building2 },
  { title: "Kontakter", url: "/kontakter", icon: Users },
  { title: "Oppfølginger", url: "/oppfolginger", icon: CalendarCheck },
];

export function AppLayout() {
  const { theme, setTheme } = useTheme();
  const { signOut, user } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top navigation */}
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 flex items-center h-14 gap-8">
          {/* Logo */}
          <span className="text-[1rem] font-extrabold tracking-tight text-foreground select-none">
            STACQ
          </span>

          {/* Nav items */}
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
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[0.8125rem] font-medium transition-colors",
                    isActive
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  <item.icon className="h-4 w-4 stroke-[1.5]" />
                  <span className="hidden sm:inline">{item.title}</span>
                </RouterNavLink>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {user && (
              <span className="hidden lg:block text-[0.75rem] text-muted-foreground/60 max-w-[160px] truncate mr-1">
                {user.email}
              </span>
            )}
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
              onClick={signOut}
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4 stroke-[1.5]" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-6 py-8 overflow-auto">
        <div className="max-w-6xl mx-auto animate-fade-up">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
