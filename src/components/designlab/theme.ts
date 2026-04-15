import type { HeatResult } from "@/lib/heatScore";

/* ═══════════════════════════════════════════════════════════
   LINEAR-INSPIRED DESIGN SYSTEM v8 — LIGHT MODE
   ═══════════════════════════════════════════════════════════ */

export const C = {
  /* Backgrounds — 3-layer: shell → main → panels */
  bg: "#F5F6F8",           // app shell (outermost)
  sidebarBg: "#FFFFFF",    // sidebar — white panel
  surface: "#FAFBFC",      // main content canvas (slightly gray)
  surfaceAlt: "#F4F5F8",   // elevated controls, table headers
  overlay: "#EDEEF2",      // --bg-overlay
  hoverBg: "#F0F2F6",      // --bg-hover
  activeBg: "#E8ECF5",     // --bg-active
  selected: "#E2E7F5",     // --bg-selected

  /* Text */
  text: "#1A1C1F",          // --text-primary
  textMuted: "#5C636E",    // --text-secondary
  textFaint: "#8C929C",    // --text-tertiary
  textGhost: "#BEC4CC",    // --text-disabled

  /* Accent */
  accent: "#5E6AD2",
  accentHover: "#4F5AB8",
  accentBg: "rgba(94,106,210,0.10)",   // --accent-subtle
  accentMuted: "rgba(94,106,210,0.05)", // --accent-muted

  /* Borders */
  border: "#DDE0E7",        // --border-default
  borderLight: "#E8EAEE",   // --border-subtle
  borderStrong: "#C8CDD6",  // --border-strong
  borderFocus: "#5E6AD2",

  /* Status — desaturated */
  success: "#2D6A4F",
  warning: "#7D4E00",
  danger: "#8B1D20",
  info: "#1A4FA0",

  /* Status backgrounds (8% opacity) */
  successBg: "rgba(45,106,79,0.08)",
  warningBg: "rgba(125,78,0,0.08)",
  dangerBg: "rgba(139,29,32,0.08)",
  infoBg: "rgba(26,79,160,0.08)",

  /* Dot colors — for status indicators */
  dotSuccess: "#4CAF78",
  dotWarning: "#E5A030",
  dotError: "#D04045",
  dotNeutral: "#9BA3AE",
  dotInfo: "#5E6AD2",
  dotBacklog: "#BEC4CC",
  dotCancelled: "#8C929C",

  /* Icons */
  iconDefault: "#8C929C",
  iconStrong: "#5C636E",
  iconActive: "#1A1C1F",

  /* Shadows */
  shadow: "0 1px 2px rgba(0,0,0,0.05)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.08)",
  shadowLg: "0 8px 32px rgba(0,0,0,0.11)",
} as const;

/* ── Signal color map ── */
type Signal = "Behov nå" | "Får fremtidig behov" | "Får kanskje behov" | "Ukjent om behov" | "Ikke aktuelt";

export const SIGNAL_COLORS: Record<Signal, { bg: string; color: string }> = {
  "Behov nå":             { bg: C.successBg,               color: C.success },
  "Får fremtidig behov":  { bg: C.infoBg,                  color: C.info },
  "Får kanskje behov":    { bg: C.warningBg,               color: C.warning },
  "Ukjent om behov":      { bg: "rgba(0,0,0,0.04)",        color: C.textFaint },
  "Ikke aktuelt":         { bg: C.dangerBg,                color: C.danger },
};

/* ── Heat badge colors ── */
export const HEAT_COLORS: Record<HeatResult["temperature"], { bg: string; color: string; label: string }> = {
  hett:     { bg: C.dangerBg,            color: C.danger,    label: "Hett" },
  lovende:  { bg: C.warningBg,           color: C.warning,   label: "Lovende" },
  mulig:    { bg: "rgba(0,0,0,0.04)",    color: C.textMuted, label: "Mulig" },
  sovende:  { bg: "rgba(0,0,0,0.03)",    color: C.textGhost, label: "Sovende" },
};
