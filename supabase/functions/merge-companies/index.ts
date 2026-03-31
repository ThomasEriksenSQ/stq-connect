import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { buildCompanyMergePreview, type CompanyMergeRelationCounts, type MergeableCompany } from "../_shared/companyMerge.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (claimsError || !claimsData?.claims?.sub) {
    throw new Error("Unauthorized");
  }

  const userId = claimsData.claims.sub as string;

  const { data: isAdmin } = await anonClient.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (!isAdmin) {
    const error = new Error("Forbidden");
    error.name = "Forbidden";
    throw error;
  }

  return userId;
}

async function countRelatedRows(
  supabase: ReturnType<typeof createClient>,
  table: string,
  column: string,
  value: string,
) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true }).eq(column, value);
  if (error) throw error;
  return count ?? 0;
}

async function fetchCompany(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
) {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, org_number, sf_account_id, website, phone, email, address, city, zip_code, linkedin, industry, owner_id, notes, status")
    .eq("id", companyId)
    .single();

  if (error) throw error;
  return data as MergeableCompany;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminUserId = await requireAdmin(req);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "preview";
    const sourceCompanyId = typeof body.sourceCompanyId === "string" ? body.sourceCompanyId : null;
    const targetCompanyId = typeof body.targetCompanyId === "string" ? body.targetCompanyId : null;

    if (!sourceCompanyId || !targetCompanyId) {
      return jsonResponse({ error: "Source and target company are required" }, 400);
    }

    if (sourceCompanyId === targetCompanyId) {
      return jsonResponse({ error: "Source and target company must be different" }, 400);
    }

    const [sourceCompany, targetCompany, contacts, activities, tasks, foresporsler, finn, external, oppdrag, aliases] =
      await Promise.all([
        fetchCompany(supabase, sourceCompanyId),
        fetchCompany(supabase, targetCompanyId),
        countRelatedRows(supabase, "contacts", "company_id", sourceCompanyId),
        countRelatedRows(supabase, "activities", "company_id", sourceCompanyId),
        countRelatedRows(supabase, "tasks", "company_id", sourceCompanyId),
        countRelatedRows(supabase, "foresporsler", "selskap_id", sourceCompanyId),
        countRelatedRows(supabase, "finn_annonser", "matched_company_id", sourceCompanyId),
        countRelatedRows(supabase, "external_consultants", "company_id", sourceCompanyId),
        countRelatedRows(supabase, "stacq_oppdrag", "selskap_id", sourceCompanyId),
        countRelatedRows(supabase, "company_aliases", "company_id", sourceCompanyId),
      ]);

    const relationCounts: CompanyMergeRelationCounts = {
      contacts,
      activities,
      tasks,
      foresporsler,
      finn_annonser: finn,
      external_consultants: external,
      stacq_oppdrag: oppdrag,
      source_aliases: aliases,
    };

    const preview = buildCompanyMergePreview(sourceCompany, targetCompany, relationCounts);

    if (action === "preview") {
      return jsonResponse({
        sourceCompany,
        targetCompany,
        ...preview,
      });
    }

    if (action !== "execute") {
      return jsonResponse({ error: "Invalid action" }, 400);
    }

    if (!preview.canMerge) {
      return jsonResponse(
        {
          error: "Merge blocked",
          blockingConflicts: preview.blockingConflicts,
        },
        400,
      );
    }

    const { data, error } = await supabase.rpc("execute_company_merge", {
      p_source_company_id: sourceCompanyId,
      p_target_company_id: targetCompanyId,
      p_merged_by: adminUserId,
    });

    if (error) {
      const status =
        error.message.includes("Merge blocked") ||
        error.message.includes("not found") ||
        error.message.includes("must be different")
          ? 400
          : 500;
      return jsonResponse({ error: error.message }, status);
    }

    return jsonResponse({
      ok: true,
      result: data,
    });
  } catch (error) {
    console.error("merge-companies error:", error);
    if (error instanceof Error && error.name === "Forbidden") {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    return jsonResponse({ error: error instanceof Error ? error.message : "Ukjent feil" }, 500);
  }
});
