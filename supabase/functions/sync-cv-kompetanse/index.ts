import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ansatt_id } = await req.json();
    if (!ansatt_id) {
      return new Response(JSON.stringify({ error: "ansatt_id er påkrevd" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the CV document for this employee
    const { data: cvDoc, error: cvError } = await supabase
      .from("cv_documents")
      .select("competence_groups, projects, sidebar_sections")
      .eq("ansatt_id", ansatt_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cvError) throw cvError;
    if (!cvDoc) {
      return new Response(
        JSON.stringify({ error: "Ingen CV funnet for denne ansatte" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract unique competencies from CV data
    const tags = new Set<string>();

    // From competence_groups: array of { title, items: string[] }
    const groups = (cvDoc.competence_groups as any[]) || [];
    for (const g of groups) {
      if (Array.isArray(g.items)) {
        for (const item of g.items) {
          if (typeof item === "string" && item.trim()) tags.add(item.trim());
        }
      }
    }

    // From projects: extract technologies mentioned
    const projects = (cvDoc.projects as any[]) || [];
    for (const p of projects) {
      if (Array.isArray(p.technologies)) {
        for (const t of p.technologies) {
          if (typeof t === "string" && t.trim()) tags.add(t.trim());
        }
      }
      if (Array.isArray(p.tech)) {
        for (const t of p.tech) {
          if (typeof t === "string" && t.trim()) tags.add(t.trim());
        }
      }
    }

    // From sidebar_sections: look for technology/competence sections
    const sidebar = (cvDoc.sidebar_sections as any[]) || [];
    for (const s of sidebar) {
      if (Array.isArray(s.items)) {
        for (const item of s.items) {
          if (typeof item === "string" && item.trim()) tags.add(item.trim());
        }
      }
    }

    const kompetanse = Array.from(tags);

    // Update the employee record
    const { error: updateError } = await supabase
      .from("stacq_ansatte")
      .update({
        kompetanse,
        cv_profil_hentet: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ansatt_id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ count: kompetanse.length, kompetanse }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sync-cv-kompetanse error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Ukjent feil" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
