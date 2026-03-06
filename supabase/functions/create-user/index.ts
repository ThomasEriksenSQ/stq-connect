import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { email, password, full_name, phone } = await req.json();

  // Create auth user
  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (createError) {
    return new Response(JSON.stringify({ error: createError.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = userData.user.id;

  // Update profile with phone and full_name
  await supabase.from("profiles").update({ full_name, phone }).eq("id", userId);

  // Add admin role
  await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });

  return new Response(JSON.stringify({ user_id: userId }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
