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

    if (type === "clear") {
      // Delete in FK order
      await supabase.from("activities").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("tasks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("contacts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("companies").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      console.log("Cleared all data");
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

    if (type === "contacts") {
      // Build company name -> id map
      const { data: companies } = await supabase.from("companies").select("id, name");
      const companyMap: Record<string, string> = {};
      for (const c of companies || []) {
        companyMap[c.name.toLowerCase()] = c.id;
      }

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
      // Build lookup maps
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
