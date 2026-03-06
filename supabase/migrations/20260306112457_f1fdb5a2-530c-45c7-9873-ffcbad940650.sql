
-- Move activity-like records from tasks to activities
INSERT INTO activities (subject, type, description, contact_id, company_id, created_by, created_at)
SELECT 
  title as subject,
  CASE 
    WHEN title ILIKE '%telefonsamtale%' OR title ILIKE '%oppringing%' OR title ILIKE '%ringt%' 
      OR title ILIKE '%forsøkt å ringe%' OR title ILIKE '%forsøkte å ringe%' OR title ILIKE '%ingen svar%'
      OR title ILIKE '%telefon,%' OR title ILIKE '%ring opp%' THEN 'call'
    WHEN title ILIKE '%list email%' OR title ILIKE '%sendt mail%' OR title ILIKE '%e-post%' 
      OR title = 'Mail/LN' THEN 'email'
    WHEN title ILIKE '%linkedin%' OR title ILIKE '%mld på%' OR title ILIKE '%sendt mld%' THEN 'note'
    WHEN title ILIKE '%lunsj%' OR title ILIKE '%møte%' OR title ILIKE '%visning%' THEN 'meeting'
    ELSE 'note'
  END as type,
  description,
  contact_id,
  company_id,
  created_by,
  created_at
FROM tasks 
WHERE title ILIKE '%telefonsamtale%' 
  OR title ILIKE '%oppringing%' 
  OR title ILIKE '%ringt%' 
  OR title ILIKE '%forsøkt å ringe%' 
  OR title ILIKE '%forsøkte å ringe%'
  OR title ILIKE '%ingen svar%'
  OR title ILIKE '%telefon,%'
  OR title ILIKE '%list email%' 
  OR title ILIKE '%sendt mail%'
  OR title ILIKE '%linkedin%' 
  OR title ILIKE '%mld på%' 
  OR title ILIKE '%sendt mld%'
  OR title ILIKE '%lunsj%'
  OR title = 'Mail/LN';

-- Delete moved records from tasks
DELETE FROM tasks 
WHERE title ILIKE '%telefonsamtale%' 
  OR title ILIKE '%oppringing%' 
  OR title ILIKE '%ringt%' 
  OR title ILIKE '%forsøkt å ringe%' 
  OR title ILIKE '%forsøkte å ringe%'
  OR title ILIKE '%ingen svar%'
  OR title ILIKE '%telefon,%'
  OR title ILIKE '%list email%' 
  OR title ILIKE '%sendt mail%'
  OR title ILIKE '%linkedin%' 
  OR title ILIKE '%mld på%' 
  OR title ILIKE '%sendt mld%'
  OR title ILIKE '%lunsj%'
  OR title = 'Mail/LN';
