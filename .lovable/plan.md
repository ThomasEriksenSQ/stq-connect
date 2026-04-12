

## Plan: Unifiser e-postdesign for fornyelsesvarsler, salgsagent-påminnelse og task-due-reminder

### Mål
Oppdater HTML-designet i tre edge functions til å matche markedsradar-stilen: hvit bakgrunn, STACQ CRM header med blå aksent, 720px bredde, avrundede kort, og konsistent typografi.

### Filer som endres

#### 1. `supabase/functions/fornyelse-varsel-epost/index.ts`
- Erstatt gammel HTML (linje 124-157) med markedsradar-designet:
  - `max-width:720px`, `background:#f8fafc`, hvitt kort med `border-radius:8px` og `box-shadow`
  - Header: STACQ + CRM med `border-bottom:2px solid #2563eb` (erstatter svart header)
  - Tittel-seksjon med blå "Ukentlig rapport" label
  - Stats-boks med antall oppdrag per segment (kritisk/snart/planlegg)
  - Seksjoner bruker `<table>` layout i stedet for `display:flex` for bedre e-postklient-kompatibilitet
  - CTA-knapp i blå (#2563eb) i stedet for svart
  - Footer med `border-top:1px solid #e2e8f0` og `color:#94a3b8`

#### 2. `supabase/functions/salgsagent-paaminning/index.ts`
- Erstatt enkel HTML (linje 108-119) med full markedsradar-wrapper:
  - Samme header, padding, og footer som markedsradar
  - Tittel: "Salgsagent-påminnelse"
  - Innholdstekst i en subtil info-boks (lik AI-oppsummering-boksen)
  - CTA: "Åpne STACQ →" i blå knapp
  - Lenke til `crm.stacq.no` i stedet for `stq-connect.lovable.app`

#### 3. `supabase/functions/task-due-reminder/index.ts`
- Erstatt enkel HTML (linje 68-76) med full markedsradar-wrapper:
  - Samme header og footer
  - Tittel: "Oppfølging forfaller" med oppgavetittel
  - Kontakt og selskap i undertekst
  - Forfaltdato med rød/normal fargekode
  - CTA: "Åpne i CRM →" i blå knapp

### Deploy
Deploy alle tre edge functions etter endringene.

