

## Plan: Flytt temperatur- og Finn.no-ikoner til toppen

### Hva endres
I salgssenteret (DailyBrief.tsx) flyttes de to indikator-stripene (temperatur: "Sovende"/"Hett"/etc. og Finn.no-stripen) fra sin nåværende posisjon (Sone 3, midt i kortet) opp til toppen av kortet, på samme linje som "Åpne kontakt"-knappen.

### Teknisk gjennomføring

**Fil:** `src/components/dashboard/DailyBrief.tsx`

1. **Flytt stripene til header-raden (linje ~780-788):** Endre `<div className="flex justify-end ...">` til en `flex items-center`-rad med stripene til venstre og "Åpne kontakt" til høyre med `ml-auto`.

2. **Komprimere stripene til kompakte ikoner/badges:** Siden de nå skal ligge på én linje med begrenset plass, gjøres de mer kompakte — emoji + kort label (uten reasons-tekst), og Finn.no-ikonet som en liten badge.

3. **Fjern Sone 3 (linje 969-1047):** Hele den gamle sone 3-blokken med dividers slettes, da innholdet nå er flyttet opp.

### Resultat
Temperatur-ikonet (f.eks. 💤 Sovende) og Finn.no-badgen vises øverst til venstre i kortet, på linje med "Åpne kontakt"-knappen øverst til høyre. Resten av kortets layout forblir uendret.

