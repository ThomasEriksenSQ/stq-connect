import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import { nb } from "date-fns/locale";
import {
  Building2,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { findBestCompanyMatch } from "@/lib/companyMatch";
import {
  buildMarketRadar,
  getFinnAnnonseTechnologies,
  getIsoWeekStr,
  type FinnAnnonseInput,
  type RadarCompany,
  type RadarCompanyRef,
} from "@/lib/markedsradar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type FinnAnnonse = FinnAnnonseInput & {
  created_at: string | null;
};

type CompanyRef = RadarCompanyRef;
type FinnImportRow = {
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
};
type ProcessFinnImportResult = {
  uke?: string | null;
  annonser_behandlet: number;
  teknologier_array_fikset: number;
  selskaper_med_teknologier: number;
  dna_profiler_oppdatert: number;
  kontakter_oppdatert?: number;
  errors?: string[];
};
type MarkedsradarEmailResult = {
  success?: boolean;
  sent?: boolean;
  skipped?: boolean;
  reason?: string;
  latestWeek?: string | null;
};

const CHART_COLORS = ["#0f766e", "#2563eb", "#ea580c", "#7c3aed", "#db2777", "#65a30d"];

function trendTone(delta: number) {
  if (delta > 0) return "text-[hsl(var(--success))]";
  if (delta < 0) return "text-destructive";
  return "text-muted-foreground";
}

function techColor(index: number) {
  return CHART_COLORS[index % CHART_COLORS.length];
}

function companyRoute(company: CompanyRef | null) {
  return company ? `/selskaper/${company.id}` : null;
}

function createCompanyRoute(name: string) {
  return `/selskaper?ny=${encodeURIComponent(name)}`;
}

export default function Markedsradar() {
  const navigate = useNavigate();
  const [importOpen, setImportOpen] = useState(false);

  const { data: annonser = [], refetch } = useQuery({
    queryKey: ["finn_annonser"],
    queryFn: async () => {
      const { data, error } = await supabase.from("finn_annonser").select("*").order("dato", { ascending: false });
      if (error) throw error;
      return (data || []) as FinnAnnonse[];
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies_ref"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name, status");
      if (error) throw error;
      return (data || []) as CompanyRef[];
    },
  });

  const companyById = useMemo(
    () => new Map(companies.map((company) => [company.id, company])),
    [companies],
  );

  const findCompany = useCallback(
    (selskap: string | null) => {
      if (!selskap) return null;
      return findBestCompanyMatch(selskap, companies);
    },
    [companies],
  );

  const resolveCompanyForAd = useCallback(
    (annonse: FinnAnnonseInput) => {
      if (annonse.matched_company_id) {
        return companyById.get(annonse.matched_company_id) || findCompany(annonse.selskap);
      }

      return findCompany(annonse.selskap);
    },
    [companyById, findCompany],
  );

  const currentWeek = getIsoWeekStr(new Date());
  const market = useMemo(
    () => buildMarketRadar(annonser, currentWeek, resolveCompanyForAd),
    [annonser, currentWeek, resolveCompanyForAd],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[1.5rem] font-bold text-foreground">Markedsradar</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Handlingsrettet oversikt over Finn-importerte selskaper, teknologier og kontaktpunkter.
          </p>
        </div>
        <Button onClick={() => setImportOpen(true)} className="w-full gap-2 sm:w-auto">
          <Download className="h-4 w-4" />
          Importer uke
        </Button>
      </div>

      <Tabs defaultValue="radar">
        <TabsList className="h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="radar" className="flex-1 min-w-[110px] sm:flex-none">Radar</TabsTrigger>
          <TabsTrigger value="annonser" className="flex-1 min-w-[110px] sm:flex-none">Annonser</TabsTrigger>
          <TabsTrigger value="ai" className="flex-1 min-w-[110px] sm:flex-none">AI-analyse</TabsTrigger>
        </TabsList>

        <TabsContent value="radar">
          <RadarTab market={market} navigate={navigate} />
        </TabsContent>

        <TabsContent value="annonser">
          <AnnonserTab annonser={annonser} market={market} findCompany={findCompany} navigate={navigate} />
        </TabsContent>

        <TabsContent value="ai">
          <AIAnalyseTab annonser={annonser} market={market} currentWeek={currentWeek} findCompany={findCompany} />
        </TabsContent>
      </Tabs>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} refetch={refetch} />
    </div>
  );
}

