

# Plan: Oppdater Design Lab til Linear Design System

## Oversikt

Grundig justering av alle tre Design Lab-sider (Contacts, Forespørsler, StacqPrisen) og den delte TextSizeControl-komponenten til det spesifiserte Linear-inspirerte designsystemet. Kun **light mode** implementeres (brukeren foretrekker lyse grensesnitt).

## Hva endres

### 1. Felles fargetema — ekstraheres til `src/components/designlab/theme.ts`

Alle tre sider dupliserer et `C`-objekt. Ekstraher til én delt fil og oppdater verdiene til Linear-spesifikasjonen:

```text
Nåværende                    → Ny (Linear light mode)
─────────────────────────────────────────────────────
bg: "#FCFCFD"                → "#F7F8FA"   (--bg-base)
sidebarBg: "#F3F3F4"         → "#F4F5F8"   (--bg-surface)
surface: "#ffffff"            → "#FFFFFF"   (--bg-app)
surfaceAlt: "#f3f4f5"        → "#EDEEF2"   (--bg-elevated)
text: "#1d2028"              → "#222326"   (--text-primary)
textMuted: "#6b6f76"         → "#5E6470"   (--text-secondary)
textFaint: "#8a8f98"         → "#8B92A1"   (--text-tertiary)
textGhost: "#a2a5ab"         → "#C1C7D0"   (--text-disabled)
accent: "#01696F"            → "#5E6AD2"   (muted indigo, Linear accent)
accentBg                     → "rgba(94,106,210,0.10)" (--accent-subtle)
accentMuted                  → "rgba(94,106,210,0.05)" (--accent-muted)
border: "#e6e6e6"            → "#E6E9EF"   (--border-default)
borderLight: "#eff0f1"       → "#EDF0F5"   (--border-subtle)
borderStrong                 → "#D4D9E3"   (--border-strong)
hoverBg                      → "#F2F4F8"   (--bg-hover)
activeBg                     → "#ECEFF5"   (--bg-active)
shadow                       → "0 1px 3px rgba(0,0,0,0.07)" (--shadow-sm)
danger: "#9a4a4a"            → "#CE2C31"   (--color-error)
success: "#4a9a6a"           → "#30A46C"   (--color-success)
warning: "#9a7a2a"           → "#DB8400"   (--color-warning)
```

**Valg om aksent:** Teal (#01696F) erstattes med Linears muted indigo (#5E6AD2) for å følge spesifikasjonen fullt ut. Brukeren ba om å "justere grundig etter denne mailen".

### 2. Typografi-justeringer (alle tre sider)

| Element | Nå | Ny |
|---------|----|----|
| Sidebar workspace title | 14px/600 | 14px/600 (ok) |
| Sidebar nav items | 13px/500 | 13px/500 (ok) |
| Sidebar section labels | 11px/600 uppercase | 11px/600 (ok) |
| Page title (h1 i header) | 14px/600 | 14px/600 (ok) |
| Table header | 11px/600-700 uppercase | 11px/500-600 uppercase, **fjern 700 weight** |
| Table body | 13px/500 | 13px/400-500 (ok) |
| Detail panel title (h2) | 16px/**700** | 16px/**600** (max 600 i UI) |
| Badges/chips | 11-12px/500 | 11-12px/500 (ok) |
| Filter labels | 11px/600 | 11px/500-600 (ok) |

**Regel: ingen fontWeight over 600 i UI-komponenter.**

### 3. Komponent-justeringer

**Sidebar (alle 3 sider)**
- Width: 216px → 220px (Linear spec)
- Topbar height: 44px (ok)
- Nav item height: py-[5px] → eksplisitt height 30px
- Active state bg: `rgba(0,0,0,0.05)` → `C.activeBg` (#ECEFF5)
- Border-radius på nav items: 6px → 4px (--radius-xs)

**Topbar/Header**
- Height: 44px (ok)
- Border-bottom: bruker `C.border` (ok)

**Tabell-rader**
- Full-width row height: 36px (ok)
- Compact row min-height: 42px → 38px
- Hover: `C.hoverBg`
- Selected: `C.activeBg`

**Buttons**
- Primary: bg accent, height 32px (sm), border-radius 6px (--radius-sm)
- Filter chips: border-radius 6px → 4px (--radius-xs)
- Filter active state: bg accent → bg accent med #fff tekst (ok)

**Input**
- Height: 30px → 34px
- Bg: `C.surface` → `C.surfaceAlt` (elevated)
- Border-radius: 6px (--radius-sm)
- Focus: border accent + box-shadow `0 0 0 3px var(--accent-muted)`

**Badges/Chips**
- Border-radius: 9999px → 4px (--radius-xs) for signal/heat badges
- Status bg: 12-16% opacity fills

**Shadows**
- Cards/surfaces: ingen shadow (flat)
- Kun dropdowns/modals: shadow-md

### 4. Signal- og heat-farger — desaturert med Linear-nøytrale toner

Signal-fargene oppdateres til å bruke status-fargene fra spec med 12-16% opacity:

```text
Behov nå:           bg rgba(48,164,108,0.12), color #30A46C
Fremtidig behov:    bg rgba(0,106,220,0.10), color #006ADC
Kanskje behov:      bg rgba(219,132,0,0.10), color #DB8400
Ukjent:             bg rgba(0,0,0,0.05), color #8B92A1
Ikke aktuelt:       bg rgba(206,44,49,0.08), color #CE2C31
```

Heat-farger:
```text
Hett:     bg rgba(206,44,49,0.12), color #CE2C31
Lovende:  bg rgba(219,132,0,0.12), color #DB8400
Mulig:    bg rgba(0,0,0,0.05), color #5E6470
Sovende:  bg rgba(0,0,0,0.03), color #C1C7D0
```

### 5. TextSizeControl-komponent

Oppdater `src/components/designlab/TextSizeControl.tsx`:
- Farger fra delt tema-fil
- Active pill: bg accent (#5E6AD2), border accent
- Inactive pill: border `#E6E9EF`, color `#8B92A1`
- Border-radius: 9999px → 4px

### 6. Filer som endres

| Fil | Endring |
|-----|---------|
| `src/components/designlab/theme.ts` | **Ny fil** — delt C-objekt + signal/heat maps |
| `src/components/designlab/TextSizeControl.tsx` | Import fra theme, oppdater farger og radius |
| `src/pages/DesignLabContacts.tsx` | Import C fra theme, fjern lokalt C, oppdater 700→600, radius, spacing |
| `src/pages/DesignLabForesporsler.tsx` | Import C fra theme, fjern lokalt C, oppdater 700→600, radius, spacing |
| `src/pages/DesignLabStacqPrisen.tsx` | Import C fra theme, fjern lokalt C, oppdater 700→600, radius, spacing |

### 7. Hva endres IKKE

- Funksjonalitet, data-spørringer, routing, keyboard shortcuts
- Standard CRM-sider (kun Design Lab)
- Darkmode (implementeres ikke — brukeren foretrekker lyse grensesnitt)

## Teknisk detalj

Det nye `theme.ts` eksporterer:
```ts
export const C = { /* alle fargeverdier */ } as const;
export const SIGNAL_COLORS = { /* ... */ };
export const HEAT_COLORS = { /* ... */ };
```

Alle tre sider importerer `C`, `SIGNAL_COLORS`, `HEAT_COLORS` fra `@/components/designlab/theme` i stedet for å definere lokalt.

