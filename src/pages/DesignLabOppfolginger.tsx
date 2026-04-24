import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { addDays, endOfWeek, format, isBefore, isToday, startOfDay } from "date-fns";
import { nb } from "date-fns/locale";
import { X } from "lucide-react";

import { ContactCardContent } from "@/components/ContactCardContent";
import { DesignLabEntitySheet } from "@/components/designlab/DesignLabEntitySheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePersistentState } from "@/hooks/usePersistentState";
import { crmQueryKeys, crmSummaryQueryKeys, invalidateQueryGroup } from "@/lib/queryKeys";
import {
  buildFollowUpViewModels,
  type FollowUpPriority,
  type FollowUpTaskRecord,
  type FollowUpViewModel,
} from "@/lib/followUpViewModel";
import { getDesignLabTextSizeStyle, type TextSize } from "@/components/designlab/TextSizeControl";
import { DesignLabMobileNavButton, DesignLabSidebar } from "@/components/designlab/DesignLabSidebar";
import { C } from "@/components/designlab/theme";
import {
  DesignLabIconButton,
} from "@/components/designlab/controls";
import { CommandPalette } from "@/components/designlab/CommandPalette";
import {
  DesignLabFilterRow,
  DesignLabReadonlyChip,
  DesignLabStatusBadge,
} from "@/components/designlab/system";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

type FollowUpViewFilter = "Alle" | "I dag" | "Denne uken" | "Neste 30 dager" | "Forfalt";

const FOLLOW_UP_QUERY_KEY = ["design-lab-follow-ups"] as const;
const FOLLOW_UP_ACTIVITY_QUERY_KEY = ["design-lab-follow-up-activities"] as const;

const VIEW_FILTERS = ["Alle", "I dag", "Denne uken", "Neste 30 dager", "Forfalt"] as const satisfies readonly FollowUpViewFilter[];

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
  P5: {
    background: "#F1E9E9",
    color: "#8C7A7A",
    border: "1px solid #E5D8D8",
    fontWeight: 500,
  },
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

function getDateTone(value: string | null) {
  if (!value) return C.textFaint;
  if (isOverdueDate(value)) return C.danger;
  if (isToday(new Date(value))) return C.accent;
  return C.textMuted;
}

