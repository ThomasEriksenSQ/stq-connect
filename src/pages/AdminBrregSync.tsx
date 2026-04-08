import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

function cleanOrgNumber(raw: string): string | null {
  let s = raw.replace(/\s/g, "").replace(/^NO/i, "").replace(/MVA$/i, "");
  return /^\d{9}$/.test(s) ? s : null;
}

export default function AdminBrregSync() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [log, setLog] = useState<string[]>([]);

  const sync = async () => {
    setRunning(true);
    setLog([]);
    setProgress("Henter selskaper...");

    const { data: companies, error } = await supabase
      .from("companies")
      .select("id, name, org_number")
      .is("city", null)
      .not("org_number", "is", null)
      .limit(2000);

    if (error || !companies) {
      setProgress(`Feil: ${error?.message}`);
      setRunning(false);
      return;
    }

    let updated = 0;
    let skipped = 0;

    const BATCH = 5;

    for (let i = 0; i < companies.length; i += BATCH) {
      const chunk = companies.slice(i, i + BATCH);
      setProgress(`Oppdaterer ${Math.min(i + BATCH, companies.length)} av ${companies.length}...`);

      await Promise.all(chunk.map(async (c) => {
        const orgnr = cleanOrgNumber(c.org_number!);
        if (!orgnr) {
          skipped++;
          setLog(prev => [...prev, `⏭ ${c.name}: ugyldig orgnr "${c.org_number}"`]);
          return;
        }
        try {
          const res = await fetch(`https://data.brreg.no/enhetsregisteret/api/enheter/${orgnr}`);
          if (!res.ok) {
            setLog(prev => [...prev, `⚠ ${c.name}: BRREG ${res.status}`]);
            skipped++;
          } else {
            const data = await res.json();
            const poststed = data?.forretningsadresse?.poststed;
            if (poststed) {
              await supabase.from("companies").update({ city: poststed }).eq("id", c.id);
              updated++;
              setLog(prev => [...prev, `✅ ${c.name} → ${poststed}`]);
            } else {
              skipped++;
              setLog(prev => [...prev, `⏭ ${c.name}: ingen poststed`]);
            }
          }
        } catch (e: any) {
          setLog(prev => [...prev, `❌ ${c.name}: ${e.message}`]);
          skipped++;
        }
      }));
      await delay(300);
    }

    setProgress(`Ferdig! ${updated} oppdatert, ${skipped} hoppet over av ${companies.length}.`);
    setRunning(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-4">
      <h1 className="text-[1.375rem] font-bold">BRREG Stedssynkronisering</h1>
      <p className="text-[0.9375rem] text-foreground/70">
        Henter poststed fra BRREG for alle selskaper der by mangler og org.nr. finnes.
      </p>
      <Button onClick={sync} disabled={running} className="bg-primary text-primary-foreground">
        {running ? "Kjører..." : "Synk steder fra BRREG"}
      </Button>
      {progress && <p className="text-[0.875rem] font-medium">{progress}</p>}
      {log.length > 0 && (
        <div className="bg-muted rounded-lg p-4 max-h-96 overflow-y-auto space-y-1 text-[0.8125rem] font-mono">
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
