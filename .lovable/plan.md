
## Funn

I `src/pages/DesignLabStacqPrisen.tsx` (linje 167–173) beregnes `workdayCount` slik:

```ts
for (let d = 1; d <= dim; d++) {
  const dow = new Date(y, m, d).getDay();
  if (dow !== 0 && dow !== 6) wd++;
}
```

Den teller alle mandag–fredag, men trekker **ikke fra norske røde dager**. På topp-stat-kortet "STACQ Prisen / mnd" vises tallet som `${workdayCount} arbeidsdager · ${måned}`, og brukes også til å multiplisere månedsomsetningen (`monthlyTotal = stacqTotalPerTime * 7.5 * workdayCount`). Det betyr at både visningen og månedstotalen blir for høy i måneder med helligdager (f.eks. mai med 1. mai, 17. mai, Kr.h.farts, 2. pinsedag).

## Plan

Legg til en delt hjelpefunksjon for norske helligdager og bruk den til å trekke fra røde dager (mandag–fredag) i `workdayCount`-beregningen.

### 1) Ny fil: `src/lib/norwegianHolidays.ts`

Eksporter to funksjoner:

- `getNorwegianHolidays(year: number): Date[]` — returnerer alle norske offentlige fridager for året:
  - Faste: 1. jan (Nyttårsdag), 1. mai (Off. høytidsdag), 17. mai (Grunnlovsdagen), 25. des (1. juledag), 26. des (2. juledag).
  - Bevegelige (utledet fra påskedag via Anonymous Gregorian-algoritmen):
    - Skjærtorsdag (påske − 3)
    - Langfredag (påske − 2)
    - 2. påskedag (påske + 1)
    - Kristi himmelfartsdag (påske + 39)
    - 1. pinsedag (påske + 49)
    - 2. pinsedag (påske + 50)
- `countNorwegianWorkdays(year: number, month: number): number` — returnerer antall mandag–fredag i måneden minus røde dager som faller på en hverdag.

### 2) Bruk funksjonen i `DesignLabStacqPrisen.tsx`

- Erstatt den lokale løkken (linje 167–173) med:
  ```ts
  const workdayCount = countNorwegianWorkdays(now.getFullYear(), now.getMonth());
  ```
- `monthlyTotal` og kortets undertekst (`${workdayCount} arbeidsdager · …`) får automatisk korrekt verdi.

### 3) Test: `src/test/norwegianHolidays.test.ts`

Korte vitest-caser for å sikre korrekthet:
- Påskedag 2025 = 20. april, 2026 = 5. april (verifiser bevegelige datoer).
- Mai 2025: 22 hverdager − 4 røde (1. mai tor, 17. mai lør → ikke trekkes, Kr.h.farts 29. mai, 1. pinsedag fredag 2026? bekreft per år) → forventet verdi.
- April 2026 inneholder skjærtorsdag, langfredag, 2. påskedag → trekkes fra.

## Hvorfor trygt

- Ren, isolert utvidelse i `src/lib/` + ett kall i én fil.
- Ingen DB-endringer, ingen API-kall, ingen avhengigheter.
- Påvirker kun visningen av "arbeidsdager" og månedstotal på STACQ Prisen — samme tall som allerede vises i dag, bare korrekt.

## Utenfor scope

- Ingen brukervalgt periode/justering — alltid inneværende måned, som i dag.
- Ingen halve dager (f.eks. onsdag før skjærtorsdag) — telles som hel arbeidsdag.
- Ingen V1-side berøres.
