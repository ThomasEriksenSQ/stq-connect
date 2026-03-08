import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
Analyser CV-en og returner KUN gyldig JSON, ingen tekst rundt:
{
  "navn": <string, personens fulle navn fra CV-en>,
  "erfaring_aar": <number, totale år med relevant arbeidserfaring>,
  "kompetanse": <string[], topp 6-8 tekniske nøkkelord, kort og presist>,
  "geografi": <string, primær by der personen jobber/bor>,
  "bio": <string, 2-3 setninger om hvem konsulenten er, hva de er best på og hva slags oppdrag de passer til. Skriv i tredjeperson. Profesjonell men menneskelig tone. Maks 60 ord.>
}
Kompetanse: bruk tekniske nøkkelord som C++, Embedded, Python, Linux, Yocto, FPGA, osv. Ikke skriv "erfaren" eller adjektiver.`;

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
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyser denne CV-en (${filename || "cv.pdf"}) og returner JSON som beskrevet.`,
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
    const clean = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      console.error("Failed to parse AI response:", text);
      return new Response(
        JSON.stringify({ error: "Kunne ikke tolke AI-svaret" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
