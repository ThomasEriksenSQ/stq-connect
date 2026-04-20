

## `/design-lab/news` — STACQ Daily v3 (final)

Justert etter Claude + GPT-feedback. Strammet på datamodell, RLS, JSON-skjema, primitives-disiplin og scoring-heuristikk. Faseinndeling beholdt.

---

### 1. Konsept

Daglig redigert nyhetsforside for selskaper i CRM med `companies.status` som tilsvarer "Potensiell kunde" eller "Kunde". **Ikke** i venstremenyen — kun direkte URL `/design-lab/news`. **1 lead + 6 features + 5 briefs.**

---

### 2. V2-forankring — konservativ primitives-policy

Ny test før noe løftes til `src/components/designlab/system/`: *"Brukes minst ett annet sted i V2/design-lab innen rimelig tid?"* Hvis nei → hold lokalt i `DesignLabNews.tsx`.

| Primitive | Status | Begrunnelse |
|---|---|---|
| `DesignLabMediaFrame` | **Løft til system** | Bildecontainer m/aspect-ratio + fallback er gjenbrukbar (konsulentkort, selskapslogoer, profilbilder). |
| `DesignLabSectionHeader` | **Løft til system** | Brukes allerede ad-hoc flere steder; konsoliderer mønster. |
| `DesignLabKicker` | **Lokal** (i `DesignLabNews.tsx`) | I praksis bare typografivariant. Løftes hvis behov oppstår senere. |
| `DesignLabMetaRow` | **Lokal** | Side-spesifikk komposisjon (kilde · dato · lenke). |

Stilark (`/design-lab/stilark`) får kun de to godkjente primitives — ikke de lokale.

**Shell:** `<DesignLabPageShell activePath="/design-lab/news" title="STACQ Daily" maxWidth={1100}>`. Tokens kun fra `src/theme.ts`. Inter 400/500/600.

---

### 3. Layout og responsivitet

Faste bildeforhold mot layout shift. `line-clamp: 2` titler, `line-clamp: 3` ingresser.

| Bredde | Hovedoppslag | Features | Briefs |
|---|---|---|---|
| `< 640px` | 1 kol, 16:9 | 1 kol stack | 1 kol |
| `640–960px` | 1 kol, 16:9 | 2 kol | 1 kol |
| `> 960px` | 1 kol, 16:9 (1200×675) | 3 kol (4:3, 800×600) | 1 kol |

48–64px vertikal luft mellom soner. Hårfine `C.borderLight`-skiller. Ingen kort-borders.

---

### 4. Felles datamodell — diskriminert union

```ts
type SourceTier = 1 | 2 | 3;

type NewsImage = {
  url: string | null;
  source: 'og' | 'company_logo' | 'placeholder';
};

type NewsItemBase = {
  id: string;                          // hash av normalisert URL
  primary_company_id: string;
  primary_company_name: string;
  also_matched_company_ids: string[];  // se §10 for UI-bruk
  title: string;
  url: string;                         // kanonisk, UTEN UTM
  source: string;                      // hostname-label
  source_tier: SourceTier;
  published_at: string;                // ISO
  image: NewsImage;
  score: number;
};

type NewsLead    = NewsItemBase & { variant: 'lead';    ingress: string };
type NewsFeature = NewsItemBase & { variant: 'feature'; ingress: string };
type NewsBrief   = NewsItemBase & { variant: 'brief';   ingress: null  };
type NewsItem = NewsLead | NewsFeature | NewsBrief;

type NewsDailyPayload = {
  items: NewsItem[];                   // sortert: lead, features..., briefs...
  generated_at: string;
  generation_version: string;          // f.eks. "v1.0"
};
```

Mock og produksjon bruker samme typer. Briefs har eksplisitt `ingress: null` — ingen tomme strenger.

---

### 5. Redaksjonell seleksjon — forenklet heuristikk

Lavere maksbonus, keyword som tiebreaker, ikke hoveddriver.

```
score = company_weight × recency × source_tier + keyword_tiebreaker

company_weight:
  Kunde            = 2.0
  Potensiell kunde = 1.0

recency (lineær):
  < 6t   = 1.0
  6–24t  = 1.0 → 0.6
  24–72t = 0.6 → 0.3   (kun fallback-pass, se §7)
  > 72t  = forkast

source_tier:
  tier 1 = 1.0
  tier 2 = 0.8
  tier 3 = 0.5

keyword_tiebreaker (maks +0.15 totalt, ren tiebreaker):
  +0.05 per treff i tittel: kontrakt, oppkjøp, kvartal,
  emisjon, permittering, børsnotering, konkurs, fusjon
```