export default function DesignLabOppfolginger() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { signOut, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [textSize] = usePersistentState<TextSize>("dl-text-size", "M");
  const [search, setSearch] = useState("");
  const [viewFilter, setViewFilter] = useState<FollowUpViewFilter>("Alle");
  const [ownerFilter, setOwnerFilterState] = useState("Alle");
  const ownerFilterTouched = useRef(false);
  const setOwnerFilter = (value: string) => {
    ownerFilterTouched.current = true;
    setOwnerFilterState(value);
  };
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("task"));
  const [cmdOpen, setCmdOpen] = useState(false);

  // ⌘K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: FOLLOW_UP_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, description, status, priority, due_date, assigned_to, created_by, created_at, updated_at, contact_id, company_id, email_notify, calendar_synced, contacts(id, first_name, last_name, phone, email, title, company_id, cv_email, call_list, companies(id, name, city))")
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

  const ownerOptions = useMemo(() => {
    const names = Array.from(new Set(viewModels.map((model) => model.ownerName).filter((value): value is string => Boolean(value))));
    return ["Alle", ...names.sort((left, right) => left.localeCompare(right, "nb")), "Uten eier"];
  }, [viewModels]);

  const filtered = useMemo(() => {
    const lowerSearch = search.trim().toLowerCase();
    const today = startOfDay(new Date());
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    const in30Days = addDays(today, 30);

    return viewModels
      .filter((model) => {
        if (ownerFilter === "Uten eier" && model.ownerId) return false;
        if (ownerFilter !== "Alle" && ownerFilter !== "Uten eier" && model.ownerName !== ownerFilter) return false;
        if (viewFilter === "Forfalt" && !isOverdueDate(model.nextFollowUpAt)) return false;
        if (viewFilter === "I dag") {
          if (!model.nextFollowUpAt) return false;
          if (!isToday(new Date(model.nextFollowUpAt))) return false;
        }
        if (viewFilter === "Denne uken") {
          if (!model.nextFollowUpAt) return false;
          const date = new Date(model.nextFollowUpAt);
          if (date < today || date > weekEnd) return false;
        }
        if (viewFilter === "Neste 30 dager") {
          if (!model.nextFollowUpAt) return false;
          const date = new Date(model.nextFollowUpAt);
          if (date < today || date > in30Days) return false;
        }
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
  }, [ownerFilter, search, user?.id, viewFilter, viewModels]);

  useEffect(() => {
    const paramId = searchParams.get("task");
    if (paramId !== selectedId) setSelectedId(paramId);
  }, [searchParams]);

  // Default Eier-filter til innlogget bruker når profilene er lastet
  useEffect(() => {
    if (ownerFilterTouched.current) return;
    if (!user?.id) return;
    const me = profiles.find((p) => p.id === user.id);
    if (!me?.full_name) return;
    setOwnerFilterState(me.full_name);
  }, [user?.id, profiles]);

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

  const renderMobileRow = (model: FollowUpViewModel) => {
    const active = selectedId === model.id;

    return (
      <button
        key={model.id}
        type="button"
        onClick={() => setSelectedId(model.id)}
        className="w-full text-left transition-colors"
        style={{
          padding: "14px 16px",
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
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate" style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
              {model.title}
            </p>
            <p className="truncate" style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
              {[model.contactName, model.companyName].filter(Boolean).join(" · ") || "Ingen koblet kontakt"}
            </p>
          </div>
          {model.priority ? (
            <DesignLabReadonlyChip active={true} activeColors={PRIORITY_COLORS[model.priority]}>
              {model.priority}
            </DesignLabReadonlyChip>
          ) : null}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3" style={{ fontSize: 12, color: C.textFaint }}>
          <span>{model.ownerName || "Ingen eier"}</span>
          <span style={{ color: getDateTone(model.nextFollowUpAt), fontWeight: isOverdueDate(model.nextFollowUpAt) ? 600 : 500 }}>
            {formatListDate(model.nextFollowUpAt)}
          </span>
        </div>
      </button>
    );
  };

  const stats = useMemo(() => {
    const overdueCount = viewModels.filter((model) => isOverdueDate(model.nextFollowUpAt)).length;
    const mineCount = viewModels.filter((model) => model.ownerId === user?.id).length;
    const thisWeekCount = viewModels.filter((model) => isDueThisWeek(model.nextFollowUpAt)).length;
    const unassignedCount = viewModels.filter((model) => !model.ownerId).length;
    return { overdueCount, mineCount, thisWeekCount, unassignedCount };
  }, [user?.id, viewModels]);

  async function invalidateFollowUpData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: FOLLOW_UP_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.generic.tasks() }),
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.oppfolginger.tasks() }),
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.oppfolginger.signal() }),
      invalidateQueryGroup(queryClient, crmSummaryQueryKeys),
    ]);
  }

  // ── Command palette data ──
  const paletteContacts = useMemo(() => {
    const map = new Map<string, any>();
    viewModels.forEach((vm) => {
      if (!vm.contactId || map.has(vm.contactId)) return;
      const [firstName, ...rest] = (vm.contactName || "").split(" ");
      map.set(vm.contactId, {
        id: vm.contactId,
        firstName: firstName || "",
        lastName: rest.join(" "),
        company: vm.companyName || "",
        companyId: vm.companyId,
        email: vm.contactEmail || "",
        phone: vm.contactPhone || "",
        signal: vm.signal || "",
        daysSince: 0,
      });
    });
    return Array.from(map.values());
  }, [viewModels]);

  const paletteCompanies = useMemo(() => {
    const counts = new Map<string, { id: string; name: string; contactCount: number }>();
    viewModels.forEach((vm) => {
      if (!vm.companyName) return;
      const key = vm.companyId || `name:${vm.companyName.toLowerCase()}`;
      const existing = counts.get(key);
      if (existing) {
        existing.contactCount += 1;
      } else {
        counts.set(key, { id: key, name: vm.companyName, contactCount: 1 });
      }
    });
    return Array.from(counts.values()).sort((a, b) => a.name.localeCompare(b.name, "nb"));
  }, [viewModels]);

  return (
    <div
      className="dl-shell flex h-screen overflow-hidden select-none"
      style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif", background: C.bg }}
    >
      <DesignLabSidebar navigate={navigate} signOut={signOut} user={user} activePath="/design-lab/oppfolginger" />

      <main className="flex-1 flex min-w-0 flex-col overflow-hidden" style={{ ...getDesignLabTextSizeStyle(textSize), background: C.appBg }}>
        <header className="dl-shell-header flex shrink-0 flex-wrap items-center gap-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex min-w-0 items-center gap-3">
            <DesignLabMobileNavButton navigate={navigate} signOut={signOut} user={user} activePath="/design-lab/oppfolginger" />
            <div className="flex items-baseline gap-2.5">
              <h1 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Oppfølginger</h1>
              <span style={{ fontSize: 13, color: C.textGhost, fontWeight: 500 }}>· {filtered.length}</span>
            </div>
          </div>
        </header>

        <div className="dl-filter-bar shrink-0 space-y-0" style={{ borderBottom: `1px solid ${C.border}` }}>
          <DesignLabFilterRow label="EIER" options={ownerOptions} value={ownerFilter} onChange={setOwnerFilter} />
          <div className="flex items-center justify-between gap-4">
            <DesignLabFilterRow
              label="PERIODE"
              options={VIEW_FILTERS}
              value={viewFilter}
              onChange={(value) => setViewFilter(value)}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 flex">
          {isMobile ? (
            <div className="h-full w-full overflow-y-auto">
              {isLoading ? (
                <div style={{ padding: "12px 0" }}>
                  {[0, 1, 2, 3, 4].map((index) => (
                    <div
                      key={index}
                      className="animate-pulse"
                      style={{
                        height: 72,
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
                filtered.map((model) => renderMobileRow(model))
              )}
            </div>
          ) : (
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={38} minSize={24} maxSize={60}>
              <div className="h-full overflow-y-auto" style={{ scrollbarColor: `${C.borderStrong} ${C.surfaceAlt}` }}>
                <div
                  className="grid items-center sticky top-0 z-10"
                  style={{
                    gridTemplateColumns: "minmax(220px, 1.4fr) minmax(180px, 1.2fr) minmax(220px, 1.4fr) 150px 96px 64px",
                    minHeight: 36,
                    padding: "0 24px",
                    borderBottom: `1px solid ${C.borderLight}`,
                    background: C.surfaceAlt,
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", color: C.textMuted, textTransform: "uppercase" }}>Oppfølging</span>
                  <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", color: C.textMuted, textTransform: "uppercase" }}>Kontakt</span>
                  <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", color: C.textMuted, textTransform: "uppercase" }}>Selskap</span>
                  <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", color: C.textMuted, textTransform: "uppercase" }}>Eier</span>
                  <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", color: C.textMuted, textTransform: "uppercase" }}>Dato</span>
                  <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", color: C.textMuted, textTransform: "uppercase", textAlign: "right" }}>Prioritet</span>
                </div>

                {isLoading ? (
                  <div style={{ padding: "12px 24px" }}>
                    {[0, 1, 2, 3, 4].map((index) => (
                      <div
                        key={index}
                        className="animate-pulse"
                        style={{
                          height: 38,
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
                          gridTemplateColumns: "minmax(220px, 1.4fr) minmax(180px, 1.2fr) minmax(220px, 1.4fr) 150px 96px 64px",
                          minHeight: 38,
                          padding: "4px 24px",
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
                        </div>

                        <div className="min-w-0 pr-3">
                          {model.contactName ? (
                            <p style={{ fontSize: 13, fontWeight: 400, color: C.textMuted }} className="truncate">
                              {model.contactName}
                            </p>
                          ) : (
                            <span style={{ fontSize: 13, color: C.textGhost }}>—</span>
                          )}
                        </div>

                        <div className="min-w-0 pr-3">
                          {model.companyName ? (
                            <p style={{ fontSize: 13, fontWeight: 400, color: C.textMuted }} className="truncate">
                              {model.companyName}
                            </p>
                          ) : (
                            <span style={{ fontSize: 13, color: C.textGhost }}>—</span>
                          )}
                        </div>

                        <div className="min-w-0">
                          {model.ownerName ? (
                            <DesignLabStatusBadge tone="signal">{model.ownerName}</DesignLabStatusBadge>
                          ) : (
                            <span style={{ fontSize: 12, color: C.textFaint }}>Ingen</span>
                          )}
                        </div>

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

            <ResizableHandle
              withHandle
              className="bg-transparent hover:bg-[rgba(0,0,0,0.04)] transition-colors data-[resize-handle-active]:bg-[rgba(94,106,210,0.12)]"
            />

            <ResizablePanel defaultSize={62} minSize={34}>
              {selected ? (
                <div
                  className="h-full flex flex-col"
                  style={{ background: C.panel, borderLeft: `1px solid ${C.borderLight}` }}
                >
                  <div
                    className="shrink-0 flex items-center justify-end px-4"
                    style={{ height: 32 }}
                  >
                    <DesignLabIconButton onClick={() => setSelectedId(null)} title="Lukk kontaktpanel">
                      <X style={{ width: 16, height: 16 }} />
                    </DesignLabIconButton>
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 py-5 dl-v8-theme">
                    {selected.contactId ? (
                      <ContactCardContent
                        contactId={selected.contactId}
                        editable
                        enableProfileEditMode
                        headerPaddingTop={12}
                        onDataChanged={() => {
                          void invalidateFollowUpData();
                        }}
                        defaultHidden={{
                          techDna: true,
                          notes: true,
                          consultantMatch: true,
                          linkedinIfEmpty: true,
                          locationsIfEmpty: true,
                        }}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center" style={{ color: C.textMuted, fontSize: 13 }}>
                        Denne oppfølgingen er ikke koblet til en kontakt
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className="flex h-full items-center justify-center"
                  style={{ borderLeft: `1px solid ${C.borderLight}`, background: C.appBg }}
                >
                  <p style={{ fontSize: 13, color: C.textFaint }}>
                    Trykk ⌘K for å søke.
                  </p>
                </div>
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
          )}
        </div>
      </main>
      <DesignLabEntitySheet
        open={isMobile && Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        contentClassName="dl-v8-theme"
      >
        {isMobile && selected ? (
          <div className="dl-detail-scroll">
            {selected.contactId ? (
              <ContactCardContent
                contactId={selected.contactId}
                editable
                enableProfileEditMode
                headerPaddingTop={12}
                onDataChanged={() => {
                  void invalidateFollowUpData();
                }}
                defaultHidden={{
                  techDna: true,
                  notes: true,
                  consultantMatch: true,
                  linkedinIfEmpty: true,
                  locationsIfEmpty: true,
                }}
              />
            ) : (
              <div className="flex min-h-[240px] items-center justify-center" style={{ color: C.textMuted, fontSize: 13 }}>
                Denne oppfølgingen er ikke koblet til en kontakt
              </div>
            )}
          </div>
        ) : null}
      </DesignLabEntitySheet>

      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        textSize={textSize}
        contacts={paletteContacts}
        companies={paletteCompanies}
        selectedContact={null}
        onSelectContact={(id) => {
          const task = viewModels.find((vm) => vm.contactId === id);
          if (task) setSelectedId(task.id);
        }}
        onFilterByCompany={(name) => setSearch(name)}
        onResetSearch={search ? () => setSearch("") : undefined}
      />
    </div>
  );
}
