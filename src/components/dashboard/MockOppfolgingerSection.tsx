import { Check, CalendarIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const CHIP_BASE = "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors cursor-pointer";
const CHIP_OFF = `${CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;
const CHIP_ON = `${CHIP_BASE} bg-foreground text-background border-foreground font-medium`;

const SIGNAL_BADGES: Record<string, string> = {
  "Behov nå": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Får fremtidig behov": "bg-blue-100 text-blue-800 border-blue-200",
  "Får kanskje behov": "bg-amber-100 text-amber-800 border-amber-200",
  "Ukjent om behov": "bg-gray-100 text-gray-600 border-gray-200",
};

type MockRow = {
  id: string;
  name: string;
  signal: string;
  company: string;
  task: string;
  due: string;
  dueType: "overdue" | "today" | "future" | "none";
  description: string | null;
  accent: "destructive" | "primary" | "emerald" | "none";
};

const MOCK_DATA: MockRow[] = [
  {
    id: "1",
    name: "Elin Lindtvedt",
    signal: "Behov nå",
    company: "Kongsberg Defence & Aerospace",
    task: "Send tilbud på konsulent",
    due: "Forfalt 2 dager",
    dueType: "overdue",
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
    description: null,
    accent: "primary",
  },
  {
    id: "3",
    name: "Harald Moldsvor",
    signal: "Får kanskje behov",
    company: "AUTOSTORE AS",
    task: "Følg opp om behov",
    due: "Om 3 dager",
    dueType: "future",
    description: "Spurte om Q2-planer sist",
    accent: "emerald",
  },
  {
    id: "4",
    name: "Øystein Kopstad",
    signal: "Får fremtidig behov",
    company: "Commit AS",
    task: "Send CV-liste",
    due: "I dag",
    dueType: "today",
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
    description: null,
    accent: "none",
  },
];

const DUE_CHIP: Record<string, string> = {
  overdue: "bg-destructive/10 text-destructive",
  today: "bg-primary/10 text-primary",
  future: "bg-muted text-muted-foreground",
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
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <h2 className="text-[1.125rem] font-bold text-foreground">Oppfølginger</h2>
        <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary/10 text-primary text-[0.6875rem] font-semibold">
          5
        </span>
      </div>

      {/* Filters (visual only) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground w-14 flex-shrink-0">Når</span>
          <div className="flex items-center gap-1.5">
            {NAAR_FILTERS.map(f => (
              <button key={f} className={f === "Forfalt + I dag" ? CHIP_ON : CHIP_OFF}>{f}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground w-14 flex-shrink-0">Eier</span>
          <div className="flex items-center gap-1.5">
            {EIER_FILTERS.map(f => (
              <button key={f} className={f === "Thomas Eriksen" ? CHIP_ON : CHIP_OFF}>{f}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground w-14 flex-shrink-0">Signal</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {SIGNAL_FILTERS.map(f => (
              <button key={f} className={f === "Alle" ? CHIP_ON : CHIP_OFF}>{f}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Card container */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {MOCK_DATA.map((row, i) => (
          <div
            key={row.id}
            className={cn(
              "px-4 py-3 cursor-pointer hover:bg-secondary/40 transition-colors",
              i < MOCK_DATA.length - 1 && "border-b border-border",
              ACCENT_CLASS[row.accent]
            )}
          >
            {/* Line 1: Name · Signal · Company */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[0.9375rem] font-semibold text-foreground">{row.name}</span>
              <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", SIGNAL_BADGES[row.signal])}>
                {row.signal}
              </span>
              <span className="text-[0.8125rem] text-muted-foreground">· {row.company}</span>
            </div>

            {/* Line 2: Checkbox + Task + Due chip + Postpone */}
            <div className="flex items-center gap-2.5 mt-1.5 pl-0.5">
              <button className="h-[16px] w-[16px] rounded border border-border flex-shrink-0 flex items-center justify-center hover:border-primary hover:bg-primary/5 transition-colors">
                <Check className="h-3 w-3 text-transparent" />
              </button>
              <span className="text-[0.8125rem] text-foreground">{row.task}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap", DUE_CHIP[row.dueType])}>
                {row.due}
              </span>
              <div className="flex-1" />
              <button className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
                <CalendarIcon className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Line 3: Description (if present) */}
            {row.description && (
              <p className="text-[0.75rem] text-muted-foreground mt-1 pl-[26px] truncate">
                {row.description}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-center">
        <button className="text-[0.8125rem] text-primary hover:underline">
          Vis alle oppfølginger →
        </button>
      </div>
    </div>
  );
};

export default MockOppfolgingerSection;
