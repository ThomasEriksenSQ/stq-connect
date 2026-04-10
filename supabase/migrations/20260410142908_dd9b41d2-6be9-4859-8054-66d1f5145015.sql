
-- =============================================
-- 1. cv_access_tokens: replace permissive ALL policies with admin-only
-- =============================================
DROP POLICY IF EXISTS "Authenticated can manage tokens" ON public.cv_access_tokens;
DROP POLICY IF EXISTS "Authenticated users can do all on cv_access_tokens" ON public.cv_access_tokens;

CREATE POLICY "Admin manage cv_access_tokens"
  ON public.cv_access_tokens
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- 2. cv_documents: replace permissive ALL with admin-only
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can do all on cv_documents" ON public.cv_documents;

CREATE POLICY "Admin manage cv_documents"
  ON public.cv_documents
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- 3. cv_versions: replace permissive ALL with admin-only
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can do all on cv_versions" ON public.cv_versions;

CREATE POLICY "Admin manage cv_versions"
  ON public.cv_versions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- 4. company_tech_profile: restrict INSERT/UPDATE to admin
-- =============================================
DROP POLICY IF EXISTS "Authenticated insert company_tech_profile" ON public.company_tech_profile;
DROP POLICY IF EXISTS "Authenticated update company_tech_profile" ON public.company_tech_profile;

CREATE POLICY "Admin insert company_tech_profile"
  ON public.company_tech_profile
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin update company_tech_profile"
  ON public.company_tech_profile
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- 5. site_settings: restrict write to admin
-- =============================================
DROP POLICY IF EXISTS "Auth write site_settings" ON public.site_settings;

CREATE POLICY "Admin write site_settings"
  ON public.site_settings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- 6. Fix function search_path on immutable functions
-- =============================================
CREATE OR REPLACE FUNCTION public.normalize_company_alias(value text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  SET search_path = public
AS $$
  SELECT trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          lower(coalesce(value, '')),
          '\m(as|asa|ab|ag|bv|gmbh|group|holding|holdings|ltd|limited|inc|llc|plc|oy|oyj|sa|sarl|the|norway|norge|no)\M',
          ' ',
          'g'
        ),
        '[&/.\-_,()]',
        ' ',
        'g'
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.normalize_contact_phone(input_value text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  SET search_path = public
AS $$
  SELECT CASE
    WHEN input_value IS NULL THEN NULL
    ELSE
      CASE
        WHEN length(regexp_replace(input_value, '\D', '', 'g')) > 8
          THEN right(regexp_replace(input_value, '\D', '', 'g'), 8)
        ELSE nullif(regexp_replace(input_value, '\D', '', 'g'), '')
      END
  END;
$$;
