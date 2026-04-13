import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Minimal MD5 implementation for subscriber hash
function md5(input: string): string {
  const k = new Uint32Array([
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a,
    0xa8304613, 0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
    0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340,
    0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8,
    0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
    0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa,
    0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92,
    0xffeff47d, 0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
    0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
  ]);
  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23,
    4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15,
    21, 6, 10, 15, 21,
  ];

  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const padLen =
    bytes.length % 64 < 56 ? 56 - (bytes.length % 64) : 120 - (bytes.length % 64);
  const padded = new Uint8Array(bytes.length + padLen + 8);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, bitLen >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(bitLen / 0x100000000), true);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;

  for (let i = 0; i < padded.length; i += 64) {
    const m = new Uint32Array(16);
    for (let j = 0; j < 16; j++) {
      m[j] = view.getUint32(i + j * 4, true);
    }
    let a = h0, b = h1, c = h2, d = h3;
    for (let j = 0; j < 64; j++) {
      let f: number, g: number;
      if (j < 16) { f = (b & c) | (~b & d); g = j; }
      else if (j < 32) { f = (d & b) | (~d & c); g = (5 * j + 1) % 16; }
      else if (j < 48) { f = b ^ c ^ d; g = (3 * j + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * j) % 16; }
      const temp = d;
      d = c;
      c = b;
      const x = (a + f + k[j] + m[g]) >>> 0;
      b = (b + ((x << s[j]) | (x >>> (32 - s[j])))) >>> 0;
      a = temp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
  }

  const hex = (n: number) =>
    [0, 8, 16, 24].map((s) => ((n >>> s) & 0xff).toString(16).padStart(2, "0")).join("");
  return hex(h0) + hex(h1) + hex(h2) + hex(h3);
}

// Owner ID → name mapping
const OWNER_MAP: Record<string, string> = {};

async function getOwnerName(
  supabaseAdmin: ReturnType<typeof createClient>,
  ownerId: string | null,
): Promise<string> {
  if (!ownerId) return "";
  if (OWNER_MAP[ownerId]) return OWNER_MAP[ownerId];
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", ownerId)
    .single();
  const name = data?.full_name || "";
  OWNER_MAP[ownerId] = name;
  return name;
}

interface McConfig {
  apiKey: string;
  audienceId: string;
  dc: string;
}

function getMcConfig(): McConfig {
  const apiKey = Deno.env.get("MAILCHIMP_API_KEY") || "";
  const audienceId = Deno.env.get("MAILCHIMP_AUDIENCE_ID") || "";
  const dc = apiKey.split("-").pop() || "us1";
  return { apiKey, audienceId, dc };
}

