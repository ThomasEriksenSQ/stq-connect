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

type Row = Record<string, string>;

function readXlsxAsObjects(file: File, requiredColumn: string): Promise<{ headers: string[], rows: Row[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        // Find header row by looking for the required column name
        let headerIdx = -1;
        for (let i = 0; i < Math.min(rawRows.length, 30); i++) {
          const cells = rawRows[i]?.map((c: any) => String(c).trim()) || [];
          if (cells.includes(requiredColumn)) {
            headerIdx = i;
            break;
          }
        }

        if (headerIdx < 0) {
          console.error(`Header row with "${requiredColumn}" not found. First 15 rows:`, rawRows.slice(0, 15).map((r, i) => `Row ${i}: [${r?.map((c: any) => String(c).trim()).filter(Boolean).join(", ")}]`));
          resolve({ headers: [], rows: [] });
          return;
        }

        const headers = rawRows[headerIdx].map((h: any) => String(h).trim());
        console.log(`Found header at row ${headerIdx}:`, headers.filter(Boolean));
        
        const rows: Row[] = [];
        for (let i = headerIdx + 1; i < rawRows.length; i++) {
          const raw = rawRows[i];
          if (!raw || raw.every((c: any) => !String(c).trim())) continue;
          // Skip Salesforce summary/total rows
          const firstCell = String(raw[0] || "").trim().toLowerCase();
          if (firstCell === "total" || firstCell === "grand total") continue;
          const obj: Row = {};
          headers.forEach((h, idx) => {
            if (h) obj[h] = clean(raw[idx]);
          });
          rows.push(obj);
        }
        
        // Debug: log first 2 data rows
        if (rows.length > 0) console.log("Sample row 0:", JSON.stringify(rows[0]));
        if (rows.length > 1) console.log("Sample row 1:", JSON.stringify(rows[1]));
        
        resolve({ headers, rows });
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
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
      const { data: clearData, error: clearErr } = await supabase.functions.invoke("salesforce-import", {
        body: { type: "clear" },
      });
      if (clearErr) throw new Error("Feil ved sletting: " + clearErr.message);
      const del = clearData?.deleted || {};
      addLog(`✅ Slettet: ${del.activities || 0} aktiviteter, ${del.tasks || 0} oppgaver, ${del.contacts || 0} kontakter, ${del.companies || 0} selskaper`);
      setProgress(10);

      // Step 2: Parse & import companies
      addLog("Parser selskaper...");
      const accData = await readXlsxAsObjects(accountsFile, "Account Name");
      addLog(`  Funnet kolonner: ${accData.headers.filter(h => h).join(", ")}`);
      addLog(`  ${accData.rows.length} rader funnet`);

      const companies: any[] = [];
      const seen = new Set<string>();
      for (const r of accData.rows) {
        const name = r["Account Name"];
        if (!name || seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());
        companies.push({
          name,
          status: mapStatus(r["Type"] || ""),
          org_number: r["Organization number"] || null,
          website: cleanUrl(r["Website"] || ""),
          industry: r["Industry"] || null,
          notes: r["Description"] || null,
          created_by: getOwnerId(r["Account Owner"] || ""),
          owner_id: getOwnerId(r["Account Owner"] || ""),
          created_at: (parseDate(r["Created Date"] || "") || "2024-01-01") + "T00:00:00Z",
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
      const conData = await readXlsxAsObjects(contactsFile, "First Name");
      addLog(`  Funnet kolonner: ${conData.headers.filter(h => h).join(", ")}`);
      addLog(`  ${conData.rows.length} rader funnet`);

      // Build SF Account ID -> Account Name map from accounts file
      const accIdToName: Record<string, string> = {};
      for (const r of accData.rows) {
        const sfId = r["Account ID"];
        const name = r["Account Name"];
        if (sfId && name) accIdToName[sfId] = name;
      }

      const contactsFinal: any[] = [];
      const seenContacts = new Set<string>();
      for (const r of conData.rows) {
        const firstName = r["First Name"] || "";
        const lastName = r["Last Name"] || "";
        if (!firstName && !lastName) continue;
        const key = `${firstName}|${lastName}`.toLowerCase();
        if (seenContacts.has(key)) continue;
        seenContacts.add(key);

        const accountId = r["Account ID"] || "";
        const accountName = accIdToName[accountId] || null;

        // Map the ringeliste/cv columns - they use Norwegian headers
        const callListVal = r["Legg til ringeliste"] || r["call_list"] || "";
        const cvEmailVal = r["Motta CV på tilgjengelige konsulenter"] || r["cv_email"] || "";

        contactsFinal.push({
          first_name: firstName || "[ukjent]",
          last_name: lastName || "[ukjent]",
          email: r["Email"] || null,
          phone: r["Phone"] || null,
          title: r["Title"] || null,
          account_name: accountName,
          linkedin: cleanUrl(r["Linkedin"] || ""),
          notes: r["Description"] || null,
          call_list: callListVal.toUpperCase() === "TRUE",
          cv_email: cvEmailVal.toUpperCase() === "TRUE",
          created_by: getOwnerId(r["Contact Owner"] || ""),
          owner_id: getOwnerId(r["Contact Owner"] || ""),
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
      const actData = await readXlsxAsObjects(activitiesFile, "Subject");
      addLog(`  Funnet kolonner: ${actData.headers.filter(h => h).join(", ")}`);
      addLog(`  ${actData.rows.length} rader funnet`);

      const activities: any[] = [];
      const tasks: any[] = [];
      for (const r of actData.rows) {
        const subject = r["Subject"];
        if (!subject) continue;

        const taskSubtype = r["Task Subtype"] || "";
        const eventSubtype = r["Event Subtype"] || "";
        const desc = r["Description"] || r["Full Comments"] || null;
        const date = parseDate(r["Date"] || "");
        const status = r["Status"] || "";
        const firstName = r["First Name"] || "";
        const lastName = r["Last Name"] || "";
        const accountName = r["Account Name"] || null;
        const assignedTo = getOwnerId(r["Assigned"] || "");

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
          {accountsFile && <p className="text-xs text-muted-foreground">✓ {accountsFile.name}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">2. Contacts (kontakter)</label>
          <input type="file" accept=".xlsx" onChange={e => setContactsFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
          {contactsFile && <p className="text-xs text-muted-foreground">✓ {contactsFile.name}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">3. Activities/Tasks (den nye eksporten med Task Subtype)</label>
          <input type="file" accept=".xlsx" onChange={e => setActivitiesFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
          {activitiesFile && <p className="text-xs text-muted-foreground">✓ {activitiesFile.name}</p>}
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
