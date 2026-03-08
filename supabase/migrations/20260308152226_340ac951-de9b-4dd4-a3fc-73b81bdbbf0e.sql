
CREATE TABLE stacq_ansatte (
  id          serial PRIMARY KEY,
  ansatt_id   integer,
  navn        text NOT NULL,
  tlf         text,
  epost       text,
  start_dato  date,
  slutt_dato  date,
  status      text DEFAULT 'AKTIV/SIGNERT',
  kommentar   text,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE stacq_ansatte ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can do all on stacq_ansatte" ON stacq_ansatte
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
