CREATE OR REPLACE FUNCTION public.validate_fk_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('sendt_cv', 'intervju', 'vunnet', 'avslag') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;