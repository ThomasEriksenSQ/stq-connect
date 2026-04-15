

# Plan: Oppdater kontakttabellen i Design Lab til å matche V1-kolonnestruktur

## Mål
Endre kolonnerekkefølge og innhold i kontakttabellen på `/design-lab/kontakter` slik at den matcher referansebildet (V1), men med V2-styling.

## Kolonner (ny rekkefølge)

| # | Header | Innhold | Bredde |
|---|--------|---------|--------|
| 1 | NAVN | Fornavn + etternavn | `minmax(160px, 2fr)` |
| 2 | SIGNAL | SignalChip (som nå) | `130px` |
| 3 | FINN | Wifi-ikon (((•))) hvis `hasMarkedsradar` | `50px` |
| 4 | SELSKAP | Selskapsnavn | `minmax(120px, 1.5fr)` |
| 5 | STILLING | Stillingstittel | `minmax(100px, 1fr)` |
| 6 | TAGS | CV + Innkjøper pills side om side | `120px` |
| 7 | SISTE AKT. | Relativ tid, høyrejustert | `80px` |

## Endringer i `src/pages/DesignLabContacts.tsx`

1. **Fjern Varme-kolonnen** fra header og rader (HeatBadge fjernes fra tabellen)
2. **Legg til FINN-kolonnen** — viser et lite wifi/signal-ikon med `C.textFaint` farge når `hasMarkedsradar === true`, ellers tom
3. **Legg til TAGS-kolonnen** — viser kompakte pills for CV (blå, bruker `C.toggleCv`) og Innkjøper (lilla, bruker `C.toggleBuyer`) med V2-styling: 11px tekst, border-radius 3px, tynne pills
4. **Endre kolonnerekkefølge** til NAVN → SIGNAL → FINN → SELSKAP → STILLING → TAGS → SISTE AKT.
5. **Oppdater `gridTemplateColumns`** i både header og rader
6. **Legg tilbake `Wifi` import** fra lucide-react
7. **Fjern `heat`-sortering** som standard, sett default sort til `signal`
8. **Oppdater `SortField` type** — fjern `heat`, legg til evt. nye felt

## Visuell stil for TAGS (V2)
- CV-pill: `background: C.toggleCv.activeBg`, `color: C.toggleCv.activeText`, `fontSize: 11`, `padding: 1px 6px`, `borderRadius: 3`
- Innkjøper-pill: `background: C.toggleBuyer.activeBg`, `color: C.toggleBuyer.activeText`, samme sizing
- Vises kun når aktiv (cv_email/call_list er true)

