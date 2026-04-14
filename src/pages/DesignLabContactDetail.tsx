import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Phone, Mail, Linkedin, Copy, MessageCircle, FileText,
  Check, ChevronDown, ExternalLink,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, isPast, isToday } from "date-fns";
import { nb } from "date-fns/locale";
import { toast } from "sonner";
import { getEffectiveSignal } from "@/lib/categoryUtils";

/* ── Signal system ── */
type Signal = "Behov nå" | "Fremtidig behov" | "Har kanskje behov" | "Ukjent om behov" | "Aldri aktuelt";

const SIGNAL_DOT: Record<Signal, string> = {
  "Behov nå": "bg-emerald-500",
  "Fremtidig behov": "bg-blue-500",
  "Har kanskje behov": "bg-amber-500",
  "Ukjent om behov": "bg-gray-400",
  "Aldri aktuelt": "bg-red-500",
};

const SIGNAL_BADGE: Record<Signal, string> = {
  "Behov nå": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Fremtidig behov": "bg-blue-100 text-blue-800 border-blue-200",
  "Har kanskje behov": "bg-amber-100 text-amber-800 border-amber-200",
  "Ukjent om behov": "bg-gray-100 text-gray-600 border-gray-200",
  "Aldri aktuelt": "bg-red-50 text-red-700 border-red-200",
};

const SIGNALS: Signal[] = ["Behov nå", "Fremtidig behov", "Har kanskje behov", "Ukjent om behov", "Aldri aktuelt"];

function mapSignal(raw: string | null): Signal {
  const map: Record<string, Signal> = {
    "Behov nå": "Behov nå",
    "Får fremtidig behov": "Fremtidig behov",
    "Fremtidig behov": "Fremtidig behov",
    "Får kanskje behov": "Har kanskje behov",
    "Har kanskje behov": "Har kanskje behov",
    "Ukjent om behov": "Ukjent om behov",
    "Aldri aktuelt": "Aldri aktuelt",
  };
  return map[raw || ""] || "Ukjent om behov";
}

/* ── Helpers ── */
function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("Kopiert til utklippstavle");
}

type Tab = "aktivitet" | "oppfolginger" | "konsulenter";

/* ══════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════ */

