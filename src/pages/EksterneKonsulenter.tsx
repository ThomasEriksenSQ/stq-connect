import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Plus, X, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type TypeFilter = "Alle" | "freelance" | "partner";
type StatusFilter = "Alle" | "ledig" | "utilgjengelig";

const CHIP_BASE = "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors cursor-pointer";
const CHIP_OFF = `${CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;
const CHIP_ON = `${CHIP_BASE} bg-foreground text-background border-foreground font-medium`;

const TYPE_LABELS: Record<string, string> = {
  freelance: "Freelance",
  partner: "Partner",
};
const STATUS_LABELS: Record<string, string> = {
  ledig: "Tilgjengelig",
  aktiv: "Tilgjengelig",
  utilgjengelig: "Ikke ledig",
  utgått: "Ikke ledig",
};
const STATUS_COLORS: Record<string, string> = {
  ledig: "bg-emerald-100 text-emerald-700",
  aktiv: "bg-emerald-100 text-emerald-700",
  utilgjengelig: "bg-muted text-muted-foreground",
  utgått: "bg-muted text-muted-foreground",
};

const SUGGESTED_TECH = [
  "C++", "C", "Embedded", "Yocto", "Linux", "Qt", "FPGA",
  "Python", "SPI/I2C", "MCU", "Embedded Linux", "Sikkerhet",
  "React", "TypeScript", "Java", "Rust", "AWS", "Azure",
];

interface ConsultantForm {
  contact_id: string;
  company_id: string;
  type: string;
  status: string;
  rolle: string;
  teknologier: string[];
  erfaring_aar: string;
  tilgjengelig_fra: string;
  tilgjengelig_til: string;
  kapasitet_prosent: string;
  innpris_time: string;
  utpris_time: string;
  cv_url: string;
  notat: string;
}

const emptyForm: ConsultantForm = {
  contact_id: "", company_id: "", type: "freelance", status: "ledig",
  rolle: "", teknologier: [], erfaring_aar: "", tilgjengelig_fra: "",
  tilgjengelig_til: "", kapasitet_prosent: "100", innpris_time: "",
  utpris_time: "", cv_url: "", notat: "",
};

export default function EksterneKonsulenter() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("Alle");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Alle");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["external-consultants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_consultants")
        .select("*, contacts(id, first_name, last_name, email, phone), companies(id, name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-for-ext"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, first_name, last_name").order("first_name");
      return data || [];
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-for-ext"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name").order("name");
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    let items = rows;
    if (typeFilter !== "Alle") items = items.filter((r: any) => r.type === typeFilter);
    if (statusFilter !== "Alle") {
      if (statusFilter === "ledig") {
        items = items.filter((r: any) => r.status === "ledig" || r.status === "aktiv");
      } else {
        items = items.filter((r: any) => r.status === "utilgjengelig" || r.status === "utgått");
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((r: any) => {
        const name = r.contacts ? `${r.contacts.first_name} ${r.contacts.last_name}` : "";
        const company = r.companies?.name || "";
        const rolle = r.rolle || "";
        const tech = (r.teknologier || []).join(" ");
        return [name, company, rolle, tech].join(" ").toLowerCase().includes(q);
      });
    }
    return items;
  }, [rows, typeFilter, statusFilter, search]);

  // Unique roles for filter
  const uniqueRoles = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r: any) => { if (r.rolle) set.add(r.rolle); });
    return Array.from(set).sort();
  }, [rows]);

  const openEdit = (row: any) => {
    setEditId(row.id);
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditId(null);
    setModalOpen(true);
  };

  if (isLoading) {
    return <p className="text-muted-foreground py-12 text-center">Laster eksterne konsulenter...</p>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-[1.375rem] font-bold">Eksterne konsulenter</h1>
        <span className="bg-secondary text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
          {filtered.length}
        </span>
      </div>

      {/* Search + Add */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Søk navn, selskap, rolle, teknologi..."
            className="pl-9 text-[0.875rem]"
          />
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Legg til
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-2 mb-5">
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground w-16 flex-shrink-0">Type</span>
          <div className="flex items-center gap-1.5">
            {(["Alle", "freelance", "partner"] as TypeFilter[]).map(f => (
              <button key={f} className={typeFilter === f ? CHIP_ON : CHIP_OFF} onClick={() => setTypeFilter(f)}>
                {f === "Alle" ? "Alle" : TYPE_LABELS[f]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground w-16 flex-shrink-0">Status</span>
          <div className="flex items-center gap-1.5">
            {(["Alle", "ledig", "utilgjengelig"] as StatusFilter[]).map(f => (
              <button key={f} className={statusFilter === f ? CHIP_ON : CHIP_OFF} onClick={() => setStatusFilter(f)}>
                {f === "Alle" ? "Alle" : f === "ledig" ? "Tilgjengelig" : "Ikke ledig"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["NAVN", "SELSKAP", "TYPE", "STATUS", "TEKNOLOGIER", "TILGJ. FRA"].map(h => (
                <th key={h} className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground px-4 py-2.5 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row: any, i: number) => {
              const contact = row.contacts;
              const name = contact ? `${contact.first_name} ${contact.last_name}` : "—";
              const company = row.companies?.name || "—";
              return (
                <tr
                  key={row.id}
                  onClick={() => openEdit(row)}
                  className={cn(
                    "hover:bg-muted/30 transition-colors cursor-pointer",
                    i < filtered.length - 1 && "border-b border-border"
                  )}
                >
                  <td className="px-4 py-3 font-semibold text-[0.875rem]">{name}</td>
                  <td className="px-4 py-3 text-[0.875rem] text-muted-foreground">{company}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      row.type === "freelance" ? "bg-emerald-100 text-emerald-700" :
                      "bg-violet-100 text-violet-700"
                    )}>
                      {TYPE_LABELS[row.type] || row.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_COLORS[row.status] || "bg-muted text-muted-foreground")}>
                      {STATUS_LABELS[row.status] || row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(row.teknologier || []).slice(0, 4).map((t: string) => (
                        <span key={t} className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[0.6875rem] text-muted-foreground">{t}</span>
                      ))}
                      {(row.teknologier || []).length > 4 && (
                        <span className="text-[0.6875rem] text-muted-foreground">+{row.teknologier.length - 4}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[0.8125rem] text-muted-foreground">
                    {row.tilgjengelig_fra ? format(new Date(row.tilgjengelig_fra), "dd.MM.yyyy") : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-muted-foreground text-center py-12">Ingen eksterne konsulenter å vise</p>
        )}
      </div>

      {/* Modal */}
      <ConsultantModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editRow={editId ? rows.find((r: any) => r.id === editId) : null}
        contacts={contacts}
        companies={companies}
        userId={user?.id}
      />
    </div>
  );
}

/* ─── Modal ─── */

function ConsultantModal({ open, onClose, editRow, contacts, companies, userId }: {
  open: boolean;
  onClose: () => void;
  editRow: any | null;
  contacts: any[];
  companies: any[];
  userId?: string;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");

  const isCreate = !editRow;

  const [form, setForm] = useState<ConsultantForm>({ ...emptyForm });
  const [lastId, setLastId] = useState<string | null>(null);

  if (open && (editRow?.id ?? null) !== lastId) {
    setLastId(editRow?.id ?? null);
    setTagInput("");
    setContactSearch("");
    setCompanySearch("");
    if (editRow) {
      setForm({
        contact_id: editRow.contact_id || "",
        company_id: editRow.company_id || "",
        type: editRow.type || "freelance",
        status: editRow.status || "ledig",
        rolle: editRow.rolle || "",
        teknologier: editRow.teknologier || [],
        erfaring_aar: editRow.erfaring_aar?.toString() || "",
        tilgjengelig_fra: editRow.tilgjengelig_fra || "",
        tilgjengelig_til: editRow.tilgjengelig_til || "",
        kapasitet_prosent: editRow.kapasitet_prosent?.toString() || "100",
        innpris_time: editRow.innpris_time?.toString() || "",
        utpris_time: editRow.utpris_time?.toString() || "",
        cv_url: editRow.cv_url || "",
        notat: editRow.notat || "",
      });
    } else {
      setForm({ ...emptyForm });
    }
  }

  const set = (key: keyof ConsultantForm, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !form.teknologier.includes(t)) set("teknologier", [...form.teknologier, t]);
    setTagInput("");
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  const handleSave = async () => {
    if (!form.contact_id) { toast.error("Velg en kontaktperson"); return; }
    setSaving(true);
    const payload: any = {
      contact_id: form.contact_id || null,
      company_id: form.company_id || null,
      type: form.type,
      status: form.status,
      rolle: form.rolle.trim() || null,
      teknologier: form.teknologier,
      erfaring_aar: form.erfaring_aar ? parseInt(form.erfaring_aar) : null,
      tilgjengelig_fra: form.tilgjengelig_fra || null,
      tilgjengelig_til: form.tilgjengelig_til || null,
      kapasitet_prosent: form.kapasitet_prosent ? parseInt(form.kapasitet_prosent) : 100,
      innpris_time: form.innpris_time ? parseFloat(form.innpris_time) : null,
      utpris_time: form.utpris_time ? parseFloat(form.utpris_time) : null,
      cv_url: form.cv_url.trim() || null,
      notat: form.notat.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (isCreate) {
      ({ error } = await supabase.from("external_consultants").insert(payload));
    } else {
      ({ error } = await supabase.from("external_consultants").update(payload).eq("id", editRow.id));
    }
    setSaving(false);
    if (error) { toast.error("Kunne ikke lagre"); return; }
    toast.success(isCreate ? "Ekstern konsulent lagt til" : "Oppdatert");
    queryClient.invalidateQueries({ queryKey: ["external-consultants"] });
    onClose();
  };

  const handleDelete = async () => {
    if (!editRow) return;
    if (!confirm("Er du sikker?")) return;
    const { error } = await supabase.from("external_consultants").delete().eq("id", editRow.id);
    if (error) { toast.error("Kunne ikke slette"); return; }
    toast.success("Slettet");
    queryClient.invalidateQueries({ queryKey: ["external-consultants"] });
    onClose();
  };

  const selectedContact = contacts.find(c => c.id === form.contact_id);
  const selectedCompany = companies.find(c => c.id === form.company_id);

  const filteredContacts = contactSearch.trim()
    ? contacts.filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(contactSearch.toLowerCase())).slice(0, 8)
    : contacts.slice(0, 8);

  const filteredCompanies = companySearch.trim()
    ? companies.filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase())).slice(0, 8)
    : companies.slice(0, 8);

  const LABEL = "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg rounded-xl p-6 gap-0 max-h-[90vh] overflow-y-auto" onInteractOutside={e => e.preventDefault()}>
        <DialogTitle className="text-[1.125rem] font-bold text-foreground mb-5">
          {isCreate ? "Ny ekstern konsulent" : "Rediger konsulent"}
        </DialogTitle>

        <div className="space-y-4">
          {/* Contact picker */}
          <div>
            <label className={LABEL}>Kontaktperson *</label>
            {selectedContact ? (
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[0.875rem] font-medium">{selectedContact.first_name} {selectedContact.last_name}</span>
                <button onClick={() => set("contact_id", "")} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <div className="mt-1">
                <Input
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                  placeholder="Søk kontakter..."
                  className="text-[0.875rem]"
                />
                {contactSearch.trim() && filteredContacts.length > 0 && (
                  <div className="border border-border rounded-lg mt-1 max-h-40 overflow-y-auto bg-popover">
                    {filteredContacts.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { set("contact_id", c.id); setContactSearch(""); }}
                        className="w-full text-left px-3 py-2 text-[0.8125rem] hover:bg-secondary transition-colors"
                      >
                        {c.first_name} {c.last_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Company picker */}
          <div>
            <label className={LABEL}>Selskap <span className="normal-case font-normal text-muted-foreground/50">(valgfritt)</span></label>
            {selectedCompany ? (
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[0.875rem] font-medium">{selectedCompany.name}</span>
                <button onClick={() => set("company_id", "")} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <div className="mt-1">
                <Input
                  value={companySearch}
                  onChange={e => setCompanySearch(e.target.value)}
                  placeholder="Søk selskaper..."
                  className="text-[0.875rem]"
                />
                {companySearch.trim() && filteredCompanies.length > 0 && (
                  <div className="border border-border rounded-lg mt-1 max-h-40 overflow-y-auto bg-popover">
                    {filteredCompanies.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { set("company_id", c.id); setCompanySearch(""); }}
                        className="w-full text-left px-3 py-2 text-[0.8125rem] hover:bg-secondary transition-colors"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Type + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL + " block mb-1.5"}>Type</label>
              <div className="flex flex-wrap gap-1.5">
                {(["freelance", "partner", "konsulenthus"] as const).map(t => (
                  <button key={t} onClick={() => set("type", t)} className={form.type === t ? CHIP_ON : CHIP_OFF}>
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={LABEL + " block mb-1.5"}>Status</label>
              <div className="flex flex-wrap gap-1.5">
                {(["ledig", "aktiv", "utilgjengelig", "utgått"] as const).map(s => (
                  <button key={s} onClick={() => set("status", s)} className={form.status === s ? CHIP_ON : CHIP_OFF}>
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Rolle + erfaring */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Rolle</label>
              <Input value={form.rolle} onChange={e => set("rolle", e.target.value)} placeholder="Embedded SW Engineer" className="mt-1 text-[0.875rem]" />
            </div>
            <div>
              <label className={LABEL}>Erfaring (år)</label>
              <Input type="number" value={form.erfaring_aar} onChange={e => set("erfaring_aar", e.target.value)} placeholder="10" className="mt-1 text-[0.875rem]" />
            </div>
          </div>

          {/* Teknologier */}
          <div>
            <label className={LABEL}>Teknologier</label>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 p-2 border border-border rounded-lg bg-background min-h-[38px]">
              {form.teknologier.map(t => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[0.75rem] text-foreground">
                  {t}
                  <button onClick={() => set("teknologier", form.teknologier.filter(x => x !== t))} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={form.teknologier.length === 0 ? "Legg til teknologi..." : ""}
                className="flex-1 min-w-[100px] bg-transparent outline-none text-[0.8125rem] placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SUGGESTED_TECH.filter(s => !form.teknologier.includes(s)).slice(0, 10).map(s => (
                <button key={s} onClick={() => addTag(s)} className="h-6 px-2 text-[0.6875rem] rounded-full border border-border text-muted-foreground hover:bg-secondary transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Tilgjengelighet */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Tilgjengelig fra</label>
              <Input type="date" value={form.tilgjengelig_fra} onChange={e => set("tilgjengelig_fra", e.target.value)} className="mt-1 text-[0.875rem]" />
            </div>
            <div>
              <label className={LABEL}>Tilgjengelig til</label>
              <Input type="date" value={form.tilgjengelig_til} onChange={e => set("tilgjengelig_til", e.target.value)} className="mt-1 text-[0.875rem]" />
            </div>
            <div>
              <label className={LABEL}>Kapasitet %</label>
              <Input type="number" value={form.kapasitet_prosent} onChange={e => set("kapasitet_prosent", e.target.value)} placeholder="100" className="mt-1 text-[0.875rem]" />
            </div>
          </div>

          {/* Økonomi */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Innpris (kr/t)</label>
              <Input type="number" value={form.innpris_time} onChange={e => set("innpris_time", e.target.value)} placeholder="850" className="mt-1 text-[0.875rem]" />
            </div>
            <div>
              <label className={LABEL}>Utpris (kr/t)</label>
              <Input type="number" value={form.utpris_time} onChange={e => set("utpris_time", e.target.value)} placeholder="1200" className="mt-1 text-[0.875rem]" />
            </div>
          </div>

          {/* CV URL */}
          <div>
            <label className={LABEL}>CV-lenke</label>
            <Input value={form.cv_url} onChange={e => set("cv_url", e.target.value)} placeholder="https://..." className="mt-1 text-[0.875rem]" />
          </div>

          {/* Notat */}
          <div>
            <label className={LABEL}>Notat</label>
            <textarea
              value={form.notat}
              onChange={e => set("notat", e.target.value)}
              placeholder="Intern merknad..."
              rows={2}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <div>
            {!isCreate && (
              <button onClick={handleDelete} className="text-[0.8125rem] text-destructive hover:underline">
                Slett
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors">
              Avbryt
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "Lagrer..." : isCreate ? "Legg til" : "Lagre"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
