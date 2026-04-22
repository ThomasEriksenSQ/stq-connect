import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  getExternalRecipientEmails,
  matchSentCvEmployees,
  normalizeEmailAddress,
} from "../../../src/lib/sentCvMatching.ts";

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
const INTERNAL_DOMAINS = ["stacq.no"];
const DEFAULT_INITIAL_LOOKBACK_DAYS = 120;
const DEFAULT_MAX_MESSAGES_PER_MAILBOX = 400;
const DEFAULT_LIVE_LOOKBACK_HOURS = 72;
const DEFAULT_LIVE_MAX_MESSAGES_PER_MAILBOX = 120;
const LIVE_SYNC_MIN_INTERVAL_MINUTES = 3;
const LIVE_SYNC_OVERLAP_MINUTES = 30;
const PAGE_SIZE = 50;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

type OutlookTokenRow = {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
};

type SyncStateRow = {
  user_id: string;
  last_synced_at: string | null;
  last_scan_started_at: string | null;
};

type ContactRow = {
  id: string;
  email: string | null;
  first_name: string;
  last_name: string;
  title: string | null;
  company_id: string | null;
};

type CompanyRow = {
  id: string;
  name: string;
};

type EmployeeRow = {
  id: number;
  navn: string;
};

type CvDocumentRow = {
  ansatt_id: number;
  hero_name: string | null;
};

type SentMessage = {
  id: string;
  subject: string;
  bodyPreview: string;
  bodyText: string;
  sentAt: string;
  webLink: string | null;
  senderEmail: string;
  externalRecipients: string[];
};

function parseJwtPayload(token: string) {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
    return JSON.parse(atob(`${normalized}${padding}`)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return "Ukjent feil";
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<(hr)\s*\/?>/gi, "\n---\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n /g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isPdfAttachment(attachment: Record<string, unknown>) {
  const name = String(attachment.name || "").trim().toLowerCase();
  const contentType = String(attachment.contentType || "").trim().toLowerCase();
  const isInline = Boolean(attachment.isInline);
  if (isInline) return false;
  return name.endsWith(".pdf") || contentType === "application/pdf";
}

function getContactDisplayName(contact: ContactRow) {
  return `${contact.first_name} ${contact.last_name}`.trim() || null;
}

function parseIsoDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function refreshTokenIfNeeded(supabase: ReturnType<typeof createClient>, tokenRow: OutlookTokenRow) {
  const expiresAt = new Date(tokenRow.expires_at);
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
      scope: "offline_access Mail.Read Calendars.ReadWrite",
    }).toString(),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(`Token refresh failed: ${tokenData.error_description || tokenData.error || "unknown"}`);
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

  return tokenData.access_token as string;
}

async function fetchSentMessagesForMailbox(accessToken: string, sinceIso: string, maxMessages: number) {
  const messages: SentMessage[] = [];
  let requestUrl =
    `${GRAPH_BASE}/me/mailFolders/sentitems/messages` +
    `?$top=${PAGE_SIZE}` +
    `&$orderby=sentDateTime desc` +
    `&$select=id,subject,bodyPreview,body,toRecipients,ccRecipients,bccRecipients,sentDateTime,hasAttachments,webLink,from`;
  let shouldStop = false;

  while (requestUrl && messages.length < maxMessages && !shouldStop) {
    const response = await fetch(requestUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'IdType="ImmutableId"',
      },
    });

    if (!response.ok) {
      throw new Error(`Graph sent-items fetch failed: ${response.status} ${await response.text()}`);
    }

    const payload = await response.json();
    const rows = Array.isArray(payload.value) ? payload.value : [];

    for (const row of rows) {
      const sentAt = String(row.sentDateTime || "");
      if (!sentAt) continue;

      const sentAtTime = new Date(sentAt).getTime();
      if (Number.isNaN(sentAtTime)) continue;

      if (sentAtTime < new Date(sinceIso).getTime()) {
        shouldStop = true;
        break;
      }

      if (!row.hasAttachments) continue;

      const externalRecipients = getExternalRecipientEmails(
        [
          ...((row.toRecipients || []) as Array<{ emailAddress?: { address?: string } }>).map(
            (recipient) => recipient.emailAddress?.address || "",
          ),
          ...((row.ccRecipients || []) as Array<{ emailAddress?: { address?: string } }>).map(
            (recipient) => recipient.emailAddress?.address || "",
          ),
          ...((row.bccRecipients || []) as Array<{ emailAddress?: { address?: string } }>).map(
            (recipient) => recipient.emailAddress?.address || "",
          ),
        ],
        INTERNAL_DOMAINS,
      );

      if (externalRecipients.length === 0) continue;

      messages.push({
        id: String(row.id || ""),
        subject: String(row.subject || "(uten emne)"),
        bodyPreview: String(row.bodyPreview || ""),
        bodyText:
          row.body?.contentType === "html"
            ? stripHtml(String(row.body?.content || ""))
            : String(row.body?.content || ""),
        sentAt,
        webLink: row.webLink ? String(row.webLink) : null,
        senderEmail: normalizeEmailAddress(row.from?.emailAddress?.address || ""),
        externalRecipients,
      });
    }

    requestUrl = shouldStop ? "" : String(payload["@odata.nextLink"] || "");
  }

  return messages;
}

