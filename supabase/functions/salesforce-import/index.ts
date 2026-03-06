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
      if (name.includes("Jon Richard")) return JR_ID;
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
      // DD.MM.YYYY → YYYY-MM-DD
      const parts = d.trim().split(".");
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      }
      return null;
    }

    function cleanText(t: string): string {
      if (!t) return "";
      return t.replace(/\\/g, "").trim();
    }

    function cleanUrl(u: string): string | null {
      if (!u || !u.trim()) return null;
      let url = u.replace(/<|>/g, "").replace(/\[.*?\]\((.*?)\)/g, "$1").trim();
      if (url && !url.startsWith("http")) {
        url = "https://" + url;
      }
      return url || null;
    }

    if (type === "companies") {
      // Parse: Last Activity||Account Owner|Account Name|Type|Last Modified Date|Account ID|Organization number|Website|Industry|Created Date|Account Owner Alias|Description
      const newMap: Record<string, string> = {};
      const companies: any[] = [];
      const seenAccountIds = new Set<string>();

      for (const row of rows) {
        const cols = row.split("|");
        // Find columns - header row has indexes shifted by pipe count
        // cols[0]=Last Activity, cols[1]='', cols[2]=Account Owner, cols[3]=Account Name, cols[4]=Type, cols[5]=Last Modified Date, cols[6]=Account ID, cols[7]=Org number, cols[8]=Website, cols[9]=Industry, cols[10]=Created Date, cols[11]=Alias, cols[12]=Description
        const sfAccountId = cleanText(cols[6] || "");
        if (!sfAccountId || sfAccountId.length < 5) continue;
        if (seenAccountIds.has(sfAccountId)) continue;
        seenAccountIds.add(sfAccountId);

        const owner = cleanText(cols[2] || "");
        const name = cleanText(cols[3] || "");
        if (!name) continue;

        const ownerId = getOwnerId(owner);
        const id = crypto.randomUUID();
        newMap[sfAccountId] = id;

        const createdDate = parseDate(cleanText(cols[10] || ""));

        companies.push({
          id,
          name,
          status: mapStatus(cleanText(cols[4] || "")),
          org_number: cleanText(cols[7] || "") || null,
          website: cleanUrl(cols[8] || ""),
          industry: cleanText(cols[9] || "") || null,
          notes: cleanText(cols[12] || "") || null,
          created_by: ownerId,
          owner_id: ownerId,
          created_at: createdDate ? createdDate + "T00:00:00Z" : new Date().toISOString(),
        });
      }

      // Insert in batches of 50
      let inserted = 0;
      for (let i = 0; i < companies.length; i += 50) {
        const batch = companies.slice(i, i + 50);
        const { error } = await supabase.from("companies").insert(batch);
        if (error) {
          console.error("Company insert error:", error, "batch starting at:", i);
        } else {
          inserted += batch.length;
        }
      }

      return new Response(JSON.stringify({ 
        type: "companies", 
        inserted, 
        total: companies.length,
        account_map: newMap 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (type === "contacts") {
      // Parse: Account Owner||Legg til ringeliste|Motta CV|Contact ID|First Name|Last Name|Email|Phone|Title|Org number|Website|Industry|Account ID|Linkedin|Contact Owner|Type|Description
      const newContactMap: Record<string, string> = {};
      const contacts: any[] = [];
      const seenContactIds = new Set<string>();

      for (const row of rows) {
        const cols = row.split("|");
        const sfContactId = cleanText(cols[4] || "");
        if (!sfContactId || sfContactId.length < 5) continue;
        if (seenContactIds.has(sfContactId)) continue;
        seenContactIds.add(sfContactId);

        const firstName = cleanText(cols[5] || "");
        const lastName = cleanText(cols[6] || "");
        if (!firstName && !lastName) continue;

        const contactOwner = cleanText(cols[15] || "");
        const ownerId = getOwnerId(contactOwner);
        const sfAccountId = cleanText(cols[13] || "");
        const companyId = account_map?.[sfAccountId] || null;

        const callList = cleanText(cols[2] || "").toUpperCase() === "TRUE";
        const cvEmail = cleanText(cols[3] || "").toUpperCase() === "TRUE";

        const id = crypto.randomUUID();
        newContactMap[sfContactId] = id;

        const email = cleanText(cols[7] || "").replace(/\\/g, "") || null;
        const phone = cleanText(cols[8] || "") || null;
        const title = cleanText(cols[9] || "") || null;
        let linkedin = cleanUrl(cols[14] || "");
        const notes = cleanText(cols[17] || "") || null;

        contacts.push({
          id,
          first_name: firstName || "[ukjent]",
          last_name: lastName || "[ukjent]",
          email,
          phone,
          title,
          company_id: companyId,
          linkedin,
          notes,
          call_list: callList,
          cv_email: cvEmail,
          created_by: ownerId,
          owner_id: ownerId,
        });
      }

      let inserted = 0;
      for (let i = 0; i < contacts.length; i += 50) {
        const batch = contacts.slice(i, i + 50);
        const { error } = await supabase.from("contacts").insert(batch);
        if (error) {
          console.error("Contact insert error:", error, "batch starting at:", i);
        } else {
          inserted += batch.length;
        }
      }

      return new Response(JSON.stringify({ 
        type: "contacts", 
        inserted, 
        total: contacts.length,
        contact_map: newContactMap 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (type === "tasks") {
      // Parse: Subject||First Name|Last Name|Activity ID|Full Comments|Comments|Status|Priority|Date|Created Date|Contact ID|Contact Owner|Account ID|Account Name|Assigned
      const tasks: any[] = [];
      const seenActivityIds = new Set<string>();

      for (const row of rows) {
        const cols = row.split("|");
        const sfActivityId = cleanText(cols[4] || "");
        if (!sfActivityId || sfActivityId.length < 5) continue;
        if (seenActivityIds.has(sfActivityId)) continue;
        seenActivityIds.add(sfActivityId);

        const subject = cleanText(cols[0] || "");
        if (!subject) continue;

        const fullComments = cleanText(cols[5] || "");
        const comments = cleanText(cols[6] || "");
        const description = fullComments || comments || null;
        const sfStatus = cleanText(cols[7] || "");
        const status = sfStatus.includes("Ferdig") ? "completed" : "open";
        const dueDate = parseDate(cleanText(cols[9] || ""));
        const createdDate = parseDate(cleanText(cols[10] || ""));
        const sfContactId = cleanText(cols[11] || "");
        const sfAccountId = cleanText(cols[13] || "");
        const assigned = cleanText(cols[15] || "");
        const assignedTo = getOwnerId(assigned);
        const contactOwner = cleanText(cols[12] || "");
        const createdBy = getOwnerId(contactOwner);

        const contactId = contact_map?.[sfContactId] || null;
        const companyId = account_map?.[sfAccountId] || null;

        tasks.push({
          title: subject,
          description,
          status,
          priority: "medium",
          due_date: dueDate,
          created_at: createdDate ? createdDate + "T00:00:00Z" : new Date().toISOString(),
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
        if (error) {
          console.error("Task insert error:", error, "batch starting at:", i);
        } else {
          inserted += batch.length;
        }
      }

      return new Response(JSON.stringify({ 
        type: "tasks", 
        inserted, 
        total: tasks.length 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid type" }), { 
      status: 400, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
