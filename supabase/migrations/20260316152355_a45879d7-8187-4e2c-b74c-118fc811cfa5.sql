CREATE POLICY "Anon can select cv_versions"
ON public.cv_versions FOR SELECT
TO anon
USING (true);