import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = "https://kbvzpcebfopqqrvmbiap.supabase.co";

interface ImportLog {
  time: string;
  message: string;
  type: "info" | "success" | "error";
}

export default function Import() {
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [running, setRunning] = useState(false);

  const log = useCallback((message: string, type: ImportLog["type"] = "info") => {
    setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), message, type }]);
  }, []);

  async function callEdgeFunction(body: object) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/salesforce-import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token || ""}`,
      },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  function sheetToRows(wb: XLSX.WorkBook): string[][] {
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    return raw;
  }

  function findHeaderRow(rows: string[][], marker: string): number {
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      if (rows[i].some((c) => String(c).includes(marker))) return i;
    }
    return -1;
  }

  function toPipeRows(rows: string[][], startIdx: number): string[] {
    const result: string[] = [];
    for (let i = startIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((c) => !String(c).trim())) continue;
      result.push(row.map((c) => String(c ?? "")).join("|"));
    }
    return result;
  }

  async function fetchFile(path: string): Promise<XLSX.WorkBook> {
    const res = await fetch(path);
    const buf = await res.arrayBuffer();
    return XLSX.read(buf, { type: "array" });
  }

  async function runImport() {
    setRunning(true);
    setLogs([]);
    try {
      // Step 1: Companies
      log("Laster accounts.xlsx...");
      const accWb = await fetchFile("/import/accounts.xlsx");
      const accRows = sheetToRows(accWb);
      const accHeader = findHeaderRow(accRows, "Account ID");
      if (accHeader === -1) throw new Error("Fant ikke header i accounts");
      const companyRows = toPipeRows(accRows, accHeader);
      log(`Fant ${companyRows.length} selskapsrader. Sender til edge function...`);

      const compResult = await callEdgeFunction({ type: "companies", rows: companyRows });
      if (compResult.error) throw new Error(`Companies error: ${compResult.error}`);
      log(`Selskaper importert: ${compResult.inserted}/${compResult.total}`, "success");
      const accountMap = compResult.account_map || {};

      // Step 2: Contacts
      log("Laster contacts.xlsx...");
      const conWb = await fetchFile("/import/contacts.xlsx");
      const conRows = sheetToRows(conWb);
      const conHeader = findHeaderRow(conRows, "Contact ID");
      if (conHeader === -1) throw new Error("Fant ikke header i contacts");
      const contactRows = toPipeRows(conRows, conHeader);
      log(`Fant ${contactRows.length} kontaktrader. Sender til edge function...`);

      const conResult = await callEdgeFunction({ type: "contacts", rows: contactRows, account_map: accountMap });
      if (conResult.error) throw new Error(`Contacts error: ${conResult.error}`);
      log(`Kontakter importert: ${conResult.inserted}/${conResult.total}`, "success");
      const contactMap = conResult.contact_map || {};

      // Step 3: Tasks
      log("Laster tasks.xlsx...");
      const taskWb = await fetchFile("/import/tasks.xlsx");
      const taskRows = sheetToRows(taskWb);
      const taskHeader = findHeaderRow(taskRows, "Activity ID");
      if (taskHeader === -1) throw new Error("Fant ikke header i tasks");
      const taskPipeRows = toPipeRows(taskRows, taskHeader);
      log(`Fant ${taskPipeRows.length} oppgaverader. Sender til edge function...`);

      const taskResult = await callEdgeFunction({ type: "tasks", rows: taskPipeRows, account_map: accountMap, contact_map: contactMap });
      if (taskResult.error) throw new Error(`Tasks error: ${taskResult.error}`);
      log(`Oppgaver importert: ${taskResult.inserted}/${taskResult.total}`, "success");

      log("✅ Import fullført!", "success");
    } catch (err: any) {
      log(`❌ Feil: ${err.message}`, "error");
      console.error(err);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Salesforce Import</h1>
      <p className="mb-4 text-muted-foreground">
        Importerer selskaper, kontakter og oppgaver fra de opplastede Excel-filene.
      </p>
      <button
        onClick={runImport}
        disabled={running}
        className="bg-primary text-primary-foreground px-6 py-2 rounded-md mb-6 disabled:opacity-50"
      >
        {running ? "Importerer..." : "Start import"}
      </button>
      <div className="bg-muted rounded-md p-4 font-mono text-sm max-h-[500px] overflow-y-auto space-y-1">
        {logs.length === 0 && <p className="text-muted-foreground">Klikk "Start import" for å begynne.</p>}
        {logs.map((l, i) => (
          <div key={i} className={l.type === "error" ? "text-red-500" : l.type === "success" ? "text-green-600" : ""}>
            <span className="text-muted-foreground">[{l.time}]</span> {l.message}
          </div>
        ))}
      </div>
    </div>
  );
}
