import { Sheet, SheetContent } from "@/components/ui/sheet";
import { getInitials } from "@/lib/utils";
import { Globe, FileText, Pencil } from "lucide-react";
import { OppdragsMatchPanel } from "@/components/OppdragsMatchPanel";

interface AnsattDetailSheetProps {
  open: boolean;
  onClose: () => void;
  ansatt: any | null;
  onEdit?: () => void;
}

export function AnsattDetailSheet({ open, onClose, ansatt, onEdit }: AnsattDetailSheetProps) {
  if (!ansatt) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-[520px] max-w-full p-0 flex flex-col [&>button]:hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            {ansatt.bilde_url ? (
              <img src={ansatt.bilde_url} alt={ansatt.navn} className="w-12 h-12 rounded-full object-cover border border-border" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
                {getInitials(ansatt.navn)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-[1.25rem] font-bold text-foreground truncate">{ansatt.navn}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                {ansatt.synlig_web && (
                  <span className="inline-flex items-center gap-1 text-[0.6875rem] text-primary">
                    <Globe className="h-3 w-3" />
                    Synlig på web
                  </span>
                )}
                {ansatt.geografi && (
                  <span className="text-[0.8125rem] text-muted-foreground">{ansatt.geografi}</span>
                )}
              </div>
            </div>
            {/* Edit button */}
            <button
              onClick={() => onEdit?.()}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-[0.8125rem] text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors shrink-0"
            >
              <Pencil className="h-3.5 w-3.5" />
              Rediger
            </button>
          </div>

          {/* Tech tags */}
          {ansatt.kompetanse?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {ansatt.kompetanse.map((t: string) => (
                <span key={t} className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-[0.75rem] font-medium text-foreground">
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* CV status badge */}
          <div className="mt-3">
            {ansatt.bio ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-0.5 text-[0.75rem] font-medium">
                <FileText className="h-3 w-3" />
                CV/bio tilgjengelig
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-[0.75rem] font-medium">
                <FileText className="h-3 w-3" />
                Ingen CV
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <OppdragsMatchPanel
            konsulent={{
              navn: ansatt.navn,
              teknologier: ansatt.kompetanse || [],
              cv_tekst: ansatt.bio || null,
              geografi: ansatt.geografi || null,
              ansatt_id: ansatt.id,
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
