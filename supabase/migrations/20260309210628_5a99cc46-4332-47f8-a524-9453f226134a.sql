CREATE OR REPLACE FUNCTION public.validate_fk_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status NOT IN ('sendt_cv', 'intervju', 'vunnet', 'avslag', 'bortfalt') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$function$;