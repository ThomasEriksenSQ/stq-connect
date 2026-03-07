import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Building2, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { relativeDate } from "@/lib/relativeDate";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

type SortField = "name" | "company" | "title" | "owner" | "last_activity";
type SortDir = "asc" | "desc";

const Contacts = () => {
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [filterCallList, setFilterCallList] = useState(false);
  const [filterCvEmail, setFilterCvEmail] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", title: "", company_id: "" });
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "last_activity", dir: "desc" });
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*, companies(name), profiles!contacts_owner_id_fkey(id, full_name)")
        .order("first_name");
      if (error) throw error;

      const contactIds = data.map(c => c.id);
      const { data: acts } = await supabase
        .from("activities")
        .select("contact_id, created_at")
        .in("contact_id", contactIds)
        .order("created_at", { ascending: false });

      const lastActMap: Record<string, string> = {};
      (acts || []).forEach(a => {
        if (a.contact_id && !lastActMap[a.contact_id]) lastActMap[a.contact_id] = a.created_at;
      });

      return data.map(c => ({ ...c, lastActivity: lastActMap[c.id] || null }));
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
        first_name: form.first_name, last_name: form.last_name,
        email: form.email || null, phone: form.phone || null, title: form.title || null,
        company_id: form.company_id || null, created_by: user?.id, owner_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts-full"] });
      setOpen(false);
      setForm({ first_name: "", last_name: "", email: "", phone: "", title: "", company_id: "" });
      toast.success("Kontakt opprettet");
    },
    onError: () => toast.error("Kunne ikke opprette kontakt"),
  });

  const getOwnerId = (contact: any) => (contact.profiles as any)?.id || null;
  const getOwnerName = (contact: any) => (contact.profiles as any)?.full_name || null;

  const ownerMap = new Map<string, string>();
  contacts.forEach(c => {
    const id = getOwnerId(c);
    const name = getOwnerFirstName(c);
    if (id && name) ownerMap.set(id, name);
  });
  const uniqueOwners = Array.from(ownerMap.entries());

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      (c.companies as any)?.name?.toLowerCase().includes(q) || c.title?.toLowerCase().includes(q);
    const matchOwner = ownerFilter === "all" || getOwnerId(c) === ownerFilter;
    const matchCallList = !filterCallList || c.call_list;
    const matchCvEmail = !filterCvEmail || c.cv_email;
    return matchSearch && matchOwner && matchCallList && matchCvEmail;
  });

  const sorted = [...filtered].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    switch (sort.field) {
      case "name": return dir * `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, "nb");
      case "company": return dir * ((a.companies as any)?.name || "").localeCompare((b.companies as any)?.name || "", "nb");
      case "title": return dir * (a.title || "").localeCompare(b.title || "", "nb");
      case "owner": return dir * (getOwnerFirstName(a) || "").localeCompare(getOwnerFirstName(b) || "", "nb");
      case "last_activity":
        if (!(a as any).lastActivity && !(b as any).lastActivity) return 0;
        if (!(a as any).lastActivity) return 1;
        if (!(b as any).lastActivity) return -1;
        return dir * (a as any).lastActivity.localeCompare((b as any).lastActivity);
      default: return 0;
    }
  });

  const toggleSort = (field: SortField) => {
    setSort((prev) => prev.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: field === "last_activity" ? "desc" : "asc" });
  };

  const SortHeader = ({ field, children, className = "" }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <button onClick={() => toggleSort(field)}
      className={`flex items-center gap-1 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors ${className}`}>
      {children}
      <ArrowUpDown className={`h-3 w-3 ${sort.field === field ? "text-foreground" : "text-muted-foreground/20"}`} />
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[1.375rem] font-bold">Kontakter</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-lg h-9 px-3.5 text-[0.8125rem] font-medium gap-1.5">
              <Plus className="h-4 w-4" />Ny kontakt
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[440px] rounded-xl">
            <DialogHeader><DialogTitle>Ny kontakt</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-label">Fornavn</Label>
                  <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required className="h-10 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-label">Etternavn</Label>
                  <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required className="h-10 rounded-lg" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-label">Selskap</Label>
                <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                  <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Velg selskap" /></SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-label">Stilling</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-10 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-label">E-post</Label>
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" className="h-10 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-label">Telefon</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-10 rounded-lg" />
                </div>
              </div>
              <Button type="submit" className="w-full h-10 rounded-lg" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Oppretter..." : "Opprett"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input placeholder="Søk..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-lg text-[0.8125rem] bg-card border-border" />
        </div>
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="h-9 w-auto min-w-[100px] rounded-lg text-[0.8125rem] border-border bg-card">
            <SelectValue placeholder="Eier: Alle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Eier: Alle</SelectItem>
            {uniqueOwners.map(([id, name]) => (
              <SelectItem key={id as string} value={id as string}>{name as string}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="inline-flex items-center gap-1.5 cursor-pointer text-[0.8125rem] text-muted-foreground">
          <Checkbox checked={filterCallList} onCheckedChange={(c) => setFilterCallList(!!c)} className="h-3.5 w-3.5 rounded-[3px]" />
          Innkjøper
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer text-[0.8125rem] text-muted-foreground">
          <Checkbox checked={filterCvEmail} onCheckedChange={(c) => setFilterCvEmail(!!c)} className="h-3.5 w-3.5 rounded-[3px]" />
          CV-Epost
        </label>
        <span className="text-[0.75rem] text-muted-foreground ml-auto">{filtered.length} kontakter</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-px">{[1,2,3,4,5].map(i => <div key={i} className="h-[44px] bg-secondary/50 animate-pulse rounded" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Ingen kontakter funnet</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-card shadow-card">
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_80px_100px] gap-3 px-4 py-2.5 border-b border-border bg-background">
            <SortHeader field="name">Navn</SortHeader>
            <SortHeader field="company">Selskap</SortHeader>
            <SortHeader field="title">Stilling</SortHeader>
            <SortHeader field="owner">Eier</SortHeader>
            <SortHeader field="last_activity" className="justify-end">Siste akt.</SortHeader>
          </div>
          <div className="divide-y divide-border">
            {sorted.map((contact) => {
              const companyName = (contact.companies as any)?.name;
              const flags = [
                contact.call_list && "Innkjøper",
                contact.cv_email && "CV-Epost",
              ].filter(Boolean);

              return (
                <button key={contact.id} onClick={() => navigate(`/kontakter/${contact.id}`)}
                  className="w-full grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_80px_100px] gap-3 items-center px-4 min-h-[44px] py-2 hover:bg-background/80 transition-colors duration-75 text-left cursor-pointer">
                  <div className="min-w-0">
                    <p className="text-[0.8125rem] font-medium text-foreground truncate">
                      {contact.first_name} {contact.last_name}
                    </p>
                    {flags.length > 0 && (
                      <div className="flex gap-1 mt-0.5">
                        {flags.map((f) => (
                          <span key={f} className="text-[0.5625rem] font-medium px-1.5 py-0 rounded-[4px] bg-tag text-tag-foreground">{f}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[0.8125rem] text-muted-foreground truncate flex items-center gap-1">
                    {companyName ? <><Building2 className="h-3 w-3 flex-shrink-0" />{companyName}</> : ""}
                  </span>
                  <span className="text-[0.8125rem] text-muted-foreground truncate">{contact.title?.slice(0, 25) || ""}</span>
                  <span className="text-[0.8125rem] text-muted-foreground truncate">{getOwnerFirstName(contact) || ""}</span>
                  <span className="text-[0.75rem] text-muted-foreground text-right">
                    {(contact as any).lastActivity ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{relativeDate((contact as any).lastActivity)}</span>
                        </TooltipTrigger>
                        <TooltipContent>{format(new Date((contact as any).lastActivity), "d. MMMM yyyy", { locale: nb })}</TooltipContent>
                      </Tooltip>
                    ) : ""}
                  </span>
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
