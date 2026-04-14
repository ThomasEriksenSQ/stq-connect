

# Plan: Heat score, fargede signalbadges og UX-forbedringer i Design Lab Kontakter

## Oversikt

Legg til heat score-beregning og visning, fargekodede signalbadges, innkjøper/CV-badges i kontaktlisten, og implementer UX-forbedringene fra GPT/Claude-feedbacken — alt innenfor V8-designspråket.

## Endringer

### 1. Beregn heat score per kontakt

I `contacts`-useMemo: importér `getHeatResult` og `getTaskStatus` fra `src/lib/heatScore.ts`. For hver kontakt beregn heat result basert på eksisterende data (signal, callList, daysSince, tasks). Legg til `heatResult` (temperature, score, reasons) på hvert kontakt-objekt.

### 2. Fargekodede signalbadges i V8-stil

Oppdater `SignalChip`-komponenten til å bruke desaturerte V8-farger per signal:
- **Behov nå**: teal bg (nåværende) — beholdes
- **Fremtidig**: dempet blå (rgba(59,130,246,0.08) + #3B6FA0)
- **Kanskje**: dempet amber (rgba(180,140,40,0.08) + #8A7A3A)
- **Ukjent**: nøytral grå (nåværende) — beholdes
- **Ikke aktuelt**: dempet rød (rgba(154,74,74,0.08) + #8a5a5a)

### 3. Heat-badge i kontaktlisten

Erstatt «Siste»-kolonnen med en kombinert «Varme»-kolonne som viser temperatur-badge:
- **Hett**: liten rød/korall pill
- **Lovende**: amber pill  
- **Mulig**: nøytral pill
- **Sovende**: ghost-grå pill

Beholder «Siste»-info som tooltip på badgen.

### 4. Innkjøper og CV-indikatorer i listen

Legg til små ikoner/dots mellom navn og signal i tabellraden:
- 🛒 Innkjøper: liten teal dot
- 📧 CV: liten dot i annen farge

Disse vises som kompakte 6px dots (ikke badges) for å holde listen ren.

### 5. Forbedret detaljpanel-header (Claude/GPT-feedback)

Oppdater headeren i detaljpanelet (linje 510-519):
- Større navn (16px bold i stedet for 14px)
- Undertekst med selskap · stilling · sted på én linje
- Tags-rad under: signal-badge, innkjøper-pill, CV-pill
- Heat score-visning med numerisk verdi og reasons-breakdown

### 6. Kontaktlisten: vis firma under navn (GPT punkt 3)

I tabellraden: vis selskapsnavn som sekundær tekst (12px, muted) under kontaktnavnet, i stedet for egen kolonne. Dette frigjør plass til heat-kolonnen. Full-bredde tabellen beholder selskapskolonnen, men kompakt-modus (med detaljpanel) bruker navn+firma i én celle.

### 7. Sortering på varme

Legg til `heat` som nytt SortField. Sorter primært på tier (ASC), sekundært på score (DESC). Gjør dette til default sortering.

## Tekniske endringer

### `src/pages/DesignLabContacts.tsx`
- Importér `getHeatResult, getTaskStatus, calcHeatScore` fra `@/lib/heatScore`
- Utvid contact-mapping med `heatResult`
- Oppdater `SortField` type med `"heat"`
- Endre default sort til `{ field: "heat", dir: "asc" }`
- Oppdater `SignalChip` med fargekart per signal
- Ny `HeatBadge`-komponent for temperatur-pill i V8-farger (desaturerte)
- Oppdater grid-layout for full og kompakt modus:
  - Kompakt: `Navn+firma | Signal | Varme` 
  - Full: `Navn | Signal | Selskap | Stilling | Eier | Varme`
- Oppdater detaljpanel-header med større navn, metadata-linje og tags
- Legg til heat score-seksjon i detaljpanel-headeren

Ingen andre filer endres. All eksisterende query-logikk beholdes uendret.