**Kvalitetsterskel:** items med `score < 0.4` forkastes. Hvis < 6 saker over terskel → vis empty state heller enn å fylle med støy.

**Picking:** sorter etter score desc → topp 1 = lead, neste 6 = features, neste 5 = briefs.

---

### 6. Deduplisering

Hash av normalisert URL: strip `utm_*`, `fbclid`, `gclid`, `?ref=`, `#fragment`, lowercase host, fjern trailing slash. Behold første treff. Andre selskaper akkumuleres i `also_matched_company_ids`. Primært selskap = høyest `company_weight` × eksplisitt navn-treff i tittel.

UTM påvirker **ikke** dedup (normalisering skjer først). UTM legges på i presentasjonslaget via helper:

```ts
withUtm(url, { source: 'stacq', medium: 'daily' })
```

`url`-feltet i payload er alltid kanonisk uten UTM.

---

### 7. To-pass henting (24t → 72t fallback)

1. **Pass 1:** `search_recency_filter: 'day'`, prompt sier "siste 24 timer". Kjør scoring + terskel.
2. Hvis < 12 saker over terskel: **Pass 2:** `search_recency_filter: 'week'`, prompt sier "siste 72 timer", filtrer ut alt > 72t i scoring-laget. Slå sammen med pass 1, dedup, scor på nytt.
3. Hvis fortsatt < 6 saker over terskel → empty state.

---

### 8. Disambiguering — prompt + post-filter

**Prompt-tillegg per selskap:**
> "Inkluder kun saker hvor selskapet eksplisitt nevnes ved fullt navn `{name}`, eller hvor sammenheng med `{hjemmeside}`-domenet/bransjen er åpenbar. Forkast saker om personer, kommuner eller andre selskaper med lignende navn."

Send med `hjemmeside` (og `org_number` hvis tilgjengelig — feltet finnes ikke på `companies` i dag, så bruk `org_number` kun hvis det legges til senere).

**Post-filter (edge function):** tittel ELLER ingress må inneholde eksakt selskapsnavn (case-insensitive) eller registrert alias fra `company_aliases.alias_name`. Ellers forkastes saken.

---

### 9. Perplexity Sonar — fullt JSON-skjema

**Modell:** `sonar`. **Batch:** 10 selskaper/kall. **Hard cap:** 30 kall/dag. **Retry:** maks 2 per failed batch, exponential backoff (1s, 4s) — atskilt fra dagskvoten.

```ts
{
  model: 'sonar',
  messages: [
    { role: 'system', content: 'Svar på norsk. Prioriter norske kilder. Bruk engelske kun hvis ingen norske finnes. Returner kun reelle nyhetssaker fra siste 24 timer (eller 72 i fallback-pass).' },
    { role: 'user', content: prompt_med_batch_og_disambiguering }
  ],
  search_recency_filter: 'day',  // eller 'week' i fallback-pass
  search_domain_filter: SOURCE_DOMAINS,  // se §11
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'news_results',
      schema: {
        type: 'object',
        required: ['stories'],
        properties: {
          stories: {
            type: 'array',
            items: {
              type: 'object',
              required: ['company_name', 'title', 'ingress', 'url', 'source', 'published_at'],
              properties: {
                company_name: { type: 'string', maxLength: 120 },
                title:        { type: 'string', minLength: 10, maxLength: 140 },
                ingress:      { type: 'string', minLength: 20, maxLength: 300 },
                url:          { type: 'string', format: 'uri' },
                source: {
                  type: 'string',
                  enum: ['e24.no','dn.no','tu.no','finansavisen.no','kapital.no',
                         'nrk.no','hegnar.no','reuters.com','bloomberg.com','other']
                },
                published_at: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      }
    }
  }
}
```

---

### 10. `also_matched_company_ids` — vises i UI

Redaksjonelt verdifullt (cross-portfolio relevans). Vises i kicker når det finnes:

> **KONGSBERG DEFENCE** · også Aker, Equinor

Maks 2 sekundære navn vises, resten forkortes til "+ N til".

---

### 11. Kildedomener og tier-mapping (konstant i edge function)

