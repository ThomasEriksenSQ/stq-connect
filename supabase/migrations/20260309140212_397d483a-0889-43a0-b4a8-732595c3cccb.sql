
CREATE TABLE public.finn_annonser (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dato date NOT NULL,
  uke text,
  selskap text,
  stillingsrolle text,
  lokasjon text,
  teknologier text,
  lenke text,
  kontaktnavn text,
  kontakt_epost text,
  kontakt_telefon text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (dato, selskap, lenke)
);

ALTER TABLE public.finn_annonser ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select finn_annonser"
  ON public.finn_annonser
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert finn_annonser"
  ON public.finn_annonser
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete finn_annonser"
  ON public.finn_annonser
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
