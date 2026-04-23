import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { C } from "@/theme";

type ThemeMode = "system" | "light" | "dark";

const THEME_MODES: Array<{ value: ThemeMode; label: string; icon: LucideIcon }> = [
  { value: "system", label: "Auto", icon: Monitor },
  { value: "light", label: "Lys", icon: Sun },
  { value: "dark", label: "Mørk", icon: Moon },
];

function normalizeTheme(theme?: string): ThemeMode {
  if (theme === "light" || theme === "dark" || theme === "system") return theme;
  return "system";
}

function getNextMode(mode: ThemeMode): ThemeMode {
  if (mode === "system") return "dark";
  if (mode === "dark") return "light";
  return "system";
}

function getModeTitle(mode: ThemeMode, resolvedTheme?: string) {
  if (mode === "system") {
    return `Tema: følger system (${resolvedTheme === "dark" ? "mørk" : "lys"})`;
  }
  return `Tema: ${mode === "dark" ? "mørk" : "lys"}`;
}

export function ThemeModeControl({ scale = 1, embedded = false }: { scale?: number; embedded?: boolean }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mode = normalizeTheme(theme);
  const px = (value: number) => Math.round(value * scale * 100) / 100;

  return (
    <div
      style={{
        border: embedded ? "none" : `1px solid ${C.borderLight}`,
        background: embedded ? "transparent" : C.surfaceAlt,
        borderRadius: embedded ? 0 : px(10),
        padding: embedded ? 0 : px(4),
        boxShadow: embedded ? "none" : "inset 0 1px 0 rgba(255,255,255,0.55)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: px(6),
          marginBottom: px(4),
          paddingInline: embedded ? px(2) : px(4),
        }}
      >
        <span style={{ fontSize: px(11), fontWeight: 500, color: C.textFaint }}>Tema</span>
        <span style={{ fontSize: px(10), fontWeight: 500, color: C.textGhost }}>
          {mode === "system" ? (resolvedTheme === "dark" ? "System: mørk" : "System: lys") : mode === "dark" ? "Mørk" : "Lys"}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: px(3) }}>
        {THEME_MODES.map((item) => {
          const active = mode === item.value;
          const Icon = item.icon;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setTheme(item.value)}
              title={item.value === "system" ? getModeTitle(item.value, resolvedTheme) : `Bruk ${item.label.toLowerCase()} tema`}
              aria-pressed={active}
              className="flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dl-focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--dl-focus-offset)]"
              style={{
                ["--dl-focus-ring" as string]: C.borderFocus,
                ["--dl-focus-offset" as string]: embedded ? "transparent" : C.surfaceAlt,
                height: px(30),
                gap: px(5),
                border: active ? `1px solid ${C.borderDefault}` : "1px solid transparent",
                borderRadius: px(8),
                background: active ? C.surface : "transparent",
                boxShadow: active ? "0 1px 2px rgba(15,23,42,0.06)" : "none",
                color: active ? C.text : C.textFaint,
                cursor: "pointer",
                fontSize: px(11),
                fontWeight: active ? 600 : 500,
              }}
              onMouseEnter={(event) => {
                if (!active) event.currentTarget.style.background = C.hoverBg;
              }}
              onMouseLeave={(event) => {
                if (!active) event.currentTarget.style.background = "transparent";
              }}
            >
              <Icon style={{ width: px(13), height: px(13), strokeWidth: 1.6 }} />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ThemeModeButton({
  scale = 1,
  onModeChange,
  className,
}: {
  scale?: number;
  onModeChange?: () => void;
  className?: string;
}) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mode = normalizeTheme(theme);
  const nextMode = getNextMode(mode);
  const px = (value: number) => Math.round(value * scale * 100) / 100;
  const Icon = mode === "system" ? Monitor : mode === "dark" ? Moon : Sun;

  return (
    <button
      type="button"
      title={`${getModeTitle(mode, resolvedTheme)}. Klikk for ${nextMode === "system" ? "system" : nextMode === "dark" ? "mørk" : "lys"}.`}
      aria-label="Bytt tema"
      className={`flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dl-focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--dl-focus-offset)] ${className || ""}`}
      style={{
        ["--dl-focus-ring" as string]: C.borderFocus,
        ["--dl-focus-offset" as string]: C.sidebarBg,
        width: px(34),
        height: px(34),
        border: `1px solid ${C.borderLight}`,
        borderRadius: px(8),
        background: mode === "system" ? C.surfaceAlt : C.surface,
        color: mode === "dark" ? C.accent : C.textMuted,
        cursor: "pointer",
      }}
      onClick={() => {
        setTheme(nextMode);
        onModeChange?.();
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = C.hoverBg;
        event.currentTarget.style.color = C.text;
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = mode === "system" ? C.surfaceAlt : C.surface;
        event.currentTarget.style.color = mode === "dark" ? C.accent : C.textMuted;
      }}
    >
      <Icon style={{ width: px(16), height: px(16), strokeWidth: 1.6 }} />
    </button>
  );
}

export function ThemeModeRowButton({ onModeChange }: { onModeChange?: () => void }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mode = normalizeTheme(theme);
  const nextMode = getNextMode(mode);
  const Icon = mode === "system" ? Monitor : mode === "dark" ? Moon : Sun;
  const label =
    mode === "system"
      ? `Tema: auto (${resolvedTheme === "dark" ? "mørk" : "lys"})`
      : mode === "dark"
        ? "Tema: mørk"
        : "Tema: lys";

  return (
    <button
      type="button"
      onClick={() => {
        setTheme(nextMode);
        onModeChange?.();
      }}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[0.875rem] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Icon className="h-4 w-4 stroke-[1.5]" />
      {label}
    </button>
  );
}
