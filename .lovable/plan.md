

## Plan: Betinget fanerekkefølge basert på "Tilgjengelig fra"

### Endring i `src/pages/AnsattDetail.tsx`

1. **Beregn defaultValue og fanerekkefølge** basert på `ansatt.tilgjengelig_fra`:
   - Hvis satt: defaultValue = `"prosesser"`, tabs i rekkefølge: Aktive prosesser → Tidligere prosesser → Aktive oppdrag → Tidligere oppdrag
   - Hvis blank: defaultValue = `"aktive"`, tabs i nåværende rekkefølge: Aktive oppdrag → Tidligere oppdrag → Aktive prosesser → Tidligere prosesser

2. **Implementering**: Legg til en variabel `const isAvailable = !!ansatt.tilgjengelig_fra` og bruk den til å betinget rendre TabsTrigger-elementene i riktig rekkefølge, samt sette `defaultValue` på `<Tabs>`.

Kun én fil endres.

