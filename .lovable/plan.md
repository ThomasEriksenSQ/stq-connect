
## Funn

I `src/pages/DesignLabCompanies.tsx` har den sticky tabellheaderen (linje 606–612) bakgrunnen `C.surfaceAlt` (#F3F3F4 — lett grå). Resten av listeområdet under headeren har `C.appBg` (#FCFCFD — nesten hvit) som arves fra `<main>`. Det skaper en synlig "hvit glippe":

- Mellom den grå header-stripen (kun i venstre panel) og panelets høyre kant/ResizableHandle, vises bakgrunnen som en lys vertikal strek.
- Den grå headerstripen står i kontrast mot det nesten hvite radområdet under, som også kan oppfattes som en "stripe".

Denne påvirker også samme mønster på andre Design Lab-sider med sticky header (Kontakter, Forespørsler, Oppfølginger), men brukeren peker spesifikt på selskaper-tabellen.

## Plan

Endre kun den sticky tabellheaderens bakgrunn slik at den smelter sømløst inn med listeområdet. Ingen layout-, kolonne- eller logikkendringer.

### Fil
- `src/pages/DesignLabCompanies.tsx` (linje ~606–612)

### Endring
- Sett header-wrapper sin `background` fra `C.surfaceAlt` (#F3F3F4) til `C.appBg` (#FCFCFD) — samme som listeområdet under, slik at det ikke lenger ser ut som en farget stripe.
- Behold `borderBottom: 1px solid C.border` som visuell separator.
- Behold `position: sticky` og `z-10` for fortsatt scroll-stickyness.

### Hvorfor lav-risk
- Ren tokenbytte på én bakgrunnsfarge.
- Ingen påvirkning på sortering, filtre, kolonnebredder eller detaljpanel.
- Følger V2-prinsippet om at hierarki skapes via typografi/border, ikke fargede flater.

### Utenfor scope
- Andre Design Lab-sider (Kontakter, Forespørsler, Oppfølginger). Kan harmoniseres etterpå hvis ønsket.
- V1 Companies-side.
