

## Synkroniser åpne oppfølginger til "Behov nå" når forespørsel opprettes

### Problemet

Når en ny forespørsel legges inn (`src/pages/Foresporsler.tsx`), legger systemet til en aktivitet med signal "Behov nå" på kontakten. Det fungerer for visning av aktivitetshistorikk, men `getEffectiveSignal` (i `src/lib/categoryUtils.ts`) prioriterer **åpne oppfølginger over aktiviteter**. Resultat: hvis kontakten har en åpen oppfølging merket "Får kanskje behov", fortsetter det å være det effektive signalet — selv etter at forespørselen er registrert.

### Løsning

Når en forespørsel opprettes, oppdater alle **åpne** (`status ≠ 'done'`) oppfølginger for kontakten slik at signalet i `description` blir "Behov nå". Eksisterende fritekst i oppfølgingen bevares; kun signal-prefikset `[…]` byttes ut. `[someday]`-markøren bevares også.

### Endring

**Fil:** `src/pages/Foresporsler.tsx` (kun `handleSubmit`, rett etter at "Behov nå"-aktiviteten er satt inn ~linje 442).

Pseudoflyt:
1. Hent alle åpne oppfølginger for `kontaktId`:
   ```ts
   supabase
     .from("tasks")
     .select("id, description, due_date")
     .eq("contact_id", kontaktId)
     .neq("status", "done");
   ```
2. For hver oppgave, kjør `upsertTaskSignalDescription(task.description, "Behov nå", !task.due_date)` — dette gjenbruker eksakt samme funksjon som Salgsagenten/ContactCard bruker, så `[someday]` og fritekst bevares korrekt.
3. Skriv tilbake `description` + `updated_at` per oppgave (parallelt med `Promise.all`).
4. Invalider relevante query-keys så Salgsagent/Oppfølginger/Hjem oppdateres umiddelbart:
   - `crmQueryKeys.foresporsler.list()` (allerede gjort)
   - `["tasks"]` og `["contacts"]` (samme mønster som `BulkSignalModal`)

### Hvorfor denne modellen

- Vi tukler ikke med `getEffectiveSignal`-prioriteringen (åpne tasks > aktiviteter beholdes — det er korrekt logikk i alle andre flater).
- Vi gjenbruker `upsertTaskSignalDescription`, så vi følger samme regler som inline-redigering i Salgsagenten — ingen ny duplikatlogikk.
- Lukkede oppfølginger (`status = 'done'`) røres ikke — de tilhører historikken.
- Kontakter som ikke har noen åpne oppfølginger får ingen ekstra task opprettet. Aktiviteten "Behov nå" alene er da nok til at `getEffectiveSignal` faller tilbake til den.

### Bevisst utelatt

- Ingen ny edge function. Ingen schema-endring. Ingen endring i `categoryUtils`/`heatScore`.
- Ingen oppdatering av lukkede tasks eller historiske aktiviteter.
- Ingen endring i `ImportForesporslerModal` (bulk-import har ikke `kontakt_id` per rad i dag — det er en separat diskusjon hvis ønsket senere).

### Verifisering etter implementering

1. Åpne en kontakt med åpen oppfølging "Får kanskje behov".
2. Opprett ny forespørsel på samme kontakt via `/design-lab/foresporsler`.
3. Bekreft at oppfølgingen nå viser signal "Behov nå" på Salgsagent, Hjem (Topp 10) og kontakt-kortet — uten at fritekst eller forfallsdato endres.

