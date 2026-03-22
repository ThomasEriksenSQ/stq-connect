CREATE TABLE IF NOT EXISTS varslingsinnstillinger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  epost_mottakere text[] NOT NULL DEFAULT ARRAY['thomas@stacq.no'],
  terskel_dager integer NOT NULL DEFAULT 90,
  aktiv boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE varslingsinnstillinger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read varslingsinnstillinger" ON varslingsinnstillinger FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin update varslingsinnstillinger" ON varslingsinnstillinger FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin insert varslingsinnstillinger" ON varslingsinnstillinger FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO varslingsinnstillinger (epost_mottakere, terskel_dager, aktiv)
VALUES (ARRAY['thomas@stacq.no'], 90, true)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_stacq_oppdrag_forny_dato
  ON stacq_oppdrag (forny_dato)
  WHERE status != 'Inaktiv' AND forny_dato IS NOT NULL;