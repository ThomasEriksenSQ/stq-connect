
-- 1. stacq_ansatte: replace permissive ALL with admin-only write, authenticated read
DROP POLICY IF EXISTS "Authenticated users can do all on stacq_ansatte" ON public.stacq_ansatte;

CREATE POLICY "Authenticated read stacq_ansatte"
  ON public.stacq_ansatte FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin insert stacq_ansatte"
  ON public.stacq_ansatte FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update stacq_ansatte"
  ON public.stacq_ansatte FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete stacq_ansatte"
  ON public.stacq_ansatte FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. stacq_oppdrag: replace permissive ALL with admin-only write, authenticated read
DROP POLICY IF EXISTS "Authenticated users can do all on stacq_oppdrag" ON public.stacq_oppdrag;

CREATE POLICY "Authenticated read stacq_oppdrag"
  ON public.stacq_oppdrag FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin insert stacq_oppdrag"
  ON public.stacq_oppdrag FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update stacq_oppdrag"
  ON public.stacq_oppdrag FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete stacq_oppdrag"
  ON public.stacq_oppdrag FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. foresporsler: replace permissive INSERT/UPDATE with admin-only write
DROP POLICY IF EXISTS "Authenticated users can insert foresporsler" ON public.foresporsler;
DROP POLICY IF EXISTS "Authenticated users can update foresporsler" ON public.foresporsler;

CREATE POLICY "Admin insert foresporsler"
  ON public.foresporsler FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update foresporsler"
  ON public.foresporsler FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. foresporsler_konsulenter: replace permissive ALL with admin-only write, authenticated read
DROP POLICY IF EXISTS "Authenticated users full access on foresporsler_konsulenter" ON public.foresporsler_konsulenter;

CREATE POLICY "Authenticated read foresporsler_konsulenter"
  ON public.foresporsler_konsulenter FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin insert foresporsler_konsulenter"
  ON public.foresporsler_konsulenter FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update foresporsler_konsulenter"
  ON public.foresporsler_konsulenter FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete foresporsler_konsulenter"
  ON public.foresporsler_konsulenter FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
