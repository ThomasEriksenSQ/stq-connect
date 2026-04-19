

## Funn

- Status beregnes allerede klient-side via `computeOppdragStatus` i `KonsulenterOppdrag.tsx` (linje 25–31): hvis `start_dato` er i fremtiden → `"Oppstart"`, ellers `"Aktiv"`, men `"Inaktiv"` overstyrer alt. Dette dekker delvis ønsket logikk, men:
  - **`slutt_dato` ignoreres** — utløpte oppdrag forblir "Aktiv" til noen manuelt avslutter dem.
  - Statusen er kun *vist* — feltet `status` i DB blir ikke oppdatert.
- I `OppdragEditSheet.tsx` finnes feltet **Startdato**, men **ingen Sluttdato-felt**. `slutt_dato` settes kun via "Avslutt oppdrag" (`terminateOppdrag` → `slutt_dato = i dag`).
- DB-kolonnen `slutt_dato` finnes allerede på `stacq_oppdrag`. Ingen migrering trengs.
- `forny_dato` brukes kun til varsler/sortering — påvirker ikke status. Dette er allerede riktig og skal ikke endres.

## Plan

### 1. Legg til Sluttdato-felt i `OppdragEditSheet.tsx`
Plasseres rett under Startdato (linje 698–724). Samme `Popover + Calendar`-mønster som Startdato. Tom som standard.

```
STARTDATO        [📅  3. desember 2025      ]
SLUTTDATO        [📅  Velg dato             ]   ← ny
```

State: `const [sluttDato, setSluttDato] = useState<Date | undefined>()`. Hentes fra `row.slutt_dato` ved redigering.

### 2. Persister `sluttDato`
- Legg `sluttDato: Date | undefined` i `OppdragFormState` (`src/lib/oppdragForm.ts`).
- I `buildOppdragWritePayload`: `slutt_dato: toIsoDate(value.sluttDato)`.
- I `OppdragEditSheet` send `sluttDato` inn via `buildFormState`.

### 3. Sentraliser `computeOppdragStatus` og utvid med `slutt_dato`-regel
Flytt funksjonen fra `KonsulenterOppdrag.tsx` til `src/lib/oppdragForm.ts` (eller ny `src/lib/oppdragStatus.ts`) så den kan brukes både for klient-derivasjon og ved lagring.

Ny logikk:
```ts
function computeOppdragStatus(o: { status?, start_dato?, slutt_dato? }): "Aktiv" | "Oppstart" | "Inaktiv" {
  if (o.status === "Inaktiv") return "Inaktiv";
  const today = startOfDay(new Date());
  const slutt = parseOppdragDate(o.slutt_dato);
  if (slutt && slutt < today) return "Inaktiv";       // sluttdato passert
  const start = parseOppdragDate(o.start_dato);
  if (start && start > today) return "Oppstart";       // startdato i fremtiden
  return "Aktiv";                                       // startdato passert (eller ingen) + ikke utløpt
}
```

Oppdater import-bruk i `KonsulenterOppdrag.tsx` (linje 25–31 erstattes av import).

### 4. Auto-sett status ved lagring
I `buildOppdragWritePayload` (`src/lib/oppdragForm.ts`): kjør `computeOppdragStatus` på det innsendte tidsspennet og overstyr `status`-feltet — **unntatt** når brukeren eksplisitt har valgt `"Inaktiv"` (det skal alltid respekteres som hard avslutning).

```ts
const derived = computeOppdragStatus({
  status: value.status,
  start_dato: toIsoDate(value.startDato),
  slutt_dato: toIsoDate(value.sluttDato),
});
return { ...payload, status: derived };
```

Dette gir:
- **Sluttdato passert** → status = `Inaktiv` (lagret i DB, ikke bare derivert).
- **Startdato i fremtiden** → status = `Oppstart`.
- **Startdato i dag/passert + ikke sluttet** → status = `Aktiv`.
- **`Fornyes / utløper`** påvirker ingenting (uendret oppførsel).

### 5. Visuell konsistens i statuschips i editoren
Status-chipsene i sheet (linje 569–587) viser fortsatt brukervalget. Vi lar brukeren kunne velge manuelt, men når sluttdato/startdato er satt vil lagring overskrive. Vurder å vise en liten hint-tekst under status-chipsene **kun når dato-regler vil overstyre** (f.eks. *"Status settes automatisk basert på datoer"*). Lavt oppmerksomhetsnivå (`text-[0.75rem] text-muted-foreground`).

### 6. Test-utvidelse
Utvid `src/test/oppdragForm.test.ts` med tre nye case:
- Sluttdato i fortiden → payload.status = `"Inaktiv"`.
- Startdato i fremtiden → payload.status = `"Oppstart"`.
- Startdato i dag, ingen sluttdato → payload.status = `"Aktiv"`.

## Utenfor scope
- Ingen bakgrunnsjobb som rydder opp gamle oppdrag som har passert sluttdato uten å bli redigert — derivasjonen i listevisningen håndterer fortsatt visningen (via `computeOppdragStatus` som nå også sjekker `slutt_dato`). Ekte DB-status oppdateres først ved neste lagring av oppdraget.
- Ingen endring i `forny_dato`-feltet eller "Løpende 30 dager"-checkboxen.
- Ingen endring i "Avslutt oppdrag"-knappen — den fortsetter å sette `slutt_dato = i dag` + `status = "Inaktiv"` umiddelbart.
- V1-flater (`StacqPrisen.tsx` m.fl.) får ingen funksjonsendringer utover at `computeOppdragStatus` nå er delt.

