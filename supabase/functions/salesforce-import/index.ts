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

    const { type, rows, account_map, contact_map } = await req.json();

    const THOMAS_ID = "877c63e8-a70c-4b78-9258-3dc8b1bf3c20";
    const JR_ID = "451cb75f-685d-433d-83f0-bb24941ff2a4";

    function getOwnerId(name: string): string {
      if (!name) return THOMAS_ID;
      if (name.includes("Jon Richard") || name === "JR") return JR_ID;
      return THOMAS_ID;
    }

    function mapStatus(sfType: string): string {
      if (!sfType) return "active";
      const t = sfType.toLowerCase();
      if (t.includes("direktekunde")) return "kunde";
      if (t.includes("dps")) return "potensiell_kunde";
      if (t.includes("partner")) return "partner";
      if (t.includes("konsulentmegler")) return "konsulentmegler";
      return "active";
    }

    function parseDate(d: string): string | null {
      if (!d || !d.trim()) return null;
      const parts = d.trim().split(".");
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      }
      return null;
    }

    function clean(t: string): string {
      if (!t) return "";
      return t.replace(/\\/g, "").trim();
    }

    function cleanUrl(u: string): string | null {
      if (!u || !u.trim()) return null;
      let url = u.replace(/<|>/g, "").replace(/\[.*?\]\((.*?)\)/g, "$1").trim();
      if (url && !url.startsWith("http")) url = "https://" + url;
      return url || null;
    }

    // Strip leading/trailing pipe from each row
    function parseCols(row: string): string[] {
      let r = row;
      if (r.startsWith("|")) r = r.substring(1);
      if (r.endsWith("|")) r = r.substring(0, r.length - 1);
      return r.split("|");
    }

    if (type === "companies") {
      // Cols: Last Activity | (empty) | Account Owner | Account Name | Type | Last Modified Date | Account ID | Organization number | Website | Industry | Created Date | Account Owner Alias | Description
      // Indices: 0             1        2               3              4      5                    6             7                     8         9          10             11                    12
      const newMap: Record<string, string> = {};
      const companies: any[] = [];
      const seen = new Set<string>();

      for (const row of rows) {
        const c = parseCols(row);
        const sfId = clean(c[6] || "");
        if (!sfId || sfId.length < 5) continue;
        if (seen.has(sfId)) continue;
        seen.add(sfId);

        const name = clean(c[3] || "");
        if (!name) continue;

        const ownerId = getOwnerId(clean(c[2] || ""));
        const id = crypto.randomUUID();
        newMap[sfId] = id;

        companies.push({
          id, name,
          status: mapStatus(clean(c[4] || "")),
          org_number: clean(c[7] || "") || null,
          website: cleanUrl(c[8] || ""),
          industry: clean(c[9] || "") || null,
          notes: clean(c[12] || "") || null,
          created_by: ownerId,
          owner_id: ownerId,
          created_at: (parseDate(clean(c[10] || "")) || "2024-01-01") + "T00:00:00Z",
        });
      }

      let inserted = 0;
      for (let i = 0; i < companies.length; i += 50) {
        const batch = companies.slice(i, i + 50);
        const { error } = await supabase.from("companies").insert(batch);
        if (error) console.error("Company err:", JSON.stringify(error), "at:", i);
        else inserted += batch.length;
      }

      return new Response(JSON.stringify({ type: "companies", inserted, total: companies.length, account_map: newMap }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (type === "contacts") {
      // Cols: Account Owner | (empty) | call_list | cv_email | Contact ID | First Name | Last Name | Email | Phone | Title | Org number | Website | Industry | Account ID | Linkedin | Contact Owner | Type | Description
      // Indices: 0             1        2           3          4            5            6           7       8       9       10           11        12         13           14         15              16     17
      const newMap: Record<string, string> = {};
      const contacts: any[] = [];
      const seen = new Set<string>();

      for (const row of rows) {
        const c = parseCols(row);
        const sfId = clean(c[4] || "");
        if (!sfId || sfId.length < 5) continue;
        if (seen.has(sfId)) continue;
        seen.add(sfId);

        const firstName = clean(c[5] || "");
        const lastName = clean(c[6] || "");
        if (!firstName && !lastName) continue;

        const ownerId = getOwnerId(clean(c[15] || ""));
        const companyId = account_map?.[clean(c[13] || "")] || null;
        const id = crypto.randomUUID();
        newMap[sfId] = id;

        contacts.push({
          id,
          first_name: firstName || "[ukjent]",
          last_name: lastName || "[ukjent]",
          email: clean(c[7] || "") || null,
          phone: clean(c[8] || "") || null,
          title: clean(c[9] || "") || null,
          company_id: companyId,
          linkedin: cleanUrl(c[14] || ""),
          notes: clean(c[17] || "") || null,
          call_list: clean(c[2] || "").toUpperCase() === "TRUE",
          cv_email: clean(c[3] || "").toUpperCase() === "TRUE",
          created_by: ownerId,
          owner_id: ownerId,
        });
      }

      let inserted = 0;
      for (let i = 0; i < contacts.length; i += 50) {
        const batch = contacts.slice(i, i + 50);
        const { error } = await supabase.from("contacts").insert(batch);
        if (error) console.error("Contact err:", JSON.stringify(error), "at:", i);
        else inserted += batch.length;
      }

      return new Response(JSON.stringify({ type: "contacts", inserted, total: contacts.length, contact_map: newMap }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (type === "tasks") {
      // Cols: Subject | (empty) | First Name | Last Name | Activity ID | Full Comments | Comments | Status | Priority | Date | Created Date | Contact ID | Contact Owner | Account ID | Account Name | Assigned
      // Indices: 0      1        2            3           4             5               6          7        8          9      10             11           12              13           14             15
      const tasks: any[] = [];
      const seen = new Set<string>();

      for (const row of rows) {
        const c = parseCols(row);
        const sfId = clean(c[4] || "");
        if (!sfId || sfId.length < 5) continue;
        if (seen.has(sfId)) continue;
        seen.add(sfId);

        const subject = clean(c[0] || "");
        if (!subject) continue;

        const desc = clean(c[5] || "") || clean(c[6] || "") || null;
        const status = clean(c[7] || "").includes("Ferdig") ? "completed" : "open";
        const dueDate = parseDate(clean(c[9] || ""));
        const createdDate = parseDate(clean(c[10] || ""));
        const assignedTo = getOwnerId(clean(c[15] || ""));
        const createdBy = getOwnerId(clean(c[12] || ""));
        const contactId = contact_map?.[clean(c[11] || "")] || null;
        const companyId = account_map?.[clean(c[13] || "")] || null;

        tasks.push({
          title: subject,
          description: desc,
          status,
          priority: "medium",
          due_date: dueDate,
          created_at: (createdDate || "2024-01-01") + "T00:00:00Z",
          completed_at: status === "completed" && dueDate ? dueDate + "T00:00:00Z" : null,
          contact_id: contactId,
          company_id: companyId,
          assigned_to: assignedTo,
          created_by: createdBy,
        });
      }

      let inserted = 0;
      for (let i = 0; i < tasks.length; i += 50) {
        const batch = tasks.slice(i, i + 50);
        const { error } = await supabase.from("tasks").insert(batch);
        if (error) console.error("Task err:", JSON.stringify(error), "at:", i);
        else inserted += batch.length;
      }

      return new Response(JSON.stringify({ type: "tasks", inserted, total: tasks.length }),
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
