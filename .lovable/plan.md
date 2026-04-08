

## Plan: Flytt "Nytt selskap"-knappen helt til høyre

### Endring

**Fil:** `src/pages/Companies.tsx`

Legg til `sm:ml-auto` på Dialog-wrapperen (linje 485) slik at "Nytt selskap"-knappen skyves helt til høyre på desktop. Søkefeltet forblir til venstre.

Konkret: på linje 462, endre flex-containeren til å inkludere `sm:justify-between` eller alternativt legge `sm:ml-auto` på Dialog-elementet (linje 485).

Enkleste løsning: legg til `ml-auto` på `<Dialog>` wrapperen ved å pakke den i en div med `ml-auto`, eller flytte Dialog ut av den nåværende containeren og inn i header-raden (linje 459) som allerede har `justify-between`.

**Anbefalt:** Flytt hele Dialog-blokken (linje 485–615) opp i header-raden (linje 459–461), ved siden av `<h1>Selskaper</h1>`. Header-raden har allerede `flex items-center justify-between`, så knappen havner automatisk til høyre. Søkefeltet forblir i sin egen rad under.

### Steg

1. Klipp ut Dialog-blokken (linje 485–615) fra søke-raden
2. Lim den inn i header-raden (linje 459–461), etter `<h1>`
3. Fjern mobilsortering-select fra søke-raden om ønskelig (valgfritt)

