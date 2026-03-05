import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const Companies = () => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", org_number: "", industry: "", phone: "", email: "", city: "" });
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("companies").insert({
        ...form,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setOpen(false);
      setForm({ name: "", org_number: "", industry: "", phone: "", email: "", city: "" });
      toast.success("Selskap opprettet");
    },
    onError: () => toast.error("Kunne ikke opprette selskap"),
  });

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.industry?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Selskaper</h1>
          <p className="text-muted-foreground">Administrer dine selskaper og kunder</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nytt selskap</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Opprett nytt selskap</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Navn *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Org.nr</Label>
                  <Input value={form.org_number} onChange={(e) => setForm({ ...form, org_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Bransje</Label>
                  <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefon</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>E-post</Label>
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>By</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Oppretter..." : "Opprett selskap"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Søk etter selskaper..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Laster...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">Ingen selskaper funnet</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Navn</TableHead>
                <TableHead>Bransje</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>E-post</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((company) => (
                <TableRow key={company.id} className="cursor-pointer">
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell>{company.industry || "—"}</TableCell>
                  <TableCell>{company.city || "—"}</TableCell>
                  <TableCell>{company.phone || "—"}</TableCell>
                  <TableCell>{company.email || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};

export default Companies;
