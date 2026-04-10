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

        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="font-size: 18px; color: #1a1a1a; margin-bottom: 4px;">Oppfølging: ${task.title}</h2>
            <p style="font-size: 14px; color: #666; margin: 4px 0 16px;">${contactLine}</p>
            <p style="font-size: 14px; color: ${isOverdue ? '#dc2626' : '#1a1a1a'};">${dueLine}</p>
            <a href="${contactUrl}" style="display: inline-block; margin-top: 16px; padding: 10px 20px; background: #1a1a1a; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px;">Åpne i CRM →</a>
            <p style="font-size: 12px; color: #999; margin-top: 24px;">STACQ CRM</p>
          </div>
        `;

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
