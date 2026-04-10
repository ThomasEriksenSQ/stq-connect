

## Plan: Epostvarsling for oppfølginger

### Hva bygges

En avkrysningsboks "Epostvarsling" i oppfølgingsskjemaene. Når aktivert, sendes en e-post til den ansvarlige CRM-brukeren når oppfølgingen forfaller.

### 1. Database-migrasjon

Legg til `email_notify` (boolean, default false) på `tasks`-tabellen:

```sql
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS email_notify boolean DEFAULT false;
```

### 2. UI — Legg til checkbox i 3 steder

**a) `FollowUpModal.tsx`** — Legg til en "Epostvarsling"-avkrysningsboks mellom eier-velger og footer. Inkluder `emailNotify` i `onSubmit`-dataene.

**b) `ContactCardContent.tsx`** — I "Ny oppfølging"-skjemaet, legg til checkbox. Sett `email_notify` i insert-kallet.

**c) `Tasks.tsx`** — I "Ny oppfølging"-dialogen, legg til checkbox. Sett `email_notify` i insert-kallet.

### 3. Oppdater alle task-insert-kall

Legg til `email_notify`-feltet i alle relevante `.from("tasks").insert()`-kall:
- `OppfolgingerSection.tsx` (handleModalSubmit)
- `ContactCardContent.tsx` (2 steder)
- `Tasks.tsx`

De automatiske task-insert-kallene (BulkSignalModal, DailyBrief, Contacts, CompanyCardContent) beholder `email_notify: false` (default).

### 4. Edge Function: `task-due-reminder`

Ny Edge Function som:
1. Validerer JWT + admin-rolle
2. Henter tasks der `due_date <= today`, `status != 'completed'`, `email_notify = true`
3. Henter brukerens e-post via service role (`auth.admin.getUserById`)
4. Sender e-post via Resend med oppfølgingens tittel, kontaktnavn, selskap, og lenke til kontaktsiden
5. Markerer varslet oppfølging (setter `email_notify` til `false` eller lagrer sendt-tidspunkt) for å unngå duplikater

### 5. Cron-jobb

Sett opp daglig pg_cron-jobb (kl. 07:00) som kaller edge-funksjonen via `pg_net`.

### Teknisk detalj

- Resend API-nøkkel er allerede konfigurert som secret
- Eksisterende e-postmønster fra `salgsagent-paaminning` gjenbrukes
- E-posten sendes fra `crm@stacq.no` (eller tilsvarende verifisert domene)
- Filer som endres: 4 frontend-filer + 1 ny edge function + 1 migrasjon + 1 cron-insert

