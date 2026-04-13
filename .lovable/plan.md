

## Plan: Fiks Mailchimp-synk og legg til synlig feilhåndtering

### Funn
1. **Funksjonen har ingen nylige logger** — ingen kall er logget, noe som tyder på at den enten ikke ble kalt, eller at den forrige versjonen (uten `status`-feltet) var deployet da du testet.
2. **Feil svelges stille** — Mailchimp-synk feil vises bare som `console.warn`, aldri som toast til bruker. Du ser aldri om noe gikk galt.
3. **Funksjonen er nå deployet med riktig kode** (inkl. `status`-feltet) — jeg deployet den nettopp.
4. **Koden ser ellers riktig ut** — `contactId` er tilgjengelig, `cv_email` oppdateres i DB før synk kalles.

### Endringer

**`src/components/ContactCardContent.tsx`** — Vis feilmelding som toast:
```ts
supabase.functions.invoke("mailchimp-sync?action=sync-contact", {
  body: { contactId },
}).then(({ data, error: mcErr }) => {
  if (mcErr) {
    console.error("Mailchimp sync feilet:", mcErr);
    toast.error("Mailchimp-synk feilet");
  } else {
    toast.success(`Mailchimp: ${data?.status || "synkronisert"}`);
  }
});
```

### Test etter deploy
- Toggle CV-Epost av for en kontakt → forvent toast «Mailchimp: unsubscribed»
- Toggle CV-Epost på → forvent toast «Mailchimp: subscribed» (med mindre kontakten er i compliance state)
- Sjekk i Mailchimp at statusen faktisk endret seg

### Risiko: Mailchimp compliance state
Mailchimp tillater ikke å re-subscribe en kontakt som har unsubscribed via Mailchimp selv. Hvis dette skjer, vil vi nå se en tydelig feilmelding i stedet for stille feil.

