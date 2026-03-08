import { useState } from "react";
import { Plus, Briefcase } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type StatusType = "Forfalt" | "Aktiv" | "Ny" | "Fullført";
type FilterType = "Alle" | "Ny" | "Aktiv" | "Forfalt" | "Fullført";
type RefType = "Kunde" | "Cold call" | "Partner";

interface Foresporsel {
  id: number;
  mottatt: string;
  frist: string;
  fristDate: Date;
  selskap: string;
  sted: string;
  type: "DIR" | "VIA";
  referanse: RefType;
  teknologier: string[];
  kommentar: string;
  antallSendt: number;
  hvemSendt: string;
  status: StatusType;
}

const TODAY = new Date(2026, 2, 8);

const DATA: Foresporsel[] = [
  { id: 66, mottatt: "14.01.2026", frist: "13.02.2026", fristDate: new Date(2026, 1, 13), selskap: "Tomra", sted: "Oslo", type: "DIR", referanse: "Kunde", teknologier: ["C", "C++", "Linux", "Embedded", "Yocto"], kommentar: "", antallSendt: 4, hvemSendt: "Bjørn Ormholt / Tom Erik / Sindre / Ande", status: "Forfalt" },
  { id: 67, mottatt: "15.01.2026", frist: "14.02.2026", fristDate: new Date(2026, 1, 14), selskap: "Kongsberg", sted: "Kongsberg/Moss", type: "DIR", referanse: "Kunde", teknologier: ["Embedded", "Lab", "Test"], kommentar: "", antallSendt: 2, hvemSendt: "Sondre Russholm / Karl Eirik", status: "Forfalt" },
  { id: 68, mottatt: "16.01.2026", frist: "16.02.2026", fristDate: new Date(2026, 1, 16), selskap: "Kongsberg KDA", sted: "Kongsberg", type: "DIR", referanse: "Kunde", teknologier: ["Embedded"], kommentar: "Morten Røraas", antallSendt: 1, hvemSendt: "Karl Eirik", status: "Forfalt" },
  { id: 69, mottatt: "12.01.2026", frist: "12.01.2026", fristDate: new Date(2026, 0, 12), selskap: "Kongsberggruppen", sted: "Kongsberg", type: "DIR", referanse: "Cold call", teknologier: ["Embedded"], kommentar: "Via Elin Lindvvet", antallSendt: 1, hvemSendt: "Karl Eirik", status: "Forfalt" },
  { id: 70, mottatt: "21.01.2026", frist: "20.02.2026", fristDate: new Date(2026, 1, 20), selskap: "Cisco", sted: "Oslo", type: "VIA", referanse: "Partner", teknologier: ["Python", "Brannmur"], kommentar: "Via Simi, Siri", antallSendt: 0, hvemSendt: "", status: "Forfalt" },
  { id: 71, mottatt: "27.01.2026", frist: "05.02.2026", fristDate: new Date(2026, 1, 5), selskap: "Sykehuspartner", sted: "Oslo", type: "VIA", referanse: "Partner", teknologier: ["Cisco", "Brannmur"], kommentar: "Via Experis", antallSendt: 1, hvemSendt: "Helge Myhre", status: "Forfalt" },
  { id: 72, mottatt: "04.01.2026", frist: "04.01.2026", fristDate: new Date(2026, 0, 4), selskap: "Pixii", sted: "Remote", type: "DIR", referanse: "Cold call", teknologier: ["Yocto", "OS"], kommentar: "", antallSendt: 2, hvemSendt: "Rikke / Christian", status: "Forfalt" },
  { id: 73, mottatt: "05.02.2026", frist: "07.03.2026", fristDate: new Date(2026, 2, 7), selskap: "Remora Robotics", sted: "Stavanger", type: "DIR", referanse: "Cold call", teknologier: ["C", "C++", "Embedded"], kommentar: "Linkedin mld, Brage", antallSendt: 1, hvemSendt: "Christian", status: "Aktiv" },
  { id: 74, mottatt: "04.02.2026", frist: "04.04.2026", fristDate: new Date(2026, 3, 4), selskap: "Kongsberg Maritime", sted: "Kongsberg/Horten", type: "DIR", referanse: "Cold call", teknologier: ["C", "C++"], kommentar: "Via Håkon Gjone", antallSendt: 1, hvemSendt: "Karl Eirik", status: "Aktiv" },
  { id: 75, mottatt: "05.02.2026", frist: "07.03.2026", fristDate: new Date(2026, 2, 7), selskap: "Alcatel", sted: "Trondheim", type: "DIR", referanse: "Partner", teknologier: ["C", "C++", "Lite info"], kommentar: "Via Experis, Arild", antallSendt: 1, hvemSendt: "Rikke", status: "Aktiv" },
  { id: 76, mottatt: "05.02.2026", frist: "07.03.2026", fristDate: new Date(2026, 2, 7), selskap: "Six Robotics", sted: "Oslo", type: "DIR", referanse: "Kunde", teknologier: ["C/C++"], kommentar: "", antallSendt: 1, hvemSendt: "Christian", status: "Aktiv" },
  { id: 77, mottatt: "11.02.2026", frist: "11.03.2026", fristDate: new Date(2026, 2, 11), selskap: "Norbit", sted: "Trondheim", type: "DIR", referanse: "Cold call", teknologier: ["C++"], kommentar: "", antallSendt: 2, hvemSendt: "Rikke, Christian", status: "Aktiv" },
  { id: 78, mottatt: "17.02.2026", frist: "19.03.2026", fristDate: new Date(2026, 2, 19), selskap: "SpinChip AS", sted: "Oslo", type: "DIR", referanse: "Cold call", teknologier: ["Yocto", "Sikkerhet", "Kryptering"], kommentar: "", antallSendt: 1, hvemSendt: "Christian", status: "Aktiv" },
  { id: 79, mottatt: "17.02.2026", frist: "19.03.2026", fristDate: new Date(2026, 2, 19), selskap: "Enker Group", sted: "Oslo", type: "DIR", referanse: "Cold call", teknologier: ["C", "C++"], kommentar: "", antallSendt: 1, hvemSendt: "Christian", status: "Aktiv" },
  { id: 80, mottatt: "06.03.2026", frist: "05.04.2026", fristDate: new Date(2026, 3, 5), selskap: "Six Robotics", sted: "Oslo", type: "DIR", referanse: "Kunde", teknologier: ["C++", "Yocto"], kommentar: "", antallSendt: 0, hvemSendt: "", status: "Ny" },
  { id: 81, mottatt: "06.03.2026", frist: "05.04.2026", fristDate: new Date(2026, 3, 5), selskap: "KDA", sted: "Kongsberg", type: "DIR", referanse: "Cold call", teknologier: ["C++"], kommentar: "Elin", antallSendt: 0, hvemSendt: "", status: "Ny" },
];

