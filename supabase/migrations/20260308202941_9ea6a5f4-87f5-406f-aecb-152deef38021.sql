
WITH latest_signal AS (
  SELECT DISTINCT ON (COALESCE(a.company_id, ct.company_id))
    COALESCE(a.company_id, ct.company_id) as cid,
    CASE
      WHEN a.subject IN ('Behov nå','Får fremtidig behov','Får kanskje behov','Ukjent om behov','Ikke aktuelt') THEN a.subject
      WHEN a.subject IN ('Fremtidig behov','Har kanskje behov','Vil kanskje få behov','Aldri aktuelt') THEN
        CASE a.subject
          WHEN 'Fremtidig behov' THEN 'Får fremtidig behov'
          WHEN 'Har kanskje behov' THEN 'Får kanskje behov'
          WHEN 'Vil kanskje få behov' THEN 'Får kanskje behov'
          WHEN 'Aldri aktuelt' THEN 'Ikke aktuelt'
        END
      WHEN a.description ~ '^\[[^\]]+\]' THEN
        CASE substring(a.description from '^\[([^\]]+)\]')
          WHEN 'Behov nå' THEN 'Behov nå'
          WHEN 'Får fremtidig behov' THEN 'Får fremtidig behov'
          WHEN 'Får kanskje behov' THEN 'Får kanskje behov'
          WHEN 'Ukjent om behov' THEN 'Ukjent om behov'
          WHEN 'Ikke aktuelt' THEN 'Ikke aktuelt'
          WHEN 'Fremtidig behov' THEN 'Får fremtidig behov'
          WHEN 'Har kanskje behov' THEN 'Får kanskje behov'
          WHEN 'Vil kanskje få behov' THEN 'Får kanskje behov'
          WHEN 'Aldri aktuelt' THEN 'Ikke aktuelt'
          ELSE NULL
        END
      ELSE NULL
    END as signal
  FROM activities a
  LEFT JOIN contacts ct ON ct.id = a.contact_id AND a.company_id IS NULL
  WHERE COALESCE(a.company_id, ct.company_id) IS NOT NULL
    AND (
      a.subject IN ('Behov nå','Får fremtidig behov','Får kanskje behov','Ukjent om behov','Ikke aktuelt','Fremtidig behov','Har kanskje behov','Vil kanskje få behov','Aldri aktuelt')
      OR a.description ~ '^\[(Behov nå|Får fremtidig behov|Får kanskje behov|Ukjent om behov|Ikke aktuelt|Fremtidig behov|Har kanskje behov|Vil kanskje få behov|Aldri aktuelt)\]'
    )
  ORDER BY COALESCE(a.company_id, ct.company_id), a.created_at DESC
)
UPDATE companies c
SET category = ls.signal
FROM latest_signal ls
WHERE c.id = ls.cid AND ls.signal IS NOT NULL
