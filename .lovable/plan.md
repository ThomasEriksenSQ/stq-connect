

## Hjem (`/design-lab/home`) — "Salgsmorgen" v2

Iterativ gjennomgang med fire ekspertroller. Jeg viser kort hver runde, så enstemmig sluttplan.

---

### Runde 1 — Førsteinntrykk

**CRM-ekspert (Maria):** "Brief + Dagsplan + 3 kolonner = riktig anatomi. Men 'Hett akkurat nå' og 'Nye signaler' overlapper — en kontakt med nytt 'Behov nå'-signal *er* hett. Slå sammen."

**AI-ekspert (David):** "AI-briefen er for generell. 'Gjør X fordi Y' uten kvantifisert *konfidens* og *kilde* blir tarot. Hver anbefaling må vise hvilke datapunkter den hviler på."

**Nytteverdi (Siri):** "Hva *gjør* brukeren her? Hvis svaret er 'leser' har vi tapt. Hver linje må ha én primærhandling i ett tastetrykk. `J` = ring, `M` = e-post, `F` = følg opp."

**Designer (Ola):** "Tre kolonner under brief = visuell støy. Linear gjør én ting per skjermkvadrant. Skjær."

**Konsensus runde 1:** For mange seksjoner. Slå sammen heat+signaler. AI må vise kilder. Tastatursnarveier per rad.

---

### Runde 2 — Hva forsvinner

**Maria:** "Markedsradar-widget hører ikke hjemme på Hjem — den lever på sin egen flate. Erstatt med noe ingen annen flate gir: *en samlet 'pipeline-puls'* — hvor mye penger er i spill akkurat nå, hvor mange forespørsler glipper hvis vi ikke handler, hvor mange konsulenter går av oppdrag innen 30d."

**David:** "Enig. Markedsradar-AI skal *mate* briefen, ikke vises som widget. Brief sier 'C++-volum +23% — Kongsberg Maritime poster 4 stillinger, du har 3 matchende konsulenter.' Det er nytteverdi."

**Siri:** "Spør-agent-feltet nederst er bra, men placeholder må være ekte spørsmål, ikke smaksprøver. Roter mellom 3 reelle spørsmål basert på dagens data."

**Ola:** "Header-stripen 'Siden i går: 4 nye…' — gjør tellerne til *handlinger*, ikke statistikk. Klikk = filtrert kø, ikke filtrert liste."

---

### Runde 3 — Sluttkonsensus

