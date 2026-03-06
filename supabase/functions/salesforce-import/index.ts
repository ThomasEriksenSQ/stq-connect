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

    if (type === "clear") {
      const a = await clearTable("activities");
      const t = await clearTable("tasks");
      const c = await clearTable("contacts");
      const co = await clearTable("companies");
      console.log(`Cleared: ${a} activities, ${t} tasks, ${c} contacts, ${co} companies`);
      return new Response(JSON.stringify({ ok: true, deleted: { activities: a, tasks: t, contacts: c, companies: co } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
      // Resolve company_id via sf_account_id
      const companies = await fetchAll("companies", "id, sf_account_id");
      const sfAccMap: Record<string, string> = {};
      for (const c of companies) {
        if (c.sf_account_id) sfAccMap[c.sf_account_id] = c.id;
      }
      console.log(`SF Account map has ${Object.keys(sfAccMap).length} entries`);

      const toInsert = records.map((r: any) => {
        const { sf_account_id, ...rest } = r;
        return {
          ...rest,
          sf_contact_id: r.sf_contact_id,
          company_id: sf_account_id ? sfAccMap[sf_account_id] || null : null,
        };
      });

      let inserted = 0;
      for (let i = 0; i < toInsert.length; i += 50) {
        const batch = toInsert.slice(i, i + 50);
        const { error } = await supabase.from("contacts").insert(batch);
        if (error) console.error("Contact err:", JSON.stringify(error), "at:", i, JSON.stringify(batch[0]));
        else inserted += batch.length;
      }
      return new Response(JSON.stringify({ type: "contacts", inserted, total: toInsert.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (type === "activities") {
      // Resolve company_id via sf_account_id, contact_id via name match scoped to company
      const companies = await fetchAll("companies", "id, sf_account_id");
      const sfAccMap: Record<string, string> = {};
      for (const c of companies) {
        if (c.sf_account_id) sfAccMap[c.sf_account_id] = c.id;
      }
      const contacts = await fetchAll("contacts", "id, first_name, last_name, company_id");
      // Build contact lookup: "first|last|company_id" -> contact.id
      const contactMap: Record<string, string> = {};
      const contactByName: Record<string, string> = {};
      for (const c of contacts) {
        const key = `${c.first_name}|${c.last_name}`.toLowerCase();
        contactByName[key] = c.id;
        if (c.company_id) {
          contactMap[`${key}|${c.company_id}`] = c.id;
        }
      }
      console.log(`Lookup maps: ${Object.keys(sfAccMap).length} companies, ${Object.keys(contactMap).length} scoped contacts, ${Object.keys(contactByName).length} name contacts`);

      const toInsert = records.map((r: any) => {
        const { sf_account_id, contact_first, contact_last, ...rest } = r;
        const companyId = sf_account_id ? sfAccMap[sf_account_id] || null : null;
        
        // Try company-scoped contact match first, then name-only
        let contactId = null;
        if (contact_first || contact_last) {
          const nameKey = `${contact_first || ""}|${contact_last || ""}`.toLowerCase();
          if (companyId) {
            contactId = contactMap[`${nameKey}|${companyId}`] || null;
          }
          if (!contactId) {
            contactId = contactByName[nameKey] || null;
          }
        }

        return {
          ...rest,
          company_id: companyId,
          contact_id: contactId,
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
      const companies = await fetchAll("companies", "id, sf_account_id");
      const sfAccMap: Record<string, string> = {};
      for (const c of companies) {
        if (c.sf_account_id) sfAccMap[c.sf_account_id] = c.id;
      }
      const contacts = await fetchAll("contacts", "id, first_name, last_name, company_id");
      const contactMap: Record<string, string> = {};
      const contactByName: Record<string, string> = {};
      for (const c of contacts) {
        const key = `${c.first_name}|${c.last_name}`.toLowerCase();
        contactByName[key] = c.id;
        if (c.company_id) {
          contactMap[`${key}|${c.company_id}`] = c.id;
        }
      }
      console.log(`Task lookup maps: ${Object.keys(sfAccMap).length} companies, ${Object.keys(contactMap).length} scoped contacts`);

      const toInsert = records.map((r: any) => {
        const { sf_account_id, contact_first, contact_last, ...rest } = r;
        const companyId = sf_account_id ? sfAccMap[sf_account_id] || null : null;
        
        let contactId = null;
        if (contact_first || contact_last) {
          const nameKey = `${contact_first || ""}|${contact_last || ""}`.toLowerCase();
          if (companyId) {
            contactId = contactMap[`${nameKey}|${companyId}`] || null;
          }
          if (!contactId) {
            contactId = contactByName[nameKey] || null;
          }
        }

        return {
          ...rest,
          company_id: companyId,
          contact_id: contactId,
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
