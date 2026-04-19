import {
  getEffectiveSignal,
  parseDescriptionCategory,
  stripSomedayMarker,
} from "@/lib/categoryUtils";

export type FollowUpVisualStatus = "triage" | "planned" | "in_progress" | "waiting" | "done";
export type FollowUpPriority = "P1" | "P2" | "P3" | "P4" | "P5" | null;

export interface FollowUpActivityRecord {
  contact_id: string | null;
  created_at: string;
  subject: string;
  description: string | null;
}

export interface FollowUpTaskRecord {
  id: string;
  title: string | null;
  description: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  contact_id: string | null;
  company_id: string | null;
  email_notify?: boolean | null;
  contacts?: {
    id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    email?: string | null;
    title?: string | null;
    company_id?: string | null;
    call_list?: boolean | null;
    cv_email?: boolean | null;
    companies?: {
      id?: string | null;
      name?: string | null;
      city?: string | null;
    } | null;
  } | null;
}

export interface FollowUpViewModel {
  id: string;
  title: string;
  description: string;
  status: FollowUpVisualStatus;
  statusLabel: string;
  dbStatus: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerShortName: string | null;
  nextFollowUpAt: string | null;
  companyId: string | null;
  companyName: string | null;
  contactId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactTitle: string | null;
  contactCity: string | null;
  signal: string;
  priority: FollowUpPriority;
  priorityRank: number;
  createdAt: string;
  updatedAt: string | null;
  emailNotify: boolean;
  rawTask: FollowUpTaskRecord;
}

const DB_TO_VISUAL_STATUS: Record<string, FollowUpVisualStatus> = {
  open: "triage",
  todo: "planned",
  in_progress: "in_progress",
  pending: "waiting",
  done: "done",
};

const VISUAL_TO_DB_STATUS: Record<FollowUpVisualStatus, string> = {
  triage: "open",
  planned: "todo",
  in_progress: "in_progress",
  waiting: "pending",
  done: "done",
};

const VISUAL_STATUS_LABELS: Record<FollowUpVisualStatus, string> = {
  triage: "Triage",
  planned: "Planned",
  in_progress: "In progress",
  waiting: "Waiting",
  done: "Done",
};

const SIGNAL_TO_PRIORITY: Record<string, FollowUpPriority> = {
  "Behov nå": "P1",
  "Får fremtidig behov": "P2",
  "Får kanskje behov": "P3",
  "Ukjent om behov": "P4",
  "Ikke aktuelt": "P5",
};

const TASK_PRIORITY_TO_PRIORITY: Record<string, FollowUpPriority> = {
  high: "P1",
  medium: "P2",
  low: "P3",
};

const PRIORITY_RANK: Record<Exclude<FollowUpPriority, null>, number> = {
  P1: 1,
  P2: 2,
  P3: 3,
  P4: 4,
  P5: 5,
};

function toFullName(firstName?: string | null, lastName?: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || null;
}

function toFirstName(fullName: string | null) {
  return fullName ? fullName.split(" ")[0] : null;
}

function mapPriority(signal: string, taskPriority?: string | null): FollowUpPriority {
  if (signal && SIGNAL_TO_PRIORITY[signal]) return SIGNAL_TO_PRIORITY[signal];
  if (taskPriority && TASK_PRIORITY_TO_PRIORITY[taskPriority]) return TASK_PRIORITY_TO_PRIORITY[taskPriority];
  return null;
}

function getPriorityRank(priority: FollowUpPriority) {
  return priority ? PRIORITY_RANK[priority] : 99;
}

export function mapTaskStatusToVisual(status?: string | null): FollowUpVisualStatus {
  if (!status) return "triage";
  return DB_TO_VISUAL_STATUS[status] || "triage";
}

export function mapVisualStatusToTaskStatus(status: FollowUpVisualStatus): string {
  return VISUAL_TO_DB_STATUS[status];
}

export function getFollowUpStatusLabel(status: FollowUpVisualStatus) {
  return VISUAL_STATUS_LABELS[status];
}

export function buildFollowUpViewModels({
  tasks,
  activities,
  profilesById,
  companiesById,
}: {
  tasks: FollowUpTaskRecord[];
  activities: FollowUpActivityRecord[];
  profilesById: Record<string, string>;
  companiesById: Record<string, string>;
}): FollowUpViewModel[] {
  const activitiesByContact = new Map<string, FollowUpActivityRecord[]>();
  const tasksByContact = new Map<
    string,
    Array<{
      created_at: string;
      updated_at?: string | null;
      title: string;
      description: string | null;
      due_date?: string | null;
      status?: string | null;
    }>
  >();

  for (const activity of activities) {
    if (!activity.contact_id) continue;
    const existing = activitiesByContact.get(activity.contact_id) || [];
    existing.push(activity);
    activitiesByContact.set(activity.contact_id, existing);
  }

  for (const task of tasks) {
    if (!task.contact_id) continue;
    const existing = tasksByContact.get(task.contact_id) || [];
    existing.push({
      created_at: task.created_at,
      updated_at: task.updated_at,
      title: task.title || "",
      description: task.description,
      due_date: task.due_date,
      status: task.status,
    });
    tasksByContact.set(task.contact_id, existing);
  }

  return tasks.map((task) => {
    const contactId = task.contact_id || task.contacts?.id || null;
    const companyId = task.contacts?.companies?.id || task.contacts?.company_id || task.company_id || null;
    const contactName = toFullName(task.contacts?.first_name, task.contacts?.last_name);
    const companyName = task.contacts?.companies?.name || (companyId ? companiesById[companyId] || null : null);
    const ownerName = task.assigned_to ? profilesById[task.assigned_to] || null : null;
    const parsedDescription = parseDescriptionCategory(stripSomedayMarker(task.description));
    const signal = contactId
      ? getEffectiveSignal(
          activitiesByContact.get(contactId) || [],
          tasksByContact.get(contactId) || [],
        )
      : parsedDescription.category;
    const priority = mapPriority(signal, task.priority);
    const status = mapTaskStatusToVisual(task.status);

    return {
      id: task.id,
      title: task.title?.trim() || "Uten tittel",
      description: parsedDescription.text,
      status,
      statusLabel: getFollowUpStatusLabel(status),
      dbStatus: mapVisualStatusToTaskStatus(status),
      ownerId: task.assigned_to || null,
      ownerName,
      ownerShortName: toFirstName(ownerName),
      nextFollowUpAt: task.due_date || null,
      companyId,
      companyName,
      contactId,
      contactName,
      contactEmail: task.contacts?.email || null,
      contactPhone: task.contacts?.phone || null,
      contactTitle: task.contacts?.title || null,
      contactCity: task.contacts?.companies?.city || null,
      signal,
      priority,
      priorityRank: getPriorityRank(priority),
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      emailNotify: Boolean(task.email_notify),
      rawTask: task,
    };
  });
}
