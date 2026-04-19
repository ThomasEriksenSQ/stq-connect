
## Mål
På `/design-lab/aktive-oppdrag`:
1. Match radhøyde og header-høyde mellom venstre tabell og høyre tidslinje.
2. Flytt månedsoppsummeringen (`Apr: 3 fornyelser …`) ut av tidslinje-kortet og under hele tabell-/tidslinje-arealet.
3. Gjør den blå "aktiv måned"-bakgrunnen kontinuerlig nedover hele kolonnen (alle rader + tomme områder), ikke bare på rader med pille.
4. Gi konsulent-kolonnen i tidslinjen en `KONSULENT`-header, og match font + avatar-stil 1:1 med venstre tabell.

## Funn
- Venstre tabell (`KonsulenterOppdrag.tsx`): header `py-2.5`, rad `min-h-[38px] py-1`, navn `text-[0.8125rem] font-medium`, avatar `w-6 h-6` med initialer `text-[0.625rem]`.
- Tidslinje (`FornyelsesTimeline.tsx`): header `py-1` (lavere), rad `min-h-[38px]`, navn `text-[0.8125rem] font-semibold` (feil vekt), avatar-initialer `text-[0.5625rem]` (feil), første kolonne har ingen tittel.
- Aktiv-måned-bakgrunn (`bg-primary/[0.03]`) settes per celle inni hver rad → vises kun der det er rader, ikke som én sammenhengende vertikal stripe.
- Summary er inni `border-t` av tidslinje-kortet (`FornyelsesTimeline.tsx`).

## Plan

### 1. `src/components/FornyelsesTimeline.tsx`
- Header: bytt `py-1` → `py-2.5` for å matche venstre tabell.
- Konsulent-kolonne (header): erstatt tom `w-[190px]`-div med samme uppercase-label som de andre månedene:
  ```tsx
  <div className="w-[190px] shrink-0 px-3 py-2.5 sticky left-0 z-30 bg-background text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
    Konsulent
  </div>
  ```
- Rad: behold `min-h-[38px]`, men bytt navnet `font-semibold` → `font-medium` for å matche venstre.
- Avatar-initialer: bytt `text-[0.5625rem]` → `text-[0.625rem]` (begge to steder: ansatt + ekstern).
- Fjern hele `monthlySummary`-blokken fra bunnen av komponenten (vi flytter den ut). Returner `monthlySummary` som del av komponentens API ikke behov — vi flytter logikken til parent i stedet.
- For den blå aktiv-måned-bakgrunnen: I stedet for å sette `bg-primary/[0.03]` på hver celle, legg til ett absolutt-posisjonert overlay som dekker hele aktiv-månedens kolonne fra top til bunn:
  - Wrap `min-w-[900px]`-div med `relative`.
  - Beregn aktiv måneds offset: konsulent-kolonne er 190px, hver måned er `flex-1 min-w-[56px]` (12 like store kolonner i resten). Bruk en CSS-grid eller absolutt overlay som matcher aktiv kolonne.
  - Enklere løsning: behold `flex` for header og rader, og rendere et absolutt overlay `<div>` etter/før innhold med `style={{ left: 'calc(190px + (100% - 190px) * 3/12)', width: 'calc((100% - 190px) / 12)', top: 0, bottom: 0, background: 'rgba(94,106,210,0.05)', pointerEvents: 'none' }}` og fjern per-celle `bg-primary/[0.03]`.
  - Behold den tynne `h-[2px] bg-primary` indikatoren under aktiv måneds header som i dag.

### 2. `src/pages/KonsulenterOppdrag.tsx` (kun `embeddedSplit`-grenen, ~linje 392–546)
- Eksporter `monthlySummary`-data fra `FornyelsesTimeline` (eller dupliser beregningen i parent — enklere: dupliser, siden `enriched` er tilgjengelig i parent).
- Wrap hele `<ResizablePanelGroup>` i et `<div>`. Etter gruppen, legg til en bunntekst som spenner over begge paneler:
  ```tsx
  <div className="px-4 py-2 border-t border-border bg-background mt-2 rounded-b-lg">
    <p className="text-[0.75rem] text-muted-foreground">
      {monthlySummary.map(...)}
    </p>
  </div>
  ```
- Fjern egen border-t-summary fra tidslinje-kortet (gjort i steg 1).

### 3. Ikke rør
- V1-flate `/konsulenter/i-oppdrag` bruker samme komponenter, men `embeddedSplit=false`. Endringene i `FornyelsesTimeline` (header-padding, navnvekt, avatar-tekstr, overlay-tilnærming) påvirker også V1-tidslinjen — det er en kosmetisk forbedring som er konsistent og ufarlig. Summary-flytting gjøres kun i V2 (parent-grenen `embeddedSplit`); V1 beholder summary-en i bunnen av tidslinje-kortet (eller vi fjerner den der også for konsistens — anbefalt: fjern fra `FornyelsesTimeline` helt, og legg til samme bunnlinje i V1-kallet på linje 276 hvis nødvendig).

Beslutning: fjern summary fra `FornyelsesTimeline` helt, og legg den til i parent både for V1 (`!embeddedSplit`) og V2 — gir én kilde til sannhet.

## Effekt
- Header og rader er pixel-like høye på venstre og høyre side.
- Konsulent-kolonnen får tittel "KONSULENT" i samme font/farge som "KUNDE" osv.
- Navne-vekt og avatar-størrelser matcher venstre tabell eksakt.
- Aktiv måned (april) får en sammenhengende, lys lavendel vertikal stripe gjennom hele tabellhøyden, inkl. tomme rader.
- Månedsoppsummeringen ligger i en egen rad under hele split-en, visuelt knyttet til begge paneler.

## Utenfor scope
- Endring av kolonnebredder, sortering, filterlogikk, eller fargelogikk for forny-pillene.
- Endring av V1-flatens layout utover summary-flytting.