const STATUS_COLORS: Record<StatusType, string> = {
  Ny: "bg-blue-100 text-blue-800 border-blue-200",
  Aktiv: "bg-amber-100 text-amber-800 border-amber-200",
  Forfalt: "bg-red-100 text-red-800 border-red-200",
  Fullført: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const REF_COLORS: Record<RefType, string> = {
  Kunde: "text-emerald-700",
  "Cold call": "text-blue-700",
  Partner: "text-purple-700",
};

const SUMMARY_COLORS: Record<StatusType, string> = {
  Ny: "text-primary",
  Aktiv: "text-amber-600",
  Forfalt: "text-destructive",
  Fullført: "text-emerald-600",
};

const CHIP_BASE = "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors cursor-pointer";
const CHIP_OFF = `${CHIP_BASE} border-border text-muted-foreground hover:bg-secondary`;
const CHIP_ON = `${CHIP_BASE} bg-foreground text-background border-foreground font-medium`;

function getFristClass(fristDate: Date): string {
  const diff = fristDate.getTime() - TODAY.getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 0) return "text-destructive font-semibold";
  if (days <= 7) return "text-amber-600 font-semibold";
  return "text-foreground font-medium";
}

function getRowBorderClass(row: Foresporsel): string {
  if (row.status === "Forfalt") return "border-l-2 border-l-destructive/40";
  if (row.status === "Ny" && row.antallSendt === 0) return "border-l-2 border-l-amber-400";
  return "border-l-2 border-l-transparent";
}

