

## Mockbilder + mindre hovedoppslag

To enkle justeringer på `/design-lab/news` (kun Fase 1 / mock — ingen backend).

### 1. Bilder på mock-saker

I dag har alle mock-items `image.url: null`, så Plan C SVG-fallbacken med selskapsnavnet vises overalt. For at designet skal føles ekte i mock-fasen, byttes dette til **Unsplash redaksjonelle bilder** (gratis, hotlinkbart, ingen API-nøkkel), valgt per sak slik at hver illustrasjon passer tema:

- Defensico (lead, forsvar/radar) → radar/teknologi
- Kongsberg Defence → industri/produksjon
- Nordic Semiconductor → kretskort/elektronikk
- Aker BP → offshore/olje
- Kongsberg Geospatial → satellitt/luftrom
- Equinor → energi
- Telenor → nettverk/antenner

Alle URL-er hentes fra `images.unsplash.com` med faste `?w=` og `?q=` parametre slik at filstørrelsen er forutsigbar og bildene laster raskt. `image.source` settes til `"og"` (simulerer at Plan A ville ha truffet i produksjon). Briefs forblir uten bilder (per spec — kun titler + meta).

`DesignLabMediaFrame` håndterer allerede `onError`-fallback til Plan C, så hvis Unsplash er nede vises selskapsnavnet — robust uten ekstra kode.

### 2. Mindre hovedoppslag

Hovedoppslaget bruker i dag full sidebredde (1100px) med 16:9-format → ~619px høyt bilde, som dominerer skjermen. Dette gjør forsiden mer "blogginnlegg" enn "avisforside".

**Endring:** hovedoppslaget får en to-kolonne layout på desktop (`≥ 760px`):

```text
┌─────────────────────────────────────────────────────────┐
│  [bilde 16:9]      KICKER                               │
│  width: 520px      Tittel (22/600)                      │
│  ratio: 16:9       Ingress (13/400, 3 linjer)           │
│                    kilde · dato      Les saken →        │
└─────────────────────────────────────────────────────────┘
```

- Bildekolonne: 520px fast bredde, fortsatt 16:9 (≈ 293px høyt — ca. halvparten av før).
- Tekstkolonne: tar resten, vertikalt sentrert mot bildets høyde.
- Mellomrom: 32px gap.
- **Mobil (`< 760px`):** kollapser til dagens stablede layout (bilde over tekst, full bredde) — ingenting endres på smale skjermer.

Features (4:3, 3 kolonner) og briefs er uendret.

### Filer som endres

- `src/pages/DesignLabNews.tsx`
  - Erstatt `image.url: null` med tematiske Unsplash-URL-er på lead + 6 features. Sett `image.source: "og"`.
  - Skriv om `LeadStory` til to-kolonne flex med 520px bildekolonne og responsiv kollaps under 760px.

Ingen endringer i `news.ts`, `media.tsx`, datamodell, scoring eller noe i Fase 2-planen. Ingen sidemenyendringer.

### Verifisering

1. `/design-lab/news` viser ekte bilder på alle features og hovedoppslag.
2. Hovedoppslaget er tydelig mindre — bilde til venstre, tekst til høyre, ca. 293px høyde på desktop.
3. Resize til < 760px → hovedoppslaget kollapser til stack (bilde over tekst).
4. Slå av nett / blokker `images.unsplash.com` → Plan C SVG-fallback med selskapsnavn vises automatisk, layout står stille.
5. Features og briefs uendret.

