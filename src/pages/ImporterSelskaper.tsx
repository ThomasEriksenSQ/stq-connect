import { useState } from "react";
import { ImportCompaniesModal } from "@/components/ImportCompaniesModal";

export default function ImporterSelskaper() {
  const [open, setOpen] = useState(true);

  return (
    <div className="space-y-4">
      <h1 className="text-[1.375rem] font-bold">Importer selskaper</h1>
      <ImportCompaniesModal open={open} onOpenChange={setOpen} />
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90"
        >
          Åpne importverktøy
        </button>
      )}
    </div>
  );
}
