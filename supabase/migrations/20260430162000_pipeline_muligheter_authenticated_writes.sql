CREATE POLICY "Authenticated insert own pipeline_muligheter"
  ON public.pipeline_muligheter
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Authenticated update own pipeline_muligheter"
  ON public.pipeline_muligheter
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Authenticated delete own pipeline_muligheter"
  ON public.pipeline_muligheter
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());
