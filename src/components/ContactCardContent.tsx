import { useState, useMemo, useRef, useEffect } from "react";
import { AiSignalBanner } from "@/components/AiSignalBanner";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";
import {
  Phone,
  Mail,
  Linkedin,
  FileText,
  Clock,
  ExternalLink,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Plus,
  MessageCircle,
  PhoneOff,
  Send,
  Signal,
  X,
  Target,
  Loader2,
  MapPin,
  Sparkles } from
"lucide-react";
import { toast } from "sonner";
import { format, isPast, isToday, getYear, addDays, addWeeks, addMonths, addYears } from "date-fns";
import { nb } from "date-fns/locale";
import { fullDate } from "@/lib/relativeDate";
import { cleanDescription } from "@/lib/cleanDescription";
import { cn } from "@/lib/utils";
import { getEffectiveSignal } from "@/lib/categoryUtils";

/* ── Category system ── */
const CATEGORIES = [
{
  label: "Behov nå",
  badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
  selectedColor: "bg-emerald-500 text-white border-emerald-500"
},
{
  label: "Får fremtidig behov",
  badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
  selectedColor: "bg-blue-500 text-white border-blue-500"
},
{
  label: "Får kanskje behov",
  badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
  selectedColor: "bg-amber-500 text-white border-amber-500"
},
{
  label: "Ukjent om behov",
  badgeColor: "bg-gray-100 text-gray-600 border-gray-200",
  selectedColor: "bg-gray-400 text-white border-gray-400"
},
{
  label: "Ikke aktuelt",
  badgeColor: "bg-red-50 text-red-700 border-red-200",
  selectedColor: "bg-red-400 text-white border-red-400"
}] as
const;

const LEGACY_CATEGORY_MAP: Record<string, string> = {
  "Fremtidig behov": "Får fremtidig behov",
  "Har kanskje behov": "Får kanskje behov",
  "Vil kanskje få behov": "Får kanskje behov",
  "Aldri aktuelt": "Ikke aktuelt"
};

function normalizeCategoryLabel(label: string): string {
  return LEGACY_CATEGORY_MAP[label] || label;
}

function getCategoryBadgeColor(label: string) {
  const normalized = normalizeCategoryLabel(label);
  const cat = CATEGORIES.find((c) => c.label === normalized);
  return cat?.badgeColor || "bg-secondary text-foreground border-border";
}

function CategoryBadge({ label, className }: {label: string;className?: string;}) {
  const normalized = normalizeCategoryLabel(label);
  const color = getCategoryBadgeColor(normalized);
  const isKnown = CATEGORIES.some((c) => c.label === normalized);
  if (!isKnown) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        color,
        className
      )}>
      
      {normalized}
    </span>);

}

function CategoryPicker({ selected, onSelect }: {selected: string;onSelect: (v: string) => void;}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CATEGORIES.map((cat) =>
      <button
        key={cat.label}
        type="button"
        onClick={() => onSelect(cat.label)}
        className={cn(
          "h-8 px-3 text-[0.8125rem] rounded-full border transition-all font-medium",
          selected === cat.label ?
          cat.selectedColor :
          "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
        )}>
        
          {cat.label}
        </button>
      )}
    </div>);

}

/* ── Helpers for storing/retrieving category in description ── */
function buildDescriptionWithCategory(category: string, description: string): string {
  if (!category) return description;
  return description ? `[${category}]\n${description}` : `[${category}]`;
}

function parseDescriptionCategory(description: string | null): {category: string;text: string;} {
  if (!description) return { category: "", text: "" };
  const match = description.match(/^\[([^\]]+)\]\n?([\s\S]*)$/);
  if (match) {
    const cat = match[1];
    if (CATEGORIES.some((c) => c.label === cat) || Object.keys(LEGACY_CATEGORY_MAP).includes(cat)) {
      return { category: normalizeCategoryLabel(cat), text: match[2].trim() };
    }
  }
  return { category: "", text: description };
}

/**
 * For legacy data: subject IS the category. For new data: subject is free-text title, category in description.
 */
function extractTitleAndCategory(subject: string, description: string | null) {
  const normalizedSubject = normalizeCategoryLabel(subject);
  // Strip bracket-only descriptions (e.g. "[Behov nå]")
  const stripBracketOnly = (d: string | null | undefined): string => {
    if (!d) return "";
    return /^\[.+\]$/.test(d.trim()) ? "" : d || "";
  };
  // Legacy: subject is a known category label
  if (CATEGORIES.some((c) => c.label === normalizedSubject)) {
    return { title: normalizedSubject, category: normalizedSubject, cleanDesc: "" };
  }
  // New format: category in description prefix
  const parsed = parseDescriptionCategory(description);
  return {
    title: subject,
    category: parsed.category,
    cleanDesc: cleanDescription(stripBracketOnly(parsed.text)) || ""
  };
}

interface ContactCardContentProps {
  contactId: string;
  editable?: boolean;
  onOpenCompany?: (companyId: string) => void;
  onNavigateToFullPage?: () => void;
}

// Inline editable text field
function InlineField({
  value,
  onSave,
  placeholder,
  className





}: {value: string;onSave: (v: string) => void;placeholder?: string;className?: string;}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, value]);

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed !== value) onSave(trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        onBlur={save}
        className={cn("bg-transparent border-b border-primary/40 outline-none py-0.5 min-w-[60px]", className)} />);


  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn(
        "group inline-flex items-center gap-1 hover:text-foreground/60 transition-colors cursor-text",
        !value && "text-muted-foreground/40 italic",
        className
      )}>
      
      <span>{value || placeholder || "—"}</span>
      <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
    </button>);

}

const SUGGESTED_TECH_TAGS = [
"C++",
"C",
"Embedded",
"Yocto",
"Linux",
"Qt",
"FPGA",
"Python",
"SPI/I2C",
"MCU",
"Embedded Linux",
"Sikkerhet",
"AUTOSAR",
"FreeRTOS"];