async function mcFetch(
  mc: McConfig,
  path: string,
  method: string,
  body?: unknown,
) {
  const url = `https://${mc.dc}.api.mailchimp.com/3.0${path}`;
  const headers: Record<string, string> = {
    Authorization: `Basic ${btoa(`anystring:${mc.apiKey}`)}`,
    "Content-Type": "application/json",
  };
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

// Map company status to Mailchimp ACCT_TYPE
function mapAccountType(status: string | null): string {
  const map: Record<string, string> = {
    customer: "Kunde",
    partner: "Partner",
    prospect: "Potensiell kunde",
    lead: "Lead",
  };
  return map[status || ""] || status || "";
}

async function syncContactToMailchimp(
  supabaseAdmin: ReturnType<typeof createClient>,
  contactId: string,
) {
  const mc = getMcConfig();
  if (!mc.apiKey || !mc.audienceId) {
    throw new Error("Mailchimp API-nøkkel eller Audience ID mangler");
  }

  const { data: contact, error } = await supabaseAdmin
    .from("contacts")
    .select("*, companies(name, status)")
    .eq("id", contactId)
    .single();
  if (error || !contact) throw new Error("Kontakt ikke funnet");
  if (!contact.email) throw new Error("Kontakt mangler e-post");

  const ownerName = await getOwnerName(supabaseAdmin, contact.owner_id);
  const subscriberHash = md5(contact.email.trim().toLowerCase());

  const mergeFields: Record<string, string> = {
    FNAME: contact.first_name || "",
    LNAME: contact.last_name || "",
    PHONE: contact.phone || "",
    TITLE: contact.title || "",
    COMPANY: (contact as any).companies?.name || "",
    OWNER: ownerName,
    ACCT_TYPE: mapAccountType((contact as any).companies?.status || null),
    MMERGE13: contact.cv_email ? "TRUE" : "FALSE",
  };

  const putBody: Record<string, unknown> = {
    email_address: contact.email.trim().toLowerCase(),
    status_if_new: contact.cv_email ? "subscribed" : "unsubscribed",
    status: contact.cv_email ? "subscribed" : "unsubscribed",
    merge_fields: mergeFields,
  };

  const res = await mcFetch(
    mc,
    `/lists/${mc.audienceId}/members/${subscriberHash}`,
    "PUT",
    putBody,
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Mailchimp feil: ${res.status} ${(err as any).detail || ""}`,
    );
  }

  // Read actual status from Mailchimp response (handles compliance unsubscribes)
  const mcResult = await res.json();
  const actualStatus = mcResult.status || (contact.cv_email ? "subscribed" : "unsubscribed");
  await supabaseAdmin
    .from("contacts")
    .update({ mailchimp_status: actualStatus })
    .eq("id", contactId);

  return { email: contact.email, status: actualStatus };
}

async function syncAllToMailchimp(
  supabaseAdmin: ReturnType<typeof createClient>,
) {
  const mc = getMcConfig();
  if (!mc.apiKey || !mc.audienceId) {
    throw new Error("Mailchimp API-nøkkel eller Audience ID mangler");
  }

  // Fetch contacts with cv_email = true
  const { data: activeContacts, error: err1 } = await supabaseAdmin
    .from("contacts")
    .select("id, first_name, last_name, email, phone, title, owner_id, cv_email, companies(name, status)")
    .eq("cv_email", true)
    .not("email", "is", null);
  if (err1) throw err1;

  // Fetch contacts with cv_email = false that have email (to update MMERGE13=FALSE)
  const { data: inactiveContacts, error: err2 } = await supabaseAdmin
    .from("contacts")
    .select("id, first_name, last_name, email, phone, title, owner_id, cv_email, companies(name, status)")
    .eq("cv_email", false)
    .not("email", "is", null);
  if (err2) throw err2;

  const allContacts = [
    ...(activeContacts || []),
    ...(inactiveContacts || []),
  ];

  if (allContacts.length === 0) {
    return { total: 0, batches: 0, message: "Ingen kontakter å synkronisere" };
  }

  // Build batch operations
  const operations = [];
  for (const contact of allContacts) {
    const ownerName = await getOwnerName(supabaseAdmin, contact.owner_id);
    const subscriberHash = md5(contact.email!.trim().toLowerCase());
    const isActive = contact.cv_email;
    operations.push({
      method: "PUT",
      path: `/lists/${mc.audienceId}/members/${subscriberHash}`,
      body: JSON.stringify({
        email_address: contact.email!.trim().toLowerCase(),
        status_if_new: isActive ? "subscribed" : "unsubscribed",
        status: isActive ? "subscribed" : "unsubscribed",
        merge_fields: {
          FNAME: contact.first_name || "",
          LNAME: contact.last_name || "",
          PHONE: contact.phone || "",
          TITLE: contact.title || "",
          COMPANY: (contact as any).companies?.name || "",
          OWNER: ownerName,
          ACCT_TYPE: mapAccountType((contact as any).companies?.status || null),
          MMERGE13: isActive ? "TRUE" : "FALSE",
        },
      }),
    });
  }

  // Send in chunks of 500 (Mailchimp batch limit)
  const batchIds: string[] = [];
  for (let i = 0; i < operations.length; i += 500) {
    const chunk = operations.slice(i, i + 500);
    const res = await mcFetch(mc, "/batches", "POST", { operations: chunk });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Mailchimp batch feil: ${res.status} ${(err as any).detail || ""}`);
    }
    const result = await res.json();
    batchIds.push(result.id);
  }

  // Update mailchimp_status for all synced contacts
  const activeIds = (activeContacts || []).map(c => c.id);
  const inactiveIds = (inactiveContacts || []).map(c => c.id);

  if (activeIds.length > 0) {
    await supabaseAdmin
      .from("contacts")
      .update({ mailchimp_status: "subscribed" })
      .in("id", activeIds);
  }
  if (inactiveIds.length > 0) {
    await supabaseAdmin
      .from("contacts")
      .update({ mailchimp_status: "unsubscribed" })
      .in("id", inactiveIds);
  }

  return {
    total: allContacts.length,
    active: activeIds.length,
    inactive: inactiveIds.length,
    batches: batchIds.length,
    batchIds,
    message: `${allContacts.length} kontakter sendt til Mailchimp (${activeIds.length} aktive, ${inactiveIds.length} inaktive) i ${batchIds.length} batch(er).`,
  };
}

