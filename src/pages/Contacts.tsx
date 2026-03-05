import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const Contacts = () => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", title: "", company_id: "" });
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*, companies(name)")
        .order("first_name");
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
    const q = search.toLowerCase();
    return `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      (c.companies as any)?.name?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-[1.75rem] font-bold">Kontakter</h1>
          <p className="text-[0.9375rem] text-muted-foreground">{contacts.length} kontakter</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl h-10 px-4 text-[0.8125rem] font-semibold gap-2">
              <Plus className="h-4 w-4 stroke-[2]" />
              Ny kontakt
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[440px] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg">Ny kontakt</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-5 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-label">Fornavn</Label>
                  <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required className="h-11 rounded-xl text-[0.9375rem] bg-secondary/50" />
                </div>
                <div className="space-y-2">
                  <Label className="text-label">Etternavn</Label>
                  <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required className="h-11 rounded-xl text-[0.9375rem] bg-secondary/50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-label">Selskap</Label>
                <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                  <SelectTrigger className="h-11 rounded-xl text-[0.9375rem] bg-secondary/50"><SelectValue placeholder="Velg selskap" /></SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-label">Stilling</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-11 rounded-xl text-[0.9375rem] bg-secondary/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-label">E-post</Label>
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" className="h-11 rounded-xl text-[0.9375rem] bg-secondary/50" />
                </div>
                <div className="space-y-2">
                  <Label className="text-label">Telefon</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-11 rounded-xl text-[0.9375rem] bg-secondary/50" />
                </div>
              </div>
              <Button type="submit" className="w-full h-11 rounded-xl text-[0.875rem] font-semibold" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Oppretter..." : "Opprett"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 stroke-[1.5]" />
        <Input
          placeholder="Søk etter navn, e-post eller selskap..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-11 h-11 rounded-xl bg-card border-border/40 text-[0.9375rem] placeholder:text-muted-foreground/40"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-[72px] rounded-2xl bg-card animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-24 text-center space-y-3">
          <p className="text-[1.0625rem] font-medium text-foreground/60">Ingen kontakter funnet</p>
          <p className="text-[0.875rem] text-muted-foreground">Opprett din første kontakt</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((contact) => (
            <button
              key={contact.id}
              onClick={() => navigate(`/kontakter/${contact.id}`)}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl hover:bg-card active:bg-accent transition-colors duration-150 group text-left"
            >
              <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-[0.8125rem] font-semibold text-primary">
                  {contact.first_name[0]}{contact.last_name[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[0.9375rem] font-medium text-foreground truncate">
                  {contact.first_name} {contact.last_name}
                </p>
                <p className="text-[0.8125rem] text-muted-foreground truncate mt-0.5">
                  {[contact.title, (contact.companies as any)?.name].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <div className="hidden md:flex items-center gap-6 flex-shrink-0">
                {contact.email && (
                  <span className="text-[0.8125rem] text-muted-foreground/60 max-w-[180px] truncate">{contact.email}</span>
                )}
                {contact.phone && (
                  <span className="text-[0.8125rem] text-muted-foreground/40 text-mono w-[100px] text-right">{contact.phone}</span>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-muted-foreground/60 transition-colors flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Contacts;
