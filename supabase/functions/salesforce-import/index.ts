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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { type, records } = await req.json();

    // Helper to delete all rows from a table (handles >1000 row limit)
    async function clearTable(table: string) {
      let deleted = 0;
      while (true) {
        const { data, error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000").select("id").limit(500);
        if (error) { console.error(`Delete ${table} err:`, JSON.stringify(error)); break; }
        if (!data || data.length === 0) break;
        deleted += data.length;
        console.log(`Deleted ${deleted} from ${table}...`);
      }
      return deleted;
    }

    if (type === "clear") {
      const a = await clearTable("activities");
      const t = await clearTable("tasks");
      const c = await clearTable("contacts");
      const co = await clearTable("companies");
      console.log(`Cleared: ${a} activities, ${t} tasks, ${c} contacts, ${co} companies`);
      return new Response(JSON.stringify({ ok: true, deleted: { activities: a, tasks: t, contacts: c, companies: co } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (type === "companies") {
      let inserted = 0;
      for (let i = 0; i < records.length; i += 50) {
        const batch = records.slice(i, i + 50);
        const { error } = await supabase.from("companies").insert(batch);
        if (error) console.error("Company err:", JSON.stringify(error), "at:", i);
        else inserted += batch.length;
      }
      return new Response(JSON.stringify({ type: "companies", inserted, total: records.length }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Helper to fetch all rows from a table (handles >1000 row limit)
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

    if (type === "contacts") {
      const companies = await fetchAll("companies", "id, name");
      const companyMap: Record<string, string> = {};
      for (const c of companies) {
        companyMap[c.name.toLowerCase()] = c.id;
      }
      console.log(`Company map has ${Object.keys(companyMap).length} entries`);

      const toInsert = records.map((r: any) => {
        const { account_name, ...rest } = r;
        return {
          ...rest,
          company_id: account_name ? companyMap[account_name.toLowerCase()] || null : null,
        };
      });

      let inserted = 0;
      for (let i = 0; i < toInsert.length; i += 50) {
        const batch = toInsert.slice(i, i + 50);
        const { error } = await supabase.from("contacts").insert(batch);
        if (error) console.error("Contact err:", JSON.stringify(error), "at:", i);
        else inserted += batch.length;
      }
      return new Response(JSON.stringify({ type: "contacts", inserted, total: toInsert.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (type === "activities") {
      const contacts = await fetchAll("contacts", "id, first_name, last_name");
      const contactMap: Record<string, string> = {};
      for (const c of contacts) {
        contactMap[`${c.first_name}|${c.last_name}`.toLowerCase()] = c.id;
      }
      const companies = await fetchAll("companies", "id, name");
      const companyMap: Record<string, string> = {};
      for (const c of companies) {
        companyMap[c.name.toLowerCase()] = c.id;
      }
      console.log(`Lookup maps: ${Object.keys(contactMap).length} contacts, ${Object.keys(companyMap).length} companies`);

      const toInsert = records.map((r: any) => {
        const { contact_name, account_name, ...rest } = r;
        return {
          ...rest,
          contact_id: contact_name ? contactMap[contact_name.toLowerCase()] || null : null,
          company_id: account_name ? companyMap[account_name.toLowerCase()] || null : null,
        };
      });

      let inserted = 0;
      for (let i = 0; i < toInsert.length; i += 50) {
        const batch = toInsert.slice(i, i + 50);
        const { error } = await supabase.from("activities").insert(batch);
        if (error) console.error("Activity err:", JSON.stringify(error), "at:", i);
        else inserted += batch.length;
      }
      return new Response(JSON.stringify({ type: "activities", inserted, total: toInsert.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (type === "tasks") {
      const { data: contacts } = await supabase.from("contacts").select("id, first_name, last_name");
      const contactMap: Record<string, string> = {};
      for (const c of contacts || []) {
        contactMap[`${c.first_name}|${c.last_name}`.toLowerCase()] = c.id;
      }
      const { data: companies } = await supabase.from("companies").select("id, name");
      const companyMap: Record<string, string> = {};
      for (const c of companies || []) {
        companyMap[c.name.toLowerCase()] = c.id;
      }

      const toInsert = records.map((r: any) => {
        const { contact_name, account_name, ...rest } = r;
        return {
          ...rest,
          contact_id: contact_name ? contactMap[contact_name.toLowerCase()] || null : null,
          company_id: account_name ? companyMap[account_name.toLowerCase()] || null : null,
        };
      });

      let inserted = 0;
      for (let i = 0; i < toInsert.length; i += 50) {
        const batch = toInsert.slice(i, i + 50);
        const { error } = await supabase.from("tasks").insert(batch);
        if (error) console.error("Task err:", JSON.stringify(error), "at:", i);
        else inserted += batch.length;
      }
      return new Response(JSON.stringify({ type: "tasks", inserted, total: toInsert.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid type" }), 
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
