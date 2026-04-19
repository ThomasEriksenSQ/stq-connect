import { User } from "@supabase/supabase-js";
import {
  Users, Building2, LayoutDashboard, Briefcase, Settings, LogOut,
  UserPlus, Radar, TrendingUp, Globe, Clock, ChevronsLeft, ChevronsRight,
  SwatchBook,
} from "lucide-react";
import { C } from "@/components/designlab/theme";
import { usePersistentState } from "@/hooks/usePersistentState";
import { SCALE_MAP, getDesignLabTextSizeVars, type TextSize } from "@/components/designlab/TextSizeControl";
import stacqLogoFull from "@/assets/stacq-logo-full-black.png";
import stacqLogoIcon from "@/assets/stacq-logo-icon-black.png";

/* ═══ NAV ITEMS ═══ */

const NAV_MAIN = [
  { label: "Salgsagent", icon: LayoutDashboard, href: "/design-lab/salgsagent" },
  { label: "Selskaper", icon: Building2, href: "/design-lab/selskaper" },
  { label: "Kontakter", icon: Users, href: "/design-lab/kontakter" },
  { label: "Forespørsler", icon: Briefcase, href: "/design-lab/foresporsler" },
  { label: "Stilark", icon: SwatchBook, href: "/design-lab/stilark" },
  { label: "Oppfølginger", icon: Clock, href: "/design-lab/oppfolginger" },
];

