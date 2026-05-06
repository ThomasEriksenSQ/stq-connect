CREATE TABLE IF NOT EXISTS public.okonomi_month_status (
  year integer NOT NULL,
  month text NOT NULL,
  ready boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (year, month)
);

ALTER TABLE public.okonomi_month_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read okonomi_month_status"
  ON public.okonomi_month_status
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated insert okonomi_month_status"
  ON public.okonomi_month_status
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated update okonomi_month_status"
  ON public.okonomi_month_status
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'okonomi_month_status'
    )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.okonomi_month_status;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
