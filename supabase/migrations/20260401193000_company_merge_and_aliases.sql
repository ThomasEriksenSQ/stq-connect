CREATE OR REPLACE FUNCTION public.normalize_company_alias(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          lower(coalesce(value, '')),
          '\m(as|asa|ab|ag|bv|gmbh|group|holding|holdings|ltd|limited|inc|llc|plc|oy|oyj|sa|sarl|the|norway|norge|no)\M',
          ' ',
          'g'
        ),
        '[&/.\-_,()]',
        ' ',
        'g'
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

CREATE TABLE IF NOT EXISTS public.company_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  alias_name text NOT NULL,
  normalized_alias text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  source_company_id uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS company_aliases_company_id_normalized_alias_key
  ON public.company_aliases (company_id, normalized_alias);

CREATE INDEX IF NOT EXISTS company_aliases_normalized_alias_idx
  ON public.company_aliases (normalized_alias);

ALTER TABLE public.company_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read company aliases" ON public.company_aliases;
CREATE POLICY "Authenticated users can read company aliases"
ON public.company_aliases
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admin users can manage company aliases" ON public.company_aliases;
CREATE POLICY "Admin users can manage company aliases"
ON public.company_aliases
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.company_merge_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_company_id uuid NOT NULL,
  source_company_name text NOT NULL,
  target_company_id uuid NOT NULL,
  target_company_name text NOT NULL,
  merged_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  relation_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS company_merge_log_target_company_id_idx
  ON public.company_merge_log (target_company_id, created_at DESC);

