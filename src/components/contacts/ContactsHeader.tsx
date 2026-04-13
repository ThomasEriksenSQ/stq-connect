import { cn, getInitials } from "@/lib/utils";
import { getConsultantAvailabilityMeta } from "@/lib/contactHunt";
import { getAvatarColor } from "./types";
import type { HuntConsultant } from "./types";

interface Props {
  selectedConsultantId: number | null;
  huntConsultants: HuntConsultant[];
  huntConsultantsLoading: boolean;
  onConsultantToggle: (id: number) => void;
  resultCount: string | number;
  resultLabel: string;
}

export function ContactsHeader({
  selectedConsultantId,
  huntConsultants,
  huntConsultantsLoading,
  onConsultantToggle,
  resultCount,
  resultLabel,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-[1.375rem] font-bold">Kontakter</h1>
        <div className="flex items-center gap-1.5">
          <span className="text-[0.9375rem] font-semibold text-foreground">{resultCount}</span>
          <span className="text-[0.9375rem] text-muted-foreground">{resultLabel}</span>
        </div>
      </div>

      {/* Horizontal consultant tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mb-1">
        <button
          onClick={() => selectedConsultantId !== null && onConsultantToggle(selectedConsultantId)}
          className={cn(
            "shrink-0 h-9 px-4 rounded-full text-[0.8125rem] font-medium border transition-colors",
            selectedConsultantId === null
              ? "bg-foreground text-background border-foreground"
              : "border-border text-muted-foreground hover:bg-secondary",
          )}
        >
          Kontaktliste
        </button>

        {huntConsultantsLoading
          ? [1, 2, 3].map((i) => (
              <div key={i} className="h-9 w-36 rounded-full bg-secondary/50 animate-pulse shrink-0" />
            ))
          : huntConsultants.map((consultant) => {
              const isSelected = selectedConsultantId === consultant.id;
              const availability = getConsultantAvailabilityMeta(consultant.tilgjengelig_fra);
              const firstName = consultant.navn.split(" ")[0];

              return (
                <button
                  key={consultant.id}
                  onClick={() => onConsultantToggle(consultant.id)}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-2 h-9 px-3 rounded-full border transition-colors",
                    isSelected
                      ? "bg-foreground text-background border-foreground"
                      : "border-border text-foreground hover:bg-secondary",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.625rem] font-semibold",
                      isSelected ? "bg-background/15 text-background" : getAvatarColor(consultant.navn),
                    )}
                  >
                    {getInitials(consultant.navn)}
                  </span>
                  <span className="text-[0.8125rem] font-medium">{firstName}</span>
                  <span
                    className={cn(
                      "text-[0.6875rem]",
                      isSelected
                        ? "text-background/70"
                        : availability.tone === "ready"
                          ? "text-emerald-600"
                          : availability.tone === "soon"
                            ? "text-amber-600"
                            : "text-muted-foreground",
                    )}
                  >
                    {availability.tone === "ready" ? "Nå" : availability.tone === "soon" ? `${availability.daysUntil}d` : availability.label.replace("Tilgjengelig ", "")}
                  </span>
                </button>
              );
            })}
      </div>
    </div>
  );
}
