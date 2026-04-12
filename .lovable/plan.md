

## Plan: Utvid markedsradar-eposten med mer nytteverdi

### Oversikt
Implementer 5 forbedringer i `supabase/functions/markedsradar-ukesmail/index.ts` som gjør e-posten mer handlingsorientert og innsiktsrik. Kontaktpersoner beholdes som egen seksjon.

### Endringer

#### 1. Uke-over-uke trendpiler (ide 1)
Legg til retningsindikatorer i statistikk-boksen og teknologi-seksjonen.
- Utvid `buildMarketSnapshot` til å beregne `previousWeekAds` (annonser forrige uke) og delta
- Stats-boksen viser `↑12` eller `↓3` ved siden av ukens antall annonser
- Teknologi-rader viser `▲` / `▼` / `–` foran deltaet med grønn/rød fargekode

#### 2. "Nye selskaper denne uken" som egen seksjon (ide 2)
Identifiser selskaper som dukker opp for aller første gang (ikke bare "ikke i CRM").
- I `buildMarketSnapshot`: sammenlign selskapene fra `latestWeek` mot alle tidligere uker i datasettet
- Nytt felt `firstTimerCompanies` i `MarketSnapshot` — selskaper der alle annonser er fra siste uke
- Ny seksjon i HTML: "Nye selskaper denne uken" med teksten "Selskaper som dukker opp for første gang i markedsradaren"
- Plasseres etter "Selskaper å følge opp", før kontaktpersoner

#### 3. Direkte handlingslenker per selskap (ide 3)
Gjør det enklere å handle direkte fra e-posten.
- Selskaper i CRM: lenke til `crm.stacq.no/selskaper/{id}` (allerede implementert)
- Selskaper ikke i CRM: lenke til `crm.stacq.no/selskaper?ny={name}` (allerede implementert)
- Ny: Legg til en tydelig "Åpne" / "Opprett" knapp-stil lenke (liten blå pill) etter hvert selskap i stedet for bare inline `<a>` på navnet
- Kontaktpersoner: legg til klikkbar `mailto:` på e-post og `tel:` på telefon (som vist i screenshotet er dette delvis på plass, men inkonsistent — noen mangler lenker)

#### 4. Konsulent-match-hint (ide 4)
Vis hvilke ledige STACQ-konsulenter som matcher teknologitrendene.
- Query `stacq_ansatte` med `kompetanse` og `tilgjengelig_fra` (ledige nå eller innen 30 dager)
- For de topp 3 teknologiene i vekst: finn ansatte med matchende kompetanse
- Ny seksjon "Ledige konsulenter" etter teknologi-seksjonen: "Konsulenter som matcher ukens etterspørsel"
- Viser: `Navn — kompetanse · Ledig fra {dato}`
- Enkel tag-matching (ingen AI-kall nødvendig)

#### 5. Mini-heatmap per teknologi (ide 6)
Visuell 8-ukers trendbar for topp teknologier.
- I `buildMarketSnapshot`: bygg en `weekSeries` per teknologi (siste 8 uker) med antall annonser per uke
- I HTML: under hver teknologi-rad, vis 8 fargede blokker (inline `<td>`) der fargemetning varierer med antall (hvit → lyseblå → STACQ-blå)
- Fungerer som en sparkline i ren HTML/inline CSS (e-postkompatibelt, ingen bilder)

### Filer som endres
- `supabase/functions/markedsradar-ukesmail/index.ts` — all logikk og HTML

### Rekkefølge av seksjoner i e-posten etter endring
1. Header + Stats (med uke-over-uke delta)
2. AI-oppsummering
3. Teknologier i vekst (med heatmap-bar og trendpiler)
4. Ledige konsulenter (ny)
5. Selskaper å følge opp (med handlingslenker)
6. Nye selskaper denne uken (ny)
7. Kontaktpersoner (beholdes som i dag, med klikkbare telefon/e-post)
8. Ikke i CRM
9. CTA + Footer

### Etter implementering
Deploy edge function, send testmail fra Innstillinger-siden.

