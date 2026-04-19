
## Mål
Bruke samme V2 right-side sheet-design som "Ny forespørsel" på "Nytt selskap" og "Ny kontakt"-modalene under `/design-lab/selskaper`. Disse skal se velpolerte ut og skalere med tekststørrelse-kontrollen.

## Funn
"Ny forespørsel" (skjermbildet) bruker allerede et right-side sheet med riktig V2-uttrykk:
- Tittel "Ny forespørsel" øverst (18–20px / 600), X-knapp øverst til høyre
- Seksjonslabels i `MOTTATT`, `SELSKAP *` osv. — uppercase 11px muted
- Felter med blå fokus-ring (`C.accent`), 32px høyde
- Chip-rad for teknologier (h-7, lys border)
- Footer med horisontal divider, "Avbryt" til venstre (ghost) og "Opprett forespørsel" til høyre (primary disabled-stil)

"Nytt selskap" og "Ny kontakt" i dag (`DesignLabCompanies.tsx` linje 666–844 og `CompanyCardContent.tsx` linje 1110–1277):
- Bruker samme `DesignLabEntitySheet`-shell, men innholdet er feil dimensjonert
- Tittel er V1-stil (`text-[1.125rem] font-bold text-foreground`) — ikke V2
- Knapper plassert med `DesignLabModalActions` uten footer-divider
- Uppercase labels mangler — bruker `DesignLabFieldLabel` som ikke er uppercase
- Ingen tekststørrelse-skalering på chrome (sheet-bredde er fast)

## Plan

### 1. Standardisere shell-strukturen (matche "Ny forespørsel")
Begge modaler beholder `DesignLabEntitySheet` (920px right-side), men får ny intern struktur:

```
┌─ Sheet content ───────────────────────────────────┐
│ Header: tittel (19px / 600) ……………………… [X]        │  ← px-6 py-5, no border
├──────────────────────────────────────────────────-┤
│ Body: scrollbar form (px-6 py-5)                  │
│   MOTTATT                                         │
│   [input]                                         │
│   SELSKAP *                                       │
│   [input]                                         │
│   …                                               │
├──────────────────────────────────────────────────-┤  ← border-t C.borderLight
│ Footer: Avbryt ……………………… Opprett selskap        │  ← px-6 py-4
└──────────────────────────────────────────────────-┘
```

### 2. Lage gjenbrukbare bygge-blokker i `DesignLabEntitySheet.tsx`
For å unngå duplisering legges det til tre eksporter:
- `DesignLabEntitySheetHeader` — tittel + X-knapp (X kobles til `Sheet`s lukke-mekanikk)
- `DesignLabEntitySheetBody` — scrollbar `flex-1` med `px-6 py-5`, `dl-v8-theme`
- `DesignLabEntitySheetFooter` — `border-t`, `px-6 py-4`, justify-between flex med Avbryt (ghost) til venstre og primær til høyre

Disse leser `useDesignLabModalScale()` slik at padding/font/knappehøyde skalerer med tekststørrelse-kontrollen — likt som "Ny forespørsel"-skalering.

### 3. Erstatte felt-komponenter med uppercase-label varianter
Bytte fra `DesignLabFieldLabel` (bare 11px medium) til den uppercase-stilen som brukes i "Ny forespørsel": 11px / 600 / `letter-spacing 0.06em` / `text-transform: uppercase` / `color C.textFaint`. Røde `*` for påkrevde felter.

Legge til en liten variant i `system/fields.tsx`:
- `DesignLabSectionLabel` — uppercase variant med valgfri `required`-prop

### 4. "Nytt selskap"-modalen (`DesignLabCompanies.tsx` linje 666–844)
Felter beholdes identisk funksjonelt, men struktureres slik:
1. **SELSKAPSNAVN \*** — `DesignLabModalInput`
2. **ORGANISASJONSNUMMER** — `BrregSearch` (auto-fyller selskapsnavn)
3. **GEOGRAFISK STED** — input + chip-rad med eksisterende steder + "Legg til sted"
4. **NETTSIDE** + **LINKEDIN** — to-kolonne grid (`DesignLabFieldGrid`)
5. **TYPE** + **EIER** — to-kolonne grid med select-felter
6. **KOMMENTAR** — `Textarea` (samme styling som "Ny forespørsel")

Footer: `Avbryt` (ghost) | `Opprett selskap` (primary).

### 5. "Ny kontakt"-modalen (`CompanyCardContent.tsx` linje 1110–1277)
Samme shell-mønster:
1. **FORNAVN \*** + **ETTERNAVN \*** — to-kolonne
2. **TITTEL/STILLING** — full bredde
3. **E-POST** + **TELEFON** — to-kolonne
4. **AVDELING** + **GEOGRAFISK STED** — to-kolonne
5. **EIER** — full bredde select
6. **KOMMENTAR** — `Textarea`

Footer: `Avbryt` (ghost) | `Opprett kontakt` (primary).

### 6. Tekststørrelse-skalering
Alle paddings og fontstørrelser hektes til CSS-variablene fra `useDesignLabModalScale` (`--dl-modal-font-size`, `--dl-modal-control-height`, `--dl-modal-row-gap`, `--dl-modal-body-padding-x`, `--dl-modal-body-padding-bottom`). Når brukeren bytter S/M/L/XL/XXL skaleres feltene proporsjonalt — likt med eksisterende "Ny forespørsel".

### 7. Liten utvidelse på `BrregSearch`
Wrapper styling tilpasses slik at input-feltet matcher V2-tokens (32px høyde, `C.border`, `C.accent` på fokus). Hvis det er trivielt; ellers wrappes komponenten i en container som overstyrer via CSS-variabler.

## Filer som endres
1. `src/components/designlab/DesignLabEntitySheet.tsx` — legge til `Header`/`Body`/`Footer`-bygge-blokker.
2. `src/components/designlab/system/fields.tsx` — legge til `DesignLabSectionLabel` (uppercase variant).
3. `src/pages/DesignLabCompanies.tsx` — refaktorere "Nytt selskap"-modalen til ny struktur.
4. `src/components/CompanyCardContent.tsx` — refaktorere "Ny kontakt"-modalen til ny struktur.

## Effekt
- Begge modaler ser identiske ut med "Ny forespørsel": tittel-rad, uppercase seksjonslabels, V2 inputs, footer med divider og høyrejustert primær-knapp.
- Skalerer korrekt med tekststørrelse-kontrollen.
- Form-funksjonalitet (BRREG-oppslag, geografiske steder, validering, mutations) er uendret.

## Utenfor scope
- Endre selve "Ny forespørsel"-modalen (den er allerede slik vi vil ha det).
- Endre V1-versjonene i `Companies.tsx`/`ContactCardContent.tsx`.
- Endre BRREG-oppslag-logikk eller mutation-flyt.
