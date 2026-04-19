

## Funn

I `src/lib/followUpViewModel.ts` mapper `SIGNAL_TO_PRIORITY` i dag både "Ukjent om behov" og "Ikke aktuelt" til **P4**. Det betyr at "død" lead og "vet ikke ennå" får samme visuelle vekt — uheldig når man scanner listen.

I `src/pages/DesignLabOppfolginger.tsx` (linje 56–81) defineres farger/stiler kun for P1–P4. P4 er nøytral grå.

## Plan

Innfør **P5** dedikert til "Ikke aktuelt", slik at det skiller seg visuelt fra P4 ("Ukjent om behov"). Alt annet beholdes uendret.

### Endring 1 — `src/lib/followUpViewModel.ts`

- Utvid `FollowUpPriority`-typen: `"P1" | "P2" | "P3" | "P4" | "P5" | null`
- Endre `SIGNAL_TO_PRIORITY`:
  - `"Ikke aktuelt"` → `"P5"` (i stedet for P4)
  - "Ukjent om behov" forblir P4
- Legg til `P5: 5` i `PRIORITY_RANK` slik at sortering plasserer P5 etter P4

### Endring 2 — `src/pages/DesignLabOppfolginger.tsx`

- Legg til P5-stil i prioritets-fargekartet (rundt linje 56–81). Forslag: enda mer dempet/utvasket enn P4 — f.eks. lys rød-grå tone som signaliserer "lukket/ikke aktuelt" uten å rope. Konkret: bakgrunn `#F1E9E9`, tekst `#8C7A7A`, border `#E5D8D8` (i tråd med V8 desaturert palett).
- Sørg for at badge-renderingen håndterer "P5" på samme måte som de andre nivåene.

### Resultat

| Salgssignal | Prioritet (før) | Prioritet (etter) |
|---|---|---|
| Behov nå | P1 | P1 |
| Får fremtidig behov | P2 | P2 |
| Får kanskje behov | P3 | P3 |
| Ukjent om behov | P4 | P4 |
| Ikke aktuelt | P4 | **P5** |

Sortering: P1 → P2 → P3 → P4 → P5 → uten prioritet. "Ikke aktuelt"-rader synker dermed lenger ned i listen, som ønsket.

## Utenfor scope

- Ingen endringer i V1-flater (Tasks, Dashboard).
- Ingen endring av selve signal-kategoriene eller `categoryUtils.ts`.
- Ingen manuell overstyring av prioritet — fortsatt drevet av kontaktens signal.

