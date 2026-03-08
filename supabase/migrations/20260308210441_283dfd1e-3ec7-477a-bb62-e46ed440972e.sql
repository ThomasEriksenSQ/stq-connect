
-- Stram inn SELECT på stacq_oppdrag til kun admin
DROP POLICY IF EXISTS "Authenticated read stacq_oppdrag" ON public.stacq_oppdrag;
CREATE POLICY "Admin read stacq_oppdrag" ON public.stacq_oppdrag FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Stram inn SELECT på external_consultants til kun admin
DROP POLICY IF EXISTS "Authenticated users can read external_consultants" ON public.external_consultants;
CREATE POLICY "Admin read external_consultants" ON public.external_consultants FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Stram inn SELECT på stacq_ansatte til kun admin
DROP POLICY IF EXISTS "Authenticated read stacq_ansatte" ON public.stacq_ansatte;
CREATE POLICY "Admin read stacq_ansatte" ON public.stacq_ansatte FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
