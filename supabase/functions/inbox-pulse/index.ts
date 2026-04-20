import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CLIENT_ID = Deno.env.get("AZURE_CLIENT_ID")!;
const TENANT_ID = Deno.env.get("AZURE_TENANT_ID")!;
const CLIENT_SECRET = Deno.env.get("AZURE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

interface Insight {
  summary: string;
  type: "unanswered" | "buried" | "follow_up";
  email_id: string | null;
  contact_email: string | null;
  age_days: number;
  web_link: string | null;
}

interface PulseResponse {
  insights: Insight[];
  scanned_count: number;
  generated_at: string;
}

const cache = new Map<string, { data: PulseResponse; expires: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

async function refreshTokenIfNeeded(
  supabase: any,
  tokenRow: { user_id: string; access_token: string; refresh_token: string; expires_at: string },
): Promise<string> {
  const expiresAt = new Date(tokenRow.expires_at);
  if (expiresAt.getTime() - Date.now() > 5 * 60 * 1000) return tokenRow.access_token;

  const tokenRes = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: tokenRow.refresh_token,
      grant_type: "refresh_token",
      scope: "offline_access Mail.Read Calendars.ReadWrite",
    }).toString(),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) throw new Error("Token refresh failed");

  const newExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
  await supabase
    .from("outlook_tokens")
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || tokenRow.refresh_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", tokenRow.user_id);
  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const userToken = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(userToken);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const cached = cache.get(userId);
    if (cached && cached.expires > Date.now()) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Hent token for innlogget bruker (fall tilbake til alle admin-tokens hvis bruker ikke har eget)
    const { data: tokens } = await supabase.from("outlook_tokens").select("*").eq("user_id", userId);
    const tokenRows = tokens && tokens.length > 0
      ? tokens
      : ((await supabase.from("outlook_tokens").select("*")).data || []);

    if (!tokenRows || tokenRows.length === 0) {
      const empty: PulseResponse = {
        insights: [],
        scanned_count: 0,
        generated_at: new Date().toISOString(),
      };
      return new Response(JSON.stringify(empty), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const allEmails: any[] = [];

    for (const row of tokenRows) {
      try {
        const accessToken = await refreshTokenIfNeeded(supabase, row);
        const url =
          `${GRAPH_BASE}/me/messages?$top=100&$orderby=receivedDateTime desc` +
          `&$filter=receivedDateTime ge ${since}` +
          `&$select=id,subject,from,receivedDateTime,bodyPreview,isRead,webLink,conversationId`;
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!resp.ok) {
          console.error("graph error", row.user_id, await resp.text());
          continue;
        }
        const data = await resp.json();
        for (const m of data.value || []) {
          allEmails.push({
            id: m.id,
            subject: m.subject || "(uten emne)",
            from: m.from?.emailAddress?.address || "",
            from_name: m.from?.emailAddress?.name || "",
            date: m.receivedDateTime,
            preview: (m.bodyPreview || "").slice(0, 200),
            is_read: m.isRead,
            web_link: m.webLink || null,
            conv: m.conversationId,
          });
        }
      } catch (err) {
        console.error("fetch err", err);
      }
    }

    if (allEmails.length === 0) {
      const empty: PulseResponse = {
        insights: [],
        scanned_count: 0,
        generated_at: new Date().toISOString(),
      };
      cache.set(userId, { data: empty, expires: Date.now() + CACHE_TTL_MS });
      return new Response(JSON.stringify(empty), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dedupliser på conversationId — behold nyeste
    const byConv = new Map<string, any>();
    for (const m of allEmails) {
      const key = m.conv || m.id;
      const existing = byConv.get(key);
      if (!existing || new Date(m.date) > new Date(existing.date)) byConv.set(key, m);
    }
    const dedupedEmails = Array.from(byConv.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    // Komprimer for AI
    const compactEmails = dedupedEmails.slice(0, 80).map((m) => ({
      id: m.id,
      subj: m.subject.slice(0, 100),
      from: m.from,
      date: m.date?.slice(0, 10),
      age: Math.round((Date.now() - new Date(m.date).getTime()) / (1000 * 60 * 60 * 24)),
      prev: m.preview.slice(0, 150),
      read: m.is_read,
    }));

    const systemPrompt = `Du er erfaren salgssjef i STACQ (norsk IT-konsulentbyrå, embedded/firmware/C/C++).
Du har lest ${compactEmails.length} e-poster fra siste 14 dager.

Identifiser MAKS 5 e-poster som krever handling NÅ. Prioriter:
- Ubesvarte kundetråder med konkrete behov
- E-poster fra kjente bedriftskontakter (ikke automatiske systemmail/markedsføring)
- Eldre tråder som "har blitt liggende" (over 7 dager uten svar)
- Konkrete forespørsler om konsulent, CV, oppdrag, fornyelse

Returner KUN JSON i formatet:
{
  "insights": [
    {
      "summary": "Kort handlingsorientert oppsummering på maks 14 ord",
      "type": "unanswered" | "buried" | "follow_up",
      "email_id": "<id fra konteksten>",
      "contact_email": "<from-felt>",
      "age_days": <tall>
    }
  ]
}

Norsk bokmål. Bruk "konsulent". Ikke ta med markedsføringsmail, nyhetsbrev, automatiske varsler. Returner BARE JSON.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(compactEmails) },
        ],
        max_tokens: 1500,
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      const fallback: PulseResponse = {
        insights: [],
        scanned_count: dedupedEmails.length,
        generated_at: new Date().toISOString(),
      };
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const text = (aiJson.choices?.[0]?.message?.content || "")
      .replace(/```json|```/g, "")
      .trim();

    let insights: Insight[] = [];
    try {
      const obj = JSON.parse(text);
      if (Array.isArray(obj.insights)) {
        insights = obj.insights.slice(0, 5).map((i: any) => {
          const matched = dedupedEmails.find((m) => m.id === i.email_id);
          return {
            summary: String(i.summary || "").slice(0, 200),
            type: ["unanswered", "buried", "follow_up"].includes(i.type) ? i.type : "follow_up",
            email_id: i.email_id || null,
            contact_email: i.contact_email || matched?.from || null,
            age_days: typeof i.age_days === "number" ? i.age_days : matched?.age || 0,
            web_link: matched?.web_link || null,
          };
        });
      }
    } catch (e) {
      console.error("Parse err", e, text);
    }

    const result: PulseResponse = {
      insights,
      scanned_count: dedupedEmails.length,
      generated_at: new Date().toISOString(),
    };
    cache.set(userId, { data: result, expires: Date.now() + CACHE_TTL_MS });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("inbox-pulse error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Ukjent feil" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