const NAV_STACQ = [
  { label: "STACQ Prisen", icon: TrendingUp, href: "/design-lab/stacq-prisen" },
  { label: "Markedsradar", icon: Radar, href: "/design-lab/markedsradar" },
  { label: "Aktive oppdrag", icon: Briefcase, href: "/design-lab/aktive-oppdrag" },
  { label: "Ansatte", icon: Users, href: "/design-lab/ansatte" },
  { label: "Eksterne", icon: UserPlus, href: "/design-lab/eksterne" },
  { label: "stacq.no", icon: Globe, href: "/design-lab/nettside-ai" },
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
  const [textSize] = usePersistentState<TextSize>("dl-text-size", "M");
  const initials = user?.email ? user.email.split("@")[0].slice(0, 2).toUpperCase() : "??";
  const scale = SCALE_MAP[textSize];
  const px = (value: number) => Math.round(value * scale * 100) / 100;

  const isActive = (href: string) => href === activePath;

  return (
    <aside
      className="flex h-screen min-h-0 flex-col shrink-0 overflow-hidden"
      style={{
        ...getDesignLabTextSizeVars(textSize),
        width: collapsed ? 48 : 220,
        transition: "width 200ms ease",
        borderRight: `1px solid ${C.borderLight}`,
        background: C.sidebarBg,
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center shrink-0"
        style={{
          height: px(40),
          paddingLeft: collapsed ? 0 : px(16),
          justifyContent: collapsed ? "center" : "flex-start",
        }}
      >
        <img
          src={collapsed ? stacqLogoIcon : stacqLogoFull}
          alt="STACQ"
          style={{
            height: collapsed ? px(22) : px(18),
            width: collapsed ? px(22) : "auto",
            display: "block",
          }}
        />
      </div>

      {/* Nav */}
      <nav
        className="flex-1 overflow-y-auto px-1.5 space-y-4 pb-3 pt-1"
        style={{ minHeight: 0, paddingInline: collapsed ? px(6) : px(12), paddingTop: px(4), paddingBottom: px(12) }}
      >
        <NavGroup items={NAV_MAIN} navigate={navigate} isActive={isActive} collapsed={collapsed} scale={scale} />
        <div>
          {!collapsed && (
            <p className="px-2 pb-1.5 pt-1" style={{ fontSize: px(11), fontWeight: 500, color: C.textFaint, whiteSpace: "nowrap" }}>
              STACQ
            </p>
          )}
          <NavGroup items={NAV_STACQ} navigate={navigate} isActive={isActive} collapsed={collapsed} scale={scale} />
        </div>
      </nav>

      {/* Footer */}
      <div
        className="mt-auto shrink-0 space-y-0.5"
        style={{ borderTop: `1px solid ${C.border}`, padding: `${px(8)}px ${collapsed ? px(6) : px(12)}px` }}
      >
        <FooterBtn icon={Settings} label="Innstillinger" onClick={() => navigate("/design-lab/innstillinger")} active={isActive("/design-lab/innstillinger")} collapsed={collapsed} scale={scale} />
        <FooterBtn icon={LogOut} label="Logg ut" onClick={signOut} muted collapsed={collapsed} scale={scale} />

        {user && !collapsed && (
          <div className="flex items-center gap-2 px-2 pt-2 pb-1">
            <div
              className="flex items-center justify-center rounded-full shrink-0"
              style={{ width: px(24), height: px(24), background: C.accentBg, color: C.accent, fontSize: px(10), fontWeight: 600 }}
            >
              {initials}
            </div>
            <span className="truncate" style={{ fontSize: px(12), color: C.textGhost }}>{user.email}</span>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((p) => !p)}
          title={collapsed ? "Utvid sidebar" : "Skjul sidebar"}
          className="flex items-center w-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dl-focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--dl-focus-offset)]"
          style={{
            ["--dl-focus-ring" as string]: C.borderFocus,
            ["--dl-focus-offset" as string]: C.sidebarBg,
            height: px(28),
            borderRadius: px(6),
            justifyContent: collapsed ? "center" : "flex-start",
            paddingLeft: collapsed ? 0 : px(8),
            gap: px(8),
            color: C.textFaint,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverSubtle; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          {collapsed
            ? <ChevronsRight style={{ width: px(14), height: px(14), strokeWidth: 1.5 }} />
            : <ChevronsLeft style={{ width: px(14), height: px(14), strokeWidth: 1.5 }} />
          }
          {!collapsed && <span style={{ fontSize: px(12), whiteSpace: "nowrap" }}>Skjul</span>}
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
  scale,
}: {
  items: typeof NAV_MAIN;
  navigate: (p: string) => void;
  isActive: (href: string) => boolean;
  collapsed: boolean;
  scale: number;
}) {
  const px = (value: number) => Math.round(value * scale * 100) / 100;
  return (
    <div className="space-y-px">
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <button
            key={item.label}
            onClick={() => navigate(item.href)}
            title={collapsed ? item.label : undefined}
            className="flex items-center w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dl-focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--dl-focus-offset)]"
            style={{
              ["--dl-focus-ring" as string]: C.borderFocus,
              ["--dl-focus-offset" as string]: C.sidebarBg,
              fontSize: px(13),
              fontWeight: active ? 500 : 400,
              color: active ? C.text : C.textMuted,
              background: active ? C.filterActiveBg : "transparent",
              borderRadius: px(6),
              height: px(28),
              gap: px(8),
              justifyContent: collapsed ? "center" : "flex-start",
              paddingLeft: collapsed ? 0 : px(10),
              paddingRight: collapsed ? 0 : px(10),
              whiteSpace: "nowrap",
              overflow: "hidden",
              transition: "background-color 120ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
            onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = C.hoverSubtle; e.currentTarget.style.color = C.text; } }}
            onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textMuted; } }}
          >
            <item.icon style={{ width: px(14), height: px(14), strokeWidth: 1.5, color: active ? C.text : C.textFaint, flexShrink: 0 }} />
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
  active,
  collapsed,
  scale,
}: {
  icon: any;
  label: string;
  onClick: () => void;
  muted?: boolean;
  active?: boolean;
  collapsed: boolean;
  scale: number;
}) {
  const px = (value: number) => Math.round(value * scale * 100) / 100;
  const baseColor = active ? C.text : muted ? C.textGhost : C.textMuted;
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className="flex items-center w-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dl-focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--dl-focus-offset)]"
      style={{
        ["--dl-focus-ring" as string]: C.borderFocus,
        ["--dl-focus-offset" as string]: C.sidebarBg,
        fontSize: px(13),
        fontWeight: active ? 500 : 400,
        color: baseColor,
        background: active ? C.filterActiveBg : "transparent",
        borderRadius: px(6),
        height: px(28),
        gap: px(8),
        justifyContent: collapsed ? "center" : "flex-start",
        paddingLeft: collapsed ? 0 : px(8),
        paddingRight: collapsed ? 0 : px(8),
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = C.hoverSubtle; e.currentTarget.style.color = C.text; } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = baseColor; } }}
    >
      <Icon style={{ width: px(14), height: px(14), strokeWidth: 1.5, color: active ? C.text : C.textFaint, flexShrink: 0 }} />
      {!collapsed && label}
    </button>
  );
}
