

## Legg til "Selskaper med sterkest signal" i Markedsradar-eposten

### Hva
Legge til en ny seksjon i ukentlig e-post som viser topp 8 selskaper rangert etter signalstyrke, med visuell score-bar, teknologier og kontaktinfo -- tilsvarende den nye listen på Markedsradar-siden.

### Endringer

**Fil:** `supabase/functions/markedsradar-ukesmail/index.ts`

1. **Utvid `MarketSnapshot.topCompanies`** fra `.slice(0, 5)` til `.slice(0, 8)` (linje 438) for å gi nok data til den nye seksjonen.

2. **Ny renderfunksjon `renderSignalRanking`** som bygger en HTML-tabell med:
   - Rangeringsnummer (1-8) og selskapsnavn i bold
   - Horisontal score-bar via en `<td>` med inline `width: X%` og `background: #2563eb` (relativ til høyeste score)
   - Topp 3 teknologier som tekst + antall kontakter i blått
   - Antall annonser og "X denne uken" til høyre
   - Klikkbart selskapsnavn (lenke til CRM)

3. **Sett inn seksjonen** etter AI-oppsummeringen og før "Teknologier i vekst" (rundt linje 658), med tittelen "SELSKAPER MED STERKEST SIGNAL" og undertekst "Rangert etter annonsefrekvens, tilgjengelig kontaktinfo og relevante teknologier."

4. **Fjern den eksisterende "Selskaper å følge opp"-seksjonen** (linje 662) siden den nye seksjonen erstatter den med bedre visuell fremstilling.

5. **Deploy** edge function etter endring.

### Resultat
E-posten får en visuelt tydelig rangert liste over de viktigste selskapene, med score-barer som gjør det enkelt å se hvilke selskaper som har sterkest signal -- samme format som på nettsiden.

