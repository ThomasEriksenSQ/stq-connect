import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  buildExternalDuplicateGroups,
  matchExternalToEmployee,
  pickPrimaryExternalConsultant,
  type CleanupSummary,
  type EmployeeIdentity,
  type ExternalConsultantIdentity,
} from "../_shared/candidateIdentity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type CleanupResponse = {
  summary: CleanupSummary;
  deleted_ids: string[];
  skipped_ids: string[];
  ansatte_matches: Array<{ external_id: string; employee_id: number | string; score: number; reasons: string[] }>;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function requireAdminOrServiceRole(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const token = authHeader.replace("Bearer ", "");
  if (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return;
  }

  const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims?.sub) {
    throw new Error("Unauthorized");
  }

  const { data: isAdmin } = await anonClient.rpc("has_role", {
    _user_id: claimsData.claims.sub as string,
    _role: "admin",
  });

  if (!isAdmin) {
    const error = new Error("Forbidden");
    error.name = "Forbidden";
    throw error;
  }
}

function getProtectedPrimary(group: ExternalConsultantIdentity[], protectedIds: Set<string>) {
  const protectedCandidates = group.filter((candidate) => protectedIds.has(candidate.id));
  if (protectedCandidates.length > 0) {
    return pickPrimaryExternalConsultant(protectedCandidates);
  }
  return pickPrimaryExternalConsultant(group);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireAdminOrServiceRole(req);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [{ data: externals, error: externalsError }, { data: employees, error: employeesError }, { data: referencedRows, error: referencedError }] =
      await Promise.all([
        supabase
          .from("external_consultants")
          .select("id, navn, epost, telefon, rolle, selskap_tekst, cv_tekst, teknologier, status, type, created_at, updated_at"),
        supabase
          .from("stacq_ansatte")
          .select("id, navn, epost, tlf, bio, kompetanse, geografi, updated_at"),
        supabase
          .from("foresporsler_konsulenter")
          .select("ekstern_id")
          .not("ekstern_id", "is", null),
      ]);

    if (externalsError) throw externalsError;
    if (employeesError) throw employeesError;
    if (referencedError) throw referencedError;

    const externalRows = (externals || []) as ExternalConsultantIdentity[];
    const employeeRows = (employees || []) as EmployeeIdentity[];
    const protectedIds = new Set((referencedRows || []).map((row) => row.ekstern_id as string).filter(Boolean));

    const deletedIds = new Set<string>();
    const skippedIds = new Set<string>();
    const ansatteMatches: CleanupResponse["ansatte_matches"] = [];

    for (const candidate of externalRows) {
      const employeeMatch = matchExternalToEmployee(candidate, employeeRows);
      if (!employeeMatch) continue;

      ansatteMatches.push({
        external_id: candidate.id,
        employee_id: employeeMatch.employeeId,
        score: employeeMatch.score,
        reasons: employeeMatch.reasons,
      });

      if (protectedIds.has(candidate.id)) {
        skippedIds.add(candidate.id);
      } else {
        deletedIds.add(candidate.id);
      }
    }

    const duplicateCandidates = externalRows.filter((candidate) => !deletedIds.has(candidate.id));
    const duplicateGroups = buildExternalDuplicateGroups(duplicateCandidates);

    for (const group of duplicateGroups) {
      const primary = getProtectedPrimary(group, protectedIds);

      for (const candidate of group) {
        if (candidate.id === primary.id) continue;

        if (protectedIds.has(candidate.id)) {
          skippedIds.add(candidate.id);
        } else {
          deletedIds.add(candidate.id);
        }
      }
    }

    const finalDeletedIds = [...deletedIds];
    if (finalDeletedIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("external_consultants")
        .delete()
        .in("id", finalDeletedIds);

      if (deleteError) throw deleteError;
    }

    const summary: CleanupSummary = {
      total_external: externalRows.length,
      matched_to_ansatte: ansatteMatches.length,
      merged_duplicate_groups: duplicateGroups.length,
      deleted_external_ids: finalDeletedIds.length,
      skipped_referenced: skippedIds.size,
      kept_external: externalRows.length - finalDeletedIds.length,
    };

    return jsonResponse({
      summary,
      deleted_ids: finalDeletedIds,
      skipped_ids: [...skippedIds],
      ansatte_matches: ansatteMatches.slice(0, 25),
    } satisfies CleanupResponse);
  } catch (error) {
    console.error("cleanup-external-consultants error:", error);
    if (error instanceof Error && error.name === "Forbidden") {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    return jsonResponse({ error: error instanceof Error ? error.message : "Ukjent feil" }, 500);
  }
});
