import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const TRIPLETEX_BASE_URL = "https://tripletex.no/v2";
const DEFAULT_YEAR = 2026;
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];
const STANDARD_DAY_HOURS = 7.5;

type MappingRow = {
  ansatt_id: number;
  stacq_oppdrag_id: number | null;
  tripletex_employee_id: number | null;
  tripletex_project_id: number | null;
  active_from: string | null;
  active_to: string | null;
};

type AssignmentRow = {
  id: number;
  oppdrag_id: number | null;
  utpris: number | null;
  start_dato: string | null;
  slutt_dato: string | null;
};

type TripletexPosting = {
  amount?: number | string;
  account?: {
    number?: number | string;
  };
};

type EmployeeFinanceMonth = {
  month: string;
  billableHours: number | null;
  coverage: number | null;
  revenue: number | null;
  costs: number | null;
  result: number | null;
  salaryCost: number | null;
  sickPayCost: number | null;
};

type EmployeeAccumulatorMonth = {
  touched: boolean;
  billableHours: number;
  coverage: number | null;
  revenue: number;
  costs: number;
  result: number;
  salaryCost: number;
  sickPayCost: number | null;
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

function createAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase auth secrets mangler.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabase = createAdminClient();
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

function getMonthDateRange(year: number, monthIndex: number) {
  const dateFrom = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  const nextMonthDate = new Date(Date.UTC(year, monthIndex + 1, 1));
  const dateTo = `${nextMonthDate.getUTCFullYear()}-${String(nextMonthDate.getUTCMonth() + 1).padStart(2, "0")}-01`;

  return { dateFrom, dateTo };
}

function parseDateValue(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function overlapsMonth(start: string | null, end: string | null, year: number, monthIndex: number) {
  const monthStart = new Date(Date.UTC(year, monthIndex, 1));
  const monthEnd = new Date(Date.UTC(year, monthIndex + 1, 0));
  const activeStart = parseDateValue(start);
  const activeEnd = parseDateValue(end);

  return (!activeStart || activeStart <= monthEnd) && (!activeEnd || activeEnd >= monthStart);
}

function countWeekdays(year: number, monthIndex: number) {
  let count = 0;
  const date = new Date(Date.UTC(year, monthIndex, 1));

  while (date.getUTCMonth() === monthIndex) {
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return count;
}

async function parseJsonResponse<T>(response: Response) {
  const text = await response.text();
  if (!text) return null as T | null;

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

async function fetchProjectLedgerPostings(sessionToken: string, projectId: number, year: number, monthIndex: number) {
  const { dateFrom, dateTo } = getMonthDateRange(year, monthIndex);
  const pageSize = 1000;
  const allPostings: TripletexPosting[] = [];
  let from = 0;

  while (true) {
    const params = new URLSearchParams({
      dateFrom,
      dateTo,
      projectId: String(projectId),
      from: String(from),
      count: String(pageSize),
      fields: "account(number),amount",
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
      const message = payload?.message ?? `Kunne ikke hente prosjektposteringer for Tripletex-prosjekt ${projectId}.`;
      throw new Error(message);
    }

    const postings = payload?.values ?? payload?.value ?? [];
    allPostings.push(...postings);

    if (postings.length < pageSize) break;
    from += postings.length;
  }

  return allPostings;
}

function aggregatePostings(postings: TripletexPosting[], hourlyRate: number | null) {
  let revenue = 0;
  let salaryCost = 0;
  let otherCosts = 0;

  for (const posting of postings) {
    const accountNumber = Number(posting.account?.number);
    const amount = Number(posting.amount ?? 0);

    if (!Number.isFinite(accountNumber) || !Number.isFinite(amount)) continue;

    if (accountNumber >= 3000 && accountNumber <= 3999) {
      revenue += -amount;
      continue;
    }

    if (accountNumber >= 5000 && accountNumber <= 5999) {
      salaryCost += amount;
      continue;
    }

    if (accountNumber >= 4000 && accountNumber <= 7999) {
      otherCosts += amount;
    }
  }

  const costs = salaryCost + otherCosts;
  const billableHours = hourlyRate && hourlyRate > 0 && revenue > 0 ? revenue / hourlyRate : 0;

  return {
    billableHours,
    revenue,
    costs,
    result: revenue - costs,
    salaryCost,
  };
}

function createEmptyAccumulatorMonths(): EmployeeAccumulatorMonth[] {
  return MONTH_LABELS.map(() => ({
    touched: false,
    billableHours: 0,
    coverage: null,
    revenue: 0,
    costs: 0,
    result: 0,
    salaryCost: 0,
    sickPayCost: null,
  }));
}

function roundMetric(value: number) {
  return Math.round(value * 10) / 10;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authErrorResponse = await requireAdmin(req);
    if (authErrorResponse) return authErrorResponse;

    const body = await req.json().catch(() => ({}));
    const year = Number(body?.year) || DEFAULT_YEAR;

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

    const supabase = createAdminClient();
    const { data: mappingsData, error: mappingsError } = await supabase
      .from("okonomi_ansatt_tripletex_mapping")
      .select("ansatt_id, stacq_oppdrag_id, tripletex_employee_id, tripletex_project_id, active_from, active_to");

    if (mappingsError) throw mappingsError;

    const mappings = (mappingsData || []) as MappingRow[];
    if (mappings.length === 0) {
      return jsonResponse({ year, employees: [] });
    }

    const assignmentIds = Array.from(new Set(mappings.map((mapping) => mapping.stacq_oppdrag_id).filter(Boolean))) as number[];
    const { data: assignmentsData, error: assignmentsError } = assignmentIds.length
      ? await supabase
          .from("stacq_oppdrag")
          .select("id, oppdrag_id, utpris, start_dato, slutt_dato")
          .in("id", assignmentIds)
      : { data: [], error: null };

    if (assignmentsError) throw assignmentsError;

    const assignments = new Map(((assignmentsData || []) as AssignmentRow[]).map((assignment) => [assignment.id, assignment]));
    const sessionToken = await createSessionToken(consumerToken, employeeToken);
    const ledgerCache = new Map<string, Promise<TripletexPosting[]>>();
    const employeeMonths = new Map<number, EmployeeAccumulatorMonth[]>();

    for (const mapping of mappings) {
      const assignment = mapping.stacq_oppdrag_id ? assignments.get(mapping.stacq_oppdrag_id) : undefined;
      const projectId = mapping.tripletex_project_id ?? assignment?.oppdrag_id ?? null;
      if (!projectId) continue;

      const activeFrom = mapping.active_from ?? assignment?.start_dato ?? null;
      const activeTo = mapping.active_to ?? assignment?.slutt_dato ?? null;
      const monthlyAccumulator = employeeMonths.get(mapping.ansatt_id) ?? createEmptyAccumulatorMonths();
      const hourlyRate = assignment?.utpris ?? null;

      for (let monthIndex = 0; monthIndex < MONTH_LABELS.length; monthIndex += 1) {
        if (!overlapsMonth(activeFrom, activeTo, year, monthIndex)) continue;

        const cacheKey = `${projectId}-${year}-${monthIndex}`;
        if (!ledgerCache.has(cacheKey)) {
          ledgerCache.set(cacheKey, fetchProjectLedgerPostings(sessionToken, projectId, year, monthIndex));
        }

        const postings = await ledgerCache.get(cacheKey)!;
        const metrics = aggregatePostings(postings, hourlyRate);
        const month = monthlyAccumulator[monthIndex];
        month.touched = true;
        month.billableHours += metrics.billableHours;
        month.revenue += metrics.revenue;
        month.costs += metrics.costs;
        month.result += metrics.result;
        month.salaryCost += metrics.salaryCost;
      }

      employeeMonths.set(mapping.ansatt_id, monthlyAccumulator);
    }

    const employees = Array.from(employeeMonths.entries()).map(([ansattId, months]) => ({
      ansatt_id: ansattId,
      months: months.map((month, monthIndex): EmployeeFinanceMonth => {
        const possibleHours = countWeekdays(year, monthIndex) * STANDARD_DAY_HOURS;
        const coverage = month.touched && possibleHours > 0 ? (month.billableHours / possibleHours) * 100 : null;

        return {
          month: MONTH_LABELS[monthIndex],
          billableHours: month.touched ? roundMetric(month.billableHours) : null,
          coverage: coverage === null ? null : roundMetric(coverage),
          revenue: month.touched ? Math.round(month.revenue) : null,
          costs: month.touched ? Math.round(month.costs) : null,
          result: month.touched ? Math.round(month.result) : null,
          salaryCost: month.touched ? Math.round(month.salaryCost) : null,
          sickPayCost: month.sickPayCost,
        };
      }),
    }));

    return jsonResponse({ year, employees });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ukjent feil ved henting av ansattøkonomi.";
    return jsonResponse({ error: message }, 500);
  }
});
