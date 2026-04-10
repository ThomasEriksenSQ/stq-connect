

## Plan: Plausible Analytics-dashboard under stacq.no-fanen

### Hva bygges

En ny fane "Nettside besøk" som første fane i stacq.no-siden (`NettsideAI.tsx`), med et dashboard som viser besøksstatistikk fra Plausible.io API v2.

### Arkitektur

API-nøkkelen kan ikke sendes fra frontend (CORS + sikkerhet), så vi lager en **edge function** som proxy.

### 1. Edge function: `plausible-stats`

**Fil:** `supabase/functions/plausible-stats/index.ts`

- Tar imot POST med `{ query_type, date_range }` fra frontend
- Videresender til `https://plausible.io/api/v2/query` med `site_id: "stacq.no"` og Bearer-token fra `PLAUSIBLE_API_KEY` secret
- Returnerer JSON-responsen med CORS-headers
- Støtter flere forhåndsdefinerte spørringer:
  - **aggregate**: visitors, visits, pageviews, bounce_rate, visit_duration
  - **timeseries**: visitors over tid med `time:day` dimensjon
  - **top_pages**: topp sider (`event:page` dimensjon)
  - **top_sources**: trafikkkilder (`visit:source` dimensjon)
  - **top_countries**: land (`visit:country_name` dimensjon)
  - **devices**: enhetstyper (`visit:device` dimensjon)

### 2. Secret: `PLAUSIBLE_API_KEY`

Be brukeren legge inn API-nøkkelen via secrets-verktøyet.

### 3. Frontend: `NettsideBesokTab` komponent

**Ny fil:** `src/components/nettside/NettsideBesokTab.tsx`

Dashboard med følgende seksjoner:

- **Datovelger**: Chips for 7d / 30d / 6mo / 12mo
- **KPI-kort** (4 stk): Besøkende, Sidevisninger, Avvisningsrate, Besøkstid
- **Tidsserie-graf**: Linjediagram med besøkende over tid (bruker eksisterende `ChartContainer` fra `chart.tsx`)
- **Topp sider**: Tabell med side og antall besøkende
- **Trafikkkilder**: Tabell med kilde og besøkende
- **Land**: Tabell med land og besøkende
- **Enheter**: Enkel fordeling Desktop/Mobil/Tablet

### 4. Oppdater `NettsideAI.tsx`

- Legg til ny `TabsTrigger` "Nettside besøk" som **første** tab (foran "Konsulenter")
- Legg til tilhørende `TabsContent` som rendrer `NettsideBesokTab`
- Endre `defaultValue` til `"besok"`

### Tekniske detaljer

- Edge function validerer input med enkel sjekk (ikke Zod da det er enkle predefinerte verdier)
- Frontend bruker `@tanstack/react-query` for data-fetching
- Recharts via eksisterende `ChartContainer`/`ChartTooltip` for graf
- Alle tall formateres med `toLocaleString("nb-NO")`
- Bounce rate vises som prosent, visit duration formateres til min:sek
- Filer som endres/opprettes: 3 (1 edge function, 1 ny komponent, 1 eksisterende side)

