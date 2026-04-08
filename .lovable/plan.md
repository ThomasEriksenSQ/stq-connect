

## Plan: Legg til fornyelsesdata og varighet i oppdragsrader

### Endring i `src/pages/AnsattDetail.tsx` — `OppdragRow`-komponenten

**1. Aktive oppdrag — vis fornyelsesdato og dager til fornyelse**

Etter pris/margin-raden, legg til fornyelsesinfo basert på `forny_dato` og `lopende_30_dager` fra oppdragsobjektet (disse feltene hentes allerede via `select("*")`):

- Beregn effektiv dato: hvis `lopende_30_dager` → dagens dato + 30 dager, ellers `forny_dato`
- Vis som: `Fornyes: 15. mai 2026 (37 dager)` med fargekoding:
  - Utløpt: `text-destructive font-semibold`
  - ≤30 dager: `text-amber-600 font-semibold`
  - >30 dager: `text-muted-foreground`

**2. Tidligere oppdrag — vis varighet**

For inaktive oppdrag med både `start_dato` og `slutt_dato`, beregn og vis varighet ved hjelp av eksisterende `formatMonths`-funksjonen (som allerede håndterer år/måneder/uker):

- Vis som: `Varighet: 1 år 2 md` etter datoene

**3. Oppdater OppdragRow-signaturen**

Legg til en `isActive`-prop slik at komponenten vet om den skal vise fornyelse (aktiv) eller varighet (tidligere). Alternativt sjekke `o.status` direkte.

### Kun én fil endres
- `src/pages/AnsattDetail.tsx`

