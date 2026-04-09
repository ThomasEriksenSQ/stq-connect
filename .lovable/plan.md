

## Plan: Oppdater stil på "Tidligere prosesser" og "Aktive prosesser"

### Endring i `src/pages/AnsattDetail.tsx`

Oppdater begge prosess-fanene (aktive og tidligere) til å bruke samme kortsti som OppdragRow:

1. **Fjern** `<Send>`-ikonet fra begge prosess-lister (linje 371, 408).
2. **Fjern** "Cold call"-teksten (hvis den vises via `referanse`-feltet — dette er trolig `f?.referanse`, beholdes men undersøkes).
3. **Endre container-klassen** på hvert prosess-element fra `flex items-center justify-between p-3 rounded-lg hover:bg-background/60` til `flex flex-col gap-2 py-2 px-3 rounded-lg bg-background border border-border` — samme som OppdragRow.
4. **Endre layout** inni hvert element til å matche OppdragRow-strukturen: selskapsnavn til venstre med `text-[0.9375rem] font-medium`, referanse som undertekst, og badge til høyre.

Kun `src/pages/AnsattDetail.tsx` endres.

