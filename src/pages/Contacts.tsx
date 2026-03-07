import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Building2, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { relativeDate } from "@/lib/relativeDate";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

type SortField = "name" | "company" | "title" | "signal" | "owner" | "last_activity";
type SortDir = "asc" | "desc";

import { CATEGORIES, extractCategory } from "@/lib/categoryUtils";

const SIGNAL_OPTIONS = CATEGORIES.map(c => ({ label: c.label, color: c.badgeColor }));

function getSignalBadge(category: string | null) {
  if (!category) return null;
  return SIGNAL_OPTIONS.find((s) => s.label === category) || null;
}

const CHIP_BASE = "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors cursor-pointer";
const CHIP_OFF = `${CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;
const CHIP_ON = `${CHIP_BASE} bg-foreground text-background border-foreground font-medium`;

const Contacts = () => {
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [signalFilter, setSignalFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
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

      const [{ data: acts }, { data: tasks }] = await Promise.all([
        supabase
          .from("activities")
          .select("contact_id, created_at, description, subject")
          .in("contact_id", contactIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("tasks")
          .select("contact_id, created_at, due_date, status, description, title")
          .in("contact_id", contactIds),
      ]);

      // Last activity date map
      const lastActMap: Record<string, string> = {};
      (acts || []).forEach(a => {
        if (a.contact_id && !lastActMap[a.contact_id]) lastActMap[a.contact_id] = a.created_at;
      });

      // Signal: latest category from activities or tasks (by created_at desc)
      const signalMap: Record<string, string> = {};
      const allItems = [
        ...(acts || []).map(a => ({ contact_id: a.contact_id, created_at: a.created_at, subject: a.subject, description: a.description })),
        ...(tasks || []).map(t => ({ contact_id: t.contact_id, created_at: t.created_at, subject: t.title, description: t.description })),
      ].sort((a, b) => b.created_at.localeCompare(a.created_at));

      allItems.forEach(item => {
        if (item.contact_id && !signalMap[item.contact_id]) {
          const cat = extractCategory(item.subject, item.description);
          if (cat) signalMap[item.contact_id] = cat;
        }
      });

      // Open tasks count + overdue flag per contact
      const openTasksMap: Record<string, { count: number; overdue: boolean }> = {};
      const today = new Date().toISOString().slice(0, 10);
      (tasks || []).forEach(t => {
        if (t.contact_id && t.status === "open") {
          if (!openTasksMap[t.contact_id]) openTasksMap[t.contact_id] = { count: 0, overdue: false };
          openTasksMap[t.contact_id].count++;
          if (t.due_date && t.due_date < today) openTasksMap[t.contact_id].overdue = true;
        }
      });

      return data.map(c => ({
        ...c,
        lastActivity: lastActMap[c.id] || null,
        signal: signalMap[c.id] || null,
        openTasks: openTasksMap[c.id] || { count: 0, overdue: false },
      }));
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

  const pendingToggles = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const handleToggle = (contact: any, field: "cv_email" | "call_list", newValue: boolean) => {
    const name = `${contact.first_name} ${contact.last_name}`;
    const key = `${contact.id}-${field}`;
    const label = field === "cv_email" ? "CV-epost" : "Innkjøper";
    const msg = newValue ? `${label} lagt til ${name}` : `${label} fjernet fra ${name}`;

    // Cancel any pending save for same contact+field
    if (pendingToggles.current[key]) {
      clearTimeout(pendingToggles.current[key]);
      delete pendingToggles.current[key];
    }

    // Optimistic UI update
    queryClient.setQueryData(["contacts-full"], (old: any[]) =>
      old?.map(c => c.id === contact.id ? { ...c, [field]: newValue } : c)
    );

    // Schedule save after 5s
    const timeout = setTimeout(async () => {
      delete pendingToggles.current[key];
      const { error } = await supabase.from("contacts").update({ [field]: newValue }).eq("id", contact.id);
      if (error) {
        toast.error("Kunne ikke oppdatere");
        queryClient.setQueryData(["contacts-full"], (old: any[]) =>
          old?.map(c => c.id === contact.id ? { ...c, [field]: !newValue } : c)
        );
      }
      queryClient.invalidateQueries({ queryKey: ["contacts-full"] });
    }, 5000);
    pendingToggles.current[key] = timeout;

    toast(msg, {
      duration: 5000,
      action: {
        label: "Angre",
        onClick: () => {
          clearTimeout(pendingToggles.current[key]);
          delete pendingToggles.current[key];
          queryClient.setQueryData(["contacts-full"], (old: any[]) =>
            old?.map(c => c.id === contact.id ? { ...c, [field]: !newValue } : c)
          );
        },
      },
    });
  };

  const getOwnerId = (contact: any) => (contact.profiles as any)?.id || null;
  const getOwnerName = (contact: any) => (contact.profiles as any)?.full_name || null;

  const ownerMap = new Map<string, string>();
  contacts.forEach(c => {
    const id = getOwnerId(c);
    const name = getOwnerName(c);
    if (id && name) ownerMap.set(id, name);
  });
  const uniqueOwners = Array.from(ownerMap.entries());

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      (c.companies as any)?.name?.toLowerCase().includes(q) || c.title?.toLowerCase().includes(q);
    const matchOwner = ownerFilter === "all" || getOwnerId(c) === ownerFilter;
    const matchSignal = signalFilter === "all" || (c as any).signal === signalFilter;
    const matchType = typeFilter === "all" ||
      (typeFilter === "call_list" && c.call_list) ||
      (typeFilter === "cv_email" && c.cv_email);
    return matchSearch && matchOwner && matchSignal && matchType;
  });

  const sorted = [...filtered].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    switch (sort.field) {
      case "name": return dir * `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, "nb");
      case "company": return dir * ((a.companies as any)?.name || "").localeCompare((b.companies as any)?.name || "", "nb");
      case "title": return dir * (a.title || "").localeCompare(b.title || "", "nb");
      case "signal": return dir * ((a as any).signal || "").localeCompare((b as any).signal || "", "nb");
      case "owner": return dir * (getOwnerName(a) || "").localeCompare(getOwnerName(b) || "", "nb");
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

  const Chip = ({ label, value, current, onSelect }: { label: string; value: string; current: string; onSelect: (v: string) => void }) => (
    <button onClick={() => onSelect(value)} className={current === value ? CHIP_ON : CHIP_OFF}>{label}</button>
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

      {/* Search + count */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input placeholder="Søk..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-lg text-[0.8125rem] bg-card border-border" />
        </div>
        <span className="text-[0.75rem] text-muted-foreground ml-auto">{filtered.length} kontakter</span>
      </div>

      {/* Chip filters */}
      <div className="space-y-2">
        {/* EIER */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground w-16 shrink-0">Eier</span>
          <Chip label="Alle" value="all" current={ownerFilter} onSelect={setOwnerFilter} />
          {uniqueOwners.map(([id, name]) => (
            <Chip key={id} label={name} value={id} current={ownerFilter} onSelect={setOwnerFilter} />
          ))}
        </div>
        {/* SIGNAL */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground w-16 shrink-0">Signal</span>
          <Chip label="Alle" value="all" current={signalFilter} onSelect={setSignalFilter} />
          {SIGNAL_OPTIONS.map((s) => (
            <Chip key={s.label} label={s.label} value={s.label} current={signalFilter} onSelect={setSignalFilter} />
          ))}
        </div>
        {/* TYPE */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground w-16 shrink-0">Type</span>
          <Chip label="Alle" value="all" current={typeFilter} onSelect={setTypeFilter} />
          <Chip label="Innkjøper" value="call_list" current={typeFilter} onSelect={setTypeFilter} />
          <Chip label="CV-Epost" value="cv_email" current={typeFilter} onSelect={setTypeFilter} />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-px">{[1,2,3,4,5].map(i => <div key={i} className="h-[44px] bg-secondary/50 animate-pulse rounded" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Ingen kontakter funnet</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-card shadow-card">
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_90px_70px_90px] gap-3 px-4 py-2.5 border-b border-border bg-background">
            <SortHeader field="name">Navn</SortHeader>
            <SortHeader field="company">Selskap</SortHeader>
            <SortHeader field="title">Stilling</SortHeader>
            <SortHeader field="signal">Signal</SortHeader>
            <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">Tags</span>
            <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground text-center">Oppf.</span>
            <SortHeader field="last_activity" className="justify-end">Siste akt.</SortHeader>
          </div>
          <div className="divide-y divide-border">
            {sorted.map((contact) => {
              const companyName = (contact.companies as any)?.name;
              const signal = (contact as any).signal as string | null;
              const signalBadge = getSignalBadge(signal);
              const openTasks = (contact as any).openTasks || { count: 0, overdue: false };

              return (
                <div key={contact.id} className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_90px_70px_90px] gap-3 items-center px-4 min-h-[44px] py-2 hover:bg-background/80 transition-colors duration-75">
                  {/* NAME - clickable */}
                  <button onClick={() => navigate(`/kontakter/${contact.id}`)} className="min-w-0 text-left cursor-pointer">
                    <p className="text-[0.8125rem] font-medium text-foreground truncate">
                      {contact.first_name} {contact.last_name}
                    </p>
                  </button>
                  {/* COMPANY */}
                  <button onClick={() => navigate(`/kontakter/${contact.id}`)} className="text-[0.8125rem] text-muted-foreground truncate flex items-center gap-1 text-left cursor-pointer">
                    {companyName ? <><Building2 className="h-3 w-3 flex-shrink-0" />{companyName}</> : ""}
                  </button>
                  {/* TITLE */}
                  <button onClick={() => navigate(`/kontakter/${contact.id}`)} className="text-[0.8125rem] text-muted-foreground truncate text-left cursor-pointer">
                    {contact.title?.slice(0, 25) || ""}
                  </button>
                  {/* SIGNAL */}
                  <div className="min-w-0">
                    {signalBadge ? (
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${signalBadge.color}`}>
                        {signal}
                      </span>
                    ) : (
                      <span className="text-[0.75rem] text-muted-foreground">—</span>
                    )}
                  </div>
                  {/* TAGS */}
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleToggle(contact, "cv_email", !contact.cv_email)}
                      className={contact.cv_email
                        ? "rounded-full bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 text-xs font-medium cursor-pointer"
                        : "rounded-full border border-border text-muted-foreground px-2 py-0.5 text-xs hover:bg-secondary cursor-pointer"
                      }
                    >CV</button>
                    <button
                      onClick={() => handleToggle(contact, "call_list", !contact.call_list)}
                      className={contact.call_list
                        ? "rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 text-xs font-medium cursor-pointer"
                        : "rounded-full border border-border text-muted-foreground px-2 py-0.5 text-xs hover:bg-secondary cursor-pointer"
                      }
                    >INN</button>
                  </div>
                  {/* OPPFØLGINGER */}
                  <div className="text-center">
                    {openTasks.count > 0 ? (
                      <span className={`text-[0.8125rem] font-medium ${openTasks.overdue ? "text-destructive" : "text-foreground"}`}>
                        {openTasks.count}
                      </span>
                    ) : (
                      <span className="text-[0.75rem] text-muted-foreground">—</span>
                    )}
                  </div>
                  {/* SISTE AKT */}
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
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Contacts;
