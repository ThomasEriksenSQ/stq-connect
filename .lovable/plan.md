

## Plan: Legg inn profilbilder for ansatte

### Bakgrunn
Alle ansatte har `bilde_url = NULL` i `stacq_ansatte`, men bildene finnes allerede i `consultants`-tabellen. AnsattDetailSheet viser allerede bildet når `bilde_url` er satt — så det eneste som trengs er å populere feltet.

### Endring: SQL-migrasjon

Kjøre en UPDATE som kopierer `image_url` fra `consultants` til `stacq_ansatte.bilde_url` basert på navnematch (fornavn + etternavn). Dette dekker 11 av 16 ansatte. De resterende (Filip Dovland, Mattis Spieler Asp, Rikke Solbjørg, Harald Moldsvor, Trond Emaus) har litt avvikende navn i `consultants` og settes manuelt.

```sql
-- Manuell mapping for alle med kjent bilde
UPDATE stacq_ansatte SET bilde_url = 'https://kbvzpcebfopqqrvmbiap.supabase.co/storage/v1/object/public/consultant-images/...' WHERE id = X;
```

16 UPDATE-setninger totalt (én per ansatt som har bilde i consultants).

### Ingen kodeendringer
AnsattDetailSheet sjekker allerede `ansatt?.bilde_url` og viser bildet. Ingen frontend-endring nødvendig.

### Kun én fil opprettes
- Ny migrasjon i `supabase/migrations/`

