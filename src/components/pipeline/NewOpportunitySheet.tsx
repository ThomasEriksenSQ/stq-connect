import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";

import { DesignLabEntitySheet } from "@/components/designlab/DesignLabEntitySheet";
import { C } from "@/components/designlab/theme";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { isEmployeeEndDatePassed } from "@/lib/employeeStatus";
import { getInitials } from "@/lib/utils";

export type OpportunityConsultantType = "intern" | "ekstern";

export type OpportunityContactPreview = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  email?: string | null;
  company_id?: string | null;
};

export type OpportunityCompanyOption = {
  id: string;
  name: string;
  status?: string | null;
};

export type OpportunityEmployeeOption = {
  id: number;
  navn: string;
  status: string | null;
  tilgjengelig_fra?: string | null;
  slutt_dato?: string | null;
  start_dato?: string | null;
  bilde_url?: string | null;
};

export type OpportunityExternalConsultantOption = {
  id: string;
  navn: string | null;
  status: string | null;
  type?: string | null;
  company_id?: string | null;
};

export type OpportunityInitialContext = {
  companyId?: string | null;
  companyName?: string | null;
  contactId?: string | null;
  contactName?: string | null;
  title?: string | null;
};

const SELECT_CLASS =
  "h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-[0.875rem] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function getContactName(contact: OpportunityContactPreview | null | undefined): string | null {
  if (!contact) return null;
  const name = `${contact.first_name || ""} ${contact.last_name || ""}`.trim();
  return name || null;
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message || "");
  }
  return "";
}

function isSearchableOpportunityEmployee(employee: OpportunityEmployeeOption) {
  return employee.status !== "SLUTTET" && !isEmployeeEndDatePassed(employee.slutt_dato);
}

function isActiveExternalConsultant(consultant: OpportunityExternalConsultantOption) {
  const normalized = String(consultant.status || "").trim().toLowerCase();
  return !["sluttet", "deleted", "slettet", "inactive", "inaktiv"].includes(normalized);
}

