DO $$
DECLARE
  jon_id uuid;
  thomas_id uuid;
BEGIN
  SELECT id
    INTO jon_id
  FROM public.profiles
  WHERE full_name = 'Jon Richard Nygaard'
  ORDER BY id
  LIMIT 1;

  SELECT id
    INTO thomas_id
  FROM public.profiles
  WHERE full_name = 'Thomas Eriksen'
  ORDER BY id
  LIMIT 1;

  IF jon_id IS NULL OR thomas_id IS NULL THEN
    RAISE EXCEPTION 'Fant ikke begge CRM-eierne som trengs for å fordele selskaper uten eier';
  END IF;

  WITH unowned_companies AS (
    SELECT
      id,
      row_number() OVER (ORDER BY random(), id) AS owner_rank
    FROM public.companies
    WHERE owner_id IS NULL
  )
  UPDATE public.companies AS companies
  SET owner_id = CASE
        WHEN unowned_companies.owner_rank % 2 = 1 THEN jon_id
        ELSE thomas_id
      END,
      updated_at = now()
  FROM unowned_companies
  WHERE companies.id = unowned_companies.id;
END $$;

ALTER TABLE public.companies
  ALTER COLUMN owner_id SET NOT NULL;
