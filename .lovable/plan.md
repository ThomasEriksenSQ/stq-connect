
## Funn

Feilen ligger på riktig side: `src/pages/DesignLabStacqPrisen.tsx`.

Der er det fortsatt to gamle avvik fra logikken i resten av appen:
1. Queryen filtrerer bort rader allerede i databasen med `.neq("status", "Inaktiv")`.
2. Lokal `computeOppdragStatus()` tar bare hensyn til manuell `status` og `start_dato`, men ignorerer `slutt_dato`.

Konsekvens: Hvis Tom Erik har lagret `status = "Inaktiv"` i DB, men `slutt_dato` fortsatt er frem i tid, blir han ekskludert før siden får regnet ham som aktiv. Det er derfor han ikke vises i `/design-lab/stacq-prisen`, selv om han vises under Aktive oppdrag.

## Plan

### `src/pages/DesignLabStacqPrisen.tsx`

**1. Fjern databasefilteret som skjuler rader for tidlig**
- Ta bort `.neq("status", "Inaktiv")` fra `stacq_oppdrag`-queryen.
- Siden må hente alle relevante oppdrag og la klienten beregne reell status.

**2. Bytt til delt statuslogikk**
- Importer `computeOppdragStatus` fra `@/lib/oppdragForm`.
- Fjern/erstatt den lokale `computeOppdragStatus()`-funksjonen i filen.
- La status beregnes med samme regler som brukes i Aktive oppdrag og V1 STACQ Prisen:
  - passert `slutt_dato` => `Inaktiv`
  - fremtidig `start_dato` => `Oppstart`
  - ellers `Aktiv`

**3. Filtrer først etter beregnet status**
- I `enriched`-listen: beregn status først, deretter filtrer bort kun rader der beregnet status er `Inaktiv`.
- Da kommer Tom Erik med dersom `slutt_dato` er frem i tid.

**4. Hold resten av Design Lab-tabellen uendret**
- Ingen visuelle endringer i layout, sortering eller kort.
- Kun logikkjustering så listen blir korrekt.

## Forventet resultat

Etter endringen vil `/design-lab/stacq-prisen` bruke samme oppdragsstatus som resten av systemet, og Tom Erik vil vises i tabellen så lenge sluttdatoen hans ikke er passert.
