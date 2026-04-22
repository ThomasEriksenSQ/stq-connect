import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { User } from "@supabase/supabase-js";
import {
  Users, Building2, LayoutDashboard, Briefcase, Settings, LogOut,
  UserPlus, Radar, TrendingUp, Globe, Clock, Menu, PanelLeftClose, PanelLeftOpen, X,
} from "lucide-react";
import { C } from "@/components/designlab/theme";
import { ThemeModeButton, ThemeModeControl } from "@/components/ThemeModeControl";
import { usePersistentState } from "@/hooks/usePersistentState";
import { SCALE_MAP, getDesignLabTextSizeVars, TextSizeControlSidebar, type TextSize } from "@/components/designlab/TextSizeControl";
import { getNavItemFromPath, type CrmNavItem, useCrmNavigation } from "@/lib/crmNavigation";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { DesignLabIconButton } from "@/components/designlab/controls";
import { useIsMobile } from "@/hooks/use-mobile";
import stacqLogoFull from "@/assets/stacq-logo-full-black.png";
import stacqLogoIcon from "@/assets/stacq-logo-icon-black.png";
import stacqLogoFullWhite from "@/assets/stacq-logo-full-white.png";
import stacqLogoIconWhite from "@/assets/stacq-logo-icon-white.png";

/* ═══ NAV ITEMS ═══ */

const NAV_MAIN: { label: string; icon: typeof LayoutDashboard; key: CrmNavItem }[] = [
  { label: "Salgsagent", icon: LayoutDashboard, key: "dashboard" },
  { label: "Selskaper", icon: Building2, key: "companies" },
  { label: "Kontakter", icon: Users, key: "contacts" },
  { label: "Forespørsler", icon: Briefcase, key: "requests" },
  { label: "Oppfølginger", icon: Clock, key: "followUps" },
];

const NAV_STACQ: { label: string; icon: typeof LayoutDashboard; key: CrmNavItem }[] = [
  { label: "STACQ Prisen", icon: TrendingUp, key: "stacqPrisen" },
  { label: "Markedsradar", icon: Radar, key: "markedsradar" },
  { label: "Aktive oppdrag", icon: Briefcase, key: "activeAssignments" },
  { label: "Ansatte", icon: Users, key: "employees" },
  { label: "Eksterne", icon: UserPlus, key: "externalConsultants" },
  { label: "stacq.no", icon: Globe, key: "websiteAi" },
];

/* ═══ PROPS ═══ */

interface DesignLabSidebarProps {
  navigate: (path: string) => void;
  signOut: () => void;
  user: User | null;
  activePath: string;
}

