
CREATE TABLE public.foresporsler (
  id              bigserial PRIMARY KEY,
  mottatt_dato    date NOT NULL DEFAULT CURRENT_DATE,
  frist_dato      date,
  selskap_id      uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  selskap_navn    text NOT NULL,
  sted            text,
  avdeling        text,
  type            text CHECK (type IN ('DIR', 'VIA')) DEFAULT 'DIR',
  referanse       text CHECK (referanse IN ('Kunde', 'Cold call', 'Partner')),
  teknologier     text[] DEFAULT '{}',
  kommentar       text,
  status          text CHECK (status IN ('Ny', 'Aktiv', 'Fullført', 'Tapt')) DEFAULT 'Ny',
  kontakt_id      uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  antall_sendt    integer DEFAULT 0,
  hvem_sendt      text,
  created_by      uuid,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.foresporsler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read foresporsler"
  ON public.foresporsler FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert foresporsler"
  ON public.foresporsler FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update foresporsler"
  ON public.foresporsler FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin can delete foresporsler"
  ON public.foresporsler FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
