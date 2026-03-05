import { Building2, Users, CheckSquare, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
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
  { title: "Oppgaver", url: "/oppgaver", icon: CheckSquare },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut, user } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <div className="px-3 py-5">
            {!collapsed && (
              <span className="text-xl font-extrabold tracking-tighter text-sidebar-primary-foreground">
                STACQ
              </span>
            )}
            {collapsed && (
              <span className="text-xl font-extrabold tracking-tighter text-sidebar-primary-foreground">
                S
              </span>
            )}
          </div>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5 px-2">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={false}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-primary-foreground font-semibold"
                    >
                      <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-2 pb-4">
        {!collapsed && user && (
          <p className="px-3 text-[11px] text-sidebar-foreground/40 truncate mb-2 text-mono">
            {user.email}
          </p>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={signOut}
          className="w-full text-sidebar-foreground/50 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent justify-start text-sm"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Logg ut</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
