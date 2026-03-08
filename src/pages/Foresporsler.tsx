import { useState, useRef, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Foresporsel {
  id: number;
  mottattDate: Date;
  selskap: string;
  sted: string;
  teknologier: string[];
  antallSendt: number;
  hvemSendt: string;
}

const TODAY = new Date(2026, 2, 8);

const DATA: Foresporsel[] = [
  { id: 66, mottattDate: new Date(2026, 0, 14), selskap: "Tomra", sted: "Oslo", teknologier: ["C", "C++", "Linux", "Embedded", "Yocto"], antallSendt: 4, hvemSendt: "Bjørn Ormholt, Tom Erik, Sindre, Ande" },
  { id: 67, mottattDate: new Date(2026, 0, 15), selskap: "Kongsberg", sted: "Kongsberg/Moss", teknologier: ["Embedded", "Lab", "Test"], antallSendt: 2, hvemSendt: "Sondre Russholm, Karl Eirik" },
  { id: 68, mottattDate: new Date(2026, 0, 16), selskap: "Kongsberg KDA", sted: "Kongsberg", teknologier: ["Embedded"], antallSendt: 1, hvemSendt: "Karl Eirik" },
  { id: 69, mottattDate: new Date(2026, 0, 12), selskap: "Kongsberggruppen", sted: "Kongsberg", teknologier: ["Embedded"], antallSendt: 1, hvemSendt: "Karl Eirik" },
  { id: 70, mottattDate: new Date(2026, 0, 21), selskap: "Cisco", sted: "Oslo", teknologier: ["Python", "Brannmur"], antallSendt: 0, hvemSendt: "" },
  { id: 71, mottattDate: new Date(2026, 0, 27), selskap: "Sykehuspartner", sted: "Oslo", teknologier: ["Cisco", "Brannmur"], antallSendt: 1, hvemSendt: "Helge Myhre" },
  { id: 72, mottattDate: new Date(2026, 0, 4), selskap: "Pixii", sted: "Remote", teknologier: ["Yocto", "OS"], antallSendt: 2, hvemSendt: "Rikke, Christian" },
  { id: 73, mottattDate: new Date(2026, 1, 5), selskap: "Remora Robotics", sted: "Stavanger", teknologier: ["C", "C++", "Embedded"], antallSendt: 1, hvemSendt: "Christian" },
  { id: 74, mottattDate: new Date(2026, 1, 4), selskap: "Kongsberg Maritime", sted: "Kongsberg/Horten", teknologier: ["C", "C++"], antallSendt: 1, hvemSendt: "Karl Eirik" },
  { id: 75, mottattDate: new Date(2026, 1, 5), selskap: "Alcatel", sted: "Trondheim", teknologier: ["C", "C++", "Lite info"], antallSendt: 1, hvemSendt: "Rikke" },
  { id: 76, mottattDate: new Date(2026, 1, 5), selskap: "Six Robotics", sted: "Oslo", teknologier: ["C/C++"], antallSendt: 1, hvemSendt: "Christian" },
  { id: 77, mottattDate: new Date(2026, 1, 11), selskap: "Norbit", sted: "Trondheim", teknologier: ["C++"], antallSendt: 2, hvemSendt: "Rikke, Christian" },
  { id: 78, mottattDate: new Date(2026, 1, 17), selskap: "SpinChip AS", sted: "Oslo", teknologier: ["Yocto", "Sikkerhet", "Kryptering"], antallSendt: 1, hvemSendt: "Christian" },
  { id: 79, mottattDate: new Date(2026, 1, 17), selskap: "Enker Group", sted: "Oslo", teknologier: ["C", "C++"], antallSendt: 1, hvemSendt: "Christian" },
  { id: 80, mottattDate: new Date(2026, 2, 6), selskap: "Six Robotics", sted: "Oslo", teknologier: ["C++", "Yocto"], antallSendt: 0, hvemSendt: "" },
  { id: 81, mottattDate: new Date(2026, 2, 6), selskap: "KDA", sted: "Kongsberg", teknologier: ["C++"], antallSendt: 0, hvemSendt: "" },
];

function getDaysAgo(d: Date): number {
  return Math.floor((TODAY.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function getMottattClass(days: number): string {
  if (days <= 7) return "text-foreground font-medium";
  if (days <= 21) return "text-amber-600 font-medium";
  return "text-destructive font-medium";
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

// Modal data
const MOCK_COMPANIES = [
  { name: "Kongsberg KDA", sted: "Kongsberg" },
  { name: "Six Robotics", sted: "Oslo" },
  { name: "SpinChip AS", sted: "Oslo" },
  { name: "Remora Robotics", sted: "Stavanger" },
  { name: "Norbit", sted: "Trondheim" },
  { name: "Tomra", sted: "Oslo" },
  { name: "Cisco", sted: "Oslo" },
  { name: "AutoStore", sted: "Halden" },
  { name: "Thales", sted: "Oslo" },
  { name: "ABB", sted: "Oslo" },
  { name: "TechnipFMC", sted: "Kongsberg" },
];

const MOCK_CONTACTS = [
  "Elin Lindtvedt", "Mathias Nedrebø", "Harald Moldsvor",
  "Øystein Kopstad", "Abdullah Akkoca", "Morten Røraas",
  "Sondre Russholm", "Karl Eirik Hansen", "Helge Myhre",
];

const SUGGESTED_TAGS = ["C", "C++", "Embedded", "Python", "Yocto", "Linux", "Lab", "Sikkerhet"];

function NyForesporselModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selskap, setSelskap] = useState("");
  const [sted, setSted] = useState("");
  const [kontakt, setKontakt] = useState("");
  const [showKontaktDropdown, setShowKontaktDropdown] = useState(false);
  const [kommentar, setKommentar] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSelskap(""); setSted(""); setKontakt(""); setKommentar("");
      setTags([]); setTagInput("");
    }
  }, [open]);

  const filtered = selskap.length > 0
    ? MOCK_COMPANIES.filter((c) => c.name.toLowerCase().includes(selskap.toLowerCase()))
    : [];

  const selectCompany = (c: typeof MOCK_COMPANIES[0]) => {
    setSelskap(c.name);
    setSted(c.sted);
    setShowDropdown(false);
  };

  const filteredKontakter = kontakt.length > 0
    ? MOCK_CONTACTS.filter((c) => c.toLowerCase().includes(kontakt.toLowerCase()))
    : [];

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md rounded-xl p-6 gap-0" hideCloseButton onInteractOutside={(e) => e.preventDefault()}>
        <DialogTitle className="text-[1.125rem] font-bold text-foreground mb-5">Ny forespørsel</DialogTitle>

        <div className="space-y-4">
          {/* Selskap */}
          <div>
            <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Selskap</label>
            <div className="relative mt-1">
              <Input
                ref={inputRef}
                value={selskap}
                onChange={(e) => { setSelskap(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Søk etter selskap..."
                className="text-[0.875rem]"
              />
              {showDropdown && filtered.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-md max-h-48 overflow-auto">
                  {filtered.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => selectCompany(c)}
                      className="w-full text-left px-3 py-2 text-[0.8125rem] hover:bg-secondary transition-colors"
                    >
                      {c.name}
                      <span className="text-muted-foreground ml-2 text-[0.75rem]">{c.sted}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sted */}
          <div>
            <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Sted</label>
            <Input
              value={sted}
              onChange={(e) => setSted(e.target.value)}
              placeholder="f.eks. Oslo, Kongsberg, Remote"
              className="mt-1 text-[0.875rem]"
            />
          </div>

          {/* Kontaktperson */}
          <div>
            <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Kontaktperson</label>
            <div className="relative mt-1">
              <Input
                value={kontakt}
                onChange={(e) => { setKontakt(e.target.value); setShowKontaktDropdown(true); }}
                onFocus={() => setShowKontaktDropdown(true)}
                onBlur={() => setTimeout(() => setShowKontaktDropdown(false), 150)}
                placeholder="Søk etter kontaktperson..."
                className="text-[0.875rem]"
              />
              {showKontaktDropdown && filteredKontakter.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-md max-h-48 overflow-auto">
                  {filteredKontakter.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setKontakt(c); setShowKontaktDropdown(false); }}
                      className="w-full text-left px-3 py-2 text-[0.8125rem] hover:bg-secondary transition-colors"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Teknologier */}
          <div>
            <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Teknologier</label>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 p-2 border border-border rounded-lg bg-background min-h-[38px]">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[0.75rem] text-foreground">
                  {t}
                  <button onClick={() => setTags(tags.filter((x) => x !== t))} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={tags.length === 0 ? "Legg til teknologi..." : ""}
                className="flex-1 min-w-[100px] bg-transparent outline-none text-[0.8125rem] placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SUGGESTED_TAGS.filter((s) => !tags.includes(s)).map((s) => (
                <button
                  key={s}
                  onClick={() => addTag(s)}
                  className="h-6 px-2 text-[0.6875rem] rounded-full border border-border text-muted-foreground hover:bg-secondary transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <button onClick={onClose} className="text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors">
            Avbryt
          </button>
          <button
            disabled={!selskap.trim()}
            onClick={() => {
              toast.success("Forespørsel opprettet");
              onClose();
            }}
            className={`inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg transition-colors ${
              selskap.trim()
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
          >
            Opprett forespørsel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Foresporsler() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

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
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Ny forespørsel
        </button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.07)] overflow-hidden">
        <table className="w-full text-[0.8125rem]">
          <thead>
            <tr className="border-b border-border">
              {["MOTTATT", "SELSKAP", "STED", "TEKNOLOGIER", "SENDT INN"].map((h) => (
                <th key={h} className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground text-left px-3 py-2.5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DATA.map((row, i) => {
              const days = getDaysAgo(row.mottattDate);
              return (
                <tr
                  key={row.id}
                  onClick={() => navigate(`/foresporsler/${row.id}`)}
                  className={`border-b border-border last:border-b-0 ${
                    i % 2 === 1 ? "bg-secondary/20" : ""
                  } hover:bg-secondary/50 transition-colors cursor-pointer`}
                >
                  <td className={`px-3 py-2.5 ${getMottattClass(days)}`}>
                    {days} dager siden
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-medium hover:text-primary hover:underline">{row.selskap}</span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{row.sted}</td>
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
                      <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-[0.6875rem] font-semibold">
                        0 sendt
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground">{row.antallSendt}</span>
                        <span className="text-muted-foreground text-[0.75rem]">{truncate(row.hvemSendt, 30)}</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {DATA.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-muted-foreground">
                  Ingen forespørsler å vise
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <NyForesporselModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
