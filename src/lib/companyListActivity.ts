const PAGE_SIZE = 1000;
const ID_CHUNK_SIZE = 100;

type SupabaseClientLike = {
  from: (table: string) => any;
};

type CompanyListCompany = {
  id: string;
  contacts?: Array<{ id: string | null }> | null;
};

type ActivityRow = {
  id: string | null;
  company_id?: string | null;
  contact_id?: string | null;
  created_at: string | null;
  subject?: string | null;
  description?: string | null;
};

type TaskRow = {
  id: string | null;
  company_id?: string | null;
  contact_id?: string | null;
  created_at: string | null;
  due_date: string | null;
  title?: string | null;
  description?: string | null;
};

export type CompanyListActivitySummary = {
  lastActivityMap: Record<string, string>;
  activityCountMap: Record<string, number>;
  taskCountMap: Record<string, number>;
  overdueTaskMap: Record<string, boolean>;
  companyActsMap: Record<string, ActivityRow[]>;
  companyTasksMap: Record<string, TaskRow[]>;
};

const compactIds = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value))));

const chunkIds = (ids: string[]) => {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK_SIZE) chunks.push(ids.slice(i, i + ID_CHUNK_SIZE));
  return chunks;
};

async function fetchPagedRows<T>(createQuery: (from: number, to: number) => any): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await createQuery(from, to);
    if (error) throw error;

    const page = ((data || []) as T[]);
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchRowsForIds<T>(
  ids: string[],
  createQuery: (idChunk: string[], from: number, to: number) => any,
): Promise<T[]> {
  if (ids.length === 0) return [];

  const rows: T[] = [];
  for (const idChunk of chunkIds(ids)) {
    const chunkRows = await fetchPagedRows<T>((from, to) => createQuery(idChunk, from, to));
    rows.push(...chunkRows);
  }
  return rows;
}

const isPastDate = (value: string | null | undefined, now: Date) => {
  if (!value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed <= now;
};

const isLater = (candidate: string, current: string | undefined) => {
  if (!current) return true;
  return new Date(candidate).getTime() > new Date(current).getTime();
};

const getSet = (map: Record<string, Set<string>>, key: string) => {
  if (!map[key]) map[key] = new Set();
  return map[key];
};

const getList = <T>(map: Record<string, T[]>, key: string) => {
  if (!map[key]) map[key] = [];
  return map[key];
};

export async function fetchCompanyListActivitySummary(
  supabase: SupabaseClientLike,
  companies: CompanyListCompany[],
): Promise<CompanyListActivitySummary> {
  const companyIds = compactIds(companies.map((company) => company.id));
  const companyIdSet = new Set(companyIds);
  const contactToCompany: Record<string, string> = {};

  companies.forEach((company) => {
    (company.contacts || []).forEach((contact) => {
      if (contact.id) contactToCompany[contact.id] = company.id;
    });
  });

  const contactIds = Object.keys(contactToCompany);

  const [companyActivities, contactActivities, companyTasks, contactTasks] = await Promise.all([
    fetchRowsForIds<ActivityRow>(companyIds, (ids, from, to) =>
      supabase
        .from("activities")
        .select("id, company_id, contact_id, created_at, subject, description")
        .in("company_id", ids)
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
    fetchRowsForIds<ActivityRow>(contactIds, (ids, from, to) =>
      supabase
        .from("activities")
        .select("id, company_id, contact_id, created_at, subject, description")
        .in("contact_id", ids)
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
    fetchRowsForIds<TaskRow>(companyIds, (ids, from, to) =>
      supabase
        .from("tasks")
        .select("id, company_id, contact_id, due_date, title, description, status, created_at")
        .in("company_id", ids)
        .neq("status", "done")
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
    fetchRowsForIds<TaskRow>(contactIds, (ids, from, to) =>
      supabase
        .from("tasks")
        .select("id, company_id, contact_id, due_date, title, description, status, created_at")
        .in("contact_id", ids)
        .neq("status", "done")
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
  ]);

  const now = new Date();
  const lastActivityMap: Record<string, string> = {};
  const activityIdsByCompany: Record<string, Set<string>> = {};
  const taskIdsByCompany: Record<string, Set<string>> = {};
  const taskCountMap: Record<string, number> = {};
  const overdueTaskMap: Record<string, boolean> = {};
  const companyActsMap: Record<string, ActivityRow[]> = {};
  const companyTasksMap: Record<string, TaskRow[]> = {};

  const registerActivity = (companyId: string, activity: ActivityRow) => {
    if (!companyIdSet.has(companyId)) return;

    const activityKey = activity.id || `${companyId}:${activity.contact_id || ""}:${activity.created_at || ""}:${activity.subject || ""}`;
    const activityIds = getSet(activityIdsByCompany, companyId);
    activityIds.add(activityKey);

    if (isPastDate(activity.created_at, now) && activity.created_at && isLater(activity.created_at, lastActivityMap[companyId])) {
      lastActivityMap[companyId] = activity.created_at;
    }
  };

  const registerTask = (companyId: string, task: TaskRow) => {
    if (!companyIdSet.has(companyId)) return;

    const taskKey = task.id || `${companyId}:${task.contact_id || ""}:${task.created_at || ""}:${task.title || ""}`;
    const taskIds = getSet(taskIdsByCompany, companyId);
    if (!taskIds.has(taskKey)) {
      taskIds.add(taskKey);
      taskCountMap[companyId] = (taskCountMap[companyId] || 0) + 1;
    }
    if (task.due_date && new Date(task.due_date) < now) overdueTaskMap[companyId] = true;
  };

  companyActivities.forEach((activity) => {
    if (activity.company_id) registerActivity(activity.company_id, activity);
  });

  contactActivities.forEach((activity) => {
    const companyId = activity.contact_id ? contactToCompany[activity.contact_id] : null;
    if (!companyId) return;

    registerActivity(companyId, activity);
    getList(companyActsMap, companyId).push(activity);
  });

  companyTasks.forEach((task) => {
    if (task.company_id) registerTask(task.company_id, task);
  });

  contactTasks.forEach((task) => {
    const companyId = task.contact_id ? contactToCompany[task.contact_id] : null;
    if (!companyId) return;

    registerTask(companyId, task);
    getList(companyTasksMap, companyId).push(task);
  });

  const activityCountMap: Record<string, number> = {};
  Object.entries(activityIdsByCompany).forEach(([companyId, ids]) => {
    activityCountMap[companyId] = ids.size;
  });

  return {
    lastActivityMap,
    activityCountMap,
    taskCountMap,
    overdueTaskMap,
    companyActsMap,
    companyTasksMap,
  };
}
