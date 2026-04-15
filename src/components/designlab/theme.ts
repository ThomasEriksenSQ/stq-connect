import type { HeatResult } from "@/lib/heatScore";

/* ═══════════════════════════════════════════════════════════
   LINEAR-INSPIRED DESIGN SYSTEM v5 — LIGHT MODE
   ═══════════════════════════════════════════════════════════ */

export const C = {
  /* Backgrounds */
  bg: "#F5F6F8",           // --bg-base
  sidebarBg: "#FFFFFF",    // --bg-surface
  surface: "#FAFBFC",      // --bg-app
  surfaceAlt: "#F4F5F8",   // --bg-elevated
  overlay: "#EDEEF2",      // --bg-overlay
  hoverBg: "#F0F2F6",      // --bg-hover
  activeBg: "#E8ECF5",     // --bg-active
  selectedStrong: "#E2E7F5", // --bg-selected-strong

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

  /* Status */
  success: "#1E7A4A",
  warning: "#8F5A0A",
  danger: "#A02328",
  info: "#1A56A8",

  /* Status backgrounds (9% opacity) */
  successBg: "rgba(30,122,74,0.09)",
  warningBg: "rgba(143,90,10,0.09)",
  dangerBg: "rgba(160,35,40,0.09)",
  infoBg: "rgba(26,86,168,0.09)",

  /* Icons */
  iconDefault: "#8C929C",
  iconStrong: "#5C636E",
  iconActive: "#1A1C1F",

  /* Shadows */
  shadow: "0 1px 3px rgba(0,0,0,0.06)",
  shadowMd: "0 4px 16px rgba(0,0,0,0.09)",
  shadowLg: "0 8px 40px rgba(0,0,0,0.12)",
} as const;

/* ── Signal color map ── */
type Signal = "Behov nå" | "Får fremtidig behov" | "Får kanskje behov" | "Ukjent om behov" | "Ikke aktuelt";

export const SIGNAL_COLORS: Record<Signal, { bg: string; color: string }> = {
  "Behov nå":             { bg: "rgba(30,122,74,0.09)",   color: C.success },
  "Får fremtidig behov":  { bg: "rgba(26,86,168,0.09)",   color: C.info },
  "Får kanskje behov":    { bg: "rgba(143,90,10,0.09)",   color: C.warning },
  "Ukjent om behov":      { bg: "rgba(0,0,0,0.04)",       color: C.textFaint },
  "Ikke aktuelt":         { bg: "rgba(160,35,40,0.09)",   color: C.danger },
};

/* ── Heat badge colors ── */
export const HEAT_COLORS: Record<HeatResult["temperature"], { bg: string; color: string; label: string }> = {
  hett:     { bg: "rgba(160,35,40,0.09)",   color: C.danger,    label: "Hett" },
  lovende:  { bg: "rgba(143,90,10,0.09)",   color: C.warning,   label: "Lovende" },
  mulig:    { bg: "rgba(0,0,0,0.04)",       color: C.textMuted, label: "Mulig" },
  sovende:  { bg: "rgba(0,0,0,0.03)",       color: C.textGhost, label: "Sovende" },
};
