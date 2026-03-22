import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function formatDateNorwegian(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function todayNorwegian(): string {
  return formatDateNorwegian(new Date().toISOString());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let isTest = false;
    try {
      const body = await req.json();
      isTest = body?.test === true;
    } catch { /* no body */ }

    // 1. Get settings
    const { data: settings, error: settingsErr } = await supabase
      .from("varslingsinnstillinger")
      .select("*")
      .single();

    if (settingsErr || !settings) {
      return new Response(JSON.stringify({ error: "Ingen innstillinger funnet" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!settings.aktiv && !isTest) {
      return new Response(JSON.stringify({ message: "Varsler er deaktivert" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get oppdrag
    const today = new Date();
    const threshold = new Date();
    threshold.setDate(today.getDate() + settings.terskel_dager);

    const { data: oppdrag } = await supabase
      .from("stacq_oppdrag")
      .select("id, kandidat, kunde, forny_dato, status")
      .neq("status", "Inaktiv")
      .not("forny_dato", "is", null)
      .lte("forny_dato", threshold.toISOString().split("T")[0])
      .order("forny_dato");

    if (!oppdrag || oppdrag.length === 0) {
      return new Response(JSON.stringify({ message: "Ingen fornyelser innen terskel" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Segment
    const enriched = oppdrag.map((o) => {
      const days = Math.ceil(
        (new Date(o.forny_dato!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return { ...o, daysUntilForny: days };
    });

    const kritisk = enriched.filter((o) => o.daysUntilForny <= 7);
    const snart = enriched.filter((o) => o.daysUntilForny > 7 && o.daysUntilForny <= 30);
    const planlegg = enriched.filter((o) => o.daysUntilForny > 30);

    // 4. Subject
    const first = enriched.sort((a, b) => a.daysUntilForny - b.daysUntilForny)[0];
    const others = enriched.length - 1;
    let subject = `${first.kandidat} (${first.kunde || "ukjent"}) forny om ${first.daysUntilForny}d`;
    if (others > 0) subject += ` — og ${others} andre kontrakter`;

    // 5. Build HTML
    const renderSection = (
      title: string,
      color: string,
      items: typeof enriched
    ) => {
      if (items.length === 0) return "";
      return `
        <div style="margin-bottom:24px;">
          <h2 style="font-size:14px;font-weight:700;color:${color};margin:0 0 12px;border-bottom:2px solid ${color};padding-bottom:6px;">${title}</h2>
          ${items
            .map(
              (o) => `
            <div style="padding:10px 0;border-bottom:1px solid #E5E7EB;">
              <span style="font-weight:600;font-size:15px;color:#111827;">${o.kandidat}</span>
              <span style="color:#6B7280;font-size:13px;margin-left:8px;">${o.kunde || ""}</span>
              <div style="margin-top:4px;">
                <span style="font-size:12px;color:#6B7280;">Forny: ${formatDateNorwegian(o.forny_dato!)}</span>
                <span style="font-weight:600;color:${color};font-size:13px;margin-left:12px;">Om ${o.daysUntilForny} dager</span>
              </div>
            </div>`
            )
            .join("")}
        </div>`;
    };

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 4px;">Ukentlig fornyelsesrapport</h1>
        <p style="font-size:13px;color:#6B7280;margin:0 0 24px;">${todayNorwegian()}</p>
        ${renderSection(`Kritisk — under 7 dager`, "#DC2626", kritisk)}
        ${renderSection(`Snart — 8 til 30 dager`, "#D97706", snart)}
        ${renderSection(`Planlegg — 31 til ${settings.terskel_dager} dager`, "#CA8A04", planlegg)}
        <div style="margin-top:32px;padding-top:16px;border-top:1px solid #E5E7EB;">
          <a href="https://crm.stacq.no/konsulenter/i-oppdrag?filter=Aktiv" style="color:#2563EB;font-size:14px;font-weight:500;text-decoration:none;">
            Åpne aktive oppdrag →
          </a>
        </div>
      </div>`;

    // 6. Send via Resend
    const recipients = isTest ? ["thomas@stacq.no"] : (settings.epost_mottakere as string[]);

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "STACQ CRM <thomas@stacq.no>",
        to: recipients,
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      return new Response(JSON.stringify({ error: err }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, sent_to: recipients, oppdrag_count: enriched.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