function TechTagEditor({
  tags,
  onSave,
  contact,
  updateMutation,
  showAnalyze,
  setShowAnalyze







}: {tags: string[];onSave: (tags: string[]) => void;contact?: any;updateMutation?: any;showAnalyze?: boolean;setShowAnalyze?: (v: boolean) => void;}) {
  const [input, setInput] = useState("");

  const [analyzeText, setAnalyzeText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const addTags = (raw: string) => {
    const newTags = raw.
    split(/[,;\n]+/).
    map((s) => s.trim()).
    filter(Boolean);
    const unique = newTags.filter((t) => !tags.includes(t));
    if (unique.length) onSave([...tags, ...unique.filter((t, i, a) => a.indexOf(t) === i)]);
    setInput("");
  };

  const removeTag = (tag: string) => {
    onSave(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      addTags(input);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text");
    if (pasted.includes(",") || pasted.includes(";") || pasted.includes("\n")) {
      e.preventDefault();
      addTags(pasted);
    }
  };

  const handleAnalyzeText = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: [
          {
            role: "user",
            content: `Analyser denne teksten og trekk ut relevante teknologier, programmeringsspråk, rammeverk og fagområder som er relevante for embedded/firmware/C/C++ konsulentbransjen. Returner KUN en JSON-array med strings, ingen annen tekst. Eksempel: ["C++", "Embedded Linux", "RTOS"]\n\nTekst:\n${analyzeText}`
          }]

        }
      });
      if (error) throw error;
      // Parse SSE streamed response or direct JSON
      let resultText = "";
      if (typeof data === "string") {
        // SSE response - extract content from data lines
        const lines = data.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || "";
            resultText += content;
          } catch {

            /* skip partial */}
        }
      } else {
        resultText = data?.choices?.[0]?.message?.content || JSON.stringify(data);
      }
      const clean = resultText.replace(/```json|```/g, "").trim();
      const parsed: string[] = JSON.parse(clean);
      const existing = tags || [];
      const merged = [...new Set([...existing, ...parsed])];
      onSave(merged);
      if (setShowAnalyze) setShowAnalyze(false);
      setAnalyzeText("");
      toast.success(`${parsed.filter((t) => !existing.includes(t)).length} teknologier lagt til`);
    } catch {
      toast.error("Kunne ikke analysere tekst");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 p-2 border border-border rounded-lg bg-background min-h-[36px]">
        {tags.map((t) =>
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[0.75rem] text-foreground">
          
            {t}
            <button onClick={() => removeTag(t)} className="hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </span>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={tags.length === 0 ? "Legg til teknologi..." : ""}
          className="flex-1 min-w-[100px] bg-transparent outline-none text-[0.8125rem] placeholder:text-muted-foreground" />
        
      </div>
      {showAnalyze &&
      <div className="mt-2 p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
          <p className="text-[0.75rem] text-muted-foreground">
            Lim inn tekst og AI henter ut relevante tags som legges til
          </p>
          <Textarea
          value={analyzeText}
          onChange={(e) => setAnalyzeText(e.target.value)}
          placeholder="Lim inn tekst her..."
          rows={4}
          className="text-[0.875rem] rounded-md resize-none" />
        

          <div className="flex items-center gap-2">
            <button
            onClick={handleAnalyzeText}
            disabled={!analyzeText.trim() || isAnalyzing}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-[0.75rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-colors">
            
              <Sparkles className="h-3.5 w-3.5" />
              {isAnalyzing ? "Analyserer..." : "Finn teknologier"}
            </button>
            <button
            onClick={() => {
              if (setShowAnalyze) setShowAnalyze(false);
              setAnalyzeText("");
            }}
            className="text-[0.75rem] text-muted-foreground hover:text-foreground">
            
              Avbryt
            </button>
          </div>
        </div>
      }
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {SUGGESTED_TECH_TAGS.filter((s) => !tags.includes(s)).
        slice(0, 8).
        map((s) =>
        <button
          key={s}
          onClick={() => addTags(s)}
          className="h-6 px-2 text-[0.6875rem] rounded-full border border-border text-muted-foreground hover:bg-secondary transition-colors">
          
              {s}
            </button>
        )}
      </div>
    </div>);

}

const DATE_CHIPS = [
  { label: "Følg opp på sikt", fn: (): Date | null => null },
  { label: "I dag", fn: () => new Date() },
  { label: "1 uke", fn: () => addWeeks(new Date(), 1) },
  { label: "2 uker", fn: () => addWeeks(new Date(), 2) },
  { label: "3 uker", fn: () => addWeeks(new Date(), 3) },
  { label: "1 måned", fn: () => addMonths(new Date(), 1) },
  { label: "3 måneder", fn: () => addMonths(new Date(), 3) },
  { label: "6 måneder", fn: () => addMonths(new Date(), 6) },
  { label: "1 år", fn: () => addYears(new Date(), 1) },
];


export function ContactCardContent({
  contactId,
  editable = false,
  onOpenCompany,
  onNavigateToFullPage
}: ContactCardContentProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Form states
  const [activeForm, setActiveForm] = useState<"call" | "meeting" | "task" | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDate, setFormDate] = useState("");
  const [selectedChipIdx, setSelectedChipIdx] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const descTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [changingCompany, setChangingCompany] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [companyResults, setCompanyResults] = useState<{id: string;name: string;}[]>([]);
  const companySearchRef = useRef<HTMLInputElement>(null);
  const [matchingConsultants, setMatchingConsultants] = useState(false);
  const [consultantResults, setConsultantResults] = useState<any[] | null>(null);
  const [showAnalyze, setShowAnalyze] = useState(false);

  const { data: contact, isLoading } = useQuery({
    queryKey: ["contact", contactId],
    queryFn: async () => {
      const { data, error } = await supabase.
      from("contacts").
      select("*, companies(id, name, city), profiles!contacts_owner_id_fkey(full_name)").
      eq("id", contactId).
      single();
      if (error) throw error;
      return data;
    },
    enabled: !!contactId
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name").order("full_name");
      if (error) throw error;
      return data;
    }
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["contact-activities", contactId],
    queryFn: async () => {
      const { data, error } = await supabase.
      from("activities").
      select("*").
      eq("contact_id", contactId).
      order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!contactId
  });

  const profileMap = Object.fromEntries(allProfiles.map((p) => [p.id, p.full_name.split(" ")[0]]));
  const profileMapFull = Object.fromEntries(allProfiles.map((p) => [p.id, p.full_name]));

  const { data: tasks = [] } = useQuery({
    queryKey: ["contact-tasks", contactId],
    queryFn: async () => {
      const { data, error } = await supabase.
      from("tasks").
      select("*, companies(name)").
      eq("contact_id", contactId).
      neq("status", "done").
      order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
    enabled: !!contactId
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("contacts").update(updates).eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact", contactId] });
      queryClient.invalidateQueries({ queryKey: ["contacts-full"] });
    },
    onError: () => toast.error("Kunne ikke oppdatere")
  });

  const createActivityMutation = useMutation({
    mutationFn: async ({ type, subject, description }: {type: string;subject: string;description?: string;}) => {
      const { error } = await supabase.from("activities").insert({
        type,
        subject: subject.trim(),
        description: description?.trim() || null,
        contact_id: contactId,
        company_id: contact?.company_id || null,
        created_by: user?.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-activities", contactId] });
      queryClient.invalidateQueries({ queryKey: ["contacts-full"] });
      queryClient.invalidateQueries({ queryKey: ["companies-full"] });
      toast.success("Aktivitet registrert");
      closeForm();
    },
    onError: () => toast.error("Kunne ikke lagre")
  });

  const createTaskMutation = useMutation({
    mutationFn: async ({ title, description }: {title: string;description?: string | null;}) => {
      const { error } = await supabase.from("tasks").insert({
        title: title.trim(),
        description: description?.trim() || null,
        priority: "medium",
        due_date: formDate === "someday" ? null : (formDate || null),
        contact_id: contactId,
        company_id: contact?.company_id || null,
        assigned_to: user?.id,
        created_by: user?.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-tasks", contactId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Oppfølging opprettet");
      closeForm();
    },
    onError: () => toast.error("Kunne ikke opprette oppfølging")
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.
      from("tasks").
      update({
        status: "done",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).
      eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-tasks", contactId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Oppfølging fullført", { duration: 2000 });
    }
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      const { error } = await supabase.from("activities").delete().eq("id", activityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-activities", contactId] });
      toast.success("Aktivitet slettet");
    }
  });

  const updateActivityMutation = useMutation({
    mutationFn: async ({ id, updates }: {id: string;updates: Record<string, any>;}) => {
      const { error } = await supabase.from("activities").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-activities", contactId] });
      toast.success("Oppdatert");
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-tasks", contactId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Oppfølging slettet");
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, updates }: {id: string;updates: Record<string, any>;}) => {
      const { error } = await supabase.
      from("tasks").
      update({ ...updates, updated_at: new Date().toISOString() }).
      eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-tasks", contactId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Oppdatert");
    }
  });

  const handleFinnKonsulent = async () => {
    const teknologier = (contact as any).teknologier || [];
    if (!teknologier.length) {
      toast("Legg til teknisk profil på kontakten først");
      return;
    }
    setMatchingConsultants(true);
    setConsultantResults(null);
    try {
      const [{ data: interne }, { data: foresporsler }] = await Promise.all([
      supabase.
      from("stacq_ansatte").
      select("id, navn, kompetanse, geografi, erfaring_aar, status").
      in("status", ["AKTIV/SIGNERT"]),
      supabase.
      from("foresporsler").
      select("teknologier").
      eq("selskap_id", contact.company_id || "").
      gte("mottatt_dato", new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))]
      );

      const effectiveSignal = getEffectiveSignal(
        activities.map((a: any) => ({ created_at: a.created_at, subject: a.subject, description: a.description })),
        tasks.map((t: any) => ({
          created_at: t.created_at,
          title: t.title,
          description: t.description,
          due_date: t.due_date
        }))
      );

      const sisteAktivitet = activities[0]?.created_at ?
      new Date(activities[0].created_at).toLocaleDateString("nb-NO", {
        day: "numeric",
        month: "long",
        year: "numeric"
      }) :
      null;

      const { data, error } = await supabase.functions.invoke("match-contact-to-consultants", {
        body: {
          kontakt_teknologier: teknologier,
          kontakt_navn: `${contact.first_name} ${contact.last_name}`,
          selskap_navn: companyName || "",
          selskap_id: contact.company_id || null,
          kontakt_er_innkjoper: (contact as any).call_list || false,
          kontakt_signal: effectiveSignal || "Ukjent om behov",
          aktive_foresporsler: foresporsler || [],
          siste_kontakt_dato: sisteAktivitet,
          interne: interne || []
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setConsultantResults(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke kjøre matching");
      setConsultantResults([]);
    } finally {
      setMatchingConsultants(false);
    }
  };

  const openForm = (type: "call" | "meeting" | "task") => {
    setActiveForm(type);
    setFormTitle(type === "task" ? "Følg opp om behov" : "");
    setFormCategory("");
    setFormDescription("");
    setFormDate("");
    setSelectedChipIdx(null);
  };

  const closeForm = () => {
    setActiveForm(null);
    setFormTitle("");
    setFormCategory("");
    setFormDescription("");
    setFormDate("");
    setSelectedChipIdx(null);
  };

  const handleFormSubmit = () => {
    if (!formTitle || !formCategory) return;
    if (activeForm === "task") {
      const descWithCat = buildDescriptionWithCategory(formCategory, formDescription);
      const finalDesc = formDate === "someday"
        ? (descWithCat ? descWithCat + "\n[someday]" : "[someday]")
        : descWithCat || null;
      createTaskMutation.mutate({ title: formTitle.trim(), description: finalDesc });
    } else {
      const descWithCat = buildDescriptionWithCategory(formCategory, formDescription);
      createActivityMutation.mutate({
        type: activeForm === "call" ? "call" : "meeting",
        subject: formTitle.trim(),
        description: descWithCat || undefined
      });
    }
  };

  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") closeForm();
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleFormSubmit();
  };

  const updateField = (field: string) => (value: string) => {
    updateMutation.mutate({ [field]: value || null });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast("Kopiert!", { duration: 1500 });
  };

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-7 w-48 bg-secondary rounded" />
        <div className="h-4 w-32 bg-secondary rounded" />
      </div>);

  }
  if (!contact) return <p className="text-sm text-muted-foreground">Kontakt ikke funnet</p>;

  const companyName = (contact.companies as any)?.name;
  const companyId = (contact.companies as any)?.id;
  const companyCity = (contact.companies as any)?.city as string | null;
  const companyLocations: string[] = companyCity ?
  companyCity.
  split(",").
  map((s: string) => s.trim()).
  filter(Boolean) :
  [];
  const showAvdeling = companyLocations.length > 1;

  return (
    <div>
      {/* ── ZONE A: Contact Header ── */}
      <div className="mb-5">
        <div className="flex items-center gap-3">
          {editable ?
          <h2 className="text-[1.5rem] font-bold truncate flex-1 min-w-0">
              <InlineField
              value={`${contact.first_name} ${contact.last_name}`}
              onSave={(v) => {
                const parts = v.split(" ");
                const first = parts[0] || "";
                const last = parts.slice(1).join(" ") || "";
                updateMutation.mutate({ first_name: first, last_name: last });
              }}
              className="text-[1.5rem] font-bold" />
            
            </h2> :

          <h2 className="text-[1.5rem] font-bold truncate flex-1 min-w-0">
              {contact.first_name} {contact.last_name}
            </h2>
          }
          {/* Owner badge */}
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {/* Signal badge */}
            {editable &&
            (() => {
              const effectiveSignal = getEffectiveSignal(
                activities.map((a) => ({ created_at: a.created_at, subject: a.subject, description: a.description })),
                tasks.map((t) => ({
                  created_at: t.created_at,
                  title: t.title,
                  description: t.description,
                  due_date: t.due_date
                }))
              );
              const signalCat = effectiveSignal ? CATEGORIES.find((c) => c.label === effectiveSignal) : null;
              return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      {signalCat ?
                    <button
                      className={cn(
                        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold cursor-pointer",
                        signalCat.badgeColor
                      )}>
                      
                          {signalCat.label}
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </button> :

                    <button className="inline-flex items-center rounded-full border border-dashed border-border px-2.5 py-0.5 text-[0.6875rem] text-muted-foreground/50 cursor-pointer hover:text-muted-foreground hover:border-muted-foreground/40 transition-colors">
                          Legg til signal
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </button>
                    }
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {CATEGORIES.map((cat) =>
                    <DropdownMenuItem
                      key={cat.label}
                      onClick={() => {
                        createActivityMutation.mutate({
                          type: "note",
                          subject: cat.label,
                          description: `[${cat.label}]`
                        });
                      }}>
                      
                          <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold mr-2",
                          cat.badgeColor
                        )}>
                        
                            {cat.label}
                          </span>
                        </DropdownMenuItem>
                    )}
                    </DropdownMenuContent>
                  </DropdownMenu>);

            })()}
            {editable &&
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap cursor-pointer">
                    {contact.owner_id && profileMapFull[contact.owner_id] ? profileMapFull[contact.owner_id] : "Eier"}
                    <ChevronDown className="h-3 w-3 ml-1 flex-shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {allProfiles.map((p) =>
                <DropdownMenuItem key={p.id} onClick={() => updateMutation.mutate({ owner_id: p.id })}>
                      <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[0.6875rem] font-medium">
                        {p.full_name}
                      </span>
                    </DropdownMenuItem>
                )}
                </DropdownMenuContent>
              </DropdownMenu>
            }
            {!editable && onNavigateToFullPage &&
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={onNavigateToFullPage}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            }
          </div>
        </div>

        {/* Line 2: Selskap · Sted */}
        <div className="flex items-center gap-1.5 flex-wrap text-[0.875rem] mt-1.5">
          {companyName &&
          <span className="group/co inline-flex items-center gap-1">
              <button
              className="text-primary font-medium hover:underline"
              onClick={() => onOpenCompany ? onOpenCompany(companyId) : navigate(`/selskaper/${companyId}`)}>
              
                {companyName}
              </button>
              {editable &&
            <button
              onClick={() => {
                setChangingCompany(true);
                setCompanySearch("");
                setCompanyResults([]);
                setTimeout(() => companySearchRef.current?.focus(), 0);
              }}
              className="opacity-0 group-hover/co:opacity-60 hover:!opacity-100 transition-opacity">
              
                  <Pencil className="h-2.5 w-2.5" />
                </button>
            }
            </span>
          }
          {!companyName && editable &&
          <button
            onClick={() => {
              setChangingCompany(true);
              setCompanySearch("");
              setCompanyResults([]);
              setTimeout(() => companySearchRef.current?.focus(), 0);
            }}
            className="text-muted-foreground/40 italic inline-flex items-center gap-1 hover:text-foreground/60 transition-colors">
            
              Selskap <Pencil className="h-2.5 w-2.5" />
            </button>
          }
          {(() => {
            const contactLocations: string[] = (contact as any).locations || [];
            if (companyLocations.length === 0) return null;
            return (
              <>
                <span className="text-muted-foreground/40">·</span>
                <div className="inline-flex items-center gap-1 flex-wrap">
                  <MapPin className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                  {companyLocations.map((loc) => {
                    const isSelected = contactLocations.includes(loc);
                    return (
                      <button
                        key={loc}
                        onClick={() => {
                          const next = isSelected ?
                          contactLocations.filter((l) => l !== loc) :
                          [...contactLocations, loc];
                          updateMutation.mutate({ locations: next } as any);
                        }}
                        className={cn(
                          "text-[0.8125rem] px-1.5 py-0 rounded transition-colors",
                          isSelected ?
                          "text-foreground font-medium" :
                          "text-muted-foreground/40 hover:text-muted-foreground"
                        )}>
                        
                        {loc}
                      </button>);

                  })}
                </div>
              </>);

          })()}
          {(contact as any).location &&
          <>
              <span className="text-muted-foreground/40">·</span>
              
            </>
          }
          {/* Avdeling · Stilling — same line */}
          {showAvdeling &&
          <>
              <span className="text-muted-foreground/40">·</span>
              {editable ?
            <InlineField
              value={(contact as any).department || ""}
              onSave={updateField("department")}
              placeholder="Avdeling"
              className="text-[0.875rem]" /> :
            (contact as any).department && <span>{(contact as any).department}</span>
            }
            </>
          }
          {(contact.title || editable) &&
          <>
              <span className="text-muted-foreground/40">·</span>
              {editable ?
            <InlineField
              value={contact.title || ""}
              onSave={updateField("title")}
              placeholder="Stilling"
              className="text-[0.875rem]" /> :
            <span>{contact.title}</span>}
            </>
          }
        </div>

        {/* Line 3: Telefon · E-post · LinkedIn */}
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          {contact.phone ?
          <a
            href={`tel:${contact.phone}`}
            onClick={(e) => {
              e.preventDefault();
              copyToClipboard(contact.phone!);
            }}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-border bg-secondary text-[0.8125rem] text-foreground hover:bg-secondary/80 transition-colors">
            
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              {editable ?
            <InlineField value={contact.phone} onSave={updateField("phone")} className="text-[0.8125rem]" /> :

            contact.phone
            }
            </a> :
          editable ?
          <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-dashed border-border text-[0.8125rem] text-muted-foreground/50 hover:text-muted-foreground hover:border-muted-foreground/40 transition-colors">
              <Phone className="h-3.5 w-3.5" />
              <InlineField value="" onSave={updateField("phone")} placeholder="Telefon" className="text-[0.8125rem]" />
            </span> :
          null}
          {contact.email ?
          <a
            href={`mailto:${contact.email}`}
            onClick={(e) => {
              e.preventDefault();
              copyToClipboard(contact.email!);
            }}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-border bg-secondary text-[0.8125rem] text-foreground hover:bg-secondary/80 transition-colors">
            
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              {editable ?
            <InlineField value={contact.email} onSave={updateField("email")} className="text-[0.8125rem]" /> :

            contact.email
            }
            </a> :
          editable ?
          <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-dashed border-border text-[0.8125rem] text-muted-foreground/50 hover:text-muted-foreground hover:border-muted-foreground/40 transition-colors">
              <Mail className="h-3.5 w-3.5" />
              <InlineField value="" onSave={updateField("email")} placeholder="E-post" className="text-[0.8125rem]" />
            </span> :
          null}
          {contact.linkedin ?
          <a
            href={contact.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-border bg-secondary text-[0.8125rem] text-foreground hover:bg-secondary/80 transition-colors">
            
              <Linkedin className="h-3.5 w-3.5 text-muted-foreground" />
              LinkedIn
            </a> :
          editable ?
          <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-dashed border-border text-[0.8125rem] text-muted-foreground/50 hover:text-muted-foreground hover:border-muted-foreground/40 transition-colors">
              <Linkedin className="h-3.5 w-3.5" />
              <InlineField
              value=""
              onSave={updateField("linkedin")}
              placeholder="LinkedIn"
              className="text-[0.8125rem]" />
            
            </span> :
          null}
        </div>
        {/* Status-piller */}
        <div className="flex items-center gap-2 flex-wrap mt-2 pt-2 border-t border-border/40">
          {/* CV-Epost */}
          <button
            onClick={() => {
              if (!contact.cv_email && !(contact as any).email) {
                toast.error("Legg til e-postadresse før du aktiverer CV-Epost-listen");
                return;
              }
              updateMutation.mutate({ cv_email: !(contact as any).cv_email });
            }}
            className={cn(
              "inline-flex items-center h-7 px-3 rounded-full border text-[0.75rem] font-medium transition-colors",
              (contact as any).cv_email ?
              "bg-green-100 text-green-800 border-green-200" :
              "bg-background text-muted-foreground border-border hover:bg-secondary"
            )}>
            {(contact as any).cv_email ? "✓ CV-Epost" : "CV-Epost"}
          </button>
          {/* Innkjøper */}
          <button
            onClick={() => updateMutation.mutate({ call_list: !(contact as any).call_list })}
            className={cn(
              "inline-flex items-center h-7 px-3 rounded-full border text-[0.75rem] font-medium transition-colors",
              (contact as any).call_list ?
              "bg-amber-100 text-amber-800 border-amber-200" :
              "bg-background text-muted-foreground border-border hover:bg-secondary"
            )}>
            {(contact as any).call_list ? "✓ Innkjøper" : "Innkjøper"}
          </button>
          {/* Ikke aktuell å kontakte */}
          <button
            onClick={() => updateMutation.mutate({ ikke_aktuell_kontakt: !(contact as any).ikke_aktuell_kontakt })}
            className={cn(
              "inline-flex items-center h-7 px-3 rounded-full border text-[0.75rem] font-medium transition-colors",
              (contact as any).ikke_aktuell_kontakt ?
              "bg-destructive/10 text-destructive border-destructive/30" :
              "bg-background text-muted-foreground border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            )}>
            {(contact as any).ikke_aktuell_kontakt ? "✕ Ikke aktuell å kontakte" : "Ikke aktuell å kontakte"}
          </button>
        </div>
        {changingCompany &&
        <div className="relative mt-1.5">
            <Input
            ref={companySearchRef}
            value={companySearch}
            onChange={async (e) => {
              const q = e.target.value;
              setCompanySearch(q);
              if (q.trim().length < 2) {
                setCompanyResults([]);
                return;
              }
              const { data } = await supabase.
              from("companies").
              select("id, name").
              ilike("name", `%${q.trim()}%`).
              limit(8);
              setCompanyResults(data || []);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setChangingCompany(false);
            }}
            placeholder="Søk selskap..."
            className="h-8 text-sm rounded-lg w-64" />
          

            {companyResults.length > 0 &&
          <div className="absolute z-50 mt-1 w-64 bg-background border border-border rounded-lg shadow-md py-1 max-h-48 overflow-y-auto">
                {companyResults.map((c) =>
            <button
              key={c.id}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-secondary transition-colors"
              onClick={() => {
                updateMutation.mutate({ company_id: c.id });
                setChangingCompany(false);
              }}>
              
                    {c.name}
                  </button>
            )}
              </div>
          }
          </div>
        }

      </div>

      <div className="space-y-0">
        {/* ── Tekniske behov ── */}
        <div className="mb-5">
          {editable &&
          <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Teknisk behov for {contact.first_name} {contact.last_name}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                  onClick={() => setShowAnalyze(!showAnalyze)}
                  className="inline-flex items-center gap-1.5 h-7 px-3 text-[0.75rem] font-medium rounded-lg border border-border bg-background text-foreground hover:bg-secondary transition-colors">
                  
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> Legg til teknologi tags
                  </button>
                  {contact.teknologier && (contact.teknologier as string[]).length > 0 &&
                <button
                  onClick={handleFinnKonsulent}
                  disabled={matchingConsultants}
                  className="inline-flex items-center gap-1.5 h-7 px-3 text-[0.75rem] font-medium rounded-lg border border-border bg-background text-foreground hover:bg-secondary transition-colors disabled:opacity-50">
                  
                      {matchingConsultants ?
                  <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Matcher...
                        </> :

                  <>
                          <Target className="h-3.5 w-3.5 text-primary" /> Finn konsulent
                        </>
                  }
                    </button>
                }
                </div>
              </div>
              <TechTagEditor
              tags={(contact as any).teknologier || []}
              onSave={(tags) => updateMutation.mutate({ teknologier: tags })}
              contact={contact}
              updateMutation={updateMutation}
              showAnalyze={showAnalyze}
              setShowAnalyze={setShowAnalyze} />
            
            </div>
          }
          {!editable && (contact as any).teknologier?.length > 0 &&
          <div>
              <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground block mb-2">
                Tekniske behov
              </span>
              <div className="flex flex-wrap gap-1.5">
                {((contact as any).teknologier as string[]).map((t: string) =>
              <span
                key={t}
                className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-[0.75rem] font-medium text-foreground">
                
                    {t}
                  </span>
              )}
              </div>
            </div>
          }

          {/* AI Signal suggestion */}
          {editable &&
          activities.length > 0 &&
          (() => {
            const effectiveSignal = getEffectiveSignal(
              activities.map((a) => ({ created_at: a.created_at, subject: a.subject, description: a.description })),
              tasks.map((t) => ({
                created_at: t.created_at,
                title: t.title,
                description: t.description,
                due_date: t.due_date
              }))
            );
            const lastTaskDue = tasks.length > 0 ? tasks[0]?.due_date || null : null;
            return (
              <AiSignalBanner
                contactId={contactId}
                contactName={`${contact.first_name} ${contact.last_name}`}
                currentSignal={effectiveSignal}
                activities={activities.
                slice(0, 5).
                map((a) => ({ type: a.type, subject: a.subject, created_at: a.created_at }))}
                lastTaskDueDate={lastTaskDue}
                onUpdateSignal={(signal) => {
                  createActivityMutation.mutate({
                    type: "note",
                    subject: signal,
                    description: `[${signal}]`
                  });
                }} />);


          })()}
        </div>

        {/* ── Notat ── */}
        <div className="mb-5">
          {editingNotes ?
          <div>
              <Textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={3}
              autoFocus
              className="text-[0.875rem] rounded-md"
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditingNotes(false);
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  updateField("notes")(notesDraft);
                  setEditingNotes(false);
                }
              }} />
            

              <div className="flex gap-2 mt-1.5">
                <Button
                size="sm"
                className="h-7 text-[0.75rem] px-3 rounded-md"
                onClick={() => {
                  updateField("notes")(notesDraft);
                  setEditingNotes(false);
                }}>
                
                  Lagre
                </Button>
                <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[0.75rem] px-3 rounded-md"
                onClick={() => setEditingNotes(false)}>
                
                  Avbryt
                </Button>
              </div>
            </div> :
          contact.notes ?
          <div className="group relative">
              <p className="text-[0.8125rem] text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {contact.notes}
              </p>
              {editable









            }
            </div> :
          editable ?
          <button
            onClick={() => {
              setNotesDraft("");
              setEditingNotes(true);
            }}
            className="text-[0.75rem] text-muted-foreground/50 hover:text-muted-foreground inline-flex items-center gap-1 transition-colors">
            
              <Pencil className="h-3 w-3" /> Legg til notat
            </button> :
          null}
        </div>

        {/* ── Separator + Action Bar ── */}
        {editable &&
        <div className="border-t border-border pt-4 pb-6">
            <div className="flex items-center gap-2 flex-wrap">
              <button
              onClick={() => openForm("call")}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg transition-colors bg-[hsl(var(--success))] text-white hover:opacity-90">
              
                <MessageCircle className="h-[15px] w-[15px]" /> Logg samtale
              </button>
              <button
              onClick={() => openForm("meeting")}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg transition-colors bg-primary text-primary-foreground hover:opacity-90">
              
                <FileText className="h-[15px] w-[15px]" /> Logg møtereferat
              </button>
              <button
              onClick={() => openForm("task")}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg border border-border bg-background text-foreground hover:bg-secondary transition-colors">
              
                <Clock className="h-[15px] w-[15px] text-[hsl(var(--warning))]" /> Ny oppfølging
              </button>
            </div>

            {/* Inline form */}
            {activeForm &&
          <div className="mt-3 animate-in slide-in-from-top-1 duration-200" onKeyDown={handleFormKeyDown}>
                <div className="mb-3">
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5 block">
                    Tittel
                  </span>
                  <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Tittel"
                className="text-[0.9375rem] rounded-md"
                autoFocus />
              

                  {activeForm === "call" &&
              <div className="flex items-center gap-1.5 mt-2">
                      <button
                  type="button"
                  onClick={() => setFormTitle("Ringte, ikke svar")}
                  className="inline-flex items-center gap-1 h-6 px-2.5 text-[0.6875rem] rounded-full border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                  
                        <PhoneOff className="h-3 w-3" /> Ringte, ikke svar
                      </button>
                      <button
                  type="button"
                  onClick={() => setFormTitle("Sendt LinkedIn melding")}
                  className="inline-flex items-center gap-1 h-6 px-2.5 text-[0.6875rem] rounded-full border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                  
                        <Send className="h-3 w-3" /> Sendt LinkedIn melding
                      </button>
                    </div>
              }
                </div>

                <div className="mb-3">
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5 block">
                    Kategori
                  </span>
                  <CategoryPicker selected={formCategory} onSelect={setFormCategory} />
                </div>

                <Textarea
              ref={descTextareaRef}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Beskrivelse (valgfritt)"
              rows={3}
              className="text-[0.9375rem] rounded-md border-border focus:ring-primary/30 resize-none" />
            

                {activeForm === "task" ?
            <div className="mt-3">
                    <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Når?
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {DATE_CHIPS.map((chip, i) =>
                <button
                  key={chip.label}
                  type="button"
                   onClick={() => {
                     const d = chip.fn();
                     if (d === null) {
                       setFormDate("someday");
                       setSelectedChipIdx(i);
                     } else {
                       setFormDate(format(d, "yyyy-MM-dd"));
                       setSelectedChipIdx(i);
                     }
                   }}
                  className={cn(
                    "h-7 px-2.5 text-[0.75rem] rounded-full border transition-colors",
                    selectedChipIdx === i ?
                    "bg-primary/10 border-primary/30 text-primary font-medium" :
                    "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}>
                  
                          {chip.label}
                        </button>
                )}
                      <input
                  type="date"
                  value={formDate}
                  onChange={(e) => {
                    setFormDate(e.target.value);
                    setSelectedChipIdx(null);
                  }}
                  className="h-7 px-2 text-[0.75rem] rounded-full border border-border text-muted-foreground bg-background" />
                
                    </div>
                    {formDate === "someday" ? (
                      <p className="text-[0.75rem] text-muted-foreground mt-2">
                        Ingen fast dato — legges i "Følg opp på sikt"-listen
                      </p>
                    ) : formDate ? (
                      <p className="text-[0.75rem] text-muted-foreground mt-2">
                        Frist: {format(new Date(formDate), "d. MMMM yyyy", { locale: nb })}
                      </p>
                    ) : null}
                  </div> :

            <div className="mt-2">
                    <span className="text-[0.75rem] text-muted-foreground">
                      Dato: I dag, {format(new Date(), "d. MMMM", { locale: nb })}
                    </span>
                  </div>
            }

                <div className="flex items-center gap-2 mt-3">
                  <Button
                size="sm"
                className="h-[34px] px-4 text-[0.8125rem] rounded-md"
                disabled={
                !formTitle.trim() ||
                !formCategory ||
                activeForm === "task" && createTaskMutation.isPending ||
                activeForm !== "task" && createActivityMutation.isPending
                }
                onClick={handleFormSubmit}>
                
                    {activeForm === "task" ?
                "Lagre oppfølging" :
                activeForm === "meeting" ?
                "Lagre referat" :
                "Lagre samtale"}
                  </Button>
                  <Button
                variant="ghost"
                size="sm"
                className="h-[34px] px-3 text-[0.8125rem] text-muted-foreground rounded-md"
                onClick={closeForm}>
                
                    Avbryt
                  </Button>
                </div>
              </div>
          }
          </div>
        }

        {/* ── Konsulent match-resultater ── */}
        {consultantResults !== null &&
        <div className="space-y-3 mb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Konsulentmatch
                </span>
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary/10 text-primary text-[0.6875rem] font-semibold">
                  {consultantResults.length}
                </span>
              </div>
              <button
              onClick={handleFinnKonsulent}
              className="text-[0.75rem] text-muted-foreground hover:text-foreground transition-colors">
              
                Kjør på nytt
              </button>
            </div>

            {consultantResults.length === 0 ?
          <p className="text-[0.8125rem] text-muted-foreground">Ingen treff med score ≥ 4</p> :

          <div className="space-y-2">
                {consultantResults.map((m: any, i: number) =>
            <div key={m.id} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[0.75rem] font-bold text-muted-foreground">#{i + 1}</span>
                        <span className="text-[0.875rem] font-semibold text-foreground truncate">{m.navn}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                    className={cn(
                      "inline-block h-2.5 w-2.5 rounded-full",
                      m.score >= 8 ? "bg-emerald-500" : m.score >= 6 ? "bg-amber-500" : "bg-red-500"
                    )} />
                  
                        <span className="text-[0.8125rem] font-bold text-foreground">{m.score}/10</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(m.match_tags || []).map((t: string) =>
                <span
                  key={t}
                  className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[0.6875rem] font-medium">
                  
                          {t}
                        </span>
                )}
                    </div>
                    <p className="text-[0.8125rem] text-muted-foreground mt-1.5 italic">{m.begrunnelse}</p>
                  </div>
            )}
              </div>
          }
          </div>
        }

        {/* ── Oppfølginger ── */}
        {tasks.length > 0 &&
        <div className="bg-card border border-border rounded-lg shadow-card p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Oppfølginger · {tasks.length}
              </h3>
            </div>
            <div className="space-y-px">
              {tasks.map((task) => {
              const overdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
              const today = task.due_date && isToday(new Date(task.due_date));
              return (
                <TaskRow
                  key={task.id}
                  task={task}
                  overdue={!!overdue}
                  today={!!today}
                  profileMap={profileMapFull}
                  onToggle={() => toggleTaskMutation.mutate(task.id)}
                  onDelete={(id) => deleteTaskMutation.mutate(id)}
                  onUpdate={(id, updates) => updateTaskMutation.mutate({ id, updates })}
                  editable={editable} />);


            })}
            </div>
          </div>
        }

        {/* ── Aktiviteter ── */}
        <div className="mt-8">
          <ActivityTimeline
            activities={activities}
            profileMap={profileMapFull}
            editable={editable}
            onDelete={(id) => deleteActivityMutation.mutate(id)}
            onUpdateActivity={(id, updates) => updateActivityMutation.mutate({ id, updates })} />
          
        </div>
      </div>
    </div>);

}

