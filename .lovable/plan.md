

## Mål
Flytte tekststørrelse-velgeren (S/M/L/XL/XXL) fra hver enkelt side-header inn i venstre sidebar, plassert rett over "Innstillinger"-knappen i footer-blokken. Felles, persistent kontroll i stedet for duplisert UI på hver side.

## Funn
- `TextSizeControl` rendres i dag i headeren på minst 7 flater: `DesignLabPageShell`, `DesignLabContacts`, `DesignLabCompanies`, `DesignLabForesporsler`, `DesignLabKonsulenterAnsatte`, `DesignLabStyleguide`, m.fl. Alle leser/skriver `usePersistentState<TextSize>("dl-text-size", "M")` — så state er allerede globalt synkronisert via localStorage.
- `DesignLabSidebar` har allerede tilgang til samme state (linje 45) og bruker den til å skalere egne rader. Footer-blokken starter på linje 124 med `borderTop` over `Innstillinger`-knappen — det er der velgeren skal inn.
- "Over streken over Innstillinger" = inne i footer-divens øverste del, like over `Innstillinger`-raden, men separert visuelt fra navigasjonen ovenfor av den eksisterende `borderTop`-streken.

## Designvalg

**Plassering:** Inni footer-blokken (under den eksisterende streken), som første element før `Innstillinger`. Dette gir velgeren samme "system/preferences"-status som Innstillinger og Logg ut, og holder den tydelig adskilt fra navigasjonen.

**Layout — utvidet sidebar (220px):**
- Liten label `Tekststørrelse` (11px, `C.textFaint`, vekt 500) til venstre
- Pill-rad S/M/L/XL/XXL høyrejustert, kompakt (samme stil som dagens kontroll, men minimal padding)
- Høyde ~28px, samme rytme som NavGroup-rader
- Padding matcher `Innstillinger`-knappens horisontale padding (8px)
- Ekstra `paddingBottom: px(6)` under raden for å skille den fra Innstillinger uten ny strek

**Layout — kollapset sidebar (48px):**
- Skjul hele velgeren (ikke vis pill-rad i 48px bredde — bryter rytmen)
- Alternativt: bare ett `T`-ikon som åpner en liten popover. For å holde scope lite: **skjul i kollapset modus**. Velgeren er en sjelden-justert preferanse; brukeren kan utvide sidebaren for å endre.

**Visuell vekt:**
- Bruk eksisterende `DesignLabFilterButton` fra `TextSizeControl` (uendret), men send inn `style` med litt mindre `minWidth` (24 i stedet for 28) for å passe i 220px-bredden.
- Ikke vis `Type`-ikonet i sidebar-varianten — labelen "Tekststørrelse" erstatter det og er tydeligere i menykontekst.

## Plan

1. **Lag ny variant i `TextSizeControl.tsx`**: Eksporter en ekstra komponent `TextSizeControlSidebar({ value, onChange })` som rendrer label + kompakt pill-rad uten `Type`-ikon, optimalisert for 220px bredde. Behold dagens `TextSizeControl` urørt for nå.

2. **Oppdater `DesignLabSidebar.tsx`**:
   - Endre `usePersistentState<TextSize>("dl-text-size", "M")` til å hente både `textSize` og `setTextSize` (linje 45).
   - I footer-blokken (linje 124–156), legg inn `<TextSizeControlSidebar>` som første barn etter `borderTop`, før `Innstillinger`-knappen. Skjul den når `collapsed === true`.

3. **Fjern `TextSizeControl` fra alle side-headere** (siden den nå er global i sidebar):
   - `DesignLabPageShell.tsx` (linje 51)
   - `DesignLabContacts.tsx` (linje 1915)
   - `DesignLabCompanies.tsx` (linje 575)
   - `DesignLabForesporsler.tsx` (linje 404)
   - `DesignLabKonsulenterAnsatte.tsx` (linje 365)
   - `DesignLabStyleguide.tsx` (linje 88)
   - Rydd opp i imports som da blir ubrukte (behold `getDesignLabTextSizeStyle` og `type TextSize` der disse fortsatt brukes til wrapper-styling).

4. **Ikke endre**: `getDesignLabTextSizeStyle`, `getDesignLabTextSizeVars`, `SCALE_MAP`, `usePersistentState`-nøkkel `"dl-text-size"`, eller noen logikk som leser tekststørrelse. Kun visuell flytting.

## Filer som endres
- `src/components/designlab/TextSizeControl.tsx` — ny eksport `TextSizeControlSidebar`.
- `src/components/designlab/DesignLabSidebar.tsx` — render velger i footer-blokken.
- `src/components/designlab/DesignLabPageShell.tsx` — fjern fra header.
- `src/pages/DesignLabContacts.tsx` — fjern fra header.
- `src/pages/DesignLabCompanies.tsx` — fjern fra header.
- `src/pages/DesignLabForesporsler.tsx` — fjern fra header.
- `src/pages/DesignLabKonsulenterAnsatte.tsx` — fjern fra header.
- `src/pages/DesignLabStyleguide.tsx` — fjern fra header.

## Utenfor scope
- Ny popover-variant i kollapset sidebar (kan legges til senere ved behov).
- Endring av selve skala-verdiene eller persistens-nøkkelen.
- Endring av andre Design Lab-flater enn de som har `TextSizeControl` i header i dag.

