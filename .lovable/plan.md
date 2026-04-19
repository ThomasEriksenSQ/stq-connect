
## Mål
Bytt ut tekstlogoen øverst i venstremenyen med ekte STACQ-logo. Bruk full logo (ikon + tekst) når sidebar er utvidet, og kun ikon når den er kollapset. Støtt både lys og mørk variant.

## Funn
- **Filer som må endres**: `src/components/AppSidebar.tsx` (V1, linje 30–37) og `src/components/designlab/DesignLabSidebar.tsx` (V2, linje 56–73).
- I dag vises `"S"` (collapsed) eller `"STACQ"` (expanded) som tekst.
- `src/assets/` er tom — logoene må kopieres inn.
- Fire opplastede filer:
  - `Logo_og_tekst_-_svart_transparent_-_1475x364-2.png` → svart logo med tekst
  - `Logo_og_tekst_-_hvit_transparent_-_1475x364.png` → hvit logo med tekst
  - `Logo_ikon_-_1920x1920_svart_transparent-2.png` → svart ikon
  - `Logo_ikon_-_1920x1920_hvit_transparent.png` → hvit ikon
- V1 sidebar bruker `text-sidebar-accent-foreground` — må sjekke om sidebar-bakgrunnen er lys eller mørk for å velge riktig logovariant. Basert på user preference (lys/varm tema) og dagens tema-tokens er begge sidebars lyse → bruk **svart logo** som default.
- V2 sidebar har `background: C.sidebarBg` (#F3F3F4, lys) → svart logo.

## Plan

### 1. Kopier logoer til `src/assets/`
Bruk `lov-copy` for alle fire varianter:
- `src/assets/stacq-logo-full-black.png`
- `src/assets/stacq-logo-full-white.png`
- `src/assets/stacq-logo-icon-black.png`
- `src/assets/stacq-logo-icon-white.png`

Begge fargevarianter kopieres inn slik at vi har hvit klar hvis sidebar-temaet senere blir mørkt — men vi importerer og bruker kun de svarte variantene nå.

### 2. `src/components/AppSidebar.tsx`
- Importer `stacq-logo-full-black.png` og `stacq-logo-icon-black.png` som ES6 modules.
- Erstatt `<span>` med `<img>`:
  - Collapsed: ikon, ca. 22×22px, sentrert.
  - Expanded: full logo, høyde ~18–20px, auto-bredde, venstrejustert.
- Behold padding-strukturen (`px-4 pt-6 pb-8`).

### 3. `src/components/designlab/DesignLabSidebar.tsx`
- Importer samme to logoer.
- Erstatt logo-blokken (linje 56–72): fjern det blå "S"-firkant-ikonet og `<span>STACQ</span>`.
- Collapsed: ikon ~22×22px (skalert med `px(22)`), sentrert i logo-raden.
- Expanded: full logo, høyde `px(18)`, auto-bredde, venstrejustert med `paddingLeft: px(16)`.
- Logoen skal fortsatt skalere med tekststørrelse-valget (S/M/L/XL/XXL) via `px()`-helperen.

### 4. Ikke rør
- `NAV_STACQ`-seksjonslabel ("STACQ" som tekst over STACQ-undermenyen) beholdes — det er en seksjonsoverskrift, ikke logo.
- `Login.tsx` og andre branding-flater er utenfor scope.

## Effekt
- Begge sidebars (V1 + V2) viser ekte STACQ-logo i stedet for tekst.
- Kollapset sidebar viser kun ikon-versjonen.
- V2-logoen skalerer korrekt med tekststørrelse-kontrollen.
- Hvit-variantene er tilgjengelige i `src/assets/` for fremtidig bruk (f.eks. mørkt tema).

## Utenfor scope
- Bytting av login-side-logo eller andre branding-flater.
- Automatisk lys/mørk-tema-switching for logoen (vi bruker svart fast nå siden alle sidebars er lyse).
