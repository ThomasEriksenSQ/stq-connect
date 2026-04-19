

## Vurdering

`DesignLabKonsulenterAnsatte.tsx` (Ansatte) er en ren V2-side bygget direkte mot `DesignLabSidebar` + V2-tokens, med:

- 40px header (`fontSize: 14`), tittel + telling, høyre side med søk + primær-knapp.
- Filterbar i egen rad med `DesignLabFilterRow` (label "STATUS" + V2 pill-knapper), avsluttet med en fin border-b.
- Edge-to-edge `ResizablePanelGroup` som fyller resten av høyden.
- Tabellheader: 32px høy, sticky, `background: C.surfaceAlt`, kolonneetiketter 11px/uppercase/`C.textMuted`.
- Rad: 38px min-høyde, `borderBottom: C.borderLight`, hover `C.hoverBg`, valgt `C.selected`.
- Detaljpanel: hvit `C.panel`, 32px lukk-rad øverst, deretter scrollbart innhold.

`DesignLabEksterneKonsulenter.tsx` (Eksterne) wrapper derimot den gamle V1-komponenten `EksterneKonsulenter` (med `embeddedSplit`) inni `DesignLabPageShell`. Det gir disse avvikene mot referansen (se skjermbildene):

| Element | Ansatte (riktig) | Eksterne (nå) |
|---|---|---|
| Filterbar | V2 pill-rad `DesignLabFilterRow` ("STATUS · Alle/Aktiv/...") | To V1-rader med `CHIP_BASE`/`CHIP_ON` ("Type" + "Status") |
| Layout under header | Edge-to-edge resizable split som fyller skjermen | Card-i-card inni shellets padding (`24px 24px 48px`) + fast `h-[820px]` |
| Tabellheader | 32px sticky wrapper, `C.surfaceAlt` fra kant til kant | `py-2.5` med `bg-background`, klemt inne i en kortramme |
| Tabellramme | Ingen ytre kort/border — tabellen møter sidebakgrunn | `border + rounded-lg + shadow-card` rundt hele tabellen |
| Radhøyde | 38px, `borderBottom: C.borderLight`, hover `C.hoverBg`, valgt `C.selected` | 38px med `divide-y divide-border` + `hover:bg-background/80`, valgt `bg-muted/60` |
| Søk | `DesignLabSearchInput` i header (220px) | Ikke synlig i embedded-modus (kun ⌘K) |
| Telling | `· N` i header | `· N` (kommer fra shell, OK) |

Resultatet er at "Eksterne" føles som en V1-tabell pakket inn i V2-chrome, mens "Ansatte" er ekte V2.

## Plan

Bygg om `src/pages/DesignLabEksterneKonsulenter.tsx` til en selvstendig V2-side etter samme mal som `DesignLabKonsulenterAnsatte.tsx`. Den gamle `EksterneKonsulenter`-komponenten (og dens `embeddedSplit`-grein) berøres ikke — V1-CRM-flaten består uendret.

### Fil som endres
- `src/pages/DesignLabEksterneKonsulenter.tsx` — full omskriving (~250 linjer).

### Filer som ikke endres
- `src/pages/EksterneKonsulenter.tsx` — V1 beholdes for `/stacq`-flaten.
- `DesignLabPageShell` — brukes ikke lenger på denne siden (samme grep som på Ansatte).
- `ExternalConsultantDetailCard` (linje 464–597 i V1-filen) — eksporteres fra V1-filen og gjenbrukes 1:1 i den nye V2-siden, slik at detaljpanelet forblir identisk.

### Ny struktur i `DesignLabEksterneKonsulenter.tsx`

1. **Skall**: `flex h-screen` med `DesignLabSidebar` + main, identisk med Ansatte.
2. **Header (40px)**: tittel "Eksterne" + `· {filtered.length}`, søk (`DesignLabSearchInput`, 220px), `Importer CVer` (`DesignLabSecondaryAction`), `Rydd dubletter` (`DesignLabSecondaryAction`), `Legg til` (`DesignLabPrimaryAction`).
3. **Filterbar**: én `DesignLabFilterRow` for TYPE (`Alle / Freelance / Via partner`) + én for STATUS (`Alle / Tilgjengelig / Ikke ledig`) i samme container med 8/24px padding og `border-b: C.border` — samme grep som Ansatte.
4. **Body**: `flex-1 min-h-0` + `ResizablePanelGroup` med `defaultSize={38}` / `defaultSize={62}` (samme som Forespørsler/Selskaper/Kontakter — låst inn i memory-regelen for tabellbredder).
5. **Listepanel**: scroll-container uten ytre kort. Sticky header-wrapper med `background: C.surfaceAlt` (32px, full bredde inkl. scroll-gutter — samme grep som vi nettopp innførte på Forespørsler/Selskaper/Kontakter). Kolonner: `Navn / Selskap / Type / Status / Teknologier / Tilgj. fra` (uendret innhold).
6. **Rader**: 38px min-høyde, `borderBottom: C.borderLight`, hover `C.hoverBg`, valgt `C.selected`. Bytter ut `DesignLabStaticTag` med eksisterende V2-tag-stiler (uendret).
7. **Detaljpanel**: gjenbruk `ExternalConsultantDetailCard` i hvit `C.panel`-container med 32px lukk-rad — identisk med Ansatte.
8. **Modal/cleanup-bekreftelse**: flyttes opp i den nye filen (`ConsultantModal` re-eksporteres fra V1-filen).
9. **⌘K-palett**: `ExternalCommandPalette` re-eksporteres fra V1-filen og bevares.

### Eksport-justering i `EksterneKonsulenter.tsx`
For å gjenbruke uten duplisering: legg til `export` foran funksjonene `ExternalConsultantDetailCard`, `ConsultantModal` og `ExternalCommandPalette`. Ingen logikk endres — kun synlighet.

## Hvorfor lav-risk

- Endringen er isolert til én ny fil + tre `export`-nøkkelord i V1-filen.
- All datalogikk (queries, filtre, cleanup, modal, ⌘K) gjenbrukes uendret.
- V1-flaten `/stacq/eksterne-konsulenter` blir ikke berørt.
- Tabellbreddene (38/62) holder seg konsistente med de andre V2-flatene (memory-regelen).
- Detaljpanelets innhold er bit-for-bit det samme som før.

## Utenfor scope

- V1-versjonen av `EksterneKonsulenter` (uendret).
- Detaljkortets innhold (`ExternalConsultantDetailCard`).
- Modal for opprett/rediger og cleanup-dialog.
- Andre Design Lab-sider.

