
-- Fix cv_access_tokens: remove the two overly permissive anon SELECT policies
DROP POLICY IF EXISTS "Anon can read own token by value" ON public.cv_access_tokens;
DROP POLICY IF EXISTS "Anon can select cv_access_tokens" ON public.cv_access_tokens;

-- Fix salgsagent_bruk: remove the overly permissive "Service role kan lese alt" policy
DROP POLICY IF EXISTS "Service role kan lese alt" ON public.salgsagent_bruk;
