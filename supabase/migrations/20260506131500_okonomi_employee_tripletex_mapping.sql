CREATE TABLE IF NOT EXISTS public.okonomi_ansatt_tripletex_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ansatt_id integer NOT NULL REFERENCES public.stacq_ansatte(id) ON DELETE CASCADE,
  tripletex_employee_id integer,
  tripletex_project_id integer,
  tripletex_project_number text,
  project_name text,
  active_from date,
  active_to date,
  source text NOT NULL DEFAULT 'manual',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT okonomi_ansatt_tripletex_mapping_has_reference
    CHECK (
      tripletex_employee_id IS NOT NULL
      OR tripletex_project_id IS NOT NULL
      OR NULLIF(btrim(tripletex_project_number), '') IS NOT NULL
    ),
  CONSTRAINT okonomi_ansatt_tripletex_mapping_valid_period
    CHECK (active_to IS NULL OR active_from IS NULL OR active_to >= active_from)
);

CREATE INDEX IF NOT EXISTS okonomi_ansatt_tripletex_mapping_ansatt_idx
  ON public.okonomi_ansatt_tripletex_mapping(ansatt_id);

CREATE INDEX IF NOT EXISTS okonomi_ansatt_tripletex_mapping_employee_idx
  ON public.okonomi_ansatt_tripletex_mapping(tripletex_employee_id)
  WHERE tripletex_employee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS okonomi_ansatt_tripletex_mapping_project_idx
  ON public.okonomi_ansatt_tripletex_mapping(tripletex_project_id)
  WHERE tripletex_project_id IS NOT NULL;

ALTER TABLE public.okonomi_ansatt_tripletex_mapping ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read okonomi_ansatt_tripletex_mapping" ON public.okonomi_ansatt_tripletex_mapping;
DROP POLICY IF EXISTS "Admin insert okonomi_ansatt_tripletex_mapping" ON public.okonomi_ansatt_tripletex_mapping;
DROP POLICY IF EXISTS "Admin update okonomi_ansatt_tripletex_mapping" ON public.okonomi_ansatt_tripletex_mapping;
DROP POLICY IF EXISTS "Admin delete okonomi_ansatt_tripletex_mapping" ON public.okonomi_ansatt_tripletex_mapping;

CREATE POLICY "Admin read okonomi_ansatt_tripletex_mapping"
  ON public.okonomi_ansatt_tripletex_mapping
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin insert okonomi_ansatt_tripletex_mapping"
  ON public.okonomi_ansatt_tripletex_mapping
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin update okonomi_ansatt_tripletex_mapping"
  ON public.okonomi_ansatt_tripletex_mapping
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin delete okonomi_ansatt_tripletex_mapping"
  ON public.okonomi_ansatt_tripletex_mapping
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

NOTIFY pgrst, 'reload schema';
