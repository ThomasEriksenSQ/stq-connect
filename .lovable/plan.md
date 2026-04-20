

## Fase 2: Realiser STACQ Daily med ekte data

Aktivere full backend-pipeline som beskrevet i den opprinnelige v3-planen (§14–§17). Frontend-shell, datamodell og layout er allerede på plass fra Fase 1 — denne planen erstatter mock med ekte Perplexity-data, bilder og daglig generering.

---

### 1. Perplexity-tilkobling

Bruke Lovable-connector for Perplexity (Sonar). Dette gir `PERPLEXITY_API_KEY` som env-variabel i edge functions.

**Steg:** Koble Perplexity-connector via `standard_connectors--connect`. Ingen ny secret manuelt — connector injiserer nøkkelen automatisk.

---

### 2. Database — `news_daily`

Migrasjon (single source of truth: kolonner for metadata, payload kun for items):

```sql
create table public.news_daily (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  payload jsonb not null,
  generated_at timestamptz not null default now(),
  is_current boolean not null default true,
  status text not null default 'ok' check (status in ('ok','empty','error')),
  source_count integer not null default 0,
  company_count integer not null default 0,
  warnings jsonb not null default '[]'::jsonb
);

create unique index news_daily_current_per_date
  on public.news_daily(date) where is_current = true;

create index news_daily_date_idx on public.news_daily(date desc);

alter table public.news_daily enable row level security;

create policy "authenticated read news_daily"
  on public.news_daily for select to authenticated using (true);

create policy "service_role manage news_daily"
  on public.news_daily for all to service_role using (true) with check (true);
```

---

### 3. Storage — bucket `news-images`

Public bucket for mirror av artikkelbilder. Sti: `news/{YYYY-MM-DD}/{item-id}.{ext}`. Lagrer bytes ved generering → stabile URL-er overlever 404 hos kilden.

---

### 4. Edge function — `news-daily-digest`

Filer:
- `supabase/functions/news-daily-digest/index.ts` — hovedflyt
- `supabase/functions/news-daily-digest/sources.ts` — `SOURCE_TIERS` + `SOURCE_DOMAINS`
- `supabase/functions/news-daily-digest/scoring.ts` — `scoreItem()`, dedup, kvalitetsterskel
- `supabase/functions/news-daily-digest/heat.ts` — beregne heat-tier per selskap via `getHeatScore`-logikk (port fra `src/lib/heatScore.ts`)
- `supabase/functions/news-daily-digest/images.ts` — Plan A → B → C, mirror til Storage

**Konfig (config.toml):** `verify_jwt = false` (kalles av cron + on-demand fra frontend).

**Flyt:**
1. Hent `companies` med `status` ∈ {Potensiell kunde, Kunde}, inkludert `id`, `name`, `website`, `org_number`.
2. Hent alle aktive `contacts` for disse → beregn `heat_tier` per `company_id` (høyeste tier blant kontaktene).
3. `pg_advisory_lock` på `hashtext('news-daily-' || current_date)`. Låst → returner 202.
4. Hard cap: maks 30 Sonar-kall per dag (telles fra dagens rader/log).
5. **Pass 1** (24t): batch á 10 selskaper, kall Sonar med disambigueringskontekst (navn + website + org_number) og JSON-skjema fra v3-plan §9. Retry maks 2 per failed batch (1s, 4s backoff) — atskilt fra dagskvoten.
6. Slå sammen, dedup på normalisert URL, post-filter (eksakt navn/alias-match i tittel eller ingress), scor med kombinert `(base_weight + heat_boost) * recency * source_tier + keyword_tiebreaker`, filtrer `score < 0.4`.
7. Hvis < 12 over terskel → **Pass 2** (72t, `search_recency_filter: 'week'`). Slå sammen, dedup, scor på nytt.
8. Hvis fortsatt < 6 → status `'empty'`, insert tom rad, returner.
9. Pick: 1 lead + 6 features + 5 briefs (etter score desc).
10. Bilder: Plan A (`og:image` fra kilde) → Plan B (`og:image`/favicon fra `companies.website`) → Plan C (server-generert SVG med selskapsnavn). Validering: realistisk User-Agent, 5s timeout, content-type `image/*`, min. 400×200px. Mirror til `news-images`.
11. Insert i `news_daily`. Marker forrige rad samme dato `is_current = false`.
12. Strukturert log: `{ run_id, status, batches_called, items_returned, fallback_used, heat_tier_distribution }`.
13. Release lock.

