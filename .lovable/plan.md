

## Mål
Legg til en ny **fane** på `/design-lab/news` som viser den faktiske kildelisten — selskapene nyhetene baseres på — i nøyaktig samme rekkefølge som brukeren ser dem på `/kontakter`. Denne listen skal også bli den autoritative kilden som edge-funksjonen `news-daily-digest` bruker, slik at nyhetspipelinen og UI-listen alltid er synkronisert.

## Hva vises i fanen
For hvert selskap én rad med:
- Selskapsnavn
- Org.nr (hvis tilgjengelig)
- Nettsted (hvis tilgjengelig — klikkbar lenke)
- LinkedIn (hvis tilgjengelig — klikkbar lenke)

Pluss en liten posisjonsnummerering (1, 2, 3 …) til venstre, og total-teller øverst.

## Rangering — eksakt som /kontakter (default)
1. Hent kontakter med samme query og samme filtre som `Contacts.tsx` bruker som default:
   - Ekskluder `ikke_aktuell_kontakt = true`
   - Ekskluder kontakter hvis `companies.ikke_relevant = true`
   - Inkluder kun kontakter hvor `companies.status IN ('prospect', 'customer')` (Potensiell kunde / Kunde)
2. Beregn `tier` og `heatScore` per kontakt med samme `getHeatResult` fra `src/lib/heatScore.ts` som kontaktsiden bruker (signal, innkjøper, markedsradar, aktiv forespørsel, overdue, dager siden siste aktivitet, m.m.).
3. Sorter kontaktene med samme `priority desc`-logikk: lavest tier først, deretter høyest heatScore.
4. Gå listen ovenfra og ned, ta selskapet til hver kontakt, og **dedupliser** — første gang et selskap dukker opp beholdes posisjonen, alle senere forekomster droppes. Slik får selskapet rangen til sin høyest rangerte kontakt.

Resultat: rekkefølgen på selskapsfanen matcher 1:1 hva brukeren ser øverst i Kontakter når default sortering er aktiv.

## Datakilde + delt logikk
For å unngå avvik mellom "hva brukeren ser" og "hva fanen viser":

- Lag en ny shared helper `src/lib/newsSourceCompanies.ts` som:
  - Eksporterer en funksjon `rankCompaniesFromContacts(contacts, requests, finn, tasks, activities)` som tar samme rådata som Contacts-siden og returnerer en ordnet liste `{ companyId, name, orgNumber, website, linkedin, rank }[]` filtrert på `prospect`/`customer` og deduplisert.
  - Bruker `getHeatResult` fra `heatScore.ts` (samme funksjon som /kontakter), så reglene kan ikke divergere.

- Frontend-fanen kaller denne via en lett `useQuery` (samme pattern som Contacts-siden, men kun nødvendige felter).

## Ny fane-struktur på /design-lab/news
Legg til en enkel taberad rett under masthead, i tråd med Design Lab V8-stilen (Linear-aktig, ingen tunge chips):

```text
STACQ Daily
torsdag 21. apr. 2026 · 14 saker

[ Nyheter ]   [ Kildeliste ]
─────────────
```

- "Nyheter": dagens innhold (eksisterende layout, uendret).
- "Kildeliste": ny tabellvisning.

Tab-stil: 13 px tekst, `font-weight: 500`, aktiv tab har `border-bottom: 2px solid C.text`, inaktiv er `C.textMuted`. Ingen pillebakgrunner.

## Tabellutforming for "Kildeliste"
Tett, lesbar Linear-stil med V8-tokens:

```text
#    SELSKAP                       ORG.NR        NETTSTED           LINKEDIN
1    Forsvarets Forskningsinst.    971 525 893   ffi.no →           in →
2    Tomra Systems ASA             927 124 238   tomra.com →        in →
3    Experis                       —             experis.no →       —
…
```

- Rad-høyde ca. 34 px, `border-bottom: 1px solid C.borderLight`.
- `#`-kolonne: 40 px, `C.textFaint`, tabular nums.
- Selskapsnavn: 13 px, `C.text`, `font-weight: 500`.
- Org.nr: 12 px, tabular nums, `C.textMuted`, formattert med tusenskille.
- Nettsted/LinkedIn: 12 px lenker, `C.text` med `target="_blank"`. Tom verdi vises som `—` i `C.textGhost`.
- Hover på rad: `background: C.hoverBg`.
- Header-rad: 11 px, uppercase OFF (i tråd med V8), `C.textFaint`.

Øverst over tabellen en kort meta-linje:
> "Listen er sortert eksakt som Kontakter-siden (Potensiell kunde + Kunde, deduplisert)."
Pluss totalantall: "X selskaper".

## Edge function — bruk samme rangering
Oppdater `supabase/functions/news-daily-digest/index.ts` slik at den bruker den samme rangerte listen i stedet for nåværende heat-aggregering:

- Behold dagens query for kontakter/aktiviteter, men flytt sorterings-/dedupliserings-logikken til en delt port av `rankCompaniesFromContacts` (Deno-versjon under `supabase/functions/_shared/newsSourceCompanies.ts`, samme regler som klient-helpere).
- Resultatet brukes direkte som søkerekkefølge for Perplexity (varmest øverst).
- Selskaper utenfor `prospect`/`customer` ekskluderes (uendret), men nå garantert i samme rekkefølge som UI-fanen viser.
- Pass 1 = topp ~50 selskaper (varmest), Pass 2 = resten av listen ved behov.

## Filer som endres / opprettes
**Nye:**
- `src/lib/newsSourceCompanies.ts` — delt rangerings-/dedupliseringslogikk for klient.
- `supabase/functions/_shared/newsSourceCompanies.ts` — Deno-port av samme logikk.
- `src/components/designlab/news/SourceListTab.tsx` — selve tabell-komponenten.

**Endres:**
- `src/pages/DesignLabNews.tsx` — legg til tab-state (`"news" | "sources"`), tab-bar under masthead, render `SourceListTab` når valgt.
- `supabase/functions/news-daily-digest/index.ts` — bytt nåværende sortering ut med shared helper.

## Akseptkriterier
1. Fanen "Kildeliste" på /design-lab/news viser kun selskaper med `status` Potensiell kunde eller Kunde, uten duplikater.
2. Rekkefølgen på fanen matcher topp-til-bunn rekkefølgen brukeren ser på /kontakter med default sortering (priority desc).
3. Hver rad viser navn, org.nr, nettsted, LinkedIn — manglende felter vises som "—".
4. Lenker åpner i ny fane.
5. Edge-funksjonen `news-daily-digest` bruker samme rangerte selskapsliste som fanen viser, slik at "viktigste selskap øverst" gjelder både i UI og i nyhetsuthenting.
6. Eksisterende "Nyheter"-fane er uendret i utseende og oppførsel.

