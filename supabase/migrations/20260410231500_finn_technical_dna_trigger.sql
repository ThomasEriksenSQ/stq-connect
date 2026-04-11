CREATE OR REPLACE FUNCTION public.handle_finn_technical_dna_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.matched_company_id IS NOT NULL THEN
      PERFORM public.rebuild_company_technical_dna(OLD.matched_company_id);
      PERFORM public.rebuild_contact_technical_dna(NULL, OLD.matched_company_id);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.matched_company_id IS DISTINCT FROM NEW.matched_company_id AND OLD.matched_company_id IS NOT NULL THEN
    PERFORM public.rebuild_company_technical_dna(OLD.matched_company_id);
    PERFORM public.rebuild_contact_technical_dna(NULL, OLD.matched_company_id);
  END IF;

  IF NEW.matched_company_id IS NOT NULL THEN
    PERFORM public.rebuild_company_technical_dna(NEW.matched_company_id);
    PERFORM public.rebuild_contact_technical_dna(NULL, NEW.matched_company_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS finn_annonser_rebuild_technical_dna ON public.finn_annonser;
CREATE TRIGGER finn_annonser_rebuild_technical_dna
AFTER INSERT OR UPDATE OR DELETE ON public.finn_annonser
FOR EACH ROW
EXECUTE FUNCTION public.handle_finn_technical_dna_change();

REVOKE ALL ON FUNCTION public.handle_finn_technical_dna_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_finn_technical_dna_change() TO service_role;
