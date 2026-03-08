import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Plus, X, Search, CalendarIcon, Upload, CheckCircle2, Loader2, Users, User } from "lucide-react";
import { relativeFutureDate } from "@/lib/relativeDate";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
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
  partner: "Via partner",
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
];

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
        .select("*, companies(id, name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
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
        const name = (r as any).navn || "";
        const company = r.companies?.name || (r as any).selskap_tekst || "";
        const tech = (r.teknologier || []).join(" ");
        return [name, company, tech].join(" ").toLowerCase().includes(q);
      });
    }
    return items;
  }, [rows, typeFilter, statusFilter, search]);

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
            placeholder="Søk navn, selskap, teknologi..."
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
              const name = (row as any).navn || "—";
              const company = row.companies?.name || (row as any).selskap_tekst || "—";
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
                      {(row.teknologier || []).slice(0, 3).map((t: string) => (
                        <span key={t} className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[0.6875rem] text-muted-foreground">{t}</span>
                      ))}
                      {(row.teknologier || []).length > 3 && (
                        <span className="text-[0.6875rem] text-muted-foreground">+{row.teknologier.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[0.8125rem] text-muted-foreground">
                    {relativeFutureDate(row.tilgjengelig_fra)}
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
        userId={user?.id}
      />
    </div>
  );
}

/* ─── Modal ─── */

interface ConsultantForm {
  type: string;
  navn: string;
  epost: string;
  telefon: string;
  company_id: string;
  selskap_tekst: string;
  teknologier: string[];
  status: string;
  tilgjengelig_fra: string;
  cv_tekst: string;
  kommentar: string;
}

const emptyForm: ConsultantForm = {
  type: "", navn: "", epost: "", telefon: "",
  company_id: "", selskap_tekst: "",
  teknologier: [], status: "ledig",
  tilgjengelig_fra: "", cv_tekst: "",
  kommentar: "",
};

function ConsultantModal({ open, onClose, editRow, userId }: {
  open: boolean;
  onClose: () => void;
  editRow: any | null;
  userId?: string;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [cvParsing, setCvParsing] = useState(false);
  const [cvPrefilled, setCvPrefilled] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const isCreate = !editRow;

  const [form, setForm] = useState<ConsultantForm>({ ...emptyForm });
  const [lastId, setLastId] = useState<string | null>(null);

  if (open && (editRow?.id ?? null) !== lastId) {
    setLastId(editRow?.id ?? null);
    setTagInput("");
    setCompanySearch("");
    setCvPrefilled(new Set());
    setCvParsing(false);
    if (editRow) {
      setForm({
        type: editRow.type || "freelance",
        navn: (editRow as any).navn || "",
        epost: (editRow as any).epost || "",
        telefon: (editRow as any).telefon || "",
        company_id: editRow.company_id || "",
        selskap_tekst: (editRow as any).selskap_tekst || "",
        teknologier: editRow.teknologier || [],
        status: editRow.status || "ledig",
        tilgjengelig_fra: editRow.tilgjengelig_fra || "",
        cv_tekst: (editRow as any).cv_tekst || "",
      });
    } else {
      setForm({ ...emptyForm });
    }
  }

  const set = (key: keyof ConsultantForm, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  // Company search for partner type
  const { data: companies = [] } = useQuery({
    queryKey: ["companies-for-ext"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name").order("name");
      return data || [];
    },
  });

  const filteredCompanies = companySearch.trim()
    ? companies.filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase())).slice(0, 8)
    : companies.slice(0, 8);

  const selectedCompany = companies.find(c => c.id === form.company_id);

  // Tag input
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

  // CV Upload & Parse
  const handleCvUpload = useCallback(async (file: File) => {
    if (!file || file.type !== "application/pdf") {
      toast.error("Kun PDF-filer støttes");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Filen er for stor (maks 10 MB)");
      return;
    }

    setCvParsing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      const { data, error } = await supabase.functions.invoke("extract-cv-contact", {
        body: { base64, filename: file.name },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const prefilled = new Set<string>();

      if (data.name && !form.navn) {
        set("navn", data.name);
        prefilled.add("navn");
      }
      if (data.email && !form.epost) {
        set("epost", data.email);
        prefilled.add("epost");
      }
      if (data.phone && !form.telefon) {
        set("telefon", data.phone);
        prefilled.add("telefon");
      }
      if (data.technologies?.length && form.teknologier.length === 0) {
        set("teknologier", data.technologies);
        prefilled.add("teknologier");
      }

      // Store raw CV text placeholder (the base64 is too large, but we mark it)
      set("cv_tekst", `[CV: ${file.name}]`);

      setCvPrefilled(prefilled);
      toast.success("CV analysert — felter fylt ut");
    } catch (err: any) {
      console.error("CV parsing error:", err);
      toast.error(err.message || "Kunne ikke analysere CV");
    } finally {
      setCvParsing(false);
    }
  }, [form.navn, form.epost, form.telefon, form.teknologier.length]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleCvUpload(file);
  }, [handleCvUpload]);

  const handleSave = async () => {
    if (!form.navn.trim()) { toast.error("Navn er påkrevd"); return; }
    if (form.type === "partner" && !form.company_id) { toast.error("Velg partnerselskap"); return; }

    setSaving(true);
    const payload: any = {
      type: form.type,
      navn: form.navn.trim(),
      epost: form.epost.trim() || null,
      telefon: form.telefon.trim() || null,
      company_id: form.type === "partner" ? (form.company_id || null) : null,
      selskap_tekst: form.type === "freelance" ? (form.selskap_tekst.trim() || null) : null,
      teknologier: form.teknologier,
      status: form.status,
      tilgjengelig_fra: form.tilgjengelig_fra || null,
      cv_tekst: form.cv_tekst || null,
      notat: form.kommentar.trim() || null,
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

  const LABEL = "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";
  const showTypeSelection = isCreate && !form.type;

  const CvBadge = ({ field }: { field: string }) =>
    cvPrefilled.has(field) ? (
      <span className="inline-flex items-center gap-1 text-[0.6875rem] text-emerald-600 font-medium ml-2">
        <CheckCircle2 className="h-3 w-3" /> Hentet fra CV
      </span>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg rounded-xl p-6 gap-0 max-h-[90vh] overflow-y-auto">
        <DialogTitle className="text-[1.125rem] font-bold text-foreground mb-5">
          {isCreate ? "Ny ekstern konsulent" : "Rediger konsulent"}
        </DialogTitle>

        {/* STEP 1: Type selection (create only) */}
        {showTypeSelection && (
          <div className="space-y-3">
            <p className="text-[0.8125rem] text-muted-foreground">Velg type:</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => set("type", "freelance")}
                className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-center"
              >
                <User className="h-7 w-7 text-primary" />
                <span className="text-[0.9375rem] font-semibold">Freelance</span>
                <span className="text-[0.75rem] text-muted-foreground leading-snug">Selvstendig konsulent</span>
              </button>
              <button
                onClick={() => set("type", "partner")}
                className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-center"
              >
                <Users className="h-7 w-7 text-primary" />
                <span className="text-[0.9375rem] font-semibold">Via partner</span>
                <span className="text-[0.75rem] text-muted-foreground leading-snug">Kommer via et partnerselskap</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Fields (after type selected or edit mode) */}
        {(form.type || !isCreate) && (
          <div className="space-y-4">
            {/* Partner: Company picker first */}
            {form.type === "partner" && (
              <div>
                <label className={LABEL}>Partnerselskap *</label>
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
            )}

            {/* CV Upload */}
            <div>
              <label className={LABEL}>CV-opplasting</label>
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "mt-1 flex flex-col items-center gap-2 p-5 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
                  cvParsing
                    ? "border-primary/40 bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-primary/5"
                )}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleCvUpload(file);
                    e.target.value = "";
                  }}
                />
                {cvParsing ? (
                  <>
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                    <span className="text-[0.8125rem] text-primary font-medium">Analyserer CV...</span>
                  </>
                ) : cvPrefilled.size > 0 ? (
                  <>
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    <span className="text-[0.8125rem] text-emerald-600 font-medium">CV analysert</span>
                    <span className="text-[0.6875rem] text-muted-foreground">Klikk for å laste opp ny</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-[0.8125rem] text-muted-foreground">Dra og slipp PDF, eller klikk for å velge</span>
                  </>
                )}
              </div>
            </div>

            {/* Navn */}
            <div>
              <div className="flex items-center">
                <label className={LABEL}>Navn *</label>
                <CvBadge field="navn" />
              </div>
              <Input value={form.navn} onChange={e => set("navn", e.target.value)} placeholder="Fullt navn" className="mt-1 text-[0.875rem]" />
            </div>

            {/* Epost */}
            <div>
              <div className="flex items-center">
                <label className={LABEL}>E-post</label>
                <CvBadge field="epost" />
              </div>
              <Input value={form.epost} onChange={e => set("epost", e.target.value)} placeholder="epost@eksempel.no" className="mt-1 text-[0.875rem]" />
            </div>

            {/* Telefon */}
            <div>
              <div className="flex items-center">
                <label className={LABEL}>Telefon</label>
                <CvBadge field="telefon" />
              </div>
              <Input value={form.telefon} onChange={e => set("telefon", e.target.value)} placeholder="+47 ..." className="mt-1 text-[0.875rem]" />
            </div>

            {/* Freelance: Selskap (text) */}
            {form.type === "freelance" && (
              <div>
                <label className={LABEL}>Selskap</label>
                <Input value={form.selskap_tekst} onChange={e => set("selskap_tekst", e.target.value)} placeholder="Eget enkeltpersonforetak e.l." className="mt-1 text-[0.875rem]" />
                <p className="text-[0.6875rem] text-muted-foreground mt-1">Ikke et salgsselskap i CRM</p>
              </div>
            )}

            {/* Teknologier */}
            <div>
              <div className="flex items-center">
                <label className={LABEL}>Teknologier</label>
                <CvBadge field="teknologier" />
              </div>
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

            {/* Status */}
            <div>
              <label className={LABEL + " block mb-1.5"}>Status</label>
              <div className="flex gap-1.5">
                <button onClick={() => set("status", "ledig")} className={form.status === "ledig" ? CHIP_ON : CHIP_OFF}>Tilgjengelig</button>
                <button onClick={() => set("status", "utilgjengelig")} className={form.status === "utilgjengelig" ? CHIP_ON : CHIP_OFF}>Ikke ledig</button>
              </div>
            </div>

            {/* Tilgjengelig fra */}
            <div>
              <label className={LABEL}>Tilgjengelig fra</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("mt-1 w-full justify-start text-left text-[0.875rem] font-normal", !form.tilgjengelig_fra && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.tilgjengelig_fra ? format(new Date(form.tilgjengelig_fra), "d. MMM yyyy", { locale: nb }) : "Velg dato"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.tilgjengelig_fra ? new Date(form.tilgjengelig_fra) : undefined}
                    onSelect={(d) => set("tilgjengelig_fra", d ? format(d, "yyyy-MM-dd") : "")}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Kommentar */}
            <div>
              <label className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">Kommentar</label>
              <textarea
                value={form.kommentar}
                onChange={(e) => set("kommentar", e.target.value)}
                rows={3}
                placeholder="Notater om konsulenten, kilde, hvordan dere kom i kontakt..."
                className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-[0.875rem] ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>
        )}

        {/* Footer */}
        {(form.type || !isCreate) && (
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
        )}
      </DialogContent>
    </Dialog>
  );
}
