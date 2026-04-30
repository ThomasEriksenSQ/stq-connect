CREATE TABLE IF NOT EXISTS public.pipeline_muligheter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  konsulent_type text NOT NULL DEFAULT 'intern'
    CHECK (konsulent_type IN ('intern', 'ekstern')),
  ansatt_id integer REFERENCES public.stacq_ansatte(id) ON DELETE CASCADE,
  ekstern_id uuid REFERENCES public.external_consultants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  tittel text NOT NULL DEFAULT 'Direkte mulighet',
  notat text,
  status text NOT NULL DEFAULT 'sendt_cv'
    CHECK (status IN ('sendt_cv', 'intervju', 'vunnet', 'avslag', 'bortfalt')),
  status_updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pipeline_muligheter_one_konsulent_ref
    CHECK (
      (ansatt_id IS NOT NULL AND ekstern_id IS NULL AND konsulent_type = 'intern')
      OR
      (ansatt_id IS NULL AND ekstern_id IS NOT NULL AND konsulent_type = 'ekstern')
    )
);

CREATE INDEX IF NOT EXISTS pipeline_muligheter_ansatt_id_idx
  ON public.pipeline_muligheter (ansatt_id);

CREATE INDEX IF NOT EXISTS pipeline_muligheter_ekstern_id_idx
  ON public.pipeline_muligheter (ekstern_id);

CREATE INDEX IF NOT EXISTS pipeline_muligheter_company_id_idx
  ON public.pipeline_muligheter (company_id);

CREATE INDEX IF NOT EXISTS pipeline_muligheter_contact_id_idx
  ON public.pipeline_muligheter (contact_id);

CREATE INDEX IF NOT EXISTS pipeline_muligheter_status_idx
  ON public.pipeline_muligheter (status);

CREATE OR REPLACE FUNCTION public.set_pipeline_muligheter_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();

  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pipeline_muligheter_updated_at ON public.pipeline_muligheter;
CREATE TRIGGER trg_pipeline_muligheter_updated_at
BEFORE INSERT OR UPDATE ON public.pipeline_muligheter
FOR EACH ROW
EXECUTE FUNCTION public.set_pipeline_muligheter_updated_at();

ALTER TABLE public.pipeline_muligheter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read pipeline_muligheter"
  ON public.pipeline_muligheter
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin insert pipeline_muligheter"
  ON public.pipeline_muligheter
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin update pipeline_muligheter"
  ON public.pipeline_muligheter
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin delete pipeline_muligheter"
  ON public.pipeline_muligheter
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
