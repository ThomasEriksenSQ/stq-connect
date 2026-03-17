import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { full_name, email, phone, cv_url } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const htmlBody = `
      <h2>Ny søknad fra ${full_name}</h2>
      <p><strong>Navn:</strong> ${full_name}</p>
      <p><strong>E-post:</strong> <a href="mailto:${email}">${email}</a></p>
      <p><strong>Telefon:</strong> ${phone || "Ikke oppgitt"}</p>
      ${cv_url ? `<p><strong>CV:</strong> <a href="${cv_url}">Last ned CV</a></p>` : "<p><strong>CV:</strong> Ikke lastet opp</p>"}
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "STACQ <noreply@stacq.no>",
        to: ["thomas@stacq.no", "jr@stacq.no"],
        subject: `Ny søknad fra ${full_name}`,
        html: htmlBody,
      }),
    });

    const result = await res.json();
    return new Response(JSON.stringify(result), {
      status: res.ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
