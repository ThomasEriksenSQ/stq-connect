ALTER TABLE public.stacq_oppdrag
ADD COLUMN IF NOT EXISTS ansatt_id integer REFERENCES public.stacq_ansatte(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS ekstern_id uuid REFERENCES public.external_consultants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stacq_oppdrag_ansatt_id
  ON public.stacq_oppdrag (ansatt_id);

CREATE INDEX IF NOT EXISTS idx_stacq_oppdrag_ekstern_id
  ON public.stacq_oppdrag (ekstern_id);

ALTER TABLE public.stacq_oppdrag
DROP CONSTRAINT IF EXISTS stacq_oppdrag_single_person_link;

ALTER TABLE public.stacq_oppdrag
ADD CONSTRAINT stacq_oppdrag_single_person_link
CHECK (num_nonnulls(ansatt_id, ekstern_id) <= 1);

ALTER TABLE public.stacq_oppdrag
DROP CONSTRAINT IF EXISTS stacq_oppdrag_person_type_consistency;

ALTER TABLE public.stacq_oppdrag
ADD CONSTRAINT stacq_oppdrag_person_type_consistency
CHECK (
  (ansatt_id IS NULL OR COALESCE(er_ansatt, false) = true)
  AND (ekstern_id IS NULL OR COALESCE(er_ansatt, false) = false)
);

WITH unique_ansatte AS (
  SELECT lower(trim(navn)) AS normalized_name, min(id) AS id, count(*) AS match_count
  FROM public.stacq_ansatte
  GROUP BY 1
)
UPDATE public.stacq_oppdrag AS oppdrag
SET
  ansatt_id = ansatte.id,
  er_ansatt = true,
  kandidat = trim(oppdrag.kandidat)
FROM unique_ansatte AS ansatte
WHERE oppdrag.ansatt_id IS NULL
  AND oppdrag.ekstern_id IS NULL
  AND COALESCE(oppdrag.er_ansatt, false) = true
  AND lower(trim(oppdrag.kandidat)) = ansatte.normalized_name
  AND ansatte.match_count = 1;

WITH unique_eksterne AS (
  SELECT lower(trim(navn)) AS normalized_name, min(id::text)::uuid AS id, count(*) AS match_count
  FROM public.external_consultants
  WHERE navn IS NOT NULL
  GROUP BY 1
)
UPDATE public.stacq_oppdrag AS oppdrag
SET
  ekstern_id = eksterne.id,
  er_ansatt = false,
  kandidat = trim(oppdrag.kandidat)
FROM unique_eksterne AS eksterne
WHERE oppdrag.ansatt_id IS NULL
  AND oppdrag.ekstern_id IS NULL
  AND COALESCE(oppdrag.er_ansatt, false) = false
  AND lower(trim(oppdrag.kandidat)) = eksterne.normalized_name
  AND eksterne.match_count = 1;
