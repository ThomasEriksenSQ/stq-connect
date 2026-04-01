import type { QueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { buildOppdragWritePayload, type OppdragFormState } from "@/lib/oppdragForm";

const OPPDRAG_QUERY_KEYS = [
  ["stacq-oppdrag"],
  ["stacq-oppdrag-prisen"],
  ["stacq-oppdrag-active-names"],
  ["stacq-oppdrag-fornyelser"],
] as const;

export async function invalidateOppdragQueries(queryClient: QueryClient) {
  await Promise.all(
    OPPDRAG_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey: [...queryKey] })),
  );
}

export async function createOppdrag(
  value: OppdragFormState,
  options?: { allowMissingRelation?: boolean },
) {
  const payload = buildOppdragWritePayload(value, options);
  const { data, error } = await supabase
    .from("stacq_oppdrag")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateOppdrag(
  id: number,
  value: OppdragFormState,
  options?: { allowMissingRelation?: boolean },
) {
  const payload = buildOppdragWritePayload(value, options);
  const { error } = await supabase
    .from("stacq_oppdrag")
    .update(payload)
    .eq("id", id);

  if (error) throw error;
}

export async function terminateOppdrag(id: number) {
  const { error } = await supabase
    .from("stacq_oppdrag")
    .update({ status: "Inaktiv", slutt_dato: format(new Date(), "yyyy-MM-dd") })
    .eq("id", id);

  if (error) throw error;
}
