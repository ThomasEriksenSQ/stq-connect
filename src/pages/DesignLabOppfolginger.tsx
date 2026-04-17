import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { endOfWeek, format, isBefore, isToday, startOfDay } from "date-fns";
import { nb } from "date-fns/locale";
import { CalendarIcon, ExternalLink, Mail, Phone, Plus, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePersistentState } from "@/hooks/usePersistentState";
import { crmQueryKeys, crmSummaryQueryKeys, invalidateQueryGroup } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import {
  buildFollowUpViewModels,
  type FollowUpPriority,
  type FollowUpTaskRecord,
  type FollowUpViewModel,
  type FollowUpVisualStatus,
  mapVisualStatusToTaskStatus,
} from "@/lib/followUpViewModel";
import { TextSizeControl, SCALE_MAP, type TextSize } from "@/components/designlab/TextSizeControl";
import { DesignLabSidebar } from "@/components/designlab/DesignLabSidebar";
import { C } from "@/components/designlab/theme";
import {
  DESIGN_LAB_NEUTRAL_TAG_ACTIVE_COLORS,
  DESIGN_LAB_NEUTRAL_TAG_INACTIVE_COLORS,
  DESIGN_LAB_NEUTRAL_TAG_INACTIVE_HOVER_COLORS,
  DesignLabSearchInput,
} from "@/components/designlab/controls";
import {
  DesignLabFilterRow,
  DesignLabGhostAction,
  DesignLabModalActions,
  DesignLabModalContent,
  DesignLabModalField,
  DesignLabModalForm,
  DesignLabModalInput,
  DesignLabModalLabel,
  DesignLabPrimaryAction,
  DesignLabReadonlyChip,
  DesignLabSecondaryAction,
  DesignLabSignalBadge,
  getDesignLabV2ActionStyle,
} from "@/components/designlab/system";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type FollowUpViewFilter = "Alle" | "Mine" | "Forfalt" | "Denne uka" | "Uten eier";

const FOLLOW_UP_QUERY_KEY = ["design-lab-follow-ups"] as const;
const FOLLOW_UP_ACTIVITY_QUERY_KEY = ["design-lab-follow-up-activities"] as const;
const FOLLOW_UP_CONTACT_QUERY_KEY = ["design-lab-follow-up-modal-contacts"] as const;

const VIEW_FILTERS = ["Alle", "Mine", "Forfalt", "Denne uka", "Uten eier"] as const satisfies readonly FollowUpViewFilter[];

