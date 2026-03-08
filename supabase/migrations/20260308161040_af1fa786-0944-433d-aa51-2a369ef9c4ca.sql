
-- Junction table linking foresporsler to stacq_ansatte
CREATE TABLE public.foresporsler_konsulenter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  foresporsler_id bigint NOT NULL REFERENCES public.foresporsler(id) ON DELETE CASCADE,
  ansatt_id integer NOT NULL REFERENCES public.stacq_ansatte(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(foresporsler_id, ansatt_id)
);

ALTER TABLE public.foresporsler_konsulenter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access on foresporsler_konsulenter"
  ON public.foresporsler_konsulenter
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Drop old free-text columns
ALTER TABLE public.foresporsler DROP COLUMN IF EXISTS antall_sendt;
ALTER TABLE public.foresporsler DROP COLUMN IF EXISTS hvem_sendt;
