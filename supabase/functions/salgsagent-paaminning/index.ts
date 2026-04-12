import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@^3.0.0";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: claimsData.claims.sub,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { test } = await req.json();

    // Get settings
    const { data: settings } = await adminClient
      .from("varslingsinnstillinger")
      .select("*")
      .single();

    if (!settings) {
      return new Response(JSON.stringify({ error: "No settings found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipients: string[] = settings.epost_mottakere ?? ["thomas@stacq.no"];

    if (!test) {
      // Check if any user has used salgsagent in the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentUsage } = await adminClient
        .from("salgsagent_bruk")
        .select("brukt_at")
        .gte("brukt_at", sevenDaysAgo.toISOString())
        .limit(1);

      if (recentUsage && recentUsage.length > 0) {
        return new Response(
          JSON.stringify({ message: "Salgsagent used recently, no reminder needed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Send email via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resend = new Resend(resendKey);

    const subject = test
      ? "[TEST] Salgsagent-påminnelse"
      : "Påminnelse: Salgsagenten har ikke blitt brukt på 7 dager";

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
    <p style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#2563eb;margin:0 0 8px">Påminnelse</p>
    <h1 style="font-size:24px;font-weight:700;color:#0f172a;margin:0;letter-spacing:-0.3px">Salgsagent-påminnelse</h1>
  </div>

  <!-- Content -->
  <div style="padding:0 40px 24px">
    <div style="background:#eff6ff;border-radius:8px;padding:20px 24px;border-left:3px solid #2563eb">
      <p style="font-size:14px;color:#1e293b;margin:0;line-height:1.65">
        ${test ? "<strong>[TEST]</strong> " : ""}Salgsagenten har ikke blitt brukt de siste 7 dagene. Husk å bruke den regelmessig for å holde oversikt over salgsaktiviteter.
      </p>
    </div>
  </div>

  <!-- CTA -->
  <div style="padding:16px 40px 32px">
    <a href="https://crm.stacq.no/" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:13px;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none;letter-spacing:0.02em"><a href="https://crm.stacq.no/" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:13px;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none;letter-spacing:0.02em">Åpne Salgsagent →</a></a>
  </div>

  <!-- Footer -->
  <div style="padding:20px 40px;border-top:1px solid #e2e8f0">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td><span style="font-size:12px;color:#94a3b8">STACQ CRM · Automatisk påminnelse</span></td>
        <td style="text-align:right"><span style="font-size:12px;color:#94a3b8">crm.stacq.no</span></td>
      </tr>
    </table>
  </div>

</div>
</div>
</div>
</body>
</html>`;

    for (const email of recipients) {
      await resend.emails.send({
        from: "STACQ <noreply@stacq.no>",
        to: email,
        subject,
        html,
      });
    }

    // Update last sent timestamp
    if (!test) {
      await adminClient
        .from("varslingsinnstillinger")
        .update({
          salgsagent_sist_sendt: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", settings.id);
    }

    return new Response(
      JSON.stringify({ message: `Påminnelse sendt til ${recipients.join(", ")}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("salgsagent-paaminning error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
