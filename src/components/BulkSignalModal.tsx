import { useState } from "react";
import { Sparkles, Check, SkipForward, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { analyzeSignal, type AiSignalResult } from "@/lib/aiSignal";
import { getEffectiveSignal, getSignalBadgeStyle, upsertTaskSignalDescription } from "@/lib/categoryUtils";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

interface ResultRow {
  contactId: string;
  contactName: string;
  companyName: string | null;
  companyId: string | null;
  currentSignal: string | null;
  result: AiSignalResult;
  status: "pending" | "approved" | "skipped";
}

interface BulkSignalModalProps {
  open: boolean;
  onClose: () => void;
}

export function BulkSignalModal({ open, onClose }: BulkSignalModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<ResultRow[]>([]);
  const [finished, setFinished] = useState(false);

  const start = async () => {
    setRunning(true);
    setResults([]);
    setFinished(false);

    // Fetch top 20 contacts by updated_at
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, company_id, companies(name)")
      .neq("status", "deleted")
      .order("updated_at", { ascending: false })
      .limit(20);

    if (!contacts || contacts.length === 0) {
      setRunning(false);
      setFinished(true);
      return;
    }

    const contactIds = contacts.map((c) => c.id);
    setProgress({ done: 0, total: contacts.length });

    // Batch fetch activities and tasks for all contacts
    const [{ data: acts }, { data: tasks }] = await Promise.all([
      supabase
        .from("activities")
        .select("contact_id, type, subject, created_at, description")
        .in("contact_id", contactIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("tasks")
        .select("contact_id, due_date, status, title, description, created_at")
        .in("contact_id", contactIds)
        .neq("status", "done"),
    ]);

    const actsMap: Record<string, typeof acts> = {};
    const tasksMap: Record<string, typeof tasks> = {};
    (acts || []).forEach((a) => {
      if (a.contact_id) {
        if (!actsMap[a.contact_id]) actsMap[a.contact_id] = [];
        actsMap[a.contact_id]!.push(a);
      }
    });
    (tasks || []).forEach((t) => {
      if (t.contact_id) {
        if (!tasksMap[t.contact_id]) tasksMap[t.contact_id] = [];
        tasksMap[t.contact_id]!.push(t);
      }
    });

    const newResults: ResultRow[] = [];

    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i];
      const contactName = `${c.first_name} ${c.last_name}`;
      const contactActs = (actsMap[c.id] || []).map((a: any) => ({
        type: a.type,
        subject: a.subject,
        created_at: a.created_at,
      }));
      const contactTasks = tasksMap[c.id] || [];
      const currentSignal = getEffectiveSignal(
        (actsMap[c.id] || []).map((a: any) => ({
          created_at: a.created_at,
          subject: a.subject,
          description: a.description,
        })),
        (contactTasks || []).map((t: any) => ({
          created_at: t.created_at,
          title: t.title,
          description: t.description,
          due_date: t.due_date,
        })),
      );

      const lastTaskDue =
        contactTasks.length > 0
          ? contactTasks.reduce(
              (best: string | null, t: any) => (!best || (t.due_date && t.due_date > best) ? t.due_date : best),
              null,
            )
          : null;

      const result = await analyzeSignal({
        currentSignal,
        activities: contactActs.slice(0, 5),
        lastTaskDueDate: lastTaskDue,
        contactName,
      });

      if (result && result.anbefalt_signal !== currentSignal) {
        newResults.push({
          contactId: c.id,
          contactName,
          companyName: (c.companies as any)?.name || null,
          companyId: c.company_id,
          currentSignal,
          result,
          status: "pending",
        });
      }

      setProgress({ done: i + 1, total: contacts.length });
      setResults([...newResults]);

      // Delay between calls to avoid rate limiting
      if (i < contacts.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    setRunning(false);
    setFinished(true);
  };

  const approveRow = async (row: ResultRow) => {
    const { data: existingTasks, error: taskLookupError } = await supabase
      .from("tasks")
      .select("id, description, due_date")
      .eq("contact_id", row.contactId)
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(1);
    if (taskLookupError) {
      toast.error("Kunne ikke oppdatere");
      return;
    }

    const primaryTask = existingTasks?.[0];
    if (primaryTask) {
      const { error } = await supabase
        .from("tasks")
        .update({
          description: upsertTaskSignalDescription(
            primaryTask.description,
            row.result.anbefalt_signal,
            !primaryTask.due_date,
          ),
          updated_at: new Date().toISOString(),
        })
        .eq("id", primaryTask.id);
      if (error) {
        toast.error("Kunne ikke oppdatere");
        return;
      }
    } else {
      const { error } = await supabase.from("tasks").insert({
        title: "Følg opp om behov",
        description: upsertTaskSignalDescription(null, row.result.anbefalt_signal, true),
        priority: "medium",
        due_date: null,
        contact_id: row.contactId,
        company_id: row.companyId,
        assigned_to: user?.id,
        created_by: user?.id,
      });
      if (error) {
        toast.error("Kunne ikke oppdatere");
        return;
      }
    }

    setResults((prev) => prev.map((r) => (r.contactId === row.contactId ? { ...r, status: "approved" } : r)));
  };

  const skipRow = (contactId: string) => {
    setResults((prev) => prev.map((r) => (r.contactId === contactId ? { ...r, status: "skipped" } : r)));
  };

  const approveAll = async () => {
    const pending = results.filter((r) => r.status === "pending");
    for (const row of pending) {
      await approveRow(row);
    }
    queryClient.invalidateQueries({ queryKey: ["contacts-full"] });
    queryClient.invalidateQueries({ queryKey: ["companies-full"] });
    queryClient.invalidateQueries({ queryKey: ["oppfolginger-tasks-v1"] });
    queryClient.invalidateQueries({ queryKey: ["oppfolginger-signal-v1"] });
    toast.success(`${pending.length} signaler oppdatert`);
  };

  const handleClose = () => {
    if (results.some((r) => r.status === "approved")) {
      queryClient.invalidateQueries({ queryKey: ["contacts-full"] });
      queryClient.invalidateQueries({ queryKey: ["companies-full"] });
      queryClient.invalidateQueries({ queryKey: ["oppfolginger-tasks-v1"] });
      queryClient.invalidateQueries({ queryKey: ["oppfolginger-signal-v1"] });
    }
    onClose();
    // Reset state after animation
    setTimeout(() => {
      setRunning(false);
      setProgress({ done: 0, total: 0 });
      setResults([]);
      setFinished(false);
    }, 300);
  };

  const pendingCount = results.filter((r) => r.status === "pending").length;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent
        className="max-w-lg rounded-xl p-6 gap-0 max-h-[80vh] flex flex-col"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between mb-4">
          <DialogTitle className="text-[1.125rem] font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-primary" />
            AI signal-gjennomgang
          </DialogTitle>
        </div>

        {!running && !finished && (
          <div className="space-y-3">
            <p className="text-[0.875rem] text-muted-foreground">
              Analyser de 20 sist oppdaterte kontaktene og få AI-anbefalinger for salgssignal.
            </p>
            <button
              onClick={start}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Start analyse
            </button>
          </div>
        )}

        {running && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-[0.875rem] text-foreground font-medium">
                {progress.done}/{progress.total} analysert...
              </span>
            </div>
            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="flex-1 overflow-y-auto mt-3 space-y-2 min-h-0">
            {results.map((row) => (
              <div
                key={row.contactId}
                className={cn(
                  "rounded-lg border px-3 py-2.5 transition-opacity",
                  row.status === "approved" && "opacity-50 border-emerald-200 bg-emerald-50/30",
                  row.status === "skipped" && "opacity-30",
                  row.status === "pending" && "border-border bg-card",
                )}
              >
                <p className="text-[0.875rem] font-semibold text-foreground">{row.contactName}</p>
                {row.companyName && <p className="text-[0.75rem] text-muted-foreground">{row.companyName}</p>}
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className="inline-flex items-center rounded-[6px] border px-2.5 py-0.5 text-[0.75rem] font-medium h-7"
                    style={getSignalBadgeStyle(row.currentSignal || "")}
                  >
                    {row.currentSignal || "—"}
                  </span>
                  <span className="text-muted-foreground text-[0.75rem]">→</span>
                  <span
                    className="inline-flex items-center rounded-[6px] border px-2.5 py-0.5 text-[0.75rem] font-medium h-7"
                    style={getSignalBadgeStyle(row.result.anbefalt_signal)}
                  >
                    {row.result.anbefalt_signal}
                  </span>
                </div>
                <p className="text-[0.75rem] text-muted-foreground mt-0.5 italic">"{row.result.begrunnelse}"</p>
                {row.status === "pending" && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      onClick={() => approveRow(row)}
                      className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      <Check className="h-3 w-3" />
                      Godkjenn
                    </button>
                    <button
                      onClick={() => skipRow(row.contactId)}
                      className="inline-flex items-center gap-1 text-[0.75rem] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <SkipForward className="h-3 w-3" />
                      Hopp over
                    </button>
                  </div>
                )}
                {row.status === "approved" && (
                  <p className="text-[0.75rem] text-emerald-600 font-medium mt-1">✓ Godkjent</p>
                )}
              </div>
            ))}
          </div>
        )}

        {finished && results.length === 0 && (
          <p className="text-[0.875rem] text-muted-foreground mt-3">
            Alle kontakter har korrekt signal — ingen endringer foreslått.
          </p>
        )}

        {finished && pendingCount > 0 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
            <span className="text-[0.8125rem] text-muted-foreground">{pendingCount} venter på godkjenning</span>
            <button
              onClick={approveAll}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Check className="h-3.5 w-3.5" />
              Godkjenn alle ({pendingCount})
            </button>
          </div>
        )}

        {finished && pendingCount === 0 && results.length > 0 && (
          <div className="flex justify-end mt-4 pt-3 border-t border-border">
            <button
              onClick={handleClose}
              className="text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors"
            >
              Lukk
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
