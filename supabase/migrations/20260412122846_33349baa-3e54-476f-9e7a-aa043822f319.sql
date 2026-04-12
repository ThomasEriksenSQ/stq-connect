-- 1. Fix profiles: restrict phone access by replacing broad SELECT with a view-like approach
-- Since we can't do column-level RLS, we keep the broad read (needed for owner name display)
-- but this is acceptable given both users are admins. The real fix: ensure only admins exist.
-- Actually, let's just scope it to admin-only read for full rows, own-profile for non-admins.

DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;

CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Admins can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Fix ansatte-bilder storage: restrict write/delete to admin only
-- First drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can upload ansatte-bilder" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update ansatte-bilder" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete ansatte-bilder" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload ansatte-bilder" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update ansatte-bilder" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete ansatte-bilder" ON storage.objects;

CREATE POLICY "Admin insert ansatte-bilder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ansatte-bilder' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin update ansatte-bilder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'ansatte-bilder' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin delete ansatte-bilder"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'ansatte-bilder' AND public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Fix user_roles: add explicit WITH CHECK
DROP POLICY IF EXISTS "Admin manage roles" ON public.user_roles;

CREATE POLICY "Admin manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));