/* ── Task Row ── */

function TaskRow({
  task,
  overdue,
  today,
  profileMap,
  onToggle,
  onDelete,
  onUpdate,
  editable









}: {task: any;overdue: boolean;today: boolean;profileMap: Record<string, string>;onToggle: () => void;onDelete: (id: string) => void;onUpdate: (id: string, updates: Record<string, any>) => void;editable: boolean;}) {
  const [completing, setCompleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editCategory, setEditCategory] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDate, setEditDate] = useState(task.due_date || "");
  const [editChipIdx, setEditChipIdx] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    title: displayTitle,
    category: displayCategory,
    cleanDesc: displayDesc
  } = extractTitleAndCategory(task.title, task.description);

  const handleCheck = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCompleting(true);
    setTimeout(() => onToggle(), 250);
  };

  const handleRowClick = () => {
    if (!editable || completing || editing) return;
    const parsed = extractTitleAndCategory(task.title, task.description);
    setEditTitle(parsed.title);
    setEditCategory(parsed.category);
    setEditDesc(parsed.cleanDesc);
    const isSomeday = !task.due_date && !!task.description?.includes("[someday]");
    setEditDate(isSomeday ? "someday" : (task.due_date || ""));
    if (isSomeday) {
      setEditChipIdx(0);
    } else if (task.due_date) {
      const dueDateStr = task.due_date;
      const matchIdx = DATE_CHIPS.findIndex((chip, i) => {
        if (i === 0) return false;
        const d = chip.fn();
        if (!d) return false;
        return format(d, "yyyy-MM-dd") === dueDateStr;
      });
      setEditChipIdx(matchIdx >= 0 ? matchIdx : null);
    } else {
      setEditChipIdx(null);
    }
    setEditing(true);
  };

  const handleSave = () => {
    if (!editTitle || !editCategory) return;
    const descWithCat = buildDescriptionWithCategory(editCategory, editDesc.trim());
    onUpdate(task.id, { title: editTitle.trim(), description: descWithCat || null, due_date: editDate === "someday" ? null : (editDate || null) });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="py-2.5 px-1 space-y-2 animate-in fade-in duration-150">
        <div>
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5 block">
            Tittel
          </span>
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="text-[0.9375rem] rounded-md"
            autoFocus />
          
        </div>
        <div>
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5 block">
            Kategori
          </span>
          <CategoryPicker selected={editCategory} onSelect={setEditCategory} />
        </div>
        <Textarea
          value={editDesc}
          onChange={(e) => setEditDesc(e.target.value)}
          rows={3}
          placeholder="Beskrivelse (valgfritt)"
          className="text-[0.875rem] rounded-md"
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSave();
          }} />
        

        <div>
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Når?</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {DATE_CHIPS.map((chip, i) =>
            <button
              key={chip.label}
              type="button"
               onClick={() => {
                 const d = chip.fn();
                 if (d === null) {
                   setEditDate("someday");
                   setEditChipIdx(i);
                 } else {
                   setEditDate(format(d, "yyyy-MM-dd"));
                   setEditChipIdx(i);
                 }
               }}
              className={cn(
                "h-7 px-2.5 text-[0.75rem] rounded-full border transition-colors",
                editChipIdx === i ?
                "bg-primary/10 border-primary/30 text-primary font-medium" :
                "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}>
              
                {chip.label}
              </button>
            )}
            <input
              type="date"
              value={editDate}
              onChange={(e) => {
                setEditDate(e.target.value);
                setEditChipIdx(null);
              }}
              className="h-7 px-2 text-[0.75rem] rounded-full border border-border text-muted-foreground bg-background" />
            {editDate === "someday" && (
              <p className="text-[0.75rem] text-muted-foreground mt-2">
                Ingen fast dato — legges i "Følg opp på sikt"-listen
              </p>
            )}

          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-6 text-[0.6875rem] px-2 rounded"
            disabled={!editTitle.trim() || !editCategory}
            onClick={handleSave}>
            
            Lagre
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[0.6875rem] px-2 rounded"
            onClick={() => setEditing(false)}>
            
            Avbryt
          </Button>
          <div className="ml-auto">
            {confirmDelete ?
            <span className="text-[0.75rem] animate-in fade-in duration-150">
                <span className="text-destructive mr-1">Er du sikker?</span>
                <button
                onClick={() => {
                  onDelete(task.id);
                  setConfirmDelete(false);
                }}
                className="text-destructive font-medium hover:underline mr-1">
                
                  Ja, slett
                </button>
                <button onClick={() => setConfirmDelete(false)} className="text-muted-foreground hover:text-foreground">
                  Avbryt
                </button>
              </span> :

            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
              
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            }
          </div>
        </div>
      </div>);

  }

  return (
    <div
      onClick={handleRowClick}
      className={cn(
        "flex items-start gap-2.5 py-2.5 px-1 rounded-md transition-all duration-200 group hover:bg-background/60",
        completing && "opacity-30 line-through scale-[0.98]",
        editable && "cursor-pointer"
      )}>
      
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={completing}
          onCheckedChange={() => handleCheck({ stopPropagation: () => {} } as any)}
          className="h-4 w-4 rounded-[4px] border-2 border-muted-foreground/40 flex-shrink-0 mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
        
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[1.0625rem] font-bold text-foreground">{displayTitle}</div>
        {displayDesc && <p className="text-[0.875rem] text-foreground/70 truncate mt-0.5">{displayDesc}</p>}
        {task.assigned_to && profileMap[task.assigned_to] &&
        <div className="mt-1">
            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[0.6875rem] font-medium">
              {profileMap[task.assigned_to]}
            </span>
          </div>
        }
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0 mt-0.5">
        {task.due_date ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn(
                "text-[0.8125rem] font-medium",
                overdue ? "text-destructive" : today ? "text-[hsl(var(--warning))]" : "text-muted-foreground"
              )}>
                {format(new Date(task.due_date), "d. MMM yyyy", { locale: nb })}
              </span>
            </TooltipTrigger>
            <TooltipContent>{fullDate(task.due_date)}</TooltipContent>
          </Tooltip>
        ) : task.description?.includes("[someday]") || !task.due_date ? (
          <span className="text-[0.8125rem] font-medium text-muted-foreground italic">
            Følg opp på sikt
          </span>
        ) : null}
        {displayCategory && <CategoryBadge label={displayCategory} />}
      </div>
    </div>);

}

