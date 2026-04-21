import type { HeatResult } from "@/lib/heatScore";

const dlVar = (name: string, fallback: string) => `var(--dl-${name}, ${fallback})`;

/* ═══════════════════════════════════════════════════════════
   LINEAR-INSPIRED DESIGN SYSTEM v8
   3-layer hierarchy: shell (#F5F6F8) → main (#FAFBFC) → panels (#FFFFFF)
   ═══════════════════════════════════════════════════════════ */

export const C = {
  /* Backgrounds — 3-layer: shell → main → panels */
  bg: dlVar("bg", "#F5F6F8"),                     // app shell (outermost viewport)
  sidebarBg: dlVar("sidebar-bg", "#F3F3F4"),      // sidebar — own subtle layer
  panel: dlVar("panel", "#FFFFFF"),               // detail/right panel
  surface: dlVar("surface", "#FFFFFF"),           // panels, detail views
  appBg: dlVar("app-bg", "#FCFCFD"),              // main canvas background
  surfaceAlt: dlVar("surface-alt", "#F3F3F4"),    // elevated controls, table headers
  overlay: dlVar("overlay", "#EDEEF2"),           // overlay backgrounds
  hoverBg: dlVar("hover-bg", "#F0F2F6"),          // hover state
  activeBg: dlVar("active-bg", "#E8ECF5"),        // active/pressed
  selected: dlVar("selected", "#E2E7F5"),         // selected row
  hoverSubtle: dlVar("hover-subtle", "#F0F2F6"),
  filterActiveBg: dlVar("filter-active-bg", "#E8ECF5"),
  filterActiveBorder: dlVar("filter-active-border", "#C5CBE8"),

  /* Text */
  text: dlVar("text", "#1A1C1F"),
  textMuted: dlVar("text-muted", "#5C636E"),
  textFaint: dlVar("text-faint", "#8C929C"),
  textGhost: dlVar("text-ghost", "#BEC4CC"),
  textPrimary: dlVar("text", "#1A1C1F"),
  textSecondary: dlVar("text-muted", "#5C636E"),

  /* Accent */
  accent: dlVar("accent", "#5E6AD2"),
  accentHover: dlVar("accent-hover", "#4F5AB8"),
  onAccent: dlVar("on-accent", "#FFFFFF"),
  accentBg: dlVar("accent-bg", "rgba(94,106,210,0.10)"),
  accentMuted: dlVar("accent-muted", "rgba(94,106,210,0.05)"),

  /* Borders */
  border: dlVar("border", "#DDE0E7"),
  borderLight: dlVar("border-light", "#E8EAEE"),   // sidebar/panel dividers
  borderStrong: dlVar("border-strong", "#C8CDD6"),
  borderFocus: dlVar("border-focus", "#5E6AD2"),
  borderDefault: dlVar("border", "#DDE0E7"),

  /* Status — desaturated */
  success: dlVar("success", "#2D6A4F"),
  warning: dlVar("warning", "#7D4E00"),
  danger: dlVar("danger", "#8B1D20"),
  info: dlVar("info", "#1A4FA0"),
  statusNeutral: dlVar("status-neutral", "#3A3F4A"),
  heatPromising: dlVar("heat-promising", "#FB923C"),
  heatPossible: dlVar("heat-possible", "#FBBF24"),

  /* Status backgrounds (8% opacity) */
  successBg: dlVar("success-bg", "rgba(45,106,79,0.08)"),
  warningBg: dlVar("warning-bg", "rgba(125,78,0,0.08)"),
  dangerBg: dlVar("danger-bg", "rgba(139,29,32,0.08)"),
  infoBg: dlVar("info-bg", "rgba(26,79,160,0.08)"),
  statusNeutralBg: dlVar("status-neutral-bg", "#F0F2F6"),
  statusNeutralBorder: dlVar("status-neutral-border", "#C8CDD6"),

  /* Dot colors — for status indicators */
  dotSuccess: dlVar("dot-success", "#4CAF78"),
  dotWarning: dlVar("dot-warning", "#E5A030"),
  dotError: dlVar("dot-error", "#D04045"),
  dotNeutral: dlVar("dot-neutral", "#9BA3AE"),
  dotInfo: dlVar("dot-info", "#5E6AD2"),
  dotBacklog: dlVar("dot-backlog", "#BEC4CC"),
  dotCancelled: dlVar("dot-cancelled", "#8C929C"),

  /* Icons */
  iconDefault: dlVar("text-faint", "#8C929C"),
  iconStrong: dlVar("text-muted", "#5C636E"),
  iconActive: dlVar("text", "#1A1C1F"),

  /* Toggle states */
  toggleCv:         { activeBg: dlVar("info-bg", "rgba(26,79,160,0.08)"), activeText: dlVar("info", "#1A4FA0") },
  toggleBuyer:      { activeBg: dlVar("accent-bg", "rgba(94,106,210,0.08)"), activeText: dlVar("accent", "#5E6AD2") },
  toggleIrrelevant: { activeBg: dlVar("danger-bg", "rgba(193,53,56,0.08)"), activeText: dlVar("danger", "#C13538") },
  toggleInactive:   { bg: "transparent", text: dlVar("text-faint", "#8C929C"), border: dlVar("border", "#DDE0E7") },

  /* Shadows */
  shadow: dlVar("shadow", "0 1px 2px rgba(0,0,0,0.05)"),
  shadowMd: dlVar("shadow-md", "0 4px 12px rgba(0,0,0,0.08)"),
  shadowLg: dlVar("shadow-lg", "0 8px 32px rgba(0,0,0,0.11)"),
} as const;

