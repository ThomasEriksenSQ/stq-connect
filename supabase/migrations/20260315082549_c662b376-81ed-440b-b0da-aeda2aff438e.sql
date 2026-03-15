
-- cv_documents table
CREATE TABLE public.cv_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ansatt_id integer REFERENCES public.stacq_ansatte(id) ON DELETE CASCADE NOT NULL,
  title text DEFAULT 'CV',
  hero_name text,
  hero_title text,
  intro_paragraphs jsonb DEFAULT '[]'::jsonb,
  competence_groups jsonb DEFAULT '[]'::jsonb,
  projects jsonb DEFAULT '[]'::jsonb,
  education jsonb DEFAULT '[]'::jsonb,
  work_experience jsonb DEFAULT '[]'::jsonb,
  sidebar_sections jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.cv_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can do all on cv_documents"
  ON public.cv_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anon can select cv_documents"
  ON public.cv_documents FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can update cv_documents"
  ON public.cv_documents FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- cv_versions table
CREATE TABLE public.cv_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cv_id uuid REFERENCES public.cv_documents(id) ON DELETE CASCADE NOT NULL,
  snapshot jsonb NOT NULL,
  saved_by text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cv_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can do all on cv_versions"
  ON public.cv_versions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anon can insert cv_versions"
  ON public.cv_versions FOR INSERT TO anon WITH CHECK (true);

-- cv_access_tokens table
CREATE TABLE public.cv_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ansatt_id integer REFERENCES public.stacq_ansatte(id) ON DELETE CASCADE NOT NULL,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  pin_hash text NOT NULL,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cv_access_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can do all on cv_access_tokens"
  ON public.cv_access_tokens FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anon can select cv_access_tokens"
  ON public.cv_access_tokens FOR SELECT TO anon USING (true);
