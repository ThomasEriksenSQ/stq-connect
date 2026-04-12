

## Plan: Redesign markedsradar-ukesmail

### Mål
Oppgradere HTML-mailen til et profesjonelt, minimalistisk design som er gjenkjennbart som STACQ CRM. Beholder all eksisterende data og logikk, kun `buildHtml`, `section` og `renderBulletRows` endres.

### Designretning
- Hvit bakgrunn (#ffffff) med subtil ytre ramme (#f5f5f5)
- STACQ-logo som tekst i header med blå aksent (#2563eb, matching primary)
- Rene seksjonsdelere, god luft, Inter-lignende systemfont
- Statistikk-kort øverst (annonser denne uken, unike selskaper, teknologier i vekst) i en horisontal rad
- Seksjonstitler med uppercase tracking som matcher CRM-designsystemet
- Tabellaktig layout for selskaper/kontakter i stedet for bullet-lister
- CTA-knapp i STACQ-blå (#2563eb) i stedet for svart
- Footer med subtil grå linje og STACQ-branding

### Tekniske endringer

**Fil: `supabase/functions/markedsradar-ukesmail/index.ts`**

Kun funksjonene `buildHtml` (linje 465-537), `section` (linje 456-463) og `renderBulletRows` (linje 441-454) endres:

1. **`renderBulletRows`** — Ny versjon med cleanere spacing, venstre blå aksent-linje per rad, bedre typografi
2. **`section`** — Oppdatert med mer luft, tynnere delere, og uppercase titler som matcher CRM
3. **`buildHtml`** — Ny layout:
   - Header: Hvit bakgrunn, STACQ-logo venstrejustert, dato høyrejustert, tynn bunnlinje
   - Statistikk-stripe: 3 nøkkeltall i en rad med tall + label
   - AI-oppsummering i en subtil blåtonet boks
   - Seksjoner med rene delere og bedre spacing
   - CTA-knapp i blå (#2563eb) med avrundede hjørner
   - Footer: Minimalistisk med STACQ CRM-tekst

Ingen endringer i datalogikk, snapshot-bygging, eller utsendelseslogikk.

### Etter implementering
Deploy edge function, deretter kan du sende testmail fra Innstillinger-siden.

