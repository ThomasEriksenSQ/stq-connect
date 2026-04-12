

## Plan: Vis "Løpende 30 dager" i fornyelsesvarsler-eposten

### Endring i `supabase/functions/fornyelse-varsel-epost/index.ts`

#### 1. Inkluder `lopende_30_dager` i spørringen (linje 65)
Legg til feltet i select:
```
.select("id, kandidat, kunde, forny_dato, status, lopende_30_dager")
```

#### 2. Oppdater badge-teksten i `oppdragRad` (linje 108)
Når `o.lopende_30_dager` er true, vis "Løpende 30 dager" i stedet for "Om X dager":
```typescript
const badgeText = o.lopende_30_dager ? 'Løpende 30 dager' : `Om ${o.daysUntilForny} dager`;
```

#### 3. Deploy
Deploy `fornyelse-varsel-epost` edge function.

### Resultat
Christian Steffen Poljac (og andre med løpende kontrakt) vil vise "Løpende 30 dager" som badge i stedet for "Om X dager".

