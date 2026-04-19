
## Funn

`src/pages/DesignLabCompanies.tsx` viser selskapstabell med kolonner. Brukeren vil ha en ny kolonne "Antall kontakter" rett etter "STED".

## Plan

1. Sjekk eksisterende kolonner og datakilde i `DesignLabCompanies.tsx`.
2. Hent antall kontakter per selskap (count fra `contacts` med `company_id`).
3. Legg til kolonneoverskrift "Antall kontakter" etter "Sted" og verdi i hver rad.
4. Oppdater `gridTemplateColumns` i header og rader for å få plass til ny kolonne (~110px, høyrejustert numerisk).

### Datahenting
- Bruk eksisterende kontakt-data hvis allerede fetchet, ellers hent en aggregert telling via Supabase (group by company_id) eller utled fra eksisterende kontaktliste.

### Utenfor scope
- Sortering på den nye kolonnen (kun visning).
- V1 Companies-side.
