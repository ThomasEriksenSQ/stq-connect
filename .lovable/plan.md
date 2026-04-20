

## Diagnose

To separate datokilder:
- **Oppdrag** (`stacq_oppdrag`): `start_dato`, `slutt_dato`, `forny_dato` — gjelder kontrakten med kunden
- **Ansettelse** (`stacq_ansatte`): `start_dato`, `slutt_dato` — gjelder ansettelsesforholdet i STACQ

Tom Erik har oppdrag id 11 satt til `status: Inaktiv` selv om `slutt_dato = 2026-04-24` (4 dager frem). Dette er sannsynligvis manuell inntasting som har henget igjen.

Brukerens nye krav endrer omfanget av mailen:
1. **Forholde seg til oppdragsdata, ikke ansettelse** — mailen skal speile aktive oppdrag.
2. **Inkluder ansatte uten aktive oppdrag** — hvis en ansatt er aktiv (i `stacq_ansatte`) men ikke har et pågående oppdrag, skal de listes som "Konsulent uten oppdrag" i samme mail.

## Endringer

### 1. Datakorreksjon (engangs)
Sett oppdrag id 11 (`Tom Erik`) til `status = 'Aktiv'` siden `slutt_dato` er i fremtiden.

### 2. Edge function: `supabase/functions/fornyelse-varsel-epost/index.ts`

**A. Robust filter for fornyelser** — bytt fra `.neq("status", "Inaktiv")` til datodrevet logikk:
```ts
.not("forny_dato", "is", null)
.lte("forny_dato", thresholdISO)
.or(`slutt_dato.is.null,slutt_dato.gte.${todayISO}`)
```
Dette fanger oppdrag basert på faktiske datoer, uavhengig av om `status`-feltet er feil.

**B. Ny seksjon: "Konsulenter uten oppdrag"**
Hent alle aktive ansatte fra `stacq_ansatte`:
- `status` ikke i ('SLUTTET', 'AVSLUTTET') og `slutt_dato` er null eller i fremtiden

For hver ansatt: sjekk om de har et pågående oppdrag i `stacq_oppdrag` (slutt_dato null eller >= i dag). Hvis ikke → inkluder i ny seksjon med:
- Navn
- "Tilgjengelig fra"-dato (eller "Tilgjengelig nå" hvis ingen)
- Sist avsluttet kunde (siste oppdrag, hvis finnes)

### 3. Mailmal — ny struktur

```
Header (uendret)
  ↓
Stats-rad: Kritisk | Snart | Planlegg | Uten oppdrag (4 kolonner i stedet for 3)
  ↓
Seksjon: Kritisk — under 7 dager
Seksjon: Snart — under 30 dager
Seksjon: Planlegg — under 90 dager
Seksjon: Konsulenter uten oppdrag (ny, grå/nøytral farge)
  ↓
CTA + footer (uendret)
```

Visuelt: bruk en nøytral grå indikator (`#64748B`) for "Uten oppdrag"-seksjonen for å skille fra fornyelseskategoriene.

## Etter endringen

- Tom Erik vises i "Kritisk — under 7 dager" (oppdrag slutter 24.04, fornyelse innen terskel).
- Når oppdraget hans faktisk avsluttes 24.04 og han ikke har nytt oppdrag, flyttes han automatisk til "Konsulenter uten oppdrag" i neste utsendelse.
- Mailen reflekterer nå hele konsulentporteføljen, ikke bare fornyelser.

## Ikke endret

- Cron-skjema, terskel_dager-logikk, mottakerliste.
- `computeOppdragStatus` i klient — dekker fremtidige lagringer korrekt.
- V1/V2 UI — kun edge function og engangs datafiks.

