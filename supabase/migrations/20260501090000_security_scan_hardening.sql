-- Harden findings from the security scan without changing public object URLs.

-- Outlook tokens are only needed server-side through service-role edge functions.
DROP POLICY IF EXISTS "Admin manage outlook_tokens" ON public.outlook_tokens;
DROP POLICY IF EXISTS "Users can read own outlook_tokens" ON public.outlook_tokens;
DROP POLICY IF EXISTS "Users can manage own outlook_tokens" ON public.outlook_tokens;
DROP POLICY IF EXISTS "Service role manage outlook_tokens" ON public.outlook_tokens;

CREATE POLICY "Service role manage outlook_tokens"
ON public.outlook_tokens
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Remove broad listing policies for public buckets. Known public object URLs still work.
DROP POLICY IF EXISTS "Public read ansatte-bilder" ON storage.objects;
DROP POLICY IF EXISTS "Public read news-images" ON storage.objects;

-- Replace every historical ansatte-bilder write policy name with admin-only writes.
DROP POLICY IF EXISTS "Authenticated upload ansatte-bilder" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update ansatte-bilder" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete ansatte-bilder" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload ansatte-bilder" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update ansatte-bilder" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete ansatte-bilder" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload ansatte-bilder" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update ansatte-bilder" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete ansatte-bilder" ON storage.objects;
DROP POLICY IF EXISTS "Admin insert ansatte-bilder" ON storage.objects;
DROP POLICY IF EXISTS "Admin update ansatte-bilder" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete ansatte-bilder" ON storage.objects;

CREATE POLICY "Admin insert ansatte-bilder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ansatte-bilder' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admin update ansatte-bilder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'ansatte-bilder' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'ansatte-bilder' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admin delete ansatte-bilder"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'ansatte-bilder' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger/helper functions should not be directly executable by API clients.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_foresporsel_technical_dna_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_contact_technical_dna_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_finn_technical_dna_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.execute_company_merge(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rebuild_company_technical_dna(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rebuild_contact_technical_dna(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rebuild_technical_dna(uuid, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.execute_company_merge(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rebuild_company_technical_dna(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rebuild_contact_technical_dna(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rebuild_technical_dna(uuid, uuid) TO service_role;

-- Keep the role helper callable for RLS policies, but prevent role lookups for other users.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (
        _user_id = auth.uid()
        OR auth.role() = 'service_role'
      )
  );
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- The trigger function was missing an explicit search_path.
ALTER FUNCTION public.set_pipeline_muligheter_updated_at() SET search_path = public;