export default function DesignLabContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("aktivitet");

  // ── Fetch contact with company & owner ──
  const { data: contact, isLoading } = useQuery({
    queryKey: ["design-lab-contact", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*, companies(id, name, city), profiles:owner_id(id, full_name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // ── Fetch activities ──
  const { data: activities = [] } = useQuery({
    queryKey: ["design-lab-activities", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*, profiles:created_by(full_name)")
        .eq("contact_id", id!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // ── Fetch tasks (oppfølginger) ──
  const { data: tasks = [] } = useQuery({
    queryKey: ["design-lab-tasks", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, profiles:assigned_to(full_name)")
        .eq("contact_id", id!)
        .neq("status", "done")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // ── Compute signal ──
  const signal = useMemo(() => {
    if (!activities || !tasks) return "Ukjent om behov" as Signal;
    const effective = getEffectiveSignal(activities, tasks);
    return mapSignal(effective);
  }, [activities, tasks]);

  if (isLoading) {
    return <p className="text-muted-foreground py-12 text-center">Laster kontakt…</p>;
  }

  if (!contact) {
    return <p className="text-muted-foreground py-12 text-center">Kontakt ikke funnet</p>;
  }

  const fullName = `${contact.first_name} ${contact.last_name}`;
  const company = (contact as any).companies;
  const owner = (contact as any).profiles;
  const ownerName = owner?.full_name || "Ikke tildelt";

  const TABS: { key: Tab; label: string }[] = [
    { key: "aktivitet", label: "Aktivitet" },
    { key: "oppfolginger", label: "Oppfølginger" },
    { key: "konsulenter", label: "Konsulenter" },
  ];

  return (
    <div className="max-w-6xl">
      {/* Breadcrumb */}
      <div className="mb-5">
        <div className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
          <Link to="/design-lab/kontakter" className="hover:text-foreground transition-colors">
            Kontakter
          </Link>
          <span>›</span>
          <span className="text-foreground font-medium">{fullName}</span>
        </div>
      </div>

      {/* ── TWO COLUMN LAYOUT ── */}
      <div className="flex gap-8">
        {/* ── LEFT: Contact card (320px) ── */}
        <div className="w-[320px] shrink-0">
          {/* Avatar + Name */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-[1.5rem] font-bold text-muted-foreground mb-3">
              {initials(contact.first_name, contact.last_name)}
            </div>
            <h1 className="text-[1.25rem] font-semibold text-foreground">{fullName}</h1>
            {contact.title && (
              <p className="text-[0.8125rem] text-muted-foreground mt-0.5">{contact.title}</p>
            )}
            {company && (
              <p className="text-[0.8125rem] text-muted-foreground">{company.name}</p>
            )}

            {/* Signal badge */}
            <div className="mt-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${SIGNAL_BADGE[signal]}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${SIGNAL_DOT[signal]}`} />
                {signal}
              </span>
            </div>
          </div>

          {/* Action icons */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title="Ring"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title="E-post"
              >
                <Mail className="w-4 h-4" />
              </a>
            )}
            {contact.linkedin && (
              <a
                href={contact.linkedin.startsWith("http") ? contact.linkedin : `https://${contact.linkedin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title="LinkedIn"
              >
                <Linkedin className="w-4 h-4" />
              </a>
            )}
            {contact.email && (
              <button
                onClick={() => copyToClipboard(contact.email!)}
                className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title="Kopier e-post"
              >
                <Copy className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-border mb-4" />

          {/* Properties */}
          <div className="space-y-3">
            {contact.email && (
              <PropertyRow label="E-post">
                <div className="flex items-center gap-1.5">
                  <span className="text-[0.8125rem] text-foreground truncate">{contact.email}</span>
                </div>
              </PropertyRow>
            )}
            {contact.phone && (
              <PropertyRow label="Telefon">
                <span className="text-[0.8125rem] text-foreground">{contact.phone}</span>
              </PropertyRow>
            )}
            {(contact.location || company?.city) && (
              <PropertyRow label="Sted">
                <span className="text-[0.8125rem] text-foreground">{contact.location || company?.city}</span>
              </PropertyRow>
            )}
            {contact.department && (
              <PropertyRow label="Avdeling">
                <span className="text-[0.8125rem] text-foreground">{contact.department}</span>
              </PropertyRow>
            )}
            {company && (
              <PropertyRow label="Selskap">
                <Link to={`/selskaper/${company.id}`} className="text-[0.8125rem] text-foreground hover:text-primary transition-colors flex items-center gap-1">
                  {company.name}
                  <ExternalLink className="w-3 h-3 text-muted-foreground" />
                </Link>
              </PropertyRow>
            )}
            <PropertyRow label="Eier">
              <span className="text-[0.8125rem] text-foreground">{ownerName}</span>
            </PropertyRow>
          </div>

          {/* Status section */}
          <div className="border-t border-border mt-4 pt-4">
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-muted-foreground mb-3">Status</p>
            <div className="space-y-2">
              <StatusRow label="CV-Epost" active={contact.cv_email} />
              <StatusRow label="Innkjøper" active={contact.call_list} />
              <StatusRow label="Ikke relevant" active={contact.ikke_aktuell_kontakt || false} negative />
            </div>
          </div>

          {/* Teknisk DNA */}
          {contact.teknologier && contact.teknologier.length > 0 && (
            <div className="border-t border-border mt-4 pt-4">
              <p className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-muted-foreground mb-3">Teknisk DNA</p>
              <div className="flex flex-wrap gap-1.5">
                {contact.teknologier.map((tag: string) => (
                  <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notat */}
          {contact.notes && (
            <div className="border-t border-border mt-4 pt-4">
              <p className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-muted-foreground mb-2">Notat</p>
              <p className="text-[0.8125rem] text-foreground/70 leading-relaxed whitespace-pre-wrap">{contact.notes}</p>
            </div>
          )}
        </div>

        {/* ── RIGHT: Tabbed content ── */}
        <div className="flex-1 min-w-0">
          {/* Tabs */}
          <div className="flex items-center border-b border-border mb-5">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-[0.8125rem] font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab.key
                    ? "text-foreground border-foreground"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                {tab.label}
                {tab.key === "oppfolginger" && tasks.length > 0 && (
                  <span className="ml-1.5 text-[0.6875rem] text-muted-foreground">{tasks.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "aktivitet" && (
            <ActivityTab activities={activities} />
          )}
          {activeTab === "oppfolginger" && (
            <TasksTab tasks={tasks} />
          )}
          {activeTab === "konsulenter" && (
            <ConsultantsTab contactId={id!} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   SUB-COMPONENTS
   ══════════════════════════════════════════ */

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[0.6875rem] font-medium text-muted-foreground mb-0.5">{label}</p>
      {children}
    </div>
  );
}

function StatusRow({ label, active, negative }: { label: string; active: boolean; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[0.8125rem] text-foreground">{label}</span>
      {active ? (
        <span className={`text-[0.75rem] font-medium ${negative ? "text-destructive" : "text-emerald-600"}`}>
          {negative ? "Ja" : "✓"}
        </span>
      ) : (
        <span className="text-[0.75rem] text-muted-foreground">—</span>
      )}
    </div>
  );
}

/* ── Activity Tab ── */
function ActivityTab({ activities }: { activities: any[] }) {
  // Group by month
  const grouped = useMemo(() => {
    const groups: Record<string, typeof activities> = {};
    activities.forEach((a) => {
      const key = format(new Date(a.created_at), "MMMM yyyy", { locale: nb });
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    });
    return groups;
  }, [activities]);

  if (activities.length === 0) {
    return <p className="text-[0.8125rem] text-muted-foreground py-8 text-center">Ingen aktiviteter registrert</p>;
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([month, items]) => (
        <div key={month}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[0.8125rem] font-bold tracking-[0.04em] text-foreground capitalize">{month}</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="relative pl-8 space-y-4">
            {/* Vertical line */}
            <div className="absolute left-[5px] top-[5px] bottom-0 w-[2px] bg-border" />
            {items.map((activity: any) => {
              const isCall = activity.type === "call" || activity.type === "samtale";
              const isMeeting = activity.type === "meeting" || activity.type === "møte";
              return (
                <div key={activity.id} className="relative">
                  {/* Dot on line */}
                  <div className="absolute -left-8 top-[2px] w-[12px] h-[12px] bg-background rounded-full flex items-center justify-center">
                    {isCall ? (
                      <MessageCircle className="w-3 h-3 text-[hsl(var(--success))]" />
                    ) : isMeeting ? (
                      <FileText className="w-3 h-3 text-primary" />
                    ) : (
                      <Mail className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-[1.0625rem] font-bold text-foreground">{activity.subject}</p>
                    {activity.description && (
                      <p className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-foreground/70 mt-0.5">
                        {activity.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[0.8125rem] text-muted-foreground">
                        {format(new Date(activity.created_at), "d. MMM yyyy", { locale: nb })}
                      </span>
                      {(activity as any).profiles?.full_name && (
                        <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[0.6875rem] font-medium">
                          {(activity as any).profiles.full_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Tasks Tab ── */
function TasksTab({ tasks }: { tasks: any[] }) {
  if (tasks.length === 0) {
    return <p className="text-[0.8125rem] text-muted-foreground py-8 text-center">Ingen oppfølginger</p>;
  }

  return (
    <div className="space-y-3">
      {tasks.map((task: any) => {
        const due = task.due_date ? new Date(task.due_date) : null;
        const overdue = due && isPast(due) && !isToday(due);
        const today = due && isToday(due);
        return (
          <div key={task.id} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[1rem] font-bold text-foreground">{task.title}</p>
                {task.description && (
                  <p className="text-[0.8125rem] text-muted-foreground mt-0.5">{task.description}</p>
                )}
              </div>
              {due && (
                <span className={`text-[0.8125rem] font-medium shrink-0 ml-3 ${
                  overdue ? "text-destructive" : today ? "text-[hsl(var(--warning))]" : "text-muted-foreground"
                }`}>
                  {format(due, "d. MMM yyyy", { locale: nb })}
                </span>
              )}
            </div>
            {(task as any).profiles?.full_name && (
              <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[0.6875rem] font-medium mt-2">
                {(task as any).profiles.full_name}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Consultants Tab (placeholder — uses match-consultants edge function) ── */
function ConsultantsTab({ contactId }: { contactId: string }) {
  const { data: matches, isLoading } = useQuery({
    queryKey: ["design-lab-consultant-match", contactId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("match-contact-to-consultants", {
        body: { contact_id: contactId },
      });
      if (error) throw error;
      return (data?.matches || []) as Array<{
        id: number | string;
        navn: string;
        score: number;
        begrunnelse: string;
        match_tags: string[];
      }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return <p className="text-[0.8125rem] text-muted-foreground py-8 text-center">Finner konsulenter…</p>;
  }

  if (!matches || matches.length === 0) {
    return <p className="text-[0.8125rem] text-muted-foreground py-8 text-center">Ingen konsulentmatcher funnet</p>;
  }

  return (
    <div className="space-y-3">
      {matches.slice(0, 5).map((m) => (
        <div key={m.id} className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[1rem] font-bold text-foreground">{m.navn}</p>
            <span className={`text-[0.8125rem] font-semibold ${
              m.score >= 8 ? "text-emerald-600" : m.score >= 6 ? "text-amber-600" : "text-muted-foreground"
            }`}>
              {m.score}/10
            </span>
          </div>
          <p className="text-[0.8125rem] text-foreground/70 mb-2">{m.begrunnelse}</p>
          {m.match_tags && m.match_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {m.match_tags.map((tag) => (
                <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
