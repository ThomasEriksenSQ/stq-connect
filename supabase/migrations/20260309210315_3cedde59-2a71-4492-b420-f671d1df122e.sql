ALTER TABLE foresporsler_konsulenter
DROP CONSTRAINT IF EXISTS foresporsler_konsulenter_status_check;
ALTER TABLE foresporsler_konsulenter
ADD CONSTRAINT foresporsler_konsulenter_status_check
CHECK (status IN (
  'sendt_cv', 'intervju', 'vunnet', 
  'avslag', 'bortfalt'
));