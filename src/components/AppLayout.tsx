import { Outlet, NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Building2, Users, CalendarCheck, LogOut, FileUp, Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, end: true },
  { title: "Kontakter", url: "/kontakter", icon: Users },
  { title: "Selskaper", url: "/selskaper", icon: Building2 },
  { title: "Oppfølginger", url: "/oppfolginger", icon: CalendarCheck },
  { title: "Import", url: "/import", icon: FileUp },
];

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/kontakter": "Kontakter",
  "/selskaper": "Selskaper",
  "/oppfolginger": "Oppfølginger",
  "/import": "Import",
};

export function AppLayout() {
  const { signOut, user } = useAuth();
  const location = useLocation();

  // Fetch counts for nav badges
  const { data: counts } = useQuery({
    queryKey: ["nav-counts"],
    queryFn: async () => {
      const [contacts, companies, tasks] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "open"),
      ]);
      return {
        "/kontakter": contacts.count ?? 0,
        "/selskaper": companies.count ?? 0,
        "/oppfolginger": tasks.count ?? 0,
      } as Record<string, number>;
    },
    staleTime: 60000,
  });

  // Resolve page title
  const getPageTitle = () => {
    for (const [path, title] of Object.entries(pageTitles)) {
      if (path === "/" && location.pathname === "/") return title;
      if (path !== "/" && location.pathname.startsWith(path)) return title;
    }
    return "";
  };

  return (
    <div className="min-h-screen flex w-full">
      {/* Dark sidebar */}
      <aside className="w-[220px] flex-shrink-0 bg-sidebar flex flex-col border-r border-sidebar-border">
        {/* Logo */}
        <div className="px-5 pt-6 pb-8">
          <span className="text-[15px] font-bold tracking-tight text-sidebar-accent-foreground">
            STACQ
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = item.end
              ? location.pathname === item.url
              : location.pathname.startsWith(item.url);
            const count = counts?.[item.url];

            return (
              <RouterNavLink
                key={item.url}
                to={item.url}
                end={item.end}
                className={cn(
                  "flex items-center gap-3 px-3 py-[7px] rounded-md text-[13px] font-medium transition-colors duration-75",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0 stroke-[1.5]" />
                <span className="flex-1">{item.title}</span>
                {count !== undefined && count > 0 && (
                  <span className="text-[11px] tabular-nums text-sidebar-muted">{count.toLocaleString("nb-NO")}</span>
                )}
              </RouterNavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 space-y-3">
          {/* CMD+K hint */}
          <div className="flex items-center gap-2 px-3 py-1.5 text-sidebar-muted">
            <Command className="h-3 w-3" />
            <span className="text-[11px]">K to search</span>
          </div>

          {user && (
            <p className="px-3 text-[11px] text-sidebar-muted/60 truncate">
              {user.email}
            </p>
          )}
          <Button
            variant="ghost"
            onClick={signOut}
            className="w-full justify-start text-sidebar-foreground/50 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent rounded-md h-8 px-3"
          >
            <LogOut className="h-3.5 w-3.5 stroke-[1.5] mr-2" />
            <span className="text-[13px]">Logg ut</span>
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-12 flex items-center px-8 border-b border-border/50 bg-background flex-shrink-0">
          <h2 className="text-[13px] font-semibold text-foreground">{getPageTitle()}</h2>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1200px] mx-auto px-8 py-6 animate-fade-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
