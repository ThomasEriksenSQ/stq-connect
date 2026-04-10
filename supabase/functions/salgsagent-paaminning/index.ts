import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@^4.0.0";

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

    const html = `
      <div style="font-family: sans-serif; max-width: 560px;">
        <h2 style="color: #1a1a1a;">Salgsagent-påminnelse</h2>
        <p style="color: #555; line-height: 1.6;">
          ${test ? "<strong>[TEST]</strong> " : ""}Salgsagenten har ikke blitt brukt de siste 7 dagene.
          Husk å bruke den regelmessig for å holde oversikt over salgsaktiviteter.
        </p>
        <a href="https://stq-connect.lovable.app/" style="display: inline-block; margin-top: 16px; padding: 10px 20px; background: #2563eb; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 500;">
          Åpne STACQ
        </a>
      </div>
    `;

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
