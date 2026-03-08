import { useState } from "react";
import { Check, CalendarIcon, ChevronDown } from "lucide-react";
import { format, addWeeks, addMonths } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import FollowUpModal, { type FollowUpModalData } from "./FollowUpModal";

const CHIP_BASE = "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors cursor-pointer";
const CHIP_OFF = `${CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;
const CHIP_ON = `${CHIP_BASE} bg-foreground text-background border-foreground font-medium`;

const SIGNAL_OPTIONS = [
  { label: "Behov nå", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { label: "Får fremtidig behov", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { label: "Får kanskje behov", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { label: "Ukjent om behov", color: "bg-gray-100 text-gray-600 border-gray-200" },
];

const SIGNAL_BADGES: Record<string, string> = Object.fromEntries(
  SIGNAL_OPTIONS.map((s) => [s.label, s.color])
);

type MockRow = {
  id: string;
  name: string;
  signal: string;
  company: string;
  task: string;
  due: string;
  dueType: "overdue" | "today" | "future";
  fullDate: string;
  owner: string;
  description: string | null;
  accent: "destructive" | "primary" | "emerald" | "none";
};

const INITIAL_DATA: MockRow[] = [
  {
    id: "1",
    name: "Elin Lindtvedt",
    signal: "Behov nå",
    company: "Kongsberg Defence & Aerospace",
    task: "Send tilbud på konsulent",
    due: "Forfalt 2 dager",
    dueType: "overdue",
    fullDate: "06.03.2026",
    owner: "Thomas",
    description: "Avklar pris og tilgjengelighet med Thomas først",
    accent: "destructive",
  },
  {
    id: "2",
    name: "Mathias Nedrebø",
    signal: "Behov nå",
    company: "Six Robotics AS",
    task: "Ring tilbake",
    due: "I dag",
    dueType: "today",
    fullDate: "08.03.2026",
    owner: "Thomas",
    description: null,
    accent: "none",
  },
  {
    id: "3",
    name: "Harald Moldsvor",
    signal: "Får kanskje behov",
    company: "AUTOSTORE AS",
    task: "Følg opp om behov",
    due: "Om 3 dager",
    dueType: "future",
    fullDate: "11.03.2026",
    owner: "Jon",
    description: "Spurte om Q2-planer sist",
    accent: "none",
  },
  {
    id: "4",
    name: "Øystein Kopstad",
    signal: "Får fremtidig behov",
    company: "Commit AS",
    task: "Send CV-liste",
    due: "Om 6 dager",
    dueType: "future",
    fullDate: "14.03.2026",
    owner: "Thomas",
    description: null,
    accent: "none",
  },
  {
    id: "5",
    name: "Abdullah Akkoca",
    signal: "Ukjent om behov",
    company: "TechnipFMC",
    task: "Ta kontakt igjen",
    due: "Om 5 dager",
    dueType: "future",
    fullDate: "13.03.2026",
    owner: "Jon",
    description: null,
    accent: "none",
  },
];

const DATE_COLOR: Record<string, string> = {
  overdue: "text-destructive",
  today: "text-primary",
  future: "text-muted-foreground",
};

const ACCENT_CLASS: Record<string, string> = {
  destructive: "border-l-[3px] border-l-destructive",
  primary: "border-l-[3px] border-l-primary",
  emerald: "border-l-[3px] border-l-emerald-500",
  none: "",
};

const NAAR_FILTERS = ["Forfalt + I dag", "Forfalt", "I dag", "Denne uken", "Alle"];
const EIER_FILTERS = ["Thomas Eriksen", "Jon Richard Nygaard", "Alle"];
const SIGNAL_FILTERS = ["Alle", "Behov nå", "Får fremtidig behov", "Får kanskje behov", "Ukjent om behov", "Ikke aktuelt"];

const MockOppfolgingerSection = () => {
  const [rows, setRows] = useState<MockRow[]>(INITIAL_DATA);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<FollowUpModalData | null>(null);
  const [removedRow, setRemovedRow] = useState<{ row: MockRow; index: number } | null>(null);

  const updateSignal = (id: string, newSignal: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, signal: newSignal } : r))
    );
  };

  const postponeRow = (id: string, newDate: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(newDate);
    target.setHours(0, 0, 0, 0);
    const diffMs = target.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    let due: string;
    let dueType: MockRow["dueType"];
    if (diffDays < 0) {
      due = `Forfalt ${Math.abs(diffDays)} dager`;
      dueType = "overdue";
    } else if (diffDays === 0) {
      due = "I dag";
      dueType = "today";
    } else {
      due = `Om ${diffDays} dager`;
      dueType = "future";
    }

    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, due, dueType, fullDate: format(newDate, "dd.MM.yyyy"), accent: dueType === "overdue" ? "destructive" : "none" }
          : r
      )
    );
  };

  const handleCheckbox = (row: MockRow) => {
    // Start fade animation
    setCompletingId(row.id);

    // After fade, remove row and open modal
    setTimeout(() => {
      const idx = rows.findIndex((r) => r.id === row.id);
      setRemovedRow({ row, index: idx });
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setCompletingId(null);
      setModalData({
        name: row.name,
        company: row.company,
        task: row.task,
        signal: row.signal,
        owner: row.owner,
      });
      setModalOpen(true);
    }, 400);
  };

  const handleFollowUpSubmit = (data: { title: string; dueDate: Date; owner: string }) => {
    setModalOpen(false);
    setRemovedRow(null);
    const firstName = modalData?.name.split(" ")[0] ?? "";
    toast.success(`Oppfølging opprettet for ${firstName}`);
  };

  const handleCancel = () => {
    setModalOpen(false);
    if (removedRow) {
      setRows((prev) => {
        const next = [...prev];
        next.splice(removedRow.index, 0, removedRow.row);
        return next;
      });
      setRemovedRow(null);
    }
  };

  const handleSkip = () => {
    setModalOpen(false);
    setRemovedRow(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <h2 className="text-[1.125rem] font-bold text-foreground">Oppfølginger</h2>
        <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary/10 text-primary text-[0.6875rem] font-semibold">
          {rows.length}
        </span>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground w-14 flex-shrink-0">Når</span>
          <div className="flex items-center gap-1.5">
            {NAAR_FILTERS.map((f) => (
              <button key={f} className={f === "Forfalt + I dag" ? CHIP_ON : CHIP_OFF}>{f}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground w-14 flex-shrink-0">Eier</span>
          <div className="flex items-center gap-1.5">
            {EIER_FILTERS.map((f) => (
              <button key={f} className={f === "Thomas Eriksen" ? CHIP_ON : CHIP_OFF}>{f}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground w-14 flex-shrink-0">Signal</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {SIGNAL_FILTERS.map((f) => (
              <button key={f} className={f === "Alle" ? CHIP_ON : CHIP_OFF}>{f}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Card container */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {rows.map((row, i) => (
          <div
            key={row.id}
            className={cn(
              "flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/40 transition-all duration-300",
              i < rows.length - 1 && "border-b border-border",
              ACCENT_CLASS[row.accent],
              completingId === row.id && "opacity-0 scale-95"
            )}
          >
            {/* Checkbox */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCheckbox(row);
              }}
              className="h-[16px] w-[16px] rounded border border-border flex-shrink-0 flex items-center justify-center hover:border-primary hover:bg-primary/5 transition-colors mt-1"
            >
              <Check className={cn("h-3 w-3", completingId === row.id ? "text-primary" : "text-transparent")} />
            </button>

            {/* Left content */}
            <div className="flex-1 min-w-0">
              {/* Line 1: Name · Company */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[0.9375rem] font-semibold text-foreground">{row.name}</span>
                <span className="text-[0.8125rem] text-muted-foreground">· {row.company}</span>
              </div>

              {/* Line 2: Task */}
              <div className="flex items-center gap-2.5 mt-1.5">
                <span className="text-[0.8125rem] text-foreground">{row.task}</span>
              </div>

              {/* Line 3: Description */}
              {row.description && (
                <p className="text-[0.75rem] text-muted-foreground mt-1 truncate">
                  {row.description}
                </p>
              )}
            </div>

            {/* Right column — stacked */}
            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 cursor-pointer hover:opacity-70 transition-opacity"
                  >
                    <span className={cn("text-[0.8125rem] font-medium", DATE_COLOR[row.dueType])}>
                      {row.due}
                    </span>
                    <span className={cn("text-[0.8125rem] font-medium", DATE_COLOR[row.dueType])}>
                      · {row.fullDate}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[160px]">
                  <DropdownMenuItem className="cursor-pointer" onSelect={() => postponeRow(row.id, addWeeks(new Date(), 1))}>
                    1 uke
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer" onSelect={() => postponeRow(row.id, addWeeks(new Date(), 2))}>
                    2 uker
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer" onSelect={() => postponeRow(row.id, addMonths(new Date(), 1))}>
                    1 måned
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="w-full flex items-center gap-2 px-2 py-1.5 text-[0.8125rem] hover:bg-secondary rounded-sm transition-colors">
                        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        Velg dato
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        onSelect={(d) => { if (d) postponeRow(row.id, d); }}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity mt-0.5",
                      SIGNAL_BADGES[row.signal] || "bg-gray-100 text-gray-600 border-gray-200"
                    )}
                  >
                    {row.signal}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[180px]">
                  {SIGNAL_OPTIONS.map((opt) => (
                    <DropdownMenuItem
                      key={opt.label}
                      onSelect={() => updateSignal(row.id, opt.label)}
                      className="cursor-pointer"
                    >
                      <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", opt.color)}>
                        {opt.label}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center">
        <button className="text-[0.8125rem] text-primary hover:underline">
          Vis alle oppfølginger →
        </button>
      </div>

      {/* Follow-up modal */}
      <FollowUpModal
        open={modalOpen}
        onCancel={handleCancel}
        onClose={handleSkip}
        onSubmit={handleFollowUpSubmit}
        data={modalData}
      />
    </div>
  );
};

export default MockOppfolgingerSection;
