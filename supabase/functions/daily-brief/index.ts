import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BriefAction {
  title: string;
  why_facts: string[];
  action_keys: Array<"J" | "M" | "V" | "S" | "F">;
  target_url: string | null;
  contact_id?: string | null;
  contact_name?: string | null;
  company_name?: string | null;
}

interface BriefResponse {
  actions: BriefAction[];
  placeholder_questions: string[];
  generated_at: string;
}

// In-memory cache: 30 min per user
const cache = new Map<string, { data: BriefResponse; expires: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

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
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const cached = cache.get(userId);
    if (cached && cached.expires > Date.now()) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Hent kontekst siste 24t
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [actsRes, tasksRes, foresRes, oppdragRes] = await Promise.all([
      supabase
        .from("activities")
        .select("subject, type, created_at, contact_id, company_id")
        .gte("created_at", since24h)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("tasks")
        .select("title, due_date, status, contact_id, company_id")
        .neq("status", "done")
        .order("due_date", { ascending: true })
        .limit(20),
      supabase
        .from("foresporsler")
        .select("id, selskap_navn, sluttkunde, mottatt_dato, frist_dato, status, teknologier, kontakt_id")
        .gte("mottatt_dato", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
        .order("mottatt_dato", { ascending: false })
        .limit(15),
      supabase
        .from("stacq_oppdrag")
        .select("kandidat, kunde, forny_dato, slutt_dato, status")
        .not("forny_dato", "is", null)
        .order("forny_dato", { ascending: true })
        .limit(15),
    ]);

    const compactContext = {
      activities_24h: (actsRes.data || []).slice(0, 10).map((a) => ({
        t: a.type,
        s: (a.subject || "").slice(0, 80),
        d: a.created_at?.slice(0, 10),
      })),
      open_tasks: (tasksRes.data || []).slice(0, 8).map((t) => ({
        t: (t.title || "").slice(0, 80),
        due: t.due_date,
      })),
      foresporsler: (foresRes.data || []).slice(0, 10).map((f) => ({
        id: f.id,
        selskap: f.selskap_navn,
        sluttkunde: f.sluttkunde,
        frist: f.frist_dato,
        teknologier: (f.teknologier || []).slice(0, 5),
        status: f.status,
      })),
      fornyelser_kommende: (oppdragRes.data || [])
        .filter((o) => {
          if (!o.forny_dato) return false;
          const days = Math.round(
            (new Date(o.forny_dato).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          return days >= -7 && days <= 30;
        })
        .slice(0, 8)
        .map((o) => ({
          k: o.kandidat,
          kunde: o.kunde,
          forny: o.forny_dato,
        })),
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY mangler");

    const systemPrompt = `Du er erfaren salgssjef i STACQ, et norsk IT-konsulentbyrå (embedded/firmware/C/C++).
Bruk alltid "konsulent". Norsk bokmål. Ingen emojis.

Returner KUN JSON med formatet:
{
  "actions": [
    {
      "title": "kort handling, maks 8 ord",
      "why_facts": ["faktum 1 med tall/dato", "faktum 2"],
      "action_keys": ["J", "M", "F"],
      "target_url": "/design-lab/kontakter/<id>" eller null,
      "contact_name": "navn eller null",
      "company_name": "selskap eller null"
    }
  ],
  "placeholder_questions": [
    "ekte spørsmål basert på dagens data",
    "...",
    "..."
  ]
}

Maks 3 actions. Hver why_facts: 1–3 punkt med konkrete tall/datoer/teknologier fra konteksten.
Action_keys: J=ring, M=e-post, V=vis CV, S=send CV, F=flytt til neste dag.
Placeholder_questions: 3 stk, korte, basert på dagens data ("Hvem trenger C++?", osv).
Returner BARE JSON, ingen annen tekst.`;

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
          { role: "user", content: JSON.stringify(compactContext) },
        ],
        max_tokens: 1200,
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      // Returner tom respons heller enn å feile UIet
      const fallback: BriefResponse = {
        actions: [],
        placeholder_questions: [
          "Hvem bør jeg ringe i dag?",
          "Hvilke konsulenter er ledige?",
          "Hva skjedde i markedet i går?",
        ],
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

    let parsed: BriefResponse;
    try {
      const obj = JSON.parse(text);
      parsed = {
        actions: Array.isArray(obj.actions) ? obj.actions.slice(0, 3) : [],
        placeholder_questions: Array.isArray(obj.placeholder_questions)
          ? obj.placeholder_questions.slice(0, 3)
          : [],
        generated_at: new Date().toISOString(),
      };
    } catch (e) {
      console.error("Parse error:", e, text);
      parsed = {
        actions: [],
        placeholder_questions: [
          "Hvem bør jeg ringe i dag?",
          "Hvilke konsulenter er ledige?",
          "Hva skjedde i markedet i går?",
        ],
        generated_at: new Date().toISOString(),
      };
    }

    cache.set(userId, { data: parsed, expires: Date.now() + CACHE_TTL_MS });

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("daily-brief error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Ukjent feil" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