function countByStatus(s: StatusType): number {
  return DATA.filter((r) => r.status === s).length;
}

const FILTERS: FilterType[] = ["Alle", "Ny", "Aktiv", "Forfalt", "Fullført"];

export default function Foresporsler() {
  const [filter, setFilter] = useState<FilterType>("Alle");
  const navigate = useNavigate();

  const filtered = filter === "Alle" ? DATA : DATA.filter((r) => r.status === filter);

  const handleSummaryClick = (s: StatusType) => {
    setFilter(filter === s ? "Alle" : s);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[1.5rem] font-bold text-foreground">Forespørsler</h1>
          <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary/10 text-primary text-[0.6875rem] font-semibold">
            {DATA.length}
          </span>
        </div>
        <button className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" />
          Ny forespørsel
        </button>
      </div>

      {/* Pipeline summary */}
      <div className="flex items-center gap-3">
        {(["Ny", "Aktiv", "Forfalt", "Fullført"] as StatusType[]).map((s) => (
          <button
            key={s}
            onClick={() => handleSummaryClick(s)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[0.8125rem] transition-colors cursor-pointer ${
              filter === s ? "border-foreground/20 bg-secondary/60" : "border-border bg-card hover:bg-secondary/40"
            }`}
          >
            <span className="text-muted-foreground font-medium">{s}:</span>
            <span className={`font-bold ${SUMMARY_COLORS[s]}`}>{countByStatus(s)}</span>
          </button>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2">
        {FILTERS.map((f) => (
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
              {["MOTTATT", "FRIST", "SELSKAP", "STED", "TYPE", "REF.", "TEKNOLOGIER", "SENDT INN", "STATUS"].map((h) => (
                <th key={h} className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground text-left px-3 py-2.5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr
                key={row.id}
                onClick={() => navigate(`/foresporsler/${row.id}`)}
                className={`${getRowBorderClass(row)} border-b border-border last:border-b-0 ${
                  i % 2 === 1 ? "bg-secondary/20" : ""
                } hover:bg-secondary/50 transition-colors cursor-pointer min-h-[44px]`}
              >
                <td className="px-3 py-2.5 text-muted-foreground">{row.mottatt}</td>
                <td className={`px-3 py-2.5 ${getFristClass(row.fristDate)}`}>{row.frist}</td>
                <td className="px-3 py-2.5">
                  <span className="font-medium hover:text-primary hover:underline">{row.selskap}</span>
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
                  <span className={`text-xs font-medium ${REF_COLORS[row.referanse]}`}>{row.referanse}</span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {row.teknologier.slice(0, 3).map((t) => (
                      <span key={t} className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[0.6875rem] text-muted-foreground">{t}</span>
                    ))}
                    {row.teknologier.length > 3 && (
                      <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[0.6875rem] text-muted-foreground">
                        +{row.teknologier.length - 3}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {row.antallSendt === 0 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[0.6875rem] font-semibold">0</span>
                      </TooltipTrigger>
                      <TooltipContent>Ingen CV-er sendt</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="font-semibold text-foreground">{row.antallSendt}</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-[0.75rem]">{row.hvemSendt}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-semibold ${STATUS_COLORS[row.status]}`}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-12 text-muted-foreground">
                  Ingen forespørsler å vise
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
