

## Legg til «Avmeldt»-badge på kontaktprofilen

### Bakgrunn
Når en kontakt avmelder seg i Mailchimp (unsubscribe/cleaned), skal dette vises visuelt i CRM-et som en rød «Avmeldt»-badge ved siden av CV-Epost-togglen.

### Endringer

**1. Ny kolonne i `contacts`-tabellen**
- Legg til `mailchimp_status text default null` — verdier: `subscribed`, `unsubscribed`, `cleaned`, eller `null` (aldri synket).
- Migrasjon: `ALTER TABLE contacts ADD COLUMN mailchimp_status text DEFAULT null;`

**2. Edge Function (`supabase/functions/mailchimp-sync/index.ts`)**
- **Webhook**: Når type=`unsubscribe` eller `cleaned`, sett `mailchimp_status` til `'unsubscribed'`/`'cleaned'` (i tillegg til `cv_email = false`).
- **sync-contact**: Etter vellykket PUT til Mailchimp, sett `mailchimp_status = 'subscribed'` hvis cv_email=true.
- **sync-all**: Etter batch-kall, oppdater alle synkede kontakter med `mailchimp_status = 'subscribed'`. For kontakter med cv_email=false, sett `mailchimp_status = 'unsubscribed'`.

**3. UI — ContactCardContent.tsx**
- Vis en rød «Avmeldt»-badge etter CV-Epost-knappen når `mailchimp_status` er `unsubscribed` eller `cleaned`:
```
<span className="inline-flex items-center h-7 px-3 rounded-full border text-[0.75rem] font-medium bg-red-50 text-red-700 border-red-200">
  Avmeldt
</span>
```
- Badgen vises kun når kontakten aktivt har avmeldt seg, ikke når cv_email bare er av.

### Teknisk detalj
- Feltet `mailchimp_status` skiller mellom «aldri synket» (null), «aktivt abonnert» og «avmeldt av bruker/Mailchimp».
- Når brukeren slår CV-Epost PÅ igjen i CRM-et og synker til Mailchimp, settes `mailchimp_status = 'subscribed'` og badgen forsvinner.

### Filer som endres
- `supabase/migrations/` — ny migrasjon for `mailchimp_status`-kolonne
- `supabase/functions/mailchimp-sync/index.ts` — oppdater webhook + sync-funksjoner
- `src/components/ContactCardContent.tsx` — vis «Avmeldt»-badge

