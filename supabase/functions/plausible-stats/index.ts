import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLAUSIBLE_API = "https://plausible.io/api/v2/query";
const SITE_ID = "stacq.no";

const ALLOWED_QUERY_TYPES = ["aggregate", "timeseries", "top_pages", "top_sources", "top_countries", "devices"];
const ALLOWED_DATE_RANGES = ["7d", "30d", "6mo", "12mo", "all"];

function buildQuery(queryType: string, dateRange: string) {
  const base = { site_id: SITE_ID, date_range: dateRange };

  switch (queryType) {
    case "aggregate":
      return { ...base, metrics: ["visitors", "visits", "pageviews", "bounce_rate", "visit_duration"] };
    case "timeseries":
      return { ...base, metrics: ["visitors", "pageviews"], dimensions: ["time:day"] };
    case "top_pages":
      return { ...base, metrics: ["visitors", "pageviews"], dimensions: ["event:page"], order_by: [["visitors", "desc"]] };
    case "top_sources":
      return { ...base, metrics: ["visitors"], dimensions: ["visit:source"], order_by: [["visitors", "desc"]] };
    case "top_countries":
      return { ...base, metrics: ["visitors"], dimensions: ["visit:country_name"], order_by: [["visitors", "desc"]] };
    case "devices":
      return { ...base, metrics: ["visitors"], dimensions: ["visit:device"], order_by: [["visitors", "desc"]] };
    default:
      return base;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json();
    const { query_type, date_range } = body;

    if (!ALLOWED_QUERY_TYPES.includes(query_type)) {
      return new Response(JSON.stringify({ error: "Invalid query_type" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!ALLOWED_DATE_RANGES.includes(date_range)) {
      return new Response(JSON.stringify({ error: "Invalid date_range" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("PLAUSIBLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "PLAUSIBLE_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const query = buildQuery(query_type, date_range);

    const response = await fetch(PLAUSIBLE_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(query),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: data.error || "Plausible API error", status: response.status }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
