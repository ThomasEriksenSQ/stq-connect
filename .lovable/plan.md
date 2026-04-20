

## Problem
Merge feilet med 500 fra Postgres:
```
ERROR: duplicate key value violates unique constraint "companies_sf_account_id_key"
```

Begge Sensio-radene finnes:
- Source `Sensio` (c0f7bc4a…): `sf_account_id = 0017R000032QteKQAS`
- Target `SENSIO AS` (2a2fd2f3…): `sf_account_id = NULL`

I `execute_company_merge` (DB-funksjonen) kjøres rekkefølgen:
1. UPDATE target SET `sf_account_id = coalesce(target.sf_account_id, source.sf_account_id)` → target får `0017R…`
2. DELETE source

På steg 1 har **begge rader samme `sf_account_id`** samtidig → `companies_sf_account_id_key` unique constraint sprenger. Samme problem gjelder potensielt `org_number` (også UNIQUE). I dette tilfellet har begge `919415223`, men `coalesce(target, source)` gir samme verdi (target var ikke null) — så ikke endring der. Likevel er sf_account_id den faktiske bommen.

## Fiks: ny migrering som oppdaterer `execute_company_merge`

Endring: **nullstill source sine UNIQUE-felter FØR target oppdateres**, slik at verdiene kan flyttes uten kollisjon.

Konkret diff i RPC-funksjonen, rett før `UPDATE public.companies … WHERE id = p_target_company_id`:

```sql
-- Frigjør UNIQUE-verdier fra source så target kan arve dem uten kollisjon
UPDATE public.companies
SET
  sf_account_id = NULL,
  org_number = NULL
WHERE id = p_source_company_id;
```

Source slettes uansett rett etterpå, så å nullstille er trygt. Begge `coalesce()`-uttrykkene i target-UPDATE leser allerede `source_company.sf_account_id` / `source_company.org_number` fra den lokale `ROWTYPE`-variabelen (lest tidligere i funksjonen), så fjerning fra raden påvirker ikke logikken.

Ingen andre endringer:
- Konflikt-sjekk (begge NOT NULL og ulike) gjelder fortsatt — den kjører før nullstillingen.
- `company_aliases`, FK-flyttinger, notes-flett, `company_merge_log`, `rebuild_technical_dna` — alt urørt.
- Edge-funksjon, UI og preview-flyt — uendret.

## Etter migrering
- Sensio merge går igjennom; SENSIO AS arver `sf_account_id 0017R000032QteKQAS`.
- Senere merger med kolliderende UNIQUE-felter (sf_account_id eller org_number) der target er NULL fungerer også.
- Ekte konflikter (begge NOT NULL og ulike) blokkeres fortsatt med "Merge blocked".