ALTER TABLE public.company_merge_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin users can read company merge log" ON public.company_merge_log;
CREATE POLICY "Admin users can read company merge log"
ON public.company_merge_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.execute_company_merge(
  p_source_company_id uuid,
  p_target_company_id uuid,
  p_merged_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_company public.companies%ROWTYPE;
  target_company public.companies%ROWTYPE;
  source_notes text;
  updated_target public.companies%ROWTYPE;
  contacts_count integer := 0;
  activities_count integer := 0;
  tasks_count integer := 0;
  foresporsler_count integer := 0;
  finn_count integer := 0;
  external_count integer := 0;
  oppdrag_count integer := 0;
  aliases_count integer := 0;
  relation_counts jsonb;
BEGIN
  IF p_source_company_id IS NULL OR p_target_company_id IS NULL THEN
    RAISE EXCEPTION 'Source and target company are required';
  END IF;

  IF p_source_company_id = p_target_company_id THEN
    RAISE EXCEPTION 'Source and target company must be different';
  END IF;

  SELECT *
  INTO source_company
  FROM public.companies
  WHERE id = p_source_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source company not found';
  END IF;

  SELECT *
  INTO target_company
  FROM public.companies
  WHERE id = p_target_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target company not found';
  END IF;

  IF source_company.org_number IS NOT NULL
     AND target_company.org_number IS NOT NULL
     AND source_company.org_number <> target_company.org_number THEN
    RAISE EXCEPTION 'Merge blocked: conflicting org_number';
  END IF;

  IF source_company.sf_account_id IS NOT NULL
     AND target_company.sf_account_id IS NOT NULL
     AND source_company.sf_account_id <> target_company.sf_account_id THEN
    RAISE EXCEPTION 'Merge blocked: conflicting sf_account_id';
  END IF;

  SELECT count(*) INTO contacts_count FROM public.contacts WHERE company_id = p_source_company_id;
  SELECT count(*) INTO activities_count FROM public.activities WHERE company_id = p_source_company_id;
  SELECT count(*) INTO tasks_count FROM public.tasks WHERE company_id = p_source_company_id;
  SELECT count(*) INTO foresporsler_count FROM public.foresporsler WHERE selskap_id = p_source_company_id;
  SELECT count(*) INTO finn_count FROM public.finn_annonser WHERE matched_company_id = p_source_company_id;
  SELECT count(*) INTO external_count FROM public.external_consultants WHERE company_id = p_source_company_id;
  SELECT count(*) INTO oppdrag_count FROM public.stacq_oppdrag WHERE selskap_id = p_source_company_id;
  SELECT count(*) INTO aliases_count FROM public.company_aliases WHERE company_id = p_source_company_id;

  relation_counts := jsonb_build_object(
    'contacts', contacts_count,
    'activities', activities_count,
    'tasks', tasks_count,
    'foresporsler', foresporsler_count,
    'finn_annonser', finn_count,
    'external_consultants', external_count,
    'stacq_oppdrag', oppdrag_count,
    'source_aliases', aliases_count
  );

  INSERT INTO public.company_aliases (company_id, alias_name, normalized_alias, created_by, source_company_id)
  VALUES (
    p_target_company_id,
    source_company.name,
    public.normalize_company_alias(source_company.name),
    p_merged_by,
    p_source_company_id
  )
  ON CONFLICT (company_id, normalized_alias) DO NOTHING;

  INSERT INTO public.company_aliases (company_id, alias_name, normalized_alias, created_by, source_company_id)
  SELECT
    p_target_company_id,
    alias.alias_name,
    alias.normalized_alias,
    p_merged_by,
    coalesce(alias.source_company_id, p_source_company_id)
  FROM public.company_aliases alias
  WHERE alias.company_id = p_source_company_id
  ON CONFLICT (company_id, normalized_alias) DO NOTHING;

  DELETE FROM public.company_aliases
  WHERE company_id = p_source_company_id;

  UPDATE public.contacts
  SET company_id = p_target_company_id
  WHERE company_id = p_source_company_id;

  UPDATE public.activities
  SET company_id = p_target_company_id
  WHERE company_id = p_source_company_id;

  UPDATE public.tasks
  SET company_id = p_target_company_id
  WHERE company_id = p_source_company_id;

  UPDATE public.foresporsler
  SET selskap_id = p_target_company_id
  WHERE selskap_id = p_source_company_id;

  UPDATE public.finn_annonser
  SET matched_company_id = p_target_company_id
  WHERE matched_company_id = p_source_company_id;

  UPDATE public.external_consultants
  SET company_id = p_target_company_id
  WHERE company_id = p_source_company_id;

  UPDATE public.stacq_oppdrag
  SET selskap_id = p_target_company_id
  WHERE selskap_id = p_source_company_id;

  source_notes := nullif(btrim(coalesce(source_company.notes, '')), '');

  UPDATE public.companies
  SET
    website = coalesce(public.companies.website, source_company.website),
    phone = coalesce(public.companies.phone, source_company.phone),
    email = coalesce(public.companies.email, source_company.email),
    address = coalesce(public.companies.address, source_company.address),
    city = coalesce(public.companies.city, source_company.city),
    zip_code = coalesce(public.companies.zip_code, source_company.zip_code),
    linkedin = coalesce(public.companies.linkedin, source_company.linkedin),
    industry = coalesce(public.companies.industry, source_company.industry),
    owner_id = coalesce(public.companies.owner_id, source_company.owner_id),
    org_number = coalesce(public.companies.org_number, source_company.org_number),
    sf_account_id = coalesce(public.companies.sf_account_id, source_company.sf_account_id),
    notes = CASE
      WHEN source_notes IS NULL THEN public.companies.notes
      WHEN public.companies.notes IS NULL OR btrim(public.companies.notes) = '' THEN
        format('[Merged from %s]%s%s', source_company.name, E'\n', source_notes)
      ELSE
        public.companies.notes || E'\n\n' || format('[Merged from %s]%s%s', source_company.name, E'\n', source_notes)
    END,
    updated_at = now()
  WHERE id = p_target_company_id
  RETURNING *
  INTO updated_target;

  DELETE FROM public.company_tech_profile
  WHERE company_id = p_source_company_id;

  INSERT INTO public.company_merge_log (
    source_company_id,
    source_company_name,
    target_company_id,
    target_company_name,
    merged_by,
    relation_counts,
    source_snapshot,
    target_snapshot
  )
  VALUES (
    p_source_company_id,
    source_company.name,
    p_target_company_id,
    target_company.name,
    p_merged_by,
    relation_counts,
    to_jsonb(source_company),
    to_jsonb(updated_target)
  );

  DELETE FROM public.companies
  WHERE id = p_source_company_id;

  PERFORM public.rebuild_technical_dna(p_target_company_id, NULL);

  RETURN jsonb_build_object(
    'source_company_id', p_source_company_id,
    'source_company_name', source_company.name,
    'target_company_id', p_target_company_id,
    'target_company_name', updated_target.name,
    'relation_counts', relation_counts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.execute_company_merge(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_company_merge(uuid, uuid, uuid) TO service_role;
