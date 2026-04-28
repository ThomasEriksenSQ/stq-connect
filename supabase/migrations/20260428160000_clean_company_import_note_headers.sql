WITH note_lines AS (
  SELECT
    companies.id,
    lines.ordinality,
    lines.line
  FROM public.companies
  CROSS JOIN LATERAL regexp_split_to_table(companies.notes, E'\\r?\\n') WITH ORDINALITY AS lines(line, ordinality)
  WHERE companies.notes IS NOT NULL
    AND companies.notes ~* '(must[-[:space:]]*have|kilde[[:space:]]*:?[[:space:]]*linkedin|nace[[:space:]]*:?)'
),
cleaned_notes AS (
  SELECT
    id,
    NULLIF(
      btrim(
        regexp_replace(
          string_agg(line, E'\n' ORDER BY ordinality)
            FILTER (
              WHERE NOT (
                line ~* '^[[:space:]]*\\[?[[:space:]]*must[-[:space:]]*have[[:space:]]*\\]?[[:space:]]*$'
                OR line ~* '^[[:space:]]*kilde[[:space:]]*:?[[:space:]]*linkedin[-[:space:]]*import[[:space:]]*$'
                OR line ~* '^[[:space:]]*nace([[:space:]]*:|[[:space:]]+[0-9]).*$'
              )
            ),
          E'(\\n[[:blank:]]*){3,}',
          E'\n\n',
          'g'
        )
      ),
      ''
    ) AS notes
  FROM note_lines
  GROUP BY id
)
UPDATE public.companies
SET notes = cleaned_notes.notes,
    updated_at = now()
FROM cleaned_notes
WHERE companies.id = cleaned_notes.id
  AND companies.notes IS DISTINCT FROM cleaned_notes.notes;
