import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Building2, Mail, Phone, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type SortField = "name" | "company" | "title" | "owner" | "email";
type SortDir = "asc" | "desc";

const Contacts = () => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", title: "", company_id: "" });
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "name", dir: "asc" });
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*, companies(name), profiles!contacts_owner_id_fkey(full_name)")
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
        owner_id: user?.id,
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
      (c.companies as any)?.name?.toLowerCase().includes(q) ||
      c.title?.toLowerCase().includes(q);
  });

  const getOwnerFirstName = (contact: any) => {
    const fullName = (contact.profiles as any)?.full_name;
    return fullName ? fullName.split(" ")[0] : null;
  };

  const sorted = [...filtered].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    switch (sort.field) {
      case "name":
        return dir * `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, "nb");
      case "company":
        return dir * ((a.companies as any)?.name || "").localeCompare((b.companies as any)?.name || "", "nb");
      case "title":
        return dir * (a.title || "").localeCompare(b.title || "", "nb");
      case "owner":
        return dir * (getOwnerFirstName(a) || "").localeCompare(getOwnerFirstName(b) || "", "nb");
      case "email":
        return dir * (a.email || "").localeCompare(b.email || "", "nb");
      default:
        return 0;
    }
  });

  const toggleSort = (field: SortField) => {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" }
    );
  };

  const SortHeader = ({ field, children, className = "" }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <button
      onClick={() => toggleSort(field)}
      className={`flex items-center gap-1 text-[0.75rem] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      {children}
      <ArrowUpDown className={`h-3 w-3 ${sort.field === field ? "text-foreground" : "text-muted-foreground/30"}`} />
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-[1.75rem] font-bold tracking-tight">Kontakter</h1>
          <p className="text-[0.875rem] text-muted-foreground">{contacts.length} totalt</p>
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 stroke-[1.5]" />
        <Input
          placeholder="Søk etter navn, e-post, stilling eller selskap..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-11 h-11 rounded-xl bg-card border-border/40 text-[0.9375rem] placeholder:text-muted-foreground/40"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-[52px] rounded-xl bg-secondary/50 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-24 text-center space-y-3">
          <p className="text-[1.0625rem] font-medium text-foreground/60">Ingen kontakter funnet</p>
          <p className="text-[0.875rem] text-muted-foreground">Opprett din første kontakt for å komme i gang</p>
        </div>
      ) : (
        <div className="border border-border/40 rounded-2xl overflow-hidden bg-card">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_160px_140px_160px_100px] gap-4 px-5 py-3 border-b border-border/40 bg-secondary/30">
            <SortHeader field="name">Navn</SortHeader>
            <SortHeader field="company">Selskap</SortHeader>
            <SortHeader field="title">Stilling</SortHeader>
            <SortHeader field="email">E-post</SortHeader>
            <span className="text-[0.75rem] font-medium uppercase tracking-wider text-muted-foreground text-right">Telefon</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border/30">
            {sorted.map((contact) => {
              const companyName = (contact.companies as any)?.name;
              const flags = [
                contact.call_list && "Innkjøper",
                contact.cv_email && "CV-Epost",
              ].filter(Boolean);

              return (
                <button
                  key={contact.id}
                  onClick={() => navigate(`/kontakter/${contact.id}`)}
                  className="w-full grid grid-cols-[1fr_160px_140px_160px_100px] gap-4 items-center px-5 py-3.5 hover:bg-accent/50 active:bg-accent transition-colors duration-100 text-left group"
                >
                  {/* Name + flags */}
                  <div className="min-w-0">
                    <p className="text-[0.875rem] font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {contact.first_name} {contact.last_name}
                    </p>
                    {flags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {flags.map((f) => (
                          <Badge key={f} variant="outline" className="text-[0.625rem] font-medium px-1.5 py-0 rounded bg-primary/5 text-primary border-primary/15">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Company */}
                  <div className="min-w-0">
                    {companyName ? (
                      <span className="flex items-center gap-1 text-[0.8125rem] text-muted-foreground truncate">
                        <Building2 className="h-3 w-3 flex-shrink-0 stroke-[1.5]" />
                        {companyName}
                      </span>
                    ) : (
                      <span className="text-[0.8125rem] text-muted-foreground/30">—</span>
                    )}
                  </div>

                  {/* Title */}
                  <div className="min-w-0">
                    <span className="text-[0.8125rem] text-muted-foreground truncate block">
                      {contact.title || <span className="text-muted-foreground/30">—</span>}
                    </span>
                  </div>

                  {/* Email */}
                  <div className="min-w-0">
                    {contact.email ? (
                      <span className="flex items-center gap-1 text-[0.8125rem] text-muted-foreground/70 truncate">
                        <Mail className="h-3 w-3 flex-shrink-0 stroke-[1.5]" />
                        {contact.email}
                      </span>
                    ) : (
                      <span className="text-[0.8125rem] text-muted-foreground/30">—</span>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="text-right min-w-0">
                    {contact.phone ? (
                      <span className="inline-flex items-center gap-1 text-[0.8125rem] text-muted-foreground/60">
                        <Phone className="h-3 w-3 flex-shrink-0 stroke-[1.5]" />
                        {contact.phone}
                      </span>
                    ) : (
                      <span className="text-[0.8125rem] text-muted-foreground/30">—</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Contacts;
