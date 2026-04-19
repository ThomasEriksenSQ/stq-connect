

## Mål
Heve tekststørrelse-velgeren i sidebar fra "funksjonell" til "proft Linear-nivå". Bedre spacing, tydeligere visuell hierarki, ryddigere proporsjoner, og en aktiv tilstand som faktisk leser som "valgt" — ikke bare som en svak ramme.

## Funn (nåværende tilstand)
Fra skjermbilde + kode (`TextSizeControl.tsx` linjer 73–108):
- T-ikon ligger flush mot venstre kant uten visuell vekt — ser løsrevet ut.
- Pillene har samme størrelse (~22px), tett pakket med `gap-0.5` (2px). Ingen luft mellom dem, og hver pille har rektangulær preg fordi `paddingInline: 4` + minWidth 22 + fontSize 11 gir nesten kvadratiske bokser.
- Aktiv pille (XXL i bildet) har en lilla-aktig ramme via `DesignLabFilterButton`'s `active`-stil — men i sidebar-konteksten leser det som "outline", ikke som "valgt".
- Hele raden er presset inn i `paddingInline: 10/8` med `height: 28` — gir lite pust over/under ikon vs pille-høyde.
- Footer-streken ligger umiddelbart under, så raden henger oppå den uten margin.

## Designvalg

**Layout — segmentert kontroll i stedet for fritt-stående pills**
Bygg om pill-raden til en **segmented control** i Linear-stil:
- Én sammenhengende container med subtil `C.surfaceAlt`-bakgrunn (`#F3F3F4`) og 1px `C.borderLight`-ramme, radius 6px.
- Segmentene inni har **ingen egen ramme** — kun aktiv segment får hvit `C.panel`-bakgrunn + en mikro-skygge (`0 1px 2px rgba(0,0,0,0.04)`) som "løfter" det.
- Inaktive segmenter er transparente; hover gir `C.hoverBg`.
- Dette er det samme mønsteret Linear, Vercel og Raycast bruker for size/density-velgere — det leser umiddelbart som "ett valg ut av flere".

**Proporsjoner**
- Container-høyde: 24px (kompakt, matcher Linears tetthet).
- Segment-bredde: `minWidth: 26px`, `paddingInline: 6px` — gir litt mer pust enn dagens 22/4.
- Segment-radius: 4px (1px mindre enn container 5px → "innfelt"-effekt).
- Font: 11px / vekt 500 aktiv, vekt 400 inaktiv. Aktiv farge `C.text`, inaktiv `C.textMuted`, hover `C.text`.

**T-ikon**
- Behold `Type` fra lucide, men:
  - Reduser til `size={12}` (matcher 11px font).
  - `strokeWidth={1.75}` (litt mer vekt — ikonet skal lese som label, ikke pynt).
  - Farge `C.textFaint`.
  - Gi det `aria-hidden` og `title="Tekststørrelse"` på wrapper-`<button>`-gruppen for tilgjengelighet.

**Spacing**
- Rad-padding: `paddingInline: px(10)` (matcher nav-rader nøyaktig — visuelt linjert med navn på menypunkter over).
- Rad-høyde: 32px (4px mer enn dagens 28 — gir luft rundt 24px-segmentet).
- Gap mellom T-ikon og segmented control: `gap: px(10)` (ikke `justify-between` — det presser kontrollen ut til høyre kant og bryter rytmen mot footer-knappene under). I stedet: T-ikon venstre, kontroll høyrejustert via `marginLeft: auto` på kontroll-containeren. Dette gir kontrollerbar luft hvis sidebar-bredden endrer seg.
- `paddingBottom: px(10)` på wrapper-divet (mot streken under) — luftigere enn dagens 8.

**Mikro-detaljer**
- Transitions: `background-color 120ms ease, color 120ms ease` på segmenter.
- Aktiv segment-skygge: `0 1px 2px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)` — knapt synlig, men gir den "løftede" følelsen.
- Ingen focus-ring på enkeltsegmenter (de sitter i en gruppe); behold focus-visible kun via tab på hver knapp med `outline: 2px solid C.borderFocus, outline-offset: 1px`.

## ASCII-skisse

```text
sidebar (220px)
┌────────────────────────────────────────┐
│ ...nav...                              │
│                                        │
│  T      ┌──┬──┬──┬──┬───┐              │  ← 32px høyde, padding 10
│         │S │M │L │XL│XXL│              │     segmented control 24px
│         └──┴──┴──┴──┴───┘              │     aktiv = hvit + mikro-skygge
├────────────────────────────────────────┤  ← borderTop (footer)
│ ⚙  Innstillinger                       │
│ ↪  Logg ut                             │
└────────────────────────────────────────┘
```

## Plan

1. **Skriv om `TextSizeControlSidebar` i `src/components/designlab/TextSizeControl.tsx`:**
   - Bytt ut `DesignLabFilterButton`-pills med en intern segmented control (egen `<div>` med `<button>`-segmenter).
   - T-ikon venstre med faste dimensjoner og farge `C.textFaint`.
   - Container med `C.surfaceAlt`-bakgrunn + `C.borderLight`-ramme.
   - Aktivt segment: hvit bakgrunn, vekt 500, mikro-skygge.
   - Inaktivt: transparent, vekt 400, hover `C.hoverBg`.
   - Behold `value` + `onChange`-API uendret — kun visuell endring.

2. **Justér wrapper i `src/components/designlab/DesignLabSidebar.tsx`:**
   - Endre wrapper-divets padding fra `paddingInline: px(12), paddingBottom: px(8)` til `paddingInline: px(10), paddingBottom: px(10)` for å matche nav-rader og puste mot streken.
   - Ingen andre endringer i sidebar-strukturen.

3. **Behold uendret:**
   - Persistens (`"dl-text-size"`-nøkkel).
   - Synlighet kun i utvidet sidebar (skjult når kollapset).
   - Plassering over footer-streken.
   - Den eksisterende `TextSizeControl`-eksporten (header-varianten) — den brukes ikke lenger, men er ufarlig å beholde for nå.

## Filer som endres
- `src/components/designlab/TextSizeControl.tsx` — full omskriving av `TextSizeControlSidebar` til segmented control.
- `src/components/designlab/DesignLabSidebar.tsx` — minor padding-justering på wrapper.

## Utenfor scope
- Synlighet i kollapset modus.
- Endring av skala-verdier eller persistens.
- Endringer i header-varianten av `TextSizeControl`.

