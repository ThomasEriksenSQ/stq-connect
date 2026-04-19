
## Mål
Justere tekststørrelse-skalaen i Design Lab opp ett hakk, og sikre at alle V2-flater faktisk responderer på valget (ikke bare de som allerede gjør det i dag).

## Funn
Nåværende skala i `src/components/designlab/TextSizeControl.tsx`:
- S = 0.9 (Kompakt)
- M = 1.0 (Standard) ← basis 13px
- L = 1.1
- XL = 1.2
- XXL = 1.32

Implementasjonen bruker to mekanismer:
1. **CSS-variabler** (`--dl-text-xs/sm/md/lg/xl`) via `getDesignLabTextSizeVars()` — krever at komponenter faktisk leser variablene.
2. **`zoom: <scale>`** via `getDesignLabTextSizeStyle()` — global skalering av alt innhold (tekst + spacing + ikoner).

`zoom`-tilnærmingen er den som faktisk virker overalt (siden den skalerer hele subtreet), men brukes bare på flater som eksplisitt har wrapper med `getDesignLabTextSizeStyle()`. Andre flater bruker bare CSS-variabler — og hardkodede `fontSize: 13` (svært vanlig i Design Lab-koden) ignorerer disse.

## Forslag til ny skala
Hev hele skalaen ett hakk så M føles som dagens L, og maks-nivået blir tydelig stort uten å sprenge layout.

| Nivå | I dag | Forslag | Effektiv basis-fontstørrelse |
|------|-------|---------|------------------------------|
| S    | 0.90  | **0.95** | ~12.4px |
| M    | 1.00  | **1.05** | ~13.7px (ny standard) |
| L    | 1.10  | **1.15** | ~15.0px |
| XL   | 1.20  | **1.25** | ~16.3px |
| XXL  | 1.32  | **1.40** | ~18.2px |

M blir ny standard og er litt større/lettere å lese enn dagens M. XXL gir et reelt "stort" alternativ uten å bli grotesk. Forskjellen mellom nivåer holdes jevn (~10%).

## Plan

1. **Oppdater skala** i `src/components/designlab/TextSizeControl.tsx`
   - Endre `TEXT_SIZE_PRESETS` til verdiene over (0.95 / 1.05 / 1.15 / 1.25 / 1.40).
   - Behold kontroll-UI uendret (samme 5 knapper, samme tooltip-format).

2. **Standardiser skaleringen til `zoom`-mekanismen overalt**
   - Audit av alle Design Lab-page-shells / sider som leser `textSize` (`DesignLabPageShell`, `DesignLabContacts`, `DesignLabCompanies`, `DesignLabKonsulenterAnsatte`, `DesignLabKonsulenterOppdrag`, `DesignLabForesporsler`, `DesignLabOppfolginger`, `DesignLabMarkedsradar`, `DesignLabStacqPrisen`, `DesignLabNettsideAI`, `DesignLabDashboard`, `DesignLabEksterneKonsulenter`, `DesignLabContactDetail`, `InnstillingerV2`).
   - Sørg for at hver av disse wrapper hovedinnholdet i en container med `style={getDesignLabTextSizeStyle(textSize)}` (zoom + variabler), ikke bare variabler.
   - For sider som mangler tekstskala-state helt (hvis noen): hent `textSize` fra `usePersistentState` på samme nøkkel som resten av Design Lab bruker, så valget er globalt.

3. **Detaljpaneler / sheets**
   - Sjekk at `DesignLabEntitySheet`, kontakt-/selskap-/ansatt-detaljpaneler og `CommandPalette` også arver `zoom` (enten ved at de ligger inne i shell-containeren, eller ved å sette `getDesignLabTextSizeStyle` på sheet-roten).
   - Modaler/portaler som rendres utenfor shell-DOM (f.eks. via Radix `Portal`) må eksplisitt få `style={getDesignLabTextSizeStyle(textSize)}` på sin rot — ellers ignorerer de skalaen.

4. **Dokumentasjon / memory**
   - Oppdater `mem://features/design-lab/text-scaling` med ny skala (0.95 / 1.05 / 1.15 / 1.25 / 1.40) og regelen "alltid wrap med `getDesignLabTextSizeStyle` på rot, inkludert portaler/modaler".

## Effekt
- Standard tekst i Design Lab blir ~13.7px (litt mer behagelig å lese på store skjermer).
- Alle Design Lab-flater, inkl. detaljpaneler og modaler, responderer konsistent på tekststørrelse-valget.
- Brukeren får et reelt "stort" nivå (XXL ≈ 18px basis) uten at layout knekker, fordi `zoom` skalerer både tekst, spacing og ikoner proporsjonalt.

## Utenfor scope
- Endring av V1-flater (CRM utenfor `/design-lab` og ikke-migrerte flater).
- Ny tekststørrelse-kontroll-UI (kun verdier endres).
- Per-side overstyring av skala.
