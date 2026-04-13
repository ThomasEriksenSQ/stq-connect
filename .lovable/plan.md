

## Mailchimp toveis-synk for CV-Epost

### Oversikt
Integrer STACQ med Mailchimp slik at kontakter med `cv_email = true` automatisk holdes i synk med den eksisterende Mailchimp-audiencen. Endringer i STACQ pusher til Mailchimp, og unsubscribes i Mailchimp synkes tilbake.

### Forutsetning: API-nøkkel og Audience ID
Du trenger en Mailchimp API-nøkkel og Audience (List) ID. Disse lagres som secrets i Supabase Edge Functions.

---

### Steg 1 — Lagre secrets
Legg til to nye secrets:
- `MAILCHIMP_API_KEY` — API-nøkkel fra Mailchimp (Account → Extras → API keys)
- `MAILCHIMP_AUDIENCE_ID` — List/Audience ID fra Mailchimp (Audience → Settings → Audience name and defaults)

### Steg 2 — Edge Function: `mailchimp-sync`
Ny Edge Function som håndterer tre operasjoner:

**a) Enkel kontakt-synk (sanntid)**
Kalles fra frontend når `cv_email` togles. Tar kontakt-ID, henter kontakten fra Supabase, og:
- `cv_email = true` → PUT til Mailchimp (`/lists/{id}/members/{hash}`) med status `subscribed`, merge fields (FNAME, LNAME, PHONE, TITLE, COMPANY, OWNER, ACCT_TYPE)
- `cv_email = false` → PUT med status `unsubscribed`

**b) Full synk (manuell)**
Henter alle kontakter med `cv_email = true` + tilhørende selskap. Bruker Mailchimp batch operations for å synke hele listen. Kontakter som finnes i Mailchimp men ikke lenger har `cv_email = true` settes til `unsubscribed`.

**c) Webhook-mottaker (Mailchimp → STACQ)**
Mottar Mailchimp webhook-events (`unsubscribe`, `cleaned`) og oppdaterer `cv_email = false` på matchende kontakt i Supabase (matcher på e-post).

### Steg 3 — Felt-mapping (STACQ → Mailchimp merge fields)

| Mailchimp merge tag | STACQ-kilde |
|---|---|
| FNAME | `contacts.first_name` |
| LNAME | `contacts.last_name` |
| PHONE | `contacts.phone` |
| TITLE | `contacts.title` |
| COMPANY | `companies.name` (via `company_id`) |
| OWNER | `profiles.full_name` (via `owner_id`) |
| ACCT_TYPE | Mappet fra `companies.status`: partner → "Partner", customer/kunde → "Privat direktekunde", prospect → "Potensiell kunde" |
| CV_EMAIL | `true`/`false` (merge field for tracking) |

Noen av disse merge fields finnes kanskje allerede i Mailchimp-listen (FNAME, LNAME finnes som standard). De resterende opprettes automatisk av Edge Function ved første synk.

### Steg 4 — Frontend-integrasjon

**Sanntid:** I `ContactCardContent.tsx`, etter vellykket `cv_email`-toggle, kall `supabase.functions.invoke('mailchimp-sync', { body: { action: 'sync-contact', contactId } })` i bakgrunnen (fire-and-forget, med toast ved feil).

**Manuell full synk:** Ny knapp på Innstillinger-siden (`/innstillinger`) under en ny seksjon "MAILCHIMP". Knappen "Synk alle til Mailchimp" trigger full synk. Viser antall synkroniserte/oppdaterte kontakter som resultat.

### Steg 5 — Mailchimp webhook-oppsett
Edge Function `mailchimp-sync` eksponeres med `verify_jwt = false` for webhook-endepunktet. Webhook-URL (`https://kbvzpcebfopqqrvmbiap.supabase.co/functions/v1/mailchimp-sync?action=webhook`) registreres manuelt i Mailchimp (Audience → Settings → Webhooks). Verifisering via en `MAILCHIMP_WEBHOOK_SECRET` som sjekkes ved innkommende requests.

### Steg 6 — Første import fra CSV (engangs)
Kjør et script som matcher de 679 subscribed-kontaktene fra CSV-filen mot eksisterende kontakter i Supabase (match på e-post). For kontakter som finnes i STACQ men mangler `cv_email = true`, oppdater til `cv_email = true`. Rapporter kontakter som finnes i Mailchimp men ikke i STACQ (potensielt manuelle oppføringer).

---

### Teknisk detalj

```text
┌─────────┐   cv_email toggle    ┌──────────────────┐   PUT /members   ┌───────────┐
│  STACQ  │ ──────────────────►  │ mailchimp-sync   │ ──────────────►  │ Mailchimp │
│ (React) │                      │ (Edge Function)  │                  │           │
│         │ ◄────────────────── │                  │ ◄────────────── │  Webhook  │
└─────────┘   cv_email = false   └──────────────────┘   unsubscribe    └───────────┘
```

### Filer som endres/opprettes
- `supabase/functions/mailchimp-sync/index.ts` — ny Edge Function
- `src/components/ContactCardContent.tsx` — kall mailchimp-sync ved toggle
- `src/pages/Innstillinger.tsx` — ny "Mailchimp"-seksjon med synk-knapp
- `supabase/config.toml` — legg til `[functions.mailchimp-sync]` med `verify_jwt = false`

