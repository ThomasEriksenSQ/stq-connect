

## Forbedringsforslag for Markedsradar-siden

### Problem
De tre kortene ("Opprett i CRM", "Kontaktpersoner", "Teknologier i vekst") er presset inn i tre smale kolonner (`xl:grid-cols-3`), noe som gir lite plass til innholdet i hver kolonne og dårlig lesbarhet.

### Forslag til ny layout

**Erstatt tre-kolonners grid med stablede, fullbredde seksjoner:**

1. **"Opprett i CRM"** -- Fullbredde. Vis selskapene som kompakte rader i et horisontalt grid (`grid-cols-2` eller `grid-cols-3` for radene inni kortet), i stedet for en smal vertikal liste. Gir bedre plass til selskapsinfo og "Opprett"-knapp.

2. **"Kontaktpersoner"** -- Fullbredde. Samme prinsipp: vis kontaktene i et to-kolonners grid inni kortet, så telefon/e-post får plass uten trengsel.

3. **"Teknologier i vekst"** -- Fullbredde. Vis trendene som en kompakt horisontal liste eller to-kolonners grid, med momentum-badge til høyre.

### Andre forbedringer

- **Stat-kort-raden** (5 kort): Fungerer bra som den er.
- **Grafene under** (`xl:grid-cols-[1.35fr_1fr]`): Beholdes som to-kolonners -- god balanse.
- **Prioriterte selskaper**: Allerede fullbredde, beholdes.

### Teknisk endring

**Fil:** `src/pages/Markedsradar.tsx`

- Linje 345: Endre `grid gap-6 xl:grid-cols-3` til `space-y-6` (stablede kort)
- Innholdet i hvert kort: Endre `.space-y-3` listene til `grid grid-cols-1 sm:grid-cols-2 gap-3` for å utnytte bredden
- Fjerne `slice(0, 6)` begrensningen eller øke den, siden det nå er plass til flere elementer

Resultatet: Tre fulle-bredde seksjoner med innhold i to-kolonners grid, som gir mye bedre lesbarhet og utnytter skjermbredden.

