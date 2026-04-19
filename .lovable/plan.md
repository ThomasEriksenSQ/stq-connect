
## Mål
1. Aktivere ⌘K-søk på `/design-lab/eksterne` (Eksterne) på samme måte som Kontakter og Selskaper.
2. Erstatte teksten "Velg en ekstern konsulent for å vise profil." med "Trykk ⌘K for å søke." når ingen ekstern konsulent er valgt — kun i V2 (`embeddedSplit`).

## Funn
- `DesignLabEksterneKonsulenter.tsx` er bare en tynn wrapper rundt `EksterneKonsulenter` med `embeddedSplit`-flagget.
- `EksterneKonsulenter.tsx` brukes både i V1 (`/eksterne`) og V2 — derfor må `embeddedSplit` brukes som gate for V2-spesifikke endringer (⌘K + ny tekst).
- V2 split ligger på linje 239–322. Empty-state på linje 312–317 viser dagens tekst.
- `CommandPalette` (delt komponent) er bygget for kontakter + selskaper-kategorier. Den passer ikke for eksterne konsulenter direkte (den har ingen "Eksterne"-seksjon, og `onSelectContact`/`onSelectCompany`-API-et matcher ikke). Vi trenger en lokal palette for Eksterne.

## Plan

### 1. Erstatt empty-state-tekst (V2 only)
I `src/pages/EksterneKonsulenter.tsx` (linje 312–317), når `embeddedSplit === true`:
- Bytt "Velg en ekstern konsulent for å vise profil." → "Trykk ⌘K for å søke."
- Match Kontakter/Selskaper-stilen: `fontSize: 13, color: C.textFaint`, sentrert i `flex h-full items-center justify-center`.
- Importer `C` fra `@/components/designlab/theme`.
- V1-versjonen (ikke `embeddedSplit`) berøres ikke.

### 2. Legg til ⌘K-palette for Eksterne
I `EksterneKonsulenter.tsx` (kun aktiv når `embeddedSplit === true`):
- Tilstand: `const [cmdOpen, setCmdOpen] = useState(false);` og `const [textSize] = usePersistentState<TextSize>("dl-text-size", "M");` — samme nøkkel som resten av Design Lab.
- Globalt keyboard-listener via `useEffect`: `Cmd/Ctrl + K` → `setCmdOpen(true)` (kun hvis `embeddedSplit`).
- Render en lett, lokalt definert command-palette (etter mønster fra `CommandPalette.tsx`) med én seksjon "Eksterne konsulenter":
  - Items bygges fra `filtered` (eller hele `data`-listen, ufiltrert, så ⌘K alltid søker bredt).
  - Match query mot `navn`, `companies?.name`, og `teknologier`-array.
  - Velg item → `setSelectedId(row.id)` + `setCmdOpen(false)`.
  - Pil opp/ned + Enter + Esc, samme oppførsel som eksisterende palette.
  - Wrap roten med `style={{ ...getDesignLabTextSizeStyle(textSize) }}` og portal via `createPortal` til `document.body`.
  - Stil identisk med eksisterende palette (44px input-rad, 560px bred, 18vh top, samme farger og border).

Begrunnelse for lokal palette i stedet for å gjenbruke `CommandPalette`:
- Gjenbruk ville krevd å utvide den delte komponenten med en tredje "eksterne"-seksjon, ny callback (`onSelectExternal`) og endring av types — bredere blast radius. En liten lokal palette på ~80 linjer holder endringen isolert til Eksterne-flaten.

### 3. Ikke rør V1
- Alle endringer gates på `embeddedSplit`. V1-ruten `/eksterne` får verken nytt empty-state-språk eller ⌘K-binding.

## Effekt
- På `/design-lab/eksterne`: ⌘K åpner søk over alle eksterne konsulenter (navn / selskap / teknologier). Valg fyller høyre panel.
- Empty state matcher Kontakter og Selskaper visuelt og språkmessig.
- V1 (`/eksterne`) er uberørt.

## Utenfor scope
- Endring av delt `CommandPalette`-komponent.
- Andre Design Lab-flater (Forespørsler, Oppfølginger, Ansatte).
- Endring av V1 Eksterne.