```ts
// Førsteversjon — heuristikk, ikke fasit. Justeres ved evaluering.
const SOURCE_TIERS: Record<string, SourceTier> = {
  'e24.no': 1, 'dn.no': 1, 'reuters.com': 1, 'bloomberg.com': 1,
  'tu.no': 2, 'finansavisen.no': 2, 'kapital.no': 2, 'hegnar.no': 2,
  'nrk.no': 2,  // hevet fra 3 etter feedback
};
const DEFAULT_TIER: SourceTier = 3;

const SOURCE_DOMAINS = Object.keys(SOURCE_TIERS);
```

Ligger som éksportert konstant i `supabase/functions/news-daily-digest/sources.ts` for revisjon.

---

### 12. Bildestrategi — 3 nivåer + bestemt hosting

| Plan | Kilde | Validering |
|---|---|---|
| A | `og:image` fra kilde-URL | Realistisk User-Agent, 5s timeout, content-type `image/*`, min. 400×200px |
| B | `og:image`/favicon fra `companies.website` | Samme validering |
| C | Server-generert SVG | Selskapsnavn på `C.appBg`, `C.text`, `C.borderLight`-ramme |

**Hosting (besluttet):** **Mirror til Supabase Storage** ved generering. Bucket `news-images`, sti `news/{date}/{item-id}.{ext}`. Stabil URL i payload, overlever 404 på kilde, gir arkivverdi. Gamle bilder kan ryddes via cron etter 90 dager hvis nødvendig.

---

### 13. Empty state

Ved 0 items eller < 6 over kvalitetsterskel:

> **Ingen store nyheter i porteføljen i dag.**
> Kom tilbake i morgen.

Samme typografi som resten. Ingen error-rød, ingen ikoner.

---

### 14. Database

**Single source of truth-rydding:** metadata som kolonner, **ikke** i payload.

```sql
create table public.news_daily (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  payload jsonb not null,                    -- kun NewsItem[] + generation_version + generated_at
  generated_at timestamptz not null default now(),
  is_current boolean not null default true,
  status text not null default 'ok',         -- 'ok' | 'empty' | 'error'
  source_count integer not null default 0,
  company_count integer not null default 0,
  warnings jsonb not null default '[]'::jsonb
);

create unique index news_daily_current_per_date
  on public.news_daily(date) where is_current = true;

alter table public.news_daily enable row level security;

create policy "authenticated read news_daily"
  on public.news_daily for select to authenticated using (true);
```

`is_current` beholdes — gir trygg re-generering uten å slette historikk. Dokumentert som bevisst MVP-valg, ikke overengineering.

---

### 15. Klikk-tracking — utsatt til Fase 2b

Splittet ut av Fase 2 for å holde scope stramt. Implementeres separat når kjernen er stabil. Ingen DDL eller RLS i denne planen.

I mellomtiden: lenker bruker `withUtm()`-helper slik at server-logger på destinasjonssidene fanger kilde.

---

### 16. Cache-modell — A (cron + on-demand)

- **Cron:** `pg_cron` kjører `news-daily-digest` daglig **04:30 UTC** (≈05:30 vinter / 06:30 sommer norsk tid). **Eksplisitt MVP-kompromiss** — ikke endelig løsning. Kan flyttes til Supabase scheduled function med tidssone-støtte senere.
- **Frontend:** `select * from news_daily where date = current_date and is_current = true`. Hvis null rad → POST til edge function (idempotent via advisory lock).
- **Ingen 6t-regenerering.** Cron + on-demand-fallback er nok.

---

### 17. Edge function — `news-daily-digest`

Fil: `supabase/functions/news-daily-digest/index.ts` + `sources.ts`.

Flyt:
1. Hent companies med relevant status + `website`.
2. `pg_advisory_lock` på dagens dato. Låst → 202.
3. Sjekk hard cap (30 kall/dag).
4. Pass 1 (24t): batch á 10, kall Sonar med disambigueringskontekst.
5. Hvis < 12 over terskel → Pass 2 (72t).
6. Slå sammen, dedup, post-filter (navn/alias-match), scor, kvalitetsterskel.
7. Pick 1 + 6 + 5.
8. Bilder: Plan A → B → C, mirror til Storage.
9. Insert i `news_daily`. Forrige rad samme dato → `is_current=false`.
10. Strukturert log: `{ run_id, status, batches_called, items_returned, fallback_used }`.
11. Release lock.

