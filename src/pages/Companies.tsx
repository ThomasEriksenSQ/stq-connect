import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, MapPin, Globe, Users, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type SortField = "name" | "city" | "status" | "owner" | "contacts";
type SortDir = "asc" | "desc";

const statusLabels: Record<string, { label: string; className: string }> = {
  lead: { label: "Lead", className: "bg-primary/10 text-primary border-primary/20" },
  prospect: { label: "Prospekt", className: "bg-warning/10 text-warning border-warning/20" },
  customer: { label: "Kunde", className: "bg-success/10 text-success border-success/20" },
  churned: { label: "Tapt", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const Companies = () => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", org_number: "", city: "", website: "", linkedin: "" });
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "name", dir: "asc" });
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*, contacts(id), profiles!companies_owner_id_fkey(full_name)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("companies").insert({
        name: form.name,
        org_number: form.org_number || null,
        city: form.city || null,
        website: form.website || null,
        linkedin: form.linkedin || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setOpen(false);
      setForm({ name: "", org_number: "", city: "", website: "", linkedin: "" });
      toast.success("Selskap opprettet");
    },
    onError: () => toast.error("Kunne ikke opprette selskap"),
  });

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.city?.toLowerCase().includes(search.toLowerCase()) ||
    c.org_number?.includes(search)
  );

  const getOwnerFirstName = (company: any) => {
    const fullName = (company.profiles as any)?.full_name;
    return fullName ? fullName.split(" ")[0] : null;
  };

  const sorted = [...filtered].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    switch (sort.field) {
      case "name":
        return dir * a.name.localeCompare(b.name, "nb");
      case "city":
        return dir * (a.city || "").localeCompare(b.city || "", "nb");
      case "status":
        return dir * (a.status || "").localeCompare(b.status || "", "nb");
      case "owner":
        return dir * (getOwnerFirstName(a) || "").localeCompare(getOwnerFirstName(b) || "", "nb");
      case "contacts":
        return dir * ((a.contacts?.length || 0) - (b.contacts?.length || 0));
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

  const getStatus = (status: string) => {
    const s = statusLabels[status] || { label: status, className: "bg-secondary text-secondary-foreground border-border" };
    return s;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-[1.75rem] font-bold tracking-tight">Selskaper</h1>
          <p className="text-[0.875rem] text-muted-foreground">{companies.length} totalt</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl h-10 px-4 text-[0.8125rem] font-semibold gap-2">
              <Plus className="h-4 w-4 stroke-[2]" />
              Nytt selskap
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[440px] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg">Nytt selskap</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-5 mt-4">
              <div className="space-y-2">
                <Label className="text-label">Selskapsnavn</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Firmanavn AS" className="h-11 rounded-xl text-[0.9375rem] bg-secondary/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-label">Org.nr</Label>
                  <Input value={form.org_number} onChange={(e) => setForm({ ...form, org_number: e.target.value })} placeholder="923 456 789" className="h-11 rounded-xl text-[0.9375rem] bg-secondary/50" />
                </div>
                <div className="space-y-2">
                  <Label className="text-label">Sted</Label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Oslo" className="h-11 rounded-xl text-[0.9375rem] bg-secondary/50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-label">Nettside</Label>
                <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" className="h-11 rounded-xl text-[0.9375rem] bg-secondary/50" type="url" />
              </div>
              <div className="space-y-2">
                <Label className="text-label">LinkedIn</Label>
                <Input value={form.linkedin} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} placeholder="https://linkedin.com/company/..." className="h-11 rounded-xl text-[0.9375rem] bg-secondary/50" type="url" />
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
          placeholder="Søk etter selskap, sted eller org.nr..."
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
          <p className="text-[1.0625rem] font-medium text-foreground/60">Ingen selskaper funnet</p>
          <p className="text-[0.875rem] text-muted-foreground">Opprett ditt første selskap for å komme i gang</p>
        </div>
      ) : (
        <div className="border border-border/40 rounded-2xl overflow-hidden bg-card">
          {/* Column headers */}
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_90px_80px_70px] gap-4 px-5 py-3 border-b border-border/40 bg-secondary/30">
            <SortHeader field="name">Selskap</SortHeader>
            <SortHeader field="city">Sted</SortHeader>
            <SortHeader field="status">Status</SortHeader>
            <SortHeader field="owner">Eier</SortHeader>
            <SortHeader field="contacts" className="justify-end">Kontakter</SortHeader>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border/30">
            {sorted.map((company) => {
              const status = getStatus(company.status);
              const contactCount = company.contacts?.length || 0;
              const ownerName = getOwnerFirstName(company);
              return (
                <button
                  key={company.id}
                  onClick={() => navigate(`/selskaper/${company.id}`)}
                  className="w-full grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_90px_80px_70px] gap-4 items-center px-5 py-3.5 hover:bg-accent/50 active:bg-accent transition-colors duration-100 text-left group"
                >
                  {/* Name + website */}
                  <div className="min-w-0">
                    <p className="text-[0.875rem] font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {company.name}
                    </p>
                    {company.website && (
                      <span className="flex items-center gap-1 text-[0.75rem] text-muted-foreground/60 mt-0.5 truncate">
                        <Globe className="h-3 w-3 flex-shrink-0" />
                        {company.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                      </span>
                    )}
                  </div>

                  {/* City */}
                  <div className="min-w-0">
                    {company.city ? (
                      <span className="flex items-center gap-1 text-[0.8125rem] text-muted-foreground truncate">
                        <MapPin className="h-3 w-3 flex-shrink-0 stroke-[1.5]" />
                        {company.city}
                      </span>
                    ) : (
                      <span className="text-[0.8125rem] text-muted-foreground/30">—</span>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <Badge variant="outline" className={`text-[0.6875rem] font-medium px-2 py-0.5 rounded-md ${status.className}`}>
                      {status.label}
                    </Badge>
                  </div>

                  {/* Owner */}
                  <div className="min-w-0">
                    <span className="text-[0.8125rem] text-muted-foreground truncate block">
                      {ownerName || <span className="text-muted-foreground/30">—</span>}
                    </span>
                  </div>

                  {/* Contact count */}
                  <div className="text-right">
                    {contactCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[0.8125rem] text-muted-foreground">
                        <Users className="h-3 w-3 stroke-[1.5]" />
                        {contactCount}
                      </span>
                    ) : (
                      <span className="text-[0.8125rem] text-muted-foreground/30">0</span>
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

export default Companies;
