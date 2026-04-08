
## Plan: Optimaliser kolonnebredder i ansatt-tabellen

### Endring i `src/pages/KonsulenterAnsatte.tsx`

Endre `GRID_COLS` fra faste pikselverdier til en mer balansert fordeling som utnytter tilgjengelig plass bedre:

```ts
// Fra:
const GRID_COLS = "grid grid-cols-[minmax(0,2.5fr)_100px_110px_100px_90px_90px]";

// Til:
const GRID_COLS = "grid grid-cols-[minmax(0,2.5fr)_minmax(90px,1fr)_minmax(90px,1fr)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(80px,auto)]";
```

Kolonnene (NAVN, START, ANSETTELSE, OPPDRAG, FORNYES, knapp) får fleksible minimumsstørrelser med `1fr` som lar dem vokse proporsjonalt, mens NAVN beholder sin `2.5fr`-vekt for å forbli bredest.

### Kun én fil endres
- `src/pages/KonsulenterAnsatte.tsx` (linje 25)
