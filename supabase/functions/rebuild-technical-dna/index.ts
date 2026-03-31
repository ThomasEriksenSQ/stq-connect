import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { normalizeTechnologyTags } from "../_shared/technologyTags.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ForesporselRow = {
  id: number;
  selskap_id: string | null;
  kontakt_id: string | null;
  teknologier: string[] | null;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireAdmin(req);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const companyId = typeof body.companyId === "string" && body.companyId.trim() ? body.companyId.trim() : null;
    const contactId = typeof body.contactId === "string" && body.contactId.trim() ? body.contactId.trim() : null;

    let requestsQuery = supabase
      .from("foresporsler")
      .select("id, selskap_id, kontakt_id, teknologier");

    if (companyId) requestsQuery = requestsQuery.eq("selskap_id", companyId);
    if (contactId) requestsQuery = requestsQuery.eq("kontakt_id", contactId);

    const { data: foresporsler, error: foresporslerError } = await requestsQuery;
    if (foresporslerError) throw foresporslerError;

    let normalizedRequests = 0;
    for (const foresporsel of (foresporsler || []) as ForesporselRow[]) {
      const normalizedTags = normalizeTechnologyTags(foresporsel.teknologier || []);
      const currentTags = foresporsel.teknologier || [];

      if (JSON.stringify(currentTags) === JSON.stringify(normalizedTags)) continue;

      const { error } = await supabase
        .from("foresporsler")
        .update({
          teknologier: normalizedTags,
          updated_at: new Date().toISOString(),
        })
        .eq("id", foresporsel.id);

      if (error) throw error;
      normalizedRequests += 1;
    }

    const { data: rebuildResult, error: rebuildError } = await supabase.rpc("rebuild_technical_dna", {
      target_company_id: companyId,
      target_contact_id: contactId,
    });
    if (rebuildError) throw rebuildError;

    return jsonResponse({
      company_id: companyId,
      contact_id: contactId,
      foresporsler_normalisert: normalizedRequests,
      company_profiles_updated: Number((rebuildResult as { company_profiles_updated?: number } | null)?.company_profiles_updated || 0),
      contacts_updated: Number((rebuildResult as { contacts_updated?: number } | null)?.contacts_updated || 0),
    });
  } catch (error) {
    console.error("rebuild-technical-dna error:", error);
    if (error instanceof Error && error.name === "Forbidden") {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    return jsonResponse({ error: error instanceof Error ? error.message : "Ukjent feil" }, 500);
  }
});
