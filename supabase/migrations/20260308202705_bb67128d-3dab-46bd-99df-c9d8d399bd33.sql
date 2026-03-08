
UPDATE companies c
SET category = latest_signal.subject
FROM (
  SELECT DISTINCT ON (a.company_id) a.company_id, a.subject
  FROM activities a
  WHERE a.description IN ('[Behov nå]','[Får fremtidig behov]','[Får kanskje behov]','[Ukjent om behov]','[Ikke aktuelt]')
  ORDER BY a.company_id, a.created_at DESC
) latest_signal
WHERE c.id = latest_signal.company_id
  AND latest_signal.subject IN ('Behov nå','Får fremtidig behov','Får kanskje behov','Ukjent om behov','Ikke aktuelt')
