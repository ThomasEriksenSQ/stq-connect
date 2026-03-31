import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth guard: require valid JWT + admin role ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Check admin role
    const { data: isAdmin } = await anonClient.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client for data operations (bypasses RLS intentionally for import)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { type, records } = await req.json();

    // --- Helpers ---
    async function clearTable(table: string) {
      let deleted = 0;
      while (true) {
        const { data, error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000").select("id").limit(500);
        if (error) { console.error(`Delete ${table} err:`, JSON.stringify(error)); break; }
        if (!data || data.length === 0) break;
        deleted += data.length;
      }
      return deleted;
    }

    async function fetchAll(table: string, columns: string) {
      const all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase.from(table).select(columns).range(from, from + pageSize - 1);
        if (error) { console.error(`Fetch ${table} err:`, JSON.stringify(error)); break; }
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    }

    async function batchInsert(table: string, rows: any[], batchSize = 50) {
      let inserted = 0;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase.from(table).insert(batch);
        if (error) console.error(`${table} insert err at ${i}:`, JSON.stringify(error));
        else inserted += batch.length;
      }
      return inserted;
    }

    function hasEmail(value: unknown) {
      return typeof value === "string" && value.trim().length > 0;
    }

    // --- Build lookup maps for activities/tasks resolution ---
    async function buildLookups() {
      const companies = await fetchAll("companies", "id, sf_account_id");
      const contacts = await fetchAll("contacts", "id, sf_contact_id, company_id");

      // sf_account_id → company uuid
      const companyBySfId: Record<string, string> = {};
      for (const c of companies) {
        if (c.sf_account_id) companyBySfId[c.sf_account_id] = c.id;
      }

      // sf_contact_id → { contact uuid, company uuid }
      const contactBySfId: Record<string, { id: string; company_id: string | null }> = {};
      for (const c of contacts) {
        if (c.sf_contact_id) contactBySfId[c.sf_contact_id] = { id: c.id, company_id: c.company_id };
      }

      console.log(`Lookups: ${Object.keys(companyBySfId).length} companies, ${Object.keys(contactBySfId).length} contacts`);
      return { companyBySfId, contactBySfId };
    }

    // 3-step company resolution: sf_what_id → sf_account_id → contact's company
    function resolveCompanyAndContact(
      r: any,
      companyBySfId: Record<string, string>,
      contactBySfId: Record<string, { id: string; company_id: string | null }>
    ) {
      let companyId: string | null = null;
      let contactId: string | null = null;

      // Step 1: WhatId → company
      if (r.sf_what_id) {
        companyId = companyBySfId[r.sf_what_id] || null;
      }
      // Step 2: AccountId → company (fallback)
      if (!companyId && r.sf_account_id) {
        companyId = companyBySfId[r.sf_account_id] || null;
      }
      // Resolve contact from WhoId
      if (r.sf_who_id && contactBySfId[r.sf_who_id]) {
        const contact = contactBySfId[r.sf_who_id];
        contactId = contact.id;
        // Step 3: Contact's company (fallback)
        if (!companyId && contact.company_id) {
          companyId = contact.company_id;
        }
      }

      return { company_id: companyId, contact_id: contactId };
    }

    // --- Handlers ---

    if (type === "clear") {
      const a = await clearTable("activities");
      const t = await clearTable("tasks");
      const c = await clearTable("contacts");
      const co = await clearTable("companies");
      console.log(`Cleared: ${a} activities, ${t} tasks, ${c} contacts, ${co} companies`);
      return new Response(JSON.stringify({ ok: true, deleted: { activities: a, tasks: t, contacts: c, companies: co } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (type === "companies") {
      const inserted = await batchInsert("companies", records);
      return new Response(JSON.stringify({ type: "companies", inserted, total: records.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (type === "contacts") {
      // Resolve company_id from sf_account_id
      const companies = await fetchAll("companies", "id, sf_account_id");
      const sfAccMap: Record<string, string> = {};
      for (const c of companies) {
        if (c.sf_account_id) sfAccMap[c.sf_account_id] = c.id;
      }

      const toInsert = records.map((r: any) => {
        const { sf_account_id, ...rest } = r;
        return {
          ...rest,
          cv_email: Boolean(rest.cv_email) && hasEmail(rest.email),
          company_id: sf_account_id ? sfAccMap[sf_account_id] || null : null,
        };
      });

      const inserted = await batchInsert("contacts", toInsert);
      return new Response(JSON.stringify({ type: "contacts", inserted, total: toInsert.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (type === "activities") {
      const { companyBySfId, contactBySfId } = await buildLookups();

      const toInsert = records.map((r: any) => {
        const { sf_who_id, sf_what_id, sf_account_id, ...rest } = r;
        const resolved = resolveCompanyAndContact({ sf_who_id, sf_what_id, sf_account_id }, companyBySfId, contactBySfId);
        return { ...rest, ...resolved };
      });

      const inserted = await batchInsert("activities", toInsert);
      return new Response(JSON.stringify({ type: "activities", inserted, total: toInsert.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (type === "tasks") {
      const { companyBySfId, contactBySfId } = await buildLookups();

      const toInsert = records.map((r: any) => {
        const { sf_who_id, sf_what_id, sf_account_id, subject, ...rest } = r;
        const resolved = resolveCompanyAndContact({ sf_who_id, sf_what_id, sf_account_id }, companyBySfId, contactBySfId);
        return { ...rest, ...resolved };
      });

      const inserted = await batchInsert("tasks", toInsert);
      return new Response(JSON.stringify({ type: "tasks", inserted, total: toInsert.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid type" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: unknown) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
