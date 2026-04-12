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
    const mostCritical = enriched[0];
    const antallAndre = enriched.length - 1;
    const subject = antallAndre === 0
      ? `${mostCritical.kandidat} (${mostCritical.kunde}) — forny om ${mostCritical.daysUntilForny} dager`
      : `${mostCritical.kandidat} (${mostCritical.kunde}) forny om ${mostCritical.daysUntilForny}d — og ${antallAndre} andre kontrakter`;

    // 5. Build HTML
    const datoNorsk = today.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });

    function oppdragRad(o: typeof enriched[0], badgeBg: string, badgeColor: string) {
      const fornyDato = new Date(o.forny_dato!).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' });
      return `
        <div style="padding:14px 0;border-top:1px solid #f5f5f5;display:flex;align-items:center;justify-content:space-between">
          <div>
            <p style="font-size:15px;font-weight:600;color:#0a0a0a;margin:0 0 2px">${o.kandidat}</p>
            <p style="font-size:13px;color:#888888;margin:0">${o.kunde} · Forny: ${fornyDato}</p>
          </div>
          <span style="display:inline-block;background:${badgeBg};color:${badgeColor};font-size:12px;font-weight:600;padding:4px 10px;border-radius:20px;white-space:nowrap;margin-left:16px">Om ${o.daysUntilForny} dager</span>
        </div>`;
    }

    function seksjon(tittel: string, farge: string, badgeBg: string, oppdragListe: typeof enriched) {
      if (oppdragListe.length === 0) return '';
      return `
        <div style="padding:24px 40px 0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
            
            <span style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${farge}">${tittel}</span>
          </div>
          ${oppdragListe.map(o => oppdragRad(o, badgeBg, farge)).join('')}
        </div>`;
    }

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
    <p style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#2563eb;margin:0 0 8px">Ukentlig rapport</p>
    <h1 style="font-size:24px;font-weight:700;color:#0f172a;margin:0 0 4px;letter-spacing:-0.3px">Kontraktfornyelser</h1>
    <p style="font-size:14px;color:#64748b;margin:8px 0 0">${enriched.length} oppdrag krever oppfølging de neste 90 dagene</p>
  </div>

  <!-- Stats -->
  <div style="padding:0 40px 24px">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:8px;overflow:hidden">
      <tr>
        <td style="text-align:center;padding:16px 0">
          <div style="font-size:28px;font-weight:700;color:#DC2626;letter-spacing:-0.5px">${kritisk.length}</div>
          <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;margin-top:4px">Kritisk</div>
        </td>
        <td style="width:1px;background:#e2e8f0;padding:0"></td>
        <td style="text-align:center;padding:16px 0">
          <div style="font-size:28px;font-weight:700;color:#D97706;letter-spacing:-0.5px">${snart.length}</div>
          <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;margin-top:4px">Snart</div>
        </td>
        <td style="width:1px;background:#e2e8f0;padding:0"></td>
        <td style="text-align:center;padding:16px 0">
          <div style="font-size:28px;font-weight:700;color:#2563eb;letter-spacing:-0.5px">${planlegg.length}</div>
          <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;margin-top:4px">Planlegg</div>
        </td>
      </tr>
    </table>
  </div>

  ${seksjon('Kritisk — under 7 dager', '#DC2626', '#FEF2F2', kritisk)}
  ${seksjon('Snart — under 30 dager', '#D97706', '#FFFBEB', snart)}
  ${seksjon('Planlegg — under 90 dager', '#CA8A04', '#FEFCE8', planlegg)}

  <!-- CTA -->
  <div style="padding:32px 40px">
    <a href="https://crm.stacq.no/konsulenter-oppdrag?filter=Aktiv" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:13px;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none;letter-spacing:0.02em">Åpne aktive oppdrag →</a>
  </div>

  <!-- Footer -->
  <div style="padding:20px 40px;border-top:1px solid #e2e8f0">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td><span style="font-size:12px;color:#94a3b8">STACQ CRM · Automatisk rapport</span></td>
        <td style="text-align:right"><span style="font-size:12px;color:#94a3b8">crm.stacq.no</span></td>
      </tr>
    </table>
  </div>

</div>
</div>
</div>
</body>
</html>`;

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
