-- Make cvs bucket private
UPDATE storage.buckets SET public = false WHERE id = 'cvs';

-- Drop old permissive policies on cvs bucket
DROP POLICY IF EXISTS "Anyone can read CVs" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload CVs" ON storage.objects;

-- Admin-only policies for cvs bucket
CREATE POLICY "Admin read cvs" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'cvs' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admin upload cvs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'cvs' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admin update cvs" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'cvs' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'cvs' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admin delete cvs" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'cvs' AND public.has_role(auth.uid(), 'admin'::public.app_role));