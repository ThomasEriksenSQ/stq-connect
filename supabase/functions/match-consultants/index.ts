import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { buildMatchingProfile, sanitizeAiMatchResults } from "../_shared/matchingProfile.ts";

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

    type ConsultantCandidate = {
      id: number | string;
      navn: string;
      kompetanse?: string[] | null;
      teknologier?: string[] | null;
    };

    const {
      teknologier,
      sted,
      interne,
      eksterne,
    }: {
      teknologier?: string[] | null;
      sted?: string | null;
      interne?: ConsultantCandidate[] | null;
      eksterne?: ConsultantCandidate[] | null;
    } = await req.json();
    const requestProfile = buildMatchingProfile(teknologier || []);

    if (!requestProfile.tags.length) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const candidateProfiles = new Map<string, { tags: string[]; type: string; navn?: string }>();
    const normalizedInterne = (interne || []).map((k) => {
      const profile = buildMatchingProfile(k.kompetanse || []);
      candidateProfiles.set(String(k.id), { tags: profile.tags, type: "intern", navn: k.navn });
      return { ...k, _profile: profile };
    });
    const normalizedEksterne = (eksterne || []).map((k) => {
      const profile = buildMatchingProfile(k.teknologier || []);
      candidateProfiles.set(String(k.id), { tags: profile.tags, type: "ekstern", navn: k.navn });
      return { ...k, _profile: profile };
    });

    const systemPrompt = `You are a consultant matching assistant for STACQ, a Norwegian IT staffing company specializing in embedded systems and engineering.
Rank consultants by fit for the assignment. Return ONLY a valid JSON array, no markdown, no explanation:
[{ "id": <number|string>, "navn": "<name>", "type": "intern"|"ekstern", "score": <1-10>, "begrunnelse": "<1 short Norwegian sentence, max 12 words>", "match_tags": ["<matching technology>", ...] }]
Rank best fit first. Return ALL consultants with score >= 4, ranked best first. Return as many matches as possible — do not limit the list.
Use exact canonical tags from the provided profiles when you populate match_tags. Do not invent new tags.`;

    const userPrompt = `Forespørsel: ${requestProfile.promptText}${sted ? ` — ${sted}` : ""}

Interne konsulenter:
${normalizedInterne.map((k) => `[id:${k.id}] ${k.navn}: ${k._profile.promptText}`).join("\n") || "Ingen"}

Eksterne konsulenter (tilgjengelige):
${normalizedEksterne.map((k) => `[id:${k.id}] ${k.navn}: ${k._profile.promptText}`).join("\n") || "Ingen"}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
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
    const clean = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      console.error("Failed to parse AI match response:", text);
      return new Response(
        JSON.stringify({ error: "Kunne ikke tolke AI-svaret" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sanitized = sanitizeAiMatchResults(parsed, {
      targetTags: requestProfile.tags,
      sourcesById: candidateProfiles,
      allowedTypes: new Set(["intern", "ekstern"]),
      fallbackReason: "Relevant teknologimatch",
    });

    return new Response(JSON.stringify(sanitized), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("match-consultants error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
