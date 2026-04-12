

## Plan: Blacklist rekrutteringsselskaper + endre e-posttittel

### Problem
1. Rekrutteringsselskaper (f.eks. Jobzone) dukker opp som "Ikke i CRM" i ukentlig e-post fordi edge-funksjonen ikke filtrerer på `ikke_relevant`-flagget
2. E-posttittelen viser `Markedsradar 2026-W15` i stedet for `Markedsradar 2026 - Uke 15`

### Løsning

**Fil: `supabase/functions/markedsradar-ukesmail/index.ts`**

#### 1. Filtrer ut `ikke_relevant`-selskaper
- Endre company-queryen (linje 637) fra `.select("id, name, status")` til `.select("id, name, status, ikke_relevant")`
- Legg til `.not("ikke_relevant", "eq", true)` for å ekskludere blacklistede selskaper allerede i queryen, slik at de aldri matcher finn-annonser og aldri vises i noen seksjon

#### 2. Endre tittelformat
- Linje 526: Endre `Markedsradar ${snapshot.latestWeek}` til å formatere `2026-W15` som `2026 - Uke 15`
- Linje 695 (e-post subject): Samme formatering for subject-linjen

#### 3. Deploy
- Deploy `markedsradar-ukesmail` edge function

### Hvordan blackliste selskaper
Eksisterende `ikke_relevant`-flagg på companies-tabellen brukes allerede i CRM-frontenden. For å blackliste et rekrutteringsselskap: opprett det i CRM og merk det som "ikke relevant". Da filtreres det bort fra både CRM-visninger og e-posten.