export function NewOpportunitySheet({
  open,
  onOpenChange,
  employees,
  externalConsultants,
  companies,
  contacts,
  cvPortraitMap,
  userId,
  onCreated,
  initialContext,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: OpportunityEmployeeOption[];
  externalConsultants: OpportunityExternalConsultantOption[];
  companies: OpportunityCompanyOption[];
  contacts: OpportunityContactPreview[];
  cvPortraitMap: Map<number, string>;
  userId: string | null;
  onCreated: () => Promise<void>;
  initialContext?: OpportunityInitialContext;
}) {
  const [consultantType, setConsultantType] = useState<OpportunityConsultantType>("intern");
  const [consultantId, setConsultantId] = useState("");
  const [consultantSearch, setConsultantSearch] = useState("");
  const [consultantPickerOpen, setConsultantPickerOpen] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [contactId, setContactId] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialContext?.companyId) {
      setCompanyId(initialContext.companyId);
      setCompanySearch(initialContext.companyName || "");
    }
    if (initialContext?.contactId) {
      setContactId(initialContext.contactId);
      setContactSearch(initialContext.contactName || "");
    }
    if (initialContext?.title) setTitle(initialContext.title);
  }, [
    initialContext?.companyId,
    initialContext?.companyName,
    initialContext?.contactId,
    initialContext?.contactName,
    initialContext?.title,
    open,
  ]);

  const consultantOptions = useMemo(
    () =>
      consultantType === "intern"
        ? employees.filter(isSearchableOpportunityEmployee)
        : externalConsultants.filter(isActiveExternalConsultant),
    [consultantType, employees, externalConsultants],
  );

  const filteredConsultants = useMemo(() => {
    const query = consultantSearch.trim().toLowerCase();
    return consultantOptions
      .filter((consultant) => {
        if (!query) return true;
        return [consultant.navn, consultant.status].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
      })
      .slice(0, 30);
  }, [consultantOptions, consultantSearch]);

  const filteredCompanies = useMemo(() => {
    const query = companySearch.trim().toLowerCase();
    return companies
      .filter((company) => !query || [company.name, company.status].filter(Boolean).some((value) => String(value).toLowerCase().includes(query)))
      .slice(0, 30);
  }, [companies, companySearch]);

  const companyContacts = useMemo(
    () => contacts.filter((contact) => !companyId || contact.company_id === companyId),
    [companyId, contacts],
  );

  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    return companyContacts
      .filter((contact) => {
        if (!query) return true;
        return [getContactName(contact), contact.title, contact.email]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .slice(0, 30);
  }, [companyContacts, contactSearch]);

  const reset = () => {
    setConsultantType("intern");
    setConsultantId("");
    setConsultantSearch("");
    setConsultantPickerOpen(false);
    setCompanyId("");
    setCompanySearch("");
    setCompanyPickerOpen(false);
    setContactId("");
    setContactSearch("");
    setContactPickerOpen(false);
    setTitle("");
    setNote("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const createOpportunity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!consultantId || !companyId || !contactId || !trimmedTitle) {
      toast.error("Fyll ut alle obligatoriske felt");
      return;
    }

    setSaving(true);
    try {
      if (!userId) {
        toast.error("Du må være innlogget for å opprette mulighet");
        return;
      }

      const { error } = await supabase.from("pipeline_muligheter").insert({
        konsulent_type: consultantType,
        ansatt_id: consultantType === "intern" ? Number(consultantId) : null,
        ekstern_id: consultantType === "ekstern" ? consultantId : null,
        company_id: companyId,
        contact_id: contactId,
        tittel: trimmedTitle,
        notat: note.trim() || null,
        status: "sendt_cv",
        created_by: userId,
      });
      if (error) throw error;

      await onCreated();
      toast.success("Mulighet opprettet");
      reset();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      const message = getErrorMessage(error);
      toast.error(message ? `Kunne ikke opprette mulighet: ${message}` : "Kunne ikke opprette mulighet");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DesignLabEntitySheet
      open={open}
      onOpenChange={handleOpenChange}
      contentClassName="px-6 py-6"
    >
      <form onSubmit={createOpportunity} className="flex min-h-full flex-col">
        <div className="-mx-6 -mt-6 mb-5 border-b border-border px-6 pb-4 pt-5">
          <h2 className="text-[1.125rem] font-bold text-foreground">Ny mulighet</h2>
          <p className="mt-1 text-[0.875rem] text-muted-foreground">Når det er en mulighet uten direkte forespørsel</p>
        </div>

        <div className="flex-1 space-y-4">
          <SheetField>
            <FieldLabel required>Konsulenttype</FieldLabel>
            <select
              className={SELECT_CLASS}
              value={consultantType}
              required
              aria-required="true"
              onChange={(event) => {
                setConsultantType(event.target.value as OpportunityConsultantType);
                setConsultantId("");
                setConsultantSearch("");
                setConsultantPickerOpen(false);
              }}
            >
              <option value="intern">Ansatt</option>
              <option value="ekstern">Ekstern</option>
            </select>
          </SheetField>

          <SheetField>
            <FieldLabel required>Konsulent</FieldLabel>
            <SearchSelect
              value={consultantId}
              search={consultantSearch}
              onSearchChange={(value) => {
                setConsultantSearch(value);
                setConsultantId("");
              }}
              open={consultantPickerOpen}
              onOpenChange={setConsultantPickerOpen}
              placeholder="Søk etter konsulent..."
              emptyText="Ingen konsulenter funnet"
              required
              options={filteredConsultants.map((consultant) => ({
                id: String(consultant.id),
                label: consultant.navn || "Uten navn",
                avatarUrl:
                  consultantType === "intern"
                    ? cvPortraitMap.get(Number(consultant.id)) || (consultant as OpportunityEmployeeOption).bilde_url || null
                    : null,
              }))}
              showAvatar
              onSelect={(option) => {
                setConsultantId(option.id);
                setConsultantSearch(option.label);
                setConsultantPickerOpen(false);
              }}
              onClear={() => {
                setConsultantId("");
                setConsultantSearch("");
              }}
            />
          </SheetField>

          <SheetField>
            <FieldLabel required>Selskap</FieldLabel>
            <SearchSelect
              value={companyId}
              search={companySearch}
              onSearchChange={(value) => {
                setCompanySearch(value);
                setCompanyId("");
                setContactId("");
                setContactSearch("");
              }}
              open={companyPickerOpen}
              onOpenChange={setCompanyPickerOpen}
              placeholder="Søk etter selskap..."
              emptyText="Ingen selskaper funnet"
              required
              options={filteredCompanies.map((company) => ({
                id: company.id,
                label: company.name,
              }))}
              onSelect={(option) => {
                setCompanyId(option.id);
                setCompanySearch(option.label);
                setContactId("");
                setContactSearch("");
                setCompanyPickerOpen(false);
              }}
              onClear={() => {
                setCompanyId("");
                setCompanySearch("");
                setContactId("");
                setContactSearch("");
              }}
            />
          </SheetField>

          <SheetField>
            <FieldLabel required>Kontaktperson</FieldLabel>
            <SearchSelect
              value={contactId}
              search={contactSearch}
              onSearchChange={(value) => {
                setContactSearch(value);
                setContactId("");
              }}
              open={contactPickerOpen}
              onOpenChange={setContactPickerOpen}
              placeholder={companyId ? "Søk etter kontaktperson..." : "Velg selskap først..."}
              emptyText={companyId ? "Ingen kontakter på dette selskapet" : "Velg selskap først"}
              disabled={!companyId}
              required
              options={filteredContacts.map((contact) => ({
                id: contact.id,
                label: getContactName(contact) || "Uten navn",
                meta: contact.title || contact.email || null,
              }))}
              onSelect={(option) => {
                setContactId(option.id);
                setContactSearch(option.label);
                setContactPickerOpen(false);
              }}
              onClear={() => {
                setContactId("");
                setContactSearch("");
              }}
            />
          </SheetField>

          <SheetField>
            <FieldLabel required>Tittel</FieldLabel>
            <Input
              value={title}
              required
              aria-required="true"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="F.eks. Kunden vurderer kandidaten"
            />
          </SheetField>

          <SheetField>
            <FieldLabel>Notat</FieldLabel>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              className="resize-none text-[0.875rem]"
              placeholder="Kort kontekst, hva kunden vurderer, neste steg..."
            />
          </SheetField>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
            className="text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            Avbryt
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[0.8125rem] font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Oppretter..." : "Opprett mulighet"}
          </button>
        </div>
      </form>
    </DesignLabEntitySheet>
  );
}

