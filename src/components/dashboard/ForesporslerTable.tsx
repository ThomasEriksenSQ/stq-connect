import { useState } from "react";
import { Plus } from "lucide-react";

type StatusType = "Forfalt" | "Aktiv" | "Ny" | "Fullført";
type FilterType = "Alle" | "Aktive" | "Forfalt" | "Fullført";

interface Foresporsel {
  mottatt: string;
  frist: string;
  fristDate: Date;
  selskap: string;
  sted: string;
  type: "DIR" | "VIA";
  teknologier: string[];
  sendt: number;
  sendt_navn: string;
  status: StatusType;
}

const TODAY = new Date(2026, 2, 7); // 07.03.2026

const DATA: Foresporsel[] = [
  { mottatt: "06.01.2026", frist: "09.03.2026", fristDate: new Date(2026, 2, 9), selskap: "Thales", sted: "Oslo", type: "DIR", teknologier: ["Embedded", "C++"], sendt: 1, sendt_navn: "Bjørn", status: "Forfalt" },
  { mottatt: "12.01.2026", frist: "11.02.2026", fristDate: new Date(2026, 1, 11), selskap: "Kongsberggruppen", sted: "Kongsberg", type: "VIA", teknologier: ["Embedded", "C", "C++"], sendt: 4, sendt_navn: "Karl, Bjørn +2", status: "Forfalt" },
  { mottatt: "16.01.2026", frist: "14.03.2026", fristDate: new Date(2026, 2, 14), selskap: "Kongsberg KDA", sted: "Kongsberg", type: "DIR", teknologier: ["Embedded", "Lab"], sendt: 2, sendt_navn: "Sondre, Karl", status: "Aktiv" },
  { mottatt: "21.01.2026", frist: "05.02.2026", fristDate: new Date(2026, 1, 5), selskap: "Cisco", sted: "Oslo", type: "VIA", teknologier: ["Python"], sendt: 0, sendt_navn: "", status: "Forfalt" },
  { mottatt: "05.02.2026", frist: "07.03.2026", fristDate: new Date(2026, 2, 7), selskap: "Six Robotics", sted: "Oslo", type: "DIR", teknologier: ["C/C++"], sendt: 1, sendt_navn: "Christian", status: "Aktiv" },
  { mottatt: "17.02.2026", frist: "19.03.2026", fristDate: new Date(2026, 2, 19), selskap: "SpinChip AS", sted: "Oslo", type: "DIR", teknologier: ["Yocto", "Sikkerhet"], sendt: 1, sendt_navn: "Christian", status: "Aktiv" },
  { mottatt: "05.02.2026", frist: "04.04.2026", fristDate: new Date(2026, 3, 4), selskap: "Pixii", sted: "Remote", type: "DIR", teknologier: ["Yocto", "OS"], sendt: 2, sendt_navn: "Rikke, Christian", status: "Aktiv" },
  { mottatt: "06.03.2026", frist: "05.04.2026", fristDate: new Date(2026, 3, 5), selskap: "KDA", sted: "Kongsberg", type: "DIR", teknologier: ["C++"], sendt: 0, sendt_navn: "", status: "Ny" },
];

const STATUS_COLORS: Record<StatusType, string> = {
  Forfalt: "bg-red-100 text-red-800 border-red-200",
  Aktiv: "bg-amber-100 text-amber-800 border-amber-200",
  Ny: "bg-blue-100 text-blue-800 border-blue-200",
  Fullført: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const CHIP_BASE = "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors cursor-pointer";
const CHIP_OFF = `${CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;
const CHIP_ON = `${CHIP_BASE} bg-foreground text-background border-foreground font-medium`;

const ForesporslerTable = () => {
  const [filter, setFilter] = useState<FilterType>("Alle");

  const FILTER_MAP: Record<FilterType, (f: Foresporsel) => boolean> = {
    Alle: () => true,
    Aktive: (f) => f.status === "Aktiv",
    Forfalt: (f) => f.status === "Forfalt",
    Fullført: (f) => f.status === "Fullført",
  };

  const filtered = DATA.filter(FILTER_MAP[filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[1.125rem] font-bold text-foreground">Forespørsler</h2>
          <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary/10 text-primary text-[0.6875rem] font-semibold">
            {DATA.length}
          </span>
        </div>
        <button className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" />
          Ny forespørsel
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2">
        {(["Alle", "Aktive", "Forfalt", "Fullført"] as FilterType[]).map((f) => (
          <button key={f} className={filter === f ? CHIP_ON : CHIP_OFF} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.07)] overflow-hidden">
        <table className="w-full text-[0.8125rem]">
          <thead>
            <tr className="border-b border-border">
              {["MOTTATT", "FRIST", "SELSKAP", "STED", "TYPE", "TEKNOLOGIER", "SENDT INN", "STATUS"].map((h) => (
                <th key={h} className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground text-left px-3 py-2.5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => {
              const overdue = row.fristDate < TODAY;
              return (
                <tr key={i} className={`border-b border-border last:border-0 ${i % 2 === 1 ? "bg-secondary/30" : ""} hover:bg-secondary/50 transition-colors`}>
                  <td className="px-3 py-2.5 text-muted-foreground">{row.mottatt}</td>
                  <td className={`px-3 py-2.5 font-medium ${overdue ? "text-destructive" : "text-foreground"}`}>{row.frist}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-primary font-medium cursor-pointer hover:underline">{row.selskap}</span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{row.sted}</td>
                  <td className="px-3 py-2.5">
                    {row.type === "DIR" ? (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold bg-foreground text-background">DIR</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[0.6875rem] font-semibold text-foreground">VIA</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {row.teknologier.map((t) => (
                        <span key={t} className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[0.6875rem] text-muted-foreground">{t}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-semibold text-foreground">{row.sendt}</span>
                    {row.sendt_navn && <span className="text-muted-foreground ml-1">({row.sendt_navn})</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-semibold ${STATUS_COLORS[row.status]}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted-foreground">Ingen forespørsler</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ForesporslerTable;
