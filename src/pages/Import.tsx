import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const THOMAS_ID = "877c63e8-a70c-4b78-9258-3dc8b1bf3c20";
const JR_ID = "451cb75f-685d-433d-83f0-bb24941ff2a4";

function getOwnerId(name: string): string {
  if (!name) return THOMAS_ID;
  if (name.includes("Jon Richard") || name === "JR") return JR_ID;
  return THOMAS_ID;
}

function parseDate(d: string): string | null {
  if (!d?.trim()) return null;
  const parts = d.trim().split(".");
  if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  return null;
}

function clean(t: any): string {
  if (t == null) return "";
  return String(t).replace(/\\/g, "").trim();
}

function cleanUrl(u: string): string | null {
  if (!u?.trim()) return null;
  let url = u.replace(/<|>/g, "").replace(/\[.*?\]\((.*?)\)/g, "$1").trim();
  if (url && !url.startsWith("http")) url = "https://" + url;
  return url || null;
}

function mapStatus(sfType: string): string {
  if (!sfType) return "active";
  const t = sfType.toLowerCase();
  if (t.includes("direktekunde")) return "kunde";
  if (t.includes("dps")) return "potensiell_kunde";
  if (t.includes("partner")) return "partner";
  if (t.includes("konsulentmegler")) return "konsulentmegler";
  return "active";
}

function readXlsx(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function findHeaderRow(rows: string[][], marker: string): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    if (rows[i]?.some(c => String(c).includes(marker))) return i;
  }
  return -1;
}

