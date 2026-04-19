

## Plan: Balanser kolonnene i matches-tabellen

### Diagnose

På `/design-lab/kontakter` med en konsulent valgt brukes dette gridet både i header (linje 2085) og rader (linje 2158):

```
minmax(220px,2fr) minmax(140px,1.2fr) minmax(120px,1fr) 110px 110px 96px
```

På 4245px viewport får panelet ca 1530px bredde. Da fordeles det slik:
- **Lead** ~520px (alt for bredt — navn som "Tom Erik Lundesgaard" fyller ca 180px, resten blir tomt)
- **Selskap** ~310px (mer enn nødvendig)
- **Kilde** ~260px (mer enn nødvendig)
- **Match / Varme** 110/110px (for trange — "Match 8/10" + farget prikk + "Høy evidens" presses)
- **Sist** 96px helt til høyre

Resultatet i skjermbildet: store hull etter Lead-navnet, mens Match-/Varme-overskriftene og pillene står klemt mot venstre i kolonnene sine — visuelt ubalansert.

### Endring (kun gridTemplateColumns, to steder i `src/pages/DesignLabContacts.tsx`)

Bytt til en mer balansert fordeling som følger V2 ultrawide-regelen (metadata = fast bredde, tekst-kolonner = fleksibel):

```
minmax(220px,1.6fr) minmax(140px,1fr) minmax(140px,1fr) 140px 120px 110px
```

Hva endringen gjør:

| Kolonne | Før | Etter | Hvorfor |
|---|---|---|---|
| Lead | 2fr | 1.6fr | Mindre dødplass etter navn |
| Selskap | 1.2fr | 1fr | Likestilles med Kilde |
| Kilde | 1fr | 1fr | Uendret andel, men min økt til 140px så "Finn · S…" ikke trunkeres unødvendig |
| Match | 110px | 140px | Plass til "● Match 8/10" + "Høy evidens" uten klem |
| Varme | 110px | 120px | "Mulig"/"Lovende" får luft |
| Sist | 96px | 110px | "19 mnd siden" får plass uten å skrumpe |

Totalt fast pluss min: 220+140+140+140+120+110 = 870px min. Resten (ca 660px på 4245px-skjerm) deles likt mellom Lead (1.6fr) og Selskap+Kilde (1fr+1fr) → Lead ~330px ekstra, Selskap/Kilde ~165px hver. Det gir et harmonisk forhold der ingen kolonne er overdimensjonert.

### Filer som endres

- `src/pages/DesignLabContacts.tsx`
  - linje 2085 (header grid)
  - linje 2158 (rad grid)

Begge må holdes identiske ellers blir headere og data ikke linjert.

### Ikke endret

- Headerstil (font, casing, sortering) — uendret fra forrige iterasjon
- Radhøyde 48px — uendret
- Tekstinnhold og truncate-regler — uendret
- Kontakt-tabellens grid (linje 2258/2290) — uendret

