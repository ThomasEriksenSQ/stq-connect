

## Gjør AI-matching raskere uten å endre logikk

### Problem
Hver gang brukeren klikker "Finn konsulent", "Finn match" eller "Finn oppdrag" skjer dette sekvensielt:
1. **Hent konsulentlister fra DB** (stacq_ansatte + external_consultants) — 200-500ms
2. **Hent tilleggsdata** (forespørsler, aktiviteter, tasks) — 200-500ms  
3. **Kall AI edge function** — 3-8 sekunder (uunngåelig, AI-inferens)

Steg 1 og 2 gjentas identisk hver gang, selv om dataen sjelden endres. AI-kallet (steg 3) kan ikke gjøres raskere, men ventetiden FØR det kan elimineres.

### Løsning: Pre-cache konsulentlister med React Query

Opprett en ny hook `src/hooks/useConsultantCache.ts` som bruker `useQuery` til å holde konsulentlistene varme i minnet:

- **Interne konsulenter**: `stacq_ansatte` med status AKTIV/SIGNERT og Ledig
- **Eksterne konsulenter**: `external_consultants` med status ledig/aktiv
- **staleTime: 5 minutter** — dataen er varm og klar når brukeren klikker

Deretter oppdater de 5 stedene som henter konsulenter manuelt til å bruke cachen i stedet:

### Filer som endres

**1. Ny fil: `src/hooks/useConsultantCache.ts`**
- Hook som returnerer `{ interne, eksterne, isReady }`
- Bruker `useQuery` med 5 min staleTime

**2. `src/components/ContactCardContent.tsx`** (linje 588-597)
- Erstatt `Promise.all([supabase.from("stacq_ansatte")..., supabase.from("external_consultants")...])` med data fra hooken
- Sparer ~300ms per klikk

**3. `src/components/CompanyCardContent.tsx`** (linje 569-580)
- Samme endring — bruk cachen i stedet for fersk DB-henting

**4. `src/components/ForespørselSheet.tsx`** (linje 516-518)
- Samme endring

**5. `src/components/OppdragsMatchPanel.tsx`** (linje 99-109)
- Bruker ikke konsulentlisten, men henter kontakter/aktiviteter/tasks — disse er allerede potensielt cachet. Ingen endring nødvendig her.

**6. `src/components/AIChatPanel.tsx`** (linje 536-539)
- Erstatt inline DB-fetch med cachen

### Hva dette IKKE endrer
- Ingen logikk i edge functions
- Ingen endring i matching-algoritmer eller prompts
- Ingen endring i hva som sendes til AI
- Ingen endring i UI eller visning av resultater

### Forventet effekt
Eliminerer 200-500ms DB-ventetid før hvert AI-kall. Brukeren merker at spinneren starter umiddelbart etter klikk, og AI-svaret kommer tilbake uten unødvendig forsinkelse foran.

