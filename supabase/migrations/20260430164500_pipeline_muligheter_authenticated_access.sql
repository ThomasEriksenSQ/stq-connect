DROP POLICY IF EXISTS "Authenticated insert pipeline_muligheter" ON public.pipeline_muligheter;
DROP POLICY IF EXISTS "Authenticated update pipeline_muligheter" ON public.pipeline_muligheter;
DROP POLICY IF EXISTS "Authenticated delete pipeline_muligheter" ON public.pipeline_muligheter;

CREATE POLICY "Authenticated insert pipeline_muligheter"
  ON public.pipeline_muligheter
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated update pipeline_muligheter"
  ON public.pipeline_muligheter
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated delete pipeline_muligheter"
  ON public.pipeline_muligheter
  FOR DELETE
  TO authenticated
  USING (true);
