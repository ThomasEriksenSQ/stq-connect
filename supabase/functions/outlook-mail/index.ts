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

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function refreshTokenIfNeeded(
  supabase: any,
  tokenRow: { user_id: string; access_token: string; refresh_token: string; expires_at: string },
): Promise<string> {
  const expiresAt = new Date(tokenRow.expires_at);
  // Refresh if less than 5 minutes left
  if (expiresAt.getTime() - Date.now() > 5 * 60 * 1000) {
    return tokenRow.access_token;
  }

  const tokenRes = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: tokenRow.refresh_token,
      grant_type: "refresh_token",
      scope: "offline_access Mail.Read",
    }).toString(),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error("Token refresh failed: " + (tokenData.error_description || tokenData.error || "unknown"));
  }

  const newExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
  await supabase
    .from("outlook_tokens")
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || tokenRow.refresh_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", tokenRow.user_id);

  return tokenData.access_token;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth check
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

  // Parse request
  let body: { email: string; top?: number };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.email || typeof body.email !== "string") {
    return new Response(JSON.stringify({ error: "email is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const emailAddr = body.email.toLowerCase().trim();
  const top = Math.min(body.top || 20, 50);

  // Get ALL admin users' tokens and fetch from all connected accounts
  const { data: tokenRows, error: tokenError } = await supabase
    .from("outlook_tokens")
    .select("*");

  if (tokenError || !tokenRows || tokenRows.length === 0) {
    return new Response(JSON.stringify({ error: "no_outlook_connected", emails: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch emails from all connected accounts and merge
  const allEmails: any[] = [];

  for (const tokenRow of tokenRows) {
    try {
      const accessToken = await refreshTokenIfNeeded(supabase, tokenRow);

      // Build OData filter for emails involving the contact
      const filter = `from/emailAddress/address eq '${emailAddr}' or toRecipients/any(r: r/emailAddress/address eq '${emailAddr}')`;
      const graphUrl = `${GRAPH_BASE}/me/messages?$filter=${encodeURIComponent(filter)}&$top=${top}&$orderby=receivedDateTime desc&$select=id,subject,from,toRecipients,receivedDateTime,bodyPreview,body,isRead`;

      const graphRes = await fetch(graphUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!graphRes.ok) {
        const errText = await graphRes.text();
        console.error(`Graph API error for user ${tokenRow.user_id}:`, errText);
        continue;
      }

      const graphData = await graphRes.json();
      const messages = graphData.value || [];

      for (const msg of messages) {
        allEmails.push({
          id: msg.id,
          subject: msg.subject || "(ingen emne)",
          from: msg.from?.emailAddress?.address || "",
          from_name: msg.from?.emailAddress?.name || "",
          to: (msg.toRecipients || []).map((r: any) => r.emailAddress?.address || "").join(", "),
          date: msg.receivedDateTime,
          preview: msg.bodyPreview || "",
          body_text: msg.body?.contentType === "html" ? stripHtml(msg.body.content || "") : (msg.body?.content || ""),
          is_read: msg.isRead,
          account_user_id: tokenRow.user_id,
        });
      }
    } catch (err) {
      console.error(`Error fetching from account ${tokenRow.user_id}:`, err);
    }
  }

  // Sort by date descending and deduplicate by subject+date
  allEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Deduplicate: same email seen from multiple accounts
  const seen = new Set<string>();
  const dedupedEmails = allEmails.filter((e) => {
    const key = `${e.subject}|${e.date}|${e.from}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return new Response(JSON.stringify({ emails: dedupedEmails.slice(0, top) }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
