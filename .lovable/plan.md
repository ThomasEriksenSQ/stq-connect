

## Berik selskaper med nettsted og LinkedIn fra LinkedIn-dump

Importer URL-er fra `Must_have_kunder_dump_fra_Linkedin.xlsx` og legg dem inn på selskapene i CRM hvor `org_number` matcher eksakt.

### Beslutninger
- **Overskriving**: Kun fyll inn `website` og `linkedin` der nåværende verdi er `NULL` eller tom. Eksisterende URL-er beholdes urørt.
- **Omfang**: Alle selskaper med matchende org.nummer — ingen begrensning på `status`.

### Steg

1. **Lese Excel-filen**
   - Parse `Must_have_kunder_dump_fra_Linkedin.xlsx` med pandas
   - Identifiser kolonner for: organisasjonsnummer, nettside-URL, LinkedIn-URL
   - Normaliser org.nummer (fjern alt som ikke er siffer, behold 9 siffer)
   - Normaliser URL-er: legg på `https://` hvis manglende, fjern trailing slash

2. **Matche mot `companies`-tabellen**
   - Hent alle selskaper med `org_number IS NOT NULL` via `psql`
   - Match eksakt på normalisert 9-sifret org.nummer (ingen fuzzy)
   - Rapporter antall: treff, Excel-rader uten match i CRM, duplikate org.numre i Excel

3. **Generere forhåndsvisning (CSV)**
   - Skriv `/mnt/documents/url-berikelse-preview.csv` med kolonner:
     `org_number, selskap_navn, eksisterende_website, ny_website, eksisterende_linkedin, ny_linkedin, action_website, action_linkedin`
   - `action_*` kan være: `insert` (tomt → ny verdi), `skip-existing` (allerede satt), `no-new-value` (Excel mangler verdi)
   - Rapporter også selskaper i Excel som ikke finnes i CRM (egen seksjon i konsoll-output)

4. **Kjøre oppdatering via migration**
   - Generere SQL med `UPDATE public.companies SET website = COALESCE(NULLIF(website,''), '<ny>'), linkedin = COALESCE(NULLIF(linkedin,''), '<ny>') WHERE org_number = '<orgnr>'` per match
   - Kjøre alt i én transaksjon
   - `COALESCE(NULLIF(...))`-mønsteret garanterer at eksisterende verdier aldri overskrives, selv om noe glipper i preview-logikken

5. **Sluttrapport**
   - Antall selskaper oppdatert (website + linkedin separat)
   - Antall som ble hoppet over fordi feltet allerede var fylt
   - Antall i Excel uten CRM-match

### Filer som opprettes
- `/mnt/documents/url-berikelse-preview.csv` — forhåndsvisning av endringer
- En ny migrasjon under `supabase/migrations/` med UPDATE-statements

### Tekniske detaljer
- Tabell: `public.companies`, kolonner `org_number`, `website`, `linkedin`
- Org.nummer normaliseres med regex `\D` → "" og match på de 9 siste sifrene
- Eksakt match på org.nummer — ingen fallback på navn
- Ingen UI-endringer; dette er et engangs-databerikelse
- Eksisterende `companies` RLS-policies påvirkes ikke

