

## Plan: Konsistent rød farge og font-vekt på datoer

### Problem
- **Siste oppfølging:** Bruker `text-destructive/70` (dempet rød, 70% opacity) uten bold/medium.
- **Neste oppfølging:** Bruker `text-destructive` (full rød) med `font-medium`.

De skal se like ut når de begge signaliserer «gammel/forfalt».

### Endring

**Fil:** `src/components/dashboard/DailyBrief.tsx`

1. **Linje 891:** Endre `text-destructive/70` → `text-destructive` slik at begge bruker samme rødfarge.
2. **Linje 965:** Fjern `font-medium` fra overdue-stilen, slik at ingen av dem er bold — dato-tekst skal følge designsystemets meta-stil (`text-[0.8125rem]` uten ekstra vekt).

Alternativt kan begge beholde `font-medium` — men de må matche. Anbefaling: ingen `font-medium` på noen av dem, i tråd med meta/dato-spesifikasjonen.

