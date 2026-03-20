import { useState, useMemo, useCallback } from "react";
import { companiesMatch } from "@/lib/companyMatch";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Download, ExternalLink, Plus, User, TrendingUp, TrendingDown, Sparkles, Loader2, Search, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfWeek, getISOWeek, getISOWeekYear, subDays, parseISO } from "date-fns";
import { nb } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, Legend, ResponsiveContainer, BarChart, Bar, CartesianGrid } from "recharts";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import ReactMarkdown from "react-markdown";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

// ── Types ──
type FinnAnnonse = {
  id: string;
  dato: string;
  uke: string | null;
  selskap: string | null;
  stillingsrolle: string | null;
  lokasjon: string | null;
  teknologier: string | null;
  lenke: string | null;
  kontaktnavn: string | null;
  kontakt_epost: string | null;
  kontakt_telefon: string | null;
  created_at: string;
};

type CompanyRef = { id: string; name: string };

const TECH_KEYWORDS = ["C++", "C", "Rust", "Python", "Zephyr", "Yocto", "Embedded Linux", "FreeRTOS", "FPGA"];
const TECH_COLORS: Record<string, string> = {
  "C++": "#3b82f6", C: "#10b981", Rust: "#f97316", Python: "#eab308",
  Zephyr: "#8b5cf6", Yocto: "#ec4899", "Embedded Linux": "#14b8a6",
  FreeRTOS: "#f43f5e", FPGA: "#6366f1",
};

function getIsoWeekStr(d: Date): string {
  return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
}

function matchTech(text: string, keyword: string): boolean {
  if (keyword === "C") return /\bC\b/.test(text);
  return text.toLowerCase().includes(keyword.toLowerCase());
}

