

## Plan: Fiks Mailchimp-synk ved avslåing + manglende oppgaver

### Problem 1: Synk virker ikke ved av/på av CV-Epost
`syncContactToMailchimp` bruker kun `status_if_new` som bare gjelder nye kontakter. Når en eksisterende abonnent skrus av i CRM-et, endres ikke statusen i Mailchimp fordi kontakten allerede finnes der.

**Fiks**: Legg til `status: "unsubscribed"` i PUT-body når `cv_email = false`, og `status: "subscribed"` når `cv_email = true`. Behold `status_if_new` som fallback.

### Problem 2: Bulk-synk (`sync-all`) har samme feil
Batch-operasjonene bruker også bare `status_if_new`. Kontakter som skrus av vil ikke bli unsubscribed i Mailchimp ved bulk-synk.

**Fiks**: Legg til `status`-felt i batch body basert på `isActive`.

### Problem 3: `mailchimp_status` ikke oppdatert i CRM
Etter vellykket synk settes `mailchimp_status` riktig for sync-all, men `syncContactToMailchimp` setter kun `subscribed`/`unsubscribed` basert på `cv_email`. Dette ser riktig ut, men bør verifiseres at det faktisk kjører.

### Endringer

**`supabase/functions/mailchimp-sync/index.ts`**:

1. **`syncContactToMailchimp`** (~linje 177-180): Legg til `status`-felt i PUT-body:
   ```ts
   const putBody = {
     email_address: contact.email.trim().toLowerCase(),
     status_if_new: contact.cv_email ? "subscribed" : "unsubscribed",
     status: contact.cv_email ? "subscribed" : "unsubscribed",
     merge_fields: mergeFields,
   };
   ```

2. **`syncAllToMailchimp`** batch body (~linje 249-251): Legg til `status`:
   ```ts
   status_if_new: isActive ? "subscribed" : "unsubscribed",
   status: isActive ? "subscribed" : "unsubscribed",
   ```

### Etter deploy
- Kjør en test: Skru av CV-Epost for en kontakt, sjekk at Mailchimp-status endres til "Unsubscribed".
- Kjør «Synk alle» for å oppdatere `mailchimp_status` i CRM for alle kontakter.

