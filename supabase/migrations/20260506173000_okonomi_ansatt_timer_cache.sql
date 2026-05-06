CREATE TABLE IF NOT EXISTS public.okonomi_ansatt_timer_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ansatt_id integer NOT NULL REFERENCES public.stacq_ansatte(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month smallint NOT NULL CHECK (month BETWEEN 1 AND 12),
  billable_hours numeric,
  coverage numeric,
  revenue numeric,
  costs numeric,
  result numeric,
  salary_cost numeric,
  sick_pay_cost numeric,
  source text NOT NULL DEFAULT 'tripletex',
  is_final boolean NOT NULL DEFAULT false,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT okonomi_ansatt_timer_cache_unique_month UNIQUE (ansatt_id, year, month)
);

CREATE INDEX IF NOT EXISTS okonomi_ansatt_timer_cache_year_month_idx
  ON public.okonomi_ansatt_timer_cache(year, month);

ALTER TABLE public.okonomi_ansatt_timer_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read okonomi_ansatt_timer_cache" ON public.okonomi_ansatt_timer_cache;
DROP POLICY IF EXISTS "Admin insert okonomi_ansatt_timer_cache" ON public.okonomi_ansatt_timer_cache;
DROP POLICY IF EXISTS "Admin update okonomi_ansatt_timer_cache" ON public.okonomi_ansatt_timer_cache;
DROP POLICY IF EXISTS "Admin delete okonomi_ansatt_timer_cache" ON public.okonomi_ansatt_timer_cache;

CREATE POLICY "Admin read okonomi_ansatt_timer_cache"
  ON public.okonomi_ansatt_timer_cache
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin insert okonomi_ansatt_timer_cache"
  ON public.okonomi_ansatt_timer_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin update okonomi_ansatt_timer_cache"
  ON public.okonomi_ansatt_timer_cache
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin delete okonomi_ansatt_timer_cache"
  ON public.okonomi_ansatt_timer_cache
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

NOTIFY pgrst, 'reload schema';
