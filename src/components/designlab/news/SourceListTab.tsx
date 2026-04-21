import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInDays } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { C } from "@/components/designlab/theme";
import { crmQueryKeys } from "@/lib/queryKeys";
import {
  getActivityStatus,
  getHeatResult,
  getTaskStatus,
} from "@/lib/heatScore";
import { getEffectiveSignal } from "@/lib/categoryUtils";
import {
  ensureHref,
  formatOrgNumber,
  prettyUrl,
  rankCompaniesFromContacts,
  type CompanyMeta,
  type RankInputContact,
  type RankedSourceCompany,
} from "@/lib/newsSourceCompanies";

interface ContactsFullData {
  contacts: Array<{
    id: string;
    company_id: string | null;
    call_list: boolean | null;
    ikke_aktuell_kontakt: boolean | null;
    companies: {
      id: string;
      name: string;
      status: string | null;
      ikke_relevant: boolean | null;
      org_number: string | null;
      website: string | null;
      linkedin: string | null;
    } | null;
  }>;
  acts: Array<{ contact_id: string | null; created_at: string; description: string | null; subject: string | null }>;
  tasks: Array<{
    contact_id: string | null;
    created_at: string;
    updated_at: string;
    due_date: string | null;
    status: string;
    description: string | null;
    title: string | null;
  }>;
  techProfiles: Array<{ company_id: string | null; sist_fra_finn: string | null }>;
  requests: Array<{ selskap_id: string | null; mottatt_dato: string; status: string | null }>;
}

