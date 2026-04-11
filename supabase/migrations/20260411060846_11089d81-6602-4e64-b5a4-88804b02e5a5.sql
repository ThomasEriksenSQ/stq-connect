-- 1. Remove anonymous read access to stacq_ansatte (contains sensitive employee data)
DROP POLICY IF EXISTS "Anon read stacq_ansatte" ON public.stacq_ansatte;

-- 2. Remove anonymous upload policy on cvs storage bucket
DROP POLICY IF EXISTS "Anon upload cvs" ON storage.objects;