function RadarTab({
  market,
  navigate,
}: {
  market: ReturnType<typeof buildMarketRadar>;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [crmFilter, setCrmFilter] = useState<"alle" | "crm" | "ikke_crm">("alle");
  const [techFilter, setTechFilter] = useState<string>("alle");

  const filteredCompanies = useMemo(() => {
    let rows = market.companies;
    if (crmFilter === "crm") rows = rows.filter((company) => company.inCrm);
    if (crmFilter === "ikke_crm") rows = rows.filter((company) => !company.inCrm);
    if (techFilter !== "alle") {
      rows = rows.filter((company) => company.technologyCounts.some((item) => item.name === techFilter));
    }
    return rows;
  }, [crmFilter, market.companies, techFilter]);

  const filteredCompanyKeys = new Set(filteredCompanies.map((company) => company.key));
  const visibleContacts = market.topContactOpportunities.filter((contact) =>
    filteredCompanyKeys.has(contact.companyKey),
  );
  const visibleNewCompanies = market.newCompaniesNotInCrm.filter((company) => filteredCompanyKeys.has(company.key));
  const visibleTechTrends =
    techFilter === "alle"
      ? market.technologyTrends.slice(0, 8)
      : market.technologyTrends.filter((trend) => trend.name === techFilter);
  const chartTechs = market.technologyOptions.slice(0, 5);
  const selectedTechCompanies = techFilter === "alle" ? [] : filteredCompanies.slice(0, 8);
  const totalContactable = market.companies.reduce(
    (sum, company) => sum + company.contacts.filter((contact) => contact.email || contact.phone).length,
    0,
  );

  return (
    <div className="space-y-6 mt-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Annonser denne uken" value={market.adsThisWeek} />
        <StatCard
          label="Endring fra forrige uke"
          value={`${market.weekDiff >= 0 ? "+" : ""}${market.weekDiff}`}
          color={market.weekDiff >= 0 ? "text-[hsl(var(--success))]" : "text-destructive"}
          sub={market.weekDiff >= 0 ? "opp" : "ned"}
        />
        <StatCard label="Unike selskaper (30d)" value={market.uniqueCompanies30d} />
        <StatCard label="Nye selskaper ikke i CRM" value={market.newCompaniesNotInCrm.length} />
      </div>

      <Card>
        <CardContent className="pt-5 pb-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">Filtre</p>
              <p className="text-[0.8125rem] text-muted-foreground">
                Viser {filteredCompanies.length} prioriterte selskaper
                {techFilter !== "alle" ? ` for ${techFilter}` : ""}.
              </p>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {(["alle", "crm", "ikke_crm"] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setCrmFilter(value)}
                  className={cn(
                    "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors",
                    crmFilter === value
                      ? "bg-primary/10 border-primary/30 text-primary font-medium"
                      : "border-border text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {value === "alle" ? "Alle" : value === "crm" ? "I CRM" : "Ikke i CRM"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setTechFilter("alle")}
              className={cn(
                "h-7 px-2.5 text-[0.75rem] rounded-full border transition-colors",
                techFilter === "alle"
                  ? "bg-foreground text-background border-foreground font-medium"
                  : "border-border text-muted-foreground hover:bg-secondary",
              )}
            >
              Alle teknologier
            </button>
            {market.technologyOptions.map((tech) => (
              <button
                key={tech}
                onClick={() => setTechFilter((current) => (current === tech ? "alle" : tech))}
                className={cn(
                  "h-7 px-2.5 text-[0.75rem] rounded-full border transition-colors",
                  techFilter === tech
                    ? "bg-primary/10 border-primary/30 text-primary font-medium"
                    : "border-border text-muted-foreground hover:bg-secondary",
                )}
              >
                {tech}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {techFilter !== "alle" && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-5 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-primary/70">
                  Valgt teknologi
                </p>
                <h2 className="text-[1.125rem] font-semibold text-foreground">{techFilter}</h2>
                <p className="text-[0.8125rem] text-muted-foreground">
                  {selectedTechCompanies.length} selskaper i visningen matcher dette signalet akkurat nå.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedTechCompanies.slice(0, 5).map((company) => (
                  <button
                    key={company.key}
                    onClick={() =>
                      navigate(company.company ? companyRoute(company.company)! : createCompanyRoute(company.name))
                    }
                    className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-background px-3 py-1.5 text-[0.75rem] text-foreground hover:bg-secondary"
                  >
                    {!company.inCrm && <Plus className="h-3 w-3" />}
                    {company.name}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-4 w-4 text-primary" />
              <div>
                <p className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Opprett i CRM
                </p>
                <p className="text-[0.8125rem] text-muted-foreground">Selskaper som ikke finnes i dag.</p>
              </div>
            </div>
            <div className="divide-y divide-border">
              {visibleNewCompanies.slice(0, 9).map((company) => (
                <div key={company.key} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <p className="text-[0.875rem] font-medium text-foreground">{company.name}</p>
                      <p className="text-[0.75rem] text-muted-foreground truncate">
                        {company.adCount} annonser · {company.topTechnologies.slice(0, 3).join(", ") || "Ingen teknologi tolket"}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(createCompanyRoute(company.name))}
                    className="gap-1.5 shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Opprett
                  </Button>
                </div>
              ))}
              {visibleNewCompanies.length === 0 && (
                <p className="text-[0.8125rem] text-muted-foreground">Ingen nye selskaper i dette utvalget.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-4 w-4 text-primary" />
              <div>
                <p className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Kontaktpersoner
                </p>
                <p className="text-[0.8125rem] text-muted-foreground">De mest nyttige direkte kontaktpunktene.</p>
              </div>
            </div>
            <div className="divide-y divide-border">
              {visibleContacts.slice(0, 9).map((contact) => (
                <div key={contact.key} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[0.875rem] font-medium text-foreground">{contact.name || "Kontaktperson"}</p>
                        {contact.role && <span className="text-[0.75rem] text-muted-foreground">· {contact.role}</span>}
                      </div>
                      <button
                        onClick={() =>
                          navigate(
                            contact.company ? companyRoute(contact.company)! : createCompanyRoute(contact.companyName),
                          )
                        }
                        className="text-[0.75rem] text-primary hover:underline"
                      >
                        {contact.companyName}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    {contact.phone && (
                      <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1.5 text-[0.75rem] text-foreground hover:text-primary">
                        <Phone className="h-3.5 w-3.5" />
                        {contact.phone}
                      </a>
                    )}
                    {contact.email && (
                      <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1.5 text-[0.75rem] text-foreground hover:text-primary">
                        <Mail className="h-3.5 w-3.5" />
                        {contact.email}
                      </a>
                    )}
                    <Badge variant="outline">{contact.adCount} treff</Badge>
                  </div>
                </div>
              ))}
              {visibleContacts.length === 0 && (
                <p className="text-[0.8125rem] text-muted-foreground">
                  Ingen kontaktpunkter med telefon eller e-post i dette utvalget.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-4 w-4 text-primary" />
              <div>
                <p className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Teknologier i vekst
                </p>
                <p className="text-[0.8125rem] text-muted-foreground">Siste 30 dager sammenlignet med forrige 30.</p>
              </div>
            </div>
            <div className="divide-y divide-border">
              {visibleTechTrends.slice(0, 9).map((trend) => (
                <div key={trend.name} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button
                      onClick={() => setTechFilter(trend.name)}
                      className="text-[0.875rem] font-medium text-foreground hover:text-primary shrink-0"
                    >
                      {trend.name}
                    </button>
                    <span className="text-[0.75rem] text-muted-foreground">{trend.current} annonser</span>
                    {trend.companies.length > 0 && (
                      <span className="text-[0.75rem] text-muted-foreground truncate hidden sm:inline">{trend.companies.join(" · ")}</span>
                    )}
                  </div>
                  <span className={cn("text-[0.75rem] font-medium shrink-0", trendTone(trend.delta))}>
                    {trend.momentumLabel}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="mb-4">
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Teknologitrender over tid
              </p>
              <p className="text-[0.8125rem] text-muted-foreground">De mest synlige teknologisignalene i datasettet.</p>
            </div>
            {market.weeklyTechSeries.length === 0 || chartTechs.length === 0 ? (
              <p className="text-[0.8125rem] text-muted-foreground py-10 text-center">
                Ikke nok data til å tegne trendgraf ennå.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={market.weeklyTechSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="uke" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <ReTooltip />
                  <Legend />
                  {chartTechs.map((tech, index) => (
                    <Line
                      key={tech}
                      type="monotone"
                      dataKey={tech}
                      stroke={techColor(index)}
                      strokeWidth={2.25}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="mb-4">
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Selskaper med sterkest signal
              </p>
              <p className="text-[0.8125rem] text-muted-foreground">
                Rangert etter annonsefrekvens, tilgjengelig kontaktinfo og relevante teknologier.
              </p>
            </div>
            {filteredCompanies.length === 0 ? (
              <p className="text-[0.8125rem] text-muted-foreground py-10 text-center">
                Ingen selskaper matcher filteret.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {filteredCompanies.slice(0, 8).map((company, index) => {
                  const maxScore = filteredCompanies[0]?.score || 1;
                  const pct = Math.round((company.score / maxScore) * 100);
                  return (
                    <div key={company.key} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <span className="text-[0.8125rem] font-bold text-muted-foreground mt-0.5 shrink-0 w-5 text-right">
                            {index + 1}.
                          </span>
                          <div className="min-w-0 flex-1">
                            <button
                              onClick={() => {
                                if (company.company) {
                                  navigate(`/companies/${company.company.id}`);
                                }
                              }}
                              className="text-[0.9375rem] font-bold text-foreground hover:text-primary transition-colors text-left truncate max-w-full block"
                            >
                              {company.name}
                            </button>
                            <div className="mt-1 h-1.5 w-full rounded-full bg-primary/10">
                              <div
                                className="h-full rounded-full bg-primary/60 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                              {company.topTechnologies.slice(0, 3).map((tech) => (
                                <span key={tech} className="text-[0.75rem] text-muted-foreground">
                                  {tech}
                                </span>
                              ))}
                              {company.contactableNow && (
                                <span className="text-[0.75rem] text-primary font-medium">
                                  {company.contacts.length} kontakt{company.contacts.length !== 1 ? "er" : ""}
                                </span>
                              )}
                              {!company.inCrm && (
                                <span className="text-[0.75rem] text-destructive font-medium">Ikke i CRM</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0 text-right">
                          <span className="text-[0.8125rem] font-medium text-foreground">
                            {company.adCount} annonser
                          </span>
                          {company.currentWeekCount > 0 && (
                            <span className="text-[0.75rem] text-primary font-medium">
                              {company.currentWeekCount} denne uken
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-5 pb-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Prioriterte selskaper
              </p>
              <p className="text-[0.8125rem] text-muted-foreground">Klare neste steg for salg og oppfølging.</p>
            </div>
            <Badge variant="outline">{filteredCompanies.length} selskaper</Badge>
          </div>

          <div className="space-y-3">
            {filteredCompanies.slice(0, 14).map((company) => (
              <PriorityCompanyCard key={company.key} company={company} navigate={navigate} />
            ))}
            {filteredCompanies.length === 0 && (
              <p className="text-[0.8125rem] text-muted-foreground py-8 text-center">
                Ingen selskaper matcher dagens filter.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PriorityCompanyCard({
  company,
  navigate,
}: {
  company: RadarCompany;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const bestContact = company.contacts[0];
  const actionText =
    company.primaryAction === "create_company"
      ? "Opprett selskap"
      : company.primaryAction === "contact"
        ? "Åpne selskap"
        : "Åpne CRM";

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() =>
                navigate(company.company ? companyRoute(company.company)! : createCompanyRoute(company.name))
              }
              className="text-[1rem] font-semibold text-foreground hover:text-primary text-left"
            >
              {company.name}
            </button>
            <Badge variant={company.inCrm ? "secondary" : "outline"}>{company.inCrm ? "I CRM" : "Ikke i CRM"}</Badge>
            <Badge variant="outline">{company.adCount} annonser</Badge>
            {company.currentWeekCount > 0 && <Badge variant="outline">{company.currentWeekCount} denne uken</Badge>}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {company.topTechnologies.slice(0, 5).map((tech) => (
              <span
                key={tech}
                className="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-[0.6875rem] text-muted-foreground"
              >
                {tech}
              </span>
            ))}
          </div>

          <p className="text-[0.8125rem] text-muted-foreground">
            {[company.latestRole, company.locations[0], ...company.scoreReasons].filter(Boolean).join(" · ")}
          </p>

          {bestContact && (
            <div className="rounded-lg border border-border bg-secondary/25 p-3">
              <p className="text-[0.75rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Beste kontaktpunkt
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-[0.875rem] font-medium text-foreground">
                  {bestContact.name || "Kontaktperson"}
                </span>
                {bestContact.role && <span className="text-[0.75rem] text-muted-foreground">{bestContact.role}</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                {bestContact.phone && (
                  <a
                    href={`tel:${bestContact.phone}`}
                    className="inline-flex items-center gap-1.5 text-[0.75rem] text-foreground hover:text-primary"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {bestContact.phone}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            variant={company.primaryAction === "create_company" ? "default" : "outline"}
            onClick={() =>
              navigate(company.company ? companyRoute(company.company)! : createCompanyRoute(company.name))
            }
          >
            {actionText}
          </Button>
          {company.latestLink && (
            <Button variant="ghost" asChild>
              <a href={company.latestLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Annonse
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
        <p className={cn("text-[1.5rem] font-bold mt-1", color || "text-foreground")}>{value}</p>
        {sub && <p className="text-[0.75rem] text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function AnnonserTab({
  annonser,
  market,
  findCompany,
  navigate,
}: {
  annonser: FinnAnnonse[];
  market: ReturnType<typeof buildMarketRadar>;
  findCompany: (name: string | null) => CompanyRef | null;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [search, setSearch] = useState("");
  const [weekFilter, setWeekFilter] = useState<string>("alle");
  const [techFilters, setTechFilters] = useState<string[]>([]);
  const [crmFilter, setCrmFilter] = useState<"alle" | "crm" | "ikke_crm">("alle");
  const [page, setPage] = useState(0);
  const PER_PAGE = 25;

  const allWeeks = useMemo(() => {
    const weeks = [...new Set(annonser.map((ad) => ad.uke).filter(Boolean))] as string[];
    return weeks.sort().reverse();
  }, [annonser]);

  const filtered = useMemo(() => {
    let rows = annonser;

    if (search) {
      const query = search.toLowerCase();
      rows = rows.filter((row) =>
        [row.selskap, row.stillingsrolle, row.teknologier, row.kontaktnavn, row.kontakt_epost, row.kontakt_telefon]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query)),
      );
    }

    if (weekFilter !== "alle") rows = rows.filter((row) => row.uke === weekFilter);
    if (techFilters.length > 0) {
      rows = rows.filter((row) =>
        techFilters.some((tech) => getFinnAnnonseTechnologies(row).includes(tech)),
      );
    }
    if (crmFilter === "crm") rows = rows.filter((row) => findCompany(row.selskap));
    if (crmFilter === "ikke_crm") rows = rows.filter((row) => !findCompany(row.selskap));

    return rows;
  }, [annonser, crmFilter, findCompany, search, techFilters, weekFilter]);

  const paged = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full sm:max-w-xs sm:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Søk selskap, rolle, kontakt eller teknologi..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              className="pl-9"
            />
          </div>

          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-[0.8125rem] sm:w-auto"
            value={weekFilter}
            onChange={(event) => {
              setWeekFilter(event.target.value);
              setPage(0);
            }}
          >
            <option value="alle">Alle uker</option>
            {allWeeks.map((week) => (
              <option key={week} value={week}>
                {week}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 flex-wrap">
            {(["alle", "crm", "ikke_crm"] as const).map((value) => (
              <button
                key={value}
                onClick={() => {
                  setCrmFilter(value);
                  setPage(0);
                }}
                className={cn(
                  "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors",
                  crmFilter === value
                    ? "bg-primary/10 border-primary/30 text-primary font-medium"
                    : "border-border text-muted-foreground hover:bg-secondary",
                )}
              >
                {value === "alle" ? "Alle" : value === "crm" ? "I CRM" : "Ikke i CRM"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {market.technologyOptions.map((tech) => (
            <button
              key={tech}
              onClick={() => {
                setTechFilters((current) =>
                  current.includes(tech) ? current.filter((value) => value !== tech) : [...current, tech],
                );
                setPage(0);
              }}
              className={cn(
                "h-7 px-2.5 text-[0.75rem] rounded-full border transition-colors",
                techFilters.includes(tech)
                  ? "bg-primary/10 border-primary/30 text-primary font-medium"
                  : "border-border text-muted-foreground hover:bg-secondary",
              )}
            >
              {tech}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[0.8125rem] text-muted-foreground">{filtered.length} annonser</p>

      <div className="space-y-3 md:hidden">
        {paged.map((annonse) => {
          const company = findCompany(annonse.selskap);
          const technologies = getFinnAnnonseTechnologies(annonse);

          return (
            <Card key={annonse.id} className="shadow-card">
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-[0.75rem] text-muted-foreground">
                      {format(parseISO(annonse.dato), "d. MMM yyyy", { locale: nb })}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        className={cn(
                          "text-[0.9375rem] font-semibold text-left",
                          company ? "text-primary hover:underline" : "text-foreground",
                        )}
                        onClick={() =>
                          navigate(company ? companyRoute(company)! : createCompanyRoute(annonse.selskap || ""))
                        }
                      >
                        {annonse.selskap}
                      </button>
                      {!company && <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--warning))]" />}
                    </div>
                    {annonse.stillingsrolle && <p className="text-[0.8125rem] text-foreground">{annonse.stillingsrolle}</p>}
                    {annonse.lokasjon && <p className="text-[0.75rem] text-muted-foreground">{annonse.lokasjon}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        navigate(company ? companyRoute(company)! : createCompanyRoute(annonse.selskap || ""))
                      }
                    >
                      {company ? <Building2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </Button>
                    {annonse.lenke && (
                      <a href={annonse.lenke} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                    )}
                  </div>
                </div>

                {technologies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {technologies.slice(0, 4).map((technology) => (
                      <span
                        key={technology}
                        className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[0.6875rem] text-muted-foreground"
                      >
                        {technology}
                      </span>
                    ))}
                    {technologies.length > 4 && (
                      <span className="text-[0.6875rem] text-muted-foreground">+{technologies.length - 4} mer</span>
                    )}
                  </div>
                )}

                {annonse.kontaktnavn && (
                  <div className="space-y-1">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Kontakt</p>
                    <p className="text-[0.8125rem] text-foreground">{annonse.kontaktnavn}</p>
                    <div className="flex flex-wrap gap-3">
                      {annonse.kontakt_telefon && (
                        <a
                          href={`tel:${annonse.kontakt_telefon}`}
                          className="inline-flex items-center gap-1.5 text-[0.75rem] text-foreground hover:text-primary"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {annonse.kontakt_telefon}
                        </a>
                      )}
                      {annonse.kontakt_epost && (
                        <a
                          href={`mailto:${annonse.kontakt_epost}`}
                          className="inline-flex items-center gap-1.5 text-[0.75rem] text-foreground hover:text-primary"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {annonse.kontakt_epost}
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="hidden md:block shadow-card">
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
            {paged.map((annonse) => {
              const company = findCompany(annonse.selskap);
              const technologies = getFinnAnnonseTechnologies(annonse);

              return (
                <TableRow key={annonse.id} className="min-h-[44px]">
                  <TableCell className="text-[0.8125rem] text-muted-foreground whitespace-nowrap">
                    {format(parseISO(annonse.dato), "d. MMM yyyy", { locale: nb })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <button
                        className={cn(
                          "text-[0.8125rem] font-medium text-left",
                          company ? "text-primary hover:underline" : "text-foreground",
                        )}
                        onClick={() =>
                          navigate(company ? companyRoute(company)! : createCompanyRoute(annonse.selskap || ""))
                        }
                      >
                        {annonse.selskap}
                      </button>
                      {!company && <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--warning))]" />}
                    </div>
                  </TableCell>
                  <TableCell className="text-[0.8125rem]">{annonse.stillingsrolle}</TableCell>
                  <TableCell className="text-[0.8125rem] text-muted-foreground">{annonse.lokasjon}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {technologies.slice(0, 4).map((technology) => (
                        <span
                          key={technology}
                          className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[0.6875rem] text-muted-foreground"
                        >
                          {technology}
                        </span>
                      ))}
                      {technologies.length > 4 && (
                        <span className="text-[0.6875rem] text-muted-foreground">+{technologies.length - 4} mer</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {annonse.kontaktnavn ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="inline-flex items-center gap-1.5 text-[0.75rem] text-foreground hover:text-primary">
                            <Users className="h-3.5 w-3.5" />
                            {annonse.kontaktnavn}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{annonse.kontaktnavn}</p>
                          {annonse.kontakt_epost && <p className="text-[0.75rem]">{annonse.kontakt_epost}</p>}
                          {annonse.kontakt_telefon && <p className="text-[0.75rem]">{annonse.kontakt_telefon}</p>}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-[0.6875rem] text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          navigate(company ? companyRoute(company)! : createCompanyRoute(annonse.selskap || ""))
                        }
                      >
                        {company ? <Building2 className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      </Button>
                      {annonse.lenke && (
                        <a href={annonse.lenke} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
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

function AIAnalyseTab({
  annonser,
  market,
  currentWeek,
  findCompany,
}: {
  annonser: FinnAnnonse[];
  market: ReturnType<typeof buildMarketRadar>;
  currentWeek: string;
  findCompany: (name: string | null) => CompanyRef | null;
}) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const generateAnalysis = async () => {
    setLoading(true);
    try {
      const thisWeekRows =
        annonser
          .filter((annonse) => annonse.uke === currentWeek)
          .map((annonse) => {
            const parts = [
              annonse.selskap,
              annonse.stillingsrolle,
              getFinnAnnonseTechnologies(annonse).join(", "),
              annonse.kontaktnavn ? `Kontakt: ${annonse.kontaktnavn}` : null,
            ].filter(Boolean);
            return parts.join(" · ");
          })
          .join("\n") || "Ingen data denne uken";

      const techCounts = market.technologyTrends
        .slice(0, 10)
        .map((trend) => `${trend.name}: ${trend.current} siste 30d (${trend.momentumLabel})`)
        .join(", ");

      const topCompanies = market.topHiringCompanies
        .slice(0, 12)
        .map(
          (company) =>
            `${company.name}: ${company.adCount} annonser, ${company.topTechnologies.slice(0, 3).join("/") || "ingen tech"}${company.inCrm ? " [CRM]" : " [ikke CRM]"}`,
        )
        .join(", ");

      const notInCRM = market.newCompaniesNotInCrm
        .slice(0, 12)
        .map((company) => `${company.name} (${company.adCount} annonser)`)
        .join(", ");

      const { data, error } = await supabase.functions.invoke("markedsradar-analyse", {
        body: { currentWeek, thisWeekRows, techCounts, topCompanies, notInCRM },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAnalysis(data.analysis);
      setGeneratedAt(new Date());
    } catch (error: unknown) {
      toast({
        title: "Feil",
        description: error instanceof Error ? error.message : "Kunne ikke generere analyse",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const parsedSections = useMemo(() => {
    if (!analysis) return [];

    return analysis
      .split(/(?=\d\.\s)/)
      .map((part) => {
        const match = part.match(/^(\d)\.\s*(.*)/s);
        if (!match) return null;
        const sectionNum = Number(match[1]);
        const content = match[2].trim();
        const lines = content.split("\n");
        const header = lines[0].replace(/^\*+|\*+$/g, "").trim();
        const body = lines.slice(1).join("\n").trim();
        return { sectionNum, header, body };
      })
      .filter(Boolean) as Array<{ sectionNum: number; header: string; body: string }>;
  }, [analysis]);

  const renderBold = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={index} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const renderParagraphs = (body: string) => {
    return body
      .split(/\n\n+/)
      .filter(Boolean)
      .map((paragraph, index) => (
        <p key={index} className="text-[0.9375rem] leading-relaxed text-foreground/70">
          {renderBold(paragraph.replace(/\n/g, " "))}
        </p>
      ));
  };

  const renderLeadCards = (body: string) => {
    const lines = body
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const blocks: Array<{ title: string; description: string }> = [];
    let current: { title: string; description: string } | null = null;

    lines.forEach((line) => {
      const match = line.match(/^[-•*]*\s*\*?\*?(.+?)\*?\*?\s*[·–—:]\s*(.*)/);

      if (match) {
        if (current) blocks.push(current);
        current = { title: match[1].trim(), description: match[2].trim() };
        return;
      }

      if (!current) {
        current = { title: "", description: line };
        return;
      }

      current.description += ` ${line}`;
    });

    if (current) blocks.push(current);
    if (blocks.length === 0) return renderParagraphs(body);

    return (
      <div className="grid gap-3 md:grid-cols-2">
        {blocks.map((block, index) => {
          const company = findCompany(block.title);
          return (
            <div
              key={`${block.title}-${index}`}
              className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2"
            >
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="text-[1rem] font-semibold text-foreground">{block.title || `Lead ${index + 1}`}</span>
              </div>
              <p className="text-[0.875rem] leading-relaxed text-foreground/70">{renderBold(block.description)}</p>
              {block.title && (
                <Button
                  variant="ghost"
                  className="px-0 h-auto text-[0.8125rem] text-primary hover:text-primary"
                  onClick={() => navigate(company ? companyRoute(company)! : createCompanyRoute(block.title))}
                >
                  {company ? "Åpne i CRM" : "Opprett i CRM"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderCrmChips = (body: string) => {
    const names = [
      ...new Set(
        body
          .split(/[,\n•-]/)
          .map((name) => name.replace(/\*\*/g, "").trim())
          .filter((name) => name.length > 1 && name.length < 70),
      ),
    ];
    if (names.length === 0) return renderParagraphs(body);

    return (
      <div className="flex flex-wrap gap-2">
        {names.map((name) => {
          const company = findCompany(name);
          return (
            <button
              key={name}
              onClick={() => navigate(company ? companyRoute(company)! : createCompanyRoute(name))}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors",
                company
                  ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                  : "border-border bg-secondary text-foreground hover:bg-accent",
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

  return (
    <div className="space-y-6 mt-4">
      <div className="flex flex-wrap items-center gap-4">
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

      {!loading && analysis && (
        <div className="space-y-4">
          {parsedSections.map((section) => {
            const useLeads = section.sectionNum === 2;
            const useCrmChips = section.sectionNum === 5;

            return (
              <Card key={section.sectionNum} className="overflow-hidden">
                <div className="border-b border-border px-5 py-3">
                  <h3 className="text-[1.0625rem] font-bold text-foreground">{section.header}</h3>
                </div>
                <CardContent className="pt-4 pb-5 space-y-3">
                  {useLeads
                    ? renderLeadCards(section.body)
                    : useCrmChips
                      ? renderCrmChips(section.body)
                      : renderParagraphs(section.body)}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && !analysis && (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-[0.9375rem] text-muted-foreground">
              AI-oppsummeringen bruker de nye radarprioriteringene som input og peker ut hva STACQ bør handle på nå.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ImportModal({ open, onClose, refetch }: { open: boolean; onClose: () => void; refetch: () => void }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<FinnImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<ProcessFinnImportResult | null>(null);
  const [fileName, setFileName] = useState("");

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const data = new Uint8Array(loadEvent.target!.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });

      const mapped = json
        .map((row) => {
          const dato = excelDate(row["Dato"] || row["dato"]);
          const selskap = String(row["Selskap"] || row["selskap"] || "").trim();
          if (!dato || !selskap) return null;

          const lower = selskap.toLowerCase();
          if (lower.includes("witted") || lower.includes("stacq")) return null;

          return {
            dato,
            uke: getIsoWeekStr(parseISO(dato)),
            selskap,
            stillingsrolle:
              String(row["Stillingsrolle"] || row["stillingsrolle"] || row["Rolle"] || row["rolle"] || "").trim() ||
              null,
            lokasjon: String(row["Lokasjon"] || row["lokasjon"] || row["Sted"] || row["sted"] || "").trim() || null,
            teknologier: String(row["Teknologier"] || row["teknologier"] || "").trim() || null,
            lenke: String(row["Lenke"] || row["lenke"] || row["URL"] || row["url"] || "").trim() || null,
            kontaktnavn: String(row["Kontaktnavn"] || row["kontaktnavn"] || "").trim() || null,
            kontakt_epost:
              String(row["Kontakt epost"] || row["kontakt_epost"] || row["Kontakt_epost"] || "").trim() || null,
            kontakt_telefon:
              String(row["Kontakt telefon"] || row["kontakt_telefon"] || row["Kontakt_telefon"] || "").trim() || null,
          };
        })
        .filter(Boolean);

      setRows(mapped as FinnImportRow[]);
    };
    reader.readAsArrayBuffer(file);
  };

  const doImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      const importedWeeks = [...new Set(rows.map((row) => row.uke).filter(Boolean))] as string[];
      const { error } = await supabase.from("finn_annonser").upsert(rows, {
        onConflict: "dato,selskap,lenke",
        ignoreDuplicates: true,
      });

      if (error) throw error;

      let latestProcessResult: ProcessFinnImportResult | null = null;
      try {
        const { data: processData, error: processError } = await supabase.functions.invoke<ProcessFinnImportResult>(
          "process-finn-import",
          {
            body: importedWeeks.length > 0 ? { uker: importedWeeks } : {},
          },
        );
        if (processError) throw processError;
        latestProcessResult = processData || null;
        if (latestProcessResult) setProcessResult(latestProcessResult);
      } catch (processError) {
        console.error("process-finn-import after import failed", processError);
      }

      toast({
        title: "Importert",
        description: latestProcessResult?.uke
          ? `${rows.length} annonser behandlet for ${latestProcessResult.uke}.`
          : `${rows.length} annonser behandlet.`,
      });

      try {
        const { data: emailResult, error: emailError } = await supabase.functions.invoke<MarkedsradarEmailResult>(
          "markedsradar-ukesmail",
          {
            body: { source: "import" },
          },
        );
        if (emailError) throw emailError;
        if (emailResult?.sent) {
          toast({
            title: "Markedsradar sendt",
            description: emailResult.latestWeek
              ? `Ukentlig markedsradar ble sendt automatisk for ${emailResult.latestWeek}.`
              : "Ukentlig markedsradar ble sendt automatisk.",
          });
        }
      } catch (emailError) {
        console.error("markedsradar-ukesmail after import failed", emailError);
      }

      setRows([]);
      setFileName("");
      onClose();
      refetch();
    } catch (error: unknown) {
      toast({
        title: "Feil",
        description: error instanceof Error ? error.message : "Kunne ikke importere filen",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const doProcess = async () => {
    setProcessing(true);
    setProcessResult(null);
    try {
      const selectedWeeks = [...new Set(rows.map((row) => row.uke).filter(Boolean))] as string[];
      const { data, error } = await supabase.functions.invoke<ProcessFinnImportResult>("process-finn-import", {
        body: selectedWeeks.length > 0 ? { uker: selectedWeeks } : {},
      });
      if (error) throw error;
      if (!data) throw new Error("Ingen respons fra process-finn-import");
      setProcessResult(data);
      toast({
        title: "Prosessering fullført",
        description: data.uke
          ? `${data.uke}: ${data.teknologier_array_fikset} teknologier fikset, ${data.dna_profiler_oppdatert} DNA-profiler oppdatert`
          : `${data.teknologier_array_fikset} teknologier fikset, ${data.dna_profiler_oppdatert} DNA-profiler oppdatert`,
      });
      refetch();
    } catch (error: unknown) {
      toast({
        title: "Feil",
        description: error instanceof Error ? error.message : "Kunne ikke prosessere Finn-data",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importer Finn-annonser</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Input type="file" accept=".xlsx,.xls" onChange={handleFile} />
          {fileName && (
            <p className="text-[0.8125rem] text-muted-foreground">
              {fileName} - {rows.length} rader
            </p>
          )}

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
                  {rows.slice(0, 10).map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-[0.8125rem]">{row.dato}</TableCell>
                      <TableCell className="text-[0.8125rem]">{row.selskap}</TableCell>
                      <TableCell className="text-[0.8125rem]">{row.stillingsrolle}</TableCell>
                      <TableCell className="text-[0.8125rem]">{row.lokasjon}</TableCell>
                      <TableCell className="text-[0.8125rem]">{row.teknologier}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 10 && (
                <p className="text-[0.75rem] text-muted-foreground text-center py-2">
                  ...og {rows.length - 10} rader til
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2">
          {processResult && (
            <div className="w-full rounded-lg bg-muted px-4 py-3 text-[0.8125rem] space-y-1">
              <p className="font-medium text-foreground">Prosessering fullført</p>
              {processResult.uke && <p className="text-muted-foreground">Uke: {processResult.uke}</p>}
              <p className="text-muted-foreground">Behandlet: {processResult.annonser_behandlet} annonser</p>
              <p className="text-muted-foreground">Teknologier fikset: {processResult.teknologier_array_fikset}</p>
              <p className="text-muted-foreground">
                Selskaper med teknologier: {processResult.selskaper_med_teknologier}
              </p>
              <p className="text-muted-foreground">DNA-profiler oppdatert: {processResult.dna_profiler_oppdatert}</p>
              {typeof processResult.kontakter_oppdatert === "number" && (
                <p className="text-muted-foreground">Kontakter oppdatert: {processResult.kontakter_oppdatert}</p>
              )}
              {processResult.errors?.length > 0 && (
                <p className="text-destructive text-[0.75rem]">Feil: {processResult.errors.join(", ")}</p>
              )}
            </div>
          )}
          <div className="flex gap-2 w-full justify-end">
            <Button variant="outline" onClick={onClose}>
              Avbryt
            </Button>
            <Button onClick={doImport} disabled={rows.length === 0 || importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Importer {rows.length} rader
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function excelDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "number") {
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

  const match = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;

  return null;
}
