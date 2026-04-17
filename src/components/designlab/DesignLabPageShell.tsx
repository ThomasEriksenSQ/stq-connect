import type { CSSProperties, ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { usePersistentState } from "@/hooks/usePersistentState";
import { DesignLabSidebar } from "@/components/designlab/DesignLabSidebar";
import { TextSizeControl, SCALE_MAP, type TextSize } from "@/components/designlab/TextSizeControl";
import { C } from "@/components/designlab/theme";

interface DesignLabPageShellProps {
  activePath: string;
  title: string;
  children: ReactNode;
  maxWidth?: number | string | null;
  headerRight?: ReactNode;
  contentStyle?: CSSProperties;
  contentClassName?: string;
}

export function DesignLabPageShell({
  activePath,
  title,
  children,
  maxWidth = 1180,
  headerRight,
  contentStyle,
  contentClassName,
}: DesignLabPageShellProps) {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [textSize, setTextSize] = usePersistentState<TextSize>("dl-text-size", "M");

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif", background: C.bg }}
    >
      <DesignLabSidebar navigate={navigate} signOut={signOut} user={user} activePath={activePath} />

      <main className="flex-1 flex min-w-0 flex-col overflow-hidden" style={{ zoom: SCALE_MAP[textSize], background: C.appBg }}>
        <header className="flex items-center justify-between px-6 shrink-0" style={{ height: 40, borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-baseline gap-2.5">
            <h1 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {headerRight}
            <TextSizeControl value={textSize} onChange={setTextSize} />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto" style={{ padding: "24px 24px 48px", ...contentStyle }}>
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
