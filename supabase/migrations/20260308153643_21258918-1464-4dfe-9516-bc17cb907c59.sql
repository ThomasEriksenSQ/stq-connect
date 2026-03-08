
ALTER TABLE stacq_ansatte 
  ADD COLUMN IF NOT EXISTS bilde_url text,
  ADD COLUMN IF NOT EXISTS erfaring_aar integer,
  ADD COLUMN IF NOT EXISTS geografi text,
  ADD COLUMN IF NOT EXISTS kompetanse text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS linkedin text,
  ADD COLUMN IF NOT EXISTS synlig_web boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

INSERT INTO storage.buckets (id, name, public)
VALUES ('ansatte-bilder', 'ansatte-bilder', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read ansatte-bilder" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'ansatte-bilder');

CREATE POLICY "Authenticated upload ansatte-bilder" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ansatte-bilder');

CREATE POLICY "Authenticated update ansatte-bilder" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'ansatte-bilder');

CREATE POLICY "Authenticated delete ansatte-bilder" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'ansatte-bilder');
