import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const TRIPLETEX_BASE_URL = "https://tripletex.no/v2";
const REPORT_YEAR = 2026;
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];

type TripletexPosting = {
  amount?: number | string;
  date?: string;
  account?: {
    number?: number | string;
    type?: string;
  };
};

type OkonomiMonth = {
  month: string;
  omsetning: number;
  lonnskostnader: number;
  varekostnad: number;
  andreDriftskostnader: number;
  finansnetto: number;
  resultatForSkatt: number;
};

type OkonomiResponse = {
  months: OkonomiMonth[];
  previousYearMonths: OkonomiMonth[];
  year: number;
  previousYear: number;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase auth secrets mangler." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });
  if (roleError) {
    return jsonResponse({ error: roleError.message }, 500);
  }
  if (!isAdmin) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  return null;
}

function getOsloDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function formatOsloDate(date: Date) {
  const { year, month, day } = getOsloDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getMonthIndexesToFetch() {
  const now = new Date();
  const { year, month } = getOsloDateParts(now);

  if (year < REPORT_YEAR) {
    return [];
  }

  const lastMonthIndex = year > REPORT_YEAR ? 11 : Math.min(month - 1, 11);
  return Array.from({ length: lastMonthIndex + 1 }, (_, index) => index);
}

async function parseJsonResponse<T>(response: Response) {
  const text = await response.text();

  if (!text) {
    return null as T | null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Tripletex svarte med ugyldig JSON (${response.status}).`);
  }
}

async function createSessionToken(consumerToken: string, employeeToken: string) {
  const expirationDate = formatOsloDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const url =
    `${TRIPLETEX_BASE_URL}/token/session/:create?consumerToken=${encodeURIComponent(consumerToken)}` +
    `&employeeToken=${encodeURIComponent(employeeToken)}&expirationDate=${encodeURIComponent(expirationDate)}`;

  const response = await fetch(url, { method: "PUT" });
  const payload = await parseJsonResponse<{ value?: { token?: string }; token?: string; message?: string }>(response);

  if (!response.ok) {
    const message = payload?.message ?? "Kunne ikke opprette Tripletex session token.";
    throw new Error(message);
  }

  const sessionToken = payload?.value?.token ?? payload?.token;
  if (!sessionToken) {
    throw new Error("Tripletex returnerte ingen session token.");
  }

  return sessionToken;
}

async function fetchLedgerPostings(sessionToken: string, year: number, monthIndex: number) {
  const month = monthIndex + 1;
  const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;
  // Tripletex treats dateTo as exclusive, so we must use the first day of the next month.
  const nextMonthDate = new Date(Date.UTC(year, monthIndex + 1, 1));
  const dateTo = `${nextMonthDate.getUTCFullYear()}-${String(nextMonthDate.getUTCMonth() + 1).padStart(2, "0")}-${String(
    nextMonthDate.getUTCDate(),
  ).padStart(2, "0")}`;
  const pageSize = 1000;
  const allPostings: TripletexPosting[] = [];
  let from = 0;

  while (true) {
    const params = new URLSearchParams({
      dateFrom,
      dateTo,
      from: String(from),
      count: String(pageSize),
      fields: "account(number,type),amount,date",
    });

    const response = await fetch(`${TRIPLETEX_BASE_URL}/ledger/posting?${params.toString()}`, {
      headers: {
        Authorization: `Basic ${btoa(`0:${sessionToken}`)}`,
        Accept: "application/json",
      },
    });

    const payload = await parseJsonResponse<{ values?: TripletexPosting[]; value?: TripletexPosting[]; message?: string }>(
      response,
    );

    if (!response.ok) {
      const message = payload?.message ?? `Kunne ikke hente hovedboksposteringer for ${MONTH_LABELS[monthIndex]} ${year}.`;
      throw new Error(message);
    }

    const postings = payload?.values ?? payload?.value ?? [];
    allPostings.push(...postings);

    if (postings.length < pageSize) {
      break;
    }

    from += postings.length;
  }

  return allPostings;
}

function roundAmount(value: number) {
  return Math.round(value);
}

function aggregateMonth(monthIndex: number, postings: TripletexPosting[]): OkonomiMonth {
  let omsetning = 0;
  let lonnskostnader = 0;
  let varekostnad = 0;
  let andreDriftskostnader = 0;
  let finansinntekter = 0;
  let finanskostnader = 0;

  for (const posting of postings) {
    const accountNumber = Number(posting.account?.number);
    const amount = Number(posting.amount ?? 0);

    if (!Number.isFinite(accountNumber) || !Number.isFinite(amount)) {
      continue;
    }

    if (accountNumber >= 3000 && accountNumber <= 3999) {
      omsetning += -amount;
      continue;
    }

    if (accountNumber >= 5000 && accountNumber <= 5999) {
      lonnskostnader += amount;
      continue;
    }

    if (accountNumber >= 4000 && accountNumber <= 4999) {
      varekostnad += amount;
      continue;
    }

    if (accountNumber >= 6000 && accountNumber <= 7999) {
      andreDriftskostnader += amount;
      continue;
    }

    if (accountNumber >= 8000 && accountNumber <= 8099) {
      finansinntekter += -amount;
      continue;
    }

    if (accountNumber >= 8100 && accountNumber <= 8299) {
      finanskostnader += amount;
    }
  }

  const finansnetto = finansinntekter - finanskostnader;
  const resultatForSkatt = omsetning - lonnskostnader - varekostnad - andreDriftskostnader + finansinntekter - finanskostnader;

  return {
    month: MONTH_LABELS[monthIndex],
    omsetning: roundAmount(omsetning),
    lonnskostnader: roundAmount(lonnskostnader),
    varekostnad: roundAmount(varekostnad),
    andreDriftskostnader: roundAmount(andreDriftskostnader),
    finansnetto: roundAmount(finansnetto),
    resultatForSkatt: roundAmount(resultatForSkatt),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authErrorResponse = await requireAdmin(req);
    if (authErrorResponse) return authErrorResponse;

    const consumerToken = Deno.env.get("TRIPLETEX_CONSUMER_TOKEN");
    const employeeToken = Deno.env.get("TRIPLETEX_EMPLOYEE_TOKEN");

    if (!consumerToken || !employeeToken) {
      return jsonResponse(
        {
          error: "Tripletex secrets mangler. Legg inn TRIPLETEX_CONSUMER_TOKEN og TRIPLETEX_EMPLOYEE_TOKEN i Supabase.",
        },
        500,
      );
    }

    const monthIndexes = getMonthIndexesToFetch();
    if (monthIndexes.length === 0) {
      return jsonResponse({
        months: [],
        previousYearMonths: [],
        year: REPORT_YEAR,
        previousYear: REPORT_YEAR - 1,
      } satisfies OkonomiResponse);
    }

    const sessionToken = await createSessionToken(consumerToken, employeeToken);
    const months = await Promise.all(
      monthIndexes.map(async (monthIndex) => {
        const postings = await fetchLedgerPostings(sessionToken, REPORT_YEAR, monthIndex);
        return aggregateMonth(monthIndex, postings);
      }),
    );
    const previousYearMonths = await Promise.all(
      monthIndexes.map(async (monthIndex) => {
        const postings = await fetchLedgerPostings(sessionToken, REPORT_YEAR - 1, monthIndex);
        return aggregateMonth(monthIndex, postings);
      }),
    );

    return jsonResponse({
      months,
      previousYearMonths,
      year: REPORT_YEAR,
      previousYear: REPORT_YEAR - 1,
    } satisfies OkonomiResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ukjent feil ved henting av økonomidata.";
    return jsonResponse({ error: message }, 500);
  }
});
