
-- External consultants table
CREATE TABLE public.external_consultants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'freelance' CHECK (type IN ('freelance', 'partner', 'konsulenthus')),
  status text NOT NULL DEFAULT 'ledig' CHECK (status IN ('aktiv', 'ledig', 'utilgjengelig', 'utgått')),
  rolle text,
  teknologier text[] DEFAULT '{}'::text[],
  erfaring_aar integer,
  tilgjengelig_fra date,
  tilgjengelig_til date,
  kapasitet_prosent integer DEFAULT 100,
  innpris_time numeric,
  utpris_time numeric,
  valuta text DEFAULT 'NOK',
  cv_url text,
  notat text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.external_consultants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read external_consultants"
  ON public.external_consultants FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin can insert external_consultants"
  ON public.external_consultants FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update external_consultants"
  ON public.external_consultants FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete external_consultants"
  ON public.external_consultants FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
