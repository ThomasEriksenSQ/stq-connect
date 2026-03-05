import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const Contacts = () => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", title: "", company_id: "" });
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*, companies(name)")
        .order("created_at", { ascending: false });
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
      const { error } = await supabase.from("contacts").insert({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email || null,
        phone: form.phone || null,
        title: form.title || null,
        company_id: form.company_id || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setOpen(false);
      setForm({ first_name: "", last_name: "", email: "", phone: "", title: "", company_id: "" });
      toast.success("Kontakt opprettet");
    },
    onError: () => toast.error("Kunne ikke opprette kontakt"),
  });

  const filtered = contacts.filter((c) => {
    const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
    return fullName.includes(search.toLowerCase()) || (c.email?.toLowerCase().includes(search.toLowerCase()));
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kontakter</h1>
          <p className="text-muted-foreground">Administrer kontaktpersoner</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Ny kontakt</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Opprett ny kontakt</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fornavn *</Label>
                  <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Etternavn *</Label>
                  <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
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
              <div className="space-y-2">
                <Label>Stilling</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>E-post</Label>
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Telefon</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Oppretter..." : "Opprett kontakt"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Søk etter kontakter..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Laster...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">Ingen kontakter funnet</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Navn</TableHead>
                <TableHead>Selskap</TableHead>
                <TableHead>Stilling</TableHead>
                <TableHead>E-post</TableHead>
                <TableHead>Telefon</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((contact) => (
                <TableRow key={contact.id} className="cursor-pointer">
                  <TableCell className="font-medium">{contact.first_name} {contact.last_name}</TableCell>
                  <TableCell>{(contact.companies as any)?.name || "—"}</TableCell>
                  <TableCell>{contact.title || "—"}</TableCell>
                  <TableCell>{contact.email || "—"}</TableCell>
                  <TableCell>{contact.phone || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};

export default Contacts;
