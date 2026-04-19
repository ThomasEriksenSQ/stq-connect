

## Funn

I `OppdragEditSheet.tsx` finnes "TYPE"-blokken med chips "Direkte" / "Via partner" som styrer `dealType` (`"DIR"` / `"PARTNER"`). I dag finnes kun ett selskaps-felt ("Kunde"), som representerer sluttkunden. Når deal er via partner mangler det en måte å registrere hvilket partnerselskap som formidler oppdraget.

Datamodellen `stacq_oppdrag` har kun `selskap_id` + `kunde` (sluttkunde). Det finnes ingen kolonne for partnerselskap.

`buildOppdragWritePayload` mapper `selskapId` → `selskap_id` og `selskapNavn` → `kunde`.

## Plan

### 1. Database — ny migrasjon
Legg til to kolonner på `stacq_oppdrag`:
- `partner_selskap_id uuid` (FK til `companies.id`, nullable, ON DELETE SET NULL)
- `partner_navn text` (denormalisert visningsnavn, nullable)

Index på `partner_selskap_id` for oppslag.

### 2. `src/lib/oppdragForm.ts`
- Utvid `OppdragFormState` med `partnerSelskapId: string | null` og `partnerSelskapNavn: string | null`.
- Default `null` i `OPPDRAG_DEFAULTS`.
- `buildOppdragWritePayload`: skriv `partner_selskap_id` og `partner_navn` kun når `dealType === "PARTNER"`. Hvis Direkte → tving begge til `null` (rensing ved bytte).

### 3. `src/components/OppdragEditSheet.tsx`
- Behold eksisterende TYPE-blokk uendret.
- Når `dealType === "PARTNER"`: render ny "PARTNER"-blokk under TYPE med samme selskaps-velger-mønster som "Kunde"-feltet (gjenbruk samme `CompanyCombobox`/søk som allerede brukes). Plassering: rett under TYPE-chipsene, før KUNDE.
- Når brukeren bytter til Direkte: nullstill partner-state lokalt (UI) — `buildOppdragWritePayload` sørger for DB-rensing.
- Init fra eksisterende rad: les `partner_selskap_id`/`partner_navn` inn i form-state ved åpning.
- Behold lagrings-kall uendret.

### 4. Lesing/visning (utenfor scope nå)
Liste-/detaljvisning av oppdrag oppdateres ikke i denne iterasjonen — kun lagring. Kan legges til når brukeren ønsker å se partner i tabellen.

### 5. Tester
Utvid `src/test/oppdragForm.test.ts`:
- PARTNER + valgt partnerselskap → payload inneholder `partner_selskap_id` og `partner_navn`.
- DIR → payload har `partner_selskap_id: null` og `partner_navn: null` selv om state har verdier (rensing).

## Utenfor scope
- V1-flater (`OppdragEditSheet` brukes både i V1 og V2; UI-endringen vises begge steder, men ingen V1-spesifikk logikk endres).
- Visning av partner i lister/timeline.
- Migrering av historiske data (eksisterende rader får `null` på de nye kolonnene).

