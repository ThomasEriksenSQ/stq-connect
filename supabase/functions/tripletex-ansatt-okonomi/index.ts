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

type EmployeeRow = {
  id: number;
  ansatt_id: number | null;
  start_dato: string | null;
  slutt_dato: string | null;
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

type TripletexProjectRef = {
  id?: number | string | null;
  number?: number | string | null;
  name?: string | null;
};

type TripletexEmployee = {
  id?: number | string | null;
  employeeNumber?: number | string | null;
};

type TripletexTimesheetEntry = {
  hours?: number | string | null;
  chargeableHours?: number | string | null;
  project?: TripletexProjectRef | null;
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

type CachedEmployeeFinanceMonth = {
  ansatt_id: number;
  year: number;
  month: number;
  billable_hours: number | null;
  coverage: number | null;
  revenue: number | null;
  costs: number | null;
  result: number | null;
  salary_cost: number | null;
  sick_pay_cost: number | null;
  is_final: boolean | null;
};

type EmployeeAccumulatorMonth = {
  touched: boolean;
  hasTimesheetHours: boolean;
  billableHours: number;
  coverage: number | null;
  revenue: number;
  costs: number;
  result: number;
  salaryCost: number;
  sickPayCost: number | null;
};

type EmployeeSource = {
  id: number;
  tripletexEmployeeIds: Set<number>;
  start_dato: string | null;
  slutt_dato: string | null;
  mappings: MappingRow[];
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

function isMonthFetchable(year: number, monthIndex: number) {
  const today = getOsloDateParts(new Date());
  if (year < today.year) return true;
  if (year > today.year) return false;
  return monthIndex <= today.month - 1;
}

function isMonthCacheEligible(year: number, monthIndex: number) {
  const now = getOsloDateParts(new Date());
  const cacheReadyDate = new Date(Date.UTC(year, monthIndex + 1, 15));
  const today = new Date(Date.UTC(now.year, now.month - 1, now.day));
  return today >= cacheReadyDate;
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

function parseFiniteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAmount(value: unknown) {
  return parseFiniteNumber(value) ?? 0;
}

function addWarning(warnings: string[], message: string) {
  if (warnings.includes(message)) return;
  if (warnings.length >= 5) return;
  warnings.push(message);
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

function getPayloadValues<T>(payload: { values?: T[]; value?: T[] | T } | null) {
  if (!payload) return [];
  if (Array.isArray(payload.values)) return payload.values;
  if (Array.isArray(payload.value)) return payload.value;
  return [];
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

async function resolveTripletexEmployeeId(sessionToken: string, employeeNumber: number) {
  const params = new URLSearchParams({
    employeeNumber: String(employeeNumber),
    from: "0",
    count: "10",
    fields: "id,employeeNumber",
  });

  const response = await fetch(`${TRIPLETEX_BASE_URL}/employee?${params.toString()}`, {
    headers: {
      Authorization: `Basic ${btoa(`0:${sessionToken}`)}`,
      Accept: "application/json",
    },
  });
  const payload = await parseJsonResponse<{ values?: TripletexEmployee[]; value?: TripletexEmployee[]; message?: string }>(
    response,
  );

  if (!response.ok) {
    const message = payload?.message ?? `Kunne ikke slå opp Tripletex-ansattnummer ${employeeNumber}.`;
    throw new Error(message);
  }

  const employees = getPayloadValues(payload);
  const exactEmployee = employees.find((employee) => Number(employee.employeeNumber) === employeeNumber) ?? employees[0];
  const employeeId = Number(exactEmployee?.id);

  if (!Number.isFinite(employeeId)) {
    throw new Error(`Fant ikke Tripletex ansatt-ID for ansattnummer ${employeeNumber}.`);
  }

  return employeeId;
}

async function fetchEmployeeTimesheetEntries(sessionToken: string, employeeId: number, year: number, monthIndex: number) {
  const { dateFrom, dateTo } = getMonthDateRange(year, monthIndex);
  const pageSize = 1000;
  const entries: TripletexTimesheetEntry[] = [];
  let from = 0;

  while (true) {
    const params = new URLSearchParams({
      dateFrom,
      dateTo,
      employeeId: String(employeeId),
      from: String(from),
      count: String(pageSize),
      fields: "project(id,number,name),hours,chargeableHours",
    });

    const response = await fetch(`${TRIPLETEX_BASE_URL}/timesheet/entry?${params.toString()}`, {
      headers: {
        Authorization: `Basic ${btoa(`0:${sessionToken}`)}`,
        Accept: "application/json",
      },
    });
    const payload = await parseJsonResponse<{ values?: TripletexTimesheetEntry[]; value?: TripletexTimesheetEntry[]; message?: string }>(
      response,
    );

    if (!response.ok) {
      const message = payload?.message ?? `Kunne ikke hente timer for Tripletex-ansatt ${employeeId}.`;
      throw new Error(message);
    }

    const pageEntries = getPayloadValues(payload);
    entries.push(...pageEntries);

    if (pageEntries.length < pageSize) break;
    from += pageEntries.length;
  }

  return entries;
}

function getTimesheetEntryHours(entry: TripletexTimesheetEntry) {
  const hours = parseFiniteNumber(entry.hours);
  const chargeableHours = parseFiniteNumber(entry.chargeableHours);
  return chargeableHours ?? hours ?? 0;
}

function getProjectRefKeys(project: TripletexProjectRef | null | undefined) {
  return [project?.id, project?.number]
    .map((value) => value === null || value === undefined ? "" : String(value).trim())
    .filter(Boolean);
}

function sumTimesheetHours(entries: TripletexTimesheetEntry[], projectRefs: Set<string>) {
  const matchingEntries = projectRefs.size > 0
    ? entries.filter((entry) => getProjectRefKeys(entry.project).some((key) => projectRefs.has(key)))
    : entries;
  const matchingHours = matchingEntries.reduce((sum, entry) => sum + getTimesheetEntryHours(entry), 0);
  const allHours = entries.reduce((sum, entry) => sum + getTimesheetEntryHours(entry), 0);
  const shouldUseAllEntries = matchingEntries.length === 0 || (matchingHours === 0 && allHours > 0);
  const entriesToSum = shouldUseAllEntries ? entries : matchingEntries;

  return {
    hours: shouldUseAllEntries ? allHours : matchingHours,
    entryCount: entriesToSum.length,
    matchedProject: projectRefs.size === 0 || !shouldUseAllEntries,
  };
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
    hasTimesheetHours: false,
    billableHours: 0,
    coverage: null,
    revenue: 0,
    costs: 0,
    result: 0,
    salaryCost: 0,
    sickPayCost: null,
  }));
}

function applyCachedMonth(month: EmployeeAccumulatorMonth, cachedMonth: CachedEmployeeFinanceMonth) {
  month.touched = true;
  month.hasTimesheetHours = cachedMonth.billable_hours !== null;
  month.billableHours = Number(cachedMonth.billable_hours ?? 0);
  month.coverage = cachedMonth.coverage;
  month.revenue = Number(cachedMonth.revenue ?? 0);
  month.costs = Number(cachedMonth.costs ?? 0);
  month.result = Number(cachedMonth.result ?? 0);
  month.salaryCost = Number(cachedMonth.salary_cost ?? 0);
  month.sickPayCost = cachedMonth.sick_pay_cost;
}

function roundMetric(value: number) {
  return Math.round(value * 10) / 10;
}

function ensureEmployeeSource(sources: Map<number, EmployeeSource>, employeeId: number) {
  let source = sources.get(employeeId);
  if (!source) {
    source = {
      id: employeeId,
      tripletexEmployeeIds: new Set<number>(),
      start_dato: null,
      slutt_dato: null,
      mappings: [],
    };
    sources.set(employeeId, source);
  }

  return source;
}

function getMappingAssignment(mapping: MappingRow, assignments: Map<number, AssignmentRow>) {
  return mapping.stacq_oppdrag_id ? assignments.get(mapping.stacq_oppdrag_id) : undefined;
}

function getMappingProjectId(mapping: MappingRow, assignments: Map<number, AssignmentRow>) {
  const assignment = getMappingAssignment(mapping, assignments);
  return mapping.tripletex_project_id ?? assignment?.oppdrag_id ?? null;
}

function getMappingActiveFrom(mapping: MappingRow, assignment: AssignmentRow | undefined, source: EmployeeSource) {
  return mapping.active_from ?? assignment?.start_dato ?? source.start_dato;
}

function getMappingActiveTo(mapping: MappingRow, assignment: AssignmentRow | undefined, source: EmployeeSource) {
  return mapping.active_to ?? assignment?.slutt_dato ?? source.slutt_dato;
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
    const forceRefresh = body?.forceRefresh === true;

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

    const warnings: string[] = [];
    const supabase = createAdminClient();
    const [employeesResult, mappingsResult] = await Promise.all([
      supabase
        .from("stacq_ansatte")
        .select("id, ansatt_id, start_dato, slutt_dato")
        .not("ansatt_id", "is", null),
      supabase
        .from("okonomi_ansatt_tripletex_mapping")
        .select("ansatt_id, stacq_oppdrag_id, tripletex_employee_id, tripletex_project_id, active_from, active_to"),
    ]);

    if (employeesResult.error) throw employeesResult.error;

    const employees = (employeesResult.data || []) as EmployeeRow[];
    const mappings = mappingsResult.error ? [] : (mappingsResult.data || []) as MappingRow[];
    if (mappingsResult.error) {
      addWarning(warnings, "Tripletex-prosjektkobling er ikke tilgjengelig. Viser timer fra ansatt-ID der den finnes.");
    }

    const sources = new Map<number, EmployeeSource>();
    for (const employee of employees) {
      const source = ensureEmployeeSource(sources, employee.id);
      source.start_dato = employee.start_dato;
      source.slutt_dato = employee.slutt_dato;
      if (employee.ansatt_id) {
        source.tripletexEmployeeIds.add(employee.ansatt_id);
      }
    }

    for (const mapping of mappings) {
      const source = ensureEmployeeSource(sources, mapping.ansatt_id);
      source.mappings.push(mapping);
      if (mapping.tripletex_employee_id) {
        source.tripletexEmployeeIds.add(mapping.tripletex_employee_id);
      }
    }

    if (sources.size === 0) {
      return jsonResponse({ year, employees: [], warnings });
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
    const { data: cachedData, error: cacheLoadError } = await supabase
      .from("okonomi_ansatt_timer_cache")
      .select("ansatt_id, year, month, billable_hours, coverage, revenue, costs, result, salary_cost, sick_pay_cost, is_final")
      .eq("year", year);

    if (cacheLoadError) {
      addWarning(warnings, "Kunne ikke lese cache for ansatttimer.");
    }

    const cacheByEmployeeMonth = new Map<string, CachedEmployeeFinanceMonth>();
    for (const cachedMonth of (cachedData || []) as CachedEmployeeFinanceMonth[]) {
      if (cachedMonth.is_final) {
        cacheByEmployeeMonth.set(`${cachedMonth.ansatt_id}-${cachedMonth.month - 1}`, cachedMonth);
      }
    }

    const sessionToken = await createSessionToken(consumerToken, employeeToken);
    const employeeIdCache = new Map<number, Promise<number>>();
    const ledgerCache = new Map<string, Promise<TripletexPosting[]>>();
    const timesheetEntryCache = new Map<string, Promise<TripletexTimesheetEntry[]>>();
    const employeeMonths = new Map<number, EmployeeAccumulatorMonth[]>();

    for (const source of sources.values()) {
      const months = createEmptyAccumulatorMonths();
      const tripletexEmployeeCandidateGroups: number[][] = [];

      for (const employeeNumber of source.tripletexEmployeeIds) {
        const candidates = [employeeNumber];
        try {
          if (!employeeIdCache.has(employeeNumber)) {
            employeeIdCache.set(employeeNumber, resolveTripletexEmployeeId(sessionToken, employeeNumber));
          }
          const resolvedEmployeeId = await employeeIdCache.get(employeeNumber)!;
          if (!candidates.includes(resolvedEmployeeId)) {
            candidates.push(resolvedEmployeeId);
          }
        } catch {
          // Some historical or draft CRM rows can carry stale Tripletex employee numbers.
          // The stored value can still be a valid internal employeeId, so keep it as a fallback.
        }
        tripletexEmployeeCandidateGroups.push(candidates);
      }

      for (let monthIndex = 0; monthIndex < MONTH_LABELS.length; monthIndex += 1) {
        if (!isMonthFetchable(year, monthIndex)) continue;

        const sourceActive = overlapsMonth(source.start_dato, source.slutt_dato, year, monthIndex);
        const activeMappings = source.mappings.filter((mapping) => {
          const assignment = getMappingAssignment(mapping, assignments);
          return overlapsMonth(
            getMappingActiveFrom(mapping, assignment, source),
            getMappingActiveTo(mapping, assignment, source),
            year,
            monthIndex,
          );
        });
        const month = months[monthIndex];
        const cachedMonth = cacheByEmployeeMonth.get(`${source.id}-${monthIndex}`);
        if (!forceRefresh && cachedMonth && isMonthCacheEligible(year, monthIndex)) {
          applyCachedMonth(month, cachedMonth);
          continue;
        }

        const activeProjectRefs = new Set(
          activeMappings
            .map((mapping) => getMappingProjectId(mapping, assignments))
            .filter((projectId): projectId is number => projectId !== null)
            .map((projectId) => String(projectId)),
        );

        if (sourceActive && tripletexEmployeeCandidateGroups.length > 0) {
          for (const candidateGroup of tripletexEmployeeCandidateGroups) {
            let foundTimesheetCandidate = false;
            let foundZeroHourCandidate = false;
            let zeroHourCandidateMatchedProject = true;

            for (const employeeId of candidateGroup) {
              const cacheKey = `${employeeId}-${year}-${monthIndex}`;
              try {
                if (!timesheetEntryCache.has(cacheKey)) {
                  timesheetEntryCache.set(cacheKey, fetchEmployeeTimesheetEntries(sessionToken, employeeId, year, monthIndex));
                }
                const entries = await timesheetEntryCache.get(cacheKey)!;
                const timesheetHours = sumTimesheetHours(entries, activeProjectRefs);
                if (timesheetHours.entryCount > 0 && timesheetHours.hours > 0) {
                  month.billableHours += timesheetHours.hours;
                  month.hasTimesheetHours = true;
                  month.touched = true;
                  foundTimesheetCandidate = true;
                  if (!timesheetHours.matchedProject) {
                    addWarning(warnings, "Fant timer på ansatt, men ikke på koblet prosjekt for enkelte måneder.");
                  }
                  break;
                }
                if (timesheetHours.entryCount > 0) {
                  foundZeroHourCandidate = true;
                  zeroHourCandidateMatchedProject = zeroHourCandidateMatchedProject && timesheetHours.matchedProject;
                }
              } catch {
                if (candidateGroup.indexOf(employeeId) === candidateGroup.length - 1) {
                  addWarning(warnings, "Kunne ikke hente timer fra Tripletex for enkelte ansatte.");
                }
              }
            }

            if (!foundTimesheetCandidate && foundZeroHourCandidate) {
              month.hasTimesheetHours = true;
              month.touched = true;
              if (!zeroHourCandidateMatchedProject) {
                addWarning(warnings, "Fant timer på ansatt, men ikke på koblet prosjekt for enkelte måneder.");
              }
            }
          }
        }

        const ledgerKeys = new Set<string>();
        for (const mapping of activeMappings) {
          const assignment = getMappingAssignment(mapping, assignments);
          const projectId = getMappingProjectId(mapping, assignments);
          if (!projectId) continue;

          const cacheKey = `${projectId}-${year}-${monthIndex}`;
          if (ledgerKeys.has(cacheKey)) continue;
          ledgerKeys.add(cacheKey);

          try {
            if (!ledgerCache.has(cacheKey)) {
              ledgerCache.set(cacheKey, fetchProjectLedgerPostings(sessionToken, projectId, year, monthIndex));
            }

            const postings = await ledgerCache.get(cacheKey)!;
            const metrics = aggregatePostings(postings, assignment?.utpris ?? null);
            month.touched = true;
            if (!month.hasTimesheetHours) {
              month.billableHours += metrics.billableHours;
            }
            month.revenue += metrics.revenue;
            month.costs += metrics.costs;
            month.result += metrics.result;
            month.salaryCost += metrics.salaryCost;
          } catch {
            addWarning(warnings, "Kunne ikke hente prosjektøkonomi fra Tripletex for enkelte koblinger.");
          }
        }
      }

      months.forEach((month, monthIndex) => {
        const cachedMonth = cacheByEmployeeMonth.get(`${source.id}-${monthIndex}`);
        if (!month.touched && cachedMonth && isMonthCacheEligible(year, monthIndex)) {
          applyCachedMonth(month, cachedMonth);
        }
      });

      employeeMonths.set(source.id, months);
    }

    const employeesResponse = Array.from(employeeMonths.entries()).map(([ansattId, months]) => ({
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

    const cacheRows = employeesResponse.flatMap((employee) =>
      employee.months
        .map((month, monthIndex) => ({ month, monthIndex }))
        .filter(({ month, monthIndex }) => month.billableHours !== null && isMonthCacheEligible(year, monthIndex))
        .map(({ month, monthIndex }) => ({
          ansatt_id: employee.ansatt_id,
          year,
          month: monthIndex + 1,
          billable_hours: month.billableHours,
          coverage: month.coverage,
          revenue: month.revenue,
          costs: month.costs,
          result: month.result,
          salary_cost: month.salaryCost,
          sick_pay_cost: month.sickPayCost,
          is_final: true,
          source: "tripletex",
          refreshed_at: new Date().toISOString(),
        })),
    );

    if (cacheRows.length > 0) {
      const { error: cacheSaveError } = await supabase
        .from("okonomi_ansatt_timer_cache")
        .upsert(cacheRows, { onConflict: "ansatt_id,year,month" });
      if (cacheSaveError) {
        addWarning(warnings, "Kunne ikke lagre cache for ansatttimer.");
      }
    }

    return jsonResponse({ year, employees: employeesResponse, warnings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ukjent feil ved henting av ansattøkonomi.";
    return jsonResponse({ error: message }, 500);
  }
});
