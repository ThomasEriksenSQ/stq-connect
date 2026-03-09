import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { currentWeek, thisWeekRows, techCounts, topCompanies, notInCRM, brief } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt: string;
    let userPrompt: string;
    let maxTokens: number;

    if (brief) {
      systemPrompt = "Du er markedsanalytiker for STACQ. Gi en kort, skarp markedsoppsummering på 2-3 setninger. Kun det viktigste. Norsk.";
      userPrompt = `Teknologitrender siste 90 dager: ${techCounts}\nVarmeste selskaper siste 3 uker: ${topCompanies}\nSkriv 2-3 setninger om hva dette betyr for STACQ akkurat nå. Vær konkret og handlingsrettet.`;
      maxTokens = 600;
    } else {
      systemPrompt = `Du er markedsanalytiker for STACQ, et norsk IT-konsulentbyrå spesialisert på embedded/firmware C/C++ konsulenter. Analyser Finn.no-data og gi konkrete, handlingsrettede innsikter på norsk. Fokuser på: trender, muligheter, hvilke selskaper STACQ bør prioritere å kontakte.`;
      userPrompt = `Analyser dette markedsbildet:

SISTE UKE (${currentWeek}):
${thisWeekRows}

TEKNOLOGIFORDELING SISTE 4 UKER:
${techCounts}

TOPP SELSKAPER SISTE 8 UKER:
${topCompanies}

SELSKAPER IKKE I CRM:
${notInCRM}

Lag en analyse med disse seksjonene:
1. 📈 UKENS TRENDER (2-3 setninger om hva som er nytt)
2. 🎯 PRIORITERTE LEADS (topp 3-5 selskaper STACQ bør ringe denne uken, med konkret begrunnelse)
3. 🔧 TEKNOLOGISIGNALER (hvilke tech-stacks vokser, hvilke synker)
4. ⚡ MULIGHETER (selskaper som ansetter mye = voksende team = potensielt konsulentbehov)
5. 🏴 IKKE I CRM (hvilke av disse bør legges til)`;
      maxTokens = 2000;
    }

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
          { role: "user", content: userPrompt },
        ],
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit nådd, prøv igjen om litt." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Kreditter oppbrukt. Fyll på i Lovable workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI-feil" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "Ingen analyse generert.";

    return new Response(JSON.stringify({ analysis: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("markedsradar-analyse error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Ukjent feil" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
