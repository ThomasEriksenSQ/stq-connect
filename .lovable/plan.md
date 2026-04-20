

## Justering: prioritering av "varme" selskaper i STACQ Daily

I dag scorer planen kun på `company_weight` (Kunde 2.0 / Potensiell kunde 1.0) + recency + source_tier. Det betyr at de største og mest medieomtalte selskapene (Equinor, Telenor, DNB osv.) vil dominere forsiden — selv om de ikke er der vi har varmeste salgspipeline. Vi flytter vekten over på selskaper som matcher de varmeste kontaktene fra `/kontakter`.

### Endring i scoringsmodell (§5)

`company_weight` erstattes med en kombinert vekt som tar inn varmeste-score per selskap:

```
company_weight = base_weight + heat_boost

base_weight (uendret intensjon, men dempet rolle):
  Kunde            = 1.0
  Potensiell kunde = 0.6

heat_boost (NY — basert på varmeste kontakter knyttet til selskapet):
  Tier 1 (Hett)        = +2.0
  Tier 2 (Lovende)     = +1.2
  Tier 3 (Følges opp)  = +0.6
  Tier 4 (Kaldt)       = +0.0
  ingen kontakter      = +0.0

Selskap uten kontakter eller med kun Tier 4-kontakter
faller dermed tilbake til ren base_weight, og blir
sjelden lead-kandidat selv om det har mye presse.
```

Heat-tier per selskap = **høyeste tier blant aktive kontakter** knyttet til selskapet (`contacts.company_id`). Bruker eksisterende `getHeatScore()`-modell fra `src/lib/heatScore.ts` — samme logikk som ranker `/kontakter`.

**Resultat:** Et lite "Potensiell kunde"-selskap med en Hett kontakt får `0.6 + 2.0 = 2.6`, høyere enn en stor Kunde uten varme kontakter (`1.0 + 0.0 = 1.0`). Salgsrelevansen styrer forsiden.

### Endring i selskapsutvalg (§1, §17)

Fortsatt grunnfilter: `companies.status` = "Potensiell kunde" eller "Kunde". **Ingen endring der** — kontaktrangering brukes kun til vekting, ikke til å utvide eller snevre inn listen. Dette unngår at varme kontakter på "Inaktiv"-selskaper trekker inn støy.

### Konsekvenser for picking (§5)

Picking-logikken (1 lead + 6 features + 5 briefs etter score desc) er uendret — kun underliggende score-formel justeres. Kvalitetsterskel `score < 0.4` beholdes, men evalueres på nytt i Fase 2 etter første ekte kjøring (heat_boost kan løfte gjennomsnittsscoren).

### Datamodell

Ingen endringer i `NewsItem` eller `news_daily`. Heat-tier beregnes i edge function (Fase 2) ved start av kjøring og caches per `company_id` for hele kjøringen. Ikke lagret i payload — det er en input til scoring, ikke et UI-felt.

### Mockdata (Fase 1)

`MOCK_LEAD` og `MOCK_FEATURES` justeres slik at sekvensen reflekterer ny prioritering: et mindre "Potensiell kunde"-selskap med åpenbar varme (f.eks. Defensico eller Kongsberg Geospatial) kan nå være lead foran Equinor/Telenor. Dette demonstrerer modellen visuelt.

### Memory

Oppdater `mem://features/design-lab/news-page` med:
- "Scoring kombinerer base_weight (Kunde/Potensiell kunde) + heat_boost basert på varmeste kontakt per selskap. Heat-tier hentes fra getHeatScore() — samme som /kontakter."
- "Selskapsutvalg styres kun av companies.status; heat brukes til vekting, ikke filter."

### Verifisering

1. **Fase 1 (nå):** Mock-rekkefølgen viser et mindre, varmt selskap som lead — ikke det største selskapet i porteføljen.
2. **Fase 2:** Loggfør beregnet `heat_tier` per selskap i strukturert log slik at vi kan revidere vektene etter første uke.
3. **Fase 2:** Test med selskap som har 0 kontakter → `heat_boost = 0` → faller naturlig nedover, men kan fortsatt nå briefs hvis source_tier × recency er høy.

### Hva som IKKE endres

- Ingen endring i deduplisering, disambiguering, to-pass-henting, bildestrategi, cron, RLS, JSON-skjema eller layout.
- Ingen ny tabell, ingen ny route.
- Ingen UI-eksponering av heat-score på `/design-lab/news` — det er kun en intern rangeringsfaktor.

