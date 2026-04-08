

## Plan: Vis aktive prosesser fra Forespørsler på ansattprofilen

### Oversikt
Legge til en ny seksjon "Aktive prosesser" på ansattprofilsiden som viser forespørsler der den ansatte har status `sendt_cv` eller `intervju`. Seksjonen plasseres mellom "Informasjon"-kortet og "Aktive oppdrag"-kortet.

### Endringer i `src/pages/AnsattDetail.tsx`

1. **Ny query**: Hent data fra `foresporsler_konsulenter` joinet med `foresporsler` der `ansatt_id` matcher og `status` er `sendt_cv` eller `intervju`.

2. **Ny seksjon** (mellom Informasjon-kortet og Oppdrag-kortet, ca. linje 291):
   - Overskrift: "AKTIVE PROSESSER" (seksjonstittel-stil)
   - Viser hver forespørsel som en rad med:
     - Selskapsnavn (fra `foresporsler.selskap_navn`)
     - Status-badge (`Sendt CV` / `Intervju`)
     - Klikkbar lenke til forespørsler-siden
   - Seksjonen vises kun hvis det finnes aktive prosesser (ikke vis tom seksjon)

### Datamodell
- `foresporsler_konsulenter`: `ansatt_id`, `status`, `foresporsler_id`
- `foresporsler`: `id`, `selskap_navn`, `teknologier`
- Filtrering: `status IN ('sendt_cv', 'intervju')`

