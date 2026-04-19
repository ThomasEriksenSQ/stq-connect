

## Funn

Bruker satte sluttdato fram i tid på et oppdrag som var `Inaktiv`, men status forblir `Inaktiv` etter lagring.

Roten ligger i `computeOppdragStatus` i `src/lib/oppdragForm.ts`:

```ts
if (input.status === "Inaktiv") return "Inaktiv";
```

Denne early-return ble lagt inn for å la "Avslutt oppdrag"-knappen være en hard manuell avslutning som ikke overstyres av datoer. Men nå brukes den samme funksjonen i `buildOppdragWritePayload` ved hver lagring — og siden `OppdragEditSheet` fortsatt sender med eksisterende `status: "Inaktiv"` fra raden, blir oppdraget låst som Inaktiv selv om brukeren forlenger sluttdatoen til fremtiden.

Med andre ord: så snart et oppdrag har blitt `Inaktiv` én gang, klarer det aldri å komme tilbake til `Aktiv` via redigering — selv ikke ved å sette en gyldig fremtidig sluttdato.

## Plan

### Endring i `src/lib/oppdragForm.ts`

Snu logikken slik at datoer er sannheten, og `Inaktiv` kun "vinner" når det ikke finnes datogrunnlag som tilsier noe annet:

```ts
export function computeOppdragStatus(input): OppdragStatus {
  const today = startOfDay(new Date());
  const slutt = parseOppdragDate(input.slutt_dato);
  const start = parseOppdragDate(input.start_dato);

  // Sluttdato passert → Inaktiv
  if (slutt && slutt < today) return "Inaktiv";

  // Startdato i fremtiden → Oppstart
  if (start && start > today) return "Oppstart";

  // Har gyldig dato-grunnlag for å være aktivt
  if (start || slutt) return "Aktiv";

  // Ingen datoer satt — respekter eksisterende manuell Inaktiv
  if (input.status === "Inaktiv") return "Inaktiv";

  return "Aktiv";
}
```

Dette gir:
- Forleng sluttdato til fremtiden på et `Inaktiv` oppdrag → blir `Aktiv` (eller `Oppstart` hvis startdato også flyttes fram).
- "Avslutt oppdrag"-knappen fungerer fortsatt — den setter `slutt_dato = i dag` + `status = "Inaktiv"`, og siden sluttdato er ≤ i dag returnerer funksjonen `Inaktiv`.
- Manuell `Inaktiv` uten datoer respekteres fortsatt.

### Test-oppdatering i `src/test/oppdragForm.test.ts`

Legg til ett nytt case:
- Reaktivering: `status: "Inaktiv"` + `slutt_dato` i fremtiden + `start_dato` i fortiden → payload.status = `"Aktiv"`.

Eksisterende tester forblir grønne (sjekket mot ny logikk: sluttdato i fortiden → Inaktiv; startdato i fremtiden → Oppstart; startdato i dag uten sluttdato → Aktiv).

## Utenfor scope
- Ingen UI-endring i `OppdragEditSheet.tsx`.
- Ingen endring i `terminateOppdrag` eller listevisningen.