async function fetchPdfAttachmentNames(accessToken: string, messageId: string) {
  const response = await fetch(
    `${GRAPH_BASE}/me/messages/${encodeURIComponent(messageId)}/attachments?$select=id,name,contentType,isInline`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'IdType="ImmutableId"',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Graph attachments fetch failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const rows = Array.isArray(payload.value) ? payload.value : [];
  return rows
    .filter((attachment) => attachment && typeof attachment === "object" && isPdfAttachment(attachment as Record<string, unknown>))
    .map((attachment) => String((attachment as Record<string, unknown>).name || "").trim())
    .filter(Boolean);
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

  let body: { trigger?: string; lookbackDays?: number; maxMessagesPerMailbox?: number } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const authHeader = req.headers.get("Authorization") || "";
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  const jwtPayload = bearerToken ? parseJwtPayload(bearerToken) : null;
  const jwtRole = typeof jwtPayload?.role === "string" ? jwtPayload.role : null;
  let isAdminRequest = false;
  const isLiveRequest = body.trigger === "live";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (jwtRole === "authenticated") {
    const { data: authData, error: authError } = await supabase.auth.getUser(bearerToken);
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: hasRole } = await supabase.rpc("has_role", {
      _user_id: authData.user.id,
      _role: "admin",
    });
    if (!hasRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    isAdminRequest = true;
  } else if (jwtRole === "anon") {
    if (body.trigger !== "cron") {
      return new Response(JSON.stringify({ error: "Cron trigger required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } else {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const lookbackDays = isAdminRequest
    ? Math.min(Math.max(body.lookbackDays || DEFAULT_INITIAL_LOOKBACK_DAYS, 1), 365)
    : DEFAULT_INITIAL_LOOKBACK_DAYS;
  const defaultMaxMessagesPerMailbox = isLiveRequest
    ? DEFAULT_LIVE_MAX_MESSAGES_PER_MAILBOX
    : DEFAULT_MAX_MESSAGES_PER_MAILBOX;
  const maxMessagesPerMailbox = isAdminRequest
    ? Math.min(Math.max(body.maxMessagesPerMailbox || defaultMaxMessagesPerMailbox, 20), 1000)
    : DEFAULT_MAX_MESSAGES_PER_MAILBOX;
  const runStartedAt = new Date().toISOString();

  try {
    const [
      { data: tokenRows, error: tokenError },
      { data: syncStates, error: syncStateError },
      { data: contacts, error: contactsError },
      { data: companies, error: companiesError },
      { data: employees, error: employeesError },
      { data: cvDocuments, error: cvDocumentsError },
    ] = await Promise.all([
      supabase.from("outlook_tokens").select("user_id, access_token, refresh_token, expires_at"),
      supabase.from("outlook_sent_cv_sync_state").select("user_id, last_synced_at, last_scan_started_at"),
      supabase
        .from("contacts")
        .select("id, email, first_name, last_name, title, company_id")
        .not("email", "is", null),
      supabase.from("companies").select("id, name"),
      supabase.from("stacq_ansatte").select("id, navn"),
      supabase.from("cv_documents").select("ansatt_id, hero_name"),
    ]);

    if (tokenError) throw tokenError;
    if (syncStateError) throw syncStateError;
    if (contactsError) throw contactsError;
    if (companiesError) throw companiesError;
    if (employeesError) throw employeesError;
    if (cvDocumentsError) throw cvDocumentsError;

    const contactMap = new Map<string, ContactRow>();
    (contacts as ContactRow[]).forEach((contact) => {
      const email = normalizeEmailAddress(contact.email);
      if (email && !contactMap.has(email)) {
        contactMap.set(email, contact);
      }
    });

    const companyMap = new Map<string, CompanyRow>();
    (companies as CompanyRow[]).forEach((company) => {
      companyMap.set(company.id, company);
    });

    const heroNameByEmployeeId = new Map<number, string>();
    (cvDocuments as CvDocumentRow[]).forEach((cvDocument) => {
      if (!heroNameByEmployeeId.has(cvDocument.ansatt_id) && cvDocument.hero_name?.trim()) {
        heroNameByEmployeeId.set(cvDocument.ansatt_id, cvDocument.hero_name.trim());
      }
    });

    const employeeCandidates = (employees as EmployeeRow[]).map((employee) => ({
      id: employee.id,
      navn: employee.navn,
      heroName: heroNameByEmployeeId.get(employee.id) || null,
    }));

    const syncStateMap = new Map<string, SyncStateRow>();
    (syncStates as SyncStateRow[]).forEach((state) => {
      syncStateMap.set(state.user_id, state);
    });

    const accountSummaries: Array<{
      user_id: string;
      scanned_messages: number;
      matched_rows: number;
      status: "ok" | "error" | "skipped";
      error?: string;
    }> = [];

    let totalScannedMessages = 0;
    let totalMatchedRows = 0;
    let scannedAccounts = 0;
    let skippedAccounts = 0;

    for (const tokenRow of (tokenRows || []) as OutlookTokenRow[]) {
      let matchedRowsForAccount = 0;
      try {
        const syncState = syncStateMap.get(tokenRow.user_id);
        const previousSync = parseIsoDate(syncState?.last_synced_at);
        const lastScanStartedAt = parseIsoDate(syncState?.last_scan_started_at);

        if (
          isLiveRequest &&
          lastScanStartedAt &&
          Date.now() - lastScanStartedAt.getTime() < LIVE_SYNC_MIN_INTERVAL_MINUTES * MINUTE_MS
        ) {
          skippedAccounts += 1;
          accountSummaries.push({
            user_id: tokenRow.user_id,
            scanned_messages: 0,
            matched_rows: 0,
            status: "skipped",
          });
          continue;
        }

        await supabase.from("outlook_sent_cv_sync_state").upsert({
          user_id: tokenRow.user_id,
          last_scan_started_at: runStartedAt,
          last_error: null,
          updated_at: runStartedAt,
        });

        const accessToken = await refreshTokenIfNeeded(supabase, tokenRow);
        const defaultLookbackStart = isLiveRequest
          ? new Date(Date.now() - DEFAULT_LIVE_LOOKBACK_HOURS * HOUR_MS)
          : new Date(Date.now() - lookbackDays * DAY_MS);
        const overlapMs = isLiveRequest ? LIVE_SYNC_OVERLAP_MINUTES * MINUTE_MS : 12 * HOUR_MS;
        const incrementalSyncStart = previousSync
          ? new Date(Math.max(previousSync.getTime() - overlapMs, defaultLookbackStart.getTime()))
          : defaultLookbackStart;
        const sinceIso =
          isAdminRequest && body.trigger === "manual"
            ? new Date(Date.now() - lookbackDays * DAY_MS).toISOString()
            : previousSync
              ? incrementalSyncStart.toISOString()
              : defaultLookbackStart.toISOString();

        const sentMessages = await fetchSentMessagesForMailbox(accessToken, sinceIso, maxMessagesPerMailbox);
        totalScannedMessages += sentMessages.length;
        scannedAccounts += 1;

        const rowsToUpsert: Array<Record<string, unknown>> = [];

        for (const message of sentMessages) {
          const attachmentNames = await fetchPdfAttachmentNames(accessToken, message.id);
          if (attachmentNames.length === 0) continue;

          const employeeMatches = matchSentCvEmployees({
            attachmentNames,
            subject: message.subject,
            bodyPreview: message.bodyPreview,
            employees: employeeCandidates,
          });
          if (employeeMatches.length === 0) continue;

          const matchedContacts = Array.from(
            new Set(
              message.externalRecipients
                .map((recipientEmail) => normalizeEmailAddress(recipientEmail))
                .filter((recipientEmail) => contactMap.has(recipientEmail)),
            ),
          );
          if (matchedContacts.length === 0) continue;

          employeeMatches.forEach((employeeMatch) => {
            matchedContacts.forEach((recipientEmail) => {
              const contact = contactMap.get(recipientEmail);
              if (!contact) return;

              const company = contact.company_id ? companyMap.get(contact.company_id) : null;
              rowsToUpsert.push({
                ansatt_id: employeeMatch.employeeId,
                contact_id: contact.id,
                company_id: contact.company_id,
                sender_user_id: tokenRow.user_id,
                sender_email: message.senderEmail || "",
                recipient_email: recipientEmail,
                message_id: message.id,
                message_web_link: message.webLink,
                message_subject: message.subject,
                message_preview: message.bodyPreview,
                message_body_text: message.bodyText || null,
                attachment_name: employeeMatch.attachmentName,
                contact_name_snapshot: getContactDisplayName(contact),
                company_name_snapshot: company?.name || null,
                contact_title_snapshot: contact.title || null,
                sent_at: message.sentAt,
                employee_match_score: employeeMatch.score,
                employee_match_basis: employeeMatch.matchedBy,
                updated_at: runStartedAt,
              });
            });
          });
        }

        if (rowsToUpsert.length > 0) {
          const { error: upsertError } = await supabase.from("sent_cv_log").upsert(rowsToUpsert, {
            onConflict: "sender_email,message_id,ansatt_id,recipient_email,attachment_name",
          });
          if (upsertError) throw upsertError;
          matchedRowsForAccount = rowsToUpsert.length;
          totalMatchedRows += rowsToUpsert.length;
        }

        await supabase.from("outlook_sent_cv_sync_state").upsert({
          user_id: tokenRow.user_id,
          last_synced_at: runStartedAt,
          last_scan_started_at: runStartedAt,
          last_error: null,
          updated_at: runStartedAt,
        });

        accountSummaries.push({
          user_id: tokenRow.user_id,
          scanned_messages: sentMessages.length,
          matched_rows: matchedRowsForAccount,
          status: "ok",
        });
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        await supabase.from("outlook_sent_cv_sync_state").upsert({
          user_id: tokenRow.user_id,
          last_scan_started_at: runStartedAt,
          last_error: errorMessage,
          updated_at: runStartedAt,
        });
        accountSummaries.push({
          user_id: tokenRow.user_id,
          scanned_messages: 0,
          matched_rows: matchedRowsForAccount,
          status: "error",
          error: errorMessage,
        });
      }
    }

    return new Response(
      JSON.stringify({
        trigger: body.trigger || "manual",
        scanned_messages: totalScannedMessages,
        matched_rows: totalMatchedRows,
        scanned_accounts: scannedAccounts,
        skipped_accounts: skippedAccounts,
        accounts: accountSummaries,
        generated_at: runStartedAt,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: getErrorMessage(error),
        generated_at: runStartedAt,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
