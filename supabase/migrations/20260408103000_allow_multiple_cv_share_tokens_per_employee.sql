ALTER TABLE public.cv_access_tokens
DROP CONSTRAINT IF EXISTS cv_access_tokens_ansatt_id_unique;

CREATE INDEX IF NOT EXISTS idx_cv_access_tokens_ansatt_id
  ON public.cv_access_tokens (ansatt_id);
