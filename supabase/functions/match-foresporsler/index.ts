import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await sb.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { konsulent, foresporsler } = await req.json();

    if (!foresporsler?.length) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Du er en konsulentmatcher for STACQ, et norsk IT-konsulentbyrå som spesialiserer seg på embedded systems og engineering.
Ranger forespørsler etter hvor godt de passer for denne konsulenten.
Return ONLY valid JSON array, no markdown, no explanation:
[{
  "id": <number>,
  "selskap_navn": "<string>",
  "score": <number 1-10>,
  "begrunnelse": "<string, maks 12 ord, norsk>",
  "match_tags": ["<matching technology>", ...]
}]
Ranger best match først. Inkluder kun score >= 4. Returner maks 15 matcher.`;

    const userPrompt = `Konsulent: ${konsulent.navn}
Teknologier: ${konsulent.teknologier?.join(", ") || "ukjent"}
${konsulent.cv_tekst ? `CV-sammendrag: ${konsulent.cv_tekst.slice(0, 800)}` : "CV: ikke tilgjengelig"}
${konsulent.geografi ? `Geografi: ${konsulent.geografi}` : ""}

Aktive forespørsler:
${foresporsler.map((f: any) =>
  `ID:${f.id} | ${f.selskap_navn} | ${f.sted || "ukjent sted"} | Teknologier: ${(f.teknologier || []).join(", ") || "ukjent"} | Frist: ${f.frist_dato || "ingen"}`
).join("\n")}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 4000,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "For mange forespørsler, prøv igjen om litt." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Kreditter oppbrukt." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: `AI-matching feilet [${response.status}]` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? "[]";
    let clean = text.replace(/```json|```/g, "").trim();

    // Handle truncated JSON: try to recover a valid array
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      // Attempt to recover truncated JSON array
      const lastBrace = clean.lastIndexOf("}");
      if (lastBrace > 0) {
        const recovered = clean.slice(0, lastBrace + 1) + "]";
        try {
          parsed = JSON.parse(recovered);
          console.log("Recovered truncated JSON with", parsed.length, "items");
        } catch {
          console.error("Failed to parse AI match response:", text.slice(0, 500));
          return new Response(
            JSON.stringify({ error: "Kunne ikke tolke AI-svaret" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        console.error("Failed to parse AI match response:", text.slice(0, 500));
        return new Response(
          JSON.stringify({ error: "Kunne ikke tolke AI-svaret" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("match-foresporsler error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
