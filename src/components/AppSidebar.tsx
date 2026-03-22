import { LayoutDashboard, Building2, Users, CalendarCheck, ClipboardList, Briefcase, FileText, LogOut } from "lucide-react";
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
  { title: "Salgsagent", url: "/", icon: LayoutDashboard, end: true },
  { title: "Selskaper", url: "/selskaper", icon: Building2, end: false },
  { title: "Kontakter", url: "/kontakter", icon: Users, end: false },
  { title: "Forespørsler", url: "/foresporsler", icon: ClipboardList, end: false },
  { title: "Oppfølginger", url: "/oppfolginger", icon: CalendarCheck, end: false },
  { title: "Aktive oppdrag", url: "/konsulenter/i-oppdrag", icon: Briefcase, end: false },
  { title: "CV Maker", url: "/cv-maker", icon: FileText, end: false },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut, user } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <div className="px-4 pt-6 pb-8">
            <span className="text-[15px] font-bold tracking-tight text-sidebar-accent-foreground">
              {collapsed ? "S" : "STACQ"}
            </span>
          </div>
          <SidebarGroupContent>
            <SidebarMenu className="px-2 space-y-1">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.end}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/80 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                    >
                      <item.icon className="h-[18px] w-[18px] flex-shrink-0 stroke-[1.5]" />
                      {!collapsed && <span className="text-[13px] font-medium">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-2 pb-4 space-y-2">
        {!collapsed && user && (
          <p className="px-3 text-[11px] text-sidebar-foreground/30 truncate">
            {user.email}
          </p>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={signOut}
          className="w-full text-sidebar-foreground/40 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent justify-start rounded-xl"
        >
          <LogOut className="h-4 w-4 stroke-[1.5]" />
          {!collapsed && <span className="ml-2 text-[13px]">Logg ut</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
