import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { findBestCompanyMatch } from "../_shared/companyMatch.ts";
import { mergeTechnologyTags } from "../_shared/technologyTags.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type FinnAnnonseRow = {
  id: string;
  uke: string | null;
  selskap: string | null;
  teknologier: string | null;
  teknologier_array: string[] | null;
  matched_company_id: string | null;
};

type CompanyRef = {
  id: string;
  name: string;
  status: string | null;
  aliases?: string[];
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
    const requestedWeeks = Array.isArray(body.uker)
      ? body.uker.filter((week: unknown): week is string => typeof week === "string" && week.trim().length > 0)
      : [];
    const requestedIds = Array.isArray(body.ids)
      ? body.ids.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
      : [];

    let weeks = requestedWeeks;
    if (body.uke && typeof body.uke === "string" && body.uke.trim()) {
      weeks = [...new Set([...weeks, body.uke.trim()])];
    }

    if (requestedIds.length === 0 && weeks.length === 0) {
      const { data: latestWeekRow, error: latestWeekError } = await supabase
        .from("finn_annonser")
        .select("uke")
        .not("uke", "is", null)
        .order("uke", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestWeekError) throw latestWeekError;
      if (latestWeekRow?.uke) weeks = [latestWeekRow.uke];
    }

    let rowsQuery = supabase
      .from("finn_annonser")
      .select("id, uke, selskap, teknologier, teknologier_array, matched_company_id");

    if (requestedIds.length > 0) {
      rowsQuery = rowsQuery.in("id", requestedIds);
    } else if (weeks.length > 0) {
      rowsQuery = rowsQuery.in("uke", weeks);
    }

    const { data: rows, error: rowsError } = await rowsQuery;
    if (rowsError) throw rowsError;

    const annonser = (rows || []) as FinnAnnonseRow[];
    if (annonser.length === 0) {
      return jsonResponse({
        uke: weeks[0] || null,
        annonser_behandlet: 0,
        teknologier_array_fikset: 0,
        selskaper_med_teknologier: 0,
        dna_profiler_oppdatert: 0,
        kontakter_oppdatert: 0,
        errors: [],
      });
    }

    const [{ data: companies, error: companiesError }, { data: aliases, error: aliasesError }] = await Promise.all([
      supabase.from("companies").select("id, name, status"),
      supabase.from("company_aliases").select("company_id, alias_name"),
    ]);
    if (companiesError || aliasesError) throw companiesError || aliasesError;

    const aliasMap = new Map<string, string[]>();
    (aliases || []).forEach((alias) => {
      const list = aliasMap.get(alias.company_id) || [];
      list.push(alias.alias_name);
      aliasMap.set(alias.company_id, list);
    });

    const companiesWithAliases = ((companies || []) as CompanyRef[]).map((company) => ({
      ...company,
      aliases: aliasMap.get(company.id) || [],
    }));

    const companyById = new Map(companiesWithAliases.map((company) => [company.id, company as CompanyRef]));
    const updates: Array<Promise<unknown>> = [];
    const affectedCompanyIds = new Set<string>();
    const companiesWithTechnologies = new Set<string>();
    const errors: string[] = [];
    let teknologierArrayFikset = 0;

    for (const row of annonser) {
      const normalizedTags = mergeTechnologyTags(row.teknologier_array || [], row.teknologier || null);
      const existingCompany = row.matched_company_id ? companyById.get(row.matched_company_id) || null : null;
      const matchedCompany = existingCompany || findBestCompanyMatch(row.selskap, companiesWithAliases);

      if (normalizedTags.length > 0 && matchedCompany?.id) {
        companiesWithTechnologies.add(matchedCompany.id);
      }
      if (matchedCompany?.id) {
        affectedCompanyIds.add(matchedCompany.id);
      }

      const hasTechnologyChange =
        JSON.stringify(row.teknologier_array || []) !== JSON.stringify(normalizedTags);
      const hasCompanyChange = row.matched_company_id !== (matchedCompany?.id || null);

      if (!hasTechnologyChange && !hasCompanyChange) continue;

      if (hasTechnologyChange) teknologierArrayFikset += 1;

      updates.push(
        supabase
          .from("finn_annonser")
          .update({
            teknologier_array: normalizedTags,
            matched_company_id: matchedCompany?.id || null,
          })
          .eq("id", row.id)
          .then(({ error }) => {
            if (error) {
              errors.push(`${row.id}: ${error.message}`);
            }
          }),
      );
    }

    await Promise.all(updates);

    let dnaProfilerOppdatert = 0;
    let kontakterOppdatert = 0;

    for (const companyId of affectedCompanyIds) {
      const { data, error } = await supabase.rpc("rebuild_technical_dna", {
        target_company_id: companyId,
        target_contact_id: null,
      });

      if (error) {
        errors.push(`${companyId}: ${error.message}`);
        continue;
      }

      dnaProfilerOppdatert += Number((data as { company_profiles_updated?: number } | null)?.company_profiles_updated || 0);
      kontakterOppdatert += Number((data as { contacts_updated?: number } | null)?.contacts_updated || 0);
    }

    return jsonResponse({
      uke: weeks.length === 1 ? weeks[0] : null,
      annonser_behandlet: annonser.length,
      teknologier_array_fikset: teknologierArrayFikset,
      selskaper_med_teknologier: companiesWithTechnologies.size,
      dna_profiler_oppdatert: dnaProfilerOppdatert,
      kontakter_oppdatert: kontakterOppdatert,
      errors,
    });
  } catch (error) {
    console.error("process-finn-import error:", error);
    if (error instanceof Error && error.name === "Forbidden") {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    return jsonResponse({ error: error instanceof Error ? error.message : "Ukjent feil" }, 500);
  }
});
