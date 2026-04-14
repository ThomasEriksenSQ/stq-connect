import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CV_SHARE_VALID_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const LEGACY_CV_DOCUMENT_TITLE = "CV";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function badRequest(error: string) {
  return json({ error }, 400);
}

function unauthorized(error: string) {
  return json({ error }, 401);
}

function notFound(error: string) {
  return json({ error }, 404);
}

function buildPin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function buildToken() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

async function sha256Hex(value: string) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function buildSessionKey(token: string, pinHash: string) {
  return sha256Hex(`${token}:${pinHash}`);
}

function buildExpiryDate() {
  return new Date(Date.now() + CV_SHARE_VALID_DAYS * DAY_MS).toISOString();
}

function isExpired(expiresAt: string | null) {
  return Boolean(expiresAt && new Date(expiresAt).getTime() < Date.now());
}

function normalizeProjectsSectionTitle(value: unknown) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed || trimmed === LEGACY_CV_DOCUMENT_TITLE) return "";
  return trimmed;
}

function normalizeSnapshot(snapshot: Record<string, unknown>, updatedAt: string) {
  return {
    additional_sections: snapshot.additional_sections ?? [],
    competence_groups: snapshot.competence_groups ?? [],
    education: snapshot.education ?? [],
    hero_name: typeof snapshot.hero_name === "string" ? snapshot.hero_name : "",
    hero_title: typeof snapshot.hero_title === "string" ? snapshot.hero_title : "",
    intro_paragraphs: snapshot.intro_paragraphs ?? [],
    portrait_position: typeof snapshot.portrait_position === "string" ? snapshot.portrait_position : "50% 50%",
    portrait_url: typeof snapshot.portrait_url === "string" ? snapshot.portrait_url : null,
    projects: snapshot.projects ?? [],
    sidebar_sections: snapshot.sidebar_sections ?? [],
    title: normalizeProjectsSectionTitle(snapshot.title) || null,
    updated_at: updatedAt,
    work_experience: snapshot.work_experience ?? [],
  };
}

function createAuthClient(authHeader: string) {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
}

function createServiceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function requireAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) return null;

  const authClient = createAuthClient(authHeader);
  const { data, error } = await authClient.auth.getClaims(authHeader.replace("Bearer ", ""));

  if (error || !data?.claims?.sub) return null;

  return { authClient, id: data.claims.sub as string };
}

