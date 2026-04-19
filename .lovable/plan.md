

## Mål

Legge til feltet **Ekstra kostnad / time** (samme som finnes på STACQ Prisen-redigering i dag) i **Aktive oppdrag → Nytt oppdrag** og **Rediger oppdrag**. Beløpet trekkes fra timesprisen som del av STACQ-prisberegningen (`stacqPris.ts` håndterer det allerede via `ekstra_kostnad`).

## Funn

- `stacq_oppdrag.ekstra_kostnad` finnes allerede i DB og brukes av `calcStacqPris()`.
- I dag eksponeres feltet kun i `DesignLabStacqPrisen.tsx` (EditModal, linje 503/511/543-547) og `StacqPrisen.tsx`.
- `OppdragEditSheet.tsx` (brukt av Aktive oppdrag for både opprett og rediger) har felt for Utpris og Innpris, men ingen `ekstra_kostnad`.
- `src/lib/oppdragForm.ts` definerer `OppdragFormState` og `buildOppdragWritePayload()` — disse må utvides så `ekstra_kostnad` kommer med i insert/update.

## Endringer

**1. `src/lib/oppdragForm.ts`**
- Legg til `ekstraKostnad: string` i `OppdragFormState` og `OPPDRAG_DEFAULTS` (default `""`).
- Inkluder `ekstra_kostnad: toNullableNumber(value.ekstraKostnad)` i `buildOppdragWritePayload`-returobjektet.

**2. `src/components/OppdragEditSheet.tsx`**
- Ny `useState` `ekstraKostnad` (string).
- Reset i `useEffect` for create-mode (tom) og populer fra `row.ekstra_kostnad` i edit-mode.
- Inkluder `ekstraKostnad` i `buildFormState()`.
- Oppdater `marginPerTime`-beregningen så den også trekker fra `ekstraKostnad`:  
  `(utpris) - (tilKonsulent) - (ekstraKostnad)` slik at "Margin (beregnet)" reflekterer netto STACQ-pris pr. time.
- Legg inn nytt input-felt rett under "Innpris / time" (samme V1-stil som de andre feltene i sheetet — `LABEL` + `Input type="number"`):
  - Label: `Ekstra kostnad / time`
  - Placeholder: `f.eks. 80`
  - Liten hjelpetekst under: *"Trekkes fra STACQ Prisen. Brukes for deal-avtaler, bonus-forpliktelser e.l."*

**3. Type-utvidelse for row**
- `OppdragEditSheet` leser `row.ekstra_kostnad` i load-effekten. Feltet finnes allerede i `Database["public"]["Tables"]["stacq_oppdrag"]["Row"]`, så ingen typeendringer ut over riktig casting.

## Hvor feltet vises

Sidepanel `OppdragEditSheet` brukes både fra:
- `KonsulenterOppdrag.tsx` (V1 `/konsulenter/i-oppdrag`)
- `DesignLabKonsulenterOppdrag.tsx` (V2 `/design-lab/aktive-oppdrag`)

Begge får automatisk det nye feltet med samme V1-stil som resten av sheetet (project-knowledge V1-regler — vi endrer ikke styling i sheetet).

## Forventet resultat

På Aktive oppdrag → "Nytt oppdrag" og "Rediger" finnes nå et felt **Ekstra kostnad / time**. Tallet lagres i `stacq_oppdrag.ekstra_kostnad`, viser direkte i margin-boksen i sheetet, og brukes av `calcStacqPris()` slik at STACQ Prisen-tabellen automatisk får riktig verdi uten dobbeltvedlikehold.

