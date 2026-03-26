import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TECH_SECTION_KEYWORDS = [
  "kompet",
  "teknolog",
  "sprak",
  "språk",
  "rammeverk",
  "verktoy",
  "verktøy",
  "stack",
  "tools",
];

function normalizeTag(value: string) {
  const normalized = value
    .replace(/^[\s,;|•\-]+/, "")
    .replace(/[\s,;|•\-]+$/, "")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || null;
}

function splitTechText(value: string) {
  return value
    .split(/[\n,;|•]+/g)
    .map((part) => normalizeTag(part))
    .filter((part): part is string => Boolean(part));
}

function addTagsFromValue(tags: Set<string>, value: unknown) {
  if (typeof value === "string") {
    for (const part of splitTechText(value)) tags.add(part);
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) addTagsFromValue(tags, entry);
  }
}

function isTechSidebarSection(section: any) {
  const heading = typeof section?.heading === "string" ? section.heading.toLowerCase() : "";
  return TECH_SECTION_KEYWORDS.some((keyword) => heading.includes(keyword));
}

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

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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
      return new Response(JSON.stringify({ error: "Ingen CV funnet for denne ansatte" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract unique competencies from the structured CV fields
    const tags = new Set<string>();

    // From competence_groups: array of { label, content }
    const groups = (cvDoc.competence_groups as any[]) || [];
    for (const g of groups) {
      addTagsFromValue(tags, g?.content);
    }

    // From projects: technologies are stored as free text in the editor
    const projects = (cvDoc.projects as any[]) || [];
    for (const p of projects) {
      addTagsFromValue(tags, p?.technologies);
      addTagsFromValue(tags, p?.tech);
    }

    // From sidebar_sections: only include sections that look technology-related
    const sidebar = (cvDoc.sidebar_sections as any[]) || [];
    for (const s of sidebar) {
      if (!isTechSidebarSection(s)) continue;
      addTagsFromValue(tags, s?.items);
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

    return new Response(JSON.stringify({ count: kompetanse.length, kompetanse }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("sync-cv-kompetanse error:", err);
    return new Response(JSON.stringify({ error: err.message || "Ukjent feil" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
