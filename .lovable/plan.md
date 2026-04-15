

# Plan: Subtil heat-indikator i Design Lab kontaktlisten

## Tilnærming

Legge til en tynn farget venstrekant (3px `border-left`) på hver kontaktrad i listen, basert på `heatResult.temperature`. Dette matcher det eksisterende mønsteret fra standard Contacts-siden, men tilpasset Design Lab-paletten via `HEAT_COLORS` fra theme.ts.

I tillegg vises den eksisterende `HeatBadge`-komponenten som allerede finnes i filen (linje 625) som en kolonne i tabellen — erstatning av den nåværende "Siste akt."-kolonnen med en kombinert kolonne som viser både heat-badge og relativ tid.

## Design

- **Venstrekant på rad**: 3px `borderLeft` med farge fra `HEAT_COLORS[temperature].color`. `sovende` får transparent kant for å unngå støy.
- **Heat-kolonne i header**: Bytt "Siste akt." til "Varme" — viser `HeatBadge` (som allerede er definert) med relativ tid som sekundær tekst.
- Subtilt og konsistent med Linear-estetikken — ingen ekstra badges, bare en stille fargekant + kompakt badge.

## Endringer i `src/pages/DesignLabContacts.tsx`

### 1. Rad: legg til farget venstrekant
Linje ~531-536: Legg til `borderLeft` basert på temperature:
```tsx
borderLeft: `3px solid ${c.heatResult.temperature === "sovende" ? "transparent" : HEAT_COLORS[c.heatResult.temperature].color}`,
```

### 2. Siste kolonne: vis HeatBadge + relativ tid
Linje ~561-563: Erstatt ren relativ tid med HeatBadge + tid:
```tsx
<div className="flex items-center justify-end gap-2">
  <HeatBadge heat={c.heatResult} daysSince={c.daysSince} />
  <span style={{ fontSize: 11, color: C.textFaint }}>{c.daysSince < 999 ? relTime(c.daysSince) : ""}</span>
</div>
```

### 3. Header: oppdater siste kolonne-label
Linje ~517: Endre "Siste akt." til "Varme" og juster bredde fra `80px` til `140px` i gridTemplateColumns (linje 506 og 532).

### Filer som endres
- `src/pages/DesignLabContacts.tsx` — 3 småjusteringer i listevisningen

