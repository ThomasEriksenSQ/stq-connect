import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_CHAT_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_MODEL = "google/gemini-2.5-flash";

type TranslateCvVariantRequest = {
  doc?: Record<string, unknown>;
  is_anonymized?: boolean;
  target_language_code?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireAuthorizedClient(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (error || !data?.claims) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return supabase;
}

function sanitizeJsonCandidate(text: string) {
  let clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const firstBrace = clean.indexOf("{");
  const lastBrace = clean.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    clean = clean.slice(firstBrace, lastBrace + 1);
  }

  return clean
    .replace(/,\s*([}\]])/g, "$1")
    .split("")
    .map((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 ? " " : character;
    })
    .join("")
    .trim();
}

function tryParseJsonPayload(text: string) {
  try {
    return JSON.parse(sanitizeJsonCandidate(text));
  } catch {
    return null;
  }
}

async function invokeLovableChat(apiKey: string, systemPrompt: string, userPrompt: string) {
  const response = await fetch(LOVABLE_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LOVABLE_MODEL,
      max_tokens: 16000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("translate-cv-variant AI gateway error:", response.status, errorText);

    if (response.status === 429) {
      throw new Response(JSON.stringify({ error: "For mange forespørsler, prøv igjen om litt." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (response.status === 402) {
      throw new Response(JSON.stringify({ error: "Kreditter oppbrukt. Legg til kreditter i Lovable." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("AI-oversettelse feilet");
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("AI returnerte tomt svar");
  return text;
}

async function repairMalformedJson(apiKey: string, rawText: string) {
  const repaired = await invokeLovableChat(
    apiKey,
    `Du reparerer ugyldig JSON.
Returner kun gyldig JSON og behold struktur, nøkler og innhold så likt som mulig.
Ikke legg til forklaringer, markdown eller kodegjerder.`,
    `Reparer dette til gyldig JSON:\n\n${rawText}`,
  );

  const parsed = tryParseJsonPayload(repaired);
  if (!parsed) throw new Error("AI returnerte ugyldig JSON ved reparasjon");
  return parsed;
}

async function extractJsonPayload(apiKey: string, text: string) {
  const parsed = tryParseJsonPayload(text);
  if (parsed) return parsed;
  return repairMalformedJson(apiKey, text);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireAuthorizedClient(req);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const body = (await req.json()) as TranslateCvVariantRequest;
    const doc = body.doc;
    const targetLanguageCode = body.target_language_code || "en";
    const isAnonymized = Boolean(body.is_anonymized);

    if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
      throw new Error("Manglende eller ugyldig CV-dokument");
    }

    if (targetLanguageCode !== "en") {
      throw new Error("Kun engelsk oversettelse er støttet nå");
    }

    const systemPrompt = `You translate STACQ CV documents from Norwegian to English.
Return only valid JSON that matches the input structure exactly.

Rules:
- Preserve the same object structure, array order, and field names.
- Translate only user-visible text to fluent, professional English.
- Keep company names, product names, acronyms, certifications, technologies, phone numbers, email addresses, URLs, and numeric dates unchanged unless they are ordinary Norwegian words.
- Do not add, remove, merge, split, or reorder paragraphs, rows, bullets, projects, competence groups, or sections.
- Keep empty strings empty and keep null/boolean/number values as they are.
- Translate section headings, prose, project titles, and labels such as "Teknologier" or "nåværende" when they are stored in the document.
- For anonymized CVs, preserve anonymity and translate placeholders consistently:
  - "Anonymisert kandidat" -> "Anonymous candidate"
  - "Konsulenten" -> "The consultant"
  - "Konsulentens" -> "The consultant's"
- Never reveal or invent a real candidate name in anonymized output.
- Return JSON only. No markdown, no code fences, no commentary.`;

    const userPrompt = `Translate this CV document to English.
Anonymized source: ${isAnonymized ? "yes" : "no"}

JSON:
${JSON.stringify(doc)}`;

    const rawResponse = await invokeLovableChat(apiKey, systemPrompt, userPrompt);
    const parsed = await extractJsonPayload(apiKey, rawResponse);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Oversettelsen returnerte ugyldig dokument");
    }

    return jsonResponse({ document: parsed });
  } catch (error) {
    if (error instanceof Response) return error;

    console.error("translate-cv-variant error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
