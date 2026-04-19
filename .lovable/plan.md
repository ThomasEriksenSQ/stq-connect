

## Vurdering

Vi fjernet "Legg til alle"-snarveien da vi gjorde chips klikkbare individuelt — men når AI foreslår 4–5 tags og brukeren vil ha alle, blir 4–5 separate klikk unødvendig friksjon. Riktig løsning: behold individuell chip-klikking som primærmønster, men tilby "Oppdater alle" som sekundær snarvei foran "Ignorer". Brukeren får da begge ytterpunktene dekket.

## Plan

### `src/components/AiSignalBanner.tsx`

I action-raden (linje ~190–212), legg inn en "Oppdater alle"-knapp mellom "Oppdater signal" og "Ignorer". Vises bare når `remainingTechs.length > 0`.

Onclick:
- Kall `onAddTechnologies(remainingTechs)` med alle gjenværende tags i én batch
- Oppdater `addedTechs`-settet med alle tags slik at chips forsvinner umiddelbart

Stil matcher eksisterende sekundærknapper i banneret: `inline-flex items-center gap-1 text-[0.75rem] font-medium text-primary hover:text-primary/80 transition-colors` (samme som "Oppdater signal"). Ikon: `Plus` (h-3 w-3) for å signalisere bulk-tillegging.

Rekkefølge i action-rad: `[Oppdater signal] [Oppdater alle] [Ignorer]`.

## Filer som endres
- `src/components/AiSignalBanner.tsx` — legg til "Oppdater alle"-knapp i action-raden, conditional på `remainingTechs.length > 0`.

## Utenfor scope
- Endre individuell chip-interaksjon (beholdes).
- Andre call sites/varianter av banneret.