---

### 5. Cron — daglig 04:30 UTC

Aktiver `pg_cron` + `pg_net`. Migrasjon (kjøres én gang via insert-tool):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'news-daily-digest',
  '30 4 * * *',
  $$
  select net.http_post(
    url := 'https://kbvzpcebfopqqrvmbiap.supabase.co/functions/v1/news-daily-digest',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  );
  $$
);
```

---

### 6. Frontend — bytt mock til ekte data

`src/pages/DesignLabNews.tsx`:
- Fjern `MOCK_LEAD`, `MOCK_FEATURES`, `MOCK_BRIEFS`.
- `useQuery(['news-daily', today])`:
  - `select * from news_daily where date = current_date and is_current = true limit 1`.
  - Hvis null rad → `supabase.functions.invoke('news-daily-digest', { body: { trigger: 'on-demand' } })`, deretter re-query.
- Loading: skeleton-versjon av layout (samme høyder, ingen layout shift).
- Error: vis empty state med subtil "Kunne ikke hente nyheter" + retry-knapp.
- Status `'empty'` → eksisterende empty state.
- Items splittes etter `variant` til `LeadStory`, `FeatureCard`, `BriefRow`.

Layout, typografi, `MediaFrame`-fallback og `withUtm()` er uendret.

---

### 7. Heat-port til Deno

Edge function trenger samme heat-logikk som `/kontakter`. Lager `supabase/functions/news-daily-digest/heat.ts` som speiler `src/lib/heatScore.ts` (Tier 1–4 basert på siste signal-kategori + aktivitet). Per selskap: høyeste tier blant aktive kontakter → mappes til boost (Tier 1 +2.0, Tier 2 +1.2, Tier 3 +0.6, Tier 4 / ingen +0.0).

---

### 8. Verifisering

1. Manuell trigger: `supabase.functions.invoke('news-daily-digest')` → ny rad i `news_daily` for i dag.
2. `/design-lab/news` viser ekte saker, ekte lenker (åpner i ny fane med UTM), ekte bilder fra Storage.
3. Empty-test: midlertidig snevre status-filter til kun "Inaktiv" → status `'empty'` + empty state.
4. Dedup-test: sjekk i payload at duplikat-sak har én entry + ikke-tom `also_matched_company_ids`.
5. Bilde-fallback: midlertidig sett ugyldig `og:image` → Plan B/C kicker inn, ingen brutte bilder.
6. Re-trigger samme dag: forrige rad får `is_current = false`, ny rad blir current.
7. Cron: sjekk `cron.job` + `cron.job_run_details` etter 04:30 UTC neste dag.
8. Hard cap: log viser at maks 30 batches kjøres.
9. Heat-prioritering: log viser `heat_tier_distribution` og at små "Potensiell kunde"-selskaper med Tier 1-kontakt kan toppe.

---

### 9. Hva som IKKE er med

- Klikk-tracking (Fase 2b).
- E-postalerting på `status='error'`/`'empty'` 3 dager (Fase 2b).
- 90-dagers opprydding av gamle bilder i Storage (følger senere ved behov).
- Sidemeny-oppføring (forblir hemmelig URL).

---

### 10. Rekkefølge for implementering

1. Koble Perplexity-connector.
2. Migrasjon: tabell + RLS + indekser.
3. Opprette Storage-bucket `news-images`.
4. Edge function (alle 5 filer) + `config.toml`-oppdatering.
5. Aktivere `pg_cron` + `pg_net` + schedule (via insert-tool, ikke migrasjon — inneholder anon key).
6. Frontend: bytt mock til `useQuery` + on-demand-trigger + loading/error states.
7. Manuell trigger og full verifisering (steg 8).

