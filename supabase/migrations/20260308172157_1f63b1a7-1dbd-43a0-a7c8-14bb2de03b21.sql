ALTER TABLE public.external_consultants
  ADD COLUMN IF NOT EXISTS navn text,
  ADD COLUMN IF NOT EXISTS epost text,
  ADD COLUMN IF NOT EXISTS telefon text,
  ADD COLUMN IF NOT EXISTS cv_tekst text,
  ADD COLUMN IF NOT EXISTS selskap_tekst text;