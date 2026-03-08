
UPDATE companies c
SET category = CASE
  WHEN latest.cat = 'Fremtidig behov' THEN 'Får fremtidig behov'
  WHEN latest.cat = 'Har kanskje behov' THEN 'Får kanskje behov'
  WHEN latest.cat = 'Vil kanskje få behov' THEN 'Får kanskje behov'
  WHEN latest.cat = 'Aldri aktuelt' THEN 'Ikke aktuelt'
  ELSE latest.cat
END
FROM (
  SELECT DISTINCT ON (a.company_id) 
    a.company_id,
    substring(a.description from '^\[([^\]]+)\]') as cat
  FROM activities a
  WHERE a.description ~ '^\[[^\]]+\]'
  ORDER BY a.company_id, a.created_at DESC
) latest
WHERE c.id = latest.company_id
  AND latest.cat IS NOT NULL
  AND (
    latest.cat IN ('Behov nå','Får fremtidig behov','Får kanskje behov','Ukjent om behov','Ikke aktuelt')
    OR latest.cat IN ('Fremtidig behov','Har kanskje behov','Vil kanskje få behov','Aldri aktuelt')
  )
