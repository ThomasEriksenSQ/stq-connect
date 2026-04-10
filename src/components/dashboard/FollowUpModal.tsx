import { useState, useEffect, useRef, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { format, addDays, addWeeks, addMonths } from "date-fns";
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
import { ChevronDown, CalendarIcon, X } from "lucide-react";
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

export type FollowUpModalData = {
  name: string;
  company: string;
  task: string;
  signal: string;
  ownerProfileId: string;
};

type Props = {
  open: boolean;
  onCancel: () => void;
  onClose: () => void;
  onSubmit: (data: { title: string; dueDate: Date; owner: string; emailNotify: boolean }) => void;
  data: FollowUpModalData | null;
  profiles: Array<{ id: string; full_name: string }>;
};

const CHIP_BASE = "h-7 px-2.5 text-[0.75rem] rounded-full border transition-colors cursor-pointer";
const CHIP_OFF = `${CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;
const CHIP_ON = `${CHIP_BASE} bg-primary/10 border-primary/30 text-primary font-medium`;

const FollowUpModal = ({ open, onCancel, onClose, onSubmit, data, profiles }: Props) => {
  const [title, setTitle] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>("+1 uke");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [owner, setOwner] = useState("");
  const [emailNotify, setEmailNotify] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(false);
  const userTypedRef = useRef(false);

  const firstName = data?.name.split(" ")[0] ?? "";

  useEffect(() => {
    if (open && data) {
      const fallback = `Følg opp ${firstName}`;
      setTitle(fallback);
      userTypedRef.current = false;
      setAiSuggested(false);
      setOwner(data.ownerProfileId);

      const defaultDate = SIGNAL_DEFAULT_DATE[data.signal] ?? "+1 uke";
      setSelectedDate(defaultDate);
      setCustomDate(undefined);

      // Real AI call via edge function
      setAiLoading(true);
      let cancelled = false;

      const fetchAi = async () => {
        try {
          const resp = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({
                messages: [
                  {
                    role: "system",
                    content: "Du er salgsassistent for STACQ, et norsk konsulentselskap som matcher IT-konsulenter med kunder. Foreslå EN kort oppgavetittel (maks 6 ord) på norsk for neste salgsoppfølging. Bare tittelen, ingenting annet.",
                  },
                  {
                    role: "user",
                    content: JSON.stringify({
                      completedTask: data.task,
                      contactName: data.name,
                      company: data.company,
                      signal: data.signal,
                    }),
                  },
                ],
              }),
            }
          );

          if (!resp.ok || !resp.body) throw new Error("AI failed");

          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          let result = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let idx: number;
            while ((idx = buf.indexOf("\n")) !== -1) {
              let line = buf.slice(0, idx);
              buf = buf.slice(idx + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6).trim();
              if (json === "[DONE]") break;
              try {
                const parsed = JSON.parse(json);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) result += content;
              } catch {
                buf = line + "\n" + buf;
                break;
              }
            }
          }

          if (!cancelled && result.trim() && !userTypedRef.current) {
            setTitle(result.trim().replace(/^["']|["']$/g, ""));
            setAiSuggested(true);
          }
        } catch {
          // Fail silently
        } finally {
          if (!cancelled) setAiLoading(false);
        }
      };

      fetchAi();
      return () => { cancelled = true; };
    }
  }, [open, data, firstName]);

  const computedDate = useCallback(() => {
    if (selectedDate === "custom" && customDate) return customDate;
    const opt = DATE_OPTIONS.find((o) => o.label === selectedDate);
    return opt ? opt.fn(new Date()) : new Date();
  }, [selectedDate, customDate]);

  const formattedDate = format(computedDate(), "dd.MM.yyyy");
  const hasValidDate = selectedDate === "custom" ? !!customDate : !!selectedDate;
  const ownerObj = profiles.find((p) => p.id === owner);
  const canSubmit = title.trim().length > 0 && hasValidDate;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-md rounded-xl p-6 gap-0"
        hideCloseButton
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Opprett oppfølging</DialogTitle>

        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="pb-4 mb-4 border-b border-border">
          <p className="text-2xl font-bold text-emerald-600">✓ Fullført</p>
          <p className="text-[0.9375rem] text-muted-foreground mt-0.5">
            {data?.name} · {data?.company}
          </p>
        </div>

        {/* Body */}
        <div className="space-y-4">
          <p className="text-lg font-semibold text-foreground">Sett neste oppfølging?</p>

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
                  onClick={() => { setSelectedDate(opt.label); setCustomDate(undefined); }}
                  className={selectedDate === opt.label ? CHIP_ON : CHIP_OFF}
                >
                  {opt.label}
                </button>
              ))}
              <Popover>
                <PopoverTrigger asChild>
                  <button className={selectedDate === "custom" ? CHIP_ON : CHIP_OFF}>
                    {selectedDate === "custom" && customDate
                      ? format(customDate, "dd.MM.yyyy")
                      : "Velg dato"}
                    <CalendarIcon className="inline-block ml-1 h-3 w-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customDate}
                    onSelect={(d) => {
                      if (d) {
                        setCustomDate(d);
                        setSelectedDate("custom");
                      }
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
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
                  {ownerObj?.full_name || "Velg eier"}
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {profiles.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onSelect={() => setOwner(p.id)}
                    className="cursor-pointer"
                  >
                    {p.full_name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Email notify */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={emailNotify}
              onCheckedChange={(v) => setEmailNotify(!!v)}
              className="h-4 w-4"
            />
            <span className="text-[0.8125rem] text-foreground">Epostvarsling ved forfall</span>
          </label>
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
                    emailNotify,
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