async function getTokenRow(serviceClient: ReturnType<typeof createServiceClient>, token: string) {
  const { data, error } = await serviceClient
    .from("cv_access_tokens")
    .select("ansatt_id, expires_at, pin_hash, token")
    .eq("token", token)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function requireValidToken(
  serviceClient: ReturnType<typeof createServiceClient>,
  token: string,
  sessionKey?: string,
) {
  const tokenRow = await getTokenRow(serviceClient, token);

  if (!tokenRow) return { errorResponse: notFound("Lenken finnes ikke lenger") };
  if (isExpired(tokenRow.expires_at)) return { errorResponse: unauthorized("Lenken har utløpt") };

  if (sessionKey) {
    const expectedSessionKey = await buildSessionKey(tokenRow.token, tokenRow.pin_hash);
    if (sessionKey !== expectedSessionKey) {
      return { errorResponse: unauthorized("Økten er ikke lenger gyldig. Tast inn PIN-koden på nytt.") };
    }
  }

  return { tokenRow };
}

async function loadCvPayload(
  serviceClient: ReturnType<typeof createServiceClient>,
  token: string,
  tokenRow: { ansatt_id: number; pin_hash: string; token: string },
) {
  const { data: cvRow, error: cvError } = await serviceClient
    .from("cv_documents")
    .select("*")
    .eq("ansatt_id", tokenRow.ansatt_id)
    .maybeSingle();

  if (cvError) throw cvError;
  if (!cvRow) return { errorResponse: notFound("CV ikke funnet") };

  const { data: ansattRow, error: ansattError } = await serviceClient
    .from("stacq_ansatte")
    .select("navn, bilde_url")
    .eq("id", tokenRow.ansatt_id)
    .maybeSingle();

  if (ansattError) throw ansattError;

  return {
    payload: {
      document: cvRow,
      employee_image_url: ansattRow?.bilde_url || null,
      session: {
        ansatt_id: tokenRow.ansatt_id,
        ansatt_name: ansattRow?.navn || "Ansatt",
        cv_id: cvRow.id,
        session_key: await buildSessionKey(token, tokenRow.pin_hash),
        token,
      },
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = typeof body?.action === "string" ? body.action : "";
    const serviceClient = createServiceClient();

    if (action === "issue") {
      const authUser = await requireAuthenticatedUser(req);
      if (!authUser) return unauthorized("Du må være logget inn for å dele lenken");

      const ansattId = Number(body?.ansatt_id);
      if (!Number.isInteger(ansattId) || ansattId <= 0) {
        return badRequest("ansatt_id er påkrevd");
      }

      const { data: ansatt, error: ansattError } = await authUser.authClient
        .from("stacq_ansatte")
        .select("id")
        .eq("id", ansattId)
        .maybeSingle();

      if (ansattError || !ansatt) {
        return unauthorized("Du har ikke tilgang til å dele denne lenken");
      }

      const pin = buildPin();
      const token = buildToken();
      const pinHash = await sha256Hex(pin);
      const expiresAt = buildExpiryDate();
      const createdAt = new Date().toISOString();

      const { error: cleanupError } = await serviceClient
        .from("cv_access_tokens")
        .delete()
        .eq("ansatt_id", ansattId)
        .lt("expires_at", createdAt);

      if (cleanupError) throw cleanupError;

      const { error } = await serviceClient.from("cv_access_tokens").insert({
        ansatt_id: ansattId,
        created_at: createdAt,
        expires_at: expiresAt,
        pin_hash: pinHash,
        token,
      });

      if (error) throw error;

      return json({
        expires_at: expiresAt,
        pin,
        token,
        valid_days: CV_SHARE_VALID_DAYS,
      });
    }

    if (action === "verify") {
      const token = typeof body?.token === "string" ? body.token : "";
      const pin = typeof body?.pin === "string" ? body.pin : "";

      if (!token) return badRequest("Token mangler");
      if (!/^\d{4}$/.test(pin)) return badRequest("PIN-koden må være fire siffer");

      const { tokenRow, errorResponse } = await requireValidToken(serviceClient, token);
      if (errorResponse) return errorResponse;

      const pinHash = await sha256Hex(pin);
      if (pinHash !== tokenRow.pin_hash) return unauthorized("Feil PIN-kode");

      const result = await loadCvPayload(serviceClient, token, tokenRow);
      if (result.errorResponse) return result.errorResponse;
      return json(result.payload);
    }

    if (action === "load") {
      const token = typeof body?.token === "string" ? body.token : "";
      const sessionKey = typeof body?.session_key === "string" ? body.session_key : "";

      if (!token) return badRequest("Token mangler");
      if (!sessionKey) return unauthorized("Økten er ikke lenger gyldig. Tast inn PIN-koden på nytt.");

      const { tokenRow, errorResponse } = await requireValidToken(serviceClient, token, sessionKey);
      if (errorResponse) return errorResponse;

      const result = await loadCvPayload(serviceClient, token, tokenRow);
      if (result.errorResponse) return result.errorResponse;
      return json(result.payload);
    }

    if (action === "save") {
      const token = typeof body?.token === "string" ? body.token : "";
      const sessionKey = typeof body?.session_key === "string" ? body.session_key : "";
      const cvId = typeof body?.cv_id === "string" ? body.cv_id : "";
      const savedBy = typeof body?.saved_by === "string" ? body.saved_by : "Ansatt";
      const snapshot = body?.snapshot;

      if (!token) return badRequest("Token mangler");
      if (!sessionKey) return unauthorized("Økten er ikke lenger gyldig. Tast inn PIN-koden på nytt.");
      if (!cvId) return badRequest("cv_id er påkrevd");
      if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
        return badRequest("Snapshot mangler");
      }

      const { tokenRow, errorResponse } = await requireValidToken(serviceClient, token, sessionKey);
      if (errorResponse) return errorResponse;

      const savedAt = new Date().toISOString();
      const normalizedSnapshot = normalizeSnapshot(snapshot as Record<string, unknown>, savedAt);

      const { data: updatedRow, error: updateError } = await serviceClient
        .from("cv_documents")
        .update(normalizedSnapshot)
        .eq("id", cvId)
        .eq("ansatt_id", tokenRow.ansatt_id)
        .select("id, updated_at")
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updatedRow) return notFound("CV ikke funnet");

      const { error: versionError } = await serviceClient.from("cv_versions").insert({
        created_at: savedAt,
        cv_id: cvId,
        saved_by: savedBy,
        snapshot: normalizedSnapshot,
        source: "ansatt",
      });

      if (versionError) throw versionError;

      return json({ updated_at: updatedRow.updated_at || savedAt });
    }

    if (action === "versions") {
      const token = typeof body?.token === "string" ? body.token : "";
      const sessionKey = typeof body?.session_key === "string" ? body.session_key : "";
      const cvId = typeof body?.cv_id === "string" ? body.cv_id : "";

      if (!token) return badRequest("Token mangler");
      if (!sessionKey) return unauthorized("Økten er ikke lenger gyldig. Tast inn PIN-koden på nytt.");
      if (!cvId) return badRequest("cv_id er påkrevd");

      const { tokenRow, errorResponse } = await requireValidToken(serviceClient, token, sessionKey);
      if (errorResponse) return errorResponse;

      const { data: cvRow, error: cvError } = await serviceClient
        .from("cv_documents")
        .select("id")
        .eq("id", cvId)
        .eq("ansatt_id", tokenRow.ansatt_id)
        .maybeSingle();

      if (cvError) throw cvError;
      if (!cvRow) return notFound("CV ikke funnet");

      const { data: versions, error: versionsError } = await serviceClient
        .from("cv_versions")
        .select("*")
        .eq("cv_id", cvId)
        .order("created_at", { ascending: false });

      if (versionsError) throw versionsError;

      return json({ versions: versions || [] });
    }

    return badRequest("Ukjent handling");
  } catch (error) {
    console.error("cv-access error:", error);
    return json({ error: error instanceof Error ? error.message : "Ukjent feil" }, 500);
  }
});
