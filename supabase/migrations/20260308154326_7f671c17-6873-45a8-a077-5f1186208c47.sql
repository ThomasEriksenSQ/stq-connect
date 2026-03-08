ALTER TABLE stacq_oppdrag
  ADD COLUMN IF NOT EXISTS ekstra_kostnad numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS til_konsulent_override numeric DEFAULT NULL;