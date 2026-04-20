

## Plan: Omstrukturer matcher-tabellen på Design Lab Kontakter

### Endring
Fil: `src/pages/DesignLabContacts.tsx` (linje ~2073–2226 — matcher-tabellen som vises når en konsulent er valgt i "Tilgjengelig for oppdrag").

### Ny kolonnerekkefølge
| # | Kolonne | Bredde | Innhold |
|---|---------|--------|---------|
| 1 | Navn | minmax(200px,1.5fr) | `lead.name` (ingen sekundærlinje med tittel) |
| 2 | Match | 120px | Prikk + `Match X/10` + confidence-label |
| 3 | Varme | 96px | `<DesignLabHeatBadge>` |
| 4 | Selskap | minmax(160px,1.2fr) | `lead.companyName` / fallback per type |
| 5 | Stilling | minmax(160px,1.2fr) | `lead.title` (kontakt) / `contactTitle` (forespørsel) / `preferredContactName` (selskap) |
| 6 | Tags | minmax(140px,1fr) | `lead.matchTags.slice(0, 3).join(", ")` |
| 7 | Siste akt | 96px (right) | `relativeDate(leadDate)` |

### Detaljer
- Fjern "Kilde"-kolonnen helt (`lead.matchSources` og linjen med `getMatchSourceLabel`).
- Flytt tags fra under Kilde til egen Tags-kolonne.
- Flytt stilling/sekundærtekst (tidligere under Navn) til egen Stilling-kolonne — fjern den fra Navn-cellen.
- Behold sortering på Match og Varme via `toggleHuntSort` — andre kolonner forblir usorterbare (ingen sort-handler eksisterer for dem i dag).
- Behold heat-stripen til venstre (`boxShadow: inset 3px 0 0 ${heatColor}`) og signal-pillene "Selskap"/"Forespørsel" ved siden av navnet.
- Oppdater både header-grid (linje 2081–2119) og rad-grid (linje 2154–2226) med samme `gridTemplateColumns`.

### Ny gridTemplateColumns
```
"minmax(200px,1.5fr) 120px 96px minmax(160px,1.2fr) minmax(160px,1.2fr) minmax(140px,1fr) 96px"
```

### Ikke endret
- Logikk for matching, sortering, valg, `handleMatchLeadSelect`.
- Standard kontakt-tabellen (når ingen konsulent er valgt).
- "Tilgjengelig for oppdrag"-baren og filterraden over.