async function fetchSourceData(): Promise<ContactsFullData> {
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select(
      "id, company_id, call_list, ikke_aktuell_kontakt, companies(id, name, status, ikke_relevant, org_number, website, linkedin)",
    )
    .limit(2000);
  if (error) throw error;

  const [{ data: acts }, { data: tasks }, { data: techProfiles }, { data: requests }] = await Promise.all([
    supabase
      .from("activities")
      .select("contact_id, created_at, description, subject")
      .not("contact_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("tasks")
      .select("contact_id, created_at, updated_at, due_date, status, description, title")
      .not("contact_id", "is", null)
      .limit(5000),
    supabase
      .from("company_tech_profile")
      .select("company_id, sist_fra_finn")
      .not("company_id", "is", null)
      .limit(5000),
    supabase
      .from("foresporsler")
      .select("selskap_id, mottatt_dato, status")
      .order("mottatt_dato", { ascending: false })
      .limit(5000),
  ]);

  return {
    contacts: (contacts ?? []) as ContactsFullData["contacts"],
    acts: (acts ?? []) as ContactsFullData["acts"],
    tasks: (tasks ?? []) as ContactsFullData["tasks"],
    techProfiles: (techProfiles ?? []) as ContactsFullData["techProfiles"],
    requests: (requests ?? []) as ContactsFullData["requests"],
  };
}

const ACTIVE_REQUEST_DAYS = 45;
function isActiveRequest(mottattDato: string, status: string | null): boolean {
  if (status && /vunnet|tapt|avslått|avslag/i.test(status)) return false;
  const days = differenceInDays(new Date(), new Date(mottattDato));
  return days <= ACTIVE_REQUEST_DAYS;
}

function buildRanked(data: ContactsFullData): RankedSourceCompany[] {
  // Per kontakt: nyeste aktivitet
  const lastActMap: Record<string, string> = {};
  const contactActsMap: Record<string, ContactsFullData["acts"]> = {};
  const contactTasksMap: Record<string, ContactsFullData["tasks"]> = {};
  const now = new Date().toISOString();
  for (const a of data.acts) {
    if (!a.contact_id) continue;
    if (a.created_at <= now && !lastActMap[a.contact_id]) lastActMap[a.contact_id] = a.created_at;
    if (!contactActsMap[a.contact_id]) contactActsMap[a.contact_id] = [];
    contactActsMap[a.contact_id]!.push(a);
  }
  for (const t of data.tasks) {
    if (!t.contact_id || t.status === "done") continue;
    if (!contactTasksMap[t.contact_id]) contactTasksMap[t.contact_id] = [];
    contactTasksMap[t.contact_id]!.push(t);
  }

  // Open task overdue per contact
  const today = new Date().toISOString().slice(0, 10);
  const openTasksMap: Record<string, { count: number; overdue: boolean }> = {};
  for (const t of data.tasks) {
    if (!t.contact_id || t.status !== "open") continue;
    const cur = openTasksMap[t.contact_id] ?? { count: 0, overdue: false };
    cur.count++;
    if (t.due_date && t.due_date < today) cur.overdue = true;
    openTasksMap[t.contact_id] = cur;
  }

  // Markedsradar (finn) per company
  const sistFraFinnByCompany = new Map<string, string>();
  for (const p of data.techProfiles) {
    if (p.company_id && p.sist_fra_finn) sistFraFinnByCompany.set(p.company_id, p.sist_fra_finn);
  }

  // Aktive forespørsler per company
  const activeRequestByCompany = new Map<string, boolean>();
  const anyRequestByCompany = new Map<string, boolean>();
  for (const r of data.requests) {
    if (!r.selskap_id) continue;
    anyRequestByCompany.set(r.selskap_id, true);
    if (isActiveRequest(r.mottatt_dato, r.status)) activeRequestByCompany.set(r.selskap_id, true);
  }

  const companyMetaList: CompanyMeta[] = [];
  const seenCompany = new Set<string>();
  for (const c of data.contacts) {
    if (!c.companies) continue;
    if (seenCompany.has(c.companies.id)) continue;
    seenCompany.add(c.companies.id);
    companyMetaList.push({
      id: c.companies.id,
      name: c.companies.name,
      org_number: c.companies.org_number,
      website: c.companies.website,
      linkedin: c.companies.linkedin,
      status: c.companies.status,
      ikke_relevant: c.companies.ikke_relevant,
    });
  }

  const inputs: RankInputContact[] = data.contacts.map((c) => {
    const lastActivity = lastActMap[c.id] || null;
    const sig = getEffectiveSignal(
      (contactActsMap[c.id] || []).map((a) => ({
        created_at: a.created_at,
        subject: a.subject || "",
        description: a.description,
      })),
      (contactTasksMap[c.id] || []).map((t) => ({
        created_at: t.created_at,
        updated_at: t.updated_at,
        title: t.title || "",
        description: t.description,
        due_date: t.due_date,
        status: t.status,
      })),
    );
    const openTasks = openTasksMap[c.id] || { count: 0, overdue: false };
    const daysSince = lastActivity ? differenceInDays(new Date(), new Date(lastActivity)) : 999;
    const sistFraFinn = c.company_id ? sistFraFinnByCompany.get(c.company_id) : null;
    const hasMarkedsradar = !!(sistFraFinn && differenceInDays(new Date(), new Date(sistFraFinn)) <= 90);
    const hasAktivForespørsel = !!(c.company_id && activeRequestByCompany.get(c.company_id));
    const hasTidligereForespørsel =
      !!(c.company_id && anyRequestByCompany.get(c.company_id)) && !hasAktivForespørsel;

    const contactActs = contactActsMap[c.id] || [];
    const signalAct = contactActs.find((a) => {
      const cat = a.subject || "";
      return ["Behov nå", "Får fremtidig behov", "Får kanskje behov", "Ukjent om behov", "Ikke aktuelt"].includes(cat);
    });
    const signalSetAt = signalAct ? new Date(signalAct.created_at) : null;
    const lastActDate = lastActivity ? new Date(lastActivity) : null;
    const kes = !!(signalSetAt && lastActDate && lastActDate > signalSetAt);

    const taskList = (contactTasksMap[c.id] || []).map((t) => ({ due_date: t.due_date, status: t.status }));
    const taskStatus = getTaskStatus(taskList);
    const activityStatus = getActivityStatus(daysSince);

    const heat = getHeatResult({
      signal: sig || "",
      isInnkjoper: !!c.call_list,
      hasMarkedsradar,
      hasAktivForespørsel,
      hasOverdue: openTasks.overdue,
      daysSinceLastContact: daysSince,
      hasTidligereForespørsel,
      ikkeAktuellKontakt: !!c.ikke_aktuell_kontakt,
      ikkeRelevantSelskap: !!c.companies?.ikke_relevant,
      taskStatus,
      activityStatus,
      kes,
    });

    return {
      companyId: c.company_id,
      heat,
      companyStatus: c.companies?.status ?? null,
      ikkeRelevantSelskap: !!c.companies?.ikke_relevant,
      ikkeAktuellKontakt: !!c.ikke_aktuell_kontakt,
    };
  });

  return rankCompaniesFromContacts(inputs, companyMetaList);
}

export function SourceListTab() {
  const query = useQuery({
    queryKey: ["news-source-companies"],
    queryFn: fetchSourceData,
    staleTime: 5 * 60_000,
  });

  const ranked = useMemo<RankedSourceCompany[]>(() => {
    if (!query.data) return [];
    return buildRanked(query.data);
  }, [query.data]);

  if (query.isLoading) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center", color: C.textMuted, fontSize: 13 }}>
        Laster kildeliste …
      </div>
    );
  }

  if (query.isError) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center", color: C.textMuted, fontSize: 13 }}>
        Kunne ikke laste kildelisten.
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 18,
          gap: 16,
        }}
      >
        <p style={{ fontSize: 12, color: C.textMuted, margin: 0, lineHeight: 1.5 }}>
          Listen er sortert eksakt som Kontakter-siden — Potensiell kunde og Kunde, deduplisert per selskap.
        </p>
        <span style={{ fontSize: 12, color: C.textFaint, whiteSpace: "nowrap" }}>
          {ranked.length} {ranked.length === 1 ? "selskap" : "selskaper"}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "40px minmax(200px, 1.4fr) 130px minmax(180px, 1fr) 80px",
          gap: 16,
          padding: "10px 0",
          borderBottom: `1px solid ${C.border}`,
          fontSize: 11,
          color: C.textFaint,
          fontWeight: 500,
        }}
      >
        <span style={{ textAlign: "right" }}>#</span>
        <span>Selskap</span>
        <span>Org.nr</span>
        <span>Nettsted</span>
        <span>LinkedIn</span>
      </div>

      {ranked.length === 0 ? (
        <div style={{ padding: "60px 0", textAlign: "center", color: C.textMuted, fontSize: 13 }}>
          Ingen selskaper med status Potensiell kunde eller Kunde.
        </div>
      ) : (
        <>
          {ranked.map((row) => <SourceRow key={row.companyId} row={row} />)}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
            <button
              type="button"
              onClick={() => downloadCsv(ranked)}
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: C.text,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 5,
                padding: "7px 12px",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = C.hoverBg;
                e.currentTarget.style.borderColor = C.borderStrong;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = C.surface;
                e.currentTarget.style.borderColor = C.border;
              }}
            >
              Last ned som CSV ↓
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function csvEscape(value: string | null | undefined): string {
  const v = value ?? "";
  if (/[",\n;]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function downloadCsv(rows: RankedSourceCompany[]): void {
  const header = ["Rangering", "Selskap", "Org.nr", "Nettsted", "LinkedIn"];
  const lines = [header.map(csvEscape).join(",")];
  for (const r of rows) {
    lines.push(
      [
        String(r.rank),
        csvEscape(r.name),
        csvEscape(formatOrgNumber(r.orgNumber) ?? ""),
        csvEscape(r.website ?? ""),
        csvEscape(r.linkedin ?? ""),
      ].join(","),
    );
  }
  const csv = "\uFEFF" + lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const today = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stacq-kildeliste-${today}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function SourceRow({ row }: { row: RankedSourceCompany }) {
  const websitePretty = prettyUrl(row.website);
  const websiteHref = ensureHref(row.website);
  const linkedinHref = ensureHref(row.linkedin);
  const orgFormatted = formatOrgNumber(row.orgNumber);
  const dash = <span style={{ color: C.textGhost }}>—</span>;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "40px minmax(200px, 1.4fr) 130px minmax(180px, 1fr) 80px",
        gap: 16,
        alignItems: "center",
        padding: "9px 0",
        borderBottom: `1px solid ${C.borderLight}`,
        transition: "background 120ms",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = C.hoverBg)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span
        style={{
          fontSize: 11,
          color: C.textFaint,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {row.rank}
      </span>
      <span style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {row.name}
      </span>
      <span style={{ fontSize: 12, color: C.textMuted, fontVariantNumeric: "tabular-nums" }}>
        {orgFormatted ?? dash}
      </span>
      <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {websiteHref && websitePretty ? (
          <a
            href={websiteHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: C.text, textDecoration: "none" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.accent)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.text)}
          >
            {websitePretty} →
          </a>
        ) : (
          dash
        )}
      </span>
      <span style={{ fontSize: 12 }}>
        {linkedinHref ? (
          <a
            href={linkedinHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: C.text, textDecoration: "none" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.accent)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.text)}
          >
            LinkedIn →
          </a>
        ) : (
          dash
        )}
      </span>
    </div>
  );
}