const STATUS_OPTIONS: Array<{ value: FollowUpVisualStatus; label: string }> = [
  { value: "triage", label: "Triage" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting", label: "Waiting" },
  { value: "done", label: "Done" },
];

const STATUS_COLORS: Record<FollowUpVisualStatus, { background: string; color: string; border: string; fontWeight: number }> = {
  triage: {
    background: C.statusNeutralBg,
    color: C.statusNeutral,
    border: `1px solid ${C.statusNeutralBorder}`,
    fontWeight: 500,
  },
  planned: {
    background: C.infoBg,
    color: C.info,
    border: `1px solid rgba(26,79,160,0.18)`,
    fontWeight: 600,
  },
  in_progress: {
    background: C.accentBg,
    color: C.accent,
    border: `1px solid rgba(94,106,210,0.18)`,
    fontWeight: 600,
  },
  waiting: {
    background: C.warningBg,
    color: C.warning,
    border: `1px solid rgba(125,78,0,0.18)`,
    fontWeight: 600,
  },
  done: {
    background: C.successBg,
    color: C.success,
    border: `1px solid rgba(45,106,79,0.18)`,
    fontWeight: 600,
  },
};

const PRIORITY_COLORS: Record<Exclude<FollowUpPriority, null>, { background: string; color: string; border: string; fontWeight: number }> = {
  P1: {
    background: C.dangerBg,
    color: C.danger,
    border: `1px solid rgba(139,29,32,0.18)`,
    fontWeight: 600,
  },
  P2: {
    background: C.infoBg,
    color: C.info,
    border: `1px solid rgba(26,79,160,0.18)`,
    fontWeight: 600,
  },
  P3: {
    background: C.warningBg,
    color: C.warning,
    border: `1px solid rgba(125,78,0,0.18)`,
    fontWeight: 600,
  },
  P4: {
    background: C.statusNeutralBg,
    color: C.statusNeutral,
    border: `1px solid ${C.statusNeutralBorder}`,
    fontWeight: 500,
  },
};

const EMPTY_FORM = {
  title: "",
  description: "",
  dueDate: "",
  contactId: "",
  companyId: "",
  emailNotify: false,
};

function formatListDate(value: string | null) {
  if (!value) return "Ingen dato";
  const date = new Date(value);
  if (isToday(date)) return "I dag";
  return format(date, "d. MMM", { locale: nb });
}

function isOverdueDate(value: string | null) {
  if (!value) return false;
  return isBefore(new Date(value), startOfDay(new Date())) && !isToday(new Date(value));
}

function isDueThisWeek(value: string | null) {
  if (!value) return false;
  const date = new Date(value);
  const today = startOfDay(new Date());
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  return date >= today && date <= weekEnd;
}

function rowMeta(model: FollowUpViewModel) {
  if (model.companyName && model.contactName) return `${model.companyName} · ${model.contactName}`;
  return model.companyName || model.contactName || "Ingen kobling";
}

function detailMeta(model: FollowUpViewModel) {
  const parts = [model.companyName, model.contactName, model.contactTitle].filter(Boolean);
  return parts.join(" · ");
}

function getDateTone(value: string | null) {
  if (!value) return C.textFaint;
  if (isOverdueDate(value)) return C.danger;
  if (isToday(new Date(value))) return C.accent;
  return C.textMuted;
}

export default function DesignLabOppfolginger() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { signOut, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [textSize, setTextSize] = usePersistentState<TextSize>("dl-text-size", "M");
  const [search, setSearch] = useState("");
  const [viewFilter, setViewFilter] = useState<FollowUpViewFilter>("Alle");
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("task"));
  const [createOpen, setCreateOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const contactInputRef = useRef<HTMLInputElement | null>(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: FOLLOW_UP_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, description, status, priority, due_date, assigned_to, created_by, created_at, updated_at, contact_id, company_id, email_notify, contacts(id, first_name, last_name, phone, email, title, company_id, cv_email, call_list, companies(id, name, city))")
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as FollowUpTaskRecord[];
    },
  });

  const contactIds = useMemo(() => {
    return Array.from(new Set(tasks.map((task) => task.contact_id).filter((value): value is string => Boolean(value))));
  }, [tasks]);

  const { data: activities = [] } = useQuery({
    queryKey: [...FOLLOW_UP_ACTIVITY_QUERY_KEY, contactIds],
    queryFn: async () => {
      if (contactIds.length === 0) return [];
      const { data, error } = await supabase
        .from("activities")
        .select("contact_id, created_at, subject, description")
        .in("contact_id", contactIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: contactIds.length > 0,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: crmQueryKeys.profiles.all(),
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name").order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["design-lab-follow-up-companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: modalContacts = [] } = useQuery({
    queryKey: FOLLOW_UP_CONTACT_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, company_id, companies(id, name)")
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
    enabled: createOpen,
  });

  const profilesById = useMemo(
    () => Object.fromEntries(profiles.map((profile) => [profile.id, profile.full_name])),
    [profiles],
  );

  const companiesById = useMemo(
    () => Object.fromEntries(companies.map((company) => [company.id, company.name])),
    [companies],
  );

  const viewModels = useMemo(
    () =>
      buildFollowUpViewModels({
        tasks,
        activities,
        profilesById,
        companiesById,
      }),
    [tasks, activities, profilesById, companiesById],
  );

  const activitiesByContact = useMemo(() => {
    const map = new Map<string, Array<{ id?: string; created_at: string; subject: string; description: string | null }>>();
    for (const activity of activities) {
      if (!activity.contact_id) continue;
      const existing = map.get(activity.contact_id) || [];
      existing.push(activity);
      map.set(activity.contact_id, existing);
    }
    return map;
  }, [activities]);

  const filtered = useMemo(() => {
    const lowerSearch = search.trim().toLowerCase();
    const today = startOfDay(new Date());
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

    return viewModels
      .filter((model) => {
        if (viewFilter === "Mine" && model.ownerId !== user?.id) return false;
        if (viewFilter === "Forfalt" && !isOverdueDate(model.nextFollowUpAt)) return false;
        if (viewFilter === "Denne uka") {
          if (!model.nextFollowUpAt) return false;
          const date = new Date(model.nextFollowUpAt);
          if (date < today || date > weekEnd) return false;
        }
        if (viewFilter === "Uten eier" && model.ownerId) return false;
        if (!lowerSearch) return true;

        return [
          model.title,
          model.companyName,
          model.contactName,
          model.signal,
          model.ownerName,
          model.description,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(lowerSearch));
      })
      .sort((a, b) => {
        const aOverdue = isOverdueDate(a.nextFollowUpAt);
        const bOverdue = isOverdueDate(b.nextFollowUpAt);
        if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

        const aHasOwner = Boolean(a.ownerId);
        const bHasOwner = Boolean(b.ownerId);
        if (aHasOwner !== bHasOwner) return aHasOwner ? 1 : -1;

        if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;

        if (a.nextFollowUpAt && b.nextFollowUpAt && a.nextFollowUpAt !== b.nextFollowUpAt) {
          return a.nextFollowUpAt.localeCompare(b.nextFollowUpAt);
        }
        if (a.nextFollowUpAt && !b.nextFollowUpAt) return -1;
        if (!a.nextFollowUpAt && b.nextFollowUpAt) return 1;

        return (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt);
      });
  }, [search, user?.id, viewFilter, viewModels]);

  useEffect(() => {
    const paramId = searchParams.get("task");
    if (paramId !== selectedId) setSelectedId(paramId);
  }, [searchParams]);

  useEffect(() => {
    const current = searchParams.get("task");
    if (selectedId) {
      if (current !== selectedId) setSearchParams({ task: selectedId }, { replace: true });
    } else if (current !== null) {
      setSearchParams({}, { replace: true });
    }
  }, [selectedId, searchParams, setSearchParams]);

  useEffect(() => {
    if (selectedId && !filtered.some((item) => item.id === selectedId)) {
      setSelectedId(filtered[0]?.id || null);
    }
  }, [filtered, selectedId]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return filtered.find((model) => model.id === selectedId) || viewModels.find((model) => model.id === selectedId) || null;
  }, [filtered, selectedId, viewModels]);

  const selectedActivities = useMemo(() => {
    if (!selected?.contactId) return [];
    return (activitiesByContact.get(selected.contactId) || []).slice(0, 6);
  }, [activitiesByContact, selected?.contactId]);

  const stats = useMemo(() => {
    const overdueCount = viewModels.filter((model) => isOverdueDate(model.nextFollowUpAt)).length;
    const mineCount = viewModels.filter((model) => model.ownerId === user?.id).length;
    const thisWeekCount = viewModels.filter((model) => isDueThisWeek(model.nextFollowUpAt)).length;
    const unassignedCount = viewModels.filter((model) => !model.ownerId).length;
    return { overdueCount, mineCount, thisWeekCount, unassignedCount };
  }, [user?.id, viewModels]);

  const filteredContacts = useMemo(() => {
    const lower = contactSearch.trim().toLowerCase();
    if (!lower) return modalContacts.slice(0, 12);
    return modalContacts
      .filter((contact: any) => {
        const fullName = `${contact.first_name} ${contact.last_name}`.toLowerCase();
        const companyName = contact.companies?.name?.toLowerCase() || "";
        return fullName.includes(lower) || companyName.includes(lower);
      })
      .slice(0, 12);
  }, [contactSearch, modalContacts]);

  async function invalidateFollowUpData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: FOLLOW_UP_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.generic.tasks() }),
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.oppfolginger.tasks() }),
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.oppfolginger.signal() }),
      invalidateQueryGroup(queryClient, crmSummaryQueryKeys),
    ]);
  }

  const updateTaskMutation = useMutation({
    mutationFn: async ({
      taskId,
      patch,
    }: {
      taskId: string;
      patch: Partial<{
        assigned_to: string | null;
        due_date: string | null;
        status: string;
        completed_at: string | null;
        updated_at: string;
      }>;
    }) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          ...patch,
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateFollowUpData();
    },
    onError: () => {
      toast.error("Kunne ikke oppdatere oppfølging");
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        due_date: form.dueDate || null,
        contact_id: form.contactId || null,
        company_id: form.companyId || null,
        assigned_to: user?.id || null,
        created_by: user?.id || null,
        priority: "medium",
        email_notify: form.emailNotify,
        status: "open",
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateFollowUpData();
      setCreateOpen(false);
      setContactSearch("");
      setForm(EMPTY_FORM);
      toast.success("Oppfølging opprettet");
    },
    onError: () => {
      toast.error("Kunne ikke opprette oppfølging");
    },
  });

  const handleStatusChange = (model: FollowUpViewModel, nextStatus: FollowUpVisualStatus) => {
    updateTaskMutation.mutate({
      taskId: model.id,
      patch: {
        status: mapVisualStatusToTaskStatus(nextStatus),
        completed_at: nextStatus === "done" ? new Date().toISOString() : null,
      },
    });
  };

  const handleOwnerChange = (model: FollowUpViewModel, nextOwner: string) => {
    updateTaskMutation.mutate({
      taskId: model.id,
      patch: {
        assigned_to: nextOwner === "unassigned" ? null : nextOwner,
      },
    });
  };

  const handleDateChange = (model: FollowUpViewModel, nextDate: Date | undefined) => {
    updateTaskMutation.mutate({
      taskId: model.id,
      patch: {
        due_date: nextDate ? format(nextDate, "yyyy-MM-dd") : null,
      },
    });
  };

  const handleContactPick = (contact: any) => {
    setForm((current) => ({
      ...current,
      contactId: contact.id,
      companyId: contact.company_id || "",
    }));
    setContactSearch(`${contact.first_name} ${contact.last_name}`);
  };

  return (
    <div
      className="flex h-screen overflow-hidden select-none"
      style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif", background: C.bg }}
    >
      <DesignLabSidebar navigate={navigate} signOut={signOut} user={user} activePath="/design-lab/oppfolginger" />

      <main className="flex-1 flex min-w-0 flex-col overflow-hidden" style={{ zoom: SCALE_MAP[textSize], background: C.appBg }}>
        <header className="flex items-center justify-between px-6 shrink-0" style={{ height: 40, borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-baseline gap-2.5">
            <h1 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Oppfølginger</h1>
            <span style={{ fontSize: 13, color: C.textGhost, fontWeight: 500 }}>· {filtered.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <DesignLabSearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Søk oppfølginger…"
              style={{ width: 220 }}
            />
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <DesignLabPrimaryAction>
                  <Plus className="h-3.5 w-3.5" />
                  Ny oppfølging
                </DesignLabPrimaryAction>
              </DialogTrigger>
              <DesignLabModalContent title="Ny oppfølging">
                <DesignLabModalForm
                  onSubmit={(event) => {
                    event.preventDefault();
                    createMutation.mutate();
                  }}
                >
                  <DesignLabModalField>
                    <DesignLabModalLabel>Tittel</DesignLabModalLabel>
                    <DesignLabModalInput
                      autoFocus
                      value={form.title}
                      onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Hva skal følges opp?"
                    />
                  </DesignLabModalField>

                  <DesignLabModalField>
                    <DesignLabModalLabel>Kontaktperson</DesignLabModalLabel>
                    <div className="relative">
                      <DesignLabModalInput
                        ref={contactInputRef}
                        value={contactSearch}
                        onChange={(event) => {
                          setContactSearch(event.target.value);
                          if (!event.target.value) {
                            setForm((current) => ({ ...current, contactId: "", companyId: "" }));
                          }
                        }}
                        placeholder="Søk etter kontakt…"
                      />
                      {contactSearch && !form.contactId && filteredContacts.length > 0 ? (
                        <div
                          className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-[8px] border bg-white shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
                          style={{ borderColor: C.border }}
                        >
                          {filteredContacts.map((contact: any) => (
                            <button
                              key={contact.id}
                              type="button"
                              onClick={() => handleContactPick(contact)}
                              className="w-full px-3 py-2 text-left transition-colors"
                              style={{ fontSize: 12, color: C.text }}
                              onMouseEnter={(event) => {
                                event.currentTarget.style.background = C.hoverSubtle;
                              }}
                              onMouseLeave={(event) => {
                                event.currentTarget.style.background = "transparent";
                              }}
                            >
                              {contact.first_name} {contact.last_name}
                              {contact.companies?.name ? (
                                <span style={{ color: C.textMuted }}> · {contact.companies.name}</span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </DesignLabModalField>

                  <DesignLabModalField>
                    <DesignLabModalLabel>Neste oppfølging</DesignLabModalLabel>
                    <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center justify-between rounded-[6px] border px-3 text-left"
                          style={{
                            ...getDesignLabV2ActionStyle({
                              width: "100%",
                              height: 32,
                              fontSize: 13,
                              background: "#FFFFFF",
                              color: form.dueDate ? C.text : C.textFaint,
                              border: `1px solid ${C.border}`,
                            }),
                          }}
                        >
                          <span>{form.dueDate ? format(new Date(form.dueDate), "d. MMMM yyyy", { locale: nb }) : "Velg dato"}</span>
                          <CalendarIcon className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={form.dueDate ? new Date(form.dueDate) : undefined}
                          onSelect={(date) => {
                            if (!date) return;
                            setForm((current) => ({ ...current, dueDate: format(date, "yyyy-MM-dd") }));
                            setDueDateOpen(false);
                          }}
                          locale={nb}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </DesignLabModalField>

                  <DesignLabModalField>
                    <DesignLabModalLabel>Beskrivelse</DesignLabModalLabel>
                    <Textarea
                      value={form.description}
                      onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                      rows={3}
                      className="min-h-[88px] rounded-[6px]"
                    />
                  </DesignLabModalField>

                  <label className="flex items-center gap-2" style={{ fontSize: 12, color: C.text }}>
                    <Checkbox
                      checked={form.emailNotify}
                      onCheckedChange={(checked) => setForm((current) => ({ ...current, emailNotify: Boolean(checked) }))}
                    />
                    Epostvarsling ved forfall
                  </label>

                  <DesignLabModalActions>
                    <DesignLabPrimaryAction type="submit" disabled={createMutation.isPending || !form.title.trim()}>
                      {createMutation.isPending ? "Oppretter..." : "Opprett"}
                    </DesignLabPrimaryAction>
                    <DesignLabGhostAction
                      type="button"
                      onClick={() => {
                        setCreateOpen(false);
                        setContactSearch("");
                        setForm(EMPTY_FORM);
                      }}
                    >
                      Avbryt
                    </DesignLabGhostAction>
                  </DesignLabModalActions>
                </DesignLabModalForm>
              </DesignLabModalContent>
            </Dialog>
            <TextSizeControl value={textSize} onChange={setTextSize} />
          </div>
        </header>

        <div className="shrink-0" style={{ borderBottom: `1px solid ${C.border}`, padding: "8px 24px 10px" }}>
          <div className="flex items-center justify-between gap-4">
            <DesignLabFilterRow
              label="VISNING"
              options={VIEW_FILTERS}
              value={viewFilter}
              onChange={(value) => setViewFilter(value)}
            />
            <span style={{ fontSize: 12, color: C.textFaint, fontWeight: 500, whiteSpace: "nowrap" }}>
              {stats.mineCount} mine · {stats.overdueCount} forfalte · {stats.unassignedCount} uten eier
            </span>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={40} minSize={26} maxSize={58}>
              <div className="h-full overflow-y-auto" style={{ scrollbarColor: `${C.borderStrong} ${C.surfaceAlt}` }}>
                <div
                  className="grid items-center sticky top-0 z-10"
                  style={{
                    gridTemplateColumns: "minmax(0, 2.2fr) 118px 96px 92px 70px",
                    minHeight: 36,
                    padding: "0 24px",
                    borderBottom: `1px solid ${C.borderLight}`,
                    background: C.surfaceAlt,
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.01em", color: C.textMuted }}>Oppfølging</span>
                  <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.01em", color: C.textMuted }}>Status</span>
                  <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.01em", color: C.textMuted }}>Eier</span>
                  <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.01em", color: C.textMuted }}>Dato</span>
                  <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.01em", color: C.textMuted, textAlign: "right" }}>Prioritet</span>
                </div>

                {isLoading ? (
                  <div style={{ padding: "12px 24px" }}>
                    {[0, 1, 2, 3, 4].map((index) => (
                      <div
                        key={index}
                        className="animate-pulse"
                        style={{
                          height: 52,
                          borderBottom: `1px solid ${C.borderLight}`,
                          background: index % 2 === 0 ? "rgba(0,0,0,0.01)" : "transparent",
                        }}
                      />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex h-full items-center justify-center" style={{ minHeight: 280, color: C.textMuted, fontSize: 13 }}>
                    Ingen oppfølginger i denne visningen
                  </div>
                ) : (
                  filtered.map((model) => {
                    const active = selectedId === model.id;
                    return (
                      <button
                        key={model.id}
                        onClick={() => setSelectedId(model.id)}
                        className="grid w-full items-center text-left transition-colors"
                        style={{
                          gridTemplateColumns: "minmax(0, 2.2fr) 118px 96px 92px 70px",
                          minHeight: 52,
                          padding: "10px 24px",
                          borderBottom: `1px solid ${C.borderLight}`,
                          background: active ? C.selected : "transparent",
                        }}
                        onMouseEnter={(event) => {
                          if (!active) event.currentTarget.style.background = C.hoverSubtle;
                        }}
                        onMouseLeave={(event) => {
                          if (!active) event.currentTarget.style.background = "transparent";
                        }}
                      >
                        <div className="min-w-0 pr-3">
                          <p style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.25 }} className="truncate">
                            {model.title}
                          </p>
                          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }} className="truncate">
                            {rowMeta(model)}
                          </p>
                        </div>

                        <div>
                          <DesignLabReadonlyChip active={true} activeColors={STATUS_COLORS[model.status]}>
                            {model.statusLabel}
                          </DesignLabReadonlyChip>
                        </div>

                        <span style={{ fontSize: 12, color: model.ownerName ? C.text : C.textFaint, fontWeight: model.ownerName ? 500 : 400 }} className="truncate">
                          {model.ownerShortName || "Ingen"}
                        </span>

                        <span style={{ fontSize: 12, color: getDateTone(model.nextFollowUpAt), fontWeight: isOverdueDate(model.nextFollowUpAt) ? 600 : 500 }}>
                          {formatListDate(model.nextFollowUpAt)}
                        </span>

                        <div className="flex justify-end">
                          {model.priority ? (
                            <DesignLabReadonlyChip active={true} activeColors={PRIORITY_COLORS[model.priority]}>
                              {model.priority}
                            </DesignLabReadonlyChip>
                          ) : (
                            <span style={{ fontSize: 12, color: C.textFaint }}>—</span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={60} minSize={32}>
              <div className="h-full overflow-y-auto" style={{ background: C.panel }}>
                {selected ? (
                  <div className="min-h-full" style={{ borderLeft: `1px solid ${C.borderLight}` }}>
                    <div
                      className="flex items-start justify-between gap-4"
                      style={{ padding: "24px 28px 18px", borderBottom: `1px solid ${C.borderLight}` }}
                    >
                      <div className="min-w-0">
                        <h2 style={{ fontSize: 16, fontWeight: 650, color: C.text, letterSpacing: "-0.01em", lineHeight: 1.25 }}>
                          {selected.title}
                        </h2>
                        <p style={{ fontSize: 13, color: C.textMuted, marginTop: 8 }}>
                          {detailMeta(selected) || "Ingen kontakt koblet til"}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <DesignLabReadonlyChip active={true} activeColors={STATUS_COLORS[selected.status]}>
                            {selected.statusLabel}
                          </DesignLabReadonlyChip>
                          {selected.signal ? <DesignLabSignalBadge signal={selected.signal} /> : null}
                          {selected.priority ? (
                            <DesignLabReadonlyChip active={true} activeColors={PRIORITY_COLORS[selected.priority]}>
                              {selected.priority}
                            </DesignLabReadonlyChip>
                          ) : null}
                        </div>
                      </div>
                      <DesignLabGhostAction type="button" onClick={() => setSelectedId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </DesignLabGhostAction>
                    </div>

                    <div className="space-y-6" style={{ padding: "22px 28px 32px" }}>
                      <section className="grid gap-4 md:grid-cols-3">
                        <DetailField label="Status">
                          <Select value={selected.status} onValueChange={(value) => handleStatusChange(selected, value as FollowUpVisualStatus)}>
                            <SelectTrigger className="h-8 rounded-[6px] text-[12px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </DetailField>

                        <DetailField label="Eier">
                          <Select
                            value={selected.ownerId || "unassigned"}
                            onValueChange={(value) => handleOwnerChange(selected, value)}
                          >
                            <SelectTrigger className="h-8 rounded-[6px] text-[12px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Ingen eier</SelectItem>
                              {profiles.map((profile) => (
                                <SelectItem key={profile.id} value={profile.id}>
                                  {profile.full_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </DetailField>

                        <DetailField label="Neste oppfølging">
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="flex h-8 w-full items-center justify-between rounded-[6px] border px-3 text-left"
                                style={{ fontSize: 12, color: selected.nextFollowUpAt ? C.text : C.textFaint, borderColor: C.border }}
                              >
                                <span>
                                  {selected.nextFollowUpAt
                                    ? format(new Date(selected.nextFollowUpAt), "d. MMMM yyyy", { locale: nb })
                                    : "Ingen dato"}
                                </span>
                                <CalendarIcon className="h-3.5 w-3.5" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={selected.nextFollowUpAt ? new Date(selected.nextFollowUpAt) : undefined}
                                onSelect={(date) => handleDateChange(selected, date)}
                                locale={nb}
                                className="p-3 pointer-events-auto"
                              />
                              <div className="border-t px-3 py-2" style={{ borderColor: C.borderLight }}>
                                <button
                                  type="button"
                                  className="text-[12px] font-medium"
                                  style={{ color: C.textMuted }}
                                  onClick={() => handleDateChange(selected, undefined)}
                                >
                                  Fjern dato
                                </button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </DetailField>
                      </section>

                      {selected.description ? (
                        <section>
                          <SectionLabel>Beskrivelse</SectionLabel>
                          <div
                            style={{
                              marginTop: 8,
                              padding: "14px 16px",
                              borderRadius: 10,
                              border: `1px solid ${C.borderLight}`,
                              background: C.surface,
                              fontSize: 13,
                              color: C.textMuted,
                              lineHeight: 1.6,
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {selected.description}
                          </div>
                        </section>
                      ) : null}

                      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                        <div>
                          <SectionLabel>Siste aktivitet</SectionLabel>
                          <div style={{ marginTop: 8, border: `1px solid ${C.borderLight}`, borderRadius: 10, overflow: "hidden", background: C.surface }}>
                            {selectedActivities.length > 0 ? (
                              selectedActivities.map((activity, index) => (
                                <div
                                  key={`${activity.created_at}-${index}`}
                                  style={{
                                    padding: "12px 16px",
                                    borderBottom: index === selectedActivities.length - 1 ? "none" : `1px solid ${C.borderLight}`,
                                  }}
                                >
                                  <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{activity.subject}</p>
                                  <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                                    {format(new Date(activity.created_at), "d. MMM yyyy", { locale: nb })}
                                  </p>
                                  {activity.description ? (
                                    <p style={{ fontSize: 12, color: C.textFaint, marginTop: 6, lineHeight: 1.5 }}>
                                      {activity.description}
                                    </p>
                                  ) : null}
                                </div>
                              ))
                            ) : (
                              <div style={{ padding: "14px 16px", fontSize: 12, color: C.textFaint }}>
                                Ingen nyere aktivitet registrert
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <SectionLabel>Kontakt</SectionLabel>
                          <div style={{ marginTop: 8, border: `1px solid ${C.borderLight}`, borderRadius: 10, background: C.surface, padding: "14px 16px" }}>
                            <div className="space-y-2">
                              <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                                {selected.contactName || "Ingen kontakt"}
                              </p>
                              {selected.contactTitle ? (
                                <p style={{ fontSize: 12, color: C.textMuted }}>{selected.contactTitle}</p>
                              ) : null}
                              {selected.companyName ? (
                                <p style={{ fontSize: 12, color: C.textMuted }}>{selected.companyName}</p>
                              ) : null}
                              {selected.contactEmail ? (
                                <div className="flex items-center gap-2" style={{ fontSize: 12, color: C.textMuted }}>
                                  <Mail className="h-3.5 w-3.5" />
                                  <span className="truncate">{selected.contactEmail}</span>
                                </div>
                              ) : null}
                              {selected.contactPhone ? (
                                <div className="flex items-center gap-2" style={{ fontSize: 12, color: C.textMuted }}>
                                  <Phone className="h-3.5 w-3.5" />
                                  <span>{selected.contactPhone}</span>
                                </div>
                              ) : null}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              {selected.contactId ? (
                                <DesignLabSecondaryAction onClick={() => navigate(`/design-lab/kontakter?contact=${selected.contactId}`)}>
                                  Åpne kontakt
                                </DesignLabSecondaryAction>
                              ) : null}
                              {selected.companyId ? (
                                <DesignLabGhostAction onClick={() => navigate(`/design-lab/selskaper?company=${selected.companyId}`)}>
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  Åpne selskap
                                </DesignLabGhostAction>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center" style={{ color: C.textMuted, fontSize: 13 }}>
                    Velg en oppfølging for å se detaljer
                  </div>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </main>
    </div>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <SectionLabel>{label}</SectionLabel>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.03em", color: C.textMuted }}>
      {children}
    </p>
  );
}
