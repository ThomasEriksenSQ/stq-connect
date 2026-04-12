

## Plan: Juster markedsradar-epost (3 endringer)

### Endringer i `supabase/functions/markedsradar-ukesmail/index.ts`

#### 1. Fjern "Ledige konsulenter"-seksjonen
- Fjern linje 660 (seksjon-kallet for konsulenter)
- Fjern konsulent-relatert kode: `consultantRows` (linje 589-592), `findConsultantMatches`-kallet og parameteren i `buildHtml`
- Beholder `findConsultantMatches`-funksjonen for eventuell fremtidig bruk, men kaller den ikke

#### 2. Gjør teknologi-trendbaren mer lesbar
Erstatt den numeriske heatmap-baren med en enklere visuell bar + uke-labels. Ny layout per teknologi:
- **Navn — antall siste 30d — trendpil** (beholdes)
- Under: erstattes med en enkel horisontal stolpediagram der bredden representerer antall, med uke-nummer som label over. Lettere å forstå enn fargekodede tall-ruter.
- Alternativt: Fjern heatmap helt og vis kun tekst med trendpil + "siste 30d vs forrige 30d" som er umiddelbart forståelig

#### 3. Øk bredden på e-posten
- Endre `max-width:620px` (linje 610) til `max-width:720px`
- Justér ikke annet — alle seksjoner flyter naturlig med bredere container

### Deploy
Deploy `markedsradar-ukesmail` edge function etter endringene.