**Secret:** `PERPLEXITY_API_KEY` (Perplexity-connector).

---

### 18. Monitoring — minimum

- Strukturert logging per kjøring (over).
- Status-kolonne i `news_daily` enables enkle dashboards/queries.
- Alerting (e-post ved 3 dager `status='empty'`/`'error'`) er ønske, **utsettes til Fase 2b** sammen med klikk-tracking.

---

### 19. Rute

`src/App.tsx` — lazy:
```tsx
<Route path="news" element={<DesignLabNews />} />
```
**Ikke** lagt til i `DesignLabSidebar.tsx`.

---

### 20. AI-modellanbefaling

**Perplexity Sonar.** Eneste reelle valg pga real-time web-grounding, `search_recency_filter`, `search_domain_filter` og strukturert JSON output. Start med `sonar`, oppgrader til `sonar-pro` kun hvis evals viser at dypere reasoning trengs.

---

### 21. Kostnadsestimat

| Modell | Per kall | Per dag (≤ 30 kall) | Per måned |
|---|---|---|---|
| `sonar` | ~$0.05 | ≤ $1.50 | ≤ $45 |
| `sonar-pro` | ~$0.30 | ≤ $9 | ≤ $270 |

Hard cap = 30 kall = trygg utgiftskontroll.

---

### 22. Designprinsipper

- Maks 1100px, sentrert.
- 1px `C.borderLight` på bilder, radius 4px, ingen skygge.
- Typografi:
  - Masthead: 28/600
  - Lead-tittel: 22/600 / line-height 1.2
  - Feature-tittel: 16/600
  - Brief-tittel: 13/500
  - Ingress: 13/400 / `C.textMuted`
  - Kicker: 11/600 / `C.accent` / normal case (ikke chip/badge)
  - Kilde+dato: 11/400 / `C.textFaint`
- "Les saken →": tekstlenke i `C.text`, hover `C.accent`. `target="_blank" rel="noopener noreferrer"`.

---

### 23. Faseinndeling

**Fase 1 (denne implementasjonen):**
- Rute, side-shell, godkjente system-primitives (`MediaFrame`, `SectionHeader`), lokal kicker/meta, **felles diskriminert `NewsItem`-union**, mockdata (1 + 6 + 5), empty state, full responsivitet, line-clamps, Plan C SVG-generator (lokal helper), `withUtm()` i felles `lib/`.
- Stilark får de to godkjente primitives.
- Ingen edge function, ingen tabell, ingen Perplexity, ingen Storage.

**Fase 2 (egen approval):**
- Tabell `news_daily` (med kolonne-metadata, RLS), edge function med to-pass + scoring + dedup + post-filter + bildestrategi + Storage-mirror, `pg_cron` 04:30 UTC, advisory lock, kostnadscap, strukturert logging.

**Fase 2b (senere, egen approval):**
- `news_clicks`-tabell + RLS (insert: `auth.uid()`, select: service_role).
- E-postalerting på `status='error'`/`'empty'` 3 dager.
- Eventuell oppgradering til Supabase scheduled function for korrekt lokal tidssone.

---

### 24. Verifisering

**Fase 1:**
1. `/design-lab/news` rendres umiddelbart fra mock — 1 lead + 6 features + 5 briefs.
2. Resize 375 / 720 / 1280 / 5000px → 1 / 2 / 3 kolonner, ingen layout shift.
3. Empty state vises når mock-array tømmes.
4. Line-clamps kutter pent.
5. Venstremenyen har **ingen** "Nyheter"-oppføring.
6. "Les saken →" åpner i ny fane med UTM via `withUtm()`.
7. `MediaFrame` + `SectionHeader` synlige i `/design-lab/stilark`.
8. Brief-items har `ingress === null` (typedisiplin).

**Fase 2:**
9. Tomt resultat → empty state + `status='empty'`-rad.
10. Duplikat-sak treffer 3 selskaper → vises én gang + `also_matched_company_ids` i kicker.
11. Manuell cron-trigger → ny rad, gammel får `is_current=false`.
12. Hard cap (30) kicker inn.
13. Advisory lock hindrer parallelle kjøringer.
14. Bilder hostet på Supabase Storage, ikke ekstern URL i payload.
15. Disambiguering: test "Kongsberg" → kun saker som matcher Kongsberg Defence' navn/alias slipper gjennom.