export function DesignLabSidebar({ navigate, signOut, user, activePath }: DesignLabSidebarProps) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = usePersistentState("dl-sidebar-collapsed", false);
  const [textSize, setTextSize] = usePersistentState<TextSize>("dl-text-size", "M");
  const { resolvedTheme } = useTheme();
  const { getHomePath, getNavPath } = useCrmNavigation();
  const scale = SCALE_MAP[textSize];
  const px = (value: number) => Math.round(value * scale * 100) / 100;
  const activeItem = getNavItemFromPath(activePath);
  const logoFull = resolvedTheme === "dark" ? stacqLogoFullWhite : stacqLogoFull;
  const logoIcon = resolvedTheme === "dark" ? stacqLogoIconWhite : stacqLogoIcon;

  const isActive = (item: CrmNavItem) => item === activeItem;

  // Cmd/Ctrl + \ shortcut to toggle sidebar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setCollapsed((p) => !p);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setCollapsed]);

  if (isMobile) {
    return null;
  }

  return (
    <aside
      className="group flex h-screen min-h-0 flex-col shrink-0 overflow-hidden"
      style={{
        ...getDesignLabTextSizeVars(textSize),
        width: collapsed ? 48 : 220,
        transition: "width 200ms ease",
        borderRight: `1px solid ${C.borderLight}`,
        background: C.sidebarBg,
      }}
    >
      {/* Logo + collapse-toggle */}
      {!collapsed ? (
        <div
          className="flex items-center shrink-0"
          style={{
            height: px(40),
            paddingLeft: px(12),
            paddingRight: px(8),
            justifyContent: "space-between",
            gap: px(8),
          }}
        >
          <button
            type="button"
            onClick={() => navigate(getHomePath())}
            aria-label="Gå til STACQ Nyheter"
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dl-focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--dl-focus-offset)]"
            style={{
              ["--dl-focus-ring" as string]: C.borderFocus,
              ["--dl-focus-offset" as string]: C.sidebarBg,
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
            }}
          >
            <img
              src={logoFull}
              alt="STACQ"
              style={{ height: px(18), width: "auto", display: "block" }}
            />
          </button>
          <CollapseToggle collapsed={collapsed} onClick={() => setCollapsed((p) => !p)} scale={scale} />
        </div>
      ) : (
        <div
          className="flex flex-col items-center shrink-0"
          style={{ paddingTop: px(8), paddingBottom: px(4), gap: px(4) }}
        >
          <button
            type="button"
            onClick={() => navigate(getHomePath())}
            aria-label="Gå til STACQ Nyheter"
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dl-focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--dl-focus-offset)]"
            style={{
              ["--dl-focus-ring" as string]: C.borderFocus,
              ["--dl-focus-offset" as string]: C.sidebarBg,
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
            }}
          >
            <img
              src={logoIcon}
              alt="STACQ"
              style={{ height: px(24), width: px(24), display: "block" }}
            />
          </button>
          <CollapseToggle collapsed={collapsed} onClick={() => setCollapsed((p) => !p)} scale={scale} />
        </div>
      )}

      {/* Nav */}
      <nav
        className="flex-1 overflow-y-auto px-1.5 space-y-4 pb-3 pt-1"
        style={{ minHeight: 0, paddingInline: collapsed ? px(6) : px(12), paddingTop: px(4), paddingBottom: px(12) }}
      >
        <div>
          {!collapsed && (
            <p className="px-2 pb-1.5 pt-1" style={{ fontSize: px(11), fontWeight: 500, color: C.textFaint, whiteSpace: "nowrap" }}>
              CRM
            </p>
          )}
          <NavGroup items={NAV_MAIN} navigate={navigate} getNavPath={getNavPath} isActive={isActive} collapsed={collapsed} scale={scale} />
        </div>
        <div>
          {!collapsed && (
            <p className="px-2 pb-1.5 pt-1" style={{ fontSize: px(11), fontWeight: 500, color: C.textFaint, whiteSpace: "nowrap" }}>
              STACQ
            </p>
          )}
          <NavGroup items={NAV_STACQ} navigate={navigate} getNavPath={getNavPath} isActive={isActive} collapsed={collapsed} scale={scale} />
        </div>
      </nav>

      {/* Tekststørrelse — over footer-streken, gruppert med nav */}
      {!collapsed && (
        <div className="shrink-0 space-y-2" style={{ paddingInline: px(10), paddingBottom: px(10) }}>
          <TextSizeControlSidebar value={textSize} onChange={setTextSize} />
          <ThemeModeControl scale={scale} />
        </div>
      )}

      {/* Footer */}
      <div
        className="mt-auto shrink-0 space-y-0.5"
        style={{ borderTop: `1px solid ${C.border}`, padding: `${px(8)}px ${collapsed ? px(6) : px(12)}px` }}
      >
        {collapsed && (
          <div style={{ display: "flex", justifyContent: "center", paddingBottom: px(4) }}>
            <ThemeModeButton scale={scale} />
          </div>
        )}
        <FooterBtn icon={Settings} label="Innstillinger" onClick={() => navigate(getNavPath("settings"))} active={isActive("settings")} collapsed={collapsed} scale={scale} />
        <FooterBtn icon={LogOut} label="Logg ut" onClick={signOut} muted collapsed={collapsed} scale={scale} />
      </div>
    </aside>
  );
}

