

## Mål
Sett venstre tabell-panel på `/design-lab/selskaper` og `/design-lab/kontakter` lik bredden brukt på `/design-lab/foresporsler`.

## Plan
1. Lese `ResizablePanel`-config (`defaultSize`/`minSize`/`maxSize`) på venstre panel i `DesignLabForesporsler.tsx`.
2. Finne tilsvarende `ResizablePanel` i `DesignLabCompanies.tsx` og `DesignLabContacts.tsx` (eller `DesignLabContactDetail.tsx` hvis split ligger der).
3. Oppdatere de to filene med eksakt samme size-verdier som Forespørsler.

## Filer som endres
- `src/pages/DesignLabCompanies.tsx` — venstre `ResizablePanel` props
- `src/pages/DesignLabContacts.tsx` (og evt. `DesignLabContactDetail.tsx`) — venstre `ResizablePanel` props

## Utenfor scope
- Endring av kolonnebredder, `GRID_TEMPLATE` eller header-layout
- Endringer i Forespørsler-siden
- V1-versjoner av selskap/kontakt-listene

