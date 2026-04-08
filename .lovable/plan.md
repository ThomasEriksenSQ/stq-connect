

## Plan: Linjeskift etter labels + bedre datovisning

### Hva endres
1. **"SISTE" → "SISTE OPPFØLGING"** med linjeskift etter labelen (label på egen rad, innhold under).
2. **"NESTE OPPFØLGING"** med linjeskift etter labelen (label på egen rad, innhold under).
3. **Bedre datovisning** for "Siste"-raden.

### Datoforslag

Dagens visning: `18. apr. 2024 · 720 dager siden` — "720 dager siden" er vanskelig å tolke mentalt.

**Forslag:** Vis relativ dato i menneskelig format og legg absolutt dato som sekundær info:

- Under 7 dager: `3 dager siden · 5. apr. 2026`
- Under 4 uker: `2 uker siden · 25. mar. 2026`
- Under 12 måneder: `4 mnd siden · des. 2025`
- Over 12 måneder: `1 år 11 mnd siden · mai 2024` (eller `2 år siden`)

Relativ dato vises først med `text-foreground/70`, absolutt dato etter `·` i `text-muted-foreground`. For gamle datoer (>6 mnd) legges det til en subtil `text-destructive/70` farge på den relative delen for å signalisere at det er lenge siden.

### Teknisk gjennomføring

**Fil:** `src/components/dashboard/DailyBrief.tsx`

1. **Endre layout (linje 859–877):** Fra `flex items-baseline gap-2 flex-wrap` til `flex flex-col gap-1`. Label "SISTE OPPFØLGING" på egen rad. Under: `flex items-baseline gap-2 flex-wrap` med sitat og dato.

2. **Endre layout (linje 880–882):** Samme mønster — label "NESTE OPPFØLGING" på egen rad, innhold under.

3. **Legg til hjelpefunksjon** `formatRelativeAge(dateStr)` som returnerer menneskelig relativ tekst (`3 dager siden`, `2 uker siden`, `4 mnd siden`, `1 år 11 mnd siden`).

4. **Fargekoding av alder:**
   - < 30 dager: `text-muted-foreground` (normal)
   - 30–180 dager: `text-amber-600` (advarsel)
   - > 180 dager: `text-destructive/70` (gammel)

