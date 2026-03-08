import { useState, useEffect, useRef, useCallback } from "react";
import { format, addDays, addWeeks, addMonths } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ChevronDown, CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";

const DATE_OPTIONS = [
  { label: "+3 dager", fn: (d: Date) => addDays(d, 3) },
  { label: "+1 uke", fn: (d: Date) => addWeeks(d, 1) },
  { label: "+2 uker", fn: (d: Date) => addWeeks(d, 2) },
  { label: "+1 måned", fn: (d: Date) => addMonths(d, 1) },
];

const SIGNAL_DEFAULT_DATE: Record<string, string> = {
  "Behov nå": "+3 dager",
  "Får fremtidig behov": "+2 uker",
  "Får kanskje behov": "+1 måned",
  "Ukjent om behov": "+1 uke",
};

const OWNERS = [
  { key: "Thomas", full: "Thomas Eriksen" },
  { key: "Jon", full: "Jon Richard Nygaard" },
];

export type FollowUpModalData = {
  name: string;
  company: string;
  task: string;
  signal: string;
  owner: string;
};

type Props = {
  open: boolean;
  onCancel: () => void;
  onClose: () => void;
  onSubmit: (data: { title: string; dueDate: Date; owner: string }) => void;
  data: FollowUpModalData | null;
};

const CHIP_BASE = "h-7 px-2.5 text-[0.75rem] rounded-full border transition-colors cursor-pointer";
const CHIP_OFF = `${CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;
const CHIP_ON = `${CHIP_BASE} bg-primary/10 border-primary/30 text-primary font-medium`;

const FollowUpModal = ({ open, onCancel, onClose, onSubmit, data }: Props) => {
  const [title, setTitle] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>("+1 uke");
  const [owner, setOwner] = useState("Thomas");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(false);
  const userTypedRef = useRef(false);

  const firstName = data?.name.split(" ")[0] ?? "";

  // Reset state when modal opens with new data
  useEffect(() => {
    if (open && data) {
      const fallback = `Følg opp ${firstName}`;
      setTitle(fallback);
      userTypedRef.current = false;
      setAiSuggested(false);
      setOwner(data.owner);

      const defaultDate = SIGNAL_DEFAULT_DATE[data.signal] ?? "+1 uke";
      setSelectedDate(defaultDate);

      // Simulate AI suggestion (mockup — will be replaced with real API call)
      setAiLoading(true);
      const timer = setTimeout(() => {
        if (!userTypedRef.current) {
          // Mockup AI suggestions based on task context
          const suggestions: Record<string, string> = {
            "Send tilbud på konsulent": "Følg opp tilbudet",
            "Ring tilbake": "Sjekk status etter samtale",
            "Følg opp om behov": "Avklar Q2-planer",
            "Send CV-liste": "Følg opp CV-feedback",
            "Ta kontakt igjen": "Kartlegg behov",
          };
          const aiTitle = suggestions[data.task] ?? `Følg opp ${firstName}`;
          setTitle(aiTitle);
          setAiSuggested(true);
        }
        setAiLoading(false);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [open, data, firstName]);

  const computedDate = useCallback(() => {
    const opt = DATE_OPTIONS.find((o) => o.label === selectedDate);
    return opt ? opt.fn(new Date()) : new Date();
  }, [selectedDate]);

  const formattedDate = format(computedDate(), "dd.MM.yyyy");

  const ownerObj = OWNERS.find((o) => o.key === owner) ?? OWNERS[0];

  const canSubmit = title.trim().length > 0 && selectedDate;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-md rounded-xl p-6 gap-0"
        hideCloseButton
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Opprett oppfølging</DialogTitle>

        {/* Header */}
        <div className="mb-5">
          <p className="text-emerald-600 text-[0.8125rem] font-medium mb-0.5">✓ Fullført</p>
          <p className="text-[0.9375rem] font-semibold text-foreground">
            {data?.name} · {data?.company}
          </p>
        </div>

        {/* Body */}
        <div className="space-y-4">
          <p className="text-[0.9375rem] font-medium text-foreground">Sett neste oppfølging?</p>

          {/* Title input */}
          <div>
            <div className="h-4 mb-1">
              {(aiLoading || aiSuggested) && (
                <span className="text-[0.625rem] text-muted-foreground">
                  ✦ AI-forslag{aiLoading ? "…" : ""}
                </span>
              )}
            </div>
            <Input
              value={title}
              onChange={(e) => {
                userTypedRef.current = true;
                setTitle(e.target.value);
              }}
              placeholder="Hva skal gjøres?"
              className="text-[0.875rem]"
            />
          </div>

          {/* Date chips */}
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {DATE_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setSelectedDate(opt.label)}
                  className={selectedDate === opt.label ? CHIP_ON : CHIP_OFF}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[0.75rem] text-muted-foreground mt-1.5">
              Forfallsdato: {formattedDate}
            </p>
          </div>

          {/* Owner selector */}
          <div>
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Eier
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="mt-1 flex items-center gap-1.5 h-8 px-3 text-[0.8125rem] rounded-lg border border-border bg-background text-foreground hover:bg-secondary transition-colors">
                  {ownerObj.full}
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {OWNERS.map((o) => (
                  <DropdownMenuItem
                    key={o.key}
                    onSelect={() => setOwner(o.key)}
                    className="cursor-pointer"
                  >
                    {o.full}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <button
            onClick={onCancel}
            className="text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors"
          >
            Avbryt
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors"
            >
              Hopp over
            </button>
            <button
              disabled={!canSubmit}
              onClick={() => {
                if (canSubmit) {
                  onSubmit({
                    title: title.trim(),
                    dueDate: computedDate(),
                    owner,
                  });
                }
              }}
              className={cn(
                "inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg transition-colors",
                canSubmit
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              Opprett →
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FollowUpModal;
