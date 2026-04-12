import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find tasks due today or overdue with email_notify = true
    const today = new Date().toISOString().split("T")[0];
    const { data: tasks, error: tasksError } = await adminClient
      .from("tasks")
      .select("id, title, due_date, assigned_to, contact_id, company_id, contacts(first_name, last_name, companies(name))")
      .eq("email_notify", true)
      .lte("due_date", today)
      .neq("status", "done");

    if (tasksError) throw tasksError;
    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    const errors: string[] = [];

    for (const task of tasks) {
      try {
        if (!task.assigned_to) continue;

        // Get user email via admin API
        const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(task.assigned_to);
        if (userError || !userData?.user?.email) {
          errors.push(`No email for user ${task.assigned_to}`);
          continue;
        }

        const contact = task.contacts as any;
        const contactName = contact ? `${contact.first_name} ${contact.last_name}` : "Ukjent kontakt";
        const companyName = contact?.companies?.name || "";
        const contactLine = companyName ? `${contactName} · ${companyName}` : contactName;
        const appUrl = Deno.env.get("APP_URL") || "https://stq-connect.lovable.app";
        const contactUrl = task.contact_id ? `${appUrl}/kontakter/${task.contact_id}` : appUrl;

        const isOverdue = task.due_date < today;
        const dueLine = isOverdue ? `⚠️ Forfalt (${task.due_date})` : `Forfaller i dag`;

        const datoNorsk = new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
        const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',Helvetica,Arial,sans-serif">
<div style="padding:40px 20px">
<div style="max-width:720px;margin:0 auto">
<div style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06)">

  <!-- Header -->
  <div style="padding:24px 40px;border-bottom:2px solid #2563eb">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td>
          <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#0f172a">STACQ</span>
          <span style="font-size:11px;font-weight:600;color:#2563eb;margin-left:8px;letter-spacing:0.1em;text-transform:uppercase">CRM</span>
        </td>
        <td style="text-align:right">
          <span style="font-size:12px;color:#94a3b8;letter-spacing:0.02em">${datoNorsk}</span>
        </td>
      </tr>
    </table>
  </div>

  <!-- Title -->
  <div style="padding:28px 40px 20px">
    <p style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#2563eb;margin:0 0 8px">Oppfølging</p>
    <h1 style="font-size:24px;font-weight:700;color:#0f172a;margin:0 0 4px;letter-spacing:-0.3px">${task.title}</h1>
    <p style="font-size:14px;color:#64748b;margin:8px 0 0">${contactLine}</p>
  </div>

  <!-- Status -->
  <div style="padding:0 40px 24px">
    <div style="background:${isOverdue ? '#fef2f2' : '#eff6ff'};border-radius:8px;padding:20px 24px;border-left:3px solid ${isOverdue ? '#dc2626' : '#2563eb'}">
      <p style="font-size:14px;color:${isOverdue ? '#dc2626' : '#1e293b'};margin:0;font-weight:600">${dueLine}</p>
    </div>
  </div>

  <!-- CTA -->
  <div style="padding:16px 40px 32px">
    <a href="${contactUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:13px;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none;letter-spacing:0.02em">Åpne i CRM →</a>
  </div>

  <!-- Footer -->
  <div style="padding:20px 40px;border-top:1px solid #e2e8f0">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td><span style="font-size:12px;color:#94a3b8">STACQ CRM · Oppfølgingspåminnelse</span></td>
        <td style="text-align:right"><span style="font-size:12px;color:#94a3b8">crm.stacq.no</span></td>
      </tr>
    </table>
  </div>

</div>
</div>
</div>
</body>
</html>`;

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "STACQ CRM <crm@stacq.no>",
            to: [userData.user.email],
            subject: `Oppfølging: ${task.title} — ${contactLine}`,
            html,
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          errors.push(`Resend error for task ${task.id}: ${body}`);
          continue;
        }

        // Mark as notified by setting email_notify = false
        await adminClient
          .from("tasks")
          .update({ email_notify: false })
          .eq("id", task.id);

        sent++;
      } catch (e) {
        errors.push(`Error processing task ${task.id}: ${(e as Error).message}`);
      }
    }

    return new Response(
      JSON.stringify({ sent, total: tasks.length, errors: errors.length > 0 ? errors : undefined }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
