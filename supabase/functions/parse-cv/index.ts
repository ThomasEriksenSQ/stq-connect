import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { base64, filename } = await req.json();
    if (!base64) throw new Error("Missing base64 PDF data");

    const systemPrompt = `Du er en CV-analysator for et norsk konsulentselskap (STACQ) som matcher ingeniører/teknologer med oppdrag.
Analyser CV-en og returner KUN et JSON-objekt uten noe annet tekst eller markdown. JSON-strukturen skal være eksakt:
{
  "navn": "string",
  "tittel": "string (kort profesjonell tittel, maks 8 ord)",
  "introParagraphs": ["string", "string"],
  "competenceGroups": [
    { "label": "string", "content": "string" }
  ],
  "projects": [
    {
      "company": "string",
      "subtitle": "string (kort prosjektbeskrivelse)",
      "role": "string",
      "period": "string (f.eks. jan. 2022 - mai 2024)",
      "paragraphs": ["string", "string"],
      "technologies": "string (kommaseparert liste)"
    }
  ],
  "education": [
    { "period": "string", "primary": "string", "secondary": "string" }
  ],
  "workExperience": [
    { "period": "string", "primary": "string" }
  ],
  "sidebarSections": [
    {
      "heading": "string",
      "items": ["string"]
    }
  ]
}

Regler:
- Trekk ut ALLE prosjekter med rolle, periode, beskrivelse og teknologier
- Lag 2-4 kompetansegrupper basert på CV-innhold (f.eks. Programmeringsspråk, Embedded-teknologier, Hardware, Kommunikasjonsprotokoller)
- introParagraphs: 2-3 avsnitt som oppsummerer kandidaten profesjonelt, skriv i tredjeperson
- sidebarSections: inkluder Personalia (fødselsår, språk, statsborgerskap), Nøkkelpunkter (tekniske nøkkelord), og Utdannelse
- workExperience: liste alle arbeidsgivere med periode
- Returner BARE JSON, ingen forklaring, ingen markdown-blokker`;

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
          max_tokens: 16000,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyser denne CV-en (${filename || "cv.pdf"}) og returner JSON som beskrevet. VIKTIG: Returner KUN gyldig JSON, ingen markdown, ingen forklaring.`,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:application/pdf;base64,${base64}`,
                  },
                },
              ],
            },
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
          JSON.stringify({ error: "Kreditter oppbrukt. Legg til kreditter i Lovable." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI-analyse feilet" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    let clean = text.replace(/```json|```/g, "").trim();
    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      clean = clean.slice(firstBrace, lastBrace + 1);
    }

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      console.error("Failed to parse AI response:", text);
      return new Response(
        JSON.stringify({ error: "Dokumentet ser ikke ut til å være en CV. Last opp en CV i PDF-format." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-cv error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
