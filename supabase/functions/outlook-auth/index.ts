import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CLIENT_ID = Deno.env.get("AZURE_CLIENT_ID")!;
const TENANT_ID = Deno.env.get("AZURE_TENANT_ID")!;
const CLIENT_SECRET = Deno.env.get("AZURE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/outlook-auth?action=callback`;
const SCOPES = "offline_access Mail.Read";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // --- LOGIN: generate Microsoft OAuth URL ---
  if (action === "login") {
    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: hasRole } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!hasRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const state = btoa(JSON.stringify({ user_id: user.id }));
    const authUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?` +
      new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: "code",
        redirect_uri: REDIRECT_URI,
        scope: SCOPES,
        state,
        response_mode: "query",
        prompt: "consent",
      }).toString();

    return new Response(JSON.stringify({ url: authUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- CALLBACK: exchange code for tokens ---
  if (action === "callback") {
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    if (errorParam) {
      return new Response(`<html><body><h2>Feil: ${errorParam}</h2><p>${url.searchParams.get("error_description") || ""}</p></body></html>`, {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    if (!code || !stateParam) {
      return new Response(`<html><body><h2>Mangler code eller state</h2></body></html>`, {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    let userId: string;
    try {
      const parsed = JSON.parse(atob(stateParam));
      userId = parsed.user_id;
    } catch {
      return new Response(`<html><body><h2>Ugyldig state</h2></body></html>`, {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Exchange code for tokens
    const tokenRes = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
        scope: SCOPES,
      }).toString(),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      return new Response(`<html><body><h2>Token-utveksling feilet</h2><pre>${JSON.stringify(tokenData, null, 2)}</pre></body></html>`, {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Store tokens in DB
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

    const { error: upsertError } = await supabase
      .from("outlook_tokens")
      .upsert({
        user_id: userId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertError) {
      return new Response(`<html><body><h2>Kunne ikke lagre token</h2><pre>${upsertError.message}</pre></body></html>`, {
        status: 500,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Redirect back to CRM
    const returnUrl = Deno.env.get("OUTLOOK_RETURN_URL") || "https://stq-connect.lovable.app";
    return new Response(null, {
      status: 302,
      headers: {
        Location: returnUrl,
      },
    });
  }

  // --- STATUS: check if current user has connected Outlook ---
  if (action === "status") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ connected: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ connected: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data } = await supabase
      .from("outlook_tokens")
      .select("id, expires_at")
      .eq("user_id", user.id)
      .maybeSingle();

    return new Response(JSON.stringify({ connected: !!data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
