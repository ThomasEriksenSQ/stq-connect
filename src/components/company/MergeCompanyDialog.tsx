import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRightLeft, Loader2, Search } from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type CompanyOption = {
  id: string;
  name: string;
  org_number: string | null;
  status: string;
};

type MergePreview = {
  canMerge: boolean;
  blockingConflicts: string[];
  fieldTransfers: string[];
  relationCounts: {
    contacts: number;
    activities: number;
    tasks: number;
    foresporsler: number;
    finn_annonser: number;
    external_consultants: number;
    stacq_oppdrag: number;
    source_aliases: number;
  };
  targetCompany: CompanyOption;
};

const PREVIEW_LABELS: Array<{ key: keyof MergePreview["relationCounts"]; label: string }> = [
  { key: "contacts", label: "Kontakter" },
  { key: "activities", label: "Aktiviteter" },
  { key: "tasks", label: "Tasks" },
  { key: "foresporsler", label: "Forespørsler" },
  { key: "finn_annonser", label: "Finn-annonser" },
  { key: "external_consultants", label: "Eksterne konsulenter" },
  { key: "stacq_oppdrag", label: "Oppdrag" },
  { key: "source_aliases", label: "Eksisterende aliases" },
];

interface MergeCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceCompanyId: string;
  sourceCompanyName: string;
  onMerged: (targetCompanyId: string) => void;
}

export function MergeCompanyDialog({
  open,
  onOpenChange,
  sourceCompanyId,
  sourceCompanyName,
  onMerged,
}: MergeCompanyDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<CompanyOption | null>(null);
  const [preview, setPreview] = useState<MergePreview | null>(null);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedTarget(null);
      setPreview(null);
    }
  }, [open]);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["merge-company-options", sourceCompanyId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, org_number, status")
        .neq("id", sourceCompanyId)
        .neq("status", "deleted")
        .order("name");

      if (error) throw error;
      return data as CompanyOption[];
    },
  });

  const filteredCompanies = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const base = needle
      ? companies.filter((company) => company.name.toLowerCase().includes(needle))
      : companies;

    return base.slice(0, 10);
  }, [companies, search]);

  const previewMutation = useMutation({
    mutationFn: async (targetCompanyId: string) => {
      const { data, error } = await supabase.functions.invoke("merge-companies", {
        body: {
          action: "preview",
          sourceCompanyId,
          targetCompanyId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as MergePreview;
    },
    onSuccess: (data) => {
      setPreview(data);
    },
    onError: (error: Error) => {
      setPreview(null);
      toast.error(error.message || "Kunne ikke hente merge-preview");
    },
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTarget) throw new Error("Velg målselskap først");
      const { data, error } = await supabase.functions.invoke("merge-companies", {
        body: {
          action: "execute",
          sourceCompanyId,
          targetCompanyId: selectedTarget.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      if (!selectedTarget) return;
      toast.success(`Selskapet ble slått sammen inn i ${selectedTarget.name}`);
      onMerged(selectedTarget.id);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Kunne ikke slå sammen selskap");
    },
  });

  const handleSelectTarget = (company: CompanyOption) => {
    setSelectedTarget(company);
    setPreview(null);
    previewMutation.mutate(company.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] rounded-xl">
        <DialogHeader>
          <DialogTitle>Slå sammen selskap</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-[0.875rem]">
            <span className="font-semibold text-foreground">{sourceCompanyName}</span>
            <span className="text-muted-foreground"> skal merges inn i et annet selskap.</span>
          </div>

          <div className="space-y-2">
            <label className="text-[0.8125rem] font-medium text-foreground">Velg målselskap</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Søk etter målselskap"
                className="pl-9"
              />
            </div>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
              {isLoading ? (
                <div className="flex items-center gap-2 px-3 py-4 text-[0.8125rem] text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Laster selskaper...
                </div>
              ) : filteredCompanies.length === 0 ? (
                <div className="px-3 py-4 text-[0.8125rem] text-muted-foreground">Ingen treff</div>
              ) : (
                filteredCompanies.map((company) => (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => handleSelectTarget(company)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[0.8125rem] transition-colors ${
                      selectedTarget?.id === company.id ? "bg-primary/10" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">{company.name}</div>
                      <div className="text-muted-foreground">
                        {company.org_number ? `Org.nr ${company.org_number}` : "Ingen org.nr"}
                      </div>
                    </div>
                    {selectedTarget?.id === company.id && <ArrowRightLeft className="h-4 w-4 text-primary" />}
                  </button>
                ))
              )}
            </div>
          </div>

          {previewMutation.isPending && (
            <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-3 text-[0.8125rem] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Henter merge-preview...
            </div>
          )}

          {preview && (
            <div className="space-y-4 rounded-lg border border-border px-4 py-4">
              <div>
                <div className="text-[0.8125rem] text-muted-foreground">Målselskap</div>
                <div className="font-medium text-foreground">{preview.targetCompany.name}</div>
              </div>

              {preview.blockingConflicts.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-[0.8125rem] text-red-700">
                  <div className="mb-2 flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4" />
                    Merge er blokkert
                  </div>
                  <ul className="space-y-1">
                    {preview.blockingConflicts.map((conflict) => (
                      <li key={conflict}>• {conflict}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                <div className="text-[0.8125rem] font-medium text-foreground">Data som følger med</div>
                <div className="grid grid-cols-2 gap-2 text-[0.8125rem]">
                  {PREVIEW_LABELS.map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium text-foreground">{preview.relationCounts[key]}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[0.8125rem] font-medium text-foreground">Felter som fylles inn på målselskapet</div>
                {preview.fieldTransfers.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {preview.fieldTransfers.map((field) => (
                      <span
                        key={field}
                        className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[0.75rem] font-medium text-emerald-700"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-[0.8125rem] text-muted-foreground">Ingen manglende felter fylles inn.</div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button
              type="button"
              disabled={!selectedTarget || !preview || !preview.canMerge || executeMutation.isPending}
              onClick={() => executeMutation.mutate()}
            >
              {executeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Slår sammen...
                </>
              ) : (
                "Slå sammen selskap"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