// ── Main Component ──
export default function Markedsradar() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [importOpen, setImportOpen] = useState(false);

  // Fetch annonser
  const { data: annonser = [], refetch } = useQuery({
    queryKey: ["finn_annonser"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finn_annonser" as any)
        .select("*")
        .order("dato", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as FinnAnnonse[];
    },
  });

  // Fetch companies for CRM matching
  const { data: companies = [] } = useQuery({
    queryKey: ["companies_ref"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name");
      if (error) throw error;
      return (data || []) as CompanyRef[];
    },
  });

  const findCompany = useCallback(
    (selskap: string | null) => {
      if (!selskap) return null;
      return companies.find((c) => companiesMatch(selskap, c.name)) || null;
    },
    [companies]
  );

  const currentWeek = getIsoWeekStr(new Date());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[1.5rem] font-bold text-foreground">Markedsradar</h1>
          <p className="text-[0.8125rem] text-muted-foreground">Embedded & firmware-markedet i Norge</p>
        </div>
        <Button onClick={() => setImportOpen(true)} className="gap-2">
          <Download className="h-4 w-4" />
          Importer uke
        </Button>
      </div>

      <Tabs defaultValue="oversikt">
        <TabsList>
          <TabsTrigger value="oversikt">Oversikt</TabsTrigger>
          <TabsTrigger value="annonser">Annonser</TabsTrigger>
          <TabsTrigger value="ai">AI-analyse</TabsTrigger>
        </TabsList>

        <TabsContent value="oversikt">
          <OversiktTab annonser={annonser} currentWeek={currentWeek} findCompany={findCompany} navigate={navigate} />
        </TabsContent>
        <TabsContent value="annonser">
          <AnnonserTab annonser={annonser} findCompany={findCompany} navigate={navigate} />
        </TabsContent>
        <TabsContent value="ai">
          <AIAnalyseTab annonser={annonser} currentWeek={currentWeek} findCompany={findCompany} />
        </TabsContent>
      </Tabs>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} refetch={refetch} />
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OVERSIKT TAB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function OversiktTab({ annonser, currentWeek, findCompany, navigate }: {
  annonser: FinnAnnonse[]; currentWeek: string;
  findCompany: (s: string | null) => CompanyRef | null;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const now = new Date();
  const prevWeek = getIsoWeekStr(subDays(startOfWeek(now, { weekStartsOn: 1 }), 1));

  const thisWeek = annonser.filter((a) => a.uke === currentWeek);
  const lastWeek = annonser.filter((a) => a.uke === prevWeek);
  const diff = thisWeek.length - lastWeek.length;

  // Unique companies last 30 days
  const d30 = subDays(now, 30).toISOString().slice(0, 10);
  const uniqueCompanies30 = new Set(
    annonser.filter((a) => a.dato >= d30 && a.selskap).map((a) => a.selskap!.toLowerCase().trim())
  ).size;

  // Hottest tech this week
  const techCountsWeek: Record<string, number> = {};
  thisWeek.forEach((a) => {
    if (!a.teknologier) return;
    TECH_KEYWORDS.forEach((kw) => {
      if (matchTech(a.teknologier!, kw)) techCountsWeek[kw] = (techCountsWeek[kw] || 0) + 1;
    });
  });
  const hottestTech = Object.entries(techCountsWeek).sort((a, b) => b[1] - a[1])[0];

  // Chart data: last 12 weeks
  const weeks = useMemo(() => {
    const allWeeks = [...new Set(annonser.map((a) => a.uke).filter(Boolean))] as string[];
    return allWeeks.sort().slice(-12);
  }, [annonser]);

  const chartData = useMemo(() => {
    return weeks.map((w) => {
      const weekRows = annonser.filter((a) => a.uke === w);
      const entry: Record<string, any> = { uke: `Uke ${w.split("-W")[1]}` };
      TECH_KEYWORDS.forEach((kw) => {
        entry[kw] = weekRows.filter((r) => r.teknologier && matchTech(r.teknologier, kw)).length;
      });
      return entry;
    });
  }, [weeks, annonser]);

  // Top employers last 90 days
  const d90 = subDays(now, 90).toISOString().slice(0, 10);
  const employerCounts = useMemo(() => {
    const map: Record<string, number> = {};
    annonser.filter((a) => a.dato >= d90 && a.selskap).forEach((a) => {
      const key = a.selskap!.trim();
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [annonser, d90]);

  const barData = employerCounts.map(([name, count]) => ({
    name, count, inCRM: !!findCompany(name),
  }));

  return (
    <div className="space-y-6 mt-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Annonser denne uken" value={thisWeek.length} />
        <StatCard
          label="Endring fra forrige uke"
          value={`${diff >= 0 ? "+" : ""}${diff}`}
          sub={diff >= 0 ? "↑" : "↓"}
          color={diff >= 0 ? "text-[hsl(var(--success))]" : "text-destructive"}
        />
        <StatCard label="Unike selskaper (30d)" value={uniqueCompanies30} />
        <StatCard
          label="Varmeste teknologi"
          value={hottestTech ? hottestTech[0] : "–"}
          sub={hottestTech ? `${hottestTech[1]} treff` : undefined}
        />
      </div>

      {/* Tech trend chart */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-4">Teknologitrender</h2>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="uke" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <ReTooltip />
              <Legend />
              {TECH_KEYWORDS.map((kw) => (
                <Line key={kw} type="monotone" dataKey={kw} stroke={TECH_COLORS[kw]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Two columns */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top employers bar chart */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-4">
              Topp arbeidsgivere (siste 90 dager)
            </h2>
            <ResponsiveContainer width="100%" height={barData.length * 36 + 20}>
              <BarChart data={barData} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  width={100}
                />
                <ReTooltip />
                <Bar
                  dataKey="count"
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(d: any) => {
                    const c = findCompany(d.name);
                    if (c) navigate(`/selskaper/${c.id}`);
                  }}
                  fill="hsl(var(--primary))"
                  // Color based on CRM status handled via cells
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* This week's ads */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-4">
              Nye annonser denne uken
            </h2>
            <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
              {thisWeek.slice(0, 20).map((a) => {
                const c = findCompany(a.selskap);
                return (
                  <div key={a.id} className="py-2.5 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn("text-[0.9375rem] font-medium truncate", c ? "text-foreground cursor-pointer hover:underline" : "text-foreground")}
                          onClick={() => c && navigate(`/selskaper/${c.id}`)}
                        >
                          {a.selskap || "Ukjent"}
                        </span>
                        {!c && (
                          <span className="inline-flex items-center gap-1 text-[0.6875rem] text-[hsl(var(--warning))] font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--warning))]" />
                            Ikke i CRM
                          </span>
                        )}
                        {a.kontaktnavn && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <User className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">{a.kontaktnavn}</p>
                              {a.kontakt_epost && <p className="text-[0.75rem]">{a.kontakt_epost}</p>}
                              {a.kontakt_telefon && <p className="text-[0.75rem]">{a.kontakt_telefon}</p>}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <p className="text-[0.8125rem] text-muted-foreground truncate">{a.stillingsrolle}</p>
                      {a.teknologier && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {a.teknologier.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 4).map((t) => (
                            <span key={t} className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[0.6875rem] text-muted-foreground">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!c && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => navigate(`/selskaper?ny=${encodeURIComponent(a.selskap || "")}`)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {a.lenke && (
                        <a href={a.lenke} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
              {thisWeek.length === 0 && (
                <p className="text-[0.8125rem] text-muted-foreground py-4 text-center">Ingen annonser denne uken ennå.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
        <p className={cn("text-[1.5rem] font-bold mt-1", color || "text-foreground")}>
          {value} {sub && <span className="text-[0.875rem]">{sub}</span>}
        </p>
      </CardContent>
    </Card>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ANNONSER TAB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function AnnonserTab({ annonser, findCompany, navigate }: {
  annonser: FinnAnnonse[];
  findCompany: (s: string | null) => CompanyRef | null;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [search, setSearch] = useState("");
  const [weekFilter, setWeekFilter] = useState<string>("alle");
  const [techFilters, setTechFilters] = useState<string[]>([]);
  const [crmFilter, setCrmFilter] = useState<"alle" | "crm" | "ikke_crm">("alle");
  const [page, setPage] = useState(0);
  const PER_PAGE = 25;

  const allWeeks = useMemo(() => {
    const w = [...new Set(annonser.map((a) => a.uke).filter(Boolean))] as string[];
    return w.sort().reverse();
  }, [annonser]);

  const filtered = useMemo(() => {
    let rows = annonser;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        (r.selskap || "").toLowerCase().includes(q) ||
        (r.stillingsrolle || "").toLowerCase().includes(q) ||
        (r.teknologier || "").toLowerCase().includes(q)
      );
    }
    if (weekFilter !== "alle") rows = rows.filter((r) => r.uke === weekFilter);
    if (techFilters.length > 0) {
      rows = rows.filter((r) =>
        r.teknologier && techFilters.some((tf) => matchTech(r.teknologier!, tf))
      );
    }
    if (crmFilter === "crm") rows = rows.filter((r) => findCompany(r.selskap));
    if (crmFilter === "ikke_crm") rows = rows.filter((r) => !findCompany(r.selskap));
    return rows;
  }, [annonser, search, weekFilter, techFilters, crmFilter, findCompany]);

  const paged = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  return (
    <div className="space-y-4 mt-4">
      {/* Filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Søk selskap, rolle, teknologi..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-[0.8125rem]"
            value={weekFilter}
            onChange={(e) => { setWeekFilter(e.target.value); setPage(0); }}
          >
            <option value="alle">Alle uker</option>
            {allWeeks.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            {(["alle", "crm", "ikke_crm"] as const).map((v) => (
              <button
                key={v}
                onClick={() => { setCrmFilter(v); setPage(0); }}
                className={cn(
                  "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors",
                  crmFilter === v
                    ? "bg-primary/10 border-primary/30 text-primary font-medium"
                    : "border-border text-muted-foreground hover:bg-secondary"
                )}
              >
                {v === "alle" ? "Alle" : v === "crm" ? "I CRM" : "Ikke i CRM"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {TECH_KEYWORDS.map((kw) => (
            <button
              key={kw}
              onClick={() => {
                setTechFilters((prev) =>
                  prev.includes(kw) ? prev.filter((t) => t !== kw) : [...prev, kw]
                );
                setPage(0);
              }}
              className={cn(
                "h-7 px-2.5 text-[0.75rem] rounded-full border transition-colors",
                techFilters.includes(kw)
                  ? "bg-primary/10 border-primary/30 text-primary font-medium"
                  : "border-border text-muted-foreground hover:bg-secondary"
              )}
            >
              {kw}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[0.8125rem] text-muted-foreground">{filtered.length} annonser</p>

      {/* Table */}
      <Card className="shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[0.6875rem]">DATO</TableHead>
              <TableHead className="text-[0.6875rem]">SELSKAP</TableHead>
              <TableHead className="text-[0.6875rem]">ROLLE</TableHead>
              <TableHead className="text-[0.6875rem]">LOKASJON</TableHead>
              <TableHead className="text-[0.6875rem]">TEKNOLOGIER</TableHead>
              <TableHead className="text-[0.6875rem]">KONTAKT</TableHead>
              <TableHead className="text-[0.6875rem]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((a) => {
              const c = findCompany(a.selskap);
              const techs = a.teknologier ? a.teknologier.split(",").map((t) => t.trim()).filter(Boolean) : [];
              return (
                <TableRow key={a.id} className="min-h-[44px]">
                  <TableCell className="text-[0.8125rem] text-muted-foreground whitespace-nowrap">
                    {format(parseISO(a.dato), "d. MMM yyyy", { locale: nb })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {c ? (
                        <span
                          className="text-[0.8125rem] font-medium text-primary cursor-pointer hover:underline"
                          onClick={() => navigate(`/selskaper/${c.id}`)}
                        >
                          {a.selskap}
                        </span>
                      ) : (
                        <span className="text-[0.8125rem] font-medium">{a.selskap}</span>
                      )}
                      {!c && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--warning))]" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-[0.8125rem]">{a.stillingsrolle}</TableCell>
                  <TableCell className="text-[0.8125rem] text-muted-foreground">{a.lokasjon}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {techs.slice(0, 4).map((t) => (
                        <span key={t} className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[0.6875rem] text-muted-foreground">{t}</span>
                      ))}
                      {techs.length > 4 && (
                        <span className="text-[0.6875rem] text-muted-foreground">+{techs.length - 4} mer</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {a.kontaktnavn ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <User className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{a.kontaktnavn}</p>
                          {a.kontakt_epost && <p className="text-[0.75rem]">{a.kontakt_epost}</p>}
                          {a.kontakt_telefon && <p className="text-[0.75rem]">{a.kontakt_telefon}</p>}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-[0.6875rem] text-muted-foreground">–</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {a.lenke && (
                      <a href={a.lenke} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Forrige
          </Button>
          <span className="text-[0.8125rem] text-muted-foreground">
            Side {page + 1} av {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
            Neste
          </Button>
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI ANALYSE TAB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function AIAnalyseTab({ annonser, currentWeek, findCompany }: {
  annonser: FinnAnnonse[]; currentWeek: string;
  findCompany: (s: string | null) => CompanyRef | null;
}) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const { toast } = useToast();

  const generateAnalysis = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const thisWeekRows = annonser
        .filter((a) => a.uke === currentWeek)
        .map((r) => `${r.selskap} · ${r.stillingsrolle} · ${r.teknologier}`)
        .join("\n") || "Ingen data denne uken";

      // Tech counts last 4 weeks
      const w4 = [...new Set(annonser.map((a) => a.uke).filter(Boolean))]
        .sort()
        .slice(-4) as string[];
      const w4Rows = annonser.filter((a) => a.uke && w4.includes(a.uke));
      const tc: Record<string, number> = {};
      w4Rows.forEach((r) => {
        if (!r.teknologier) return;
        TECH_KEYWORDS.forEach((kw) => {
          if (matchTech(r.teknologier!, kw)) tc[kw] = (tc[kw] || 0) + 1;
        });
      });
      const techCounts = Object.entries(tc).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(", ");

      // Top companies last 8 weeks
      const w8 = [...new Set(annonser.map((a) => a.uke).filter(Boolean))]
        .sort()
        .slice(-8) as string[];
      const w8Rows = annonser.filter((a) => a.uke && w8.includes(a.uke));
      const cc: Record<string, number> = {};
      w8Rows.forEach((r) => {
        if (r.selskap) cc[r.selskap.trim()] = (cc[r.selskap.trim()] || 0) + 1;
      });
      const topCompanies = Object.entries(cc).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${k}: ${v} annonser`).join(", ");

      // Not in CRM
      const allCompanyNames = [...new Set(annonser.filter((a) => a.selskap).map((a) => a.selskap!.trim()))];
      const notInCRM = allCompanyNames.filter((n) => !findCompany(n)).slice(0, 20).join(", ");

      const { data, error } = await supabase.functions.invoke("markedsradar-analyse", {
        body: { currentWeek, thisWeekRows, techCounts, topCompanies, notInCRM },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAnalysis(data.analysis);
      setGeneratedAt(new Date());
    } catch (e: any) {
      toast({ title: "Feil", description: e.message || "Kunne ikke generere analyse", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const navigate = useNavigate();

  const parsedSections = useMemo(() => {
    if (!analysis) return [];
    // Split on numbered sections like "1. " "2. " etc
    const parts = analysis.split(/(?=\d\.\s)/);
    return parts
      .map((part) => {
        const match = part.match(/^\d\.\s*(.*)/s);
        if (!match) return null;
        const content = match[1].trim();
        // Extract emoji + title from first line
        const lines = content.split("\n");
        const headerLine = lines[0].replace(/^\*+|\*+$/g, "").trim();
        const body = lines.slice(1).join("\n").trim();
        // Detect section number
        const numMatch = part.match(/^(\d)\./);
        const sectionNum = numMatch ? parseInt(numMatch[1]) : 0;
        return { sectionNum, header: headerLine, body };
      })
      .filter(Boolean) as { sectionNum: number; header: string; body: string }[];
  }, [analysis]);

  const renderBold = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((p, i) => {
      if (p.startsWith("**") && p.endsWith("**")) {
        return <strong key={i} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>;
      }
      return <span key={i}>{p}</span>;
    });
  };

  const renderParagraphs = (body: string) => {
    const paragraphs = body.split(/\n\n+/).filter(Boolean);
    return paragraphs.map((p, i) => (
      <p key={i} className="text-[0.9375rem] leading-relaxed text-foreground/70">
        {renderBold(p.replace(/\n/g, " "))}
      </p>
    ));
  };

  const renderLeadsSection = (body: string) => {
    // Split into sub-cards per company lead (lines starting with - or • or **CompanyName**)
    const blocks: { title: string; desc: string }[] = [];
    const lines = body.split("\n").filter((l) => l.trim());
    let current: { title: string; desc: string } | null = null;

    for (const line of lines) {
      const leadMatch = line.match(/^[-•*]*\s*\*?\*?(.+?)\*?\*?\s*[·–—:]\s*(.*)/);
      const boldLeadMatch = line.match(/^\*\*(.+?)\*\*\s*[·–—:]\s*(.*)/);
      const bulletMatch = line.match(/^[-•]\s*\*?\*?(.+?)\*?\*?\s*$/);

      if (boldLeadMatch) {
        if (current) blocks.push(current);
        current = { title: boldLeadMatch[1].trim(), desc: boldLeadMatch[2].trim() };
      } else if (leadMatch && (line.startsWith("-") || line.startsWith("•") || line.startsWith("*"))) {
        if (current) blocks.push(current);
        current = { title: leadMatch[1].trim(), desc: leadMatch[2].trim() };
      } else if (current) {
        current.desc += " " + line.trim();
      } else {
        // Standalone line, create a block
        if (current) blocks.push(current);
        current = { title: "", desc: line.trim() };
      }
    }
    if (current) blocks.push(current);

    if (blocks.length === 0) return renderParagraphs(body);

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {blocks.map((b, i) => {
          const company = findCompany(b.title);
          return (
            <div
              key={i}
              className="rounded-lg border border-border bg-secondary/30 p-4 space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <span className="text-[1rem] font-bold text-foreground">{b.title || `Lead ${i + 1}`}</span>
              </div>
              {b.desc && (
                <p className="text-[0.875rem] leading-relaxed text-foreground/70">{renderBold(b.desc)}</p>
              )}
              {b.title && (
                <div className="pt-1">
                  {company ? (
                    <button
                      onClick={() => navigate(`/companies/${company.id}`)}
                      className="text-[0.8125rem] text-primary hover:underline"
                    >
                      Åpne i CRM →
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[0.75rem] text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--warning))]" />
                      Ikke i CRM
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderCRMChips = (body: string) => {
    // Extract company names from the body text
    const names = body
      .split(/[,\n•\-]/)
      .map((s) => s.replace(/\*\*/g, "").trim())
      .filter((s) => s.length > 1 && s.length < 60);

    if (names.length === 0) return renderParagraphs(body);

    return (
      <div className="flex flex-wrap gap-2">
        {names.map((name, i) => {
          const company = findCompany(name);
          return (
            <button
              key={i}
              onClick={() => {
                if (company) navigate(`/companies/${company.id}`);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors",
                company
                  ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                  : "border-border bg-secondary text-foreground hover:bg-accent"
              )}
            >
              {!company && <Plus className="h-3 w-3" />}
              {name}
            </button>
          );
        })}
      </div>
    );
  };

  const renderSection = (section: { sectionNum: number; header: string; body: string }) => {
    const isLeads = section.sectionNum === 2;
    const isCRM = section.sectionNum === 5;

    return (
      <Card key={section.sectionNum} className="overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <h3 className="text-[1.0625rem] font-bold text-foreground">{section.header}</h3>
        </div>
        <CardContent className="pt-4 pb-5 space-y-3">
          {isLeads
            ? renderLeadsSection(section.body)
            : isCRM
              ? renderCRMChips(section.body)
              : renderParagraphs(section.body)}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center gap-4">
        <Button onClick={generateAnalysis} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Generer analyse
        </Button>
        {generatedAt && (
          <span className="text-[0.8125rem] text-muted-foreground">
            Sist generert: {format(generatedAt, "d. MMM yyyy HH:mm", { locale: nb })}
          </span>
        )}
      </div>

      {loading && (
        <Card>
          <CardContent className="py-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      {analysis && !loading && (
        <div className="space-y-4">
          {parsedSections.map((s) => renderSection(s))}
        </div>
      )}

      {!analysis && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-[0.9375rem] text-muted-foreground">
              Klikk "Generer analyse" for å få AI-drevet markedsinnsikt basert på Finn-data.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// IMPORT MODAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ImportModal({ open, onClose, refetch }: { open: boolean; onClose: () => void; refetch: () => void }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<any>(null);
  const [fileName, setFileName] = useState("");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target!.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      // Map columns
      const mapped = json
        .map((r) => {
          const dato = excelDate(r["Dato"] || r["dato"]);
          const selskap = String(r["Selskap"] || r["selskap"] || "").trim();
          if (!dato || !selskap) return null;

          // Filter out Witted / STACQ
          const lower = selskap.toLowerCase();
          if (lower.includes("witted") || lower.includes("stacq")) return null;

          const d = parseISO(dato);
          return {
            dato,
            uke: getIsoWeekStr(d),
            selskap,
            stillingsrolle: String(r["Stillingsrolle"] || r["stillingsrolle"] || r["Rolle"] || r["rolle"] || "").trim() || null,
            lokasjon: String(r["Lokasjon"] || r["lokasjon"] || r["Sted"] || r["sted"] || "").trim() || null,
            teknologier: String(r["Teknologier"] || r["teknologier"] || "").trim() || null,
            lenke: String(r["Lenke"] || r["lenke"] || r["URL"] || r["url"] || "").trim() || null,
            kontaktnavn: String(r["Kontaktnavn"] || r["kontaktnavn"] || "").trim() || null,
            kontakt_epost: String(r["Kontakt epost"] || r["kontakt_epost"] || r["Kontakt_epost"] || "").trim() || null,
            kontakt_telefon: String(r["Kontakt telefon"] || r["kontakt_telefon"] || r["Kontakt_telefon"] || "").trim() || null,
          };
        })
        .filter(Boolean);

      setRows(mapped);
    };
    reader.readAsArrayBuffer(file);
  };

  const doImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      const { data, error } = await supabase
        .from("finn_annonser" as any)
        .upsert(rows as any, { onConflict: "dato,selskap,lenke", ignoreDuplicates: true });

      if (error) throw error;

      toast({ title: "Importert", description: `${rows.length} annonser behandlet.` });
      setRows([]);
      setFileName("");
      onClose();
      refetch();
    } catch (e: any) {
      toast({ title: "Feil", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importer Finn-annonser</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Input type="file" accept=".xlsx,.xls" onChange={handleFile} />
          {fileName && <p className="text-[0.8125rem] text-muted-foreground">{fileName} — {rows.length} rader</p>}

          {rows.length > 0 && (
            <div className="max-h-[300px] overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[0.6875rem]">DATO</TableHead>
                    <TableHead className="text-[0.6875rem]">SELSKAP</TableHead>
                    <TableHead className="text-[0.6875rem]">ROLLE</TableHead>
                    <TableHead className="text-[0.6875rem]">LOKASJON</TableHead>
                    <TableHead className="text-[0.6875rem]">TEKNOLOGIER</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 10).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-[0.8125rem]">{r.dato}</TableCell>
                      <TableCell className="text-[0.8125rem]">{r.selskap}</TableCell>
                      <TableCell className="text-[0.8125rem]">{r.stillingsrolle}</TableCell>
                      <TableCell className="text-[0.8125rem]">{r.lokasjon}</TableCell>
                      <TableCell className="text-[0.8125rem]">{r.teknologier}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 10 && (
                <p className="text-[0.75rem] text-muted-foreground text-center py-2">...og {rows.length - 10} rader til</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Avbryt</Button>
          <Button onClick={doImport} disabled={rows.length === 0 || importing}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Importer {rows.length} rader
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Helper: Excel date parsing ──
function excelDate(val: any): string | null {
  if (!val) return null;
  if (typeof val === "number") {
    // Excel serial date
    const d = new Date((val - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  // Try ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Try dd.mm.yyyy
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}
