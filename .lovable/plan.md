

## Plan: Legg til profilbilde i Fornyelser-tidslinja

### Bakgrunn
`FornyelsesTimeline` viser fornavn + kunde per rad, men ingen avatar. `stacq_oppdrag` har `kandidat` (fullt navn) og `er_ansatt` (boolean), men ingen `ansatt_id`. Portrettbilder ligger i `cv_documents.portrait_url` koblet via `stacq_ansatte.id`.

### Tilnærming
Matche oppdragets `kandidat`-navn mot `stacq_ansatte.navn` for å finne ansatt-ID, deretter slå opp portrait fra `cv_documents`.

### Endringer

**1. `src/components/FornyelsesTimeline.tsx`**

- Importer `useQuery`, `supabase`, og `getInitials` fra `@/lib/utils`
- Legg til to queries inne i komponenten:
  - Hent alle ansatte: `stacq_ansatte` → `id, navn`
  - Hent portretter: `cv_documents` → `ansatt_id, portrait_url` (der portrait_url ikke er null)
- Bygg to maps i en `useMemo`:
  - `nameToAnsattId`: `Map<string, number>` (lowercase navn → id)
  - `portraitByAnsattId`: `Map<number, string>` (ansatt_id → portrait_url)
- I `rows` useMemo: inkluder `fullName: o.kandidat` (fullt navn, ikke bare fornavn) og `erAnsatt: o.er_ansatt`
- I hver rad, legg til en 24×24px avatar foran navn+kunde:
  - For ansatte (`er_ansatt === true`): slå opp portrait via `nameToAnsattId` → `portraitByAnsattId`. Vis `<img>` hvis funnet, ellers initialer.
  - For ikke-ansatte (`er_ansatt !== true`): vis initialer (1-2 bokstaver) i en `bg-muted` sirkel.
- Utvid den sticky venstre kolonnen fra `w-[160px]` til `w-[190px]` for å gi plass til avataren.

### Tekniske detaljer
- Avatar: `w-6 h-6 rounded-full` (24px) med `object-cover border border-border` for bilder
- Initialer-sirkel: `w-6 h-6 rounded-full bg-primary/10 text-primary text-[0.5625rem] font-bold flex items-center justify-center`
- For ikke-ansatte: `bg-muted text-muted-foreground` i stedet for primary
- `getInitials` brukes fra `@/lib/utils` (allerede eksisterende)
- Navn-matching gjøres case-insensitive med `.toLowerCase()` og trimming av mellomrom

