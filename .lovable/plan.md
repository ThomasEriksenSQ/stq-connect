

## Funn

På `/design-lab/aktive-oppdrag` ligger fire stat-kort i en `grid grid-cols-2 md:grid-cols-4` (linje 229–252) i `src/pages/KonsulenterOppdrag.tsx`:
- Aktive oppdrag (emerald)
- I oppstart (amber)
- Fornyelser under 30 dager (amber)
- Fornyelser under 60 dager (amber)

Brukeren vil ha et nytt kort **rett etter "I oppstart"** som teller oppdrag som er i ferd med å avsluttes — definert som aktive oppdrag der `slutt_dato` er satt og ligger i fremtiden (innen et fornuftig vindu). Datakilden er `enriched`, der `slutt_dato` allerede er tilgjengelig.

## Tolkning av "Avsluttes"

"Sluttdato er satt på et oppdrag" alene treffer for vidt — alle ferdig planlagte oppdrag har sluttdato. For at kortet skal være handlingsrelevant (parallell til "Fornyelser under 30/60 dager") foreslås:

**Avsluttes innen 60 dager**: `status ∈ {Aktiv, Oppstart}` AND `slutt_dato` satt AND dager til `slutt_dato` er mellom 0 og 60.

Dette gjør kortet meningsfullt sammen med fornyelseskortene og fanger oppdrag som faktisk skal termineres snart (i motsetning til løpende fornyelser).

## Plan

### `src/pages/KonsulenterOppdrag.tsx`

**1. Stats-beregning (linje 122–168)** — legg til `avsluttes60`:
```
const avsluttes60 = enriched.filter((o) =>
  (o.status === "Aktiv" || o.status === "Oppstart") &&
  o.slutt_dato &&
  (() => {
    const d = differenceInDays(parseOppdragDate(o.slutt_dato)!, today);
    return d >= 0 && d <= 60;
  })()
).length;
```
Returner `avsluttes60` i stats-objektet.

**2. Grid (linje 229)** — utvid fra 4 til 5 kort: `grid-cols-2 md:grid-cols-5`.

**3. Nytt kort (sett inn rett etter "I oppstart", før "Fornyelser under 30 dager")** — bruk samme amber-stil som omkringliggende kort for visuell konsistens, med `Hourglass`-ikon (importeres fra `lucide-react`):
```
<div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 rounded-xl px-5 py-4 shadow-sm">
  <Hourglass className="h-4 w-4 text-amber-600 mb-1" />
  <p className="text-2xl font-bold text-amber-600">{stats.avsluttes60}</p>
  <p className="text-[0.8125rem] text-muted-foreground">Avsluttes under 60 dager</p>
  <p className="text-xs text-muted-foreground">Sluttdato satt</p>
</div>
```

**4. Import (linje 6)** — legg til `Hourglass` i `lucide-react`-importen.

### Utenfor scope
- Ingen nytt filter-chip "Avsluttes" (kan legges til senere ved behov).
- Ingen endring i tabellrader, kolonner eller pille-stiler.
- Ingen endring i V1-flater.
- Ingen endring i `oppdragForm` eller DB.

