

## Vurdering

I dag har sidebar-versjonen av tekststørrelse-kontrollen (`TextSizeControlSidebar`) en T-ikon til venstre + en segmentert kontroll høyrejustert med 5 knapper (S, M, L, XL, XXL) på ca 26px hver. Brukeren vil fjerne T-ikonet og la knappene fylle hele bredden av sidebar-innholdet.

Dette er riktig i Linear-stil: ikonet er dekorativt — knappenes bokstaver kommuniserer hva kontrollen er. Å fjerne T og strekke segmentene gir bedre touch-targets, ren symmetri, og full utnyttelse av sidebar-bredden uten å øke visuell vekt.

## Designprinsipper anvendt

- **Selvforklarende uten ikon**: S/M/L/XL/XXL er universelle størrelse-tegn — T-ikonet var redundant.
- **Lik bredde per segment**: `flex: 1` på hvert segment gir perfekt symmetri og forutsigbarhet (Linear-mønster).
- **Beholder eksisterende høyde, radius og farger**: ingen ny visuell vekt, bare bedre proporsjoner.
- **Beholder padding**: containeren beholder `paddingInline: px(10)` slik at kontrollen flukter med øvrige sidebar-elementer.

## Plan

### `src/components/designlab/TextSizeControl.tsx` — `TextSizeControlSidebar`

1. Fjern `<Type>`-ikonet og dets wrapper-gap.
2. Endre ytre wrapper: dropp `gap: 10`, behold `paddingInline: 10` og `height: 32`.
3. Endre segmentert kontroll-container:
   - `width: "100%"` (fyller sidebar-innholdet)
   - Fjern `marginLeft: "auto"` (ikke lenger nødvendig)
4. Endre hver segment-knapp:
   - `flex: 1` (lik bredde)
   - Fjern `minWidth: 26`
   - Behold høyde 20, radius 4, font 11, vekt og farge-logikk
5. Behold tooltip (`title`) på hver knapp — gir "Kompakt", "Standard" osv. ved hover siden ikonet fjernes.
6. Behold `aria-label="Tekststørrelse"` på gruppen for tilgjengelighet (erstatter ikon-konteksten).

Ingen endringer i `TextSizeControl` (header-varianten brukt i Stilark/StacqPrisen) — den beholder T-ikonet siden den ligger i en bredere header-kontekst.

## Filer som endres
- `src/components/designlab/TextSizeControl.tsx`

## Utenfor scope
- `TextSizeControl` (header-variant) — uendret
- Skala-logikk, presets eller persistens — uendret