function SheetField({ children }: { children: ReactNode }) {
  return <div className="grid min-w-0 gap-1">{children}</div>;
}

type SearchSelectOption = {
  id: string;
  label: string;
  meta?: string | null;
  avatarUrl?: string | null;
};

function SearchSelect({
  value,
  search,
  onSearchChange,
  open,
  onOpenChange,
  placeholder,
  emptyText,
  disabled = false,
  required = false,
  showAvatar = false,
  options,
  onSelect,
  onClear,
}: {
  value: string;
  search: string;
  onSearchChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder: string;
  emptyText: string;
  disabled?: boolean;
  required?: boolean;
  showAvatar?: boolean;
  options: SearchSelectOption[];
  onSelect: (option: SearchSelectOption) => void;
  onClear: () => void;
}) {
  return (
    <div className="relative min-w-0">
      <input
        className={`${SELECT_CLASS} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        value={search}
        required={required}
        aria-required={required}
        disabled={disabled}
        onChange={(event) => {
          onSearchChange(event.target.value);
          onOpenChange(true);
        }}
        onFocus={() => onOpenChange(true)}
        onBlur={() => window.setTimeout(() => onOpenChange(false), 160)}
        placeholder={placeholder}
      />
      {value && !disabled ? (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onClear}
          className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-sm text-[#8C929C] hover:text-[#1F2328]"
          style={{ width: 22, height: 22 }}
          aria-label="Nullstill valg"
        >
          <X style={{ width: 13, height: 13 }} />
        </button>
      ) : null}
      {open && !disabled ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border bg-white shadow-lg" style={{ borderColor: C.borderDefault }}>
          {options.length === 0 ? (
            <p className="px-3 py-2.5" style={{ fontSize: 12, color: C.textFaint }}>{emptyText}</p>
          ) : (
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(option)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[#F6F7F9]"
              >
                {showAvatar ? (
                  option.avatarUrl ? (
                    <img
                      src={option.avatarUrl}
                      alt={option.label}
                      className="h-7 w-7 shrink-0 rounded-full border object-cover"
                      style={{ borderColor: C.borderLight }}
                    />
                  ) : (
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                      style={{ background: C.filterActiveBg, color: C.textPrimary, fontSize: 10, fontWeight: 650 }}
                    >
                      {getInitials(option.label)}
                    </span>
                  )
                ) : null}
                <span className="min-w-0">
                  <p className="truncate" style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{option.label}</p>
                  {option.meta ? (
                    <p className="truncate" style={{ fontSize: 11, color: C.textFaint }}>{option.meta}</p>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function FieldLabel({ children, required = false }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
      {required ? <span className="ml-1 text-destructive">*</span> : null}
    </label>
  );
}
