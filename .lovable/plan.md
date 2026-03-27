

## Plan: Legg til profilbilde i oppdragstabellen

### Endringer i `src/pages/KonsulenterOppdrag.tsx`

**1. Legg til queries for ansatte-navn og CV-portretter** (inne i `KonsulenterOppdrag`-komponenten, etter eksisterende queries):
- Hent `stacq_ansatte` → `id, navn`
- Hent `cv_documents` → `ansatt_id, portrait_url` (der portrait_url ikke er null)

**2. Bygg lookup-maps i useMemo** (samme mønster som FornyelsesTimeline):
- `nameToAnsattId: Map<string, number>` (lowercase trimmed navn → id)
- `portraitByAnsattId: Map<number, string>` (ansatt_id → portrait_url)

**3. Oppdater KONSULENT-cellen** (linje 732-735):
Erstatt den enkle `<p>` med en flex-rad med avatar + navn:
- Slå opp `er_ansatt` på oppdragsraden
- For ansatte: finn portrait via `nameToAnsattId` → `portraitByAnsattId`, vis `<img>` (w-7 h-7 rounded-full) eller initialer i primary-sirkel
- For ikke-ansatte/partnere: vis initialer i muted sirkel
- Behold navnet som truncated tekst ved siden av

### Tekniske detaljer
- Avatar: `w-7 h-7 rounded-full object-cover border border-border`
- Ansatt-initialer: `bg-primary/10 text-primary`
- Partner-initialer: `bg-muted text-muted-foreground`
- Bruker `getInitials()` fra `@/lib/utils` (allerede importert)
- Konsulent-cellen wraps i `flex items-center gap-2 min-w-0`

