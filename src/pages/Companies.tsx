import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, MapPin, ChevronRight } from "lucide-react";
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

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-[28px] font-bold tracking-tight">Selskaper</h1>
          <p className="text-[15px] text-muted-foreground">
            {companies.length} selskaper
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl h-10 px-4 text-[13px] font-semibold gap-2">
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
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Firmanavn AS" className="h-11 rounded-xl text-[15px] bg-secondary/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-label">Org.nr</Label>
                  <Input value={form.org_number} onChange={(e) => setForm({ ...form, org_number: e.target.value })} placeholder="923 456 789" className="h-11 rounded-xl text-[15px] bg-secondary/50 text-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="text-label">Sted</Label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Oslo" className="h-11 rounded-xl text-[15px] bg-secondary/50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-label">Nettside</Label>
                <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" className="h-11 rounded-xl text-[15px] bg-secondary/50" type="url" />
              </div>
              <div className="space-y-2">
                <Label className="text-label">LinkedIn</Label>
                <Input value={form.linkedin} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} placeholder="https://linkedin.com/company/..." className="h-11 rounded-xl text-[15px] bg-secondary/50" type="url" />
              </div>
              <Button type="submit" className="w-full h-11 rounded-xl text-[14px] font-semibold" disabled={createMutation.isPending}>
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
          className="pl-11 h-11 rounded-xl bg-card border-border/40 text-[15px] placeholder:text-muted-foreground/40"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[72px] rounded-2xl bg-card animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-24 text-center space-y-3">
          <p className="text-[17px] font-medium text-foreground/60">Ingen selskaper funnet</p>
          <p className="text-[14px] text-muted-foreground">Opprett ditt første selskap for å komme i gang</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((company) => (
            <button
              key={company.id}
              onClick={() => navigate(`/selskaper/${company.id}`)}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl hover:bg-card active:bg-accent transition-colors duration-150 group text-left"
            >
              {/* Avatar */}
              <div className="h-11 w-11 rounded-2xl bg-card border border-border/60 flex items-center justify-center flex-shrink-0 group-hover:border-primary/30 transition-colors">
                <span className="text-[15px] font-semibold text-foreground/70">
                  {company.name.charAt(0)}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-foreground truncate">
                  {company.name}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  {company.city && (
                    <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
                      <MapPin className="h-3 w-3 stroke-[1.5]" />
                      {company.city}
                    </span>
                  )}
                  {company.org_number && (
                    <span className="text-[13px] text-muted-foreground/60 text-mono">
                      {company.org_number}
                    </span>
                  )}
                </div>
              </div>

              {/* Chevron */}
              <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-muted-foreground/60 transition-colors flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Companies;
