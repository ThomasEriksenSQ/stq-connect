import { User } from "@supabase/supabase-js";
import {
  Users, Building2, LayoutDashboard, Briefcase, Settings, LogOut,
  UserPlus, Radar, TrendingUp, Globe, Clock, ChevronsLeft, ChevronsRight,
} from "lucide-react";
import { C } from "@/components/designlab/theme";
import { usePersistentState } from "@/hooks/usePersistentState";

/* ═══ NAV ITEMS ═══ */

const NAV_MAIN = [
  { label: "Salgsagent", icon: LayoutDashboard, href: "/" },
  { label: "Selskaper", icon: Building2, href: "/design-lab/selskaper" },
  { label: "Kontakter", icon: Users, href: "/design-lab/kontakter" },
  { label: "Forespørsler", icon: Briefcase, href: "/design-lab/foresporsler" },
  { label: "Oppfølginger", icon: Clock, href: "/oppfolginger" },
];

const NAV_STACQ = [
  { label: "STACQ Prisen", icon: TrendingUp, href: "/design-lab/stacq-prisen" },
  { label: "Markedsradar", icon: Radar, href: "/markedsradar" },
  { label: "Ansatte", icon: Users, href: "/konsulenter/ansatte" },
  { label: "Eksterne", icon: UserPlus, href: "/konsulenter/eksterne" },
  { label: "stacq.no", icon: Globe, href: "/nettside-ai" },
];

/* ═══ PROPS ═══ */

interface DesignLabSidebarProps {
  navigate: (path: string) => void;
  signOut: () => void;
  user: User | null;
  activePath: string;
}

export function DesignLabSidebar({ navigate, signOut, user, activePath }: DesignLabSidebarProps) {
  const [collapsed, setCollapsed] = usePersistentState("dl-sidebar-collapsed", false);
  const initials = user?.email ? user.email.split("@")[0].slice(0, 2).toUpperCase() : "??";

  const isActive = (href: string) => href === activePath;

  return (
    <aside
      className="flex flex-col shrink-0 overflow-hidden"
      style={{
        width: collapsed ? 48 : 220,
        transition: "width 200ms ease",
        borderRight: `1px solid ${C.borderLight}`,
        background: C.sidebarBg,
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0" style={{ height: 40, paddingLeft: collapsed ? 13 : 16 }}>
        <div
          className="flex items-center justify-center rounded shrink-0"
          style={{ width: 22, height: 22, background: C.accent, color: "#fff", fontSize: 11, fontWeight: 600 }}
        >
          S
        </div>
        {!collapsed && (
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
            STACQ
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-1.5 space-y-4 pb-3 pt-1" style={{ paddingInline: collapsed ? 6 : 12 }}>
        <NavGroup items={NAV_MAIN} navigate={navigate} isActive={isActive} collapsed={collapsed} />
        <div>
          {!collapsed && (
            <p className="px-2 pb-1.5 pt-1" style={{ fontSize: 11, fontWeight: 500, color: C.textFaint, whiteSpace: "nowrap" }}>
              STACQ
            </p>
          )}
          <NavGroup items={NAV_STACQ} navigate={navigate} isActive={isActive} collapsed={collapsed} />
        </div>
      </nav>

      {/* Footer */}
      <div className="shrink-0 space-y-0.5" style={{ borderTop: `1px solid ${C.border}`, padding: collapsed ? "8px 6px" : "8px 12px" }}>
        <FooterBtn icon={Settings} label="Innstillinger" onClick={() => navigate("/innstillinger")} collapsed={collapsed} />
        <FooterBtn icon={LogOut} label="Logg ut" onClick={signOut} muted collapsed={collapsed} />

        {user && !collapsed && (
          <div className="flex items-center gap-2 px-2 pt-2 pb-1">
            <div
              className="flex items-center justify-center rounded-full shrink-0"
              style={{ width: 24, height: 24, background: C.accentBg, color: C.accent, fontSize: 10, fontWeight: 600 }}
            >
              {initials}
            </div>
            <span className="truncate" style={{ fontSize: 12, color: C.textGhost }}>{user.email}</span>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((p) => !p)}
          title={collapsed ? "Utvid sidebar" : "Skjul sidebar"}
          className="flex items-center w-full transition-colors"
          style={{
            height: 28,
            borderRadius: 4,
            justifyContent: collapsed ? "center" : "flex-start",
            paddingLeft: collapsed ? 0 : 8,
            gap: 8,
            color: C.textFaint,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverBg; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          {collapsed
            ? <ChevronsRight style={{ width: 14, height: 14, strokeWidth: 1.5 }} />
            : <ChevronsLeft style={{ width: 14, height: 14, strokeWidth: 1.5 }} />
          }
          {!collapsed && <span style={{ fontSize: 12, whiteSpace: "nowrap" }}>Skjul</span>}
        </button>
      </div>
    </aside>
  );
}

/* ═══ HELPERS ═══ */

function NavGroup({
  items,
  navigate,
  isActive,
  collapsed,
}: {
  items: typeof NAV_MAIN;
  navigate: (p: string) => void;
  isActive: (href: string) => boolean;
  collapsed: boolean;
}) {
  return (
    <div className="space-y-px">
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <button
            key={item.label}
            onClick={() => navigate(item.href)}
            title={collapsed ? item.label : undefined}
            className="flex items-center w-full transition-colors"
            style={{
              fontSize: 13,
              fontWeight: active ? 500 : 400,
              color: active ? C.text : C.textMuted,
              background: active ? "#EAECF0" : "transparent",
              borderRadius: 4,
              height: 28,
              gap: 8,
              justifyContent: collapsed ? "center" : "flex-start",
              paddingLeft: collapsed ? 0 : 8,
              paddingRight: collapsed ? 0 : 8,
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "#F0F2F4"; e.currentTarget.style.color = C.text; } }}
            onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textMuted; } }}
          >
            <item.icon style={{ width: 14, height: 14, strokeWidth: 1.5, color: active ? C.text : "#8C929C", flexShrink: 0 }} />
            {!collapsed && item.label}
          </button>
        );
      })}
    </div>
  );
}

function FooterBtn({
  icon: Icon,
  label,
  onClick,
  muted,
  collapsed,
}: {
  icon: any;
  label: string;
  onClick: () => void;
  muted?: boolean;
  collapsed: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className="flex items-center w-full transition-colors"
      style={{
        fontSize: 13,
        fontWeight: 400,
        color: muted ? C.textGhost : C.textMuted,
        borderRadius: 4,
        height: 28,
        gap: 8,
        justifyContent: collapsed ? "center" : "flex-start",
        paddingLeft: collapsed ? 0 : 8,
        paddingRight: collapsed ? 0 : 8,
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#F0F2F4"; e.currentTarget.style.color = C.text; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = muted ? C.textGhost : C.textMuted; }}
    >
      <Icon style={{ width: 14, height: 14, strokeWidth: 1.5, color: "#8C929C", flexShrink: 0 }} />
      {!collapsed && label}
    </button>
  );
}
