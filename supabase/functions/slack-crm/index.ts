const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipient, message } = await req.json();

    const webhookUrl = Deno.env.get("SLACK_CRM_WEBHOOK_URL");
    if (!webhookUrl) {
      return new Response(JSON.stringify({ error: "Missing SLACK_CRM_WEBHOOK_URL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      channel: recipient || "#crm",
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "🔔 CV-editor innlogging", emoji: true },
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: message },
        },
        {
          type: "context",
          elements: [
            { type: "mrkdwn", text: "Sendt via STACQ CRM · CV-editor" },
          ],
        },
      ],
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    return new Response(JSON.stringify({ ok: res.ok, status: res.status, body: text }), {
      status: res.ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("slack-crm error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Ukjent feil" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
