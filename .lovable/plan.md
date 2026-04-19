

## Funn

I dag styres prioritet kun av kontaktens salgssignal (P1–P5) i `src/lib/followUpViewModel.ts`. Feltene `email_notify` (DB) og `calendarSync` (kun runtime, ikke persistert i dag) settes i `FollowUpModal.tsx`, men brukes ikke til prioritering.

I `FollowUpViewModel` finnes allerede `emailNotify: boolean` (mappet fra `task.email_notify`). Kalender-sync er derimot ikke lagret per i dag — den brukes kun til å opprette Outlook-event ved oppretting.

## Tolkning av krav

> "Hvis Epostvarsling ved forfall eller Legg til Outlook-kalender er sjekket av på en oppfølging, skal den få **P1**-prioritet avhengig av signal satt."

Jeg leser dette som: **Hvis brukeren aktivt har bedt om varsling (e-post eller kalender), er oppgaven viktig nok til å løftes til P1** — uavhengig av hvilket signal kontakten har. Signalet bestemmer fortsatt prioritet når ingen varsling er aktiv.

Kort sagt: varsling = "jeg vil ikke glemme denne" → P1.

(Si fra hvis du heller mente noe annet, f.eks. "kun løft til P1 hvis signalet allerede er P2/P3" — da justerer jeg.)

## Plan

### Endring 1 — Persister kalendervalget

I dag lagres ikke `calendarSync` på tasken. Vi må vite om kalendersync er valgt for å kunne bruke det i prioritetsberegning.

- Legg til kolonne `calendar_sync boolean default false` på `tasks` (migration).
- Oppdater `DesignLabOppfolginger.tsx` (linje ~370 hvor task opprettes) til å lagre `calendar_sync`.
- Oppdater `FollowUpTaskRecord`-typen og `buildFollowUpViewModels` til å lese feltet.
- Legg `calendarSync: boolean` i `FollowUpViewModel`.

### Endring 2 — Løft til P1 ved varsling

I `mapPriority`-logikken i `src/lib/followUpViewModel.ts`:

```ts
function mapPriority(signal, taskPriority, emailNotify, calendarSync) {
  if (emailNotify || calendarSync) return "P1";
  // eksisterende signal-basert mapping
  ...
}
```

Oppdater kall i `buildFollowUpViewModels` til å sende inn `task.email_notify` og `task.calendar_sync`.

### Endring 3 — Sortering oppdateres automatisk

`priorityRank` regnes allerede ut fra resultat av `mapPriority`, så P1-løftede oppgaver havner automatisk øverst sammen med "Behov nå"-oppgavene. Ingen ekstra sorteringsendring trengs.

### Endring 4 — Ingen visuell endring

P1-badgen er allerede definert i `DesignLabOppfolginger.tsx`. Den brukes uendret. Brukeren ser bare at oppgaver med varsling får rød P1-pille.

### Resultat

| Tilstand | Prioritet |
|---|---|
| Epostvarsling ✓ eller Kalender ✓ | **P1** (uansett signal) |
| Behov nå (uten varsling) | P1 |
| Får fremtidig behov | P2 |
| Får kanskje behov | P3 |
| Ukjent om behov | P4 |
| Ikke aktuelt | P5 |

## Utenfor scope

- Ingen UI-endring i `FollowUpModal` — checkboxene finnes allerede.
- Ingen V1-flate berøres (`Tasks.tsx`, `OppfolgingerSection.tsx`).
- Ingen retroaktiv migrering av eksisterende tasks — `calendar_sync` blir `false` på alle gamle rader (ingen konsekvens, da modalen aldri lagret feltet før).
- Ingen overstyring per task manuelt utover varslingscheckboxene.

