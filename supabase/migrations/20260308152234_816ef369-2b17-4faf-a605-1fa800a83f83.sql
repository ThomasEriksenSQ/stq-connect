
CREATE TABLE stacq_oppdrag (
  id            serial PRIMARY KEY,
  oppdrag_id    integer,
  kandidat      text NOT NULL,
  er_ansatt     boolean DEFAULT false,
  status        text DEFAULT 'Aktiv',
  utpris        numeric,
  til_konsulent numeric,
  kunde         text,
  deal_type     text,
  start_dato    date,
  forny_dato    date,
  slutt_dato    date,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE stacq_oppdrag ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can do all on stacq_oppdrag" ON stacq_oppdrag
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
