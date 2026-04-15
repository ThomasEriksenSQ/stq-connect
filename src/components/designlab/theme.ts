import type { HeatResult } from "@/lib/heatScore";

/* ═══════════════════════════════════════════════════════════
   LINEAR-INSPIRED DESIGN SYSTEM — LIGHT MODE
   ═══════════════════════════════════════════════════════════ */

export const C = {
  /* Backgrounds */
  bg: "#F7F8FA",           // --bg-base
  sidebarBg: "#F4F5F8",   // --bg-surface
  surface: "#FFFFFF",      // --bg-app
  surfaceAlt: "#EDEEF2",  // --bg-elevated
  overlay: "#E6E8EE",     // --bg-overlay
  hoverBg: "#F2F4F8",     // --bg-hover
  activeBg: "#ECEFF5",    // --bg-active

  /* Text */
  text: "#222326",         // --text-primary
  textMuted: "#5E6470",   // --text-secondary
  textFaint: "#8B92A1",   // --text-tertiary
  textGhost: "#C1C7D0",   // --text-disabled

  /* Accent */
  accent: "#5E6AD2",
  accentHover: "#4F5AB8",
  accentBg: "rgba(94,106,210,0.10)",   // --accent-subtle
  accentMuted: "rgba(94,106,210,0.05)", // --accent-muted

  /* Borders */
  border: "#E6E9EF",       // --border-default
  borderLight: "#EDF0F5",  // --border-subtle
  borderStrong: "#D4D9E3", // --border-strong
  borderFocus: "#5E6AD2",

  /* Status */
  success: "#30A46C",
  warning: "#DB8400",
  danger: "#CE2C31",
  info: "#006ADC",

  /* Status backgrounds (12-16% opacity) */
  successBg: "rgba(48,164,108,0.12)",
  warningBg: "rgba(219,132,0,0.12)",
  dangerBg: "rgba(206,44,49,0.08)",
  infoBg: "rgba(0,106,220,0.10)",

  /* Icons */
  iconDefault: "#8B92A1",
  iconStrong: "#5E6470",
  iconActive: "#222326",

  /* Shadows */
  shadow: "0 1px 3px rgba(0,0,0,0.07)",
  shadowMd: "0 4px 16px rgba(0,0,0,0.09), 0 1px 3px rgba(0,0,0,0.05)",
  shadowLg: "0 8px 32px rgba(0,0,0,0.12)",
} as const;

/* ── Signal color map ── */
type Signal = "Behov nå" | "Får fremtidig behov" | "Får kanskje behov" | "Ukjent om behov" | "Ikke aktuelt";

export const SIGNAL_COLORS: Record<Signal, { bg: string; color: string }> = {
  "Behov nå":             { bg: "rgba(48,164,108,0.12)",  color: C.success },
  "Får fremtidig behov":  { bg: "rgba(0,106,220,0.10)",   color: C.info },
  "Får kanskje behov":    { bg: "rgba(219,132,0,0.10)",   color: C.warning },
  "Ukjent om behov":      { bg: "rgba(0,0,0,0.05)",       color: C.textFaint },
  "Ikke aktuelt":         { bg: "rgba(206,44,49,0.08)",   color: C.danger },
};

/* ── Heat badge colors ── */
export const HEAT_COLORS: Record<HeatResult["temperature"], { bg: string; color: string; label: string }> = {
  hett:     { bg: "rgba(206,44,49,0.12)",  color: C.danger,    label: "Hett" },
  lovende:  { bg: "rgba(219,132,0,0.12)",  color: C.warning,   label: "Lovende" },
  mulig:    { bg: "rgba(0,0,0,0.05)",      color: C.textMuted, label: "Mulig" },
  sovende:  { bg: "rgba(0,0,0,0.03)",      color: C.textGhost, label: "Sovende" },
};
