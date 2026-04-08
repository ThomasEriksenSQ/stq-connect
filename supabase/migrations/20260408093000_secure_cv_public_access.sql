-- Route public CV editor access through the cv-access edge function instead of open anon RLS policies
DROP POLICY IF EXISTS "Anon can select cv_access_tokens" ON public.cv_access_tokens;

DROP POLICY IF EXISTS "Anon can select cv_documents" ON public.cv_documents;
DROP POLICY IF EXISTS "Anon can update cv_documents" ON public.cv_documents;

DROP POLICY IF EXISTS "Anon can insert cv_versions" ON public.cv_versions;
DROP POLICY IF EXISTS "Anon can select cv_versions" ON public.cv_versions;
