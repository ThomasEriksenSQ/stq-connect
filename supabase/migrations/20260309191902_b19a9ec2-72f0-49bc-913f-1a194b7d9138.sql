ALTER TABLE public.foresporsler_konsulenter 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'sendt_cv',
ADD COLUMN IF NOT EXISTS status_updated_at timestamptz NOT NULL DEFAULT now();

-- Add a validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_fk_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status NOT IN ('sendt_cv', 'intervju', 'vunnet', 'avslag') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_fk_status
BEFORE INSERT OR UPDATE ON public.foresporsler_konsulenter
FOR EACH ROW EXECUTE FUNCTION public.validate_fk_status();