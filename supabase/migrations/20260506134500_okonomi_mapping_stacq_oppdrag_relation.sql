ALTER TABLE public.okonomi_ansatt_tripletex_mapping
  ADD COLUMN IF NOT EXISTS stacq_oppdrag_id integer REFERENCES public.stacq_oppdrag(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS okonomi_ansatt_tripletex_mapping_stacq_oppdrag_idx
  ON public.okonomi_ansatt_tripletex_mapping(stacq_oppdrag_id)
  WHERE stacq_oppdrag_id IS NOT NULL;

UPDATE public.okonomi_ansatt_tripletex_mapping mapping
SET stacq_oppdrag_id = oppdrag.id,
    project_name = COALESCE(mapping.project_name, oppdrag.kunde),
    active_from = COALESCE(mapping.active_from, oppdrag.start_dato),
    active_to = COALESCE(mapping.active_to, oppdrag.slutt_dato),
    updated_at = now()
FROM public.stacq_oppdrag oppdrag
WHERE mapping.stacq_oppdrag_id IS NULL
  AND oppdrag.ansatt_id = mapping.ansatt_id
  AND mapping.tripletex_project_id IS NOT NULL
  AND oppdrag.oppdrag_id = mapping.tripletex_project_id;

NOTIFY pgrst, 'reload schema';