async function handleWebhook(req: Request, supabaseAdmin: ReturnType<typeof createClient>) {
  // Mailchimp sends GET for verification — respond 200
  if (req.method === "GET") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  // POST — parse body. Mailchimp sends application/x-www-form-urlencoded
  let type = "";
  let email = "";

  try {
    const rawBody = await req.text();
    console.log("Mailchimp webhook raw body:", rawBody);
    const params = new URLSearchParams(rawBody);
    type = params.get("type") || "";
    email = (params.get("data[email]") || "").trim().toLowerCase();
  } catch (e) {
    console.error("Failed to parse webhook body:", e);
    return json({ ok: true });
  }

  console.log(`Mailchimp webhook: type=${type}, email=${email}`);

  if (!email) return json({ ok: true });

  if (type === "unsubscribe" || type === "cleaned") {
    const mcStatus = type === "cleaned" ? "cleaned" : "unsubscribed";
    const { data: contacts } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .ilike("email", email);

    if (contacts && contacts.length > 0) {
      for (const c of contacts) {
        await supabaseAdmin
          .from("contacts")
          .update({ cv_email: false, mailchimp_status: mcStatus })
          .eq("id", c.id);
      }
      console.log(`Set cv_email=false, mailchimp_status=${mcStatus} for ${contacts.length} contacts with email ${email}`);
    }
  }

  if (type === "subscribe") {
    const { data: contacts } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .ilike("email", email);

    if (contacts && contacts.length > 0) {
      for (const c of contacts) {
        await supabaseAdmin
          .from("contacts")
          .update({ mailchimp_status: "subscribed" })
          .eq("id", c.id);
      }
    }
  }

  return json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const requestBody = req.method === "GET" || req.method === "HEAD"
      ? null
      : await req.clone().json().catch(() => null);
    const actionFromBody = requestBody && typeof requestBody === "object" && "action" in requestBody
      ? String((requestBody as { action?: unknown }).action || "")
      : "";
    const action = url.searchParams.get("action") || actionFromBody;
    console.log(`mailchimp-sync action=${action}, contactId=${requestBody?.contactId || "N/A"}`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Webhook — no auth needed
    if (action === "webhook") {
      return await handleWebhook(req, supabaseAdmin);
    }

    // Other actions require auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    if (action === "sync-contact") {
      const contactId = requestBody && typeof requestBody === "object"
        ? (requestBody as { contactId?: string }).contactId
        : undefined;
      if (!contactId) return json({ error: "contactId required" }, 400);
      const result = await syncContactToMailchimp(supabaseAdmin, contactId);
      return json(result);
    }

    if (action === "sync-all") {
      const result = await syncAllToMailchimp(supabaseAdmin);
      return json(result);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("mailchimp-sync error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
