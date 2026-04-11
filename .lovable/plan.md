

## Plan: Legg til Outlook-kalenderintegrasjon for oppfølginger

### Konsept
Ny avkrysningsboks "Legg til i Outlook-kalender" ved siden av eksisterende "Epostvarsling ved forfall". Når aktivert, opprettes en kalenderhendelse i CRM-brukerens Outlook-kalender med tittel "Følg opp KONTAKTNAVN, SELSKAPSNAVN" på forfallsdatoen.

### Forutsetning: OAuth-scope
Dagens OAuth-flyt bruker kun `offline_access Mail.Read`. Vi må utvide til `offline_access Mail.Read Calendars.ReadWrite`. Brukerne (Jon Richard og Thomas) må re-autentisere én gang for å gi den nye tilgangen. Azure-appen i Entra må også ha `Calendars.ReadWrite` lagt til som tillatelse.

### Tekniske endringer

**1. `supabase/functions/outlook-auth/index.ts`** — Utvid SCOPES
- Endre `SCOPES` fra `"offline_access Mail.Read"` til `"offline_access Mail.Read Calendars.ReadWrite"`

**2. Ny edge-funksjon `supabase/functions/outlook-calendar/index.ts`**
- Mottar: `{ title, date, userId }` (userId = den innloggede brukeren)
- Henter brukerens Outlook-token fra `outlook_tokens`
- Refresher token hvis utløpt (gjenbruk logikk fra `outlook-mail`)
- Kaller Microsoft Graph: `POST /me/events` med:
  - `subject`: "Følg opp KONTAKTNAVN, SELSKAPSNAVN"
  - `start/end`: Forfallsdato som heldagshendelse
  - `isAllDay: true`
  - `isReminderOn: true`, `reminderMinutesBeforeStart: 480` (8 timer = morgen)
- Returnerer `{ success: true }` eller feilmelding

**3. `src/components/ContactCardContent.tsx`** — Ny checkbox + kall
- Legg til `formCalendarSync` state (default false)
- Ny checkbox under "Epostvarsling ved forfall": "Legg til i Outlook-kalender"
- Ved lagring av oppfølging: hvis `formCalendarSync` er true, kall `outlook-calendar` med tittel, dato og brukerens access_token
- Samme mønster i inline-redigering (`TaskRow`)

**4. `src/components/dashboard/FollowUpModal.tsx`** — Ny checkbox
- Legg til `calendarSync` state
- Ny checkbox under "Epostvarsling ved forfall"
- Utvid `onSubmit`-dataen med `calendarSync: boolean`

**5. `src/components/dashboard/OppfolgingerSection.tsx`** — Håndter calendarSync
- I `handleModalSubmit`: hvis `calendarSync` er true, kall edge-funksjonen etter opprettelse

### Viktige detaljer
- Kalenderkallet er fire-and-forget med toast ved suksess/feil — blokkerer ikke opprettelsen
- Ingen ny databasekolonne nødvendig (kalendersynk lagres ikke, det er en engangsaksjons)
- Brukerne må re-autentisere Outlook én gang etter deploy for å gi `Calendars.ReadWrite`-tilgang
- Azure-appen i Entra admin center må ha `Calendars.ReadWrite` delegert tillatelse lagt til

### Filer
| Fil | Endring |
|-----|---------|
| `supabase/functions/outlook-auth/index.ts` | Utvid SCOPES |
| `supabase/functions/outlook-calendar/index.ts` | Ny edge-funksjon |
| `src/components/ContactCardContent.tsx` | Ny checkbox + kall |
| `src/components/dashboard/FollowUpModal.tsx` | Ny checkbox |
| `src/components/dashboard/OppfolgingerSection.tsx` | Kall edge-funksjon |

