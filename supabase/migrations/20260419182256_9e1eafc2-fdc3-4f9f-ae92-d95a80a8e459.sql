ALTER TABLE public.stacq_oppdrag
  ADD COLUMN IF NOT EXISTS partner_selskap_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS partner_navn text;

CREATE INDEX IF NOT EXISTS idx_stacq_oppdrag_partner_selskap_id
  ON public.stacq_oppdrag(partner_selskap_id);