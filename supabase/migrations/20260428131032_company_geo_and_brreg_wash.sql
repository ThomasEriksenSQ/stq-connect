ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS geo_areas text[],
  ADD COLUMN IF NOT EXISTS geo_source text,
  ADD COLUMN IF NOT EXISTS geo_unresolved_places text[],
  ADD COLUMN IF NOT EXISTS geo_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS brreg_status text,
  ADD COLUMN IF NOT EXISTS brreg_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS brreg_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS brreg_last_error text;

CREATE INDEX IF NOT EXISTS companies_geo_areas_gin_idx
  ON public.companies USING gin (geo_areas);

CREATE INDEX IF NOT EXISTS companies_brreg_status_idx
  ON public.companies (brreg_status);
