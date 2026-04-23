import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import Papa from "papaparse";

const NULL_SF = "000000000000000AAA";

function sf(val: string | undefined | null): string | null {
  if (!val || val.trim() === "" || val === NULL_SF) return null;
  return val.trim();
}

function mapStatus(sfType: string | null): string {
  if (!sfType) return "active";
  const t = sfType.toLowerCase();
  if (t.includes("direktekunde")) return "kunde";
  if (t.includes("dps")) return "potensiell_kunde";
  if (t.includes("partner")) return "partner";
  if (t.includes("konsulentmegler")) return "konsulentmegler";
  return "active";
}

function cleanUrl(u: string | null): string | null {
  if (!u?.trim()) return null;
  let url = u.replace(/<|>/g, "").replace(/\[.*?\]\((.*?)\)/g, "$1").trim();
  if (url && !url.startsWith("http")) url = "https://" + url;
  return url || null;
}

function parseCsv(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      complete: (results) => resolve(results.data as Record<string, string>[]),
      error: (err: any) => reject(err),
    });
  });
}

function sfDate(d: string | null | undefined): string | null {
  if (!d?.trim()) return null;
  // Salesforce dates: "2024-01-15 00:00:00" or "2024-01-15"
  const match = d.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function sfDateTime(d: string | null | undefined): string | null {
  if (!d?.trim()) return null;
  const date = sfDate(d);
  if (!date) return null;
  const timeMatch = d.trim().match(/\d{4}-\d{2}-\d{2}\s+(\d{2}:\d{2}:\d{2})/);
  return timeMatch ? `${date}T${timeMatch[1]}Z` : `${date}T00:00:00Z`;
}

function inferActivityType(subject: string): string {
  const s = subject.toLowerCase();
  if (/telefon|ring|ringt|samtale/.test(s)) return "call";
  if (/e-?mail|epost|mail/.test(s)) return "email";
  if (/møte|lunch|kaffeprat|besøk/.test(s)) return "meeting";
  return "task";
}

const Import = () => {
  const [accountsFile, setAccountsFile] = useState<File | null>(null);
  const [contactsFile, setContactsFile] = useState<File | null>(null);
  const [tasksFile, setTasksFile] = useState<File | null>(null);
  const [eventsFile, setEventsFile] = useState<File | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => {
    setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50);
  };

  const runImport = async () => {
    if (!accountsFile || !contactsFile || !tasksFile || !eventsFile) {
      toast.error("Last opp alle 4 filene først");
      return;
    }
    setRunning(true);
    setLog([]);
    setProgress(0);

    try {
      // Step 1: Clear
      addLog("Sletter eksisterende data...");
      const { data: clearData, error: clearErr } = await supabase.functions.invoke("salesforce-import", {
        body: { type: "clear" },
      });
      if (clearErr) throw new Error("Feil ved sletting: " + clearErr.message);
      const del = clearData?.deleted || {};
      addLog(`✅ Slettet: ${del.activities || 0} aktiviteter, ${del.tasks || 0} oppgaver, ${del.contacts || 0} kontakter, ${del.companies || 0} selskaper`);
      setProgress(5);

      // Step 2: Parse all CSV files
      addLog("Parser CSV-filer...");
      const [accountRows, contactRows, taskRows, eventRows] = await Promise.all([
        parseCsv(accountsFile),
        parseCsv(contactsFile),
        parseCsv(tasksFile),
        parseCsv(eventsFile),
      ]);
      addLog(`Parset: ${accountRows.length} selskaper, ${contactRows.length} kontakter, ${taskRows.length} tasks, ${eventRows.length} events`);
      setProgress(10);

      // Step 3: Import companies
      addLog("Importerer selskaper...");
      const companies = accountRows
        .filter(r => r.Name?.trim())
        .map(r => ({
          sf_account_id: sf(r.Id),
          name: r.Name.trim(),
          status: mapStatus(r.Type),
          industry: sf(r.Industry),
          phone: sf(r.Phone),
          website: cleanUrl(r.Website),
          org_number: sf(r.Organization_number__c),
          sf_owner_id: sf(r.OwnerId),
          created_at: sfDateTime(r.CreatedDate) || "2024-01-01T00:00:00Z",
        }));

      const { data: compRes, error: compErr } = await supabase.functions.invoke("salesforce-import", {
        body: { type: "companies", records: companies },
      });
      if (compErr) throw new Error("Feil selskaper: " + compErr.message);
      addLog(`✅ ${compRes?.inserted || 0} selskaper importert`);
      setProgress(25);

      // Step 4: Import contacts
      addLog("Importerer kontakter...");
      const contacts = contactRows
        .filter(r => r.FirstName?.trim() || r.LastName?.trim())
        .map(r => ({
          sf_contact_id: sf(r.Id),
          sf_account_id: sf(r.AccountId),
          first_name: r.FirstName?.trim() || "[ukjent]",
          last_name: r.LastName?.trim() || "[ukjent]",
          email: sf(r.Email),
          phone: sf(r.MobilePhone) || sf(r.Phone),
          title: sf(r.Title),
          linkedin: cleanUrl(r.Linkedin__c),
          notes: sf(r.Description),
          sf_owner_id: sf(r.OwnerId),
          call_list: r.Ringeliste__c === "1",
          cv_email: r.send_partner_email__c === "1",
        }));

      const { data: conRes, error: conErr } = await supabase.functions.invoke("salesforce-import", {
        body: { type: "contacts", records: contacts },
      });
      if (conErr) throw new Error("Feil kontakter: " + conErr.message);
      addLog(`✅ ${conRes?.inserted || 0} kontakter importert`);
      setProgress(45);

      // Step 5: Import tasks and activities from Task.csv
      addLog("Prosesserer Task.csv...");
      const taskRecords: any[] = [];
      const activityRecordsFromTasks: any[] = [];

      for (const r of taskRows) {
        if (!r.Subject?.trim()) continue;
        const sfOwnerId = sf(r.OwnerId);
        const createdAt = sfDateTime(r.CreatedDate) || sfDateTime(r.ActivityDate) || "2024-01-01T00:00:00Z";
        const status = (r.Status || "").trim().toLowerCase();
        const isCompleted = status === "completed" || status === "ferdig utført" || r.IsClosed === "1";

        const base = {
          sf_activity_id: sf(r.Id),
          sf_who_id: sf(r.WhoId),
          sf_what_id: sf(r.WhatId),
          sf_account_id: sf(r.AccountId),
          sf_owner_id: sfOwnerId,
          subject: r.Subject.trim(),
          description: sf(r.Description),
          created_at: createdAt,
        };

        if (isCompleted) {
          activityRecordsFromTasks.push({ ...base, type: inferActivityType(base.subject) });
        } else {
          taskRecords.push({
            ...base,
            title: base.subject,
            status: "open",
            priority: (r.Priority || "Normal").toLowerCase() === "high" ? "high" : "medium",
            due_date: sfDate(r.ActivityDate),
            completed_at: null,
          });
        }
      }

      // Step 6: Import activities from Event.csv
      addLog("Prosesserer Event.csv...");
      const activityRecordsFromEvents: any[] = [];
      for (const r of eventRows) {
        if (!r.Subject?.trim()) continue;
        const sfOwnerId = sf(r.OwnerId);
        activityRecordsFromEvents.push({
          sf_activity_id: sf(r.Id),
          sf_who_id: sf(r.WhoId),
          sf_what_id: sf(r.WhatId),
          sf_account_id: sf(r.AccountId),
          sf_owner_id: sfOwnerId,
          subject: r.Subject.trim(),
          description: sf(r.Description),
          type: "meeting",
          created_at: sfDateTime(r.ActivityDateTime) || sfDateTime(r.ActivityDate) || sfDateTime(r.CreatedDate) || "2024-01-01T00:00:00Z",
        });
      }

      const allActivities = [...activityRecordsFromTasks, ...activityRecordsFromEvents];

      // Send activities
      addLog(`Sender ${allActivities.length} aktiviteter...`);
      const { data: actRes, error: actErr } = await supabase.functions.invoke("salesforce-import", {
        body: { type: "activities", records: allActivities },
      });
      if (actErr) throw new Error("Feil aktiviteter: " + actErr.message);
      addLog(`✅ ${actRes?.inserted || 0} aktiviteter importert`);
      setProgress(70);

      // Send tasks
      addLog(`Sender ${taskRecords.length} oppgaver...`);
      const { data: taskRes, error: taskErr } = await supabase.functions.invoke("salesforce-import", {
        body: { type: "tasks", records: taskRecords },
      });
      if (taskErr) throw new Error("Feil oppgaver: " + taskErr.message);
      addLog(`✅ ${taskRes?.inserted || 0} oppgaver importert`);
      setProgress(90);

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
      <h1 className="text-[1.375rem] font-bold">Salesforce CSV Re-import</h1>
      <p className="text-[0.8125rem] text-muted-foreground">
        Last opp 4 CSV-filer fra Salesforce Data Export. All eksisterende data slettes og erstattes.
      </p>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-label">1. Account.csv (selskaper)</label>
          <input type="file" accept=".csv" onChange={e => setAccountsFile(e.target.files?.[0] || null)} className="block w-full text-[0.8125rem]" />
          {accountsFile && <p className="text-[0.75rem] text-muted-foreground">✓ {accountsFile.name}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-label">2. Contact.csv (kontakter)</label>
          <input type="file" accept=".csv" onChange={e => setContactsFile(e.target.files?.[0] || null)} className="block w-full text-[0.8125rem]" />
          {contactsFile && <p className="text-[0.75rem] text-muted-foreground">✓ {contactsFile.name}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-label">3. Task.csv (oppgaver og samtaler)</label>
          <input type="file" accept=".csv" onChange={e => setTasksFile(e.target.files?.[0] || null)} className="block w-full text-[0.8125rem]" />
          {tasksFile && <p className="text-[0.75rem] text-muted-foreground">✓ {tasksFile.name}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-label">4. Event.csv (møter og hendelser)</label>
          <input type="file" accept=".csv" onChange={e => setEventsFile(e.target.files?.[0] || null)} className="block w-full text-[0.8125rem]" />
          {eventsFile && <p className="text-[0.75rem] text-muted-foreground">✓ {eventsFile.name}</p>}
        </div>
      </div>

      {progress > 0 && <Progress value={progress} className="h-2" />}

      <Button onClick={runImport} disabled={running || !accountsFile || !contactsFile || !tasksFile || !eventsFile} className="rounded-lg h-10 px-5 text-[0.8125rem] font-medium">
        {running ? "Importerer..." : "Start re-import"}
      </Button>

      {log.length > 0 && (
        <div ref={logRef} className="bg-secondary rounded-lg border border-border p-4 max-h-80 overflow-y-auto font-mono text-[0.75rem] space-y-1">
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
};

export default Import;
