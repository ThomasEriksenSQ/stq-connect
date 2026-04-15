

# Plan: Standardiser knappehøyder i Design Lab header

## Problem
TextSizeControl-knappene har `height: 24px` mens søkefeltet og handlingsknappen har `height: 30px`. V2-retningslinjene krever 30–32px for alle interaktive elementer.

## Endringer

### 1. `src/components/designlab/TextSizeControl.tsx`
- Endre `height: 24` → `height: 28` på pill-knappene (28px passer bedre visuelt som sekundærkontroll uten å dominere headeren, men matcher vertikalt med 30px-elementer via `items-center`)
- Alternativt: bruk `height: 30` for eksakt match med input og primærknapp

### 2. Verifisering
- Søkefelt: allerede `height: 30` ✓
- "+ Ny kontakt"-knapp: allerede `height: 30` ✓
- TextSizeControl: oppdateres til `height: 28` (visuelt balansert sekundærkontroll)

Én fil, én linje endret.

