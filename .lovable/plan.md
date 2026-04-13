

## Plan: Fiks Mailchimp-synk fra alle steder CV-Epost toggles

### Rotårsak
Mailchimp-synk trigges **kun** fra kontaktdetaljsiden (`ContactCardContent.tsx`). Men CV-Epost kan toggles fra **tre steder**:

1. **`ContactCardContent.tsx`** — har Mailchimp-synk ✓
2. **`Contacts.tsx`** (kontaktlisten) — **mangler Mailchimp-synk** ✗
3. **`DailyBrief.tsx`** (salgsagent) — **mangler Mailchimp-synk** ✗

Brukeren toggler mest sannsynlig fra kontaktlisten (screenshot viser `/kontakter`), der synk aldri kalles.

### Endringer

**1. `src/pages/Contacts.tsx` — Legg til Mailchimp-synk etter DB-oppdatering**

I `handleToggle`-funksjonen (~linje 556-569), etter vellykket DB-oppdatering av `cv_email`, kall edge-funksjonen:

```ts
if (!error && field === "cv_email") {
  supabase.functions.invoke("mailchimp-sync", {
    body: { action: "sync-contact", contactId: contact.id },
  }).then(({ data, error: mcErr }) => {
    if (mcErr) {
      console.error("Mailchimp sync feilet:", mcErr);
      toast.error("Mailchimp-synk feilet");
    } else {
      toast.success(`Mailchimp: ${data?.status || "synkronisert"}`);
    }
  });
}
```

**2. `src/components/dashboard/DailyBrief.tsx` — Legg til Mailchimp-synk**

I CV-epost toggle (~linje 1142-1153), etter vellykket DB-oppdatering, kall edge-funksjonen med samme mønster.

**3. Legg til console.log i edge-funksjonen for framtidig debugging**

I `supabase/functions/mailchimp-sync/index.ts`, legg til en linje etter action-parsing:
```ts
console.log(`mailchimp-sync action=${action}, contactId=${requestBody?.contactId || "N/A"}`);
```

### Ingen andre endringer
Edge-funksjonen fungerer korrekt — jeg har verifisert dette ved å kalle den direkte. Angelica er nå unsubscribed i Mailchimp etter min manuelle test.

