

## Endring i `supabase/functions/fornyelse-varsel-epost/index.ts`

### Problem
Christian Steffen Poljac (AMINA Charging AS) har `lopende_30_dager: true` og havner i dag i "Kritisk — under 7 dager" fordi `forny_dato` er nær. Løpende 30-dager-oppdrag har ikke en reell deadline — de fornyes automatisk hver 30. dag — så de bør ikke skape kritisk-alarm. Brukeren vil at alle med `lopende_30_dager: true` skal grupperes under **Planlegg**.

### Justering av segmenteringen (linje ~125–127)

```ts
const kritisk  = enriched.filter(o => !o.lopende_30_dager && o.daysUntilForny <= 7);
const snart    = enriched.filter(o => !o.lopende_30_dager && o.daysUntilForny > 7 && o.daysUntilForny <= 30);
const planlegg = enriched.filter(o =>  o.lopende_30_dager || o.daysUntilForny > 30);
```

Dvs. `lopende_30_dager` overstyrer dagsbasert kategorisering og legges alltid i Planlegg.

### Ingen andre endringer
- Mailmal, stats-rad (4 kolonner), CTA, footer — uendret.
- "Konsulenter uten oppdrag"-seksjonen — uendret.
- Filter-spørringen mot `stacq_oppdrag` — uendret (datodrevet).
- Badgen "Løpende 30 dager" vises fortsatt i radene som tidligere.

### Resultat
- Christian flyttes fra Kritisk → Planlegg.
- Stats-tellerne reflekterer ny gruppering automatisk (`kritisk.length` osv.).
- Lars Ødegård (ikke løpende, fornyelse om 4 dager) blir fortsatt i Kritisk.

