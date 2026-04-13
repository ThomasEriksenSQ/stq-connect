

## Fiks: Bruk Mailchimp Batch API for sync-all

### Problem
Edge Function timeout (~60s) avbryter sync-all etter ~9 kontakter. 369 sekvensielle API-kall tar for lang tid.

### Løsning
Bruk Mailchimp Batch Operations API (`POST /3.0/batches`) som sender alle kontakter i ett enkelt kall. Mailchimp behandler dem asynkront.

### Endring i `supabase/functions/mailchimp-sync/index.ts`

Erstatt den sekvensielle loopen i `syncAllToMailchimp` med:

1. Bygg en array av batch-operasjoner (maks 500 per batch-kall)
2. Send `POST /3.0/batches` med alle operasjonene
3. Returner batch-ID og antall operasjoner (ikke vent på ferdigstillelse)

```typescript
// Erstatt for-loopen med batch API
const operations = [];
for (const contact of contacts) {
  const ownerName = await getOwnerName(supabaseAdmin, contact.owner_id);
  const subscriberHash = md5(contact.email!.trim().toLowerCase());
  operations.push({
    method: "PUT",
    path: `/lists/${mc.audienceId}/members/${subscriberHash}`,
    body: JSON.stringify({
      email_address: contact.email!.trim().toLowerCase(),
      status_if_new: "subscribed",
      status: "subscribed",
      merge_fields: {
        FNAME: contact.first_name || "",
        LNAME: contact.last_name || "",
        PHONE: contact.phone || "",
        TITLE: contact.title || "",
        COMPANY: contact.companies?.name || "",
        OWNER: ownerName,
        ACCT_TYPE: mapAccountType(contact.companies?.status || null),
        MMERGE13: "Ja",
      },
    }),
  });
}

const res = await mcFetch(mc, "/batches", "POST", { operations });
```

### Filer som endres
- `supabase/functions/mailchimp-sync/index.ts` — erstatt sekvensiell loop med batch API

### Resultat
- Alle 369 kontakter sendes i ett API-kall
- Ingen timeout-problemer
- Mailchimp prosesserer i bakgrunnen (tar noen minutter)
- Frontend viser antall sendte operasjoner

