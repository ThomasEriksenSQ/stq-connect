

## Plan: Horisontale rader for Siste og Neste oppfølging

### Hva endres
Sone 2 i DailyBrief endres fra 2-kolonners grid til to stablede horisontale rader.

### Teknisk gjennomføring

**Fil:** `src/components/dashboard/DailyBrief.tsx` (linje 857–994)

1. **Erstatt grid med flex-col:** Bytt `grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6` → `flex flex-col gap-3`.

2. **Siste-raden (linje 859–877):** Endre fra `space-y-1.5` til `flex items-baseline gap-2 flex-wrap`. Label "SISTE", sitat og dato legges på én horisontal linje. Legg til `whitespace-nowrap` på labelen og datoen, `min-w-0 truncate` på sitatteksten om nødvendig.

3. **Neste oppfølging-raden (linje 880–993):**
   - Endre ytre `space-y-1.5` til `flex flex-col gap-1.5`.
   - Første linje: `flex items-baseline gap-2 flex-wrap` med label "NESTE OPPFØLGING", tittel og dato horisontalt.
   - Andre linje: Chips og date-input forblir på sin egen rad under (den eksisterende `flex flex-wrap`-blokken på linje 946–985 beholdes som den er).

### Resultat
- Rad 1: `SISTE · "Samtale om prosjekt" · 3. apr 2025 · 5 dager siden`
- Rad 2 linje 1: `NESTE OPPFØLGING · Følg opp etter møte · 10. apr 2025`
- Rad 2 linje 2: `[Følg opp på sikt] [1 uke] [2 uker] [1 måned] [3 måneder] [📅]`

