import { Building2, Users, Activity, CheckSquare, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Selskaper", url: "/selskaper", icon: Building2 },
  { title: "Kontakter", url: "/kontakter", icon: Users },
  { title: "Aktiviteter", url: "/aktiviteter", icon: Activity },
  { title: "Oppgaver", url: "/oppgaver", icon: CheckSquare },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">
            {!collapsed && (
              <span className="text-lg font-bold tracking-tight text-sidebar-primary-foreground">
                STACQ
              </span>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-2">
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={false}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {!collapsed && user && (
          <p className="px-3 text-xs text-sidebar-foreground/50 truncate mb-1">
            {user.email}
          </p>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={signOut}
          className="w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent justify-start"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Logg ut</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
