

## Husk valgt dato og signal i nudge-modalen

### Problem
Når brukeren velger f.eks. "2 uker" på kortet og trykker "Ok, neste" uten signal, åpnes nudge-modalen med "Følg opp på sikt" i stedet for "2 uker". Tilsvarende: hvis signal er valgt men ikke dato, vises ikke signalet i modalen.

### Løsning
Endre `openNudge`-funksjonen (linje 1238-1248 i `DailyBrief.tsx`) til å lese gjeldende verdier fra kortet:

**1. Dato: Les fra `selectedChipDate` / `customChipDate`**

Før `setNudgeDate("someday")` (linje 1245), sjekk om brukeren har valgt en dato-chip på kortet:
- Hent `taskId` fra `current.nextTask?.id`
- Les `selectedChipDate[taskId]` — hvis den finnes, bruk den som `nudgeDate` (konverter `null` → `"someday"`)
- Les `customChipDate[taskId]` for `nudgeCustomDate`
- Hvis ingen chip er valgt, behold `"someday"` som default

**2. Signal: Les fra `currentSignal`**

Linje 1243 setter allerede `nudgeSignal` til `currentSignal` når `requireSignalChoice` er false. Men når `requireSignalChoice` er true (mangler signal), settes den til `""`. Dette er korrekt — brukeren MÅ velge signal. Men hvis `currentSignal` allerede finnes (f.eks. satt av brukeren på kortet), bør den brukes uavhengig av `requireSignalChoice`.

Endre linje 1243 fra:
```ts
setNudgeSignal(options?.requireSignalChoice ? "" : currentSignal || "");
```
til:
```ts
setNudgeSignal(currentSignal || "");
setNudgeRequiresSignalChoice(!currentSignal && !!options?.requireSignalChoice);
```

### Fil som endres
- `src/components/dashboard/DailyBrief.tsx` — kun `openNudge`-funksjonen (linje 1238-1248)

### Ingen andre endringer
Ingen logikk i nudge-modalen, salgsagenten eller andre steder endres.