/* ── Activity Timeline ── */
function ActivityTimeline({
  activities,
  profileMap,
  editable,
  onDelete,
  onUpdateActivity






}: {activities: any[];profileMap: Record<string, string>;editable: boolean;onDelete: (id: string) => void;onUpdateActivity: (id: string, updates: Record<string, any>) => void;}) {
  const currentYear = getYear(new Date());

  const grouped = useMemo(() => {
    const groups: {key: string;label: string;period: string;items: any[];}[] = [];
    let currentKey = "";
    for (const act of activities) {
      const d = new Date(act.created_at);
      const monthKey = format(d, "yyyy-MM");
      if (monthKey !== currentKey) {
        currentKey = monthKey;
        const label = format(d, "MMMM yyyy", { locale: nb }).toUpperCase();
        const yr = getYear(d);
        let period = "";
        if (yr === currentYear - 1) period = "I fjor";else
        if (yr < currentYear - 1) period = `${currentYear - yr} år siden`;
        groups.push({ key: monthKey, label, period, items: [] });
      }
      groups[groups.length - 1].items.push(act);
    }
    return groups;
  }, [activities, currentYear]);

  if (activities.length === 0) {
    return (
      <div>
        <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Aktiviteter · 0
        </h3>
        <p className="text-[0.8125rem] text-muted-foreground/60 py-2">Ingen aktiviteter ennå</p>
      </div>);

  }

  return (
    <div>
      <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-4 mt-8">
        Aktiviteter · {activities.length}
      </h3>

      {grouped.map((group, gi) =>
      <div key={group.key}>
          {/* Month header */}
          <div className={cn("flex items-center gap-3 mb-3", gi > 0 && "mt-6")}>
            <span className="text-[0.8125rem] font-bold tracking-[0.04em] text-foreground whitespace-nowrap">
              {group.label}
            </span>
            {group.period && <span className="text-[0.8125rem] text-muted-foreground/60">· {group.period}</span>}
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Timeline spine */}
          <div className="relative pl-7">
            {/* Vertical line */}
            <div className="absolute left-[5px] top-[5px] bottom-0 w-[2px] bg-border" />

            <div className="space-y-6">
              {group.items.map((activity) =>
            <ActivityRow
              key={activity.id}
              activity={activity}
              currentYear={currentYear}
              profileMap={profileMap}
              editable={editable}
              onDelete={onDelete}
              onUpdateActivity={onUpdateActivity} />

            )}
            </div>
          </div>
        </div>
      )}
    </div>);

}

