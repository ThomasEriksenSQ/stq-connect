

## Plan: Vis "Starter"-status basert på `tilgjengelig_fra`

### Diagnose

I `src/pages/DesignLabKonsulenterAnsatte.tsx` bestemmes statusen av `getStatus()` (linje 128–132) — kun `start_dato` brukes til å avgjøre om en ansatt er "Kommende". `tilgjengelig_fra` er ikke en del av regelen.

Database-bilde av alle 4 ansatte med fremtidig `tilgjengelig_fra`:
- Harald, Trond, Herbert: `start_dato = tilgjengelig_fra = 01.09.2026` → vises korrekt som "Kommende — Starter 01.09"
- **Tom Erik Lundesgaard**: `start_dato = 01.11.2025` (fortid), `tilgjengelig_fra = 24.04.2026` (fremtid) → vises som "Aktiv" i dag, ingen "Starter"-boks

Brukerens regel: hvis `tilgjengelig_fra` er satt (spesielt i fremtiden) skal den ansatte få en "Starter"-boks med den datoen, slik som de andre tre allerede har.

### Endring

Kun `src/pages/DesignLabKonsulenterAnsatte.tsx`:

1. **Utvid `getStatus()`** så en ansatt klassifiseres som "Kommende" hvis enten:
   - `start_dato` er i fremtiden, **eller**
   - `tilgjengelig_fra` er i fremtiden (og ikke `SLUTTET`)

2. **Velg visningsdato** for "Starter"-chipen ut fra hva som er mest relevant:
   - Hvis `tilgjengelig_fra` er i fremtiden → bruk den ("Starter 24.04")
   - Ellers (klassisk Kommende) → behold `start_dato`

3. **Stats-telling** (`stats.kommende`) plukker opp endringen automatisk siden den bruker `getStatus()`.

4. **Filter "Aktiv"** viser allerede både "Aktiv" og "Kommende" sammen, så Tom Erik blir liggende på samme sted som i dag — bare med oppdatert chip.

5. Ingen DB-endringer, ingen migrasjoner, ingen andre filer.

### Forventet resultat

Tom Erik vil etter endringen vises med en gul **"Starter 24.04"**-chip i samme kolonne som de tre andre, og han teller med i `Kommende`-stat-tallet. De andre tre er uberørt.

### Detaljer

```text
getStatus(row):
  if status === 'SLUTTET' → 'Sluttet'
  if start_dato i fremtiden → 'Kommende'
  if tilgjengelig_fra i fremtiden → 'Kommende'   ← NY
  → 'Aktiv'

Visningsdato i "Starter"-chip:
  if tilgjengelig_fra > i dag → tilgjengelig_fra
  else → start_dato
```