export function DesignLabMobileNavButton({ navigate, signOut, user, activePath }: DesignLabSidebarProps) {
  const [open, setOpen] = useState(false);
  const [textSize, setTextSize] = usePersistentState<TextSize>("dl-text-size", "M");
  const { resolvedTheme } = useTheme();
  const { getHomePath, getNavPath } = useCrmNavigation();
  const scale = SCALE_MAP[textSize];
  const px = (value: number) => Math.round(value * scale * 100) / 100;
  const activeItem = getNavItemFromPath(activePath);
  const logoFull = resolvedTheme === "dark" ? stacqLogoFullWhite : stacqLogoFull;

  const isActive = (item: CrmNavItem) => item === activeItem;

  const closeAndNavigate = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const closeAndSignOut = () => {
    setOpen(false);
    signOut();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Åpne navigasjon"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-md border transition-colors md:hidden"
        style={{
          width: "var(--dl-mobile-nav-size, 36px)",
          height: "var(--dl-mobile-nav-size, 36px)",
          borderColor: C.borderDefault,
          background: C.surface,
          color: C.textSecondary,
          flexShrink: 0,
        }}
      >
        <Menu style={{ width: 16, height: 16, strokeWidth: 1.75 }} />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          hideCloseButton
          className="w-[280px] max-w-[86vw] p-0"
          style={{ background: C.sidebarBg, borderRight: `1px solid ${C.borderLight}` }}
        >
          <aside
            className="flex h-full min-h-0 flex-col overflow-hidden"
            style={{
              ...getDesignLabTextSizeVars(textSize),
              background: C.sidebarBg,
            }}
          >
            <div
              className="flex items-center justify-between shrink-0"
              style={{
                height: px(48),
                paddingLeft: px(12),
                paddingRight: px(8),
                borderBottom: `1px solid ${C.borderLight}`,
              }}
            >
              <button
                type="button"
                onClick={() => closeAndNavigate(getHomePath())}
                aria-label="Gå til STACQ Nyheter"
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dl-focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--dl-focus-offset)]"
                style={{
                  ["--dl-focus-ring" as string]: C.borderFocus,
                  ["--dl-focus-offset" as string]: C.sidebarBg,
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                <img
                  src={logoFull}
                  alt="STACQ"
                  style={{ height: px(18), width: "auto", display: "block" }}
                />
              </button>

              <DesignLabIconButton aria-label="Lukk navigasjon" onClick={() => setOpen(false)}>
                <X style={{ width: 16, height: 16 }} />
              </DesignLabIconButton>
            </div>

            <nav
              className="flex-1 overflow-y-auto space-y-4"
              style={{ minHeight: 0, paddingInline: px(12), paddingTop: px(8), paddingBottom: px(12) }}
            >
              <div>
                <p className="px-2 pb-1.5 pt-1" style={{ fontSize: px(11), fontWeight: 500, color: C.textFaint, whiteSpace: "nowrap" }}>
                  CRM
                </p>
                <NavGroup
                  items={NAV_MAIN}
                  navigate={closeAndNavigate}
                  getNavPath={getNavPath}
                  isActive={isActive}
                  collapsed={false}
                  scale={scale}
                />
              </div>
              <div>
                <p className="px-2 pb-1.5 pt-1" style={{ fontSize: px(11), fontWeight: 500, color: C.textFaint, whiteSpace: "nowrap" }}>
                  STACQ
                </p>
                <NavGroup
                  items={NAV_STACQ}
                  navigate={closeAndNavigate}
                  getNavPath={getNavPath}
                  isActive={isActive}
                  collapsed={false}
                  scale={scale}
                />
              </div>
            </nav>

            <div className="shrink-0 space-y-2" style={{ paddingInline: px(10), paddingBottom: px(10) }}>
              <TextSizeControlSidebar value={textSize} onChange={setTextSize} />
              <ThemeModeControl scale={scale} />
            </div>

            <div
              className="mt-auto shrink-0 space-y-0.5"
              style={{ borderTop: `1px solid ${C.border}`, padding: `${px(8)}px ${px(12)}px` }}
            >
              <FooterBtn icon={Settings} label="Innstillinger" onClick={() => closeAndNavigate(getNavPath("settings"))} active={isActive("settings")} collapsed={false} scale={scale} />
              <FooterBtn icon={LogOut} label="Logg ut" onClick={closeAndSignOut} muted collapsed={false} scale={scale} />
            </div>
          </aside>
        </SheetContent>
      </Sheet>
    </>
  );
}

/* ═══ COLLAPSE TOGGLE ═══ */

function CollapseToggle({
  collapsed,
  onClick,
  scale,
  fullRow,
}: {
  collapsed: boolean;
  onClick: () => void;
  scale: number;
  fullRow?: boolean;
}) {
  const px = (value: number) => Math.round(value * scale * 100) / 100;
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <button
      onClick={onClick}
      title={collapsed ? "Utvid sidebar (⌘\\)" : "Skjul sidebar (⌘\\)"}
      aria-label={collapsed ? "Utvid sidebar" : "Skjul sidebar"}
      className="flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dl-focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--dl-focus-offset)]"
      style={{
        ["--dl-focus-ring" as string]: C.borderFocus,
        ["--dl-focus-offset" as string]: C.sidebarBg,
        width: fullRow ? "100%" : px(24),
        height: fullRow ? px(34) : px(24),
        borderRadius: px(5),
        color: C.textFaint,
        background: "transparent",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverSubtle; e.currentTarget.style.color = C.text; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textFaint; }}
    >
      <Icon style={{ width: fullRow ? px(20) : px(14), height: fullRow ? px(20) : px(14), strokeWidth: 1.5 }} />
    </button>
  );
}

/* ═══ HELPERS ═══ */

function NavGroup({
  items,
  navigate,
  getNavPath,
  isActive,
  collapsed,
  scale,
}: {
  items: typeof NAV_MAIN;
  navigate: (p: string) => void;
  getNavPath: (item: CrmNavItem) => string;
  isActive: (item: CrmNavItem) => boolean;
  collapsed: boolean;
  scale: number;
}) {
  const px = (value: number) => Math.round(value * scale * 100) / 100;
  return (
    <div className="space-y-px">
      {items.map((item) => {
        const active = isActive(item.key);
        const handleClick = () => {
          if (active) return;
          navigate(getNavPath(item.key));
        };
        return (
          <button
            key={item.label}
            type="button"
            onClick={handleClick}
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
              height: collapsed ? px(34) : px(28),
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
            <item.icon style={{ width: collapsed ? px(20) : px(14), height: collapsed ? px(20) : px(14), strokeWidth: 1.5, color: active ? C.text : C.textFaint, flexShrink: 0 }} />
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
  const handleClick = () => {
    if (active) return;
    onClick();
  };
  return (
    <button
      type="button"
      onClick={handleClick}
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
        height: collapsed ? px(34) : px(28),
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
      <Icon style={{ width: collapsed ? px(20) : px(14), height: collapsed ? px(20) : px(14), strokeWidth: 1.5, color: active ? C.text : C.textFaint, flexShrink: 0 }} />
      {!collapsed && label}
    </button>
  );
}