/* ── Single Activity Row ── */
function ActivityRow({
  activity,
  currentYear,
  profileMap,
  editable,
  onDelete,
  onUpdateActivity







}: {activity: any;currentYear: number;profileMap: Record<string, string>;editable: boolean;onDelete: (id: string) => void;onUpdateActivity: (id: string, updates: Record<string, any>) => void;}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(activity.subject);
  const [editCategory, setEditCategory] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDate, setEditDate] = useState(
    activity.created_at ? format(new Date(activity.created_at), "yyyy-MM-dd") : ""
  );
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    title: displayTitle,
    category: displayCategory,
    cleanDesc
  } = extractTitleAndCategory(activity.subject, activity.description);
  const ownerName = activity.created_by ? profileMap[activity.created_by] : null;
  const d = new Date(activity.created_at);

  const typeIcon =
  activity.type === "call" || activity.type === "phone" ?
  <MessageCircle className="h-3.5 w-3.5 text-[hsl(var(--success))]" /> :

  <FileText className="h-3.5 w-3.5 text-primary" />;


  const handleSaveEdit = () => {
    if (!editTitle || !editCategory) return;
    const descWithCat = buildDescriptionWithCategory(editCategory, editDesc.trim());
    const subjectValue = CATEGORIES.some((c) => c.label === editTitle.trim()) ? editCategory : editTitle.trim();
    const updates: Record<string, any> = { subject: subjectValue, description: descWithCat || null };
    if (editDate) {
      updates.created_at = new Date(editDate).toISOString();
    }
    onUpdateActivity(activity.id, updates);
    setEditing(false);
  };

  const handleRowClick = () => {
    if (!editable || editing) return;
    const parsed = extractTitleAndCategory(activity.subject, activity.description);
    let cat = parsed.category;
    // Signal-activities: subject IS the category label
    if (!cat && CATEGORIES.some((c) => c.label === activity.subject)) {
      cat = activity.subject;
    }
    setEditTitle(parsed.title);
    setEditCategory(cat);
    setEditDesc(parsed.cleanDesc);
    setEditDate(activity.created_at ? format(new Date(activity.created_at), "yyyy-MM-dd") : "");
    setConfirmDelete(false);
    setEditing(true);
  };

  return (
    <div className="relative group">
      {/* Icon on spine */}
      <div className="absolute -left-7 top-[2px] w-[12px] h-[12px] flex items-center justify-center bg-background rounded-full">
        {typeIcon}
      </div>

      <div className="min-w-0">
        {editing ?
        <div className="space-y-2 animate-in fade-in duration-150">
            <div>
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5 block">
                Tittel
              </span>
              <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-[0.9375rem] rounded-md"
              autoFocus />
            
            </div>
            <div>
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5 block">
                Kategori
              </span>
              <CategoryPicker selected={editCategory} onSelect={setEditCategory} />
            </div>
            <Textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            rows={3}
            placeholder="Beskrivelse (valgfritt)"
            className="text-[0.875rem] rounded-md"
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSaveEdit();
            }} />
          

            <div className="flex items-center gap-2">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Dato:
              </span>
              <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="h-7 px-2 text-[0.75rem] rounded-full border border-border text-muted-foreground bg-background" />
            
            </div>
            <div className="flex items-center gap-2">
              <Button
              size="sm"
              className="h-[34px] px-4 text-[0.8125rem] font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              disabled={!editTitle.trim() || !editCategory}
              onClick={handleSaveEdit}>
              
                Lagre
              </Button>
              <Button
              variant="ghost"
              size="sm"
              className="h-[34px] px-3 text-[0.8125rem] text-muted-foreground rounded-md hover:bg-secondary transition-colors"
              onClick={() => setEditing(false)}>
              
                Avbryt
              </Button>
              <div className="ml-auto">
                {confirmDelete ?
              <span className="text-[0.75rem] animate-in fade-in duration-150">
                    <span className="text-destructive mr-1">Er du sikker?</span>
                    <button
                  onClick={() => {
                    onDelete(activity.id);
                    setConfirmDelete(false);
                  }}
                  className="text-destructive font-medium hover:underline mr-1">
                  
                      Ja, slett
                    </button>
                    <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-muted-foreground hover:text-foreground">
                  
                      Avbryt
                    </button>
                  </span> :

              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
              }
              </div>
            </div>
          </div> :

        <div onClick={handleRowClick} className={cn("flex items-start gap-3", editable && "cursor-pointer")}>
            <div className="flex-1 min-w-0">
              {/* Title */}
              <span className="text-[1.0625rem] font-bold text-foreground">{displayTitle}</span>

              {/* Delete confirmation */}
              {confirmDelete &&
            <div className="flex items-center gap-2 mt-1 text-[0.75rem] animate-in fade-in duration-150">
                  <span className="text-destructive">Slett denne aktiviteten?</span>
                  <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(activity.id);
                  setConfirmDelete(false);
                }}
                className="text-destructive font-medium hover:underline">
                
                    Ja, slett
                  </button>
                  <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(false);
                }}
                className="text-muted-foreground hover:text-foreground">
                
                    Avbryt
                  </button>
                </div>
            }

              {/* Description */}
              {cleanDesc ?
            <div className="mt-0.5">
                  <p className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-foreground/70">{cleanDesc}</p>
                </div> :
            null}

              {/* Owner badge */}
              {ownerName &&
            <div className="mt-1">
                  <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[0.6875rem] font-medium">
                    {ownerName}
                  </span>
                </div>
            }
            </div>

            {/* Right side: Date + Category + Delete */}
            <div className="flex flex-col items-end gap-1 flex-shrink-0 mt-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[0.8125rem] text-muted-foreground">
                    {format(d, "d. MMM yyyy", { locale: nb })}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{fullDate(activity.created_at)}</TooltipContent>
              </Tooltip>
              {displayCategory && <CategoryBadge label={displayCategory} />}
            </div>
          </div>
        }
      </div>
    </div>);

}