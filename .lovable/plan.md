

## Implementer Mailchimp-synk Edge Function + Frontend

Mailchimp gir 404 fordi `mailchimp-sync` ikke eksisterer ennå. Vi må opprette alt fra planen.

### Forutsetning: Secrets

Du trenger å legge til disse secrets i Supabase (hvis ikke allerede gjort):
- `MAILCHIMP_API_KEY` — fra Mailchimp Account → Extras → API keys
- `MAILCHIMP_AUDIENCE_ID` — fra Audience → Settings → Audience name and defaults
- `MAILCHIMP_WEBHOOK_SECRET` — en selvvalgt streng for å verifisere webhook-kall

### Steg 1 — Edge Function `mailchimp-sync/index.ts`

Oppretter en Edge Function med tre actions:

**`sync-contact`** — Sanntid ved toggle av `cv_email`:
- Henter kontakten + selskap + eier fra Supabase
- PUT til Mailchimp med status `subscribed`/`unsubscribed` + merge fields (FNAME, LNAME, PHONE, TITLE, COMPANY, OWNER, ACCT_TYPE)

**`sync-all`** — Manuell full synk:
- Henter alle kontakter med `cv_email = true` + selskap/eier
- Batch-oppdaterer Mailchimp via PUT for hver kontakt
- Returnerer antall synkroniserte

**`webhook`** — Mailchimp → STACQ:
- Mottar GET (Mailchimp verifikasjon) og POST (events)
- Ved `unsubscribe`/`cleaned`: setter `cv_email = false` på matchende kontakt

CORS-headers inkludert. `verify_jwt = false` i config.toml for webhook-tilgang.

### Steg 2 — Frontend: ContactCardContent.tsx

Etter vellykket `cv_email`-toggle, kall `supabase.functions.invoke('mailchimp-sync', { body: { action: 'sync-contact', contactId } })` i bakgrunnen. Toast ved feil.

### Steg 3 — Frontend: Innstillinger.tsx

Ny seksjon "Mailchimp" med:
- Knapp "Synk alle til Mailchimp"
- Viser resultat (antall synkroniserte/oppdaterte)
- Loading-state under synk

### Steg 4 — Config

Legg til `[functions.mailchimp-sync]` med `verify_jwt = false` i `supabase/config.toml`.

### Steg 5 — Deploy + Webhook

Etter deploy kan du opprette webhook i Mailchimp på nytt — URLen vil da returnere 200.

### Filer
- `supabase/functions/mailchimp-sync/index.ts` (ny)
- `src/components/ContactCardContent.tsx` (legg til sync-kall)
- `src/pages/Innstillinger.tsx` (ny Mailchimp-seksjon)
- `supabase/config.toml` (ny function entry)