Alle fire signerer på følgende anatomi:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ God morgen, Jon Richard      man. 20. apr. · uke 17       ⌘K søk  │
├─────────────────────────────────────────────────────────────────────┤
│ Pipeline nå:  4 forespørsler aktive · 12 konsulenter ledige om 30d │
│              · 2 fornyelser denne uka · 1 vunnet i går             │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─ Dagens 3 trekk (AI) ──────────────────────┐ ┌─ Din dag ───────┐│
│ │                                            │ │ 09:00 Møte: …   ││
│ │ 1 ▸ Ring Håkon Gjøne (Kongsberg)           │ │ 10:30 Ring: …   ││
│ │     Hvorfor: CC-ed på annonse i går        │ │ 13:00 Demo: …   ││
│ │     +3 lignende C++-treff i markedet       │ │ ───────────────  ││
│ │     [J] ring  [M] e-post  [F] flytt        │ │ Forfalt (2)     ││
│ │                                            │ │ • Sensio-merge ✓││
│ │ 2 ▸ Send CV til Equinor                    │ │ • Aker BP …     ││
│ │     Hvorfor: signal Behov nå (3d gammelt)  │ │                  ││
│ │     Match: Lars 94%, Mona 87%              │ │                  ││
│ │     [V] vis CV  [S] send  [F] flytt        │ │                  ││
│ │                                            │ │                  ││
│ │ 3 ▸ Følg opp DNV — fornyelse om 14d        │ │                  ││
│ │     Hvorfor: ingen kontakt på 21d          │ │                  ││
│ │     [J] ring  [M] e-post  [F] flytt        │ │                  ││
│ │                                            │ │                  ││
│ │              Tenk høyt 🎯  [Start dagen]    │ │                  ││
│ └────────────────────────────────────────────┘ └─────────────────┘│
├─────────────────────────────────────────────────────────────────────┤
│ Nye signaler i går (4)                                              │
│ Equinor    Ukjent → Behov nå        2t  Thomas    [→ kort]         │
│ DNV        Ukjent → Får fremtidig   5t  Jon       [→ kort]         │
│ TietoEvry  Mulig → Behov nå         9t  Thomas    [→ kort]         │
│ Telenor    Får fremtidig → Behov   14t  Jon       [→ kort]         │
├─────────────────────────────────────────────────────────────────────┤
│  Spør agenten: "Hvem trenger C++ akkurat nå?"          ⌘K  [→]    │
└─────────────────────────────────────────────────────────────────────┘
```

### Endringer fra v1

| v1 | v2 |
|---|---|
| Tellere "siden i går" som tekst | Pipeline-puls som handlinger |
| 3 kompakte kolonner | 1 fokusert "Nye signaler"-rad |
| Markedsradar-widget | AI fletter markedssignaler inn i briefen |
| AI sier "gjør X fordi Y" | AI viser kvantifisert kilde + match-prosent |
| Klikk → kort | Tastatursnarveier per anbefaling (J/M/F/V/S) |
| Statisk placeholder i søk | Roterer mellom 3 ekte spørsmål basert på dagens data |
| Hilsen + tellere på én linje | Hilsen-rad + dedikert pipeline-puls-rad |

### Seksjonene (endelig)

**1. Hilsen (32px)** — "God morgen, Jon Richard · man. 20. apr. 2026 · uke 17". `⌘K`-hint helt høyre.

**2. Pipeline-puls (40px, klikkbare segmenter)** — Fire metrikker separert med "·": aktive forespørsler, konsulenter ledige innen 30d, fornyelser denne uka, vunnet i går. Hvert tall = lenke til filtrert visning på riktig flate.

**3. Dagens 3 trekk (venstre 64%)** — AI-generert via ny `daily-brief`-edge function. Hver anbefaling: nummer, handling, *Hvorfor*-rad med kvantifiserte kilder, action-row med tastatursnarveier (J=ring, M=e-post, V=vis CV, S=send, F=flytt til neste dag). `Start dagen`-knapp åpner trekk #1 i Salgsagent-modus.

**4. Din dag (høyre 36%)** — Outlook-kalender + dagens forfalte oppfølginger. Klokkeslett · tittel · kontakt. Maks 5, "+ N flere" → /oppfolginger. Forfalt-blokk under, rød prikk.

**5. Nye signaler (24t, full bredde)** — Tabellrad: kontakt · signal-overgang (`Ukjent → Behov nå` med pil) · tid siden · eier · `[→ kort]`-knapp. Maks 5, ingen overskriftsstøy. Erstatter både "Hett akkurat nå" og "Nye signaler" fra v1.

**6. Spør agenten (40px, full bredde)** — Inputfelt med roterende ekte placeholder generert ved sideload (basert på dagens data). `⌘K` fokuserer.

### Designprinsipper (V2-tokens, alle fire enige)

- Hver seksjon adskilles med 1px `C.borderLight` — ingen kort-på-kort.
- Bakgrunn: `C.appBg` overalt; ingen fargede flater unntatt prikker for status.
- Typografi: 13px standard, 18px kun på hilsen, 11px på meta. Inter 400/500/600.
- Ingen ikoner i overskrifter. Prikker (4px) for signal/status.
- Tastatursnarveier vises som små `kbd`-stiler `[J]` i `C.surfaceAlt` med `C.textMuted`.
- Lasting: 28px skeleton-rader, ikke spinner. AI-brief har eget "Tenker…"-skjelett og blokkerer ikke resten.
- Mobil: ikke prioritert (intern brukstid sitter ved skjerm). Layout krymper til én kolonne under 900px uten optimalisering.

### Teknisk

**Ny side:** `src/pages/DesignLabHome.tsx`
- `DesignLabPageShell` med `activePath="/design-lab/home"`, `title="Hjem"`, `maxWidth={1280}`.
- Ren V2 — `C` fra `src/theme.ts`. Ingen nye tokens.

**Rute:** `src/App.tsx` under `/design-lab`-treet:
```tsx
<Route path="home" element={<Suspense fallback={<LazyFallback />}><DesignLabHome /></Suspense>} />
```
Bevisst utelatt fra `DesignLabSidebar` — bare nåbar via direkte URL.

**Ny edge function:** `supabase/functions/daily-brief/index.ts`
- Henter siste 24t fra `crm_activities`, `crm_tasks`, `crm_contacts.signal_changed_at`, `foresporsler`, `outlook_messages_cache`, `markedsradar_snapshots` (ukesdiff), pluss top 10 fra `getHeatResult`.
- Komprimert JSON → Lovable AI Gateway `google/gemini-2.5-flash`.
- Systemprompt: *"Du er erfaren salgssjef i STACQ. Returner JSON `{actions: [{title, why_facts: string[], action_keys: ['J'|'M'|'V'|'S'|'F'], target_url}], placeholder_questions: string[]}`. Maks 3 actions. Hver `why_facts` skal inneholde 1–3 kvantifiserte fakta. Norsk bokmål."*
- Cachet 30 min per bruker (in-memory + React Query `staleTime`).
- Returnerer også 3 roterende placeholder-spørsmål til "Spør agenten".

**Tastatur-handler:** Lokal `useEffect` på siden lytter på `J/M/V/S/F` når en anbefaling er fokusert (piltaster opp/ned for å bytte). `⌘K` fokuserer søk.

**Pipeline-puls-data:** Parallelle queries:
- `foresporsler` count where `status='active'` AND `mottatt_at > now() - 45d`
- `stacq_ansatte` count where `tilgjengelig_fra <= now() + 30d`
- `stacq_oppdrag` count where renewal due 0–7d
- `foresporsler` count where `status='won'` AND `updated_at > yesterday 00:00`

**Eksisterende byggeklosser:**
- `getHeatResult`, `HEAT_COLORS`, `SIGNAL_COLORS` fra `src/theme.ts`.
- `outlook-calendar` for Din dag.
- `chat`-edge function for "Spør agenten".
- `getEffectiveSignal` for signal-overganger.

**Tilstand `lastSeenAt`:** localStorage per bruker, oppdateres ved `unload`. Brukes til "Nye signaler i går"-vinduet.

### Hva som er bevisst utelatt

- Ingen grafer. Ingen "Velkommen"-banner. Ingen markedsradar-widget. Ingen duplisering av Salgsagent-kø. Ingen mobiloptimalisering. Ingen oppgave-opprettelse fra Hjem (bruk Salgsagent eller Oppfølginger).

