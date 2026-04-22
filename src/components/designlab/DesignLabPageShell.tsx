import type { CSSProperties, ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { usePersistentState } from "@/hooks/usePersistentState";
import { DesignLabMobileNavButton, DesignLabSidebar } from "@/components/designlab/DesignLabSidebar";
import { getDesignLabTextSizeStyle, type TextSize } from "@/components/designlab/TextSizeControl";
import { C } from "@/components/designlab/theme";

interface DesignLabPageShellProps {
  activePath: string;
  title: string;
  count?: number | null;
  children: ReactNode;
  maxWidth?: number | string | null;
  headerRight?: ReactNode;
  contentStyle?: CSSProperties;
  contentClassName?: string;
  hideHeader?: boolean;
}

export function DesignLabPageShell({
  activePath,
  title,
  count,
  children,
  maxWidth = 1180,
  headerRight,
  contentStyle,
  contentClassName,
  hideHeader = false,
}: DesignLabPageShellProps) {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [textSize] = usePersistentState<TextSize>("dl-text-size", "M");

  return (
    <div
      className="dl-shell flex h-screen overflow-hidden"
      style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif", background: C.bg }}
    >
      <DesignLabSidebar navigate={navigate} signOut={signOut} user={user} activePath={activePath} />

      <main className="flex-1 flex min-w-0 flex-col overflow-hidden" style={{ ...getDesignLabTextSizeStyle(textSize), background: C.appBg }}>
        {hideHeader ? null : (
          <header className="dl-shell-header flex shrink-0 flex-wrap items-center justify-between gap-3" style={{ borderBottom: `1px solid ${C.border}` }}>
            <div className="flex min-w-0 items-center gap-3">
              <DesignLabMobileNavButton navigate={navigate} signOut={signOut} user={user} activePath={activePath} />
              <div className="flex min-w-0 items-baseline gap-2.5">
                <h1 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{title}</h1>
                {typeof count === "number" ? (
                  <span style={{ fontSize: 13, color: C.textGhost, fontWeight: 500 }}>· {count}</span>
                ) : null}
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              {headerRight}
            </div>
          </header>
        )}

        <div className="dl-page-scroll flex-1 overflow-y-auto" style={contentStyle}>
          <div
            className={contentClassName}
            style={{
              width: "100%",
              margin: "0 auto",
              maxWidth: maxWidth === null ? undefined : maxWidth,
            }}
          >
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
