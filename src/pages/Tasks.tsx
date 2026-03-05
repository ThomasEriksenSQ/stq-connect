import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, CalendarDays, Circle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { format, isPast, isToday } from "date-fns";
import { nb } from "date-fns/locale";

const priorityLabels: Record<string, string> = { low: "Lav", medium: "Medium", high: "Høy" };
const priorityDots: Record<string, string> = {
  low: "text-muted-foreground/30",
  medium: "text-primary",
  high: "text-destructive",
};

const Tasks = () => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", due_date: "", company_id: "" });
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, companies(name)")
        .order("status", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").insert({
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        due_date: form.due_date || null,
        company_id: form.company_id || null,
        assigned_to: user?.id,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setOpen(false);
      setForm({ title: "", description: "", priority: "medium", due_date: "", company_id: "" });
      toast.success("Oppgave opprettet");
    },
    onError: () => toast.error("Kunne ikke opprette oppgave"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === "done" ? "open" : "done";
      const { error } = await supabase.from("tasks").update({
        status: newStatus,
        completed_at: newStatus === "done" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const openTasks = tasks.filter(t => t.status !== "done");
  const doneTasks = tasks.filter(t => t.status === "done");

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-[28px] font-bold tracking-tight">Oppgaver</h1>
          <p className="text-[15px] text-muted-foreground">
            {openTasks.length} åpne{doneTasks.length > 0 && ` · ${doneTasks.length} fullført`}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl h-10 px-4 text-[13px] font-semibold gap-2">
              <Plus className="h-4 w-4 stroke-[2]" />
              Ny oppgave
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[440px] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg">Ny oppgave</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-5 mt-4">
              <div className="space-y-2">
                <Label className="text-label">Tittel</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="h-11 rounded-xl text-[15px] bg-secondary/50" />
              </div>
              <div className="space-y-2">
                <Label className="text-label">Beskrivelse</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="rounded-xl text-[15px] bg-secondary/50 min-h-[80px]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-label">Prioritet</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger className="h-11 rounded-xl text-[15px] bg-secondary/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Lav</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">Høy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-label">Frist</Label>
                  <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="h-11 rounded-xl text-[15px] bg-secondary/50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-label">Selskap</Label>
                <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                  <SelectTrigger className="h-11 rounded-xl text-[15px] bg-secondary/50"><SelectValue placeholder="Velg selskap" /></SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full h-11 rounded-xl text-[14px] font-semibold" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Oppretter..." : "Opprett"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-[64px] rounded-2xl bg-card animate-pulse" />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-24 text-center space-y-3">
          <p className="text-[17px] font-medium text-foreground/60">Ingen oppgaver</p>
          <p className="text-[14px] text-muted-foreground">Alt er i boks 🎉</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Open */}
          {openTasks.length > 0 && (
            <div className="space-y-1">
              {openTasks.map((task) => {
                const overdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
                return (
                  <div key={task.id} className="flex items-center gap-4 px-5 py-4 rounded-2xl hover:bg-card transition-colors group">
                    <Checkbox
                      checked={false}
                      onCheckedChange={() => toggleMutation.mutate({ id: task.id, currentStatus: task.status })}
                      className="flex-shrink-0 h-5 w-5 rounded-md border-border/60"
                    />
                    <Circle className={`h-2 w-2 fill-current ${priorityDots[task.priority]} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium leading-snug">{task.title}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {(task.companies as any)?.name && (
                          <span className="text-[13px] text-muted-foreground">{(task.companies as any).name}</span>
                        )}
                        {task.due_date && (
                          <span className={`flex items-center gap-1 text-[13px] ${overdue ? 'text-destructive' : 'text-muted-foreground/60'}`}>
                            <CalendarDays className="h-3 w-3 stroke-[1.5]" />
                            {format(new Date(task.due_date), "d. MMM", { locale: nb })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Done */}
          {doneTasks.length > 0 && (
            <div className="space-y-1">
              <p className="text-label mb-2">Fullført · {doneTasks.length}</p>
              {doneTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-4 px-5 py-3 rounded-2xl opacity-40 hover:opacity-60 transition-opacity">
                  <Checkbox
                    checked={true}
                    onCheckedChange={() => toggleMutation.mutate({ id: task.id, currentStatus: task.status })}
                    className="flex-shrink-0 h-5 w-5 rounded-md"
                  />
                  <span className="text-[15px] line-through">{task.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Tasks;
