## Problem

På `/pipeline` viser stat-boksen "Vunnet" alltid 5, fordi den teller fra `pipelineItems` (alle data) i stedet for det filtrerte datasettet. Med standardfiltrene (Tilgjengelig / Alle / Alle) skal verdien være 0, fordi vunne løp ikke er inkludert i "Tilgjengelig"-visningen.

## Endring

Fil: `src/pages/Pipeline.tsx` (linje ~632–645, `stats`-useMemo)

Bytt kilden for `won` fra `pipelineItems` til `filteredItems`, slik at tellingen følger de aktive filterne (status, type, kilde).

```ts
won: filteredItems.filter((item) => item.status === "vunnet").length,
```

Legg `filteredItems` til i dependency-arrayen.

## Avgrensning

- Kun `won` endres nå, siden det er den brukeren peker på. Andre stats (`sentCv`, `interviews`, `open`, `available`, `consultants`, `direct`) beholder dagens semantikk for ikke å endre annen oppførsel uten beskjed.
- Resultat: ved default (Tilgjengelig, Alle, Alle) blir Vunnet = 0, fordi "Tilgjengelig"-filteret ekskluderer vunnet-status. Når brukeren f.eks. velger status "Vunnet" eller "Alle", reflekterer tallet det som faktisk vises.
