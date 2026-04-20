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

    // 2. Date setup
    const today = new Date();
    const todayISO = today.toISOString().split("T")[0];
    const threshold = new Date();
    threshold.setDate(today.getDate() + settings.terskel_dager);
    const thresholdISO = threshold.toISOString().split("T")[0];

    // 3. Get oppdrag — datodrevet filter, ikke status-felt
    const { data: oppdrag } = await supabase
      .from("stacq_oppdrag")
      .select("id, kandidat, kunde, forny_dato, status, lopende_30_dager, slutt_dato, ansatt_id")
      .not("forny_dato", "is", null)
      .lte("forny_dato", thresholdISO)
      .or(`slutt_dato.is.null,slutt_dato.gte.${todayISO}`)
      .order("forny_dato");

    // 4. Get aktive ansatte
    const { data: ansatte } = await supabase
      .from("stacq_ansatte")
      .select("id, navn, status, slutt_dato, tilgjengelig_fra")
      .or(`slutt_dato.is.null,slutt_dato.gte.${todayISO}`)
      .order("navn");

    // 5. Get alle pågående oppdrag for å finne hvem som er uten oppdrag
    const { data: paagaaendeOppdrag } = await supabase
      .from("stacq_oppdrag")
      .select("ansatt_id, kunde, slutt_dato")
      .or(`slutt_dato.is.null,slutt_dato.gte.${todayISO}`);

    const ansatteMedOppdrag = new Set(
      (paagaaendeOppdrag || [])
        .map((o) => o.ansatt_id)
        .filter((v): v is number => v !== null && v !== undefined)
    );

    // 6. Hent siste avsluttet oppdrag per ansatt for kontekst
    const { data: alleOppdrag } = await supabase
      .from("stacq_oppdrag")
      .select("ansatt_id, kunde, slutt_dato")
      .not("ansatt_id", "is", null)
      .not("slutt_dato", "is", null)
      .lt("slutt_dato", todayISO)
      .order("slutt_dato", { ascending: false });

    const sisteKundePerAnsatt = new Map<number, string>();
    for (const o of alleOppdrag || []) {
      if (o.ansatt_id && !sisteKundePerAnsatt.has(o.ansatt_id) && o.kunde) {
        sisteKundePerAnsatt.set(o.ansatt_id, o.kunde);
      }
    }

    const ekskluderteStatuser = new Set(["SLUTTET", "AVSLUTTET", "Sluttet", "Avsluttet"]);
    const utenOppdrag = (ansatte || [])
      .filter((a) => !ansatteMedOppdrag.has(a.id))
      .filter((a) => !a.status || !ekskluderteStatuser.has(a.status))
      .map((a) => ({
        navn: a.navn,
        tilgjengelig_fra: a.tilgjengelig_fra,
        siste_kunde: sisteKundePerAnsatt.get(a.id) || null,
      }));

    // 7. Segment fornyelser
    const enriched = (oppdrag || []).map((o) => {
      const days = Math.ceil(
        (new Date(o.forny_dato!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return { ...o, daysUntilForny: days };
    });

    const kritisk = enriched.filter((o) => o.daysUntilForny <= 7);
    const snart = enriched.filter((o) => o.daysUntilForny > 7 && o.daysUntilForny <= 30);
    const planlegg = enriched.filter((o) => o.daysUntilForny > 30);

    if (enriched.length === 0 && utenOppdrag.length === 0) {
      return new Response(JSON.stringify({ message: "Ingen fornyelser eller konsulenter uten oppdrag" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 8. Subject + dato
    const subject = 'Kontraktfornyelser';
    const datoNorsk = today.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });

    // 9. Bygg HTML
    function oppdragRad(o: typeof enriched[0], badgeBg: string, badgeColor: string) {
      const fornyDato = new Date(o.forny_dato!).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' });
      return `
        <div style="padding:14px 0;border-top:1px solid #f5f5f5;display:flex;align-items:center;justify-content:space-between">
          <div>
            <p style="font-size:15px;font-weight:600;color:#0a0a0a;margin:0 0 2px">${o.kandidat}</p>
            <p style="font-size:13px;color:#888888;margin:0">${o.kunde ?? '—'} · Forny: ${fornyDato}</p>
          </div>
          <span style="display:inline-block;background:${badgeBg};color:${badgeColor};font-size:12px;font-weight:600;padding:4px 10px;border-radius:20px;white-space:nowrap;margin-left:16px">${o.lopende_30_dager ? 'Løpende 30 dager' : `Om ${o.daysUntilForny} dager`}</span>
        </div>`;
    }

    function seksjon(tittel: string, farge: string, badgeBg: string, oppdragListe: typeof enriched) {
      if (oppdragListe.length === 0) return '';
      return `
        <div style="padding:24px 40px 0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
            <span style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#64748b">${tittel}</span>
          </div>
          ${oppdragListe.map(o => oppdragRad(o, badgeBg, farge)).join('')}
        </div>`;
    }

    function utenOppdragRad(a: typeof utenOppdrag[0]) {
      let tilgjengeligTekst = 'Tilgjengelig nå';
      if (a.tilgjengelig_fra) {
        const tilgjDato = new Date(a.tilgjengelig_fra);
        if (tilgjDato > today) {
          tilgjengeligTekst = `Fra ${tilgjDato.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
        }
      }
      const sisteKundeTekst = a.siste_kunde ? `Sist hos ${a.siste_kunde}` : 'Ingen tidligere oppdrag';
      return `
        <div style="padding:14px 0;border-top:1px solid #f5f5f5;display:flex;align-items:center;justify-content:space-between">
          <div>
            <p style="font-size:15px;font-weight:600;color:#0a0a0a;margin:0 0 2px">${a.navn}</p>
            <p style="font-size:13px;color:#888888;margin:0">${sisteKundeTekst}</p>
          </div>
          <span style="display:inline-block;background:#F1F5F9;color:#64748B;font-size:12px;font-weight:600;padding:4px 10px;border-radius:20px;white-space:nowrap;margin-left:16px">${tilgjengeligTekst}</span>
        </div>`;
    }

    function utenOppdragSeksjon() {
      if (utenOppdrag.length === 0) return '';
      return `
        <div style="padding:24px 40px 0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
            <span style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#64748b">Konsulenter uten oppdrag</span>
          </div>
          ${utenOppdrag.map(utenOppdragRad).join('')}
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
        <td style="width:1px;background:#e2e8f0;padding:0"></td>
        <td style="text-align:center;padding:16px 0">
          <div style="font-size:28px;font-weight:700;color:#64748B;letter-spacing:-0.5px">${utenOppdrag.length}</div>
          <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;margin-top:4px">Uten oppdrag</div>
        </td>
      </tr>
    </table>
  </div>

  ${seksjon('Kritisk — under 7 dager', '#DC2626', '#FEF2F2', kritisk)}
  ${seksjon('Snart — under 30 dager', '#D97706', '#FFFBEB', snart)}
  ${seksjon('Planlegg — under 90 dager', '#CA8A04', '#FEFCE8', planlegg)}
  ${utenOppdragSeksjon()}

  <!-- CTA -->
  <div style="padding:32px 40px">
    <a href="https://crm.stacq.no/konsulenter/i-oppdrag" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:13px;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none;letter-spacing:0.02em">Åpne aktive oppdrag →</a>
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

    // 10. Send via Resend
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
      JSON.stringify({
        success: true,
        sent_to: recipients,
        oppdrag_count: enriched.length,
        uten_oppdrag_count: utenOppdrag.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
