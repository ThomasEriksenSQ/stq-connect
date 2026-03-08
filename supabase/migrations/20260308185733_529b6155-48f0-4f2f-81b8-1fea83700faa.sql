
-- Make ansatt_id nullable (was NOT NULL, only supported stacq_ansatte)
ALTER TABLE public.foresporsler_konsulenter ALTER COLUMN ansatt_id DROP NOT NULL;

-- Add ekstern_id for external_consultants FK
ALTER TABLE public.foresporsler_konsulenter 
  ADD COLUMN ekstern_id uuid REFERENCES public.external_consultants(id) ON DELETE CASCADE;

-- Add konsulent_type to distinguish intern/ekstern
ALTER TABLE public.foresporsler_konsulenter 
  ADD COLUMN konsulent_type text NOT NULL DEFAULT 'intern' 
  CHECK (konsulent_type IN ('intern', 'ekstern'));

-- Add check: exactly one of ansatt_id or ekstern_id must be set
ALTER TABLE public.foresporsler_konsulenter 
  ADD CONSTRAINT one_konsulent_ref 
  CHECK (
    (ansatt_id IS NOT NULL AND ekstern_id IS NULL) OR 
    (ansatt_id IS NULL AND ekstern_id IS NOT NULL)
  );
