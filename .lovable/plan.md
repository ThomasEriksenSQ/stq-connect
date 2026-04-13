

## Fiks: Legg til MMERGE13 i Mailchimp-synk

### Problem
Edge Function sender ikke `MMERGE13` (Motta CV på tilgjengelige konsulenter) til Mailchimp. Feltet står tomt selv om kontakten har `cv_email = true`.

### Løsning
Legg til `MMERGE13` i merge fields med verdien `"Ja"` når `cv_email = true`, og `"Nei"` ellers.

### Fil som endres
- `supabase/functions/mailchimp-sync/index.ts` — legg til `MMERGE13: contact.cv_email ? "Ja" : "Nei"` i merge fields i både `syncContactToMailchimp` og `syncAllToMailchimp`.

### Teknisk detalj
To steder i koden bygger `mergeFields`-objektet — begge oppdateres med:
```typescript
MMERGE13: contact.cv_email ? "Ja" : "Nei",
```

