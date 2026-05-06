UPDATE public.stacq_ansatte ansatte
SET ansatt_id = mapping.tripletex_employee_id,
    updated_at = now()
FROM (
  SELECT DISTINCT ON (ansatt_id)
    ansatt_id,
    tripletex_employee_id
  FROM public.okonomi_ansatt_tripletex_mapping
  WHERE tripletex_employee_id IS NOT NULL
  ORDER BY ansatt_id, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
) mapping
WHERE ansatte.id = mapping.ansatt_id
  AND ansatte.ansatt_id IS NULL;

NOTIFY pgrst, 'reload schema';
