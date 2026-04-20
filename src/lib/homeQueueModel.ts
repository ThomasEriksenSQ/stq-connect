import { differenceInDays, isPast, isToday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { getEffectiveSignal } from "@/lib/categoryUtils";
import { getHeatResult, type HeatResult } from "@/lib/heatScore";

export interface HomeQueueLead {
  contactId: string;
  contactName: string;
  companyId: string | null;
  companyName: string;
  signal: string;
  daysSinceLastContact: number;
  hasOverdue: boolean;
  hasMarkedsradar: boolean;
  hasAktivForespørsel: boolean;
  hasTidligereForespørsel: boolean;
  isInnkjoper: boolean;
  heat: HeatResult;
  reasonLine: string;
  technologies: string[];
  ownerName: string | null;
  lastActivitySubject: string | null;
}

function buildReasonLine(lead: {
  signal: string;
  hasMarkedsradar: boolean;
  hasAktivForespørsel: boolean;
  hasTidligereForespørsel: boolean;
  hasOverdue: boolean;
  isInnkjoper: boolean;
  daysSinceLastContact: number;
}): string {
  const parts: string[] = [];
  if (lead.signal === "Behov nå" && lead.hasAktivForespørsel) parts.push("Aktiv forespørsel + behov nå");
  else if (lead.signal === "Behov nå") parts.push("Behov nå");
  else if (lead.signal === "Får fremtidig behov") parts.push("Fremtidig behov");
  else if (lead.signal === "Får kanskje behov") parts.push("Mulig behov");
  if (lead.hasMarkedsradar) parts.push("annonserer på Finn");
  if (lead.isInnkjoper) parts.push("innkjøper");
  if (lead.hasAktivForespørsel && !parts[0]?.includes("forespørsel")) parts.push("aktiv forespørsel");
  if (lead.hasOverdue) parts.push("forfalt oppfølging");
  else if (lead.daysSinceLastContact === 999) parts.push("aldri kontaktet");
  else if (lead.daysSinceLastContact > 90) parts.push(`${lead.daysSinceLastContact}d uten kontakt`);
  if (parts.length === 0) return "Ingen aktive signaler";
  const joined = parts.join(" · ");
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

export async function loadHomeQueueData(userId: string | null): Promise<HomeQueueLead[]> {
  let q = supabase
    .from("contacts")
    .select("*, companies(id, name), profiles:owner_id(full_name)")
    .or("ikke_aktuell_kontakt.is.null,ikke_aktuell_kontakt.eq.false");
  if (userId) q = q.eq("owner_id", userId);

  const { data: contacts } = await q.limit(500);
  if (!contacts || contacts.length === 0) return [];

  const contactIds = contacts.map((c: any) => c.id);
  const companyIds = Array.from(new Set(contacts.map((c: any) => c.company_id).filter(Boolean)));

  const [actsRes, tasksRes, techRes, foresRes] = await Promise.all([
    supabase
      .from("activities")
      .select("contact_id, created_at, subject, description, type")
      .in("contact_id", contactIds)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("tasks")
      .select("id, contact_id, created_at, updated_at, due_date, status, description, title")
      .in("contact_id", contactIds)
      .neq("status", "done")
      .limit(2000),
    companyIds.length > 0
      ? supabase
          .from("company_tech_profile")
          .select("company_id, sist_fra_finn, teknologier, konsulent_hyppighet")
          .in("company_id", companyIds)
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from("foresporsler")
      .select("id, selskap_id, status, mottatt_dato, teknologier")
      .not("status", "in", '("avsluttet","tapt")'),
  ]);

  const allActs = (actsRes.data || []) as any[];
  const allTasks = (tasksRes.data || []) as any[];
  const techProfiles = (techRes.data || []) as any[];
  const foresporsler = (foresRes.data || []) as any[];

  const leads: HomeQueueLead[] = contacts
    .map((contact: any): HomeQueueLead | null => {
      const cActs = allActs.filter((a) => a.contact_id === contact.id);
      const cTasks = allTasks.filter((t) => t.contact_id === contact.id);
      const signal = getEffectiveSignal(
        cActs.map((a) => ({ created_at: a.created_at, subject: a.subject, description: a.description })),
        cTasks.map((t) => ({
          created_at: t.created_at,
          title: t.title,
          description: t.description,
          due_date: t.due_date,
          status: t.status,
        })),
      );
      if (signal === "Ikke aktuelt") return null;

      const lastAct = cActs[0];
      const daysSince = lastAct ? differenceInDays(new Date(), new Date(lastAct.created_at)) : 999;
      const nextTask = cTasks.find((t: any) => t.due_date) ?? cTasks[0] ?? null;
      const hasOverdue = nextTask?.due_date
        ? isPast(new Date(nextTask.due_date)) && !isToday(new Date(nextTask.due_date))
        : false;
      const techProfile = techProfiles.find((tp) => tp.company_id === contact.company_id);
      const hasMarkedsradar = !!(
        techProfile?.sist_fra_finn &&
        differenceInDays(new Date(), new Date(techProfile.sist_fra_finn)) <= 90
      );
      const hasAktivForespørsel = foresporsler.some(
        (f) =>
          f.selskap_id === contact.company_id &&
          f.mottatt_dato &&
          differenceInDays(new Date(), new Date(f.mottatt_dato)) <= 45,
      );
      const hasTidligereForespørsel = foresporsler.some(
        (f) =>
          f.selskap_id === contact.company_id &&
          (!f.mottatt_dato || differenceInDays(new Date(), new Date(f.mottatt_dato)) > 45),
      );
      const isInnkjoper = !!contact.call_list;

      const heat = getHeatResult({
        signal,
        isInnkjoper,
        hasMarkedsradar,
        hasAktivForespørsel,
        hasOverdue,
        daysSinceLastContact: daysSince,
        hasTidligereForespørsel,
        ikkeAktuellKontakt: !!contact.ikke_aktuell_kontakt,
      });

      const reasonLine = buildReasonLine({
        signal,
        hasMarkedsradar,
        hasAktivForespørsel,
        hasTidligereForespørsel,
        hasOverdue,
        isInnkjoper,
        daysSinceLastContact: daysSince,
      });

      const techs: string[] = Array.isArray(contact.teknologier)
        ? contact.teknologier
        : techProfile?.teknologier
          ? Object.keys(techProfile.teknologier as Record<string, unknown>)
          : [];

      return {
        contactId: contact.id,
        contactName: `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Ukjent",
        companyId: contact.company_id,
        companyName: contact.companies?.name || "Ukjent selskap",
        signal,
        daysSinceLastContact: daysSince,
        hasOverdue,
        hasMarkedsradar,
        hasAktivForespørsel,
        hasTidligereForespørsel,
        isInnkjoper,
        heat,
        reasonLine,
        technologies: techs.slice(0, 4),
        ownerName: contact.profiles?.full_name || null,
        lastActivitySubject: lastAct?.subject || null,
      };
    })
    .filter((lead): lead is HomeQueueLead => lead !== null && lead.heat.score > -100)
    .sort((a, b) => b.heat.score - a.heat.score);

  return leads;
}

export function getTop10Leads(leads: HomeQueueLead[]): HomeQueueLead[] {
  return leads.slice(0, 10);
}
