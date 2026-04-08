

## Plan: Velg mellom "Match mot forespørsler" og "Finn leads" i overlayen

### Oversikt
Når brukeren klikker "Finn oppdrag" på ansattsiden, åpnes overlayen uten å starte noe automatisk. I stedet vises to valg-knapper: "Match mot forespørsler" og "Finn leads for [Navn]". Først etter klikk på en av dem startes den aktuelle funksjonen.

### Endringer

**1. `src/pages/AnsattDetail.tsx`**
- Fjern `autoRunMatch={true}` fra `AnsattDetailSheet`-kallet (sett til `false` eller fjern prop)

**2. `src/components/AnsattDetailSheet.tsx`**
- Legg til en `activeMode` state: `null | "oppdrag" | "leads"` (starter som `null`)
- Når `activeMode === null`: vis to knapper side om side i content-området:
  - **"Match mot forespørsler"** (med `Sparkles`-ikon) → setter `activeMode = "oppdrag"`
  - **"Finn leads for [Fornavn]"** (med `Target`-ikon) → setter `activeMode = "leads"` og kaller `handleFinnLeads()`
- Når `activeMode === "oppdrag"`: vis `OppdragsMatchPanel` med `autoRunMatch={true}` (som i dag)
- Når `activeMode === "leads"`: vis leads-resultatene (eksisterende kode)
- Fjern den separate "Finn leads"-knappen nederst — den er nå integrert i valg-visningen
- Reset `activeMode` til `null` når sheeten lukkes

### Filer som endres
- `src/pages/AnsattDetail.tsx`
- `src/components/AnsattDetailSheet.tsx`

