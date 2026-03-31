import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { mergeTechnologyTags, normalizeTechnologyTags } from "../_shared/technologyTags.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTRACTION_SYSTEM_PROMPT = `Du jobber for STACQ og skal trekke ut teknologier fra kundeforesporsler, stillingsannonser og CRM-notater.
Finn alle relevante teknologier som er eksplisitt nevnt eller sterkt implisert. Ta med programmeringssprak, RTOS, operativsystemer, protokoller, MCU/SoC-familier, rammeverk, verktøy og fagomrader nar de er teknisk nyttige for matching.
Ikke finn opp noe som ikke er i teksten.
Returner KUN en JSON-array med strings. Ingen markdown, ingen forklaring.`;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function cleanJsonBlock(text: string): string {
  return text.replace(/```json|```/gi, "").trim();
}

function parseStringArray(raw: string): string[] {
  const cleaned = cleanJsonBlock(raw);
  if (!cleaned) return [];

  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
  } catch {
    const quoted = [...cleaned.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    if (quoted.length > 0) return quoted;
    return cleaned
      .split(/[,;\n]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { text, existing, rawTags } = await req.json();
    const existingTags = normalizeTechnologyTags(existing || []);
    const providedTags = normalizeTechnologyTags(rawTags || []);

    if (!text || !String(text).trim()) {
      const mergedWithoutAi = mergeTechnologyTags(existingTags, providedTags);
      return jsonResponse({
        tags: mergedWithoutAi,
        found: providedTags,
      });
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: String(text).trim() },
        ],
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("extract-technology-tags gateway error:", response.status, errorText);
      return jsonResponse({ error: "AI-feil. Prøv igjen." }, response.status === 429 ? 429 : 500);
    }

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content || "[]";
    const aiTags = parseStringArray(content);
    const found = mergeTechnologyTags(providedTags, aiTags);
    const tags = mergeTechnologyTags(existingTags, found);

    return jsonResponse({
      tags,
      found,
    });
  } catch (error) {
    console.error("extract-technology-tags error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Ukjent feil" }, 500);
  }
});