const Import = () => {
  const [accountsFile, setAccountsFile] = useState<File | null>(null);
  const [contactsFile, setContactsFile] = useState<File | null>(null);
  const [activitiesFile, setActivitiesFile] = useState<File | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => {
    setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50);
  };

  const runImport = async () => {
    if (!accountsFile || !contactsFile || !activitiesFile) {
      toast.error("Last opp alle 3 filene først");
      return;
    }
    setRunning(true);
    setLog([]);
    setProgress(0);

    try {
      // Step 1: Clear all data
      addLog("Sletter eksisterende data...");
      const { error: clearErr } = await supabase.functions.invoke("salesforce-import", {
        body: { type: "clear" },
      });
      if (clearErr) throw new Error("Feil ved sletting: " + clearErr.message);
      addLog("✅ Data slettet");
      setProgress(10);

      // Step 2: Parse & import companies
      addLog("Parser selskaper...");
      const accRows = await readXlsx(accountsFile);
      const accHeader = findHeaderRow(accRows, "Account Name");
      if (accHeader < 0) throw new Error("Fant ikke header-rad i accounts-filen");

      const companies: any[] = [];
      const seen = new Set<string>();
      for (let i = accHeader + 1; i < accRows.length; i++) {
        const c = accRows[i];
        const name = clean(c[3]);
        if (!name || seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());
        companies.push({
          name,
          status: mapStatus(clean(c[4])),
          org_number: clean(c[7]) || null,
          website: cleanUrl(clean(c[8])),
          industry: clean(c[9]) || null,
          notes: clean(c[12]) || null,
          created_by: getOwnerId(clean(c[2])),
          owner_id: getOwnerId(clean(c[2])),
          created_at: (parseDate(clean(c[10])) || "2024-01-01") + "T00:00:00Z",
        });
      }
      addLog(`Sender ${companies.length} selskaper...`);
      const { data: compRes, error: compErr } = await supabase.functions.invoke("salesforce-import", {
        body: { type: "companies", records: companies },
      });
      if (compErr) throw new Error("Feil ved import av selskaper: " + compErr.message);
      addLog(`✅ ${compRes?.inserted || 0} selskaper importert`);
      setProgress(30);

      // Step 3: Parse & import contacts
      addLog("Parser kontakter...");
      const conRows = await readXlsx(contactsFile);
      const conHeader = findHeaderRow(conRows, "First Name");
      if (conHeader < 0) throw new Error("Fant ikke header-rad i contacts-filen");

      const contacts: any[] = [];
      const seenContacts = new Set<string>();
      for (let i = conHeader + 1; i < conRows.length; i++) {
        const c = conRows[i];
        const firstName = clean(c[5]);
        const lastName = clean(c[6]);
        if (!firstName && !lastName) continue;
        const key = `${firstName}|${lastName}`.toLowerCase();
        if (seenContacts.has(key)) continue;
        seenContacts.add(key);

        contacts.push({
          first_name: firstName || "[ukjent]",
          last_name: lastName || "[ukjent]",
          email: clean(c[7]) || null,
          phone: clean(c[8]) || null,
          title: clean(c[9]) || null,
          account_name: clean(c[3] ? "" : ""), // Account name is matched via Account ID -> accounts file
          linkedin: cleanUrl(clean(c[14])),
          notes: clean(c[17]) || null,
          call_list: clean(c[2]).toUpperCase() === "TRUE",
          cv_email: clean(c[3]).toUpperCase() === "TRUE",
          created_by: getOwnerId(clean(c[15])),
          owner_id: getOwnerId(clean(c[15])),
        });
      }

      // We need to match contacts to companies by Account ID -> Account Name
      // The contacts file has Account ID at index 13, accounts file maps Account ID -> Account Name
      // Build account ID -> name map from accounts file
      const accIdToName: Record<string, string> = {};
      for (let i = accHeader + 1; i < accRows.length; i++) {
        const sfId = clean(accRows[i][6]);
        const name = clean(accRows[i][3]);
        if (sfId && name) accIdToName[sfId] = name;
      }

      // Now re-parse contacts with proper account_name
      const contactsFinal: any[] = [];
      const seenContacts2 = new Set<string>();
      for (let i = conHeader + 1; i < conRows.length; i++) {
        const c = conRows[i];
        const firstName = clean(c[5]);
        const lastName = clean(c[6]);
        if (!firstName && !lastName) continue;
        const key = `${firstName}|${lastName}`.toLowerCase();
        if (seenContacts2.has(key)) continue;
        seenContacts2.add(key);

        const accountId = clean(c[13]);
        const accountName = accIdToName[accountId] || null;

        contactsFinal.push({
          first_name: firstName || "[ukjent]",
          last_name: lastName || "[ukjent]",
          email: clean(c[7]) || null,
          phone: clean(c[8]) || null,
          title: clean(c[9]) || null,
          account_name: accountName,
          linkedin: cleanUrl(clean(c[14])),
          notes: clean(c[17]) || null,
          call_list: clean(c[2]).toUpperCase() === "TRUE",
          cv_email: clean(c[3]).toUpperCase() === "TRUE",
          created_by: getOwnerId(clean(c[15])),
          owner_id: getOwnerId(clean(c[15])),
        });
      }

      addLog(`Sender ${contactsFinal.length} kontakter...`);
      const { data: conRes, error: conErr } = await supabase.functions.invoke("salesforce-import", {
        body: { type: "contacts", records: contactsFinal },
      });
      if (conErr) throw new Error("Feil ved import av kontakter: " + conErr.message);
      addLog(`✅ ${conRes?.inserted || 0} kontakter importert`);
      setProgress(60);

      // Step 4: Parse & import activities/tasks
      addLog("Parser aktiviteter og oppgaver...");
      const actRows = await readXlsx(activitiesFile);
      const actHeader = findHeaderRow(actRows, "Subject");
      if (actHeader < 0) throw new Error("Fant ikke header-rad i activities-filen");

      const activities: any[] = [];
      const tasks: any[] = [];
      for (let i = actHeader + 1; i < actRows.length; i++) {
        const c = actRows[i];
        const subject = clean(c[0]);
        if (!subject) continue;

        const taskSubtype = clean(c[11]);
        const eventSubtype = clean(c[12]);
        const desc = clean(c[3]) || clean(c[4]) || null;
        const date = parseDate(clean(c[5]));
        const status = clean(c[6]);
        const firstName = clean(c[7]);
        const lastName = clean(c[8]);
        const accountName = clean(c[9]) || null;
        const assignedTo = getOwnerId(clean(c[10]));

        if (taskSubtype === "Task") {
          tasks.push({
            title: subject,
            description: desc,
            status: status.includes("Ferdig") ? "completed" : "open",
            priority: "medium",
            due_date: date,
            completed_at: status.includes("Ferdig") && date ? date + "T00:00:00Z" : null,
            created_at: (date || "2024-01-01") + "T00:00:00Z",
            contact_name: firstName && lastName ? `${firstName}|${lastName}` : null,
            account_name: accountName,
            assigned_to: assignedTo,
            created_by: assignedTo,
          });
        } else {
          // Call, Event, or other -> activities table
          let actType = "note";
          if (taskSubtype === "Call") actType = "call";
          else if (eventSubtype === "Event") actType = "meeting";

          activities.push({
            subject,
            type: actType,
            description: desc,
            created_at: (date || "2024-01-01") + "T00:00:00Z",
            contact_name: firstName && lastName ? `${firstName}|${lastName}` : null,
            account_name: accountName,
            created_by: assignedTo,
          });
        }
      }

      addLog(`Sender ${activities.length} aktiviteter...`);
      const { data: actRes, error: actErr } = await supabase.functions.invoke("salesforce-import", {
        body: { type: "activities", records: activities },
      });
      if (actErr) throw new Error("Feil ved import av aktiviteter: " + actErr.message);
      addLog(`✅ ${actRes?.inserted || 0} aktiviteter importert`);
      setProgress(80);

      addLog(`Sender ${tasks.length} oppgaver...`);
      const { data: taskRes, error: taskErr } = await supabase.functions.invoke("salesforce-import", {
        body: { type: "tasks", records: tasks },
      });
      if (taskErr) throw new Error("Feil ved import av oppgaver: " + taskErr.message);
      addLog(`✅ ${taskRes?.inserted || 0} oppgaver importert`);
      setProgress(100);

      addLog("🎉 Import fullført!");
      toast.success("Import fullført!");
    } catch (err: any) {
      addLog(`❌ Feil: ${err.message}`);
      toast.error(err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 p-8">
      <h1 className="text-2xl font-bold">Salesforce Re-import</h1>
      <p className="text-muted-foreground">
        Last opp 3 Excel-filer fra Salesforce. All eksisterende data slettes og erstattes.
      </p>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">1. Accounts (selskaper)</label>
          <input type="file" accept=".xlsx" onChange={e => setAccountsFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
          {accountsFile && <p className="text-xs text-green-600">✓ {accountsFile.name}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">2. Contacts (kontakter)</label>
          <input type="file" accept=".xlsx" onChange={e => setContactsFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
          {contactsFile && <p className="text-xs text-green-600">✓ {contactsFile.name}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">3. Activities/Tasks (den nye eksporten med Task Subtype)</label>
          <input type="file" accept=".xlsx" onChange={e => setActivitiesFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
          {activitiesFile && <p className="text-xs text-green-600">✓ {activitiesFile.name}</p>}
        </div>
      </div>

      {progress > 0 && <Progress value={progress} className="h-2" />}

      <Button onClick={runImport} disabled={running || !accountsFile || !contactsFile || !activitiesFile} size="lg">
        {running ? "Importerer..." : "Start re-import"}
      </Button>

      {log.length > 0 && (
        <div ref={logRef} className="bg-muted rounded-xl p-4 max-h-80 overflow-y-auto font-mono text-xs space-y-1">
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
};

export default Import;
