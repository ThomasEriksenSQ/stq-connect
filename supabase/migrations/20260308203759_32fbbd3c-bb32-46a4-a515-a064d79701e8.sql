
-- Sync companies.category from the most recent signal activity.
-- Looks at activities linked directly to the company OR via contacts.
-- Uses the most recent activity (by created_at) that has a recognized signal.

WITH all_signal_activities AS (
  -- Direct company activities
  SELECT
    a.company_id AS cid,
    a.created_at,
    a.subject,
    a.description
  FROM activities a
  WHERE a.company_id IS NOT NULL

  UNION ALL

  -- Activities via contacts
  SELECT
    ct.company_id AS cid,
    a.created_at,
    a.subject,
    a.description
  FROM activities a
  JOIN contacts ct ON ct.id = a.contact_id
  WHERE a.contact_id IS NOT NULL
    AND ct.company_id IS NOT NULL
),
parsed AS (
  SELECT
    cid,
    created_at,
    CASE
      -- Check subject first (exact match to current labels)
      WHEN subject IN ('Behov nå','Får fremtidig behov','Får kanskje behov','Ukjent om behov','Ikke aktuelt')
        THEN subject
      -- Legacy subject mappings
      WHEN subject = 'Fremtidig behov' THEN 'Får fremtidig behov'
      WHEN subject = 'Har kanskje behov' THEN 'Får kanskje behov'
      WHEN subject = 'Vil kanskje få behov' THEN 'Får kanskje behov'
      WHEN subject = 'Aldri aktuelt' THEN 'Ikke aktuelt'
      -- Check description bracket pattern [Signal]
      WHEN description ~ '^\[([^\]]+)\]' THEN
        CASE substring(description from '^\[([^\]]+)\]')
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
    END AS signal
  FROM all_signal_activities
),
latest_signal AS (
  SELECT DISTINCT ON (cid)
    cid,
    signal
  FROM parsed
  WHERE signal IS NOT NULL
  ORDER BY cid, created_at DESC
)
UPDATE companies c
SET category = ls.signal
FROM latest_signal ls
WHERE c.id = ls.cid
  AND ls.signal IS NOT NULL
  AND (c.category IS DISTINCT FROM ls.signal);