/* ── Signal color map ── */
type Signal = "Behov nå" | "Får fremtidig behov" | "Får kanskje behov" | "Ukjent om behov" | "Ikke aktuelt";

export const SIGNAL_COLORS: Record<
  Signal,
  {
    bg: string;
    color: string;
    border: string;
    activeBg: string;
    activeColor: string;
    activeBorder: string;
  }
> = {
  "Behov nå":             { bg: dlVar("signal-now-bg", "#EBF3EE"), color: dlVar("signal-now-text", "#2D6A4F"), border: dlVar("signal-now-border", "#C0DEC8"), activeBg: C.filterActiveBg, activeColor: C.text, activeBorder: C.filterActiveBorder },
  "Får fremtidig behov":  { bg: dlVar("signal-future-bg", "#EAF0F9"), color: dlVar("signal-future-text", "#1A4FA0"), border: dlVar("signal-future-border", "#B3C8E8"), activeBg: C.filterActiveBg, activeColor: C.text, activeBorder: C.filterActiveBorder },
  "Får kanskje behov":    { bg: dlVar("signal-maybe-bg", "#FBF3E6"), color: dlVar("signal-maybe-text", "#7D4E00"), border: dlVar("signal-maybe-border", "#E8D0A0"), activeBg: C.filterActiveBg, activeColor: C.text, activeBorder: C.filterActiveBorder },
  "Ukjent om behov":      { bg: dlVar("signal-unknown-bg", "#F0F2F6"), color: dlVar("signal-unknown-text", "#3A3F4A"), border: dlVar("signal-unknown-border", "#C8CDD6"), activeBg: C.filterActiveBg, activeColor: C.text, activeBorder: C.filterActiveBorder },
  "Ikke aktuelt":         { bg: dlVar("signal-no-bg", "#FAEBEC"), color: dlVar("signal-no-text", "#8B1D20"), border: dlVar("signal-no-border", "#E8B8BA"), activeBg: C.filterActiveBg, activeColor: C.text, activeBorder: C.filterActiveBorder },
};

/* ── Heat badge colors ── */
export const HEAT_COLORS: Record<HeatResult["temperature"], { bg: string; color: string; label: string }> = {
  hett:     { bg: C.dangerBg,            color: C.danger,    label: "Hett" },
  lovende:  { bg: C.warningBg,           color: C.warning,   label: "Lovende" },
  mulig:    { bg: C.infoBg,              color: C.info,      label: "Mulig" },
  sovende:  { bg: "rgba(0,0,0,0.05)",    color: C.textFaint, label: "Sovende" },
};
