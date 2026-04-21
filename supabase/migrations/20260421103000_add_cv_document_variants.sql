CREATE TABLE public.cv_document_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cv_id uuid REFERENCES public.cv_documents(id) ON DELETE CASCADE NOT NULL,
  language_code text NOT NULL DEFAULT 'nb',
  is_anonymized boolean NOT NULL DEFAULT false,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_original_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cv_document_variants_unique_variant UNIQUE (cv_id, language_code, is_anonymized)
);

CREATE INDEX cv_document_variants_cv_id_idx ON public.cv_document_variants(cv_id);
CREATE INDEX cv_document_variants_variant_lookup_idx
  ON public.cv_document_variants(cv_id, language_code, is_anonymized);

ALTER TABLE public.cv_document_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage cv_document_variants"
  ON public.cv_document_variants
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.cv_versions
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.cv_document_variants(id) ON DELETE CASCADE;

CREATE INDEX cv_versions_variant_id_created_at_idx
  ON public.cv_versions(variant_id, created_at DESC);
