

# Plan: Oppdater til Linear Design System v5

## Oversikt
Oppdater `theme.ts` og alle tre Design Lab-sider til v5-spesifikasjonen. Endringene er primært fargeverdier, radii, og komponent-geometri.

## 1. theme.ts — oppdaterte fargeverdier

| Token | Nåværende | Ny (v5) |
|-------|-----------|---------|
| bg | #F7F8FA | #F5F6F8 |
| sidebarBg (bg-surface) | #F4F5F8 | #FFFFFF |
| surface (bg-app) | #FFFFFF | #FAFBFC |
| surfaceAlt (bg-elevated) | #EDEEF2 | #F4F5F8 |
| overlay | #E6E8EE | #EDEEF2 |
| hoverBg | #F2F4F8 | #F0F2F6 |
| activeBg | #ECEFF5 | #E8ECF5 |
| + selectedStrong | — | #E2E7F5 |
| text | #222326 | #1A1C1F |
| textMuted | #5E6470 | #5C636E |
| textFaint | #8B92A1 | #8C929C |
| textGhost | #C1C7D0 | #BEC4CC |
| border | #E6E9EF | #DDE0E7 |
| borderLight | #EDF0F5 | #E8EAEE |
| borderStrong | #D4D9E3 | #C8CDD6 |
| success | #30A46C | #1E7A4A |
| warning | #DB8400 | #8F5A0A |
| danger | #CE2C31 | #A02328 |
| info | #006ADC | #1A56A8 |
| status bgs | 12% opacity | 9% opacity |
| shadow | 0.07 | 0.06 |
| shadowMd | multi | 0 4px 16px rgba(0,0,0,0.09) |
| shadowLg | 0.12 | 0 8px 40px rgba(0,0,0,0.12) |

Signal- og heat-farger oppdateres til å bruke de nye status-fargene og 9% opacity.

## 2. Komponent-geometri (alle tre sider)

| Element | Nå | Ny (v5) |
|---------|----|----|
| Nav item height | py-[5px] ~30px | eksplisitt 28px |
| Nav inactive weight | 500 | 400 |
| Sidebar section labels | 600 uppercase | 500, **fjern uppercase** |
| Border-radius xs | 4px | 3px |
| Border-radius sm (buttons/inputs) | 6px | 5px |
| Input height | 34px | 32px |
| Input padding | 0 10px | 0 9px |
| Filter chip height | 24px | 24px (ok) |
| Filter chip radius | 4px | 3px |
| Table row height | 36px | 34-36px |
| ColHeader active weight | 700 | 600 |
| Badge/chip radius | rounded (4px) | 3px |
| Badge padding | 1px 7px → 2px 6px |
| SidebarBtn radius | 6px | 3px |
| Detail panel section header | — | 11px/600/textFaint |

## 3. Filer som endres

| Fil | Endring |
|-----|---------|
| `src/components/designlab/theme.ts` | Alle fargeverdier, signal/heat maps |
| `src/components/designlab/TextSizeControl.tsx` | Radius 4→3px |
| `src/pages/DesignLabContacts.tsx` | Radii, weights, heights, input sizing |
| `src/pages/DesignLabForesporsler.tsx` | Samme justeringer |
| `src/pages/DesignLabStacqPrisen.tsx` | Samme justeringer |

## 4. Hva endres IKKE
- Funksjonalitet, data, routing, keyboard shortcuts
- Standard CRM-sider
- Dark mode (kun light mode)

