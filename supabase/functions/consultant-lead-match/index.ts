import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface LeadMatch {
  contact_id: string | null;
  score: number;
  reasoning: string;
}

interface Match {
  consultant_id: number;
  // Bakoverkompatibelt: speiler top_leads[0]
  best_contact_id: string | null;
  score: number;
  reasoning: string;
  top_leads: LeadMatch[];
}

interface MatchResponse {
  matches: Match[];
  generated_at: string;
}

const cache = new Map<string, { data: MatchResponse; expires: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_VERSION = "v2";

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const body = await req.json();
    const consultants: Array<{
      consultant_id: number;
      navn: string;
      kompetanse: string[];
      tilgjengelig_fra: string | null;
    }> = Array.isArray(body.consultants) ? body.consultants.slice(0, 10) : [];
    const leads: Array<{
      contact_id: string;
      navn: string;
      selskap: string;
      signal: string;
      teknologier: string[];
      heat_score: number;
    }> = Array.isArray(body.leads) ? body.leads.slice(0, 30) : [];

    if (consultants.length === 0 || leads.length === 0) {
      const empty: MatchResponse = { matches: [], generated_at: new Date().toISOString() };
      return new Response(JSON.stringify(empty), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cacheKey = `${CACHE_VERSION}:${userId}:${consultants.map((c) => c.consultant_id).join(",")}:${leads.map((l) => l.contact_id).slice(0, 10).join(",")}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

    const systemPrompt = `Du er erfaren salgssjef i STACQ (norsk IT-konsulentbyrå, embedded/firmware/C/C++).
For HVER konsulent: velg TOPP 3 leads rangert etter match-kvalitet, basert på:
1. Teknologi-overlapp (vekt: høy)
2. Signal-styrke (Behov nå > Får fremtidig behov > Får kanskje behov)
3. Heat score
4. Realistisk timing (konsulent ledig snart = haster)

Hver lead kan bare være "beste lead" (første i top_leads) for én konsulent — unngå at samme lead rangeres #1 hos flere konsulenter. Samme lead kan godt gå igjen som #2 eller #3.

Returner KUN JSON:
{
  "matches": [
    {
      "consultant_id": <tall>,
      "top_leads": [
        { "contact_id": "<id>", "score": <0–100>, "reasoning": "maks 12 ord om teknologi/signal" },
        { "contact_id": "<id>", "score": <0–100>, "reasoning": "..." },
        { "contact_id": "<id>", "score": <0–100>, "reasoning": "..." }
      ]
    }
  ]
}

Hvis færre enn 3 leads passer: returner de som finnes. Hvis ingen passer: top_leads=[].
Bruk "konsulent". Norsk bokmål. Returner BARE JSON.`;

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
          {
            role: "user",
            content: JSON.stringify({ consultants, leads }),
          },
        ],
        max_tokens: 1500,
      }),
    });

    if (!aiResp.ok) {
      console.error("AI error", aiResp.status, await aiResp.text());
      const empty: MatchResponse = { matches: [], generated_at: new Date().toISOString() };
      return new Response(JSON.stringify(empty), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const text = (aiJson.choices?.[0]?.message?.content || "")
      .replace(/```json|```/g, "")
      .trim();

    let matches: Match[] = [];
    try {
      const obj = JSON.parse(text);
      if (Array.isArray(obj.matches)) {
        matches = obj.matches.slice(0, 10).map((m: any) => {
          const rawTop: any[] = Array.isArray(m.top_leads) ? m.top_leads : [];
          const top_leads: LeadMatch[] = rawTop.slice(0, 3).map((t: any) => ({
            contact_id: t.contact_id || null,
            score: Math.max(0, Math.min(100, Number(t.score) || 0)),
            reasoning: String(t.reasoning || "").slice(0, 200),
          }));

          // Bakoverkompatibelt: hvis AI svarte i gammelt format, map til top_leads[0]
          if (top_leads.length === 0 && (m.best_contact_id || m.score || m.reasoning)) {
            top_leads.push({
              contact_id: m.best_contact_id || null,
              score: Math.max(0, Math.min(100, Number(m.score) || 0)),
              reasoning: String(m.reasoning || "").slice(0, 200),
            });
          }

          const first = top_leads[0];
          return {
            consultant_id: Number(m.consultant_id),
            best_contact_id: first?.contact_id || null,
            score: first?.score || 0,
            reasoning: first?.reasoning || "Ingen passende lead nå",
            top_leads,
          };
        });
      }
    } catch (e) {
      console.error("Parse err", e, text);
    }

    const result: MatchResponse = { matches, generated_at: new Date().toISOString() };
    cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL_MS });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("consultant-lead-match error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Ukjent feil" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
