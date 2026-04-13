

## Fiks: Endre MMERGE13 til TRUE/FALSE

### Problem
MMERGE13-feltet sender "Ja"/"Nei" som tekst, men Mailchimp-feltet forventer boolsk verdi (TRUE/FALSE).

### Løsning
Endre begge steder i `supabase/functions/mailchimp-sync/index.ts` fra `"Ja"/"Nei"` til `true/false`.

### Endringer

**`supabase/functions/mailchimp-sync/index.ts`** — to steder:

1. I `syncContactToMailchimp` (~linje 148):
   - Fra: `MMERGE13: contact.cv_email ? "Ja" : "Nei"`
   - Til: `MMERGE13: contact.cv_email ? "TRUE" : "FALSE"`

2. I `syncAllToMailchimp` (~linje 193):
   - Fra: `MMERGE13: "Ja"`
   - Til: `MMERGE13: "TRUE"`

Deretter deploy edge function og kjør sync på nytt.

