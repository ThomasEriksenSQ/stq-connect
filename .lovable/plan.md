

## Plan

Utvid visningsfilteret på `/design-lab/oppfolginger` med to nye valg og rens opp rekkefølgen.

### Ny rekkefølge
`Alle | I dag | Denne uken | Neste 30 dager | Forfalt`

### Endringer i `src/pages/DesignLabOppfolginger.tsx`

1. **Type (linje 48)**: `type FollowUpViewFilter = "Alle" | "I dag" | "Denne uken" | "Neste 30 dager" | "Forfalt";`
   - "Denne uka" → "Denne uken" (mer i tråd med øvrig norsk i appen).
2. **VIEW_FILTERS (linje 54)**: oppdater til ny rekkefølge.
3. **Filterlogikk (linje 262–266)**: 
   - `"I dag"`: `nextFollowUpAt` er i dag (`isToday`).
   - `"Denne uken"`: eksisterende logikk (i dag → slutten av uken).
   - `"Neste 30 dager"`: `nextFollowUpAt` mellom i dag og +30 dager (inkluderer i dag).
   - `"Forfalt"`: uendret.
4. Ingen DB-endringer, ingen visuell stylingendring — pillene rendres allerede via `DesignLabFilterRow`.

### Resultat
Brukeren kan zoome inn på dagens oppgaver, ukens oppgaver, eller en månedshorisont — uten å forlate "Forfalt"-snarveien.

