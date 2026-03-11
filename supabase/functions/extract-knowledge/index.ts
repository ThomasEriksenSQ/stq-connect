import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { documentText } = await req.json();
    if (!documentText || typeof documentText !== "string" || documentText.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Tomt dokument" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Du er en assistent som trekker ut relevant kunnskap fra dokumenter for STACQ — et norsk IT-konsulentselskap spesialisert på embedded software, firmware, C, C++ og Rust.

Analyser dokumentet og returner KUN en JSON-array med objekter på dette formatet:
[{"category": "skills", "content": "Beskrivelse av kompetanse eller erfaring"}]

Regler:
- Aldri inkluder personnavn, arbeidsgivernavn, kundenavn eller årstall
- Skriv om til anonymisert form: bruk "En av våre konsulenter har..." eller "STACQ har erfaring med..."
- Maks 15 rader totalt
- Gyldige kategorier: skills, domain, services, availability, education, languages
- Returner BARE JSON-arrayen, ingen annen tekst, ingen markdown`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: documentText.slice(0, 50000) },
        ],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "For mange forespørsler. Prøv igjen om litt." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Mangler kreditter for AI." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI-feil, prøv igjen" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || "";

    // Strip markdown fences if present
    let jsonStr = rawText.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let rows: Array<{ category: string; content: string }>;
    try {
      rows = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", rawText);
      return new Response(JSON.stringify({ error: "Kunne ikke tolke AI-svar", raw: rawText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate
    const validCategories = ["skills", "domain", "services", "availability", "education", "languages"];
    const validRows = (Array.isArray(rows) ? rows : [])
      .filter((r) => r.category && validCategories.includes(r.category) && r.content)
      .slice(0, 15);

    return new Response(JSON.stringify({ rows: validRows }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-knowledge error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Ukjent feil" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
