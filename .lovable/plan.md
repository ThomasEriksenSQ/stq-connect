

## Plan: Rød "CV ✗" badge i kontaktlisten for avmeldte kontakter

### Vurdering
Forslaget er godt. I stedet for en separat "Avmeldt"-badge bruker vi den eksisterende CV-badgen med en tredje visuell tilstand. Dette er mer kompakt og umiddelbart forståelig. Ved klikk på en avmeldt badge viser vi en toast i stedet for å toggle — fordi re-subscribe via API ikke er mulig når kontakten har unsubscribed via Mailchimp.

### Tre tilstander for CV-badgen

| Tilstand | Betingelse | Utseende | Klikk-handling |
|----------|-----------|----------|---------------|
| Aktiv | `cv_email=true` og ikke avmeldt | Blå badge "CV" | Toggle av |
| Inaktiv | `cv_email=false` | Grå badge "CV" | Toggle på |
| Avmeldt | `cv_email=true` og `mailchimp_status` er `unsubscribed` eller `cleaned` | Rød badge "CV ✗" | Toast: "Kontakten har avmeldt seg via Mailchimp og kan ikke re-abonneres." |

### Endringer

**1. `src/pages/Contacts.tsx`** — Oppdater CV-badge (to steder: mobil ~linje 2027 og desktop ~linje 2176)

Legg til en tredje conditional for styling og tekst:
- Hvis `cv_email=true` OG `mailchimp_status` er `unsubscribed`/`cleaned` → rød badge (`bg-red-50 text-red-700 border-red-200`), tekst "CV ✗", onClick viser toast i stedet for toggle
- Eksisterende blå og grå tilstander uendret

**2. `src/components/ContactCardContent.tsx`** — Erstatt den separate "Avmeldt"-badgen (~linje 1012-1014)

Fjern den separate røde "Avmeldt"-badgen og integrer det i selve CV-Epost-knappen med samme mønster: rød styling + "CV-Epost ✗" tekst + toast ved klikk.

**3. Database-migrasjon** — Fiks de 6 kontaktene som er ute av synk

```sql
UPDATE contacts
SET cv_email = false, mailchimp_status = 'unsubscribed'
WHERE lower(trim(email)) IN (
  'an@hideindustry.com', 'vikesh.schouwenaars@kferrotech.com',
  'dlarsen@shearwatergeo.com', 'torgeir.braein@kferrotech.com',
  'johan.lovseth@arm.com', 'mads.dahl@virinco.com'
) AND cv_email = true;
```

**4. Edge-funksjon** — Les tilbake faktisk status fra Mailchimp etter PUT

I `syncContactToMailchimp`, etter vellykket PUT: les `result.status` fra Mailchimp-responsen og skriv den til `mailchimp_status` i CRM. Dette forhindrer fremtidig drift.

### Oppsummering
- 2 frontend-filer endres (`Contacts.tsx`, `ContactCardContent.tsx`)
- 1 edge-funksjon oppdateres (`mailchimp-sync/index.ts`)
- 1 migrasjon for å rette opp de 6 avmeldte kontaktene

