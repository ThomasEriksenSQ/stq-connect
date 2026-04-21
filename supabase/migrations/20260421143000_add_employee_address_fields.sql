ALTER TABLE public.stacq_ansatte
  ADD COLUMN IF NOT EXISTS adresse text,
  ADD COLUMN IF NOT EXISTS postnummer text,
  ADD COLUMN IF NOT EXISTS poststed text;

UPDATE public.stacq_ansatte
SET
  postnummer = COALESCE(
    NULLIF(postnummer, ''),
    substring(geografi from '[0-9]{4}')
  )
WHERE geografi ~ '[0-9]{4}';

UPDATE public.stacq_ansatte
SET postnummer = substring(postnummer from '[0-9]{4}')
WHERE postnummer IS NOT NULL;

UPDATE public.stacq_ansatte
SET poststed = COALESCE(
  NULLIF(poststed, ''),
  NULLIF(btrim(regexp_replace(geografi, '^.*[0-9]{4}\s*', '')), '')
)
WHERE geografi ~ '[0-9]{4}\s+\S';
