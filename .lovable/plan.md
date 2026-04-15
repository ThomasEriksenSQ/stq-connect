

# Plan: Gjør heat-indikatorer mer fargerike i Design Lab

## Problem
Nåværende heat-farger for "mulig" og "sovende" er nesten grå og uten fargenyanse — dette gjør heat-kolonnen lite verdifull visuelt. Kun "hett" (rød) og "lovende" (amber) har tydelig farge.

## Løsning
Oppdater `HEAT_COLORS` i theme.ts med desaturerte men distinkte fargenyanser som følger Linear-paletten:

| Temperatur | Nå | Ny |
|---|---|---|
| **hett** | Rød 8% bg + #8B1D20 | Beholder — fungerer |
| **lovende** | Amber 8% bg + #7D4E00 | Beholder — fungerer |
| **mulig** | Grå 4% + textMuted | Blå 8% bg (`rgba(26,79,160,0.08)`) + info-farge (`#1A4FA0`) |
| **sovende** | Grå 3% + textGhost | Nøytral 5% bg (`rgba(0,0,0,0.05)`) + `#8C929C` (textFaint) |

Dette bruker allerede definerte farger fra `C`-objektet (`infoBg`, `info`, `textFaint`) — konsistent med designsystemet. Nå har alle fire nivåer distinkte fargenyanser: rød → amber → blå → grå.

Venstrekanten på rader oppdateres tilsvarende — "sovende" forblir transparent, resten får tydelige farger.

## Endringer

### `src/components/designlab/theme.ts`
Oppdater `HEAT_COLORS`:
- `mulig`: bg → `C.infoBg`, color → `C.info`
- `sovende`: bg → `"rgba(0,0,0,0.05)"`, color → `C.textFaint` (allerede #8C929C — en tick mørkere enn nåværende textGhost)

### Filer som endres
- `src/components/designlab/theme.ts` — 2 linjer i HEAT_COLORS

