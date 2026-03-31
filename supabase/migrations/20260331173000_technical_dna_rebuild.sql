CREATE OR REPLACE FUNCTION public.normalize_contact_phone(input_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN input_value IS NULL THEN NULL
    ELSE
      CASE
        WHEN length(regexp_replace(input_value, '\D', '', 'g')) > 8
          THEN right(regexp_replace(input_value, '\D', '', 'g'), 8)
        ELSE nullif(regexp_replace(input_value, '\D', '', 'g'), '')
      END
  END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_company_technical_dna(target_company_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer := 0;
BEGIN
  WITH company_scope AS (
    SELECT DISTINCT company_id
    FROM (
      SELECT matched_company_id AS company_id
      FROM public.finn_annonser
      WHERE matched_company_id IS NOT NULL
        AND (target_company_id IS NULL OR matched_company_id = target_company_id)

      UNION

      SELECT selskap_id AS company_id
      FROM public.foresporsler
      WHERE selskap_id IS NOT NULL
        AND (target_company_id IS NULL OR selskap_id = target_company_id)

      UNION

      SELECT company_id
      FROM public.company_tech_profile
      WHERE target_company_id IS NULL OR company_id = target_company_id
    ) scoped
    WHERE company_id IS NOT NULL
  ),
  finn_stats AS (
    SELECT
      matched_company_id AS company_id,
      count(*)::integer AS finn_count,
      max(dato) AS last_finn_date
    FROM public.finn_annonser
    WHERE matched_company_id IS NOT NULL
      AND (target_company_id IS NULL OR matched_company_id = target_company_id)
    GROUP BY matched_company_id
  ),
  tag_counts AS (
    SELECT
      company_id,
      tag,
      count(*)::integer AS tag_count
    FROM (
      SELECT
        matched_company_id AS company_id,
        unnest(coalesce(teknologier_array, ARRAY[]::text[])) AS tag
      FROM public.finn_annonser
      WHERE matched_company_id IS NOT NULL
        AND (target_company_id IS NULL OR matched_company_id = target_company_id)

      UNION ALL

      SELECT
        selskap_id AS company_id,
        unnest(coalesce(teknologier, ARRAY[]::text[])) AS tag
      FROM public.foresporsler
      WHERE selskap_id IS NOT NULL
        AND (target_company_id IS NULL OR selskap_id = target_company_id)
    ) combined
    WHERE nullif(trim(tag), '') IS NOT NULL
    GROUP BY company_id, tag
  ),
  aggregated AS (
    SELECT
      scope.company_id,
      coalesce(
        (
          SELECT jsonb_object_agg(tc.tag, tc.tag_count ORDER BY tc.tag_count DESC, tc.tag)
          FROM tag_counts tc
          WHERE tc.company_id = scope.company_id
        ),
        '{}'::jsonb
      ) AS teknologier,
      coalesce(stats.finn_count, 0) AS konsulent_hyppighet,
      stats.last_finn_date AS sist_fra_finn
    FROM company_scope scope
    LEFT JOIN finn_stats stats ON stats.company_id = scope.company_id
  ),
  deleted AS (
    DELETE FROM public.company_tech_profile profile
    WHERE profile.company_id IN (SELECT company_id FROM company_scope)
      AND NOT EXISTS (
        SELECT 1
        FROM aggregated aggregated_profile
        WHERE aggregated_profile.company_id = profile.company_id
      )
    RETURNING 1
  ),
  upserted AS (
    INSERT INTO public.company_tech_profile (
      company_id,
      teknologier,
      konsulent_hyppighet,
      sist_fra_finn,
      sist_oppdatert,
      oppdatert_at,
      domener,
      senioritet
    )
    SELECT
      company_id,
      teknologier,
      NULLIF(konsulent_hyppighet, 0),
      sist_fra_finn,
      timezone('utc', now()),
      timezone('utc', now()),
      NULL,
      NULL
    FROM aggregated
    ON CONFLICT (company_id) DO UPDATE
    SET
      teknologier = EXCLUDED.teknologier,
      konsulent_hyppighet = EXCLUDED.konsulent_hyppighet,
      sist_fra_finn = EXCLUDED.sist_fra_finn,
      sist_oppdatert = EXCLUDED.sist_oppdatert,
      oppdatert_at = EXCLUDED.oppdatert_at,
      domener = EXCLUDED.domener,
      senioritet = EXCLUDED.senioritet
    RETURNING 1
  )
  SELECT coalesce((SELECT count(*) FROM upserted), 0) + coalesce((SELECT count(*) FROM deleted), 0)
  INTO updated_count;

  RETURN updated_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_contact_technical_dna(
  target_contact_id uuid DEFAULT NULL,
  target_company_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer := 0;
BEGIN
  WITH contact_scope AS (
    SELECT DISTINCT c.id
    FROM public.contacts c
    WHERE (
      target_contact_id IS NOT NULL
      AND c.id = target_contact_id
    )
    OR (
      target_contact_id IS NULL
      AND target_company_id IS NOT NULL
      AND c.company_id = target_company_id
    )
    OR (
      target_contact_id IS NULL
      AND target_company_id IS NULL
    )
  ),
  request_tags AS (
    SELECT
      f.kontakt_id AS contact_id,
      unnest(coalesce(f.teknologier, ARRAY[]::text[])) AS tag
    FROM public.foresporsler f
    WHERE f.kontakt_id IN (SELECT id FROM contact_scope)
  ),
  finn_tags AS (
    SELECT
      c.id AS contact_id,
      unnest(coalesce(fa.teknologier_array, ARRAY[]::text[])) AS tag
    FROM public.contacts c
    JOIN public.finn_annonser fa
      ON fa.matched_company_id = c.company_id
    WHERE c.id IN (SELECT id FROM contact_scope)
      AND (
        (
          nullif(lower(coalesce(c.email, '')), '') IS NOT NULL
          AND lower(coalesce(fa.kontakt_epost, '')) = lower(coalesce(c.email, ''))
        )
        OR (
          public.normalize_contact_phone(c.phone) IS NOT NULL
          AND public.normalize_contact_phone(fa.kontakt_telefon) = public.normalize_contact_phone(c.phone)
        )
      )
  ),
  tag_counts AS (
    SELECT
      contact_id,
      tag,
      count(*)::integer AS tag_count
    FROM (
      SELECT * FROM request_tags
      UNION ALL
      SELECT * FROM finn_tags
    ) combined
    WHERE nullif(trim(tag), '') IS NOT NULL
    GROUP BY contact_id, tag
  ),
  aggregated AS (
    SELECT
      scope.id AS contact_id,
      (
        SELECT array_agg(tc.tag ORDER BY tc.tag_count DESC, tc.tag)
        FROM tag_counts tc
        WHERE tc.contact_id = scope.id
      ) AS teknologier
    FROM contact_scope scope
  )
  UPDATE public.contacts c
  SET
    teknologier = aggregated.teknologier,
    updated_at = timezone('utc', now())
  FROM aggregated
  WHERE c.id = aggregated.contact_id;

  SELECT count(*)
  INTO updated_count
  FROM public.contacts c
  WHERE (
    target_contact_id IS NOT NULL
    AND c.id = target_contact_id
  )
  OR (
    target_contact_id IS NULL
    AND target_company_id IS NOT NULL
    AND c.company_id = target_company_id
  )
  OR (
    target_contact_id IS NULL
    AND target_company_id IS NULL
  );

  RETURN updated_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_technical_dna(
  target_company_id uuid DEFAULT NULL,
  target_contact_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  company_profiles_updated integer := 0;
  contacts_updated integer := 0;
BEGIN
  IF target_company_id IS NOT NULL THEN
    company_profiles_updated := public.rebuild_company_technical_dna(target_company_id);
  ELSIF target_contact_id IS NULL THEN
    company_profiles_updated := public.rebuild_company_technical_dna(NULL);
  END IF;

  IF target_contact_id IS NOT NULL THEN
    contacts_updated := public.rebuild_contact_technical_dna(target_contact_id, NULL);
  ELSIF target_company_id IS NOT NULL THEN
    contacts_updated := public.rebuild_contact_technical_dna(NULL, target_company_id);
  ELSE
    contacts_updated := public.rebuild_contact_technical_dna(NULL, NULL);
  END IF;

  RETURN jsonb_build_object(
    'company_profiles_updated', company_profiles_updated,
    'contacts_updated', contacts_updated
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_foresporsel_technical_dna_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.selskap_id IS NOT NULL THEN
      PERFORM public.rebuild_company_technical_dna(OLD.selskap_id);
    END IF;
    IF OLD.kontakt_id IS NOT NULL THEN
      PERFORM public.rebuild_contact_technical_dna(OLD.kontakt_id, NULL);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.selskap_id IS DISTINCT FROM NEW.selskap_id AND OLD.selskap_id IS NOT NULL THEN
      PERFORM public.rebuild_company_technical_dna(OLD.selskap_id);
    END IF;
    IF OLD.kontakt_id IS DISTINCT FROM NEW.kontakt_id AND OLD.kontakt_id IS NOT NULL THEN
      PERFORM public.rebuild_contact_technical_dna(OLD.kontakt_id, NULL);
    END IF;
  END IF;

  IF NEW.selskap_id IS NOT NULL THEN
    PERFORM public.rebuild_company_technical_dna(NEW.selskap_id);
  END IF;
  IF NEW.kontakt_id IS NOT NULL THEN
    PERFORM public.rebuild_contact_technical_dna(NEW.kontakt_id, NULL);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_contact_technical_dna_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.rebuild_contact_technical_dna(NEW.id, NULL);
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS foresporsler_rebuild_technical_dna ON public.foresporsler;
CREATE TRIGGER foresporsler_rebuild_technical_dna
AFTER INSERT OR UPDATE OR DELETE ON public.foresporsler
FOR EACH ROW
EXECUTE FUNCTION public.handle_foresporsel_technical_dna_change();

DROP TRIGGER IF EXISTS contacts_rebuild_technical_dna ON public.contacts;
CREATE TRIGGER contacts_rebuild_technical_dna
AFTER INSERT OR UPDATE OF email, phone, company_id ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.handle_contact_technical_dna_change();

REVOKE ALL ON FUNCTION public.rebuild_company_technical_dna(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rebuild_contact_technical_dna(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rebuild_technical_dna(uuid, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.rebuild_company_technical_dna(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rebuild_contact_technical_dna(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rebuild_technical_dna(uuid, uuid) TO service_role;
