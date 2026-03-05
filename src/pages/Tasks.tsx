import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

const priorityLabels: Record<string, string> = { low: "Lav", medium: "Medium", high: "Høy" };
const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-primary/10 text-primary",
  high: "bg-destructive/10 text-destructive",
};

const Tasks = () => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", due_date: "", company_id: "", contact_id: "" });
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, companies(name), contacts(first_name, last_name)")
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
        contact_id: form.contact_id || null,
        assigned_to: user?.id,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setOpen(false);
      setForm({ title: "", description: "", priority: "medium", due_date: "", company_id: "", contact_id: "" });
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Oppgaver</h1>
          <p className="text-muted-foreground">Hold oversikt over alle oppgaver</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Ny oppgave</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Opprett ny oppgave</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Tittel *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Beskrivelse</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prioritet</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Lav</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">Høy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Forfallsdato</Label>
                  <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Selskap</Label>
                <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Velg selskap" /></SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Oppretter..." : "Opprett oppgave"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Laster...</p>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckSquare className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">Ingen oppgaver</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <Card key={task.id} className={task.status === "done" ? "opacity-60" : ""}>
              <CardContent className="flex items-center gap-4 py-3">
                <Checkbox
                  checked={task.status === "done"}
                  onCheckedChange={() => toggleMutation.mutate({ id: task.id, currentStatus: task.status })}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${task.status === "done" ? "line-through" : ""}`}>{task.title}</span>
                    <Badge className={priorityColors[task.priority]}>{priorityLabels[task.priority]}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {(task.companies as any)?.name && <span>{(task.companies as any).name}</span>}
                    {task.due_date && (
                      <span>Frist: {format(new Date(task.due_date), "d. MMM yyyy", { locale: nb })}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Tasks;
