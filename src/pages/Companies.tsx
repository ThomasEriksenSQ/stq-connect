import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Building2, Globe, MapPin, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const Companies = () => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", org_number: "", city: "", website: "", linkedin: "" });
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();

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
    (c.city?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Selskaper</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {companies.length} {companies.length === 1 ? "selskap" : "selskaper"} totalt
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Nytt selskap
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Opprett nytt selskap</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Selskapsnavn *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Firmanavn AS" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Org.nr</Label>
                  <Input value={form.org_number} onChange={(e) => setForm({ ...form, org_number: e.target.value })} placeholder="123 456 789" className="text-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sted</Label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Oslo" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nettside</Label>
                <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://example.com" type="url" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">LinkedIn</Label>
                <Input value={form.linkedin} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} placeholder="https://linkedin.com/company/..." type="url" />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Oppretter..." : "Opprett selskap"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Søk etter selskaper..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-card border-border/50"
        />
      </div>

      {/* Company grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-card animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Building2 className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground font-medium">Ingen selskaper funnet</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Opprett ditt første selskap for å komme i gang</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((company) => (
            <button
              key={company.id}
              onClick={() => navigate(`/selskaper/${company.id}`)}
              className="group text-left p-4 rounded-xl bg-card border border-border/50 hover:border-primary/30 hover:bg-accent/50 transition-all duration-200 cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
              </div>
              <h3 className="font-semibold text-sm mb-1 text-foreground">{company.name}</h3>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {company.org_number && (
                  <span className="text-mono">{company.org_number}</span>
                )}
                {company.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />{company.city}
                  </span>
                )}
              </div>
              {company.website && (
                <div className="flex items-center gap-1 mt-2 text-xs text-primary/70">
                  <Globe className="h-3 w-3" />
                  <span className="truncate">{company.website.replace(/^https?:\/\//, '')}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Companies;
