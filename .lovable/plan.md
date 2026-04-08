

## Plan: Vis hvem som la til aktiviteten

Legger til visning av CRM-brukerens fulle navn etter datoen i aktivitetstidslinjen.

### Endringer i `src/pages/AnsattDetail.tsx`

1. **Hent profiler** — Legg til en query mot `profiles`-tabellen for å hente `id` og `full_name`, og bygg et `profileMap` (samme mønster som brukes i Tasks, ContactCardContent osv.)

2. **Vis navn i aktivitetsraden** — Etter dato og relativ tid, legg til brukernavnet med owner-badge styling:
   ```
   8. apr. 2026 · I dag · Jon Richard Nygaard
   ```
   Bruker prosjektets owner-badge klasser: `inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[0.6875rem] font-medium`

Kun én fil endres.

